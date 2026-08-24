export type SavedGymAction = 'save' | 'unsave';

export interface SavedGymActionError {
  gymId: string;
  action: SavedGymAction;
  message: string;
}

export type SavedGymActionErrors = Record<string, SavedGymActionError>;

export function createSavedGymAccountResetState(isLoading: boolean) {
  return {
    savedGyms: [],
    error: null,
    actionErrors: {},
    pendingGymIds: [],
    isLoading,
  };
}

export function shouldClearSavedGymErrorsOnViewChange(current: string, next: string) {
  return current !== next;
}

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

export function createSavedGymOperationGuard() {
  let generation = 0;
  let sequence = 0;
  const pending = new Map<string, number>();

  return {
    tryBegin(gymId: string) {
      if (pending.has(gymId)) return null;
      const operation = { gymId, generation, sequence: ++sequence };
      pending.set(gymId, operation.sequence);
      return operation;
    },
    isCurrent(operation: { gymId: string; generation: number; sequence: number }) {
      return operation.generation === generation && pending.get(operation.gymId) === operation.sequence;
    },
    finish(operation: { gymId: string; generation: number; sequence: number }) {
      if (operation.generation !== generation || pending.get(operation.gymId) !== operation.sequence) return false;
      pending.delete(operation.gymId);
      return true;
    },
    reset() {
      generation += 1;
      pending.clear();
    },
  };
}
