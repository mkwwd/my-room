import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

const path = fileURLToPath(
  new URL('../src/components/room/RoomEntrance.ts', import.meta.url),
);
let Entrance;
if (existsSync(path)) {
  const compiledModule = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      require: createRequire(path),
      exports: compiledModule.exports,
      module: compiledModule,
    },
  );
  Entrance = compiledModule.exports.default;
}

test('the door waits for assets and the cat, crosses into the room and settles into exploration', () => {
  assert.equal(typeof Entrance, 'function');
  const end = new THREE.Vector3(0, 10.5, 15);
  const entry = new Entrance(end, 16 / 9, 8.6);
  entry.update(5, false, null, false);
  assert.equal(entry.opening, false);
  entry.update(1, true, entry.catStart, false);
  assert.equal(entry.opening, false);
  const cat = entry.catTarget.clone();
  entry.update(0.016, true, cat, false);
  assert.equal(entry.opening, true);
  let crossed = false;
  let continued = false;
  let lastZ = entry.cameraPosition.z;
  for (let i = 0; i < 360; i++) {
    entry.update(1 / 60, true, cat, false);
    if (!entry.entered) assert.ok(entry.cameraPosition.z <= lastZ + 0.0001);
    if (crossed && entry.cameraPosition.z < lastZ - 0.0001) continued = true;
    if (!crossed && entry.cameraPosition.z < entry.doorZ) {
      crossed = true;
      assert.ok(entry.cameraPosition.y > 0.2 && entry.cameraPosition.y < 4.4);
      assert.ok(Math.abs(entry.cameraPosition.x) < 1.4);
    }
    lastZ = entry.cameraPosition.z;
  }
  assert.ok(crossed && continued && entry.complete);
  assert.ok(entry.cameraPosition.distanceTo(end) < 0.001);
  entry.dispose();
});

test('reduced motion finishes on the exploration pose without a camera flight', () => {
  assert.equal(typeof Entrance, 'function');
  const end = new THREE.Vector3(0, 25, 46);
  const entry = new Entrance(end, 390 / 844, 8.6);
  entry.update(0.016, true, entry.catStart, true);
  assert.ok(entry.complete);
  assert.ok(entry.cameraPosition.equals(end));
  entry.dispose();
});

test('the door is framed straight on and entry has no sideways drift or lens zoom', () => {
  const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), 16 / 9, 8.6);
  assert.equal(entry.cameraPosition.x, 0);
  assert.equal(entry.cameraTarget.x, 0);
  assert.equal(entry.cameraPosition.y, entry.cameraTarget.y);
  assert.equal(entry.fov, 32);
  const eyeHeight = entry.cameraPosition.y;
  const cat = entry.catTarget.clone();
  let previousHeight = eyeHeight;
  for (let i = 0; i < 360; i++) {
    entry.update(1 / 60, true, cat, false);
    assert.equal(entry.cameraPosition.x, 0);
    assert.equal(entry.cameraTarget.x, 0);
    assert.equal(entry.fov, 32);
    assert.ok(entry.cameraPosition.y >= previousHeight - 0.00001);
    if (!entry.entered) {
      assert.ok(Math.abs(entry.cameraPosition.y - eyeHeight) < 1e-9);
      assert.ok(Math.abs(entry.cameraTarget.y - eyeHeight) < 1e-9);
    }
    previousHeight = entry.cameraPosition.y;
  }
  entry.dispose();
});

test('the threshold touches the actual room, independently of the overview camera distance', () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    const entry = new Entrance(
      new THREE.Vector3(0, aspect > 1 ? 10.5 : 25, aspect > 1 ? 15 : 46),
      aspect,
      8.6,
    );
    assert.equal(entry.doorZ, 8.6);
    assert.equal(
      entry.catStart.x,
      -2.6,
      'keep the existing approach from the left',
    );
    assert.ok(Math.abs(entry.catStart.z - entry.doorZ - 3.5) < 0.001);
    const distance = entry.cameraPosition.z - entry.doorZ;
    const visibleWidth =
      2 * distance * Math.tan(THREE.MathUtils.degToRad(entry.fov / 2)) * aspect;
    assert.ok(visibleWidth > 3.45, 'the door frame must still fit on mobile');
    entry.dispose();
  }
});

test('footprints are deposited at foot contacts, not progress changes or idle frames', () => {
  assert.equal(typeof Entrance, 'function');
  const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), 16 / 9, 8.6);
  const cat = new THREE.Group();
  const foot = new THREE.Bone();
  foot.name = 'tripo0_Left_Limb_3';
  cat.add(foot);
  for (const height of [0.16, 0.1, 0.05, 0.06]) {
    foot.position.set(0.1, height, entry.doorZ + 1);
    entry.updateFootprints(cat, 1 / 60);
  }
  assert.equal(
    entry.footprints.children.filter((mark) => mark.visible).length,
    1,
  );
  for (let i = 0; i < 60; i++) entry.updateFootprints(cat, 1 / 60);
  assert.equal(
    entry.footprints.children.filter((mark) => mark.visible).length,
    1,
  );
  entry.dispose();
});
