import { useState } from 'react';
import { isApiClientError } from '../../lib/api';
import { confirmEmailVerification, requestEmailVerification } from './api';
import { isValidVerificationEmail, normalizeVerificationEmail } from './email-verification';
import type { EmailVerificationPurpose } from './types';

type Props = {
  email: string;
  purpose: EmailVerificationPurpose;
  verifiedEmail: string | null;
  onVerified: (email: string, verificationToken: string) => void;
};

export function EmailVerificationControl({ email, purpose, verifiedEmail, onVerified }: Props) {
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'send' | 'confirm' | null>(null);
  const normalizedEmail = normalizeVerificationEmail(email);
  const isVerified = verifiedEmail === normalizedEmail && normalizedEmail.length > 0;
  const codeSent = sentEmail === normalizedEmail && normalizedEmail.length > 0;

  async function sendCode() {
    if (!isValidVerificationEmail(email)) {
      setMessage('인증번호를 받을 올바른 이메일을 입력해주세요.');
      return;
    }

    setPendingAction('send');
    setMessage(null);
    try {
      await requestEmailVerification(normalizedEmail, purpose);
      setSentEmail(normalizedEmail);
      setCode('');
      setMessage('인증번호를 이메일로 전송했습니다.');
    } catch (error) {
      setMessage(isApiClientError(error) ? error.message : '인증번호를 전송하지 못했습니다.');
    } finally {
      setPendingAction(null);
    }
  }

  async function verifyCode() {
    if (!codeSent) {
      setMessage('현재 이메일로 인증번호를 먼저 받아주세요.');
      return;
    }
    setPendingAction('confirm');
    setMessage(null);
    try {
      const result = await confirmEmailVerification(normalizedEmail, purpose, code);
      onVerified(normalizedEmail, result.verificationToken);
    } catch (error) {
      setMessage(isApiClientError(error) ? error.message : '인증번호를 확인하지 못했습니다.');
    } finally {
      setPendingAction(null);
    }
  }

  if (isVerified) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700" role="status">
        <span aria-hidden="true">✓</span>
        이메일 인증이 완료되었습니다.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={sendCode}
        disabled={pendingAction !== null}
        className="h-11 w-full rounded-2xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
      >
        {pendingAction === 'send' ? '전송 중...' : codeSent ? '인증번호 다시 받기' : '이메일 인증번호 받기'}
      </button>

      {codeSent && (
        <div className="flex gap-2">
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            className="h-11 min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-center text-base font-bold tracking-[0.2em] text-neutral-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            placeholder="인증번호 6자리"
            aria-label="이메일 인증번호"
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={pendingAction !== null || code.length !== 6}
            className="h-11 shrink-0 rounded-2xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction === 'confirm' ? '확인 중...' : '인증 확인'}
          </button>
        </div>
      )}

      {message && <p className="text-xs font-medium text-blue-700" role="status">{message}</p>}
    </div>
  );
}
