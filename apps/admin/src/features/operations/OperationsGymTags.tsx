import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Info, Pencil, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/app/components/ui/tooltip';
import {
  createOperationsGymTag,
  deleteOperationsGymTag,
  getOperationsGymTagAssignments,
  listOperationsGyms,
  listOperationsGymTags,
  OperationsGymSummary,
  OperationsGymTag,
  OperationsGymTagAssignments,
  OperationsGymTagFields,
  replaceOperationsGymTags,
  updateOperationsGymTag,
} from './api';
import { publicAppUrl } from './public-app-url';

const inputClass = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const emptyTag: OperationsGymTagFields = { code: '', label: '', description: null, sortOrder: 0, isActive: true };

function message(error: unknown) {
  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

function fieldsOf(tag: OperationsGymTag): OperationsGymTagFields {
  return {
    code: tag.code,
    label: tag.label,
    description: tag.description,
    sortOrder: tag.sortOrder,
    isActive: tag.isActive,
  };
}

function gymName(gym: Pick<OperationsGymSummary, 'name' | 'branchName'>) {
  return gym.branchName && !gym.name.includes(gym.branchName) ? `${gym.name} ${gym.branchName}` : gym.name;
}

function FieldLabel({ htmlFor, label, help }: { htmlFor: string; label: string; help: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor}>{label}</label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`${label} 도움말`} className="inline-flex rounded-full text-slate-400 outline-none transition hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <Info className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-72 leading-5">
          {help}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export function OperationsGymTags() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGymId = searchParams.get('gymId') ?? '';
  const [tags, setTags] = useState<OperationsGymTag[]>([]);
  const [tagLoading, setTagLoading] = useState(true);
  const [tagError, setTagError] = useState('');
  const [form, setForm] = useState<OperationsGymTagFields>(emptyTag);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [savingTag, setSavingTag] = useState(false);
  const [gymQuery, setGymQuery] = useState('');
  const [gyms, setGyms] = useState<OperationsGymSummary[]>([]);
  const [gymLoading, setGymLoading] = useState(false);
  const [assignment, setAssignment] = useState<OperationsGymTagAssignments | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadTags = useCallback(async (signal?: AbortSignal) => {
    setTagLoading(true);
    try {
      setTags(await listOperationsGymTags(signal));
      setTagError('');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setTagError(message(error));
    } finally {
      if (!signal?.aborted) setTagLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTags(controller.signal);
    return () => controller.abort();
  }, [loadTags]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setGymLoading(true);
      void listOperationsGyms({ q: gymQuery.trim() || undefined, page: 1, limit: 100 }, controller.signal)
        .then((response) => setGyms(response.data))
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setAssignmentError(message(error));
        })
        .finally(() => { if (!controller.signal.aborted) setGymLoading(false); });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [gymQuery]);

  useEffect(() => {
    if (!selectedGymId) {
      setAssignment(null);
      setSelectedTagIds([]);
      return;
    }
    const controller = new AbortController();
    setAssignment(null);
    setSelectedTagIds([]);
    setAssignmentError('');
    void getOperationsGymTagAssignments(selectedGymId, controller.signal)
      .then((next) => {
        setAssignment(next);
        setSelectedTagIds(next.tagIds);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setAssignmentError(message(error));
      });
    return () => controller.abort();
  }, [selectedGymId]);

  const gymOptions = useMemo(() => {
    const byId = new Map(gyms.map((gym) => [gym.id, gym]));
    if (assignment) byId.set(assignment.gym.id, { ...assignment.gym, address: '', operationStatus: 'active', lastVerifiedAt: null });
    return [...byId.values()];
  }, [assignment, gyms]);

  function resetForm() {
    setEditingTagId(null);
    setForm(emptyTag);
  }

  async function submitTag(event: FormEvent) {
    event.preventDefault();
    setSavingTag(true);
    setTagError('');
    try {
      if (editingTagId) {
        const current = tags.find((tag) => tag.id === editingTagId);
        if (!current) return;
        await updateOperationsGymTag(editingTagId, { ...form, expectedUpdatedAt: current.updatedAt });
      } else {
        await createOperationsGymTag(form);
      }
      await loadTags();
      resetForm();
      setSaved(true);
      toast.success(editingTagId ? '키워드를 수정했습니다.' : '키워드를 추가했습니다.');
    } catch (error) {
      setTagError(message(error));
    } finally {
      setSavingTag(false);
    }
  }

  async function toggleActive(tag: OperationsGymTag) {
    setTagError('');
    try {
      await updateOperationsGymTag(tag.id, { ...fieldsOf(tag), isActive: !tag.isActive, expectedUpdatedAt: tag.updatedAt });
      await loadTags();
      setSaved(true);
    } catch (error) {
      setTagError(message(error));
    }
  }

  async function removeTag(tag: OperationsGymTag) {
    if (!window.confirm(`“${tag.label}” 키워드를 삭제할까요?`)) return;
    setTagError('');
    try {
      await deleteOperationsGymTag(tag.id, tag.updatedAt);
      await loadTags();
      if (editingTagId === tag.id) resetForm();
      setSaved(true);
    } catch (error) {
      setTagError(message(error));
    }
  }

  async function saveAssignments() {
    if (!assignment) return;
    setSavingAssignment(true);
    setAssignmentError('');
    try {
      const updated = await replaceOperationsGymTags(assignment.gym.id, selectedTagIds, assignment.gym.updatedAt);
      setAssignment(updated);
      setSelectedTagIds(updated.tagIds);
      setSaved(true);
      await loadTags();
      toast.success('암장 키워드를 저장했습니다.');
    } catch (error) {
      setAssignmentError(message(error));
    } finally {
      setSavingAssignment(false);
    }
  }

  const conflict = (tagError || assignmentError).includes('다른 운영자');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Search dictionary</p>
        <h2 className="mt-1 text-2xl font-black">키워드 사전과 암장 배정</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">활성 키워드만 사용자 검색에 노출되며, 여러 키워드는 모두 만족하는 암장만 찾습니다.</p>
      </div>

      {saved && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />변경 사항을 저장했습니다.</span><button type="button" onClick={() => toast.info('알림 전송은 후속 이슈에서 연결됩니다.')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3"><Bell className="h-4 w-4" />알림 보내기</button></div>}
      {(tagError || assignmentError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><span>{tagError || assignmentError}</span>{conflict && <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2"><RefreshCw className="h-4 w-4" />최신 정보 불러오기</button>}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-black">키워드 사전</h3><p className="mt-1 text-sm text-slate-500">비활성화하면 기존 배정은 유지하되 사용자에게 숨깁니다.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{tags.length}개</span></div>

          <form onSubmit={submitTag} className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <div className="text-sm font-black text-slate-700"><FieldLabel htmlFor="gym-tag-label" label="표시 이름" help="사용자 화면에 노출되는 키워드 이름입니다. 한글로 이해하기 쉽게 작성하세요. 예: 샤워실" /><input id="gym-tag-label" required value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} className={inputClass} placeholder="예: 샤워실" /></div>
            <div className="text-sm font-black text-slate-700"><FieldLabel htmlFor="gym-tag-code" label="코드" help="시스템과 검색 URL에서 사용하는 고유 식별자입니다. 영문 소문자, 숫자, 밑줄(_), 하이픈(-)만 사용할 수 있으며 등록 후에는 가급적 변경하지 마세요. 예: shower" /><input id="gym-tag-code" required value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toLowerCase() }))} className={inputClass} placeholder="예: shower" pattern="[a-z0-9]+(?:[-_][a-z0-9]+)*" /></div>
            <label className="text-sm font-black text-slate-700 sm:col-span-2">설명<input value={form.description ?? ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value || null }))} className={inputClass} maxLength={200} placeholder="사용자에게 보여줄 간단한 설명" /></label>
            <div className="text-sm font-black text-slate-700"><FieldLabel htmlFor="gym-tag-sort-order" label="정렬 순서" help="사용자 화면과 운영 목록에 키워드가 표시되는 순서입니다. 숫자가 작을수록 먼저 표시됩니다. 예: 10, 20, 30" /><input id="gym-tag-sort-order" type="number" min="0" max="10000" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className={inputClass} placeholder="예: 10" /></div>
            <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4" />사용자 검색에 노출</label>
            <div className="flex gap-2 sm:col-span-2"><button disabled={savingTag} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50">{editingTagId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingTagId ? '수정 저장' : '키워드 추가'}</button>{editingTagId && <button type="button" onClick={resetForm} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">취소</button>}</div>
          </form>

          <div className="mt-5 space-y-3">
            {tagLoading ? <div className="py-10 text-center text-sm text-slate-500">키워드를 불러오는 중입니다.</div> : tags.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">등록된 키워드가 없습니다.</div> : tags.map((tag) => (
              <article key={tag.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-black">{tag.label}</h4><code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{tag.code}</code><span className={`rounded-full px-2 py-0.5 text-xs font-black ${tag.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{tag.isActive ? '활성' : '비활성'}</span></div><p className="mt-1 text-sm text-slate-500">{tag.description || '설명 없음'} · 암장 {tag.assignmentCount}곳 · 순서 {tag.sortOrder}</p></div>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void toggleActive(tag)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-black">{tag.isActive ? '비활성화' : '활성화'}</button><button type="button" onClick={() => { setEditingTagId(tag.id); setForm(fieldsOf(tag)); setSaved(false); }} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-black"><Pencil className="h-3.5 w-3.5" />수정</button><button type="button" disabled={tag.assignmentCount > 0} onClick={() => void removeTag(tag)} title={tag.assignmentCount > 0 ? '배정된 암장을 먼저 해제하세요.' : undefined} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />삭제</button></div>
              </article>
            ))}
          </div>
        </section>

        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-24">
          <h3 className="text-lg font-black">암장별 키워드 배정</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">검색 후 암장을 선택하고 적용할 키워드를 모두 체크하세요.</p>
          <label className="relative mt-5 block"><span className="sr-only">암장 검색</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={gymQuery} onChange={(event) => setGymQuery(event.target.value)} className={`${inputClass} mt-0 pl-9`} placeholder="암장명, 지점, 주소 검색" /></label>
          <label className="mt-3 block text-sm font-black text-slate-700">암장<select value={selectedGymId} onChange={(event) => { setSaved(false); setSearchParams(event.target.value ? { gymId: event.target.value } : {}); }} className={inputClass}><option value="">{gymLoading ? '암장 불러오는 중…' : '암장을 선택하세요'}</option>{gymOptions.map((gym) => <option key={gym.id} value={gym.id}>{gymName(gym)}</option>)}</select></label>

          {assignment && <div className="mt-5"><div className="rounded-xl bg-blue-50 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-blue-950">{gymName(assignment.gym)}</p><p className="mt-1 text-xs font-medium text-blue-700">선택 {selectedTagIds.length}개 · 모든 선택 키워드가 사용자 검색의 AND 조건입니다.</p></div><a href={publicAppUrl(`/gyms/${assignment.gym.id}`)} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700">사용자 화면 보기</a></div></div><fieldset className="mt-4 space-y-2"><legend className="mb-2 text-sm font-black text-slate-700">키워드 선택</legend>{tags.map((tag) => <label key={tag.id} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3"><span className="min-w-0"><span className="block truncate text-sm font-bold">{tag.label}</span><span className="block text-xs text-slate-400">{tag.isActive ? '사용자 노출' : '비활성'}</span></span><input type="checkbox" checked={selectedTagIds.includes(tag.id)} onChange={() => { setSaved(false); setSelectedTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id]); }} className="h-5 w-5" /></label>)}</fieldset><button type="button" disabled={savingAssignment} onClick={() => void saveAssignments()} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingAssignment ? '저장 중…' : '암장 키워드 저장'}</button></div>}
        </section>
      </div>
    </div>
  );
}
