import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Clock3, Layers3, RefreshCw, Save, Tags } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiClientError } from '../../lib/api/error';
import {
  createOperationsGym,
  getOperationsGym,
  GymOperationStatus,
  operationStatusLabels,
  OperationsGym,
  OperationsGymFields,
  updateOperationsGym,
  updateOperationsGymStatus,
  verifyOperationsGym,
} from './api';
import { OperationsGymMedia } from './OperationsGymMedia';

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const textareaClass = `${inputClass} min-h-24 py-3`;

const emptyFields: OperationsGymFields = {
  name: '',
  branchName: null,
  address: '',
  phone: null,
  websiteUrl: null,
  instagramUrl: null,
  nearbyDirections: null,
  operatingHoursNote: null,
  parkingInfo: null,
  calendarColor: null,
  calendarTextColor: null,
  facilities: [],
  dayPassPrice: null,
  shoeRentalPrice: null,
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)) : '아직 확인하지 않음';
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block text-sm font-black text-slate-700">{label}{children}{hint && <span className="mt-1 block text-xs font-medium text-slate-400">{hint}</span>}</label>;
}

export function OperationsGymEditor() {
  const { gymId } = useParams();
  const editing = Boolean(gymId);
  const navigate = useNavigate();
  const location = useLocation();
  const [fields, setFields] = useState<OperationsGymFields>(emptyFields);
  const [gym, setGym] = useState<OperationsGym | null>(null);
  const [status, setStatus] = useState<GymOperationStatus>('active');
  const [facilitiesText, setFacilitiesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(Boolean((location.state as { saved?: boolean } | null)?.saved));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    (gymId ? getOperationsGym(gymId, controller.signal) : Promise.resolve(null))
      .then((nextGym) => {
        if (nextGym) {
          const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, lastVerifiedAt: _lastVerifiedAt, operationStatus, ...nextFields } = nextGym;
          setGym(nextGym);
          setFields(nextFields);
          setFacilitiesText(nextFields.facilities.join(', '));
          setStatus(operationStatus);
        }
      })
      .catch((nextError) => { if (!(nextError instanceof DOMException && nextError.name === 'AbortError')) setError(nextError instanceof Error ? nextError.message : '암장 정보를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gymId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change<K extends keyof OperationsGymFields>(key: K, value: OperationsGymFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function priceChange(key: 'dayPassPrice' | 'shoeRentalPrice', part: 'amount' | 'rawText', value: string) {
    const current = fields[key] ?? { amount: null, rawText: '' };
    const next = { ...current, [part]: part === 'amount' ? (value === '' ? null : Number(value)) : value };
    change(key, next.rawText || next.amount !== null ? next : null);
  }

  function normalizedFields(): OperationsGymFields {
    const normalizePrice = (price: OperationsGymFields['dayPassPrice']) => price?.rawText.trim() ? { ...price, rawText: price.rawText.trim() } : null;
    const facilities = [...new Set(facilitiesText.split(',').map((item) => item.trim()).filter(Boolean))];
    return { ...fields, facilities, dayPassPrice: normalizePrice(fields.dayPassPrice), shoeRentalPrice: normalizePrice(fields.shoeRentalPrice) };
  }

  function showError(nextError: unknown) {
    const apiError = nextError instanceof ApiClientError ? nextError : null;
    setConflict(apiError?.code === 'OPS_RESOURCE_CHANGED');
    setError(nextError instanceof Error ? nextError.message : '요청을 처리하지 못했습니다.');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(''); setConflict(false);
    try {
      if (gymId && gym) {
        const updated = await updateOperationsGym(gymId, { ...normalizedFields(), expectedUpdatedAt: gym.updatedAt });
        setGym(updated); setFields(normalizedFields()); setDirty(false); setSaved(true);
      } else {
        const created = await createOperationsGym({ ...normalizedFields(), operationStatus: status });
        setGym(created);
        setFields(normalizedFields());
        setDirty(false);
        setSaved(true);
        navigate(`/ops/gyms/${created.id}`, { replace: true, state: { saved: true } });
      }
    } catch (nextError) { showError(nextError); } finally { setSaving(false); }
  }

  async function saveStatus() {
    if (!gymId || !gym) return;
    setSaving(true); setError(''); setConflict(false);
    try {
      const updated = await updateOperationsGymStatus(gymId, status, gym.updatedAt);
      setGym(updated); setDirty(false); setSaved(true);
    } catch (nextError) { showError(nextError); } finally { setSaving(false); }
  }

  async function verify() {
    if (!gymId || !gym) return;
    setSaving(true); setError(''); setConflict(false);
    try {
      const updated = await verifyOperationsGym(gymId, gym.updatedAt);
      setGym(updated); setSaved(true);
      toast.success('암장 정보 확인 시각을 기록했습니다.');
    } catch (nextError) { showError(nextError); } finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">암장 정보를 불러오는 중입니다.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link to="/ops/gyms" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" />암장 목록</Link><h2 className="mt-3 text-2xl font-black">{editing ? '암장 정보 편집' : '새 암장 등록'}</h2>{gym && <p className="mt-1 text-sm text-slate-500">ID {gym.id}</p>}</div>{gym && <div className="flex flex-col gap-2 sm:items-end"><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"><Link to={`/gyms/${gym.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">사용자 화면 보기</Link><Link to={`/ops/gyms/${gym.id}/hours`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700"><Clock3 className="h-4 w-4" />운영시간 관리</Link><Link to={`/ops/gyms/${gym.id}/setting-sectors`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700"><Layers3 className="h-4 w-4" />세팅 구역 관리</Link><Link to={`/ops/gyms/${gym.id}/setting-events`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white"><CalendarDays className="h-4 w-4" />세팅 일정 관리</Link></div><div className="rounded-xl bg-slate-100 px-4 py-3 text-sm"><span className="font-bold text-slate-500">마지막 확인 </span><span className="font-black">{dateTime(gym.lastVerifiedAt)}</span><span className="mx-2 text-slate-300">·</span><span className="font-bold text-slate-500">수정 </span><span className="font-black">{dateTime(gym.updatedAt)}</span></div></div>}</div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><span>{error}</span>{conflict && <button onClick={() => window.location.reload()} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2"><RefreshCw className="h-4 w-4" />최신 정보 불러오기</button>}</div>}
      {saved && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />변경 사항을 저장했습니다.</span><button type="button" onClick={() => toast.info('알림 전송은 후속 이슈에서 연결됩니다.')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-emerald-800"><Bell className="h-4 w-4" />알림 보내기</button></div>}

      {editing && gym && <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto_auto_auto] md:items-end"><Field label="운영 상태"><select value={status} onChange={(event) => setStatus(event.target.value as GymOperationStatus)} className={inputClass}>{Object.entries(operationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Link to={`/ops/gym-tags?gymId=${gym.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-black"><Tags className="h-4 w-4" />키워드 배정</Link><button disabled={saving || status === gym.operationStatus} onClick={() => void saveStatus()} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40">상태 저장</button><button disabled={saving} onClick={() => void verify()} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-5 text-sm font-black text-blue-700 disabled:opacity-40">정보 확인 완료</button></section>}

      {editing && gym && <OperationsGymMedia
        gymId={gym.id}
        gymName={gym.branchName ? `${gym.name} ${gym.branchName}` : gym.name}
        updatedAt={gym.updatedAt}
        onUpdatedAt={(updatedAt) => {
          setGym((current) => current ? { ...current, updatedAt } : current);
          setSaved(true);
        }}
      />}

      <form onSubmit={save} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-lg font-black">기본 정보</h3><div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="암장명 *"><input required value={fields.name} onChange={(event) => change('name', event.target.value)} className={inputClass} /></Field>
          <Field label="지점명"><input value={fields.branchName ?? ''} onChange={(event) => change('branchName', event.target.value || null)} className={inputClass} /></Field>
          <div className="md:col-span-2"><Field label="주소 *"><input required value={fields.address} onChange={(event) => change('address', event.target.value)} className={inputClass} /></Field></div>
          <Field label="전화번호"><input value={fields.phone ?? ''} onChange={(event) => change('phone', event.target.value || null)} className={inputClass} /></Field>
          <Field label="찾아오는 길"><input value={fields.nearbyDirections ?? ''} onChange={(event) => change('nearbyDirections', event.target.value || null)} className={inputClass} /></Field>
          <Field label="웹사이트" hint="https:// 주소만 입력할 수 있습니다."><input type="url" value={fields.websiteUrl ?? ''} onChange={(event) => change('websiteUrl', event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
          <Field label="인스타그램" hint="https:// 주소만 입력할 수 있습니다."><input type="url" value={fields.instagramUrl ?? ''} onChange={(event) => change('instagramUrl', event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
          <div className="md:col-span-2"><Field label="보유시설" hint="쉼표로 구분해 입력하세요. 예: 샤워실, 주차, 라커"><input value={facilitiesText} onChange={(event) => { setFacilitiesText(event.target.value); setDirty(true); setSaved(false); }} className={inputClass} /></Field></div>
        </div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-lg font-black">운영 안내</h3><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="운영시간 안내"><textarea value={fields.operatingHoursNote ?? ''} onChange={(event) => change('operatingHoursNote', event.target.value || null)} className={textareaClass} /></Field><Field label="주차 안내"><textarea value={fields.parkingInfo ?? ''} onChange={(event) => change('parkingInfo', event.target.value || null)} className={textareaClass} /></Field></div></section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-lg font-black">가격과 캘린더 색상</h3><div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="일일 이용권 가격(원)"><input type="number" min="0" step="1" value={fields.dayPassPrice?.amount ?? ''} onChange={(event) => priceChange('dayPassPrice', 'amount', event.target.value)} className={inputClass} /></Field><Field label="일일 이용권 표시 문구"><input value={fields.dayPassPrice?.rawText ?? ''} onChange={(event) => priceChange('dayPassPrice', 'rawText', event.target.value)} className={inputClass} placeholder="예: 평일 20,000원" /></Field>
          <Field label="암벽화 대여 가격(원)"><input type="number" min="0" step="1" value={fields.shoeRentalPrice?.amount ?? ''} onChange={(event) => priceChange('shoeRentalPrice', 'amount', event.target.value)} className={inputClass} /></Field><Field label="암벽화 대여 표시 문구"><input value={fields.shoeRentalPrice?.rawText ?? ''} onChange={(event) => priceChange('shoeRentalPrice', 'rawText', event.target.value)} className={inputClass} placeholder="예: 3,000원" /></Field>
          <Field label="캘린더 배경색"><input type="color" value={fields.calendarColor ?? '#2563eb'} onChange={(event) => change('calendarColor', event.target.value)} className={`${inputClass} p-1`} /></Field><Field label="캘린더 글자색"><input type="color" value={fields.calendarTextColor ?? '#ffffff'} onChange={(event) => change('calendarTextColor', event.target.value)} className={`${inputClass} p-1`} /></Field>
        </div></section>

        {!editing && <section className="rounded-2xl border border-slate-200 bg-white p-5"><Field label="최초 운영 상태"><select value={status} onChange={(event) => setStatus(event.target.value as GymOperationStatus)} className={inputClass}>{Object.entries(operationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></section>}
        <div className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"><button disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? '저장 중…' : editing ? '변경 저장' : '암장 등록'}</button></div>
      </form>
    </div>
  );
}
