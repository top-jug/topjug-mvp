import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { ApiClientError } from '../../lib/api/error';
import { verifyOperationsSession } from './api';
import { operationsAccessDecision } from './operations-access';

type VerificationState = 'idle' | 'checking' | 'allowed' | 'forbidden' | 'error';

function LoadingState({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6" aria-busy="true">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
        <p className="mt-4 text-sm font-medium text-slate-600">{message}</p>
      </div>
    </main>
  );
}

function StateCard({ title, description, retry }: { title: string; description: string; retry?: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert aria-hidden="true" className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        {retry ? (
          <button type="button" onClick={retry} className="mt-6 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            다시 확인
          </button>
        ) : (
          <Link to="/" className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            사용자 화면으로 돌아가기
          </Link>
        )}
      </section>
    </main>
  );
}

export function RequireOperationsAdmin() {
  const { status, user, error, retry } = useAuth();
  const location = useLocation();
  const decision = operationsAccessDecision(status, user?.role ?? null);
  const [verification, setVerification] = useState<VerificationState>('idle');

  const verify = useCallback(() => {
    const controller = new AbortController();
    setVerification('checking');
    void verifyOperationsSession(controller.signal)
      .then(() => setVerification('allowed'))
      .catch((nextError: unknown) => {
        if (controller.signal.aborted) return;
        setVerification(nextError instanceof ApiClientError && nextError.status === 403 ? 'forbidden' : 'error');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (decision !== 'verify') {
      setVerification('idle');
      return;
    }
    return verify();
  }, [decision, user?.id, verify]);

  if (decision === 'loading') return <LoadingState message="로그인 상태를 확인하고 있어요." />;
  if (decision === 'auth-error') {
    return <StateCard title="로그인 상태를 확인하지 못했어요" description={error?.message ?? '잠시 후 다시 시도해주세요.'} retry={() => void retry()} />;
  }
  if (decision === 'login') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  if (decision === 'forbidden' || verification === 'forbidden') {
    return <StateCard title="운영 관리자 전용 화면입니다" description="현재 계정에는 운영 콘솔 접근 권한이 없습니다." />;
  }
  if (verification === 'error') {
    return <StateCard title="운영 권한을 확인하지 못했어요" description="서버 연결을 확인한 뒤 다시 시도해주세요." retry={() => verify()} />;
  }
  if (verification !== 'allowed') return <LoadingState message="운영 관리자 권한을 확인하고 있어요." />;

  return <Outlet />;
}
