import { z } from 'zod';

const dateTimeSchema = z.string().datetime({ offset: true });
const statusSchema = z.enum(['scheduled', 'completed', 'cancelled']);
const titleSchema = z.string().trim().min(1).max(100);
const noteSchema = z.string().trim().max(1000).nullable().transform((value) => value || null);
const sectorIdsSchema = z.array(z.string().uuid()).min(1).max(50).refine(
  (sectorIds) => new Set(sectorIds).size === sectorIds.length,
  '대상 섹터를 중복해서 선택할 수 없습니다.',
);

function validateTimeRange(
  input: { startsAt?: string; endsAt?: string | null },
  context: z.RefinementCtx,
) {
  if (input.startsAt && input.endsAt && new Date(input.endsAt) < new Date(input.startsAt)) {
    context.addIssue({
      code: 'custom',
      message: '종료 시각은 시작 시각보다 빠를 수 없습니다.',
      path: ['endsAt'],
    });
  }
}

export const listOperationsSettingEventsSchema = z.object({
  from: dateTimeSchema,
  to: dateTimeSchema,
  gymId: z.string().uuid().optional(),
  status: statusSchema.optional(),
}).strict().superRefine((input, context) => {
  if (new Date(input.to) < new Date(input.from)) {
    context.addIssue({
      code: 'custom',
      message: '조회 종료 시각은 시작 시각보다 빠를 수 없습니다.',
      path: ['to'],
    });
  }
});

export const createOperationsSettingEventSchema = z.object({
  gymId: z.string().uuid(),
  title: titleSchema,
  startsAt: dateTimeSchema,
  endsAt: dateTimeSchema.nullable(),
  note: noteSchema,
  sectorIds: sectorIdsSchema,
}).strict().superRefine(validateTimeRange);

export const updateOperationsSettingEventSchema = z.object({
  title: titleSchema.optional(),
  status: statusSchema.optional(),
  startsAt: dateTimeSchema.optional(),
  endsAt: dateTimeSchema.nullable().optional(),
  note: noteSchema.optional(),
  sectorIds: sectorIdsSchema.optional(),
  expectedUpdatedAt: dateTimeSchema,
}).strict().superRefine((input, context) => {
  validateTimeRange(input, context);
  const changedFieldCount = Object.keys(input).filter((key) => key !== 'expectedUpdatedAt').length;
  if (changedFieldCount === 0) {
    context.addIssue({ code: 'custom', message: '변경할 세팅 일정 정보를 입력해주세요.' });
  }
});

export const deleteOperationsSettingEventSchema = z.object({
  expectedUpdatedAt: dateTimeSchema,
}).strict();

export type ListOperationsSettingEventsInput = z.infer<typeof listOperationsSettingEventsSchema>;
export type CreateOperationsSettingEventInput = z.infer<typeof createOperationsSettingEventSchema>;
export type UpdateOperationsSettingEventInput = z.infer<typeof updateOperationsSettingEventSchema>;
export type DeleteOperationsSettingEventInput = z.infer<typeof deleteOperationsSettingEventSchema>;
