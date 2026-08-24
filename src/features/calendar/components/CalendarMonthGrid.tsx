import { useEffect, useRef } from 'react';
import { CalendarEntry } from '../../../entities/calendar/types';
import { getCalendarWeekdayKind } from '../calendar-month';
import CalendarEntryStack from './CalendarEntryStack';

export interface CalendarGridCell {
  key: string;
  day: number | null;
  year: number;
  month: number;
}

interface CalendarMonthGridProps {
  weekdays: string[];
  pages: CalendarGridCell[][];
  getEntriesForCell: (cell: CalendarGridCell) => CalendarEntry[] | null;
  selectedDate: number | null;
  selectedMonth: number;
  selectedYear: number;
  isDateInteractionEnabled?: boolean;
  onSelectDate: (year: number, month: number, date: number) => void;
  onOpenDateMenu: (year: number, month: number, date: number) => void;
  onShiftPeriod: (direction: -1 | 1) => void;
  containerClassName?: string;
}

function chunkCells(cells: CalendarGridCell[], size = 7) {
  const rows: CalendarGridCell[][] = [];

  for (let index = 0; index < cells.length; index += size) {
    rows.push(cells.slice(index, index + size));
  }

  return rows;
}

export default function CalendarMonthGrid(props: CalendarMonthGridProps) {
  const {
    weekdays,
    pages,
    getEntriesForCell,
    selectedDate,
    selectedMonth,
    selectedYear,
    isDateInteractionEnabled = true,
    onSelectDate,
    onOpenDateMenu,
    onShiftPeriod,
    containerClassName = 'px-5 py-4',
  } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const today = new Date();

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    node.scrollLeft = node.clientWidth;
  }, [pages]);

  const handleScroll = () => {
    const node = scrollerRef.current;
    if (!node) return;

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      const width = node.clientWidth;
      const ratio = node.scrollLeft / width;

      if (ratio < 0.6) {
        onShiftPeriod(-1);
      } else if (ratio > 1.4) {
        onShiftPeriod(1);
      } else {
        node.scrollTo({ left: width, behavior: 'smooth' });
      }
    }, 120);
  };

  return (
    <div className={containerClassName}>
      <div className="grid grid-cols-7 gap-px mb-1 border-b border-neutral-200 pb-2">
        {weekdays.map((day, index) => (
          <div key={day} className={`text-center text-[12px] py-1 ${getCalendarWeekdayKind(index) === 'sunday' ? 'text-[#E24B4A]' : getCalendarWeekdayKind(index) === 'saturday' ? 'text-[#185FA5]' : 'text-neutral-500'}`}>
            {day}
          </div>
        ))}
      </div>

      <div ref={scrollerRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
        {pages.map((page, pageIndex) => (
          <div key={`month-page-${pageIndex}`} className="w-full flex-shrink-0 snap-center">
            <div className="space-y-0">
              {chunkCells(page, 7).map((row, rowIndex) => (
                <div key={`month-row-${rowIndex}`} className={`grid grid-cols-7 gap-px ${rowIndex < chunkCells(page, 7).length - 1 ? 'border-b border-neutral-200 pb-1 mb-1' : ''}`}>
                  {row.map((date, index) => {
                    const dayData = typeof date.day === 'number' ? getEntriesForCell(date) : null;
                    const visibleEntries = dayData ?? [];
                    const isSelected = date.day === selectedDate && date.month === selectedMonth && date.year === selectedYear;
                    const isToday = date.day === today.getDate() && date.month === today.getMonth() + 1 && date.year === today.getFullYear();
                    const weekdayKind = getCalendarWeekdayKind(index % 7);

                    if (typeof date.day !== 'number') {
                      return <div key={date.key} className="min-h-[48px] rounded-md p-1" aria-hidden="true" />;
                    }
                    const day = date.day;

                    return (
                      <button
                        key={date.key}
                        onClick={() => onSelectDate(date.year, date.month, day)}
                        aria-label={`${date.year}년 ${date.month}월 ${day}일`}
                        aria-pressed={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          onOpenDateMenu(date.year, date.month, day);
                        }}
                        className={`min-h-[48px] rounded-md p-1 flex flex-col justify-between transition-colors ${isSelected ? 'bg-[#E6F1FB]' : 'hover:bg-white'}`}
                        disabled={!isDateInteractionEnabled}
                      >
                        <div className="flex flex-col items-center gap-0.5">
<div
                              className={`text-[13px] ${
                                isToday
                                  ? 'w-6 h-6 rounded-full bg-[#185FA5] text-white flex items-center justify-center font-medium'
                                  : weekdayKind === 'saturday'
                                    ? 'text-[#185FA5]'
                                    : weekdayKind === 'sunday'
                                      ? 'text-[#E24B4A]'
                                      : 'text-neutral-900'
                             }`}
                            >
                              {day}
                            </div>
                            <CalendarEntryStack
                              entries={visibleEntries}
                              className="mt-0.5 gap-0.5"
                              logoClassName="h-5 w-5"
                              hiddenCountClassName="rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-medium text-neutral-500"
                            />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
