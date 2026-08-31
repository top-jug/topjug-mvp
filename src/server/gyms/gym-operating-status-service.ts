import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import {
  getSeoulOperatingMoment,
  resolveGymTodayOperatingStatus,
  type GymTodayOperatingStatus,
} from '../../entities/gym/operating-status';
import { getDatabase } from '../db/client';
import { gymOperatingHourOverrides, gymOperatingHours } from '../db/schema';

export async function loadGymTodayOperatingStatuses(gymIds: string[], now = new Date()) {
  const statuses = new Map<string, GymTodayOperatingStatus>();
  if (gymIds.length === 0) return statuses;

  const database = getDatabase();
  const moment = getSeoulOperatingMoment(now);
  const [weeklyHours, overrides] = await Promise.all([
    database.select({
      gymId: gymOperatingHours.gymId,
      dayOfWeek: gymOperatingHours.dayOfWeek,
      sequence: gymOperatingHours.sequence,
      opensAt: gymOperatingHours.opensAt,
      closesAt: gymOperatingHours.closesAt,
      isClosed: gymOperatingHours.isClosed,
    }).from(gymOperatingHours).where(and(
      inArray(gymOperatingHours.gymId, gymIds),
      eq(gymOperatingHours.dayOfWeek, moment.dayOfWeek),
    )),
    database.select({
      gymId: gymOperatingHourOverrides.gymId,
      date: gymOperatingHourOverrides.date,
      sequence: gymOperatingHourOverrides.sequence,
      opensAt: gymOperatingHourOverrides.opensAt,
      closesAt: gymOperatingHourOverrides.closesAt,
      isClosed: gymOperatingHourOverrides.isClosed,
    }).from(gymOperatingHourOverrides).where(and(
      inArray(gymOperatingHourOverrides.gymId, gymIds),
      eq(gymOperatingHourOverrides.date, moment.date),
    )),
  ]);

  for (const gymId of gymIds) {
    statuses.set(gymId, resolveGymTodayOperatingStatus(
      weeklyHours.filter((entry) => entry.gymId === gymId),
      overrides.filter((entry) => entry.gymId === gymId),
      now,
    ));
  }
  return statuses;
}
