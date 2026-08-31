import assert from 'node:assert/strict';
import test from 'node:test';
import {
  batchOperatingHourOverridesSchema,
  createOperationsGymSchema,
  parseOperatingHoursInput,
  replaceOperatingHourOverrideSchema,
  replaceWeeklyOperatingHoursSchema,
  updateOperationsGymSchema,
  updateOperationsGymStatusSchema,
} from '../../src/server/operations/operations-gym-validation';
import { ApiError } from '../../src/server/http/api-error';

const validGym = {
  name: '테스트 클라이밍',
  branchName: null,
  address: '서울특별시 종로구 테스트로 1',
  phone: null,
  websiteUrl: 'https://example.com',
  instagramUrl: null,
  nearbyDirections: null,
  operatingHoursNote: null,
  parkingInfo: null,
  calendarColor: '#2563eb',
  calendarTextColor: '#ffffff',
  facilities: ['샤워실', '주차'],
  dayPassPrice: { amount: 20000, rawText: '20,000원' },
  shoeRentalPrice: null,
};

test('operations gym validation accepts a complete base-information payload', () => {
  const parsed = createOperationsGymSchema.parse(validGym);
  assert.equal(parsed.operationStatus, 'active');
  assert.equal(parsed.dayPassPrice?.amount, 20000);
});

test('operations gym validation rejects insecure URLs, invalid colors, and invalid facilities', () => {
  assert.equal(createOperationsGymSchema.safeParse({ ...validGym, websiteUrl: 'http://example.com' }).success, false);
  assert.equal(createOperationsGymSchema.safeParse({ ...validGym, websiteUrl: 'https://' }).success, false);
  assert.equal(createOperationsGymSchema.safeParse({ ...validGym, calendarColor: '#fff' }).success, false);
  assert.equal(createOperationsGymSchema.safeParse({ ...validGym, facilities: [''] }).success, false);
});

test('operations gym updates require an RFC3339 version and status updates are strict', () => {
  assert.equal(updateOperationsGymSchema.safeParse({ ...validGym }).success, false);
  assert.equal(updateOperationsGymSchema.safeParse({ ...validGym, expectedUpdatedAt: '2026-08-30T08:00:00Z' }).success, true);
  assert.equal(updateOperationsGymStatusSchema.safeParse({ operationStatus: 'closed', expectedUpdatedAt: '2026-08-30T08:00:00Z' }).success, true);
  assert.equal(updateOperationsGymStatusSchema.safeParse({ operationStatus: 'paused', expectedUpdatedAt: '2026-08-30T08:00:00Z' }).success, false);
});

test('operating-hours validation accepts ordered multi-interval schedules and normalizes seconds', () => {
  const expectedUpdatedAt = new Date().toISOString();
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek === 0,
    intervals: dayOfWeek === 0 ? [] : [
      { opensAt: '10:00', closesAt: '14:00' },
      { opensAt: '16:00', closesAt: '22:00' },
    ],
  }));
  const parsed = replaceWeeklyOperatingHoursSchema.parse({ days, expectedUpdatedAt });
  assert.equal(parsed.days[1].intervals[0].opensAt, '10:00:00');
  assert.equal(parsed.days[1].intervals[1].closesAt, '22:00:00');
});

test('operating-hours validation rejects contradictory, overlapping, and overlong exceptions', () => {
  const expectedUpdatedAt = new Date().toISOString();
  const contradictory = {
    isClosed: true,
    intervals: [{ opensAt: '10:00', closesAt: '22:00' }],
    note: null,
    expectedUpdatedAt,
  };
  assert.equal(replaceOperatingHourOverrideSchema.safeParse(contradictory).success, false);
  assert.throws(
    () => parseOperatingHoursInput(replaceOperatingHourOverrideSchema, contradictory),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_OPERATING_HOURS',
  );
  assert.equal(replaceOperatingHourOverrideSchema.safeParse({
    isClosed: false,
    intervals: [
      { opensAt: '10:00', closesAt: '18:00' },
      { opensAt: '17:00', closesAt: '22:00' },
    ],
    note: null,
    expectedUpdatedAt,
  }).success, false);
  assert.equal(batchOperatingHourOverridesSchema.safeParse({
    startDate: '2026-09-01',
    endDate: '2026-12-02',
    isClosed: true,
    intervals: [],
    note: '장기 휴무',
    overwriteExisting: false,
    expectedUpdatedAt,
  }).success, false);
  assert.equal(batchOperatingHourOverridesSchema.safeParse({
    startDate: '2026-02-30',
    endDate: '2026-03-01',
    isClosed: true,
    intervals: [],
    note: null,
    overwriteExisting: false,
    expectedUpdatedAt,
  }).success, false);
});
