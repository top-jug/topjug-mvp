import { createContext, type PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../../lib/api/error';
import { apiClient } from '../../lib/api/client';
import { login as loginRequest, logout as logoutRequest, register as registerRequest, restoreSession } from './api';
import type { AuthStatus, AuthUser, LoginInput, RegisterInput } from './types';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: ApiClientError | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
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
  const operation = useRef(0);

  async function initialize() {
    const currentOperation = ++operation.current;
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
    }
  }

  useEffect(() => {
    let active = true;
    const unsubscribe = apiClient.subscribeUnauthorized(() => {
      if (!active) return;
      operation.current += 1;
      setUser(null);
      setError(null);
      setStatus('unauthenticated');
    });

    void initialize();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function login(input: LoginInput) {
    const currentOperation = ++operation.current;
    setStatus('loading');
    setError(null);
    try {
      const currentUser = await loginRequest(input);
      if (currentOperation !== operation.current) return;
      setUser(currentUser);
      setStatus('authenticated');
    } catch (nextError) {
      if (currentOperation !== operation.current) return;
      setUser(null);
      setStatus('unauthenticated');
      throw nextError;
    }
  }

  async function register(input: RegisterInput) {
    const currentOperation = ++operation.current;
    setStatus('loading');
    setError(null);
    try {
      const currentUser = await registerRequest(input);
      if (currentOperation !== operation.current) return;
      setUser(currentUser);
      setStatus('authenticated');
    } catch (nextError) {
      if (currentOperation !== operation.current) return;
      setUser(null);
      setStatus('unauthenticated');
      throw nextError;
    }
  }

  async function logout() {
    operation.current += 1;
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
    try {
      await logoutRequest();
    } catch {
      // Local auth remains cleared even when the best-effort server logout fails.
    }
  }

  return (
    <AuthContext.Provider value={{ status, user, error, login, register, logout, retry: initialize }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
