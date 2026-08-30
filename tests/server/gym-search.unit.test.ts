import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGymSearchTokens } from '../../src/server/gyms/gym-search';
import { listGymsSchema } from '../../src/server/gyms/gym-validation';

test('Korean gym search normalizes administrative region tokens without romanized aliases', () => {
  assert.deepEqual(normalizeGymSearchTokens('서울특별시 종로구'), ['서울', '종로']);
  assert.deepEqual(normalizeGymSearchTokens('서울시   종로'), ['서울', '종로']);
  assert.deepEqual(normalizeGymSearchTokens('경기도 성남시'), ['경기', '성남']);
  assert.deepEqual(normalizeGymSearchTokens('  '), []);
  assert.deepEqual(normalizeGymSearchTokens('Seoul jongno'), ['seoul', 'jongno']);
});

test('gym search validation trims empty queries and rejects unsafe lengths', () => {
  assert.equal(listGymsSchema.parse({ q: '   ', limit: 10 }).q, '');
  assert.equal(listGymsSchema.parse({ q: ' 서울 종로 ', limit: 10 }).q, '서울 종로');
  assert.equal(listGymsSchema.safeParse({ q: '가'.repeat(101) }).success, false);
  assert.equal(listGymsSchema.safeParse({ regionCode: '  ' }).success, false);
  assert.equal(listGymsSchema.parse({ regionCode: ' 11110 ' }).regionCode, '11110');
});
