import { MembershipInput, ApiMembership } from '../../app/api/membership-api';
import { firstUnusedHomeOrder, MembershipItem } from '../../mocks/memberships';

export type MembershipGymOption = { gymName: string; gymId: string; lightBg: string; darkText: string };

function parseDisplayDate(value: string) {
  const [year, month, day] = value.split(/[.-]/).map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

export function formatMembershipDisplayDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function formatMembershipGymName(gym: { name: string; branchName: string | null }) {
  if (!gym.branchName || gym.name.includes(gym.branchName)) return gym.name;
  return `${gym.name} ${gym.branchName}`;
}

export function membershipColorsForIndex(index: number) {
  const colors = [
    { lightBg: '#E6F1FB', darkText: '#0C447C' },
    { lightBg: '#F7E8D7', darkText: '#6A3F0A' },
    { lightBg: '#F0E8FA', darkText: '#5A2D84' },
    { lightBg: '#EAF3DE', darkText: '#27500A' },
  ];
  return colors[index % colors.length];
}

export function apiMembershipToItem(membership: ApiMembership, gymOptions: MembershipGymOption[]): MembershipItem {
  const gymNames = membership.gyms.map(formatMembershipGymName);
  const primaryGymName = gymNames[0] ?? '';
  const colors = gymOptions.find((option) => option.gymId === membership.gymIds[0]) ?? membershipColorsForIndex(0);
  const validUntil = new Date(membership.validUntil);
  const daysLeft = Math.max(0, Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return {
    id: membership.id,
    gymIds: membership.gymIds,
    gymName: gymNames.length > 1 ? `${primaryGymName} 외 ${gymNames.length - 1}` : primaryGymName,
    passName: membership.name,
    passType: membership.type,
    remainingLabel: membership.type === 'count' ? '남은 횟수' : '남은 기간',
    remainingValue: membership.type === 'count'
      ? `${membership.remainingUses ?? 0} / ${membership.totalUses ?? 0}회`
      : `${daysLeft}일 남음`,
    lightBg: colors.lightBg,
    darkText: colors.darkText,
    startDate: formatMembershipDisplayDate(membership.validFrom),
    endDate: formatMembershipDisplayDate(membership.validUntil),
    validFrom: membership.validFrom,
    validUntil: membership.validUntil,
    updatedAt: membership.updatedAt,
    note: membership.note,
    isFavorite: membership.homeFavorite,
    homeOrder: membership.homeOrder,
    eligibilityStatus: membership.eligibilityStatus,
  };
}

export function parseMembershipCounts(remainingValue: string) {
  const [remainingText, totalText, ...extraParts] = remainingValue.replace('회', '').split('/').map((value) => value.trim());
  if (extraParts.length > 0 || !/^\d+$/.test(remainingText ?? '') || !/^\d+$/.test(totalText ?? '')) {
    throw new Error('횟수는 0 이상의 정수로 입력해주세요.');
  }

  const remainingUses = Number(remainingText);
  const totalUses = Number(totalText);
  if (!Number.isSafeInteger(remainingUses) || !Number.isSafeInteger(totalUses)) {
    throw new Error('횟수는 0 이상의 정수로 입력해주세요.');
  }
  if (remainingUses > totalUses) throw new Error('남은 횟수는 전체 횟수보다 클 수 없습니다.');
  return { remainingUses, totalUses };
}

export function buildMembershipInput(membership: MembershipItem, gymOptions: MembershipGymOption[], memberships: MembershipItem[]): MembershipInput {
  const gymIds = membership.gymIds && membership.gymIds.length > 0
    ? membership.gymIds
    : gymOptions.filter((option) => option.gymName === membership.gymName).map((option) => option.gymId);
  const counts = membership.passType === 'count' ? parseMembershipCounts(membership.remainingValue) : null;
  const favoriteMemberships = memberships.filter((item) => item.isFavorite && item.id !== membership.id);
  const homeOrder = membership.isFavorite
    ? membership.homeOrder ?? firstUnusedHomeOrder(favoriteMemberships)
    : null;

  return {
    name: membership.passName,
    type: membership.passType,
    gymIds,
    totalUses: counts?.totalUses ?? null,
    remainingUses: counts?.remainingUses ?? null,
    validFrom: membership.validFrom && formatMembershipDisplayDate(membership.validFrom) === membership.startDate
      ? membership.validFrom
      : parseDisplayDate(membership.startDate),
    validUntil: membership.validUntil && formatMembershipDisplayDate(membership.validUntil) === membership.endDate
      ? membership.validUntil
      : parseDisplayDate(membership.endDate),
    note: membership.note?.trim() ? membership.note : null,
    homeFavorite: Boolean(membership.isFavorite),
    homeOrder,
  };
}
