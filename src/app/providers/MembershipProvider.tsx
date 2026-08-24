import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CountPass, PeriodPass } from '../../entities/record/types';
import { MembershipItem } from '../../mocks/memberships';
import { ApiClientError } from '../api/api-client';
import {
  ApiGymSummary,
  ApiMembership,
  MembershipInput,
  archiveMembership,
  createMembership,
  listGyms,
  listMemberships,
  replaceMembership,
} from '../api/membership-api';
import { useAuth } from '../../features/auth/AuthProvider';

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

function parseDisplayDate(value: string) {
  const [year, month, day] = value.split(/[.-]/).map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function formatDisplayDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatGymName(gym: { name: string; branchName: string | null }) {
  if (!gym.branchName || gym.name.includes(gym.branchName)) return gym.name;
  return `${gym.name} ${gym.branchName}`;
}

function colorsForIndex(index: number) {
  const colors = [
    { lightBg: '#E6F1FB', darkText: '#0C447C' },
    { lightBg: '#F7E8D7', darkText: '#6A3F0A' },
    { lightBg: '#F0E8FA', darkText: '#5A2D84' },
    { lightBg: '#EAF3DE', darkText: '#27500A' },
  ];
  return colors[index % colors.length];
}

function messageForError(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) return '로그인이 필요합니다.';
  if (error instanceof ApiClientError && error.status === 409) return error.message;
  if (error instanceof Error) return error.message;
  return '회원권 요청을 처리하지 못했습니다.';
}

function apiMembershipToItem(membership: ApiMembership, gymOptions: Array<{ gymName: string; gymId: string; lightBg: string; darkText: string }>): MembershipItem {
  const gymNames = membership.gyms.map(formatGymName);
  const primaryGymName = gymNames[0] ?? '';
  const colors = gymOptions.find((option) => option.gymId === membership.gymIds[0]) ?? colorsForIndex(0);
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
    startDate: formatDisplayDate(membership.validFrom),
    endDate: formatDisplayDate(membership.validUntil),
    note: membership.note ?? '메모 없음',
    isFavorite: membership.homeFavorite,
    homeOrder: membership.homeOrder,
    eligibilityStatus: membership.eligibilityStatus,
  };
}

function buildRecordPasses(memberships: MembershipItem[]) {
  const countPasses: CountPass[] = [];
  const periodPasses: PeriodPass[] = [];

  memberships.forEach((membership) => {
    if (membership.eligibilityStatus !== 'active') return;

    if (membership.passType === 'count') {
      const [remainingPart, totalPart] = membership.remainingValue.replace('회', '').split('/').map((part) => Number(part.trim()));
      countPasses.push({
        id: membership.id,
        name: membership.passName,
        gym: membership.gymName || '암장 미선택',
        gymIds: membership.gymIds ?? [],
        remaining: remainingPart || 0,
        total: totalPart || 0,
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

function buildInput(membership: MembershipItem, gymOptions: MembershipContextValue['gymOptions'], memberships: MembershipItem[]): MembershipInput {
  const gymIds = membership.gymIds && membership.gymIds.length > 0
    ? membership.gymIds
    : gymOptions.filter((option) => option.gymName === membership.gymName).map((option) => option.gymId);
  const [remainingPart, totalPart] = membership.remainingValue.replace('회', '').split('/').map((value) => Number(value.trim()));
  const favoriteMemberships = memberships.filter((item) => item.isFavorite && item.id !== membership.id);
  const homeOrder = membership.isFavorite
    ? membership.homeOrder ?? favoriteMemberships.length
    : null;

  return {
    name: membership.passName,
    type: membership.passType,
    gymIds,
    totalUses: membership.passType === 'count' ? totalPart || remainingPart || 0 : null,
    remainingUses: membership.passType === 'count' ? remainingPart || 0 : null,
    validFrom: parseDisplayDate(membership.startDate),
    validUntil: parseDisplayDate(membership.endDate),
    note: membership.note || null,
    homeFavorite: Boolean(membership.isFavorite),
    homeOrder,
  };
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
        gymName: formatGymName(gym),
        ...colorsForIndex(index),
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
          const response = await createMembership(buildInput(membership, gymOptions, memberships));
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
          const response = await replaceMembership(membership.id, buildInput(membership, gymOptions, memberships));
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          const nextMembership = apiMembershipToItem(response.data, gymOptions);
          setMemberships((prev) => prev.map((item) => (item.id === membership.id ? nextMembership : item)));
        } catch (requestError) {
          if (account !== accountGeneration.current) throw requestError;
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
