import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../lib/api/error';
import { apiClient } from '../../lib/api/client';
import { getCurrentUser, hasPendingLogout, LOGOUT_PENDING_KEY, login as loginRequest, logout as logoutRequest, register as registerRequest, resetPassword as resetPasswordRequest, restoreSession } from './api';
import { canUseSessionStorage, createSessionReconciler, isSessionStateEvent, publishAuthenticatedSession, publishLoggedOutSession, readSessionStateEvent, shouldForceActivationReconciliation } from './session-events';
import { profileRefreshFailure } from './profile-refresh';
import type { AuthStatus, AuthUser, LoginInput, PasswordResetInput, RegisterInput } from './types';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: ApiClientError | null;
  isRestoringSession: boolean;
  isRefreshingUser: boolean;
  refreshUserError: ApiClientError | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  resetPassword: (input: PasswordResetInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function asApiError(error: unknown) {
  if (error instanceof ApiClientError) return error;
  return new ApiClientError('인증 상태를 확인하지 못했습니다.', 0, 'AUTH_INITIALIZATION_FAILED', null, null, { cause: error });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);
  const [refreshUserError, setRefreshUserError] = useState<ApiClientError | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const operation = useRef(0);
  const localSessionOperation = useRef(false);
  const sessionReconciler = useRef<ReturnType<typeof createSessionReconciler> | null>(null);
  const sessionEventSnapshot = useRef<string | null>(null);
  userRef.current = user;

  async function initialize() {
    const currentOperation = ++operation.current;
    setIsRestoringSession(true);
    setStatus('loading');
    setError(null);
    setIsRefreshingUser(false);
    setRefreshUserError(null);
    try {
      const currentUser = await restoreSession();
      if (currentOperation !== operation.current) return;
      setUser(currentUser);
      setStatus('authenticated');
    } catch (nextError) {
      if (currentOperation !== operation.current) return;
      setUser(null);
      const apiError = asApiError(nextError);
      if (apiError.status === 401) {
        setStatus('unauthenticated');
      } else {
        setError(apiError);
        setStatus('error');
      }
    } finally {
      if (currentOperation === operation.current) setIsRestoringSession(false);
    }
  }

  useEffect(() => {
    let active = true;
    const unsubscribe = apiClient.subscribeUnauthorized(() => {
      if (!active) return;
      operation.current += 1;
      setIsRestoringSession(false);
      setUser(null);
      setError(null);
      setStatus('unauthenticated');
      setIsRefreshingUser(false);
      setRefreshUserError(null);
    });
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_PENDING_KEY && event.newValue === 'true') {
        sessionReconciler.current?.markDirty();
      } else if (isSessionStateEvent(event)) {
        sessionEventSnapshot.current = event.newValue;
        sessionReconciler.current?.markDirty();
      }
    };
    const reconciler = createSessionReconciler(async () => {
      if (!active || localSessionOperation.current) return;
      apiClient.beginSessionRestoration();
      await initialize();
    }, () => active && document.visibilityState === 'visible' && !localSessionOperation.current);
    sessionReconciler.current = reconciler;
    const handleActivation = () => {
      if (document.visibilityState !== 'visible') return;
      if (hasPendingLogout()) reconciler.markDirty();
      const storageAvailable = canUseSessionStorage();
      if (storageAvailable) {
        const storedEvent = readSessionStateEvent();
        if (storedEvent !== sessionEventSnapshot.current) {
          sessionEventSnapshot.current = storedEvent;
          reconciler.markDirty();
        }
      } else if (shouldForceActivationReconciliation(storageAvailable, typeof navigator !== 'undefined' && Boolean(navigator.locks))) {
        reconciler.markDirty();
      }
      void reconciler.reconcileOnActivation();
    };
    sessionEventSnapshot.current = readSessionStateEvent();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleActivation);
    window.addEventListener('pageshow', handleActivation);
    document.addEventListener('visibilitychange', handleActivation);

    if (document.visibilityState !== 'visible') reconciler.markDirty();
    void reconciler.reconcileBootstrap();
    return () => {
      active = false;
      sessionReconciler.current = null;
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleActivation);
      window.removeEventListener('pageshow', handleActivation);
      document.removeEventListener('visibilitychange', handleActivation);
    };
  }, []);

  async function login(input: LoginInput) {
    const currentOperation = ++operation.current;
    localSessionOperation.current = true;
    setStatus('loading');
    setIsRestoringSession(false);
    setError(null);
    setIsRefreshingUser(false);
    setRefreshUserError(null);
    try {
      const currentUser = await loginRequest(input);
      if (currentOperation !== operation.current) {
        throw new ApiClientError('인증 요청이 취소되었습니다.', 401, 'AUTH_SESSION_CHANGED');
      }
      setUser(currentUser);
      setStatus('authenticated');
      sessionReconciler.current?.markClean();
      sessionEventSnapshot.current = publishAuthenticatedSession();
    } catch (nextError) {
      if (currentOperation === operation.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      throw nextError;
    } finally {
      localSessionOperation.current = false;
    }
  }

  async function register(input: RegisterInput) {
    const currentOperation = ++operation.current;
    localSessionOperation.current = true;
    setStatus('loading');
    setIsRestoringSession(false);
    setError(null);
    setIsRefreshingUser(false);
    setRefreshUserError(null);
    try {
      const currentUser = await registerRequest(input);
      if (currentOperation !== operation.current) {
        throw new ApiClientError('인증 요청이 취소되었습니다.', 401, 'AUTH_SESSION_CHANGED');
      }
      setUser(currentUser);
      setStatus('authenticated');
      sessionReconciler.current?.markClean();
      sessionEventSnapshot.current = publishAuthenticatedSession();
    } catch (nextError) {
      if (currentOperation === operation.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      throw nextError;
    } finally {
      localSessionOperation.current = false;
    }
  }

  async function logout() {
    operation.current += 1;
    localSessionOperation.current = true;
    setIsRestoringSession(false);
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
    setIsRefreshingUser(false);
    setRefreshUserError(null);
    try {
      await logoutRequest();
      sessionReconciler.current?.markClean();
      sessionEventSnapshot.current = publishLoggedOutSession();
    } catch (nextError) {
      setError(asApiError(nextError));
      throw nextError;
    } finally {
      localSessionOperation.current = false;
    }
  }

  async function resetPassword(input: PasswordResetInput) {
    const currentOperation = ++operation.current;
    localSessionOperation.current = true;
    setError(null);
    try {
      await resetPasswordRequest(input);
      if (currentOperation !== operation.current) {
        throw new ApiClientError('인증 요청이 취소되었습니다.', 401, 'AUTH_SESSION_CHANGED');
      }
      setUser(null);
      setStatus('unauthenticated');
      setIsRestoringSession(false);
      setIsRefreshingUser(false);
      setRefreshUserError(null);
      sessionReconciler.current?.markClean();
      sessionEventSnapshot.current = publishLoggedOutSession();
    } finally {
      localSessionOperation.current = false;
    }
  }

  const refreshUser = useCallback(async () => {
    const currentOperation = ++operation.current;
    setIsRefreshingUser(true);
    setRefreshUserError(null);
    try {
      const currentUser = await getCurrentUser();
      if (currentOperation !== operation.current) return;
      setUser(currentUser);
      setError(null);
      setStatus('authenticated');
    } catch (nextError) {
      if (currentOperation !== operation.current) throw nextError;
      const apiError = asApiError(nextError);
      const failure = profileRefreshFailure(userRef.current, apiError);
      setUser(failure.user);
      setStatus(failure.status);
      setRefreshUserError(failure.error);
      throw nextError;
    } finally {
      if (currentOperation === operation.current) setIsRefreshingUser(false);
    }
  }, []);

  async function retry() {
    if (sessionReconciler.current) await sessionReconciler.current.forceReconciliation();
    else await initialize();
  }

  return (
    <AuthContext.Provider value={{ status, user, error, isRestoringSession, isRefreshingUser, refreshUserError, login, register, resetPassword, logout, refreshUser, retry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
