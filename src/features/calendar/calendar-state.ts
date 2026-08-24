import type { CalendarData } from '../../entities/calendar/types';

const EMPTY_CALENDAR_DATA: CalendarData = {};

export type CalendarViewState = 'loading' | 'source-empty' | 'filtered-empty' | 'error' | 'ready';

export interface CalendarSnapshot {
  year: number;
  month: number;
  data: CalendarData;
  error: string | null;
  isLoading: boolean;
}

export interface CalendarSlideStateKeyInput {
  mode: 'record' | 'setting';
  year: number;
  month: number;
  selectedDate: number | null;
  entryKeys: string[];
}

export function hasCalendarEntries(data: CalendarData) {
  return Object.values(data).some((entries) => entries.length > 0);
}

export function getCalendarViewState(
  isLoading: boolean,
  error: string | null,
  sourceData: CalendarData,
  filteredData: CalendarData,
): CalendarViewState {
  if (isLoading && !hasCalendarEntries(sourceData)) return 'loading';
  if (error) return 'error';
  if (!hasCalendarEntries(sourceData)) return 'source-empty';
  return hasCalendarEntries(filteredData) ? 'ready' : 'filtered-empty';
}

export function resolveCalendarSnapshot(snapshot: CalendarSnapshot | null, year: number, month: number) {
  if (!snapshot || snapshot.year !== year || snapshot.month !== month) {
    return { data: EMPTY_CALENDAR_DATA, error: null, isLoading: true };
  }

  return { data: snapshot.data, error: snapshot.error, isLoading: snapshot.isLoading };
}

export function getCalendarSlideStateKey(input: CalendarSlideStateKeyInput) {
  return {
    context: JSON.stringify([input.mode, input.year, input.month, input.selectedDate]),
    entries: JSON.stringify(input.entryKeys),
  };
}

export function reconcileCalendarSlide(activeSlide: number, entryCount: number, shouldReset: boolean) {
  if (shouldReset || entryCount === 0) return 0;
  return Math.min(Math.max(activeSlide, 0), entryCount - 1);
}

export class CalendarRequestGate {
  private latestRequest = 0;

  begin() {
    this.latestRequest += 1;
    return this.latestRequest;
  }

  isCurrent(request: number) {
    return request === this.latestRequest;
  }

  invalidate() {
    this.latestRequest += 1;
  }
}
