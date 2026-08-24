import GymSearchCard from './GymSearchCard';
import { ApiGymSummary } from '../../../app/api/gym-api';

interface GymSearchListProps {
  gyms: ApiGymSummary[];
  onSelectGym: (gym: ApiGymSummary) => void;
  title: string;
  isSavedGym: (gymId: string) => boolean;
  onToggleSavedGym: (gym: ApiGymSummary) => void;
  isSavingGym?: (gymId: string) => boolean;
  countOverride?: number;
  countLabel?: string;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function GymSearchList({ gyms, onSelectGym, title, isSavedGym, onToggleSavedGym, isSavingGym, countOverride, countLabel, isLoading = false, error = null, emptyMessage = '조건에 맞는 암장이 없어요.', onRetry, hasMore = false, onLoadMore }: GymSearchListProps) {
  return (
    <div className="pb-24 min-h-screen">
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">{countLabel ?? `${countOverride ?? gyms.length}개의 ${title}`}</h2>
        </div>

        {error ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="text-[15px] font-bold text-neutral-900">{error}</div>
            {onRetry && <button onClick={onRetry} className="mt-4 rounded-full bg-blue-500 px-4 py-2 text-[13px] font-semibold text-white">다시 시도</button>}
          </div>
        ) : isLoading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-12 text-center text-[14px] text-neutral-500">암장을 불러오는 중입니다.</div>
        ) : gyms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-[14px] text-neutral-500">{emptyMessage}</div>
        ) : (
          <div className="space-y-3">
            {gyms.map((gym) => (
            <GymSearchCard
              key={gym.id}
              gym={gym}
              onClick={() => onSelectGym(gym)}
              isSaved={isSavedGym(gym.id)}
              onToggleSaved={() => onToggleSavedGym(gym)}
              isSaving={isSavingGym?.(gym.id)}
            />
            ))}
            {hasMore && onLoadMore && (
              <button onClick={onLoadMore} className="h-12 w-full rounded-2xl border border-neutral-200 bg-white text-[14px] font-semibold text-neutral-700">더 보기</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
