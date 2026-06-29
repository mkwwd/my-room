'use client';

import { useEffect, useRef, useState, type WheelEvent } from 'react';

import * as hangul from 'hangul-js';
import { Expand, Play, Search, X } from 'lucide-react';

import YouTubeKeyboard from './YouTubeKeyboard';

const MAX_SEARCH_HISTORY = 5;
const SEARCH_HISTORY_KEY = 'youtube-search-histories';

type YouTubeVideo = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  viewCount: string;
  duration: string;
};

type KeyboardLayout = 'english' | 'korean' | 'symbol';

function formatViewCount(viewCount: string) {
  const count = Number(viewCount);

  if (Number.isNaN(count)) return '0 views';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;

  return `${count.toLocaleString('en-US')} views`;
}

function formatPublishedAt(publishedAt: string) {
  const publishedDate = new Date(publishedAt);
  const now = new Date();

  const diffMs = now.getTime() - publishedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'today';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;

  return `${Math.floor(diffDays / 365)}y ago`;
}

function YouTubePlayer({ videoId }: { videoId: string }) {
  return (
    <iframe
      className="h-full w-full"
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

export default function YouTubeSearch() {
  const [keyword, setKeyword] = useState('');
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistories, setSearchHistories] = useState<string[]>([]);

  const resultScrollRef = useRef<HTMLDivElement>(null);

  const addKeyword = (key: string, type?: KeyboardLayout) => {
    if (type === 'korean') {
      setKeyword((prev) => {
        const disassembled = hangul.disassemble(prev + key);
        return hangul.assemble(disassembled);
      });
    } else {
      setKeyword((prev) => prev + key);
    }
  };

  const removeLastKeyword = () => {
    setKeyword((prev) => prev.slice(0, -1));
  };

  const clearKeyword = () => {
    setKeyword('');
    setVideos([]);
    setPlayingVideoId(null);
    setExpandedVideoId(null);
  };

  const saveSearchHistory = (searchKeyword: string) => {
    const trimmedKeyword = searchKeyword.trim();

    if (!trimmedKeyword) return;

    setSearchHistories((prev) => {
      const nextHistories = [
        trimmedKeyword,
        ...prev.filter((history) => history !== trimmedKeyword),
      ].slice(0, MAX_SEARCH_HISTORY);

      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistories));

      return nextHistories;
    });
  };

  const searchVideos = async (searchKeyword = keyword) => {
    const trimmedKeyword = searchKeyword.trim();

    if (!trimmedKeyword) return;

    saveSearchHistory(trimmedKeyword);

    try {
      setIsLoading(true);
      setPlayingVideoId(null);
      setExpandedVideoId(null);

      const response = await fetch(
        `/api/youtube?q=${encodeURIComponent(trimmedKeyword)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Search failed');
      }

      setVideos(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectHistory = (history: string) => {
    setKeyword(history);
    searchVideos(history);
  };

  const handleResultWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scrollContainer = resultScrollRef.current;

    if (!scrollContainer) return;

    event.preventDefault();
    scrollContainer.scrollLeft += event.deltaY;
  };

  useEffect(() => {
    const savedHistories = localStorage.getItem(SEARCH_HISTORY_KEY);

    if (!savedHistories) return;

    try {
      const parsedHistories = JSON.parse(savedHistories);

      if (Array.isArray(parsedHistories)) {
        setSearchHistories(parsedHistories);
      }
    } catch {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    }
  }, []);

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden pt-1">
      <div className="flex h-12 max-w-[800px] shrink-0 items-center gap-3 rounded-full bg-[#2b2b2b] px-5">
        <Search size={20} className="text-white/70" />

        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              searchVideos();
            }
          }}
          placeholder="Search YouTube"
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
        />

        {keyword ? (
          <button
            type="button"
            onClick={clearKeyword}
            className="cursor-pointer rounded-full p-1 hover:bg-white/10"
            aria-label="Clear search keyword">
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid max-w-[900px] shrink-0 grid-cols-[1fr_1.1fr] gap-10">
        <div className="space-y-2">
          {searchHistories.length === 0 ? (
            <p className="px-4 text-sm text-white/40">
              No recent searches yet.
            </p>
          ) : null}
          {searchHistories.map((history) => (
            <button
              key={history}
              type="button"
              onClick={() => selectHistory(history)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-full bg-[#333] px-4 py-2 text-left text-sm text-white/90 transition hover:bg-[#454545]">
              <Search size={14} className="text-white/60" />
              <span>{history}</span>
            </button>
          ))}
        </div>

        <YouTubeKeyboard
          onInput={addKeyword}
          onBackspace={removeLastKeyword}
          onSpace={() => addKeyword(' ')}
          onSearch={() => {
            void searchVideos();
          }}
        />
      </div>

      <div className="mt-6 min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-white/50">Searching...</p>
        ) : null}

        {!isLoading && videos.length > 0 ? (
          <div
            ref={resultScrollRef}
            onWheel={handleResultWheel}
            className="h-full w-full overflow-x-auto overflow-y-hidden pb-4">
            <div className="flex w-max gap-5 pr-10">
              {videos.map((video) => {
                const isPlaying = playingVideoId === video.videoId;

                return (
                  <article
                    key={video.videoId}
                    className="w-[260px] shrink-0 text-white">
                    <div className="relative aspect-video overflow-hidden rounded-sm bg-black">
                      {isPlaying ? (
                        <div
                          className={
                            expandedVideoId === video.videoId
                              ? 'fixed inset-0 z-[999] bg-black'
                              : 'absolute inset-0 bg-black'
                          }>
                          <YouTubePlayer videoId={video.videoId} />

                          <button
                            type="button"
                            onClick={() => setExpandedVideoId(null)}
                            className={`absolute top-5 right-5 z-10 size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 ${
                              expandedVideoId === video.videoId
                                ? 'flex'
                                : 'hidden'
                            }`}
                            aria-label="Close fullscreen player">
                            <X size={22} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedVideoId((prev) =>
                                prev === video.videoId ? null : video.videoId,
                              )
                            }
                            className="absolute right-2 bottom-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded bg-black/70 text-white hover:bg-black"
                            aria-label="Expand video">
                            <Expand size={17} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPlayingVideoId(video.videoId)}
                          className="group relative h-full w-full cursor-pointer overflow-hidden bg-black text-left">
                          <img
                            src={video.thumbnail}
                            alt=""
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />

                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <div className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white">
                              <Play size={24} fill="white" />
                            </div>
                          </div>

                          {video.duration ? (
                            <span className="absolute right-1 bottom-1 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                              {video.duration}
                            </span>
                          ) : null}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPlayingVideoId(video.videoId)}
                      className="mt-3 block w-full cursor-pointer text-left">
                      <h3 className="line-clamp-2 text-sm leading-5 font-semibold">
                        {video.title}
                      </h3>

                      <p className="mt-1 truncate text-xs text-white/55">
                        {video.channelTitle}
                      </p>

                      <p className="mt-1 text-xs text-white/55">
                        {formatViewCount(video.viewCount)} -{' '}
                        {formatPublishedAt(video.publishedAt)}
                      </p>
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {!isLoading && keyword && videos.length === 0 ? (
          <p className="text-sm text-white/40">
            Search results will appear here.
          </p>
        ) : null}
      </div>
    </section>
  );
}
