import ConfirmModal from '../../../../app/components/overlay/ConfirmModal';

interface ConfirmActionModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmActionModal({ title, description, confirmLabel, confirmDisabled, onConfirm, onClose }: ConfirmActionModalProps) {
  return (
    <ConfirmModal title={title} description={description} confirmLabel={confirmLabel} confirmDisabled={confirmDisabled} onConfirm={onConfirm} onClose={onClose} />
  );
}
