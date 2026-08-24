import type { RegisterInput } from './types';

export type RegistrationFormValues = RegisterInput & {
  passwordConfirmation: string;
};

export function validateRegistrationPasswords(password: string, passwordConfirmation: string) {
  if (password.length < 12) return '비밀번호는 12자 이상 입력해주세요.';
  if (password !== passwordConfirmation) return '비밀번호가 일치하지 않습니다.';
  return null;
}

export function toRegisterInput({ passwordConfirmation: _passwordConfirmation, ...input }: RegistrationFormValues): RegisterInput {
  return input;
}
