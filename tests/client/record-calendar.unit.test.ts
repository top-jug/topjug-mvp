import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiRecordSummary } from '../../src/app/api/record-api';
import {
  buildMonthCells,
  getCalendarMonthRange,
  getLocalCalendarDate,
  getCalendarWeekdayKind,
  shiftCalendarMonth,
} from '../../src/features/calendar/calendar-month';
import {
  buildRecordCalendarData,
  getRecordCalendarState,
  loadRecordCalendarMonth,
  resolveRecordCalendarSnapshot,
} from '../../src/features/calendar/record-calendar';

function record(overrides: Partial<ApiRecordSummary> = {}): ApiRecordSummary {
  return {
    id: 'real-record-id',
    gym: { id: 'gym-1', name: '더클라임', branchName: '강남' },
    membership: null,
    accessType: 'day_pass',
    status: 'completed',
    sessionType: 'training',
    startedAt: '2026-08-24T10:00:00.000Z',
    endedAt: '2026-08-24T11:00:00.000Z',
    activeDurationSeconds: 3600,
    rating: 4.5,
    mode: 'normal',
    note: null,
    sends: 4,
    attempts: 7,
    createdAt: '2026-08-24T09:00:00.000Z',
    ...overrides,
  };
}

test('record calendar initializes from the supplied local current date', () => {
  assert.deepEqual(getLocalCalendarDate(new Date(2027, 0, 31, 23, 30)), { year: 2027, month: 1, day: 31 });
});

test('API record summaries map to their local day with real IDs and details', () => {
  const startedAt = new Date(2026, 7, 24, 10).toISOString();
  const data = buildRecordCalendarData([record({ startedAt })], 2026, 8);

  assert.deepEqual(data[24], [{
    gym: '더클라임 강남',
    gymId: 'gym-1',
    wall: '완등 4 · 시도 7',
    recordId: 'real-record-id',
    status: 'completed',
    startsAt: startedAt,
    endsAt: '2026-08-24T11:00:00.000Z',
    sends: 4,
    attempts: 7,
    rating: 4.5,
    sessionType: 'training',
  }]);
});

test('record gym names do not repeat a branch already included in the name', () => {
  const startedAt = new Date(2026, 7, 24, 10).toISOString();
  const data = buildRecordCalendarData([
    record({ gym: { id: 'gym-1', name: '더클라임 강남', branchName: '강남' }, startedAt }),
  ], 2026, 8);

  assert.equal(data[24][0].gym, '더클라임 강남');
});

test('month movement and ranges cross year and short-month boundaries', () => {
  assert.deepEqual(shiftCalendarMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftCalendarMonth(2027, 1, -1), { year: 2026, month: 12 });

  const range = getCalendarMonthRange(2027, 2);
  assert.equal(new Date(range.from).getDate(), 1);
  assert.equal(new Date(range.to).getDate(), 28);
  assert.equal(new Date(range.to).getMonth(), 1);

  const january = buildMonthCells(2027, 1);
  assert.equal(january.findIndex((cell) => cell.day === 1), 5);
  assert.equal(january.filter((cell) => cell.day !== null).length, 31);
});

test('Sunday-first calendar columns classify weekend colors consistently', () => {
  assert.equal(getCalendarWeekdayKind(0), 'sunday');
  assert.equal(getCalendarWeekdayKind(1), 'weekday');
  assert.equal(getCalendarWeekdayKind(5), 'weekday');
  assert.equal(getCalendarWeekdayKind(6), 'saturday');
});

test('month loading follows every cursor instead of treating the first page as complete', async () => {
  const calls: Array<string | null | undefined> = [];
  const data = await loadRecordCalendarMonth(2026, 8, undefined, async (params) => {
    calls.push(params.cursor);
    return params.cursor
      ? { data: [record({ id: 'record-page-2', startedAt: new Date(2026, 7, 31, 20).toISOString() })], meta: { nextCursor: null } }
      : { data: [record({ id: 'record-page-1', startedAt: new Date(2026, 7, 1, 8).toISOString() })], meta: { nextCursor: 'page-2' } };
  });

  assert.deepEqual(calls, [null, 'page-2']);
  assert.equal(data[1][0].recordId, 'record-page-1');
  assert.equal(data[31][0].recordId, 'record-page-2');
});

test('record calendar exposes loading, empty, error, and ready states', () => {
  assert.equal(getRecordCalendarState(true, null, {}), 'loading');
  assert.equal(getRecordCalendarState(false, null, {}), 'source-empty');
  assert.equal(getRecordCalendarState(false, 'failed', {}), 'error');
  assert.equal(getRecordCalendarState(false, null, { 1: [{ gym: '암장', wall: '완등 1' }] }), 'ready');
  assert.equal(getRecordCalendarState(false, null, { 1: [{ gym: '암장', wall: '완등 1' }] }, { 1: [] }), 'filtered-empty');
});

test('record calendar hides a snapshot that belongs to a different displayed month', () => {
  const snapshot = {
    year: 2026,
    month: 8,
    data: { 24: [{ gym: '암장', wall: '완등 1', recordId: 'august-record' }] },
    error: null,
    isLoading: false,
  };

  assert.deepEqual(resolveRecordCalendarSnapshot(snapshot, 2026, 9), {
    data: {},
    error: null,
    state: 'loading',
  });
  assert.equal(resolveRecordCalendarSnapshot(snapshot, 2026, 8).state, 'ready');
});

test('record calendar retains carried data while the matching month is refreshing or failed', () => {
  const snapshot = {
    year: 2026,
    month: 8,
    data: { 24: [{ gym: '암장', wall: '완등 1', recordId: 'stale-record' }] },
    error: null,
    isLoading: true,
  };

  assert.deepEqual(resolveRecordCalendarSnapshot(snapshot, 2026, 8), {
    data: snapshot.data,
    error: null,
    state: 'ready',
  });
  assert.deepEqual(resolveRecordCalendarSnapshot({ ...snapshot, error: 'failed', isLoading: false }, 2026, 8), {
    data: snapshot.data,
    error: 'failed',
    state: 'error',
  });
});
