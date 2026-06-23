'use client';

import { useState } from 'react';

import { Plus, Search, X } from 'lucide-react';

import type { YoutubeProfile } from './tvConfig';
import YouTubeSearch from './YouTubeSearch';

type YouTubeWindowProps = {
  onClose: () => void;
};

type YouTubePanel = 'search' | 'profile';

const profiles: YoutubeProfile[] = [
  {
    id: 'judy',
    name: 'Judy',
    type: 'initial',
    value: 'J',
    background: 'linear-gradient(135deg, #ff9f1c, #ff7a00)',
  },
  {
    id: 'min',
    name: 'Min',
    type: 'initial',
    value: 'M',
    background: 'linear-gradient(135deg, #ff4fb8, #ff0f8a)',
  },
];

function ProfileAvatar({
  profile,
  size = 'large',
}: {
  profile: YoutubeProfile;
  size?: 'small' | 'large';
}) {
  const sizeClass = size === 'small' ? 'size-10 text-xl' : 'size-50 text-7xl';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${sizeClass}`}
      style={{ background: profile.background }}>
      {profile.type === 'emoji' ? (
        <span className="translate-y-1">{profile.value}</span>
      ) : (
        <span>{profile.value}</span>
      )}
    </div>
  );
}

export default function YouTubeWindow({ onClose }: YouTubeWindowProps) {
  const [activePanel, setActivePanel] = useState<YouTubePanel>('search');
  const [selectedProfile, setSelectedProfile] = useState<YoutubeProfile>(
    profiles[0],
  );

  const selectProfile = (profile: YoutubeProfile) => {
    setSelectedProfile(profile);
  };

  return (
    <div className="absolute inset-0 z-30 flex overflow-hidden bg-[#111] text-white">
      <aside className="flex w-16 shrink-0 flex-col items-center gap-5 bg-[#0b0b0b] py-5">
        <button
          type="button"
          onClick={() => setActivePanel('profile')}
          className="flex cursor-pointer flex-col items-center gap-1"
          aria-label="Open profile panel">
          <div
            className={`rounded-full p-1 transition ${
              activePanel === 'profile' ? 'bg-white' : 'bg-transparent'
            }`}>
            <ProfileAvatar profile={selectedProfile} size="small" />
          </div>

          <span className="max-w-14 truncate text-[11px] text-white/80">
            {selectedProfile.name}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActivePanel('search')}
          className={`flex size-10 cursor-pointer items-center justify-center rounded-full transition ${
            activePanel === 'search'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          aria-label="Open search panel">
          <Search size={20} />
        </button>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-hidden bg-[#121212] px-8 py-5">
        <div className="absolute top-5 right-8 z-10 flex items-center gap-3">
          <div className="flex h-5 w-8 items-center justify-center rounded bg-[#ff0033]">
            <div className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
          </div>
          <span className="text-sm font-bold">YouTube</span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close YouTube window">
            <X size={18} />
          </button>
        </div>

        {activePanel === 'search' && <YouTubeSearch />}

        {activePanel === 'profile' && (
          <section className="flex h-full flex-col items-center justify-center gap-15">
            <div className="flex items-start gap-16">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => selectProfile(profile)}
                  className="flex cursor-pointer flex-col items-center gap-5 text-center">
                  <div
                    className={`rounded-full p-1 transition ${
                      selectedProfile.id === profile.id
                        ? 'bg-white'
                        : 'bg-transparent hover:bg-white/30'
                    }`}>
                    <ProfileAvatar profile={profile} />
                  </div>

                  <span className="text-2xl font-semibold text-white">
                    {profile.name}
                  </span>
                </button>
              ))}

              <button
                type="button"
                className="flex flex-col items-center gap-5 text-center">
                <div className="flex size-50 items-center justify-center rounded-full bg-[#f2f4f8] text-[#111]">
                  <Plus size={70} strokeWidth={1.6} />
                </div>

                <span className="text-2xl font-semibold text-white">
                  Add account
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close YouTube window"
              className="cursor-pointer rounded-full bg-[#333] px-10 py-5 text-left text-2xl text-white/90 transition hover:bg-[#454545]">
              Exit
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
