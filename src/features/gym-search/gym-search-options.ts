import { type ApiGymSummary, displayGymName } from '../../app/api/gym-api';

export const ALL_GYM_REGIONS = '전체 지역';
export const GYM_SEARCH_PLACEHOLDER = '암장 이름, 지점 또는 주소 검색';
export const GYM_SEARCH_REGIONS = [ALL_GYM_REGIONS, '서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종'];
export const GYM_SEARCH_TABS = ['전체', '샤워실', '킬터보드', '스트레칭', '주차가능'];

const ADDRESS_REGION_BY_PREFIX: Record<string, string> = {
  서울: '서울',
  서울시: '서울',
  서울특별시: '서울',
  경기: '경기',
  경기도: '경기',
  고양시: '경기',
  성남시: '경기',
  인천: '인천',
  인천광역시: '인천',
  부산: '부산',
  부산광역시: '부산',
  대구: '대구',
  대구광역시: '대구',
  대전: '대전',
  대전광역시: '대전',
  광주: '광주',
  광주광역시: '광주',
  울산: '울산',
  울산광역시: '울산',
  세종: '세종',
  세종특별자치시: '세종',
};

export function regionFromAddress(address: string) {
  const [prefix = ''] = address.trim().split(/\s+/);
  return ADDRESS_REGION_BY_PREFIX[prefix] ?? null;
}

export function gymMatchesRegion(
  gym: Pick<ApiGymSummary, 'address' | 'regionCode'>,
  selectedRegion: string,
) {
  if (selectedRegion === ALL_GYM_REGIONS) return true;
  const canonicalRegionCode = gym.regionCode && ADDRESS_REGION_BY_PREFIX[gym.regionCode];
  return (canonicalRegionCode ?? regionFromAddress(gym.address)) === selectedRegion;
}

export function gymCardActionLabel(gym: Pick<ApiGymSummary, 'name' | 'branchName'>) {
  return `${displayGymName(gym)} 상세 보기`;
}

export function gymCardPrimaryAction(
  gym: Pick<ApiGymSummary, 'name' | 'branchName'>,
  onActivate: () => void,
) {
  return {
    type: 'button' as const,
    onClick: onActivate,
    'aria-label': gymCardActionLabel(gym),
  };
}
