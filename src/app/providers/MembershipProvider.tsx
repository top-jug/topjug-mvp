import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CountPass, PeriodPass } from '../../entities/record/types';
import { MembershipItem } from '../../mocks/memberships';
import { ApiClientError } from '../api/api-client';
import {
  ApiGymSummary,
  archiveMembership,
  createMembership,
  listGyms,
  listMemberships,
  replaceMembership,
} from '../api/membership-api';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  apiMembershipToItem,
  buildMembershipInput,
  formatMembershipGymName,
  membershipColorsForIndex,
  parseMembershipCounts,
} from '../../features/membership/membership-contract';

interface MembershipContextValue {
  memberships: MembershipItem[];
  gymOptions: Array<{ gymName: string; gymId: string; lightBg: string; darkText: string }>;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  refreshMemberships: () => Promise<void>;
  addMembership: (membership: MembershipItem) => Promise<void>;
  updateMembership: (membership: MembershipItem) => Promise<void>;
  deleteMembership: (membershipId: string) => Promise<void>;
  countPasses: CountPass[];
  periodPasses: PeriodPass[];
}

const MembershipContext = createContext<MembershipContextValue | null>(null);

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function parseKoreanDate(value: string) {
  const [year, month, day] = value.split('.').map(Number);
  return new Date(year, month - 1, day);
}

function messageForError(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) return '로그인이 필요합니다.';
  if (error instanceof ApiClientError && error.status === 409) return error.message;
  if (error instanceof Error) return error.message;
  return '회원권 요청을 처리하지 못했습니다.';
}

function buildRecordPasses(memberships: MembershipItem[]) {
  const countPasses: CountPass[] = [];
  const periodPasses: PeriodPass[] = [];

  memberships.forEach((membership) => {
    if (membership.eligibilityStatus !== 'active') return;

    if (membership.passType === 'count') {
      const { remainingUses, totalUses } = parseMembershipCounts(membership.remainingValue);
      countPasses.push({
        id: membership.id,
        name: membership.passName,
        gym: membership.gymName || '암장 미선택',
        gymIds: membership.gymIds ?? [],
        remaining: remainingUses,
        total: totalUses,
      });
      return;
    }

    const expiry = parseKoreanDate(membership.endDate);
    const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    periodPasses.push({
      id: membership.id,
      name: membership.passName,
      gym: membership.gymName || '암장 미선택',
      gymIds: membership.gymIds ?? [],
      daysLeft,
      expiryDate: `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}`,
      expiryDay: DAY_LABELS[expiry.getDay()],
    });
  });

  return { countPasses, periodPasses };
}

export function MembershipProvider({ children }: PropsWithChildren) {
  const { status: authStatus, user } = useAuth();
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [gymOptions, setGymOptions] = useState<MembershipContextValue['gymOptions']>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const accountGeneration = useRef(0);
  const refreshVersion = useRef(0);

  const refreshMemberships = useCallback(async () => {
    const account = accountGeneration.current;
    const version = refreshVersion.current + 1;
    refreshVersion.current = version;
    setIsLoading(true);
    setError(null);

    try {
      const [gymsResponse, membershipsResponse] = await Promise.all([
        listGyms(),
        listMemberships(),
      ]);
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      const nextGymOptions = gymsResponse.data.map((gym: ApiGymSummary, index) => ({
        gymId: gym.id,
        gymName: formatMembershipGymName(gym),
        ...membershipColorsForIndex(index),
      }));

      setGymOptions(nextGymOptions);
      setMemberships(membershipsResponse.data.map((membership) => apiMembershipToItem(membership, nextGymOptions)));
    } catch (fetchError) {
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      setMemberships([]);
      setError(messageForError(fetchError));
    } finally {
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    accountGeneration.current += 1;
    refreshVersion.current += 1;
    if (authStatus === 'authenticated') {
      void refreshMemberships();
      return;
    }
    setMemberships([]);
    setGymOptions([]);
    setError(null);
    setActionError(null);
    setIsLoading(authStatus === 'loading');
  }, [authStatus, refreshMemberships, user?.id]);

  const value = useMemo(() => {
    const { countPasses, periodPasses } = buildRecordPasses(memberships);

    return {
      memberships,
      gymOptions,
      isLoading,
      error,
      actionError,
      refreshMemberships,
      addMembership: async (membership: MembershipItem) => {
        const account = accountGeneration.current;
        refreshVersion.current += 1;
        setIsLoading(false);
        setActionError(null);
        try {
          const response = await createMembership(buildMembershipInput(membership, gymOptions, memberships));
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          setMemberships((prev) => [apiMembershipToItem(response.data, gymOptions), ...prev]);
        } catch (requestError) {
          if (account !== accountGeneration.current) throw requestError;
          const message = messageForError(requestError);
          setActionError(message);
          throw new Error(message);
        }
      },
      updateMembership: async (membership: MembershipItem) => {
        const account = accountGeneration.current;
        refreshVersion.current += 1;
        setIsLoading(false);
        setActionError(null);
        try {
          if (!membership.updatedAt) throw new Error('회원권의 최신 수정 시각이 없습니다. 다시 불러온 뒤 시도해주세요.');
          const response = await replaceMembership(membership.id, {
            ...buildMembershipInput(membership, gymOptions, memberships),
            expectedUpdatedAt: membership.updatedAt,
          });
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          const nextMembership = apiMembershipToItem(response.data, gymOptions);
          setMemberships((prev) => prev.map((item) => (item.id === membership.id ? nextMembership : item)));
        } catch (requestError) {
          if (account !== accountGeneration.current) throw requestError;
          if (requestError instanceof ApiClientError && requestError.code === 'MEMBERSHIP_CHANGED') {
            await refreshMemberships();
          }
          const message = messageForError(requestError);
          setActionError(message);
          throw new Error(message);
        }
      },
      deleteMembership: async (membershipId: string) => {
        const account = accountGeneration.current;
        refreshVersion.current += 1;
        setIsLoading(false);
        setActionError(null);
        try {
          await archiveMembership(membershipId);
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          setMemberships((prev) => prev.filter((item) => item.id !== membershipId));
        } catch (requestError) {
          if (account !== accountGeneration.current) throw requestError;
          const message = messageForError(requestError);
          setActionError(message);
          throw new Error(message);
        }
      },
      countPasses,
      periodPasses,
    };
  }, [actionError, error, gymOptions, isLoading, memberships, refreshMemberships]);

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMemberships() {
  const context = useContext(MembershipContext);

  if (!context) {
    throw new Error('useMemberships must be used within MembershipProvider');
  }

  return context;
}
