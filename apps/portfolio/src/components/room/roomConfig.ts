export type FocusMode = 'computer' | 'tv';
export type SceneMode = 'explore' | FocusMode;

export const ROOM = {
  width: 13.4,
  depth: 20,
  wallHeight: 8,
  playerLimitX: 5.25,
  playerLimitZ: 8.75,
} as const;

export const ROOM_COLORS = {
  sky: '#c9ecff',
  floor: '#ffffff',
  wall: '#e7f7ff',
} as const;

export const WALL_THICKNESS = 0.32;

export const ROOM_MODELS = {
  desk: '/models/whitedesk.glb',
  computerDesk: '/models/computerdesk.glb',
  computer: '/models/computer.glb',
  carpet: '/models/carpet.glb',
  miniTable: '/models/minitable.glb',
  pinkSofa: '/models/pinksofa.glb',
  tv: '/models/tv.glb',
  vase: '/models/vase.glb',
} as const;

export const MODEL_TARGET_WIDTH = {
  carpet: 5.4,
  desk: 4,
  computerDesk: 2.5,
  computer: 1.8,
  miniTable: 3,
  pinkSofa: 8,
  tv: 5.4,
  vase: 1,
} as const;

export const DESK_ROTATION_Y = (23.72 * Math.PI) / 180;
export const DESK_SURFACE_HEIGHT = 1.72;
export const COMPUTER_DESK_ROTATION_Y = Math.PI / 2;
export const COMPUTER_DESK_HEIGHT_SCALE = 1.25;
export const COMPUTER_DESK_HEIGHT =
  MODEL_TARGET_WIDTH.computerDesk * 0.075 * COMPUTER_DESK_HEIGHT_SCALE;
export const COMPUTER_SURFACE_HEIGHT =
  DESK_SURFACE_HEIGHT + COMPUTER_DESK_HEIGHT;
export const COMPUTER_BASE_HEIGHT = COMPUTER_SURFACE_HEIGHT + 0.05;
export const COMPUTER_STATION_WALL_INSET = 1.35;
export const TV_BOTTOM_HEIGHT = 2.28;

export const COMPUTER_SCREEN = {
  centerX: -0.1,
  centerY: COMPUTER_BASE_HEIGHT + 0.71,
  centerZ: 0,
  width: 1.64,
  height: 0.99,
  focusDistance: 2.45,
} as const;
