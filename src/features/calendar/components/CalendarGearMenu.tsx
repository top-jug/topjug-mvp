import { ActiveGyms, CalendarGym } from '../../../entities/calendar/types';
import BottomSheet from '../../../app/components/overlay/BottomSheet';

interface CalendarGearMenuProps {
  gyms: CalendarGym[];
  activeGyms: ActiveGyms;
  onSelectAll: () => void;
  onToggleGym: (gymId: string) => void;
  onClose: () => void;
}

export default function CalendarGearMenu({ gyms, activeGyms, onSelectAll, onToggleGym, onClose }: CalendarGearMenuProps) {
  const allSelected = gyms.length > 0 && gyms.every((gym) => activeGyms[gym.id]);

  return (
    <BottomSheet onClose={onClose} title="암장 필터" description="캘린더에 표시할 암장을 선택합니다." maxHeightClassName="mobile-bottom-sheet-max-h-70">
          <button
            onClick={onSelectAll}
            aria-pressed={allSelected}
            className={`w-full py-4 rounded-full text-[17px] font-semibold transition-colors mb-5 ${allSelected ? 'bg-blue-700 text-white' : 'bg-neutral-100 text-neutral-700'}`}
          >
            전체 선택
          </button>
          <div className="grid grid-cols-2 gap-4">
{gyms.map((gym) => (
              <button
                key={gym.id}
                onClick={() => onToggleGym(gym.id)}
                aria-pressed={Boolean(activeGyms[gym.id])}
                className={`py-3 rounded-full text-[15px] font-medium transition-colors flex items-center gap-2 ${
                  activeGyms[gym.id] ? 'bg-blue-700 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: activeGyms[gym.id] ? 'rgba(255,255,255,0.3)' : gym.lightBg, color: activeGyms[gym.id] ? 'white' : gym.darkText }}>
                  {gym.name.slice(0, 1)}
                </div>
                <span>{gym.name}</span>
              </button>
            ))}
          </div>
    </BottomSheet>
  );
}
