import { HomeSectionShell } from './HomeSectionShell';

interface HomeRecentGymsProps {
  onGymClick: () => void;
  onOpen: () => void;
}

export function HomeRecentGyms({ onGymClick, onOpen }: HomeRecentGymsProps) {
  const recentGyms = [
    { name: '더클라임 양재', grade: 'V4' },
    { name: '피커스 홀딩', grade: 'V3' },
    { name: '클라이밍랩코', grade: 'V5' },
  ];

  return (
    <HomeSectionShell title="최근 다녀온 암장" onAction={onOpen}>
      <div className="space-y-2.5">
        {recentGyms.map((gym, i) => (
          <div key={i} onClick={onGymClick} className="flex items-center justify-between text-[14px] cursor-pointer hover:bg-white -mx-1 px-1 py-1 rounded-lg transition-colors">
            <div>
              <div className="font-medium mb-0.5">{gym.name}</div>
            </div>
            <div className="text-blue-600 font-bold">{gym.grade}</div>
          </div>
        ))}
      </div>
    </HomeSectionShell>
  );
}
