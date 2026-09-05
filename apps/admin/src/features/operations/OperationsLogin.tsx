import { type FormEvent, useState } from 'react';
import { LogIn, Mountain, ShieldAlert } from 'lucide-react';
import { Navigate } from 'react-router';
import { isApiClientError } from '@/src/lib/api';
import { useAuth } from '@/src/features/auth/AuthProvider';
import { passwordVisibilityControl } from '@/src/features/auth/auth-presentation';
import { publicAppUrl } from './public-app-url';

export function OperationsLogin() {
  const { status, user, error, isRestoringSession, login, logout, retry } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const passwordControl = passwordVisibilityControl(showPassword);

  if (status === 'authenticated' && user?.role === 'operations_admin') return <Navigate to="/ops" replace />;
  if (isRestoringSession) return <OperationsLoginState message="운영자 로그인 상태를 확인하고 있습니다." />;
  if (status === 'error') {
    return <OperationsLoginState message={error?.message ?? '로그인 상태를 확인하지 못했습니다.'} actionLabel="다시 확인" action={() => void retry()} />;
  }
  if (status === 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <section className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
          <h1 className="mt-5 text-xl font-black">운영 관리자 권한이 없습니다</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">현재 계정은 일반 사용자 계정입니다.</p>
          <button type="button" onClick={() => void logout()} className="mt-6 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-black text-white">다른 계정으로 로그인</button>
          <a href={publicAppUrl()} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-blue-700">사용자 앱으로 이동</a>
        </section>
      </main>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      await login({ email, password });
    } catch (nextError) {
      setMessage(isApiClientError(nextError) ? nextError.message : '로그인 요청을 처리하지 못했습니다.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white"><Mountain className="h-6 w-6" aria-hidden="true" /></span>
          <div><p className="font-black tracking-tight">TOPJUG</p><p className="text-xs font-bold text-slate-500">Operations Console</p></div>
        </div>
        <h1 className="mt-8 text-2xl font-black tracking-tight">운영자 로그인</h1>
        <p className="mt-2 text-sm text-slate-500">승인된 운영 관리자 계정으로 로그인하세요.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-bold text-slate-700">이메일<input required type="email" autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="block text-sm font-bold text-slate-700">비밀번호<span className="relative mt-2 block"><input required type={passwordControl.inputType} autoComplete="current-password" maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 px-4 pr-20 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /><button type="button" aria-label={passwordControl.accessibleName} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-1 right-1 min-w-16 rounded-lg text-sm font-bold text-blue-700">{passwordControl.visibleLabel}</button></span></label>
          {message && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</div>}
          <button disabled={status === 'loading'} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white disabled:opacity-50"><LogIn className="h-4 w-4" aria-hidden="true" />{status === 'loading' ? '확인 중…' : '로그인'}</button>
        </form>
        <a href={publicAppUrl()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center text-sm font-bold text-slate-500">TopJug 사용자 앱으로 이동</a>
      </section>
    </main>
  );
}

function OperationsLoginState({ message, actionLabel, action }: { message: string; actionLabel?: string; action?: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" /><p className="mt-4 text-sm font-bold text-slate-600">{message}</p>{action && <button type="button" onClick={action} className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">{actionLabel}</button>}</div></main>;
}
