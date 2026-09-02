import { z } from 'zod';

const settingSectorNameSchema = z.string().trim().min(1).max(80);
const expectedUpdatedAtSchema = z.string().datetime({ offset: true });

export const createOperationsGymSettingSectorSchema = z.object({
  name: settingSectorNameSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
}).strict();

export const updateOperationsGymSettingSectorSchema = z.object({
  name: settingSectorNameSchema,
  isActive: z.boolean(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
}).strict();

export const deleteOperationsGymSettingSectorSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
}).strict();

export type CreateOperationsGymSettingSectorInput = z.infer<typeof createOperationsGymSettingSectorSchema>;
export type UpdateOperationsGymSettingSectorInput = z.infer<typeof updateOperationsGymSettingSectorSchema>;
export type DeleteOperationsGymSettingSectorInput = z.infer<typeof deleteOperationsGymSettingSectorSchema>;
