import { ReactNode } from 'react';

interface HomeSectionShellProps {
  title: string;
  children: ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  bordered?: boolean;
}

export function HomeSectionShell({ title, children, onAction, actionLabel, bordered = true }: HomeSectionShellProps) {
  return (
    <section className={bordered ? 'border border-neutral-200 rounded-2xl p-3 bg-white' : ''}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-[15px]">{title}</h3>
        {onAction && (
          <button onClick={onAction} className="min-h-10 px-1 flex items-center gap-1 text-[13px] text-neutral-500 font-medium">
            {actionLabel ? (
              <span>{actionLabel}</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
