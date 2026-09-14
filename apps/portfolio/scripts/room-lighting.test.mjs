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
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (id) =>
      id.startsWith('./') ? loadSource(id.slice(2)) : createRequire(path)(id),
  });
  return compiledModule.exports;
}

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
