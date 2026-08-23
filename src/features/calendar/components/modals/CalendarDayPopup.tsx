import RecordModalShell from '../../../record/components/modals/RecordModalShell';
import { CalendarData, CalendarGym } from '../../../../entities/calendar/types';

interface CalendarDayPopupProps {
  mode: 'record' | 'setting';
  year: number;
  month: number;
  day: number;
  gyms: CalendarGym[];
  calendarData: CalendarData;
  onClose: () => void;
  onOpenRecord: (recordId: string) => void;
  onGoToRecord: () => void;
}

export default function CalendarDayPopup({ mode, year, month, day, gyms, calendarData, onClose, onOpenRecord, onGoToRecord }: CalendarDayPopupProps) {
  const entries = calendarData[day];
  const emptyLabel = mode === 'record' ? '이 날짜에 등록된 기록이 없습니다.' : '이 날짜에 등록된 세팅 정보가 없습니다.';

  return (
    <RecordModalShell onClose={onClose} panelClassName="bg-white rounded-2xl w-full max-w-[350px] max-h-[460px] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-neutral-200">
        <span className="text-[15px] font-medium">{year}년 {month}월 {day}일</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center bg-neutral-100 rounded-full border border-neutral-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {entries ? (
          entries.map((entry, idx) => {
            const gymInfo = gyms.find((gym) => gym.name === entry.gym);
            if (!gymInfo) return null;
            return (
              <button
                type="button"
                key={`${entry.gym}-${idx}`}
                onClick={() => entry.recordId && onOpenRecord(entry.recordId)}
                disabled={mode !== 'record' || !entry.recordId}
                className="w-full border border-neutral-200 rounded-xl p-3 mb-2 text-left disabled:cursor-default"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: gymInfo.lightBg, color: gymInfo.darkText }}>
                    {entry.gym.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{entry.gym}</div>
                    <div className="text-[11px] text-neutral-500">{mode === 'record' ? `기록: ${entry.wall}` : entry.wall}</div>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="text-center text-[13px] text-neutral-500 py-8">{emptyLabel}</div>
        )}
      </div>
      {mode === 'setting' && (
        <div className="p-3">
          <button onClick={onGoToRecord} className="w-full h-[42px] bg-[#185FA5] text-white rounded-xl font-medium flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            기록 페이지로 이동
          </button>
        </div>
      )}
    </RecordModalShell>
  );
}
