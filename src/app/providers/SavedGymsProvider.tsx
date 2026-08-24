import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClientError } from '../api/api-client';
import { ApiGymSummary, listSavedGyms, saveGym, unsaveGym } from '../api/gym-api';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  clearSavedGymActionError,
  createSavedGymActionErrorGuard,
  SavedGymActionError,
  SavedGymActionErrors,
  setSavedGymActionError,
} from '../../features/gym-search/saved-gym-action-state';

interface SavedGymsContextValue {
  savedGyms: ApiGymSummary[];
  savedGymIds: string[];
  isLoading: boolean;
  error: string | null;
  getActionError: (gymId: string) => SavedGymActionError | null;
  dismissActionError: (gymId?: string) => void;
  pendingGymIds: string[];
  isSavedGym: (gymId: string) => boolean;
  refreshSavedGyms: () => Promise<void>;
  toggleSavedGym: (gym: ApiGymSummary) => Promise<void>;
}

const SavedGymsContext = createContext<SavedGymsContextValue | null>(null);

function savedGymErrorMessage(error: unknown) {
  if (error instanceof ApiClientError && error.status === 401) return '로그인 후 내 암장을 이용할 수 있어요.';
  if (error instanceof Error) return error.message;
  return '내 암장 정보를 불러오지 못했습니다.';
}

export function SavedGymsProvider({ children }: PropsWithChildren) {
  const { status: authStatus, user } = useAuth();
  const [savedGyms, setSavedGyms] = useState<ApiGymSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<SavedGymActionErrors>({});
  const [pendingGymIds, setPendingGymIds] = useState<string[]>([]);
  const accountGeneration = useRef(0);
  const refreshVersion = useRef(0);
  const actionErrorGuard = useRef(createSavedGymActionErrorGuard());

  const refreshSavedGyms = useCallback(async () => {
    const account = accountGeneration.current;
    const version = refreshVersion.current + 1;
    refreshVersion.current = version;
    setIsLoading(true);
    setError(null);

    try {
      const response = await listSavedGyms();
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      setSavedGyms(response.data);
    } catch (requestError) {
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      setSavedGyms([]);
      setError(savedGymErrorMessage(requestError));
    } finally {
      if (account !== accountGeneration.current || version !== refreshVersion.current) return;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    accountGeneration.current += 1;
    refreshVersion.current += 1;
    actionErrorGuard.current.invalidate();
    if (authStatus === 'authenticated') {
      void refreshSavedGyms();
      return;
    }
    setSavedGyms([]);
    setError(null);
    setActionErrors({});
    setPendingGymIds([]);
    setIsLoading(authStatus === 'loading');
  }, [authStatus, refreshSavedGyms, user?.id]);

  const getActionError = useCallback((gymId: string) => actionErrors[gymId] ?? null, [actionErrors]);
  const dismissActionError = useCallback((gymId?: string) => {
    actionErrorGuard.current.invalidate(gymId);
    setActionErrors((current) => clearSavedGymActionError(current, gymId));
  }, []);

  const value = useMemo<SavedGymsContextValue>(() => {
    const savedGymIds = savedGyms.map((gym) => gym.id);

    return {
      savedGyms,
      savedGymIds,
      isLoading,
      error,
      getActionError,
      dismissActionError,
      pendingGymIds,
      isSavedGym: (gymId: string) => savedGymIds.includes(gymId),
      refreshSavedGyms,
      toggleSavedGym: async (gym: ApiGymSummary) => {
        if (pendingGymIds.includes(gym.id)) return;

        const wasSaved = savedGymIds.includes(gym.id);
        const account = accountGeneration.current;
        const errorScope = actionErrorGuard.current.begin(gym.id);
        refreshVersion.current += 1;
        setIsLoading(false);
        setActionErrors((current) => clearSavedGymActionError(current, gym.id));
        setPendingGymIds((current) => [...current, gym.id]);
        setSavedGyms((current) => wasSaved
          ? current.filter((item) => item.id !== gym.id)
          : [gym, ...current]);

        try {
          if (wasSaved) await unsaveGym(gym.id);
          else await saveGym(gym.id);
          if (account !== accountGeneration.current) return;
          refreshVersion.current += 1;
          setSavedGyms((current) => wasSaved
            ? current.filter((item) => item.id !== gym.id)
            : [gym, ...current.filter((item) => item.id !== gym.id)]);
          setActionErrors((current) => clearSavedGymActionError(current, gym.id));
        } catch (requestError) {
          if (account !== accountGeneration.current) return;
          setSavedGyms((current) => wasSaved
            ? [gym, ...current.filter((item) => item.id !== gym.id)]
            : current.filter((item) => item.id !== gym.id));
          const message = savedGymErrorMessage(requestError);
          if (actionErrorGuard.current.isCurrent(errorScope)) {
            setActionErrors((current) => setSavedGymActionError(current, {
              gymId: gym.id,
              action: wasSaved ? 'unsave' : 'save',
              message,
            }));
          }
          throw new Error(message);
        } finally {
          if (account === accountGeneration.current) {
            setPendingGymIds((current) => current.filter((id) => id !== gym.id));
          }
        }
      },
    };
  }, [dismissActionError, error, getActionError, isLoading, pendingGymIds, refreshSavedGyms, savedGyms]);

  return <SavedGymsContext.Provider value={value}>{children}</SavedGymsContext.Provider>;
}

export function useSavedGyms() {
  const context = useContext(SavedGymsContext);

  if (!context) throw new Error('useSavedGyms must be used within SavedGymsProvider');
  return context;
}
