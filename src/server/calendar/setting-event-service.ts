import 'server-only';

import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { gymMedia, gymSectors, gyms, gymWalls, mediaAssets, settingEvents, settingEventSectors } from '../db/schema';
import { publicMediaUrl } from '../media/media-url';
import { ListSettingEventsInput } from './setting-event-validation';

export async function listSettingEvents(input: ListSettingEventsInput) {
  const database = getDatabase();
  const conditions = [
    lte(settingEvents.startsAt, new Date(input.to)),
    or(
      gte(settingEvents.endsAt, new Date(input.from)),
      and(isNull(settingEvents.endsAt), gte(settingEvents.startsAt, new Date(input.from))),
    )!,
  ];
  if (input.gymId) conditions.push(eq(settingEvents.gymId, input.gymId));
  if (input.status) conditions.push(eq(settingEvents.status, input.status));
  const events = await database.select({
    id: settingEvents.id,
    title: settingEvents.title,
    status: settingEvents.status,
    startsAt: settingEvents.startsAt,
    endsAt: settingEvents.endsAt,
    note: settingEvents.note,
    gym: {
      id: gyms.id,
      name: gyms.name,
      branchName: gyms.branchName,
      address: gyms.address,
      calendarColor: gyms.calendarColor,
      calendarTextColor: gyms.calendarTextColor,
    },
  }).from(settingEvents)
    .innerJoin(gyms, eq(settingEvents.gymId, gyms.id))
    .where(and(...conditions))
    .orderBy(asc(settingEvents.startsAt), asc(gyms.name));
  const eventIds = events.map((event) => event.id);
  const gymIds = [...new Set(events.map((event) => event.gym.id))];
  const [sectors, logos] = await Promise.all([
    eventIds.length > 0 ? database.select({
      settingEventId: settingEventSectors.settingEventId,
      id: gymSectors.id,
      code: gymSectors.code,
      name: gymSectors.name,
      sortOrder: gymSectors.sortOrder,
      isActive: gymSectors.isActive,
      wall: { id: gymWalls.id, code: gymWalls.code, name: gymWalls.name },
    }).from(settingEventSectors)
      .innerJoin(gymSectors, eq(settingEventSectors.gymSectorId, gymSectors.id))
      .innerJoin(gymWalls, eq(gymSectors.wallId, gymWalls.id))
      .where(inArray(settingEventSectors.settingEventId, eventIds))
      .orderBy(gymWalls.sortOrder, gymSectors.sortOrder)
      : Promise.resolve([]),
    gymIds.length > 0 ? database.select({
      gymId: gymMedia.gymId,
      id: mediaAssets.id,
      storageKey: mediaAssets.storageKey,
      contentType: mediaAssets.contentType,
    })
      .from(gymMedia).innerJoin(mediaAssets, eq(gymMedia.mediaAssetId, mediaAssets.id))
      .where(and(inArray(gymMedia.gymId, gymIds), eq(gymMedia.type, 'logo'), eq(mediaAssets.status, 'ready')))
      .orderBy(gymMedia.sortOrder)
      : Promise.resolve([]),
  ]);
  const sectorsByEvent = new Map<string, Array<Omit<(typeof sectors)[number], 'settingEventId'>>>();
  for (const sector of sectors) {
    const { settingEventId, ...value } = sector;
    sectorsByEvent.set(settingEventId, [...(sectorsByEvent.get(settingEventId) ?? []), value]);
  }
  const logoByGym = new Map<string, (typeof logos)[number] & { url: string | null }>();
  for (const logo of logos) {
    if (!logoByGym.has(logo.gymId)) logoByGym.set(logo.gymId, { ...logo, url: publicMediaUrl(logo.storageKey) });
  }
  return { data: events.map((event) => ({
    ...event,
    gym: { ...event.gym, logo: logoByGym.get(event.gym.id) ?? null },
    sectors: sectorsByEvent.get(event.id) ?? [],
  })) };
}
