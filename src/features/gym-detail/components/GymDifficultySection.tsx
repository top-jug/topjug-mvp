interface GymDifficultySectionProps {
  colors: string[];
  onOpenComparison: () => void;
}

export default function GymDifficultySection({ colors, onOpenComparison }: GymDifficultySectionProps) {
  return (
    <div className="px-5 mb-4">
      <div className="bg-white rounded-2xl border border-neutral-200 p-4">
        <h3 className="text-[15px] font-bold mb-3">난이도 체계</h3>
        <div className="flex items-center justify-center gap-3 mb-3">
          {colors.map((color, index) => (
            <div key={index} className={`w-7 h-7 ${color} rounded-full`}></div>
          ))}
        </div>
        <button onClick={onOpenComparison} className="w-full py-2 bg-neutral-100 text-neutral-700 text-[13px] font-medium rounded-xl hover:bg-neutral-200 transition-colors">
          난이도 비교
        </button>
      </div>
    </div>
  );
}
