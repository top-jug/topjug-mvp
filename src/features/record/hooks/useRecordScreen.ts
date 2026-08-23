import { useEffect, useState } from 'react';
import { RECORD_DIFFICULTIES } from '../../../mocks/record';
import { ClimbingRecord, RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';
import { RecordDraft } from '../../../app/providers/RecordDraftProvider';

interface UseRecordScreenOptions {
  onClose: () => void;
  initialDraft?: RecordDraft | null;
  onSubmitComplete?: (record: ClimbingRecord) => void;
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
  const displayTimeMatch = timeValue.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})$/);
  const [hourPart, minutePart] = displayTimeMatch
    ? [
        displayTimeMatch[1] === '오후'
          ? Number(displayTimeMatch[2]) === 12
            ? 12
            : Number(displayTimeMatch[2]) + 12
          : Number(displayTimeMatch[2]) === 12
            ? 0
            : Number(displayTimeMatch[2]),
        Number(displayTimeMatch[3]),
      ]
    : timeValue.split(':').map(Number);

  if (!yearPart || !monthPart || !dayPart || Number.isNaN(hourPart) || Number.isNaN(minutePart)) {
    return Date.now();
  }

  return new Date(yearPart, monthPart - 1, dayPart, hourPart, minutePart, 0, 0).getTime();
}

function getInitialElapsedSeconds(dateValue: string, timeValue: string) {
  return Math.max(0, Math.floor((Date.now() - parseSessionStart(dateValue, timeValue)) / 1000));
}

export function useRecordScreen({ onClose, initialDraft, onSubmitComplete }: UseRecordScreenOptions) {
  const [isRecording, setIsRecording] = useState(true);
  const initialDate = initialDraft?.selectedDate ?? DEFAULT_DATE;
  const initialStartTime = initialDraft?.selectedStartTime ?? '00:00';
  const parsedDate = parseRecordDate(initialDate);
  const [date, setDate] = useState(initialDate);
  const [startTime] = useState(initialStartTime);
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getInitialElapsedSeconds(initialDate, initialStartTime));
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
  const [expandedSectors, setExpandedSectors] = useState<{ [key: string]: boolean }>({ sector1: false, sector2: false });
  const [rating, setRating] = useState<number | null>(null);
  const [isEasyMode, setIsEasyMode] = useState(false);
  const [showEasyModeConfirm, setShowEasyModeConfirm] = useState(false);
  const [showNormalModeConfirm, setShowNormalModeConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState<{ type: 'pass' | 'rating' | null }>({ type: null });
  const [routeCounts, setRouteCounts] = useState<RouteCounts>({});
  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setElapsedSeconds(getInitialElapsedSeconds(date, startTime));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
    const nextDate = `${selectedYear}.${String(selectedMonth + 1).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
    setSelectedDay(day);
    setDate(nextDate);
    setElapsedSeconds(getInitialElapsedSeconds(nextDate, startTime));
    setIsRecording(true);
    setShowDatePicker(false);
  };

  const handleRecordingToggle = () => {
    setIsRecording((current) => !current);
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
    setShowSubmitConfirm(false);
    onSubmitComplete?.({
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `record-${Date.now()}`,
      gym: selectedGym,
      date,
      duration: formatElapsedTime(elapsedSeconds),
      passLabel: selectedPass ?? selectedPassType ?? '미선택',
      rating: rating ?? 0,
      mode: isEasyMode ? 'easy' : 'normal',
      routeCounts,
      createdAt: new Date().toISOString(),
    });
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
