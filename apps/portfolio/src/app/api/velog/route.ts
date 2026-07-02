import { NextResponse } from 'next/server';

const VELOG_RSS_URL = 'https://v2.velog.io/rss/@mkwhwkdud';

function decodeXml(value: string) {
  return value
    .replaceAll('<![CDATA[', '')
    .replaceAll(']]>', '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function readTag(xml: string, tag: string) {
  const pattern = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    'i',
  );
  const match = xml.match(pattern);
  return match ? decodeXml(match[1].trim()) : '';
}

function toPlainText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function GET() {
  try {
    const response = await fetch(VELOG_RSS_URL, {
      next: { revalidate: 1800 },
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!response.ok) throw new Error(`Velog RSS returned ${response.status}`);

    const xml = await response.text();
    const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .slice(0, 8)
      .map((match, index) => {
        const item = match[1];
        const rawDescription = readTag(item, 'description');
        const thumbnail = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
        return {
          id: readTag(item, 'guid') || `${index}-${readTag(item, 'link')}`,
          title: toPlainText(readTag(item, 'title')),
          link: readTag(item, 'link'),
          description: toPlainText(rawDescription).slice(0, 180),
          thumbnail: thumbnail || null,
          publishedAt: readTag(item, 'pubDate'),
        };
      })
      .filter((post) => post.title && post.link);

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Failed to load Velog RSS:', error);
    return NextResponse.json({ posts: [] }, { status: 502 });
  }
}
