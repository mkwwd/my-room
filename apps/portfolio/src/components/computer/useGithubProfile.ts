'use client';

import { useEffect, useState } from 'react';

export type GithubLoadStatus = 'loading' | 'ready' | 'error';

export type GithubProfile = {
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

export type GithubRepo = {
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

const GITHUB_USERNAME = 'mkwwd';
export const GITHUB_PROFILE_URL = `https://github.com/${GITHUB_USERNAME}`;

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

export default function useGithubProfile() {
  const [status, setStatus] = useState<GithubLoadStatus>('loading');
  const [profile, setProfile] = useState<GithubProfile>(fallbackGithubProfile);
  const [repos, setRepos] = useState<GithubRepo[]>(fallbackGithubRepos);

  useEffect(() => {
    const controller = new AbortController();

    async function loadGithubProfile() {
      setStatus('loading');

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

        const nextProfile = (await profileResponse.json()) as GithubProfile;
        const nextRepos = (await reposResponse.json()) as GithubRepo[];

        setProfile(nextProfile);
        setRepos(nextRepos.filter((repo) => !repo.fork).slice(0, 6));
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted) {
          setProfile(fallbackGithubProfile);
          setRepos(fallbackGithubRepos);
          setStatus('error');
        }
      }
    }

    void loadGithubProfile();

    return () => {
      controller.abort();
    };
  }, []);

  return {
    status,
    profile,
    repos: repos.length > 0 ? repos : fallbackGithubRepos,
  };
}
