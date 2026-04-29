import { useState } from 'react';
import { RECORD_DIFFICULTIES } from '../../../mocks/record';
import { RecordCountType, RecordSectorId, RouteCounts } from '../../../entities/record/types';

interface UseRecordScreenOptions {
  onClose: () => void;
}

export function useRecordScreen({ onClose }: UseRecordScreenOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [date, setDate] = useState('2026.04.09');
  const [startTime, setStartTime] = useState('14:00');
  const [duration, setDuration] = useState('2시간 23분');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(3);
  const [selectedDay, setSelectedDay] = useState(9);
  const [selectedPassType, setSelectedPassType] = useState<string | null>(null);
  const [showPassModal, setShowPassModal] = useState(false);
  const [selectedPass, setSelectedPass] = useState<string | null>(null);
  const [tempPassType, setTempPassType] = useState('일일이용권');
  const [showGymModal, setShowGymModal] = useState(false);
  const [selectedGym, setSelectedGym] = useState('더클라임 양재');
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [expandedSectors, setExpandedSectors] = useState<{ [key: string]: boolean }>({ sector1: true, sector2: false });
  const [rating, setRating] = useState<number | null>(null);
  const [isEasyMode, setIsEasyMode] = useState(false);
  const [showEasyModeConfirm, setShowEasyModeConfirm] = useState(false);
  const [showNormalModeConfirm, setShowNormalModeConfirm] = useState(false);
  const [showWallInfo, setShowWallInfo] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState<{ type: 'pass' | 'rating' | null }>({ type: null });
  const [routeCounts, setRouteCounts] = useState<RouteCounts>({});

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
      startTime,
      duration,
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
      showWallInfo,
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
      setShowWallInfo,
      setShowSubmitConfirm,
      setShowWarningModal,
      setRouteCounts,
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
