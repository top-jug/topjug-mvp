import { z } from 'zod';

export const createShareSchema = z.object({
  mediaAssetId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().refine((input) => !input.expiresAt || new Date(input.expiresAt) > new Date(), {
  message: '공유 만료 시각은 현재보다 이후여야 합니다.',
  path: ['expiresAt'],
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
