import { useReducer } from 'react';
import type { ApiRegion } from '../../../../app/api/region-api';
import { childRegions, firstLevelRegions, initialRegionSelection, updateRegionSelection } from '../../gym-search-options';
import RecordModalShell from '../../../record/components/modals/RecordModalShell';

interface RegionFilterModalProps {
  selectedRegionCode: string | null;
  regions: ApiRegion[];
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onApply: (regionCode: string | null) => void;
}

export default function RegionFilterModal(props: RegionFilterModalProps) {
  const { selectedRegionCode, regions, error, onRetry, onClose, onApply } = props;
  const [selection, dispatch] = useReducer(updateRegionSelection, initialRegionSelection(regions, selectedRegionCode));
  const { draftCode, activeParentCode } = selection;
  const firstLevel = firstLevelRegions(regions);
  const activeParent = firstLevel.find((region) => region.code === activeParentCode);
  const children = activeParent ? childRegions(regions, activeParent.code) : [];

  return (
    <RecordModalShell onClose={onClose} title="지역 선택" description="시·도와 시·군·구를 차례로 선택한 뒤 적용합니다." panelClassName="w-[calc(100%-24px)] max-w-[380px] bg-white rounded-3xl shadow-2xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {activeParent && (
              <button type="button" onClick={() => dispatch({ type: 'back' })} className="min-w-8 min-h-8" aria-label="시·도 선택으로 돌아가기">←</button>
            )}
            <h3 className="text-lg font-bold">{activeParent?.name ?? '지역 선택'}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center" aria-label="지역 선택 닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 text-sm text-red-600">
            <span>{error}</span>
            <button type="button" onClick={onRetry} className="min-h-10 shrink-0 rounded-lg border border-red-200 px-3 font-semibold">다시 시도</button>
          </div>
        )}
        <div className="mb-6 max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {!activeParent && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'select', code: null })}
                aria-pressed={draftCode === null}
                className={`min-h-11 px-3 py-2 rounded-xl text-[13px] font-medium ${
                  draftCode === null ? 'bg-blue-700 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                전체 지역
              </button>
            )}
            {!activeParent && firstLevel.map((region) => (
              <button type="button" key={region.code} onClick={() => dispatch({ type: 'openParent', code: region.code })} className="min-h-11 px-3 py-2 rounded-xl bg-neutral-100 text-[13px] font-medium text-neutral-700">
                {region.name}
              </button>
            ))}
            {activeParent && [activeParent, ...children].map((region) => (
              <button
                type="button"
                key={region.code}
                onClick={() => dispatch({ type: 'select', code: region.code })}
                aria-pressed={draftCode === region.code}
                className={`min-h-11 px-3 py-2 rounded-xl text-[13px] font-medium ${draftCode === region.code ? 'bg-blue-700 text-white' : 'bg-neutral-100 text-neutral-700'}`}
              >
                {region.code === activeParent.code ? `${activeParent.name} 전체` : region.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-neutral-200 text-sm font-semibold">취소</button>
          <button type="button" onClick={() => onApply(draftCode)} disabled={regions.length === 0 && draftCode !== null} className="min-h-11 flex-1 rounded-xl bg-blue-700 text-sm font-semibold text-white disabled:opacity-50">적용</button>
        </div>
      </div>
    </RecordModalShell>
  );
}
