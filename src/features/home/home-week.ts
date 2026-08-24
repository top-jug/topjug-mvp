import type { CalendarEntry } from '../../entities/calendar/types';
import type { SettingEvent } from '../calendar/setting-calendar';

export interface HomeWeekDay {
  key: string;
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
}

export interface HomeWeek {
  days: HomeWeekDay[];
  from: string;
  to: string;
}

export interface HomeSettingEntry extends CalendarEntry {
  eventId: string;
  logoUrl: string | null;
}

export interface HomeClock {
  week: HomeWeek;
  todayKey: string;
  nextLocalMidnightAt: number;
}

const STATUS_LABELS = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
} satisfies Record<SettingEvent['status'], string>;

export function getLocalDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function getHomeWeek(now = new Date()): HomeWeek {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  const days = Array.from({ length: 7 }, (_, weekdayIndex) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + weekdayIndex);
    return {
      key: getLocalDateKey(date),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekdayIndex,
    };
  });

  return { days, from: start.toISOString(), to: end.toISOString() };
}

export function getHomeClock(now = new Date()): HomeClock {
  const nextLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    week: getHomeWeek(now),
    todayKey: getLocalDateKey(now),
    nextLocalMidnightAt: nextLocalMidnight.getTime(),
  };
}

export function shouldRefreshHome(lastRefreshAt: number, now: number, minimumInterval = 1000) {
  return now - lastRefreshAt >= minimumInterval;
}

export function buildHomeSettingEntries(events: SettingEvent[], week: HomeWeek) {
  const entriesByDay: Record<string, HomeSettingEntry[]> = Object.fromEntries(week.days.map((day) => [day.key, []]));
  const weekStart = new Date(week.from);
  const weekEnd = new Date(week.to);

  events.forEach((event) => {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt ?? event.startsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt < weekStart || startsAt > weekEnd) return;

    const firstDate = startsAt < weekStart ? weekStart : startsAt;
    const lastDate = endsAt > weekEnd ? weekEnd : endsAt;
    const gymName = event.gym.branchName && !event.gym.name.includes(event.gym.branchName)
      ? `${event.gym.name} ${event.gym.branchName}`
      : event.gym.name;
    const sectorLabel = event.sectors.map((sector) => sector.name).join(', ');
    const title = sectorLabel || event.title || '세팅';
    const color = event.gym.calendarColor ?? '#185FA5';
    const entry: HomeSettingEntry = {
      eventId: event.id,
      gym: gymName,
      gymId: event.gym.id,
      wall: `${title} · ${STATUS_LABELS[event.status]}`,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? undefined,
      color,
      lightBg: `${color}22`,
      darkText: event.gym.calendarTextColor ?? color,
      logoUrl: event.gym.logo?.url ?? null,
    };

    for (
      let date = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
      date <= lastDate;
      date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    ) {
      const key = getLocalDateKey(date);
      if (entriesByDay[key]) entriesByDay[key].push(entry);
    }
  });

  return entriesByDay;
}
