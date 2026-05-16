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
        <div className="flex items-center gap-6">
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <button
                key={tab.value}
                onClick={() => onChangeTab(tab.value)}
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
