import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

function loadSource(name) {
  const path = fileURLToPath(
    new URL(`../src/components/room/${name}.ts`, import.meta.url),
  );
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    require: (id) =>
      id.startsWith('./') ? loadSource(id.slice(2)) : createRequire(path)(id),
  });
  return module.exports;
}

test('the four-lobed lamp stands left of the TV, has a collision footprint and uses one shadow-free light', () => {
  const Lamp = loadSource('RoomFloorLamp').default;
  const { ROOM_COLLISION_BOXES } = loadSource('roomConfig');
  const scene = new THREE.Group();
  const lamp = new Lamp(scene);
  const root = scene.getObjectByName('floor-lamp');
  const shade = root.getObjectByName('lamp-shade');
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x > -5 && bounds.max.x < -3.2);
  assert.ok(bounds.min.z > -10 && bounds.max.z < -8);
  assert.ok(
    bounds.min.y >= 0 &&
      bounds.min.y < 0.03 &&
      bounds.max.y > 5.5 &&
      bounds.max.y < 5.7,
  );
  assert.ok(
    ROOM_COLLISION_BOXES.some(
      (box) =>
        Math.abs(box.centerX + 4.15) < 0.1 &&
        Math.abs(box.centerZ + 8.98) < 0.1 &&
        box.centerX - box.halfWidth <= bounds.min.x &&
        box.centerX + box.halfWidth >= bounds.max.x &&
        box.centerZ - box.halfDepth <= bounds.min.z &&
        box.centerZ + box.halfDepth >= bounds.max.z,
    ),
  );
  const profile = shade.geometry.parameters.points;
  let peaks = 0;
  for (let i = 1; i < profile.length - 1; i++)
    if (profile[i].x > profile[i - 1].x && profile[i].x > profile[i + 1].x)
      peaks++;
  assert.equal(peaks, 4);
  let triangles = 0;
  let lights = 0;
  root.traverse((object) => {
    if (object.isLight) {
      lights++;
      assert.equal(object.castShadow, false);
    }
    if (object.isMesh)
      triangles +=
        (object.geometry.index?.count ??
          object.geometry.attributes.position.count) / 3;
  });
  assert.equal(lights, 1);
  assert.ok(triangles < 24000);
  const ray = new THREE.Raycaster(
    lamp.hintAnchor.clone().add(new THREE.Vector3(0, 0, 3)),
    new THREE.Vector3(0, 0, -1),
  );
  assert.equal(lamp.isPointerOver(ray), true);
  ray.ray.origin.x += 0.85;
  assert.equal(lamp.isPointerOver(ray), false);
  ray.ray.origin.set(-4.15, 5.3, -5.98);
  assert.equal(lamp.isPointerOver(ray), true);
  lamp.dispose();
});

test('warm white cycles to peach, fully off and back, with smooth frame-rate-independent transitions', () => {
  const Lamp = loadSource('RoomFloorLamp').default;
  for (const fps of [15, 60]) {
    const scene = new THREE.Group();
    const lamp = new Lamp(scene);
    const root = scene.getObjectByName('floor-lamp');
    const light = root.getObjectByName('lamp-light');
    const material = root.getObjectByName('lamp-shade').material;
    const warm = light.color.clone();
    const intensity = light.intensity;
    assert.equal(lamp.mode, 'warm');
    assert.ok(intensity > 0 && material.emissiveIntensity > 0);
    assert.equal(lamp.cycle(), 'peach');
    assert.equal(light.color.equals(warm), true);
    lamp.update(1 / fps, false);
    assert.ok(light.color.g < warm.g && light.color.g > 0.2);
    for (let i = 0; i < fps; i++) lamp.update(1 / fps, false);
    assert.ok(light.color.g < warm.g * 0.85);
    assert.equal(lamp.cycle(), 'off');
    lamp.update(1 / fps, false);
    assert.ok(light.intensity > 0 && light.intensity < intensity);
    for (let i = 0; i < fps * 2; i++) lamp.update(1 / fps, false);
    assert.equal(light.intensity, 0);
    assert.equal(material.emissiveIntensity, 0);
    assert.equal(lamp.cycle(), 'warm');
    lamp.update(1, false);
    assert.ok(Math.abs(light.intensity - intensity) < 0.01);
    assert.ok(Math.abs(light.color.g - warm.g) < 0.01);
    lamp.dispose();
  }
});

test('disposing the lamp releases shared resources once and prevents further light changes or picking', () => {
  const Lamp = loadSource('RoomFloorLamp').default;
  const scene = new THREE.Group();
  const lamp = new Lamp(scene);
  const root = scene.getObjectByName('floor-lamp');
  const resources = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    for (const resource of [
      object.geometry,
      object.material,
      object.material.map,
    ].filter(Boolean))
      resources.set(resource, 0);
  });
  for (const resource of resources.keys())
    resource.addEventListener('dispose', () =>
      resources.set(resource, resources.get(resource) + 1),
    );
  lamp.dispose();
  lamp.dispose();
  assert.equal(scene.children.length, 0);
  for (const count of resources.values()) assert.equal(count, 1);
  const before = lamp.mode;
  lamp.cycle();
  lamp.update(1, true);
  assert.equal(lamp.mode, before);
  assert.equal(lamp.isPointerOver(new THREE.Raycaster()), false);
});
