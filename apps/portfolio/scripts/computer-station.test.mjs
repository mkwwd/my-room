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
      id.endsWith('/GLTFLoader.js')
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
for (const key of ['desk', 'computerDesk', 'computer']) {
  const path = config.ROOM_MODELS[key];
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
