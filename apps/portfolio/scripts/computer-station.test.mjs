import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ts from 'typescript';

globalThis.ProgressEvent ??= class {
  constructor(type, values) {
    Object.assign(this, { type }, values);
  }
};
const assets = new Map();
const modules = new Map();
const pending = [];
class AssetLoader {
  load(path, ready) {
    pending.push(() => ready({ scene: assets.get(path).clone(true) }));
  }
}
function loadSource(url) {
  const path = fileURLToPath(url);
  if (modules.has(path)) return modules.get(path);
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
      id === 'three'
        ? THREE
        : id.endsWith('/GLTFLoader.js')
          ? { GLTFLoader: AssetLoader }
          : id.startsWith('.')
            ? loadSource(new URL(`${id}.ts`, url))
            : createRequire(path)(id),
  });
  modules.set(path, compiledModule.exports);
  return compiledModule.exports;
}
const config = loadSource(
  new URL('../src/components/room/roomConfig.ts', import.meta.url),
);
for (const key of [
  'desk',
  'computerDesk',
  'computer',
  'keyboard',
  'mouse',
  'gamingChair',
]) {
  const path = config.ROOM_MODELS[key];
  assert.ok(path, `${key} has a standalone model`);
  const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  delete json.images;
  delete json.textures;
  json.materials = json.materials?.map(({ name }) => ({ name }));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  gltf.scene.name = `asset:${key}`;
  assets.set(path, gltf.scene);
}

test('keyboard and mouse rest on the desk and the chair is separate from computer focus', () => {
  const { scene, station } = setup();
  const desk = bounds(scene, 'asset:desk');
  for (const key of ['keyboard', 'mouse']) {
    const item = bounds(scene, `asset:${key}`);
    assert.ok(Math.abs(item.min.y - desk.max.y) < 0.005, `${key} rests on top`);
    assert.ok(item.min.x >= desk.min.x && item.max.x <= desk.max.x);
    assert.ok(item.min.z >= desk.min.z && item.max.z <= desk.max.z);
  }
  const chair = bounds(scene, 'asset:gamingChair');
  assert.ok(Math.abs(chair.min.y) < 0.005, 'wheels rest on floor');
  assert.ok(chair.min.x > desk.max.x + 0.1, 'chair clears the desk');
  const point = chair.getCenter(new THREE.Vector3());
  const ray = new THREE.Raycaster(
    point.clone().add(new THREE.Vector3(3, 0, 0)),
    new THREE.Vector3(-1, 0, 0),
  );
  assert.ok(station.chair.isPointerOver(ray));
  assert.ok(station.chair.hintAnchor.distanceTo(point) < 1);
  station.dispose();
  assert.equal(scene.children.length, 0);
});

test('new accessories use opaque materials and batched geometry within a small asset budget', () => {
  for (const key of ['keyboard', 'mouse', 'gamingChair']) {
    const bytes = readFileSync(
      new URL(`../public${config.ROOM_MODELS[key]}`, import.meta.url),
    );
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    assert.ok(bytes.length < 160 * 1024, `${key} stays lightweight`);
    assert.ok(json.meshes.length <= 6, `${key} uses at most six draw calls`);
    assert.ok(
      json.materials.every((m) => !m.alphaMode || m.alphaMode === 'OPAQUE'),
    );
    assert.equal(json.images, undefined, 'no extra texture downloads');
  }
});

test('desktop accessories leave clear space at the front while monitor focus follows the display', () => {
  const { scene, station } = setup();
  const desk = bounds(scene, 'asset:desk');
  const deskCenter = desk.getCenter(new THREE.Vector3());
  for (const key of ['keyboard', 'mouse']) {
    const item = bounds(scene, `asset:${key}`);
    assert.ok(
      desk.max.x - item.max.x > 0.22,
      `${key} leaves room at the front edge`,
    );
  }
  for (const key of ['computer', 'computerDesk']) {
    const center = bounds(scene, `asset:${key}`).getCenter(new THREE.Vector3());
    assert.ok(center.x < deskCenter.x - 0.15, `${key} sits toward the wall`);
  }
  const display = bounds(scene, 'Object_6');
  assert.ok(
    Math.abs(station.focusTarget.x - display.max.x) < 0.04,
    'focus follows the moved display',
  );
  station.dispose();
});

test('the white mouse has a cyan light band around its lower shell', () => {
  const bytes = readFileSync(
    new URL(`../public${config.ROOM_MODELS.mouse}`, import.meta.url),
  );
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const light = json.materials.find(({ name }) => name === 'MouseGlow');
  assert.ok(light, 'mouse includes its own light band');
  const [red, green, blue] = light.emissiveFactor;
  assert.ok(
    green > red * 2 && blue > green,
    'cyan light, separate from the white shell',
  );
  const mouse = assets.get(config.ROOM_MODELS.mouse);
  const band = bounds(mouse, 'MouseGlow');
  const shell = bounds(mouse, 'MousePorcelain');
  assert.ok(band.min.x < -0.14 && band.max.x > 0.14, 'band wraps both sides');
  assert.ok(band.max.z > 0.19, 'band wraps the palm end');
  assert.ok(
    band.min.y > 0.025 && band.max.y < shell.max.y - 0.05,
    'band stays below the white dome',
  );
});

test('keyboard replaces the dark key bed with three pastel emissive zones', () => {
  const bytes = readFileSync(
    new URL(`../public${config.ROOM_MODELS.keyboard}`, import.meta.url),
  );
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.equal(
    json.materials.some(({ name }) => name === 'SoftGraphite'),
    false,
  );
  const lights = json.materials.filter(({ name }) =>
    name.startsWith('KeyBacklight'),
  );
  assert.equal(lights.length, 3);
  assert.equal(
    new Set(lights.map(({ emissiveFactor }) => JSON.stringify(emissiveFactor)))
      .size,
    3,
  );
  for (const light of lights) {
    assert.ok(
      light.emissiveFactor.every((channel) => channel > 0.15),
      'soft multicolor light, not saturated primary colors',
    );
    assert.ok(
      Math.max(...light.emissiveFactor) >= 0.8,
      'visible with room lights off',
    );
  }
  const keyboard = assets.get(config.ROOM_MODELS.keyboard);
  const litBounds = new THREE.Box3();
  for (const light of lights)
    litBounds.expandByObject(keyboard.getObjectByName(light.name));
  assert.ok(
    litBounds.min.x < -0.6 && litBounds.max.x > 0.6,
    'backlighting spans all key rows',
  );
  assert.ok(litBounds.max.y < 0.09, 'lights stay below the key tops');
});
const ComputerStation = loadSource(
  new URL('../src/components/computer/ComputerStation.ts', import.meta.url),
).default;
function setup() {
  const scene = new THREE.Scene();
  const station = new ComputerStation(scene, new THREE.LoadingManager());
  while (pending.length) pending.shift()();
  scene.updateMatrixWorld(true);
  return { scene, station };
}
function bounds(scene, name) {
  return new THREE.Box3().setFromObject(scene.getObjectByName(name));
}

test('the monitor display stays in front of the chassis instead of sharing its depth', () => {
  const { scene, station } = setup();
  const display = bounds(scene, 'Object_6');
  const chassis = bounds(scene, 'Object_4');
  const clearance = display.min.x - chassis.max.x;
  assert.ok(
    clearance >= 0.003 && clearance <= 0.01,
    `display clearance: ${clearance}`,
  );
  for (const z of [-0.65, 0, 0.65]) {
    const point = display.getCenter(new THREE.Vector3());
    point.z += z;
    const ray = new THREE.Raycaster(
      point.clone().add(new THREE.Vector3(10, 3, 0)),
      new THREE.Vector3(-10, -3, 0).normalize(),
    );
    const hit = ray.intersectObject(
      scene.getObjectByName('asset:computer'),
      true,
    )[0];
    assert.equal(
      hit.object.name,
      'Object_6',
      'display wins at exploration distances',
    );
  }
  station.dispose();
});

test('the new desk is a standalone lightweight GLB with a matte white top and silver handles', () => {
  assert.equal(config.ROOM_MODELS.desk, '/models/cozy-desk.glb');
  const scene = assets.get(config.ROOM_MODELS.desk);
  assert.ok(scene.getObjectByName('DeskTop'));
  assert.ok(scene.getObjectByName('DrawerCabinet'));
  const bytes = readFileSync(
    new URL(`../public${config.ROOM_MODELS.desk}`, import.meta.url),
  );
  assert.ok(bytes.length < 250 * 1024);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const materialFor = (node) =>
    json.materials[json.meshes[node.mesh].primitives[0].material]
      .pbrMetallicRoughness;
  const top = materialFor(json.nodes.find((node) => node.name === 'DeskTop'));
  assert.ok(
    top.baseColorFactor.slice(0, 3).every((channel) => channel > 0.85),
    'neutral white tabletop',
  );
  assert.ok(top.roughnessFactor >= 0.8, 'matte tabletop');
  assert.equal(top.metallicFactor, 0);
  assert.equal(
    scene.getObjectByName('OakGrain'),
    undefined,
    'no wood grain overlay',
  );
  const handles = json.nodes.filter((node) => node.name === 'SilverHandle');
  assert.equal(handles.length, 3);
  handles.forEach((handle) => {
    const material = materialFor(handle);
    assert.ok(material.metallicFactor >= 0.5);
    assert.ok(material.roughnessFactor >= 0.35, 'soft brushed finish');
  });
});

test('the desk sits parallel and close to the wall with its top at the existing height', () => {
  const { scene, station } = setup();
  const desk = bounds(scene, 'asset:desk');
  const gap = desk.min.x + config.ROOM.width / 2;
  assert.ok(gap >= 0.015 && gap <= 0.05, `wall gap: ${gap}`);
  assert.ok(Math.abs(desk.min.y) < 0.005);
  assert.ok(Math.abs(desk.max.y - config.DESK_SURFACE_HEIGHT) < 0.005);
  assert.ok(
    Math.abs(desk.max.z - desk.min.z - config.MODEL_TARGET_WIDTH.desk) < 0.005,
  );
  const collision = config.ROOM_COLLISION_BOXES.find(
    (box) => box.centerZ === 2,
  );
  assert.ok(collision.centerX - collision.halfWidth <= desk.min.x + 0.01);
  assert.ok(collision.centerX + collision.halfWidth >= desk.max.x - 0.01);
  assert.ok(
    collision.halfWidth < 1,
    'release the old empty floor collision area',
  );
  station.dispose();
});

test('computer and riser stay on the desk and focus still points at the screen', () => {
  const { scene, station } = setup();
  const desk = bounds(scene, 'asset:desk');
  const riser = bounds(scene, 'asset:computerDesk');
  assert.ok(Math.abs(riser.min.y - desk.max.y) < 0.005);
  for (const item of [riser, bounds(scene, 'asset:computer')]) {
    assert.ok(
      item.min.x >= desk.min.x && item.max.x <= desk.max.x,
      'no depth overhang',
    );
    assert.ok(
      item.min.z >= desk.min.z && item.max.z <= desk.max.z,
      'no width overhang',
    );
  }
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  camera.position.copy(station.focusPosition);
  camera.lookAt(station.focusTarget);
  camera.updateMatrixWorld(true);
  const viewport = station.getScreenViewport(camera, 1280, 720);
  assert.ok(viewport);
  for (const corner of Object.values(viewport)) {
    assert.ok(
      corner.x > 0 && corner.x < 1280 && corner.y > 0 && corner.y < 720,
    );
  }
  const ray = new THREE.Raycaster(
    camera.position,
    station.focusTarget.clone().sub(camera.position).normalize(),
  );
  assert.ok(station.isPointerOver(ray));
  station.dispose();
  assert.equal(scene.children.length, 0);
});
