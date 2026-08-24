import { CalendarEntry } from '../../../entities/calendar/types';

interface CalendarEntryStackProps {
  entries: CalendarEntry[];
  maxVisible?: number;
  className?: string;
  logoClassName?: string;
  hiddenCountClassName?: string;
}

function joinClassNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function CalendarEntryStack({
  entries,
  maxVisible = 2,
  className,
  logoClassName = 'h-7 w-7',
  hiddenCountClassName = 'text-[10px] leading-none font-medium text-neutral-500',
}: CalendarEntryStackProps) {
  const visibleEntries = entries.slice(0, maxVisible);
  const hiddenCount = Math.max(0, entries.length - visibleEntries.length);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={joinClassNames('flex flex-col items-center gap-1', className)}>
      {visibleEntries.map((entry, index) => (
        entry.logoUrl ? (
          <img
            key={entry.settingEventId ?? entry.recordId ?? `${entry.gym}-${index}`}
            src={entry.logoUrl}
            alt={`${entry.gym} 로고`}
            className={joinClassNames('rounded-full border border-neutral-200 bg-neutral-100 object-cover', logoClassName)}
          />
        ) : (
          <span
            key={entry.settingEventId ?? entry.recordId ?? `${entry.gym}-${index}`}
            aria-label={entry.gym}
            className={joinClassNames('flex items-center justify-center rounded-full border border-neutral-200 text-[10px] font-bold', logoClassName)}
            style={{ backgroundColor: entry.lightBg, color: entry.darkText }}
          >
            {entry.gym.slice(0, 1)}
          </span>
        )
      ))}
      {hiddenCount > 0 && <div className={hiddenCountClassName}>+{hiddenCount}개</div>}
    </div>
  );
}
