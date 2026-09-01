import type { GymTagCatalogItem } from '../../../app/api/gym-api';

interface GymSearchTabsProps {
  selectedTagCodes: string[];
  tags: GymTagCatalogItem[];
  tagError: string | null;
  regionLabel: string;
  onSelectTag: (code: string | null) => void;
  onRetryTags: () => void;
  onOpenRegion: () => void;
}

export default function GymSearchTabs({ selectedTagCodes, tags, tagError, regionLabel, onSelectTag, onRetryTags, onOpenRegion }: GymSearchTabsProps) {
  const isAllSelected = selectedTagCodes.length === 0;

  return (
    <div className="px-5 pb-3 pt-2 flex gap-2 bg-white overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={() => onSelectTag(null)}
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
      {tags.map((tag) => (
        <button
          key={tag.code}
          onClick={() => onSelectTag(tag.code)}
          aria-pressed={selectedTagCodes.includes(tag.code)}
          title={tag.description ?? undefined}
          className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors flex-shrink-0 ${
            selectedTagCodes.includes(tag.code) ? 'bg-blue-700 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
          }`}
        >
          {tag.label}
        </button>
      ))}
      {tagError && (
        <button type="button" onClick={onRetryTags} className="flex-shrink-0 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-[14px] font-bold text-red-700">
          키워드 다시 불러오기
        </button>
      )}
    </div>
  );
}
