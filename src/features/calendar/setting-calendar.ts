import { CalendarData, CalendarEntry } from '../../entities/calendar/types';

export interface SettingEvent {
  id: string;
  title: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  startsAt: string;
  endsAt: string | null;
  sectors: Array<{ id: string; name: string }>;
  gym: {
    id: string;
    name: string;
    branchName: string | null;
    address: string;
    calendarColor: string | null;
    calendarTextColor: string | null;
    logo?: { url: string | null } | null;
  };
}

const STATUS_LABELS = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
} satisfies Record<NonNullable<CalendarEntry['status']>, string>;

export function buildSettingCalendarData(events: SettingEvent[], year: number, month: number) {
  const nextData: CalendarData = {};
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  events.forEach((event) => {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt ?? event.startsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt < monthStart || startsAt > monthEnd) return;

    const firstDate = startsAt < monthStart ? monthStart : startsAt;
    const lastDate = endsAt > monthEnd ? monthEnd : endsAt;
    const gymName = [event.gym.name, event.gym.branchName].filter(Boolean).join(' ');
    const sectorLabel = event.sectors.map((sector) => sector.name).join(', ');
    const title = sectorLabel || event.title || '세팅';
    const color = event.gym.calendarColor ?? '#185FA5';
    const entry: CalendarEntry = {
      gym: gymName,
      gymId: event.gym.id,
      wall: `${title} · ${STATUS_LABELS[event.status]}`,
      status: event.status,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? undefined,
      color,
      lightBg: `${color}22`,
      darkText: event.gym.calendarTextColor ?? color,
    };

    for (let date = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate()); date <= lastDate; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
      const day = date.getDate();
      nextData[day] = [...(nextData[day] ?? []), entry];
    }
  });

  return nextData;
}
