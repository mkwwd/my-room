'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useState } from 'react';

import CalendarWindow from './CalendarWindow';
import ContactWindow from './ContactWindow';
import {
  desktopAppByIcon,
  desktopIcons,
  type DesktopAppId,
  type DesktopIconId,
} from './desktopConfig';
import DesktopIcon from './DesktopIcon';
import DesktopTaskbar from './DesktopTaskbar';
import GalleryWindow from './GalleryWindow';
import GithubWindow from './GithubWindow';
import useDesktopIcons from './useDesktopIcons';
import VelogWindow from './VelogWindow';

export default function ComputerDesktop({ isFocused }: { isFocused: boolean }) {
  const [openApps, setOpenApps] = useState<DesktopAppId[]>([]);
  const [activeApp, setActiveApp] = useState<DesktopAppId | null>(null);
  const [minimizedApps, setMinimizedApps] = useState<DesktopAppId[]>([]);
  const [maximizedApps, setMaximizedApps] = useState<DesktopAppId[]>([]);
  const {
    desktopRef,
    iconPositions,
    draggingIcon,
    startIconDrag,
    moveIcon,
    stopIconDrag,
  } = useDesktopIcons();

  const openApp = (iconId: DesktopIconId) => {
    const appId = desktopAppByIcon[iconId];
    if (!appId) return;

    setOpenApps((apps) => (apps.includes(appId) ? apps : [...apps, appId]));
    setMinimizedApps((apps) => apps.filter((id) => id !== appId));
    setActiveApp(appId);
  };

  const activateApp = (appId: DesktopAppId) => {
    setMinimizedApps((apps) => apps.filter((id) => id !== appId));
    setActiveApp(appId);
  };

  const minimizeApp = (appId: DesktopAppId) => {
    setMinimizedApps((apps) =>
      apps.includes(appId) ? apps : [...apps, appId],
    );
    setActiveApp((currentApp) => (currentApp === appId ? null : currentApp));
  };

  const toggleMaximizeApp = (appId: DesktopAppId) => {
    setMaximizedApps((apps) =>
      apps.includes(appId)
        ? apps.filter((id) => id !== appId)
        : [...apps, appId],
    );
    setActiveApp(appId);
  };

  const closeApp = (appId: DesktopAppId) => {
    setOpenApps((apps) => apps.filter((openAppId) => openAppId !== appId));
    setMinimizedApps((apps) => apps.filter((id) => id !== appId));
    setMaximizedApps((apps) => apps.filter((id) => id !== appId));
    setActiveApp((currentApp) => (currentApp === appId ? null : currentApp));
  };

  const finishIconInteraction = (
    event: ReactPointerEvent<HTMLButtonElement>,
    iconId: DesktopIconId,
  ) => {
    if (stopIconDrag(event, iconId)) {
      openApp(iconId);
    }
  };

  return (
    <section
      className={`relative h-[630px] w-[1120px] overflow-hidden ${
        isFocused ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      aria-label="Focused computer desktop">
      <div
        className="relative h-full w-full overflow-hidden bg-[#131215]"
        ref={desktopRef}>
        <div className="absolute inset-x-0 top-0 bottom-10 overflow-hidden bg-[#131215]">
          {desktopIcons.map((icon) => (
            <DesktopIcon
              key={icon.id}
              icon={icon}
              position={iconPositions[icon.id]}
              isDragging={draggingIcon?.id === icon.id}
              onPointerDown={startIconDrag}
              onPointerMove={moveIcon}
              onPointerUp={finishIconInteraction}
            />
          ))}

          {openApps.includes('github') && !minimizedApps.includes('github') ? (
            <GithubWindow
              isActive={activeApp === 'github'}
              isMaximized={maximizedApps.includes('github')}
              onActivate={() => setActiveApp('github')}
              onMinimize={() => minimizeApp('github')}
              onToggleMaximize={() => toggleMaximizeApp('github')}
              onClose={() => closeApp('github')}
            />
          ) : null}

          {openApps.includes('contact') &&
          !minimizedApps.includes('contact') ? (
            <ContactWindow
              isActive={activeApp === 'contact'}
              isMaximized={maximizedApps.includes('contact')}
              onActivate={() => setActiveApp('contact')}
              onMinimize={() => minimizeApp('contact')}
              onToggleMaximize={() => toggleMaximizeApp('contact')}
              onClose={() => closeApp('contact')}
            />
          ) : null}

          {openApps.includes('velog') && !minimizedApps.includes('velog') ? (
            <VelogWindow
              isActive={activeApp === 'velog'}
              isMaximized={maximizedApps.includes('velog')}
              onActivate={() => setActiveApp('velog')}
              onMinimize={() => minimizeApp('velog')}
              onToggleMaximize={() => toggleMaximizeApp('velog')}
              onClose={() => closeApp('velog')}
            />
          ) : null}

          {openApps.includes('calendar') &&
          !minimizedApps.includes('calendar') ? (
            <CalendarWindow
              isActive={activeApp === 'calendar'}
              isMaximized={maximizedApps.includes('calendar')}
              onActivate={() => setActiveApp('calendar')}
              onMinimize={() => minimizeApp('calendar')}
              onToggleMaximize={() => toggleMaximizeApp('calendar')}
              onClose={() => closeApp('calendar')}
            />
          ) : null}
          {openApps.includes('gallery') &&
          !minimizedApps.includes('gallery') ? (
            <GalleryWindow
              isActive={activeApp === 'gallery'}
              isMaximized={maximizedApps.includes('gallery')}
              onActivate={() => setActiveApp('gallery')}
              onMinimize={() => minimizeApp('gallery')}
              onToggleMaximize={() => toggleMaximizeApp('gallery')}
              onClose={() => closeApp('gallery')}
            />
          ) : null}
        </div>

        <DesktopTaskbar
          openApps={openApps}
          activeApp={activeApp}
          onActivateApp={activateApp}
        />
      </div>
    </section>
  );
}
