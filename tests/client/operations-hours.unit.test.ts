import assert from 'node:assert/strict';
import test from 'node:test';
import { overridesFromRows, weeklyDaysFromRows } from '../../src/features/operations/operations-hours';

test('operations hours map ordered database rows into editor schedules', () => {
  const weekly = weeklyDaysFromRows([
    { dayOfWeek: 1, sequence: 1, opensAt: '16:00:00', closesAt: '22:00:00', isClosed: false },
    { dayOfWeek: 1, sequence: 0, opensAt: '10:00:00', closesAt: '14:00:00', isClosed: false },
    { dayOfWeek: 2, sequence: 0, opensAt: null, closesAt: null, isClosed: true },
  ]);
  assert.deepEqual(weekly[1].intervals, [
    { opensAt: '10:00', closesAt: '14:00' },
    { opensAt: '16:00', closesAt: '22:00' },
  ]);
  assert.equal(weekly[2].isClosed, true);
  assert.deepEqual(weekly[0].intervals, [{ opensAt: '10:00', closesAt: '22:00' }]);

  const overrides = overridesFromRows([
    { date: '2026-09-02', sequence: 0, opensAt: null, closesAt: null, isClosed: true, note: '임시 휴무' },
    { date: '2026-09-01', sequence: 0, opensAt: '12:00:00', closesAt: '18:00:00', isClosed: false, note: '단축 운영' },
  ]);
  assert.deepEqual(overrides.map((item) => [item.date, item.isClosed, item.note]), [
    ['2026-09-01', false, '단축 운영'],
    ['2026-09-02', true, '임시 휴무'],
  ]);
});
