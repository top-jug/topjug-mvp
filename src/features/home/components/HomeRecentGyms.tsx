import { HomeSectionShell } from './HomeSectionShell';

interface HomeRecentGymsProps {
  onGymClick: () => void;
  onOpen: () => void;
}

export function HomeRecentGyms({ onGymClick, onOpen }: HomeRecentGymsProps) {
  const recentGyms = [
    { name: '더클라임 양재', colorClassName: 'bg-red-500' },
    { name: '피커스 홀딩', colorClassName: 'bg-green-500' },
    { name: '클라이밍랩코', colorClassName: 'bg-blue-500' },
  ];

  return (
    <HomeSectionShell title="최근 다녀온 암장" onAction={onOpen}>
      <div className="space-y-2.5">
        {recentGyms.map((gym, i) => (
          <div key={i} onClick={onGymClick} className="flex items-center justify-between gap-2 text-[14px] cursor-pointer hover:bg-white -mx-1 px-1 py-1 rounded-lg transition-colors">
            <div className="font-medium truncate">{gym.name}</div>
            <div className={`h-3.5 w-3.5 flex-shrink-0 rounded-full ${gym.colorClassName}`} aria-hidden="true" />
          </div>
        ))}
      </div>
    </HomeSectionShell>
  );
}
