import { BottomTab } from '../../navigation';

interface BottomTabBarProps {
  activeTab?: BottomTab;
  onNavigate: (screen: BottomTab | 'record') => void;
}

export default function BottomTabBar({ activeTab, onNavigate }: BottomTabBarProps) {
  const activeColor = 'rgb(59 130 246)';
  const inactiveStroke = 'rgb(115 115 115)';

  return (
    <nav aria-label="주요 메뉴" className="fixed bottom-0 left-0 right-0 z-50 h-24 px-5 pb-2 pt-1 pointer-events-auto">
      <div className="w-full h-full flex items-center justify-between">
        <div className="bg-white border border-neutral-200 rounded-full h-[68px] flex items-center justify-around px-4 flex-1 mr-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]">
          <button onClick={() => onNavigate('home')} aria-current={activeTab === 'home' ? 'page' : undefined} className="flex flex-col items-center gap-1.5 px-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke={activeTab === 'home' ? activeColor : inactiveStroke} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span className={`text-[12px] ${activeTab === 'home' ? 'text-blue-500' : 'text-neutral-500'}`}>홈</span>
          </button>
          <button onClick={() => onNavigate('gymSearch')} aria-current={activeTab === 'gymSearch' ? 'page' : undefined} className="flex flex-col items-center gap-1.5 px-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke={activeTab === 'gymSearch' ? activeColor : inactiveStroke} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className={`text-[12px] ${activeTab === 'gymSearch' ? 'text-blue-500' : 'text-neutral-500'}`}>암장</span>
          </button>
          <button onClick={() => onNavigate('calendar')} aria-current={activeTab === 'calendar' ? 'page' : undefined} className="flex flex-col items-center gap-1.5 px-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke={activeTab === 'calendar' ? activeColor : inactiveStroke} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" stroke={activeTab === 'calendar' ? activeColor : inactiveStroke} strokeWidth="2" />
              <line x1="8" y1="2" x2="8" y2="6" stroke={activeTab === 'calendar' ? activeColor : inactiveStroke} strokeWidth="2" />
              <line x1="3" y1="10" x2="21" y2="10" stroke={activeTab === 'calendar' ? activeColor : inactiveStroke} strokeWidth="2" />
            </svg>
            <span className={`text-[12px] ${activeTab === 'calendar' ? 'text-blue-500' : 'text-neutral-500'}`}>캘린더</span>
          </button>
        </div>
        <button onClick={() => onNavigate('record')} aria-label="운동 기록 시작" className="w-16 h-16 bg-white border border-blue-100 rounded-full flex items-center justify-center shadow-[0_-4px_12px_rgba(15,23,42,0.10)] flex-shrink-0">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
