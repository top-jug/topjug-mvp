interface GymSearchTabsProps {
  selectedTabs: string[];
  tabs: string[];
  regionLabel: string;
  onSelectTab: (tab: string) => void;
  onOpenRegion: () => void;
}

export default function GymSearchTabs({ selectedTabs, tabs, regionLabel, onSelectTab, onOpenRegion }: GymSearchTabsProps) {
  const isAllSelected = selectedTabs.length === 0;

  return (
    <div className="px-5 pb-3 pt-2 flex gap-2 bg-white overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={() => onSelectTab('전체')}
        aria-pressed={isAllSelected}
        className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors flex-shrink-0 ${
          isAllSelected ? 'bg-blue-700 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
        }`}
      >
        전체
      </button>
      <button onClick={onOpenRegion} className="px-4 py-1.5 rounded-full text-[14px] font-medium bg-white border border-neutral-200 text-neutral-700 flex items-center gap-1.5 flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {regionLabel}
      </button>
      {tabs.slice(1).map((tab) => (
        <button
          key={tab}
          onClick={() => onSelectTab(tab)}
          aria-pressed={selectedTabs.includes(tab)}
          className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors flex-shrink-0 ${
            selectedTabs.includes(tab) ? 'bg-blue-700 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
