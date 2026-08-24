import { PropsWithChildren } from 'react';
import CenteredModalShell from '../../../../app/components/overlay/CenteredModalShell';

interface RecordModalShellProps extends PropsWithChildren {
  onClose: () => void;
  title: string;
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  panelClassName?: string;
}

export default function RecordModalShell({ onClose, title, role, dismissible, panelClassName, children }: RecordModalShellProps) {
  return (
    <CenteredModalShell onClose={onClose} title={title} role={role} dismissible={dismissible} panelClassName={panelClassName ?? 'bg-white rounded-3xl p-6 w-[340px]'}>
      {children}
    </CenteredModalShell>
  );
}
