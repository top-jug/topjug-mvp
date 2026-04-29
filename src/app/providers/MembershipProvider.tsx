import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { CountPass, PeriodPass } from '../../entities/record/types';
import { MEMBERSHIPS, MembershipItem } from '../../mocks/memberships';

interface MembershipContextValue {
  memberships: MembershipItem[];
  addMembership: (membership: MembershipItem) => void;
  updateMembership: (membership: MembershipItem) => void;
  deleteMembership: (membershipId: string) => void;
  countPasses: CountPass[];
  periodPasses: PeriodPass[];
}

const MembershipContext = createContext<MembershipContextValue | null>(null);
const STORAGE_KEY = 'topjug.memberships';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const TODAY = new Date('2026-04-10T00:00:00');

function parseKoreanDate(value: string) {
  const [year, month, day] = value.split('.').map(Number);
  return new Date(year, month - 1, day);
}

function buildRecordPasses(memberships: MembershipItem[]) {
  const countPasses: CountPass[] = [];
  const periodPasses: PeriodPass[] = [];

  memberships.forEach((membership, index) => {
    if (membership.passType === 'count') {
      const [remainingPart, totalPart] = membership.remainingValue.replace('회', '').split('/').map((part) => Number(part.trim()));
      countPasses.push({
        id: index + 1,
        gym: membership.gymName || '암장 미선택',
        remaining: remainingPart || 0,
        total: totalPart || 0,
      });
      return;
    }

    const expiry = parseKoreanDate(membership.endDate);
    const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24)));
    periodPasses.push({
      id: index + 1,
      gym: membership.gymName || '암장 미선택',
      daysLeft,
      expiryDate: `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`,
      expiryDay: DAY_LABELS[expiry.getDay()],
    });
  });

  return { countPasses, periodPasses };
}

export function MembershipProvider({ children }: PropsWithChildren) {
  const [memberships, setMemberships] = useState<MembershipItem[]>(() => {
    if (typeof window === 'undefined') return MEMBERSHIPS;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return MEMBERSHIPS;

    try {
      return JSON.parse(stored) as MembershipItem[];
    } catch {
      return MEMBERSHIPS;
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memberships));
  }, [memberships]);

  const value = useMemo(() => {
    const { countPasses, periodPasses } = buildRecordPasses(memberships);

    return {
      memberships,
      addMembership: (membership: MembershipItem) => setMemberships((prev) => [membership, ...prev]),
      updateMembership: (membership: MembershipItem) => setMemberships((prev) => prev.map((item) => (item.id === membership.id ? membership : item))),
      deleteMembership: (membershipId: string) => setMemberships((prev) => prev.filter((item) => item.id !== membershipId)),
      countPasses,
      periodPasses,
    };
  }, [memberships]);

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMemberships() {
  const context = useContext(MembershipContext);

  if (!context) {
    throw new Error('useMemberships must be used within MembershipProvider');
  }

  return context;
}
