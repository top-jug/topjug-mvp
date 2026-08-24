import RecordModalShell from './RecordModalShell';

interface GymSelectModalProps {
  gyms: Array<{ id: string; name: string }>;
  selectedGymId: string;
  onSelect: (gym: { id: string; name: string }) => void;
  onClose: () => void;
}

export default function GymSelectModal({ gyms, selectedGymId, onSelect, onClose }: GymSelectModalProps) {
  return (
    <RecordModalShell onClose={onClose} title="클라이밍장 선택" description="운동을 기록할 클라이밍장을 선택합니다.">
      <h3 className="text-lg font-bold mb-4">클라이밍장 선택</h3>

      <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
        {gyms.map((gym) => (
          <button
            key={gym.id}
            onClick={() => onSelect(gym)}
            className={`w-full p-4 rounded-xl text-left transition-colors ${
              selectedGymId === gym.id ? 'bg-blue-500 text-white font-medium' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
            }`}
          >
            {gym.name}
          </button>
        ))}
      </div>

      <button onClick={onClose} className="w-full py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
        닫기
      </button>
    </RecordModalShell>
  );
}
