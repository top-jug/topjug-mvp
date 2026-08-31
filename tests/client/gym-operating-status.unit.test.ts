import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGymTodayOperatingStatus } from '../../src/entities/gym/operating-status';

const mondayHours = [
  { dayOfWeek: 1, sequence: 0, opensAt: '10:00:00', closesAt: '14:00:00', isClosed: false },
  { dayOfWeek: 1, sequence: 1, opensAt: '16:00:00', closesAt: '22:00:00', isClosed: false },
];

test('today operating status follows Seoul time across opening intervals', () => {
  assert.equal(resolveGymTodayOperatingStatus(mondayHours, [], new Date('2026-08-30T15:30:00Z')).state, 'before_open');
  assert.equal(resolveGymTodayOperatingStatus(mondayHours, [], new Date('2026-08-31T03:00:00Z')).state, 'open');
  assert.equal(resolveGymTodayOperatingStatus(mondayHours, [], new Date('2026-08-31T06:00:00Z')).state, 'between_intervals');
  assert.equal(resolveGymTodayOperatingStatus(mondayHours, [], new Date('2026-08-31T13:00:00Z')).state, 'after_close');
});

test('today date exception takes priority over the weekly schedule', () => {
  const status = resolveGymTodayOperatingStatus(mondayHours, [{
    date: '2026-08-31',
    sequence: 0,
    opensAt: null,
    closesAt: null,
    isClosed: true,
  }], new Date('2026-08-31T03:00:00Z'));

  assert.deepEqual(status, {
    date: '2026-08-31',
    state: 'closed',
    source: 'override',
    opensAt: null,
    closesAt: null,
  });
});

test('missing hours remain distinct from a configured closed day', () => {
  assert.deepEqual(resolveGymTodayOperatingStatus([], [], new Date('2026-08-31T03:00:00Z')), {
    date: '2026-08-31',
    state: 'hours_unavailable',
    source: null,
    opensAt: null,
    closesAt: null,
  });
});
