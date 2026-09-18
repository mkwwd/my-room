import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import ts from 'typescript';

const modules = new Map();
function loadSource(url) {
  const path = fileURLToPath(url);
  if (modules.has(path)) return modules.get(path);
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const compiledModule = { exports: {} };
  vm.runInNewContext(outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (id) =>
      id.endsWith('/GLTFLoader.js')
        ? {
            GLTFLoader: class {
              load(_path, ready) {
                const scene = new THREE.Group();
                scene.add(
                  new THREE.Mesh(
                    new THREE.BoxGeometry(5.3, 3.04, 0.1),
                    new THREE.MeshBasicMaterial(),
                  ),
                );
                ready({ scene });
              }
            },
          }
        : id.startsWith('.')
          ? loadSource(new URL(`${id}.ts`, url))
          : createRequire(path)(id),
  });
  modules.set(path, compiledModule.exports);
  return compiledModule.exports;
}
const TvStation = loadSource(
  new URL('../src/components/tv/TvStation.ts', import.meta.url),
).default;

test('TV stays powered through zoom-out, but is hidden from behind and after disposal', () => {
  const station = new TvStation(new THREE.Scene(), new THREE.LoadingManager());
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  camera.position.copy(station.focusPosition);
  camera.lookAt(station.focusTarget);
  camera.updateMatrixWorld(true);
  assert.equal(station.getScreenViewport(camera, 1280, 720), null);
  station.turnOn();
  assert.ok(station.getScreenViewport(camera, 1280, 720));
  camera.position.add(new THREE.Vector3(3, 2, 5));
  camera.lookAt(station.focusTarget);
  camera.updateMatrixWorld(true);
  assert.ok(station.getScreenViewport(camera, 1280, 720));
  camera.position.copy(station.focusTarget).add(new THREE.Vector3(0, 0, -5));
  camera.lookAt(station.focusTarget);
  camera.updateMatrixWorld(true);
  assert.equal(station.getScreenViewport(camera, 1280, 720), null);
  station.dispose();
  assert.equal(station.getScreenViewport(camera, 1280, 720), null);
});
