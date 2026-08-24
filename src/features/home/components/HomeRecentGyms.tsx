import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getHomeDataState } from '../home-state';
import { loadRecentGyms, type RecentGym } from '../recent-gyms';
import { HomeSectionShell } from './HomeSectionShell';

interface HomeRecentGymsProps {
  onOpen: () => void;
}

export function HomeRecentGyms({ onOpen }: HomeRecentGymsProps) {
  const [recentGyms, setRecentGyms] = useState<RecentGym[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const state = getHomeDataState(isLoading, error, recentGyms.length);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    loadRecentGyms(controller.signal)
      .then(setRecentGyms)
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setRecentGyms([]);
        setError(fetchError instanceof Error ? fetchError.message : '최근 암장을 불러오지 못했어요.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [requestKey]);

  return (
    <HomeSectionShell title="최근 다녀온 암장" onAction={onOpen}>
      {state === 'loading' && <div className="py-5 text-center text-[12px] text-neutral-500">최근 기록을 불러오는 중입니다.</div>}
      {state === 'error' && (
        <div className="py-3 text-center text-[12px] text-red-600">
          <div>{error}</div>
          <button type="button" onClick={() => setRequestKey((key) => key + 1)} className="mt-1 min-h-10 font-semibold text-red-700">다시 시도</button>
        </div>
      )}
      {state === 'empty' && (
        <div className="py-2 text-center text-[12px] text-neutral-500">
          <div>아직 완료한 클라이밍 기록이 없어요.</div>
          <Link to="/record/start" className="mt-2 inline-flex min-h-10 items-center font-semibold text-[#185FA5]">첫 기록 남기기</Link>
        </div>
      )}
      {state === 'ready' && (
        <div className="space-y-1">
          {recentGyms.map((gym) => (
            <Link key={gym.id} to={gym.href} className="-mx-1 flex min-h-10 items-center justify-between gap-2 rounded-lg px-1 text-[14px] transition-colors hover:bg-neutral-50">
              <span className="truncate font-medium">{gym.name}</span>
              <span className="text-neutral-400" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}
    </HomeSectionShell>
  );
}
