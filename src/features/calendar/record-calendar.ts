import { listRecords, type ApiRecordSummary } from '../../app/api/record-api';
import { displayGymName } from '../../app/api/gym-api';
import type { CalendarData, CalendarEntry } from '../../entities/calendar/types';
import { getCalendarMonthRange } from './calendar-month';
import {
  getCalendarViewState,
  resolveCalendarSnapshot,
  type CalendarSnapshot,
  type CalendarViewState,
} from './calendar-state';

const RECORD_PAGE_SIZE = 100;

type RecordPage = Awaited<ReturnType<typeof listRecords>>;
type ListRecordPage = (params: {
  from: string;
  to: string;
  cursor?: string | null;
  limit: number;
  signal?: AbortSignal;
}) => Promise<RecordPage>;

export type RecordCalendarState = CalendarViewState;

export type RecordCalendarSnapshot = CalendarSnapshot;

export function buildRecordCalendarData(records: ApiRecordSummary[], year: number, month: number) {
  const calendarData: CalendarData = {};

  records.forEach((record) => {
    const startedAt = new Date(record.startedAt);
    if (
      Number.isNaN(startedAt.getTime()) ||
      startedAt.getFullYear() !== year ||
      startedAt.getMonth() + 1 !== month
    ) return;

    const day = startedAt.getDate();
    const gymName = displayGymName(record.gym);
    const entry: CalendarEntry = {
      gym: gymName,
      gymId: record.gym.id,
      wall: `완등 ${record.sends} · 시도 ${record.attempts}`,
      recordId: record.id,
      status: 'completed',
      startsAt: record.startedAt,
      endsAt: record.endedAt ?? undefined,
      sends: record.sends,
      attempts: record.attempts,
      rating: record.rating,
      ...(record.gym.logo?.url ? { logoUrl: record.gym.logo.url } : {}),
    };
    calendarData[day] = [...(calendarData[day] ?? []), entry];
  });

  return calendarData;
}

export async function loadRecordCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal,
  listPage: ListRecordPage = listRecords,
) {
  const range = getCalendarMonthRange(year, month);
  const records: ApiRecordSummary[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await listPage({ ...range, cursor, limit: RECORD_PAGE_SIZE, signal });
    page.data.forEach((record) => {
      if (seenIds.has(record.id)) return;
      seenIds.add(record.id);
      records.push(record);
    });

    cursor = page.meta.nextCursor;
    if (cursor && seenCursors.has(cursor)) throw new Error('기록 페이지를 끝까지 불러오지 못했어요.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);

  return buildRecordCalendarData(records, year, month);
}

export function getRecordCalendarState(
  isLoading: boolean,
  error: string | null,
  calendarData: CalendarData,
  filteredData = calendarData,
): RecordCalendarState {
  return getCalendarViewState(isLoading, error, calendarData, filteredData);
}

export function resolveRecordCalendarSnapshot(
  snapshot: RecordCalendarSnapshot | null,
  year: number,
  month: number,
) {
  const resolved = resolveCalendarSnapshot(snapshot, year, month);
  const state = getRecordCalendarState(resolved.isLoading, resolved.error, resolved.data);

  return {
    data: resolved.data,
    error: resolved.error,
    state,
  };
}
