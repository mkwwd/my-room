import * as THREE from 'three';

import {
  ROOM,
  ROOM_COLORS,
  ROOM_WINDOW,
  WALL_THICKNESS,
} from './roomConfig';
import RoomFurniture from './RoomFurniture';
import RoomWindow from './RoomWindow';

export type RoomWalls = {
  back: THREE.Mesh;
  front: THREE.Mesh;
  left: THREE.Group;
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
  const left = new THREE.Group();
  left.position.set(
    -halfWidth - WALL_THICKNESS / 2,
    wallY,
    -WALL_THICKNESS / 2,
  );
  parent.add(left);

  const wallDepth = ROOM.depth + WALL_THICKNESS;
  const wallMinZ = -wallDepth / 2;
  const wallMaxZ = wallDepth / 2;
  const windowCenterZ = ROOM_WINDOW.centerZ + WALL_THICKNESS / 2;
  const windowMinZ = windowCenterZ - ROOM_WINDOW.width / 2;
  const windowMaxZ = windowCenterZ + ROOM_WINDOW.width / 2;
  const lowerWallHeight = ROOM_WINDOW.bottomHeight;
  const windowTop = ROOM_WINDOW.bottomHeight + ROOM_WINDOW.height;
  const upperWallHeight = ROOM.wallHeight - windowTop;

  addBox(
    left,
    [WALL_THICKNESS, ROOM.wallHeight, windowMinZ - wallMinZ],
    [0, 0, (wallMinZ + windowMinZ) / 2],
    wallMaterial,
  );
  addBox(
    left,
    [WALL_THICKNESS, ROOM.wallHeight, wallMaxZ - windowMaxZ],
    [0, 0, (windowMaxZ + wallMaxZ) / 2],
    wallMaterial,
  );
  addBox(
    left,
    [WALL_THICKNESS, lowerWallHeight, ROOM_WINDOW.width],
    [0, -ROOM.wallHeight / 2 + lowerWallHeight / 2, windowCenterZ],
    wallMaterial,
  );
  addBox(
    left,
    [WALL_THICKNESS, upperWallHeight, ROOM_WINDOW.width],
    [0, ROOM.wallHeight / 2 - upperWallHeight / 2, windowCenterZ],
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
  private readonly furniture: RoomFurniture;
  readonly roomWindow: RoomWindow;
  private lastSkyCheck = Number.NEGATIVE_INFINITY;

  constructor(private readonly scene: THREE.Scene) {
    scene.background = new THREE.Color(ROOM_COLORS.sky);
    this.updateSkyBackground(0, true);
    scene.add(this.root);

    this.root.add(new THREE.HemisphereLight('#ffffff', '#b99572', 1.7));
    this.root.add(new THREE.AmbientLight('#ffffff', 0.35));
    this.lamp.position.set(-2.8, 2.5, 1.4);
    this.root.add(this.lamp);

    this.walls = buildRoom(this.root, this.floorPickTargets);
    this.furniture = new RoomFurniture(this.root);
    this.roomWindow = new RoomWindow(this.walls.left);
  }

  update(elapsedTime: number) {
    this.lamp.intensity = 1.35 + 0.05 * Math.sin(elapsedTime * 2.1);
    this.roomWindow.update(elapsedTime);
    this.updateSkyBackground(elapsedTime);
  }

  dispose() {
    this.floorPickTargets.length = 0;
    this.furniture.dispose();
    this.roomWindow.dispose();
    this.scene.remove(this.root);
  }

  private updateSkyBackground(elapsedTime: number, force = false) {
    if (!force && elapsedTime - this.lastSkyCheck < 30) return;
    this.lastSkyCheck = elapsedTime;

    const hour = new Date().getHours();
    const isDaytime =
      hour >= ROOM_WINDOW.dayStartsAt && hour < ROOM_WINDOW.nightStartsAt;
    const skyColor = isDaytime ? ROOM_COLORS.sky : ROOM_COLORS.nightSky;

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.set(skyColor);
    } else {
      this.scene.background = new THREE.Color(skyColor);
    }
  }
}
