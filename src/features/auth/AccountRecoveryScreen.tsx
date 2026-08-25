import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePasswordPolicy } from '../../lib/auth/password-policy';
import { isApiClientError } from '../../lib/api';
import { EmailVerificationControl } from './EmailVerificationControl';
import { maskEmail, normalizeVerificationEmail } from './email-verification';
import { PasswordRequirementList } from './PasswordRequirementList';
import { findAccount, resetPassword } from './api';

type Props = {
  mode: 'find-account' | 'reset-password';
};

export function AccountRecoveryScreen({ mode }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recoveredEmail, setRecoveredEmail] = useState<string | null>(null);
  const isFindAccount = mode === 'find-account';
  const normalizedEmail = normalizeVerificationEmail(email);
  const emailVerified = verifiedEmail === normalizedEmail && normalizedEmail.length > 0;

  function changeEmail(value: string) {
    setEmail(value);
    setVerifiedEmail(null);
    setEmailVerificationToken(null);
    setCompleted(false);
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!emailVerified || !emailVerificationToken) {
      setMessage('이메일 인증을 먼저 완료해주세요.');
      return;
    }

    if (!isFindAccount) {
      const passwordMessage = validatePasswordPolicy(password);
      if (passwordMessage) {
        setMessage(passwordMessage);
        return;
      }
      if (password !== passwordConfirmation) {
        setMessage('비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isFindAccount) {
        const result = await findAccount(displayName, emailVerificationToken);
        setRecoveredEmail(result.email);
      } else {
        await resetPassword(password, emailVerificationToken);
      }
      setCompleted(true);
    } catch (error) {
      setMessage(isApiClientError(error) ? error.message : '요청을 처리하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-[420px]">
        <Link to="/login" className="mb-5 inline-flex items-center gap-1 px-1 text-sm font-bold text-neutral-600 hover:text-neutral-950">
          <span aria-hidden="true">←</span> 로그인으로
        </Link>

        <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Account recovery</div>
          <h1 className="mt-3 text-[28px] font-black tracking-[-0.04em] text-neutral-950">
            {isFindAccount ? '가입 이메일 찾기' : '비밀번호 재설정'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            {isFindAccount
              ? 'TOPJUG는 이메일을 아이디로 사용합니다. 이름과 이메일 인증으로 가입 정보를 확인하세요.'
              : '가입 이메일 인증을 완료한 뒤 새로운 비밀번호를 설정하세요.'}
          </p>

          {completed ? (
            <div className="mt-7 space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <div className="text-2xl" aria-hidden="true">✓</div>
                <h2 className="mt-2 text-lg font-black text-emerald-900">
                  {isFindAccount ? '가입 이메일을 확인했어요' : '비밀번호를 재설정했어요'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-emerald-700">
                  {isFindAccount
                    ? `확인된 로그인 이메일: ${maskEmail(recoveredEmail ?? email)}`
                    : '새 비밀번호로 로그인해주세요.'}
                </p>
              </div>
              <Link to="/login" className="flex h-13 w-full items-center justify-center rounded-2xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700">
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-4">
              {isFindAccount && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-neutral-800">이름</span>
                  <input
                    required
                    maxLength={40}
                    autoComplete="name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="가입할 때 입력한 이름"
                  />
                </label>
              )}

              <div>
                <label htmlFor="recovery-email" className="mb-2 block text-sm font-bold text-neutral-800">가입 이메일</label>
                <input
                  id="recovery-email"
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => changeEmail(event.target.value)}
                  className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  placeholder="name@example.com"
                />
                <EmailVerificationControl
                  email={email}
                  purpose={isFindAccount ? 'find_account' : 'reset_password'}
                  verifiedEmail={verifiedEmail}
                  onVerified={(verified, token) => {
                    setVerifiedEmail(verified);
                    setEmailVerificationToken(token);
                  }}
                />
              </div>

              {!isFindAccount && emailVerified && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-neutral-800">새 비밀번호</span>
                    <input
                      required
                      type="password"
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-describedby="recovery-password-requirements"
                      className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="새 비밀번호"
                    />
                    <PasswordRequirementList id="recovery-password-requirements" password={password} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-neutral-800">새 비밀번호 확인</span>
                    <input
                      required
                      type="password"
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      autoComplete="new-password"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      placeholder="새 비밀번호를 다시 입력"
                    />
                  </label>
                </>
              )}

              {message && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{message}</div>}

              <button disabled={submitting} className="h-13 w-full rounded-2xl bg-blue-600 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-300">
                {submitting ? '처리 중...' : isFindAccount ? '가입 이메일 확인' : '새 비밀번호 설정'}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
