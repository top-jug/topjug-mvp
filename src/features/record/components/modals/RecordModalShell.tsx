import { PropsWithChildren } from 'react';
import CenteredModalShell from '../../../../app/components/overlay/CenteredModalShell';

interface RecordModalShellProps extends PropsWithChildren {
  onClose: () => void;
  panelClassName?: string;
}

export default function RecordModalShell({ onClose, panelClassName, children }: RecordModalShellProps) {
  return (
    <CenteredModalShell onClose={onClose} panelClassName={panelClassName ?? 'bg-white rounded-3xl p-6 w-[340px]'}>
      {children}
    </CenteredModalShell>
  );
}
