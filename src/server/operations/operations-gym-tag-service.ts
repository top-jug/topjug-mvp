import 'server-only';

import { asc, count, eq, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { databaseErrorCode } from '../db/errors';
import { auditEvents, gyms, gymTagAssignments, gymTags } from '../db/schema';
import { ApiError } from '../http/api-error';
import { auditEventValues } from '../observability/audit';
import type {
  CreateOperationsGymTagInput,
  DeleteOperationsGymTagInput,
  ReplaceOperationsGymTagsInput,
  UpdateOperationsGymTagInput,
} from './operations-gym-tag-validation';

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const tagSelection = {
  id: gymTags.id,
  code: gymTags.code,
  label: gymTags.label,
  description: gymTags.description,
  sortOrder: gymTags.sortOrder,
  isActive: gymTags.isActive,
  createdAt: gymTags.createdAt,
  updatedAt: gymTags.updatedAt,
  assignmentCount: count(gymTagAssignments.gymId),
};

async function loadOperationsGymTag(database: Database | Transaction, tagId: string) {
  const [tag] = await database.select(tagSelection)
    .from(gymTags)
    .leftJoin(gymTagAssignments, eq(gymTagAssignments.tagId, gymTags.id))
    .where(eq(gymTags.id, tagId))
    .groupBy(gymTags.id)
    .limit(1);
  if (!tag) throw new ApiError(404, 'OPS_GYM_TAG_NOT_FOUND', '키워드를 찾을 수 없습니다.');
  return tag;
}

async function lockTag(transaction: Transaction, tagId: string, expectedUpdatedAt: string) {
  const [tag] = await transaction.select({ id: gymTags.id, updatedAt: gymTags.updatedAt })
    .from(gymTags)
    .where(eq(gymTags.id, tagId))
    .limit(1)
    .for('update');
  if (!tag) throw new ApiError(404, 'OPS_GYM_TAG_NOT_FOUND', '키워드를 찾을 수 없습니다.');
  if (tag.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 키워드를 변경했습니다. 최신 정보를 확인해주세요.');
  }
}

async function lockGym(transaction: Transaction, gymId: string, expectedUpdatedAt: string) {
  const [gym] = await transaction.select({
    id: gyms.id,
    name: gyms.name,
    branchName: gyms.branchName,
    updatedAt: gyms.updatedAt,
  }).from(gyms).where(eq(gyms.id, gymId)).limit(1).for('update');
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  if (gym.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new ApiError(409, 'OPS_RESOURCE_CHANGED', '다른 운영자가 암장 정보를 변경했습니다. 최신 정보를 확인해주세요.');
  }
  return gym;
}

function tagValues(input: CreateOperationsGymTagInput | UpdateOperationsGymTagInput) {
  return {
    code: input.code,
    label: input.label,
    description: input.description,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

export function listOperationsGymTags() {
  return getDatabase().select(tagSelection)
    .from(gymTags)
    .leftJoin(gymTagAssignments, eq(gymTagAssignments.tagId, gymTags.id))
    .groupBy(gymTags.id)
    .orderBy(asc(gymTags.sortOrder), asc(gymTags.label), asc(gymTags.id));
}

export async function createOperationsGymTag(input: CreateOperationsGymTagInput) {
  try {
    return await getDatabase().transaction(async (transaction) => {
      const [created] = await transaction.insert(gymTags).values(tagValues(input)).returning({ id: gymTags.id });
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'ops.gym_tag.create',
        resourceType: 'gym_tag',
        resourceId: created.id,
        metadata: { code: input.code },
      }));
      return loadOperationsGymTag(transaction, created.id);
    });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      throw new ApiError(409, 'OPS_GYM_TAG_CODE_EXISTS', '이미 사용 중인 키워드 코드입니다.');
    }
    throw error;
  }
}

export async function updateOperationsGymTag(tagId: string, input: UpdateOperationsGymTagInput) {
  try {
    return await getDatabase().transaction(async (transaction) => {
      await lockTag(transaction, tagId, input.expectedUpdatedAt);
      await transaction.update(gymTags).set({
        ...tagValues(input),
        updatedAt: sql`greatest(clock_timestamp(), ${gymTags.updatedAt} + interval '1 millisecond')`,
      }).where(eq(gymTags.id, tagId));
      await transaction.insert(auditEvents).values(auditEventValues({
        action: 'ops.gym_tag.update',
        resourceType: 'gym_tag',
        resourceId: tagId,
        metadata: { code: input.code, isActive: input.isActive },
      }));
      return loadOperationsGymTag(transaction, tagId);
    });
  } catch (error) {
    if (databaseErrorCode(error) === '23505') {
      throw new ApiError(409, 'OPS_GYM_TAG_CODE_EXISTS', '이미 사용 중인 키워드 코드입니다.');
    }
    throw error;
  }
}

export async function deleteOperationsGymTag(tagId: string, input: DeleteOperationsGymTagInput) {
  await getDatabase().transaction(async (transaction) => {
    await lockTag(transaction, tagId, input.expectedUpdatedAt);
    const [{ assignmentCount }] = await transaction.select({ assignmentCount: count() })
      .from(gymTagAssignments)
      .where(eq(gymTagAssignments.tagId, tagId));
    if (assignmentCount > 0) {
      throw new ApiError(409, 'OPS_GYM_TAG_ASSIGNED', '암장에 배정된 키워드는 비활성화하거나 배정을 먼저 해제해주세요.');
    }
    await transaction.delete(gymTags).where(eq(gymTags.id, tagId));
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym_tag.delete',
      resourceType: 'gym_tag',
      resourceId: tagId,
    }));
  });
}

export async function getOperationsGymTagAssignments(gymId: string) {
  const database = getDatabase();
  const [gym] = await database.select({
    id: gyms.id,
    name: gyms.name,
    branchName: gyms.branchName,
    updatedAt: gyms.updatedAt,
  }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
  const assignments = await database.select({ tagId: gymTagAssignments.tagId })
    .from(gymTagAssignments)
    .where(eq(gymTagAssignments.gymId, gymId));
  return { gym, tagIds: assignments.map((assignment) => assignment.tagId) };
}

export async function replaceOperationsGymTags(gymId: string, input: ReplaceOperationsGymTagsInput) {
  return getDatabase().transaction(async (transaction) => {
    const gym = await lockGym(transaction, gymId, input.expectedUpdatedAt);
    if (input.tagIds.length > 0) {
      const existing = await transaction.select({ id: gymTags.id }).from(gymTags).where(inArray(gymTags.id, input.tagIds));
      if (existing.length !== input.tagIds.length) {
        throw new ApiError(400, 'OPS_GYM_TAG_INVALID', '존재하지 않는 키워드가 포함되어 있습니다.');
      }
    }
    await transaction.delete(gymTagAssignments).where(eq(gymTagAssignments.gymId, gymId));
    if (input.tagIds.length > 0) {
      await transaction.insert(gymTagAssignments).values(input.tagIds.map((tagId) => ({ gymId, tagId })));
    }
    const [updated] = await transaction.update(gyms).set({
      updatedAt: sql`greatest(clock_timestamp(), ${gyms.updatedAt} + interval '1 millisecond')`,
    }).where(eq(gyms.id, gymId)).returning({ updatedAt: gyms.updatedAt });
    await transaction.insert(auditEvents).values(auditEventValues({
      action: 'ops.gym.tags.replace',
      resourceType: 'gym',
      resourceId: gymId,
      metadata: { assignmentCount: input.tagIds.length },
    }));
    return { gym: { ...gym, updatedAt: updated.updatedAt }, tagIds: input.tagIds };
  });
}
