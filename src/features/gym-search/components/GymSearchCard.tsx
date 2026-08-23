import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';
import { ApiGymSummary, displayGymName } from '../../../app/api/gym-api';

interface GymSearchCardProps {
  gym: ApiGymSummary;
  onClick: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
  isSaving?: boolean;
}

const FACILITY_LABELS: Record<string, string> = {
  shower: '샤워실',
  kilter_board: '킬터보드',
  stretching_zone: '스트레칭',
  parking: '주차가능',
  shoe_rental: '암벽화 대여',
};

export default function GymSearchCard({ gym, onClick, isSaved, onToggleSaved, isSaving = false }: GymSearchCardProps) {
  const tags = gym.tags.length > 0
    ? gym.tags.map((tag) => tag.label)
    : gym.facilities.map((facility) => FACILITY_LABELS[facility] ?? facility);

  return (
    <div onClick={onClick} className="flex gap-3 bg-white border border-neutral-200 rounded-2xl p-4 hover:border-blue-500 transition-colors cursor-pointer min-h-[116px]">
      <div className="w-20 h-20 bg-neutral-200 rounded-xl overflow-hidden flex-shrink-0">
        {gym.cover?.url ? (
          <ImageWithFallback src={gym.cover.url} alt={`${displayGymName(gym)} 대표 이미지`} className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-blue-50 text-[24px] font-black text-blue-300" aria-label="대표 이미지 없음">
            {displayGymName(gym).slice(0, 1)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] mb-1">{displayGymName(gym)}</h3>
          <p className="text-[13px] text-neutral-500 mb-2 line-clamp-1">{gym.address}</p>
          <div className="flex items-center gap-2">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-white border border-neutral-200 text-neutral-600 text-[11px] rounded-full">
                {tag}
              </span>
            ))}
          </div>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onToggleSaved();
        }}
        disabled={isSaving}
        className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-40"
        aria-label={isSaved ? '내 암장에서 제거' : '내 암장에 저장'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? '#3b82f6' : 'none'} stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  );
}
