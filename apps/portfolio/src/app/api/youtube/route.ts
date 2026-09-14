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

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const keyword = request.nextUrl.searchParams.get('q');

  if (!apiKey) {
    return NextResponse.json(
      { message: 'YOUTUBE_API_KEY is missing.' },
      { status: 500 },
    );
  }

  if (!keyword) {
    return NextResponse.json({ items: [] });
  }

  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '6',
    q: keyword,
    key: apiKey,
    regionCode: 'KR',
    relevanceLanguage: 'ko',
  });

  const searchResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
  );

  if (!searchResponse.ok) {
    return NextResponse.json(
      { message: `YouTube search request failed for "${keyword}".` },
      { status: searchResponse.status },
    );
  }

  const searchData = await searchResponse.json();
  const searchItems = searchData.items as YouTubeSearchItem[];

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
  );

  if (!videoResponse.ok) {
    return NextResponse.json(
      { message: 'YouTube video details request failed.' },
      { status: videoResponse.status },
    );
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
}
