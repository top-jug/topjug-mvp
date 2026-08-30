import { FormEvent, useEffect, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { Link } from 'react-router';
import { GymOperationStatus, listOperationsGyms, operationStatusLabels, OperationsGymSummary } from './api';

const statusClass: Record<GymOperationStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  temporarily_closed: 'bg-amber-50 text-amber-700',
  closed: 'bg-slate-200 text-slate-700',
  opening_soon: 'bg-blue-50 text-blue-700',
};

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '확인 기록 없음';
}

export function OperationsGymList() {
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<GymOperationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [gyms, setGyms] = useState<OperationsGymSummary[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listOperationsGyms({ q: query || undefined, operationStatus: status || undefined, page }, controller.signal)
      .then((response) => { setGyms(response.data); setMeta(response.meta); })
      .catch((nextError) => { if (!(nextError instanceof DOMException && nextError.name === 'AbortError')) setError(nextError instanceof Error ? nextError.message : '암장 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, status]);

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(draftQuery.trim());
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-bold text-blue-600">전체 {meta.total.toLocaleString()}개</p><h2 className="mt-1 text-2xl font-black">암장 관리</h2><p className="mt-1 text-sm text-slate-500">최근 수정된 암장부터 표시됩니다.</p></div>
        <Link to="/ops/gyms/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><Plus className="h-4 w-4" />암장 등록</Link>
      </div>

      <form onSubmit={search} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative"><span className="sr-only">암장 검색</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="이름, 지점명, 주소 검색" className="min-h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
        <label><span className="sr-only">운영 상태</span><select value={status} onChange={(event) => { setStatus(event.target.value as GymOperationStatus | ''); setPage(1); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500"><option value="">전체 상태</option>{Object.entries(operationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-black hover:bg-slate-50">검색</button>
      </form>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-10 text-center text-sm text-slate-500">암장 목록을 불러오는 중입니다.</div> : gyms.length === 0 ? <div className="p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-600">조건에 맞는 암장이 없습니다.</p></div> : (
          <div className="divide-y divide-slate-100">{gyms.map((gym) => <Link key={gym.id} to={`/ops/gyms/${gym.id}`} className="grid gap-3 p-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_150px_190px] sm:items-center sm:p-5">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black">{gym.name}{gym.branchName ? ` ${gym.branchName}` : ''}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass[gym.operationStatus]}`}>{operationStatusLabels[gym.operationStatus]}</span></div><p className="mt-1 truncate text-sm text-slate-500">{gym.address}</p></div>
            <div><p className="text-xs font-bold text-slate-400">마지막 확인</p><p className="mt-1 text-sm font-semibold text-slate-700">{dateTime(gym.lastVerifiedAt)}</p></div>
            <div><p className="text-xs font-bold text-slate-400">마지막 수정</p><p className="mt-1 text-sm font-semibold text-slate-700">{dateTime(gym.updatedAt)}</p></div>
          </Link>)}</div>
        )}
      </div>
      <div className="flex items-center justify-center gap-3"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40" aria-label="이전 페이지"><ChevronLeft className="h-5 w-5" /></button><span className="min-w-24 text-center text-sm font-black">{meta.page} / {meta.totalPages}</span><button disabled={page >= meta.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 disabled:opacity-40" aria-label="다음 페이지"><ChevronRight className="h-5 w-5" /></button></div>
    </div>
  );
}
