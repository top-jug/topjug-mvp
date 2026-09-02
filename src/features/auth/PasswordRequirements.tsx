import { getPasswordRequirementState, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../lib/auth/password-policy';

export function PasswordRequirements({ password }: { password: string }) {
  const requirements = getPasswordRequirementState(password);
  const itemClass = (satisfied: boolean) => satisfied ? 'text-emerald-700' : 'text-neutral-500';

  return (
    <div className="mt-2 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs leading-5" aria-label="비밀번호 조건">
      <div className={itemClass(requirements.hasMinimumLength && requirements.hasMaximumLength)}>
        {requirements.hasMinimumLength && requirements.hasMaximumLength ? '✓' : '○'} {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH}자
      </div>
      <div className={itemClass(requirements.hasRequiredComposition)}>
        {requirements.hasRequiredComposition ? '✓' : '○'} 영문 대문자, 숫자, 특수문자 중 2가지 이상
      </div>
    </div>
  );
}
