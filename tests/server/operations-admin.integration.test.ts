import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { createOperationsAdmin } from '../../src/server/auth/operations-admin-service';
import { requireOperationsAdmin } from '../../src/server/auth/request-auth';
import { createTokenPair } from '../../src/server/auth/token';
import { closeDatabase, getDatabase } from '../../src/server/db/client';
import { auditEvents, users } from '../../src/server/db/schema';
import { ApiError } from '../../src/server/http/api-error';

test('operations administrator bootstrap and current database role authorization', async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const email = `operations-${suffix}@example.com`;
  let userId: string | undefined;

  try {
    const created = await createOperationsAdmin({
      email,
      displayName: 'Operations Integration',
      password: 'correct horse battery staple',
    });
    userId = created.id;
    assert.equal(created.role, 'operations_admin');

    const [audit] = await database.select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, created.id));
    assert.equal(audit.action, 'ops.admin.bootstrap');
    assert.deepEqual(audit.metadata, { source: 'bootstrap_script' });

    await assert.rejects(
      () => createOperationsAdmin({
        email,
        displayName: 'Duplicate Operations Integration',
        password: 'correct horse battery staple',
      }),
      (error: unknown) => error instanceof ApiError && error.status === 409 && error.code === 'ACCOUNT_UNAVAILABLE',
    );

    const tokens = await createTokenPair(created.id);
    const request = new Request('http://localhost/api/v1/ops/session', {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    }) as unknown as NextRequest;
    assert.deepEqual(await requireOperationsAdmin(request), {
      userId: created.id,
      role: 'operations_admin',
    });

    await database.update(users).set({ role: 'user' }).where(eq(users.id, created.id));
    await assert.rejects(
      () => requireOperationsAdmin(request),
      (error: unknown) => error instanceof ApiError && error.status === 403 && error.code === 'OPERATIONS_ADMIN_REQUIRED',
    );
    await assert.rejects(
      () => requireOperationsAdmin(new Request('http://localhost/api/v1/ops/session') as unknown as NextRequest),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
  } finally {
    if (userId) await database.delete(auditEvents).where(eq(auditEvents.resourceId, userId));
    await database.delete(users).where(eq(users.email, email));
    await closeDatabase();
  }
});
