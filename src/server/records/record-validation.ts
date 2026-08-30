import { z } from 'zod';
import { ApiError } from '../http/api-error';

const dateTimeSchema = z.string().datetime({ offset: true });
const MAX_JSON_BODY_BYTES = 64 * 1024;

export const recordCountSchema = z.object({
  gymGradeId: z.string().uuid(),
  gymSectorId: z.string().uuid(),
  attempts: z.number().int().min(0),
  sends: z.number().int().min(0),
}).strict().refine((count) => count.sends <= count.attempts, {
  message: '완등 수는 시도 수보다 클 수 없습니다.',
  path: ['sends'],
});

export const createRecordSchema = z.object({
  gymId: z.string().uuid(),
  accessType: z.enum(['day_pass', 'membership', 'other']),
  membershipId: z.string().uuid().nullable().optional(),
  startedAt: dateTimeSchema,
  endedAt: dateTimeSchema,
  activeDurationSeconds: z.number().int().min(0).optional(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
  mode: z.enum(['easy', 'normal']),
  sessionType: z.enum(['free', 'training', 'project']).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  counts: z.array(recordCountSchema).max(200),
}).strict().superRefine((record, context) => {
  if (new Date(record.endedAt) < new Date(record.startedAt)) {
    context.addIssue({
      code: 'custom',
      message: '종료 시간은 시작 시간보다 빠를 수 없습니다.',
      path: ['endedAt'],
    });
  }

  if ((record.accessType === 'membership') !== Boolean(record.membershipId)) {
    context.addIssue({
      code: 'custom',
      message: '회원권 이용 기록은 membershipId가 필요하며 다른 이용 유형에는 지정할 수 없습니다.',
      path: ['membershipId'],
    });
  }

  const elapsedSeconds = Math.floor((new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()) / 1000);
  if (record.activeDurationSeconds !== undefined && record.activeDurationSeconds > elapsedSeconds) {
    context.addIssue({
      code: 'custom',
      message: '활동 시간은 전체 기록 시간보다 길 수 없습니다.',
      path: ['activeDurationSeconds'],
    });
  }

  const keys = record.counts.map((count) => `${count.gymGradeId}:${count.gymSectorId}`);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: 'custom',
      message: '같은 섹터와 난이도 기록을 중복해서 보낼 수 없습니다.',
      path: ['counts'],
    });
  }
}).transform(({ sessionType: _legacySessionType, ...record }) => record);

export const listRecordsSchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  gymId: z.string().uuid().optional(),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

const accessFields = {
  gymId: z.string().uuid(),
  accessType: z.enum(['day_pass', 'membership', 'other']),
  membershipId: z.string().uuid().nullable().optional(),
};

export const startRecordSessionSchema = z.object({
  ...accessFields,
  startedAt: dateTimeSchema,
  mode: z.enum(['easy', 'normal']),
  sessionType: z.enum(['free', 'training', 'project']).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
}).strict().superRefine((record, context) => {
  if ((record.accessType === 'membership') !== Boolean(record.membershipId)) {
    context.addIssue({ code: 'custom', message: '회원권 이용 기록의 membershipId를 확인해주세요.', path: ['membershipId'] });
  }
}).transform(({ sessionType: _legacySessionType, ...record }) => record);

export const recordTransitionSchema = z.object({
  at: dateTimeSchema.optional(),
}).strict();

export const completeRecordSessionSchema = z.object({
  endedAt: dateTimeSchema,
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  counts: z.array(recordCountSchema).max(200),
}).strict().superRefine((record, context) => {
  const keys = record.counts.map((count) => `${count.gymGradeId}:${count.gymSectorId}`);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: 'custom', message: '같은 섹터와 난이도 기록을 중복해서 보낼 수 없습니다.', path: ['counts'] });
  }
});

export const recordSessionCountsSchema = z.object({
  counts: z.array(recordCountSchema).max(200),
}).strict().superRefine((record, context) => {
  const keys = record.counts.map((count) => `${count.gymGradeId}:${count.gymSectorId}`);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: 'custom', message: '같은 섹터와 난이도 기록을 중복해서 보낼 수 없습니다.', path: ['counts'] });
  }
});

export function parseInput<Output>(schema: z.ZodType<Output>, input: unknown): Output {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, 'INVALID_REQUEST', result.error.issues[0]?.message ?? '요청 형식이 올바르지 않습니다.');
  }

  return result.data;
}

export async function readJson(request: Request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'REQUEST_TOO_LARGE', '요청 본문이 너무 큽니다.');
  }

  try {
    if (!request.body) throw new Error('Missing body');
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let body = '';
    let bytesRead = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_JSON_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'REQUEST_TOO_LARGE', '요청 본문이 너무 큽니다.');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'INVALID_JSON', 'JSON 요청 본문이 올바르지 않습니다.');
  }
}

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type ListRecordsInput = z.infer<typeof listRecordsSchema>;
export type StartRecordSessionInput = z.infer<typeof startRecordSessionSchema>;
export type CompleteRecordSessionInput = z.infer<typeof completeRecordSessionSchema>;
export type RecordSessionCountsInput = z.infer<typeof recordSessionCountsSchema>;
