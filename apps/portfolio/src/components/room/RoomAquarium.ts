import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MODEL_TARGET_WIDTH, ROOM, ROOM_MODELS } from './roomConfig';
import { prepareModel } from './RoomModelUtils';

const AQUARIUM = {
  z: 1.75,
  width: 2.9,
  depth: 1.1,
  height: 1.64,
  standHeight: 2.1,
  cabinetWidth: 4.2,
  cabinetDepth: 1.34,
  tankOffsetZ: -0.62,
  wallInset: 0.08,
} as const;

const AQUARIUM_WATER = {
  heightScale: 0.9,
  centerY: AQUARIUM.standHeight + AQUARIUM.height * 0.49,
} as const;

const AQUARIUM_BOTTOM_DECOR = {
  targetWidth: AQUARIUM.width * 0.84,
  y: AQUARIUM.standHeight - 0.475,
  xOffset: 0.12,
  zOffset: -0.08,
  rotationY: 0,
} as const;

const AQUARIUM_SAND = {
  widthScale: 0.9,
  depthScale: 0.86,
  thickness: 0.18,
  y: AQUARIUM.standHeight + 0.16,
  color: '#fff0cf',
} as const;

const AQUARIUM_CLIP_PADDING = 0.018;

const AQUARIUM_CLOWNFISH = {
  xAmplitude: AQUARIUM.depth * 0.26,
  zAmplitude: AQUARIUM.width * 0.32,
  y: AQUARIUM.standHeight + AQUARIUM.height * 0.44,
  bobAmplitude: 0.12,
  xSpeed: 0.82,
  zSpeed: 0.58,
  bobSpeed: 1.55,
  phase: 0.7,
  rotationOffsetY: -Math.PI / 2,
} as const;

const AQUARIUM_TULIP = {
  x: -0.3,
  y: AQUARIUM.standHeight + 0.08,
  zOffset: AQUARIUM.width / 2 + 0.1,
  rotationY: Math.PI / 8,
} as const;

type AquariumLighting = {
  light: THREE.PointLight;
  glowMaterial: THREE.MeshBasicMaterial;
  waterMaterial: THREE.MeshPhysicalMaterial;
};

type AquariumFish = {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  previousPosition: THREE.Vector3;
  tankOffsetZ: number;
};

function fitModelToBox(object: THREE.Object3D, targetSize: THREE.Vector3) {
  object.updateMatrixWorld(true);

  const sourceBounds = new THREE.Box3().setFromObject(object);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());

  object.scale.set(
    targetSize.x / Math.max(sourceSize.x, 0.001),
    targetSize.y / Math.max(sourceSize.y, 0.001),
    targetSize.z / Math.max(sourceSize.z, 0.001),
  );
  object.updateMatrixWorld(true);

  const fittedBounds = new THREE.Box3().setFromObject(object);
  const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
  object.position.sub(
    new THREE.Vector3(fittedCenter.x, fittedBounds.min.y, fittedCenter.z),
  );
}

function removeImportedFloorPlane(object: THREE.Object3D) {
  const floorMeshes: THREE.Object3D[] = [];

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materialNames = (
      Array.isArray(child.material) ? child.material : [child.material]
    ).map((material) => material.name.toLowerCase());
    const isFloorPlane =
      child.name.toLowerCase().includes('floor') ||
      child.name.toLowerCase().includes('plane') ||
      materialNames.some((name) => name.includes('floor'));

    if (isFloorPlane) {
      floorMeshes.push(child);
    }
  });

  floorMeshes.forEach((mesh) => mesh.parent?.remove(mesh));
}

function makeAquariumGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;

  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    8,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2,
  );
  gradient.addColorStop(0, 'rgba(126, 255, 235, 0.62)');
  gradient.addColorStop(0.42, 'rgba(70, 205, 255, 0.28)');
  gradient.addColorStop(1, 'rgba(25, 120, 255, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeAquariumSandTexture() {
  const texture = new THREE.TextureLoader().load('/images/pattern/sand1.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.2, 2.2);
  texture.anisotropy = 8;
  return texture;
}

function makeAquariumClippingPlanes({
  centerX,
  centerZ,
}: {
  centerX: number;
  centerZ: number;
}) {
  const halfDepth = AQUARIUM.depth / 2 - AQUARIUM_CLIP_PADDING;
  const halfWidth = AQUARIUM.width / 2 - AQUARIUM_CLIP_PADDING;
  const minX = centerX - halfDepth;
  const maxX = centerX + halfDepth;
  const minZ = centerZ - halfWidth;
  const maxZ = centerZ + halfWidth;

  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -minX),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), maxX),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -minZ),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), maxZ),
  ];
}

export default class RoomAquarium {
  private readonly root = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private readonly aquariumGlowTexture = makeAquariumGlowTexture();
  private readonly aquariumSandTexture = makeAquariumSandTexture();
  private aquariumLighting: AquariumLighting | null = null;
  private aquariumFish: AquariumFish | null = null;
  private isDisposed = false;

  constructor(private readonly parent: THREE.Object3D) {
    parent.add(this.root);
    this.addAquarium();
  }

  update(elapsedTime: number) {
    this.updateAquariumLighting(elapsedTime);
    this.updateAquariumFish(elapsedTime);
  }

  dispose() {
    this.isDisposed = true;
    this.parent.remove(this.root);
    this.aquariumGlowTexture?.dispose();
    this.aquariumSandTexture?.dispose();
  }

  private addAquarium() {
    const aquariumGroup = new THREE.Group();
    const rightWallX = ROOM.width / 2 - AQUARIUM.wallInset;
    const aquariumCenterX = rightWallX - AQUARIUM.cabinetDepth / 2;
    const tankCenterY = AQUARIUM.standHeight + AQUARIUM.height / 2 + 0.04;
    const tankOffsetZ = AQUARIUM.tankOffsetZ;
    const aquariumClippingPlanes = makeAquariumClippingPlanes({
      centerX: aquariumCenterX,
      centerZ: AQUARIUM.z + tankOffsetZ,
    });

    aquariumGroup.position.set(aquariumCenterX, 0, AQUARIUM.z);

    this.loadAquariumCabinet(aquariumGroup);
    this.addAquariumSand(aquariumGroup, tankOffsetZ, aquariumClippingPlanes);
    this.loadAquariumBottomDecor(
      aquariumGroup,
      tankOffsetZ,
      aquariumClippingPlanes,
    );
    this.loadAquariumClownfish(aquariumGroup, tankOffsetZ);
    this.loadAquariumTulip(aquariumGroup, tankOffsetZ);

    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: '#65dff4',
      emissive: '#0d7185',
      emissiveIntensity: 0.24,
      transparent: true,
      opacity: 0.34,
      roughness: 0.12,
      metalness: 0,
      transmission: 0.35,
      thickness: 0.08,
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(
      new THREE.BoxGeometry(
        AQUARIUM.depth * 0.96,
        AQUARIUM.height * AQUARIUM_WATER.heightScale,
        AQUARIUM.width * 0.96,
      ),
      waterMaterial,
    );
    water.position.set(0, AQUARIUM_WATER.centerY, tankOffsetZ);
    aquariumGroup.add(water);

    const glassGeometry = new THREE.BoxGeometry(
      AQUARIUM.depth,
      AQUARIUM.height,
      AQUARIUM.width,
    );
    const glass = new THREE.Mesh(
      glassGeometry,
      new THREE.MeshPhysicalMaterial({
        color: '#d9fbff',
        transparent: true,
        opacity: 0.16,
        roughness: 0.04,
        metalness: 0,
        transmission: 0.45,
        thickness: 0.05,
        side: THREE.DoubleSide,
      }),
    );
    glass.position.set(0, tankCenterY, tankOffsetZ);
    glass.castShadow = true;
    aquariumGroup.add(glass);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(glassGeometry),
      new THREE.LineBasicMaterial({
        color: '#d7fbff',
        transparent: true,
        opacity: 0.72,
        toneMapped: false,
      }),
    );
    edges.position.copy(glass.position);
    aquariumGroup.add(edges);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: '#6eefff',
      map: this.aquariumGlowTexture ?? undefined,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(AQUARIUM.width * 1.52, AQUARIUM.height * 1.95),
      glowMaterial,
    );
    glow.position.set(
      ROOM.width / 2 - 0.014,
      tankCenterY,
      AQUARIUM.z + tankOffsetZ,
    );
    glow.rotation.y = Math.PI / 2;
    this.root.add(glow);

    const light = new THREE.PointLight('#75f2ff', 0.72, 3.2, 1.75);
    light.position.set(
      aquariumCenterX - 0.28,
      tankCenterY + 0.08,
      AQUARIUM.z + tankOffsetZ,
    );
    this.root.add(light);

    this.aquariumLighting = { light, glowMaterial, waterMaterial };
    this.root.add(aquariumGroup);
  }

  private addAquariumSand(
    aquariumGroup: THREE.Group,
    tankOffsetZ: number,
    clippingPlanes: THREE.Plane[],
  ) {
    const sand = new THREE.Mesh(
      new THREE.BoxGeometry(
        AQUARIUM.depth * AQUARIUM_SAND.depthScale,
        AQUARIUM_SAND.thickness,
        AQUARIUM.width * AQUARIUM_SAND.widthScale,
      ),
      new THREE.MeshStandardMaterial({
        color: AQUARIUM_SAND.color,
        map: this.aquariumSandTexture ?? undefined,
        emissive: '#4f351c',
        emissiveIntensity: 0.035,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        clippingPlanes,
      }),
    );
    sand.position.set(0, AQUARIUM_SAND.y, tankOffsetZ);
    sand.castShadow = false;
    sand.receiveShadow = true;
    aquariumGroup.add(sand);
  }

  private loadAquariumCabinet(aquariumGroup: THREE.Group) {
    this.loader.load(ROOM_MODELS.cabinet, (gltf) => {
      if (this.isDisposed) return;

      removeImportedFloorPlane(gltf.scene);

      const cabinet = new THREE.Group();
      const orientedCabinet = new THREE.Group();
      orientedCabinet.rotation.y = Math.PI;
      orientedCabinet.add(gltf.scene);
      cabinet.add(orientedCabinet);
      fitModelToBox(
        cabinet,
        new THREE.Vector3(
          AQUARIUM.cabinetDepth,
          AQUARIUM.standHeight,
          AQUARIUM.cabinetWidth,
        ),
      );

      cabinet.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const softenedMaterials = materials.map((material) => {
          const cabinetMaterial = material.clone();
          if (cabinetMaterial instanceof THREE.MeshStandardMaterial) {
            cabinetMaterial.roughness = Math.max(
              cabinetMaterial.roughness,
              0.78,
            );
            cabinetMaterial.metalness = Math.min(
              cabinetMaterial.metalness,
              0.08,
            );
          }
          return cabinetMaterial;
        });
        child.material = Array.isArray(child.material)
          ? softenedMaterials
          : softenedMaterials[0];
      });

      aquariumGroup.add(cabinet);
    });
  }

  private loadAquariumBottomDecor(
    aquariumGroup: THREE.Group,
    tankOffsetZ: number,
    clippingPlanes: THREE.Plane[],
  ) {
    this.loader.load(ROOM_MODELS.bikini2, (gltf) => {
      if (this.isDisposed) return;

      const decor = new THREE.Group();
      const model = gltf.scene;
      model.rotation.y = AQUARIUM_BOTTOM_DECOR.rotationY;
      prepareModel(model, AQUARIUM_BOTTOM_DECOR.targetWidth);
      decor.add(model);
      decor.position.set(
        AQUARIUM_BOTTOM_DECOR.xOffset,
        AQUARIUM_BOTTOM_DECOR.y,
        tankOffsetZ + AQUARIUM_BOTTOM_DECOR.zOffset,
      );
      decor.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        child.castShadow = false;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const aquariumMaterials = materials.map((material) => {
          const decorMaterial = material.clone();
          if (decorMaterial instanceof THREE.MeshStandardMaterial) {
            decorMaterial.roughness = Math.max(decorMaterial.roughness, 0.68);
            decorMaterial.metalness = Math.min(decorMaterial.metalness, 0.04);
          }
          return decorMaterial;
        });
        aquariumMaterials.forEach((material) => {
          material.clippingPlanes = clippingPlanes;
          material.clipShadows = true;
          material.needsUpdate = true;
        });
        child.material = Array.isArray(child.material)
          ? aquariumMaterials
          : aquariumMaterials[0];
      });

      aquariumGroup.add(decor);
    });
  }

  private loadAquariumClownfish(
    aquariumGroup: THREE.Group,
    tankOffsetZ: number,
  ) {
    this.loader.load(ROOM_MODELS.clownfish, (gltf) => {
      if (this.isDisposed) return;

      const fishGroup = new THREE.Group();
      const model = gltf.scene;
      prepareModel(model, MODEL_TARGET_WIDTH.clownfish);
      fishGroup.add(model);
      fishGroup.position.set(
        AQUARIUM_CLOWNFISH.xAmplitude * Math.sin(AQUARIUM_CLOWNFISH.phase),
        AQUARIUM_CLOWNFISH.y,
        tankOffsetZ +
          AQUARIUM_CLOWNFISH.zAmplitude * Math.cos(AQUARIUM_CLOWNFISH.phase),
      );

      fishGroup.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        child.castShadow = false;
        child.receiveShadow = false;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const fishMaterials = materials.map((material) => {
          const fishMaterial = material.clone();
          if (fishMaterial instanceof THREE.MeshStandardMaterial) {
            fishMaterial.roughness = Math.max(fishMaterial.roughness, 0.48);
            fishMaterial.metalness = Math.min(fishMaterial.metalness, 0.02);
            fishMaterial.emissiveIntensity = Math.max(
              fishMaterial.emissiveIntensity,
              0.015,
            );
          }
          return fishMaterial;
        });
        child.material = Array.isArray(child.material)
          ? fishMaterials
          : fishMaterials[0];
      });

      const mixer =
        gltf.animations.length > 0 ? new THREE.AnimationMixer(model) : null;
      gltf.animations.forEach((clip) => {
        mixer?.clipAction(clip).play();
      });

      aquariumGroup.add(fishGroup);
      this.aquariumFish = {
        group: fishGroup,
        mixer,
        previousPosition: fishGroup.position.clone(),
        tankOffsetZ,
      };
    });
  }

  private loadAquariumTulip(aquariumGroup: THREE.Group, tankOffsetZ: number) {
    this.loader.load(ROOM_MODELS.tulip, (gltf) => {
      if (this.isDisposed) return;

      const tulip = gltf.scene;
      tulip.rotation.y = AQUARIUM_TULIP.rotationY;
      prepareModel(tulip, MODEL_TARGET_WIDTH.tulip);
      tulip.position.set(
        AQUARIUM_TULIP.x,
        AQUARIUM_TULIP.y,
        tankOffsetZ + AQUARIUM_TULIP.zOffset,
      );
      tulip.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const tulipMaterials = materials.map((material) => {
          const tulipMaterial = material.clone();
          if (tulipMaterial instanceof THREE.MeshStandardMaterial) {
            tulipMaterial.roughness = Math.max(tulipMaterial.roughness, 0.62);
            tulipMaterial.metalness = Math.min(tulipMaterial.metalness, 0.03);
          }
          return tulipMaterial;
        });
        child.material = Array.isArray(child.material)
          ? tulipMaterials
          : tulipMaterials[0];
      });

      aquariumGroup.add(tulip);
    });
  }

  private updateAquariumLighting(elapsedTime: number) {
    if (!this.aquariumLighting) return;

    const shimmer = 0.9 + Math.sin(elapsedTime * 1.8) * 0.1;
    this.aquariumLighting.light.intensity = 0.72 * shimmer;
    this.aquariumLighting.glowMaterial.opacity = 0.2 + shimmer * 0.045;
    this.aquariumLighting.waterMaterial.opacity = 0.3 + shimmer * 0.035;
  }

  private updateAquariumFish(elapsedTime: number) {
    if (!this.aquariumFish) return;

    const t = elapsedTime + AQUARIUM_CLOWNFISH.phase;
    const nextPosition = new THREE.Vector3(
      AQUARIUM_CLOWNFISH.xAmplitude * Math.sin(t * AQUARIUM_CLOWNFISH.xSpeed),
      AQUARIUM_CLOWNFISH.y +
        AQUARIUM_CLOWNFISH.bobAmplitude *
          Math.sin(t * AQUARIUM_CLOWNFISH.bobSpeed),
      this.aquariumFish.tankOffsetZ +
        AQUARIUM_CLOWNFISH.zAmplitude * Math.cos(t * AQUARIUM_CLOWNFISH.zSpeed),
    );
    const delta = nextPosition.clone().sub(this.aquariumFish.previousPosition);

    this.aquariumFish.group.position.copy(nextPosition);
    if (delta.lengthSq() > 0.000001) {
      this.aquariumFish.group.rotation.y =
        Math.atan2(delta.x, delta.z) + AQUARIUM_CLOWNFISH.rotationOffsetY;
    }
    this.aquariumFish.group.rotation.z = Math.sin(t * 1.85) * 0.06;
    this.aquariumFish.mixer?.setTime(elapsedTime);
    this.aquariumFish.previousPosition.copy(nextPosition);
  }
}
