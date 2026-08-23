import { z } from 'zod';

const dateTimeSchema = z.string().datetime({ offset: true });

export const listSettingEventsSchema = z.object({
  from: dateTimeSchema,
  to: dateTimeSchema,
  gymId: z.string().uuid().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
}).strict().refine((input) => new Date(input.to) >= new Date(input.from), {
  message: '조회 종료 시각은 시작 시각보다 빠를 수 없습니다.',
  path: ['to'],
});

export type ListSettingEventsInput = z.infer<typeof listSettingEventsSchema>;
