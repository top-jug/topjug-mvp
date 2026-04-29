import { MouseEvent, PropsWithChildren, ReactNode } from 'react';

interface BottomSheetProps extends PropsWithChildren {
  onClose: () => void;
  title?: ReactNode;
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
    headerLeft,
    headerRight,
    maxHeightClassName = 'max-h-[80vh]',
    bodyClassName = 'p-6',
    panelClassName = '',
    zIndexClassName = 'z-[70]',
    children,
  } = props;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose}></div>
      <div className={`fixed inset-x-0 bottom-0 bg-white rounded-t-[28px] border-t border-neutral-200 overflow-hidden flex flex-col ${maxHeightClassName} ${zIndexClassName} ${panelClassName}`}>
        {(title || headerLeft || headerRight) && (
          <div className="px-6 py-5 border-b border-neutral-100 grid grid-cols-[auto_1fr_auto] items-center gap-3 flex-shrink-0">
            <div>{headerLeft}</div>
            <div className="text-center text-[18px] font-bold">{title}</div>
            <div className="justify-self-end">
              {headerRight ?? (
              <button onClick={onClose} className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center" aria-label="닫기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              )}
            </div>
          </div>
        )}
        <div className={`flex-1 overflow-y-auto ${bodyClassName}`} onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </>
  );
}
