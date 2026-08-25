import { getPasswordRequirementState } from '../../lib/auth/password-policy';

type Props = {
  password: string;
  id?: string;
};

export function PasswordRequirementList({ password, id }: Props) {
  const state = getPasswordRequirementState(password);
  const requirements = [
    { label: '영문 대문자 1개 이상', satisfied: state.hasUppercase },
    { label: '숫자 1개 이상', satisfied: state.hasDigit },
    { label: '특수문자 1개 이상', satisfied: state.hasSpecialCharacter },
  ];

  return (
    <div id={id} className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-xs" aria-live="polite">
      <div className={`flex items-center gap-2 font-bold ${state.hasMinimumLength ? 'text-emerald-700' : 'text-neutral-500'}`}>
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${state.hasMinimumLength ? 'bg-emerald-100' : 'bg-neutral-200'}`} aria-hidden="true">
          {state.hasMinimumLength ? '✓' : '○'}
        </span>
        8자 이상
      </div>

      <div className="my-3 h-px bg-neutral-200" />

      <div className={`mb-2 font-black ${state.hasRequiredComposition ? 'text-emerald-700' : 'text-neutral-600'}`}>
        조합 조건: 3개 중 {state.satisfiedCompositionCount}개 충족 (2개 필요)
      </div>
      <ul className="space-y-2">
        {requirements.map((requirement) => (
          <li key={requirement.label} className={`flex items-center gap-2 font-bold ${requirement.satisfied ? 'text-emerald-700' : 'text-neutral-400'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full ${requirement.satisfied ? 'bg-emerald-100' : 'bg-neutral-200'}`} aria-hidden="true">
              {requirement.satisfied ? '✓' : '○'}
            </span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
