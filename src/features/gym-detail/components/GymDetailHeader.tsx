import { ImageWithFallback } from '../../../app/components/figma/ImageWithFallback';

interface GymDetailHeaderProps {
  title: string;
  logoUrl?: string | null;
  isFavorite: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
}

export default function GymDetailHeader({ title, logoUrl, isFavorite, onBack, onToggleFavorite }: GymDetailHeaderProps) {
  return (
    <div className="relative px-5 pt-5 pb-4 flex items-center justify-center">
      <button onClick={onBack} className="absolute left-5 h-11 w-6 flex items-center justify-start rounded-full" aria-label="뒤로가기">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div className="flex min-w-0 items-center gap-2 px-10">
        {logoUrl && <ImageWithFallback src={logoUrl} alt={`${title} 로고`} className="h-8 w-8 flex-shrink-0 rounded-lg bg-neutral-100 object-contain" />}
        <h1 className="truncate text-[18px] font-bold">{title}</h1>
      </div>
      <button onClick={onToggleFavorite} className="absolute right-5 w-11 h-11 flex items-center justify-center rounded-full" aria-label={`${title} 내 암장 ${isFavorite ? '해제' : '저장'}`} aria-pressed={isFavorite}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? '#3b82f6' : 'none'} stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  );
}
