export type RecordShareAttemptResult<T> =
  | { outcome: 'shared'; share: T; createdForAttempt: boolean }
  | { outcome: 'cancelled'; share: T; createdForAttempt: false }
  | { outcome: 'cancelled-revoked'; share: T; createdForAttempt: true }
  | { outcome: 'cancelled-active'; share: T; createdForAttempt: true; revokeError: unknown }
  | { outcome: 'failed'; error: unknown; share?: T; createdForAttempt: boolean };

interface RecordShareAttempt<T> {
  existingShare?: T;
  createShare: () => Promise<T>;
  presentShare: (share: T) => Promise<void>;
  revokeShare: (share: T) => Promise<void>;
}

export async function runRecordShareAttempt<T>({
  existingShare,
  createShare,
  presentShare,
  revokeShare,
}: RecordShareAttempt<T>): Promise<RecordShareAttemptResult<T>> {
  const createdForAttempt = existingShare === undefined;
  let share: T;

  try {
    share = existingShare ?? await createShare();
  } catch (error) {
    return { outcome: 'failed', error, createdForAttempt };
  }

  try {
    await presentShare(share);
    return { outcome: 'shared', share, createdForAttempt };
  } catch (error) {
    if (!isAbortError(error)) {
      return { outcome: 'failed', error, share, createdForAttempt };
    }

    if (!createdForAttempt) {
      return { outcome: 'cancelled', share, createdForAttempt: false };
    }

    try {
      await revokeShare(share);
      return { outcome: 'cancelled-revoked', share, createdForAttempt: true };
    } catch (revokeError) {
      return { outcome: 'cancelled-active', share, createdForAttempt: true, revokeError };
    }
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
