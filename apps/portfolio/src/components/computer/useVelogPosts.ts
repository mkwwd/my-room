'use client';

import { useEffect, useState } from 'react';

export const VELOG_PROFILE_URL = 'https://velog.io/@mkwhwkdud';

export type VelogPost = {
  id: string;
  title: string;
  link: string;
  description: string;
  thumbnail: string | null;
  publishedAt: string;
};

export default function useVelogPosts() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [posts, setPosts] = useState<VelogPost[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPosts() {
      try {
        const response = await fetch('/api/velog', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load Velog posts');
        const data = (await response.json()) as { posts: VelogPost[] };
        setPosts(data.posts);
        setStatus('ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('error');
      }
    }

    void loadPosts();
    return () => controller.abort();
  }, []);

  return { status, posts };
}
