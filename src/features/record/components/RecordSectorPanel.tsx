import RecordRouteList from './RecordRouteList';
import { DifficultyOption, RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';

interface RecordSectorPanelProps {
  title: string;
  sectorId: Exclude<RecordSectorId, 'easy'>;
  expanded: boolean;
  onToggle: () => void;
  onShowWallInfo: () => void;
  difficulties: DifficultyOption[];
  routeCounts: RouteCounts;
  onCountChange: (sectorId: RecordSectorId, routeIndex: number, type: RecordCountType, delta: number) => void;
}

export default function RecordSectorPanel(props: RecordSectorPanelProps) {
  const { title, sectorId, expanded, onToggle, onShowWallInfo, difficulties, routeCounts, onCountChange } = props;

  return (
    <div className="bg-neutral-50 rounded-2xl p-4">
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div onClick={onToggle} className="cursor-pointer">
            <h4 className="text-[14px] font-semibold">{title}</h4>
          </div>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onShowWallInfo();
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">i</span>
            <span className="text-[11px] text-blue-500 font-medium">벽정보</span>
          </button>
        </div>
        <svg
          onClick={onToggle}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform cursor-pointer ${expanded ? '' : '-rotate-90'}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {expanded && (
        <RecordRouteList
          difficulties={difficulties}
          sectorId={sectorId}
          routeCounts={routeCounts}
          onCountChange={onCountChange}
        />
      )}
    </div>
  );
}
