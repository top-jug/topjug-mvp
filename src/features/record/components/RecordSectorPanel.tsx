import RecordRouteList from './RecordRouteList';
import { DifficultyOption, RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';

interface RecordSectorPanelProps {
  title: string;
  sectorId: Exclude<RecordSectorId, 'easy'>;
  expanded: boolean;
  onToggle: () => void;
  difficulties: DifficultyOption[];
  routeCounts: RouteCounts;
  onCountChange: (sectorId: RecordSectorId, routeIndex: number, type: RecordCountType, delta: number) => void;
}

export default function RecordSectorPanel(props: RecordSectorPanelProps) {
  const { title, sectorId, expanded, onToggle, difficulties, routeCounts, onCountChange } = props;

  return (
    <div className="bg-neutral-50 rounded-2xl p-4">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between mb-4 text-left">
        <div className="flex items-center gap-2">
          <div className="cursor-pointer">
            <h4 className="text-[14px] font-semibold">{title}</h4>
          </div>
        </div>
        <svg
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
      </button>
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
