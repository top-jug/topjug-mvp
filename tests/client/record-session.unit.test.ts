import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import type { ApiGymDetail } from '../../src/app/api/gym-api';
import { apiClient } from '../../src/lib/api/client';
import {
  cancelRecordSession,
  completeRecordSession,
  getActiveRecordSession,
  mapApiRecordSummary,
  pauseRecordSession,
  replaceRecordSessionCounts,
  resumeRecordSession,
  startRecordSession,
} from '../../src/app/api/record-api';
import {
  calculateActiveDurationSeconds,
  canUseRecordActions,
  difficultyOptionsFromGym,
  recordCountKey,
  routeCountsFromApi,
  routeCountsToApi,
  sectorOptionsFromGym,
} from '../../src/features/record/record-session-model';
import { shiftRecordMonth } from '../../src/features/record/record-date';
import { createRecordHistoryGuard } from '../../src/features/record/record-history-guard';

afterEach(() => {
  mock.restoreAll();
  apiClient.clearSession();
});

test('record session API calls the lifecycle endpoints with the expected methods', async () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  apiClient.setAccessToken('test-access-token');

  const count = { gymGradeId: 'grade-1', gymSectorId: 'sector-1', attempts: 3, sends: 2 };
  await getActiveRecordSession();
  await startRecordSession({ gymId: 'gym-1', accessType: 'day_pass', startedAt: '2026-08-23T10:00:00+09:00', mode: 'normal', sessionType: 'free' });
  await replaceRecordSessionCounts('record-1', [count]);
  await pauseRecordSession('record-1', '2026-08-23T10:30:00+09:00');
  await resumeRecordSession('record-1', '2026-08-23T10:40:00+09:00');
  await completeRecordSession('record-1', { endedAt: '2026-08-23T11:00:00+09:00', counts: [count] });
  await cancelRecordSession('record-2', '2026-08-23T11:00:00+09:00');

  assert.deepEqual(calls.map(({ url, method }) => ({ url, method })), [
    { url: '/api/v1/records/sessions', method: 'GET' },
    { url: '/api/v1/records/sessions', method: 'POST' },
    { url: '/api/v1/records/record-1/counts', method: 'PUT' },
    { url: '/api/v1/records/record-1/pause', method: 'POST' },
    { url: '/api/v1/records/record-1/resume', method: 'POST' },
    { url: '/api/v1/records/record-1/complete', method: 'POST' },
    { url: '/api/v1/records/record-2/cancel', method: 'POST' },
  ]);
  assert.deepEqual(calls[2].body, { counts: [count] });
});

test('route counts map between the UI and API without losing grade or sector identity', () => {
  const apiCounts = [{
    id: 'count-1',
    sector: { id: 'sector-1', code: 's1', name: '슬랩', sortOrder: 0, isActive: true },
    wall: { id: 'wall-1', code: 'w1', name: '메인월' },
    attempts: 4,
    sends: 2,
    grade: { id: 'grade-1', code: 'red', label: '빨강', color: '#ef4444', standardCode: 'V5', rank: 5 },
  }];

  const routeCounts = routeCountsFromApi(apiCounts);
  assert.deepEqual(routeCounts, { [recordCountKey('sector-1', 'grade-1')]: { success: 2, attempt: 4 } });
  assert.deepEqual(routeCountsToApi(routeCounts), [{ gymGradeId: 'grade-1', gymSectorId: 'sector-1', attempts: 4, sends: 2 }]);
});

test('record summaries preserve a missing rating and the API end time', () => {
  const record = mapApiRecordSummary({
    id: 'record-1',
    gym: { id: 'gym-1', name: '더클라임', branchName: '강남' },
    membership: null,
    accessType: 'day_pass',
    status: 'completed',
    sessionType: 'free',
    startedAt: '2026-08-23T10:00:00.000Z',
    endedAt: '2026-08-23T11:00:00.000Z',
    activeDurationSeconds: 3600,
    rating: null,
    mode: 'normal',
    note: null,
    sends: 2,
    attempts: 3,
    createdAt: '2026-08-23T09:00:00.000Z',
  });

  assert.equal(record.rating, null);
  assert.equal(record.endedAt, '2026-08-23T11:00:00.000Z');
});

test('active duration excludes completed and currently open pause intervals', () => {
  const startedAt = '2026-08-23T10:00:00.000Z';
  const pauses = [
    { id: 'pause-1', recordId: 'record-1', pausedAt: '2026-08-23T10:10:00.000Z', resumedAt: '2026-08-23T10:20:00.000Z' },
    { id: 'pause-2', recordId: 'record-1', pausedAt: '2026-08-23T10:50:00.000Z', resumedAt: null },
  ];
  assert.equal(calculateActiveDurationSeconds(startedAt, pauses, new Date('2026-08-23T11:00:00.000Z').getTime()), 2_400);
});

test('gym grades and active sectors become high-to-low record options', () => {
  const gym = {
    grades: [
      { id: 'easy', code: 'yellow', label: '노랑', color: '#facc15', standardCode: 'V2', rank: 2 },
      { id: 'hard', code: 'red', label: '빨강', color: '#ef4444', standardCode: 'V5', rank: 5 },
    ],
    walls: [{
      id: 'wall-1', code: 'main', name: '메인월', sortOrder: 0, isActive: true, mapMedia: null,
      sectors: [
        { id: 'inactive', code: 'old', name: '구역', sortOrder: 0, isActive: false },
        { id: 'sector-1', code: 'slab', name: '슬랩', sortOrder: 1, isActive: true },
      ],
    }],
  } as ApiGymDetail;

  assert.deepEqual(difficultyOptionsFromGym(gym).map((grade) => grade.id), ['hard', 'easy']);
  assert.deepEqual(sectorOptionsFromGym(gym), [{ id: 'sector-1', name: '슬랩', wallName: '메인월' }]);
});

test('record actions stay gated until hydration succeeds', () => {
  assert.equal(canUseRecordActions(false, true), false);
  assert.equal(canUseRecordActions(false, false), false);
  assert.equal(canUseRecordActions(true, true), false);
  assert.equal(canUseRecordActions(true, false), true);
});

test('record history guard confirms Back and releases its duplicate before exit', async () => {
  const events = new EventTarget();
  const states: unknown[] = [{}];
  const history = {
    get state() { return states.at(-1); },
    pushState(data: unknown) { states.push(data); },
    back() {
      states.pop();
      events.dispatchEvent(new Event('popstate'));
    },
  };
  let backAttempts = 0;
  const guard = createRecordHistoryGuard(history, events, () => { backAttempts += 1; });

  assert.equal(states.length, 2);
  history.back();
  assert.equal(backAttempts, 1);
  assert.equal(states.length, 2);

  await guard.release();
  assert.equal(backAttempts, 1);
  assert.equal(states.length, 1);
});

test('record date month navigation crosses year boundaries', () => {
  assert.deepEqual(shiftRecordMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftRecordMonth(2026, 11, 1), { year: 2027, month: 0 });
});
