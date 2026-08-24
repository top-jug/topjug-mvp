import 'server-only';

import { and, asc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import {
  gymBrands,
  gymGrades,
  gymMedia,
  gymOperatingHourOverrides,
  gymOperatingHours,
  gymPrices,
  gyms,
  gymSectors,
  gymSources,
  gymTagAssignments,
  gymTags,
  gymWalls,
  mediaAssets,
  regions,
  settingEvents,
  settingEventSectors,
} from '../db/schema';
import { ApiError } from '../http/api-error';
import { publicMediaUrl } from '../media/media-url';
import { ListGymsInput } from './gym-validation';

function mediaReference(asset: {
  id: string;
  storageKey: string;
  contentType: string;
}) {
  return { ...asset, url: publicMediaUrl(asset.storageKey) };
}

export async function listGyms(input: ListGymsInput) {
  const database = getDatabase();
  const conditions = [eq(gyms.operationStatus, input.operationStatus)];
  if (input.q) conditions.push(or(ilike(gyms.name, `%${input.q}%`), ilike(gyms.branchName, `%${input.q}%`), ilike(gyms.address, `%${input.q}%`))!);
  if (input.regionCode) conditions.push(eq(gyms.regionCode, input.regionCode));
  if (input.facility) conditions.push(sql`${input.facility} = ANY(${gyms.facilities})`);
  if (input.tag) conditions.push(exists(
    database.select({ value: sql`1` })
      .from(gymTagAssignments)
      .innerJoin(gymTags, eq(gymTagAssignments.tagId, gymTags.id))
      .where(and(eq(gymTagAssignments.gymId, gyms.id), eq(gymTags.code, input.tag))),
  ));

  const rows = await database
    .select({
      id: gyms.id,
      name: gyms.name,
      branchName: gyms.branchName,
      address: gyms.address,
      regionCode: gyms.regionCode,
      latitude: gyms.latitude,
      longitude: gyms.longitude,
      operationStatus: gyms.operationStatus,
      facilities: gyms.facilities,
      calendarColor: gyms.calendarColor,
      calendarTextColor: gyms.calendarTextColor,
      brand: {
        id: gymBrands.id,
        name: gymBrands.name,
        websiteUrl: gymBrands.websiteUrl,
        instagramUrl: gymBrands.instagramUrl,
      },
    })
    .from(gyms)
    .leftJoin(gymBrands, eq(gyms.brandId, gymBrands.id))
    .where(and(...conditions))
    .orderBy(asc(gyms.name), asc(gyms.branchName))
    .limit(input.limit);

  const gymIds = rows.map((gym) => gym.id);
  const [covers, tags, dayPassPrices] = gymIds.length > 0 ? await Promise.all([
    database.select({
      gymId: gymMedia.gymId,
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
    })
      .from(gymMedia)
      .innerJoin(mediaAssets, eq(gymMedia.mediaAssetId, mediaAssets.id))
      .where(and(inArray(gymMedia.gymId, gymIds), eq(gymMedia.type, 'cover'), eq(mediaAssets.status, 'ready')))
      .orderBy(gymMedia.sortOrder),
    database.select({ gymId: gymTagAssignments.gymId, code: gymTags.code, label: gymTags.label })
      .from(gymTagAssignments)
      .innerJoin(gymTags, eq(gymTagAssignments.tagId, gymTags.id))
      .where(inArray(gymTagAssignments.gymId, gymIds))
      .orderBy(gymTags.label),
    database.select({ gymId: gymPrices.gymId, amount: gymPrices.amount, currency: gymPrices.currency, rawText: gymPrices.rawText })
      .from(gymPrices).where(and(inArray(gymPrices.gymId, gymIds), eq(gymPrices.type, 'day_pass'))),
  ]) : [[], [], []];

  const coverByGym = new Map<string, ReturnType<typeof mediaReference>>();
  for (const cover of covers) if (!coverByGym.has(cover.gymId)) coverByGym.set(cover.gymId, mediaReference(cover));
  const tagsByGym = new Map<string, Array<{ code: string; label: string }>>();
  for (const tag of tags) tagsByGym.set(tag.gymId, [...(tagsByGym.get(tag.gymId) ?? []), { code: tag.code, label: tag.label }]);
  const dayPassPriceByGym = new Map(dayPassPrices.map((price) => [price.gymId, { amount: price.amount, currency: price.currency, rawText: price.rawText }]));

  return {
    data: rows.map((gym) => ({
      ...gym,
      cover: coverByGym.get(gym.id) ?? null,
      tags: tagsByGym.get(gym.id) ?? [],
      dayPassPrice: dayPassPriceByGym.get(gym.id) ?? null,
    })),
  };
}

export async function getGym(gymId: string) {
  const database = getDatabase();
  const [gym] = await database
    .select({
      id: gyms.id,
      name: gyms.name,
      branchName: gyms.branchName,
      address: gyms.address,
      regionCode: gyms.regionCode,
      latitude: gyms.latitude,
      longitude: gyms.longitude,
      phone: gyms.phone,
      websiteUrl: gyms.websiteUrl,
      instagramUrl: gyms.instagramUrl,
      nearbyDirections: gyms.nearbyDirections,
      operatingHoursNote: gyms.operatingHoursNote,
      parkingInfo: gyms.parkingInfo,
      operationStatus: gyms.operationStatus,
      facilities: gyms.facilities,
      calendarColor: gyms.calendarColor,
      calendarTextColor: gyms.calendarTextColor,
      brand: { id: gymBrands.id, name: gymBrands.name, websiteUrl: gymBrands.websiteUrl, instagramUrl: gymBrands.instagramUrl },
      region: { code: regions.code, name: regions.name, parentCode: regions.parentCode },
      createdAt: gyms.createdAt,
      updatedAt: gyms.updatedAt,
    })
    .from(gyms)
    .leftJoin(gymBrands, eq(gyms.brandId, gymBrands.id))
    .leftJoin(regions, eq(gyms.regionCode, regions.code))
    .where(eq(gyms.id, gymId))
    .limit(1);
  if (!gym) throw new ApiError(404, 'GYM_NOT_FOUND', '암장을 찾을 수 없습니다.');

  const [media, hours, hourOverrides, prices, tags, grades, walls, sectors, events, sources] = await Promise.all([
    database.select({
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
      type: gymMedia.type,
      altText: gymMedia.altText,
      sortOrder: gymMedia.sortOrder,
    }).from(gymMedia)
      .innerJoin(mediaAssets, eq(gymMedia.mediaAssetId, mediaAssets.id))
      .where(and(eq(gymMedia.gymId, gymId), eq(mediaAssets.status, 'ready')))
      .orderBy(gymMedia.type, gymMedia.sortOrder),
    database.select().from(gymOperatingHours).where(eq(gymOperatingHours.gymId, gymId)).orderBy(gymOperatingHours.dayOfWeek, gymOperatingHours.sequence),
    database.select().from(gymOperatingHourOverrides).where(eq(gymOperatingHourOverrides.gymId, gymId)).orderBy(gymOperatingHourOverrides.date, gymOperatingHourOverrides.sequence),
    database.select().from(gymPrices).where(eq(gymPrices.gymId, gymId)).orderBy(gymPrices.type),
    database.select({ code: gymTags.code, label: gymTags.label }).from(gymTagAssignments)
      .innerJoin(gymTags, eq(gymTagAssignments.tagId, gymTags.id))
      .where(eq(gymTagAssignments.gymId, gymId)).orderBy(gymTags.label),
    database.select().from(gymGrades).where(eq(gymGrades.gymId, gymId)).orderBy(gymGrades.rank),
    database.select().from(gymWalls).where(eq(gymWalls.gymId, gymId)).orderBy(gymWalls.sortOrder),
    database.select({
      id: gymSectors.id,
      wallId: gymSectors.wallId,
      code: gymSectors.code,
      name: gymSectors.name,
      sortOrder: gymSectors.sortOrder,
      isActive: gymSectors.isActive,
      mapMediaAssetId: gymSectors.mapMediaAssetId,
    }).from(gymSectors).innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
      .where(eq(gymWalls.gymId, gymId)).orderBy(gymWalls.sortOrder, gymSectors.sortOrder),
    database.select().from(settingEvents).where(eq(settingEvents.gymId, gymId)).orderBy(settingEvents.startsAt),
    database.select({ type: gymSources.type, sourceName: gymSources.sourceName, sourceUrl: gymSources.sourceUrl, verifiedAt: gymSources.verifiedAt, lastCheckedAt: gymSources.lastCheckedAt })
      .from(gymSources).where(eq(gymSources.gymId, gymId)).orderBy(gymSources.createdAt),
  ]);

  const eventIds = events.map((event) => event.id);
  const mapAssetIds = [...new Set([
    ...walls.map((wall) => wall.mapMediaAssetId),
    ...sectors.map((sector) => sector.mapMediaAssetId),
  ].filter((id): id is string => Boolean(id)))];
  const [eventSectors, mapAssets] = await Promise.all([
    eventIds.length > 0
      ? database.select({ settingEventId: settingEventSectors.settingEventId, gymSectorId: settingEventSectors.gymSectorId })
        .from(settingEventSectors).where(inArray(settingEventSectors.settingEventId, eventIds))
      : Promise.resolve([]),
    mapAssetIds.length > 0
      ? database.select({
        id: mediaAssets.id,
        storageKey: mediaAssets.storageKey,
        contentType: mediaAssets.contentType,
      })
        .from(mediaAssets).where(and(inArray(mediaAssets.id, mapAssetIds), eq(mediaAssets.status, 'ready')))
      : Promise.resolve([]),
  ]);
  const mapAssetById = new Map(mapAssets.map((asset) => [asset.id, mediaReference(asset)]));
  const sectorIdsByEvent = new Map<string, string[]>();
  for (const item of eventSectors) sectorIdsByEvent.set(item.settingEventId, [...(sectorIdsByEvent.get(item.settingEventId) ?? []), item.gymSectorId]);
  type SectorWithMedia = (typeof sectors)[number] & { mapMedia: ReturnType<typeof mediaReference> | null };
  const sectorsByWall = new Map<string, SectorWithMedia[]>();
  const sectorById = new Map<string, SectorWithMedia>();
  for (const sector of sectors) sectorsByWall.set(sector.wallId, [...(sectorsByWall.get(sector.wallId) ?? []), {
    ...sector,
    mapMedia: sector.mapMediaAssetId ? mapAssetById.get(sector.mapMediaAssetId) ?? null : null,
  }]);
  for (const wallSectors of sectorsByWall.values()) {
    for (const sector of wallSectors) sectorById.set(sector.id, sector);
  }
  const resolvedMedia = media.map((item) => ({ ...item, url: publicMediaUrl(item.storageKey) }));

  return {
    ...gym,
    cover: resolvedMedia.find((item) => item.type === 'cover') ?? null,
    media: resolvedMedia,
    operatingHours: hours,
    operatingHourOverrides: hourOverrides,
    prices,
    tags,
    grades,
    walls: walls.map((wall) => ({
      ...wall,
      mapMedia: wall.mapMediaAssetId ? mapAssetById.get(wall.mapMediaAssetId) ?? null : null,
      sectors: sectorsByWall.get(wall.id) ?? [],
    })),
    settingEvents: events.map((event) => ({
      ...event,
      sectors: (sectorIdsByEvent.get(event.id) ?? []).map((id) => sectorById.get(id)).filter(Boolean),
    })),
    sources,
  };
}
