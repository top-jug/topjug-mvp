import { CountPass, PeriodPass } from '../../../../entities/record/types';
import RecordModalShell from './RecordModalShell';

interface PassSelectModalProps {
  passType: '횟수권' | '기간권';
  countPasses: CountPass[];
  periodPasses: PeriodPass[];
  onSelect: (selectedPassType: '횟수권' | '기간권', selectedPass: string, membershipId: string) => void;
  onClose: () => void;
}

export default function PassSelectModal({ passType, countPasses, periodPasses, onSelect, onClose }: PassSelectModalProps) {
  const passes = passType === '횟수권' ? countPasses : periodPasses;

  return (
    <RecordModalShell onClose={onClose} title={passType === '횟수권' ? '보유한 횟수권' : '보유한 기간권'} panelClassName="bg-white rounded-3xl p-6 w-[340px] shadow-2xl max-h-[500px] overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">{passType === '횟수권' ? '보유한 횟수권' : '보유한 기간권'}</h3>

      <div className="space-y-3 mb-6">
        {passes.length === 0 ? (
          <div className="rounded-xl bg-neutral-50 px-4 py-6 text-[14px] text-neutral-500 text-center">
            선택 가능한 {passType === '횟수권' ? '횟수권' : '기간권'}이 없습니다.
          </div>
        ) : passType === '횟수권'
          ? countPasses.map((pass) => {
              const afterUse = pass.remaining - 1;
              return (
                <button
                  key={pass.id}
                  onClick={() => onSelect('횟수권', `${pass.name} : 현재 (${pass.remaining}/${pass.total}) → 사용후 (${afterUse}/${pass.total})`, pass.id)}
                  className="w-full p-4 border border-neutral-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="font-semibold text-[15px] mb-1">{pass.name}</div>
                  <div className="text-[12px] text-neutral-500 mb-1">{pass.gym}</div>
                  <div className="text-[13px] text-neutral-600">
                    남은 횟수: <span className="font-bold text-blue-600">{pass.remaining}/{pass.total}</span>
                  </div>
                </button>
              );
            })
          : periodPasses.map((pass) => {
              const expiryDateFormatted = pass.expiryDate.substring(5).replace('-', '/');
              return (
                <button
                  key={pass.id}
                  onClick={() => onSelect('기간권', `${pass.name} : ${pass.daysLeft}일 남음 | 만료: ${expiryDateFormatted}(${pass.expiryDay})`, pass.id)}
                  className="w-full p-4 border border-neutral-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="font-semibold text-[15px] mb-1">{pass.name}</div>
                  <div className="text-[12px] text-neutral-500 mb-1">{pass.gym}</div>
                  <div className="text-[13px] text-neutral-600">
                    남은 기간: <span className="font-bold text-blue-600">{pass.daysLeft}일</span>
                  </div>
                </button>
              );
            })}
      </div>

      <button onClick={onClose} className="w-full py-2.5 bg-neutral-100 text-neutral-700 rounded-xl font-medium">
        닫기
      </button>
    </RecordModalShell>
  );
}
