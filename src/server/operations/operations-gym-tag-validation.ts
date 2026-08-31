import { z } from 'zod';

const tagCode = z.string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, '코드는 영문 소문자, 숫자, 하이픈, 밑줄만 사용할 수 있습니다.');

const nullableDescription = z.string().trim().max(200).nullable().transform((value) => value || null);

export const operationsGymTagFieldsSchema = z.object({
  code: tagCode,
  label: z.string().trim().min(1).max(40),
  description: nullableDescription,
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
}).strict();

export const createOperationsGymTagSchema = operationsGymTagFieldsSchema;

export const updateOperationsGymTagSchema = operationsGymTagFieldsSchema.safeExtend({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const deleteOperationsGymTagSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const replaceOperationsGymTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(50).refine(
    (tagIds) => new Set(tagIds).size === tagIds.length,
    '키워드를 중복해서 선택할 수 없습니다.',
  ),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export type CreateOperationsGymTagInput = z.infer<typeof createOperationsGymTagSchema>;
export type UpdateOperationsGymTagInput = z.infer<typeof updateOperationsGymTagSchema>;
export type DeleteOperationsGymTagInput = z.infer<typeof deleteOperationsGymTagSchema>;
export type ReplaceOperationsGymTagsInput = z.infer<typeof replaceOperationsGymTagsSchema>;
