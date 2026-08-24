import RecordModalShell from './RecordModalShell';

interface DatePickerModalProps {
  selectedYear: number;
  selectedMonth: number;
  selectedDay: number;
  monthNames: string[];
  getFirstDayOfMonth: (year: number, month: number) => number;
  getDaysInMonth: (year: number, month: number) => number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: number) => void;
  onClose: () => void;
}

export default function DatePickerModal(props: DatePickerModalProps) {
  const {
    selectedYear,
    selectedMonth,
    selectedDay,
    monthNames,
    getFirstDayOfMonth,
    getDaysInMonth,
    onPrevMonth,
    onNextMonth,
    onSelectDay,
    onClose,
  } = props;

  return (
    <RecordModalShell onClose={onClose} title="운동 날짜 선택">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onPrevMonth} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center" aria-label="이전 달">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-lg font-bold">{selectedYear}년 {monthNames[selectedMonth]}</div>
        </div>
        <button onClick={onNextMonth} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center" aria-label="다음 달">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className="text-center text-xs text-neutral-500 font-medium h-8 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {[...Array(getFirstDayOfMonth(selectedYear, selectedMonth))].map((_, index) => (
          <div key={`empty-${index}`}></div>
        ))}
        {[...Array(getDaysInMonth(selectedYear, selectedMonth))].map((_, index) => {
          const day = index + 1;
          const isSelected = day === selectedDay;

          return (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              aria-pressed={isSelected}
              aria-label={`${selectedYear}년 ${selectedMonth + 1}월 ${day}일`}
              className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                isSelected ? 'bg-blue-500 text-white font-bold' : 'hover:bg-neutral-100 text-neutral-700'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 mt-6">
        <button onClick={onClose} className="flex-1 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
          취소
        </button>
        <button onClick={onClose} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium">
          확인
        </button>
      </div>
    </RecordModalShell>
  );
}
