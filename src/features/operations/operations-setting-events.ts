import type { OperationsSettingEvent } from './api';

const SEOUL_TIME_ZONE = 'Asia/Seoul';

function dateTimeParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function seoulDateKey(value: string | Date) {
  const parts = dateTimeParts(typeof value === 'string' ? new Date(value) : value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function currentMonthInSeoul(now = new Date()) {
  return seoulDateKey(now).slice(0, 7);
}

export function toSeoulDateTimeInput(value: string) {
  const parts = dateTimeParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function seoulDateTimeInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('날짜와 시간을 확인해주세요.');
  const parsed = new Date(`${value}:00+09:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('날짜와 시간을 확인해주세요.');
  return parsed.toISOString();
}

export function shiftOperationsMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function operationsMonthRange(month: string) {
  const nextMonth = shiftOperationsMonth(month, 1);
  const from = new Date(`${month}-01T00:00:00+09:00`);
  const next = new Date(`${nextMonth}-01T00:00:00+09:00`);
  return { from: from.toISOString(), to: new Date(next.getTime() - 1).toISOString() };
}

export function operationsSettingEventOccursOn(event: Pick<OperationsSettingEvent, 'startsAt' | 'endsAt'>, date: string) {
  const first = seoulDateKey(event.startsAt);
  const last = seoulDateKey(event.endsAt ?? event.startsAt);
  return first <= date && date <= last;
}

export type OperationsSettingEventCalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  events: OperationsSettingEvent[];
};

export function buildOperationsSettingEventCalendar(events: OperationsSettingEvent[], month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const calendarStart = new Date(first);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index): OperationsSettingEventCalendarCell => {
    const date = new Date(calendarStart);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    return {
      date: dateKey,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthNumber - 1,
      events: events.filter((event) => operationsSettingEventOccursOn(event, dateKey)),
    };
  });
}
