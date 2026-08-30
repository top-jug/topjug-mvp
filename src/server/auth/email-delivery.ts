import 'server-only';

import { appendFile, chmod, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { EmailVerificationPurpose } from '../db/schema';
import { ApiError } from '../http/api-error';

export interface EmailChallengeMessage {
  to: string;
  purpose: EmailVerificationPurpose;
  code: string;
}

export type EmailChallengeDelivery = (message: EmailChallengeMessage) => Promise<void>;

function emailCopy(purpose: EmailVerificationPurpose, code: string) {
  const title = purpose === 'register' ? '회원가입 이메일 인증' : '비밀번호 재설정';
  return {
    subject: `[TOPJUG] ${title} 인증번호`,
    body: `${title} 인증번호는 ${code}입니다.\n\n인증번호는 10분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해주세요.`,
  };
}

function getDeliveryMode() {
  const mode = process.env.EMAIL_DELIVERY_MODE;
  if (mode !== 'ses' && mode !== 'file') {
    throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', '이메일 발송 설정이 필요합니다.');
  }
  if (mode === 'file' && !['local', 'test'].includes(process.env.APP_PROFILE ?? '')) {
    throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', '파일 이메일 발송은 로컬 및 테스트 환경에서만 사용할 수 있습니다.');
  }
  return mode;
}

let sesClient: SESv2Client | undefined;

async function deliverWithSes(message: EmailChallengeMessage) {
  const fromEmailAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromEmailAddress) throw new ApiError(503, 'EMAIL_NOT_CONFIGURED', '이메일 발송 설정이 필요합니다.');
  const copy = emailCopy(message.purpose, message.code);
  sesClient ??= new SESv2Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
  await sesClient.send(new SendEmailCommand({
    FromEmailAddress: fromEmailAddress,
    Destination: { ToAddresses: [message.to] },
    Content: {
      Simple: {
        Subject: { Data: copy.subject, Charset: 'UTF-8' },
        Body: { Text: { Data: copy.body, Charset: 'UTF-8' } },
      },
    },
  }));
}

async function deliverToFile(message: EmailChallengeMessage) {
  const sinkPath = join(process.cwd(), '.topjug', 'mail-sink.jsonl');
  await mkdir(dirname(sinkPath), { recursive: true, mode: 0o700 });
  await appendFile(sinkPath, `${JSON.stringify({ ...message, createdAt: new Date().toISOString() })}\n`, { mode: 0o600 });
  await chmod(sinkPath, 0o600);
}

export const deliverEmailChallenge: EmailChallengeDelivery = async (message) => {
  if (getDeliveryMode() === 'ses') await deliverWithSes(message);
  else await deliverToFile(message);
};

export function assertEmailDeliveryConfigured() {
  const mode = getDeliveryMode();
  if (mode === 'ses' && !process.env.EMAIL_FROM_ADDRESS) {
    throw new ApiError(503, 'SERVICE_NOT_READY', '이메일 발송 설정이 준비되지 않았습니다.');
  }
}
