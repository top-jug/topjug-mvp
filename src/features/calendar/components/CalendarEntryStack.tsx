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
        <img
          key={`${entry.gym}-${index}`}
          src={`https://picsum.photos/seed/${entry.gym}/40/40`}
          alt={entry.gym}
          className={joinClassNames('rounded-full border border-neutral-200 bg-neutral-100 object-cover', logoClassName)}
        />
      ))}
      {hiddenCount > 0 && <div className={hiddenCountClassName}>+{hiddenCount}개</div>}
    </div>
  );
}
