import * as THREE from 'three';

// All entrance scenery is local geometry: it appears before room assets load.
export default function createEntranceGarden(doorZ: number) {
  const garden = new THREE.Group();
  garden.name = 'EntranceGarden';
  garden.position.z = doorZ;
  const random = (seed: number) => THREE.MathUtils.seededRandom(seed + 417);
  const surface = (color: string) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
  const mesh = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number,
  ) => {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  };

  const pixels = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const shade = Math.round(random(i) * 24);
    pixels.set([131 + shade, 165 + shade, 91 + shade, 255], i * 4);
  }
  const grassTexture = new THREE.DataTexture(pixels, 64, 64);
  grassTexture.colorSpace = THREE.SRGBColorSpace;
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(36, 36);
  grassTexture.magFilter = THREE.LinearFilter;
  grassTexture.minFilter = THREE.LinearMipmapLinearFilter;
  grassTexture.generateMipmaps = true;
  grassTexture.needsUpdate = true;
  const lawn = mesh(
    garden,
    new THREE.BoxGeometry(60, 0.12, 60),
    new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1 }),
    0,
    -0.065,
    30,
  );
  lawn.name = 'Lawn';

  const stone = surface('#858b83');
  const stoneEdge = surface('#505950');
  const stoneOutline = new THREE.Shape();
  stoneOutline.moveTo(-0.5, -0.15);
  stoneOutline.bezierCurveTo(-0.54, 0.16, -0.34, 0.44, -0.07, 0.46);
  stoneOutline.bezierCurveTo(0.24, 0.51, 0.49, 0.28, 0.51, 0.04);
  stoneOutline.bezierCurveTo(0.55, -0.2, 0.29, -0.44, 0.02, -0.46);
  stoneOutline.bezierCurveTo(-0.26, -0.49, -0.48, -0.35, -0.5, -0.15);
  const stoneGeometry = new THREE.ExtrudeGeometry(stoneOutline, {
    depth: 0.04,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.035,
    bevelSegments: 2,
    curveSegments: 5,
  });
  stoneGeometry.rotateX(-Math.PI / 2);
  const stones = [
    [0, 0.38],
    [-0.48, 1.68],
    [-1.14, 2.98],
    [-1.94, 4.28],
    [-2.87, 5.58],
  ];
  stones.forEach(([x, z], i) => {
    const step = mesh(garden, stoneGeometry, [stone, stoneEdge], x, 0.014, z);
    step.name = 'SteppingStone';
    step.scale.set(0.85, 1, 0.68);
    step.rotation.y = i * 0.48;
  });

  const mailbox = new THREE.Group();
  mailbox.name = 'Mailbox';
  mailbox.position.set(2.65, 0, 0.65);
  garden.add(mailbox);
  const red = surface('#b64643');
  const rim = surface('#dbe3e4');
  const dark = surface('#354d60');
  const brass = new THREE.MeshStandardMaterial({
    color: '#c5ae77',
    metalness: 0.55,
    roughness: 0.4,
  });
  mesh(mailbox, new THREE.BoxGeometry(0.15, 1.55, 0.17), rim, 0, 0.775, 0);
  mesh(
    mailbox,
    new THREE.BoxGeometry(0.46, 0.07, 0.4),
    surface('#d1d5cf'),
    0,
    0.03,
    0,
  );
  mesh(mailbox, new THREE.BoxGeometry(0.82, 0.08, 0.72), dark, 0, 1.53, 0);
  const arch = new THREE.Shape();
  arch.moveTo(-0.42, 0);
  arch.lineTo(0.42, 0);
  arch.lineTo(0.42, 0.3);
  arch.absarc(0, 0.3, 0.42, 0, Math.PI, false);
  arch.lineTo(-0.42, 0);
  const shell = new THREE.ExtrudeGeometry(arch, {
    depth: 0.65,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 12,
  });
  mesh(mailbox, shell, red, 0, 1.57, -0.325);
  const door = mesh(
    mailbox,
    new THREE.ShapeGeometry(arch, 12),
    rim,
    0,
    1.59,
    0.354,
  );
  door.scale.set(0.9, 0.91, 1);
  mesh(
    mailbox,
    new THREE.BoxGeometry(0.43, 0.035, 0.025),
    dark,
    0,
    1.96,
    0.365,
  );
  mesh(
    mailbox,
    new THREE.BoxGeometry(0.15, 0.047, 0.055),
    brass,
    0,
    1.69,
    0.39,
  );
  mesh(
    mailbox,
    new THREE.BoxGeometry(0.055, 0.5, 0.055),
    brass,
    0.47,
    1.98,
    0.04,
  );
  mesh(
    mailbox,
    new THREE.BoxGeometry(0.23, 0.14, 0.055),
    surface('#c97e82'),
    0.56,
    2.18,
    0.04,
  );

  const clusters = [
    [-2.7, 0.65, 4],
    [-3.2, 2.1, 4],
    [2.4, 1.65, 4],
    [3.3, 0.6, 4],
    [3.25, 3.85, 4],
  ];
  const count = clusters.reduce((total, cluster) => total + cluster[2], 0);
  const green = surface('#50814d');
  green.side = THREE.DoubleSide;
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.013, 0.02, 1, 5),
    green,
    count,
  );
  stems.name = 'TulipStems';
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(-0.16, 0.2, -0.09, 0.44, 0.04, 0.68);
  leafShape.bezierCurveTo(0.17, 0.38, 0.14, 0.15, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 6);
  const leafPositions = leafGeometry.attributes.position;
  for (let i = 0; i < leafPositions.count; i++) {
    leafPositions.setZ(i, Math.pow(leafPositions.getY(i) / 0.68, 2) * 0.28);
  }
  leafGeometry.computeVertexNormals();
  const leaves = new THREE.InstancedMesh(leafGeometry, green, count * 2);

  // Six curved petals form an open cup, rather than a spherical flower head.
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= 6; row++) {
    const t = row / 6;
    const radius = 0.025 + 0.145 * Math.sin(t * Math.PI * 0.8);
    for (let column = 0; column <= 6; column++) {
      const u = column / 3 - 1;
      vertices.push(
        Math.sin(u * 0.68) * radius,
        t * 0.34 - 0.045 * u * u * t ** 4,
        Math.cos(u * 0.68) * radius,
      );
      if (row < 6 && column < 6) {
        const a = row * 7 + column;
        indices.push(a, a + 1, a + 7, a + 1, a + 8, a + 7);
      }
    }
  }
  const petalGeometry = new THREE.BufferGeometry();
  petalGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  petalGeometry.setIndex(indices);
  petalGeometry.computeVertexNormals();
  const petalMaterial = surface('#ffffff');
  petalMaterial.side = THREE.DoubleSide;
  const petals = new THREE.InstancedMesh(
    petalGeometry,
    petalMaterial,
    count * 6,
  );
  petals.name = 'TulipPetals';
  const colors = ['#efa0b3', '#f2cf69', '#fff5e8'].map(
    (color) => new THREE.Color(color),
  );
  const pose = new THREE.Object3D();
  const flower = new THREE.Object3D();
  const petalPose = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  let index = 0;
  clusters.forEach(([cx, cz, amount]) => {
    for (let i = 0; i < amount; i++, index++) {
      const angle = i * 2.399;
      const radius = 0.18 + 0.23 * Math.sqrt(i);
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius * 0.85;
      const height = 0.5 + random(index + 701) * 0.43;
      const size = 0.88 + random(index + 902) * 0.3;
      pose.position.set(x, height / 2, z);
      pose.rotation.set(0, 0, 0);
      pose.scale.set(1, height, 1);
      pose.updateMatrix();
      stems.setMatrixAt(index, pose.matrix);
      for (let side = 0; side < 2; side++) {
        pose.position.set(x, height * (0.12 + side * 0.19), z);
        pose.rotation.set(0.12, angle + side * Math.PI, (side ? -1 : 1) * 0.2);
        pose.scale.setScalar(size * (side ? 0.8 : 1));
        pose.updateMatrix();
        leaves.setMatrixAt(index * 2 + side, pose.matrix);
      }
      flower.position.set(x, height - 0.035, z);
      flower.rotation.set(
        (random(index + 501) - 0.5) * 0.25,
        angle,
        (random(index + 601) - 0.5) * 0.3,
      );
      flower.scale.setScalar(size);
      flower.updateMatrix();
      for (let petal = 0; petal < 6; petal++) {
        petalPose.rotation.y = (petal * Math.PI) / 3;
        petalPose.scale.setScalar(petal % 2 ? 0.92 : 1);
        petalPose.updateMatrix();
        matrix.multiplyMatrices(flower.matrix, petalPose.matrix);
        petals.setMatrixAt(index * 6 + petal, matrix);
        petals.setColorAt(index * 6 + petal, colors[index % colors.length]);
      }
    }
  });
  garden.add(stems, leaves, petals);

  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.02, 0, 0, 0.02, 0, 0, 0.03, 0.12, 0.025],
      3,
    ),
  );
  bladeGeometry.computeVertexNormals();
  const blades = new THREE.InstancedMesh(bladeGeometry, green, 900);
  const walk = new THREE.Line3(
    new THREE.Vector3(-2.6, 0, 3.5),
    new THREE.Vector3(-0.45, 0, 0.9),
  );
  const nearest = new THREE.Vector3();
  let planted = 0;
  for (let i = 0; i < 1200 && planted < 900; i++) {
    const x = (random(i + 1401) - 0.5) * 12;
    const z = 0.2 + random(i + 3201) * 7;
    pose.position.set(x, 0, z);
    if (
      (Math.abs(x) < 1.85 && z < 1) ||
      (Math.abs(x) < 1.25 && z > 3.5) ||
      pose.position.distanceTo(
        walk.closestPointToPoint(pose.position, true, nearest),
      ) < 0.55 ||
      stones.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 0.65)
    )
      continue;
    pose.rotation.set(0, random(i + 4501) * Math.PI * 2, 0);
    pose.scale.setScalar(0.5 + random(i + 6101) * 0.65);
    pose.updateMatrix();
    blades.setMatrixAt(planted++, pose.matrix);
  }
  blades.count = planted;
  garden.add(blades);

  const frameMaterial = surface('#46534c');
  const lanternPane = new THREE.MeshStandardMaterial({
    color: '#f5e3af',
    emissive: '#ffcc80',
    emissiveIntensity: 0.3,
    roughness: 0.5,
  });
  const frames = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.03, 0.54, 0.03),
    frameMaterial,
    8,
  );
  const backplate = new THREE.BoxGeometry(0.2, 0.45, 0.055);
  const bracket = new THREE.BoxGeometry(0.08, 0.08, 0.35);
  const pane = new THREE.BoxGeometry(0.34, 0.5, 0.26);
  const base = new THREE.BoxGeometry(0.42, 0.065, 0.35);
  const roof = new THREE.ConeGeometry(0.32, 0.15, 4);
  roof.rotateY(Math.PI / 4);
  let frameIndex = 0;
  for (const side of [-1, 1]) {
    const lantern = new THREE.Group();
    lantern.name = 'WallLantern';
    lantern.position.set(side * 4.4, 3.2, 0.18);
    mesh(lantern, backplate, frameMaterial, 0, 0, 0.028);
    mesh(lantern, bracket, frameMaterial, 0, 0.22, 0.19);
    mesh(lantern, pane, lanternPane, 0, -0.02, 0.46);
    mesh(lantern, base, frameMaterial, 0, -0.29, 0.46);
    mesh(lantern, roof, frameMaterial, 0, 0.32, 0.46);
    garden.add(lantern);
    for (const x of [-0.185, 0.185]) {
      for (const z of [-0.14, 0.14]) {
        pose.position.set(side * 4.4 + x, 3.18, 0.64 + z);
        pose.rotation.set(0, 0, 0);
        pose.scale.setScalar(1);
        pose.updateMatrix();
        frames.setMatrixAt(frameIndex++, pose.matrix);
      }
    }
  }
  garden.add(frames);

  // Shared low-poly leaves fill the side planting without another asset download.
  const shrubGeometry = new THREE.IcosahedronGeometry(1, 0);
  const shrubMaterial = surface('#ffffff');
  const foliage = ['#527b50', '#638950', '#789b60'].map(
    (color) => new THREE.Color(color),
  );
  for (const side of [-1, 1]) {
    const shrub = new THREE.InstancedMesh(shrubGeometry, shrubMaterial, 240);
    shrub.name = 'EntranceShrub';
    shrub.position.set(side * 5.65, 0, 0.85);
    for (let i = 0; i < shrub.count; i++) {
      const lobe = i % 3;
      const angle = random(i + 7201) * Math.PI * 2;
      const vertical = random(i + 8001) * 2 - 1;
      const horizontal = Math.sqrt(1 - vertical * vertical);
      const radius = 0.75 + random(i + 9001) * 0.25;
      const height = lobe === 1 ? 0.52 : 0.34;
      pose.position.set(
        (lobe - 1) * 0.65 + Math.cos(angle) * horizontal * radius * 0.64,
        height + vertical * radius * (height - 0.08),
        Math.sin(angle) * horizontal * radius * 0.43,
      );
      pose.rotation.set(random(i + 10001), angle, random(i + 11001));
      pose.scale.set(0.18, 0.095, 0.22);
      pose.updateMatrix();
      shrub.setMatrixAt(i, pose.matrix);
      shrub.setColorAt(i, foliage[i % foliage.length]);
    }
    garden.add(shrub);
  }
  return garden;
}
