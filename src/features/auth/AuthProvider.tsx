import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../lib/api/error';
import { apiClient } from '../../lib/api/client';
import { getCurrentUser, LOGOUT_PENDING_KEY, login as loginRequest, logout as logoutRequest, register as registerRequest, restoreSession } from './api';
import { createSessionEventSynchronizer, isAuthenticatedSessionEvent, publishAuthenticatedSession } from './session-events';
import type { AuthStatus, AuthUser, LoginInput, RegisterInput } from './types';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: ApiClientError | null;
  isRestoringSession: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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
  const operation = useRef(0);

  async function initialize() {
    const currentOperation = ++operation.current;
    setIsRestoringSession(true);
    setStatus('loading');
    setError(null);
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
    });
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_PENDING_KEY && event.newValue === 'true') {
        operation.current += 1;
        apiClient.clearSession();
        setIsRestoringSession(false);
        setUser(null);
        setError(null);
        setStatus('unauthenticated');
      } else if (isAuthenticatedSessionEvent(event)) {
        operation.current += 1;
        apiClient.beginSessionRestoration();
        synchronizeSession();
      }
    };
    const synchronizeSession = createSessionEventSynchronizer(async () => {
      if (!active) return;
      await initialize();
    });
    window.addEventListener('storage', handleStorage);

    void initialize();
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  async function login(input: LoginInput) {
    const currentOperation = ++operation.current;
    setStatus('loading');
    setIsRestoringSession(false);
    setError(null);
    try {
      const currentUser = await loginRequest(input);
      if (currentOperation !== operation.current) {
        throw new ApiClientError('인증 요청이 취소되었습니다.', 401, 'AUTH_SESSION_CHANGED');
      }
      setUser(currentUser);
      setStatus('authenticated');
      publishAuthenticatedSession();
    } catch (nextError) {
      if (currentOperation === operation.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      throw nextError;
    }
  }

  async function register(input: RegisterInput) {
    const currentOperation = ++operation.current;
    setStatus('loading');
    setIsRestoringSession(false);
    setError(null);
    try {
      const currentUser = await registerRequest(input);
      if (currentOperation !== operation.current) {
        throw new ApiClientError('인증 요청이 취소되었습니다.', 401, 'AUTH_SESSION_CHANGED');
      }
      setUser(currentUser);
      setStatus('authenticated');
      publishAuthenticatedSession();
    } catch (nextError) {
      if (currentOperation === operation.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      throw nextError;
    }
  }

  async function logout() {
    operation.current += 1;
    setIsRestoringSession(false);
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
    try {
      await logoutRequest();
    } catch (nextError) {
      setError(asApiError(nextError));
      throw nextError;
    }
  }

  const refreshUser = useCallback(async () => {
    const currentOperation = operation.current;
    const currentUser = await getCurrentUser();
    if (currentOperation !== operation.current) return;
    setUser(currentUser);
    setError(null);
    setStatus('authenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, error, isRestoringSession, login, register, logout, refreshUser, retry: initialize }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
