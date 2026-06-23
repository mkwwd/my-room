'use client';

import { YOUTUBE_URL } from './tvConfig';

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

type TvScreenProps = {
  isFocused: boolean;
  onClose: () => void;
};

export default function TvScreen({ isFocused, onClose }: TvScreenProps) {
  return (
    <section
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0f0f0f] text-white"
      aria-label="TV YouTube screen">
      <div className="pointer-events-none absolute inset-5 border border-white/10" />

      {isFocused ? (
        <button
          type="button"
          className="absolute top-5 right-5 z-[2] grid h-12 w-12 cursor-pointer place-items-center border border-white/45 bg-black/70 text-2xl leading-none font-bold text-white transition-colors duration-200 hover:bg-[#ff0033] focus-visible:bg-[#ff0033] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          onClick={onClose}
          aria-label="Close TV screen">
          x
        </button>
      ) : null}

      <a
        className="group flex cursor-pointer flex-col items-center gap-7 px-14 py-10 text-center focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-white"
        href={YOUTUBE_URL}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Open YouTube in a new tab">
        <YouTubeLogo />
        <span className="text-[clamp(54px,8vw,92px)] leading-none font-bold tracking-normal">
          YouTube
        </span>
        {isFocused ? (
          <span className="border border-white/30 bg-white/10 px-8 py-3 text-2xl font-semibold transition-colors duration-200 group-hover:border-[#ff0033] group-hover:bg-[#ff0033] group-focus-visible:border-[#ff0033] group-focus-visible:bg-[#ff0033]">
            Open YouTube
          </span>
        ) : null}
      </a>
    </section>
  );
}
