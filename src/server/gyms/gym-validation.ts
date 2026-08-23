import { z } from 'zod';

export const listGymsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  regionCode: z.string().trim().max(40).optional(),
  facility: z.string().trim().max(40).optional(),
  tag: z.string().trim().max(40).optional(),
  operationStatus: z.enum(['active', 'temporarily_closed', 'closed', 'opening_soon']).default('active'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export type ListGymsInput = z.infer<typeof listGymsSchema>;
