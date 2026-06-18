'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import Image from 'next/image';

const DESKTOP_UI_WIDTH = 1120;
const DESKTOP_UI_HEIGHT = 630;
const DESKTOP_TASKBAR_HEIGHT = 40;
const DESKTOP_GRID_SIZE = 72;
const DESKTOP_ICON_STORAGE_KEY = 'my-room.desktop-icon-positions.v4';

type DesktopIconId = 'github' | 'project' | 'contact';
type DesktopAppId = 'github';

type DesktopIconPosition = {
  x: number;
  y: number;
};

type DesktopIcon = {
  id: DesktopIconId;
  label: string;
  fallbackText: string;
  fallbackTone: string;
  image?: {
    src: string;
    alt: string;
  };
};

type DesktopApp = {
  id: DesktopAppId;
  title: string;
  iconId: DesktopIconId;
};

type GithubLoadStatus = 'loading' | 'ready' | 'error';

type GithubProfile = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  location: string | null;
};

type GithubRepo = {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  fork: boolean;
};

export type ScreenBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  clipPath: string;
  visible: boolean;
};

const desktopIcons: DesktopIcon[] = [
  {
    id: 'github',
    label: 'Github',
    fallbackText: 'GH',
    fallbackTone: 'bg-[#232225] text-white',
  },
  {
    id: 'project',
    label: 'Project',
    fallbackText: 'P',
    fallbackTone: 'bg-[#f09a29] text-[#17110e]',
  },
  {
    id: 'contact',
    label: 'Contact',
    fallbackText: 'C',
    fallbackTone: 'bg-[#55c6f2] text-[#17110e]',
  },
];

const defaultDesktopIconPositions: Record<DesktopIconId, DesktopIconPosition> =
  {
    github: { x: 26, y: 24 },
    project: { x: 26, y: 96 },
    contact: { x: 26, y: 168 },
  };

const desktopApps: Record<DesktopAppId, DesktopApp> = {
  github: {
    id: 'github',
    title: 'Github',
    iconId: 'github',
  },
};

const desktopAppByIcon: Partial<Record<DesktopIconId, DesktopAppId>> = {
  github: 'github',
};

const GITHUB_USERNAME = 'mkwwd';
const GITHUB_PROFILE_URL = `https://github.com/${GITHUB_USERNAME}`;

const fallbackGithubProfile: GithubProfile = {
  login: GITHUB_USERNAME,
  name: GITHUB_USERNAME,
  avatar_url: '',
  html_url: GITHUB_PROFILE_URL,
  bio: 'Frontend developer building an explorable 3D portfolio room.',
  public_repos: 0,
  followers: 0,
  following: 0,
  location: null,
};

const fallbackGithubRepos: GithubRepo[] = [
  {
    id: 1,
    name: 'my-room',
    html_url: `${GITHUB_PROFILE_URL}/my-room`,
    description: 'Explorable 3D portfolio room with a desktop interaction hub.',
    language: 'TypeScript',
    stargazers_count: 0,
    forks_count: 0,
    updated_at: '2026-06-17T00:00:00.000Z',
    fork: false,
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapDesktopIconPosition(
  position: DesktopIconPosition,
  bounds: { width: number; height: number },
) {
  const maxX = Math.max(bounds.width - 58, 0);
  const maxY = Math.max(bounds.height - DESKTOP_TASKBAR_HEIGHT - 74, 0);

  return {
    x: clamp(
      Math.round(position.x / DESKTOP_GRID_SIZE) * DESKTOP_GRID_SIZE + 26,
      14,
      maxX,
    ),
    y: clamp(
      Math.round((position.y - 24) / DESKTOP_GRID_SIZE) * DESKTOP_GRID_SIZE +
        24,
      14,
      maxY,
    ),
  };
}

function getStoredIconPositions() {
  if (typeof window === 'undefined') return defaultDesktopIconPositions;

  try {
    const savedPositions = window.localStorage.getItem(
      DESKTOP_ICON_STORAGE_KEY,
    );
    if (!savedPositions) return defaultDesktopIconPositions;

    const parsedPositions = JSON.parse(savedPositions) as Partial<
      Record<DesktopIconId, DesktopIconPosition>
    >;

    return desktopIcons.reduce<Record<DesktopIconId, DesktopIconPosition>>(
      (positions, icon) => {
        const savedPosition = parsedPositions[icon.id];
        positions[icon.id] =
          typeof savedPosition?.x === 'number' &&
          typeof savedPosition?.y === 'number'
            ? savedPosition
            : defaultDesktopIconPositions[icon.id];
        return positions;
      },
      { ...defaultDesktopIconPositions },
    );
  } catch {
    return defaultDesktopIconPositions;
  }
}

function DesktopIconGraphic({
  icon,
  size = 'desktop',
}: {
  icon: DesktopIcon;
  size?: 'desktop' | 'taskbar';
}) {
  const iconSize = size === 'desktop' ? 32 : 24;
  const sizeClass = size === 'desktop' ? 'h-8 w-8' : 'h-6 w-6';
  const textSizeClass = size === 'desktop' ? 'text-[10px]' : 'text-[9px]';

  if (icon.image) {
    return (
      <Image
        src={icon.image.src}
        alt={icon.image.alt}
        width={iconSize}
        height={iconSize}
        className={`${sizeClass} object-contain [image-rendering:pixelated]`}
        draggable={false}
      />
    );
  }

  return (
    <span
      className={`grid ${sizeClass} place-items-center rounded-sm border-2 border-black/35 ${icon.fallbackTone} ${textSizeClass} shadow-[inset_0_-3px_rgba(0,0,0,0.16),0_3px_8px_rgba(36,18,38,0.2)]`}>
      {icon.fallbackText}
    </span>
  );
}

function formatGithubDate(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return 'Recently updated';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function GithubWindow({
  isActive,
  onActivate,
  onClose,
}: {
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const githubIcon = desktopIcons.find((icon) => icon.id === 'github');
  const [githubStatus, setGithubStatus] = useState<GithubLoadStatus>('loading');
  const [githubProfile, setGithubProfile] = useState<GithubProfile>(
    fallbackGithubProfile,
  );
  const [githubRepos, setGithubRepos] =
    useState<GithubRepo[]>(fallbackGithubRepos);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGithubProfile() {
      setGithubStatus('loading');

      try {
        const [profileResponse, reposResponse] = await Promise.all([
          fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, {
            signal: controller.signal,
          }),
          fetch(
            `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=6`,
            { signal: controller.signal },
          ),
        ]);

        if (!profileResponse.ok || !reposResponse.ok) {
          throw new Error('GitHub profile request failed');
        }

        const profile = (await profileResponse.json()) as GithubProfile;
        const repos = (await reposResponse.json()) as GithubRepo[];

        setGithubProfile(profile);
        setGithubRepos(repos.filter((repo) => !repo.fork).slice(0, 6));
        setGithubStatus('ready');
      } catch {
        if (!controller.signal.aborted) {
          setGithubProfile(fallbackGithubProfile);
          setGithubRepos(fallbackGithubRepos);
          setGithubStatus('error');
        }
      }
    }

    void loadGithubProfile();

    return () => {
      controller.abort();
    };
  }, []);

  const profileName = githubProfile.name ?? githubProfile.login;
  const visibleRepos =
    githubRepos.length > 0 ? githubRepos : fallbackGithubRepos;

  return (
    <article
      className={`absolute top-[44px] left-[150px] z-[2] h-[500px] w-[850px] overflow-hidden rounded-sm border-2 ${
        isActive
          ? 'border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.38)]'
          : 'border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.24)]'
      } bg-[#ffffff] text-[#24292f]`}
      onPointerDown={onActivate}
      aria-label="Github profile window">
      <div className="flex h-9 items-center justify-between border-b-2 border-[#1f1a20] bg-[#211b26] px-3 text-white">
        <div className="flex items-center gap-2 text-sm font-black">
          {githubIcon ? (
            <DesktopIconGraphic icon={githubIcon} size="taskbar" />
          ) : null}
          <span>Github</span>
        </div>
        <button
          type="button"
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-sm border border-white/35 bg-[#5b405c] text-sm leading-none font-black text-white transition-colors duration-200 hover:bg-[#7e557e] focus-visible:bg-[#7e557e]"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Close Github window">
          x
        </button>
      </div>

      <div className="flex h-8 items-center gap-2 border-b border-[#d0d7de] bg-[#f6f8fa] px-3 text-xs font-bold text-[#57606a]">
        <span className="rounded-sm bg-[#fffaf0] px-2 py-1 shadow-[inset_0_-1px_rgba(0,0,0,0.12)]">
          {GITHUB_PROFILE_URL}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black ${
            githubStatus === 'ready'
              ? 'bg-[#ddf4ff] text-[#0969da]'
              : githubStatus === 'loading'
                ? 'bg-[#fff8c5] text-[#7d4e00]'
                : 'bg-[#ffebe9] text-[#cf222e]'
          }`}>
          {githubStatus === 'ready'
            ? 'LIVE'
            : githubStatus === 'loading'
              ? 'LOADING'
              : 'OFFLINE FALLBACK'}
        </span>
      </div>

      <div className="flex h-12 items-center gap-4 border-b border-[#d0d7de] bg-[#24292f] px-5 text-sm font-bold text-white">
        <span className="text-lg font-black">GitHub</span>
        <span className="w-48 rounded-md border border-white/20 bg-[#0d1117] px-3 py-1.5 text-xs text-white/58">
          Search or jump to...
        </span>
        <span>Pull requests</span>
        <span>Issues</span>
        <span>Codespaces</span>
      </div>

      <div className="grid h-[calc(100%-116px)] grid-cols-[250px_1fr] overflow-hidden bg-white">
        <aside className="border-r border-[#d0d7de] bg-white p-5">
          <div
            className="grid h-36 w-36 place-items-center rounded-full border border-[#d0d7de] bg-[#24292f] bg-cover bg-center text-4xl font-black text-white shadow-[0_8px_20px_rgba(27,31,36,0.16)]"
            style={{
              backgroundImage: githubProfile.avatar_url
                ? `url("${githubProfile.avatar_url}")`
                : undefined,
            }}>
            {githubProfile.avatar_url ? null : 'GH'}
          </div>
          <h2 className="mt-4 text-2xl leading-tight font-bold">
            {profileName}
          </h2>
          <p className="text-lg leading-tight text-[#57606a]">
            {githubProfile.login}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#24292f]">
            {githubProfile.bio ?? 'No profile bio yet.'}
          </p>
          {githubProfile.location ? (
            <p className="mt-3 text-xs font-bold text-[#57606a]">
              Location: {githubProfile.location}
            </p>
          ) : null}
          <p className="mt-3 text-xs font-bold text-[#57606a]">
            {githubProfile.followers} followers / {githubProfile.following}{' '}
            following
          </p>
          <p className="mt-1 text-xs font-bold text-[#57606a]">
            {githubProfile.public_repos} public repositories
          </p>
          <a
            href={githubProfile.html_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full cursor-pointer justify-center rounded-md border border-[#d0d7de] bg-[#f6f8fa] px-3 py-2 text-sm font-bold text-[#24292f] transition-colors duration-200 hover:bg-[#f3f4f6] focus-visible:bg-[#f3f4f6]">
            View on GitHub
          </a>
        </aside>

        <section className="overflow-y-auto bg-white">
          <div className="flex h-12 items-end gap-6 border-b border-[#d0d7de] px-5 text-sm font-bold text-[#57606a]">
            <span className="border-b-2 border-[#fd8c73] px-1 pb-3 text-[#24292f]">
              Overview
            </span>
            <span className="px-1 pb-3">
              Repositories
              <span className="ml-1 rounded-full bg-[#afb8c133] px-2 py-0.5 text-xs">
                {githubProfile.public_repos}
              </span>
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-base font-bold">Popular repositories</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {visibleRepos.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[116px] cursor-pointer rounded-md border border-[#d0d7de] bg-white p-4 transition-colors duration-200 hover:bg-[#f6f8fa] focus-visible:bg-[#f6f8fa]">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-bold text-[#0969da]">
                      {repo.name}
                    </h4>
                    <span className="rounded-full border border-[#d0d7de] px-2 py-0.5 text-[10px] font-bold text-[#57606a]">
                      Public
                    </span>
                  </div>
                  <p className="mt-2 max-h-9 overflow-hidden text-xs leading-relaxed text-[#57606a]">
                    {repo.description ?? 'No description provided.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-[#57606a]">
                    {repo.language ? (
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#3178c6]" />
                        {repo.language}
                      </span>
                    ) : null}
                    <span>Stars {repo.stargazers_count}</span>
                    <span>Forks {repo.forks_count}</span>
                    <span>{formatGithubDate(repo.updated_at)}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

export default function ComputerDesktop({
  bounds,
  isFocused,
  onClose,
}: {
  bounds: ScreenBounds;
  isFocused: boolean;
  onClose: () => void;
}) {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const iconPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragIconRef = useRef(false);
  const [iconPositions, setIconPositions] = useState<
    Record<DesktopIconId, DesktopIconPosition>
  >(getStoredIconPositions);
  const [draggingIcon, setDraggingIcon] = useState<{
    id: DesktopIconId;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [openApps, setOpenApps] = useState<DesktopAppId[]>([]);
  const [activeApp, setActiveApp] = useState<DesktopAppId | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      DESKTOP_ICON_STORAGE_KEY,
      JSON.stringify(iconPositions),
    );
  }, [iconPositions]);

  const updateIconPosition = (
    iconId: DesktopIconId,
    nextPosition: DesktopIconPosition,
    shouldSnap = false,
  ) => {
    const boundedPosition = {
      x: clamp(nextPosition.x, 14, DESKTOP_UI_WIDTH - 58),
      y: clamp(
        nextPosition.y,
        14,
        DESKTOP_UI_HEIGHT - DESKTOP_TASKBAR_HEIGHT - 80,
      ),
    };
    const finalPosition = shouldSnap
      ? snapDesktopIconPosition(boundedPosition, {
          width: DESKTOP_UI_WIDTH,
          height: DESKTOP_UI_HEIGHT,
        })
      : boundedPosition;

    setIconPositions((positions) => ({
      ...positions,
      [iconId]: finalPosition,
    }));
  };

  const openApp = (iconId: DesktopIconId) => {
    const appId = desktopAppByIcon[iconId];
    if (!appId) return;

    setOpenApps((apps) => (apps.includes(appId) ? apps : [...apps, appId]));
    setActiveApp(appId);
  };

  const closeApp = (appId: DesktopAppId) => {
    setOpenApps((apps) => apps.filter((openAppId) => openAppId !== appId));
    setActiveApp((currentApp) => (currentApp === appId ? null : currentApp));
  };

  const startIconDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    const desktop = desktopRef.current;
    if (!desktop) return;

    const desktopBounds = desktop.getBoundingClientRect();
    const iconPosition = iconPositions[iconId];
    const scaleX = desktopBounds.width / DESKTOP_UI_WIDTH;
    const scaleY = desktopBounds.height / DESKTOP_UI_HEIGHT;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    iconPointerStartRef.current = { x: event.clientX, y: event.clientY };
    didDragIconRef.current = false;
    setDraggingIcon({
      id: iconId,
      offsetX:
        (event.clientX - desktopBounds.left) / Math.max(scaleX, 0.001) -
        iconPosition.x,
      offsetY:
        (event.clientY - desktopBounds.top) / Math.max(scaleY, 0.001) -
        iconPosition.y,
    });
  };

  const moveIcon = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    if (!draggingIcon || draggingIcon.id !== iconId) return;

    const desktop = desktopRef.current;
    if (!desktop) return;

    const desktopBounds = desktop.getBoundingClientRect();
    const scaleX = desktopBounds.width / DESKTOP_UI_WIDTH;
    const scaleY = desktopBounds.height / DESKTOP_UI_HEIGHT;
    const pointerStart = iconPointerStartRef.current;
    if (
      pointerStart &&
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 4
    ) {
      didDragIconRef.current = true;
    }

    updateIconPosition(iconId, {
      x:
        (event.clientX - desktopBounds.left) / Math.max(scaleX, 0.001) -
        draggingIcon.offsetX,
      y:
        (event.clientY - desktopBounds.top) / Math.max(scaleY, 0.001) -
        draggingIcon.offsetY,
    });
  };

  const stopIconDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    if (!draggingIcon || draggingIcon.id !== iconId) return;

    const shouldOpenApp = !didDragIconRef.current;
    const desktop = desktopRef.current;
    if (desktop) {
      const desktopBounds = desktop.getBoundingClientRect();
      const scaleX = desktopBounds.width / DESKTOP_UI_WIDTH;
      const scaleY = desktopBounds.height / DESKTOP_UI_HEIGHT;
      updateIconPosition(
        iconId,
        {
          x:
            (event.clientX - desktopBounds.left) / Math.max(scaleX, 0.001) -
            draggingIcon.offsetX,
          y:
            (event.clientY - desktopBounds.top) / Math.max(scaleY, 0.001) -
            draggingIcon.offsetY,
        },
        true,
      );
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    iconPointerStartRef.current = null;
    didDragIconRef.current = false;
    setDraggingIcon(null);

    if (shouldOpenApp) {
      openApp(iconId);
    }
  };

  if (!bounds.visible) return null;

  const scaleX = bounds.width / DESKTOP_UI_WIDTH;
  const scaleY = bounds.height / DESKTOP_UI_HEIGHT;

  return (
    <section
      className={`absolute z-[6] ${
        isFocused ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        width: `${DESKTOP_UI_WIDTH}px`,
        height: `${DESKTOP_UI_HEIGHT}px`,
        clipPath: bounds.clipPath,
        transform: `scale(${scaleX}, ${scaleY})`,
        transformOrigin: 'top left',
      }}
      aria-label="Focused computer desktop">
      <div
        className="relative h-full w-full overflow-hidden bg-[#ad63ad]"
        ref={desktopRef}>
        {isFocused ? (
          <button
            type="button"
            className="absolute top-3 right-3 z-[4] grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-white/70 bg-[#191319]/72 text-base leading-none font-black text-white shadow-[0_10px_26px_rgba(20,12,8,0.3)] transition-colors duration-200 hover:bg-[#3f2a3f] focus-visible:bg-[#3f2a3f]"
            onClick={onClose}
            aria-label="Close computer desktop">
            x
          </button>
        ) : null}

        <div className="absolute inset-x-0 top-0 bottom-10 overflow-hidden bg-[#ad63ad]">
          {desktopIcons.map((icon) => {
            const iconPosition = iconPositions[icon.id];
            const isDragging = draggingIcon?.id === icon.id;

            return (
              <button
                key={icon.id}
                type="button"
                className={`absolute grid w-[58px] cursor-grab justify-items-center gap-1 rounded-md p-1 text-center text-[11px] leading-tight font-black text-white [text-shadow:0_1px_4px_rgba(35,22,35,0.65)] transition-[filter,transform] duration-150 hover:bg-white/10 focus-visible:bg-white/14 ${
                  isDragging ? 'z-[3] scale-105 cursor-grabbing' : 'z-[1]'
                }`}
                style={{
                  left: `${iconPosition.x}px`,
                  top: `${iconPosition.y}px`,
                  touchAction: 'none',
                }}
                onPointerDown={(event) => startIconDrag(event, icon.id)}
                onPointerMove={(event) => moveIcon(event, icon.id)}
                onPointerUp={(event) => stopIconDrag(event, icon.id)}
                onPointerCancel={(event) => stopIconDrag(event, icon.id)}
                aria-label={`${icon.label} desktop icon`}>
                <DesktopIconGraphic icon={icon} />
                <span>{icon.label}</span>
              </button>
            );
          })}

          {openApps.includes('github') ? (
            <GithubWindow
              isActive={activeApp === 'github'}
              onActivate={() => setActiveApp('github')}
              onClose={() => closeApp('github')}
            />
          ) : null}
        </div>

        <div className="absolute right-0 bottom-0 left-0 flex h-10 items-center justify-between border-t border-black/24 bg-[linear-gradient(180deg,rgba(35,56,62,0.96),rgba(18,31,37,0.98))] px-4 text-white/88 shadow-[0_-8px_20px_rgba(13,22,28,0.2)]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center text-white transition-opacity duration-200 hover:opacity-75"
              aria-label="Start menu">
              <span className="grid grid-cols-2 gap-[2px]">
                <span className="h-[9px] w-[9px] bg-white" />
                <span className="h-[9px] w-[9px] bg-white" />
                <span className="h-[9px] w-[9px] bg-white" />
                <span className="h-[9px] w-[9px] bg-white" />
              </span>
            </button>
            <div className="flex min-w-0 items-center gap-1">
              {openApps.map((appId) => {
                const app = desktopApps[appId];
                const icon = desktopIcons.find(
                  (desktopIcon) => desktopIcon.id === app.iconId,
                );
                const isActive = activeApp === appId;

                return (
                  <button
                    key={app.id}
                    type="button"
                    className={`relative flex h-9 min-w-[120px] cursor-pointer items-center gap-2 rounded-sm px-2 text-xs font-black transition-colors duration-200 ${
                      isActive
                        ? 'bg-white/16 text-white'
                        : 'bg-white/6 text-white/78 hover:bg-white/12 hover:text-white'
                    }`}
                    onClick={() => setActiveApp(appId)}
                    aria-label={`${app.title} taskbar button`}>
                    {icon ? (
                      <DesktopIconGraphic icon={icon} size="taskbar" />
                    ) : null}
                    <span className="truncate">{app.title}</span>
                    <span
                      className={`absolute right-2 bottom-0 left-2 h-[3px] rounded-full transition-colors duration-200 ${
                        isActive ? 'bg-[#7fd4ff]' : 'bg-white/24'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4 text-white/78">
            <span className="text-sm leading-none">^</span>
            <span className="h-2 w-4 rounded-[2px] border border-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
            <span className="text-xs leading-none">)))</span>
            <div className="grid min-w-18 justify-items-end text-[10px] leading-tight font-bold">
              <span>15:19</span>
              <span>2026-06-17</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
