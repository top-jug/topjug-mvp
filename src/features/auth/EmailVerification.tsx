import { useEffect, useState } from 'react';
import { confirmEmailVerification, requestEmailVerification } from './api';
import type { EmailVerificationPurpose } from './types';
import { formatRemainingTime, remainingSeconds, verificationErrorMessage } from './verification';

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
  purpose: EmailVerificationPurpose;
  onVerified: (token: string, expiresAt: number) => void;
  onVerificationCleared: () => void;
};

export function EmailVerification({ email, onEmailChange, purpose, onVerified, onVerificationCleared }: Props) {
  const [code, setCode] = useState('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [busy, setBusy] = useState<'request' | 'confirm' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const codeRemaining = remainingSeconds(codeExpiresAt, now);
  const tokenRemaining = remainingSeconds(tokenExpiresAt, now);
  const verified = tokenExpiresAt !== null && tokenRemaining > 0;
  const requested = codeExpiresAt !== null;

  useEffect(() => {
    if (!codeExpiresAt && !tokenExpiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [codeExpiresAt, tokenExpiresAt]);

  useEffect(() => {
    if (tokenExpiresAt && tokenRemaining === 0) {
      setTokenExpiresAt(null);
      onVerificationCleared();
      setMessage('이메일 인증이 만료되었습니다. 인증번호를 다시 요청해주세요.');
    }
  }, [onVerificationCleared, tokenExpiresAt, tokenRemaining]);

  useEffect(() => {
    if (codeExpiresAt && codeRemaining === 0 && !verified) {
      setMessage('인증번호가 만료되었습니다. 새 인증번호를 요청해주세요.');
    }
  }, [codeExpiresAt, codeRemaining, verified]);

  async function requestCode() {
    setBusy('request');
    setMessage(null);
    onVerificationCleared();
    setCode('');
    setCodeExpiresAt(null);
    setTokenExpiresAt(null);
    try {
      const result = await requestEmailVerification(email, purpose);
      const requestedAt = Date.now();
      setNow(requestedAt);
      setCodeExpiresAt(requestedAt + result.expiresIn * 1_000);
      setMessage('인증번호를 보냈습니다. 이메일에서 6자리 번호를 확인해주세요.');
    } catch (error) {
      setMessage(verificationErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function confirmCode() {
    if (codeRemaining === 0) {
      setMessage('인증번호가 만료되었습니다. 새 인증번호를 요청해주세요.');
      return;
    }
    setBusy('confirm');
    setMessage(null);
    try {
      const result = await confirmEmailVerification(email, purpose, code);
      const confirmedAt = Date.now();
      const expiresAt = confirmedAt + result.expiresIn * 1_000;
      setNow(confirmedAt);
      setTokenExpiresAt(expiresAt);
      onVerified(result.verificationToken, expiresAt);
    } catch (error) {
      setMessage(verificationErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function changeEmail() {
    setCode('');
    setCodeExpiresAt(null);
    setTokenExpiresAt(null);
    setMessage(null);
    onVerificationCleared();
  }

  return (
    <fieldset className="space-y-3" disabled={busy !== null}>
      <legend className="sr-only">이메일 인증</legend>
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-neutral-800">이메일</span>
        <span className="flex gap-2">
          <input required type="email" maxLength={254} autoComplete="email" value={email} disabled={requested}
            onChange={(event) => onEmailChange(event.target.value)}
            className="h-13 min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:text-neutral-600"
            placeholder="name@example.com" />
          {!requested && <button type="button" onClick={() => void requestCode()} disabled={!email || busy !== null} className="h-13 shrink-0 rounded-2xl bg-neutral-950 px-4 text-sm font-bold text-white disabled:bg-neutral-300">인증 요청</button>}
          {requested && <button type="button" onClick={changeEmail} className="h-13 shrink-0 rounded-2xl border border-neutral-200 px-4 text-sm font-bold text-neutral-700">변경</button>}
        </span>
      </label>

      {requested && !verified && (
        <div>
          <label className="block text-sm font-bold text-neutral-800" htmlFor={`${purpose}-verification-code`}>인증번호</label>
          <div className="mt-2 flex gap-2">
            <span className="relative min-w-0 flex-1">
              <input id={`${purpose}-verification-code`} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-13 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-14 text-base tracking-[0.2em] text-neutral-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="000000" />
              <span className={`absolute inset-y-0 right-3 flex items-center text-xs font-bold ${codeRemaining ? 'text-blue-600' : 'text-red-600'}`}>{formatRemainingTime(codeRemaining)}</span>
            </span>
            <button type="button" onClick={() => void confirmCode()} disabled={code.length !== 6 || busy !== null || codeRemaining === 0} className="h-13 shrink-0 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white disabled:bg-blue-300">확인</button>
          </div>
          <button type="button" onClick={() => void requestCode()} disabled={busy !== null} className="mt-2 text-sm font-bold text-blue-600">인증번호 다시 보내기</button>
        </div>
      )}

      {verified && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">이메일 인증 완료 · {formatRemainingTime(tokenRemaining)} 동안 유효</div>}
      {message && <div role="status" aria-live="polite" className={`rounded-2xl border px-4 py-3 text-sm font-medium ${verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{message}</div>}
    </fieldset>
  );
}
