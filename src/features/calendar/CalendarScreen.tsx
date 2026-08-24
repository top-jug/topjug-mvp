import { useEffect, useMemo, useRef, useState } from 'react';
import BottomTabBar from '../../app/components/layout/BottomTabBar';
import { useAuth } from '../auth/AuthProvider';
import { ActiveGyms, CalendarData, CalendarGym } from '../../entities/calendar/types';
import { CALENDAR_WEEKDAYS } from '../../mocks/calendar';
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
import { loadRecordCalendarMonth, type RecordCalendarSnapshot } from './record-calendar';
import {
  ALL_CALENDAR_STATUSES,
  filterCalendarData,
  getCalendarGyms,
  reconcileActiveGyms,
  type ActiveStatuses,
  type CalendarStatus,
} from './calendar-filters';
import {
  CalendarRequestGate,
  getCalendarViewState,
  resolveCalendarSnapshot,
  type CalendarSnapshot,
} from './calendar-state';

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
  const [filterGymsByMode, setFilterGymsByMode] = useState<Record<CalendarViewMode, CalendarGym[]>>({ record: [], setting: [] });
  const [gymSelectionPreferences, setGymSelectionPreferences] = useState<ActiveGyms>({});
  const [activeStatuses, setActiveStatuses] = useState<ActiveStatuses>({ ...ALL_CALENDAR_STATUSES });
  const [settingSnapshot, setSettingSnapshot] = useState<CalendarSnapshot | null>(null);
  const [settingRequestKey, setSettingRequestKey] = useState(0);
  const [recordSnapshot, setRecordSnapshot] = useState<RecordCalendarSnapshot | null>(null);
  const [recordRequestKey, setRecordRequestKey] = useState(0);
  const settingRequestGate = useRef(new CalendarRequestGate());
  const recordRequestGate = useRef(new CalendarRequestGate());

  const recordSource = resolveCalendarSnapshot(recordSnapshot, currentMonth.year, currentMonth.month);
  const settingSource = resolveCalendarSnapshot(settingSnapshot, currentMonth.year, currentMonth.month);
  const currentSource = viewMode === 'record' ? recordSource : settingSource;
  const filterGyms = filterGymsByMode[viewMode];
  const activeGyms = useMemo(
    () => reconcileActiveGyms(gymSelectionPreferences, filterGyms),
    [filterGyms, gymSelectionPreferences],
  );

  useEffect(() => {
    if (viewMode !== 'setting') return;

    const controller = new AbortController();
    const request = settingRequestGate.current.begin();
    const requestedMonth = currentMonth;
    const { from, to } = getCalendarMonthRange(currentMonth.year, currentMonth.month);
    const query = new URLSearchParams({ from, to });

    setSettingSnapshot((previous) => ({
      year: requestedMonth.year,
      month: requestedMonth.month,
      data: previous?.year === requestedMonth.year && previous.month === requestedMonth.month ? previous.data : {},
      error: null,
      isLoading: true,
    }));

    fetch(`/api/v1/setting-events?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? '세팅 일정을 불러오지 못했습니다.');
        }

        return response.json() as Promise<SettingEventResponse>;
      })
      .then((payload) => {
        if (!settingRequestGate.current.isCurrent(request)) return;
        const data = buildSettingCalendarData(payload.data, requestedMonth.year, requestedMonth.month);
        const nextGyms = getCalendarGyms(data);
        setSettingSnapshot({ ...requestedMonth, data, error: null, isLoading: false });
        setFilterGymsByMode((previous) => ({ ...previous, setting: nextGyms }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!settingRequestGate.current.isCurrent(request)) return;
        setSettingSnapshot((previous) => ({
          ...requestedMonth,
          data: previous?.year === requestedMonth.year && previous.month === requestedMonth.month ? previous.data : {},
          error: error instanceof Error ? error.message : '세팅 일정을 불러오지 못했습니다.',
          isLoading: false,
        }));
      });

    return () => {
      controller.abort();
      if (settingRequestGate.current.isCurrent(request)) settingRequestGate.current.invalidate();
    };
  }, [currentMonth.month, currentMonth.year, settingRequestKey, viewMode]);

  useEffect(() => {
    if (viewMode !== 'record') return;
    if (authStatus !== 'authenticated') {
      setRecordSnapshot((previous) => ({
        year: currentMonth.year,
        month: currentMonth.month,
        data: previous?.year === currentMonth.year && previous.month === currentMonth.month ? previous.data : {},
        error: authStatus === 'error' ? '로그인 상태를 확인하지 못했어요.' : null,
        isLoading: authStatus === 'loading',
      }));
      return;
    }

    const controller = new AbortController();
    const request = recordRequestGate.current.begin();
    const requestedMonth = currentMonth;
    setRecordSnapshot((previous) => ({
      ...requestedMonth,
      data: previous?.year === requestedMonth.year && previous.month === requestedMonth.month ? previous.data : {},
      error: null,
      isLoading: true,
    }));

    loadRecordCalendarMonth(currentMonth.year, currentMonth.month, controller.signal)
      .then((data) => {
        if (!recordRequestGate.current.isCurrent(request)) return;
        const nextGyms = getCalendarGyms(data);
        setRecordSnapshot({ ...requestedMonth, data, error: null, isLoading: false });
        setFilterGymsByMode((previous) => ({ ...previous, record: nextGyms }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (!recordRequestGate.current.isCurrent(request)) return;
        setRecordSnapshot((previous) => ({
          ...requestedMonth,
          data: previous?.year === requestedMonth.year && previous.month === requestedMonth.month ? previous.data : {},
          error: error instanceof Error ? error.message : '기록을 불러오지 못했어요.',
          isLoading: false,
        }));
      });

    return () => {
      controller.abort();
      if (recordRequestGate.current.isCurrent(request)) recordRequestGate.current.invalidate();
    };
  }, [authStatus, currentMonth.month, currentMonth.year, recordRequestKey, user?.id, viewMode]);

  const filteredCalendarData = useMemo<CalendarData>(() => {
    return filterCalendarData(currentSource.data, activeGyms, viewMode === 'setting' ? activeStatuses : undefined);
  }, [activeGyms, activeStatuses, currentSource.data, viewMode]);
  const visibleCalendarData = filteredCalendarData;
  const calendarState = getCalendarViewState(currentSource.isLoading, currentSource.error, currentSource.data, filteredCalendarData);

  const periodPages = useMemo(() => {
    return [-1, 0, 1].map((delta) => {
      const target = shiftCalendarMonth(currentMonth.year, currentMonth.month, delta);
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

  useEffect(() => setActiveSlide(0), [viewMode]);

  const toggleGym = (gymId: string) => {
    setGymSelectionPreferences((previous) => ({ ...previous, [gymId]: !activeGyms[gymId] }));
  };

  const toggleAllGyms = () => {
    const allSelected = filterGyms.length > 0 && filterGyms.every((gym) => activeGyms[gym.id]);
    setGymSelectionPreferences((previous) => ({
      ...previous,
      ...(allSelected ? createInactiveGyms(filterGyms) : createActiveGyms(filterGyms)),
    }));
  };

  const toggleStatus = (status: CalendarStatus) => {
    setActiveStatuses((previous) => ({ ...previous, [status]: !previous[status] }));
  };

  const applyGymSearch = (query: string) => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      setGymSelectionPreferences((previous) => ({ ...previous, ...createActiveGyms(filterGyms) }));
      return;
    }

    setGymSelectionPreferences((previous) => ({
      ...previous,
      ...Object.fromEntries(
        filterGyms.map((gym) => [gym.id, gym.name.toLowerCase().includes(keyword)]),
      ),
    }));
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
        activeStatuses={viewMode === 'setting' ? activeStatuses : undefined}
        onToggleStatus={viewMode === 'setting' ? toggleStatus : undefined}
      />

      {calendarState !== 'ready' && (
        <div className={`mx-5 mt-3 rounded-xl px-4 py-3 text-center text-[13px] ${calendarState === 'error' ? 'bg-red-50 text-red-600' : 'bg-neutral-50 text-neutral-500'}`}>
          {calendarState === 'loading' && (viewMode === 'record' ? '기록을 불러오는 중입니다.' : '세팅 일정을 불러오는 중입니다.')}
          {calendarState === 'source-empty' && (viewMode === 'record' ? '이 달에 완료된 기록이 없습니다.' : '이 달에 등록된 세팅 일정이 없습니다.')}
          {calendarState === 'filtered-empty' && '선택한 필터에 해당하는 일정이 없습니다.'}
          {calendarState === 'error' && (
            <>
              <div>{currentSource.error}</div>
              <button
                type="button"
                onClick={() => {
                  if (viewMode === 'record') {
                    if (authStatus === 'error') void retryAuth();
                    else setRecordRequestKey((key) => key + 1);
                  } else {
                    setSettingRequestKey((key) => key + 1);
                  }
                }}
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
          selectedDate={calendarState === 'ready' ? selectedDate : null}
          selectedMonth={currentMonth.month}
          selectedYear={currentMonth.year}
          isDateInteractionEnabled={calendarState === 'ready'}
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
          selectedDate={calendarState === 'ready' ? selectedDate : null}
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
