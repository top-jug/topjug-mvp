import { useEffect, useState } from 'react';
import DifficultyComparisonModal from '../../app/components/DifficultyComparisonModal';
import { RECORD_DIFFICULTIES } from '../../mocks/record';
import RecordRatingCard from './components/RecordRatingCard';
import RecordRouteList from './components/RecordRouteList';
import RecordSectorPanel from './components/RecordSectorPanel';
import ConfirmActionModal from './components/modals/ConfirmActionModal';
import DatePickerModal from './components/modals/DatePickerModal';
import GymSelectModal from './components/modals/GymSelectModal';
import SubmitConfirmModal from './components/modals/SubmitConfirmModal';
import WarningModal from './components/modals/WarningModal';
import { useRecordScreen } from './hooks/useRecordScreen';
import { RecordDraft } from '../../app/providers/RecordDraftProvider';
import { MONTH_NAMES, RECORD_GYMS } from '../../mocks/record';

export default function RecordScreen({
  onClose,
  initialDraft,
  onSubmitComplete,
}: {
  onClose: () => void;
  initialDraft?: RecordDraft | null;
  onSubmitComplete?: () => void;
}) {
  const { state, actions } = useRecordScreen({ onClose, initialDraft, onSubmitComplete });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const {
    isRecording,
    date,
    duration,
    selectedPassType,
    selectedPass,
    selectedGym,
    showDatePicker,
    selectedYear,
    selectedMonth,
    selectedDay,
    showGymModal,
    showDifficultyModal,
    expandedSectors,
    rating,
    isEasyMode,
    showEasyModeConfirm,
    showNormalModeConfirm,
    showSubmitConfirm,
    showWarningModal,
    routeCounts,
  } = state;
  const {
    setSelectedMonth,
    setShowDatePicker,
    setShowGymModal,
    setSelectedGym,
    setShowDifficultyModal,
    setExpandedSectors,
    setRating,
    setShowEasyModeConfirm,
    setShowNormalModeConfirm,
    setShowSubmitConfirm,
    setShowWarningModal,
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
  } = actions;

  useEffect(() => {
    window.history.pushState({ recordGuard: true }, '', window.location.href);

    const handlePopState = () => {
      setShowExitConfirm(true);
      window.history.pushState({ recordGuard: true }, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-neutral-100">
        <button onClick={() => setShowExitConfirm(true)} className="h-11 w-6 flex items-center justify-start rounded-full">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[22px] font-bold">기록</h1>
        <button className="h-11 w-6 invisible" aria-hidden="true">
          {/* <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="19" cy="12" r="1"/>
            <circle cx="5" cy="12" r="1"/>
          </svg> */}
        </button>
      </div>

      {/* Fixed Top Section */}
      <div className="sticky top-0 bg-white z-10 border-b border-neutral-100">
        {/* Gym Selection */}
        <div className="px-5 py-2">
          <button
            onClick={() => setShowGymModal(true)}
            className="w-full min-h-12 flex items-center justify-center gap-2 py-3 px-4 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(59 130 246)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-[16px] font-medium text-neutral-700">{selectedGym}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Date and Duration */}
        <div className="flex items-center justify-center gap-12 py-2 px-8">
          <button onClick={() => setShowDatePicker(true)} className="min-h-11 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(59 130 246)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-neutral-700 text-[16px] font-medium">{date}</span>
          </button>
          <div className="min-h-11 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isRecording ? 'rgb(239 68 68)' : 'rgb(212 212 212)'} stroke="none" className={isRecording ? 'animate-pulse' : ''}>
              <circle cx="12" cy="12" r="8" />
            </svg>
            <span className="text-neutral-700 text-[16px] font-medium">{duration}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-5 flex-1 min-h-0 overflow-y-auto pb-8">
        {showGymModal && (
          <GymSelectModal
            gyms={RECORD_GYMS}
            selectedGym={selectedGym}
            onSelect={(gym) => {
              setSelectedGym(gym);
              setShowGymModal(false);
            }}
            onClose={() => setShowGymModal(false)}
          />
        )}

        {showDatePicker && (
          <DatePickerModal
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedDay={selectedDay}
            monthNames={MONTH_NAMES}
            getFirstDayOfMonth={getFirstDayOfMonth}
            getDaysInMonth={getDaysInMonth}
            onPrevMonth={() => setSelectedMonth(selectedMonth === 0 ? 11 : selectedMonth - 1)}
            onNextMonth={() => setSelectedMonth(selectedMonth === 11 ? 0 : selectedMonth + 1)}
            onSelectDay={handleDateSelect}
            onClose={() => setShowDatePicker(false)}
          />
        )}

        <div className="border border-neutral-200 rounded-2xl my-4">
          <div className="px-4 py-3">
            <h3 className="text-[15px] font-bold mb-3">난이도 체계</h3>
            <div className="flex items-center justify-center gap-3 mb-3">
              {['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-lime-500', 'bg-green-500', 'bg-blue-500', 'bg-indigo-600', 'bg-purple-600'].map((color, i) => (
                <div key={i} className={`w-7 h-7 ${color} rounded-full`}></div>
              ))}
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setShowDifficultyModal(true)}
                className="w-full min-h-11 py-2 bg-neutral-100 text-neutral-700 text-[14px] font-medium rounded-xl hover:bg-neutral-200 transition-colors"
              >
                난이도 비교
              </button>
            </div>
          </div>
        </div>

        <DifficultyComparisonModal
          isOpen={showDifficultyModal}
          onClose={() => setShowDifficultyModal(false)}
        />

        {showEasyModeConfirm && (
          <ConfirmActionModal
            title="이지모드로 전환"
            description={'섹터별 기록은 날아갑니다.\n그래도 변경할까요?'}
            confirmLabel="허용"
            onClose={() => setShowEasyModeConfirm(false)}
            onConfirm={handleEasyModeConfirm}
          />
        )}

        {showNormalModeConfirm && (
          <ConfirmActionModal
            title="일반 모드로 전환"
            description={'지금까지의 기록이 모두 날아갑니다.\n그래도 변경할까요?'}
            confirmLabel="변경"
            onClose={() => setShowNormalModeConfirm(false)}
            onConfirm={handleNormalModeConfirm}
          />
        )}

        {showSubmitConfirm && (
          <SubmitConfirmModal
            selectedGym={selectedGym}
            date={date}
            duration={duration}
            selectedPassType={selectedPassType}
            selectedPass={selectedPass}
            rating={rating}
            onClose={() => setShowSubmitConfirm(false)}
            onSubmit={handleSubmitConfirm}
          />
        )}

        {showWarningModal.type && (
          <WarningModal
            type={showWarningModal.type}
            onClose={() => setShowWarningModal({ type: null })}
            onConfirm={showWarningModal.type === 'pass' ? handlePassWarningConfirm : handleRatingWarningConfirm}
          />
        )}

        {showExitConfirm && (
          <ConfirmActionModal
            title="기록을 취소하시겠어요?"
            description={'취소를 누르면 지금까지의 기록이 사라집니다.\n계속 진행할까요?'}
            confirmLabel="기록 취소하기"
            onClose={() => setShowExitConfirm(false)}
            onConfirm={onClose}
          />
        )}

        {/* Sector 1 */}
        <div className="py-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z"/>
              </svg>
              <h3 className="text-[15px] font-bold">섹터별 기록</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-neutral-600">이지모드</span>
              <button
                onClick={() => {
                  if (!isEasyMode) {
                    setShowEasyModeConfirm(true);
                  } else {
                    setShowNormalModeConfirm(true);
                  }
                }}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  isEasyMode ? 'bg-green-500' : 'bg-neutral-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                    isEasyMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                ></div>
              </button>
            </div>
          </div>

          {isEasyMode ? (
            <div className="bg-neutral-50 rounded-2xl p-4">
              <RecordRouteList
                difficulties={RECORD_DIFFICULTIES}
                sectorId="easy"
                routeCounts={routeCounts}
                onCountChange={handleCountChange}
              />
            </div>
          ) : (
            <>
              <RecordSectorPanel
                title="1 Sector (Main Wall)"
                sectorId="sector1"
                expanded={expandedSectors.sector1}
                onToggle={() => setExpandedSectors({ ...expandedSectors, sector1: !expandedSectors.sector1 })}
                difficulties={RECORD_DIFFICULTIES}
                routeCounts={routeCounts}
                onCountChange={handleCountChange}
              />

              <RecordSectorPanel
                title="2 Sector (Cave)"
                sectorId="sector2"
                expanded={expandedSectors.sector2}
                onToggle={() => setExpandedSectors({ ...expandedSectors, sector2: !expandedSectors.sector2 })}
                difficulties={RECORD_DIFFICULTIES}
                routeCounts={routeCounts}
                onCountChange={handleCountChange}
              />
            </>
          )}
        </div>

        <RecordRatingCard rating={rating} onChange={setRating} />

        {/* Submit Button */}
        <div className="py-6 pb-8">
          <button
            onClick={handleSubmitClick}
            className="w-full py-4 bg-blue-500 text-white rounded-xl text-[16px] font-bold shadow-lg hover:bg-blue-600 transition-colors"
          >
            제출하기
          </button>
        </div>
      </div>
    </div>
  );
}
