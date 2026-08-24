import 'server-only';

import { and, desc, eq, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { climbingRecords, gyms } from '../db/schema';

export async function listRecentVisitedGyms(userId: string) {
  const database = getDatabase();
  const latestVisitPerGym = database
    .selectDistinctOn([climbingRecords.gymId], {
      recordId: sql<string>`${climbingRecords.id}`.as('record_id'),
      gymId: sql<string>`${gyms.id}`.as('gym_id'),
      gymName: sql<string>`${gyms.name}`.as('gym_name'),
      gymBranchName: sql<string | null>`${gyms.branchName}`.as('gym_branch_name'),
      lastVisitedAt: sql<Date>`${climbingRecords.startedAt}`.mapWith(climbingRecords.startedAt).as('last_visited_at'),
    })
    .from(climbingRecords)
    .innerJoin(gyms, eq(climbingRecords.gymId, gyms.id))
    .where(and(eq(climbingRecords.userId, userId), eq(climbingRecords.status, 'completed')))
    .orderBy(climbingRecords.gymId, desc(climbingRecords.startedAt), desc(climbingRecords.id))
    .as('latest_visit_per_gym');

  const rows = await database
    .select({
      gym: {
        id: latestVisitPerGym.gymId,
        name: latestVisitPerGym.gymName,
        branchName: latestVisitPerGym.gymBranchName,
      },
      lastVisitedAt: latestVisitPerGym.lastVisitedAt,
    })
    .from(latestVisitPerGym)
    .orderBy(desc(latestVisitPerGym.lastVisitedAt), desc(latestVisitPerGym.recordId))
    .limit(3);

  return { data: rows };
}
