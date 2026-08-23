const FACILITY_ICONS = {
  shower: (
    <path d="M9 2v6m6-6v6M9 18c.64 2.5 1.5 4 3 4s2.36-1.5 3-4m-6-8h6" />
  ),
  boulder: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  stretch: (
    <path d="M12 2v20m-5-5 5 5 5-5m-5-10L7 2m10 0-5 5" />
  ),
  parking: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  rental: (
    <>
      <path d="M5 15c3-1 5-4 6-9 2 4 4 7 8 9" />
      <path d="M4 15h16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </>
  ),
} as const;

import { GymFacility } from '../../../entities/gym/types';

interface GymFacilitiesSectionProps {
  facilities: ReadonlyArray<GymFacility>;
}

export default function GymFacilitiesSection({ facilities }: GymFacilitiesSectionProps) {
  return (
    <div className="px-5 mb-6">
      <div className="mb-3">
        <h2 className="text-[16px] font-bold text-neutral-900">보유 시설</h2>
      </div>
      <div className="flex items-center justify-around">
        {facilities.map((facility) => (
          <div key={facility.label} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {FACILITY_ICONS[facility.icon]}
              </svg>
            </div>
            <span className="text-[12px] text-neutral-600">{facility.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
