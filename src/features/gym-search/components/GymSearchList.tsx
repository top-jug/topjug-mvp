import GymSearchCard from './GymSearchCard';
import { GymSearchItem } from '../../../entities/gym/types';

interface GymSearchListProps {
  gyms: GymSearchItem[];
  onSelectGym: (gym: GymSearchItem) => void;
  title: string;
  showMapButton?: boolean;
}

export default function GymSearchList({ gyms, onSelectGym, title, showMapButton = false }: GymSearchListProps) {
  return (
    <div className="pb-24 min-h-screen">
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">{gyms.length}개의 {title}</h2>
          {showMapButton && <button className="text-[13px] text-blue-500 font-medium">지도 보기</button>}
        </div>

        <div className="space-y-3">
          {gyms.map((gym) => (
            <GymSearchCard key={gym.id} gym={gym} onClick={() => onSelectGym(gym)} />
          ))}
        </div>
      </div>
    </div>
  );
}
