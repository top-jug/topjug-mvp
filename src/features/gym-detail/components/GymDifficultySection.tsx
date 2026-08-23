interface GymDifficultySectionProps {
  colors: string[];
}

export default function GymDifficultySection({ colors }: GymDifficultySectionProps) {
  return (
    <div className="px-5 mb-4">
      <div className="bg-white rounded-2xl border border-neutral-200 p-4">
        <h3 className="text-[15px] font-bold mb-3">난이도 체계</h3>
        <div className="flex items-center justify-center gap-3">
          {colors.map((color, index) => (
            <div key={index} className={`w-7 h-7 ${color} rounded-full`}></div>
          ))}
        </div>
      </div>
    </div>
  );
}
