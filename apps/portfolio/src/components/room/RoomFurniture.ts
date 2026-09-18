import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import RoomAquarium from './RoomAquarium';
import { MODEL_TARGET_WIDTH, ROOM, ROOM_MODELS } from './roomConfig';
import { addHoverRim } from './RoomHoverEffect';
import { prepareModel } from './RoomModelUtils';

const LIVING_ROOM = {
  carpetPosition: new THREE.Vector3(0, 0.025, -5.35),
  sofaPosition: new THREE.Vector3(0, 0.03, -3),
  miniTablePosition: new THREE.Vector3(-1.5, 0.03, -5),
  vaseOffset: new THREE.Vector3(1.5, 0.02, -0.8),
  sofaRotationY: Math.PI,
  miniTableRotationY: 0,
} as const;

const WALL_SHELF = {
  depth: 1.12,
  height: 0.16,
  wallInset: 0.035,
  glowHeight: 0.92,
} as const;

const RIGHT_WALL_SHELVES = [
  {
    length: 2.35,
    depth: WALL_SHELF.depth,
    y: 5.45,
    z: -6,
    baseIntensity: 0.72,
    phase: 0.2,
  },
  {
    length: 3.35,
    depth: WALL_SHELF.depth,
    y: 4.05,
    z: -4,
    baseIntensity: 0.82,
    phase: 1.35,
  },
  {
    length: 2.45,
    depth: WALL_SHELF.depth,
    y: 2.65,
    z: -5.5,
    baseIntensity: 0.76,
    phase: 2.45,
  },
] as const;

const RIGHT_WALL_TOYSTORY = {
  shelfIndex: 1,
  xOffsetFromWall: WALL_SHELF.depth * 0.58,
  yOffset: WALL_SHELF.height / 2 + 0.018,
  zOffset: 0.4,
  rotationY: -Math.PI / 2,
} as const;

type ShelfLight = {
  light: THREE.PointLight;
  glowMaterial: THREE.MeshBasicMaterial;
  stripMaterial: THREE.MeshBasicMaterial;
  baseIntensity: number;
  baseOpacity: number;
  phase: number;
};

function makeShelfWallTexture(manager: THREE.LoadingManager) {
  const texture = new THREE.TextureLoader(manager).load(
    '/images/pattern/tile.png',
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.35, 0.38);
  texture.anisotropy = 8;
  return texture;
}

function makeShelfMaterial(texture: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: texture,
    emissive: '#ffffff',
    emissiveIntensity: 0.25,
    roughness: 0.95,
    metalness: 0,
  });
}

function makeShelfGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    6,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2,
  );
  gradient.addColorStop(0, 'rgba(255, 190, 126, 0.72)');
  gradient.addColorStop(0.42, 'rgba(255, 160, 88, 0.34)');
  gradient.addColorStop(1, 'rgba(255, 130, 64, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default class RoomFurniture {
  private readonly sofaHoverStrength = { value: 0 };
  private readonly root = new THREE.Group();
  private readonly rightWallDecor = new THREE.Group();
  private readonly loader: GLTFLoader;
  private readonly shelfWallTexture: THREE.Texture;
  private readonly shelfGlowTexture = makeShelfGlowTexture();
  private readonly shelfLights: ShelfLight[] = [];
  private readonly shelfMaterials: THREE.MeshStandardMaterial[] = [];
  readonly aquarium: RoomAquarium;
  private isDisposed = false;

  constructor(
    private readonly parent: THREE.Object3D,
    manager: THREE.LoadingManager,
  ) {
    this.loader = new GLTFLoader(manager);
    this.shelfWallTexture = makeShelfWallTexture(manager);
    parent.add(this.root);
    this.root.add(this.rightWallDecor);

    this.loadCarpet();
    this.loadSofa();
    this.loadMiniTableWithVase();
    this.addRightWallShelves();
    this.loadToystoryShelfDecor();
    this.aquarium = new RoomAquarium(this.rightWallDecor, manager);
  }

  update(elapsedTime = 0, lightLevel = 1) {
    this.updateShelfLights(elapsedTime, lightLevel);
    this.shelfMaterials.forEach((material) => {
      material.emissiveIntensity = 0.25 * lightLevel;
    });
    this.aquarium.update(elapsedTime);
  }

  updateSofaHover(active: boolean, delta: number) {
    this.sofaHoverStrength.value = THREE.MathUtils.damp(
      this.sofaHoverStrength.value,
      active ? 1.1 : 0,
      14,
      delta,
    );
  }

  dispose() {
    this.isDisposed = true;
    this.aquarium.dispose();
    this.parent.remove(this.root);
    this.shelfWallTexture.dispose();
    this.shelfGlowTexture?.dispose();
  }

  private loadPlacedModel({
    path,
    targetWidth,
    position,
    rotationY = 0,
    parent = this.root,
    onReady,
  }: {
    path: string;
    targetWidth: number;
    position: THREE.Vector3;
    rotationY?: number;
    parent?: THREE.Object3D;
    onReady?: (model: THREE.Object3D) => void;
  }) {
    this.loader.load(path, (gltf) => {
      if (this.isDisposed) return;

      gltf.scene.rotation.y = rotationY;
      prepareModel(gltf.scene, targetWidth);
      gltf.scene.position.copy(position);
      parent.add(gltf.scene);
      onReady?.(gltf.scene);
    });
  }

  private loadCarpet() {
    this.loadPlacedModel({
      path: ROOM_MODELS.carpet,
      targetWidth: MODEL_TARGET_WIDTH.carpet,
      position: LIVING_ROOM.carpetPosition,
    });
  }

  private loadSofa() {
    this.loadPlacedModel({
      path: ROOM_MODELS.pinkSofa,
      targetWidth: MODEL_TARGET_WIDTH.pinkSofa,
      position: LIVING_ROOM.sofaPosition,
      rotationY: LIVING_ROOM.sofaRotationY,
      onReady: (sofa) => addHoverRim(sofa, this.sofaHoverStrength),
    });
  }

  private loadMiniTableWithVase() {
    this.loadPlacedModel({
      path: ROOM_MODELS.miniTable,
      targetWidth: MODEL_TARGET_WIDTH.miniTable,
      position: LIVING_ROOM.miniTablePosition,
      rotationY: LIVING_ROOM.miniTableRotationY,
      onReady: (miniTable) => {
        const tableBounds = new THREE.Box3().setFromObject(miniTable);
        const tableTopY = tableBounds.max.y;

        this.loadPlacedModel({
          path: ROOM_MODELS.vase,
          targetWidth: MODEL_TARGET_WIDTH.vase,
          position: new THREE.Vector3(
            LIVING_ROOM.miniTablePosition.x + LIVING_ROOM.vaseOffset.x,
            tableTopY + LIVING_ROOM.vaseOffset.y,
            LIVING_ROOM.miniTablePosition.z + LIVING_ROOM.vaseOffset.z,
          ),
        });
      },
    });
  }

  private addRightWallShelves() {
    const shelfGroup = new THREE.Group();
    const rightWallX = ROOM.width / 2 - WALL_SHELF.wallInset;

    RIGHT_WALL_SHELVES.forEach(
      ({ length, depth, y, z, baseIntensity, phase }) => {
        const shelfCenterX = rightWallX - depth / 2;
        const shelf = new THREE.Mesh(
          new THREE.BoxGeometry(depth, WALL_SHELF.height, length),
          makeShelfMaterial(this.shelfWallTexture),
        );
        shelf.position.set(shelfCenterX, y, z);
        this.shelfMaterials.push(shelf.material);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        shelfGroup.add(shelf);

        const glowMaterial = new THREE.MeshBasicMaterial({
          color: '#ffbb7c',
          map: this.shelfGlowTexture ?? undefined,
          transparent: true,
          opacity: 0.18,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        const glow = new THREE.Mesh(
          new THREE.PlaneGeometry(length * 1.24, WALL_SHELF.glowHeight),
          glowMaterial,
        );
        glow.position.set(ROOM.width / 2 - 0.012, y + 0.08, z);
        glow.rotation.y = Math.PI / 2;
        shelfGroup.add(glow);

        const stripMaterial = new THREE.MeshBasicMaterial({
          color: '#ffc188',
          transparent: true,
          opacity: 0.36,
          toneMapped: false,
        });
        const lightStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.018, length * 0.82),
          stripMaterial,
        );
        lightStrip.position.set(
          rightWallX - depth + 0.08,
          y - WALL_SHELF.height / 2 - 0.014,
          z,
        );
        shelfGroup.add(lightStrip);

        const light = new THREE.PointLight(
          '#ffbd82',
          baseIntensity,
          2.45,
          1.85,
        );
        light.position.set(shelfCenterX - 0.18, y + 0.18, z);
        shelfGroup.add(light);

        this.shelfLights.push({
          light,
          glowMaterial,
          stripMaterial,
          baseIntensity,
          baseOpacity: 0.18,
          phase,
        });
      },
    );

    this.rightWallDecor.add(shelfGroup);
  }

  private loadToystoryShelfDecor() {
    const shelf = RIGHT_WALL_SHELVES[RIGHT_WALL_TOYSTORY.shelfIndex];
    const rightWallX = ROOM.width / 2 - WALL_SHELF.wallInset;

    this.loadPlacedModel({
      path: ROOM_MODELS.toystory,
      targetWidth: MODEL_TARGET_WIDTH.toystory,
      parent: this.rightWallDecor,
      position: new THREE.Vector3(
        rightWallX - RIGHT_WALL_TOYSTORY.xOffsetFromWall,
        shelf.y + RIGHT_WALL_TOYSTORY.yOffset,
        shelf.z + RIGHT_WALL_TOYSTORY.zOffset,
      ),
      rotationY: RIGHT_WALL_TOYSTORY.rotationY,
    });
  }

  private updateShelfLights(elapsedTime: number, lightLevel: number) {
    this.shelfLights.forEach(
      ({
        light,
        glowMaterial,
        stripMaterial,
        baseIntensity,
        baseOpacity,
        phase,
      }) => {
        const pulse = 0.92 + Math.sin(elapsedTime * 1.35 + phase) * 0.08;
        light.intensity = baseIntensity * pulse * lightLevel;
        glowMaterial.opacity = baseOpacity * pulse * lightLevel;
        stripMaterial.opacity = (0.34 + (pulse - 0.84) * 0.36) * lightLevel;
      },
    );
  }
}
