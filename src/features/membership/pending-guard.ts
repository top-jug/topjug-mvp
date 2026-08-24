export function createPendingGuard() {
  let pending = false;

  return {
    isPending: () => pending,
    async run<T>(action: () => Promise<T>): Promise<T | undefined> {
      if (pending) return undefined;
      pending = true;
      try {
        return await action();
      } finally {
        pending = false;
      }
    },
  };
}
