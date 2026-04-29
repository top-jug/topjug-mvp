import RecordModalShell from './RecordModalShell';

interface GymSelectModalProps {
  gyms: string[];
  selectedGym: string;
  onSelect: (gym: string) => void;
  onClose: () => void;
}

export default function GymSelectModal({ gyms, selectedGym, onSelect, onClose }: GymSelectModalProps) {
  return (
    <RecordModalShell onClose={onClose}>
      <h3 className="text-lg font-bold mb-4">클라이밍장 선택</h3>

      <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
        {gyms.map((gym) => (
          <button
            key={gym}
            onClick={() => onSelect(gym)}
            className={`w-full p-4 rounded-xl text-left transition-colors ${
              selectedGym === gym ? 'bg-blue-500 text-white font-medium' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            {gym}
          </button>
        ))}
      </div>

      <button onClick={onClose} className="w-full py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
        닫기
      </button>
    </RecordModalShell>
  );
}
