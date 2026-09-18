import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Run: node apps/portfolio/scripts/generate-cozy-desk.mjs
// Local +Z faces the room. The rear edge is straight so it can sit against a wall.
const desk = new THREE.Group();
desk.name = 'CozyDesk';
const tabletop = new THREE.MeshStandardMaterial({
  color: '#f4f5f3',
  roughness: 0.86,
});
const silver = new THREE.MeshStandardMaterial({
  color: '#bcc4cb',
  metalness: 0.65,
  roughness: 0.42,
});
const white = new THREE.MeshStandardMaterial({
  color: '#edf1ee',
  roughness: 0.74,
});
const drawerWhite = new THREE.MeshStandardMaterial({
  color: '#fafbf7',
  roughness: 0.68,
});
const recess = new THREE.MeshStandardMaterial({
  color: '#aeb5b1',
  roughness: 0.85,
});
const geometries = new Map();

function box(parent, name, dimensions, position, material, radius = 0.025) {
  const key = [...dimensions, radius].join(',');
  if (!geometries.has(key)) {
    const geometry = mergeVertices(
      new RoundedBoxGeometry(...dimensions, 2, radius),
    );
    geometry.deleteAttribute('uv');
    geometries.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometries.get(key), material);
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

box(desk, 'DeskTop', [3.7, 0.14, 1.65], [0, 1.65, 0], tabletop, 0.05);

for (const z of [-0.59, 0.59]) {
  box(desk, 'WhiteLeg', [0.115, 1.58, 0.115], [-1.57, 0.79, z], white);
}
box(desk, 'WhiteSideRail', [0.1, 0.1, 1.27], [-1.57, 0.24, 0], white);
box(desk, 'WhiteRearRail', [2.96, 0.14, 0.095], [0, 1.46, -0.64], white);

const cabinet = new THREE.Group();
cabinet.name = 'DrawerCabinet';
cabinet.position.x = 1.24;
desk.add(cabinet);
box(cabinet, 'CabinetBody', [0.9, 1.42, 1.4], [0, 0.87, -0.04], white, 0.04);
box(
  cabinet,
  'DrawerRecess',
  [0.81, 1.3, 0.018],
  [0, 0.88, 0.666],
  recess,
  0.008,
);
for (const y of [0.44, 0.88, 1.32]) {
  box(
    cabinet,
    'DrawerFront',
    [0.8, 0.417, 0.065],
    [0, y, 0.695],
    drawerWhite,
    0.02,
  );
  box(
    cabinet,
    'SilverHandle',
    [0.24, 0.042, 0.047],
    [0, y + 0.045, 0.75],
    silver,
    0.016,
  );
}
for (const x of [-0.34, 0.34]) {
  for (const z of [-0.56, 0.48]) {
    box(cabinet, 'CabinetFoot', [0.08, 0.16, 0.08], [x, 0.08, z], white, 0.012);
  }
}

globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};
const binary = await new GLTFExporter().parseAsync(desk, { binary: true });
await writeFile(
  new URL('../public/models/cozy-desk.glb', import.meta.url),
  Buffer.from(binary),
);
console.log(`cozy-desk.glb: ${binary.byteLength} bytes`);
