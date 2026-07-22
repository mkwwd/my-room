import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import RoomAquarium from './RoomAquarium';
import { MODEL_TARGET_WIDTH, ROOM, ROOM_MODELS } from './roomConfig';
import { prepareModel } from './RoomModelUtils';

const LIVING_ROOM = {
  carpetPosition: new THREE.Vector3(0, 0.025, -5.35),
  sofaPosition: new THREE.Vector3(0, 0.03, -3),
  miniTablePosition: new THREE.Vector3(-1.5, 0.03, -5),
  vaseOffset: new THREE.Vector3(1.5, 0.02, -0.8),
  sofaRotationY: Math.PI,
  miniTableRotationY: 0,
} as const;

const WALL_CLOCK = {
  position: new THREE.Vector3(4.45, 4.15, -ROOM.depth / 2 + 0.12),
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

type ClockHands = {
  hour: THREE.Group;
  minute: THREE.Group;
};

type ShelfLight = {
  light: THREE.PointLight;
  glowMaterial: THREE.MeshBasicMaterial;
  stripMaterial: THREE.MeshBasicMaterial;
  baseIntensity: number;
  baseOpacity: number;
  phase: number;
};

function makeClockHand({
  length,
  width,
  depth,
  color,
}: {
  length: number;
  width: number;
  depth: number;
  color: string;
}) {
  const pivot = new THREE.Group();
  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(width, length, depth),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
  hand.position.y = length / 2;
  pivot.add(hand);
  return pivot;
}

function normalizeWallMountedModel(object: THREE.Object3D, targetSize: number) {
  object.updateMatrixWorld(true);

  const sourceBounds = new THREE.Box3().setFromObject(object);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  const largestFaceSide = Math.max(sourceSize.x, sourceSize.y);
  const scale = targetSize / Math.max(largestFaceSide, 0.001);

  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(object);
  const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
  object.position.sub(scaledCenter);
}

function makeClockFace(radius: number) {
  const faceGroup = new THREE.Group();

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.86, 64),
    new THREE.MeshStandardMaterial({
      color: '#f8efe4',
      emissive: '#3a2b22',
      emissiveIntensity: 0.04,
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  face.position.z = 0.012;
  face.receiveShadow = true;
  faceGroup.add(face);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.86, radius * 0.99, 72),
    new THREE.MeshStandardMaterial({
      color: '#b8a79c',
      emissive: '#2b211d',
      emissiveIntensity: 0.035,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  rim.position.z = 0.026;
  rim.castShadow = true;
  faceGroup.add(rim);

  const tickMaterial = new THREE.MeshBasicMaterial({
    color: '#5b4b47',
    toneMapped: false,
  });
  const tickRadius = radius * 0.7;
  Array.from({ length: 12 }).forEach((_, index) => {
    const isQuarter = index % 3 === 0;
    const angle = (index / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(
        isQuarter ? 0.035 : 0.018,
        isQuarter ? 0.13 : 0.085,
        0.012,
      ),
      tickMaterial,
    );
    tick.position.set(
      Math.sin(angle) * tickRadius,
      Math.cos(angle) * tickRadius,
      0.04,
    );
    tick.rotation.z = -angle;
    faceGroup.add(tick);
  });

  return faceGroup;
}

function makeShelfWallTexture() {
  const texture = new THREE.TextureLoader().load('/images/pattern/tile.png');
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
  private readonly root = new THREE.Group();
  private readonly loader = new GLTFLoader();
  private readonly shelfWallTexture = makeShelfWallTexture();
  private readonly shelfGlowTexture = makeShelfGlowTexture();
  private clockHands: ClockHands | null = null;
  private readonly shelfLights: ShelfLight[] = [];
  private aquarium: RoomAquarium | null = null;
  private isDisposed = false;

  constructor(private readonly parent: THREE.Object3D) {
    parent.add(this.root);

    this.loadCarpet();
    this.loadSofa();
    this.loadMiniTableWithVase();
    this.addRightWallShelves();
    this.loadToystoryShelfDecor();
    this.aquarium = new RoomAquarium(this.root);
    //this.loadWallClock();
  }

  update(elapsedTime = 0) {
    this.updateShelfLights(elapsedTime);
    this.aquarium?.update(elapsedTime);

    if (!this.clockHands) return;

    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    this.clockHands.minute.rotation.z = -(minutes / 60) * Math.PI * 2;
    this.clockHands.hour.rotation.z = -(hours / 12) * Math.PI * 2;
  }

  dispose() {
    this.isDisposed = true;
    this.aquarium?.dispose();
    this.aquarium = null;
    this.parent.remove(this.root);
    this.shelfWallTexture.dispose();
    this.shelfGlowTexture?.dispose();
  }

  private loadPlacedModel({
    path,
    targetWidth,
    position,
    rotationY = 0,
    onReady,
  }: {
    path: string;
    targetWidth: number;
    position: THREE.Vector3;
    rotationY?: number;
    onReady?: (model: THREE.Object3D) => void;
  }) {
    this.loader.load(path, (gltf) => {
      if (this.isDisposed) return;

      gltf.scene.rotation.y = rotationY;
      prepareModel(gltf.scene, targetWidth);
      gltf.scene.position.copy(position);
      this.root.add(gltf.scene);
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

    this.root.add(shelfGroup);
  }

  private loadToystoryShelfDecor() {
    const shelf = RIGHT_WALL_SHELVES[RIGHT_WALL_TOYSTORY.shelfIndex];
    const rightWallX = ROOM.width / 2 - WALL_SHELF.wallInset;

    this.loadPlacedModel({
      path: ROOM_MODELS.toystory,
      targetWidth: MODEL_TARGET_WIDTH.toystory,
      position: new THREE.Vector3(
        rightWallX - RIGHT_WALL_TOYSTORY.xOffsetFromWall,
        shelf.y + RIGHT_WALL_TOYSTORY.yOffset,
        shelf.z + RIGHT_WALL_TOYSTORY.zOffset,
      ),
      rotationY: RIGHT_WALL_TOYSTORY.rotationY,
    });
  }

  private updateShelfLights(elapsedTime: number) {
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
        light.intensity = baseIntensity * pulse;
        glowMaterial.opacity = baseOpacity * pulse;
        stripMaterial.opacity = 0.34 + (pulse - 0.84) * 0.36;
      },
    );
  }

  private loadWallClock() {
    this.loader.load(ROOM_MODELS.clock, (gltf) => {
      if (this.isDisposed) return;

      const clockRadius = MODEL_TARGET_WIDTH.clock / 2;
      normalizeWallMountedModel(gltf.scene, MODEL_TARGET_WIDTH.clock);
      gltf.scene.position.z = -0.018;
      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        const clockMaterials = materials.map((material) => {
          const clockMaterial = material.clone();
          if (clockMaterial instanceof THREE.MeshStandardMaterial) {
            clockMaterial.color.set('#d6c4b8');
            clockMaterial.emissive.set('#211814');
            clockMaterial.emissiveIntensity = 0.03;
            clockMaterial.roughness = 0.82;
            clockMaterial.metalness = 0;
            clockMaterial.side = THREE.DoubleSide;
          }
          return clockMaterial;
        });
        child.material = Array.isArray(child.material)
          ? clockMaterials
          : clockMaterials[0];
        child.castShadow = true;
        child.receiveShadow = true;
      });
      const face = makeClockFace(clockRadius);
      const handLayer = new THREE.Group();
      handLayer.position.z = 0.065;

      const hour = makeClockHand({
        length: clockRadius * 0.42,
        width: 0.055,
        depth: 0.025,
        color: '#403735',
      });
      const minute = makeClockHand({
        length: clockRadius * 0.62,
        width: 0.035,
        depth: 0.02,
        color: '#403735',
      });
      hour.position.z = 0.02;
      minute.position.z = 0.04;
      handLayer.add(hour, minute);

      const centerCap = new THREE.Mesh(
        new THREE.CircleGeometry(0.055, 20),
        new THREE.MeshBasicMaterial({
          color: '#403735',
          toneMapped: false,
        }),
      );
      centerCap.position.z = 0.06;
      handLayer.add(centerCap);

      const clockAnchor = new THREE.Group();
      clockAnchor.position.copy(WALL_CLOCK.position);
      clockAnchor.add(gltf.scene, face, handLayer);
      this.root.add(clockAnchor);
      this.clockHands = { hour, minute };
      this.update();
    });
  }
}
