import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { ROOM_MODELS } from './roomConfig';
import { prepareModel } from './RoomModelUtils';

type MovingCloud = {
  anchor: THREE.Group;
  materials: Array<{ material: THREE.Material; baseOpacity: number }>;
  phase: number;
  speed: number;
};

const CLOUD_TRAVEL_LEFT_Z = 3.8;
const CLOUD_TRAVEL_RIGHT_Z = -3.8;

function makeSunGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture();

  const glow = context.createRadialGradient(64, 64, 18, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 244, 178, 0.72)');
  glow.addColorStop(0.32, 'rgba(255, 218, 112, 0.32)');
  glow.addColorStop(0.68, 'rgba(255, 196, 72, 0.08)');
  glow.addColorStop(1, 'rgba(255, 190, 62, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeDaySkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Texture();

  const skyGradient = context.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, '#77c8ed');
  skyGradient.addColorStop(0.55, '#a9def4');
  skyGradient.addColorStop(1, '#e1f4fb');
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, 64, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addMovingClouds(root: THREE.Group) {
  const loader = new GLTFLoader();
  const movingClouds: MovingCloud[] = [];
  let disposed = false;

  [
    {
      path: ROOM_MODELS.cloud1,
      targetWidth: 1.55,
      position: [-2.15, 2.8, 0] as [number, number, number],
      cycleDuration: 44,
      phase: 0.05,
    },
    {
      path: ROOM_MODELS.cloud2,
      targetWidth: 1.9,
      position: [-3.15, 1.25, 0] as [number, number, number],
      cycleDuration: 58,
      phase: 0.36,
    },
    {
      path: ROOM_MODELS.cloud3,
      targetWidth: 1.3,
      position: [-4.05, 3.45, 0] as [number, number, number],
      cycleDuration: 68,
      phase: 0.68,
    },
    {
      path: ROOM_MODELS.cloud2,
      targetWidth: 1.35,
      position: [-2.65, 3.7, 0] as [number, number, number],
      cycleDuration: 76,
      phase: 0.22,
    },
    {
      path: ROOM_MODELS.cloud3,
      targetWidth: 1.65,
      position: [-3.55, 2.05, 0] as [number, number, number],
      cycleDuration: 63,
      phase: 0.53,
    },
    {
      path: ROOM_MODELS.cloud1,
      targetWidth: 1.15,
      position: [-4.35, 0.65, 0] as [number, number, number],
      cycleDuration: 82,
      phase: 0.84,
    },
  ].forEach(({ path, targetWidth, position, cycleDuration, phase }) => {
    const anchor = new THREE.Group();
    anchor.position.set(...position);
    root.add(anchor);

    const movingCloud: MovingCloud = {
      anchor,
      materials: [],
      phase,
      speed: 1 / cycleDuration,
    };
    movingClouds.push(movingCloud);

    loader.load(path, (gltf) => {
      if (disposed) return;

      prepareModel(gltf.scene, targetWidth);
      // Cloud assets are authored to lie on the X-Z ground plane. Rotate their
      // broad face onto the window's Y-Z plane so they are seen from the front.
      gltf.scene.rotation.z = -Math.PI / 2;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const cloudMaterials = materials.map((material) => {
          const cloudMaterial = material.clone();
          cloudMaterial.transparent = true;
          cloudMaterial.depthWrite = false;
          if (cloudMaterial instanceof THREE.MeshStandardMaterial) {
            cloudMaterial.color.set('#ffffff');
            cloudMaterial.vertexColors = false;
            cloudMaterial.emissive.set('#f8fbff');
            cloudMaterial.emissiveIntensity = 0.48;
            cloudMaterial.alphaTest = Math.max(cloudMaterial.alphaTest, 0.01);
            cloudMaterial.toneMapped = false;
            cloudMaterial.metalness = 0;
            cloudMaterial.roughness = 1;
          }
          movingCloud.materials.push({
            material: cloudMaterial,
            baseOpacity: cloudMaterial.opacity,
          });
          return cloudMaterial;
        });
        child.material = Array.isArray(child.material)
          ? cloudMaterials
          : cloudMaterials[0];
        child.castShadow = false;
      });
      anchor.add(gltf.scene);
    });
  });

  return {
    update(elapsedTime: number) {
      movingClouds.forEach(({ anchor, materials, phase, speed }) => {
        const progress = (elapsedTime * speed + phase) % 1;
        anchor.position.z = THREE.MathUtils.lerp(
          CLOUD_TRAVEL_LEFT_Z,
          CLOUD_TRAVEL_RIGHT_Z,
          progress,
        );
        const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.12);
        const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.8, 1);
        const opacity = fadeIn * fadeOut;
        materials.forEach(({ material, baseOpacity }) => {
          material.opacity = baseOpacity * opacity;
        });
      });
    },
    dispose() {
      disposed = true;
    },
  };
}

function makeSun(
  position: [number, number, number],
  glowTexture: THREE.Texture,
) {
  const sun = new THREE.Group();
  sun.position.set(...position);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 20),
    new THREE.MeshBasicMaterial({
      color: '#fffdf2',
      toneMapped: false,
    }),
  );
  core.castShadow = false;
  sun.add(core);

  const innerGlowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: '#fff0a0',
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const innerGlow = new THREE.Sprite(innerGlowMaterial);
  innerGlow.scale.set(1.18, 1.18, 1);
  innerGlow.position.x = -0.04;
  sun.add(innerGlow);

  const outerGlowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: '#ffd66f',
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const outerGlow = new THREE.Sprite(outerGlowMaterial);
  outerGlow.scale.set(2.15, 2.15, 1);
  outerGlow.position.x = -0.08;
  sun.add(outerGlow);

  const sunlight = new THREE.PointLight('#ffe0a3', 0.75, 7, 2);
  sunlight.position.x = 0.25;
  sun.add(sunlight);

  return {
    root: sun,
    glowMaterials: [innerGlowMaterial, outerGlowMaterial],
  };
}

export default function createDayWindowView(width: number, height: number) {
  const root = new THREE.Group();
  const sunGlowTexture = makeSunGlowTexture();
  const skyTexture = makeDaySkyTexture();
  const clouds = addMovingClouds(root);
  const sun = makeSun(
    [-3.5, height - 0.85, -0.92],
    sunGlowTexture,
  );

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 6, height * 4),
    new THREE.MeshBasicMaterial({
      map: skyTexture,
      color: '#ffffff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sky.rotation.y = Math.PI / 2;
  sky.position.set(-6, height / 2, 0);
  root.add(sky);

  root.add(sun.root);

  const daylight = new THREE.RectAreaLight('#e9fbff', 1.4, width, height);
  daylight.rotation.y = -Math.PI / 2;
  daylight.position.set(0.4, height / 2, 0);
  root.add(daylight);

  return {
    root,
    update(elapsedTime: number) {
      clouds.update(elapsedTime);
    },
    dispose() {
      clouds.dispose();
      sun.glowMaterials.forEach((material) => material.dispose());
      sunGlowTexture.dispose();
      skyTexture.dispose();
    },
  };
}
