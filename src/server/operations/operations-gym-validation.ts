import { z } from 'zod';
import { ApiError } from '../http/api-error';

export const gymOperationStatusSchema = z.enum(['active', 'temporarily_closed', 'closed', 'opening_soon']);

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const nullableHttpsUrl = z.string().trim().max(500).nullable().refine(
  (value) => {
    if (value === null || value === '') return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname);
    } catch {
      return false;
    }
  },
  '웹 주소는 https://로 시작해야 합니다.',
).transform((value) => value || null);
const color = z.string().regex(/^#[0-9a-f]{6}$/i, '색상은 #RRGGBB 형식이어야 합니다.').nullable();

export const gymPriceInputSchema = z.object({
  amount: z.number().int().min(0).nullable(),
  rawText: z.string().trim().min(1).max(100),
}).strict().nullable();

export const operationsGymFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  branchName: nullableText(120),
  address: z.string().trim().min(1).max(300),
  phone: nullableText(40),
  websiteUrl: nullableHttpsUrl,
  instagramUrl: nullableHttpsUrl,
  nearbyDirections: nullableText(500),
  operatingHoursNote: nullableText(1000),
  parkingInfo: nullableText(1000),
  calendarColor: color,
  calendarTextColor: color,
  facilities: z.array(z.string().trim().min(1).max(40)).max(30),
  dayPassPrice: gymPriceInputSchema,
  shoeRentalPrice: gymPriceInputSchema,
}).strict();

export const createOperationsGymSchema = operationsGymFieldsSchema.safeExtend({
  operationStatus: gymOperationStatusSchema.default('active'),
});

export const updateOperationsGymSchema = operationsGymFieldsSchema.safeExtend({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

export const updateOperationsGymStatusSchema = z.object({
  operationStatus: gymOperationStatusSchema,
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const verifyOperationsGymSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const listOperationsGymsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  operationStatus: gymOperationStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

const operatingTimeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, '시간은 HH:mm 형식이어야 합니다.')
  .transform((value) => value.length === 5 ? `${value}:00` : value);

const operatingDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다.')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, '유효한 날짜를 입력해주세요.');

export const operatingHourIntervalSchema = z.object({
  opensAt: operatingTimeSchema,
  closesAt: operatingTimeSchema,
}).strict().refine((interval) => interval.opensAt < interval.closesAt, {
  message: '종료 시간은 시작 시간보다 늦어야 합니다.',
  path: ['closesAt'],
});

const operatingScheduleFields = {
  isClosed: z.boolean(),
  intervals: z.array(operatingHourIntervalSchema).max(8),
};

function validateOperatingSchedule(
  schedule: { isClosed: boolean; intervals: Array<{ opensAt: string; closesAt: string }> },
  context: z.RefinementCtx,
) {
  if (schedule.isClosed && schedule.intervals.length > 0) {
    context.addIssue({ code: 'custom', message: '휴무일에는 운영 구간을 입력할 수 없습니다.', path: ['intervals'] });
    return;
  }
  if (!schedule.isClosed && schedule.intervals.length === 0) {
    context.addIssue({ code: 'custom', message: '영업일에는 운영 구간이 하나 이상 필요합니다.', path: ['intervals'] });
    return;
  }
  for (let index = 1; index < schedule.intervals.length; index += 1) {
    if (schedule.intervals[index - 1].closesAt > schedule.intervals[index].opensAt) {
      context.addIssue({ code: 'custom', message: '운영 구간은 시간순이어야 하며 서로 겹칠 수 없습니다.', path: ['intervals', index] });
    }
  }
}

export const replaceWeeklyOperatingHoursSchema = z.object({
  days: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    ...operatingScheduleFields,
  }).strict().superRefine(validateOperatingSchedule)).length(7),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((input, context) => {
  const days = input.days.map((day) => day.dayOfWeek);
  if (new Set(days).size !== 7) {
    context.addIssue({ code: 'custom', message: '일요일부터 토요일까지 각 요일을 한 번씩 입력해주세요.', path: ['days'] });
  }
});

export const createOperatingHourOverrideSchema = z.object({
  ...operatingScheduleFields,
  note: nullableText(300),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine(validateOperatingSchedule);

export const deleteOperatingHourOverrideSchema = z.object({
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const batchOperatingHourOverridesSchema = z.object({
  startDate: operatingDateSchema,
  endDate: operatingDateSchema,
  ...operatingScheduleFields,
  note: nullableText(300),
  overwriteExisting: z.boolean().default(false),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((input, context) => {
  validateOperatingSchedule(input, context);
  const start = Date.parse(`${input.startDate}T00:00:00Z`);
  const end = Date.parse(`${input.endDate}T00:00:00Z`);
  const dateCount = Math.floor((end - start) / 86_400_000) + 1;
  if (dateCount < 1) {
    context.addIssue({ code: 'custom', message: '종료일은 시작일보다 빠를 수 없습니다.', path: ['endDate'] });
  } else if (dateCount > 92) {
    context.addIssue({ code: 'custom', message: '기간 예외는 최대 92일까지 입력할 수 있습니다.', path: ['endDate'] });
  }
});

export { operatingDateSchema };

export function parseOperatingHoursInput<Output>(schema: z.ZodType<Output>, input: unknown): Output {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, 'INVALID_OPERATING_HOURS', result.error.issues[0]?.message ?? '운영시간을 확인해주세요.');
  }
  return result.data;
}

export type CreateOperationsGymInput = z.infer<typeof createOperationsGymSchema>;
export type UpdateOperationsGymInput = z.infer<typeof updateOperationsGymSchema>;
export type UpdateOperationsGymStatusInput = z.infer<typeof updateOperationsGymStatusSchema>;
export type VerifyOperationsGymInput = z.infer<typeof verifyOperationsGymSchema>;
export type ListOperationsGymsInput = z.infer<typeof listOperationsGymsSchema>;
export type ReplaceWeeklyOperatingHoursInput = z.infer<typeof replaceWeeklyOperatingHoursSchema>;
export type CreateOperatingHourOverrideInput = z.infer<typeof createOperatingHourOverrideSchema>;
export type DeleteOperatingHourOverrideInput = z.infer<typeof deleteOperatingHourOverrideSchema>;
export type BatchOperatingHourOverridesInput = z.infer<typeof batchOperatingHourOverridesSchema>;
