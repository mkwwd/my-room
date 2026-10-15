import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Authored in room units: desk accessories sit at Y=0, chair faces local +Z.
const material = (name, color, roughness = 0.75, metalness = 0) => {
  const result = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
  result.name = name;
  return result;
};
const white = material('Porcelain', '#f4f5f3');
const pink = material('PetalPink', '#db9faf');
const softPink = material('RoseFabric', '#efc9d2', 0.95);
const seam = material('RoseSeam', '#b9768c');
const rubber = material('SoftGraphite', '#41444a', 0.95);
const silver = material('BrushedSilver', '#b8c0c7', 0.4, 0.6);

function mesh(parent, geometry, position, surface) {
  const part = new THREE.Mesh(geometry, surface);
  part.position.set(...position);
  parent.add(part);
  return part;
}
function box(parent, size, position, surface, radius = 0.025) {
  return mesh(
    parent,
    radius
      ? new RoundedBoxGeometry(...size, 1, radius)
      : new THREE.BoxGeometry(...size),
    position,
    surface,
  );
}
function cylinder(parent, radius, height, position, surface) {
  return mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, height, 12),
    position,
    surface,
  );
}
function ellipsoid(parent, size, position, surface) {
  const part = mesh(
    parent,
    new THREE.SphereGeometry(1, 20, 12),
    position,
    surface,
  );
  part.scale.set(...size);
  return part;
}

const keyboard = new THREE.Group();
keyboard.name = 'CozyKeyboard';
box(keyboard, [1.36, 0.065, 0.46], [0, 0.0325, 0], pink, 0.027);
for (const [index, [name, color]] of [
  ['Cyan', '#a2ecf2'],
  ['Lavender', '#cbb7ff'],
  ['Pink', '#ffb5d4'],
].entries()) {
  const light = material(`KeyBacklight${name}`, color, 0.5);
  light.emissive.set(color);
  light.emissiveIntensity = 1.3;
  const x = (index - 1) * (1.3 / 3);
  box(keyboard, [1.3 / 3, 0.014, 0.41], [x, 0.071, 0], light, 0.004);
  box(keyboard, [1.3 / 3, 0.012, 0.008], [x, 0.04, 0.229], light, 0.003);
}
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 14; col++) {
    const accent = col === 0 || col === 13;
    box(
      keyboard,
      [0.076, 0.029, 0.059],
      [-0.59 + col * 0.091, 0.09, -0.156 + row * 0.073],
      accent ? softPink : white,
      0.006,
    );
  }
}
for (const x of [-0.59, -0.5, -0.41, 0.41, 0.5, 0.59]) {
  box(keyboard, [0.076, 0.029, 0.059], [x, 0.09, 0.137], softPink, 0.006);
}
box(keyboard, [0.65, 0.029, 0.059], [0, 0.09, 0.137], white, 0.009);

const mouse = new THREE.Group();
mouse.name = 'CozyMouse';
box(mouse, [0.52, 0.013, 0.49], [0, 0.0065, 0], softPink, 0.006);
const mouseBase = material('MouseBase', '#cbd0d6', 0.7);
const mouseShell = material('MousePorcelain', '#f4f5f3', 0.4);
const mouseControls = material('MouseControls', '#9ea8b5', 0.65);
const mouseGlow = material('MouseGlow', '#68d4fa', 0.5);
mouseGlow.emissive.set('#68d4fa');
mouseGlow.emissiveIntensity = 1.1;
ellipsoid(mouse, [0.143, 0.041, 0.197], [0, 0.057, 0], mouseBase);
const shellUnderlay = mesh(
  mouse,
  new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  [0, 0.09, 0],
  mouseBase,
);
shellUnderlay.scale.set(0.15, 0.09, 0.204);

// Curved shell panels leave narrow seams around the two front click buttons.
for (const [phi, width, theta, height] of [
  [0, Math.PI * 2, 0, 0.72],
  [0, Math.PI, 0.72, Math.PI / 2 - 0.72],
  [Math.PI + 0.025, Math.PI / 2 - 0.14, 0.76, Math.PI / 2 - 0.76],
  [Math.PI * 1.5 + 0.115, Math.PI / 2 - 0.14, 0.76, Math.PI / 2 - 0.76],
]) {
  const panel = mesh(
    mouse,
    new THREE.SphereGeometry(1, 24, 8, phi, width, theta, height),
    [0, 0.09, 0],
    mouseShell,
  );
  panel.scale.set(0.152, 0.092, 0.206);
}
const lightBand = mesh(
  mouse,
  new THREE.TorusGeometry(1, 0.035, 6, 40).rotateX(Math.PI / 2),
  [0, 0.086, 0],
  mouseGlow,
);
lightBand.scale.set(0.15, 0.16, 0.204);
const scroll = cylinder(mouse, 0.024, 0.027, [0, 0.171, -0.102], mouseControls);
scroll.rotation.z = Math.PI / 2;
box(mouse, [0.033, 0.009, 0.028], [0, 0.181, -0.038], mouseControls, 0.004);
for (const z of [-0.052, 0.009]) {
  box(mouse, [0.012, 0.018, 0.046], [-0.147, 0.107, z], mouseControls, 0.005);
}

const chair = new THREE.Group();
chair.name = 'CozyGamingChair';
cylinder(chair, 0.095, 0.57, [0, 0.65, 0], silver);
cylinder(chair, 0.13, 0.29, [0, 0.4, 0], white);
for (let i = 0; i < 5; i++) {
  const angle = (i / 5) * Math.PI * 2;
  const spoke = new THREE.Group();
  spoke.rotation.y = angle;
  chair.add(spoke);
  box(spoke, [0.115, 0.09, 0.61], [0, 0.255, 0.29], white, 0.036);
  box(spoke, [0.12, 0.09, 0.12], [0, 0.2, 0.58], silver, 0.02);
  for (const x of [-0.06, 0.06]) {
    const wheel = cylinder(spoke, 0.13, 0.065, [x, 0.13, 0.59], rubber);
    wheel.rotation.z = Math.PI / 2;
  }
}
box(chair, [1.13, 0.17, 1.04], [0, 0.995, 0.03], white, 0.075);
box(chair, [1.02, 0.16, 0.94], [0, 1.09, 0.06], softPink, 0.072);
for (const x of [-0.45, 0.45]) {
  box(chair, [0.105, 0.13, 0.91], [x, 1.14, 0.04], pink, 0.045);
}

const outline = new THREE.Shape();
outline.moveTo(-0.4, 1.04);
outline.lineTo(-0.49, 1.83);
outline.lineTo(-0.62, 2.12);
outline.quadraticCurveTo(-0.63, 2.23, -0.5, 2.3);
outline.lineTo(-0.37, 2.56);
outline.quadraticCurveTo(-0.34, 2.62, -0.25, 2.62);
outline.lineTo(0.25, 2.62);
outline.quadraticCurveTo(0.34, 2.62, 0.37, 2.56);
outline.lineTo(0.5, 2.3);
outline.quadraticCurveTo(0.63, 2.23, 0.62, 2.12);
outline.lineTo(0.49, 1.83);
outline.lineTo(0.4, 1.04);
outline.closePath();
mesh(
  chair,
  new THREE.ExtrudeGeometry(outline, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 5,
  }),
  [0, 0, -0.55],
  white,
);
box(chair, [0.74, 0.86, 0.18], [0, 1.74, -0.39], softPink, 0.075);
box(chair, [0.72, 0.22, 0.23], [0, 1.29, -0.31], pink, 0.075);
box(chair, [0.59, 0.31, 0.19], [0, 2.43, -0.36], pink, 0.075);
for (const x of [-0.21, 0.21]) {
  box(chair, [0.18, 0.078, 0.025], [x, 2.19, -0.32], rubber, 0.034);
  box(chair, [0.018, 0.55, 0.01], [x * 1.43, 1.77, -0.294], seam, 0.004);
}
for (const x of [-0.66, 0.66]) {
  box(chair, [0.075, 0.44, 0.075], [x, 1.22, 0], silver, 0.025);
  box(chair, [0.2, 0.11, 0.62], [x, 1.465, 0.05], white, 0.046);
  box(chair, [0.17, 0.04, 0.56], [x, 1.527, 0.05], pink, 0.017);
}
box(chair, [0.23, 0.035, 0.055], [0.61, 0.91, 0.16], rubber, 0.016);

// One mesh per material keeps the repeated keys and casters inexpensive to draw.
function batchParts(root) {
  root.updateMatrixWorld(true);
  const batches = new Map();
  root.traverse((part) => {
    if (!part.isMesh) return;
    const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
    geometry.deleteAttribute('uv');
    const vertices = mergeVertices(geometry);
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(vertices);
  });
  root.clear();
  for (const [surface, parts] of batches) {
    const combined = mesh(root, mergeGeometries(parts), [0, 0, 0], surface);
    combined.name = surface.name;
  }
}
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};
for (const [name, object] of [
  ['cozy-keyboard', keyboard],
  ['cozy-mouse', mouse],
  ['cozy-gaming-chair', chair],
]) {
  batchParts(object);
  const binary = await new GLTFExporter().parseAsync(object, { binary: true });
  await writeFile(
    new URL(`../public/models/${name}.glb`, import.meta.url),
    Buffer.from(binary),
  );
  console.log(
    `${name}.glb: ${binary.byteLength} bytes, ${object.children.length} draw calls`,
  );
}
