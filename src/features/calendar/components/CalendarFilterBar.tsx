import { ActiveGyms, CalendarGym } from '../../../entities/calendar/types';

interface CalendarFilterBarProps {
  gyms: CalendarGym[];
  activeGyms: ActiveGyms;
  onOpenFilter?: () => void;
}

export default function CalendarFilterBar({ gyms, activeGyms, onOpenFilter }: CalendarFilterBarProps) {
  const allSelected = gyms.length > 0 && gyms.every((gym) => activeGyms[gym.name]);

  return (
    <div className="px-5 pb-3 pt-2 bg-white">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`px-4 py-2 rounded-full text-[14px] font-medium transition-colors flex-shrink-0 ${allSelected ? 'bg-blue-500 text-white' : 'bg-white border border-neutral-200 text-neutral-700'}`}>
          전체
        </div>
        {gyms.map((gym) => {
          const isActive = activeGyms[gym.name];

          return (
            <div
              key={gym.name}
              className={`px-2 py-1.5 rounded-full text-[14px] font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                isActive ? 'bg-blue-500 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
              }`}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: gym.lightBg, color: gym.darkText }}>
                {gym.name.slice(0, 1)}
              </div>
              <span>{gym.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
