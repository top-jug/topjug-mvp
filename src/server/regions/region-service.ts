import 'server-only';

import { asc, eq, inArray, sql } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { regions } from '../db/schema';
import { ApiError } from '../http/api-error';

export async function listRegions() {
  const data = await getDatabase()
    .select({
      code: regions.code,
      name: regions.name,
      level: regions.level,
      parentCode: regions.parentCode,
      sortOrder: regions.sortOrder,
    })
    .from(regions)
    .where(inArray(regions.level, [1, 2]))
    .orderBy(asc(regions.level), asc(regions.sortOrder), asc(regions.name));
  return { data };
}

export async function regionSubtreeCodes(regionCode: string) {
  const database = getDatabase();
  const [selected] = await database.select({ code: regions.code, level: regions.level }).from(regions).where(eq(regions.code, regionCode)).limit(1);
  if (!selected || ![1, 2].includes(selected.level)) {
    throw new ApiError(400, 'INVALID_REGION_CODE', '존재하는 지역만 선택할 수 있습니다.');
  }

  const rows = await database.execute<{ code: string }>(sql`
    with recursive region_tree as (
      select code from regions where code = ${regionCode}
      union all
      select child.code
      from regions child
      join region_tree parent on child.parent_code = parent.code
    )
    select code from region_tree
  `);
  return rows.map((row) => row.code);
}
