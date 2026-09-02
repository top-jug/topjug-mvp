export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_MIN_LENGTH_MESSAGE = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해주세요.`;
export const PASSWORD_MAX_LENGTH_MESSAGE = `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하로 입력해주세요.`;
export const PASSWORD_COMPOSITION_MESSAGE = '비밀번호에 영문 대문자, 숫자, 특수문자 중 2가지 이상을 포함해주세요.';

const UPPERCASE_PATTERN = /[A-Z]/;
const DIGIT_PATTERN = /[0-9]/;
const SPECIAL_CHARACTER_PATTERN = /[!-/:-@[-`{-~]/;

export function getPasswordRequirementState(password: string) {
  const hasUppercase = UPPERCASE_PATTERN.test(password);
  const hasDigit = DIGIT_PATTERN.test(password);
  const hasSpecialCharacter = SPECIAL_CHARACTER_PATTERN.test(password);
  const satisfiedCompositionCount = [hasUppercase, hasDigit, hasSpecialCharacter].filter(Boolean).length;

  return {
    hasMinimumLength: password.length >= PASSWORD_MIN_LENGTH,
    hasMaximumLength: password.length <= PASSWORD_MAX_LENGTH,
    hasUppercase,
    hasDigit,
    hasSpecialCharacter,
    hasRequiredComposition: satisfiedCompositionCount >= 2,
  };
}

export function validatePasswordPolicy(password: string) {
  const state = getPasswordRequirementState(password);
  if (!state.hasMinimumLength) return PASSWORD_MIN_LENGTH_MESSAGE;
  if (!state.hasMaximumLength) return PASSWORD_MAX_LENGTH_MESSAGE;
  if (!state.hasRequiredComposition) return PASSWORD_COMPOSITION_MESSAGE;
  return null;
}
