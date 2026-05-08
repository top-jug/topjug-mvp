import { GymSearchItem } from '../../../entities/gym/types';

interface GymSearchCardProps {
  gym: GymSearchItem;
  onClick: () => void;
}

export default function GymSearchCard({ gym, onClick }: GymSearchCardProps) {
  return (
    <div onClick={onClick} className="flex gap-3 bg-white border border-neutral-200 rounded-2xl p-4 hover:border-blue-500 transition-colors cursor-pointer min-h-[116px]">
      <div className="w-20 h-20 bg-neutral-200 rounded-xl overflow-hidden flex-shrink-0">
        <img src={gym.image} alt={gym.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[15px] mb-1">{gym.name}</h3>
          <p className="text-[13px] text-neutral-500 mb-2 line-clamp-1">{gym.address || '서울시 강남구 테헤란로 123'}</p>
          <div className="flex items-center gap-2">
            {gym.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-white border border-neutral-200 text-neutral-600 text-[11px] rounded-full">
                {tag}
              </span>
            ))}
          </div>
      </div>
      <button className="w-10 h-10 flex items-center justify-center rounded-full">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 hover:text-yellow-500 hover:fill-yellow-500 transition-colors">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    </div>
  );
}
