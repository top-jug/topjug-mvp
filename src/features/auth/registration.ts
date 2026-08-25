import type { RegisterInput } from './types';
import { validatePasswordPolicy } from '../../lib/auth/password-policy';

export type RegistrationFormValues = RegisterInput & {
  passwordConfirmation: string;
};

export function validateRegistrationPasswords(password: string, passwordConfirmation: string) {
  const policyMessage = validatePasswordPolicy(password);
  if (policyMessage) return policyMessage;
  if (password !== passwordConfirmation) return '비밀번호가 일치하지 않습니다.';
  return null;
}

export function toRegisterInput({ passwordConfirmation: _passwordConfirmation, ...input }: RegistrationFormValues): RegisterInput {
  return input;
}
