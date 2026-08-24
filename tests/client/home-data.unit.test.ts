import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiRecordSummary } from '../../src/app/api/record-api';
import type { SettingEvent } from '../../src/features/calendar/setting-calendar';
import { getHomeDataState } from '../../src/features/home/home-state';
import { buildHomeSettingEntries, getHomeWeek } from '../../src/features/home/home-week';
import { buildRecentGyms, loadRecentGyms } from '../../src/features/home/recent-gyms';

function settingEvent(overrides: Partial<SettingEvent> = {}): SettingEvent {
  return {
    id: 'event-1',
    title: '전체 세팅',
    status: 'scheduled',
    startsAt: '2026-03-08T06:30:00.000Z',
    endsAt: '2026-03-09T05:30:00.000Z',
    sectors: [],
    gym: {
      id: 'gym-1',
      name: '더클라임',
      branchName: '강남',
      address: '서울',
      calendarColor: '#123456',
      calendarTextColor: null,
      logo: { url: 'https://example.com/logo.png' },
    },
    ...overrides,
  };
}

function record(gymId: string, overrides: Partial<ApiRecordSummary> = {}): ApiRecordSummary {
  return {
    id: `record-${gymId}`,
    gym: { id: gymId, name: `암장 ${gymId}`, branchName: null },
    membership: null,
    accessType: 'day_pass',
    status: 'completed',
    sessionType: 'free',
    startedAt: '2026-03-08T10:00:00.000Z',
    endedAt: '2026-03-08T11:00:00.000Z',
    activeDurationSeconds: 3600,
    rating: null,
    mode: 'normal',
    note: null,
    sends: 0,
    attempts: 0,
    createdAt: '2026-03-08T12:00:00.000Z',
    ...overrides,
  };
}

test('home week uses Sunday-to-Saturday local boundaries across a DST offset change', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const week = getHomeWeek(new Date('2026-03-11T16:00:00.000Z'));
    assert.equal(week.days[0].key, '2026-03-08');
    assert.equal(week.days[6].key, '2026-03-14');
    assert.equal(week.from, '2026-03-08T05:00:00.000Z');
    assert.equal(week.to, '2026-03-15T03:59:59.999Z');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('home week crosses month and year boundaries without losing full date keys', () => {
  const week = getHomeWeek(new Date(2027, 0, 1, 12));
  assert.deepEqual(week.days.map((day) => day.key), [
    '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02',
  ]);
});

test('setting events map to every overlapping local week day and clamp outside dates', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const week = getHomeWeek(new Date('2026-03-11T16:00:00.000Z'));
    const entries = buildHomeSettingEntries([
      settingEvent(),
      settingEvent({ id: 'outside', startsAt: '2026-03-01T12:00:00.000Z', endsAt: '2026-03-02T12:00:00.000Z' }),
    ], week);
    assert.equal(entries['2026-03-08'].length, 1);
    assert.equal(entries['2026-03-09'].length, 1);
    assert.equal(entries['2026-03-10'].length, 0);
    assert.equal(entries['2026-03-08'][0].gymId, 'gym-1');
    assert.equal(entries['2026-03-08'][0].logoUrl, 'https://example.com/logo.png');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('recent gyms deduplicate stable IDs while preserving newest record order and links', () => {
  const gyms = buildRecentGyms([
    record('gym-a'),
    record('gym-a', { id: 'older-a' }),
    record('gym/b', { id: 'record-b', gym: { id: 'gym/b', name: '두번째', branchName: '지점' } }),
    record('gym-c'),
    record('gym-d'),
  ]);
  assert.deepEqual(gyms, [
    { id: 'gym-a', name: '암장 gym-a', href: '/gyms/gym-a' },
    { id: 'gym/b', name: '두번째 지점', href: '/gyms/gym%2Fb' },
    { id: 'gym-c', name: '암장 gym-c', href: '/gyms/gym-c' },
  ]);
});

test('recent gym loading follows bounded pages and stops after enough distinct gyms', async () => {
  const cursors: Array<string | null | undefined> = [];
  const gyms = await loadRecentGyms(undefined, async ({ cursor }) => {
    cursors.push(cursor);
    return cursor
      ? { data: [record('gym-b'), record('gym-c')], meta: { nextCursor: 'unused' } }
      : { data: [record('gym-a'), record('gym-a', { id: 'duplicate-a' })], meta: { nextCursor: 'page-2' } };
  });
  assert.deepEqual(cursors, [null, 'page-2']);
  assert.deepEqual(gyms.map((gym) => gym.id), ['gym-a', 'gym-b', 'gym-c']);
});

test('recent gym loading never scans more than three record pages', async () => {
  const cursors: Array<string | null | undefined> = [];
  await loadRecentGyms(undefined, async ({ cursor }) => {
    cursors.push(cursor);
    return { data: [record('gym-a', { id: `record-${cursors.length}` })], meta: { nextCursor: `page-${cursors.length + 1}` } };
  });
  assert.deepEqual(cursors, [null, 'page-2', 'page-3']);
});

test('home data state distinguishes loading, error, empty, and ready UI', () => {
  assert.equal(getHomeDataState(true, null, 0), 'loading');
  assert.equal(getHomeDataState(false, 'failed', 0), 'error');
  assert.equal(getHomeDataState(false, null, 0), 'empty');
  assert.equal(getHomeDataState(false, null, 1), 'ready');
});
