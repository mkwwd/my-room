'use client';

import { desktopIcons } from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';
import useGithubProfile, { GITHUB_PROFILE_URL } from './useGithubProfile';

function formatGithubDate(updatedAt: string) {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return 'Recently updated';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function GithubWindow({
  isActive,
  onActivate,
  onClose,
}: {
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const githubIcon = desktopIcons.find((icon) => icon.id === 'github');
  const { status, profile, repos } = useGithubProfile();
  const profileName = profile.name ?? profile.login;

  return (
    <article
      className={`absolute top-[44px] left-[150px] h-[500px] w-[850px] overflow-hidden rounded-sm border-2 ${
        isActive
          ? 'z-[4] border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.38)]'
          : 'z-[2] border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.24)]'
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
            status === 'ready'
              ? 'bg-[#ddf4ff] text-[#0969da]'
              : status === 'loading'
                ? 'bg-[#fff8c5] text-[#7d4e00]'
                : 'bg-[#ffebe9] text-[#cf222e]'
          }`}>
          {status === 'ready'
            ? 'LIVE'
            : status === 'loading'
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
              backgroundImage: profile.avatar_url
                ? `url("${profile.avatar_url}")`
                : undefined,
            }}>
            {profile.avatar_url ? null : 'GH'}
          </div>
          <h2 className="mt-4 text-2xl leading-tight font-bold">
            {profileName}
          </h2>
          <p className="text-lg leading-tight text-[#57606a]">
            {profile.login}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#24292f]">
            {profile.bio ?? 'No profile bio yet.'}
          </p>
          {profile.location ? (
            <p className="mt-3 text-xs font-bold text-[#57606a]">
              Location: {profile.location}
            </p>
          ) : null}
          <p className="mt-3 text-xs font-bold text-[#57606a]">
            {profile.followers} followers / {profile.following} following
          </p>
          <p className="mt-1 text-xs font-bold text-[#57606a]">
            {profile.public_repos} public repositories
          </p>
          <a
            href={profile.html_url}
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
                {profile.public_repos}
              </span>
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-base font-bold">Popular repositories</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {repos.map((repo) => (
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
