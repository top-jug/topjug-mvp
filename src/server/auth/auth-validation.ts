import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, validatePasswordPolicy } from '../../lib/auth/password-policy';

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const verificationTokenSchema = z.string().min(43).max(128);
const passwordSchema = z.string().superRefine((password, context) => {
  const message = validatePasswordPolicy(password);
  if (message) context.addIssue({ code: 'custom', message });
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(40),
  emailVerificationToken: verificationTokenSchema,
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
}).strict();

export const requestEmailVerificationSchema = z.object({
  email: emailSchema,
  purpose: z.enum(['register', 'find_account', 'reset_password']),
}).strict();

export const confirmEmailVerificationSchema = requestEmailVerificationSchema.extend({
  code: z.string().regex(/^\d{6}$/, '인증번호 6자리를 입력해주세요.'),
}).strict();

export const findAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  emailVerificationToken: verificationTokenSchema,
}).strict();

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  emailVerificationToken: verificationTokenSchema,
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestEmailVerificationInput = z.infer<typeof requestEmailVerificationSchema>;
export type ConfirmEmailVerificationInput = z.infer<typeof confirmEmailVerificationSchema>;
export type FindAccountInput = z.infer<typeof findAccountSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
