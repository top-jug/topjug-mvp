import 'server-only';

import { getRequestContext } from './request-context';

type LogFields = Record<string, string | number | boolean | null | undefined>;

function write(level: 'info' | 'error', event: string, fields: LogFields = {}) {
  const context = getRequestContext();
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: context?.requestId,
    actorUserId: context?.actorUserId,
    ...fields,
  });

  if (level === 'error') {
    console.error(entry);
    return;
  }

  console.info(entry);
}

export const logger = {
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};
