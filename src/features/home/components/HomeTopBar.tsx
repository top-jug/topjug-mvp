interface HomeTopBarProps {
  onProfileClick: () => void;
}

export function HomeTopBar({ onProfileClick }: HomeTopBarProps) {
  return (
    <div className="px-5 pt-5 pb-3 bg-white flex items-center justify-between">
      <h1 className="text-[28px] font-bold tracking-[-0.03em]">홈</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={onProfileClick}
          className="w-11 h-11 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-colors"
          aria-label="프로필"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
