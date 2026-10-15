import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const THREE = require('three');
const cache = new Map();
function loadSource(name) {
  if (cache.has(name)) return cache.get(name).exports;
  let file = fileURLToPath(
    new URL(`../src/components/room/${name}.ts`, import.meta.url),
  );
  if (!existsSync(file)) file += 'x';
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const module = { exports: {} };
  cache.set(name, module);
  vm.runInNewContext(output.outputText, {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === './DayWindowView' || id === './NightWindowView') {
        return {
          default: () => {
            const root = new THREE.Group();
            root.name = id;
            return {
              root,
              update() {},
              dispose() {
                root.removeFromParent();
              },
            };
          },
        };
      }
      return id.startsWith('./') ? loadSource(id.slice(2)) : require(id);
    },
  });
  return module.exports;
}

const WindowPanels = loadSource('RoomWindowPanels').default;
const { ROOM_WINDOW, WALL_THICKNESS } = loadSource('roomConfig');
const makePanels = () =>
  new WindowPanels(ROOM_WINDOW.width, ROOM_WINDOW.height);

test('two leaves open outward around stationary outer hinges and reverse smoothly', () => {
  const panels = makePanels();
  const left = panels.root.getObjectByName('window-leaf-left');
  const right = panels.root.getObjectByName('window-leaf-right');
  const leftPivot = left.position.clone();
  assert.equal(panels.isOpen, false);
  assert.equal(panels.toggle(), true);
  panels.update(1 / 60);
  assert.ok(left.rotation.y > 0 && right.rotation.y < 0);
  assert.ok(Math.abs(left.rotation.y) < 0.35, 'opening starts gently');
  const openingAngle = left.rotation.y;
  assert.equal(panels.toggle(), false);
  assert.equal(left.rotation.y, openingAngle, 'toggle itself must not jump');
  panels.update(1 / 60);
  assert.ok(left.rotation.y < openingAngle);
  panels.toggle();
  for (let i = 0; i < 120; i++) panels.update(1 / 60);
  panels.root.updateMatrixWorld(true);
  const leftEdge = left.localToWorld(new THREE.Vector3(1, 0, 0));
  const rightEdge = right.localToWorld(new THREE.Vector3(-1, 0, 0));
  assert.ok(
    leftEdge.x < leftPivot.x - 0.95,
    'left leaf folds beside the opening',
  );
  assert.ok(
    rightEdge.x > right.position.x + 0.95,
    'right leaf folds beside the opening',
  );
  assert.ok(leftEdge.z < -WALL_THICKNESS - 0.05);
  assert.ok(rightEdge.z < -WALL_THICKNESS - 0.05);
  assert.ok(left.position.equals(leftPivot));
  assert.equal(panels.isOpen, true);
  panels.dispose();
});

test('fully opening leaves stay outside the wall instead of cutting through it', () => {
  const panels = makePanels();
  const point = new THREE.Vector3();
  panels.toggle();
  for (let frame = 0; frame < 120; frame++) {
    panels.update(1 / 60);
    panels.root.updateMatrixWorld(true);
    for (const name of ['window-leaf-left', 'window-leaf-right']) {
      panels.root.getObjectByName(name).traverse((node) => {
        if (!node.isMesh) return;
        const positions = node.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          point
            .fromBufferAttribute(positions, i)
            .applyMatrix4(node.matrixWorld);
          if (Math.abs(point.x) <= ROOM_WINDOW.width / 2) continue;
          assert.ok(
            point.z < -WALL_THICKNESS - 0.05,
            'leaf intersects the exterior wall',
          );
        }
      });
    }
  }
  panels.dispose();
});

test('opening is frame-rate independent and reduced-motion updates settle immediately', () => {
  const angles = [];
  for (const fps of [15, 30, 60]) {
    const panels = makePanels();
    panels.toggle();
    for (let i = 0; i < fps; i++) panels.update(1 / fps);
    angles.push(panels.root.getObjectByName('window-leaf-left').rotation.y);
    panels.update(1);
    assert.ok(
      Math.abs(panels.root.getObjectByName('window-leaf-left').rotation.y) > 1,
    );
    panels.toggle();
    panels.update(1);
    assert.equal(panels.root.getObjectByName('window-leaf-left').rotation.y, 0);
    panels.dispose();
  }
  assert.ok(Math.max(...angles) - Math.min(...angles) < 0.00001);
});

test('opening and closing ease over roughly one and a half seconds', () => {
  const panels = makePanels();
  const leaf = panels.root.getObjectByName('window-leaf-left');
  const fullyOpen = THREE.MathUtils.degToRad(170);
  panels.toggle();
  for (let i = 0; i < 30; i++) panels.update(1 / 60);
  assert.ok(
    leaf.rotation.y > fullyOpen * 0.65 && leaf.rotation.y < fullyOpen * 0.85,
  );
  for (let i = 0; i < 60; i++) panels.update(1 / 60);
  assert.ok(leaf.rotation.y > fullyOpen * 0.98);
  panels.toggle();
  for (let i = 0; i < 30; i++) panels.update(1 / 60);
  assert.ok(
    leaf.rotation.y > fullyOpen * 0.15 && leaf.rotation.y < fullyOpen * 0.35,
  );
  for (let i = 0; i < 60; i++) panels.update(1 / 60);
  assert.ok(leaf.rotation.y < fullyOpen * 0.02);
  panels.dispose();
});

test('hover fades up the frame and brass without changing the glass or opening the window', () => {
  const panels = makePanels();
  const materials = new Map();
  panels.root.traverse((node) => {
    if (node.isMesh && node.material.isMeshStandardMaterial)
      materials.set(node.material, {
        emissive: node.material.emissiveIntensity,
        opacity: node.material.opacity,
      });
  });
  for (let i = 0; i < 60; i++) panels.updateHover(true, 1 / 60);
  const brightened = [...materials].filter(
    ([material, initial]) =>
      material.emissiveIntensity > initial.emissive + 0.12,
  );
  assert.equal(brightened.length, 2, 'both paint and brass should brighten');
  for (const [material, initial] of materials)
    assert.equal(material.opacity, initial.opacity);
  assert.equal(panels.isOpen, false);
  for (let i = 0; i < 90; i++) panels.updateHover(false, 1 / 60);
  for (const [material, initial] of materials)
    assert.ok(Math.abs(material.emissiveIntensity - initial.emissive) < 0.0001);
  panels.dispose();
  panels.updateHover(true, 1);
  for (const [material, initial] of materials)
    assert.ok(Math.abs(material.emissiveIntensity - initial.emissive) < 0.0001);
});

test('window focus fills the view while keeping the casing clear of mobile controls', () => {
  const { RoomCameraController } = loadSource('RoomCamera');
  const panels = makePanels();
  // Frame the fixed casing; the open leaves fold behind the exterior wall.
  panels.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  panels.root.children
    .filter((node) => node.isMesh)
    .forEach((node) => bounds.expandByObject(node));
  for (const open of [false, true]) {
    if (open) panels.toggle();
    panels.update(1);
    panels.root.updateMatrixWorld(true);
    for (const [width, height, sideMargin, minimumFill] of [
      [1280, 800, 164, 0.92],
      [600, 400, 80, 0.86],
      [844, 390, 110, 0.86],
      [568, 320, 76, 0.84],
      [470, 460, 72, 0.74],
    ]) {
      const controller = new RoomCameraController(width / height);
      controller.resize(width, height);
      for (let frame = 0; frame < 240; frame++) {
        controller.follow({
          frame: controller.beginFrame(1 / 60),
          mode: 'window',
          characterPosition: new THREE.Vector3(),
          focusPosition: new THREE.Vector3(
            0,
            ROOM_WINDOW.height / 2,
            ROOM_WINDOW.focusDistance,
          ),
          focusTarget: new THREE.Vector3(0, ROOM_WINDOW.height / 2, 0),
        });
      }
      const { camera } = controller;
      camera.updateMatrixWorld();
      const ys = [];
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const projected = new THREE.Vector3(x, y, z).project(camera);
            const pixelX = ((projected.x + 1) * width) / 2;
            const pixelY = ((1 - projected.y) * height) / 2;
            assert.ok(
              pixelX > sideMargin && pixelX < width - sideMargin,
              `side exits at ${width}x${height}`,
            );
            assert.ok(
              pixelY > 12 && pixelY < height - 12,
              `frame overlaps controls at ${width}x${height}: y=${pixelY}`,
            );
            ys.push(pixelY);
          }
      assert.ok(
        (Math.max(...ys) - Math.min(...ys)) / height > minimumFill,
        `window is too small at ${width}x${height}`,
      );
    }
  }
  panels.dispose();
});

test('window keeps day/night views and can be clicked through the opening when open', () => {
  assert.ok(
    ROOM_WINDOW.focusDistance <= 10.2,
    'stay in front of the opposite-wall shelf',
  );
  const RoomWindow = loadSource('RoomWindow').default;
  const { ROOM, ROOM_DEPTH_BOUNDS, WALL_THICKNESS } = loadSource('roomConfig');
  const wall = new THREE.Group();
  wall.position.set(
    -ROOM.width / 2 - WALL_THICKNESS / 2,
    ROOM.wallHeight / 2,
    ROOM_DEPTH_BOUNDS.sideWallCenterZ,
  );
  const window = new RoomWindow(wall, new THREE.LoadingManager());
  const initialDay = window.isDaytime;
  window.toggle();
  window.update(0.5, 1);
  wall.updateMatrixWorld(true);
  assert.equal(window.isOpen, true);
  assert.equal(window.isDaytime, initialDay);
  assert.ok(wall.getObjectByName('./DayWindowView'));
  assert.ok(wall.getObjectByName('./NightWindowView'));
  const ray = new THREE.Raycaster(
    window.focusPosition,
    window.focusTarget.clone().sub(window.focusPosition).normalize(),
  );
  assert.equal(window.isPointerOver(ray), true);
  wall.visible = false;
  assert.equal(window.isPointerOver(ray), false);
  window.dispose();
  assert.equal(wall.children.length, 0);
});

test('disposing panels releases their unique geometry/materials and prevents later movement', () => {
  const panels = makePanels();
  const resources = new Set();
  panels.root.traverse((node) => {
    if (node.isMesh) {
      resources.add(node.geometry);
      resources.add(node.material);
    }
  });
  let released = 0;
  resources.forEach((resource) =>
    resource.addEventListener('dispose', () => released++),
  );
  panels.dispose();
  panels.dispose();
  assert.equal(released, resources.size);
  assert.equal(panels.toggle(), false);
  panels.update(1);
  assert.equal(panels.isOpen, false);
});
