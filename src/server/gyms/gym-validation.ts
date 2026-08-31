import { z } from 'zod';

export const listGymsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  regionCode: z.string().trim().min(1).max(40).optional(),
  facility: z.preprocess(
    (value) => value === undefined ? [] : Array.isArray(value) ? value : [value],
    z.array(z.string().trim().min(1).max(40)).max(10),
  ),
  tag: z.preprocess(
    (value) => value === undefined ? [] : Array.isArray(value) ? value : [value],
    z.array(z.string().trim().min(1).max(40)).max(10).refine(
      (tags) => new Set(tags).size === tags.length,
      '키워드를 중복해서 선택할 수 없습니다.',
    ),
  ),
  operationStatus: z.enum(['active', 'temporarily_closed', 'closed', 'opening_soon']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export type ListGymsInput = z.infer<typeof listGymsSchema>;
