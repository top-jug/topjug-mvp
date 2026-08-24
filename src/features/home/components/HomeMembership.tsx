import { HomeSectionShell } from './HomeSectionShell';
import { useMemberships } from '../../../app/providers/MembershipProvider';
import { compareHomeOrder } from '../../../mocks/memberships';

interface HomeMembershipProps {
  onOpen: () => void;
}

export function HomeMembership({ onOpen }: HomeMembershipProps) {
  const { memberships } = useMemberships();
  const favoriteMemberships = memberships
    .filter((membership) => membership.isFavorite)
    .sort(compareHomeOrder);
  const visibleMemberships = favoriteMemberships.slice(0, 3);
  const hiddenCount = favoriteMemberships.length - visibleMemberships.length;

  return (
    <HomeSectionShell title="회원권" onAction={onOpen} actionLabel="회원권 수정">
      <div className="space-y-2.5">
        {visibleMemberships.map((membership) => (
          <div key={membership.id} className="flex items-center justify-between gap-2 text-[14px]">
            <div className="font-medium truncate">{membership.gymName || '암장 미선택'}</div>
            <div className="text-[12px] text-neutral-400 whitespace-nowrap">{membership.remainingValue}</div>
          </div>
        ))}
        {hiddenCount > 0 && <div className="text-[12px] font-medium text-neutral-400">+{hiddenCount}개 회원권 더보기</div>}
      </div>
    </HomeSectionShell>
  );
}
