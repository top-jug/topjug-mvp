import { z } from 'zod';

const dateTimeSchema = z.string().datetime({ offset: true });

export const membershipInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['count', 'period']),
  gymIds: z.array(z.string().uuid()).max(30),
  totalUses: z.number().int().min(0).nullable().optional(),
  remainingUses: z.number().int().min(0).nullable().optional(),
  validFrom: dateTimeSchema,
  validUntil: dateTimeSchema,
  note: z.string().trim().max(1000).nullable().optional(),
  homeFavorite: z.boolean().default(false),
  homeOrder: z.number().int().min(0).max(2).nullable().optional(),
}).strict().superRefine((membership, context) => {
  if (new Date(membership.validUntil) < new Date(membership.validFrom)) {
    context.addIssue({ code: 'custom', message: '회원권 종료일은 시작일보다 빠를 수 없습니다.', path: ['validUntil'] });
  }
  if (membership.type === 'count') {
    if (membership.totalUses == null || membership.remainingUses == null || membership.remainingUses > membership.totalUses) {
      context.addIssue({ code: 'custom', message: '횟수권의 총 횟수와 올바른 잔여 횟수가 필요합니다.', path: ['remainingUses'] });
    }
  } else if (membership.totalUses != null || membership.remainingUses != null) {
    context.addIssue({ code: 'custom', message: '기간권에는 이용 횟수를 지정할 수 없습니다.', path: ['totalUses'] });
  }
  if (membership.homeFavorite !== (membership.homeOrder != null)) {
    context.addIssue({ code: 'custom', message: '홈 표시 회원권에는 0부터 2 사이의 순서가 필요합니다.', path: ['homeOrder'] });
  }
  if (new Set(membership.gymIds).size !== membership.gymIds.length) {
    context.addIssue({ code: 'custom', message: '같은 암장을 중복 지정할 수 없습니다.', path: ['gymIds'] });
  }
});

export type MembershipInput = z.infer<typeof membershipInputSchema>;
