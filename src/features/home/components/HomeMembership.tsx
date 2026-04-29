import { HomeSectionShell } from './HomeSectionShell';
import { useMemberships } from '../../../app/providers/MembershipProvider';

interface HomeMembershipProps {
  onOpen: () => void;
}

export function HomeMembership({ onOpen }: HomeMembershipProps) {
  const { memberships } = useMemberships();
  const visibleMemberships = memberships.slice(0, 2);
  const hiddenCount = memberships.length - visibleMemberships.length;

  return (
    <HomeSectionShell title="회원권" onAction={onOpen}>
      <div className="space-y-2.5">
        {visibleMemberships.map((membership) => (
          <div key={membership.id} className="flex items-center justify-between text-[14px]">
            <div>
              <div className="font-medium mb-0.5">{membership.gymName || '암장 미선택'}</div>
              <div className="text-[12px] text-neutral-400">{membership.remainingValue}</div>
            </div>
          </div>
        ))}
        {hiddenCount > 0 && <div className="text-[12px] font-medium text-neutral-400">+{hiddenCount}개 회원권 더보기</div>}
      </div>
    </HomeSectionShell>
  );
}
