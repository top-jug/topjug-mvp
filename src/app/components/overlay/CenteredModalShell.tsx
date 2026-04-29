import { MouseEvent, PropsWithChildren } from 'react';

interface CenteredModalShellProps extends PropsWithChildren {
  onClose: () => void;
  panelClassName?: string;
  zIndexClassName?: string;
}

export default function CenteredModalShell({ onClose, panelClassName, zIndexClassName = 'z-[60]', children }: CenteredModalShellProps) {
  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 ${zIndexClassName}`} onClick={onClose}>
      <div className={panelClassName ?? 'bg-white rounded-3xl p-6 w-[340px]'} onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
