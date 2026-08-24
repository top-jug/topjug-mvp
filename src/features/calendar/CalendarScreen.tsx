import { useEffect, useMemo, useState } from 'react';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { useAuth } from '../auth/AuthProvider';
import { ActiveGyms, CalendarData, CalendarGym } from '../../entities/calendar/types';
import { CALENDAR_GYMS, CALENDAR_WEEKDAYS } from '../../mocks/calendar';
import CalendarDetailSection from './components/CalendarDetailSection';
import CalendarFilterBar from './components/CalendarFilterBar';
import CalendarMonthGrid, { CalendarGridCell } from './components/CalendarMonthGrid';
import CalendarSearchMenu from './components/CalendarSearchMenu';
import CalendarTopBar from './components/CalendarTopBar';
import CalendarDayPopup from './components/modals/CalendarDayPopup';
import CalendarPeriodModal from './components/modals/CalendarPeriodModal';
import { buildSettingCalendarData, SettingEvent } from './setting-calendar';
import {
  buildMonthCells,
  getCalendarMonthRange,
  getLocalCalendarDate,
  shiftCalendarMonth,
} from './calendar-month';
import { loadRecordCalendarMonth, type RecordCalendarSnapshot, resolveRecordCalendarSnapshot } from './record-calendar';

interface CalendarScreenProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onNavigate: (screen: string) => void;
  onOpenGym: (gymId: string) => void;
  onOpenRecord: (recordId: string) => void;
}

type CalendarViewMode = 'record' | 'setting';

interface SettingEventResponse {
  data: SettingEvent[];
}

function getModeGyms(calendarData: CalendarData): CalendarGym[] {
  const apiGyms = new Map<string, CalendarGym>();

  Object.values(calendarData).flat().forEach((entry) => {
    if (!entry.gymId || apiGyms.has(entry.gymId)) return;
    apiGyms.set(entry.gymId, {
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
  return Object.fromEntries(gyms.map((gym) => [gym.id, true]));
}

function createInactiveGyms(gyms: CalendarGym[]): ActiveGyms {
  return Object.fromEntries(gyms.map((gym) => [gym.id, false]));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function CalendarScreen({ viewMode, onViewModeChange, onNavigate, onOpenGym, onOpenRecord }: CalendarScreenProps) {
  const { status: authStatus, user, retry: retryAuth } = useAuth();
  const initialDate = useMemo(() => getLocalCalendarDate(), []);
  const [selectedDate, setSelectedDate] = useState<number | null>(initialDate.day);
  const [currentMonth, setCurrentMonth] = useState({ year: initialDate.year, month: initialDate.month });
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
  const [recordSnapshot, setRecordSnapshot] = useState<RecordCalendarSnapshot | null>(null);
  const [recordRequestKey, setRecordRequestKey] = useState(0);

  const recordView = resolveRecordCalendarSnapshot(recordSnapshot, currentMonth.year, currentMonth.month);
  const currentCalendarData = viewMode === 'record' ? recordView.data : settingCalendarData;

  useEffect(() => {
    const nextGyms = getModeGyms(currentCalendarData);
    setFilterGyms(nextGyms);
    setActiveGyms(createActiveGyms(nextGyms));
    setActiveSlide(0);
  }, [currentCalendarData, viewMode]);

  useEffect(() => {
    if (viewMode !== 'setting') return;

    const controller = new AbortController();
    const { from, to } = getCalendarMonthRange(currentMonth.year, currentMonth.month);
    const query = new URLSearchParams({ from, to });

    setIsSettingLoading(true);
    setSettingCalendarData({});
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
        setSettingCalendarData(buildSettingCalendarData(payload.data, currentMonth.year, currentMonth.month));
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

  useEffect(() => {
    if (viewMode !== 'record') return;
    if (authStatus !== 'authenticated') {
      setRecordSnapshot({
        year: currentMonth.year,
        month: currentMonth.month,
        data: {},
        error: authStatus === 'error' ? '로그인 상태를 확인하지 못했어요.' : null,
        isLoading: authStatus === 'loading',
      });
      return;
    }

    const controller = new AbortController();
    setRecordSnapshot({ year: currentMonth.year, month: currentMonth.month, data: {}, error: null, isLoading: true });

    loadRecordCalendarMonth(currentMonth.year, currentMonth.month, controller.signal)
      .then((data) => {
        setRecordSnapshot({ year: currentMonth.year, month: currentMonth.month, data, error: null, isLoading: false });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRecordSnapshot({
          year: currentMonth.year,
          month: currentMonth.month,
          data: {},
          error: error instanceof Error ? error.message : '기록을 불러오지 못했어요.',
          isLoading: false,
        });
      });

    return () => controller.abort();
  }, [authStatus, currentMonth.month, currentMonth.year, recordRequestKey, user?.id, viewMode]);

  const filteredCalendarData = useMemo<CalendarData>(() => {
    return Object.fromEntries(
      Object.entries(currentCalendarData).map(([day, entries]) => [
        Number(day),
        entries.filter((entry) => {
          const gymId = entry.gymId ?? filterGyms.find((gym) => gym.name === entry.gym)?.id;
          return gymId ? activeGyms[gymId] : false;
        }),
      ]),
    );
  }, [currentCalendarData, activeGyms, filterGyms]);

  const visibleCalendarData = useMemo<CalendarData>(() => {
    return filteredCalendarData;
  }, [filteredCalendarData]);

  const periodPages = useMemo(() => {
    return [-1, 0, 1].map((delta) => {
      const target = shiftCalendarMonth(currentMonth.year, currentMonth.month, delta);
      return buildMonthCells(target.year, target.month);
    });
  }, [currentMonth.month, currentMonth.year]);

  const periodLabel = `${currentMonth.year}년 ${currentMonth.month}월`;

  const selectedEntries = selectedDate ? visibleCalendarData[selectedDate] ?? [] : [];
  const recordState = recordView.state;

  useEffect(() => {
    if (selectedEntries.length === 0 || activeSlide >= selectedEntries.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, selectedEntries.length]);

  const toggleGym = (gymId: string) => {
    setActiveGyms((prev) => {
      return { ...prev, [gymId]: !prev[gymId] };
    });
  };

  const toggleAllGyms = () => {
    setActiveGyms((prev) => {
      const allSelected = filterGyms.length > 0 && filterGyms.every((gym) => prev[gym.id]);
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
        filterGyms.map((gym) => [gym.id, gym.name.toLowerCase().includes(keyword)]),
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
    if (cell.year !== currentMonth.year || cell.month !== currentMonth.month) return null;
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

      {viewMode === 'record' && recordState !== 'ready' && (
        <div className={`mx-5 mt-3 rounded-xl px-4 py-3 text-center text-[13px] ${recordState === 'error' ? 'bg-red-50 text-red-600' : 'bg-neutral-50 text-neutral-500'}`}>
          {recordState === 'loading' && '기록을 불러오는 중입니다.'}
          {recordState === 'empty' && '이 달에 완료된 기록이 없습니다.'}
          {recordState === 'error' && (
            <>
              <div>{recordView.error}</div>
              <button
                type="button"
                onClick={() => authStatus === 'error' ? void retryAuth() : setRecordRequestKey((key) => key + 1)}
                className="mt-2 font-semibold text-red-700"
              >
                다시 시도
              </button>
            </>
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
          getEntriesForCell={getEntriesForCell}
          selectedDate={viewMode === 'record' && (recordState === 'loading' || recordState === 'error') ? null : selectedDate}
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
          selectedDate={viewMode === 'record' && (recordState === 'loading' || recordState === 'error') ? null : selectedDate}
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
