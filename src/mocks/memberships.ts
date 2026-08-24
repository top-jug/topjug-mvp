export interface MembershipItem {
  id: string;
  gymIds?: string[];
  gymName: string;
  passName: string;
  passType: 'count' | 'period';
  remainingLabel: string;
  remainingValue: string;
  lightBg: string;
  darkText: string;
  startDate: string;
  endDate: string;
  validFrom?: string;
  validUntil?: string;
  updatedAt?: string;
  note: string | null;
  isFavorite?: boolean;
  homeOrder?: number | null;
  eligibilityStatus?: 'active' | 'unassigned' | 'not_started' | 'expired' | 'exhausted';
}

export function firstUnusedHomeOrder(memberships: MembershipItem[]) {
  const usedOrders = new Set(memberships.filter((membership) => membership.isFavorite).map((membership) => membership.homeOrder));
  return [0, 1, 2].find((order) => !usedOrders.has(order)) ?? null;
}

export function compareHomeOrder(left: MembershipItem, right: MembershipItem) {
  return (left.homeOrder ?? 3) - (right.homeOrder ?? 3);
}

export const MEMBERSHIPS: MembershipItem[] = [
  {
    id: 'theclimb-count',
    gymName: '더클라임',
    passName: '5회 이용권',
    passType: 'count',
    remainingLabel: '남은 횟수',
    remainingValue: '2 / 5회',
    lightBg: '#E6F1FB',
    darkText: '#0C447C',
    startDate: '2026.04.01',
    endDate: '2026.05.31',
    note: '강남, 연남 지점 사용 가능',
    isFavorite: true,
  },
  {
    id: 'peakers-period',
    gymName: '피커스',
    passName: '한 달 자유 이용권',
    passType: 'period',
    remainingLabel: '남은 기간',
    remainingValue: '34일 남음',
    lightBg: '#F7E8D7',
    darkText: '#6A3F0A',
    startDate: '2026.04.10',
    endDate: '2026.05.14',
    note: '평일 18시 이후 혼잡',
  },
];
