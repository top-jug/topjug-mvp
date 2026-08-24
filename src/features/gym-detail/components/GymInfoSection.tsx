import type { GymContactLink, GymOperationStatus, PresentedOperatingHourOverride } from '../gym-presentation';
import { OPERATION_STATUS_PRESENTATION } from '../gym-presentation';

interface GymInfoSectionProps {
  address: string;
  nearby: string;
  operationStatus: GymOperationStatus;
  operatingHours: string[];
  operatingHourOverrides: PresentedOperatingHourOverride[];
  prices: string[];
  parkingInfo: string | null;
  contacts: GymContactLink[];
}

export default function GymInfoSection({ address, nearby, operationStatus, operatingHours, operatingHourOverrides, prices, parkingInfo, contacts }: GymInfoSectionProps) {
  const status = OPERATION_STATUS_PRESENTATION[operationStatus];
  return (
    <>
      <div className="px-5 mb-4">
        <div className={`rounded-2xl border px-4 py-3 ${status.className}`} role="status">
          <p className="text-[14px] font-bold">{status.label}</p>
          <p className="mt-0.5 text-[12px] font-medium">{status.description}</p>
        </div>
      </div>

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

      {(operatingHourOverrides.length > 0 || operatingHours.length > 0) && <div className="px-5 mb-6">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex-1">
            <p className="text-[14px] text-neutral-900 font-medium mb-1">운영시간</p>
            {operatingHourOverrides.length > 0 && (
              <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5">
                <p className="mb-1.5 text-[12px] font-bold text-amber-800">특별 운영시간 · 해당 날짜 우선</p>
                {operatingHourOverrides.map((override) => (
                  <div key={override.date} className="mb-1 last:mb-0">
                    <p className="text-[13px] font-semibold text-neutral-800">{override.date} · {override.hours}</p>
                    {override.note && <p className="text-[12px] text-neutral-600">{override.note}</p>}
                  </div>
                ))}
              </div>
            )}
            {operatingHours.length > 0 && <div className="space-y-0.5">
              {operatingHourOverrides.length > 0 && <p className="mb-1 text-[12px] font-semibold text-neutral-500">일반 운영시간</p>}
              {operatingHours.map((hours) => <p key={hours} className="text-[14px] text-neutral-600">{hours}</p>)}
            </div>}
          </div>
        </div>
      </div>}

      {parkingInfo && (
        <div className="px-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-black text-blue-500">P</div>
            <div>
              <p className="mb-1 text-[14px] font-medium text-neutral-900">주차 안내</p>
              <p className="whitespace-pre-line text-[14px] text-neutral-600">{parkingInfo}</p>
            </div>
          </div>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="px-5 mb-6">
          <p className="mb-2 text-[14px] font-medium text-neutral-900">연락처</p>
          <div className="flex flex-wrap gap-2">
            {contacts.map((contact) => (
              <a
                key={contact.kind}
                href={contact.href}
                target={contact.external ? '_blank' : undefined}
                rel={contact.external ? 'noreferrer' : undefined}
                className="min-h-11 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-blue-600"
                aria-label={`${contact.label}: ${contact.value}`}
              >
                {contact.value}
              </a>
            ))}
          </div>
        </div>
      )}

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
