import { useMemo, useState } from 'react';
import { ActiveGyms, CalendarData } from '../../../entities/calendar/types';
import { CALENDAR_GYMS, CALENDAR_SETTING_ENTRIES, CALENDAR_WEEKDAYS } from '../../../mocks/calendar';
import CalendarMonthGrid, { CalendarGridCell } from '../../calendar/components/CalendarMonthGrid';
import { HomeSectionShell } from './HomeSectionShell';

function buildWeekCells(year: number, month: number, selectedDate: number | null): CalendarGridCell[] {
  const anchorDate = new Date(year, month - 1, selectedDate ?? 1);
  const dayOfWeek = (anchorDate.getDay() + 6) % 7;
  anchorDate.setDate(anchorDate.getDate() - dayOfWeek);

  return Array.from({ length: 7 }, (_, index) => {
    const cellDate = new Date(anchorDate);
    cellDate.setDate(anchorDate.getDate() + index);

    return {
      key: `home-week-${cellDate.getFullYear()}-${cellDate.getMonth() + 1}-${cellDate.getDate()}`,
      day: cellDate.getDate(),
      year: cellDate.getFullYear(),
      month: cellDate.getMonth() + 1,
    };
  });
}

function shiftWeek(year: number, month: number, selectedDate: number | null, delta: number) {
  const shiftedDate = new Date(year, month - 1, selectedDate ?? 1);
  shiftedDate.setDate(shiftedDate.getDate() + delta * 7);
  return {
    year: shiftedDate.getFullYear(),
    month: shiftedDate.getMonth() + 1,
    day: shiftedDate.getDate(),
  };
}

function createActiveGyms(): ActiveGyms {
  return Object.fromEntries(CALENDAR_GYMS.map((gym) => [gym.name, true]));
}

function isMockMonth(year: number, month: number) {
  return year === 2026 && month === 4;
}

interface HomeCalendarGridProps {
  onOpen: () => void;
}

export function HomeCalendarGrid({ onOpen }: HomeCalendarGridProps) {
  const [selectedDate, setSelectedDate] = useState<number | null>(12);
  const [currentMonth, setCurrentMonth] = useState({ year: 2026, month: 4 });

  const activeGyms = useMemo(() => createActiveGyms(), []);

  const periodPages = useMemo(() => {
    return [-1, 0, 1].map((delta) => {
      const target = shiftWeek(currentMonth.year, currentMonth.month, selectedDate, delta);
      return buildWeekCells(target.year, target.month, target.day);
    });
  }, [currentMonth.month, currentMonth.year, selectedDate]);

  const visibleCalendarData = useMemo<CalendarData>(() => {
    return isMockMonth(currentMonth.year, currentMonth.month) ? CALENDAR_SETTING_ENTRIES : {};
  }, [currentMonth.month, currentMonth.year]);

  const getEntriesForCell = (cell: CalendarGridCell) => {
    if (!cell.day || !isMockMonth(cell.year, cell.month)) return null;
    return visibleCalendarData[cell.day] ?? null;
  };

  const handleMoveWeek = (delta: -1 | 1) => {
    const next = shiftWeek(currentMonth.year, currentMonth.month, selectedDate, delta);
    setCurrentMonth({ year: next.year, month: next.month });
    setSelectedDate(next.day);
  };

  const handleSelectFullDate = (year: number, month: number, date: number) => {
    setCurrentMonth({ year, month });
    setSelectedDate(date);
  };

  return (
    <HomeSectionShell title="세팅 일정" onAction={onOpen} actionLabel="더보기" bordered={false}>
      <div className="-mt-3 rounded-2xl border border-neutral-200 py-3 bg-white">
        <CalendarMonthGrid
          scope="week"
          weekdays={CALENDAR_WEEKDAYS}
          pages={periodPages}
          gyms={CALENDAR_GYMS}
          activeGyms={activeGyms}
          getEntriesForCell={getEntriesForCell}
          selectedDate={selectedDate}
          selectedMonth={currentMonth.month}
          selectedYear={currentMonth.year}
          onSelectDate={handleSelectFullDate}
          onOpenDateMenu={() => {}}
          onShiftPeriod={handleMoveWeek}
          showSelection={false}
          showWeekTodayHighlight={true}
          containerClassName="px-2 pt-0 pb-0"
          weekChipStackClassName="-space-y-3"
        />
      </div>
    </HomeSectionShell>
  );
}
