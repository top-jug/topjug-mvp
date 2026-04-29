import RecordCountButton from './RecordCountButton';
import { DifficultyOption, RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';

interface RecordRouteListProps {
  difficulties: DifficultyOption[];
  sectorId: RecordSectorId;
  routeCounts: RouteCounts;
  onCountChange: (sectorId: RecordSectorId, routeIndex: number, type: RecordCountType, delta: number) => void;
}

export default function RecordRouteList({ difficulties, sectorId, routeCounts, onCountChange }: RecordRouteListProps) {
  return (
    <div className="space-y-3">
      {difficulties.map((route, index) => {
        const key = `${sectorId}-${index}`;
        const counts = routeCounts[key] || { success: 0, attempt: 0 };

        return (
          <div key={key} className="bg-white rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-[100px]">
                <div className={`w-5 h-5 ${route.color} rounded-full`}></div>
                <span className="text-[14px] font-medium">{route.name} ({route.grade})</span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1 text-center">성공</div>
                  <div className="flex items-center justify-center">
                    <RecordCountButton
                      value={counts.success}
                      colorClassName="bg-green-500 active:bg-green-600"
                      onChange={(delta) => onCountChange(sectorId, index, 'success', delta)}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1 text-center">시도</div>
                  <div className="flex items-center justify-center">
                    <RecordCountButton
                      value={counts.attempt}
                      colorClassName="bg-blue-500 active:bg-blue-600"
                      onChange={(delta) => onCountChange(sectorId, index, 'attempt', delta)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
