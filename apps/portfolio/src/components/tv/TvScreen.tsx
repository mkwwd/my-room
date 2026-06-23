'use client';

import { useState } from 'react';

import type { TvIconConfig, TvIconId } from './tvConfig';
import { tvIcons } from './tvConfig';
import YouTubeWindow from './YouTubeWindow';

function YouTubeAppIcon() {
  return (
    <svg className="h-auto w-[70px]" viewBox="0 0 120 84" aria-hidden="true">
      <rect x="0" y="6" width="120" height="72" rx="18" fill="#ff0033" />
      <path d="M49 26L84 42L49 62V26Z" fill="#ffffff" />
    </svg>
  );
}

function TvAppIcon({ icon }: { icon: TvIconConfig }) {
  if (icon.id === 'youtube') {
    return (
      <div className="grid size-[104px] place-items-center rounded-[30px] bg-white shadow-[0_16px_32px_rgba(0,0,0,0.35)] transition-colors duration-200 group-hover:bg-[#fff4f4] group-focus-visible:bg-[#fff4f4]">
        <YouTubeAppIcon />
      </div>
    );
  }

  return (
    <div className="grid size-[104px] place-items-center rounded-[30px] bg-white/12 text-4xl font-black text-white shadow-[0_16px_32px_rgba(0,0,0,0.35)]">
      {icon.label.slice(0, 1)}
    </div>
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
      className="relative h-full w-full overflow-hidden bg-[#070b12] px-12 py-11 text-white"
      aria-label="TV app launcher">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(49,86,142,0.22),transparent_34%),linear-gradient(135deg,#080d16,#020306_72%)]" />
      <div className="pointer-events-none absolute inset-5 border border-white/8" />

      <div className="relative z-[1] grid grid-cols-[repeat(auto-fill,132px)] auto-rows-[156px] justify-start gap-x-9 gap-y-12">
        {tvIcons.map((icon) => (
          <button
            key={icon.id}
            type="button"
            onClick={() => openApp(icon.id)}
            className="group flex w-[132px] cursor-pointer flex-col items-center gap-3 text-center transition-transform duration-200 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
            aria-label={`Open ${icon.label}`}>
            <TvAppIcon icon={icon} />
            <span className="max-w-[132px] text-[26px] leading-tight font-medium tracking-normal text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
              {icon.label}
            </span>
          </button>
        ))}
      </div>

      {activeApp === 'youtube' && <YouTubeWindow onClose={closeApp} />}
    </section>
  );
}
