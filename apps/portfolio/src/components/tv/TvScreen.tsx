'use client';

import { useState } from 'react';

import type { TvIconId } from './tvConfig';
import { tvIcons } from './tvConfig';
import YouTubeWindow from './YouTubeWindow';

function YouTubeLogo() {
  return (
    <svg
      className="h-auto w-[clamp(180px,30%,300px)]"
      viewBox="0 0 120 84"
      aria-hidden="true">
      <rect x="0" y="6" width="120" height="72" rx="18" fill="#ff0033" />
      <path d="M49 26L84 42L49 62V26Z" fill="#ffffff" />
    </svg>
  );
}

export default function TvScreen() {
  const [activeApp, setActiveApp] = useState<TvIconId | null>(null);

  const openApp = (iconId: TvIconId) => {
    setActiveApp(iconId);
  };

  const closeApp = () => {
    setActiveApp(null);
  };

  return (
    <section
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0f0f0f] text-white"
      aria-label="TV YouTube screen">
      <div className="pointer-events-none absolute inset-5 border border-white/10" />
      {tvIcons.map((icon) => (
        <button
          key={icon.id}
          type="button"
          onClick={() => openApp(icon.id)}
          className="group flex cursor-pointer flex-col items-center gap-7 px-14 py-10 text-center focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-white"
          aria-label={`Open ${icon.label}`}>
          {icon.id === 'youtube' ? <YouTubeLogo /> : null}
          <span className="text-[clamp(54px,8vw,92px)] leading-none font-bold tracking-normal">
            {icon.label}
          </span>
        </button>
      ))}

      {activeApp === 'youtube' && <YouTubeWindow onClose={closeApp} />}
    </section>
  );
}
