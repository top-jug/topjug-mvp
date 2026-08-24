import { PropsWithChildren } from 'react';
import CenteredModalShell from '../../../../app/components/overlay/CenteredModalShell';

interface RecordModalShellProps extends PropsWithChildren {
  onClose: () => void;
  title: string;
  description: string;
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  maxHeightClassName?: string;
  panelClassName?: string;
}

export default function RecordModalShell({ onClose, title, description, role, dismissible, maxHeightClassName, panelClassName, children }: RecordModalShellProps) {
  return (
    <CenteredModalShell onClose={onClose} title={title} description={description} role={role} dismissible={dismissible} maxHeightClassName={maxHeightClassName} panelClassName={panelClassName ?? 'max-w-[340px] bg-white rounded-3xl p-6'}>
      {children}
    </CenteredModalShell>
  );
}
