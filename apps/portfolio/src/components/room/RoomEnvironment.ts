import * as THREE from 'three';

import {
  ROOM,
  ROOM_COLORS,
  ROOM_DEPTH_BOUNDS,
  ROOM_WINDOW,
  WALL_THICKNESS,
} from './roomConfig';
import RoomDoor from './RoomDoor';
import RoomFurniture from './RoomFurniture';
import RoomLighting from './RoomLighting';
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

function makeFloorTexture(manager: THREE.LoadingManager) {
  const texture = new THREE.TextureLoader(manager).load(
    '/images/pattern/tile.png',
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function makeWallTexture() {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 17;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 0xffffffff - 0.5) * 8;
      const weave =
        Math.sin((x * Math.PI) / 2) * 2 + Math.sin((y * Math.PI) / 4);
      const value = Math.round(245 + grain + weave);
      const offset = (y * size + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

type RoomSurface = 'wall' | 'floor';

function finishRoomSurface(
  mesh: THREE.Mesh<THREE.BoxGeometry>,
  surface: RoomSurface,
) {
  mesh.updateWorldMatrix(true, false);
  const positions = mesh.geometry.getAttribute('position');
  const normals = mesh.geometry.getAttribute('normal');
  const uv = mesh.geometry.getAttribute('uv');
  const colors = new Float32Array(positions.count * 3);
  const point = new THREE.Vector3();
  const halfWidth = ROOM.width / 2;

  // World-space UVs keep the wallpaper continuous across the window cutout.
  // Fixed vertex shading gives the joins depth without a per-frame shadow pass.
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    let shade: number;
    if (surface === 'floor') {
      uv.setXY(i, point.x / 3.2, -point.z / 3.2);
      const edgeDistance = Math.max(
        0,
        Math.min(
          halfWidth - Math.abs(point.x),
          point.z - ROOM_DEPTH_BOUNDS.back,
          ROOM_DEPTH_BOUNDS.front - point.z,
        ),
      );
      shade = 1 - 0.16 * Math.exp(-edgeDistance / 0.3);
    } else {
      const isSideWall = Math.abs(normals.getX(i)) > 0.5;
      uv.setXY(i, isSideWall ? point.z : point.x, point.y);
      const cornerDistance = Math.max(
        0,
        isSideWall
          ? Math.min(
              point.z - ROOM_DEPTH_BOUNDS.back,
              ROOM_DEPTH_BOUNDS.front - point.z,
            )
          : halfWidth - Math.abs(point.x),
      );
      shade =
        1 -
        0.1 * Math.exp(-cornerDistance / 0.28) -
        0.13 * Math.exp(-Math.max(0, point.y - 0.01) / 0.28);
    }
    colors.set([shade, shade, shade], i * 3);
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  surface?: RoomSurface,
) {
  const segments = size.map((length) =>
    surface ? Math.max(1, Math.ceil(length / 0.4)) : 1,
  );
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size, segments[0], segments[1], segments[2]),
    material,
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (surface) finishRoomSurface(mesh, surface);
  return mesh;
}

function addRoomTrim(walls: RoomWalls, wallY: number) {
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: '#eeeae2',
    roughness: 0.74,
    metalness: 0,
  });
  const baseboardHeight = 0.18;
  const baseboardDepth = 0.045;
  const baseboardY = 0.01 + baseboardHeight / 2;

  addBox(
    walls.back,
    [ROOM.width, baseboardHeight, baseboardDepth],
    [0, baseboardY - wallY, WALL_THICKNESS / 2 + baseboardDepth / 2],
    trimMaterial,
  );
  addBox(
    walls.front,
    [ROOM.width, baseboardHeight, baseboardDepth],
    [0, baseboardY - wallY, -WALL_THICKNESS / 2 - baseboardDepth / 2],
    trimMaterial,
  );
  addBox(
    walls.left,
    [
      baseboardDepth,
      baseboardHeight,
      ROOM_DEPTH_BOUNDS.depth - baseboardDepth * 2,
    ],
    [
      WALL_THICKNESS / 2 + baseboardDepth / 2,
      baseboardY - wallY,
      WALL_THICKNESS / 2,
    ],
    trimMaterial,
  );
  addBox(
    walls.right,
    [
      baseboardDepth,
      baseboardHeight,
      ROOM_DEPTH_BOUNDS.depth - baseboardDepth * 2,
    ],
    [
      -WALL_THICKNESS / 2 - baseboardDepth / 2,
      baseboardY - wallY,
      WALL_THICKNESS / 2,
    ],
    trimMaterial,
  );
}

function buildRoom(
  parent: THREE.Object3D,
  floorPickTargets: THREE.Object3D[],
  floorTexture: THREE.Texture,
  wallTexture: THREE.Texture,
): RoomWalls {
  const floorMaterial = makeMaterial(ROOM_COLORS.floor);
  floorMaterial.map = floorTexture;
  floorMaterial.bumpMap = floorTexture;
  floorMaterial.bumpScale = 0.018;
  floorMaterial.roughness = 0.82;
  floorMaterial.metalness = 0;
  floorMaterial.vertexColors = true;
  const wallMaterial = makeMaterial(ROOM_COLORS.wall);
  wallMaterial.map = wallTexture;
  wallMaterial.color.set('#efede8');
  wallMaterial.bumpMap = wallTexture;
  wallMaterial.bumpScale = 0.012;
  wallMaterial.roughness = 0.95;
  wallMaterial.metalness = 0;
  wallMaterial.vertexColors = true;
  const halfWidth = ROOM.width / 2;
  const halfDepth = ROOM.depth / 2;
  const wallY = ROOM.wallHeight / 2;

  const floor = addBox(
    parent,
    [
      ROOM.width + WALL_THICKNESS * 2,
      0.22,
      ROOM_DEPTH_BOUNDS.depth + WALL_THICKNESS * 2,
    ],
    [0, -0.1, ROOM_DEPTH_BOUNDS.centerZ],
    floorMaterial,
    'floor',
  );
  floorPickTargets.push(floor);

  const back = addBox(
    parent,
    [ROOM.width + WALL_THICKNESS * 2, ROOM.wallHeight, WALL_THICKNESS],
    [0, wallY, -halfDepth - WALL_THICKNESS / 2],
    wallMaterial,
    'wall',
  );
  const front = addBox(
    parent,
    [ROOM.width + WALL_THICKNESS * 2, ROOM.wallHeight, WALL_THICKNESS],
    [0, wallY, ROOM_DEPTH_BOUNDS.front + WALL_THICKNESS / 2],
    wallMaterial.clone(),
    'wall',
  );
  const left = new THREE.Group();
  left.position.set(
    -halfWidth - WALL_THICKNESS / 2,
    wallY,
    ROOM_DEPTH_BOUNDS.sideWallCenterZ,
  );
  parent.add(left);

  const wallDepth = ROOM_DEPTH_BOUNDS.depth + WALL_THICKNESS;
  const wallMinZ = -wallDepth / 2;
  const wallMaxZ = wallDepth / 2;
  const windowCenterZ = ROOM_WINDOW.centerZ - ROOM_DEPTH_BOUNDS.sideWallCenterZ;
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
    'wall',
  );
  addBox(
    left,
    [WALL_THICKNESS, ROOM.wallHeight, wallMaxZ - windowMaxZ],
    [0, 0, (windowMaxZ + wallMaxZ) / 2],
    wallMaterial,
    'wall',
  );
  addBox(
    left,
    [WALL_THICKNESS, lowerWallHeight, ROOM_WINDOW.width],
    [0, -ROOM.wallHeight / 2 + lowerWallHeight / 2, windowCenterZ],
    wallMaterial,
    'wall',
  );
  addBox(
    left,
    [WALL_THICKNESS, upperWallHeight, ROOM_WINDOW.width],
    [0, ROOM.wallHeight / 2 - upperWallHeight / 2, windowCenterZ],
    wallMaterial,
    'wall',
  );
  const right = addBox(
    parent,
    [WALL_THICKNESS, ROOM.wallHeight, ROOM_DEPTH_BOUNDS.depth + WALL_THICKNESS],
    [halfWidth + WALL_THICKNESS / 2, wallY, ROOM_DEPTH_BOUNDS.sideWallCenterZ],
    wallMaterial.clone(),
    'wall',
  );

  const walls = { back, front, left, right };
  addRoomTrim(walls, wallY);

  return walls;
}

export default class RoomEnvironment {
  readonly floorPickTargets: THREE.Object3D[] = [];
  readonly walls: RoomWalls;

  private readonly root = new THREE.Group();
  private readonly floorTexture: THREE.Texture;
  private readonly wallTexture = makeWallTexture();
  private readonly lighting = new RoomLighting(this.root);
  private readonly furniture: RoomFurniture;
  readonly roomWindow: RoomWindow;
  readonly door: RoomDoor;
  private lastSkyCheck = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly scene: THREE.Scene,
    manager: THREE.LoadingManager,
  ) {
    this.floorTexture = makeFloorTexture(manager);
    scene.background = new THREE.Color(ROOM_COLORS.sky);
    this.updateSkyBackground(0, true);
    scene.add(this.root);

    this.walls = buildRoom(
      this.root,
      this.floorPickTargets,
      this.floorTexture,
      this.wallTexture,
    );
    this.furniture = new RoomFurniture(this.root, manager);
    this.roomWindow = new RoomWindow(this.walls.left, manager);
    this.door = new RoomDoor(this.walls.front);
  }

  update(elapsedTime: number, delta: number, switchHovered: boolean) {
    this.roomWindow.update(elapsedTime);
    this.lighting.update(delta, this.roomWindow.isDaytime);
    this.furniture.update(elapsedTime, this.lighting.indoorLevel);
    this.door.update(this.lighting.isOn, switchHovered, delta);
    this.updateSkyBackground(elapsedTime);
  }

  toggleLights() {
    return this.lighting.toggle();
  }

  updateSofaHover(active: boolean, delta: number) {
    this.furniture.updateSofaHover(active, delta);
  }

  dispose() {
    this.lighting.dispose();
    this.door.dispose();
    this.floorPickTargets.length = 0;
    this.furniture.dispose();
    this.roomWindow.dispose();
    this.floorTexture.dispose();
    this.wallTexture.dispose();
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
