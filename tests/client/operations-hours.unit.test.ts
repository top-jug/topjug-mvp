import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError } from '../../src/lib/api/error';
import { displayOperationsDate, overridesFromRows, presentOperationsHoursFailure, weeklyDaysFromRows } from '../../src/features/operations/operations-hours';

test('operations hours map ordered database rows into editor schedules', () => {
  assert.match(displayOperationsDate('2026-09-01'), /2026/);
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

test('operations hours preserve backend messages and distinguish actionable conflicts', () => {
  assert.deepEqual(
    presentOperationsHoursFailure(new ApiClientError('종료 시간은 시작 시간보다 늦어야 합니다.', 400, 'INVALID_OPERATING_HOURS')),
    { kind: 'error', message: '종료 시간은 시작 시간보다 늦어야 합니다.', requiresReload: false },
  );
  assert.deepEqual(
    presentOperationsHoursFailure(new ApiClientError('최신 정보를 확인해주세요.', 409, 'OPS_RESOURCE_CHANGED')),
    { kind: 'error', message: '최신 정보를 확인해주세요.', requiresReload: true },
  );
  assert.deepEqual(
    presentOperationsHoursFailure(new ApiClientError('이미 예외가 있습니다.', 409, 'OPERATING_HOUR_OVERRIDE_EXISTS')),
    { kind: 'existing_override', message: '이미 예외가 있습니다.', requiresReload: false },
  );
});
