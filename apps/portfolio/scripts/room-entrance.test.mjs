import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

function loadSource(url) {
  const path = fileURLToPath(url);
  const compiledModule = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      require: (id) =>
        id.startsWith('.')
          ? loadSource(new URL(`${id}.ts`, url))
          : createRequire(path)(id),
      exports: compiledModule.exports,
      module: compiledModule,
    },
  );
  return compiledModule.exports;
}
const Entrance = loadSource(
  new URL('../src/components/room/RoomEntrance.ts', import.meta.url),
).default;

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

test('only the soft cat shadow follows the cat, without a footprint trail', () => {
  const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), 16 / 9, 8.6);
  const cat = new THREE.Group();
  const decals = [];
  entry.root.traverse((object) => {
    if (object.isMesh && object.material.isMeshBasicMaterial)
      decals.push(object);
  });
  assert.equal(decals.length, 1, 'one soft shadow, no pooled paw decals');
  const shadow = decals[0];
  entry.updateCatShadow(cat);
  assert.equal(shadow.visible, false, 'no shadow before the cat loads');
  cat.add(new THREE.Group());
  for (let i = 0; i < 60; i++) {
    cat.position.set(-2.5 + i * 0.025, 0, entry.doorZ + 3 - i * 0.02);
    entry.updateCatShadow(cat);
    assert.equal(shadow.visible, true);
    assert.ok(Math.abs(shadow.position.x - cat.position.x) < 0.1);
    assert.ok(Math.abs(shadow.position.z - cat.position.z) < 0.1);
  }
  assert.ok(shadow.material.map?.isDataTexture);
  entry.dispose();
});

test('the garden is framed on desktop and mobile without blocking the cat or doorway', () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), aspect, 8.6);
    const garden = entry.root.getObjectByName('EntranceGarden');
    assert.ok(garden, '3D front garden');
    entry.root.updateMatrixWorld(true);
    const mailbox = garden.getObjectByName('Mailbox');
    const mailboxBody = mailbox.children.find(
      (object) => object.geometry?.type === 'ExtrudeGeometry',
    );
    assert.ok(
      mailboxBody.material.color.r > mailboxBody.material.color.g * 2 &&
        mailboxBody.material.color.r > mailboxBody.material.color.b * 2,
      'red mailbox body',
    );
    const bounds = new THREE.Box3().setFromObject(mailbox);
    assert.ok(bounds.min.x > 1.8, 'mailbox stays right of the door');
    const camera = new THREE.PerspectiveCamera(entry.fov, aspect, 0.1, 100);
    camera.position.copy(entry.cameraPosition);
    camera.lookAt(entry.cameraTarget);
    camera.updateMatrixWorld(true);
    for (const corner of [bounds.min, bounds.max]) {
      const point = corner.clone().project(camera);
      assert.ok(
        Math.abs(point.x) < 0.97 && Math.abs(point.y) < 0.97,
        'mailbox fits',
      );
    }
    const stems = garden.getObjectByName('TulipStems');
    assert.ok(stems.count >= 15 && stems.count <= 24, 'smaller flower groups');
    const positions = [];
    const matrix = new THREE.Matrix4();
    const approach = new THREE.Line3(entry.catStart, entry.catTarget);
    for (let i = 0; i < stems.count; i++) {
      stems.getMatrixAt(i, matrix);
      const center = new THREE.Vector3()
        .setFromMatrixPosition(matrix)
        .applyMatrix4(stems.matrixWorld);
      positions.push(center);
      assert.ok(Math.abs(center.x) > 1.85, 'doorway remains clear');
      center.y = 0;
      assert.ok(
        center.distanceTo(
          approach.closestPointToPoint(center, true, new THREE.Vector3()),
        ) > 0.5,
        'cat does not walk through flowers',
      );
    }
    assert.ok(positions.some((p) => p.x < 0) && positions.some((p) => p.x > 0));
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        assert.ok(
          positions[i].distanceTo(positions[j]) > 0.36,
          'flower heads have breathing room',
        );
      }
    }
    const grass = garden.getObjectByName('Lawn');
    assert.ok(
      grass.material.map?.isDataTexture,
      'grass texture needs no network request',
    );
    entry.dispose();
  }
});

test('stepping stones have visible low sides and bevels while remaining grounded', () => {
  const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), 16 / 9, 8.6);
  entry.root.updateMatrixWorld(true);
  const stones = entry.root.getObjectsByProperty('name', 'SteppingStone');
  assert.equal(stones.length, 5);
  let previousBounds;
  for (const step of stones) {
    const bounds = new THREE.Box3().setFromObject(step);
    assert.ok(bounds.min.y <= 0, 'stone is set into the lawn');
    assert.ok(
      bounds.max.y >= 0.05 && bounds.max.y <= 0.1,
      'low but visibly raised',
    );
    assert.ok(step.geometry.parameters.options.bevelEnabled);
    assert.ok(Array.isArray(step.material), 'separate top and side shading');
    assert.ok(
      step.material[0].color.r > step.material[1].color.r,
      'lighter top',
    );
    assert.ok(
      Math.max(
        step.material[0].color.r,
        step.material[0].color.g,
        step.material[0].color.b,
      ) < 0.3,
      'muted dark stone, not white paving',
    );
    if (previousBounds) {
      assert.ok(
        bounds.min.z - previousBounds.max.z > 0.15,
        'visible lawn between neighboring stones',
      );
    }
    previousBounds = bounds;
  }
  entry.dispose();
});

test('low shrubs and wall lanterns fill both outer sides without obstructing the entrance', () => {
  const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), 1867 / 862, 8.6);
  entry.root.updateMatrixWorld(true);
  const shrubs = entry.root.getObjectsByProperty('name', 'EntranceShrub');
  const lanterns = entry.root.getObjectsByProperty('name', 'WallLantern');
  assert.equal(shrubs.length, 2);
  assert.equal(lanterns.length, 2);
  const camera = new THREE.PerspectiveCamera(entry.fov, 1867 / 862, 0.1, 100);
  camera.position.copy(entry.cameraPosition);
  camera.lookAt(entry.cameraTarget);
  camera.updateMatrixWorld(true);
  const sides = new Set();
  for (const object of [...shrubs, ...lanterns]) {
    const bounds = new THREE.Box3().setFromObject(object);
    const center = bounds.getCenter(new THREE.Vector3());
    sides.add(Math.sign(center.x));
    assert.ok(
      bounds.max.x < -3.9 || bounds.min.x > 3.9,
      'leave flowers, mailbox and cat path clear',
    );
    for (const corner of [bounds.min, bounds.max]) {
      const projected = corner.clone().project(camera);
      assert.ok(
        Math.abs(projected.x) < 0.97 && Math.abs(projected.y) < 0.97,
        'side decorations fit the wide screenshot framing',
      );
    }
    if (object.name === 'EntranceShrub') {
      assert.ok(
        bounds.max.y < 1.3 && bounds.min.y < 0.18,
        'low, grounded planting',
      );
      assert.ok(
        bounds.max.x - bounds.min.x > 1.5,
        'planting fills the empty outer margin',
      );
    } else {
      assert.ok(
        bounds.min.z >= entry.doorZ + 0.17,
        'mount on the exterior face of the wall',
      );
    }
  }
  assert.equal(sides.size, 2);
  entry.dispose();
});

test('garden geometry stays lightweight and all shared GPU resources are released once', () => {
  const entry = new Entrance(new THREE.Vector3(0, 10.5, 15), 16 / 9, 8.6);
  const garden = entry.root.getObjectByName('EntranceGarden');
  assert.ok(garden);
  const resources = new Set();
  let triangles = 0;
  let draws = 0;
  entry.root.traverse((object) => {
    if (!object.isMesh) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      resources.add(material);
      if (material.map) resources.add(material.map);
    }
    if (object.isInstancedMesh) resources.add(object);
  });
  garden.traverse((object) => {
    if (!object.isMesh) return;
    draws++;
    triangles +=
      ((object.geometry.index?.count ??
        object.geometry.attributes.position.count) /
        3) *
      (object.count ?? 1);
  });
  assert.ok(draws <= 35, `${draws} garden draws`);
  assert.ok(triangles < 40000, `${triangles} garden triangles`);
  const disposed = new Map();
  resources.forEach((resource) =>
    resource.addEventListener('dispose', () =>
      disposed.set(resource, (disposed.get(resource) ?? 0) + 1),
    ),
  );
  entry.dispose();
  entry.dispose();
  resources.forEach((resource) => assert.equal(disposed.get(resource), 1));
});
