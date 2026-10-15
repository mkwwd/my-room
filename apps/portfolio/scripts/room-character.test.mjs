import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
    require: (id) => {
      if (id === 'three') return THREE;
      if (id.endsWith('/GLTFLoader.js')) return { GLTFLoader };
      if (id.endsWith('/DRACOLoader.js')) return { DRACOLoader };
      return id.startsWith('./')
        ? loadSource(id.slice(2))
        : createRequire(path)(id);
    },
  });
  return compiledModule.exports;
}

const Controller = loadSource('RoomCharacter').default;
const { ROOM, ROOM_COLLISION_BOXES, ROOM_SEATS } = loadSource('roomConfig');

function setup(t) {
  const model = new THREE.Group();
  const head = new THREE.Group();
  head.name = 'Head';
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  geometry.morphAttributes.position = [geometry.attributes.position.clone()];
  const eyelids = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ transparent: true }),
  );
  eyelids.name = 'Eyelids';
  eyelids.material.name = 'EyelidSkin';
  head.add(eyelids);
  model.add(head);
  const animations = [
    new THREE.AnimationClip('Walking', 1, [
      new THREE.NumberKeyframeTrack(
        'Head.rotation[x]',
        [0, 0.5, 1],
        [0, 0.1, 0],
      ),
    ]),
    new THREE.AnimationClip('Sitting', 1, [
      new THREE.NumberKeyframeTrack('Head.rotation[x]', [0, 1], [0, 0.5]),
    ]),
    new THREE.AnimationClip('Blink', 0.3, [
      new THREE.NumberKeyframeTrack(
        'Eyelids.morphTargetInfluences[0]',
        [0, 0.1, 0.14, 0.3],
        [0, 1, 1, 0],
      ),
    ]),
  ];
  // Only replace browser asset I/O; movement and AnimationMixer remain real.
  t.mock.method(DRACOLoader.prototype, 'preload', function () {
    return this;
  });
  t.mock.method(GLTFLoader.prototype, 'load', (_url, ready) =>
    ready({ scene: model, animations }),
  );
  const controller = new Controller({
    manager: new THREE.LoadingManager(),
    initialPosition: [0, 0, 0.25],
    limitX: ROOM.playerLimitX,
    limitZ: ROOM.playerLimitZ,
    collisionBoxes: ROOM_COLLISION_BOXES,
    seats: ROOM_SEATS,
  });
  t.after(() => controller.dispose());
  let elapsed = 0;
  function advance(seconds, movementEnabled = true) {
    const weights = [];
    for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
      elapsed += 1 / 60;
      controller.update({
        delta: 1 / 60,
        elapsedTime: elapsed,
        movementEnabled,
        viewForward: new THREE.Vector3(0, 0, -1),
        viewRight: new THREE.Vector3(1, 0, 0),
      });
      weights.push(eyelids.morphTargetInfluences[0]);
    }
    return weights;
  }
  return { controller, head, eyelids, advance };
}

test('clicking the right-hand aisle after sitting can reach the open floor', (t) => {
  const { controller, advance } = setup(t);
  controller.tryToggleSeat('sofa', { ignoreDistance: true });
  advance(2);
  const destination = new THREE.Vector3(3, 0, -1.8);
  controller.moveTo(destination);
  advance(4);
  assert.ok(
    controller.object.position.distanceTo(destination) < 0.05,
    `right aisle blocked at ${controller.object.position.toArray()}`,
  );
});

test('keyboard movement can round the right arm but cannot pass through the sofa', (t) => {
  const { controller, advance } = setup(t);
  controller.tryToggleSeat('sofa', { ignoreDistance: true });
  controller.pressKey('d');
  advance(0.5);
  controller.releaseKey('d');
  assert.ok(controller.object.position.x > 2.7);
  controller.pressKey('s');
  advance(1);
  controller.releaseKey('s');
  assert.ok(
    controller.object.position.z > -1,
    'walk through the visible side aisle',
  );
  controller.moveTo(new THREE.Vector3(0, 0, 0));
  advance(3);
  controller.pressKey('w');
  advance(2);
  assert.ok(
    controller.object.position.z > -2.7,
    'the sofa itself remains solid',
  );
});

test('standing up without walking finishes the seated animation fade', (t) => {
  const { controller, head, advance } = setup(t);
  controller.tryToggleSeat('sofa', { ignoreDistance: true });
  advance(2);
  assert.ok(head.rotation.x > 0.4);
  controller.tryToggleSeat('sofa');
  advance(0.5);
  assert.ok(
    Math.abs(head.rotation.x) < 0.01,
    'restore the standing pose while idle',
  );
});

test('eyelid blending and shadow settings survive room model preparation', (t) => {
  const { eyelids } = setup(t);
  assert.equal(eyelids.material.transparent, true);
  assert.equal(eyelids.castShadow, false);
});

for (const state of ['idle', 'walking', 'sitting', 'focus']) {
  test(`blinks close and reopen independently while ${state}`, (t) => {
    const { controller, advance } = setup(t);
    if (state === 'walking') {
      controller.object.position.set(-5, 0, 0);
      controller.pressKey('d');
    }
    if (state === 'sitting')
      controller.tryToggleSeat('sofa', { ignoreDistance: true });
    const weights = advance(3, state !== 'focus');
    assert.ok(Math.max(...weights) > 0.95, 'reach a fully closed eye');
    assert.equal(weights.at(-1), 0, 'eyes reopen');
    assert.ok(
      Math.max(...advance(7, state !== 'focus')) > 0.95,
      'blink again without resetting movement',
    );
  });
}

test('chair faces the monitor and keeps its seated height during computer focus', (t) => {
  const { controller, advance } = setup(t);
  assert.equal(
    controller.tryToggleSeat('chair', { ignoreDistance: true }),
    true,
  );
  advance(3, false);
  assert.deepEqual(controller.object.position.toArray(), [
    ...ROOM_SEATS.chair.position,
  ]);
  assert.equal(controller.object.rotation.y, ROOM_SEATS.chair.rotationY);
  controller.tryToggleNearbySeat();
  advance(0.5);
  assert.deepEqual(controller.object.position.toArray(), [
    ...ROOM_SEATS.chair.exitPosition,
  ]);
});

test('chair exit is clear and keyboard and floor clicks can leave the desk', (t) => {
  const { controller, advance } = setup(t);
  controller.tryToggleSeat('chair', { ignoreDistance: true });
  controller.pressKey('d');
  advance(0.7);
  controller.releaseKey('d');
  assert.ok(controller.object.position.x > -1.2);
  controller.tryToggleSeat('chair', { ignoreDistance: true });
  const destination = new THREE.Vector3(0, 0, 4.2);
  controller.moveTo(destination);
  advance(3);
  assert.ok(controller.object.position.distanceTo(destination) < 0.01);
});

test('E selects the nearest reachable seat and switching seats keeps the correct exit', (t) => {
  const { controller, advance } = setup(t);
  assert.equal(controller.tryToggleNearbySeat(), false);
  controller.object.position.set(...ROOM_SEATS.chair.exitPosition);
  assert.equal(controller.tryToggleNearbySeat(), true);
  assert.deepEqual(controller.object.position.toArray(), [
    ...ROOM_SEATS.chair.position,
  ]);
  assert.equal(
    controller.tryToggleSeat('sofa', { ignoreDistance: true }),
    true,
  );
  assert.deepEqual(controller.object.position.toArray(), [
    ...ROOM_SEATS.sofa.position,
  ]);
  controller.tryToggleNearbySeat();
  advance(0.5);
  assert.deepEqual(controller.object.position.toArray(), [
    ...ROOM_SEATS.sofa.exitPosition,
  ]);
});
