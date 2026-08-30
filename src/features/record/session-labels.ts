import { ClimbingRecord } from '../../entities/record/types';

export type RecordSessionType = NonNullable<ClimbingRecord['sessionType']>;

const SESSION_TYPE_LABELS = {
  free: '자유',
  training: '훈련',
  project: '프로젝트',
} satisfies Record<RecordSessionType, string>;

export const RECORD_SESSION_TYPE_OPTIONS: Array<{ value: RecordSessionType; label: string }> = [
  { value: 'free', label: SESSION_TYPE_LABELS.free },
  { value: 'training', label: SESSION_TYPE_LABELS.training },
  { value: 'project', label: SESSION_TYPE_LABELS.project },
];

export function recordSessionTypeLabel(sessionType: string | null | undefined) {
  if (sessionType === 'free' || sessionType === 'training' || sessionType === 'project') {
    return SESSION_TYPE_LABELS[sessionType];
  }

  return '알 수 없음';
}
