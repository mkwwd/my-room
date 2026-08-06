import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { MODEL_TARGET_WIDTH, ROOM, ROOM_MODELS } from './roomConfig';
import { prepareModel } from './RoomModelUtils';

const AQUARIUM = {
  z: 1.75,
  wallInset: 0.08,
  depth: 1.34,
  standHeight: 2.1,
  cabinetWidth: 4.2,
  cabinetDepth: 1.34,
  tankOffsetZ: -0.62,
  tankWidth: 5.25,
  tankDepth: 1.95,
  tankHeight: 2.95,
  tankX: -0.02,
  tankY: 2.72,
  tankZ: -0.28,
  glowWidth: 4.4,
  glowHeight: 3.2,
  glowY: 2.85,
  glowZOffset: -0.62,
} as const;

const AQUARIUM_TULIP = {
  x: -0.08,
  y: AQUARIUM.standHeight + 0.08,
  zOffset: 1.42,
  rotationY: Math.PI / 8,
} as const;

type AquariumLighting = {
  light: THREE.PointLight;
  glowMaterial: THREE.MeshBasicMaterial;
};

function fitModelToBox(object: THREE.Object3D, targetSize: THREE.Vector3) {
  object.updateMatrixWorld(true);

  const sourceBounds = new THREE.Box3().setFromObject(object);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const scale = Math.min(
    targetSize.x / Math.max(sourceSize.x, 0.001),
    targetSize.y / Math.max(sourceSize.y, 0.001),
    targetSize.z / Math.max(sourceSize.z, 0.001),
  );
  object.scale.multiplyScalar(scale);
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
  gradient.addColorStop(0, 'rgba(126, 255, 235, 0.5)');
  gradient.addColorStop(0.42, 'rgba(70, 205, 255, 0.22)');
  gradient.addColorStop(1, 'rgba(25, 120, 255, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default class RoomAquarium {
  private readonly root = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private readonly aquariumGlowTexture = makeAquariumGlowTexture();
  private aquariumLighting: AquariumLighting | null = null;
  private isDisposed = false;

  constructor(private readonly parent: THREE.Object3D) {
    parent.add(this.root);
    this.addAquarium();
  }

  update(elapsedTime: number) {
    this.updateAquariumLighting(elapsedTime);
  }

  dispose() {
    this.isDisposed = true;
    this.parent.remove(this.root);
    this.aquariumGlowTexture?.dispose();
  }

  private addAquarium() {
    const rightWallX = ROOM.width / 2 - AQUARIUM.wallInset;
    const aquariumCenterX = rightWallX - AQUARIUM.depth / 2;
    const aquariumCenterZ = AQUARIUM.z + AQUARIUM.glowZOffset;

    this.root.position.set(aquariumCenterX, 0, AQUARIUM.z);
    this.loadAquariumCabinet();
    this.loadAquariumModel();
    this.loadAquariumTulip();

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: '#6eefff',
      map: this.aquariumGlowTexture ?? undefined,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(AQUARIUM.glowWidth, AQUARIUM.glowHeight),
      glowMaterial,
    );
    glow.position.set(
      ROOM.width / 2 - aquariumCenterX - 0.014,
      AQUARIUM.glowY,
      AQUARIUM.glowZOffset,
    );
    glow.rotation.y = Math.PI / 2;
    this.root.add(glow);

    const light = new THREE.PointLight('#75f2ff', 0.62, 3.4, 1.75);
    light.position.set(-0.28, AQUARIUM.glowY, aquariumCenterZ - AQUARIUM.z);
    this.root.add(light);

    this.aquariumLighting = { light, glowMaterial };
  }

  private loadAquariumModel() {
    this.loader.load(ROOM_MODELS.bikini1, (gltf) => {
      if (this.isDisposed) return;

      const model = gltf.scene;
      model.rotation.y = -Math.PI / 2;
      fitModelToBox(
        model,
        new THREE.Vector3(
          AQUARIUM.tankWidth,
          AQUARIUM.tankHeight,
          AQUARIUM.tankDepth,
        ),
      );
      model.position.set(AQUARIUM.tankX, AQUARIUM.tankY, AQUARIUM.tankZ);
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        child.castShadow = false;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const aquariumMaterials = materials.map((material) => {
          const aquariumMaterial = material.clone();
          if (aquariumMaterial instanceof THREE.MeshStandardMaterial) {
            aquariumMaterial.roughness = Math.max(
              aquariumMaterial.roughness,
              0.68,
            );
            aquariumMaterial.metalness = Math.min(
              aquariumMaterial.metalness,
              0.04,
            );
          }
          return aquariumMaterial;
        });
        child.material = Array.isArray(child.material)
          ? aquariumMaterials
          : aquariumMaterials[0];
      });

      this.root.add(model);
    });
  }

  private loadAquariumCabinet() {
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

        child.castShadow = false;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const cabinetMaterials = materials.map((material) => {
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
          ? cabinetMaterials
          : cabinetMaterials[0];
      });

      this.root.add(cabinet);
    });
  }

  private loadAquariumTulip() {
    this.loader.load(ROOM_MODELS.tulip, (gltf) => {
      if (this.isDisposed) return;

      const tulip = gltf.scene;
      tulip.rotation.y = AQUARIUM_TULIP.rotationY;
      prepareModel(tulip, MODEL_TARGET_WIDTH.tulip);
      tulip.position.set(
        AQUARIUM_TULIP.x,
        AQUARIUM_TULIP.y,
        AQUARIUM.tankOffsetZ + AQUARIUM_TULIP.zOffset,
      );
      tulip.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        child.castShadow = false;
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

      this.root.add(tulip);
    });
  }

  private updateAquariumLighting(elapsedTime: number) {
    if (!this.aquariumLighting) return;

    const shimmer = 0.9 + Math.sin(elapsedTime * 1.8) * 0.1;
    this.aquariumLighting.light.intensity = 0.62 * shimmer;
    this.aquariumLighting.glowMaterial.opacity = 0.16 + shimmer * 0.035;
  }
}
