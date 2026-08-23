import { z } from 'zod';
import { ApiError } from '../http/api-error';

const dateTimeSchema = z.string().datetime({ offset: true });

const recordCountSchema = z.object({
  gymGradeId: z.string().uuid(),
  sectorCode: z.string().trim().min(1).max(80).nullable().optional(),
  attempts: z.number().int().min(0),
  sends: z.number().int().min(0),
}).strict().refine((count) => count.sends <= count.attempts, {
  message: '완등 수는 시도 수보다 클 수 없습니다.',
  path: ['sends'],
});

export const createRecordSchema = z.object({
  gymId: z.string().uuid(),
  membershipId: z.string().uuid().nullable().optional(),
  startedAt: dateTimeSchema,
  endedAt: dateTimeSchema,
  rating: z.number().min(0.5).max(5).multipleOf(0.5).nullable().optional(),
  mode: z.enum(['easy', 'normal']),
  counts: z.array(recordCountSchema).max(200),
}).strict().superRefine((record, context) => {
  if (new Date(record.endedAt) < new Date(record.startedAt)) {
    context.addIssue({
      code: 'custom',
      message: '종료 시간은 시작 시간보다 빠를 수 없습니다.',
      path: ['endedAt'],
    });
  }

  const keys = record.counts.map((count) => `${count.gymGradeId}:${count.sectorCode ?? ''}`);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: 'custom',
      message: '같은 섹터와 난이도 기록을 중복해서 보낼 수 없습니다.',
      path: ['counts'],
    });
  }
});

export const listRecordsSchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  gymId: z.string().uuid().optional(),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export function parseInput<Output>(schema: z.ZodType<Output>, input: unknown): Output {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, 'INVALID_REQUEST', result.error.issues[0]?.message ?? '요청 형식이 올바르지 않습니다.');
  }

  return result.data;
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'JSON 요청 본문이 올바르지 않습니다.');
  }
}

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type ListRecordsInput = z.infer<typeof listRecordsSchema>;
