import { ActiveGyms, CalendarGym } from '../../../entities/calendar/types';
import {
  areAllCalendarGymsSelected,
  areAllCalendarStatusesSelected,
  hasCalendarFilters,
  type ActiveStatuses,
  type CalendarStatus,
} from '../calendar-filters';

interface CalendarFilterBarProps {
  gyms: CalendarGym[];
  activeGyms: ActiveGyms;
  onToggleGym: (gymId: string) => void;
  onToggleAll: () => void;
  onResetFilters: () => void;
  activeStatuses?: ActiveStatuses;
  onToggleStatus?: (status: CalendarStatus) => void;
  onToggleAllStatuses?: () => void;
}

const STATUS_OPTIONS: Array<{ status: CalendarStatus; label: string }> = [
  { status: 'scheduled', label: '예정' },
  { status: 'completed', label: '완료' },
  { status: 'cancelled', label: '취소' },
];

export default function CalendarFilterBar({
  gyms,
  activeGyms,
  onToggleGym,
  onToggleAll,
  onResetFilters,
  activeStatuses,
  onToggleStatus,
  onToggleAllStatuses,
}: CalendarFilterBarProps) {
  const allGymsSelected = areAllCalendarGymsSelected(activeGyms, gyms);
  const allStatusesSelected = activeStatuses ? areAllCalendarStatusesSelected(activeStatuses) : true;
  const isFiltered = hasCalendarFilters(activeGyms, gyms, activeStatuses);

  return (
    <div className="space-y-2 bg-white px-5 pb-3 pt-2">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-[12px] font-bold text-neutral-500">암장</span>
        {isFiltered && (
          <button
            type="button"
            onClick={onResetFilters}
            className="min-h-7 rounded-full px-2 text-[12px] font-semibold text-blue-700"
          >
            초기화
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="암장 필터">
        <button
          type="button"
          onClick={onToggleAll}
          aria-pressed={allGymsSelected}
          className={`min-h-11 flex-shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${
            allGymsSelected ? 'bg-blue-700 text-white' : 'border border-neutral-200 bg-white text-neutral-700'
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
              className={`flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-[14px] font-medium transition-colors ${
                isActive ? 'bg-blue-700 text-white' : 'border border-neutral-200 bg-white text-neutral-700'
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
      {activeStatuses && onToggleStatus && onToggleAllStatuses && (
        <div>
          <div className="mb-1 text-[12px] font-bold text-neutral-500">상태</div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="일정 상태 필터">
            <button
              type="button"
              onClick={onToggleAllStatuses}
              aria-pressed={allStatusesSelected}
              className={`min-h-11 flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${allStatusesSelected ? 'bg-neutral-800 text-white' : 'border border-neutral-200 bg-white text-neutral-600'}`}
            >
              전체
            </button>
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
        </div>
      )}
    </div>
  );
}
