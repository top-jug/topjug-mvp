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
          <p className="text-[13px] text-neutral-500 mb-2 line-clamp-1">{gym.description}</p>
          <div className="flex items-center gap-2">
            {gym.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-white border border-neutral-200 text-neutral-600 text-[11px] rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between">
        <button className="w-10 h-10 flex items-center justify-center rounded-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <div className="flex items-center gap-1 text-[12px] text-neutral-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{gym.distance}</span>
        </div>
      </div>
    </div>
  );
}
