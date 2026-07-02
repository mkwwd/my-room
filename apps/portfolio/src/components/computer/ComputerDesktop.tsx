'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useState } from 'react';

import {
  desktopAppByIcon,
  desktopIcons,
  type DesktopAppId,
  type DesktopIconId,
} from './desktopConfig';
import ContactWindow from './ContactWindow';
import DesktopIcon from './DesktopIcon';
import DesktopTaskbar from './DesktopTaskbar';
import GithubWindow from './GithubWindow';
import useDesktopIcons from './useDesktopIcons';
import VelogWindow from './VelogWindow';

export default function ComputerDesktop({
  isFocused,
  onClose,
}: {
  isFocused: boolean;
  onClose: () => void;
}) {
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
        {isFocused ? (
          <button
            type="button"
            className="absolute top-3 right-3 z-[5] grid h-8 w-8 cursor-pointer place-items-center rounded-full border-2 border-white/70 bg-[#191319]/72 text-base leading-none font-black text-white shadow-[0_10px_26px_rgba(20,12,8,0.3)] transition-colors duration-200 hover:bg-[#3f2a3f] focus-visible:bg-[#3f2a3f]"
            onClick={onClose}
            aria-label="Close computer desktop">
            x
          </button>
        ) : null}
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

          {openApps.includes('contact') && !minimizedApps.includes('contact') ? (
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
