import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

function loadSource(name, overrides = {}) {
  const path = fileURLToPath(
    new URL(`../src/components/room/${name}.ts`, import.meta.url),
  );
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (id) =>
      overrides[id] ??
      (id.startsWith('./')
        ? loadSource(id.slice(2), overrides)
        : createRequire(path)(id)),
  });
  return compiledModule.exports;
}

test('wall fill follows the switch and the subtly brighter wood retains its texture without glowing', () => {
  class AssetStub {
    isDaytime = true;
    update() {}
    dispose() {}
  }
  const Environment = loadSource('RoomEnvironment', {
    './RoomFurniture': { default: AssetStub },
    './RoomPinboard': { default: AssetStub },
    './RoomWindow': { default: AssetStub },
    three: {
      ...createRequire(import.meta.url)('three'),
      TextureLoader: class {
        load() {
          return new THREE.Texture();
        }
      },
    },
  }).default;
  for (const isDaytime of [true, false]) {
    const room = new Environment(new THREE.Scene(), new THREE.LoadingManager());
    assert.ok(room.walls.back.getObjectByName('wall-clock'));
    room.roomWindow.isDaytime = isDaytime;
    const materials = ['back', 'front', 'right'].map(
      (name) => room.walls[name].material,
    );
    room.update(0, 1, false);
    for (const material of materials) {
      assert.equal(material.color.getHexString(), 'ffffff');
      assert.ok(material.emissiveIntensity >= 0.55);
      assert.ok(material.emissive.r > 0);
      assert.equal(material.emissiveMap, material.map);
      assert.ok(material.bumpMap && material.vertexColors);
      assert.ok(material.bumpScale <= 0.002);
      const grain = material.map.image.data.filter(
        (_value, index) => index % 4 === 0,
      );
      const darkest = Math.min(...grain);
      const lightest = Math.max(...grain);
      assert.ok(darkest >= 250 && lightest - darkest <= 5);
      assert.ok(lightest > darkest, 'keep a subtle paper grain');
    }
    const floor = room.floorPickTargets[0].material;
    assert.ok(floor.color.r > 1 && floor.color.r <= 1.1);
    assert.equal(floor.color.r, floor.color.g);
    assert.equal(floor.color.g, floor.color.b);
    assert.ok(floor.map && floor.bumpMap === floor.map);
    assert.equal(floor.emissive.getHex(), 0);
    const fillBefore = materials[0].emissiveIntensity;
    assert.equal(room.toggleLights(), false);
    room.update(1 / 60, 1 / 60, false);
    assert.ok(
      materials[0].emissiveIntensity > 0 &&
        materials[0].emissiveIntensity < fillBefore,
    );
    for (let i = 1; i <= 120; i++) room.update(i / 60, 1 / 60, false);
    for (const material of materials)
      assert.ok(material.emissiveIntensity < 0.001);
    room.toggleLights();
    room.update(3, 1, false);
    for (const material of materials)
      assert.ok(material.emissiveIntensity >= 0.55);
    room.dispose();
    assert.equal(room.walls.back.getObjectByName('wall-clock'), undefined);
  }
});

test('room switch fades indoor lights without turning off morning or night window light', () => {
  const RoomLighting = loadSource('RoomLighting').default;
  for (const isDaytime of [true, false]) {
    const root = new THREE.Group();
    const lighting = new RoomLighting(root);
    lighting.update(1, isDaytime);
    const windowBefore = lighting.windowLight.intensity;
    assert.ok(windowBefore > 0);
    lighting.toggle();
    lighting.update(1 / 60, isDaytime);
    assert.ok(lighting.indoorLevel > 0 && lighting.indoorLevel < 1);
    for (let i = 0; i < 120; i++) lighting.update(1 / 60, isDaytime);
    assert.ok(lighting.indoorLevel < 0.001);
    assert.equal(lighting.windowLight.intensity, windowBefore);
    assert.equal(lighting.isOn, false);
    lighting.toggle();
    lighting.update(1, isDaytime);
    assert.ok(lighting.indoorLevel > 0.99);
    lighting.dispose();
    assert.equal(root.children.length, 0);
  }
});

test('door and switch attach to the wall opposite the TV and hidden switches cannot be picked', () => {
  const RoomDoor = loadSource('RoomDoor').default;
  const front = new THREE.Mesh();
  front.position.set(0, 4, 8.76);
  const door = new RoomDoor(front);
  front.updateMatrixWorld(true);
  assert.ok(door.hintAnchor.z > 8 && door.hintAnchor.z < 8.6);
  assert.ok(Math.abs(door.hintAnchor.x) > 1);
  const ray = new THREE.Raycaster(
    door.hintAnchor.clone().add(new THREE.Vector3(0, 0, -2)),
    new THREE.Vector3(0, 0, 1),
  );
  assert.equal(door.isPointerOver(ray), true);
  front.visible = false;
  assert.equal(door.isPointerOver(ray), false);
  door.dispose();
  assert.equal(front.children.length, 0);
});
