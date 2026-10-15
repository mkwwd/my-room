import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function readModel(name) {
  const bytes = readFileSync(
    new URL(`../public/models/${name}.glb`, import.meta.url),
  );
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  return { bytes, json, binary: bytes.subarray(28 + jsonLength) };
}

function imageHash(model) {
  const view = model.json.bufferViews[model.json.images[0].bufferView];
  return createHash('sha256')
    .update(
      model.binary.subarray(view.byteOffset, view.byteOffset + view.byteLength),
    )
    .digest('hex');
}

test('the blink preview adds skinned eyelids without changing the approved character', () => {
  assert.ok(
    existsSync(new URL('../public/models/doll-blink.glb', import.meta.url)),
    'generate the separate blink preview',
  );
  const approved = readModel('doll-soft');
  const blink = readModel('doll-blink');
  assert.equal(
    createHash('sha256').update(approved.bytes).digest('hex'),
    'b1c627dee5937b4a7723ed3158619f297ec8fd80259334b7f9b1082a4f500aa3',
    'leave the approved room character unchanged',
  );
  assert.equal(imageHash(blink), imageHash(approved));
  for (const original of approved.json.animations) {
    const revised = blink.json.animations.find(
      ({ name }) => name === original.name,
    );
    assert.ok(revised, `retain ${original.name}`);
    const duration = (model, clip) =>
      Math.max(
        ...clip.samplers.map((s) => model.json.accessors[s.input].max[0]),
      );
    assert.equal(
      duration(blink, revised),
      duration(approved, original),
      'preserve movement timing',
    );
  }
  assert.deepEqual(blink.json.animations.map(({ name }) => name).sort(), [
    'Blink',
    'Sitting',
    'Walking',
  ]);
  const clip = blink.json.animations.find(({ name }) => name === 'Blink');
  assert.ok(clip.channels.length > 0);
  for (const channel of clip.channels) {
    assert.equal(channel.target.path, 'weights');
    const node = blink.json.nodes[channel.target.node];
    assert.ok(
      Number.isInteger(node.skin),
      'eyelids follow the head during movement',
    );
    assert.equal(
      blink.json.skins[node.skin].joints.length,
      approved.json.skins[0].joints.length,
    );
    for (const primitive of blink.json.meshes[node.mesh].primitives) {
      assert.ok(
        primitive.targets?.some((target) => Number.isInteger(target.POSITION)),
      );
      assert.ok(
        'JOINTS_0' in primitive.attributes &&
          'WEIGHTS_0' in primitive.attributes,
      );
    }
    const sampler = clip.samplers[channel.sampler];
    const times = blink.json.accessors[sampler.input];
    assert.ok(
      times.max[0] >= 0.2 && times.max[0] <= 0.4,
      'a brief natural blink',
    );
    const weights = blink.json.accessors[sampler.output];
    const view = blink.json.bufferViews[weights.bufferView];
    const offset = (view.byteOffset ?? 0) + (weights.byteOffset ?? 0);
    assert.equal(weights.componentType, 5126);
    const values = Array.from({ length: weights.count }, (_, index) =>
      blink.binary.readFloatLE(offset + index * 4),
    );
    assert.equal(values[0], 0, 'start with open eyes');
    assert.equal(values.at(-1), 0, 'reopen fully before the clip ends');
    assert.equal(Math.max(...values), 1, 'close both lids fully');
  }
  assert.ok(
    blink.bytes.length < approved.bytes.length * 1.1,
    'keep the blink lightweight',
  );
});

test('the room loads the approved blinking character', () => {
  const source = readFileSync(
    new URL('../src/components/room/roomConfig.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const config = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module: config,
    exports: config.exports,
  });
  const url = new URL(
    config.exports.ROOM_MODELS.character,
    'http://room.local',
  );
  const active = readFileSync(
    new URL(`../public${url.pathname}`, import.meta.url),
  );
  assert.equal(
    createHash('sha256').update(active).digest('hex'),
    createHash('sha256').update(readModel('doll-blink').bytes).digest('hex'),
  );
  assert.notEqual(url.pathname, '/models/doll-preview.glb');
});

for (const name of ['cat', 'doll']) {
  test(`${name} revision retains the original appearance and rig`, () => {
    const original = readModel(name);
    const revised = readModel(`${name}-custom`);
    assert.equal(
      revised.json.skins?.length,
      1,
      'retain the original skinned model',
    );
    assert.equal(
      revised.json.skins[0].joints.length,
      original.json.skins[0].joints.length,
    );
    assert.equal(
      imageHash(revised),
      imageHash(original),
      'preserve the exact original face/fur texture',
    );
    assert.equal(revised.json.meshes.length, original.json.meshes.length);
    const sourcePrimitive = original.json.meshes[0].primitives[0];
    const primitive = revised.json.meshes[0].primitives[0];
    assert.ok(
      'JOINTS_0' in primitive.attributes && 'WEIGHTS_0' in primitive.attributes,
    );
    const oldCount = original.json.accessors[sourcePrimitive.indices].count;
    const newCount = revised.json.accessors[primitive.indices].count;
    assert.ok(
      newCount < oldCount * 0.5 && newCount > oldCount * 0.25,
      'retain detail while reducing triangles',
    );
    assert.ok(
      revised.bytes.length < original.bytes.length,
      'revision is smaller than its source',
    );
    const expectedClips = name === 'cat' ? ['Walking'] : ['Walking', 'Sitting'];
    assert.deepEqual(
      revised.json.animations.map((clip) => clip.name).sort(),
      expectedClips.sort(),
    );
    for (const clip of revised.json.animations) {
      assert.ok(clip.channels.length > 20, 'animate the full original rig');
      for (const channel of clip.channels) {
        assert.ok(
          revised.json.nodes[channel.target.node],
          'animation targets an existing node',
        );
      }
    }
  });
}

test('the doll preview retains its rig and texture with distinct surface materials', () => {
  const original = readModel('doll');
  const preview = readModel('doll-preview');
  assert.equal(
    preview.json.skins[0].joints.length,
    original.json.skins[0].joints.length,
  );
  assert.equal(imageHash(preview), imageHash(original));
  const materials = new Map(
    preview.json.materials.map((material) => [material.name, material]),
  );
  for (const name of ['SoftSkin', 'GlassEyes', 'WovenClothes']) {
    assert.ok(materials.has(name), `${name} surface is present`);
    assert.ok(materials.get(name).pbrMetallicRoughness.baseColorTexture);
  }
  assert.ok(
    materials.get('GlassEyes').pbrMetallicRoughness.roughnessFactor < 0.3,
  );
  assert.ok(
    materials.get('WovenClothes').pbrMetallicRoughness.roughnessFactor > 0.8,
  );
  assert.deepEqual(preview.json.animations.map((clip) => clip.name).sort(), [
    'Sitting',
    'Walking',
  ]);
});

test('only preview hair replaces the fine-line texture with soft vertex tones', () => {
  const { json } = readModel('doll-preview');
  const hairIndex = json.materials.findIndex(({ name }) => name === 'WavyHair');
  assert.ok(hairIndex >= 0);
  assert.equal(
    json.materials[hairIndex].pbrMetallicRoughness.baseColorTexture,
    undefined,
    'the original fine strands must not remain in the hair material',
  );
  const hair = json.meshes[0].primitives.filter(
    ({ material }) => material === hairIndex,
  );
  assert.ok(hair.length > 0);
  for (const primitive of hair) {
    assert.ok(
      'COLOR_0' in primitive.attributes,
      'retain soft brown tonal detail',
    );
  }
});
