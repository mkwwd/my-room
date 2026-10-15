export type FocusMode =
  | 'computer'
  | 'tv'
  | 'window'
  | 'aquarium'
  | 'portrait'
  | 'landscape'
  | 'square';
export type SceneMode = 'explore' | FocusMode;
export type RoomSeatId = 'sofa' | 'chair';
export type RoomHoverTarget =
  | FocusMode
  | RoomSeatId
  | 'lightSwitch'
  | 'floorLamp';
export type RoomSeat = {
  position: readonly [number, number, number];
  exitPosition: readonly [number, number, number];
  rotationY: number;
  interactionRadius: number;
};

export type RoomCollisionBox = {
  centerX: number;
  centerZ: number;
  halfWidth: number;
  halfDepth: number;
};

export const ROOM = {
  width: 13.4,
  depth: 20,
  wallHeight: 22,
  playerLimitX: 5.25,
  playerLimitZ: 8.75,
} as const;

export const ROOM_COLORS = {
  sky: '#c9ecff',
  nightSky: '#030b1c',
  floor: '#ffffff',
  wall: '#ffffff',
} as const;

export const WALL_THICKNESS = 0.32;
export const ROOM_FRONT_CROP = 1.4;
export const ROOM_DEPTH_BOUNDS = {
  back: -ROOM.depth / 2,
  front: ROOM.depth / 2 - ROOM_FRONT_CROP,
  depth: ROOM.depth - ROOM_FRONT_CROP,
  centerZ: -ROOM_FRONT_CROP / 2,
  sideWallCenterZ: -ROOM_FRONT_CROP / 2 - WALL_THICKNESS / 2,
} as const;

export const ROOM_WINDOW = {
  width: 3.2,
  height: 4,
  bottomHeight: 2.05,
  centerZ: -3.65,
  dayStartsAt: 6,
  nightStartsAt: 18,
  focusDistance: 8.4,
} as const;

export const ROOM_MODELS = {
  desk: '/models/cozy-desk.glb',
  computerDesk: '/models/computerdesk.glb',
  computer: '/models/computer.glb',
  keyboard: '/models/cozy-keyboard.glb',
  mouse: '/models/cozy-mouse.glb',
  gamingChair: '/models/cozy-gaming-chair.glb',
  carpet: '/models/carpet.glb',
  miniTable: '/models/minitable.glb',
  pinkSofa: '/models/pinksofa.glb',
  tv: '/models/tv.glb',
  vase: '/models/vase.glb',
  window: '/models/glass_window.glb',
  moon: '/models/moon.glb',
  cloud1: '/models/cloud1.glb',
  cloud2: '/models/cloud2.glb',
  cloud3: '/models/cloud3.glb',
  cabinet: '/models/modern_desk.glb',
  bikini1: '/models/bikini1.glb',
  clownfish: '/models/clownfish.glb',
  blueTang: '/models/blue-tang.glb',
  toystory: '/models/toystory.glb',
  // Original cat.glb and doll.glb are retained for switching back.
  cat: '/models/cat-custom.glb?v=faithful-1',
  character: '/models/doll-blink.glb?v=1',
  tulip: '/models/tulip.glb',
} as const;

export const MODEL_TARGET_WIDTH = {
  carpet: 5.4,
  desk: 3.7,
  computerDesk: 2,
  computer: 1.8,
  miniTable: 3,
  pinkSofa: 8,
  tv: 5.4,
  vase: 1,
  window: 3.2,
  toystory: 3,
  cat: 1.12,
  tulip: 0.62,
} as const;

export const DESK_DEPTH = 1.65;
export const DESK_SURFACE_HEIGHT = 1.72;
export const COMPUTER_DESK_ROTATION_Y = Math.PI / 2;
export const COMPUTER_DESK_HEIGHT_SCALE = 1.25;
export const COMPUTER_DESK_HEIGHT =
  MODEL_TARGET_WIDTH.computerDesk * 0.075 * COMPUTER_DESK_HEIGHT_SCALE;
export const COMPUTER_SURFACE_HEIGHT =
  DESK_SURFACE_HEIGHT + COMPUTER_DESK_HEIGHT;
export const COMPUTER_BASE_HEIGHT = COMPUTER_SURFACE_HEIGHT + 0.05;
export const COMPUTER_STATION_WALL_INSET = DESK_DEPTH / 2 + 0.025;
export const COMPUTER_DESKTOP_OFFSET_Z = -0.22;
export const TV_BOTTOM_HEIGHT = 2.28;

export const ROOM_FLOOR_LAMP = {
  position: [-4.15, 0.01, -8.98],
  scale: 1.3,
} as const;

export const COMPUTER_CHAIR = {
  position: [-3.85, 0, 2.1],
  rotationY: -Math.PI / 2,
} as const;

export const COMPUTER_SCREEN = {
  centerX: -0.1,
  centerY: COMPUTER_BASE_HEIGHT + 0.71,
  centerZ: COMPUTER_DESKTOP_OFFSET_Z,
  width: 1.72,
  height: 1.04,
  focusDistance: 2.45,
} as const;

export const ROOM_COLLISION_BOXES: RoomCollisionBox[] = [
  {
    centerX: ROOM_FLOOR_LAMP.position[0],
    centerZ: ROOM_FLOOR_LAMP.position[2],
    halfWidth: 0.48 * ROOM_FLOOR_LAMP.scale,
    halfDepth: 0.48 * ROOM_FLOOR_LAMP.scale,
  },
  {
    centerX: COMPUTER_CHAIR.position[0],
    centerZ: COMPUTER_CHAIR.position[2],
    halfWidth: 0.7,
    halfDepth: 0.75,
  },
  {
    centerX: 0,
    centerZ: -3.38,
    // The GLB's embedded floor is much wider than the visible sofa.
    halfWidth: 2.1,
    halfDepth: 0.42,
  },
  {
    centerX: -1.5,
    centerZ: -5,
    halfWidth: 1.65,
    halfDepth: 0.9,
  },
  {
    centerX: -ROOM.width / 2 + COMPUTER_STATION_WALL_INSET,
    centerZ: 2,
    halfWidth: DESK_DEPTH / 2,
    halfDepth: MODEL_TARGET_WIDTH.desk / 2,
  },
  {
    centerX: 0,
    centerZ: -ROOM.depth / 2 + 0.42,
    halfWidth: 3.15,
    halfDepth: 0.56,
  },
  {
    centerX: ROOM.width / 2 - 0.75,
    centerZ: 1.75,
    halfWidth: 0.95,
    halfDepth: 2.25,
  },
];

export const ROOM_SOFA_SEAT = {
  position: [0, 0.92, -3.56],
  exitPosition: [0.75, 0, -4.24],
  rotationY: Math.PI,
  interactionRadius: 1.65,
} as const;

export const ROOM_SEATS = {
  sofa: ROOM_SOFA_SEAT,
  chair: {
    position: [
      COMPUTER_CHAIR.position[0] - 0.06,
      0.53,
      COMPUTER_CHAIR.position[2],
    ],
    exitPosition: [COMPUTER_CHAIR.position[0], 0, 3.45],
    rotationY: COMPUTER_CHAIR.rotationY,
    interactionRadius: 1.7,
  },
} as const satisfies Record<RoomSeatId, RoomSeat>;

export const ROOM_SOFA_INTERACTION = {
  center: [0, 1.28, -3],
  halfSize: [2.1, 1.25, 1.35],
  hintAnchor: [0, 1.7, -2.8],
} as const;
