import { HomeSectionShell } from './HomeSectionShell';

interface HomeNearbyGymsProps {
  onGymClick: () => void;
  onOpen: () => void;
}

export function HomeNearbyGyms({ onGymClick, onOpen }: HomeNearbyGymsProps) {
  const nearbyGyms = [
    { name: '더클라임 양재', location: '서울 서초구', distance: '1.2km', rating: '4.6' },
    { name: '피커스', location: '서울 강남구', distance: '4.0km', rating: '4.3' },
  ];

  return (
    <HomeSectionShell title="주변 암장" onAction={onOpen} actionLabel="더보기" bordered={false}>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5">
        {nearbyGyms.map((gym, i) => (
          <div key={i} onClick={onGymClick} className="flex-shrink-0 w-[280px] border border-neutral-200 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500 transition-colors bg-white">
            <div className="h-40 bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 relative">
              <div className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm">
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span className="text-[12px] font-medium">{gym.rating}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-white">
              <h4 className="font-semibold text-[14px] mb-0.5">{gym.name}</h4>
              <div className="flex items-center gap-2 text-[13px] text-neutral-500">
                <div className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{gym.location}</span>
                </div>
                <span>{gym.distance} 거리</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </HomeSectionShell>
  );
}
