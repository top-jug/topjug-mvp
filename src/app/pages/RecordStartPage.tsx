import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiClientError } from '../api/api-client';
import { getActiveRecordSession, startRecordSession } from '../api/record-api';
import CenteredModalShell from '../components/overlay/CenteredModalShell';
import { useAppScreenNavigate, useNavigateBack } from '../navigation';
import { useMemberships } from '../providers/MembershipProvider';
import {
  RecordDraft,
  RecordPassType,
  recordDraftFromActiveSession,
  useRecordDraft,
} from '../providers/RecordDraftProvider';
import DatePickerModal from '../../features/record/components/modals/DatePickerModal';
import GymSelectModal from '../../features/record/components/modals/GymSelectModal';
import PassSelectModal from '../../features/record/components/modals/PassSelectModal';
import { shiftRecordMonth } from '../../features/record/record-date';

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const TIME_WHEEL_ITEM_HEIGHT = 44;
const TIME_WHEEL_VISIBLE_HEIGHT = 220;
const TIME_WHEEL_PADDING = (TIME_WHEEL_VISIBLE_HEIGHT - TIME_WHEEL_ITEM_HEIGHT) / 2;
const TIME_PERIODS = ['오전', '오후'] as const;
const SESSION_TYPES = [
  { value: 'free', label: '자유' },
  { value: 'training', label: '훈련' },
  { value: 'project', label: '프로젝트' },
] as const;

function parseRecordDate(value: string) {
  const [yearPart, monthPart, dayPart] = value.split('.').map(Number);
  if (!yearPart || !monthPart || !dayPart) return { year: new Date().getFullYear(), month: new Date().getMonth(), day: new Date().getDate() };
  return { year: yearPart, month: monthPart - 1, day: dayPart };
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
  return formatRecordDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseTimeValue(value: string) {
  const [hourPart, minutePart] = value.split(':').map(Number);
  const hour = Number.isNaN(hourPart) ? 0 : hourPart;
  const minute = Number.isNaN(minutePart) ? 0 : minutePart;
  const period: (typeof TIME_PERIODS)[number] = hour >= 12 ? '오후' : '오전';
  return { period, hour: hour % 12 === 0 ? 12 : hour % 12, minute };
}

function formatDisplayTime(value: string) {
  const { period, hour, minute } = parseTimeValue(value);
  return `${period} ${hour}:${String(minute).padStart(2, '0')}`;
}

function formatTimeValue(period: (typeof TIME_PERIODS)[number], hour: number, minute: number) {
  const normalizedHour = period === '오후' ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toStartedAt(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split('.').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function recordErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) return '로그인 후 기록을 시작할 수 있어요.';
  if (error instanceof ApiClientError && error.code === 'ACTIVE_RECORD_EXISTS') return '이미 진행 중인 기록이 있어요.';
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return '기록 요청을 처리하지 못했어요.';
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
    scrollRef.current?.scrollTo({ top: selectedIndex * TIME_WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
  }, [selectedIndex]);

  useEffect(() => () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
  }, []);

  const handleScroll = () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const element = scrollRef.current;
      if (!element) return;
      const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(element.scrollTop / TIME_WHEEL_ITEM_HEIGHT)));
      if (items[nextIndex] && items[nextIndex] !== value) onChange(items[nextIndex]);
    }, 90);
  };

  return (
    <div className="flex-1">
      <div className="mb-2 text-center text-[12px] font-medium text-neutral-500">{label}</div>
      <div className="relative" style={{ height: TIME_WHEEL_VISIBLE_HEIGHT }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto rounded-2xl bg-neutral-50/80 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingTop: TIME_WHEEL_PADDING, paddingBottom: TIME_WHEEL_PADDING }}
        >
          {items.map((item) => (
            <button key={item} type="button" onClick={() => onChange(item)} className={`flex h-11 w-full items-center justify-center rounded-xl ${value === item ? 'bg-white font-semibold text-blue-600 shadow-sm' : 'text-neutral-700'}`}>
              {item}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-11 -translate-y-1/2 border-y border-blue-200/70 bg-white/35" />
      </div>
    </div>
  );
}

export default function RecordStartPage() {
  const navigate = useNavigate();
  const navigateToScreen = useAppScreenNavigate();
  const navigateBack = useNavigateBack('/');
  const { draft, setDraft } = useRecordDraft();
  const { countPasses, periodPasses, gymOptions, isLoading: isMembershipLoading, error: membershipError } = useMemberships();

  const initialDate = draft?.selectedDate ?? getCurrentDateValue();
  const parsedDate = parseRecordDate(initialDate);
  const initialStartTime = draft?.selectedStartTime ?? getCurrentTimeValue();
  const initialTime = parseTimeValue(initialStartTime);
  const hourItems = useMemo(() => Array.from({ length: 12 }, (_, index) => String(index + 1)), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')), []);
  const gymChoices = useMemo(() => gymOptions.map((gym) => ({ id: gym.gymId, name: gym.gymName })), [gymOptions]);

  const [selectedGymId, setSelectedGymId] = useState(draft?.selectedGymId ?? '');
  const [selectedGym, setSelectedGym] = useState(draft?.selectedGym ?? '암장을 선택하세요');
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
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(draft?.membershipId ?? null);
  const [tempPassType, setTempPassType] = useState<'횟수권' | '기간권'>('횟수권');
  const [mode, setMode] = useState<'easy' | 'normal'>(draft?.mode ?? 'normal');
  const [sessionType, setSessionType] = useState<'free' | 'training' | 'project'>(draft?.sessionType ?? 'free');
  const [showGymModal, setShowGymModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const moveSelectedMonth = (delta: number) => {
    const next = shiftRecordMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  };

  useEffect(() => {
    if (selectedGymId || gymChoices.length === 0) return;
    setSelectedGymId(gymChoices[0].id);
    setSelectedGym(gymChoices[0].name);
  }, [gymChoices, selectedGymId]);

  useEffect(() => {
    let cancelled = false;
    getActiveRecordSession()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setDraft(recordDraftFromActiveSession(data));
        navigate('/record', { replace: true });
      })
      .catch((error) => {
        if (!cancelled && !(error instanceof ApiClientError && error.status === 401)) setStartError(recordErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setIsRecovering(false);
      });
    return () => { cancelled = true; };
  }, [navigate, setDraft]);

  const eligibleCountPasses = countPasses.filter((pass) => pass.gymIds.includes(selectedGymId));
  const eligiblePeriodPasses = periodPasses.filter((pass) => pass.gymIds.includes(selectedGymId));
  const canStart = Boolean(selectedGymId && selectedDate && selectedStartTime && selectedPassType && (
    selectedPassType === '일일이용권' || selectedPassType === '기타' || selectedMembershipId
  ));

  const handleStart = async () => {
    if (!canStart || isStarting) return;
    setIsStarting(true);
    setStartError(null);
    const startedAt = toStartedAt(selectedDate, selectedStartTime);
    if (new Date(startedAt).getTime() > Date.now()) {
      setStartError('시작 시간은 현재보다 미래일 수 없어요.');
      setIsStarting(false);
      return;
    }

    try {
      const accessType = selectedPassType === '기타' ? 'other' : selectedMembershipId ? 'membership' : 'day_pass';
      const { data } = await startRecordSession({
        gymId: selectedGymId,
        accessType,
        membershipId: selectedMembershipId,
        startedAt,
        mode,
        sessionType,
      });
      const nextDraft: RecordDraft = {
        recordId: data.id,
        selectedGymId,
        selectedGym,
        selectedDate,
        selectedStartTime,
        startedAt: data.startedAt,
        selectedPassType,
        selectedPass,
        membershipId: data.membershipId,
        accessType: data.accessType,
        mode: data.mode,
        sessionType: data.sessionType,
      };
      setDraft(nextDraft);
      navigate('/record');
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'ACTIVE_RECORD_EXISTS') {
        try {
          const active = await getActiveRecordSession();
          if (active.data) {
            setDraft(recordDraftFromActiveSession(active.data));
            navigate('/record', { replace: true });
            return;
          }
        } catch (recoveryError) {
          setStartError(recordErrorMessage(recoveryError));
          return;
        }
      }
      setStartError(recordErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  };

  if (isRecovering) {
    return <div className="flex min-h-screen items-center justify-center bg-white text-[15px] text-neutral-500">진행 중인 기록을 확인하고 있어요…</div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-neutral-100">
        <button onClick={navigateBack} className="h-11 w-6 flex items-center justify-start" aria-label="뒤로가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button className="h-11 w-6 invisible" aria-hidden="true" />
      </div>

      <div className="flex-1 px-5 py-2 pb-8 overflow-y-auto flex flex-col">
        <h1 className="mb-3 text-center text-[24px] font-bold leading-none">기록 시작</h1>
        {(startError || membershipError) && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{startError ?? membershipError}</div>}

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full overflow-hidden rounded-2xl">
            <button onClick={() => setShowGymModal(true)} disabled={isMembershipLoading || gymChoices.length === 0} className="w-full px-4 py-5 flex items-center justify-between bg-white hover:bg-neutral-50 border-b border-neutral-100 disabled:opacity-50">
              <div className="text-left"><div className="text-[13px] text-neutral-500 mb-1">지점 선택</div><div className="text-[16px] font-medium text-neutral-800">{selectedGym}</div></div>
              <span aria-hidden="true">⌄</span>
            </button>

            <div className="grid grid-cols-2 border-b border-neutral-100">
              <button onClick={() => setShowDatePicker(true)} className="px-4 py-5 text-left border-r border-neutral-100 hover:bg-neutral-50">
                <div className="text-[13px] text-neutral-500 mb-1">날짜 선택</div><div className="text-[16px] font-medium text-neutral-800">{selectedDate}</div>
              </button>
              <button onClick={() => { const parsed = parseTimeValue(selectedStartTime); setTempStartPeriod(parsed.period); setTempStartHour(String(parsed.hour)); setTempStartMinute(String(parsed.minute).padStart(2, '0')); setShowTimeModal(true); }} className="px-4 py-5 text-left hover:bg-neutral-50">
                <div className="text-[13px] text-neutral-500 mb-1">시작 시간</div><div className="text-[16px] font-medium text-neutral-800">{formatDisplayTime(selectedStartTime)}</div>
              </button>
            </div>

            <div className="px-4 py-4 border-b border-neutral-100">
              <div className="mb-3 text-[13px] text-neutral-500">기록 방식</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode('normal')} className={`min-h-11 rounded-full text-[14px] font-medium ${mode === 'normal' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>일반 모드</button>
                <button onClick={() => setMode('easy')} className={`min-h-11 rounded-full text-[14px] font-medium ${mode === 'easy' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>이지 모드</button>
              </div>
              <div className="mb-3 mt-5 text-[13px] text-neutral-500">세션 종류</div>
              <div className="grid grid-cols-3 gap-2">
                {SESSION_TYPES.map((option) => <button key={option.value} onClick={() => setSessionType(option.value)} className={`min-h-11 rounded-full text-[14px] font-medium ${sessionType === option.value ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>{option.label}</button>)}
              </div>
            </div>

            <div className="px-4 py-4 bg-white">
              <div className="flex items-center justify-between mb-4"><div className="text-[13px] text-neutral-500">회원권 선택</div><button onClick={() => navigateToScreen('membership')} className="min-h-10 px-3 py-2 bg-neutral-100 text-neutral-700 text-[13px] font-medium rounded-lg">회원권 수정</button></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button onClick={() => { setSelectedPassType('일일이용권'); setSelectedPass(null); setSelectedMembershipId(null); }} className={`flex-1 min-h-11 rounded-full text-[14px] font-medium ${selectedPassType === '일일이용권' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>일일이용권</button>
                <button onClick={() => { setTempPassType('횟수권'); setShowPassModal(true); }} className={`flex-1 min-h-11 rounded-full text-[14px] font-medium ${selectedPassType === '횟수권' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>횟수권</button>
                <button onClick={() => { setTempPassType('기간권'); setShowPassModal(true); }} className={`flex-1 min-h-11 rounded-full text-[14px] font-medium ${selectedPassType === '기간권' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>기간권</button>
                <button onClick={() => { setSelectedPassType('기타'); setSelectedPass(null); setSelectedMembershipId(null); }} className={`flex-1 min-h-11 rounded-full text-[14px] font-medium ${selectedPassType === '기타' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'}`}>기타</button>
              </div>
              <div className="mt-3 min-h-5 text-[14px] text-neutral-600">{formatPassSummary(selectedPassType, selectedPass)}</div>
              <div className="pt-6 flex justify-center"><button onClick={() => void handleStart()} disabled={!canStart || isStarting} className={`min-w-[180px] py-4 rounded-xl text-[16px] font-bold ${canStart && !isStarting ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-neutral-200 text-neutral-400'}`}>{isStarting ? '기록을 시작하는 중…' : '기록 시작하기'}</button></div>
            </div>
          </div>
        </div>
      </div>

      {showGymModal && <GymSelectModal gyms={gymChoices} selectedGymId={selectedGymId} onSelect={(gym) => { setSelectedGymId(gym.id); setSelectedGym(gym.name); setSelectedPassType(null); setSelectedPass(null); setSelectedMembershipId(null); setShowGymModal(false); }} onClose={() => setShowGymModal(false)} />}
      {showDatePicker && <DatePickerModal selectedYear={selectedYear} selectedMonth={selectedMonth} selectedDay={selectedDay} monthNames={MONTH_NAMES} getFirstDayOfMonth={(year, month) => new Date(year, month, 1).getDay()} getDaysInMonth={(year, month) => new Date(year, month + 1, 0).getDate()} onPrevMonth={() => moveSelectedMonth(-1)} onNextMonth={() => moveSelectedMonth(1)} onSelectDay={(day) => { setSelectedDay(day); setSelectedDate(formatRecordDate(selectedYear, selectedMonth, day)); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} />}
      {showPassModal && <PassSelectModal passType={tempPassType} countPasses={eligibleCountPasses} periodPasses={eligiblePeriodPasses} onSelect={(passType, pass, membershipId) => { setSelectedPassType(passType); setSelectedPass(pass); setSelectedMembershipId(membershipId); setShowPassModal(false); }} onClose={() => setShowPassModal(false)} />}
      {showTimeModal && <CenteredModalShell onClose={() => setShowTimeModal(false)} title="시작 시간 선택" panelClassName="bg-white rounded-[28px] p-5 w-[min(92vw,420px)]"><h3 className="text-[18px] font-bold text-center mb-2">시작 시간</h3><div className="flex gap-3"><TimeWheelColumn label="오전/오후" items={Array.from(TIME_PERIODS)} value={tempStartPeriod} onChange={(value) => setTempStartPeriod(value as (typeof TIME_PERIODS)[number])} /><TimeWheelColumn label="시" items={hourItems} value={tempStartHour} onChange={setTempStartHour} /><TimeWheelColumn label="분" items={minuteItems} value={tempStartMinute} onChange={setTempStartMinute} /></div><div className="flex gap-2 mt-5"><button onClick={() => setShowTimeModal(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">취소</button><button onClick={() => { setSelectedStartTime(formatTimeValue(tempStartPeriod, Number(tempStartHour), Number(tempStartMinute))); setShowTimeModal(false); }} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium">확인</button></div></CenteredModalShell>}
    </div>
  );
}
