import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiGymSummary } from '../../src/app/api/gym-api';
import type { ApiRegion } from '../../src/app/api/region-api';
import {
  ALL_GYM_REGIONS,
  GYM_SEARCH_PLACEHOLDER,
  childRegions,
  firstLevelRegions,
  gymCardActionLabel,
  gymCardPrimaryAction,
  initialRegionSelection,
  regionSelectionLabel,
  updateRegionSelection,
} from '../../src/features/gym-search/gym-search-options';

function gym(overrides: Partial<ApiGymSummary> = {}): ApiGymSummary {
  return {
    id: 'gym-1',
    name: '부산볼더링',
    branchName: null,
    address: '부산광역시 수영구 광안해변로 1',
    regionCode: null,
    latitude: null,
    longitude: null,
    operationStatus: 'active',
    facilities: [],
    calendarColor: null,
    calendarTextColor: null,
    brand: null,
    cover: null,
    tags: [],
    dayPassPrice: null,
    ...overrides,
  };
}

test('canonical catalog drives first and second-level selection labels', () => {
  const regions: ApiRegion[] = [
    { code: '11', name: '서울특별시', level: 1, parentCode: null, sortOrder: 10 },
    { code: '41', name: '경기도', level: 1, parentCode: null, sortOrder: 20 },
    { code: '11110', name: '종로구', level: 2, parentCode: '11', sortOrder: 10 },
  ];

  assert.deepEqual(firstLevelRegions(regions).map((region) => region.code), ['11', '41']);
  assert.deepEqual(childRegions(regions, '11').map((region) => region.code), ['11110']);
  assert.equal(regionSelectionLabel(regions, null), ALL_GYM_REGIONS);
  assert.equal(regionSelectionLabel(regions, '11'), '서울 전체');
  assert.equal(regionSelectionLabel(regions, '11110'), '서울 · 종로구');
  assert.equal(regionSelectionLabel(regions, 'unknown'), ALL_GYM_REGIONS);
});

test('region selector preserves committed state across parent, child, back, cancel, and apply flow', () => {
  const regions: ApiRegion[] = [
    { code: '11', name: '서울특별시', level: 1, parentCode: null, sortOrder: 10 },
    { code: '11110', name: '종로구', level: 2, parentCode: '11', sortOrder: 10 },
  ];
  const committedCode = '11110';
  let state = initialRegionSelection(regions, committedCode);
  assert.deepEqual(state, { draftCode: '11110', activeParentCode: '11' });

  state = updateRegionSelection(state, { type: 'back' });
  assert.equal(state.activeParentCode, null);
  state = updateRegionSelection(state, { type: 'openParent', code: '11' });
  assert.deepEqual(state, { draftCode: '11', activeParentCode: '11' });
  state = updateRegionSelection(state, { type: 'select', code: '11110' });
  assert.equal(state.draftCode, '11110');

  assert.equal(committedCode, '11110'); // cancel does not publish the draft
  const appliedCode = state.draftCode;
  assert.equal(appliedCode, '11110');
});

test('search placeholder describes only q searchable fields', () => {
  assert.equal(GYM_SEARCH_PLACEHOLDER, '암장 이름, 지점 또는 주소 검색');
  assert.doesNotMatch(GYM_SEARCH_PLACEHOLDER, /시설/);
});

test('gym card primary action has a specific accessible label', () => {
  assert.equal(gymCardActionLabel(gym({ name: '더클라임', branchName: '마곡' })), '더클라임 마곡 상세 보기');
});

test('gym card primary action uses native button semantics and activates once', () => {
  let activationCount = 0;
  const action = gymCardPrimaryAction(
    gym({ name: '손상원 판교', branchName: '판교' }),
    () => { activationCount += 1; },
  );

  assert.equal(action.type, 'button');
  assert.equal(action['aria-label'], '손상원 판교 상세 보기');
  assert.equal('onKeyDown' in action, false);
  action.onClick();
  assert.equal(activationCount, 1);
});
