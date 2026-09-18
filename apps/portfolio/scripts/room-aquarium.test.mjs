import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import ts from 'typescript';

// Use the shipped geometry and transforms; only browser-only textures are omitted.
globalThis.ProgressEvent ??= class {
  constructor(type, values) {
    Object.assign(this, { type }, values);
  }
};
const assets = new Map();
for (const name of [
  'modern_desk',
  'bikini1',
  'tulip',
  'clownfish',
  'blue-tang',
]) {
  const bytes = readFileSync(
    new URL(`../public/models/${name}.glb`, import.meta.url),
  );
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length));
  delete json.images;
  delete json.textures;
  json.materials = json.materials?.map(({ name }) => ({ name }));
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  gltf.scene.name = `asset:${name}`;
  assets.set(`/models/${name}.glb`, gltf.scene);
}

function setup() {
  const pending = [];
  const modules = new Map();
  class AssetLoader {
    constructor(manager) {
      this.manager = manager;
    }
    load(path, ready) {
      assert.ok(assets.has(path), `unexpected asset: ${path}`);
      this.manager.itemStart(path);
      pending.push(() => {
        ready({ scene: assets.get(path).clone(true) });
        this.manager.itemEnd(path);
      });
    }
  }
  function loadSource(name) {
    if (modules.has(name)) return modules.get(name);
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
      document: { createElement: () => ({ getContext: () => null }) },
      require: (id) => {
        if (id.endsWith('/GLTFLoader.js')) return { GLTFLoader: AssetLoader };
        return id.startsWith('./')
          ? loadSource(id.slice(2))
          : createRequire(path)(id);
      },
    });
    modules.set(name, compiledModule.exports);
    return compiledModule.exports;
  }
  const manager = new THREE.LoadingManager();
  const parent = new THREE.Scene();
  const RoomAquarium = loadSource('RoomAquarium').default;
  const aquarium = new RoomAquarium(parent, manager);
  const flush = () => {
    while (pending.length) pending.shift()();
    parent.updateMatrixWorld(true);
  };
  return { aquarium, parent, manager, pending, flush };
}

function bounds(parent, name) {
  const object = parent.getObjectByName(name);
  assert.ok(object, `missing ${name}`);
  return new THREE.Box3().setFromObject(object);
}

test('real tank and tulip rest on the cabinet without overlap or overhang', () => {
  const { aquarium, parent, flush } = setup();
  flush();
  const cabinet = bounds(parent, 'asset:modern_desk');
  const tank = bounds(parent, 'asset:bikini1');
  const tulip = bounds(parent, 'asset:tulip');
  for (const object of [tank, tulip]) {
    assert.ok(
      Math.abs(object.min.y - cabinet.max.y) < 0.02,
      'object must sit on the actual tabletop',
    );
    assert.ok(object.min.x > cabinet.min.x && object.max.x < cabinet.max.x);
    assert.ok(object.min.z > cabinet.min.z && object.max.z < cabinet.max.z);
  }
  assert.ok(
    tank.max.z + 0.1 < tulip.min.z,
    'leave space between the tank and flowers',
  );
  assert.ok(cabinet.max.x < 6.7, 'cabinet must stay inside the right wall');
  aquarium.dispose();
});

test('water stays in the tank and three animated fish stay underwater', () => {
  const { aquarium, parent, flush } = setup();
  flush();
  const tank = bounds(parent, 'asset:bikini1');
  const water = bounds(parent, 'Aquarium water');
  assert.ok(tank.containsBox(water));
  const fish = ['Clownfish 1', 'Clownfish 2', 'Blue tang'];
  aquarium.update(0);
  parent.updateMatrixWorld(true);
  const start = parent.getObjectByName('Blue tang').position.clone();
  for (let time = 0; time < 120; time += 0.2) {
    aquarium.update(time);
    parent.updateMatrixWorld(true);
    for (const name of fish) {
      assert.ok(
        water.containsBox(bounds(parent, name)),
        `${name} escaped at ${time}`,
      );
    }
  }
  assert.ok(
    parent.getObjectByName('Blue tang').position.distanceTo(start) > 0.1,
  );
  let triangles = 0;
  parent.getObjectByName('Blue tang').traverse((object) => {
    if (object.isMesh)
      triangles +=
        (object.geometry.index?.count ??
          object.geometry.attributes.position.count) / 3;
  });
  assert.ok(triangles < 4000, 'the handmade fish should stay lightweight');
  aquarium.dispose();
});

test('clownfish keep their reduced size while the blue tang keeps its size', () => {
  const { aquarium, parent, flush } = setup();
  flush();
  for (const [name, width] of [
    ['Clownfish 1', 0.18],
    ['Clownfish 2', 0.162],
    ['Blue tang', 0.38],
  ]) {
    const fish = parent.getObjectByName(name);
    fish.quaternion.identity();
    const size = bounds(parent, name).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x - width) < 0.005, `${name}: ${size.x}`);
  }
  aquarium.dispose();
});

test('fish wander at different depths and speeds with smooth turns', () => {
  const { aquarium, parent, flush } = setup();
  flush();
  const fish = ['Clownfish 1', 'Clownfish 2', 'Blue tang'].map((name) =>
    parent.getObjectByName(name),
  );
  const samples = fish.map((object) => ({
    position: object.position.clone(),
    rotation: object.quaternion.clone(),
    minY: Infinity,
    maxY: -Infinity,
    minSpeed: Infinity,
    maxSpeed: 0,
  }));
  for (let frame = 1; frame <= 90 * 30; frame++) {
    aquarium.update(frame / 30);
    fish.forEach((object, index) => {
      const sample = samples[index];
      const speed = object.position.distanceTo(sample.position) * 30;
      assert.ok(speed < 0.65, `${object.name} moved too fast: ${speed}`);
      assert.ok(
        object.quaternion.angleTo(sample.rotation) < 0.075,
        'no abrupt turns',
      );
      sample.minY = Math.min(sample.minY, object.position.y);
      sample.maxY = Math.max(sample.maxY, object.position.y);
      sample.minSpeed = Math.min(sample.minSpeed, speed);
      sample.maxSpeed = Math.max(sample.maxSpeed, speed);
      sample.position.copy(object.position);
      sample.rotation.copy(object.quaternion);
    });
  }
  samples.forEach((sample) => {
    assert.ok(sample.maxY - sample.minY > 0.1, 'explore different depths');
    assert.ok(
      sample.maxSpeed > sample.minSpeed * 3,
      'alternate drifting and swimming',
    );
  });
  aquarium.dispose();
});

test('nested aquarium assets including both fish finish before loading is ready', () => {
  const { flush, manager } = setup();
  const loaded = [];
  let complete = false;
  manager.onProgress = (url) => loaded.push(url);
  manager.onLoad = () => {
    complete = true;
  };
  flush();
  assert.ok(loaded.includes('/models/clownfish.glb'));
  assert.ok(loaded.includes('/models/blue-tang.glb'));
  assert.equal(
    loaded.filter((url) => url === '/models/clownfish.glb').length,
    1,
  );
  assert.equal(complete, true);
});

test('swim paths and turns remain consistent at 15 and 60 FPS', () => {
  const results = [];
  for (const fps of [15, 60]) {
    const { aquarium, parent, flush } = setup();
    flush();
    for (let frame = 1; frame <= 30 * fps; frame++)
      aquarium.update(frame / fps);
    results.push(
      ['Clownfish 1', 'Clownfish 2', 'Blue tang'].map((name) => {
        const fish = parent.getObjectByName(name);
        return {
          position: fish.position.clone(),
          rotation: fish.quaternion.clone(),
        };
      }),
    );
    aquarium.dispose();
  }
  results[0].forEach((fish, index) => {
    assert.ok(fish.position.distanceTo(results[1][index].position) < 0.001);
    assert.ok(fish.rotation.angleTo(results[1][index].rotation) < 0.12);
  });
});

test('both fish assets are small self-contained GLBs with movable tails', async () => {
  for (const name of ['clownfish', 'blue-tang']) {
    const bytes = readFileSync(
      new URL(`../public/models/${name}.glb`, import.meta.url),
    );
    assert.ok(bytes.length < 100 * 1024, `${name} must stay below 100 KiB`);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    assert.equal(json.images?.length ?? 0, 0);
    assert.ok(json.buffers.every((buffer) => !buffer.uri));
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    assert.ok(gltf.scene.getObjectByName('FishTail'));
    let triangles = 0;
    gltf.scene.traverse((object) => {
      if (object.isMesh)
        triangles +=
          (object.geometry.index?.count ??
            object.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles < 4000);
  }
});

test('all three fish keep independently animated tails after GLB loading', () => {
  const { aquarium, parent, flush } = setup();
  flush();
  const tails = ['Clownfish 1', 'Clownfish 2', 'Blue tang'].map((name) => {
    const tail = parent.getObjectByName(name).getObjectByName('FishTail');
    assert.ok(tail, `${name} has a tail pivot`);
    return tail;
  });
  assert.notEqual(tails[0], tails[1]);
  aquarium.update(0);
  const before = tails.map((tail) => tail.rotation.y);
  aquarium.update(0.2);
  tails.forEach((tail, index) =>
    assert.notEqual(tail.rotation.y, before[index]),
  );
  aquarium.dispose();
});

test('disposing before or after loading prevents late additions and further animation', () => {
  for (const loaded of [false, true]) {
    const { aquarium, parent, flush } = setup();
    if (loaded) flush();
    aquarium.dispose();
    flush();
    aquarium.update(10);
    assert.equal(parent.children.length, 0);
  }
});

test('aquarium picking covers the clear glass, not the flowers, and hover outlines stay hollow', () => {
  const { aquarium, parent, flush } = setup();
  const ray = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(1, 0, 0),
  );
  assert.equal(typeof aquarium.isPointerOver, 'function');
  assert.equal(aquarium.isPointerOver(ray), false);
  flush();
  ray.ray.origin.copy(aquarium.focusTarget).add(new THREE.Vector3(-4, 0, 0));
  assert.equal(aquarium.isPointerOver(ray), true);
  aquarium.updateHover(true, 1);
  const frame = parent.getObjectByName('Aquarium hover frame');
  assert.ok(frame.visible);
  assert.ok(frame.material.opacity > 0.9);
  parent.updateMatrixWorld(true);
  assert.equal(
    ray.intersectObject(frame).length,
    0,
    'the center must remain clear',
  );
  ray.ray.origin.z = bounds(parent, 'asset:tulip').getCenter(
    new THREE.Vector3(),
  ).z;
  assert.equal(aquarium.isPointerOver(ray), false);
  aquarium.updateHover(false, 1);
  assert.equal(frame.visible, false);
  aquarium.dispose();
  assert.equal(aquarium.isPointerOver(ray), false);
});

test('the close-up frames the whole aquarium on desktop, mobile and after a resize', () => {
  const { aquarium, parent, flush } = setup();
  assert.equal(typeof aquarium.resize, 'function');
  aquarium.resize(390 / 844);
  flush();
  const tank = bounds(parent, 'asset:bikini1');
  for (const aspect of [390 / 844, 16 / 9, 360 / 800, 4 / 3]) {
    aquarium.resize(aspect);
    const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
    camera.position.copy(aquarium.focusPosition);
    camera.lookAt(aquarium.focusTarget);
    camera.updateMatrixWorld(true);
    assert.ok(camera.position.x < tank.min.x);
    assert.ok(camera.position.y > aquarium.focusTarget.y);
    for (const x of [tank.min.x, tank.max.x]) {
      for (const y of [tank.min.y, tank.max.y]) {
        for (const z of [tank.min.z, tank.max.z]) {
          const corner = new THREE.Vector3(x, y, z).project(camera);
          assert.ok(
            Math.abs(corner.x) < 0.95 && Math.abs(corner.y) < 0.95,
            `cropped at aspect ${aspect}`,
          );
        }
      }
    }
  }
  aquarium.dispose();
});
