import { ArrowLeft, Clipboard, Download, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { ClimbingRecord } from '../../entities/record/types';
import { createRecordShareImage } from '../../features/record/record-share-image';
import {
  createRecordShareModel,
  getRecordDifficultySummaries,
  RecordShareModel,
  ShareDifficultySummary,
} from '../../features/record/record-share-model';
import { runRecordShareAttempt } from '../../features/record/record-share-orchestrator';
import {
  ApiCreatedShare,
  ApiShareSummary,
  createRecordShare as requestCreateRecordShare,
  getRecord as fetchRecord,
  listRecordShares,
  mapApiRecordDetail,
  publicShareUrl,
  revokeRecordShare,
} from '../api/record-api';
import { useNavigateBack } from '../navigation';

const MAX_SELECTED_DIFFICULTIES = 5;
const MAX_COMMENT_LENGTH = 40;

export default function RecordSharePage() {
  const { recordId } = useParams();
  const [record, setRecord] = useState<ClimbingRecord | undefined>();
  const [shares, setShares] = useState<ApiShareSummary[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(recordId));
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareListError, setShareListError] = useState<string | null>(null);
  const navigateBack = useNavigateBack(record ? `/records/${record.id}` : '/records');
  const difficultySummaries = useMemo(() => record ? getRecordDifficultySummaries(record) : [], [record]);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [selectedDifficultyIndexes, setSelectedDifficultyIndexes] = useState<number[]>([]);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [activeAttemptShare, setActiveAttemptShare] = useState<ApiCreatedShare | null>(null);

  useEffect(() => {
    if (!recordId) return;

    let isActive = true;
    setRecord(undefined);
    setShares([]);
    setIsLoading(true);
    setError(null);
    setShareListError(null);

    fetchRecord(recordId)
      .then((recordPayload) => {
        if (!isActive) return;
        setRecord(mapApiRecordDetail(recordPayload.data));
      })
      .catch((fetchError) => {
        if (isActive) setError(fetchError instanceof Error ? fetchError.message : '공유할 기록을 불러오지 못했어요.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    listRecordShares(recordId)
      .then((sharePayload) => {
        if (isActive) setShares(sharePayload.data);
      })
      .catch((shareError) => {
        if (!isActive) return;
        setShares([]);
        setShareListError(shareError instanceof Error ? shareError.message : '공유 링크 목록을 불러오지 못했어요.');
      });

    return () => {
      isActive = false;
    };
  }, [recordId]);

  useEffect(() => {
    setView('edit');
    setSelectedDifficultyIndexes(
      difficultySummaries.slice(0, MAX_SELECTED_DIFFICULTIES).map((difficulty) => difficulty.difficultyIndex),
    );
    setComment('');
    setStatus('');
    setActiveAttemptShare(null);
  }, [recordId, difficultySummaries]);

  const shareOptions = useMemo(() => ({
    selectedDifficultyIndexes,
    comment,
  }), [comment, selectedDifficultyIndexes]);

  const shareModel = useMemo(
    () => record ? createRecordShareModel(record, shareOptions) : undefined,
    [record, shareOptions],
  );

  if (!recordId) return <Navigate to="/records" replace />;

  if ((isLoading && !record) || (record && record.id !== recordId)) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] pb-10 text-neutral-950">
        <header className="sticky top-0 z-10 grid grid-cols-[44px_1fr_44px] items-center border-b border-neutral-100 bg-white px-4 py-3">
          <button type="button" onClick={navigateBack} className="flex h-11 w-11 items-center justify-center" aria-label="기록 상세로 돌아가기">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-center text-[18px] font-bold">공유 이미지 편집</h1>
          <div />
        </header>
        <main className="mx-auto max-w-md space-y-4 px-5 py-5">
          <div className="h-[86px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
          <div className="h-[230px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
          <div className="h-[92px] animate-pulse rounded-3xl border border-neutral-200 bg-white" />
        </main>
      </div>
    );
  }

  if (error && !record) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] px-5 pb-10 pt-24 text-center text-neutral-950">
        <div className="text-[18px] font-bold">공유할 기록을 찾을 수 없어요</div>
        <div className="mt-2 text-[13px] text-neutral-500">{error}</div>
        <button onClick={navigateBack} className="mt-6 h-12 rounded-2xl bg-neutral-950 px-5 text-[14px] font-bold text-white">
          돌아가기
        </button>
      </div>
    );
  }

  if (!record || !shareModel) return <Navigate to="/records" replace />;

  const toggleDifficulty = (difficultyIndex: number) => {
    setSelectedDifficultyIndexes((current) => {
      if (current.includes(difficultyIndex)) {
        return current.filter((index) => index !== difficultyIndex);
      }

      if (current.length >= MAX_SELECTED_DIFFICULTIES) return current;
      return [...current, difficultyIndex].sort((left, right) => left - right);
    });
  };

  const openPreview = () => {
    setStatus('');
    setView('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getImageFile = async () => {
    const blob = await createRecordShareImage(record, shareOptions);
    return { blob, file: new File([blob], `topjug-${record.date}.png`, { type: 'image/png' }) };
  };

  const handleSave = async () => {
    try {
      const { blob, file } = await getImageFile();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('이미지를 저장했어요.');
    } catch {
      setStatus('이미지를 저장하지 못했어요.');
    }
  };

  const handleCopy = async () => {
    try {
      const { blob } = await getImageFile();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('이미지를 복사했어요.');
    } catch {
      setStatus('이 브라우저에서는 이미지 복사를 지원하지 않아요.');
    }
  };

  const handleShare = async () => {
    setIsCreatingLink(true);
    setStatus('');
    setActiveAttemptShare(null);

    try {
      const { file } = await getImageFile();
      const baseShareData = {
        files: [file],
        title: `${record.gym} 클라이밍 기록`,
      };
      const canNativeShare = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare(baseShareData);
      const result = await runRecordShareAttempt({
        createShare: async () => (await requestCreateRecordShare(record.id)).data,
        presentShare: async (share) => {
          const nextShareUrl = publicShareUrl(share);

          if (!canNativeShare) {
            await navigator.clipboard.writeText(nextShareUrl);
            return;
          }

          await navigator.share!({
            ...baseShareData,
            text: `오늘의 클라이밍 기록 #TopJug ${nextShareUrl}`,
          });
        },
        revokeShare: (share) => revokeRecordShare(record.id, share.id),
      });

      const resultShare = result.share;
      if (resultShare) {
        const shareStatus = result.outcome === 'cancelled-revoked' ? 'revoked' : resultShare.status;
        setShares((current) => [
          { ...resultShare, status: shareStatus },
          ...current.filter((share) => share.id !== resultShare.id),
        ]);
      }

      if (result.outcome === 'shared') {
        setStatus(canNativeShare
          ? '맞춤 이미지와 공개 링크를 공유했어요. 링크에는 기본 기록만 표시돼요.'
          : '기본 기록을 보여주는 공개 링크를 만들고 복사했어요.');
      } else if (result.outcome === 'cancelled-revoked') {
        setStatus('공유를 취소해 이번에 만든 공개 링크도 폐기했어요.');
      } else if (result.outcome === 'cancelled-active') {
        setActiveAttemptShare(result.share);
        setStatus('공유는 취소됐지만 새 공개 링크를 폐기하지 못했어요.');
      } else if (result.outcome === 'failed') {
        if (result.share) setActiveAttemptShare(result.share);
        setStatus(result.error instanceof Error ? result.error.message : '공유 링크를 만들거나 전달하지 못했어요.');
      }
    } catch (imageError) {
      setStatus(imageError instanceof Error ? imageError.message : '맞춤 이미지를 준비하지 못했어요.');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleCopyPublicLink = async (share: ApiCreatedShare) => {
    try {
      await navigator.clipboard.writeText(publicShareUrl(share));
      setStatus('활성 공개 링크를 복사했어요.');
    } catch {
      setStatus('공개 링크를 복사하지 못했어요. 아래 링크를 직접 관리해주세요.');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    setRevokingShareId(shareId);
    setStatus('');

    try {
      await revokeRecordShare(record.id, shareId);
      setShares((current) => current.map((share) => (
        share.id === shareId ? { ...share, status: 'revoked', revokedAt: new Date().toISOString() } : share
      )));
      if (activeAttemptShare?.id === shareId) setActiveAttemptShare(null);
      setStatus('공유 링크를 폐기했어요.');
    } catch (revokeError) {
      setStatus(revokeError instanceof Error ? revokeError.message : '공유 링크를 폐기하지 못했어요.');
    } finally {
      setRevokingShareId(null);
    }
  };

  if (view === 'edit') {
    return (
      <ShareEditor
        record={record}
        difficulties={difficultySummaries}
        selectedDifficultyIndexes={selectedDifficultyIndexes}
        comment={comment}
        onBack={navigateBack}
        onToggleDifficulty={toggleDifficulty}
        onChangeComment={setComment}
        onOpenPreview={openPreview}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-5 pb-10 text-neutral-950">
      <header className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center py-4">
        <button
          type="button"
          onClick={() => {
            setStatus('');
            setView('edit');
          }}
          className="flex h-11 items-center gap-1 justify-self-start text-[13px] font-semibold text-neutral-600"
        >
          <ArrowLeft size={18} />
          다시 편집
        </button>
        <div className="text-[17px] font-bold">공유 미리보기</div>
        <button onClick={navigateBack} className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-white shadow-sm" aria-label="공유 화면 닫기">
          <X size={21} />
        </button>
      </header>

      <main className="mx-auto max-w-md">
        <ShareCard record={record} model={shareModel} />

        <section className="mt-7 rounded-3xl border border-neutral-200 bg-white p-5">
          <h2 className="text-[16px] font-bold">맞춤 이미지</h2>
          <p className="mt-1 text-[12px] leading-5 text-neutral-500">선택한 난이도와 한줄평이 반영된 현재 이미지를 기기에 저장하거나 복사합니다.</p>
          <div className="mt-4 grid grid-cols-2 gap-5">
            <ActionButton label="이미지 저장" icon={<Download size={22} />} onClick={handleSave} />
            <ActionButton label="이미지 복사" icon={<Clipboard size={21} />} onClick={handleCopy} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-[16px] font-bold text-blue-950">공개 링크</h2>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-blue-950">공개 링크에는 맞춤 이미지가 게시되지 않고 기본 기록만 표시됩니다.</p>
          <p className="mt-1 text-[12px] leading-5 text-blue-800">이미지 업로드 기능이 없어 위 미리보기의 맞춤 설정과 한줄평은 URL에 포함되지 않습니다. 지원되는 기기에서는 로컬 맞춤 이미지를 링크와 함께 공유하고, 그 외 브라우저에서는 공개 링크만 복사합니다.</p>
          <button
            type="button"
            onClick={handleShare}
            disabled={isCreatingLink}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[14px] font-bold text-white disabled:opacity-50"
          >
            <Share2 size={19} />
            {isCreatingLink ? '공개 링크 생성 중' : '공개 링크 만들고 공유'}
          </button>
        </section>
        <div className="mt-4 min-h-5 text-center text-[12px] text-neutral-500" role="status">{status}</div>
        {activeAttemptShare && (
          <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
            <div className="text-[13px] font-bold text-red-900">이번 시도에서 만든 공개 링크가 활성 상태예요.</div>
            <div className="mt-1 break-all text-[11px] text-red-700">{publicShareUrl(activeAttemptShare)}</div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => handleCopyPublicLink(activeAttemptShare)} className="h-10 flex-1 rounded-xl bg-white text-[12px] font-bold text-blue-700">링크 복사</button>
              <button type="button" onClick={() => handleRevokeShare(activeAttemptShare.id)} disabled={revokingShareId === activeAttemptShare.id} className="h-10 flex-1 rounded-xl bg-red-600 text-[12px] font-bold text-white disabled:opacity-50">
                {revokingShareId === activeAttemptShare.id ? '폐기 중' : '지금 폐기'}
              </button>
            </div>
          </div>
        )}
        {shareListError && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">{shareListError}</div>}
        <ShareList shares={shares} revokingShareId={revokingShareId} onRevoke={handleRevokeShare} />
      </main>
    </div>
  );
}

interface ShareEditorProps {
  record: ClimbingRecord;
  difficulties: ShareDifficultySummary[];
  selectedDifficultyIndexes: number[];
  comment: string;
  onBack: () => void;
  onToggleDifficulty: (difficultyIndex: number) => void;
  onChangeComment: (comment: string) => void;
  onOpenPreview: () => void;
}

function ShareEditor(props: ShareEditorProps) {
  const {
    record,
    difficulties,
    selectedDifficultyIndexes,
    comment,
    onBack,
    onToggleDifficulty,
    onChangeComment,
    onOpenPreview,
  } = props;

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-10 text-neutral-950">
      <header className="sticky top-0 z-10 grid grid-cols-[44px_1fr_44px] items-center border-b border-neutral-100 bg-white px-4 py-3">
        <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center" aria-label="기록 상세로 돌아가기">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-center text-[18px] font-bold">공유 이미지 편집</h1>
        <div />
      </header>

      <main className="mx-auto max-w-md space-y-4 px-5 py-5">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="text-[12px] font-semibold text-blue-600">CLIMBING RECORD</div>
          <h2 className="mt-2 truncate text-[23px] font-black tracking-[-0.04em]">{record.gym}</h2>
          <div className="mt-1 text-[13px] text-neutral-500">{record.date} · {record.duration}</div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold">표시할 난이도</h2>
              <p className="mt-1 text-[12px] leading-5 text-neutral-500">공유 이미지에 넣을 색상 난이도를 선택하세요.</p>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-bold text-blue-700">
              {selectedDifficultyIndexes.length} / {MAX_SELECTED_DIFFICULTIES}
            </div>
          </div>

          {difficulties.length > 0 ? (
            <div className="mt-4 space-y-2">
              {difficulties.map((difficulty) => {
                const isChecked = selectedDifficultyIndexes.includes(difficulty.difficultyIndex);
                const isDisabled = !isChecked && selectedDifficultyIndexes.length >= MAX_SELECTED_DIFFICULTIES;

                return (
                  <label
                    key={difficulty.difficultyIndex}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                      isChecked ? 'border-blue-200 bg-blue-50/60' : 'border-neutral-200 bg-white'
                    } ${isDisabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => onToggleDifficulty(difficulty.difficultyIndex)}
                      className="h-5 w-5 flex-shrink-0 accent-blue-500"
                      aria-label={`${difficulty.colorName} 난이도 ${difficulty.grade} 공유 이미지에 표시`}
                    />
                    <span
                      className={`h-7 w-7 flex-shrink-0 rounded-full border border-black/10 ${difficulty.colorClassName}`}
                      style={{ backgroundColor: difficulty.colorHex }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-neutral-900">({difficulty.grade})</span>
                      <span className="mt-0.5 block text-[12px] text-neutral-500">완등 {difficulty.success} · 도전 {difficulty.attempt}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500">
              공유할 난이도 기록이 없습니다.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-bold">한줄평</h2>
            <span className="text-[11px] text-neutral-400">선택 사항 · {comment.length}/{MAX_COMMENT_LENGTH}</span>
          </div>
          <input
            type="text"
            value={comment}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => onChangeComment(event.target.value.replace(/[\r\n]/g, ''))}
            placeholder="오늘의 클라이밍을 한 줄로 남겨보세요."
            className="mt-4 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-[14px] outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-400 focus:bg-white"
          />
        </section>

        <button
          type="button"
          onClick={onOpenPreview}
          className="h-14 w-full rounded-2xl bg-blue-500 text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-blue-600 active:bg-blue-700"
        >
          공유 이미지 미리보기
        </button>
      </main>
    </div>
  );
}

function ShareCard({ record, model }: { record: ClimbingRecord; model: RecordShareModel }) {
  const difficultyCount = model.difficulties.length;
  const difficultyTextClassName = difficultyCount <= 1
    ? 'text-[15px]'
    : difficultyCount === 2
      ? 'text-[14px]'
      : difficultyCount === 3
        ? 'text-[13px]'
        : difficultyCount === 4
          ? 'text-[12px]'
          : 'text-[11px]';
  const difficultyDotClassName = difficultyCount <= 1
    ? 'h-6 w-6'
    : difficultyCount <= 3
      ? 'h-5 w-5'
      : 'h-4 w-4';
  const difficultyGridClassName = difficultyCount <= 2
    ? 'grid-cols-[24px_1fr_72px_72px]'
    : difficultyCount === 3
      ? 'grid-cols-[20px_1fr_68px_68px]'
      : 'grid-cols-[16px_1fr_64px_64px]';

  return (
    <section className="relative flex aspect-[4/5] flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-[#F5F7FA] px-4 py-3 text-neutral-950 shadow-lg shadow-neutral-900/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[12px] font-black text-white">T</span>
          <span className="text-[12px] font-black tracking-[0.08em]">TOPJUG</span>
        </div>
        <span className="text-[9px] font-bold tracking-[0.12em] text-neutral-400">CLIMB LOG</span>
      </div>

      <div className="mt-2 border-l-[3px] border-blue-600 pl-3">
        <h1 className="truncate text-[23px] font-black leading-tight tracking-[-0.045em]">{record.gym}</h1>
        <div className="mt-1 text-[10px] font-semibold text-neutral-400">{record.date} · {model.durationLabel}</div>
      </div>

      <div className="mt-2 rounded-[18px] border border-neutral-100 bg-white px-2.5 py-1.5 shadow-sm">
        <div className="grid grid-cols-3 divide-x divide-neutral-100 text-center">
          <ShareSummary label="완등" value={String(model.totals.success)} />
          <ShareSummary label="도전" value={String(model.totals.attempt)} />
          <div>
            <div className="text-[9px] font-medium text-neutral-400">최고 난이도</div>
            {model.highestCompletedDifficulty ? (
              <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[17px] font-black">
                <DifficultyDot difficulty={model.highestCompletedDifficulty} sizeClassName="h-4 w-4" />
                {model.highestCompletedDifficulty.grade}
              </div>
            ) : <div className="mt-0.5 text-[17px] font-black">-</div>}
          </div>
        </div>
      </div>

      <div className="mt-2 flex h-[180px] flex-shrink-0 flex-col rounded-[18px] border border-neutral-100 bg-white px-3 py-2 shadow-sm">
        <div className="text-[13px] font-black">난이도별 기록</div>
        {model.difficulties.length > 0 ? (
          <div
            className="mt-1 grid min-h-0 flex-1 divide-y divide-neutral-100"
            style={{ gridTemplateRows: `repeat(${difficultyCount}, minmax(0, 1fr))` }}
          >
            {model.difficulties.map((difficulty) => (
              <div key={difficulty.difficultyIndex} className={`grid ${difficultyGridClassName} items-center gap-2 ${difficultyTextClassName}`}>
                <DifficultyDot difficulty={difficulty} sizeClassName={difficultyDotClassName} />
                <span className="font-black">{difficulty.grade}</span>
                <span className="text-left text-neutral-500">완등 <b className="text-neutral-900">{difficulty.success}</b></span>
                <span className="text-left text-neutral-500">도전 <b className="text-neutral-900">{difficulty.attempt}</b></span>
              </div>
            ))}
          </div>
        ) : <div className="mt-4 text-[12px] text-neutral-400">선택한 난이도가 없습니다.</div>}
      </div>

      {model.comment && (
        <div className="mt-3 h-[64px] flex-shrink-0 rounded-[18px] border border-neutral-100 bg-white px-3 py-2 shadow-sm">
          <div className="text-[13px] font-black leading-4 text-neutral-950">한줄평</div>
          <div className="mt-1 text-[13px] font-semibold leading-4 text-neutral-700">&quot;{model.comment}&quot;</div>
        </div>
      )}
    </section>
  );
}

function ShareSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium text-neutral-400">{label}</div>
      <div className="mt-0.5 text-[17px] font-black">{value}</div>
    </div>
  );
}

function DifficultyDot({ difficulty, sizeClassName }: { difficulty: ShareDifficultySummary; sizeClassName: string }) {
  return (
    <span
      className={`${sizeClassName} inline-block flex-shrink-0 rounded-full border border-black/10 ${difficulty.colorClassName}`}
      style={{ backgroundColor: difficulty.colorHex }}
      role="img"
      aria-label={`${difficulty.colorName} 난이도`}
    />
  );
}

function ShareList({
  shares,
  revokingShareId,
  onRevoke,
}: {
  shares: ApiShareSummary[];
  revokingShareId: string | null;
  onRevoke: (shareId: string) => void;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold">공유 링크</h2>
        <span className="text-[12px] text-neutral-400">{shares.length}개</span>
      </div>

      {shares.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[13px] text-neutral-500">
          아직 만든 공유 링크가 없습니다.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {shares.map((share) => {
            const isActive = share.status === 'active';

            return (
              <div key={share.id} className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-neutral-300'}`} />
                    <span className="text-[14px] font-bold text-neutral-900">{shareStatusLabel(share.status)}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    생성 {new Date(share.createdAt).toLocaleString('ko-KR')}
                  </div>
                  {share.expiresAt && (
                    <div className="mt-0.5 text-[11px] text-neutral-400">
                      만료 {new Date(share.expiresAt).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(share.id)}
                  disabled={!isActive || revokingShareId === share.id}
                  className="h-9 flex-shrink-0 rounded-xl bg-white px-3 text-[12px] font-bold text-red-600 disabled:text-neutral-300"
                >
                  {revokingShareId === share.id ? '폐기 중' : '폐기'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function shareStatusLabel(status: ApiShareSummary['status']) {
  if (status === 'active') return '활성';
  if (status === 'expired') return '만료';
  return '폐기됨';
}

function ActionButton({ label, icon, onClick, disabled = false }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 text-[12px] font-semibold text-neutral-600 disabled:opacity-50">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-600 shadow-md active:scale-95">{icon}</span>
      {label}
    </button>
  );
}
