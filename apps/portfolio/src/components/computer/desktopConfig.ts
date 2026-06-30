export const DESKTOP_UI_WIDTH = 1120;
export const DESKTOP_UI_HEIGHT = 630;
export const DESKTOP_TASKBAR_HEIGHT = 40;
export const DESKTOP_GRID_SIZE = 96;
export const DESKTOP_ICON_STORAGE_KEY = 'my-room.desktop-icon-positions.v5';

export type DesktopIconId = 'github' | 'project' | 'contact';
export type DesktopAppId = 'github';

export type DesktopIconPosition = {
  x: number;
  y: number;
};

export type DesktopIconConfig = {
  id: DesktopIconId;
  label: string;
  fallbackText: string;
  fallbackTone: string;
  image?: {
    src: string;
    alt: string;
  };
};

export type DesktopAppConfig = {
  id: DesktopAppId;
  title: string;
  iconId: DesktopIconId;
};

export const desktopIcons: DesktopIconConfig[] = [
  {
    id: 'github',
    label: 'Github',
    fallbackText: 'GH',
    fallbackTone: 'bg-[#232225] text-white',
    image: {
      src: '/images/git.png',
      alt: 'Github logo',
    },
  },
  {
    id: 'project',
    label: 'Project',
    fallbackText: 'P',
    fallbackTone: 'bg-[#f09a29] text-[#17110e]',
    image: {
      src: '/images/project.png',
      alt: 'Github logo',
    },
  },
  {
    id: 'contact',
    label: 'Contact',
    fallbackText: 'C',
    fallbackTone: 'bg-[#55c6f2] text-[#17110e]',
    image: {
      src: '/images/github_logo.png',
      alt: 'Github logo',
    },
  },
];

export const defaultDesktopIconPositions: Record<
  DesktopIconId,
  DesktopIconPosition
> = {
  github: { x: 26, y: 24 },
  project: { x: 26, y: 120 },
  contact: { x: 26, y: 216 },
};

export const desktopApps: Record<DesktopAppId, DesktopAppConfig> = {
  github: {
    id: 'github',
    title: 'Github',
    iconId: 'github',
  },
};

export const desktopAppByIcon: Partial<Record<DesktopIconId, DesktopAppId>> = {
  github: 'github',
};
