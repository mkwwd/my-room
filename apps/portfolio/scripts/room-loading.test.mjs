import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const path = fileURLToPath(
  new URL('../src/components/room/RoomLoadingGate.ts', import.meta.url),
);
const source = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const compiledModule = { exports: {} };
vm.runInNewContext(source.outputText, {
  module: compiledModule,
  exports: compiledModule.exports,
  require: createRequire(path),
});
const Gate = compiledModule.exports.default;
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('progress follows assets, stays monotonic with nested loads and reaches 100 only after preparation', async () => {
  const progress = [];
  let finish;
  const gate = new Gate(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => assert.equal(progress.at(-1), 100),
    () => assert.fail('unexpected load error'),
    (percent) => progress.push(percent),
  );
  gate.manager.itemStart('model');
  gate.manager.itemStart('cat');
  gate.completeSetup();
  assert.equal(progress.at(-1), 0);
  gate.manager.itemEnd('cat');
  assert.equal(progress.at(-1), 47);
  gate.manager.itemStart('texture-a');
  gate.manager.itemStart('texture-b');
  gate.manager.itemEnd('model');
  assert.equal(progress.at(-1), 47);
  gate.manager.itemEnd('texture-a');
  gate.manager.itemEnd('texture-b');
  assert.equal(progress.at(-1), 95);
  finish();
  await tick();
  assert.equal(progress.at(-1), 100);
  assert.ok(
    progress.every((value, index) => !index || value >= progress[index - 1]),
  );
});

test('failed and disposed loads stop publishing progress', async () => {
  for (const fail of [true, false]) {
    const progress = [];
    const gate = new Gate(
      async () => {},
      () => {},
      () => {},
      (value) => progress.push(value),
    );
    gate.manager.itemStart('model');
    gate.completeSetup();
    assert.deepEqual(progress, [0]);
    if (fail) gate.manager.itemError('model');
    else gate.dispose();
    gate.manager.itemEnd('model');
    await tick();
    assert.deepEqual(progress, [0]);
  }
});

test('the room waits for nested assets and GPU preparation before opening', async () => {
  let ready = false;
  let preparing = false;
  let finish;
  const gate = new Gate(
    async () => {
      preparing = true;
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
    () => {
      ready = true;
    },
    () => assert.fail('unexpected load error'),
  );
  gate.manager.itemStart('model');
  gate.completeSetup();
  gate.manager.itemStart('model-texture');
  gate.manager.itemEnd('model');
  await tick();
  assert.equal(preparing, false);
  gate.manager.itemEnd('model-texture');
  await tick();
  assert.equal(preparing, true);
  assert.equal(ready, false);
  finish();
  await tick();
  assert.equal(ready, true);
  gate.dispose();
});

test('cached assets cannot finish before scene setup is complete', async () => {
  let ready = false;
  const gate = new Gate(
    async () => {},
    () => {
      ready = true;
    },
    () => {},
  );
  gate.manager.itemStart('cached');
  gate.manager.itemEnd('cached');
  await tick();
  assert.equal(ready, false);
  gate.completeSetup();
  await tick();
  assert.equal(ready, true);
  gate.dispose();
});

test('failed assets or renderer preparation never reveal an incomplete room', async () => {
  for (const rendererFails of [false, true]) {
    let errors = 0;
    let ready = false;
    const gate = new Gate(
      async () => {
        if (rendererFails) throw Error('GPU');
      },
      () => {
        ready = true;
      },
      () => {
        errors++;
      },
    );
    if (!rendererFails) gate.manager.itemError('missing-model');
    gate.completeSetup();
    await tick();
    assert.equal(ready, false);
    assert.equal(errors, 1);
    gate.dispose();
  }
});

test('unmounting during preparation cannot publish ready to another scene', async () => {
  let finish;
  let ready = false;
  const gate = new Gate(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {
      ready = true;
    },
    () => {},
  );
  gate.completeSetup();
  await tick();
  gate.dispose();
  finish();
  await tick();
  assert.equal(ready, false);
});
