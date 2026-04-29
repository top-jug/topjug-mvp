import { CalendarScope } from '../../types';
import BottomSheet from '../../../../app/components/overlay/BottomSheet';

interface CalendarPeriodModalProps {
  scope: CalendarScope;
  periodLabel: string;
  onSelectScope: (scope: CalendarScope) => void;
  onSelectPeriod: (year: number, month: number, weekOffset?: number) => void;
  onClose: () => void;
}

const PERIOD_OPTIONS: { year: number; month: number; label: string }[] = [
  { year: 2026, month: 4, label: '2026년 4월' },
  { year: 2026, month: 3, label: '2026년 3월' },
  { year: 2026, month: 2, label: '2026년 2월' },
  { year: 2026, month: 5, label: '2026년 5월' },
];

const WEEK_OPTIONS: { year: number; month: number; label: string }[] = [
  { year: 2026, month: 4, label: '4월 1주 (1-5일)' },
  { year: 2026, month: 4, label: '4월 2주 (6-12일)' },
  { year: 2026, month: 4, label: '4월 3주 (13-19일)' },
  { year: 2026, month: 4, label: '4월 4주 (20-26일)' },
  { year: 2026, month: 4, label: '4월 5주 (27-30일)' },
];

export default function CalendarPeriodModal({ scope, periodLabel, onSelectScope, onSelectPeriod, onClose }: CalendarPeriodModalProps) {
  const currentPeriod = periodLabel;

  const handleSelectScope = (newScope: CalendarScope) => {
    onSelectScope(newScope);
  };

  const handleSelectPeriod = (year: number, month: number, weekLabel?: string) => {
    const weekOffset = weekLabel ? WEEK_OPTIONS.findIndex(w => w.label === weekLabel) + 1 : undefined;
    onSelectPeriod(year, month, weekOffset);
    onClose();
  };

  return (
    <BottomSheet onClose={onClose} title="보기 선택">
          <div className="mb-6">
            <div className="text-[14px] font-semibold text-neutral-700 mb-3">보기 모드</div>
            <div className="flex gap-3">
              <button
                onClick={() => handleSelectScope('week')}
                className={`flex-1 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                  scope === 'week' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                주간 보기
              </button>
              <button
                onClick={() => handleSelectScope('month')}
                className={`flex-1 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                  scope === 'month' ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                월간 보기
              </button>
            </div>
          </div>

          <div>
            <div className="text-[14px] font-semibold text-neutral-700 mb-3">
              {scope === 'week' ? '주간 선택' : '월간 선택'}
            </div>
            <div className="space-y-2">
              {scope === 'week' ? (
                WEEK_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => handleSelectPeriod(option.year, option.month, option.label)}
                    className={`w-full py-3 px-4 rounded-xl text-[15px] font-medium text-left transition-colors ${
                      currentPeriod.includes(option.label.split(' ')[0]) 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                PERIOD_OPTIONS.map((option) => (
                  <button
                    key={`${option.year}-${option.month}`}
                    onClick={() => handleSelectPeriod(option.year, option.month)}
                    className={`w-full py-3 px-4 rounded-xl text-[15px] font-medium text-left transition-colors ${
                      currentPeriod === option.label 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
    </BottomSheet>
  );
}
