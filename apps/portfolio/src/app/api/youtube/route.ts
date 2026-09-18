import { NextRequest, NextResponse } from 'next/server';

type YouTubeSearchItem = {
  id: {
    videoId?: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      medium?: {
        url: string;
      };
      high?: {
        url: string;
      };
    };
  };
};

type YouTubeVideoItem = {
  id: string;
  statistics?: {
    viewCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
};

function formatDuration(duration?: string) {
  if (!duration) return '';

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return '';

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function decodeHtml(text: string) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

async function upstreamError(response: Response) {
  const data = await response.json().catch(() => null);
  const reasons =
    data?.error?.errors?.map((error: { reason: string }) => error.reason) ?? [];
  const quotaExceeded = reasons.some((reason: string) =>
    ['quotaExceeded', 'dailyLimitExceeded'].includes(reason),
  );
  return NextResponse.json(
    {
      message: quotaExceeded
        ? 'YouTube search has reached its daily limit. Please try again later.'
        : 'YouTube search is unavailable. Please try again later.',
    },
    { status: quotaExceeded ? 503 : 502 },
  );
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  const keyword = request.nextUrl.searchParams.get('q')?.trim();

  if (!keyword) {
    return NextResponse.json({ items: [] });
  }

  if (!apiKey) {
    return NextResponse.json(
      { message: 'YouTube search is not configured on this server.' },
      { status: 500 },
    );
  }

  try {
    const signal = AbortSignal.timeout(10_000);
    const searchParams = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '6',
      q: keyword,
      key: apiKey,
      regionCode: 'KR',
      relevanceLanguage: 'ko',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
    });

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
      { signal },
    );

    if (!searchResponse.ok) {
      return upstreamError(searchResponse);
    }

    const searchData = await searchResponse.json();
    const searchItems = (searchData.items ?? []) as YouTubeSearchItem[];

    const videoIds = searchItems
      .map((item) => item.id.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) {
      return NextResponse.json({ items: [] });
    }

    const videoParams = new URLSearchParams({
      part: 'statistics,contentDetails',
      id: videoIds,
      key: apiKey,
    });

    const videoResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`,
      { signal },
    );

    if (!videoResponse.ok) {
      return upstreamError(videoResponse);
    }

    const videoData = await videoResponse.json();
    const videoMap = new Map<string, YouTubeVideoItem>(
      (videoData.items as YouTubeVideoItem[]).map((item) => [item.id, item]),
    );

    const items = searchItems
      .map((item) => {
        const videoId = item.id.videoId;

        if (!videoId) return null;

        const detail = videoMap.get(videoId);

        return {
          videoId,
          title: decodeHtml(item.snippet.title),
          channelTitle: decodeHtml(item.snippet.channelTitle),
          publishedAt: item.snippet.publishedAt,
          thumbnail:
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.medium?.url ||
            '',
          viewCount: detail?.statistics?.viewCount || '0',
          duration: formatDuration(detail?.contentDetails?.duration),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      {
        message:
          'Cannot connect to YouTube right now. Please try again shortly.',
      },
      { status: 502 },
    );
  }
}
