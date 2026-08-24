import { ActiveGyms, CalendarGym } from '../../../entities/calendar/types';
import type { ActiveStatuses, CalendarStatus } from '../calendar-filters';

interface CalendarFilterBarProps {
  gyms: CalendarGym[];
  activeGyms: ActiveGyms;
  onToggleGym: (gymId: string) => void;
  onToggleAll: () => void;
  activeStatuses?: ActiveStatuses;
  onToggleStatus?: (status: CalendarStatus) => void;
}

const STATUS_OPTIONS: Array<{ status: CalendarStatus; label: string }> = [
  { status: 'scheduled', label: '예정' },
  { status: 'completed', label: '완료' },
  { status: 'cancelled', label: '취소' },
];

export default function CalendarFilterBar({ gyms, activeGyms, onToggleGym, onToggleAll, activeStatuses, onToggleStatus }: CalendarFilterBarProps) {
  const allSelected = gyms.length > 0 && gyms.every((gym) => activeGyms[gym.id]);

  return (
    <div className="px-5 pb-3 pt-2 bg-white">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={onToggleAll}
          aria-pressed={allSelected}
          className={`px-4 py-2 rounded-full text-[14px] font-medium transition-colors flex-shrink-0 ${
            allSelected ? 'bg-blue-500 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
          }`}
        >
          전체
        </button>
        {gyms.map((gym) => {
          const isActive = activeGyms[gym.id];

          return (
            <button
              type="button"
              key={gym.id}
              onClick={() => onToggleGym(gym.id)}
              aria-pressed={Boolean(isActive)}
              className={`px-2 py-1.5 rounded-full text-[14px] font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                isActive ? 'bg-blue-500 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
              }`}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: gym.lightBg, color: gym.darkText }}>
                {gym.name.slice(0, 1)}
              </div>
              <span>{gym.name}</span>
            </button>
          );
        })}
      </div>
      {activeStatuses && onToggleStatus && (
        <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="일정 상태 필터">
          {STATUS_OPTIONS.map(({ status, label }) => (
            <button
              type="button"
              key={status}
              onClick={() => onToggleStatus(status)}
              aria-pressed={activeStatuses[status]}
              className={`min-h-11 flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${activeStatuses[status] ? 'bg-neutral-800 text-white' : 'border border-neutral-200 bg-white text-neutral-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
