'use client';

import { useEffect, useState } from 'react';

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string | null;
  colorId: string | null;
};

type CalendarStatus = 'loading' | 'ready' | 'unconfigured' | 'error';

export default function useCalendarEvents(start: Date, end: Date) {
  const [status, setStatus] = useState<CalendarStatus>('loading');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const rangeStart = start.toISOString();
  const rangeEnd = end.toISOString();

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      setStatus('loading');

      try {
        const params = new URLSearchParams({
          start: rangeStart,
          end: rangeEnd,
        });
        const response = await fetch(`/api/calendar?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          events?: CalendarEvent[];
          configured?: boolean;
        };

        if (!response.ok) throw new Error('Failed to load calendar events');

        setEvents(data.events ?? []);
        setStatus(data.configured === false ? 'unconfigured' : 'ready');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setEvents([]);
        setStatus('error');
      }
    }

    void loadEvents();
    return () => controller.abort();
  }, [rangeEnd, rangeStart]);

  return { events, status };
}
