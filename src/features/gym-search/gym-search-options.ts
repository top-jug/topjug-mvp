import { type ApiGymSummary, displayGymName } from '../../app/api/gym-api';
import type { ApiRegion } from '../../app/api/region-api';

export const ALL_GYM_REGIONS = '전체 지역';
export const GYM_SEARCH_PLACEHOLDER = '암장 이름, 지점 또는 주소 검색';
export function firstLevelRegions(regions: ApiRegion[]) {
  return regions.filter((region) => region.level === 1 && region.parentCode === null);
}

export function childRegions(regions: ApiRegion[], parentCode: string) {
  return regions.filter((region) => region.level === 2 && region.parentCode === parentCode);
}

function shortRegionName(name: string) {
  return name.replace(/특별자치도$|특별자치시$|특별시$|광역시$|도$/, '');
}

export function regionSelectionLabel(regions: ApiRegion[], regionCode: string | null) {
  if (!regionCode) return ALL_GYM_REGIONS;
  const selected = regions.find((region) => region.code === regionCode);
  if (!selected) return ALL_GYM_REGIONS;
  if (!selected.parentCode) return `${shortRegionName(selected.name)} 전체`;
  const parent = regions.find((region) => region.code === selected.parentCode);
  return parent ? `${shortRegionName(parent.name)} · ${selected.name}` : selected.name;
}

export interface RegionSelectionState {
  draftCode: string | null;
  activeParentCode: string | null;
}

export type RegionSelectionAction =
  | { type: 'openParent'; code: string }
  | { type: 'select'; code: string | null }
  | { type: 'back' };

export function initialRegionSelection(regions: ApiRegion[], selectedCode: string | null): RegionSelectionState {
  const selected = regions.find((region) => region.code === selectedCode);
  return {
    draftCode: selectedCode,
    activeParentCode: selected?.parentCode ?? (selected?.level === 1 ? selected.code : null),
  };
}

export function updateRegionSelection(state: RegionSelectionState, action: RegionSelectionAction): RegionSelectionState {
  if (action.type === 'openParent') return { draftCode: action.code, activeParentCode: action.code };
  if (action.type === 'back') return { ...state, activeParentCode: null };
  return { ...state, draftCode: action.code };
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
