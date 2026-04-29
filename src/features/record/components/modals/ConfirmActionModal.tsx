import ConfirmModal from '../../../../app/components/overlay/ConfirmModal';

interface ConfirmActionModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmActionModal({ title, description, confirmLabel, onConfirm, onClose }: ConfirmActionModalProps) {
  return (
    <ConfirmModal title={title} description={description} confirmLabel={confirmLabel} onConfirm={onConfirm} onClose={onClose} />
  );
}
