import { ReactNode } from 'react';

interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface TopTabHeaderProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChangeTab: (tab: T) => void;
  rightElement?: ReactNode;
  containerClassName?: string;
}

export default function TopTabHeader<T extends string>({
  tabs,
  activeTab,
  onChangeTab,
  rightElement,
  containerClassName = 'px-5 pt-5 pb-3 bg-white',
}: TopTabHeaderProps<T>) {
  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-6" role="tablist">
          {tabs.map((tab, index) => {
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onChangeTab(tab.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  const offset = event.key === 'ArrowRight' ? 1 : -1;
                  const nextIndex = (index + offset + tabs.length) % tabs.length;
                  onChangeTab(tabs[nextIndex].value);
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                  buttons?.[nextIndex]?.focus();
                }}
                className={`text-[28px] tracking-[-0.03em] transition-colors ${
                  isActive ? 'font-bold text-neutral-950' : 'font-semibold text-neutral-400'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {rightElement && <div className="flex items-center gap-2">{rightElement}</div>}
      </div>
    </div>
  );
}
