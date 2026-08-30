import { z } from 'zod';

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
const nullableCoordinate = z.number().nullable();
const color = z.string().regex(/^#[0-9a-f]{6}$/i, '색상은 #RRGGBB 형식이어야 합니다.').nullable();

export const gymPriceInputSchema = z.object({
  amount: z.number().int().min(0).nullable(),
  rawText: z.string().trim().min(1).max(100),
}).strict().nullable();

export const operationsGymFieldsSchema = z.object({
  brandId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  branchName: nullableText(120),
  address: z.string().trim().min(1).max(300),
  regionCode: nullableText(40),
  latitude: nullableCoordinate.refine((value) => value === null || (value >= -90 && value <= 90), '위도를 확인해주세요.'),
  longitude: nullableCoordinate.refine((value) => value === null || (value >= -180 && value <= 180), '경도를 확인해주세요.'),
  phone: nullableText(40),
  websiteUrl: nullableHttpsUrl,
  instagramUrl: nullableHttpsUrl,
  nearbyDirections: nullableText(500),
  operatingHoursNote: nullableText(1000),
  parkingInfo: nullableText(1000),
  calendarColor: color,
  calendarTextColor: color,
  dayPassPrice: gymPriceInputSchema,
  shoeRentalPrice: gymPriceInputSchema,
}).strict().superRefine((input, context) => {
  if ((input.latitude === null) !== (input.longitude === null)) {
    context.addIssue({ code: 'custom', message: '위도와 경도는 함께 입력해야 합니다.', path: ['latitude'] });
  }
});

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

export type CreateOperationsGymInput = z.infer<typeof createOperationsGymSchema>;
export type UpdateOperationsGymInput = z.infer<typeof updateOperationsGymSchema>;
export type UpdateOperationsGymStatusInput = z.infer<typeof updateOperationsGymStatusSchema>;
export type VerifyOperationsGymInput = z.infer<typeof verifyOperationsGymSchema>;
export type ListOperationsGymsInput = z.infer<typeof listOperationsGymsSchema>;
