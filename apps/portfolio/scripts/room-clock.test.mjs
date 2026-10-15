import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

function loadSource(name, clock = Date) {
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
    Date: clock,
    require: (id) =>
      id.startsWith('./')
        ? loadSource(id.slice(2), clock)
        : createRequire(path)(id),
  });
  return compiledModule.exports;
}

function assertHands(root, hours, minutes, seconds) {
  for (const [name, angle] of [
    ['hour-hand', (hours * Math.PI) / 6],
    ['minute-hand', (minutes * Math.PI) / 30],
    ['second-hand', (seconds * Math.PI) / 30],
  ]) {
    assert.ok(
      Math.abs(root.getObjectByName(name).rotation.z + angle) < 1e-10,
      `${name} must point clockwise at the device's local time`,
    );
  }
}

test('clock matches local time on first render and catches up after a suspended tab', () => {
  let now = new Date(2026, 8, 29, 15, 15, 30, 500);
  class DeviceDate extends Date {
    constructor() {
      super(now.getTime());
    }
  }
  const Clock = loadSource('RoomWallClock', DeviceDate).default;
  const wall = new THREE.Group();
  const clock = new Clock(wall);
  const root = wall.getObjectByName('wall-clock');
  const minute = 15 + 30.5 / 60;
  assertHands(root, 3 + minute / 60, minute, 30.5);

  now = new Date(2026, 8, 29, 23, 59, 59, 900);
  clock.update();
  assertHands(root, 11 + (59 + 59.9 / 60) / 60, 59 + 59.9 / 60, 59.9);
  now = new Date(2026, 8, 30, 0, 0, 0, 0);
  clock.update();
  assertHands(root, 0, 0, 0);
  now = new Date(2026, 8, 30, 12, 0, 0, 0);
  clock.update();
  assertHands(root, 0, 0, 0);
  clock.dispose();
});

test('clock sits on the back wall beside the TV without adding lights or a heavy model', () => {
  const Clock = loadSource('RoomWallClock').default;
  const { ROOM, WALL_THICKNESS } = loadSource('roomConfig');
  const wall = new THREE.Group();
  wall.position.set(
    0,
    ROOM.wallHeight / 2,
    -ROOM.depth / 2 - WALL_THICKNESS / 2,
  );
  const clock = new Clock(wall);
  const root = wall.getObjectByName('wall-clock');
  wall.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(bounds.min.x > 3.1 && bounds.max.x < ROOM.width / 2 - 0.5);
  assert.ok(bounds.min.y > 3.5 && bounds.max.y < 5.8);
  assert.ok(bounds.min.z >= -ROOM.depth / 2);
  assert.ok(bounds.max.z < -ROOM.depth / 2 + 0.4);
  let meshes = 0;
  let triangles = 0;
  root.traverse((object) => {
    assert.ok(!object.isLight);
    if (!object.isMesh) return;
    meshes++;
    triangles +=
      ((object.geometry.index?.count ??
        object.geometry.attributes.position.count) /
        3) *
      (object.isInstancedMesh ? object.count : 1);
  });
  assert.ok(meshes <= 12);
  assert.ok(triangles < 6000);
  wall.visible = false;
  let visibleMeshes = 0;
  wall.traverseVisible((object) => {
    if (object.isMesh) visibleMeshes++;
  });
  assert.equal(visibleMeshes, 0);
  clock.dispose();
});

test('disposing the clock releases each geometry and material once and preserves the wall', () => {
  const Clock = loadSource('RoomWallClock').default;
  const wall = new THREE.Group();
  const existingDecoration = new THREE.Group();
  wall.add(existingDecoration);
  const clock = new Clock(wall);
  const resources = new Map();
  wall.getObjectByName('wall-clock').traverse((object) => {
    if (!object.isMesh) return;
    for (const resource of [object.geometry, object.material])
      resources.set(resource, 0);
  });
  for (const resource of resources.keys())
    resource.addEventListener('dispose', () =>
      resources.set(resource, resources.get(resource) + 1),
    );
  clock.dispose();
  clock.dispose();
  assert.deepEqual(wall.children, [existingDecoration]);
  for (const count of resources.values()) assert.equal(count, 1);
});

test('the porcelain dial has twelve raised hour markers and its soft fill follows the room lights', () => {
  const Clock = loadSource('RoomWallClock').default;
  const wall = new THREE.Group();
  const clock = new Clock(wall);
  const root = wall.getObjectByName('wall-clock');
  const markers = root.children.filter((object) => object.isInstancedMesh);
  assert.equal(
    markers.reduce((count, mesh) => count + mesh.count, 0),
    12,
  );
  const dial = root.getObjectByName('clock-dial');
  const casing = root.getObjectByName('clock-case');
  assert.ok(dial.material.color.r > 0.9 && dial.material.color.b > 0.9);
  assert.ok(casing.material.color.r > casing.material.color.g);
  assert.ok(casing.material.color.g > casing.material.color.b);
  clock.update(1);
  const litFill = dial.material.emissiveIntensity;
  assert.ok(litFill > 0.15 && litFill <= 0.4);
  clock.update(0.5);
  assert.equal(dial.material.emissiveIntensity, litFill / 2);
  clock.update(0);
  assert.equal(dial.material.emissiveIntensity, 0);
  clock.dispose();
});
