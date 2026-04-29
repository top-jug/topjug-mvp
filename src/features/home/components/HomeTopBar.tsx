interface HomeTopBarProps {
  onNotificationClick: () => void;
  onProfileClick: () => void;
}

export function HomeTopBar({ onNotificationClick, onProfileClick }: HomeTopBarProps) {
  return (
    <div className="px-5 pt-5 pb-3 bg-white flex items-center justify-between">
      <h1 className="text-[28px] font-bold tracking-[-0.03em]">홈</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={onNotificationClick}
          className="w-11 h-11 bg-blue-50 rounded-full flex items-center justify-center relative hover:bg-blue-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(59 130 246)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">2</span>
          </div>
        </button>
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
