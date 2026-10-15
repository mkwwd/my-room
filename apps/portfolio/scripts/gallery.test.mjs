import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const THREE = createRequire(import.meta.url)('three');
const React = createRequire(import.meta.url)('react');
const { renderToStaticMarkup } = createRequire(import.meta.url)(
  'react-dom/server',
);
const root = fileURLToPath(new URL('../src/components/', import.meta.url));
const modules = new Map();
function loadSource(relative) {
  const base = path.join(root, relative);
  const filename = existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`;
  if (modules.has(filename)) return modules.get(filename).exports;
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  modules.set(filename, module);
  vm.runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    setTimeout,
    clearTimeout,
    require: (id) =>
      id.startsWith('.')
        ? loadSource(
            path.relative(root, path.resolve(path.dirname(filename), id)),
          )
        : createRequire(filename)(id),
  });
  return module.exports;
}

const { GALLERY_IMAGES } = loadSource('gallery/galleryImages');
const {
  DEFAULT_GALLERY_SELECTION,
  GALLERY_FRAME_IDS,
  readGallerySelection,
  saveGallerySelection,
} = loadSource('gallery/gallerySelection');

test('ten curated photos have unique ids and HTTPS sources, not visitor uploads', () => {
  assert.equal(GALLERY_IMAGES.length, 10);
  assert.equal(new Set(GALLERY_IMAGES.map((image) => image.id)).size, 10);
  for (const image of GALLERY_IMAGES) {
    assert.equal(new URL(image.url).protocol, 'https:');
    assert.equal(new URL(image.thumbnailUrl).protocol, 'https:');
    assert.ok(image.credit);
    assert.ok(image.sourceUrl.startsWith('https://unsplash.com/photos/'));
  }
});

test('failed initial restoration shows a retry error, not an applied photo', () => {
  const { GalleryContext } = loadSource('gallery/GalleryContext');
  const GalleryWindow = loadSource('computer/GalleryWindow').default;
  const html = renderToStaticMarkup(
    React.createElement(
      GalleryContext.Provider,
      {
        value: {
          selection: DEFAULT_GALLERY_SELECTION,
          unavailableFrames: { portrait: true },
          applySelection: async () => {},
        },
      },
      React.createElement(GalleryWindow, {
        isActive: true,
        isMaximized: false,
        onActivate() {},
        onMinimize() {},
        onToggleMaximize() {},
        onClose() {},
      }),
    ),
  );
  assert.ok(html.includes('role="alert"'));
  assert.ok(
    html.includes(
      '사진을 불러오지 못했어요. 적용 버튼으로 다시 시도해 주세요.',
    ),
  );
  assert.ok(!html.includes('현재 적용된 사진: Pink Tulips'));
  assert.ok(!html.includes('현재 포스터에 적용된 사진'));
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.ok(html.includes('정사각 포스터'));
  const { FRAME_LAYOUT } = loadSource('room/RoomPictureFrame');
  const { width, height } = FRAME_LAYOUT.portrait;
  const previewAspect = Number(html.match(/aspect-ratio:([\d.]+)/)?.[1]);
  assert.ok(Math.abs(previewAspect - width / height) < 0.00001);
});

test('first visit uses configurable defaults and saved choices restore synchronously', () => {
  assert.deepEqual(readGallerySelection(null), DEFAULT_GALLERY_SELECTION);
  const saved = {
    portrait: GALLERY_IMAGES[4].id,
    landscape: GALLERY_IMAGES[7].id,
  };
  const restored = readGallerySelection({
    getItem: () => JSON.stringify(saved),
  });
  assert.equal(restored.portrait, saved.portrait);
  assert.equal(restored.landscape, saved.landscape);
  assert.equal(restored.square, GALLERY_IMAGES[2].id);
});

test('a third selection round-trips independently while older two-poster saves stay intact', () => {
  assert.equal(
    Array.from(GALLERY_FRAME_IDS).join(','),
    'portrait,landscape,square',
  );
  const saved = {
    portrait: GALLERY_IMAGES[4].id,
    landscape: GALLERY_IMAGES[7].id,
  };
  let json = JSON.stringify(saved);
  const storage = {
    getItem: () => json,
    setItem: (_key, value) => {
      json = value;
    },
  };
  const restored = readGallerySelection(storage);
  assert.equal(restored.portrait, saved.portrait);
  assert.equal(restored.landscape, saved.landscape);
  assert.equal(restored.square, GALLERY_IMAGES[2].id);
  const updated = { ...restored, square: GALLERY_IMAGES[6].id };
  assert.equal(saveGallerySelection(storage, updated), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(readGallerySelection(storage))),
    updated,
  );
  json = JSON.stringify({ ...saved, square: 'removed-photo' });
  assert.equal(
    readGallerySelection(storage).square,
    DEFAULT_GALLERY_SELECTION.square,
  );
  assert.equal(readGallerySelection(storage).portrait, saved.portrait);
});

test('corrupt storage and removed photos fall back per frame', () => {
  assert.deepEqual(
    readGallerySelection({ getItem: () => '{broken' }),
    DEFAULT_GALLERY_SELECTION,
  );
  assert.deepEqual(
    readGallerySelection({
      getItem() {
        throw new Error('blocked');
      },
    }),
    DEFAULT_GALLERY_SELECTION,
  );
  const restored = readGallerySelection({
    getItem: () =>
      JSON.stringify({
        portrait: 'https://untrusted.test/a.jpg',
        landscape: GALLERY_IMAGES[3].id,
      }),
  });
  assert.equal(restored.portrait, DEFAULT_GALLERY_SELECTION.portrait);
  assert.equal(restored.landscape, GALLERY_IMAGES[3].id);
});

test('persistence stores only three catalog ids and reports unavailable storage', () => {
  let written;
  assert.equal(
    saveGallerySelection(
      {
        setItem: (_key, value) => {
          written = value;
        },
      },
      DEFAULT_GALLERY_SELECTION,
    ),
    true,
  );
  assert.deepEqual(
    JSON.parse(written),
    JSON.parse(JSON.stringify(DEFAULT_GALLERY_SELECTION)),
  );
  assert.equal(saveGallerySelection(null, DEFAULT_GALLERY_SELECTION), false);
  assert.equal(
    saveGallerySelection(
      {
        setItem() {
          throw new Error('quota');
        },
      },
      DEFAULT_GALLERY_SELECTION,
    ),
    false,
  );
});

test('frames mount inside the left wall, remain separate, and can be raycast', () => {
  const { default: RoomPictureFrame, FRAME_LAYOUT } = loadSource(
    'room/RoomPictureFrame',
  );
  const { ROOM, ROOM_DEPTH_BOUNDS, WALL_THICKNESS, ROOM_WINDOW } =
    loadSource('room/roomConfig');
  const wall = new THREE.Group();
  wall.position.set(
    -ROOM.width / 2 - WALL_THICKNESS / 2,
    ROOM.wallHeight / 2,
    ROOM_DEPTH_BOUNDS.sideWallCenterZ,
  );
  const frames = GALLERY_FRAME_IDS.map((id) => new RoomPictureFrame(wall, id));
  wall.updateMatrixWorld(true);
  const bounds = frames.map((frame) =>
    new THREE.Box3().setFromObject(frame.root),
  );
  for (let i = 0; i < bounds.length; i++)
    for (let j = i + 1; j < bounds.length; j++)
      assert.equal(bounds[i].intersectsBox(bounds[j]), false);
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    assert.ok(bounds[i].min.x >= -ROOM.width / 2);
    assert.ok(bounds[i].min.z > ROOM_WINDOW.centerZ + ROOM_WINDOW.width / 2);
    const direction = frame.focusTarget
      .clone()
      .sub(frame.focusPosition)
      .normalize();
    assert.equal(
      frame.isPointerOver(new THREE.Raycaster(frame.focusPosition, direction)),
      true,
    );
    assert.ok(FRAME_LAYOUT[GALLERY_FRAME_IDS[i]].height > 0);
    frame.dispose();
  }
  assert.equal(wall.children.length, 0);
});

test('the square poster tucks below the landscape and the portrait clears the wider board without changing close-ups', () => {
  const { default: RoomPictureFrame, FRAME_LAYOUT } = loadSource(
    'room/RoomPictureFrame',
  );
  const { portrait, landscape, square } = FRAME_LAYOUT;
  assert.equal(portrait.width, 1.64);
  assert.equal(portrait.height, 2.44);
  assert.equal(landscape.width, 2.04);
  assert.equal(landscape.height, 1.52);
  assert.equal(portrait.centerY, 4.92);
  assert.ok(portrait.centerZ < 0);
  assert.ok(square.centerZ < landscape.centerZ);
  assert.ok(square.centerY > 3.8);
  assert.ok(
    landscape.centerY - landscape.height / 2 >
      square.centerY + square.height / 2 + 0.08,
  );
  assert.equal(FRAME_LAYOUT.square.width, FRAME_LAYOUT.square.height);
  assert.ok(FRAME_LAYOUT.square.width < portrait.width);
  for (const id of GALLERY_FRAME_IDS) {
    const frame = new RoomPictureFrame(new THREE.Group(), id);
    const bounds = new THREE.Box3().setFromObject(frame.root);
    for (const aspect of [1280 / 800, 600 / 400]) {
      const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
      camera.position.copy(frame.focusPosition);
      camera.lookAt(frame.focusTarget);
      camera.updateMatrixWorld();
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            assert.ok(
              Math.abs(point.x) < 0.9 && Math.abs(point.y) < 0.9,
              `${id} should not clip at aspect ${aspect}`,
            );
          }
    }
    frame.dispose();
  }
});

test('the pinboard occupies the cleared center space, waits for its photos and releases all resources', async () => {
  const Board = loadSource('room/RoomPinboard').default;
  const Frame = loadSource('room/RoomPictureFrame').default;
  const { ROOM, ROOM_DEPTH_BOUNDS, WALL_THICKNESS } =
    loadSource('room/roomConfig');
  const wall = new THREE.Group();
  wall.position.set(
    -ROOM.width / 2 - WALL_THICKNESS / 2,
    ROOM.wallHeight / 2,
    ROOM_DEPTH_BOUNDS.sideWallCenterZ,
  );
  const original = THREE.TextureLoader.prototype.load;
  const requests = [];
  THREE.TextureLoader.prototype.load = (_url, success, _progress, error) =>
    requests.push({ success, error });
  const manager = new THREE.LoadingManager();
  let ready = false;
  const loaded = new Promise((resolve) => {
    manager.onLoad = () => {
      ready = true;
      resolve();
    };
  });
  const board = new Board(wall, manager);
  const frames = GALLERY_FRAME_IDS.map((id) => new Frame(wall, id));
  try {
    const root = wall.getObjectByName('room-pinboard');
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok(
      bounds.min.x > -ROOM.width / 2 && bounds.max.x < -ROOM.width / 2 + 0.3,
    );
    assert.ok(bounds.min.y > 3.5 && bounds.max.y < 6.4);
    assert.ok(bounds.min.z > 0.8 && bounds.max.z < 4.2);
    assert.ok(bounds.max.z - bounds.min.z > 2.9);
    assert.ok(bounds.max.y - bounds.min.y < 2.6);
    for (const frame of frames)
      assert.equal(
        bounds.intersectsBox(new THREE.Box3().setFromObject(frame.root)),
        false,
      );
    assert.equal(requests.length, 2);
    assert.equal(ready, false);
    const textures = [
      new THREE.Texture({ width: 900, height: 1200 }),
      new THREE.Texture({ width: 1600, height: 900 }),
    ];
    requests[0].success(textures[0]);
    await Promise.resolve();
    assert.equal(ready, false);
    requests[1].success(textures[1]);
    await loaded;
    assert.equal(ready, true);
    assert.ok(
      textures.every((texture) => texture.colorSpace === THREE.SRGBColorSpace),
    );
    const resources = new Set(textures);
    let meshes = 0;
    let triangles = 0;
    root.traverse((object) => {
      if (!object.isMesh) return;
      meshes++;
      triangles +=
        (object.geometry.index?.count ??
          object.geometry.attributes.position.count) / 3;
      resources.add(object.geometry);
      resources.add(object.material);
      if (object.material.map) resources.add(object.material.map);
    });
    assert.ok(meshes < 40 && triangles < 6000);
    const counts = new Map();
    for (const resource of resources)
      resource.addEventListener('dispose', () =>
        counts.set(resource, (counts.get(resource) ?? 0) + 1),
      );
    board.dispose();
    board.dispose();
    assert.equal(wall.getObjectByName('room-pinboard'), undefined);
    for (const resource of resources) assert.equal(counts.get(resource), 1);
  } finally {
    board.dispose();
    for (const frame of frames) frame.dispose();
    THREE.TextureLoader.prototype.load = original;
  }
});

test('pinboard image errors or disposal during loading cannot strand the room loading gate', async () => {
  const Board = loadSource('room/RoomPinboard').default;
  const original = THREE.TextureLoader.prototype.load;
  const requests = [];
  THREE.TextureLoader.prototype.load = (_url, success, _progress, error) =>
    requests.push({ success, error });
  const manager = new THREE.LoadingManager();
  const loaded = new Promise((resolve) => {
    manager.onLoad = resolve;
  });
  const wall = new THREE.Group();
  const board = new Board(wall, manager);
  try {
    board.dispose();
    requests[0].error(new Error('offline'));
    let released = false;
    const lateTexture = new THREE.Texture({ width: 100, height: 100 });
    lateTexture.addEventListener('dispose', () => {
      released = true;
    });
    requests[1].success(lateTexture);
    await loaded;
    assert.equal(released, true);
    assert.equal(wall.children.length, 0);
  } finally {
    board.dispose();
    THREE.TextureLoader.prototype.load = original;
  }
});

test('all three posters print edge to edge on thin paper and only the paper is clickable', () => {
  const { default: RoomPictureFrame, FRAME_LAYOUT } = loadSource(
    'room/RoomPictureFrame',
  );
  for (const id of GALLERY_FRAME_IDS) {
    const frame = new RoomPictureFrame(new THREE.Group(), id);
    const { width, height } = FRAME_LAYOUT[id];
    const photo = frame.root.getObjectByName('poster-image');
    const paper = frame.root.getObjectByName('poster-paper');
    const shadow = frame.root.getObjectByName('poster-shadow');
    assert.equal(photo.geometry.parameters.width, width);
    assert.equal(photo.geometry.parameters.height, height);
    assert.equal(paper.geometry.parameters.width, width);
    assert.equal(paper.geometry.parameters.height, height);
    assert.ok(paper.geometry.parameters.depth <= 0.006);
    assert.ok(
      frame.root.children.every(
        (mesh) => mesh.geometry.type !== 'ExtrudeGeometry',
      ),
    );
    assert.ok(shadow.position.y < 0 && shadow.position.z < paper.position.z);
    assert.ok(shadow.material.transparent && !shadow.material.depthWrite);
    frame.root.updateMatrixWorld(true);
    const outside = frame.root.localToWorld(
      new THREE.Vector3(width / 2 + 0.02, 0, 0.1),
    );
    assert.equal(
      frame.isPointerOver(
        new THREE.Raycaster(outside, new THREE.Vector3(-1, 0, 0)),
      ),
      false,
    );
    const shadowTexture = shadow.material.map;
    let released = false;
    shadowTexture.addEventListener('dispose', () => {
      released = true;
    });
    frame.dispose();
    assert.equal(released, true);
  }
});

test('the third poster holds the initial loading gate and its square crop preserves the image aspect', async () => {
  const { default: RoomPictureFrame } = loadSource('room/RoomPictureFrame');
  const original = THREE.TextureLoader.prototype.load;
  let finish;
  THREE.TextureLoader.prototype.load = (_url, onLoad) => {
    finish = onLoad;
  };
  const manager = new THREE.LoadingManager();
  let ready = false;
  let errors = 0;
  manager.onLoad = () => {
    ready = true;
  };
  manager.onError = () => {
    errors++;
  };
  const frame = new RoomPictureFrame(new THREE.Group(), 'square');
  try {
    const initial = frame.loadInitial(GALLERY_IMAGES[4].id, manager);
    assert.equal(ready, false);
    const texture = new THREE.Texture({ width: 1600, height: 900 });
    finish(texture);
    assert.equal(await initial, true);
    assert.equal(ready, true);
    assert.equal(errors, 0);
    assert.equal(frame.imageId, GALLERY_IMAGES[4].id);
    assert.ok(texture.repeat.x < 1);
    assert.equal(texture.repeat.y, 1);
    assert.ok(texture.offset.x > 0);
  } finally {
    frame.dispose();
    THREE.TextureLoader.prototype.load = original;
  }
});

test('failed remote photo releases initial loading and a stale request cannot replace a newer choice', async () => {
  const { default: RoomPictureFrame } = loadSource('room/RoomPictureFrame');
  const original = THREE.TextureLoader.prototype.load;
  const requests = [];
  THREE.TextureLoader.prototype.load = (_url, success, _progress, error) => {
    requests.push({ success, error });
  };
  const frame = new RoomPictureFrame(new THREE.Group(), 'landscape');
  const manager = new THREE.LoadingManager();
  let ready = false;
  let errors = 0;
  manager.onLoad = () => {
    ready = true;
  };
  manager.onError = () => {
    errors++;
  };
  try {
    const initial = frame.loadInitial(GALLERY_IMAGES[0].id, manager);
    requests[0].error(new Error('offline'));
    assert.equal(await initial, false);
    assert.equal(ready, true);
    assert.equal(errors, 0);
    const older = frame.setImage(GALLERY_IMAGES[1].id);
    const newer = frame.setImage(GALLERY_IMAGES[2].id);
    requests[2].success(new THREE.Texture({ width: 900, height: 1200 }));
    await newer;
    const staleTexture = new THREE.Texture({ width: 900, height: 1200 });
    let disposed = false;
    staleTexture.addEventListener('dispose', () => {
      disposed = true;
    });
    requests[1].success(staleTexture);
    await assert.rejects(older);
    assert.equal(frame.imageId, GALLERY_IMAGES[2].id);
    assert.equal(disposed, true);
  } finally {
    frame.dispose();
    THREE.TextureLoader.prototype.load = original;
  }
});
