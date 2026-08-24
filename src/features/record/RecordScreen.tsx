import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { RecordDraft } from '../../app/providers/RecordDraftProvider';
import ConfirmActionModal from './components/modals/ConfirmActionModal';
import SubmitConfirmModal from './components/modals/SubmitConfirmModal';
import WarningModal from './components/modals/WarningModal';
import RecordRatingCard from './components/RecordRatingCard';
import RecordRouteList from './components/RecordRouteList';
import RecordSectorPanel from './components/RecordSectorPanel';
import { useRecordScreen } from './hooks/useRecordScreen';
import { createRecordHistoryGuard } from './record-history-guard';

const SESSION_LABELS = { free: '자유', training: '훈련', project: '프로젝트' } as const;

export default function RecordScreen({
  onClose,
  initialDraft,
  onSubmitComplete,
}: {
  onClose: () => void;
  initialDraft: RecordDraft;
  onSubmitComplete?: Parameters<typeof useRecordScreen>[0]['onSubmitComplete'];
}) {
  const releaseGuardRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const handleClose = useCallback(async () => {
    await releaseGuardRef.current();
    onClose();
  }, [onClose]);
  const handleSubmitComplete = useCallback(async (record: Parameters<NonNullable<typeof onSubmitComplete>>[0]) => {
    await releaseGuardRef.current();
    await onSubmitComplete?.(record);
  }, [onSubmitComplete]);
  const { state, actions } = useRecordScreen({ onClose: handleClose, initialDraft, onSubmitComplete: handleSubmitComplete });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const {
    isRecording,
    date,
    duration,
    selectedPassType,
    selectedPass,
    selectedGym,
    mode,
    sessionType,
    expandedSectors,
    rating,
    showSubmitConfirm,
    showRatingWarning,
    routeCounts,
    difficulties,
    sectors,
    isLoading,
    isHydrated,
    isSaving,
    isTransitioning,
    error,
    saveError,
  } = state;
  const {
    setExpandedSectors,
    setRating,
    setShowSubmitConfirm,
    setShowRatingWarning,
    handleCountChange,
    handleRecordingToggle,
    handleSubmitClick,
    handleSubmitConfirm,
    handleCancel,
    handleSafeExit,
    retryHydrate,
    retrySave,
  } = actions;

  useEffect(() => {
    const guard = createRecordHistoryGuard(window.history, window, () => setShowExitConfirm(true));
    releaseGuardRef.current = guard.release;
    return guard.dispose;
  }, []);

  const visibleSectors = mode === 'easy' ? sectors.slice(0, 1) : sectors;

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-neutral-100">
        <button onClick={() => setShowExitConfirm(true)} disabled={!isHydrated} className="h-11 w-6 flex items-center justify-start disabled:opacity-50" aria-label="기록 나가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className="text-[22px] font-bold">기록</h1>
        <button className="h-11 w-6 invisible" aria-hidden="true" />
      </div>

      <div className="sticky top-0 bg-white z-10 border-b border-neutral-100">
        <div className="px-5 py-2">
          <div className="w-full min-h-12 flex items-center justify-center gap-2 py-3 px-4 bg-neutral-50 rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(59 130 246)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            <span className="text-[16px] font-medium text-neutral-700">{selectedGym}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-2 px-5">
          <div className="min-h-11 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(59 130 246)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <span className="text-neutral-700 text-[16px] font-medium">{date}</span>
          </div>
          <div className="min-h-11 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isRecording ? 'rgb(239 68 68)' : 'rgb(212 212 212)'} className={isRecording ? 'animate-pulse' : ''}><circle cx="12" cy="12" r="8" /></svg>
            <span className="text-neutral-700 text-[16px] font-medium">{duration}</span>
          </div>
          <button type="button" onClick={() => void handleRecordingToggle()} disabled={isTransitioning || !isHydrated} aria-label={isRecording ? '일시정지' : '재개'} className="min-h-11 flex items-center gap-1.5 rounded-full px-2.5 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            {isRecording ? <Pause size={18} className="text-blue-500" /> : <Play size={18} className="text-blue-500" />}
            <span className="text-[15px] font-medium">{isRecording ? '일시정지' : '재개'}</span>
          </button>
        </div>
      </div>

      <div className="px-5 flex-1 min-h-0 overflow-y-auto pb-8">
        {error && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700"><span>{error}</span><div className="flex shrink-0 gap-3"><button onClick={() => void retryHydrate()} className="font-semibold">다시 시도</button>{!isHydrated && <button onClick={() => void handleSafeExit()} className="font-semibold">안전하게 나가기</button>}</div></div>}
        {saveError && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800"><span>카운트를 저장하지 못했어요. {saveError}</span><button onClick={retrySave} className="shrink-0 font-semibold">재시도</button></div>}

        <div className="border border-neutral-200 rounded-2xl my-4 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-bold">난이도 체계</h3>
            <span className="text-[12px] text-neutral-500">{mode === 'easy' ? '이지 모드' : '일반 모드'} · {SESSION_LABELS[sessionType]}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            {difficulties.map((difficulty) => <div key={difficulty.id} title={`${difficulty.name} ${difficulty.grade}`} className="h-7 w-7 rounded-full border border-black/10" style={{ backgroundColor: difficulty.color }} />)}
            {!isLoading && difficulties.length === 0 && <span className="text-[13px] text-neutral-500">등록된 난이도가 없어요.</span>}
          </div>
        </div>

        {showSubmitConfirm && <SubmitConfirmModal selectedGym={selectedGym} date={date} duration={duration} selectedPassType={selectedPassType} selectedPass={selectedPass} rating={rating} onClose={() => setShowSubmitConfirm(false)} onSubmit={() => void handleSubmitConfirm()} />}
        {showRatingWarning && <WarningModal type="rating" onClose={() => setShowRatingWarning(false)} onConfirm={() => { setShowRatingWarning(false); document.querySelector('.rating-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />}
        {showExitConfirm && <ConfirmActionModal title="기록을 취소하시겠어요?" description={'취소하면 서버에 저장된 진행 기록도 종료됩니다.\n계속 진행할까요?'} confirmLabel={isTransitioning ? '취소하는 중…' : '기록 취소하기'} confirmDisabled={!isHydrated || isTransitioning} onClose={() => setShowExitConfirm(false)} onConfirm={() => void handleCancel()} />}

        <div className="py-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" /></svg><h3 className="text-[15px] font-bold">난이도·섹터별 기록</h3></div>
            <span className="text-[12px] text-neutral-500">{isSaving ? '저장 중…' : '자동 저장'}</span>
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[14px] text-neutral-500">기록 정보를 불러오고 있어요…</div>
          ) : difficulties.length === 0 || visibleSectors.length === 0 ? (
            <div className="rounded-2xl bg-neutral-50 px-4 py-8 text-center text-[14px] text-neutral-500">이 암장에는 기록 가능한 난이도 또는 섹터가 아직 등록되지 않았어요.</div>
          ) : mode === 'easy' ? (
            <div className="bg-neutral-50 rounded-2xl p-4">
              <p className="mb-3 text-[12px] text-neutral-500">이지 모드는 전체 카운트를 {visibleSectors[0].name} 섹터 기준으로 저장해요.</p>
              <RecordRouteList difficulties={difficulties} sectorId={visibleSectors[0].id} routeCounts={routeCounts} onCountChange={handleCountChange} disabled={!isHydrated} />
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSectors.map((sector) => <RecordSectorPanel key={sector.id} title={`${sector.name} (${sector.wallName})`} sectorId={sector.id} expanded={Boolean(expandedSectors[sector.id])} onToggle={() => setExpandedSectors({ ...expandedSectors, [sector.id]: !expandedSectors[sector.id] })} difficulties={difficulties} routeCounts={routeCounts} onCountChange={handleCountChange} disabled={!isHydrated} />)}
            </div>
          )}
        </div>

        <RecordRatingCard rating={rating} onChange={setRating} disabled={!isHydrated} />
        <div className="py-6 pb-8"><button onClick={handleSubmitClick} disabled={isTransitioning || !isHydrated} className="w-full py-4 bg-blue-500 text-white rounded-xl text-[16px] font-bold shadow-lg hover:bg-blue-600 disabled:bg-neutral-300 disabled:shadow-none">{isTransitioning ? '처리 중…' : '제출하기'}</button></div>
      </div>
    </div>
  );
}
