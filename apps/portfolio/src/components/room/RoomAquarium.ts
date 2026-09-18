import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import AquariumFishMotion from './AquariumFishMotion';
import { MODEL_TARGET_WIDTH, ROOM, ROOM_MODELS } from './roomConfig';
import { createHoverFrame } from './RoomHoverEffect';
import { prepareModel } from './RoomModelUtils';

const AQUARIUM = {
  z: 1.75,
  wallInset: 0.08,
  depth: 1.34,
  standHeight: 2.1,
  cabinetWidth: 4.2,
  cabinetDepth: 1.34,
  tankHeight: 2.95,
  tabletopMargin: 0.12,
  flowerSpace: 0.9,
  glowWidth: 4.4,
  glowHeight: 3.2,
  glowY: 2.85,
  glowZOffset: -0.62,
} as const;

const AQUARIUM_TULIP = {
  rotationY: Math.PI / 8,
} as const;

type AquariumLighting = {
  light: THREE.PointLight;
  glowMaterial: THREE.MeshBasicMaterial;
};

function prepareAquariumMaterials(
  object: THREE.Object3D,
  {
    minRoughness,
    maxMetalness,
  }: { minRoughness: number; maxMetalness: number },
) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.castShadow = false;
    child.receiveShadow = true;

    const cloneMaterial = (material: THREE.Material) => {
      const clone = material.clone();
      if (clone instanceof THREE.MeshStandardMaterial) {
        clone.roughness = Math.max(clone.roughness, minRoughness);
        clone.metalness = Math.min(clone.metalness, maxMetalness);
      }
      return clone;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(cloneMaterial)
      : cloneMaterial(child.material);
  });
}

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
  readonly focusPosition = new THREE.Vector3();
  readonly focusTarget = new THREE.Vector3();
  readonly hintAnchor = new THREE.Vector3();

  private readonly root = new THREE.Group();
  private readonly tankBounds = new THREE.Box3();
  private readonly worldTankBounds = new THREE.Box3();
  private highlight: ReturnType<typeof createHoverFrame> | null = null;
  private aspect = 16 / 9;
  private readonly loader: GLTFLoader;
  private readonly aquariumGlowTexture = makeAquariumGlowTexture();
  private aquariumLighting: AquariumLighting | null = null;
  private readonly waterTime = { value: 0 };
  private readonly swimCenter = new THREE.Vector3();
  private readonly swimRadius = new THREE.Vector3();
  private readonly fish: {
    root: THREE.Group;
    model: THREE.Object3D;
    tail?: THREE.Object3D;
    motion: AquariumFishMotion;
  }[] = [];
  private isDisposed = false;

  constructor(
    private readonly parent: THREE.Object3D,
    manager: THREE.LoadingManager,
  ) {
    this.loader = new GLTFLoader(manager);
    parent.add(this.root);
    this.addAquarium();
  }

  isPointerOver(raycaster: THREE.Raycaster) {
    return (
      !this.isDisposed &&
      !this.worldTankBounds.isEmpty() &&
      raycaster.ray.intersectsBox(this.worldTankBounds)
    );
  }

  resize(aspect: number) {
    this.aspect = Math.max(aspect, 0.1);
    if (this.tankBounds.isEmpty() || this.isDisposed) return;
    this.root.updateWorldMatrix(true, false);
    this.worldTankBounds
      .copy(this.tankBounds)
      .applyMatrix4(this.root.matrixWorld);
    const size = this.worldTankBounds.getSize(new THREE.Vector3());
    this.worldTankBounds.getCenter(this.focusTarget);
    this.hintAnchor.copy(this.focusTarget);
    this.hintAnchor.x = this.worldTankBounds.min.x - 0.02;
    const halfFov = THREE.MathUtils.degToRad(30 / 2);
    const distance =
      (Math.max(size.z / this.aspect, size.y * 1.25) /
        (2 * Math.tan(halfFov))) *
        1.2 +
      size.x / 2;
    this.focusPosition
      .copy(this.focusTarget)
      .add(new THREE.Vector3(-distance, distance * 0.14, 0));
  }

  updateHover(active: boolean, delta: number) {
    if (!this.highlight) return;
    this.highlight.material.opacity = THREE.MathUtils.damp(
      this.highlight.material.opacity,
      active ? 0.95 : 0,
      14,
      delta,
    );
    this.highlight.visible = this.highlight.material.opacity > 0.001;
  }

  update(elapsedTime: number) {
    if (this.isDisposed) return;
    this.updateAquariumLighting(elapsedTime);
    this.waterTime.value = elapsedTime;
    this.fish.forEach(({ root, model, tail, motion }) =>
      motion.update(elapsedTime, root, model, tail),
    );
  }

  dispose() {
    this.isDisposed = true;
    this.fish.length = 0;
    this.worldTankBounds.makeEmpty();
    this.highlight?.geometry.dispose();
    this.highlight?.material.dispose();
    this.highlight = null;
    this.parent.remove(this.root);
    this.aquariumGlowTexture?.dispose();
  }

  private addAquarium() {
    const rightWallX = ROOM.width / 2 - AQUARIUM.wallInset;
    const aquariumCenterX = rightWallX - AQUARIUM.depth / 2;
    const aquariumCenterZ = AQUARIUM.z + AQUARIUM.glowZOffset;

    this.root.position.set(aquariumCenterX, 0, AQUARIUM.z);
    this.loadAquariumCabinet();

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: '#6eefff',
      map: this.aquariumGlowTexture,
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

  private loadAquariumModel(cabinetBounds: THREE.Box3) {
    this.loader.load(ROOM_MODELS.bikini1, (gltf) => {
      if (this.isDisposed) return;

      const model = gltf.scene;
      model.rotation.y = -Math.PI / 2;
      const cabinetSize = cabinetBounds.getSize(new THREE.Vector3());
      fitModelToBox(
        model,
        new THREE.Vector3(
          cabinetSize.x - AQUARIUM.tabletopMargin * 2,
          AQUARIUM.tankHeight,
          cabinetSize.z - AQUARIUM.tabletopMargin * 2 - AQUARIUM.flowerSpace,
        ),
      );
      const tankSize = new THREE.Box3()
        .setFromObject(model)
        .getSize(new THREE.Vector3());
      model.position.add(
        new THREE.Vector3(
          (cabinetBounds.min.x + cabinetBounds.max.x) / 2,
          cabinetBounds.max.y + 0.006,
          cabinetBounds.min.z + AQUARIUM.tabletopMargin + tankSize.z / 2,
        ),
      );
      prepareAquariumMaterials(model, {
        minRoughness: 0.68,
        maxMetalness: 0.04,
      });

      // Measure before attaching to the translated root so all contents share local coordinates.
      const tankBounds = new THREE.Box3().setFromObject(model);
      this.tankBounds.copy(tankBounds);
      this.root.add(model);
      this.highlight = createHoverFrame(tankSize.z, tankSize.y);
      this.highlight.name = 'Aquarium hover frame';
      this.highlight.rotation.y = -Math.PI / 2;
      tankBounds.getCenter(this.highlight.position);
      this.highlight.position.x = tankBounds.min.x - 0.012;
      this.root.add(this.highlight);
      this.resize(this.aspect);
      this.addWaterAndFish(tankBounds);
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

      prepareAquariumMaterials(cabinet, {
        minRoughness: 0.78,
        maxMetalness: 0.08,
      });

      const cabinetBounds = new THREE.Box3().setFromObject(cabinet);
      this.root.add(cabinet);
      this.loadAquariumModel(cabinetBounds);
      this.loadAquariumTulip(cabinetBounds);
    });
  }

  private loadAquariumTulip(cabinetBounds: THREE.Box3) {
    this.loader.load(ROOM_MODELS.tulip, (gltf) => {
      if (this.isDisposed) return;

      const tulip = gltf.scene;
      tulip.rotation.y = AQUARIUM_TULIP.rotationY;
      prepareModel(tulip, MODEL_TARGET_WIDTH.tulip);
      const size = new THREE.Box3()
        .setFromObject(tulip)
        .getSize(new THREE.Vector3());
      tulip.position.add(
        new THREE.Vector3(
          (cabinetBounds.min.x + cabinetBounds.max.x) / 2,
          cabinetBounds.max.y + 0.006,
          cabinetBounds.max.z - AQUARIUM.tabletopMargin - size.z / 2,
        ),
      );
      prepareAquariumMaterials(tulip, {
        minRoughness: 0.62,
        maxMetalness: 0.03,
      });

      this.root.add(tulip);
    });
  }

  private addWaterAndFish(tank: THREE.Box3) {
    const tankSize = tank.getSize(new THREE.Vector3());
    const water = tank.clone();
    water.min.add(new THREE.Vector3(0.06, tankSize.y * 0.09, 0.06));
    water.max.sub(new THREE.Vector3(0.06, tankSize.y * 0.12, 0.06));
    const size = water.getSize(new THREE.Vector3());
    const center = water.getCenter(new THREE.Vector3());
    const volume = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({
        color: '#49bcd4',
        transparent: true,
        opacity: 0.065,
        depthWrite: false,
      }),
    );
    volume.name = 'Aquarium water';
    volume.position.copy(center);
    volume.renderOrder = 1;
    this.root.add(volume);

    const surfaceMaterial = new THREE.MeshPhongMaterial({
      color: '#9ee9ed',
      specular: '#ffffff',
      shininess: 90,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    surfaceMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.aquariumTime = this.waterTime;
      shader.vertexShader = `uniform float aquariumTime;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed.z += sin(position.x * 12.0 + aquariumTime * 1.2) * 0.003
          + sin(position.y * 9.0 - aquariumTime * 0.8) * 0.003;
      `,
      );
    };
    surfaceMaterial.customProgramCacheKey = () => 'aquarium-water';
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(size.x, size.z, 12, 24),
      surfaceMaterial,
    );
    surface.name = 'Aquarium water surface';
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(center.x, water.max.y, center.z);
    surface.renderOrder = 2;
    this.root.add(surface);

    this.swimCenter.set(center.x, water.min.y + size.y * 0.69, center.z);
    this.swimRadius.set(
      Math.max(0, size.x / 2 - 0.24),
      Math.max(0, Math.min(size.y * 0.19, size.y * 0.31 - 0.16)),
      Math.max(0, size.z / 2 - 0.27),
    );
    this.loader.load(ROOM_MODELS.clownfish, (gltf) => {
      if (this.isDisposed) return;
      this.addFish(gltf.scene.clone(true), 'Clownfish 1', 0.18, 0);
      this.addFish(gltf.scene.clone(true), 'Clownfish 2', 0.162, 1);
      this.update(this.waterTime.value);
    });
    this.loader.load(ROOM_MODELS.blueTang, (gltf) => {
      if (this.isDisposed) return;
      this.addFish(gltf.scene, 'Blue tang', 0.38, 2);
      this.update(this.waterTime.value);
    });
  }

  private addFish(
    model: THREE.Object3D,
    name: string,
    size: number,
    index: number,
  ) {
    prepareModel(model, size);
    const center = new THREE.Box3()
      .setFromObject(model)
      .getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    const root = new THREE.Group();
    root.name = name;
    root.add(model);
    this.root.add(root);
    this.fish.push({
      root,
      model,
      tail: model.getObjectByName('FishTail'),
      motion: new AquariumFishMotion(index, this.swimCenter, this.swimRadius),
    });
  }

  private updateAquariumLighting(elapsedTime: number) {
    if (!this.aquariumLighting) return;

    const shimmer = 0.9 + Math.sin(elapsedTime * 1.8) * 0.1;
    this.aquariumLighting.light.intensity = 0.62 * shimmer;
    this.aquariumLighting.glowMaterial.opacity = 0.16 + shimmer * 0.035;
  }
}
