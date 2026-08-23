interface GymDifficultySectionProps {
  grades: Array<{ color: string; label: string }>;
}

export default function GymDifficultySection({ grades }: GymDifficultySectionProps) {
  return (
    <div className="px-5 mb-4">
      <div className="bg-white rounded-2xl border border-neutral-200 p-4">
        <h3 className="text-[15px] font-bold mb-3">난이도 체계</h3>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {grades.map((grade) => (
            <div key={`${grade.color}-${grade.label}`} className="flex flex-col items-center gap-1">
              <div className="h-7 w-7 rounded-full border border-black/10" style={{ backgroundColor: grade.color }} />
              <span className="text-[9px] text-neutral-400">{grade.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
