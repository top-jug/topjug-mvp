import TopTabHeader from '../../../app/components/layout/TopTabHeader';
import { Search } from 'lucide-react';

type CalendarViewMode = 'record' | 'setting';

interface CalendarTopBarProps {
  mode: CalendarViewMode;
  periodLabel: string;
  onChangeMode: (mode: CalendarViewMode) => void;
  onOpenPeriod: () => void;
  onOpenSearch: () => void;
}

const MODE_META: Record<CalendarViewMode, { label: string }> = {
  record: { label: '기록' },
  setting: { label: '일정' },
};

export default function CalendarTopBar({ mode, periodLabel, onChangeMode, onOpenPeriod, onOpenSearch }: CalendarTopBarProps) {
  const orderedModes: CalendarViewMode[] = ['record', 'setting'];

  return (
    <TopTabHeader
      tabs={orderedModes.map((entryMode) => ({ value: entryMode, label: MODE_META[entryMode].label }))}
      activeTab={mode}
      onChangeTab={(tab) => onChangeMode(tab as CalendarViewMode)}
      containerClassName="px-5 pt-5 pb-2 bg-white"
      rightElement={
        <>
          <button
            onClick={onOpenPeriod}
            aria-label="기간 선택"
            className="flex h-11 shrink-0 items-center gap-0.5 rounded-full border border-neutral-200 bg-white px-2 text-neutral-700 min-[360px]:gap-1 min-[360px]:px-3"
          >
            <span className="whitespace-nowrap text-[13px] font-medium min-[360px]:text-[15px]">{periodLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            onClick={onOpenSearch}
            aria-label="암장 검색"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 min-[360px]:h-11 min-[360px]:w-11"
          >
            <Search size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </>
      }
    />
  );
}
