type BrandIconProps = {
  className?: string;
  decorative?: boolean;
};

export function BrandIcon({ className = '', decorative = false }: BrandIconProps) {
  return (
    <img
      src="/icons/icon-192.png"
      alt={decorative ? '' : 'TopJug 로고'}
      aria-hidden={decorative || undefined}
      className={`object-contain ${className}`}
    />
  );
}

export function BrandLockup({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandIcon decorative className={compact ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl'} />
      <div>
        <div className={`${compact ? 'text-base' : 'text-lg'} font-black tracking-[-0.04em] ${inverted ? 'text-white' : 'text-neutral-950'}`}>TOPJUG</div>
        {!compact && <div className={`text-xs font-medium ${inverted ? 'text-neutral-400' : 'text-neutral-500'}`}>Climbing logbook</div>}
      </div>
    </div>
  );
}
