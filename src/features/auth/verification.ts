import { isApiClientError } from '../../lib/api';

export function verificationErrorMessage(error: unknown) {
  if (!isApiClientError(error)) return '요청을 처리하지 못했습니다.';
  if (error.status === 429) {
    const seconds = Number.parseInt(error.retryAfter ?? '', 10);
    return Number.isFinite(seconds) && seconds > 0
      ? `요청이 너무 많습니다. ${seconds}초 후 다시 시도해주세요.`
      : '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }
  if (error.code === 'EMAIL_DELIVERY_FAILED') return '인증 이메일을 보낼 수 없습니다. 잠시 후 다시 시도해주세요.';
  if (error.code === 'INVALID_EMAIL_VERIFICATION') return '인증번호가 올바르지 않거나 만료되었습니다. 다시 요청해주세요.';
  return error.message;
}

export function remainingSeconds(expiresAt: number | null, now = Date.now()) {
  return expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1_000)) : 0;
}

export function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
