import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiRecentVisitedGym } from '../../src/app/api/gym-api';
import type { SettingEvent } from '../../src/features/calendar/setting-calendar';
import { getHomeDataState } from '../../src/features/home/home-state';
import { buildHomeSettingEntries, getHomeClock, getHomeWeek, shouldRefreshHome } from '../../src/features/home/home-week';
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

function visit(gymId: string, overrides: Partial<ApiRecentVisitedGym> = {}): ApiRecentVisitedGym {
  return {
    gym: { id: gymId, name: `암장 ${gymId}`, branchName: null },
    lastVisitedAt: '2026-03-08T10:00:00.000Z',
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
    assert.equal(entries['2026-03-08'][0].eventId, 'event-1');
    assert.equal(entries['2026-03-08'][0].logoUrl, 'https://example.com/logo.png');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('recent gyms preserve endpoint recency order, public shape, and links', () => {
  const gyms = buildRecentGyms([
    visit('gym/b', { gym: { id: 'gym/b', name: '두번째', branchName: '지점' }, lastVisitedAt: '2026-03-11T10:00:00.000Z' }),
    visit('gym-a', { lastVisitedAt: '2026-03-10T10:00:00.000Z' }),
    visit('gym-c', { lastVisitedAt: '2026-03-09T10:00:00.000Z' }),
    visit('gym-d', { lastVisitedAt: '2026-03-08T10:00:00.000Z' }),
  ]);
  assert.deepEqual(gyms, [
    { id: 'gym/b', name: '두번째 지점', href: '/gyms/gym%2Fb' },
    { id: 'gym-a', name: '암장 gym-a', href: '/gyms/gym-a' },
    { id: 'gym-c', name: '암장 gym-c', href: '/gyms/gym-c' },
  ]);
});

test('recent gym loading makes one dedicated request and forwards cancellation', async () => {
  const controller = new AbortController();
  let calls = 0;
  const gyms = await loadRecentGyms(controller.signal, async (signal) => {
    calls += 1;
    assert.equal(signal, controller.signal);
    return { data: [visit('gym-b'), visit('gym-a')] };
  });
  assert.equal(calls, 1);
  assert.deepEqual(gyms.map((gym) => gym.id), ['gym-b', 'gym-a']);
});

test('home clock recomputes today and the week at local midnight', () => {
  const saturday = getHomeClock(new Date(2026, 7, 29, 23, 59, 59));
  const sunday = getHomeClock(new Date(2026, 7, 30, 0, 0, 0));
  assert.equal(saturday.todayKey, '2026-08-29');
  assert.equal(sunday.todayKey, '2026-08-30');
  assert.notEqual(saturday.week.from, sunday.week.from);
  assert.equal(saturday.nextLocalMidnightAt, new Date(2026, 7, 30).getTime());
  assert.equal(shouldRefreshHome(1000, 1500), false);
  assert.equal(shouldRefreshHome(1000, 2000), true);
});

test('setting markers retain unique event identities for the same gym and start time', () => {
  const week = getHomeWeek(new Date(2026, 2, 8, 12));
  const entries = buildHomeSettingEntries([
    settingEvent({ id: 'event-a', startsAt: new Date(2026, 2, 8, 10).toISOString(), endsAt: null }),
    settingEvent({ id: 'event-b', startsAt: new Date(2026, 2, 8, 10).toISOString(), endsAt: null }),
  ], week);
  assert.deepEqual(entries['2026-03-08'].map((entry) => entry.eventId), ['event-a', 'event-b']);
});

test('home data state distinguishes loading, error, empty, and ready UI', () => {
  assert.equal(getHomeDataState(true, null, 0), 'loading');
  assert.equal(getHomeDataState(false, 'failed', 0), 'error');
  assert.equal(getHomeDataState(false, null, 0), 'empty');
  assert.equal(getHomeDataState(false, null, 1), 'ready');
});
