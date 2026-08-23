import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const membershipType = pgEnum('membership_type', ['count', 'period']);
export const recordMode = pgEnum('record_mode', ['easy', 'normal']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'failure']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  homeRegionCode: text('home_region_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: uuid('id').primaryKey(),
    familyId: uuid('family_id').notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBySessionId: uuid('replaced_by_session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('refresh_sessions_user_idx').on(table.userId),
    index('refresh_sessions_family_idx').on(table.familyId),
    index('refresh_sessions_expires_idx').on(table.expiresAt),
  ],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: text('key_hash').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('login_attempts_key_time_idx').on(table.keyHash, table.attemptedAt),
    index('login_attempts_time_idx').on(table.attemptedAt),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    outcome: auditOutcome('outcome').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_events_actor_time_idx').on(table.actorUserId, table.occurredAt),
    index('audit_events_action_time_idx').on(table.action, table.occurredAt),
    index('audit_events_request_idx').on(table.requestId),
  ],
);

export const gyms = pgTable(
  'gyms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    branchName: text('branch_name'),
    address: text('address').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    facilities: text('facilities').array().notNull().default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('gyms_name_idx').on(table.name)],
);

export const gymGrades = pgTable(
  'gym_grades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    color: text('color').notNull(),
    rank: integer('rank').notNull(),
  },
  (table) => [
    uniqueIndex('gym_grades_gym_code_uidx').on(table.gymId, table.code),
    uniqueIndex('gym_grades_gym_rank_uidx').on(table.gymId, table.rank),
  ],
);

export const savedGyms = pgTable(
  'saved_gyms',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('saved_gyms_user_gym_uidx').on(table.userId, table.gymId)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id').references(() => gyms.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: membershipType('type').notNull(),
    totalUses: integer('total_uses'),
    remainingUses: integer('remaining_uses'),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    note: text('note'),
    homeFavorite: boolean('home_favorite').notNull().default(false),
    homeOrder: integer('home_order'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memberships_user_idx').on(table.userId),
    check('memberships_valid_range_check', sql`${table.validUntil} >= ${table.validFrom}`),
    check('memberships_type_fields_check', sql`(
      (${table.type} = 'count' AND ${table.totalUses} IS NOT NULL AND ${table.remainingUses} IS NOT NULL
        AND ${table.totalUses} >= 0 AND ${table.remainingUses} >= 0 AND ${table.remainingUses} <= ${table.totalUses})
      OR (${table.type} = 'period' AND ${table.totalUses} IS NULL AND ${table.remainingUses} IS NULL)
    )`),
  ],
);

export const settingEvents = pgTable(
  'setting_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    wallName: text('wall_name'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('setting_events_gym_starts_idx').on(table.gymId, table.startsAt)],
);

export const climbingRecords = pgTable(
  'climbing_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'set null' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    rating: numeric('rating', { precision: 2, scale: 1, mode: 'number' }),
    mode: recordMode('mode').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('climbing_records_user_created_idx').on(table.userId, table.createdAt),
    index('climbing_records_user_started_idx').on(table.userId, table.startedAt),
    index('climbing_records_gym_started_idx').on(table.gymId, table.startedAt),
    check('climbing_records_time_range_check', sql`${table.endedAt} >= ${table.startedAt}`),
    check('climbing_records_rating_check', sql`${table.rating} IS NULL OR (${table.rating} >= 0.5 AND ${table.rating} <= 5)`),
  ],
);

export const recordCounts = pgTable(
  'record_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id').notNull().references(() => climbingRecords.id, { onDelete: 'cascade' }),
    gymGradeId: uuid('gym_grade_id').notNull().references(() => gymGrades.id, { onDelete: 'restrict' }),
    sectorCode: text('sector_code'),
    attempts: integer('attempts').notNull(),
    sends: integer('sends').notNull(),
  },
  (table) => [
    unique('record_counts_record_grade_sector_uidx')
      .on(table.recordId, table.gymGradeId, table.sectorCode)
      .nullsNotDistinct(),
    index('record_counts_record_idx').on(table.recordId),
    check('record_counts_nonnegative_check', sql`${table.attempts} >= 0 AND ${table.sends} >= 0`),
    check('record_counts_sends_check', sql`${table.sends} <= ${table.attempts}`),
  ],
);
