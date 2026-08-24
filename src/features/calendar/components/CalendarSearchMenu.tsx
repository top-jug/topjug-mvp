import { FormEvent, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import BottomSheet from '../../../app/components/overlay/BottomSheet';
import { CalendarGym } from '../../../entities/calendar/types';

interface CalendarSearchMenuProps {
  gyms: CalendarGym[];
  onApplySearch: (query: string) => void;
  onClose: () => void;
}

export default function CalendarSearchMenu({ gyms, onApplySearch, onClose }: CalendarSearchMenuProps) {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();
  const searchedGyms = useMemo(() => {
    if (!trimmedQuery) return gyms;

    return gyms.filter((gym) => gym.name.toLowerCase().includes(trimmedQuery.toLowerCase()));
  }, [gyms, trimmedQuery]);

  const applySearch = (nextQuery = query) => {
    onApplySearch(nextQuery);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearch();
  };

  return (
    <BottomSheet onClose={onClose} title="암장 검색" description="암장 이름을 검색해 캘린더 결과를 좁힙니다." maxHeightClassName="max-h-[70vh]">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <Search size={18} strokeWidth={2.2} className="text-neutral-500 flex-shrink-0" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
          placeholder="암장 이름 검색"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </form>

      <div className="mt-5 space-y-2">
        {searchedGyms.map((gym) => (
          <button
            type="button"
            key={gym.name}
            onClick={() => applySearch(gym.name)}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 flex items-center gap-3 text-left"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ backgroundColor: gym.lightBg, color: gym.darkText }}>
              {gym.name.slice(0, 1)}
            </div>
            <span className="text-[15px] font-medium text-neutral-800">{gym.name}</span>
          </button>
        ))}

        {searchedGyms.length === 0 && (
          <div className="py-8 text-center text-[14px] text-neutral-500">검색된 암장이 없습니다.</div>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => applySearch('')}
          className="h-12 flex-1 rounded-full bg-neutral-100 text-[15px] font-semibold text-neutral-700"
        >
          전체 보기
        </button>
        <button
          type="button"
          onClick={() => applySearch()}
          className="h-12 flex-1 rounded-full bg-blue-500 text-[15px] font-semibold text-white"
        >
          검색 적용
        </button>
      </div>
    </BottomSheet>
  );
}
