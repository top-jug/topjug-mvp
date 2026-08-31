import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Bell, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiClientError } from '../../lib/api/error';
import {
  batchOperationsHourOverrides,
  deleteOperationsHourOverride,
  getOperationsGym,
  OperationsGym,
  OperationsGymHours,
  replaceOperationsHourOverride,
  replaceOperationsWeeklyHours,
} from './api';
import {
  DAY_LABELS,
  EditableInterval,
  EditableOverride,
  EditableSchedule,
  emptyOverride,
  overridesFromRows,
  weeklyDaysFromRows,
} from './operations-hours';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40';

function todayInSeoul() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', weekday: 'short' })
    .format(new Date(`${value}T00:00:00+09:00`));
}

function scheduleText(schedule: EditableSchedule) {
  if (schedule.isClosed) return '휴무';
  return schedule.intervals.map((interval) => `${interval.opensAt}–${interval.closesAt}`).join(', ');
}

function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function nextInterval(intervals: EditableInterval[]): EditableInterval {
  const opensAt = intervals.at(-1)?.closesAt ?? '10:00';
  const [hour, minute] = opensAt.split(':').map(Number);
  const closesAtMinutes = Math.min((hour * 60) + minute + 120, (23 * 60) + 59);
  const closesAt = `${String(Math.floor(closesAtMinutes / 60)).padStart(2, '0')}:${String(closesAtMinutes % 60).padStart(2, '0')}`;
  return { opensAt, closesAt };
}

function ScheduleFields({ value, onChange }: { value: EditableSchedule; onChange: (value: EditableSchedule) => void }) {
  function intervalChange(index: number, field: keyof EditableInterval, nextValue: string) {
    onChange({ ...value, intervals: value.intervals.map((interval, position) => (
      position === index ? { ...interval, [field]: nextValue } : interval
    )) });
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={value.isClosed}
          onChange={(event) => onChange(event.target.checked
            ? { isClosed: true, intervals: [] }
            : { isClosed: false, intervals: [{ opensAt: '10:00', closesAt: '22:00' }] })}
          className="h-5 w-5 rounded border-slate-300"
        />
        휴무
      </label>
      {!value.isClosed && value.intervals.map((interval, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <label className="text-xs font-bold text-slate-500">시작<input aria-label={`운영 구간 ${index + 1} 시작`} type="time" value={interval.opensAt} onChange={(event) => intervalChange(index, 'opensAt', event.target.value)} className={`${inputClass} mt-1 px-2`} /></label>
          <span className="hidden pt-5 text-slate-400 sm:block">–</span>
          <label className="text-xs font-bold text-slate-500">종료<input aria-label={`운영 구간 ${index + 1} 종료`} type="time" value={interval.closesAt} onChange={(event) => intervalChange(index, 'closesAt', event.target.value)} className={`${inputClass} mt-1 px-2`} /></label>
          <div className="flex justify-end gap-1 sm:col-span-3">
            <button type="button" aria-label={`운영 구간 ${index + 1} 위로 이동`} disabled={index === 0} onClick={() => onChange({ ...value, intervals: move(value.intervals, index, index - 1) })} className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30"><ArrowUp className="mx-auto h-4 w-4" /></button>
            <button type="button" aria-label={`운영 구간 ${index + 1} 아래로 이동`} disabled={index === value.intervals.length - 1} onClick={() => onChange({ ...value, intervals: move(value.intervals, index, index + 1) })} className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30"><ArrowDown className="mx-auto h-4 w-4" /></button>
            <button type="button" aria-label={`운영 구간 ${index + 1} 삭제`} onClick={() => onChange({ ...value, intervals: value.intervals.filter((_, position) => position !== index) })} className="min-h-11 min-w-11 rounded-lg border border-red-200 text-red-600"><Trash2 className="mx-auto h-4 w-4" /></button>
          </div>
        </div>
      ))}
      {!value.isClosed && <button type="button" disabled={value.intervals.length >= 8} onClick={() => onChange({ ...value, intervals: [...value.intervals, nextInterval(value.intervals)] })} className={`${buttonClass} w-full border border-dashed border-blue-300 text-blue-700`}><Plus className="h-4 w-4" />운영 구간 추가</button>}
    </div>
  );
}

export function OperationsHoursEditor() {
  const { gymId = '' } = useParams();
  const initialDate = useMemo(todayInSeoul, []);
  const [gym, setGym] = useState<OperationsGym | null>(null);
  const [weekly, setWeekly] = useState(() => weeklyDaysFromRows([]));
  const [override, setOverride] = useState<EditableOverride>(() => emptyOverride(initialDate));
  const [endDate, setEndDate] = useState(initialDate);
  const [rangeMode, setRangeMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [batchConflict, setBatchConflict] = useState('');
  const [saved, setSaved] = useState(false);

  const overrides = useMemo(() => overridesFromRows(gym?.operatingHourOverrides ?? []), [gym?.operatingHourOverrides]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const nextGym = await getOperationsGym(gymId);
      setGym(nextGym);
      setWeekly(weeklyDaysFromRows(nextGym.operatingHours));
      setWeeklyDirty(false);
      setOverrideDirty(false);
      setConflict(false);
    } catch (nextError) {
      setError(nextError instanceof ApiClientError ? nextError.message : '운영시간을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [gymId]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!weeklyDirty && !overrideDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [overrideDirty, weeklyDirty]);

  function applyHours(next: OperationsGymHours) {
    setGym((current) => current ? {
      ...current,
      updatedAt: next.updatedAt,
      operatingHours: next.operatingHours,
      operatingHourOverrides: next.operatingHourOverrides,
    } : current);
    setWeekly(weeklyDaysFromRows(next.operatingHours));
  }

  function showError(nextError: unknown) {
    const apiError = nextError instanceof ApiClientError ? nextError : null;
    if (apiError?.code === 'OPS_RESOURCE_CHANGED') setConflict(true);
    if (apiError?.code === 'OPERATING_HOUR_OVERRIDE_EXISTS') {
      setBatchConflict(apiError.message);
      return;
    }
    setError(apiError?.message ?? '운영시간을 저장하지 못했습니다.');
  }

  async function saveWeekly() {
    if (!gym) return;
    setSaving(true); setError(''); setConflict(false); setSaved(false);
    try {
      const next = await replaceOperationsWeeklyHours(gymId, weekly, gym.updatedAt);
      applyHours(next);
      setWeeklyDirty(false);
      setSaved(true);
      toast.success('정규 운영시간을 저장했습니다.');
    } catch (nextError) { showError(nextError); } finally { setSaving(false); }
  }

  async function saveOverride(overwriteExisting = false) {
    if (!gym || !override.date) return;
    setSaving(true); setError(''); setConflict(false); setSaved(false);
    if (!overwriteExisting) setBatchConflict('');
    try {
      const schedule = { isClosed: override.isClosed, intervals: override.intervals, note: override.note };
      const next = rangeMode
        ? await batchOperationsHourOverrides(gymId, {
          ...schedule,
          startDate: override.date,
          endDate,
          overwriteExisting,
          expectedUpdatedAt: gym.updatedAt,
        })
        : await replaceOperationsHourOverride(gymId, override.date, schedule, gym.updatedAt);
      applyHours(next);
      setOverride(emptyOverride(override.date));
      setEndDate(override.date);
      setOverrideDirty(false);
      setBatchConflict('');
      setSaved(true);
      toast.success(rangeMode ? '기간 예외 운영시간을 저장했습니다.' : '예외 운영시간을 저장했습니다.');
    } catch (nextError) { showError(nextError); } finally { setSaving(false); }
  }

  async function removeOverride(date: string) {
    if (!gym || !window.confirm(`${displayDate(date)} 예외 운영시간을 삭제할까요?`)) return;
    setSaving(true); setError(''); setConflict(false); setSaved(false);
    try {
      const next = await deleteOperationsHourOverride(gymId, date, gym.updatedAt);
      applyHours(next);
      if (override.date === date) setOverride(emptyOverride(date));
      setSaved(true);
      toast.success('예외 운영시간을 삭제했습니다.');
    } catch (nextError) { showError(nextError); } finally { setSaving(false); }
  }

  function editOverride(item: EditableOverride) {
    setRangeMode(false);
    setOverride({ ...item, intervals: item.intervals.map((interval) => ({ ...interval })) });
    setEndDate(item.date);
    setOverrideDirty(false);
    setBatchConflict('');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">운영시간을 불러오는 중입니다.</div>;
  if (!gym) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{error || '암장을 찾을 수 없습니다.'}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><Link to={`/ops/gyms/${gymId}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" />암장 정보</Link><h2 className="mt-3 text-2xl font-black">{gym.name} 운영시간</h2><p className="mt-1 text-sm text-slate-500">대한민국 표준시(Asia/Seoul) 기준 · 수정 {new Date(gym.updatedAt).toLocaleString('ko-KR')}</p></div>
        <Link to={`/gyms/${gymId}`} className={`${buttonClass} border border-slate-200 bg-white text-slate-700`}>사용자 화면 보기</Link>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><span>{error}</span>{conflict && <button type="button" onClick={() => void load()} className={`${buttonClass} bg-white text-red-700`}><RefreshCw className="h-4 w-4" />최신 정보 불러오기</button>}</div>}
      {saved && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><span>운영시간 변경 사항을 저장했습니다.</span><button type="button" onClick={() => toast.info('알림 전송은 후속 이슈에서 연결됩니다.')} className={`${buttonClass} border border-emerald-300 bg-white text-emerald-800`}><Bell className="h-4 w-4" />알림 보내기</button></div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-lg font-black">정규 주간 운영시간</h3><p className="mt-1 text-sm text-slate-500">요일별 휴무 또는 최대 8개의 운영 구간을 시간순으로 입력하세요.</p></div><button type="button" disabled={saving || !weeklyDirty} onClick={() => void saveWeekly()} className={`${buttonClass} bg-blue-600 text-white`}><Save className="h-4 w-4" />정규시간 저장</button></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {weekly.map((day, index) => <div key={day.dayOfWeek} className="rounded-2xl border border-slate-200 p-4"><h4 className="mb-3 font-black">{DAY_LABELS[day.dayOfWeek]}요일</h4><ScheduleFields value={day} onChange={(schedule) => { setWeekly((current) => current.map((item, position) => position === index ? { ...item, ...schedule } : item)); setWeeklyDirty(true); setSaved(false); }} /></div>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-black">예외 운영시간 등록</h3><p className="mt-1 text-sm text-slate-500">특정 날짜 또는 최대 92일 기간의 휴무·단축·연장 운영을 등록합니다.</p>
          <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => { setRangeMode(false); setBatchConflict(''); }} className={`${buttonClass} ${!rangeMode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>날짜 1일</button>
            <button type="button" onClick={() => { setRangeMode(true); setEndDate(override.date); setBatchConflict(''); }} className={`${buttonClass} ${rangeMode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>기간</button>
          </div>
          <div className={`mt-4 grid gap-4 ${rangeMode ? 'sm:grid-cols-2' : ''}`}>
            <label className="text-sm font-bold text-slate-700">{rangeMode ? '시작일' : '날짜'}<input type="date" required value={override.date} onChange={(event) => { setOverride((current) => ({ ...current, date: event.target.value })); if (!rangeMode) setEndDate(event.target.value); setBatchConflict(''); }} className={`${inputClass} mt-1`} /></label>
            {rangeMode && <label className="text-sm font-bold text-slate-700">종료일<input type="date" required min={override.date} value={endDate} onChange={(event) => { setEndDate(event.target.value); setBatchConflict(''); }} className={`${inputClass} mt-1`} /></label>}
          </div>
          <div className="mt-4"><ScheduleFields value={override} onChange={(schedule) => { setOverride((current) => ({ ...current, ...schedule })); setOverrideDirty(true); setSaved(false); setBatchConflict(''); }} /></div>
          <label className="mt-4 block text-sm font-bold text-slate-700">예외 사유 메모<textarea value={override.note ?? ''} maxLength={300} onChange={(event) => { setOverride((current) => ({ ...current, note: event.target.value || null })); setOverrideDirty(true); setSaved(false); }} className={`${inputClass} mt-1 min-h-24 py-3`} placeholder="예: 공휴일 단축 운영" /></label>
          {batchConflict && <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900"><p>{batchConflict}</p><button type="button" disabled={saving} onClick={() => void saveOverride(true)} className={`${buttonClass} mt-3 bg-amber-700 text-white`}>표시된 날짜 포함 덮어쓰기</button></div>}
          <button type="button" disabled={saving || !override.date || (rangeMode && !endDate)} onClick={() => void saveOverride(false)} className={`${buttonClass} mt-5 w-full bg-blue-600 text-white`}><Save className="h-4 w-4" />{saving ? '저장 중…' : rangeMode ? '기간 예외 저장' : '날짜 예외 저장'}</button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-black">등록된 예외</h3><p className="mt-1 text-sm text-slate-500">예외를 삭제하면 해당 요일의 정규시간으로 돌아갑니다.</p>
          <div className="mt-5 space-y-3">
            {overrides.length === 0 && <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">등록된 예외 운영시간이 없습니다.</div>}
            {overrides.map((item) => <article key={item.date} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-black text-slate-900">{displayDate(item.date)}</p><p className="mt-1 text-sm font-bold text-blue-700">{scheduleText(item)}</p>{item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={() => editOverride(item)} className={`${buttonClass} flex-1 border border-slate-200 text-slate-700`}>수정</button><button type="button" disabled={saving} onClick={() => void removeOverride(item.date)} className={`${buttonClass} border border-red-200 text-red-600`}><Trash2 className="h-4 w-4" />삭제</button></div></article>)}
          </div>
        </section>
      </div>
    </div>
  );
}
