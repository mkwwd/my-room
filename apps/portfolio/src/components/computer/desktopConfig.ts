export const DESKTOP_UI_WIDTH = 1120;
export const DESKTOP_UI_HEIGHT = 630;
export const DESKTOP_TASKBAR_HEIGHT = 40;
export const DESKTOP_GRID_SIZE = 96;
export const DESKTOP_ICON_STORAGE_KEY = 'my-room.desktop-icon-positions.v5';
export type DesktopIconId =
  | 'github'
  | 'velog'
  | 'project'
  | 'contact'
  | 'calendar'
  | 'gallery';
export type DesktopAppId =
  | 'github'
  | 'velog'
  | 'contact'
  | 'calendar'
  | 'gallery';

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
      src: '/images/logo/git.png',
      alt: 'Github logo',
    },
  },
  {
    id: 'velog',
    label: 'Velog',
    fallbackText: 'V',
    fallbackTone: 'bg-[#20c997] text-white',
    image: {
      src: '/images/logo/velog3.png',
      alt: 'velog icon',
    },
  },
  {
    id: 'project',
    label: 'Project',
    fallbackText: 'P',
    fallbackTone: 'bg-[#f09a29] text-[#17110e]',
    image: {
      src: '/images/logo/project.png',
      alt: 'Project folder icon',
    },
  },
  {
    id: 'contact',
    label: 'Contact',
    fallbackText: 'C',
    fallbackTone: 'bg-[#55c6f2] text-[#17110e]',
    image: {
      src: '/images/logo/mail2.png',
      alt: 'Contact icon',
    },
  },
  {
    id: 'calendar',
    label: 'Calendar',
    fallbackText: '31',
    fallbackTone: 'bg-white text-[#1a73e8]',
  },
  {
    id: 'gallery',
    label: 'Gallery',
    fallbackText: 'G',
    fallbackTone: 'bg-[#9ef2c3] text-[#173329]',
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
  calendar: { x: 26, y: 408 },
  gallery: { x: 122, y: 24 },
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
  calendar: {
    id: 'calendar',
    title: 'Calendar',
    iconId: 'calendar',
  },
  gallery: {
    id: 'gallery',
    title: 'Gallery',
    iconId: 'gallery',
  },
};

export const desktopAppByIcon: Partial<Record<DesktopIconId, DesktopAppId>> = {
  github: 'github',
  velog: 'velog',
  contact: 'contact',
  calendar: 'calendar',
  gallery: 'gallery',
};
