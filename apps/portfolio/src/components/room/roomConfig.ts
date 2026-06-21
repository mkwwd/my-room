export type SceneMode = 'explore' | 'computer';

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
  desk: '/whitedesk.glb',
  desktop: '/desktop.glb',
  tv: '/tv.glb',
} as const;

export const MODEL_TARGET_WIDTH = {
  desk: 4.2,
  desktop: 2,
  tv: 5.4,
} as const;

export const DESK_ROTATION_Y = (23.72 * Math.PI) / 180;
export const DESK_SURFACE_HEIGHT = 1.81;
export const TV_BOTTOM_HEIGHT = 2.28;

export const COMPUTER_SCREEN = {
  centerX: -0.27,
  centerY: DESK_SURFACE_HEIGHT + 0.92,
  centerZ: -0.35,
  width: 1.42,
  height: 0.76,
} as const;
