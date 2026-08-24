import * as Dialog from '@radix-ui/react-dialog';
import { PropsWithChildren, RefObject, useEffect, useRef } from 'react';
import { handleOverlayOpenChange, shouldPreventOverlayDismiss } from './overlay-behavior';

interface CenteredModalShellProps extends PropsWithChildren {
  onClose: () => void;
  title: string;
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  panelClassName?: string;
  zIndexClassName?: string;
}

export default function CenteredModalShell({
  onClose,
  title,
  role = 'dialog',
  dismissible = true,
  initialFocusRef,
  panelClassName,
  zIndexClassName = 'z-[60]',
  children,
}: CenteredModalShellProps) {
  const restoreFocusRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const restoreTarget = restoreFocusRef.current;
      queueMicrotask(() => { if (!isMountedRef.current && restoreTarget?.isConnected) restoreTarget.focus(); });
    };
  }, []);

  return (
    <Dialog.Root modal open onOpenChange={(open) => handleOverlayOpenChange(open, dismissible, onClose)}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 bg-black/50 ${zIndexClassName}`} />
        <Dialog.Content
          role={role}
          aria-modal="true"
          onEscapeKeyDown={(event) => { if (shouldPreventOverlayDismiss(dismissible)) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (shouldPreventOverlayDismiss(dismissible)) event.preventDefault(); }}
          onOpenAutoFocus={(event) => {
            if (!initialFocusRef?.current) return;
            event.preventDefault();
            initialFocusRef.current.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocusRef.current?.focus();
          }}
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 outline-none ${zIndexClassName} ${panelClassName ?? 'bg-white rounded-3xl p-6 w-[340px]'}`}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
