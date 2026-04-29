type CalendarViewMode = 'record' | 'setting';
type CalendarScope = 'month' | 'week';

interface CalendarTopBarProps {
  mode: CalendarViewMode;
  scope: CalendarScope;
  periodLabel: string;
  onChangeMode: (mode: CalendarViewMode) => void;
  onOpenPeriod: () => void;
  onOpenFilter: () => void;
}

const MODE_META: Record<CalendarViewMode, { label: string }> = {
  record: { label: '기록' },
  setting: { label: '일정' },
};

export default function CalendarTopBar({ mode, periodLabel, onChangeMode, onOpenPeriod, onOpenFilter }: CalendarTopBarProps) {
  const orderedModes: CalendarViewMode[] = ['record', 'setting'];

  return (
    <div className="px-5 pt-5 pb-2 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {orderedModes.map((entryMode) => {
              const isActive = entryMode === mode;

              return (
                <button
                  key={entryMode}
                  onClick={() => onChangeMode(entryMode)}
                  className={`min-h-11 text-[30px] tracking-[-0.03em] transition-colors ${isActive ? 'font-bold text-neutral-950' : 'font-semibold text-neutral-400'}`}
                >
                  {MODE_META[entryMode].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPeriod}
            aria-label="기간 선택"
            className="flex items-center gap-1 h-11 px-3 rounded-full bg-white border border-neutral-200 text-neutral-700"
          >
            <span className="text-[15px] font-medium">{periodLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            onClick={onOpenFilter}
            aria-label="필터"
            className="w-11 h-11 rounded-full bg-white border border-neutral-200 text-neutral-700 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
