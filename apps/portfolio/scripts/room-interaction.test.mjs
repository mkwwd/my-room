import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

const keyboardEvents = new EventTarget();

function loadSource(name) {
  let path = fileURLToPath(
    new URL(`../src/components/room/${name}.ts`, import.meta.url),
  );
  if (!existsSync(path)) path += 'x';
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const compiledModule = { exports: {} };
  vm.runInNewContext(source.outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (id) =>
      id.endsWith('.css')
        ? { default: {} }
        : id.startsWith('./')
          ? loadSource(id.slice(2))
          : createRequire(path)(id),
    window: keyboardEvents,
  });
  return compiledModule.exports;
}

const Controller = loadSource('RoomInteractionController').default;

function setup(t) {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 3, 12);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld();
  const canvas = Object.assign(new EventTarget(), {
    style: {},
    focus() {},
    getBoundingClientRect: () => ({
      left: 100,
      top: 50,
      width: 800,
      height: 800,
    }),
  });
  const station = (x) => ({
    hintAnchor: new THREE.Vector3(x, 3, 0),
    focusTarget: new THREE.Vector3(x, 3, 0),
    focusPosition: new THREE.Vector3(x, 3, 5),
    isPointerOver: () => false,
  });
  const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  windowMesh.position.set(3, 3, 0);
  windowMesh.updateMatrixWorld();
  const lampMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 4.2, 16),
  );
  lampMesh.position.set(-4.15, 2.11, -8.98);
  lampMesh.updateMatrixWorld();
  const windowStation = {
    ...station(3),
    isPointerOver: (raycaster) =>
      raycaster.intersectObject(windowMesh).length > 0,
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100));
  floor.rotation.x = -Math.PI / 2;
  floor.updateMatrixWorld();
  let mode = 'explore';
  let positions;
  let updates = 0;
  let hovered = null;
  let sits = 0;
  let lastSeat;
  let nearbySits = 0;
  let toggles = 0;
  let lampCycles = 0;
  let windowOpen = false;
  let windowToggles = 0;
  let moves = 0;
  const actions = [];
  let enabled = true;
  const walls = { left: { visible: true }, front: { visible: false } };
  const controller = new Controller({
    canvas,
    camera,
    stations: {
      computer: station(-3),
      tv: station(0),
      window: windowStation,
      aquarium: station(1.5),
      portrait: station(-1),
      landscape: station(1),
      square: station(2),
    },
    chair: {
      hintAnchor: new THREE.Vector3(-2, 2, 1),
      isPointerOver: () => false,
    },
    environment: {
      walls,
      floorPickTargets: [floor],
      floorLamp: {
        hintAnchor: lampMesh.position.clone(),
        isPointerOver: (raycaster) =>
          raycaster.intersectObject(lampMesh).length > 0,
      },
      door: {
        hintAnchor: new THREE.Vector3(-1.72, 2.05, 8.4),
        isPointerOver: () => true,
      },
    },
    character: {
      tryToggleSeat: (seat) => {
        sits++;
        lastSeat = seat;
        return true;
      },
      tryToggleNearbySeat: () => {
        nearbySits++;
        return true;
      },
      pressKey() {},
      releaseKey() {},
      clearInput() {},
      moveTo() {
        moves++;
      },
    },
    getSceneMode: () => mode,
    isEnabled: () => enabled,
    onEnterFocus: (target) => {
      actions.push(`focus:${target}`);
      mode = target;
    },
    onExitFocus: () => {
      actions.push('exit');
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
    onCycleFloorLamp: () => lampCycles++,
    onToggleWindow: () => {
      actions.push('toggle');
      windowToggles++;
      windowOpen = !windowOpen;
    },
  });
  t?.after(() => {
    controller.dispose();
    for (const mesh of [windowMesh, floor, lampMesh]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  });
  return {
    setEnabled(value) {
      enabled = value;
    },
    controller,
    camera,
    walls,
    canvas,
    windowStation,
    get lampCycles() {
      return lampCycles;
    },
    actions,
    pointer(type, point = new THREE.Vector3(3, 3, 0), button = 0) {
      const projected = point.clone().project(camera);
      canvas.dispatchEvent(
        Object.assign(new Event(type), {
          clientX: 100 + (projected.x * 0.5 + 0.5) * 800,
          clientY: 50 + (-projected.y * 0.5 + 0.5) * 800,
          button,
        }),
      );
    },
    get windowOpen() {
      return windowOpen;
    },
    get windowToggles() {
      return windowToggles;
    },
    get moves() {
      return moves;
    },
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
    get lastSeat() {
      return lastSeat;
    },
    get nearbySits() {
      return nearbySits;
    },
    get toggles() {
      return toggles;
    },
  };
}

function keyDown(key, repeat = false) {
  keyboardEvents.dispatchEvent(
    Object.assign(new Event('keydown', { cancelable: true }), { key, repeat }),
  );
}

test('first window click only focuses; later clicks open and close without changing the zoom', (t) => {
  const state = setup(t);
  state.pointer('pointerdown');
  assert.equal(state.windowOpen, false);
  assert.equal(state.mode, 'window');
  assert.deepEqual(state.actions, ['focus:window']);
  state.pointer('pointerdown');
  assert.equal(state.windowOpen, true);
  assert.equal(state.mode, 'window');
  assert.deepEqual(state.actions, ['focus:window', 'toggle']);
  state.pointer('pointerdown');
  assert.equal(state.windowOpen, false);
  assert.equal(state.mode, 'window');
  assert.deepEqual(state.actions, ['focus:window', 'toggle', 'toggle']);
  assert.equal(state.moves, 0);
});

test('window focus only toggles over the window and never moves on a floor click', (t) => {
  const state = setup(t);
  state.controller.activateTarget('window');
  state.pointer('pointerdown', new THREE.Vector3(0, 0, 5));
  state.pointer('pointerdown', undefined, 2);
  assert.equal(state.windowToggles, 0);
  assert.equal(state.windowOpen, false);
  assert.equal(state.moves, 0);
  assert.equal(state.mode, 'window');
  state.pointer('pointerdown');
  assert.equal(state.windowToggles, 1);
  assert.equal(state.windowOpen, true);
});

test('window focus keeps its hover highlight through hint updates without opening on hover', (t) => {
  const state = setup(t);
  state.controller.activateTarget('window');
  state.pointer('pointermove');
  assert.equal(state.canvas.style.cursor, 'pointer');
  assert.equal(state.hovered, 'window');
  state.controller.updateHint(800, 800);
  assert.equal(state.hovered, 'window');
  assert.equal(state.windowToggles, 0);
  state.pointer('pointermove', new THREE.Vector3(0, 0, 5));
  assert.equal(state.canvas.style.cursor, 'default');
  assert.equal(state.hovered, null);
  state.pointer('pointermove');
  state.canvas.dispatchEvent(new Event('pointerleave'));
  assert.equal(state.canvas.style.cursor, 'default');
  assert.equal(state.hovered, null);
  state.controller.setHoveredTarget('window');
  assert.equal(state.hovered, 'window', 'keyboard focus shares the highlight');
  state.walls.left.visible = false;
  state.controller.updateHint(800, 800);
  assert.equal(state.hovered, null);
});

test('E toggles once per press in window focus without entering focus again or sitting', (t) => {
  const state = setup(t);
  state.controller.activateTarget('window');
  keyDown('e');
  keyDown('e', true);
  assert.equal(state.windowToggles, 1);
  assert.equal(state.windowOpen, true);
  keyDown('E');
  assert.equal(state.windowToggles, 2);
  assert.equal(state.windowOpen, false);
  assert.equal(state.nearbySits, 0);
  assert.equal(state.mode, 'window');
  assert.deepEqual(state.actions, ['focus:window', 'toggle', 'toggle']);
});

test('Escape and reentering focus both preserve the window state', (t) => {
  const state = setup(t);
  state.controller.activateTarget('window');
  state.controller.activateTarget('window');
  assert.equal(state.windowOpen, true);
  keyDown('Escape');
  assert.equal(state.mode, 'explore');
  assert.equal(state.windowOpen, true);
  assert.equal(state.windowToggles, 1);
  assert.deepEqual(state.actions, ['focus:window', 'toggle', 'exit']);
  state.controller.activateTarget('window');
  assert.equal(state.windowOpen, true);
  assert.equal(state.windowToggles, 1);
  assert.equal(state.mode, 'window');
  state.controller.activateTarget('window');
  assert.equal(state.windowOpen, false);
  keyDown('Escape');
  assert.equal(state.windowOpen, false);
  assert.equal(state.windowToggles, 2);
});

for (const blockedBy of [
  'loading',
  'hidden wall',
  'unloaded station',
  'back face',
]) {
  test(`${blockedBy} blocks window activation, focus clicks, keyboard and pointer cursor`, (t) => {
    const state = setup(t);
    const block = () => {
      if (blockedBy === 'loading') state.setEnabled(false);
      if (blockedBy === 'hidden wall') state.walls.left.visible = false;
      if (blockedBy === 'unloaded station')
        state.windowStation.hintAnchor.set(0, 0, 0);
      if (blockedBy === 'back face') state.camera.position.z = -12;
    };
    block();
    assert.equal(state.controller.activateTarget('window'), false);
    assert.equal(state.windowToggles, 0);
    assert.equal(state.mode, 'explore');
    state.setEnabled(true);
    state.walls.left.visible = true;
    state.windowStation.hintAnchor.set(3, 3, 0);
    state.camera.position.z = 12;
    assert.equal(state.controller.activateTarget('window'), true);
    block();
    assert.equal(state.controller.activateTarget('window'), false);
    state.pointer('pointerdown');
    keyDown('e');
    state.pointer('pointermove');
    assert.equal(state.canvas.style.cursor, 'default');
    assert.equal(state.windowToggles, 0);
    assert.equal(state.mode, 'window');
    assert.equal(state.moves, 0);
  });
}

test('other focus modes cannot toggle the window or switch focus targets', (t) => {
  const state = setup(t);
  state.controller.activateTarget('computer');
  assert.equal(state.controller.activateTarget('window'), false);
  keyDown('e');
  state.pointer('pointerdown');
  assert.equal(state.windowToggles, 0);
  assert.equal(state.mode, 'computer');
  keyDown('Escape');
  state.controller.activateTarget('window');
  assert.equal(state.controller.activateTarget('tv'), false);
  assert.equal(state.mode, 'window');
});

const RoomHud = loadSource('RoomHud').default;

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node?.props) return [];
  return [node, ...elements(node.props.children)];
}

test('window HUD keeps a keyboard action and focus feedback without a visible label or icon', () => {
  for (const windowOpen of [false, true]) {
    const activated = [];
    const hovered = [];
    let exits = 0;
    const nodes = elements(
      RoomHud({
        sceneMode: 'window',
        windowOpen,
        onActivateTarget: (target) => activated.push(target),
        onHoverTarget: (target) => hovered.push(target),
        onExitFocus: () => exits++,
      }),
    );
    const button = nodes.find(
      (node) =>
        node.props['aria-label'] ===
        (windowOpen ? 'Close window' : 'Open window'),
    );
    assert.ok(button, 'window focus must expose an open/close action');
    assert.equal(button.type, 'button');
    assert.equal(button.props.type, 'button');
    assert.equal(button.props['aria-pressed'], windowOpen);
    assert.equal(button.props.children, undefined);
    button.props.onFocus();
    button.props.onBlur();
    assert.deepEqual(hovered, ['window', null]);
    button.props.onClick();
    assert.deepEqual(activated, ['window']);
    const sideExits = nodes.filter((node) =>
      node.props['aria-label']?.startsWith('Back to room from'),
    );
    assert.equal(sideExits.length, 2);
    sideExits.forEach((node) => node.props.onClick());
    assert.equal(exits, 2);
  }
});

test('window HUD action stays out of other modes; computer has only side exits and mobile guidance stays sr-only', () => {
  for (const sceneMode of [
    'explore',
    'computer',
    'tv',
    'aquarium',
    'portrait',
    'landscape',
    'square',
  ]) {
    const nodes = elements(
      RoomHud({ sceneMode, windowOpen: true, hintPositions: {} }),
    );
    assert.equal(
      nodes.some((node) =>
        ['Open window', 'Close window'].includes(node.props['aria-label']),
      ),
      false,
    );
    if (sceneMode === 'computer') {
      assert.equal(nodes.filter((node) => node.type === 'button').length, 2);
    }
    if (sceneMode === 'explore') {
      assert.ok(
        nodes.some(
          (node) =>
            node.type === 'span' &&
            node.props.className.includes('max-lg:sr-only'),
        ),
      );
    }
  }
});

test('all ten discoverable targets project without hovering and idle frames do not publish again', () => {
  const state = setup();
  state.controller.updateHint(800, 800);
  assert.equal(
    Object.values(state.positions ?? {}).filter((p) => p.visible).length,
    10,
  );
  state.controller.updateHint(800, 800);
  assert.equal(state.updates, 1);
  state.controller.dispose();
});

test('chair click sits without opening the computer and monitor activation still opens it', () => {
  const state = setup();
  state.controller.activateTarget('chair');
  assert.equal(state.lastSeat, 'chair');
  assert.equal(state.mode, 'explore');
  state.controller.activateTarget('computer');
  assert.equal(state.mode, 'computer');
  state.controller.dispose();
});

test('E activates the nearest seat once, not repeatedly while held or during focus', () => {
  const state = setup();
  const key = (repeat) =>
    keyboardEvents.dispatchEvent(
      Object.assign(new Event('keydown'), { key: 'e', repeat }),
    );
  key(false);
  key(true);
  assert.equal(state.nearbySits, 1);
  state.controller.activateTarget('computer');
  key(false);
  assert.equal(state.nearbySits, 1);
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
  assert.equal(state.positions.portrait.visible, false);
  assert.equal(state.positions.landscape.visible, false);
  assert.equal(state.positions.square.visible, false);
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

test('each wall frame enters its own focus view', () => {
  for (const target of ['portrait', 'landscape', 'square']) {
    const state = setup();
    assert.equal(state.controller.activateTarget(target), true);
    assert.equal(state.mode, target);
    state.controller.dispose();
  }
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

test('lamp clicks cycle its light without focus or floor movement, including the keyboard target', (t) => {
  const state = setup(t);
  const point = new THREE.Vector3(-4.15, 2.11, -8.98);
  state.pointer('pointermove', point);
  assert.equal(state.hovered, 'floorLamp');
  state.pointer('pointerdown', point);
  state.pointer('pointerdown', point);
  state.controller.activateTarget('floorLamp');
  assert.equal(state.lampCycles, 3);
  assert.equal(state.mode, 'explore');
  assert.equal(state.moves, 0);
  assert.equal(state.toggles, 0);
  state.setEnabled(false);
  assert.equal(state.controller.activateTarget('floorLamp'), false);
  state.setEnabled(true);
  state.controller.activateTarget('tv');
  assert.equal(state.controller.activateTarget('floorLamp'), false);
  assert.equal(state.lampCycles, 3);
});

test('lamp HUD exposes its current state and next action without adding a visible label', () => {
  for (const [floorLampMode, text] of [
    ['warm', 'warm white'],
    ['peach', 'peach pink'],
    ['off', 'off'],
  ]) {
    const nodes = elements(
      RoomHud({
        sceneMode: 'explore',
        floorLampMode,
        hintPositions: { floorLamp: { x: 80, y: 100, visible: true } },
      }),
    );
    const lamp = nodes.find(
      (node) => node.props['data-room-target'] === 'floorLamp',
    );
    assert.ok(lamp?.props['aria-label'].includes(text));
    assert.equal(lamp.props.children, undefined);
  }
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
