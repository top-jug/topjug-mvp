import 'server-only';

import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/client';
import { auditEvents } from '../db/schema';
import { logger } from './logger';
import { getRequestContext } from './request-context';

type AuditMetadata = Record<string, string | number | boolean | null>;

export interface AuditEvent {
  action: string;
  outcome?: 'success' | 'failure';
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: AuditMetadata;
}

export function auditEventValues(event: AuditEvent) {
  const context = getRequestContext();
  return {
    requestId: context?.requestId ?? randomUUID(),
    actorUserId: event.actorUserId ?? context?.actorUserId ?? null,
    action: event.action,
    resourceType: event.resourceType ?? null,
    resourceId: event.resourceId ?? null,
    outcome: event.outcome ?? 'success' as const,
    metadata: event.metadata ?? {},
  };
}

export async function writeAuditEvent(event: AuditEvent) {
  try {
    await getDatabase().insert(auditEvents).values(auditEventValues(event));
  } catch (error) {
    logger.error('audit.write_failed', {
      action: event.action,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

export function writeRequiredAuditEvent(event: AuditEvent) {
  return getDatabase().insert(auditEvents).values(auditEventValues(event));
}
