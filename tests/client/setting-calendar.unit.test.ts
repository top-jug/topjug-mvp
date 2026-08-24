import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSettingCalendarData, SettingEvent } from '../../src/features/calendar/setting-calendar';

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
