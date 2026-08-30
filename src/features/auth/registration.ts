import type { RegisterInput } from './types';
import { validatePasswordPolicy } from '../../lib/auth/password-policy';

export type RegistrationFormValues = RegisterInput & {
  passwordConfirmation: string;
};

export function validateMatchingPasswords(password: string, passwordConfirmation: string) {
  const policyError = validatePasswordPolicy(password);
  if (policyError) return policyError;
  if (password !== passwordConfirmation) return '비밀번호가 일치하지 않습니다.';
  return null;
}

export const validateRegistrationPasswords = validateMatchingPasswords;

export function toRegisterInput({ passwordConfirmation: _passwordConfirmation, ...input }: RegistrationFormValues): RegisterInput {
  return input;
}
