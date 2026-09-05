import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperationsSettingEvent } from '../../apps/admin/src/features/operations/api';
import {
  buildOperationsSettingEventCalendar,
  operationsMonthRange,
  operationsSettingEventOccursOn,
  seoulDateTimeInputToIso,
  shiftOperationsMonth,
  toSeoulDateTimeInput,
} from '../../apps/admin/src/features/operations/operations-setting-events';

const event: OperationsSettingEvent = {
  id: 'event-1',
  gymId: 'gym-1',
  gym: { id: 'gym-1', name: '테스트 암장', branchName: null },
  title: '월말 세팅',
  status: 'scheduled',
  startsAt: '2026-08-31T14:00:00.000Z',
  endsAt: '2026-09-01T02:00:00.000Z',
  note: null,
  sectors: [],
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
};

test('operations month helpers use Seoul boundaries and cross year boundaries', () => {
  assert.deepEqual(operationsMonthRange('2026-09'), {
    from: '2026-08-31T15:00:00.000Z',
    to: '2026-09-30T14:59:59.999Z',
  });
  assert.equal(shiftOperationsMonth('2026-01', -1), '2025-12');
  assert.equal(shiftOperationsMonth('2026-12', 1), '2027-01');
});

test('operations editor converts datetime-local values with the Seoul offset', () => {
  const iso = seoulDateTimeInputToIso('2026-09-10T10:00');
  assert.equal(iso, '2026-09-10T01:00:00.000Z');
  assert.equal(toSeoulDateTimeInput(iso), '2026-09-10T10:00');
});

test('operations calendar is a six-week grid and includes multi-day events on each Seoul date', () => {
  const calendar = buildOperationsSettingEventCalendar([event], '2026-09');
  assert.equal(calendar.length, 42);
  assert.equal(calendar[0].date, '2026-08-30');
  assert.equal(calendar[41].date, '2026-10-10');
  assert.equal(calendar.find((cell) => cell.date === '2026-08-31')?.events[0]?.id, event.id);
  assert.equal(calendar.find((cell) => cell.date === '2026-09-01')?.events[0]?.id, event.id);
  assert.equal(calendar.find((cell) => cell.date === '2026-09-02')?.events.length, 0);
  assert.equal(operationsSettingEventOccursOn(event, '2026-09-01'), true);
});
