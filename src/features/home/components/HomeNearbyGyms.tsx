import { useEffect, useRef, useState } from 'react';
import { ApiGymSummary, displayGymName, listGyms } from '../../../app/api/gym-api';
import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import { getRetainedHomeDataState } from '../home-state';
import { shouldRefreshHome } from '../home-week';
import { HomeSectionShell } from './HomeSectionShell';

interface HomeNearbyGymsProps {
  onGymClick: (gymId: string) => void;
  onOpen: () => void;
}

export function HomeNearbyGyms({ onGymClick, onOpen }: HomeNearbyGymsProps) {
  const [gyms, setGyms] = useState<ApiGymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const lastRefreshAt = useRef(Date.now());
  const state = getRetainedHomeDataState(isLoading, error, gyms.length, hasLoaded);

  useEffect(() => {
    const refreshWhenVisible = () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible' || !shouldRefreshHome(lastRefreshAt.current, now)) return;
      lastRefreshAt.current = now;
      setRequestKey((key) => key + 1);
    };
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    lastRefreshAt.current = Date.now();
    setIsLoading(true);
    setError(null);
    listGyms({ limit: 3, signal: controller.signal })
      .then((response) => {
        setGyms(response.data);
        setHasLoaded(true);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
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
      {(state === 'ready' || state === 'refreshing' || state === 'stale') && (
        <>
          {state === 'refreshing' && <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-[12px] text-blue-700" role="status" aria-busy="true">기존 추천을 표시하며 업데이트하고 있어요.</div>}
          {state === 'stale' && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900" role="alert">
              <span>최신 추천을 불러오지 못해 이전 정보를 표시해요.</span>
              <button type="button" onClick={() => setRequestKey((key) => key + 1)} className="min-h-10 shrink-0 font-semibold underline">다시 시도</button>
            </div>
          )}
          {gyms.length > 0 ? (
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
          ) : (
            <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-[13px] text-neutral-500">
              <div>현재 추천할 수 있는 암장이 없어요.</div>
              <button type="button" onClick={onOpen} className="mt-2 min-h-10 font-semibold text-[#185FA5]">전체 암장 둘러보기</button>
            </div>
          )}
        </>
      )}
    </HomeSectionShell>
  );
}
