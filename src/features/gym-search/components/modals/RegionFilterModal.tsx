import RecordModalShell from '../../../record/components/modals/RecordModalShell';

interface RegionFilterModalProps {
  selectedRegion: string;
  regions: string[];
  onClose: () => void;
  onSelectRegion: (region: string) => void;
}

export default function RegionFilterModal(props: RegionFilterModalProps) {
  const { selectedRegion, regions, onClose, onSelectRegion } = props;

  return (
    <RecordModalShell onClose={onClose} panelClassName="bg-white rounded-3xl w-[340px] shadow-2xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">지역 선택</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center" aria-label="지역 선택 닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <button
                type="button"
                key={region}
                onClick={() => onSelectRegion(region)}
                aria-pressed={selectedRegion === region}
                className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
                  selectedRegion === region ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      </div>
    </RecordModalShell>
  );
}
