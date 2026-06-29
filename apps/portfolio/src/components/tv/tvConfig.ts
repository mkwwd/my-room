export const TV_UI_WIDTH = 1100;
export const TV_UI_HEIGHT = 630;

export const TV_SCREEN = {
  centerX: 0,
  centerY: 1.62,
  centerZ: 0.148,
  width: 5.3,
  height: 3.04,
  focusDistance: 5.9,
} as const;

export type TvIconId = 'youtube';

export type TvIconConfig = {
  id: TvIconId;
  label: string;
  image?: {
    src: string;
    alt: string;
  };
};

export const tvIcons: TvIconConfig[] = [
  {
    id: 'youtube',
    label: 'YouTube',
  },
];

export type YoutubeProfile = {
  id: string;
  name: string;
  type: 'emoji' | 'initial';
  value: string;
  background: string;
};
