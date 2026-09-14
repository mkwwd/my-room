'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { desktopIcons } from './desktopConfig';
import DesktopIconGraphic from './DesktopIconGraphic';
import useCalendarEvents, { type CalendarEvent } from './useCalendarEvents';
import WindowControls from './WindowControls';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseAllDayDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getEventBounds(event: CalendarEvent) {
  const start = event.allDay
    ? parseAllDayDate(event.start)
    : new Date(event.start);
  const end = event.allDay ? parseAllDayDate(event.end) : new Date(event.end);
  return { start, end };
}

function getEventsForDay(events: CalendarEvent[], day: Date) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = addDays(dayStart, 1);

  return events
    .filter((event) => {
      const bounds = getEventBounds(event);
      return bounds.start < dayEnd && bounds.end > dayStart;
    })
    .sort((first, second) => {
      if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
      return (
        getEventBounds(first).start.getTime() -
        getEventBounds(second).start.getTime()
      );
    });
}

function formatEventTime(event: CalendarEvent) {
  if (event.allDay) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(event.start));
}

function EventPill({ event }: { event: CalendarEvent }) {
  const content = (
    <>
      {event.allDay ? null : (
        <span className="mr-1 shrink-0 text-[#185abc]">
          {formatEventTime(event)}
        </span>
      )}
      <span className="truncate">{event.title}</span>
    </>
  );
  const className = `flex h-[18px] min-w-0 items-center rounded-[3px] px-1.5 text-[9px] leading-none font-bold transition-colors duration-150 ${
    event.allDay
      ? 'bg-[#1a73e8] text-white hover:bg-[#1765cc]'
      : 'bg-[#e8f0fe] text-[#174ea6] hover:bg-[#d2e3fc]'
  }`;

  return event.htmlLink ? (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noreferrer"
      className={`${className} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a73e8]`}
      title={event.title}>
      {content}
    </a>
  ) : (
    <span className={className} title={event.title}>
      {content}
    </span>
  );
}

export default function CalendarWindow({
  isActive,
  isMaximized,
  onActivate,
  onMinimize,
  onToggleMaximize,
  onClose,
}: {
  isActive: boolean;
  isMaximized: boolean;
  onActivate: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const today = new Date();
  const todayKey = getDateKey(today);
  const calendarIcon = desktopIcons.find((icon) => icon.id === 'calendar');
  const calendarDays = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const gridStart = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [visibleMonth]);
  const rangeStart = calendarDays[0];
  const rangeEnd = addDays(calendarDays[calendarDays.length - 1], 1);
  const { events, status } = useCalendarEvents(rangeStart, rangeEnd);
  const monthLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(visibleMonth);

  return (
    <article
      className={`absolute top-[25px] left-[130px] h-[540px] w-[920px] overflow-hidden rounded-sm border-2 bg-white text-[#202124] ${
        isActive
          ? 'z-[4] border-[#f5f0da] shadow-[0_24px_60px_rgba(18,13,20,0.4)]'
          : 'z-[2] border-[#392a39] shadow-[0_16px_38px_rgba(18,13,20,0.25)]'
      }`}
      style={
        isMaximized
          ? { top: 0, left: 0, width: '100%', height: '100%' }
          : undefined
      }
      onPointerDown={onActivate}
      aria-label="Google Calendar window">
      <div className="flex h-9 items-center justify-between border-b-2 border-[#1f1a20] bg-[#211b26] px-3 text-white">
        <div className="flex items-center gap-2 text-sm font-black">
          {calendarIcon ? (
            <DesktopIconGraphic icon={calendarIcon} size="taskbar" />
          ) : (
            <CalendarDays size={20} />
          )}
          <span>Calendar</span>
        </div>
        <WindowControls
          appName="Calendar"
          isMaximized={isMaximized}
          onMinimize={onMinimize}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
        />
      </div>

      <div className="relative h-[calc(100%-36px)] bg-white">
        <header className="flex h-16 items-center gap-2 border-b border-[#dadce0] px-5">
          <div className="mr-3 flex items-center gap-2 text-[#3c4043]">
            <CalendarDays size={27} className="text-[#1a73e8]" />
            <span className="text-lg font-medium">캘린더</span>
          </div>
          <button
            type="button"
            className="h-9 cursor-pointer rounded border border-[#dadce0] px-4 text-xs font-bold text-[#3c4043] transition-colors duration-150 hover:bg-[#f1f3f4] focus-visible:outline-2 focus-visible:outline-[#1a73e8]"
            onClick={() => setVisibleMonth(startOfMonth(new Date()))}>
            오늘
          </button>
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#5f6368] transition-colors duration-150 hover:bg-[#f1f3f4] focus-visible:outline-2 focus-visible:outline-[#1a73e8]"
            onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
            aria-label="이전 달">
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#5f6368] transition-colors duration-150 hover:bg-[#f1f3f4] focus-visible:outline-2 focus-visible:outline-[#1a73e8]"
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            aria-label="다음 달">
            <ChevronRight size={20} />
          </button>
          <h2 className="ml-2 text-xl font-medium tracking-tight text-[#3c4043]">
            {monthLabel}
          </h2>
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-black ${
              status === 'ready'
                ? 'bg-[#e6f4ea] text-[#137333]'
                : status === 'loading'
                  ? 'bg-[#e8f0fe] text-[#185abc]'
                  : status === 'unconfigured'
                    ? 'bg-[#fef7e0] text-[#8a5a00]'
                    : 'bg-[#fce8e6] text-[#c5221f]'
            }`}>
            {status === 'ready'
              ? '일정 연결됨'
              : status === 'loading'
                ? '불러오는 중'
                : status === 'unconfigured'
                  ? 'API 연결 대기'
                  : '일정 불러오기 실패'}
          </span>
        </header>

        <div className="grid h-8 grid-cols-7 border-b border-[#dadce0] bg-[#f8f9fa]">
          {WEEKDAYS.map((weekday, index) => (
            <div
              key={weekday}
              className={`grid place-items-center border-r border-[#dadce0] text-[10px] font-bold last:border-r-0 ${
                index === 0
                  ? 'text-[#d93025]'
                  : index === 6
                    ? 'text-[#1a73e8]'
                    : 'text-[#5f6368]'
              }`}>
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid h-[calc(100%-96px)] grid-cols-7 grid-rows-6">
          {calendarDays.map((day, index) => {
            const dateKey = getDateKey(day);
            const isToday = dateKey === todayKey;
            const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
            const dayEvents = getEventsForDay(events, day);
            const weekday = day.getDay();

            return (
              <section
                key={dateKey}
                className={`min-h-0 overflow-hidden border-r border-b border-[#dadce0] px-1.5 pt-1 last:border-r-0 ${
                  isCurrentMonth ? 'bg-white' : 'bg-[#fafafa]'
                } ${index % 7 === 6 ? 'border-r-0' : ''}`}
                aria-label={`${dateKey}, 일정 ${dayEvents.length}개`}>
                <div className="mb-1 flex h-5 items-center justify-center">
                  <time
                    dateTime={dateKey}
                    aria-current={isToday ? 'date' : undefined}
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${
                      isToday
                        ? 'bg-[#1a73e8] text-white'
                        : !isCurrentMonth
                          ? 'text-[#bdc1c6]'
                          : weekday === 0
                            ? 'text-[#d93025]'
                            : weekday === 6
                              ? 'text-[#1a73e8]'
                              : 'text-[#3c4043]'
                    }`}>
                    {day.getDate()}
                  </time>
                </div>
                <div className="space-y-[2px]">
                  {dayEvents.slice(0, 3).map((event) => (
                    <EventPill key={`${dateKey}-${event.id}`} event={event} />
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="block pl-1 text-[9px] font-bold text-[#5f6368]">
                      +{dayEvents.length - 3}개 더보기
                    </span>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

        {status === 'unconfigured' ? (
          <p className="pointer-events-none absolute right-3 bottom-3 rounded border border-[#f6d98b] bg-[#fff8e1]/95 px-3 py-2 text-[10px] font-bold text-[#7a4f00] shadow-sm">
            환경변수를 추가하면 Google 일정이 여기에 표시돼요.
          </p>
        ) : null}
      </div>
    </article>
  );
}
