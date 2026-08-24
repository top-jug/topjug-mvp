import { useEffect, useState } from 'react';
import { ApiGymSummary, displayGymName, listGyms } from '../../../app/api/gym-api';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import { getHomeDataState } from '../home-state';
import { HomeSectionShell } from './HomeSectionShell';

interface HomeNearbyGymsProps {
  onGymClick: (gymId: string) => void;
  onOpen: () => void;
}

export function HomeNearbyGyms({ onGymClick, onOpen }: HomeNearbyGymsProps) {
  const [gyms, setGyms] = useState<ApiGymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const state = getHomeDataState(isLoading, error, gyms.length);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    listGyms({ limit: 3, signal: controller.signal })
      .then((response) => setGyms(response.data))
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setGyms([]);
        setError(fetchError instanceof Error ? fetchError.message : '추천 암장을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [requestKey]);

  return (
    <HomeSectionShell title="추천 암장" onAction={onOpen} actionLabel="더보기" bordered={false}>
      {state === 'loading' && (
        <div className="rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500" aria-busy="true">추천 암장을 불러오는 중입니다.</div>
      )}
      {state === 'error' && (
        <div className="rounded-2xl bg-red-50 px-4 py-6 text-center text-[13px] text-red-700" role="alert">
          <div>{error}</div>
          <button type="button" onClick={() => setRequestKey((key) => key + 1)} className="mt-2 min-h-10 font-semibold underline">추천 암장 다시 시도</button>
        </div>
      )}
      {state === 'empty' && (
        <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-500">
          <div>현재 추천할 수 있는 암장이 없어요.</div>
          <button type="button" onClick={onOpen} className="mt-2 min-h-10 font-semibold text-[#185FA5]">전체 암장 둘러보기</button>
        </div>
      )}
      {state === 'ready' && (
        <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5">
          {gyms.map((gym) => (
            <button type="button" key={gym.id} onClick={() => onGymClick(gym.id)} className="flex-shrink-0 w-[280px] border border-neutral-200 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500 transition-colors bg-white text-left">
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
            </button>
          ))}
        </div>
      )}
    </HomeSectionShell>
  );
}
