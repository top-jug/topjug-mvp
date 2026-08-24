import { ImageWithFallback } from '../../../../app/components/figma/ImageWithFallback';
import sectorMap from '../../../../imports/image-4.png';
import RecordModalShell from './RecordModalShell';

interface WallInfoModalProps {
  wallId: 'sector1' | 'sector2';
  onClose: () => void;
}

export default function WallInfoModal({ wallId, onClose }: WallInfoModalProps) {
  const isMainWall = wallId === 'sector1';

  return (
    <RecordModalShell onClose={onClose} title={isMainWall ? '1 Sector Main Wall 정보' : '2 Sector Cave 정보'} panelClassName="bg-white rounded-3xl p-6 w-[340px] max-h-[600px] overflow-y-auto shadow-2xl">
      <h3 className="text-lg font-bold mb-4">{isMainWall ? '1 Sector (Main Wall) 정보' : '2 Sector (Cave) 정보'}</h3>

      <div className="mb-4 bg-neutral-800 rounded-xl overflow-hidden">
        <ImageWithFallback src={sectorMap.src} alt="Sector Map" className="w-full h-48 object-contain" />
      </div>

      <div className="space-y-3 mb-6">
        {isMainWall ? (
          <>
            <InfoRow label="벽 타입" value="Main Wall" />
            <InfoRow label="높이" value="4.5m" />
            <InfoRow label="각도" value="수직 (90°)" />
            <InfoRow label="특징" value="초보자부터 중급자까지 다양한 난이도의 루트가 설정되어 있습니다." />
          </>
        ) : (
          <>
            <InfoRow label="벽 타입" value="Cave (동굴형)" />
            <InfoRow label="높이" value="4.0m" />
            <InfoRow label="각도" value="오버행 (110-120°)" />
            <InfoRow label="특징" value="오버행 벽으로 팔 힘과 코어 근력이 필요한 루트들로 구성되어 있습니다." />
          </>
        )}
      </div>

      <button onClick={onClose} className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-medium">
        확인
      </button>
    </RecordModalShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm font-semibold text-neutral-700 min-w-[60px]">{label}:</span>
      <span className="text-sm text-neutral-600">{value}</span>
    </div>
  );
}
