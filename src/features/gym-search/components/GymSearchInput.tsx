interface GymSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function GymSearchInput({ value, onChange }: GymSearchInputProps) {
  return (
    <div className="px-5 pb-3 pt-2 bg-white">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="암장 이름이나 지역, 시설을 입력"
          className="w-full pl-4 pr-10 py-3 bg-white border border-neutral-200 rounded-2xl text-[15px] placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
    </div>
  );
}
