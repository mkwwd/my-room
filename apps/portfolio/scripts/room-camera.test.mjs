import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

const sourcePath = fileURLToPath(
  new URL('../src/components/room/RoomCamera.tsx', import.meta.url),
);
const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
  },
});
const compiledModule = { exports: {} };
vm.runInNewContext(compiled.outputText, {
  require: createRequire(sourcePath),
  module: compiledModule,
  exports: compiledModule.exports,
});
const { RoomCameraController } = compiledModule.exports;
const configModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../src/components/room/roomConfig.ts', import.meta.url),
      'utf8',
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { module: configModule, exports: configModule.exports },
);
const { ROOM, ROOM_DEPTH_BOUNDS } = configModule.exports;
const focusPosition = new THREE.Vector3(-4, 2, 2);
const focusTarget = new THREE.Vector3(-6, 2, 2);
const characterPosition = new THREE.Vector3();

function step(controller, delta, mode = 'explore') {
  const frame = controller.beginFrame(delta);
  controller.follow({
    frame,
    mode,
    characterPosition,
    focusPosition,
    focusTarget,
  });
  return frame;
}

function advance(controller, seconds, fps, mode = 'explore') {
  for (let i = 0; i < Math.round(seconds * fps); i++) {
    step(controller, 1 / fps, mode);
  }
}

test('wall tops stay above the exploration viewport on desktop and mobile', () => {
  for (const aspect of [16 / 9, 768 / 1024, 390 / 844, 360 / 800]) {
    const controller = new RoomCameraController(aspect);
    for (const direction of [0, 1, 2, 3]) {
      controller.setView(direction);
      advance(controller, 4, 60);
      controller.camera.updateMatrixWorld(true);
      for (const x of [-ROOM.width / 2, ROOM.width / 2]) {
        for (const z of [ROOM_DEPTH_BOUNDS.back, ROOM_DEPTH_BOUNDS.front]) {
          const top = new THREE.Vector3(x, ROOM.wallHeight, z).applyMatrix4(
            controller.camera.matrixWorldInverse,
          );
          const viewportTop =
            -top.z *
            Math.tan(THREE.MathUtils.degToRad(controller.camera.fov / 2));
          assert.ok(
            top.y > viewportTop,
            `wall top visible: aspect=${aspect}, view=${direction}`,
          );
        }
      }
    }
  }
});

test('an entrance pose hands the same camera to exploration without a jump', () => {
  const controller = new RoomCameraController(16 / 9);
  const start = new THREE.Vector3(0, 3, 18);
  const target = new THREE.Vector3(0, 3, -0.5);
  assert.equal(typeof controller.setPose, 'function');
  controller.setPose(start, target, 38);
  assert.ok(controller.camera.position.equals(start));
  step(controller, 1 / 60);
  assert.ok(controller.camera.position.distanceTo(start) < 0.1);
  assert.ok(controller.camera.fov < 38 && controller.camera.fov > 32);
  advance(controller, 3, 60);
  assert.ok(Math.abs(controller.camera.position.z - 15) < 0.01);
});

test('a click does not show the front wall before the camera moves inside', () => {
  const controller = new RoomCameraController(16 / 9);
  const walls = Object.fromEntries(
    ['front', 'back', 'left', 'right'].map((name) => [name, new THREE.Group()]),
  );
  const update = () => controller.updateWallVisibility(walls, 13.4, 18.6, -0.7);
  update();
  assert.equal(walls.front.visible, false);
  controller.rotate(1);
  update();
  assert.equal(walls.front.visible, false);
  advance(controller, 2, 60);
  update();
  assert.equal(walls.front.visible, true);
  assert.equal(walls.right.visible, false);
});

test('three rapid right clicks keep rotating right', () => {
  const controller = new RoomCameraController(16 / 9);
  assert.equal(controller.rotate(1), 1);
  assert.equal(controller.rotate(1), 2);
  assert.equal(controller.rotate(1), 3);
  assert.ok(step(controller, 1 / 60).forward.x < 0);
  advance(controller, 3, 60);
  assert.ok(controller.camera.position.x < -14);
  assert.ok(Math.abs(controller.camera.position.z) < 0.01);
});

test('rotation eases into motion instead of starting at maximum speed', () => {
  const controller = new RoomCameraController(16 / 9);
  controller.rotate(1);
  const angles = [0];
  for (let i = 0; i < 3; i++) {
    const { forward } = step(controller, 1 / 60);
    angles.push(Math.atan2(-forward.x, -forward.z));
  }
  assert.ok(angles[1] < 0.02);
  assert.ok(angles[2] - angles[1] > angles[1]);
  assert.ok(angles[3] - angles[2] > angles[2] - angles[1]);
});

test('focus converges equally at 10, 30, 60 and 120 FPS', () => {
  const results = [10, 30, 60, 120].map((fps) => {
    const controller = new RoomCameraController(16 / 9);
    advance(controller, 1, fps, 'computer');
    assert.ok(controller.camera.position.distanceTo(focusPosition) < 0.06);
    return controller.camera;
  });
  for (const camera of results.slice(1)) {
    assert.ok(camera.position.distanceTo(results[0].position) < 1e-9);
    assert.ok(Math.abs(camera.fov - results[0].fov) < 0.0001);
  }
});

test('exiting focus mid-transition preserves momentum and returns to the room', () => {
  const controller = new RoomCameraController(16 / 9);
  const initial = controller.camera.position.clone();
  advance(controller, 0.2, 60, 'computer');
  const before = controller.camera.position.clone();
  step(controller, 1 / 6000);
  assert.ok(controller.camera.position.distanceTo(before) < 0.02);
  advance(controller, 3, 60);
  assert.ok(controller.camera.position.distanceTo(initial) < 0.001);
  assert.ok(Math.abs(controller.camera.fov - 32) < 0.001);
});

test('all four views and focus return remain finite on desktop and mobile', () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    const controller = new RoomCameraController(aspect);
    for (let direction = 0; direction < 4; direction++) {
      controller.setView(direction);
      advance(controller, 3, 30);
      controller.camera.updateMatrixWorld();
      const player = new THREE.Vector3(0, 1, 0).project(controller.camera);
      assert.ok(Math.abs(player.x) < 1 && Math.abs(player.y) < 1);
      assert.ok(controller.camera.position.toArray().every(Number.isFinite));
    }
    advance(controller, 3, 30, 'computer');
    assert.ok(controller.camera.position.distanceTo(focusPosition) < 0.001);
    advance(controller, 3, 30);
    assert.ok(controller.camera.position.toArray().every(Number.isFinite));
  }
});
