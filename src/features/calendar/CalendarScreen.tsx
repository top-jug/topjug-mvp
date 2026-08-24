import { useEffect, useMemo, useState } from 'react';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { ActiveGyms, CalendarData, CalendarEntry, CalendarGym } from '../../entities/calendar/types';
import { CALENDAR_GYMS, CALENDAR_RECORD_ENTRIES, CALENDAR_WEEKDAYS } from '../../mocks/calendar';
import CalendarDetailSection from './components/CalendarDetailSection';
import CalendarFilterBar from './components/CalendarFilterBar';
import CalendarMonthGrid, { CalendarGridCell } from './components/CalendarMonthGrid';
import CalendarSearchMenu from './components/CalendarSearchMenu';
import CalendarTopBar from './components/CalendarTopBar';
import CalendarDayPopup from './components/modals/CalendarDayPopup';
import CalendarPeriodModal from './components/modals/CalendarPeriodModal';

interface CalendarScreenProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onNavigate: (screen: string) => void;
  onOpenGym: (gymId: string) => void;
  onOpenRecord: (recordId: string) => void;
}

type CalendarViewMode = 'record' | 'setting';

interface SettingEventResponse {
  data: Array<{
    id: string;
    title: string | null;
    status: 'scheduled' | 'completed' | 'cancelled';
    startsAt: string;
    endsAt: string | null;
    sectors: Array<{ id: string; name: string }>;
    gym: {
      id: string;
      name: string;
      branchName: string | null;
      address: string;
      calendarColor: string | null;
      calendarTextColor: string | null;
    };
  }>;
}

const STATUS_LABELS = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
} satisfies Record<NonNullable<CalendarEntry['status']>, string>;

function getModeGyms(calendarData: CalendarData): CalendarGym[] {
  const apiGyms = new Map<string, CalendarGym>();

  Object.values(calendarData).flat().forEach((entry) => {
    if (!entry.gymId || apiGyms.has(entry.gym)) return;
    apiGyms.set(entry.gym, {
      id: entry.gymId,
      name: entry.gym,
      color: entry.color ?? '#185FA5',
      lightBg: entry.lightBg ?? '#E6F1FB',
      darkText: entry.darkText ?? '#0C447C',
    });
  });

  if (apiGyms.size > 0) return [...apiGyms.values()];

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

function shiftMonth(year: number, month: number, delta: number) {
  const shiftedDate = new Date(year, month - 1 + delta, 1);
  return { year: shiftedDate.getFullYear(), month: shiftedDate.getMonth() + 1 };
}

function isMockMonth(year: number, month: number) {
  return year === 2026 && month === 4;
}

function getMonthRange(year: number, month: number) {
  return {
    from: new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString(),
    to: new Date(year, month, 0, 23, 59, 59, 999).toISOString(),
  };
}

function buildSettingCalendarData(events: SettingEventResponse['data']) {
  const nextData: CalendarData = {};

  events.forEach((event) => {
    const startsAt = new Date(event.startsAt);
    const day = startsAt.getDate();
    const gymName = [event.gym.name, event.gym.branchName].filter(Boolean).join(' ');
    const sectorLabel = event.sectors.map((sector) => sector.name).join(', ');
    const title = sectorLabel || event.title || '세팅';
    const color = event.gym.calendarColor ?? '#185FA5';

    nextData[day] = [
      ...(nextData[day] ?? []),
      {
        gym: gymName,
        gymId: event.gym.id,
        wall: `${title} · ${STATUS_LABELS[event.status]}`,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt ?? undefined,
        color,
        lightBg: `${color}22`,
        darkText: event.gym.calendarTextColor ?? color,
      },
    ];
  });

  return nextData;
}

export default function CalendarScreen({ viewMode, onViewModeChange, onNavigate, onOpenGym, onOpenRecord }: CalendarScreenProps) {
  const [selectedDate, setSelectedDate] = useState<number | null>(12);
  const [currentMonth, setCurrentMonth] = useState({ year: 2026, month: 4 });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [popupDate, setPopupDate] = useState<number | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [filterGyms, setFilterGyms] = useState<CalendarGym[]>([]);
  const [activeGyms, setActiveGyms] = useState<ActiveGyms>({});
  const [settingCalendarData, setSettingCalendarData] = useState<CalendarData>({});
  const [isSettingLoading, setIsSettingLoading] = useState(false);
  const [settingError, setSettingError] = useState<string | null>(null);
  const [settingRequestKey, setSettingRequestKey] = useState(0);

  const currentCalendarData = viewMode === 'record' ? CALENDAR_RECORD_ENTRIES : settingCalendarData;

  useEffect(() => {
    const nextGyms = getModeGyms(currentCalendarData);
    setFilterGyms(nextGyms);
    setActiveGyms(createActiveGyms(nextGyms));
    setActiveSlide(0);
  }, [currentCalendarData, viewMode]);

  useEffect(() => {
    if (viewMode !== 'setting') return;

    const controller = new AbortController();
    const { from, to } = getMonthRange(currentMonth.year, currentMonth.month);
    const query = new URLSearchParams({ from, to });

    setIsSettingLoading(true);
    setSettingError(null);

    fetch(`/api/v1/setting-events?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? '세팅 일정을 불러오지 못했습니다.');
        }

        return response.json() as Promise<SettingEventResponse>;
      })
      .then((payload) => {
        setSettingCalendarData(buildSettingCalendarData(payload.data));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSettingCalendarData({});
        setSettingError(error instanceof Error ? error.message : '세팅 일정을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSettingLoading(false);
      });

    return () => controller.abort();
  }, [currentMonth.month, currentMonth.year, settingRequestKey, viewMode]);

  const filteredCalendarData = useMemo<CalendarData>(() => {
    return Object.fromEntries(
      Object.entries(currentCalendarData).map(([day, entries]) => [
        Number(day),
        entries.filter((entry) => activeGyms[entry.gym]),
      ]),
    );
  }, [currentCalendarData, activeGyms]);

  const visibleCalendarData = useMemo<CalendarData>(() => {
    if (viewMode === 'setting') return filteredCalendarData;
    return isMockMonth(currentMonth.year, currentMonth.month) ? filteredCalendarData : {};
  }, [currentMonth.month, currentMonth.year, filteredCalendarData, viewMode]);

  const periodPages = useMemo(() => {
    return [-1, 0, 1].map((delta) => {
      const target = shiftMonth(currentMonth.year, currentMonth.month, delta);
      return buildMonthCells(target.year, target.month);
    });
  }, [currentMonth.month, currentMonth.year]);

  const periodLabel = `${currentMonth.year}년 ${currentMonth.month}월`;

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

  const handleSelectFullDate = (year: number, month: number, date: number) => {
    setCurrentMonth({ year, month });
    setSelectedDate(date);
    setActiveSlide(0);
  };

  const getEntriesForCell = (cell: CalendarGridCell) => {
    if (!cell.day) return null;
    if (viewMode === 'setting') {
      if (cell.year !== currentMonth.year || cell.month !== currentMonth.month) return null;
      return filteredCalendarData[cell.day] ?? null;
    }
    if (!isMockMonth(cell.year, cell.month)) return null;
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

  return (
    <>
      <CalendarTopBar
        mode={viewMode}
        periodLabel={periodLabel}
        onChangeMode={onViewModeChange}
        onOpenPeriod={() => setShowPeriodModal(true)}
        onOpenSearch={() => setShowSearchModal(true)}
      />

      <CalendarFilterBar
        gyms={filterGyms}
        activeGyms={activeGyms}
        onToggleGym={toggleGym}
        onToggleAll={toggleAllGyms}
      />

      {viewMode === 'setting' && (isSettingLoading || settingError) && (
        <div className={`px-5 py-2 text-center text-[12px] ${settingError ? 'text-red-500' : 'text-neutral-500'}`}>
          {settingError ? (
            <button onClick={() => setSettingRequestKey((key) => key + 1)} className="font-medium">
              {settingError} 다시 시도
            </button>
          ) : (
            '세팅 일정을 불러오는 중입니다.'
          )}
        </div>
      )}

      {showSearchModal && (
        <CalendarSearchMenu
          gyms={filterGyms}
          onApplySearch={applyGymSearch}
          onClose={() => setShowSearchModal(false)}
        />
      )}

      {showPeriodModal && (
        <CalendarPeriodModal
          currentYear={currentMonth.year}
          currentMonth={currentMonth.month}
          onSelectPeriod={(year, month) => {
            setCurrentMonth({ year, month });
            setSelectedDate((date) => Math.min(date ?? 1, getDaysInMonth(year, month)));
            setActiveSlide(0);
            setShowPeriodModal(false);
          }}
          onClose={() => setShowPeriodModal(false)}
        />
      )}

      {/* Content - Fixed height without scroll */}
      <div className="pb-24 min-h-screen">
        <CalendarMonthGrid
          weekdays={CALENDAR_WEEKDAYS}
          pages={periodPages}
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
          onShiftPeriod={moveMonth}
        />

        <CalendarDetailSection
          mode={viewMode}
          year={currentMonth.year}
          month={currentMonth.month}
          selectedDate={selectedDate}
          activeSlide={activeSlide}
          gyms={filterGyms}
          calendarData={visibleCalendarData}
          onOpenGym={onOpenGym}
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
          onOpenGym={(gymId) => {
            setShowDayPopup(false);
            onOpenGym(gymId);
          }}
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
