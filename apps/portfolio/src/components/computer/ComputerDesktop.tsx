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

export default function ComputerDesktop({
  isFocused,
}: {
  isFocused: boolean;
}) {
  const [openApps, setOpenApps] = useState<DesktopAppId[]>([]);
  const [activeApp, setActiveApp] = useState<DesktopAppId | null>(null);
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
    setActiveApp(appId);
  };

  const closeApp = (appId: DesktopAppId) => {
    setOpenApps((apps) => apps.filter((openAppId) => openAppId !== appId));
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

          {openApps.includes('github') ? (
            <GithubWindow
              isActive={activeApp === 'github'}
              onActivate={() => setActiveApp('github')}
              onClose={() => closeApp('github')}
            />
          ) : null}

          {openApps.includes('contact') ? (
            <ContactWindow
              isActive={activeApp === 'contact'}
              onActivate={() => setActiveApp('contact')}
              onClose={() => closeApp('contact')}
            />
          ) : null}
        </div>

        <DesktopTaskbar
          openApps={openApps}
          activeApp={activeApp}
          onActivateApp={setActiveApp}
        />
      </div>
    </section>
  );
}
