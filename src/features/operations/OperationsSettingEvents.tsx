import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { getGym, type ApiGymDetail } from '../../app/api/gym-api';
import { ApiClientError } from '../../lib/api/error';
import {
  createOperationsSettingEvent,
  deleteOperationsSettingEvent,
  listOperationsSettingEvents,
  type OperationsSettingEvent,
  type OperationsSettingEventFields,
  type OperationsSettingEventStatus,
  updateOperationsSettingEvent,
} from './api';
import type { OperationsGymSettingSectors } from './api';
import { OperationsSettingSectorManager } from './OperationsSettingSectorManager';
import {
  buildOperationsSettingEventCalendar,
  currentMonthInSeoul,
  operationsMonthRange,
  operationsSettingEventOccursOn,
  seoulDateKey,
  seoulDateTimeInputToIso,
  shiftOperationsMonth,
  toSeoulDateTimeInput,
} from './operations-setting-events';

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';
const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
const statusLabels: Record<OperationsSettingEventStatus, string> = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
};
const statusClasses: Record<OperationsSettingEventStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

type EventForm = {
  title: string;
  startsAt: string;
  endsAt: string;
  note: string;
  sectorIds: string[];
};

function defaultForm(month: string): EventForm {
  const today = seoulDateKey(new Date());
  const date = today.startsWith(month) ? today : `${month}-01`;
  return { title: '', startsAt: `${date}T10:00`, endsAt: `${date}T14:00`, note: '', sectorIds: [] };
}

function formFromEvent(event: OperationsSettingEvent): EventForm {
  return {
    title: event.title ?? '',
    startsAt: toSeoulDateTimeInput(event.startsAt),
    endsAt: event.endsAt ? toSeoulDateTimeInput(event.endsAt) : '',
    note: event.note ?? '',
    sectorIds: event.sectors.map((sector) => sector.id),
  };
}

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function displayRange(event: OperationsSettingEvent) {
  return event.endsAt
    ? `${displayDateTime(event.startsAt)} – ${displayDateTime(event.endsAt)}`
    : displayDateTime(event.startsAt);
}

function displaySector(sector: OperationsSettingEvent['sectors'][number]) {
  return sector.wall.name === sector.name ? sector.name : `${sector.wall.name} · ${sector.name}`;
}

function monthTitle(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}년 ${monthNumber}월`;
}

function EventStatus({ status }: { status: OperationsSettingEventStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

export function OperationsSettingEvents() {
  const { gymId = '' } = useParams();
  const [month, setMonth] = useState(() => currentMonthInSeoul());
  const [gym, setGym] = useState<ApiGymDetail | null>(null);
  const [events, setEvents] = useState<OperationsSettingEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<OperationsSettingEvent | null>(null);
  const [form, setForm] = useState<EventForm>(() => defaultForm(currentMonthInSeoul()));
  const [gymLoading, setGymLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  const calendar = useMemo(() => buildOperationsSettingEventCalendar(events, month), [events, month]);
  const visibleEvents = useMemo(
    () => selectedDate ? events.filter((event) => operationsSettingEventOccursOn(event, selectedDate)) : events,
    [events, selectedDate],
  );
  const sectorCount = gym?.walls.reduce(
    (count, wall) => count + (wall.isActive ? wall.sectors.filter((sector) => sector.isActive).length : 0),
    0,
  ) ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    void loadGym(controller.signal);
    return () => controller.abort();
  }, [gymId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEvents(month, controller.signal);
    return () => controller.abort();
  }, [gymId, month]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function loadGym(signal?: AbortSignal) {
    setGymLoading(true);
    try {
      const response = await getGym(gymId, signal);
      setGym(response.data);
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === 'AbortError') return;
      setError(nextError instanceof Error ? nextError.message : '암장 정보를 불러오지 못했습니다.');
    } finally {
      if (!signal?.aborted) setGymLoading(false);
    }
  }

  async function loadEvents(targetMonth = month, signal?: AbortSignal) {
    setEventsLoading(true);
    setError('');
    setConflict(false);
    try {
      const range = operationsMonthRange(targetMonth);
      const nextEvents = await listOperationsSettingEvents({ ...range, gymId }, signal);
      setEvents(nextEvents);
      return nextEvents;
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === 'AbortError') return [];
      const message = nextError instanceof Error ? nextError.message : '세팅 일정을 불러오지 못했습니다.';
      setError(message);
      toast.error(message);
      return [];
    } finally {
      if (!signal?.aborted) setEventsLoading(false);
    }
  }

  function changeForm<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
    setError('');
    setConflict(false);
  }

  function chooseMonth(nextMonth: string, nextSelectedDate: string | null = null) {
    if (!/^\d{4}-\d{2}$/.test(nextMonth)) return;
    if (dirty && !window.confirm('저장하지 않은 일정 변경을 버리고 다른 달로 이동할까요?')) return;
    setMonth(nextMonth);
    setSelectedDate(nextSelectedDate);
    setEditing(null);
    setForm(defaultForm(nextMonth));
    setDirty(false);
    setSaved(false);
  }

  function resetEditor(date = selectedDate) {
    if (dirty && !window.confirm('저장하지 않은 일정 변경을 버리고 새 일정을 작성할까요?')) return;
    const next = defaultForm(month);
    if (date) {
      next.startsAt = `${date}T10:00`;
      next.endsAt = `${date}T14:00`;
    }
    setEditing(null);
    setForm(next);
    setDirty(false);
    setSaved(false);
  }

  function handleSectorsChanged(catalog: OperationsGymSettingSectors) {
    const existingIds = new Set(catalog.sectors.map((sector) => sector.id));
    const selectableIds = new Set(catalog.sectors
      .filter((sector) => (sector.isActive && sector.wall.isActive) || editing?.sectors.some((item) => item.id === sector.id))
      .map((sector) => sector.id));
    setForm((current) => ({
      ...current,
      sectorIds: current.sectorIds.filter((id) => existingIds.has(id) && selectableIds.has(id)),
    }));
    void loadGym();
  }

  function startEdit(event: OperationsSettingEvent) {
    if (dirty && !window.confirm('저장하지 않은 일정 변경을 버리고 다른 일정을 편집할까요?')) return;
    setEditing(event);
    setForm(formFromEvent(event));
    setDirty(false);
    setSaved(false);
    document.getElementById('setting-event-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showMutationError(nextError: unknown) {
    const apiError = nextError instanceof ApiClientError ? nextError : null;
    setConflict(apiError?.code === 'OPS_RESOURCE_CHANGED');
    const message = nextError instanceof Error ? nextError.message : '세팅 일정을 저장하지 못했습니다.';
    setError(message);
    toast.error(message);
  }

  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    setError('');
    setConflict(false);
    if (form.sectorIds.length === 0) {
      setError('대상 구역을 하나 이상 선택해주세요.');
      return;
    }
    setSaving(true);
    try {
      const startsAt = seoulDateTimeInputToIso(form.startsAt);
      const endsAt = form.endsAt ? seoulDateTimeInputToIso(form.endsAt) : null;
      if (endsAt && new Date(endsAt) < new Date(startsAt)) throw new Error('종료 시각은 시작 시각보다 빠를 수 없습니다.');
      const fields: OperationsSettingEventFields = {
        title: form.title.trim(),
        startsAt,
        endsAt,
        note: form.note.trim() || null,
        sectorIds: form.sectorIds,
      };
      const next = editing
        ? await updateOperationsSettingEvent(editing.id, { ...fields, expectedUpdatedAt: editing.updatedAt })
        : await createOperationsSettingEvent(gymId, fields);
      setEditing(next);
      setForm(formFromEvent(next));
      setDirty(false);
      setSaved(true);
      await loadEvents();
      toast.success(editing ? '세팅 일정을 수정했습니다.' : '세팅 일정을 등록했습니다.');
    } catch (nextError) {
      showMutationError(nextError);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: 'completed' | 'cancelled') {
    if (!editing) return;
    const action = status === 'completed' ? '완료' : '취소';
    if (!window.confirm(`이 세팅 일정을 ${action} 처리할까요?`)) return;
    setSaving(true); setError(''); setConflict(false);
    try {
      const next = await updateOperationsSettingEvent(editing.id, { status, expectedUpdatedAt: editing.updatedAt });
      setEditing(next);
      setForm(formFromEvent(next));
      setDirty(false);
      setSaved(true);
      await loadEvents();
      toast.success(`세팅 일정을 ${action} 처리했습니다.`);
    } catch (nextError) { showMutationError(nextError); } finally { setSaving(false); }
  }

  async function removeEvent() {
    if (!editing || !window.confirm('잘못 생성된 세팅 일정을 삭제할까요? 사용자 화면에서도 즉시 사라집니다.')) return;
    setSaving(true); setError(''); setConflict(false);
    try {
      await deleteOperationsSettingEvent(editing.id, editing.updatedAt);
      setEditing(null);
      setForm(defaultForm(month));
      setDirty(false);
      setSaved(true);
      await loadEvents();
      toast.success('세팅 일정을 삭제했습니다.');
    } catch (nextError) { showMutationError(nextError); } finally { setSaving(false); }
  }

  if (gymLoading && !gym) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">세팅 일정 화면을 불러오는 중입니다.</div>;
  if (!gym) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{error || '암장을 찾을 수 없습니다.'}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={`/ops/gyms/${gymId}`} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" />암장 정보</Link>
          <h2 className="mt-3 text-2xl font-black">{gym.branchName ? `${gym.name} ${gym.branchName}` : gym.name} 세팅 일정</h2>
          <p className="mt-1 text-sm text-slate-500">대한민국 표준시 기준 · 활성 세팅 구역 {sectorCount}개</p>
        </div>
        <Link to={`/gyms/${gymId}`} className={`${buttonClass} border border-slate-200 bg-white text-slate-700`}>사용자 화면 보기</Link>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><span>{error}</span>{conflict && <button type="button" onClick={() => window.location.reload()} className={`${buttonClass} bg-white text-red-700`}><RefreshCw className="h-4 w-4" />최신 정보 불러오기</button>}</div>}
      {saved && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />세팅 일정 변경 사항을 저장했습니다.</span><button type="button" onClick={() => toast.info('알림 전송은 후속 기능에서 연결됩니다.')} className={`${buttonClass} border border-emerald-300 bg-white text-emerald-800`}><Bell className="h-4 w-4" />알림 보내기</button></div>}

      <OperationsSettingSectorManager gymId={gymId} onChanged={handleSectorsChanged} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-lg font-black">월간 캘린더</h3><p className="mt-1 text-sm text-slate-500">날짜를 선택하면 아래 목록을 해당 날짜 일정으로 좁힙니다.</p></div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <button type="button" aria-label="이전 달" onClick={() => chooseMonth(shiftOperationsMonth(month, -1))} className="min-h-11 min-w-11 rounded-xl border border-slate-200"><ChevronLeft className="mx-auto h-5 w-5" /></button>
            <label><span className="sr-only">조회 월</span><input type="month" value={month} onChange={(event) => chooseMonth(event.target.value)} className={`${inputClass} mt-0 min-w-36 text-center font-black`} /></label>
            <button type="button" aria-label="다음 달" onClick={() => chooseMonth(shiftOperationsMonth(month, 1))} className="min-h-11 min-w-11 rounded-xl border border-slate-200"><ChevronRight className="mx-auto h-5 w-5" /></button>
          </div>
        </div>
        <p className="mt-4 text-center text-lg font-black sm:hidden">{monthTitle(month)}</p>
        <div className="mt-4 grid grid-cols-7 border-l border-t border-slate-200 text-center text-xs font-black text-slate-500">
          {dayLabels.map((label, index) => <div key={label} className={`border-b border-r border-slate-200 py-2 ${index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : ''}`}>{label}</div>)}
          {calendar.map((cell) => (
            <button
              key={cell.date}
              type="button"
              aria-label={`${cell.date} · ${cell.events.length > 0 ? `일정 ${cell.events.length}개` : '일정 없음'}`}
              onClick={() => cell.inMonth
                ? setSelectedDate((current) => current === cell.date ? null : cell.date)
                : chooseMonth(cell.date.slice(0, 7), cell.date)}
              className={`min-h-16 min-w-0 border-b border-r border-slate-200 p-1 text-left align-top transition sm:min-h-28 sm:p-2 ${cell.inMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'} ${selectedDate === cell.date ? 'ring-2 ring-inset ring-blue-500' : ''}`}
            >
              <span className="text-xs font-black sm:text-sm">{cell.day}</span>
              <span className="mt-1 flex flex-wrap gap-1 sm:hidden">{cell.events.slice(0, 3).map((event) => <span key={event.id} className={`h-2 w-2 rounded-full ${event.status === 'scheduled' ? 'bg-blue-500' : event.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'}`} />)}</span>
              <span className="mt-1 hidden space-y-1 sm:block">{cell.events.slice(0, 2).map((event) => <span key={event.id} className={`block truncate rounded px-1.5 py-1 text-[11px] font-bold ${statusClasses[event.status]}`}>{event.title || '세팅'}</span>)}{cell.events.length > 2 && <span className="block text-[11px] font-bold text-slate-500">+{cell.events.length - 2}개</span>}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,.9fr)] xl:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{selectedDate ? `${selectedDate} 일정` : `${monthTitle(month)} 일정`}</h3><p className="mt-1 text-sm text-slate-500">{selectedDate ? '날짜 선택을 다시 누르면 전체 목록으로 돌아갑니다.' : '시작 시각 순으로 표시됩니다.'}</p></div>{selectedDate && <button type="button" onClick={() => setSelectedDate(null)} className={`${buttonClass} border border-slate-200`}>전체 보기</button>}</div>
          <div className="mt-5 space-y-3">
            {eventsLoading && <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">일정을 불러오는 중입니다.</div>}
            {!eventsLoading && visibleEvents.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><CalendarDays className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">등록된 세팅 일정이 없습니다.</p></div>}
            {visibleEvents.map((event) => <article key={event.id} className={`rounded-2xl border p-4 ${editing?.id === event.id ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-black text-slate-950">{event.title || '제목 없는 세팅'}</h4><EventStatus status={event.status} /></div><p className="mt-2 text-sm font-bold text-slate-600">{displayRange(event)}</p><p className="mt-1 text-sm text-slate-500">{event.sectors.map(displaySector).join(', ')}</p>{event.note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{event.note}</p>}</div><button type="button" onClick={() => startEdit(event)} className={`${buttonClass} border border-slate-200 bg-white`}><Pencil className="h-4 w-4" />편집</button></div></article>)}
          </div>
        </section>

        <section id="setting-event-editor" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-600">{editing ? '일정 편집' : '새 일정'}</p><h3 className="mt-1 text-lg font-black">{editing?.title || '세팅 일정 등록'}</h3></div>{editing && <div className="flex flex-wrap items-center gap-2"><EventStatus status={editing.status} /><button type="button" onClick={() => resetEditor()} className={`${buttonClass} border border-blue-200 bg-blue-50 text-blue-700`}><Plus className="h-4 w-4" />새 일정 작성</button></div>}</div>
          <form onSubmit={saveEvent} className="mt-5 space-y-4">
            <label className="block text-sm font-black text-slate-700">제목 *<input required maxLength={100} value={form.title} onChange={(event) => changeForm('title', event.target.value)} className={inputClass} placeholder="예: A벽 정기 세팅" /></label>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><label className="block text-sm font-black text-slate-700">시작 *<input required type="datetime-local" value={form.startsAt} onChange={(event) => changeForm('startsAt', event.target.value)} className={inputClass} /></label><label className="block text-sm font-black text-slate-700">종료<input type="datetime-local" min={form.startsAt} value={form.endsAt} onChange={(event) => changeForm('endsAt', event.target.value)} className={inputClass} /></label></div>
            <label className="block text-sm font-black text-slate-700">메모<textarea maxLength={1000} value={form.note} onChange={(event) => changeForm('note', event.target.value)} className={`${inputClass} min-h-24 py-3`} placeholder="운영자와 사용자에게 필요한 안내" /></label>
            <fieldset><legend className="text-sm font-black text-slate-700">대상 구역 * <span className="font-medium text-slate-500">(여러 개 선택 가능)</span></legend><div className="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">{gym.walls.map((wall) => {
              const visibleSectors = wall.sectors.filter((sector) => (wall.isActive && sector.isActive) || form.sectorIds.includes(sector.id));
              if (visibleSectors.length === 0) return null;
              const wholeWall = visibleSectors.length === 1 && visibleSectors[0].name === wall.name;
              return <div key={wall.id}>{!wholeWall && <p className="text-xs font-black uppercase tracking-wide text-slate-500">{wall.name}</p>}<div className={`${wholeWall ? '' : 'mt-1'} grid gap-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2`}>{visibleSectors.map((sector) => {
                const active = wall.isActive && sector.isActive;
                const checked = form.sectorIds.includes(sector.id);
                return <label key={sector.id} className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold ${active ? 'cursor-pointer hover:bg-slate-50' : 'text-slate-400'}`}><input type="checkbox" disabled={!active && !checked} checked={checked} onChange={(event) => changeForm('sectorIds', event.target.checked ? [...form.sectorIds, sector.id] : form.sectorIds.filter((id) => id !== sector.id))} className="h-5 w-5 rounded border-slate-300" /><span>{wholeWall ? wall.name : sector.name}{!active && <span className="ml-1 text-xs">비활성</span>}</span></label>;
              })}</div></div>;
            })}{sectorCount === 0 && form.sectorIds.length === 0 && <p className="py-4 text-center text-sm text-slate-500">위의 세팅 구역 관리에서 벽·구역을 먼저 추가해주세요.</p>}</div></fieldset>
            <button disabled={saving || (sectorCount === 0 && form.sectorIds.length === 0)} className={`${buttonClass} w-full bg-blue-600 text-white`}><Save className="h-4 w-4" />{saving ? '저장 중…' : editing ? '일정 수정' : '일정 등록'}</button>
          </form>
          {editing && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{editing.status === 'scheduled' && <><button type="button" disabled={saving} onClick={() => void changeStatus('completed')} className={`${buttonClass} border border-emerald-200 bg-emerald-50 text-emerald-700`}><CheckCircle2 className="h-4 w-4" />완료 처리</button><button type="button" disabled={saving} onClick={() => void changeStatus('cancelled')} className={`${buttonClass} border border-amber-200 bg-amber-50 text-amber-700`}><CircleX className="h-4 w-4" />취소 처리</button></>}<button type="button" disabled={saving} onClick={() => void removeEvent()} className={`${buttonClass} border border-red-200 text-red-600 sm:col-span-2 xl:col-span-1 2xl:col-span-2`}><Trash2 className="h-4 w-4" />잘못 생성된 일정 삭제</button></div>}
        </section>
      </div>
    </div>
  );
}
