import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../../app/api/api-client';
import { getGym } from '../../../app/api/gym-api';
import {
  ApiRecordPause,
  cancelRecordSession,
  completeRecordSession,
  getActiveRecordSession,
  mapApiRecordDetail,
  pauseRecordSession,
  replaceRecordSessionCounts,
  resumeRecordSession,
} from '../../../app/api/record-api';
import { RecordDraft } from '../../../app/providers/RecordDraftProvider';
import { ClimbingRecord, DifficultyOption, RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';
import {
  RecordSectorOption,
  calculateActiveDurationSeconds,
  canUseRecordActions,
  difficultyOptionsFromGym,
  formatElapsedTime,
  recordCountKey,
  routeCountsFromApi,
  routeCountsToApi,
  sectorOptionsFromGym,
} from '../record-session-model';

interface UseRecordScreenOptions {
  onClose: () => void | Promise<void>;
  initialDraft: RecordDraft;
  onSubmitComplete?: (record: ClimbingRecord) => void | Promise<void>;
}

function messageForRecordError(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) return '로그인이 만료됐어요. 다시 로그인해주세요.';
  if (error instanceof ApiClientError && error.code === 'ACTIVE_RECORD_EXISTS') return '이미 진행 중인 기록이 있어요.';
  if (error instanceof ApiClientError && error.code.startsWith('MEMBERSHIP_')) return error.message;
  if (error instanceof ApiClientError && error.code === 'ACTIVE_RECORD_NOT_FOUND') return '진행 중인 기록을 찾지 못했어요.';
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return '기록 요청을 처리하지 못했어요.';
}

export function useRecordScreen({ onClose, initialDraft, onSubmitComplete }: UseRecordScreenOptions) {
  const [isRecording, setIsRecording] = useState(true);
  const [pauses, setPauses] = useState<ApiRecordPause[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => calculateActiveDurationSeconds(initialDraft.startedAt, []));
  const [difficulties, setDifficulties] = useState<DifficultyOption[]>([]);
  const [sectors, setSectors] = useState<RecordSectorOption[]>([]);
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showRatingWarning, setShowRatingWarning] = useState(false);
  const [routeCounts, setRouteCounts] = useState<RouteCounts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSavesRef = useRef(0);
  const latestCountsRef = useRef<RouteCounts>({});

  const updateElapsed = useCallback((nextPauses = pauses) => {
    setElapsedSeconds(calculateActiveDurationSeconds(initialDraft.startedAt, nextPauses));
  }, [initialDraft.startedAt, pauses]);

  const hydrate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsHydrated(false);
    hydratedRef.current = false;

    try {
      const [activeResponse, gymResponse] = await Promise.all([
        getActiveRecordSession(),
        getGym(initialDraft.selectedGymId),
      ]);
      const active = activeResponse.data;
      if (!active || active.id !== initialDraft.recordId) {
        throw new Error('진행 중인 기록을 찾지 못했어요. 기록 시작 화면에서 다시 확인해주세요.');
      }

      const nextPauses = active.pauses ?? [];
      const nextCounts = routeCountsFromApi(active.counts ?? []);
      const nextSectors = sectorOptionsFromGym(gymResponse.data);
      setPauses(nextPauses);
      setIsRecording(!active.isPaused);
      setElapsedSeconds(calculateActiveDurationSeconds(active.startedAt, nextPauses));
      setDifficulties(difficultyOptionsFromGym(gymResponse.data));
      setSectors(nextSectors);
      setExpandedSectors(nextSectors[0] ? { [nextSectors[0].id]: true } : {});
      setRouteCounts(nextCounts);
      latestCountsRef.current = nextCounts;
      setRating(active.rating);
      hydratedRef.current = true;
      setIsHydrated(true);
    } catch (hydrateError) {
      setError(messageForRecordError(hydrateError));
    } finally {
      setIsLoading(false);
    }
  }, [initialDraft.recordId, initialDraft.selectedGymId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isRecording || isLoading) return;
    const timer = window.setInterval(() => updateElapsed(), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading, isRecording, updateElapsed]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateElapsed();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateElapsed]);

  const saveCounts = useCallback((counts: RouteCounts) => {
    if (!hydratedRef.current) return;
    pendingSavesRef.current += 1;
    setIsSaving(true);
    setSaveError(null);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await replaceRecordSessionCounts(initialDraft.recordId, routeCountsToApi(counts));
      })
      .catch((saveFailure) => {
        setSaveError(messageForRecordError(saveFailure));
      })
      .finally(() => {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        if (pendingSavesRef.current === 0) setIsSaving(false);
      });
  }, [initialDraft.recordId]);

  useEffect(() => {
    latestCountsRef.current = routeCounts;
    if (!hydratedRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveCounts(routeCounts), 500);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [routeCounts, saveCounts]);

  const handleCountChange = (sectorId: RecordSectorId, gradeId: string, type: RecordCountType, delta: number) => {
    if (!canUseRecordActions(hydratedRef.current, isLoading)) return;
    const key = recordCountKey(sectorId, gradeId);
    setRouteCounts((currentCounts) => {
      const current = currentCounts[key] ?? { success: 0, attempt: 0 };
      let success = current.success;
      let attempt = current.attempt;
      if (type === 'success') {
        success = Math.max(0, success + delta);
        if (success > attempt) return currentCounts;
      } else {
        attempt = Math.max(0, attempt + delta);
        if (attempt < success) return currentCounts;
      }
      return { ...currentCounts, [key]: { success, attempt } };
    });
  };

  const handleRecordingToggle = async () => {
    if (!canUseRecordActions(hydratedRef.current, isLoading) || isTransitioning) return;
    setIsTransitioning(true);
    setError(null);
    const at = new Date().toISOString();
    try {
      if (isRecording) {
        const response = await pauseRecordSession(initialDraft.recordId, at);
        const nextPauses = [...pauses, response.data];
        setPauses(nextPauses);
        setIsRecording(false);
        updateElapsed(nextPauses);
      } else {
        const response = await resumeRecordSession(initialDraft.recordId, at);
        const nextPauses = pauses.map((pause) => pause.id === response.data.id ? response.data : pause);
        setPauses(nextPauses);
        setIsRecording(true);
        updateElapsed(nextPauses);
      }
    } catch (transitionError) {
      setError(messageForRecordError(transitionError));
      await hydrate();
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleSubmitClick = () => {
    if (!canUseRecordActions(hydratedRef.current, isLoading)) return;
    if (rating === null) {
      setShowRatingWarning(true);
      return;
    }
    setShowSubmitConfirm(true);
  };

  const handleSubmitConfirm = async () => {
    if (!canUseRecordActions(hydratedRef.current, isLoading) || isTransitioning) return;
    setShowSubmitConfirm(false);
    setIsTransitioning(true);
    setError(null);
    try {
      const response = await completeRecordSession(initialDraft.recordId, {
        endedAt: new Date().toISOString(),
        rating,
        counts: routeCountsToApi(latestCountsRef.current),
      });
      await onSubmitComplete?.(mapApiRecordDetail(response.data));
    } catch (submitError) {
      setError(messageForRecordError(submitError));
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleCancel = async () => {
    if (!canUseRecordActions(hydratedRef.current, isLoading) || isTransitioning) return;
    setIsTransitioning(true);
    setError(null);
    try {
      await cancelRecordSession(initialDraft.recordId);
      await onClose();
    } catch (cancelError) {
      setError(messageForRecordError(cancelError));
    } finally {
      setIsTransitioning(false);
    }
  };

  return {
    state: {
      isRecording,
      date: initialDraft.selectedDate,
      duration: formatElapsedTime(elapsedSeconds),
      selectedPassType: initialDraft.selectedPassType,
      selectedPass: initialDraft.selectedPass,
      selectedGym: initialDraft.selectedGym,
      mode: initialDraft.mode,
      sessionType: initialDraft.sessionType,
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
    },
    actions: {
      setExpandedSectors,
      setRating: (value: number) => {
        if (canUseRecordActions(hydratedRef.current, isLoading)) setRating(value);
      },
      setShowSubmitConfirm,
      setShowRatingWarning,
      handleCountChange,
      handleRecordingToggle,
      handleSubmitClick,
      handleSubmitConfirm,
      handleCancel,
      handleSafeExit: onClose,
      retryHydrate: hydrate,
      retrySave: () => saveCounts(latestCountsRef.current),
    },
  };
}
