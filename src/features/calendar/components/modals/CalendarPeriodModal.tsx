import { useEffect, useRef, useState } from 'react';
import BottomSheet from '../../../../app/components/overlay/BottomSheet';

interface CalendarPeriodModalProps {
  currentYear: number;
  currentMonth: number;
  onSelectPeriod: (year: number, month: number) => void;
  onClose: () => void;
}

interface WheelPickerProps {
  label: string;
  options: number[];
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}

const WHEEL_ITEM_HEIGHT = 44;
const YEAR_OPTIONS = Array.from({ length: 201 }, (_, index) => 1900 + index);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function WheelPicker({ label, options, value, suffix, onChange }: WheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedIndex = options.indexOf(value);
    if (selectedIndex < 0 || !scrollRef.current) return;

    scrollRef.current.scrollTop = selectedIndex * WHEEL_ITEM_HEIGHT;
  }, [options, value]);

  const selectNearestValue = () => {
    const node = scrollRef.current;
    if (!node) return;

    const nextIndex = Math.max(0, Math.min(options.length - 1, Math.round(node.scrollTop / WHEEL_ITEM_HEIGHT)));
    const nextValue = options[nextIndex];

    if (nextValue !== value) onChange(nextValue);
  };

  return (
    <div>
      <div className="mb-2 text-center text-[13px] font-medium text-neutral-500">{label}</div>
      <div className="relative h-[220px] overflow-hidden rounded-2xl bg-neutral-50">
        <div className="pointer-events-none absolute inset-x-2 top-[88px] z-10 h-11 rounded-xl border-y border-neutral-200 bg-white/80" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[72px] bg-gradient-to-b from-neutral-50 via-neutral-50/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[72px] bg-gradient-to-t from-neutral-50 via-neutral-50/90 to-transparent" />

        <div
          ref={scrollRef}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={selectNearestValue}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();

            const currentIndex = options.indexOf(value);
            const direction = event.key === 'ArrowUp' ? -1 : 1;
            const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
            onChange(options[nextIndex]);
          }}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain py-[88px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {options.map((option) => (
            <div
              key={option}
              role="option"
              aria-selected={option === value}
              className={`flex h-11 snap-center items-center justify-center text-[20px] transition-all ${
                option === value ? 'font-semibold text-neutral-950' : 'font-normal text-neutral-400'
              }`}
            >
              {option}{suffix}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPeriodModal({ currentYear, currentMonth, onSelectPeriod, onClose }: CalendarPeriodModalProps) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  return (
    <BottomSheet
      onClose={onClose}
      title="날짜 선택"
      bodyClassName="px-6 pb-8 pt-5"
      headerRight={
        <button
          type="button"
          onClick={() => onSelectPeriod(year, month)}
          className="h-10 rounded-full px-4 text-[15px] font-semibold text-blue-500"
        >
          완료
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <WheelPicker label="연도" options={YEAR_OPTIONS} value={year} suffix="년" onChange={setYear} />
        <WheelPicker label="월" options={MONTH_OPTIONS} value={month} suffix="월" onChange={setMonth} />
      </div>
    </BottomSheet>
  );
}
