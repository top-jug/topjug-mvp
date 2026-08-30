import { type FormEvent, useState } from 'react';
import { CalendarDays, MapPinned } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';
import { BrandIcon, BrandLockup } from '../../app/components/brand/BrandLogo';
import { isApiClientError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { passwordVisibilityControl } from './auth-presentation';
import { toRegisterInput, validateRegistrationPasswords } from './registration';
import { authenticatedLandingPath } from './auth-navigation';

type Props = {
  mode: 'login' | 'register';
};

export function AuthScreen({ mode }: Props) {
  const { status, user, error, isRestoringSession, login, register, retry } = useAuth();
  const location = useLocation();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submitting = status === 'loading';

  if (status === 'authenticated' && user) return <Navigate to={authenticatedLandingPath(location.state, user.role)} replace />;
  if (isRestoringSession) {
    return (
      <main className="mobile-screen flex items-center justify-center bg-[#f3faf8] px-5" aria-busy="true" aria-live="polite">
        <div className="text-center">
          <BrandIcon className="mx-auto h-16 w-16 rounded-[20px]" />
          <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" aria-hidden="true" />
          <h1 className="mt-5 text-lg font-black tracking-[-0.03em] text-neutral-950">로그인 상태를 확인하고 있어요</h1>
          <p className="mt-2 text-sm text-neutral-500">잠시만 기다려주세요.</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="mobile-screen flex items-center justify-center bg-[#f3faf8] px-5">
        <section className="w-full max-w-sm rounded-[28px] border border-teal-100 bg-white p-7 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <BrandIcon className="mx-auto h-16 w-16 rounded-[20px]" />
          <h1 className="mt-5 text-xl font-black tracking-[-0.03em] text-neutral-950">로그인 상태를 확인하지 못했어요</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">{error?.message ?? '네트워크 연결을 확인하고 다시 시도해주세요.'}</p>
          <button type="button" onClick={() => void retry()} className="mt-6 h-12 w-full rounded-2xl bg-teal-700 text-sm font-bold text-white hover:bg-teal-800">다시 시도</button>
          <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-neutral-500">처음으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (mode === 'register') {
      const validationMessage = validateRegistrationPasswords(password, passwordConfirmation);
      if (validationMessage) {
        setMessage(validationMessage);
        return;
      }
    }

    try {
      if (mode === 'login') await login({ email, password });
      else await register(toRegisterInput({ displayName, email, password, passwordConfirmation }));
    } catch (error) {
      setMessage(isApiClientError(error) ? error.message : '요청을 처리하지 못했습니다.');
    }
  }

  const isLogin = mode === 'login';
  const confirmationError = !isLogin && message === '비밀번호가 일치하지 않습니다.';
  const passwordControl = passwordVisibilityControl(showPassword);

  return (
    <main className="mobile-screen flex items-center justify-center bg-[#f3faf8] px-5 py-8 sm:px-8 sm:py-12">
      <div className="grid w-full max-w-[980px] overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_28px_80px_rgba(15,118,110,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative hidden overflow-hidden bg-neutral-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-teal-500/25 blur-3xl" aria-hidden="true" />
          <Link to="/" className="relative inline-flex">
            <BrandLockup inverted />
          </Link>
          <div className="relative my-16">
            <p className="text-xs font-bold tracking-[0.16em] text-teal-400">KEEP CLIMBING</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.05em]">다음 완등까지,<br />기록은 이어집니다.</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">암장과 세팅을 찾고 매번의 도전을 나만의 로그북에 쌓아보세요.</p>
          </div>
          <div className="relative grid grid-cols-2 gap-2 text-xs font-semibold text-neutral-300">
            <Link to="/gyms" className="flex min-h-12 items-center gap-2 rounded-xl bg-white/5 px-3 hover:bg-white/10"><MapPinned size={17} className="text-teal-400" /> 암장 탐색</Link>
            <Link to="/schedule/settings" className="flex min-h-12 items-center gap-2 rounded-xl bg-white/5 px-3 hover:bg-white/10"><CalendarDays size={17} className="text-teal-400" /> 세팅 일정</Link>
          </div>
        </aside>

        <div className="p-5 sm:p-9 lg:p-12">
          <Link to="/" className="mb-8 inline-flex lg:hidden"><BrandLockup /></Link>

          <section>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{isLogin ? 'Welcome back' : 'Start climbing'}</div>
            <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-neutral-950">{isLogin ? '다시 만나서 반가워요' : '나만의 기록을 시작하세요'}</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-500">{isLogin ? '회원권과 클라이밍 기록을 이어서 관리합니다.' : '암장과 루트, 완등 기록을 한곳에서 관리합니다.'}</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {!isLogin && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-800">이름</span>
                <input
                  required
                  maxLength={40}
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  placeholder="표시할 이름"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-neutral-800">이메일</span>
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                placeholder="name@example.com"
              />
            </label>
            <div>
              <label htmlFor="auth-password" className="mb-2 block text-sm font-bold text-neutral-800">비밀번호</label>
              <span className="relative block">
                <input
                  id="auth-password"
                  required
                  type={passwordControl.inputType}
                  minLength={isLogin ? 1 : 12}
                  maxLength={128}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-20 text-base text-neutral-950 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  placeholder={isLogin ? '비밀번호' : '12자 이상 입력'}
                />
                <button
                  type="button"
                  aria-label={passwordControl.accessibleName}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-1 right-1 min-w-16 rounded-xl px-3 text-sm font-bold text-teal-700 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  {passwordControl.visibleLabel}
                </button>
              </span>
            </div>

            {!isLogin && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-800">비밀번호 확인</span>
                <input
                  required
                  type={passwordControl.inputType}
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  aria-invalid={confirmationError}
                  aria-describedby={confirmationError ? 'password-confirmation-error' : undefined}
                  className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  placeholder="비밀번호를 다시 입력"
                />
              </label>
            )}

            {message && <div id={confirmationError ? 'password-confirmation-error' : undefined} role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div>}

            <button disabled={submitting} className="h-13 w-full rounded-2xl bg-teal-700 text-base font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:bg-neutral-500">
              {submitting ? '확인 중...' : isLogin ? '로그인' : '계정 만들기'}
            </button>
          </form>

          <div className="mt-6 border-t border-neutral-100 pt-5 text-center text-sm text-neutral-500">
            {isLogin ? '처음 오셨나요?' : '이미 계정이 있나요?'}{' '}
            <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-bold text-teal-700 hover:text-teal-800">
              {isLogin ? '회원가입' : '로그인'}
            </Link>
          </div>
          </section>
        </div>
      </div>
    </main>
  );
}
