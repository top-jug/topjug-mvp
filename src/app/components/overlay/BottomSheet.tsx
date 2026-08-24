import * as Dialog from '@radix-ui/react-dialog';
import { PropsWithChildren, ReactNode, RefObject, useEffect, useRef } from 'react';
import { handleOverlayOpenChange, shouldPreventOverlayDismiss, shouldRestoreOverlayFocus } from './overlay-behavior';

interface BottomSheetProps extends PropsWithChildren {
  onClose: () => void;
  title: ReactNode;
  description: string;
  accessibleTitle?: string;
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  maxHeightClassName?: string;
  bodyClassName?: string;
  panelClassName?: string;
  zIndexClassName?: string;
}

export default function BottomSheet(props: BottomSheetProps) {
  const {
    onClose,
    title,
    description,
    accessibleTitle,
    role = 'dialog',
    dismissible = true,
    initialFocusRef,
    headerLeft,
    headerRight,
    maxHeightClassName = 'mobile-bottom-sheet-max-h-80',
    bodyClassName = 'p-6',
    panelClassName = '',
    zIndexClassName = 'z-[70]',
    children,
  } = props;
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
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/20" />
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
          className={`mobile-bottom-sheet fixed inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] border-t border-neutral-200 bg-white outline-none ${maxHeightClassName} ${zIndexClassName} ${panelClassName}`}
        >
          <div className="px-6 py-5 border-b border-neutral-100 grid grid-cols-[auto_1fr_auto] items-center gap-3 flex-shrink-0">
            <div>{headerLeft}</div>
            <Dialog.Title className="text-center text-[18px] font-bold" aria-label={accessibleTitle}>
              {title}
            </Dialog.Title>
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
            <div className="justify-self-end">
              {headerRight ?? (
                <button type="button" onClick={onClose} disabled={!dismissible} className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center disabled:cursor-not-allowed disabled:text-neutral-400" aria-label="닫기">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
