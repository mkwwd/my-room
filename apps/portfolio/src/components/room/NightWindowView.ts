import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { ROOM_COLORS, ROOM_MODELS } from './roomConfig';

const MOON_DIAMETER = 0.8;

const BIG_DIPPER_STARS: Array<[number, number]> = [
  [-0.25, 0.2],
  [0.24, 0.5],
  [0.65, 0.4],
  [0.9, 0.4],
  [1.2, -0.2],
  [-0.8, 0.7],
  [-0.75, 0.35],
];

const POLARIS_STAR: [number, number] = [-0.75, 2.5];

const SCATTERED_STARS: Array<[number, number]> = [
  [0.55, 3.66],
  [-0.8, 4.1],
  [-1.38, 4.4],
  [-1.92, 3.5],
  [-1.39, 3.85],
  [-1.85, 4],
  [-0.7, 2.8],

  [1.6, 2.5],
  [1.45, 4],
  [0.82, 2.62],
  [-1.45, 1.72],
  [-1.6, 1],

  [-1.38, -0.3],
  [0.86, 1.3],
  [1.7, 1.1],
  [1.5, 0.4],
];

function makeStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture();

  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.18, 'rgba(225, 237, 255, 0.9)');
  glow.addColorStop(0.5, 'rgba(166, 198, 255, 0.28)');
  glow.addColorStop(1, 'rgba(120, 165, 255, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStarGlow(
  texture: THREE.Texture,
  size: number,
  position: [number, number, number],
) {
  const star = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: '#d7e5ff',
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  star.position.set(...position);
  star.scale.set(size, size, 1);
  return star;
}

function makeMoon(
  position: [number, number, number],
  glowTexture: THREE.Texture,
) {
  const moon = new THREE.Group();
  moon.position.set(...position);

  new GLTFLoader().load(ROOM_MODELS.moon, (gltf) => {
    const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const scale =
      MOON_DIAMETER / Math.max(sourceSize.x, sourceSize.y, sourceSize.z, 0.001);
    gltf.scene.scale.setScalar(scale);
    gltf.scene.updateMatrixWorld(true);

    const scaledBounds = new THREE.Box3().setFromObject(gltf.scene);
    const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(scaledCenter);

    gltf.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const glowingMaterials = materials.map((material) => {
        const glowingMaterial = material.clone();
        if (glowingMaterial instanceof THREE.MeshStandardMaterial) {
          glowingMaterial.color.set('#ffffff');
          glowingMaterial.emissive.set('#64759c');
          glowingMaterial.emissiveIntensity = 0.68;
          glowingMaterial.roughness = 0.9;
        }
        return glowingMaterial;
      });
      child.material = Array.isArray(child.material)
        ? glowingMaterials
        : glowingMaterials[0];
      child.castShadow = false;
    });

    moon.add(gltf.scene);
  });

  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: '#9eb8ed',
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.set(1.42, 1.42, 1);
  glow.position.x = -0.04;
  moon.add(glow);

  return { root: moon, glowMaterial };
}

export default function createNightWindowView(width: number, height: number) {
  const root = new THREE.Group();
  const starTexture = makeStarTexture();
  const moon = makeMoon([-3.5, height - 0.55, 1.12], starTexture);
  const twinklingStars: Array<{
    sprite: THREE.Sprite;
    baseSize: number;
    minOpacity: number;
    opacityRange: number;
    phase: number;
    speed: number;
  }> = [];

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 6, height * 4),
    new THREE.MeshBasicMaterial({
      color: ROOM_COLORS.nightSky,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  sky.rotation.y = Math.PI / 2;
  sky.position.set(-6, height / 2, 0);
  root.add(sky);

  root.add(moon.root);

  [...BIG_DIPPER_STARS, ...SCATTERED_STARS, POLARIS_STAR].forEach(
    ([z, y], index) => {
      const isBigDipper = index < BIG_DIPPER_STARS.length;
      const isPolaris =
        index === BIG_DIPPER_STARS.length + SCATTERED_STARS.length;
      const baseSize = isPolaris
        ? 0.18
        : isBigDipper
          ? 0.12
          : index % 3 === 0
            ? 0.12
            : 0.08;
      const star = makeStarGlow(starTexture, baseSize, [
        -2.5 - (index % 3) * 0.55,
        y,
        z,
      ]);
      if (isPolaris) star.material.color.set('#ffffff');
      twinklingStars.push({
        sprite: star,
        baseSize,
        minOpacity: isPolaris ? 0.72 : 0.18,
        opacityRange: isPolaris ? 0.28 : 0.68,
        phase: index * 1.73,
        speed: isPolaris ? 0.78 : 1.15 + (index % 4) * 0.37,
      });
      root.add(star);
    },
  );

  const moonlight = new THREE.RectAreaLight('#8297c2', 0.24, width, height);
  moonlight.rotation.y = -Math.PI / 2;
  moonlight.position.set(0.4, height / 2, 0);
  root.add(moonlight);

  return {
    root,
    update(elapsedTime: number) {
      twinklingStars.forEach(
        ({ sprite, baseSize, minOpacity, opacityRange, phase, speed }) => {
          const wave = Math.sin(elapsedTime * speed + phase) * 0.5 + 0.5;
          sprite.material.opacity = minOpacity + wave * opacityRange;
          const size = baseSize * (0.9 + wave * 0.14);
          sprite.scale.set(size, size, 1);
        },
      );
    },
    dispose() {
      twinklingStars.forEach(({ sprite }) => sprite.material.dispose());
      moon.glowMaterial.dispose();
      starTexture.dispose();
    },
  };
}
