import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '../db/client';
import { gymTags } from '../db/schema';

export function listActiveGymTags() {
  return getDatabase().select({
    code: gymTags.code,
    label: gymTags.label,
    description: gymTags.description,
    sortOrder: gymTags.sortOrder,
  }).from(gymTags)
    .where(eq(gymTags.isActive, true))
    .orderBy(asc(gymTags.sortOrder), asc(gymTags.label), asc(gymTags.id));
}
