import 'server-only';

import { getDatabase } from '../db/client';
import { databaseErrorCode } from '../db/errors';
import { auditEvents, users } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import { hashPassword } from './password';

export type OperationsAdminBootstrapInput = {
  email: string;
  displayName: string;
  password: string;
};

export async function createOperationsAdmin(input: OperationsAdminBootstrapInput) {
  const passwordHash = await hashPassword(input.password);

  try {
    return await getDatabase().transaction(async (transaction) => {
      const [createdUser] = await transaction
        .insert(users)
        .values({
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          role: 'operations_admin',
        })
        .returning({ id: users.id, role: users.role });

      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'ops.admin.bootstrap',
        resourceType: 'user',
        resourceId: createdUser.id,
        metadata: { source: 'bootstrap_script' },
      }));

      return createdUser;
    });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      throw new ApiError(409, 'ACCOUNT_UNAVAILABLE', '이 이메일로 계정을 만들 수 없습니다.');
    }
    throw error;
  }
}
