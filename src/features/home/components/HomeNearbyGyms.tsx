import { useMemo } from 'react';
import { GYM_SEARCH_ITEMS } from '../../../mocks/gym-search';
import { HomeSectionShell } from './HomeSectionShell';

interface HomeNearbyGymsProps {
  onGymClick: () => void;
  onOpen: () => void;
}

export function HomeNearbyGyms({ onGymClick, onOpen }: HomeNearbyGymsProps) {
  const recommendedGyms = useMemo(() => {
    const gyms = [...GYM_SEARCH_ITEMS];

    for (let i = gyms.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [gyms[i], gyms[randomIndex]] = [gyms[randomIndex], gyms[i]];
    }

    return gyms.slice(0, 3);
  }, []);

  return (
    <HomeSectionShell title="추천 암장" onAction={onOpen} actionLabel="더보기" bordered={false}>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5">
        {recommendedGyms.map((gym) => (
          <div key={gym.id} onClick={onGymClick} className="flex-shrink-0 w-[280px] border border-neutral-200 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500 transition-colors bg-white">
            <div className="h-40 bg-neutral-200 relative">
              <img src={gym.image} alt={gym.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-3 bg-white">
              <h4 className="font-semibold text-[14px] mb-0.5">{gym.name}</h4>
              <div className="flex items-center gap-2 text-[13px] text-neutral-500">
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">{gym.address || gym.description}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </HomeSectionShell>
  );
}
