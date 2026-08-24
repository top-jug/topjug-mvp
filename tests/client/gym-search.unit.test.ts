import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiGymSummary } from '../../src/app/api/gym-api';
import {
  ALL_GYM_REGIONS,
  GYM_SEARCH_PLACEHOLDER,
  GYM_SEARCH_REGIONS,
  gymCardActionLabel,
  gymCardPrimaryAction,
  gymMatchesRegion,
  regionFromAddress,
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

test('nationwide default preserves an exact imported gym-name result outside Seoul', () => {
  const exactNameResults = [gym({
    name: '손상원 판교',
    branchName: '판교',
    address: '성남시 분당구 대왕판교로 670 유스페이스2 B동 지하 1층',
  })].filter((result) => result.name === '손상원 판교');

  assert.equal(ALL_GYM_REGIONS, '전체 지역');
  assert.equal(GYM_SEARCH_REGIONS[0], ALL_GYM_REGIONS);
  assert.deepEqual(exactNameResults.filter((result) => gymMatchesRegion(result, ALL_GYM_REGIONS)), exactNameResults);
});

test('region matching uses canonical region codes and administrative address prefixes', () => {
  assert.equal(regionFromAddress('서울특별시 마포구 양화로 1'), '서울');
  assert.equal(regionFromAddress('경기도 수원시 팔달구 효원로 1'), '경기');
  assert.equal(regionFromAddress('인천광역시 연수구 송도동 1'), '인천');
  assert.equal(gymMatchesRegion(gym({ address: '대구광역시 중구 동성로 1' }), '대구'), true);
  assert.equal(gymMatchesRegion(gym({ address: '알 수 없는 주소', regionCode: '서울특별시' }), '서울'), true);
});

test('null-region imported Gyeonggi addresses resolve from every city form in the source data', () => {
  const importedAddresses = [
    '경기도 고양시 일산동구 중앙로 1160, 5층',
    '성남시 분당구 대왕판교로 670 유스페이스2 B동 지하 1층',
  ];

  for (const address of importedAddresses) {
    assert.equal(regionFromAddress(address), '경기');
    assert.equal(gymMatchesRegion(gym({ address, regionCode: null }), '경기'), true);
  }
  assert.equal(regionFromAddress('고양시 일산동구 중앙로 1160, 5층'), '경기');
});

test('unsupported marketing neighborhoods are not treated as address regions', () => {
  assert.equal(GYM_SEARCH_REGIONS.includes('홍대'), false);
  assert.equal(GYM_SEARCH_REGIONS.includes('신촌'), false);
  assert.equal(regionFromAddress('홍대입구역 9번 출구 앞'), null);
  assert.equal(gymMatchesRegion(gym({ address: '서울특별시 서대문구 신촌로 1' }), '신촌'), false);
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
