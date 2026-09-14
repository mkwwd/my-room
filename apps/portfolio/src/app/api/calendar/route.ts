import { NextRequest, NextResponse } from 'next/server';

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  colorId?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
};

function isValidRange(start: string | null, end: string | null) {
  if (!start || !end) return false;

  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  const maximumRange = 62 * 24 * 60 * 60 * 1000;

  return (
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    startTime < endTime &&
    endTime - startTime <= maximumRange
  );
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const start = request.nextUrl.searchParams.get('start');
  const end = request.nextUrl.searchParams.get('end');

  if (!isValidRange(start, end)) {
    return NextResponse.json(
      { message: 'A valid calendar range is required.' },
      { status: 400 },
    );
  }

  if (!apiKey || !calendarId) {
    return NextResponse.json({ events: [], configured: false });
  }

  const searchParams = new URLSearchParams({
    key: apiKey,
    timeMin: start!,
    timeMax: end!,
    singleEvents: 'true',
    orderBy: 'startTime',
    showDeleted: 'false',
    maxResults: '250',
    timeZone: 'Asia/Seoul',
    fields:
      'items(id,summary,status,htmlLink,colorId,start(date,dateTime),end(date,dateTime))',
  });
  const encodedCalendarId = encodeURIComponent(calendarId);

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?${searchParams.toString()}`,
      { next: { revalidate: 300 } },
    );

    if (!response.ok) {
      const message = await response.text();
      console.error('Google Calendar API request failed:', message);
      return NextResponse.json(
        { events: [], configured: true, message: '일정을 불러오지 못했어요.' },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { items?: GoogleCalendarEvent[] };
    const events = (data.items ?? [])
      .filter(
        (event) =>
          event.status !== 'cancelled' &&
          event.start &&
          event.end &&
          (event.start.date || event.start.dateTime) &&
          (event.end.date || event.end.dateTime),
      )
      .map((event) => ({
        id: event.id,
        title: event.summary?.trim() || '제목 없는 일정',
        start: event.start?.dateTime ?? event.start?.date ?? '',
        end: event.end?.dateTime ?? event.end?.date ?? '',
        allDay: Boolean(event.start?.date),
        htmlLink: event.htmlLink ?? null,
        colorId: event.colorId ?? null,
      }));

    return NextResponse.json({ events, configured: true });
  } catch (error) {
    console.error('Failed to load Google Calendar events:', error);
    return NextResponse.json(
      { events: [], configured: true, message: '일정을 불러오지 못했어요.' },
      { status: 502 },
    );
  }
}
