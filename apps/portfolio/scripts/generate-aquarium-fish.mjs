import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Run: node apps/portfolio/scripts/generate-aquarium-fish.mjs
// Generation stays out of the browser bundle; each GLB includes a movable tail.
function createBlueTang() {
  const fish = new THREE.Group();
  const blue = new THREE.Color('#1975e8');
  const ink = new THREE.Color('#102139');
  const bodyGeometry = new THREE.SphereGeometry(1, 32, 20);
  const positions = bodyGeometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  // The dark dorsal band and palette-shaped flank mark wrap around both sides.
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const patch = ((x + 0.22) / 0.62) ** 2 + ((y - 0.2) / 0.5) ** 2;
    const blueIsland = ((x + 0.32) / 0.32) ** 2 + ((y - 0.17) / 0.21) ** 2;
    const color = y > 0.67 || (patch < 1 && blueIsland > 1) ? ink : blue;
    color.toArray(colors, i * 3);
  }
  bodyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  bodyGeometry.scale(0.43, 0.28, 0.105);
  const body = new THREE.Mesh(
    bodyGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58 }),
  );
  fish.add(body);

  const yellow = new THREE.MeshStandardMaterial({
    color: '#ffdc37',
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: '#1852b7',
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0.025, 0);
  tailShape.quadraticCurveTo(-0.1, 0.05, -0.25, 0.19);
  tailShape.quadraticCurveTo(-0.21, 0, -0.25, -0.19);
  tailShape.quadraticCurveTo(-0.1, -0.05, 0.025, 0);
  const tail = new THREE.Group();
  tail.name = 'FishTail';
  tail.position.x = -0.39;
  tail.add(new THREE.Mesh(new THREE.ShapeGeometry(tailShape, 6), yellow));
  fish.add(tail);

  const finShape = new THREE.Shape();
  finShape.moveTo(-0.32, 0.13);
  finShape.quadraticCurveTo(-0.14, 0.42, 0.23, 0.23);
  finShape.lineTo(0.1, 0.18);
  finShape.closePath();
  const dorsal = new THREE.Mesh(
    new THREE.ShapeGeometry(finShape, 8),
    finMaterial,
  );
  fish.add(dorsal);
  const lower = dorsal.clone();
  lower.scale.y = -0.8;
  fish.add(lower);

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: '#101820',
    roughness: 0.25,
  });
  const glintMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyeGeometry = new THREE.SphereGeometry(0.032, 10, 8);
  const glintGeometry = new THREE.SphereGeometry(0.009, 6, 4);
  const sideFinGeometry = new THREE.SphereGeometry(1, 8, 6);
  sideFinGeometry.scale(0.09, 0.035, 0.009);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(0.31, 0.055, side * 0.072);
    const glint = new THREE.Mesh(glintGeometry, glintMaterial);
    glint.position.set(0.321, 0.067, side * 0.099);
    const fin = new THREE.Mesh(sideFinGeometry, yellow);
    fin.position.set(0.08, -0.05, side * 0.108);
    fin.rotation.z = -0.35;
    fish.add(eye, glint, fin);
  }
  return fish;
}

function createClownfish() {
  const fish = new THREE.Group();
  const orange = new THREE.Color('#f58220');
  const white = new THREE.Color('#fff9ed');
  const black = new THREE.Color('#202127');
  const bodyGeometry = new THREE.SphereGeometry(1, 24, 24);
  // Align latitude rings with the bands so their borders wrap evenly around the body.
  bodyGeometry.rotateZ(Math.PI / 2);
  const positions = bodyGeometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const band = Math.min(
      Math.abs(x - 0.62) / 0.11,
      Math.abs(x + 0.02) / 0.14,
      Math.abs(x + 0.76) / 0.075,
    );
    const color = band < 1 ? white : band < 1.55 ? black : orange;
    color.toArray(colors, i * 3);
  }
  bodyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  bodyGeometry.scale(0.43, 0.225, 0.115);
  fish.add(
    new THREE.Mesh(
      bodyGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
      }),
    ),
  );

  const finMaterial = new THREE.MeshStandardMaterial({
    color: orange,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: black,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  function borderedFin(shape) {
    const geometry = new THREE.ShapeGeometry(shape, 6);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geometry, edgeMaterial));
    for (const side of [-1, 1]) {
      const inset = new THREE.Mesh(geometry, finMaterial);
      inset.scale.set(0.82, 0.82, 1);
      inset.position.z = side * 0.002;
      group.add(inset);
    }
    return group;
  }
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0.02, 0);
  tailShape.quadraticCurveTo(-0.11, 0.07, -0.22, 0.15);
  tailShape.quadraticCurveTo(-0.29, 0, -0.22, -0.15);
  tailShape.quadraticCurveTo(-0.11, -0.07, 0.02, 0);
  const tail = borderedFin(tailShape);
  tail.name = 'FishTail';
  tail.position.x = -0.39;
  fish.add(tail);

  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(-0.3, 0.12);
  dorsalShape.quadraticCurveTo(-0.18, 0.32, 0.16, 0.24);
  dorsalShape.lineTo(0.25, 0.14);
  dorsalShape.closePath();
  const dorsal = borderedFin(dorsalShape);
  const lower = dorsal.clone(true);
  lower.scale.y = -0.8;
  fish.add(dorsal, lower);

  const eyeGeometry = new THREE.SphereGeometry(0.033, 10, 8);
  const glintGeometry = new THREE.SphereGeometry(0.009, 6, 4);
  const glintMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const sideFinGeometry = new THREE.SphereGeometry(1, 10, 6);
  sideFinGeometry.scale(0.085, 0.052, 0.012);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, edgeMaterial);
    eye.position.set(0.34, 0.04, side * 0.064);
    const glint = new THREE.Mesh(glintGeometry, glintMaterial);
    glint.position.set(0.352, 0.052, side * 0.091);
    const fin = new THREE.Mesh(sideFinGeometry, finMaterial);
    fin.position.set(0.12, -0.07, side * 0.109);
    fin.rotation.z = -0.4;
    fish.add(eye, glint, fin);
  }
  return fish;
}

// GLTFExporter only needs this browser API for its binary Blob conversion.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
};

for (const [name, createFish] of [
  ['clownfish', createClownfish],
  ['blue-tang', createBlueTang],
]) {
  const fish = createFish();
  fish.name = name;
  // These untextured meshes do not need UVs in the exported assets.
  fish.traverse((object) => {
    if (object.isMesh) object.geometry.deleteAttribute('uv');
  });
  const binary = await new GLTFExporter().parseAsync(fish, { binary: true });
  await writeFile(
    new URL(`../public/models/${name}.glb`, import.meta.url),
    Buffer.from(binary),
  );
  console.log(`${name}.glb: ${binary.byteLength} bytes`);
}
