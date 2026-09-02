import { z } from 'zod';

export const operationsGymPhotoMutationSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export type OperationsGymPhotoMutationInput = z.infer<typeof operationsGymPhotoMutationSchema>;
