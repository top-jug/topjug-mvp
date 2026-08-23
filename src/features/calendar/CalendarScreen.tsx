import { useEffect, useMemo, useState } from 'react';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { ActiveGyms, CalendarData, CalendarGym } from '../../entities/calendar/types';
import { CALENDAR_GYMS, CALENDAR_RECORD_ENTRIES, CALENDAR_SETTING_ENTRIES, CALENDAR_WEEKDAYS } from '../../mocks/calendar';
import CalendarDetailSection from './components/CalendarDetailSection';
import CalendarFilterBar from './components/CalendarFilterBar';
import CalendarMonthGrid, { CalendarGridCell } from './components/CalendarMonthGrid';
import CalendarSearchMenu from './components/CalendarSearchMenu';
import CalendarTopBar from './components/CalendarTopBar';
import CalendarDayPopup from './components/modals/CalendarDayPopup';
import CalendarPeriodModal from './components/modals/CalendarPeriodModal';
import { CalendarScope } from './types';

interface CalendarScreenProps {
  onNavigate: (screen: string) => void;
  onOpenRecord: (recordId: string) => void;
}

type CalendarViewMode = 'record' | 'setting';

const CALENDAR_MODE_DATA: Record<CalendarViewMode, CalendarData> = {
  record: CALENDAR_RECORD_ENTRIES,
  setting: CALENDAR_SETTING_ENTRIES,
};

function getModeGyms(calendarData: CalendarData): CalendarGym[] {
  const gymNames = new Set(Object.values(calendarData).flat().map((entry) => entry.gym));
  return CALENDAR_GYMS.filter((gym) => gymNames.has(gym.name));
}

function createActiveGyms(gyms: CalendarGym[]): ActiveGyms {
  return Object.fromEntries(gyms.map((gym) => [gym.name, true]));
}

function createInactiveGyms(gyms: CalendarGym[]): ActiveGyms {
  return Object.fromEntries(gyms.map((gym) => [gym.name, false]));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMonthOffset(year: number, month: number) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

function buildMonthCells(year: number, month: number): CalendarGridCell[] {
  const daysInMonth = getDaysInMonth(year, month);
  const startOffset = getMonthOffset(year, month);
  const cells: CalendarGridCell[] = [];

  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ key: `blank-start-${year}-${month}-${index}`, day: null, year, month });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `day-${year}-${month}-${day}`, day, year, month });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${year}-${month}-${cells.length}`, day: null, year, month });
  }

  return cells;
}

function buildWeekCells(year: number, month: number, selectedDate: number | null): CalendarGridCell[] {
  const anchorDate = new Date(year, month - 1, selectedDate ?? 1);
  const dayOfWeek = (anchorDate.getDay() + 6) % 7;
  anchorDate.setDate(anchorDate.getDate() - dayOfWeek);

  return Array.from({ length: 7 }, (_, index) => {
    const cellDate = new Date(anchorDate);
    cellDate.setDate(anchorDate.getDate() + index);

    return {
      key: `week-${cellDate.getFullYear()}-${cellDate.getMonth() + 1}-${cellDate.getDate()}`,
      day: cellDate.getDate(),
      year: cellDate.getFullYear(),
      month: cellDate.getMonth() + 1,
    };
  });
}

function shiftMonth(year: number, month: number, delta: number) {
  const shiftedDate = new Date(year, month - 1 + delta, 1);
  return { year: shiftedDate.getFullYear(), month: shiftedDate.getMonth() + 1 };
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

function formatWeekRangeLabel(cells: CalendarGridCell[]) {
  const first = cells[0];
  const last = cells[cells.length - 1];
  const sameMonth = first.year === last.year && first.month === last.month;

  if (sameMonth) {
    return `${first.month}월 ${first.day}일 - ${last.day}일`;
  }

  return `${first.month}월 ${first.day}일 - ${last.month}월 ${last.day}일`;
}

function isMockMonth(year: number, month: number) {
  return year === 2026 && month === 4;
}

export default function CalendarScreen({ onNavigate, onOpenRecord }: CalendarScreenProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('setting');
  const [scope, setScope] = useState<CalendarScope>('month');
  const [selectedDate, setSelectedDate] = useState<number | null>(12);
  const [currentMonth, setCurrentMonth] = useState({ year: 2026, month: 4 });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [popupDate, setPopupDate] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [filterGyms, setFilterGyms] = useState<CalendarGym[]>([]);
  const [activeGyms, setActiveGyms] = useState<ActiveGyms>({});

  const currentCalendarData = CALENDAR_MODE_DATA[viewMode];

  useEffect(() => {
    const nextGyms = getModeGyms(currentCalendarData);
    setFilterGyms(nextGyms);
    setActiveGyms(createActiveGyms(nextGyms));
    setActiveSlide(0);
  }, [viewMode]);

  const filteredCalendarData = useMemo<CalendarData>(() => {
    return Object.fromEntries(
      Object.entries(currentCalendarData).map(([day, entries]) => [
        Number(day),
        entries.filter((entry) => activeGyms[entry.gym]),
      ]),
    );
  }, [currentCalendarData, activeGyms]);

  const visibleCalendarData = useMemo<CalendarData>(() => {
    return isMockMonth(currentMonth.year, currentMonth.month) ? filteredCalendarData : {};
  }, [currentMonth.month, currentMonth.year, filteredCalendarData]);

  const calendarCells = useMemo(() => {
    return scope === 'month'
      ? buildMonthCells(currentMonth.year, currentMonth.month)
      : buildWeekCells(currentMonth.year, currentMonth.month, selectedDate);
  }, [currentMonth.month, currentMonth.year, scope, selectedDate]);

  const periodPages = useMemo(() => {
    if (scope === 'month') {
      return [-1, 0, 1].map((delta) => {
        const target = shiftMonth(currentMonth.year, currentMonth.month, delta);
        return buildMonthCells(target.year, target.month);
      });
    }

    return [-1, 0, 1].map((delta) => {
      const target = shiftWeek(currentMonth.year, currentMonth.month, selectedDate, delta);
      return buildWeekCells(target.year, target.month, target.day);
    });
  }, [currentMonth.month, currentMonth.year, scope, selectedDate]);

  const periodLabel = useMemo(() => {
    if (scope === 'month') {
      return `${currentMonth.year}년 ${currentMonth.month}월`;
    }

    return formatWeekRangeLabel(calendarCells);
  }, [calendarCells, currentMonth.month, currentMonth.year, scope]);

  const selectedEntries = selectedDate ? visibleCalendarData[selectedDate] ?? [] : [];

  useEffect(() => {
    if (selectedEntries.length === 0 || activeSlide >= selectedEntries.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, selectedEntries.length]);

  const toggleGym = (gymName: string) => {
    setActiveGyms((prev) => {
      return { ...prev, [gymName]: !prev[gymName] };
    });
  };

  const toggleAllGyms = () => {
    setActiveGyms((prev) => {
      const allSelected = filterGyms.length > 0 && filterGyms.every((gym) => prev[gym.name]);
      return allSelected ? createInactiveGyms(filterGyms) : createActiveGyms(filterGyms);
    });
  };

  const applyGymSearch = (query: string) => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      setActiveGyms(createActiveGyms(filterGyms));
      return;
    }

    setActiveGyms(
      Object.fromEntries(
        filterGyms.map((gym) => [gym.name, gym.name.toLowerCase().includes(keyword)]),
      ),
    );
  };

  const handleDayLongPress = (day: number) => {
    setPopupDate(day);
    setShowDayPopup(true);
  };

  const handleCardClick = () => {
    if (!selectedDate || !visibleCalendarData[selectedDate]) return;
    const maxSlide = visibleCalendarData[selectedDate].length - 1;
    setActiveSlide((activeSlide + 1) % (maxSlide + 1));
  };

  const handleSelectFullDate = (year: number, month: number, date: number) => {
    setCurrentMonth({ year, month });
    setSelectedDate(date);
    setActiveSlide(0);
  };

  const getEntriesForCell = (cell: CalendarGridCell) => {
    if (!cell.day || !isMockMonth(cell.year, cell.month)) return null;
    return filteredCalendarData[cell.day] ?? null;
  };

  const moveMonth = (delta: number) => {
    setCurrentMonth((prev) => {
      const nextDate = new Date(prev.year, prev.month - 1 + delta, 1);
      const nextMonth = { year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 };
      setSelectedDate((prevSelectedDate) => {
        if (!prevSelectedDate) return 1;
        return Math.min(prevSelectedDate, getDaysInMonth(nextMonth.year, nextMonth.month));
      });
      setActiveSlide(0);
      return nextMonth;
    });
  };

  const moveWeek = (delta: number) => {
    const anchorDate = new Date(currentMonth.year, currentMonth.month - 1, selectedDate ?? 1);
    anchorDate.setDate(anchorDate.getDate() + delta * 7);
    setCurrentMonth({ year: anchorDate.getFullYear(), month: anchorDate.getMonth() + 1 });
    setSelectedDate(anchorDate.getDate());
    setActiveSlide(0);
  };

  return (
    <>
      <CalendarTopBar
        mode={viewMode}
        scope={scope}
        periodLabel={periodLabel}
        onChangeMode={setViewMode}
        onOpenPeriod={() => setShowPeriodModal(true)}
        onOpenSearch={() => setShowSearchModal(true)}
      />

      <CalendarFilterBar
        gyms={filterGyms}
        activeGyms={activeGyms}
        onToggleGym={toggleGym}
        onToggleAll={toggleAllGyms}
        onOpenSettings={() => onNavigate('myGyms')}
      />

      {showSearchModal && (
        <CalendarSearchMenu
          gyms={filterGyms}
          onApplySearch={applyGymSearch}
          onClose={() => setShowSearchModal(false)}
        />
      )}

      {showPeriodModal && (
        <CalendarPeriodModal
          scope={scope}
          periodLabel={periodLabel}
          onSelectScope={(newScope) => setScope(newScope)}
          onSelectPeriod={(year, month, weekOffset) => {
            setCurrentMonth({ year, month });
            if (weekOffset !== undefined) {
              setSelectedDate((weekOffset - 1) * 7 + 1);
            }
            setShowPeriodModal(false);
          }}
          onClose={() => setShowPeriodModal(false)}
        />
      )}

      {/* Content - Fixed height without scroll */}
      <div className="pb-24 min-h-screen">
        <CalendarMonthGrid
          scope={scope}
          weekdays={CALENDAR_WEEKDAYS}
          pages={periodPages}
          gyms={filterGyms}
          activeGyms={activeGyms}
          getEntriesForCell={getEntriesForCell}
          selectedDate={selectedDate}
          selectedMonth={currentMonth.month}
          selectedYear={currentMonth.year}
          onSelectDate={handleSelectFullDate}
          onOpenDateMenu={(year, month, day) => {
            setCurrentMonth({ year, month });
            handleDayLongPress(day);
          }}
          onShiftPeriod={(direction) => (scope === 'month' ? moveMonth(direction) : moveWeek(direction))}
          showWeekTodayHighlight={true}
        />

        <CalendarDetailSection
          mode={viewMode}
          year={currentMonth.year}
          month={currentMonth.month}
          selectedDate={selectedDate}
          activeSlide={activeSlide}
          gyms={filterGyms}
          calendarData={visibleCalendarData}
          onCardClick={handleCardClick}
          onOpenRecord={onOpenRecord}
          onSelectSlide={setActiveSlide}
        />
      </div>

      {showDayPopup && popupDate && (
        <CalendarDayPopup
          mode={viewMode}
          year={currentMonth.year}
          month={currentMonth.month}
          day={popupDate}
          gyms={filterGyms}
          calendarData={visibleCalendarData}
          onClose={() => setShowDayPopup(false)}
          onOpenRecord={onOpenRecord}
          onGoToRecord={() => {
            setShowDayPopup(false);
            onNavigate('record');
          }}
        />
      )}

      <BottomTabBar activeTab="calendar" onNavigate={onNavigate} />
    </>
  );
}
