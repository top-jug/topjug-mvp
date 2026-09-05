import { FormEvent, useEffect, useState } from 'react';
import { Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClientError } from '@/src/lib/api/error';
import {
  createOperationsGymSettingSector,
  deleteOperationsGymSettingSector,
  getOperationsGymSettingSectors,
  type OperationsGymSettingSectors,
  updateOperationsGymSettingSector,
} from './api';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';

interface OperationsSettingSectorManagerProps {
  gymId: string;
  onChanged?: (catalog: OperationsGymSettingSectors) => void;
}

export function OperationsSettingSectorManager({ gymId, onChanged }: OperationsSettingSectorManagerProps) {
  const [catalog, setCatalog] = useState<OperationsGymSettingSectors | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => controller.abort();
  }, [gymId]);

  function applyCatalog(next: OperationsGymSettingSectors) {
    setCatalog(next);
    setNames(Object.fromEntries(next.sectors.map((sector) => [sector.id, sector.name])));
    setConflict(false);
    setError('');
    onChanged?.(next);
  }

  async function loadCatalog(signal?: AbortSignal) {
    setLoading(true);
    try {
      applyCatalog(await getOperationsGymSettingSectors(gymId, signal));
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === 'AbortError') return;
      setError(nextError instanceof Error ? nextError.message : '세팅 구역을 불러오지 못했습니다.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  function showMutationError(nextError: unknown) {
    const apiError = nextError instanceof ApiClientError ? nextError : null;
    setConflict(apiError?.code === 'OPS_RESOURCE_CHANGED');
    const message = nextError instanceof Error ? nextError.message : '세팅 구역을 변경하지 못했습니다.';
    setError(message);
    toast.error(message);
  }

  async function addSector(event: FormEvent) {
    event.preventDefault();
    if (!catalog || !newName.trim()) return;
    setSavingId('new'); setError(''); setConflict(false);
    try {
      const next = await createOperationsGymSettingSector(gymId, newName.trim(), catalog.gym.updatedAt);
      applyCatalog(next);
      setNewName('');
      toast.success('세팅 구역을 추가했습니다.');
    } catch (nextError) { showMutationError(nextError); } finally { setSavingId(null); }
  }

  async function saveSector(sectorId: string, isActive: boolean) {
    if (!catalog) return;
    const name = names[sectorId]?.trim();
    if (!name) return;
    const wasActive = catalog.sectors.some((sector) => sector.id === sectorId && sector.isActive && sector.wall.isActive);
    setSavingId(sectorId); setError(''); setConflict(false);
    try {
      applyCatalog(await updateOperationsGymSettingSector(gymId, sectorId, {
        name,
        isActive,
        expectedUpdatedAt: catalog.gym.updatedAt,
      }));
      toast.success(wasActive ? '세팅 구역 이름을 저장했습니다.' : '세팅 구역을 다시 사용할 수 있습니다.');
    } catch (nextError) { showMutationError(nextError); } finally { setSavingId(null); }
  }

  async function removeSector(sectorId: string, usageCount: number) {
    if (!catalog) return;
    const message = usageCount > 0
      ? '과거 일정이나 기록에서 사용한 구역입니다. 이름을 보존하고 새 일정에서만 숨길까요?'
      : '이 세팅 구역을 삭제할까요?';
    if (!window.confirm(message)) return;
    setSavingId(sectorId); setError(''); setConflict(false);
    try {
      const result = await deleteOperationsGymSettingSector(gymId, sectorId, catalog.gym.updatedAt);
      applyCatalog(result);
      toast.success(result.mode === 'deactivated' ? '사용 중인 구역을 비활성화했습니다.' : '세팅 구역을 삭제했습니다.');
    } catch (nextError) { showMutationError(nextError); } finally { setSavingId(null); }
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm sm:p-6">
      <div>
        <h3 className="text-lg font-black">벽·구역 목록</h3>
        <p className="mt-1 text-sm text-slate-600">암장에서 실제로 부르는 벽·구역 이름을 등록하세요. 일정 하나에 여러 구역을 선택할 수 있습니다.</p>
        <p className="mt-1 text-xs text-slate-500">예: NEW WAVE, ARCH, 1 SECTOR, A 섹터, ALL</p>
      </div>

      {error && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"><span>{error}</span>{conflict && <button type="button" onClick={() => void loadCatalog()} className={`${buttonClass} bg-white text-red-700`}><RefreshCw className="h-4 w-4" />최신 정보</button>}</div>}

      <form onSubmit={addSector} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1"><span className="sr-only">새 세팅 구역 이름</span><input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} className={inputClass} placeholder="새 벽·구역 이름" /></label>
        <button disabled={!catalog || !newName.trim() || savingId !== null} className={`${buttonClass} bg-blue-600 text-white`}><Plus className="h-4 w-4" />구역 추가</button>
      </form>

      <div className="mt-4 space-y-2">
        {loading && <div className="rounded-xl bg-white p-5 text-center text-sm text-slate-500">세팅 구역을 불러오는 중입니다.</div>}
        {!loading && catalog?.sectors.length === 0 && <div className="rounded-xl border border-dashed border-blue-200 bg-white p-5 text-center text-sm text-slate-500">아직 등록된 구역이 없습니다. 위 입력칸에서 먼저 추가해주세요.</div>}
        {catalog?.sectors.map((sector) => {
          const active = sector.isActive && sector.wall.isActive;
          const changed = names[sector.id]?.trim() !== sector.name;
          return <div key={sector.id} className={`rounded-xl border p-3 ${active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100'}`}>
            {!sector.representsWholeWall && <p className="mb-2 text-xs font-black text-slate-500">{sector.wall.name} 안의 세부 구역</p>}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <label className="min-w-0 flex-1"><span className="sr-only">{sector.name} 이름</span><input disabled={!active || savingId !== null} value={names[sector.id] ?? sector.name} onChange={(event) => setNames((current) => ({ ...current, [sector.id]: event.target.value }))} maxLength={80} className={inputClass} /></label>
              <div className="flex flex-wrap gap-2">
                {active ? <>
                  <button type="button" disabled={!changed || !names[sector.id]?.trim() || savingId !== null} onClick={() => void saveSector(sector.id, true)} className={`${buttonClass} border border-blue-200 bg-blue-50 text-blue-700`}><Save className="h-4 w-4" />이름 저장</button>
                  <button type="button" disabled={savingId !== null} onClick={() => void removeSector(sector.id, sector.usageCount)} className={`${buttonClass} border border-red-200 bg-white text-red-600`}><Trash2 className="h-4 w-4" />삭제</button>
                </> : <button type="button" disabled={savingId !== null} onClick={() => void saveSector(sector.id, true)} className={`${buttonClass} border border-slate-300 bg-white text-slate-700`}><RotateCcw className="h-4 w-4" />다시 사용</button>}
              </div>
            </div>
            {sector.usageCount > 0 && <p className="mt-2 text-xs text-slate-500">과거 일정·기록 {sector.usageCount}건에서 사용 중 · 삭제하면 비활성화됩니다.</p>}
          </div>;
        })}
      </div>
    </section>
  );
}
