import CenteredModalShell from './CenteredModalShell';

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: 'primary' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal(props: ConfirmModalProps) {
  const { title, description, confirmLabel, confirmTone = 'primary', onConfirm, onClose } = props;

  return (
    <CenteredModalShell onClose={onClose} panelClassName="bg-white rounded-3xl p-6 w-[340px]">
      <div className="flex items-center gap-2 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={confirmTone === 'danger' ? 'rgb(239 68 68)' : 'rgb(59 130 246)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h3 className={`text-lg font-bold ${confirmTone === 'danger' ? 'text-red-500' : 'text-blue-500'}`}>확인</h3>
        <span className="text-lg font-bold text-neutral-900">{title}</span>
      </div>

      <div className="space-y-3 mb-6">
        <p className="text-sm text-neutral-600 whitespace-pre-line">{description}</p>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
          취소
        </button>
        <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-medium text-white ${confirmTone === 'danger' ? 'bg-red-500' : 'bg-blue-500'}`}>
          {confirmLabel}
        </button>
      </div>
    </CenteredModalShell>
  );
}
