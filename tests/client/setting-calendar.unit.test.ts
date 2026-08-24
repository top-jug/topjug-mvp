import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSettingCalendarData, SettingEvent } from '../../src/features/calendar/setting-calendar';
import {
  ALL_CALENDAR_STATUSES,
  filterCalendarData,
  getCalendarGyms,
  reconcileActiveGyms,
} from '../../src/features/calendar/calendar-filters';
import {
  CalendarRequestGate,
  getCalendarViewState,
  resolveCalendarSnapshot,
} from '../../src/features/calendar/calendar-state';

function event(overrides: Partial<SettingEvent> = {}): SettingEvent {
  return {
    id: 'event-1',
    title: '전체 세팅',
    status: 'scheduled',
    startsAt: '2026-07-30T10:00:00.000Z',
    endsAt: '2026-08-03T10:00:00.000Z',
    sectors: [],
    gym: {
      id: 'gym-1',
      name: '동명 암장',
      branchName: null,
      address: '서울',
      calendarColor: null,
      calendarTextColor: null,
    },
    ...overrides,
  };
}

test('setting events expand across each overlapping day and clamp to the displayed month', () => {
  const data = buildSettingCalendarData([event()], 2026, 8);
  assert.deepEqual(Object.keys(data), ['1', '2', '3']);
  assert.ok(Object.values(data).flat().every((entry) => entry.gymId === 'gym-1'));
});

test('setting events outside the displayed month are omitted', () => {
  const data = buildSettingCalendarData([event({ startsAt: '2026-07-01T00:00:00.000Z', endsAt: '2026-07-02T00:00:00.000Z' })], 2026, 8);
  assert.deepEqual(data, {});
});

test('setting entries carry the real gym address and logo instead of bundled detail data', () => {
  const data = buildSettingCalendarData([event({
    startsAt: '2026-08-02T10:00:00.000Z',
    endsAt: null,
    gym: {
      id: 'gym-real',
      name: '실제 암장',
      branchName: '성수',
      address: '서울특별시 성동구 성수동 1',
      calendarColor: '#123456',
      calendarTextColor: '#102030',
      logo: { url: 'https://cdn.example.com/real-logo.png' },
    },
  })], 2026, 8);

  assert.equal(data[2][0].settingEventId, 'event-1');
  assert.equal(data[2][0].address, '서울특별시 성동구 성수동 1');
  assert.equal(data[2][0].logoUrl, 'https://cdn.example.com/real-logo.png');
});

test('setting entries omit missing address and logo fields', () => {
  const data = buildSettingCalendarData([event({
    startsAt: '2026-08-02T10:00:00.000Z',
    endsAt: null,
    gym: {
      id: 'gym-1',
      name: '정보 없는 암장',
      branchName: null,
      address: '   ',
      calendarColor: null,
      calendarTextColor: null,
      logo: { url: null },
    },
  })], 2026, 8);

  assert.equal(Object.hasOwn(data[2][0], 'address'), false);
  assert.equal(Object.hasOwn(data[2][0], 'logoUrl'), false);
});

test('gym filters reconcile by stable ID while adding and removing available gyms', () => {
  const augustData = buildSettingCalendarData([
    event({ id: 'a', startsAt: '2026-08-02T10:00:00.000Z', endsAt: null }),
    event({
      id: 'b',
      startsAt: '2026-08-03T10:00:00.000Z',
      endsAt: null,
      gym: { ...event().gym, id: 'gym-2', name: '두번째 암장' },
    }),
  ], 2026, 8);
  const augustGyms = getCalendarGyms(augustData);
  const selected = reconcileActiveGyms({}, augustGyms);
  selected['gym-1'] = false;
  selected['gym-2'] = false;

  const septemberGyms = [augustGyms[0], {
    id: 'gym-3', name: '새 암장', color: '#185FA5', lightBg: '#E6F1FB', darkText: '#0C447C',
  }];
  assert.deepEqual(reconcileActiveGyms(selected, septemberGyms), { 'gym-1': false, 'gym-3': true });

  const byMode = {
    setting: reconcileActiveGyms(selected, augustGyms),
    record: reconcileActiveGyms(selected, [augustGyms[0]]),
  };
  assert.equal(byMode.setting['gym-1'], false);
  assert.equal(byMode.record['gym-1'], false);
  assert.equal(reconcileActiveGyms(selected, [augustGyms[1]])['gym-2'], false);
  assert.equal(reconcileActiveGyms(selected, [augustGyms[0]])['gym-1'], false);
});

test('status filtering includes cancelled events only when selected and retains their cancellation label', () => {
  const startsAt = '2026-08-02T10:00:00.000Z';
  const data = buildSettingCalendarData([
    event({ id: 'scheduled', startsAt, endsAt: null }),
    event({ id: 'cancelled', status: 'cancelled', startsAt, endsAt: null }),
  ], 2026, 8);
  const statuses = { ...ALL_CALENDAR_STATUSES, cancelled: false };
  const withoutCancelled = filterCalendarData(data, { 'gym-1': true }, statuses);

  assert.deepEqual(withoutCancelled[2].map((entry) => entry.status), ['scheduled']);
  assert.match(data[2].find((entry) => entry.status === 'cancelled')!.wall, /취소/);
  assert.deepEqual(filterCalendarData(data, { 'gym-1': true }, ALL_CALENDAR_STATUSES)[2].map((entry) => entry.status), ['scheduled', 'cancelled']);
});

test('calendar state distinguishes loading, source empty, filtered empty, error, and ready', () => {
  const source = { 2: [{ gym: '암장', gymId: 'gym-1', wall: '세팅' }] };
  assert.equal(getCalendarViewState(true, null, {}, {}), 'loading');
  assert.equal(getCalendarViewState(false, null, {}, {}), 'source-empty');
  assert.equal(getCalendarViewState(false, null, source, { 2: [] }), 'filtered-empty');
  assert.equal(getCalendarViewState(false, 'failed', source, source), 'error');
  assert.equal(getCalendarViewState(false, null, source, source), 'ready');
  assert.equal(getCalendarViewState(true, null, source, source), 'ready');
});

test('matching refreshes retain data while another month and stale request are rejected', () => {
  const snapshot = {
    year: 2026,
    month: 8,
    data: { 2: [{ gym: '암장', wall: '세팅' }] },
    error: null,
    isLoading: true,
  };
  assert.equal(resolveCalendarSnapshot(snapshot, 2026, 8).data[2][0].wall, '세팅');
  assert.deepEqual(resolveCalendarSnapshot(snapshot, 2026, 9).data, {});

  const gate = new CalendarRequestGate();
  const augustRequest = gate.begin();
  const septemberRequest = gate.begin();
  assert.equal(gate.isCurrent(augustRequest), false);
  assert.equal(gate.isCurrent(septemberRequest), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(septemberRequest), false);
});
