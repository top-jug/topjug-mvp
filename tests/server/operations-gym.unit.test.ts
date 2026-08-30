import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationsGymSchema,
  updateOperationsGymSchema,
  updateOperationsGymStatusSchema,
} from '../../src/server/operations/operations-gym-validation';

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
