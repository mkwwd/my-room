import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

test('rotation guidance is server-rendered with readable text and decorative icons', () => {
  const path = fileURLToPath(
    new URL(
      '../src/components/room/RoomOrientationNotice.tsx',
      import.meta.url,
    ),
  );
  const compiledModule = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module: compiledModule,
      exports: compiledModule.exports,
      require: (id) =>
        id.endsWith('.css') ? { default: {} } : createRequire(path)(id),
    },
  );
  const html = renderToStaticMarkup(
    createElement(compiledModule.exports.default),
  );
  assert.match(html, /role="status"/);
  assert.match(html, /화면을 가로로 돌려주세요/);
  assert.match(html, /My Room/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<button|<canvas/);
});
