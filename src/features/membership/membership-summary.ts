import { MembershipItem } from '../../mocks/memberships';

export const EXPIRING_SOON_DAYS = 14;
export const ACTIVATION_REFRESH_COALESCE_MS = 1_000;

function localDayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / (24 * 60 * 60 * 1000);
}

export function localCalendarDaysRemaining(validUntil: string, now: Date) {
  return localDayNumber(new Date(validUntil)) - localDayNumber(now);
}

export function deriveMembershipPresentation(membership: MembershipItem, now: Date): MembershipItem {
  if (!membership.validFrom || !membership.validUntil) return membership;

  const nowTime = now.getTime();
  const validFromTime = new Date(membership.validFrom).getTime();
  const validUntilTime = new Date(membership.validUntil).getTime();
  const remainingUses = membership.passType === 'count'
    ? Number(/^\s*(\d+)\s*\//.exec(membership.remainingValue)?.[1])
    : null;
  const eligibilityStatus = (membership.gymIds?.length ?? 0) === 0 ? 'unassigned'
    : nowTime < validFromTime ? 'not_started'
      : nowTime > validUntilTime ? 'expired'
        : membership.passType === 'count' && remainingUses === 0 ? 'exhausted'
          : 'active';

  return {
    ...membership,
    eligibilityStatus,
    remainingValue: membership.passType === 'period'
      ? `${Math.max(0, localCalendarDaysRemaining(membership.validUntil, now))}일 남음`
      : membership.remainingValue,
  };
}

export function countExpiringSoon(memberships: MembershipItem[], now: Date) {
  return memberships.filter((membership) => {
    if (!membership.validUntil) return false;
    const presented = deriveMembershipPresentation(membership, now);
    const daysRemaining = localCalendarDaysRemaining(membership.validUntil, now);
    return presented.eligibilityStatus === 'active'
      && daysRemaining >= 0
      && daysRemaining <= EXPIRING_SOON_DAYS;
  }).length;
}

export function millisecondsUntilNextLocalDate(now: Date) {
  const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextDate.getTime() - now.getTime();
}

export function shouldRefreshForActivation(lastRefreshAt: number, now: number) {
  return now - lastRefreshAt >= ACTIVATION_REFRESH_COALESCE_MS;
}
