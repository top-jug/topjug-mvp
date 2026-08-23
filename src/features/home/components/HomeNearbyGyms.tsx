import { useEffect, useState } from 'react';
import { ApiGymSummary, displayGymName, listGyms } from '../../../app/api/gym-api';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import { HomeSectionShell } from './HomeSectionShell';

interface HomeNearbyGymsProps {
  onGymClick: (gymId: string) => void;
  onOpen: () => void;
}

export function HomeNearbyGyms({ onGymClick, onOpen }: HomeNearbyGymsProps) {
  const [gyms, setGyms] = useState<ApiGymSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    listGyms({ limit: 3, signal: controller.signal })
      .then((response) => setGyms(response.data))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setGyms([]);
      });
    return () => controller.abort();
  }, []);

  return (
    <HomeSectionShell title="추천 암장" onAction={onOpen} actionLabel="더보기" bordered={false}>
      {gyms.length === 0 ? (
        <div className="rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-400">추천 암장을 준비하고 있어요.</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5">
          {gyms.map((gym) => (
            <div key={gym.id} onClick={() => onGymClick(gym.id)} className="flex-shrink-0 w-[280px] border border-neutral-200 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500 transition-colors bg-white">
              <div className="h-40 bg-neutral-200 relative">
                {gym.cover?.url ? <ImageWithFallback src={gym.cover.url} alt={`${displayGymName(gym)} 대표 이미지`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-blue-50 text-[36px] font-black text-blue-200">{displayGymName(gym).slice(0, 1)}</div>}
              </div>
              <div className="p-3 bg-white">
                <h4 className="font-semibold text-[14px] mb-0.5">{displayGymName(gym)}</h4>
                <div className="flex items-center gap-1 text-[13px] text-neutral-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">{gym.address}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </HomeSectionShell>
  );
}
