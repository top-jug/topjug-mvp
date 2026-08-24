import * as Dialog from '@radix-ui/react-dialog';
import { PropsWithChildren, RefObject, useEffect, useRef } from 'react';
import { handleOverlayOpenChange, shouldPreventOverlayDismiss, shouldRestoreOverlayFocus } from './overlay-behavior';

interface CenteredModalShellProps extends PropsWithChildren {
  onClose: () => void;
  title: string;
  description: string;
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  maxHeightClassName?: string;
  panelClassName?: string;
  zIndexClassName?: string;
}

export default function CenteredModalShell({
  onClose,
  title,
  description,
  role = 'dialog',
  dismissible = true,
  initialFocusRef,
  maxHeightClassName = 'max-h-[calc(100dvh-2rem)]',
  panelClassName,
  zIndexClassName = 'z-[80]',
  children,
}: CenteredModalShellProps) {
  const restoreFocusRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const restoreTarget = restoreFocusRef.current;
      queueMicrotask(() => {
        if (shouldRestoreOverlayFocus(isMountedRef.current, Boolean(restoreTarget?.isConnected))) restoreTarget?.focus();
      });
    };
  }, []);

  return (
    <Dialog.Root modal open onOpenChange={(open) => handleOverlayOpenChange(open, dismissible, onClose)}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 bg-black/50 ${zIndexClassName}`} />
        <div className={`pointer-events-none fixed inset-0 flex items-center justify-center p-4 ${zIndexClassName}`}>
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
            className={`pointer-events-auto w-full overflow-y-auto outline-none ${maxHeightClassName} ${panelClassName ?? 'max-w-[340px] bg-white rounded-3xl p-6'}`}
          >
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
