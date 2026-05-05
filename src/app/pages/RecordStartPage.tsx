import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MONTH_NAMES, RECORD_GYMS } from '../../mocks/record';
import CenteredModalShell from '../components/overlay/CenteredModalShell';
import DifficultyComparisonModal from '../components/DifficultyComparisonModal';
import { useMemberships } from '../providers/MembershipProvider';
import { RecordDraft, RecordPassType, useRecordDraft } from '../providers/RecordDraftProvider';
import { useAppScreenNavigate } from '../navigation';
import GymSelectModal from '../../features/record/components/modals/GymSelectModal';
import DatePickerModal from '../../features/record/components/modals/DatePickerModal';
import PassSelectModal from '../../features/record/components/modals/PassSelectModal';

const DEFAULT_GYM = RECORD_GYMS[0];
const TIME_WHEEL_ITEM_HEIGHT = 44;
const TIME_WHEEL_VISIBLE_HEIGHT = 220;
const TIME_WHEEL_PADDING = (TIME_WHEEL_VISIBLE_HEIGHT - TIME_WHEEL_ITEM_HEIGHT) / 2;
const TIME_PERIODS = ['오전', '오후'] as const;

function parseRecordDate(value: string) {
  const [yearPart, monthPart, dayPart] = value.split('.').map(Number);

  if (!yearPart || !monthPart || !dayPart) {
    return { year: 2026, month: 3, day: 9 };
  }

  return {
    year: yearPart,
    month: monthPart - 1,
    day: dayPart,
  };
}

function formatRecordDate(year: number, month: number, day: number) {
  return `${year}.${String(month + 1).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
}

function getCurrentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getCurrentDateValue() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function parseTimeValue(value: string) {
  const [hourPart, minutePart] = value.split(':').map(Number);
  const hour = Number.isNaN(hourPart) ? 0 : hourPart;
  const minute = Number.isNaN(minutePart) ? 0 : minutePart;
  const period = hour >= 12 ? '오후' : '오전';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;

  return {
    period,
    hour: displayHour,
    minute,
  };
}

function formatDisplayTime(value: string) {
  const { period, hour, minute } = parseTimeValue(value);

  return `${period} ${hour}:${String(minute).padStart(2, '0')}`;
}

function formatTimeValue(period: (typeof TIME_PERIODS)[number], hour: number, minute: number) {
  const normalizedHour = period === '오후' ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;

  return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatPassSummary(passType: RecordPassType | null, selectedPass: string | null) {
  if (!passType) return '회원권을 선택하세요';
  if (passType === '일일이용권') return '일일이용권';
  return selectedPass ?? `${passType}을 선택하세요`;
}

interface TimeWheelColumnProps {
  label: string;
  items: string[];
  value: string;
  onChange: (value: string) => void;
}

function TimeWheelColumn({ label, items, value, onChange }: TimeWheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const selectedIndex = Math.max(0, items.indexOf(value));

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTo({
      top: selectedIndex * TIME_WHEEL_ITEM_HEIGHT,
      behavior: 'smooth',
    });
  }, [selectedIndex]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleScroll = () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      const element = scrollRef.current;
      if (!element) return;

      const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(element.scrollTop / TIME_WHEEL_ITEM_HEIGHT)));
      const nextValue = items[nextIndex];

      if (nextValue && nextValue !== value) {
        onChange(nextValue);
      }
    }, 90);
  };

  return (
    <div className="flex-1">
      <div className="mb-2 text-center text-[12px] font-medium text-neutral-500">{label}</div>
      <div className="relative" style={{ height: TIME_WHEEL_VISIBLE_HEIGHT }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto rounded-2xl bg-neutral-50/80 px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: TIME_WHEEL_PADDING, paddingBottom: TIME_WHEEL_PADDING }}
        >
          <div className="flex flex-col gap-0">
            {items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onChange(item)}
                className={`flex h-11 w-full items-center justify-center rounded-xl snap-center transition-colors ${
                  value === item ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-neutral-700'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-11 -translate-y-1/2 border-y border-blue-200/70 bg-white/35" />
      </div>
    </div>
  );
}

export default function RecordStartPage() {
  const navigate = useNavigate();
  const navigateToScreen = useAppScreenNavigate();
  const { draft, setDraft } = useRecordDraft();
  const { countPasses, periodPasses } = useMemberships();

  const initialDate = draft?.selectedDate ?? getCurrentDateValue();
  const parsedDate = parseRecordDate(initialDate);
  const initialStartTime = draft?.selectedStartTime ?? getCurrentTimeValue();
  const initialTime = parseTimeValue(initialStartTime);
  const hourItems = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1)), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')), []);

  const [selectedGym, setSelectedGym] = useState<string>(draft?.selectedGym ?? DEFAULT_GYM);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedYear, setSelectedYear] = useState(parsedDate.year);
  const [selectedMonth, setSelectedMonth] = useState(parsedDate.month);
  const [selectedDay, setSelectedDay] = useState(parsedDate.day);
  const [selectedStartTime, setSelectedStartTime] = useState(initialStartTime);
  const [tempStartPeriod, setTempStartPeriod] = useState<(typeof TIME_PERIODS)[number]>(initialTime.period);
  const [tempStartHour, setTempStartHour] = useState(String(initialTime.hour));
  const [tempStartMinute, setTempStartMinute] = useState(String(initialTime.minute).padStart(2, '0'));
  const [selectedPassType, setSelectedPassType] = useState<RecordPassType | null>(draft?.selectedPassType ?? null);
  const [selectedPass, setSelectedPass] = useState<string | null>(draft?.selectedPass ?? null);
  const [tempPassType, setTempPassType] = useState<RecordPassType>('일일이용권');
  const [showGymModal, setShowGymModal] = useState(false);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const canStart = Boolean(selectedGym && selectedDate && selectedStartTime && selectedPassType && (selectedPassType === '일일이용권' || selectedPass));

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  };

  const handleDateSelect = (day: number) => {
    setSelectedDay(day);
    setSelectedDate(formatRecordDate(selectedYear, selectedMonth, day));
    setShowDatePicker(false);
  };

  const handleTimeConfirm = () => {
    setSelectedStartTime(formatTimeValue(tempStartPeriod, Number(tempStartHour), Number(tempStartMinute)));
    setShowTimeModal(false);
  };

  const handleStart = () => {
    if (!canStart) return;

    const nextDraft: RecordDraft = {
      selectedGym,
      selectedDate,
      selectedStartTime,
      selectedPassType,
      selectedPass,
    };

    setDraft(nextDraft);
    navigate('/record');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-neutral-100">
        <button onClick={handleClose} className="w-11 h-11 flex items-center justify-center rounded-full">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button className="w-11 h-11 invisible" aria-hidden="true" />
      </div>

      <div className="flex-1 px-5 py-2 pb-8 overflow-y-auto flex flex-col">
        <div className="mb-3 text-center">
          <h1 className="text-[24px] font-bold leading-none">기록 시작</h1>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowGymModal(true)}
              className="w-full px-4 py-5 flex items-center justify-between bg-white hover:bg-neutral-50 transition-colors border-b border-neutral-100"
            >
              <div className="text-left flex flex-col justify-center">
                <div className="text-[13px] text-neutral-500 mb-1">지점 선택</div>
                <div className="text-[16px] font-medium text-neutral-800">{selectedGym}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <div className="px-4 py-3 bg-white border-b border-neutral-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold">난이도 체계</h3>
              </div>
              <div className="flex items-center justify-center gap-3 mb-3">
                {['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500', 'bg-blue-500', 'bg-indigo-600', 'bg-purple-600'].map((color, i) => (
                  <div key={i} className={`w-7 h-7 ${color} rounded-full`}></div>
                ))}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowDifficultyModal(true)}
                  className="w-full min-h-11 py-2 bg-neutral-100 text-neutral-700 text-[14px] font-medium rounded-xl hover:bg-neutral-200 transition-colors"
                >
                  난이도 비교
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-neutral-100">
              <button
                onClick={() => setShowDatePicker(true)}
                className="px-4 py-5 flex items-center justify-between bg-white hover:bg-neutral-50 transition-colors border-r border-neutral-100"
              >
                <div className="text-left flex flex-col justify-center">
                  <div className="text-[13px] text-neutral-500 mb-1">날짜 선택</div>
                  <div className="text-[16px] font-medium text-neutral-800">{selectedDate}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
              <button
                onClick={() => {
                  const parsedTime = parseTimeValue(selectedStartTime);
                  setTempStartPeriod(parsedTime.period);
                  setTempStartHour(String(parsedTime.hour));
                  setTempStartMinute(String(parsedTime.minute).padStart(2, '0'));
                  setShowTimeModal(true);
                }}
                className="px-4 py-5 flex items-center justify-between bg-white hover:bg-neutral-50 transition-colors"
              >
                <div className="text-left flex flex-col justify-center">
                  <div className="text-[13px] text-neutral-500 mb-1">시작 시간</div>
                  <div className="text-[16px] font-medium text-neutral-800">{formatDisplayTime(selectedStartTime)}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-4 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[13px] text-neutral-500">회원권 선택</div>
                <button
                  onClick={() => navigateToScreen('membership')}
                  className="min-h-10 px-3 py-2 bg-neutral-100 text-neutral-700 text-[13px] font-medium rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  회원권 수정
                </button>
              </div>
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => {
                    setSelectedPassType('일일이용권');
                    setSelectedPass(null);
                  }}
                  className={`flex-1 min-h-11 py-2 text-[15px] font-medium rounded-full ${
                    selectedPassType === '일일이용권' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  일일이용권
                </button>
                <button
                  onClick={() => {
                    setTempPassType('횟수권');
                    setShowPassModal(true);
                  }}
                  className={`flex-1 min-h-11 py-2 text-[15px] font-medium rounded-full ${
                    selectedPassType === '횟수권' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  횟수권
                </button>
                <button
                  onClick={() => {
                    setTempPassType('기간권');
                    setShowPassModal(true);
                  }}
                  className={`flex-1 min-h-11 py-2 text-[15px] font-medium rounded-full ${
                    selectedPassType === '기간권' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  기간권
                </button>
              </div>
              <div className="mt-3 text-[14px] text-neutral-600 min-h-5">{formatPassSummary(selectedPassType, selectedPass)}</div>
              <div className="pt-6 flex justify-center">
                <button
                  onClick={handleStart}
                  disabled={!canStart}
                  className={`min-w-[180px] py-4 rounded-xl text-[16px] font-bold transition-colors ${
                    canStart ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  기록 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showGymModal && (
        <GymSelectModal
          gyms={RECORD_GYMS}
          selectedGym={selectedGym}
          onSelect={(gym) => {
            setSelectedGym(gym);
            setShowGymModal(false);
          }}
          onClose={() => setShowGymModal(false)}
        />
      )}

      <DifficultyComparisonModal isOpen={showDifficultyModal} onClose={() => setShowDifficultyModal(false)} />

      {showDatePicker && (
        <DatePickerModal
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          monthNames={MONTH_NAMES}
          getFirstDayOfMonth={(year, month) => new Date(year, month, 1).getDay()}
          getDaysInMonth={(year, month) => new Date(year, month + 1, 0).getDate()}
          onPrevMonth={() => setSelectedMonth(selectedMonth === 0 ? 11 : selectedMonth - 1)}
          onNextMonth={() => setSelectedMonth(selectedMonth === 11 ? 0 : selectedMonth + 1)}
          onSelectDay={handleDateSelect}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {showPassModal && (
        <PassSelectModal
          passType={tempPassType === '횟수권' ? '횟수권' : '기간권'}
          countPasses={countPasses}
          periodPasses={periodPasses}
          onSelect={(passType, pass) => {
            setSelectedPassType(passType);
            setSelectedPass(pass);
            setShowPassModal(false);
          }}
          onClose={() => setShowPassModal(false)}
        />
      )}

      {showTimeModal && (
        <CenteredModalShell onClose={() => setShowTimeModal(false)} panelClassName="bg-white rounded-[28px] p-5 w-[min(92vw,420px)]">
          <h3 className="text-[18px] font-bold text-center mb-2">시작 시간</h3>

          <div className="flex gap-3">
            <TimeWheelColumn label="오전/오후" items={Array.from(TIME_PERIODS)} value={tempStartPeriod} onChange={(value) => setTempStartPeriod(value as (typeof TIME_PERIODS)[number])} />
            <TimeWheelColumn label="시" items={hourItems} value={tempStartHour} onChange={setTempStartHour} />
            <TimeWheelColumn label="분" items={minuteItems} value={tempStartMinute} onChange={setTempStartMinute} />
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowTimeModal(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
              취소
            </button>
            <button onClick={handleTimeConfirm} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium">
              확인
            </button>
          </div>
        </CenteredModalShell>
      )}
    </div>
  );
}
