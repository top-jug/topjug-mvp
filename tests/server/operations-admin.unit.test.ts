import assert from 'node:assert/strict';
import test from 'node:test';
import { registerSchema } from '../../src/server/auth/auth-validation';
import { parseOperationsAdminArguments } from '../../src/server/auth/operations-admin-bootstrap';

test('public registration cannot request an operations administrator role', () => {
  const result = registerSchema.safeParse({
    email: 'admin@example.com',
    displayName: 'Admin',
    password: 'correct-horse-battery-staple',
    role: 'operations_admin',
  });

  assert.equal(result.success, false);
});

test('operations administrator bootstrap is dry-run by default and requires explicit identity flags', () => {
  assert.deepEqual(parseOperationsAdminArguments([
    '--email', 'admin@example.com',
    '--display-name', 'Operations Admin',
  ]), {
    apply: false,
    email: 'admin@example.com',
    displayName: 'Operations Admin',
  });
});

test('operations administrator bootstrap rejects password arguments and duplicate values', () => {
  assert.throws(
    () => parseOperationsAdminArguments(['--password', 'secret']),
    /Password arguments are forbidden/,
  );
  assert.throws(
    () => parseOperationsAdminArguments(['--email', 'one@example.com', '--email', 'two@example.com']),
    /only once/,
  );
});
