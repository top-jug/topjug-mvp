import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { INITIAL_GYM_REGION_BY_EXTERNAL_ID, assignInitialGymRegions, initialGymRegionCode } from '../../src/server/regions/initial-gym-regions';

test('all 31 initial source IDs have reviewed deterministic second-level regions', () => {
  assert.equal(Object.keys(INITIAL_GYM_REGION_BY_EXTERNAL_ID).length, 31);
  assert.equal(new Set(Object.keys(INITIAL_GYM_REGION_BY_EXTERNAL_ID)).size, 31);
  assert.ok(Object.values(INITIAL_GYM_REGION_BY_EXTERNAL_ID).every((code) => /^\d{5}$/.test(code)));

  assert.equal(initialGymRegionCode('1488f92d278357e800a8872640815641'), '11620'); // 사당 branch, 관악구 address
  assert.equal(initialGymRegionCode('bf7ce40006bc6c3d5e45f695d1d45399'), '11650'); // 논현 branch, 서초구 address
  assert.equal(initialGymRegionCode('656f829ce20960af4db592cb39ce6d75'), '11710'); // 잠실, 송파구
  assert.equal(initialGymRegionCode('unknown'), undefined);
});

test('importer assignment flow requires every reviewed source exactly once', () => {
  const sourceRows = Object.keys(INITIAL_GYM_REGION_BY_EXTERNAL_ID).map((externalId) => ({ externalId, location: externalId }));
  const assigned = assignInitialGymRegions(sourceRows);
  assert.deepEqual(
    Object.fromEntries(assigned.map((row) => [row.externalId, row.regionCode])),
    INITIAL_GYM_REGION_BY_EXTERNAL_ID,
  );
  assert.throws(() => assignInitialGymRegions(sourceRows.slice(1)), /without imported gyms/);
  assert.throws(() => assignInitialGymRegions([...sourceRows, sourceRows[0]!]), /Duplicate source IDs/);
  assert.throws(() => assignInitialGymRegions([...sourceRows.slice(1), { externalId: 'f'.repeat(32), location: 'unknown' }]), /Missing region mappings/);
});

test('migration and importer contain the exact same reviewed assignments', () => {
  const migration = readFileSync(new URL('../../drizzle/0002_korean_region_catalog.sql', import.meta.url), 'utf8');
  const assignmentSql = migration.match(/INSERT INTO "expected_initial_gym_regions"[\s\S]*?VALUES([\s\S]*?);/)?.[1];
  assert.ok(assignmentSql);
  const migrationAssignments = Object.fromEntries(
    [...assignmentSql.matchAll(/\('([0-9a-f]{32})','(\d{5})'\)/g)].map((match) => [match[1], match[2]]),
  );
  assert.deepEqual(migrationAssignments, INITIAL_GYM_REGION_BY_EXTERNAL_ID);
});

test('catalog uses the July 2026 Incheon structure and excludes obsolete districts', () => {
  const migration = readFileSync(new URL('../../drizzle/0002_korean_region_catalog.sql', import.meta.url), 'utf8');
  for (const [code, name] of [['28125', '제물포구'], ['28155', '영종구'], ['28275', '서해구'], ['28290', '검단구']]) {
    assert.match(migration, new RegExp(`\\('${code}','28','${name}'\\)`));
  }
  for (const code of ['28110', '28140', '28260']) assert.doesNotMatch(migration, new RegExp(`\\('${code}','28'`));
});
