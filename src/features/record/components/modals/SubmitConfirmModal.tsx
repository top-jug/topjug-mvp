import { ReactNode } from 'react';

import RecordModalShell from './RecordModalShell';

interface SubmitConfirmModalProps {
  selectedGym: string;
  date: string;
  duration: string;
  selectedPassType: string | null;
  selectedPass: string | null;
  rating: number | null;
  onClose: () => void;
  onSubmit: () => void;
}

export default function SubmitConfirmModal(props: SubmitConfirmModalProps) {
  const { selectedGym, date, duration, selectedPassType, selectedPass, rating, onClose, onSubmit } = props;

  return (
    <RecordModalShell onClose={onClose} title="운동 종료 확인" description="운동 정보 요약을 확인하고 운동을 종료하거나 계속합니다." role="alertdialog">
      <h3 className="text-lg font-bold mb-4 text-center">운동을 그만두시겠어요?</h3>

      <div className="bg-neutral-50 rounded-2xl p-4 mb-6">
        <h4 className="text-sm font-semibold mb-3 text-neutral-700">운동 정보 요약</h4>
        <div className="space-y-2 text-sm text-neutral-600">
          <SummaryRow label="암장" value={<span className="font-medium text-neutral-900">{selectedGym}</span>} />
          <SummaryRow label="날짜" value={<span className="font-medium text-neutral-900">{date}</span>} />
          <SummaryRow label="운동 시간" value={<span className="font-medium text-neutral-900">{duration}</span>} />
          <SummaryRow
            label="회원권"
            value={
              <div className="font-medium text-neutral-900 text-right flex-1 ml-2">
                {selectedPassType === '일일이용권' ? (
                  <span>일일이용권</span>
                ) : selectedPass ? (
                  <div className="text-[12px] leading-relaxed">
                    {selectedPass.split(' : ')[0]}
                    <br />
                    {selectedPass.split(' : ')[1]}
                  </div>
                ) : (
                  <span>미선택</span>
                )}
              </div>
            }
          />
          <SummaryRow label="난이도 평가" value={<span className="font-medium text-neutral-900">{rating}/5</span>} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-medium hover:bg-neutral-200 transition-colors">
          계속하기
        </button>
        <button onClick={onSubmit} className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors">
          그만하기
        </button>
      </div>
    </RecordModalShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <span className="min-w-[60px]">{label}:</span>
      {value}
    </div>
  );
}
