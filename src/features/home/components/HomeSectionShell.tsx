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
      <div className="mb-3 flex min-w-0 items-center justify-between gap-1">
        <h3 className="min-w-0 flex-1 truncate font-bold text-[15px]" title={title}>{title}</h3>
        {onAction && (
          <button
            onClick={onAction}
            aria-label={actionLabel ?? `${title} 더보기`}
            className="flex min-h-10 max-w-[65%] shrink-0 items-center gap-1 whitespace-nowrap px-1 text-[13px] font-medium text-neutral-500"
          >
            {actionLabel ? (
              <span className="block truncate">{actionLabel}</span>
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
