import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_GYM_REGION_BY_EXTERNAL_ID, initialGymRegionCode } from '../../src/server/regions/initial-gym-regions';

test('all 31 initial source IDs have reviewed deterministic second-level regions', () => {
  assert.equal(Object.keys(INITIAL_GYM_REGION_BY_EXTERNAL_ID).length, 31);
  assert.equal(new Set(Object.keys(INITIAL_GYM_REGION_BY_EXTERNAL_ID)).size, 31);
  assert.ok(Object.values(INITIAL_GYM_REGION_BY_EXTERNAL_ID).every((code) => /^\d{5}$/.test(code)));

  assert.equal(initialGymRegionCode('1488f92d278357e800a8872640815641'), '11620'); // 사당 branch, 관악구 address
  assert.equal(initialGymRegionCode('bf7ce40006bc6c3d5e45f695d1d45399'), '11650'); // 논현 branch, 서초구 address
  assert.equal(initialGymRegionCode('656f829ce20960af4db592cb39ce6d75'), '11710'); // 잠실, 송파구
  assert.equal(initialGymRegionCode('unknown'), undefined);
});
