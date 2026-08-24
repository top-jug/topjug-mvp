import RecordModalShell from './RecordModalShell';

interface WarningModalProps {
  type: 'pass' | 'rating';
  onClose: () => void;
  onConfirm: () => void;
}

export default function WarningModal({ type, onClose, onConfirm }: WarningModalProps) {
  return (
    <RecordModalShell onClose={onClose} title={type === 'pass' ? '회원권 선택 필요' : '난이도 평가 필요'} description={type === 'pass' ? '기록을 계속하려면 회원권을 선택해야 합니다.' : '기록을 계속하려면 암장 난이도를 평가해야 합니다.'} role="alertdialog">
      <div className="flex items-center gap-2 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(239 68 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="text-lg font-bold text-neutral-900">{type === 'pass' ? '회원권 선택 필요' : '난이도 평가 필요'}</span>
      </div>

      <div className="space-y-3 mb-6">
        <p className="text-sm text-neutral-600">{type === 'pass' ? '회원권을 선택해주세요.' : '암장 난이도를 평가해주세요.'}</p>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
          취소
        </button>
        <button onClick={onConfirm} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-medium">
          확인
        </button>
      </div>
    </RecordModalShell>
  );
}
