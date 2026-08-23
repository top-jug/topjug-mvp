import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
  actorUserId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, operation: () => T) {
  return storage.run(context, operation);
}

export function getRequestContext() {
  return storage.getStore();
}

export function setRequestActor(actorUserId: string) {
  const context = storage.getStore();
  if (context) context.actorUserId = actorUserId;
}
