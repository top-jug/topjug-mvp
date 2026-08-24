import { MembershipInput, ApiMembership } from '../../app/api/membership-api';
import { firstUnusedHomeOrder, MembershipItem } from '../../mocks/memberships';

export type MembershipGymOption = { gymName: string; gymId: string; lightBg: string; darkText: string };

export type MembershipDateField = 'startDate' | 'endDate';

export class MembershipDateValidationError extends Error {
  constructor(message: string, readonly field: MembershipDateField) {
    super(message);
    this.name = 'MembershipDateValidationError';
  }
}

function parseDisplayDate(value: string, field: MembershipDateField) {
  const label = field === 'startDate' ? '시작일' : '만료일';
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value);
  if (!match) {
    throw new MembershipDateValidationError(`${label}은 YYYY.MM.DD 형식으로 입력해주세요.`, field);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (month < 1 || month > 12 || day < 1 || day > (daysInMonth ?? 0)) {
    throw new MembershipDateValidationError(`${label}에 실제 존재하는 날짜를 입력해주세요.`, field);
  }

  return { year, month, day };
}

export function validateMembershipDates(
  startDate: string,
  endDate: string,
  existing?: { validFrom?: string; validUntil?: string },
) {
  const start = parseDisplayDate(startDate, 'startDate');
  const end = parseDisplayDate(endDate, 'endDate');

  const toInstant = ({ year, month, day }: typeof start) => {
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return date.toISOString();
  };
  const validFrom = existing?.validFrom && formatMembershipDisplayDate(existing.validFrom) === startDate
    ? existing.validFrom
    : toInstant(start);
  const validUntil = existing?.validUntil && formatMembershipDisplayDate(existing.validUntil) === endDate
    ? existing.validUntil
    : toInstant(end);
  if (new Date(validFrom).getTime() > new Date(validUntil).getTime()) {
    throw new MembershipDateValidationError('만료일은 시작일과 같거나 이후여야 합니다.', 'endDate');
  }
  return { validFrom, validUntil };
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

export function apiMembershipToItem(membership: ApiMembership, gymOptions: MembershipGymOption[], now = new Date()): MembershipItem {
  const gymNames = membership.gyms.map(formatMembershipGymName);
  const primaryGymName = gymNames[0] ?? '';
  const colors = gymOptions.find((option) => option.gymId === membership.gymIds[0]) ?? membershipColorsForIndex(0);
  const validUntil = new Date(membership.validUntil);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDay = Date.UTC(validUntil.getFullYear(), validUntil.getMonth(), validUntil.getDate());
  const daysLeft = Math.max(0, (expiryDay - today) / (1000 * 60 * 60 * 24));

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
  const dates = validateMembershipDates(membership.startDate, membership.endDate, membership);

  return {
    name: membership.passName,
    type: membership.passType,
    gymIds,
    totalUses: counts?.totalUses ?? null,
    remainingUses: counts?.remainingUses ?? null,
    validFrom: dates.validFrom,
    validUntil: dates.validUntil,
    note: membership.note?.trim() ? membership.note : null,
    homeFavorite: Boolean(membership.isFavorite),
    homeOrder,
  };
}
