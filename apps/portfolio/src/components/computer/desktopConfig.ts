export const DESKTOP_UI_WIDTH = 1120;
export const DESKTOP_UI_HEIGHT = 630;
export const DESKTOP_TASKBAR_HEIGHT = 40;
export const DESKTOP_GRID_SIZE = 96;
export const DESKTOP_ICON_STORAGE_KEY = 'my-room.desktop-icon-positions.v5';
export type DesktopIconId = 'github' | 'velog' | 'project' | 'contact';
export type DesktopAppId = 'github' | 'velog' | 'contact';

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
    id: 'velog',
    label: 'Velog',
    fallbackText: 'V',
    fallbackTone: 'bg-[#20c997] text-white',
  },
  {
    id: 'project',
    label: 'Project',
    fallbackText: 'P',
    fallbackTone: 'bg-[#f09a29] text-[#17110e]',
    image: {
      src: '/images/project.png',
      alt: 'Project folder icon',
    },
  },
  {
    id: 'contact',
    label: 'Contact',
    fallbackText: 'C',
    fallbackTone: 'bg-[#55c6f2] text-[#17110e]',
    image: {
      src: '/images/github_logo.png',
      alt: 'Contact icon',
    },
  },
];

export const defaultDesktopIconPositions: Record<
  DesktopIconId,
  DesktopIconPosition
> = {
  github: { x: 26, y: 24 },
  velog: { x: 26, y: 120 },
  project: { x: 26, y: 216 },
  contact: { x: 26, y: 312 },
};

export const desktopApps: Record<DesktopAppId, DesktopAppConfig> = {
  github: {
    id: 'github',
    title: 'Github',
    iconId: 'github',
  },
  velog: {
    id: 'velog',
    title: 'Velog',
    iconId: 'velog',
  },
  contact: {
    id: 'contact',
    title: 'Contact',
    iconId: 'contact',
  },
};

export const desktopAppByIcon: Partial<Record<DesktopIconId, DesktopAppId>> = {
  github: 'github',
  velog: 'velog',
  contact: 'contact',
};
