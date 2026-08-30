import { type FormEvent, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { isApiClientError } from '../../lib/api';
import { useAuth } from './AuthProvider';
import { toRegisterInput, validateRegistrationPasswords } from './registration';
import { authenticatedLandingPath } from './auth-navigation';

type Props = {
  mode: 'login' | 'register';
};

export function AuthScreen({ mode }: Props) {
  const { status, user, isRestoringSession, login, register } = useAuth();
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
      <main className="min-h-screen bg-[#f4f7fb] px-5 flex items-center justify-center" aria-busy="true" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-[3px] border-blue-100 border-t-blue-600 animate-spin" aria-hidden="true" />
          <h1 className="mt-5 text-lg font-black tracking-[-0.03em] text-neutral-950">로그인 상태를 확인하고 있어요</h1>
          <p className="mt-2 text-sm text-neutral-500">잠시만 기다려주세요.</p>
        </div>
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

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">T</div>
          <div>
            <div className="text-lg font-black tracking-[-0.04em] text-neutral-950">TOPJUG</div>
            <div className="text-xs font-medium text-neutral-600">Climbing logbook</div>
          </div>
        </div>

        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{isLogin ? 'Welcome back' : 'Start climbing'}</div>
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
                  className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
                className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="name@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-neutral-800">비밀번호</span>
              <span className="relative block">
                <input
                  required
                  type={!isLogin && showPassword ? 'text' : 'password'}
                  minLength={isLogin ? 1 : 12}
                  maxLength={128}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 ${isLogin ? '' : 'pr-20'}`}
                  placeholder={isLogin ? '비밀번호' : '12자 이상 입력'}
                />
                {!isLogin && (
                  <button
                    type="button"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시하기'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-1 right-1 min-w-16 rounded-xl px-3 text-sm font-bold text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {showPassword ? '숨기기' : '보기'}
                  </button>
                )}
              </span>
            </label>

            {!isLogin && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-neutral-800">비밀번호 확인</span>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  aria-invalid={confirmationError}
                  aria-describedby={confirmationError ? 'password-confirmation-error' : undefined}
                  className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="비밀번호를 다시 입력"
                />
              </label>
            )}

            {message && <div id={confirmationError ? 'password-confirmation-error' : undefined} role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div>}

            <button disabled={submitting} className="h-13 w-full rounded-2xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300">
              {submitting ? '확인 중...' : isLogin ? '로그인' : '계정 만들기'}
            </button>
          </form>

          <div className="mt-6 border-t border-neutral-100 pt-5 text-center text-sm text-neutral-500">
            {isLogin ? '처음 오셨나요?' : '이미 계정이 있나요?'}{' '}
            <Link to={isLogin ? '/register' : '/login'} state={location.state} className="font-bold text-blue-600 hover:text-blue-700">
              {isLogin ? '회원가입' : '로그인'}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
