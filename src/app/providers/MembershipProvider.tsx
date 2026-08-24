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
import { deriveMembershipPresentation, localCalendarDaysRemaining, millisecondsUntilNextMembershipPresentation } from '../../features/membership/membership-summary';
import { emptyMembershipAccountState, loadMembershipResource, membershipStateForAccount } from '../../features/membership/membership-loading';

interface MembershipContextValue {
  memberships: MembershipItem[];
  gymOptions: Array<{ gymName: string; gymId: string; lightBg: string; darkText: string }>;
  isLoading: boolean;
  error: string | null;
  isGymOptionsLoading: boolean;
  gymOptionsError: string | null;
  actionError: string | null;
  refreshMemberships: () => Promise<void>;
  refreshGymOptions: () => Promise<void>;
  refreshMembershipPresentation: () => void;
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

function buildRecordPasses(memberships: MembershipItem[], now: Date) {
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
    const daysLeft = membership.validUntil
      ? Math.max(0, localCalendarDaysRemaining(membership.validUntil, now))
      : Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
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
  const [isGymOptionsLoading, setIsGymOptionsLoading] = useState(true);
  const [gymOptionsError, setGymOptionsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [presentationNow, setPresentationNow] = useState(() => new Date());
  const [stateAccountId, setStateAccountId] = useState<string | null>(null);
  const accountGeneration = useRef(0);
  const refreshVersion = useRef(0);
  const gymRefreshVersion = useRef(0);
  const membershipRefreshInFlight = useRef<{ account: number; promise: Promise<void> } | null>(null);
  const gymRefreshInFlight = useRef<{ account: number; promise: Promise<void> } | null>(null);
  const gymOptionsRef = useRef(gymOptions);

  const refreshMemberships = useCallback(async () => {
    const account = accountGeneration.current;
    if (membershipRefreshInFlight.current?.account === account) return membershipRefreshInFlight.current.promise;
    const version = refreshVersion.current + 1;
    refreshVersion.current = version;
    const promise = (async () => {
      setIsLoading(true);
      setError(null);
      const result = await loadMembershipResource(listMemberships);
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      if (result.ok) {
        const now = new Date();
        setPresentationNow(now);
        setMemberships(result.data.data.map((membership) => apiMembershipToItem(membership, gymOptionsRef.current, now)));
      } else {
        setMemberships([]);
        setError(messageForError(result.error));
      }
      setIsLoading(false);
    })();
    membershipRefreshInFlight.current = { account, promise };
    await promise;
    if (membershipRefreshInFlight.current?.promise === promise) membershipRefreshInFlight.current = null;
  }, []);

  const refreshGymOptions = useCallback(async () => {
    const account = accountGeneration.current;
    if (gymRefreshInFlight.current?.account === account) return gymRefreshInFlight.current.promise;
    const version = gymRefreshVersion.current + 1;
    gymRefreshVersion.current = version;
    const promise = (async () => {
      setIsGymOptionsLoading(true);
      setGymOptionsError(null);
      const result = await loadMembershipResource(listGyms);
      if (account !== accountGeneration.current || version !== gymRefreshVersion.current) return;
      if (result.ok) {
        const nextGymOptions = result.data.data.map((gym: ApiGymSummary, index) => ({
          gymId: gym.id,
          gymName: formatMembershipGymName(gym),
          ...membershipColorsForIndex(index),
        }));
        gymOptionsRef.current = nextGymOptions;
        setGymOptions(nextGymOptions);
      } else {
        setGymOptionsError(messageForError(result.error));
      }
      setIsGymOptionsLoading(false);
    })();
    gymRefreshInFlight.current = { account, promise };
    await promise;
    if (gymRefreshInFlight.current?.promise === promise) gymRefreshInFlight.current = null;
  }, []);

  const refreshMembershipPresentation = useCallback(() => setPresentationNow(new Date()), []);
  const authAccountId = authStatus === 'authenticated' ? user?.id ?? null : null;
  const isCurrentAccountState = stateAccountId === authAccountId;

  useEffect(() => {
    accountGeneration.current += 1;
    refreshVersion.current += 1;
    gymRefreshVersion.current += 1;
    membershipRefreshInFlight.current = null;
    gymRefreshInFlight.current = null;
    const emptyState = emptyMembershipAccountState(authAccountId, authStatus === 'loading' || authStatus === 'authenticated');
    setStateAccountId(emptyState.accountId);
    setMemberships(emptyState.memberships);
    setGymOptions(emptyState.gymOptions);
    gymOptionsRef.current = emptyState.gymOptions;
    setError(emptyState.error);
    setGymOptionsError(emptyState.gymOptionsError);
    setActionError(emptyState.actionError);
    setIsLoading(emptyState.isLoading);
    setIsGymOptionsLoading(emptyState.isGymOptionsLoading);
    setPresentationNow(new Date());
    if (authStatus === 'authenticated') {
      void refreshMemberships();
      void refreshGymOptions();
    }
  }, [authAccountId, authStatus, refreshGymOptions, refreshMemberships]);

  useEffect(() => {
    const now = new Date();
    const accountMemberships = isCurrentAccountState ? memberships : [];
    const timeout = window.setTimeout(
      () => setPresentationNow(new Date()),
      millisecondsUntilNextMembershipPresentation(accountMemberships, now),
    );
    return () => window.clearTimeout(timeout);
  }, [isCurrentAccountState, memberships, presentationNow]);

  const value = useMemo(() => {
    const accountState = membershipStateForAccount({
      accountId: stateAccountId,
      memberships,
      gymOptions,
      isLoading,
      error,
      isGymOptionsLoading,
      gymOptionsError,
      actionError,
    }, authAccountId);
    const accountMemberships = accountState.memberships;
    const accountGymOptions = accountState.gymOptions;
    const presentedMemberships = accountMemberships.map((membership) => deriveMembershipPresentation(membership, presentationNow));
    const { countPasses, periodPasses } = buildRecordPasses(presentedMemberships, presentationNow);

    return {
      memberships: presentedMemberships,
      gymOptions: accountGymOptions,
      isLoading: accountState.isLoading,
      error: accountState.error,
      isGymOptionsLoading: accountState.isGymOptionsLoading,
      gymOptionsError: accountState.gymOptionsError,
      actionError: accountState.actionError,
      refreshMemberships,
      refreshGymOptions,
      refreshMembershipPresentation,
      addMembership: async (membership: MembershipItem) => {
        const account = accountGeneration.current;
        refreshVersion.current += 1;
        membershipRefreshInFlight.current = null;
        setIsLoading(false);
        setActionError(null);
        try {
          const response = await createMembership(buildMembershipInput(membership, accountGymOptions, accountMemberships));
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          setMemberships((prev) => [apiMembershipToItem(response.data, accountGymOptions), ...prev]);
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
        membershipRefreshInFlight.current = null;
        setIsLoading(false);
        setActionError(null);
        try {
          if (!membership.updatedAt) throw new Error('회원권의 최신 수정 시각이 없습니다. 다시 불러온 뒤 시도해주세요.');
          const response = await replaceMembership(membership.id, {
            ...buildMembershipInput(membership, accountGymOptions, accountMemberships),
            expectedUpdatedAt: membership.updatedAt,
          });
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          const nextMembership = apiMembershipToItem(response.data, accountGymOptions);
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
        membershipRefreshInFlight.current = null;
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
  }, [actionError, authAccountId, error, gymOptions, gymOptionsError, isGymOptionsLoading, isLoading, memberships, presentationNow, refreshGymOptions, refreshMembershipPresentation, refreshMemberships, stateAccountId]);

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMemberships() {
  const context = useContext(MembershipContext);

  if (!context) {
    throw new Error('useMemberships must be used within MembershipProvider');
  }

  return context;
}
