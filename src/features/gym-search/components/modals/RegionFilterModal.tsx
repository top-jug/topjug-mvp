import RecordModalShell from '../../../record/components/modals/RecordModalShell';
import { RegionMap } from '../../../../entities/gym/types';

interface RegionFilterModalProps {
  showSubRegion: boolean;
  selectedRegion: string;
  selectedSubRegion: string | null;
  regions: string[];
  subRegions: RegionMap;
  onBack: () => void;
  onClose: () => void;
  onSelectRegion: (region: string) => void;
  onSelectSubRegion: (subRegion: string | null) => void;
}

export default function RegionFilterModal(props: RegionFilterModalProps) {
  const { showSubRegion, selectedRegion, selectedSubRegion, regions, subRegions, onBack, onClose, onSelectRegion, onSelectSubRegion } = props;

  return (
    <RecordModalShell onClose={onClose} panelClassName="bg-white rounded-3xl w-[340px] shadow-2xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          {showSubRegion ? (
            <button onClick={onBack} className="flex items-center gap-2 text-neutral-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <h3 className="text-lg font-bold">세부 지역 선택</h3>
            </button>
          ) : (
            <h3 className="text-lg font-bold">지역 선택</h3>
          )}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!showSubRegion ? (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {regions.map((region) => (
                <button
                  key={region}
                  onClick={() => onSelectRegion(region)}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                    selectedRegion === region ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {['서울', '경기'].includes(selectedRegion) && (
                <button
                  onClick={() => onSelectSubRegion(null)}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                    selectedSubRegion === null ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  전체
                </button>
              )}
              {subRegions[selectedRegion]?.map((subRegion) => (
                <button
                  key={subRegion}
                  onClick={() => onSelectSubRegion(subRegion)}
                  className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                    selectedSubRegion === subRegion ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {subRegion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </RecordModalShell>
  );
}
