import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const { status, error, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-6" aria-busy="true">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-[3px] border-neutral-200 border-t-blue-600 animate-spin" />
          <p className="mt-4 text-sm font-medium text-neutral-600">로그인 상태를 확인하고 있어요.</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-6">
        <section className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-7 text-center shadow-sm">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Connection error</div>
          <h1 className="mt-3 text-xl font-bold text-neutral-950">로그인 상태를 확인하지 못했어요</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{error?.message ?? '잠시 후 다시 시도해주세요.'}</p>
          <button type="button" onClick={() => void retry()} className="mt-6 h-12 w-full rounded-2xl bg-neutral-950 text-sm font-bold text-white">
            다시 시도
          </button>
        </section>
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
