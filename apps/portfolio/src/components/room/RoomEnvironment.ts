import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  MODEL_TARGET_WIDTH,
  ROOM,
  ROOM_COLORS,
  ROOM_MODELS,
  TV_BOTTOM_HEIGHT,
  WALL_THICKNESS,
} from './roomConfig';
import { prepareModel } from './RoomModelUtils';

export type RoomWalls = {
  back: THREE.Mesh;
  front: THREE.Mesh;
  left: THREE.Mesh;
  right: THREE.Mesh;
};

function makeMaterial(color: string) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.02,
  });
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildRoom(
  parent: THREE.Object3D,
  floorPickTargets: THREE.Object3D[],
): RoomWalls {
  const floorMaterial = makeMaterial(ROOM_COLORS.floor);
  const wallMaterial = makeMaterial(ROOM_COLORS.wall);
  const halfWidth = ROOM.width / 2;
  const halfDepth = ROOM.depth / 2;
  const wallY = ROOM.wallHeight / 2;

  const floor = addBox(
    parent,
    [ROOM.width, 0.22, ROOM.depth],
    [0, -0.12, 0],
    floorMaterial,
  );
  floorPickTargets.push(floor);

  const back = addBox(
    parent,
    [ROOM.width + WALL_THICKNESS * 2, ROOM.wallHeight, WALL_THICKNESS],
    [0, wallY, -halfDepth - WALL_THICKNESS / 2],
    wallMaterial,
  );
  const front = addBox(
    parent,
    [ROOM.width + WALL_THICKNESS * 2, ROOM.wallHeight, WALL_THICKNESS],
    [0, wallY, halfDepth + WALL_THICKNESS / 2],
    wallMaterial.clone(),
  );
  const left = addBox(
    parent,
    [WALL_THICKNESS, ROOM.wallHeight, ROOM.depth + WALL_THICKNESS],
    [-halfWidth - WALL_THICKNESS / 2, wallY, -WALL_THICKNESS / 2],
    wallMaterial,
  );
  const right = addBox(
    parent,
    [WALL_THICKNESS, ROOM.wallHeight, ROOM.depth + WALL_THICKNESS],
    [halfWidth + WALL_THICKNESS / 2, wallY, -WALL_THICKNESS / 2],
    wallMaterial.clone(),
  );

  return { back, front, left, right };
}

export default class RoomEnvironment {
  readonly floorPickTargets: THREE.Object3D[] = [];
  readonly walls: RoomWalls;

  private readonly root = new THREE.Group();
  private readonly lamp = new THREE.PointLight('#ffd59a', 1.35, 10);
  private isDisposed = false;

  constructor(private readonly scene: THREE.Scene) {
    scene.background = new THREE.Color(ROOM_COLORS.sky);
    scene.add(this.root);

    this.root.add(new THREE.HemisphereLight('#ffffff', '#b99572', 1.7));
    this.root.add(new THREE.AmbientLight('#ffffff', 0.35));
    this.lamp.position.set(-2.8, 2.5, 1.4);
    this.root.add(this.lamp);

    this.walls = buildRoom(this.root, this.floorPickTargets);
    this.loadWallTv();
  }

  update(elapsedTime: number) {
    this.lamp.intensity = 1.35 + 0.05 * Math.sin(elapsedTime * 2.1);
  }

  dispose() {
    this.isDisposed = true;
    this.floorPickTargets.length = 0;
    this.scene.remove(this.root);
  }

  private loadWallTv() {
    const anchor = new THREE.Group();
    const backWallInnerZ = -ROOM.depth / 2 + 0.08;

    anchor.position.set(0, TV_BOTTOM_HEIGHT, backWallInnerZ);
    this.root.add(anchor);

    new GLTFLoader().load(ROOM_MODELS.tv, (gltf) => {
      if (this.isDisposed) return;

      prepareModel(gltf.scene, MODEL_TARGET_WIDTH.tv);
      anchor.add(gltf.scene);
    });
  }
}
