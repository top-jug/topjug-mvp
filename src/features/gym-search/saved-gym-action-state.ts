export type SavedGymAction = 'save' | 'unsave';

export interface SavedGymActionError {
  gymId: string;
  action: SavedGymAction;
  message: string;
}

export type SavedGymActionErrors = Record<string, SavedGymActionError>;

export function setSavedGymActionError(
  errors: SavedGymActionErrors,
  error: SavedGymActionError,
): SavedGymActionErrors {
  return { ...errors, [error.gymId]: error };
}

export function clearSavedGymActionError(errors: SavedGymActionErrors, gymId?: string): SavedGymActionErrors {
  if (!gymId) return {};
  if (!(gymId in errors)) return errors;
  const next = { ...errors };
  delete next[gymId];
  return next;
}

export function createSavedGymActionErrorGuard() {
  let generation = 0;
  const versions = new Map<string, number>();

  return {
    begin(gymId: string) {
      const version = (versions.get(gymId) ?? 0) + 1;
      versions.set(gymId, version);
      return { gymId, generation, version };
    },
    isCurrent(scope: { gymId: string; generation: number; version: number }) {
      return scope.generation === generation && versions.get(scope.gymId) === scope.version;
    },
    invalidate(gymId?: string) {
      if (gymId) versions.set(gymId, (versions.get(gymId) ?? 0) + 1);
      else generation += 1;
    },
  };
}
