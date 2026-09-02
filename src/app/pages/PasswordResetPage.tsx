import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { isApiClientError } from '../../lib/api';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../lib/auth/password-policy';
import { useAuth } from '../../features/auth/AuthProvider';
import { EmailVerification } from '../../features/auth/EmailVerification';
import { authNavigationState } from '../../features/auth/navigation';
import { PasswordRequirements } from '../../features/auth/PasswordRequirements';
import { validateMatchingPasswords } from '../../features/auth/registration';

export default function PasswordResetPage() {
  const { resetPassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const validationMessage = validateMatchingPasswords(password, passwordConfirmation);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    if (!verificationToken) {
      setMessage('이메일 인증을 완료해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ password, emailVerificationToken: verificationToken });
      navigate('/login', { replace: true, state: { ...authNavigationState(location.state), resetComplete: true } });
    } catch (error) {
      setMessage(isApiClientError(error) ? error.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">T</div>
          <div><div className="text-lg font-black tracking-[-0.04em] text-neutral-950">TOPJUG</div><div className="text-xs font-medium text-neutral-600">Climbing logbook</div></div>
        </div>
        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Account recovery</div>
          <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-neutral-950">비밀번호 재설정</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">이메일을 인증한 뒤 새 비밀번호를 설정합니다.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <EmailVerification email={email} onEmailChange={setEmail} purpose="reset_password"
              onVerified={(token) => setVerificationToken(token)} onVerificationCleared={() => setVerificationToken('')} />

            {verificationToken && (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-neutral-800">새 비밀번호</span>
                  <span className="relative block">
                    <input required type={showPassword ? 'text' : 'password'} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password"
                      value={password} onChange={(event) => setPassword(event.target.value)}
                      className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-20 text-base text-neutral-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                    <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시하기'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-1 right-1 min-w-16 rounded-xl px-3 text-sm font-bold text-blue-600 hover:bg-blue-50">{showPassword ? '숨기기' : '보기'}</button>
                  </span>
                  <PasswordRequirements password={password} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-neutral-800">새 비밀번호 확인</span>
                  <input required type={showPassword ? 'text' : 'password'} minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password"
                    value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                </label>
              </>
            )}

            {message && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div>}
            <button disabled={!verificationToken || submitting} className="h-13 w-full rounded-2xl bg-blue-600 text-base font-bold text-white hover:bg-blue-700 disabled:bg-blue-300">
              {submitting ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
          <div className="mt-6 border-t border-neutral-100 pt-5 text-center text-sm text-neutral-500">
            비밀번호가 기억났나요? <Link to="/login" state={authNavigationState(location.state)} className="font-bold text-blue-600">로그인</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
