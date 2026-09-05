import { FormEvent, useEffect, useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '@/src/app/components/figma/ImageWithFallback';
import { ApiClientError } from '@/src/lib/api/error';
import {
  addOperationsGymPhoto,
  deleteOperationsGymPhoto,
  getOperationsGymPhotos,
  type OperationsGymPhotos,
} from './api';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface OperationsGymMediaProps {
  gymId: string;
  gymName: string;
  updatedAt: string;
  onUpdatedAt: (updatedAt: string) => void;
}

export function OperationsGymMedia({ gymId, gymName, updatedAt, onUpdatedAt }: OperationsGymMediaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<OperationsGymPhotos | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getOperationsGymPhotos(gymId, controller.signal)
      .then((next) => setData(next))
      .catch((nextError) => {
        if (!(nextError instanceof DOMException && nextError.name === 'AbortError')) {
          setError(nextError instanceof Error ? nextError.message : '사진을 불러오지 못했습니다.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gymId]);

  function showError(nextError: unknown) {
    const apiError = nextError instanceof ApiClientError ? nextError : null;
    setConflict(apiError?.code === 'OPS_RESOURCE_CHANGED');
    setError(nextError instanceof Error ? nextError.message : '사진 요청을 처리하지 못했습니다.');
  }

  function apply(next: OperationsGymPhotos) {
    setData(next);
    setError('');
    setConflict(false);
    onUpdatedAt(next.gym.updatedAt);
  }

  function chooseFile(file: File | null) {
    setError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!SUPPORTED_TYPES.has(file.type)) {
      setSelectedFile(null);
      setError('JPEG, PNG, WebP 이미지만 선택할 수 있습니다.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null);
      setError('이미지는 최대 10 MiB까지 업로드할 수 있습니다.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!selectedFile || !data) return;
    setBusy('upload');
    setError('');
    try {
      apply(await addOperationsGymPhoto(gymId, selectedFile, updatedAt));
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      toast.success('암장 사진을 추가했습니다.');
    } catch (nextError) {
      showError(nextError);
    } finally {
      setBusy(null);
    }
  }

  async function remove(gymMediaId: string) {
    if (!data || !window.confirm('이 사진을 암장에서 삭제할까요?')) return;
    setBusy(gymMediaId);
    setError('');
    try {
      apply(await deleteOperationsGymPhoto(gymId, gymMediaId, updatedAt));
      toast.success('암장 사진을 삭제했습니다.');
    } catch (nextError) {
      showError(nextError);
    } finally {
      setBusy(null);
    }
  }

  const atLimit = Boolean(data && data.photos.length >= data.maxPhotos);

  return (
    <section aria-labelledby="operations-gym-photos-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="operations-gym-photos-title" className="text-lg font-black">암장 사진</h3>
          <p className="mt-1 text-sm text-slate-500">최근 추가한 사진이 사용자 암장 카드에 표시되며, 모든 사진은 상세 화면에 노출됩니다.</p>
        </div>
        <span className="text-sm font-bold text-slate-500">{data?.photos.length ?? 0} / {data?.maxPhotos ?? 20}장</span>
      </div>

      <form onSubmit={upload} className="mt-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 md:flex-row md:items-end">
        <label className="min-w-0 flex-1 text-sm font-black text-slate-700">
          JPEG, PNG 또는 WebP (최대 10 MiB)
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={Boolean(busy) || atLimit}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            className="mt-2 block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-black file:text-blue-700 disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={!selectedFile || Boolean(busy) || atLimit || loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-40"
        >
          <ImagePlus className="h-4 w-4" />{busy === 'upload' ? '추가 중…' : '사진 추가'}
        </button>
      </form>
      {atLimit && <p className="mt-2 text-sm font-bold text-amber-700">사진을 더 추가하려면 기존 사진을 삭제해주세요.</p>}

      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          <span>{error}</span>
          {conflict && <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-white px-3"><RefreshCw className="h-4 w-4" />최신 정보 불러오기</button>}
        </div>
      )}

      {loading ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">사진을 불러오는 중입니다.</p>
      ) : data?.photos.length ? (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.photos.map((photo, index) => (
            <li key={photo.gymMediaId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-[4/3] bg-slate-100">
                {photo.url
                  ? <ImageWithFallback src={photo.url} alt={`${gymName} 암장 사진 ${index + 1}`} className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center px-4 text-center text-sm font-bold text-slate-400">공개 미디어 URL을 설정하면 미리보기가 표시됩니다.</div>}
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="truncate text-xs font-bold text-slate-500">사진 {index + 1} · {(photo.byteSize / 1024).toFixed(0)} KiB</span>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void remove(photo.gymMediaId)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-200 text-red-600 disabled:opacity-40"
                  aria-label={`${gymName} 암장 사진 ${index + 1} 삭제`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">등록된 암장 사진이 없습니다.</p>
      )}
    </section>
  );
}
