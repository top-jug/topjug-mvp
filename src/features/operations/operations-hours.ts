import type { OperationsOperatingHour, OperationsOperatingHourOverride } from './api';

export const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function displayOperationsDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${value}T00:00:00+09:00`));
}

export type EditableInterval = { opensAt: string; closesAt: string };
export type EditableSchedule = { isClosed: boolean; intervals: EditableInterval[] };
export type EditableWeeklyDay = EditableSchedule & { dayOfWeek: number };
export type EditableOverride = EditableSchedule & { date: string; note: string | null };

function timeInput(value: string | null) {
  return value?.slice(0, 5) ?? '';
}

export function weeklyDaysFromRows(rows: OperationsOperatingHour[]): EditableWeeklyDay[] {
  return DAY_LABELS.map((_, dayOfWeek) => {
    const entries = rows.filter((row) => row.dayOfWeek === dayOfWeek).sort((a, b) => a.sequence - b.sequence);
    if (entries.length === 0) {
      return { dayOfWeek, isClosed: false, intervals: [{ opensAt: '10:00', closesAt: '22:00' }] };
    }
    const isClosed = entries.some((entry) => entry.isClosed);
    return {
      dayOfWeek,
      isClosed,
      intervals: isClosed ? [] : entries.flatMap((entry) => (
        entry.opensAt && entry.closesAt ? [{ opensAt: timeInput(entry.opensAt), closesAt: timeInput(entry.closesAt) }] : []
      )),
    };
  });
}

export function overridesFromRows(rows: OperationsOperatingHourOverride[]): EditableOverride[] {
  const byDate = new Map<string, OperationsOperatingHourOverride[]>();
  for (const row of rows) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, entries]) => {
    const sorted = [...entries].sort((a, b) => a.sequence - b.sequence);
    const isClosed = sorted.some((entry) => entry.isClosed);
    return {
      date,
      isClosed,
      intervals: isClosed ? [] : sorted.flatMap((entry) => (
        entry.opensAt && entry.closesAt ? [{ opensAt: timeInput(entry.opensAt), closesAt: timeInput(entry.closesAt) }] : []
      )),
      note: sorted.find((entry) => entry.note?.trim())?.note ?? null,
    };
  });
}

export function emptyOverride(date: string): EditableOverride {
  return { date, isClosed: true, intervals: [], note: null };
}
