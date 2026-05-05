import { useEffect, useRef, useState } from 'react';
import { RECORD_DIFFICULTIES } from '../../../mocks/record';
import { RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';
import { RecordDraft } from '../../../app/providers/RecordDraftProvider';

interface UseRecordScreenOptions {
  onClose: () => void;
  initialDraft?: RecordDraft | null;
  onSubmitComplete?: () => void;
}

const DEFAULT_DATE = '2026.04.09';
const DEFAULT_GYM = '더클라임 양재';

function parseRecordDate(value: string) {
  const [yearPart, monthPart, dayPart] = value.split('.').map(Number);

  if (!yearPart || !monthPart || !dayPart) {
    return { year: 2026, month: 3, day: 9 };
  }

  return {
    year: yearPart,
    month: monthPart - 1,
    day: dayPart,
  };
}

function formatElapsedTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseSessionStart(dateValue: string, timeValue: string) {
  const [yearPart, monthPart, dayPart] = dateValue.split('.').map(Number);
  const [hourPart, minutePart] = timeValue.split(':').map(Number);

  if (!yearPart || !monthPart || !dayPart || Number.isNaN(hourPart) || Number.isNaN(minutePart)) {
    return Date.now();
  }

  return new Date(yearPart, monthPart - 1, dayPart, hourPart, minutePart, 0, 0).getTime();
}

export function useRecordScreen({ onClose, initialDraft, onSubmitComplete }: UseRecordScreenOptions) {
  const [isRecording, setIsRecording] = useState(true);
  const initialDate = initialDraft?.selectedDate ?? DEFAULT_DATE;
  const initialStartTime = initialDraft?.selectedStartTime ?? '00:00';
  const parsedDate = parseRecordDate(initialDate);
  const [date, setDate] = useState(initialDate);
  const [startTime] = useState(initialStartTime);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pausedAccumulatedMs, setPausedAccumulatedMs] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(parsedDate.year);
  const [selectedMonth, setSelectedMonth] = useState(parsedDate.month);
  const [selectedDay, setSelectedDay] = useState(parsedDate.day);
  const [selectedPassType, setSelectedPassType] = useState<string | null>(initialDraft?.selectedPassType ?? null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedPass, setSelectedPass] = useState<string | null>(initialDraft?.selectedPass ?? null);
  const [tempPassType, setTempPassType] = useState('일일이용권');
  const [showGymModal, setShowGymModal] = useState(false);
  const [selectedGym, setSelectedGym] = useState(initialDraft?.selectedGym ?? DEFAULT_GYM);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<{ [key: string]: boolean }>({ sector1: false, sector2: false });
  const [rating, setRating] = useState<number | null>(null);
  const [isEasyMode, setIsEasyMode] = useState(false);
  const [showEasyModeConfirm, setShowEasyModeConfirm] = useState(false);
  const [showNormalModeConfirm, setShowNormalModeConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState<{ type: 'pass' | 'rating' | null }>({ type: null });
  const [routeCounts, setRouteCounts] = useState<RouteCounts>({});
  const pauseStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const sessionStartMs = parseSessionStart(date, startTime);
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - sessionStartMs - pausedAccumulatedMs) / 1000));

  const handleCountChange = (sectorId: RecordSectorId, routeIndex: number, type: RecordCountType, delta: number) => {
    const key = `${sectorId}-${routeIndex}`;
    const current = routeCounts[key] || { success: 0, attempt: 0 };

    let newSuccess = current.success;
    let newAttempt = current.attempt;

    if (type === 'success') {
      newSuccess = Math.max(0, current.success + delta);
      if (newSuccess > current.attempt) return;
    } else {
      newAttempt = Math.max(0, current.attempt + delta);
      if (newAttempt < current.success) return;
    }

    setRouteCounts({
      ...routeCounts,
      [key]: { success: newSuccess, attempt: newAttempt },
    });
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDateSelect = (day: number) => {
    setSelectedDay(day);
    setDate(`${selectedYear}.${String(selectedMonth + 1).padStart(2, '0')}.${String(day).padStart(2, '0')}`);
    setShowDatePicker(false);
  };

  const handleRecordingToggle = () => {
    if (isRecording) {
      pauseStartedAtRef.current = Date.now();
      setIsRecording(false);
      return;
    }

    if (pauseStartedAtRef.current !== null) {
      setPausedAccumulatedMs((current) => current + (Date.now() - pauseStartedAtRef.current!));
      pauseStartedAtRef.current = null;
    }

    setNowMs(Date.now());
    setIsRecording(true);
  };

  const handlePassWarningConfirm = () => {
    setShowWarningModal({ type: null });
    document.querySelector('.pass-selection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleRatingWarningConfirm = () => {
    setShowWarningModal({ type: null });
    document.querySelector('.rating-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSubmitClick = () => {
    if (!selectedPassType || ((selectedPassType === '횟수권' || selectedPassType === '기간권') && !selectedPass)) {
      setShowWarningModal({ type: 'pass' });
      return;
    }

    if (rating === null) {
      setShowWarningModal({ type: 'rating' });
      return;
    }

    setShowSubmitConfirm(true);
  };

  const handleSubmitConfirm = () => {
    alert('운동 기록이 제출되었습니다!');
    setShowSubmitConfirm(false);
    onSubmitComplete?.();
    onClose();
  };

  const handleEasyModeConfirm = () => {
    const mergedCounts: RouteCounts = {};

    for (let i = 0; i < RECORD_DIFFICULTIES.length; i++) {
      let totalSuccess = 0;
      let totalAttempt = 0;

      Object.keys(routeCounts).forEach((key) => {
        if (key.endsWith(`-${i}`)) {
          totalSuccess += routeCounts[key].success;
          totalAttempt += routeCounts[key].attempt;
        }
      });

      if (totalSuccess > 0 || totalAttempt > 0) {
        mergedCounts[`easy-${i}`] = { success: totalSuccess, attempt: totalAttempt };
      }
    }

    setRouteCounts(mergedCounts);
    setIsEasyMode(true);
    setShowEasyModeConfirm(false);
  };

  const handleNormalModeConfirm = () => {
    setIsEasyMode(false);
    setRouteCounts({});
    setShowNormalModeConfirm(false);
  };

  return {
    state: {
      isRecording,
      date,
      duration: formatElapsedTime(elapsedSeconds),
      showDatePicker,
      selectedYear,
      selectedMonth,
      selectedDay,
      selectedPassType,
      showPassModal,
      selectedPass,
      tempPassType,
      showGymModal,
      selectedGym,
      showDifficultyModal,
      expandedSectors,
      rating,
      isEasyMode,
      showEasyModeConfirm,
      showNormalModeConfirm,
      showSubmitConfirm,
      showWarningModal,
      routeCounts,
    },
    actions: {
      setIsRecording,
      setShowDatePicker,
      setSelectedYear,
      setSelectedMonth,
      setSelectedDay,
      setSelectedPassType,
      setShowPassModal,
      setSelectedPass,
      setTempPassType,
      setShowGymModal,
      setSelectedGym,
      setShowDifficultyModal,
      setExpandedSectors,
      setRating,
      setIsEasyMode,
      setShowEasyModeConfirm,
      setShowNormalModeConfirm,
      setShowSubmitConfirm,
      setShowWarningModal,
      setRouteCounts,
      handleRecordingToggle,
      handleCountChange,
      getDaysInMonth,
      getFirstDayOfMonth,
      handleDateSelect,
      handlePassWarningConfirm,
      handleRatingWarningConfirm,
      handleSubmitClick,
      handleSubmitConfirm,
      handleEasyModeConfirm,
      handleNormalModeConfirm,
    },
  };
}
