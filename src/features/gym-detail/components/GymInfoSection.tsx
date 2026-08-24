interface GymInfoSectionProps {
  address: string;
  nearby: string;
  operatingHours: string[];
  prices: string[];
}

export default function GymInfoSection({ address, nearby, operatingHours, prices }: GymInfoSectionProps) {
  return (
    <>
      <div className="px-5 mb-4">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <div>
            <p className="text-[14px] text-neutral-900 font-medium mb-0.5">{address}</p>
            {nearby && <p className="text-[13px] text-neutral-400">{nearby}</p>}
          </div>
        </div>
      </div>

      <div className="px-5 mb-6">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex-1">
            <p className="text-[14px] text-neutral-900 font-medium mb-1">운영시간</p>
            <div className="space-y-0.5">
              {operatingHours.map((hours) => <p key={hours} className="text-[14px] text-neutral-600">{hours}</p>)}
            </div>
          </div>
        </div>
      </div>

      {prices.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[12px] font-black text-blue-500">₩</div>
            <div>
              <p className="mb-1 text-[14px] font-medium text-neutral-900">이용 가격</p>
              {prices.map((price) => <p key={price} className="text-[14px] text-neutral-600">{price}</p>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
