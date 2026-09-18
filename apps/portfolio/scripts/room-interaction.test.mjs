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
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const compiledModule = { exports: {} };
  vm.runInNewContext(source.outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (id) =>
      id.startsWith('./') ? loadSource(id.slice(2)) : createRequire(path)(id),
    window: new EventTarget(),
  });
  return compiledModule.exports;
}

const Controller = loadSource('RoomInteractionController').default;

function setup() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 3, 12);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld();
  const canvas = Object.assign(new EventTarget(), { style: {}, focus() {} });
  const station = (x) => ({
    hintAnchor: new THREE.Vector3(x, 3, 0),
    focusTarget: new THREE.Vector3(x, 3, 0),
    focusPosition: new THREE.Vector3(x, 3, 5),
    isPointerOver: () => true,
  });
  let mode = 'explore';
  let positions;
  let updates = 0;
  let hovered = null;
  let sits = 0;
  let toggles = 0;
  let enabled = true;
  const walls = { left: { visible: true }, front: { visible: false } };
  const controller = new Controller({
    canvas,
    camera,
    stations: {
      computer: station(-3),
      tv: station(0),
      window: station(3),
      aquarium: station(1.5),
    },
    environment: {
      walls,
      door: {
        hintAnchor: new THREE.Vector3(-1.72, 2.05, 8.4),
        isPointerOver: () => true,
      },
    },
    character: {
      tryToggleSofaSit: () => {
        sits++;
        return true;
      },
      clearInput() {},
    },
    getSceneMode: () => mode,
    isEnabled: () => enabled,
    onEnterFocus: (target) => {
      mode = target;
    },
    onExitFocus: () => {
      mode = 'explore';
    },
    onHoverTargetChange: (target) => {
      hovered = target;
    },
    onHintPositionsChange: (value) => {
      positions = value;
      updates++;
    },
    onToggleLights: () => {
      toggles++;
    },
  });
  return {
    setEnabled(value) {
      enabled = value;
    },
    controller,
    camera,
    walls,
    canvas,
    get positions() {
      return positions;
    },
    get updates() {
      return updates;
    },
    get hovered() {
      return hovered;
    },
    get mode() {
      return mode;
    },
    get sits() {
      return sits;
    },
    get toggles() {
      return toggles;
    },
  };
}

test('all five discoverable targets project without hovering and idle frames do not publish again', () => {
  const state = setup();
  state.controller.updateHint(800, 800);
  assert.equal(
    Object.values(state.positions ?? {}).filter((p) => p.visible).length,
    5,
  );
  state.controller.updateHint(800, 800);
  assert.equal(state.updates, 1);
  state.controller.dispose();
});

test('aquarium activation enters focus and hides exploration targets', () => {
  const state = setup();
  state.controller.updateHint(800, 800);
  assert.equal(state.positions.aquarium?.visible, true);
  state.controller.setHoveredTarget('aquarium');
  assert.equal(state.hovered, 'aquarium');
  assert.equal(state.controller.activateTarget('aquarium'), true);
  assert.equal(state.mode, 'aquarium');
  assert.equal(state.hovered, null);
  state.controller.updateHint(800, 800);
  assert.ok(Object.values(state.positions).every((p) => !p.visible));
  state.controller.dispose();
});

test('hidden window, behind-camera and focus-mode markers are suppressed', () => {
  const state = setup();
  state.walls.left.visible = false;
  state.controller.updateHint(800, 800);
  assert.equal(state.positions.window.visible, false);
  state.controller.activateTarget('tv');
  state.controller.updateHint(800, 800);
  assert.ok(Object.values(state.positions).every((p) => !p.visible));
  state.controller.dispose();
  const behind = setup();
  behind.camera.lookAt(0, 3, 20);
  behind.camera.updateMatrixWorld();
  behind.controller.updateHint(800, 800);
  assert.ok(Object.values(behind.positions).every((p) => !p.visible));
  behind.controller.dispose();
});

test('markers preserve focus and sofa actions and pointer exit clears the highlight', () => {
  const state = setup();
  state.controller.setHoveredTarget('tv');
  state.canvas.dispatchEvent(new Event('pointerleave'));
  assert.equal(state.hovered, null);
  state.controller.activateTarget('sofa');
  assert.equal(state.sits, 1);
  state.controller.activateTarget('computer');
  assert.equal(state.mode, 'computer');
  state.controller.activateTarget('sofa');
  assert.equal(state.sits, 1);
  state.controller.dispose();
});

test('screen hover brightens only its border and returns to a hidden idle state', () => {
  const ProjectedScreen = loadSource('ProjectedScreen').default;
  const screen = new ProjectedScreen({
    centerX: 0,
    centerY: 2,
    centerZ: 0,
    width: 3,
    height: 2,
  });
  const anchor = new THREE.Group();
  screen.updateHighlight(anchor, true, 1 / 60);
  const overlay = anchor.children[0];
  assert.ok(overlay.visible);
  assert.ok(overlay.material.opacity > 0 && overlay.material.opacity < 0.7);
  anchor.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 2, 1),
    new THREE.Vector3(0, 0, -1),
  );
  assert.equal(
    ray.intersectObject(overlay).length,
    0,
    'the center of the screen must remain clear',
  );
  ray.ray.origin.x = 1.49;
  assert.ok(
    ray.intersectObject(overlay).length > 0,
    'the frame should have a visible border',
  );
  for (let i = 0; i < 90; i++) screen.updateHighlight(anchor, false, 1 / 60);
  assert.equal(overlay.visible, false);
  assert.equal(anchor.children.length, 1);
  screen.dispose();
  assert.equal(anchor.children.length, 0);
});

test('room switch toggles lights without moving the camera into focus mode', () => {
  const state = setup();
  state.controller.activateTarget('lightSwitch');
  assert.equal(state.toggles, 0, 'hidden wall cannot be activated');
  state.walls.front.visible = true;
  state.camera.position.z = 0;
  state.controller.activateTarget('lightSwitch');
  assert.equal(state.toggles, 1);
  assert.equal(state.mode, 'explore');
  state.controller.dispose();
});

test('loading blocks hover, focus, sofa and pointer input', () => {
  const state = setup();
  state.setEnabled(false);
  state.controller.updateHint(800, 800);
  assert.equal(state.updates, 0);
  state.controller.setHoveredTarget('tv');
  assert.equal(state.hovered, null);
  state.controller.activateTarget('computer');
  state.controller.activateTarget('sofa');
  state.canvas.dispatchEvent(new Event('pointerdown'));
  assert.equal(state.mode, 'explore');
  assert.equal(state.sits, 0);
  state.setEnabled(true);
  state.controller.activateTarget('computer');
  assert.equal(state.mode, 'computer');
  state.controller.dispose();
});
