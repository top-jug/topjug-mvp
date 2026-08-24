const RECORD_GUARD_STATE = '__topjugRecordGuard';

interface HistoryTarget {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  back(): void;
}

interface PopStateTarget {
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}

export function createRecordHistoryGuard(history: HistoryTarget, events: PopStateTarget, onBack: () => void) {
  let releaseResolve: (() => void) | null = null;
  let releasePromise: Promise<void> | null = null;
  let disposed = false;

  const pushGuard = () => {
    const currentState = history.state && typeof history.state === 'object' ? history.state : {};
    history.pushState({ ...currentState, [RECORD_GUARD_STATE]: true }, '');
  };

  const handlePopState = () => {
    if (releaseResolve) {
      const resolve = releaseResolve;
      releaseResolve = null;
      disposed = true;
      events.removeEventListener('popstate', handlePopState);
      resolve();
      return;
    }

    onBack();
    pushGuard();
  };

  const currentState = history.state;
  if (!currentState || typeof currentState !== 'object' || !(RECORD_GUARD_STATE in currentState)) pushGuard();
  events.addEventListener('popstate', handlePopState);

  return {
    release() {
      if (disposed) return Promise.resolve();
      if (releasePromise) return releasePromise;
      releasePromise = new Promise<void>((resolve) => {
        releaseResolve = resolve;
        history.back();
      });
      return releasePromise;
    },
    dispose() {
      disposed = true;
      events.removeEventListener('popstate', handlePopState);
      releaseResolve?.();
      releaseResolve = null;
    },
  };
}
