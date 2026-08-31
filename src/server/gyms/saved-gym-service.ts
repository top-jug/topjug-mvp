import 'server-only';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { auditEvents, gymMedia, gyms, mediaAssets, savedGyms } from '../db/schema';
import { ApiError } from '../http/api-error';
import { publicMediaUrl } from '../media/media-url';
import { auditEventValues } from '../observability/audit';
import { loadGymTodayOperatingStatuses } from './gym-operating-status-service';

export async function listSavedGyms(userId: string) {
  const database = getDatabase();
  const rows = await database.select({
    id: gyms.id,
    name: gyms.name,
    branchName: gyms.branchName,
    address: gyms.address,
    regionCode: gyms.regionCode,
    facilities: gyms.facilities,
    operationStatus: gyms.operationStatus,
    savedAt: savedGyms.createdAt,
  }).from(savedGyms)
    .innerJoin(gyms, eq(savedGyms.gymId, gyms.id))
    .where(eq(savedGyms.userId, userId))
    .orderBy(desc(savedGyms.createdAt));
  const gymIds = rows.map((row) => row.id);
  const [covers, todayOperatingStatuses] = await Promise.all([
    gymIds.length > 0
      ? database.select({
      gymId: gymMedia.gymId,
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
    })
      .from(gymMedia).innerJoin(mediaAssets, eq(gymMedia.mediaAssetId, mediaAssets.id))
      .where(and(inArray(gymMedia.gymId, gymIds), eq(gymMedia.type, 'cover'), eq(mediaAssets.status, 'ready')))
      .orderBy(gymMedia.sortOrder)
      : Promise.resolve([]),
    loadGymTodayOperatingStatuses(gymIds),
  ]);
  const coverByGym = new Map<string, (typeof covers)[number] & { url: string | null }>();
  for (const cover of covers) {
    if (!coverByGym.has(cover.gymId)) coverByGym.set(cover.gymId, { ...cover, url: publicMediaUrl(cover.storageKey) });
  }
  return { data: rows.map((row) => ({
    ...row,
    cover: coverByGym.get(row.id) ?? null,
    todayOperatingStatus: todayOperatingStatuses.get(row.id)!,
  })) };
}

export async function saveGym(userId: string, gymId: string) {
  const database = getDatabase();
  await database.transaction(async (transaction) => {
    const [gym] = await transaction.select({ id: gyms.id }).from(gyms).where(eq(gyms.id, gymId)).limit(1);
    if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');
    await transaction.insert(savedGyms).values({ userId, gymId }).onConflictDoNothing();
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'gym.save', resourceType: 'gym', resourceId: gymId }));
  });
}

export async function unsaveGym(userId: string, gymId: string) {
  await getDatabase().transaction(async (transaction) => {
    await transaction.delete(savedGyms).where(and(eq(savedGyms.userId, userId), eq(savedGyms.gymId, gymId)));
    await transaction.insert(auditEvents).values(auditEventValues({ action: 'gym.unsave', resourceType: 'gym', resourceId: gymId }));
  });
}
