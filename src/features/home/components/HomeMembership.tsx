import { HomeSectionShell } from './HomeSectionShell';
import { useMemberships } from '../../../app/providers/MembershipProvider';
import { compareHomeOrder } from '../../../mocks/memberships';
import { getHomeDataState } from '../home-state';

interface HomeMembershipProps {
  onOpen: () => void;
}

export function HomeMembership({ onOpen }: HomeMembershipProps) {
  const { memberships, isLoading, error, refreshMemberships } = useMemberships();
  const favoriteMemberships = memberships
    .filter((membership) => membership.isFavorite)
    .sort(compareHomeOrder);
  const visibleMemberships = favoriteMemberships.slice(0, 3);
  const hiddenCount = favoriteMemberships.length - visibleMemberships.length;
  const state = getHomeDataState(isLoading, error, visibleMemberships.length);

  return (
    <HomeSectionShell title="회원권" onAction={onOpen} actionLabel="회원권 수정">
      {state === 'loading' && <div className="py-5 text-center text-[12px] text-neutral-500" aria-busy="true">회원권을 불러오는 중입니다.</div>}
      {state === 'error' && (
        <div className="py-2 text-center text-[12px] text-red-600" role="alert">
          <div>{error}</div>
          <button type="button" onClick={() => void refreshMemberships()} className="mt-1 min-h-10 font-semibold text-red-700">회원권 다시 시도</button>
        </div>
      )}
      {state === 'empty' && (
        <div className="py-2 text-center text-[12px] text-neutral-500">
          <div>{memberships.length === 0 ? '등록된 회원권이 없어요.' : '홈에 표시할 회원권이 없어요.'}</div>
          <button type="button" onClick={onOpen} className="mt-2 min-h-10 font-semibold text-[#185FA5]">
            {memberships.length === 0 ? '첫 회원권 등록하기' : '홈 회원권 선택하기'}
          </button>
        </div>
      )}
      {state === 'ready' && (
        <div className="space-y-2.5">
          {visibleMemberships.map((membership) => (
            <div key={membership.id} className="flex items-center justify-between gap-2 text-[14px]">
              <div className="font-medium truncate">{membership.gymName || '암장 미선택'}</div>
              <div className="text-[12px] text-neutral-400 whitespace-nowrap">{membership.remainingValue}</div>
            </div>
          ))}
          {hiddenCount > 0 && <div className="text-[12px] font-medium text-neutral-400">+{hiddenCount}개 회원권 더보기</div>}
        </div>
      )}
    </HomeSectionShell>
  );
}
