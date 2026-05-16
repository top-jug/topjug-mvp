import GymSearchCard from './GymSearchCard';
import { GymSearchItem } from '../../../entities/gym/types';

interface GymSearchListProps {
  gyms: GymSearchItem[];
  onSelectGym: (gym: GymSearchItem) => void;
  title: string;
  isSavedGym: (gymId: number) => boolean;
  onToggleSavedGym: (gymId: number) => void;
  showMapButton?: boolean;
  countOverride?: number;
}

export default function GymSearchList({ gyms, onSelectGym, title, isSavedGym, onToggleSavedGym, showMapButton = false, countOverride }: GymSearchListProps) {
  return (
    <div className="pb-24 min-h-screen">
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">{countOverride ?? gyms.length}개의 {title}</h2>
        </div>

        <div className="space-y-3">
          {gyms.map((gym) => (
            <GymSearchCard
              key={gym.id}
              gym={gym}
              onClick={() => onSelectGym(gym)}
              isSaved={isSavedGym(gym.id)}
              onToggleSaved={() => onToggleSavedGym(gym.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
