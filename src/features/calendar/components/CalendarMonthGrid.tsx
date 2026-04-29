import { useEffect, useRef } from 'react';
import { ActiveGyms, CalendarData, CalendarEntry, CalendarGym } from '../../../entities/calendar/types';

export interface CalendarGridCell {
  key: string;
  day: number | null;
  year: number;
  month: number;
}

type CalendarScope = 'month' | 'week';

interface CalendarMonthGridProps {
  scope: CalendarScope;
  weekdays: string[];
  pages: CalendarGridCell[][];
  gyms: CalendarGym[];
  activeGyms: ActiveGyms;
  getEntriesForCell: (cell: CalendarGridCell) => CalendarEntry[] | null;
  selectedDate: number | null;
  selectedMonth: number;
  selectedYear: number;
  onSelectDate: (year: number, month: number, date: number) => void;
  onOpenDateMenu: (year: number, month: number, date: number) => void;
  onShiftPeriod: (direction: -1 | 1) => void;
  showSelection?: boolean;
  showWeekTodayHighlight?: boolean;
  containerClassName?: string;
  weekChipStackClassName?: string;
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
    scope,
    weekdays,
    pages,
    gyms,
    activeGyms,
    getEntriesForCell,
    selectedDate,
    selectedMonth,
    selectedYear,
    onSelectDate,
    onOpenDateMenu,
    onShiftPeriod,
    showSelection = true,
    showWeekTodayHighlight = false,
    containerClassName = 'px-5 py-4',
    weekChipStackClassName = '-space-y-1',
  } = props;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    node.scrollLeft = node.clientWidth;
  }, [pages, scope]);

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

  if (scope === 'week') {
    return (
      <div className={containerClassName}>
        <div>
          <div ref={scrollerRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar">
          {pages.map((page, pageIndex) => (
            <div key={`week-page-${pageIndex}`} className="w-full flex-shrink-0 snap-center">
              <div className="space-y-0">
                {chunkCells(page, 7).map((row, rowIndex) => (
                  <div key={`week-row-${rowIndex}`} className={`grid grid-cols-7 gap-1.5 ${rowIndex < chunkCells(page, 7).length - 1 ? 'border-b border-neutral-200 pb-2 mb-2' : ''}`}>
                    {row.map((date, index) => {
                      const dayData = typeof date.day === 'number' ? getEntriesForCell(date) : null;
                      const visibleEntries = dayData?.filter((entry) => activeGyms[entry.gym]) ?? [];
                      const isSelected = date.day === selectedDate && date.month === selectedMonth && date.year === selectedYear;
                      const isToday = date.day === 12 && date.month === 4 && date.year === 2026;
                      const weekday = weekdays[index];

                      return (
                        <button
                          key={date.key}
                          onClick={() => typeof date.day === 'number' && onSelectDate(date.year, date.month, date.day)}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            if (typeof date.day === 'number') onOpenDateMenu(date.year, date.month, date.day);
                          }}
                          className={`rounded-2xl px-1 py-2 flex flex-col items-center min-h-[84px] transition-colors ${showSelection && isSelected ? 'bg-[#DCEBFA]' : 'bg-white'}`}
                          disabled={typeof date.day !== 'number'}
                        >
                          {typeof date.day === 'number' && (
                            <>
                              <div className="text-[11px] leading-none text-neutral-500">{weekday}</div>
                              <div className="mt-2.5 h-8 flex items-center justify-center">
                                <div
                                  className={`text-[17px] leading-none font-bold flex items-center justify-center ${showWeekTodayHighlight && isToday ? 'w-8 h-8 rounded-full bg-[#185FA5] text-white' : ''}`}
                                >
                                  {date.day}
                                </div>
                              </div>
                              <div className="mt-2 min-h-[34px] flex flex-col items-center justify-center gap-1">
                                {visibleEntries.length > 0 && (
                                  <>
                                    <div className={`flex flex-col ${weekChipStackClassName}`}>
                                      {visibleEntries.slice(0, 3).map((entry, idx) => {
                                      const gymInfo = gyms.find((gym) => gym.name === entry.gym);
                                      return (
                                        <div
                                          key={`${entry.gym}-${idx}`}
                                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 border-white"
                                          style={{
                                            backgroundColor: gymInfo?.lightBg || '#E5E7EB',
                                            color: gymInfo?.darkText || '#374151',
                                            zIndex: 10 - idx,
                                          }}
                                        >
                                          {entry.gym.slice(0, 1)}
                                        </div>
                                      );
                                    })}
                                    </div>
                                    {visibleEntries.length > 3 && (
                                      <div className="text-[10px] leading-none font-medium text-neutral-500">
                                        +{visibleEntries.length - 3}개
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </>
                          )}
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
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <div className="grid grid-cols-7 gap-px mb-1 border-b border-neutral-200 pb-2">
        {weekdays.map((day, index) => (
          <div key={day} className={`text-center text-[12px] py-1 ${index === 5 ? 'text-[#185FA5]' : index === 6 ? 'text-[#E24B4A]' : 'text-neutral-500'}`}>
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
                    const visibleEntries = dayData?.filter((entry) => activeGyms[entry.gym]) ?? [];
                    const isSelected = date.day === selectedDate && date.month === selectedMonth && date.year === selectedYear;
                    const isToday = date.day === 12 && date.month === 4 && date.year === 2026;
                    const isSaturday = index % 7 === 5;
                    const isSunday = index % 7 === 6;

                    return (
                      <button
                        key={date.key}
                        onClick={() => typeof date.day === 'number' && onSelectDate(date.year, date.month, date.day)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          if (typeof date.day === 'number') onOpenDateMenu(date.year, date.month, date.day);
                        }}
                        className={`min-h-[48px] rounded-md p-1 flex flex-col justify-between transition-colors ${isSelected ? 'bg-[#E6F1FB]' : 'hover:bg-white'}`}
                        disabled={typeof date.day !== 'number'}
                      >
                        {typeof date.day === 'number' && (
                          <div className="flex flex-col items-center gap-0.5">
<div
                              className={`text-[13px] ${
                                isToday
                                  ? 'w-6 h-6 rounded-full bg-[#185FA5] text-white flex items-center justify-center font-medium'
                                  : isSaturday
                                    ? 'text-[#185FA5]'
                                    : isSunday
                                      ? 'text-[#E24B4A]'
                                      : 'text-neutral-900'
                             }`}
                            >
                              {date.day}
                            </div>
                            {visibleEntries.length > 0 && (
                              <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                <div className="flex -space-x-1">
                                  {visibleEntries.slice(0, 3).map((entry, idx) => {
                                    const gymInfo = gyms.find((gym) => gym.name === entry.gym);
                                    if (!gymInfo) return null;
                                    return (
                                      <div
                                        key={`${entry.gym}-${idx}`}
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border border-white"
                                        style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText, zIndex: 10 - idx }}
                                      >
                                        {entry.gym.slice(0, 1)}
                                      </div>
                                    );
                                  })}
                                </div>
                                {visibleEntries.length > 3 && (
                                  <div className="text-[8px] font-medium text-neutral-600">+{visibleEntries.length - 3}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
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
