import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const membershipType = pgEnum('membership_type', ['count', 'period']);
export const userRole = pgEnum('user_role', ['user', 'operations_admin']);
export const recordMode = pgEnum('record_mode', ['easy', 'normal']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'failure']);
export const gymOperationStatus = pgEnum('gym_operation_status', ['active', 'temporarily_closed', 'closed', 'opening_soon']);
export const gymSourceType = pgEnum('gym_source_type', ['operator', 'official_site', 'public_data', 'user_report']);
export const mediaStatus = pgEnum('media_status', ['pending', 'ready', 'deleted']);
export const gymMediaType = pgEnum('gym_media_type', ['logo', 'cover', 'photo', 'map', 'sector_map']);
export const gymPriceType = pgEnum('gym_price_type', ['day_pass', 'shoe_rental']);
export const settingEventStatus = pgEnum('setting_event_status', ['scheduled', 'completed', 'cancelled']);
export const recordAccessType = pgEnum('record_access_type', ['day_pass', 'membership', 'other']);
export const recordStatus = pgEnum('record_status', ['in_progress', 'completed', 'cancelled']);
export const membershipUsageType = pgEnum('membership_usage_type', ['consume', 'restore', 'adjustment']);
export const recordShareStatus = pgEnum('record_share_status', ['active', 'revoked', 'expired']);

export const regions = pgTable('regions', {
  code: text('code').primaryKey(),
  parentCode: text('parent_code').references((): AnyPgColumn => regions.code, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  level: integer('level').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  index('regions_parent_idx').on(table.parentCode),
  check('regions_level_check', sql`${table.level} >= 0`),
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('user'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  homeRegionCode: text('home_region_code').references(() => regions.code, { onDelete: 'set null' }),
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
    index('refresh_sessions_revoked_idx').on(table.revokedAt),
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

export type EmailVerificationPurpose = 'register' | 'reset_password';

export const emailVerificationChallenges = pgTable(
  'email_verification_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    purpose: text('purpose').$type<EmailVerificationPurpose>().notNull(),
    codeHash: text('code_hash').notNull(),
    tokenHash: text('token_hash'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('email_verification_email_purpose_idx').on(table.email, table.purpose, table.createdAt),
    index('email_verification_expires_idx').on(table.expiresAt),
    uniqueIndex('email_verification_token_uidx').on(table.tokenHash).where(sql`${table.tokenHash} IS NOT NULL`),
    check('email_verification_purpose_check', sql`${table.purpose} IN ('register', 'reset_password')`),
    check('email_verification_attempts_check', sql`${table.attempts} BETWEEN 0 AND 5`),
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
    index('audit_events_occurred_idx').on(table.occurredAt),
  ],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    storageKey: text('storage_key').notNull().unique(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    checksumSha256: text('checksum_sha256'),
    status: mediaStatus('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('media_assets_owner_idx').on(table.ownerUserId),
    check('media_assets_byte_size_check', sql`${table.byteSize} >= 0`),
    check('media_assets_lifecycle_check', sql`(
      (${table.status} = 'pending' AND ${table.readyAt} IS NULL AND ${table.deletedAt} IS NULL)
      OR (${table.status} = 'ready' AND ${table.readyAt} IS NOT NULL AND ${table.deletedAt} IS NULL)
      OR (${table.status} = 'deleted' AND ${table.deletedAt} IS NOT NULL)
    )`),
  ],
);

export const gymBrands = pgTable('gym_brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  websiteUrl: text('website_url'),
  instagramUrl: text('instagram_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gyms = pgTable(
  'gyms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id').references(() => gymBrands.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    branchName: text('branch_name'),
    address: text('address').notNull(),
    regionCode: text('region_code').references(() => regions.code, { onDelete: 'set null' }),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    phone: text('phone'),
    websiteUrl: text('website_url'),
    instagramUrl: text('instagram_url'),
    nearbyDirections: text('nearby_directions'),
    operatingHoursNote: text('operating_hours_note'),
    parkingInfo: text('parking_info'),
    operationStatus: gymOperationStatus('operation_status').notNull().default('active'),
    calendarColor: text('calendar_color'),
    calendarTextColor: text('calendar_text_color'),
    facilities: text('facilities').array().notNull().default(sql`ARRAY[]::text[]`),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('gyms_name_idx').on(table.name),
    index('gyms_region_idx').on(table.regionCode),
    index('gyms_brand_idx').on(table.brandId),
    check('gyms_coordinates_pair_check', sql`(${table.latitude} IS NULL) = (${table.longitude} IS NULL)`),
    check('gyms_latitude_check', sql`${table.latitude} IS NULL OR ${table.latitude} BETWEEN -90 AND 90`),
    check('gyms_longitude_check', sql`${table.longitude} IS NULL OR ${table.longitude} BETWEEN -180 AND 180`),
  ],
);

export const gymPrices = pgTable(
  'gym_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    type: gymPriceType('type').notNull(),
    amount: integer('amount'),
    currency: text('currency').notNull().default('KRW'),
    rawText: text('raw_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gym_prices_gym_type_uidx').on(table.gymId, table.type),
    index('gym_prices_gym_idx').on(table.gymId),
    check('gym_prices_amount_check', sql`${table.amount} IS NULL OR ${table.amount} >= 0`),
  ],
);

export const gymSources = pgTable(
  'gym_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    type: gymSourceType('type').notNull(),
    sourceName: text('source_name').notNull(),
    sourceUrl: text('source_url'),
    externalId: text('external_id'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gym_sources_name_external_uidx').on(table.sourceName, table.externalId),
    index('gym_sources_gym_idx').on(table.gymId),
  ],
);

export const gymMedia = pgTable(
  'gym_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    mediaAssetId: uuid('media_asset_id').notNull().references(() => mediaAssets.id, { onDelete: 'restrict' }),
    type: gymMediaType('type').notNull(),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gym_media_gym_asset_type_uidx').on(table.gymId, table.mediaAssetId, table.type),
    uniqueIndex('gym_media_type_order_uidx').on(table.gymId, table.type, table.sortOrder),
    uniqueIndex('gym_media_cover_uidx').on(table.gymId).where(sql`${table.type} = 'cover'`),
    uniqueIndex('gym_media_logo_uidx').on(table.gymId).where(sql`${table.type} = 'logo'`),
    index('gym_media_gym_idx').on(table.gymId),
  ],
);

export const gymOperatingHours = pgTable(
  'gym_operating_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    sequence: integer('sequence').notNull().default(0),
    opensAt: time('opens_at'),
    closesAt: time('closes_at'),
    isClosed: boolean('is_closed').notNull().default(false),
  },
  (table) => [
    uniqueIndex('gym_operating_hours_day_sequence_uidx').on(table.gymId, table.dayOfWeek, table.sequence),
    check('gym_operating_hours_day_check', sql`${table.dayOfWeek} BETWEEN 0 AND 6`),
    check('gym_operating_hours_value_check', sql`(
      (${table.isClosed} AND ${table.opensAt} IS NULL AND ${table.closesAt} IS NULL)
      OR (NOT ${table.isClosed} AND ${table.opensAt} IS NOT NULL AND ${table.closesAt} IS NOT NULL)
    )`),
  ],
);

export const gymOperatingHourOverrides = pgTable(
  'gym_operating_hour_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    sequence: integer('sequence').notNull().default(0),
    opensAt: time('opens_at'),
    closesAt: time('closes_at'),
    isClosed: boolean('is_closed').notNull().default(false),
    note: text('note'),
  },
  (table) => [
    uniqueIndex('gym_operating_overrides_date_sequence_uidx').on(table.gymId, table.date, table.sequence),
    check('gym_operating_overrides_value_check', sql`(
      (${table.isClosed} AND ${table.opensAt} IS NULL AND ${table.closesAt} IS NULL)
      OR (NOT ${table.isClosed} AND ${table.opensAt} IS NOT NULL AND ${table.closesAt} IS NOT NULL)
    )`),
  ],
);

export const gymTags = pgTable(
  'gym_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    label: text('label').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('gym_tags_active_order_idx').on(table.isActive, table.sortOrder, table.label)],
);

export const gymTagAssignments = pgTable(
  'gym_tag_assignments',
  {
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id').notNull().references(() => gymTags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.gymId, table.tagId] }),
    index('gym_tag_assignments_tag_idx').on(table.tagId),
  ],
);

export const gymGrades = pgTable(
  'gym_grades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    color: text('color').notNull(),
    standardCode: text('standard_code'),
    rank: integer('rank').notNull(),
  },
  (table) => [
    unique('gym_grades_id_gym_unique').on(table.id, table.gymId),
    uniqueIndex('gym_grades_gym_code_uidx').on(table.gymId, table.code),
    uniqueIndex('gym_grades_gym_rank_uidx').on(table.gymId, table.rank),
  ],
);

export const gymWalls = pgTable(
  'gym_walls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    mapMediaAssetId: uuid('map_media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('gym_walls_id_gym_unique').on(table.id, table.gymId),
    uniqueIndex('gym_walls_gym_code_uidx').on(table.gymId, table.code),
    uniqueIndex('gym_walls_gym_order_uidx').on(table.gymId, table.sortOrder),
  ],
);

export const gymSectors = pgTable(
  'gym_sectors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    wallId: uuid('wall_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    mapMediaAssetId: uuid('map_media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('gym_sectors_id_gym_unique').on(table.id, table.gymId),
    foreignKey({
      columns: [table.wallId, table.gymId],
      foreignColumns: [gymWalls.id, gymWalls.gymId],
      name: 'gym_sectors_wall_gym_fk',
    }).onDelete('cascade'),
    uniqueIndex('gym_sectors_wall_code_uidx').on(table.wallId, table.code),
    uniqueIndex('gym_sectors_wall_order_uidx').on(table.wallId, table.sortOrder),
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
    name: text('name').notNull(),
    type: membershipType('type').notNull(),
    totalUses: integer('total_uses'),
    remainingUses: integer('remaining_uses'),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    note: text('note'),
    homeFavorite: boolean('home_favorite').notNull().default(false),
    homeOrder: integer('home_order'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('memberships_user_idx').on(table.userId),
    unique('memberships_id_user_unique').on(table.id, table.userId),
    check('memberships_valid_range_check', sql`${table.validUntil} >= ${table.validFrom}`),
    check('memberships_type_fields_check', sql`(
      (${table.type} = 'count' AND ${table.totalUses} IS NOT NULL AND ${table.remainingUses} IS NOT NULL
        AND ${table.totalUses} >= 0 AND ${table.remainingUses} >= 0 AND ${table.remainingUses} <= ${table.totalUses})
      OR (${table.type} = 'period' AND ${table.totalUses} IS NULL AND ${table.remainingUses} IS NULL)
    )`),
    uniqueIndex('memberships_user_home_order_uidx').on(table.userId, table.homeOrder),
    check('memberships_home_order_check', sql`(
      (${table.homeFavorite} AND ${table.homeOrder} IS NOT NULL AND ${table.homeOrder} BETWEEN 0 AND 2)
      OR (NOT ${table.homeFavorite} AND ${table.homeOrder} IS NULL)
    )`),
  ],
);

export const membershipGyms = pgTable(
  'membership_gyms',
  {
    membershipId: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'restrict' }),
  },
  (table) => [primaryKey({ columns: [table.membershipId, table.gymId] })],
);

export const settingEvents = pgTable(
  'setting_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'cascade' }),
    title: text('title'),
    status: settingEventStatus('status').notNull().default('scheduled'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('setting_events_id_gym_unique').on(table.id, table.gymId),
    index('setting_events_gym_starts_idx').on(table.gymId, table.startsAt),
    check('setting_events_time_range_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`),
  ],
);

export const settingEventSectors = pgTable(
  'setting_event_sectors',
  {
    settingEventId: uuid('setting_event_id').notNull(),
    gymSectorId: uuid('gym_sector_id').notNull(),
    gymId: uuid('gym_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.settingEventId, table.gymSectorId] }),
    foreignKey({
      columns: [table.settingEventId, table.gymId],
      foreignColumns: [settingEvents.id, settingEvents.gymId],
      name: 'setting_event_sectors_event_gym_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.gymSectorId, table.gymId],
      foreignColumns: [gymSectors.id, gymSectors.gymId],
      name: 'setting_event_sectors_sector_gym_fk',
    }).onDelete('restrict'),
  ],
);

export const climbingRecords = pgTable(
  'climbing_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    gymId: uuid('gym_id').notNull().references(() => gyms.id, { onDelete: 'restrict' }),
    membershipId: uuid('membership_id'),
    accessType: recordAccessType('access_type').notNull(),
    status: recordStatus('status').notNull().default('completed'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    activeDurationSeconds: integer('active_duration_seconds'),
    rating: numeric('rating', { precision: 2, scale: 1, mode: 'number' }),
    mode: recordMode('mode').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('climbing_records_id_gym_unique').on(table.id, table.gymId),
    foreignKey({
      columns: [table.membershipId, table.userId],
      foreignColumns: [memberships.id, memberships.userId],
      name: 'climbing_records_membership_owner_fk',
    }).onDelete('no action'),
    foreignKey({
      columns: [table.membershipId, table.gymId],
      foreignColumns: [membershipGyms.membershipId, membershipGyms.gymId],
      name: 'climbing_records_membership_gym_fk',
    }).onDelete('no action'),
    index('climbing_records_user_created_idx').on(table.userId, table.createdAt),
    index('climbing_records_user_started_idx').on(table.userId, table.startedAt),
    index('climbing_records_gym_started_idx').on(table.gymId, table.startedAt),
    uniqueIndex('climbing_records_user_active_uidx').on(table.userId).where(sql`${table.status} = 'in_progress'`),
    check('climbing_records_time_range_check', sql`${table.endedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`),
    check('climbing_records_status_check', sql`(
      (${table.status} = 'in_progress' AND ${table.endedAt} IS NULL)
      OR (${table.status} IN ('completed', 'cancelled') AND ${table.endedAt} IS NOT NULL)
    )`),
    check('climbing_records_access_check', sql`(
      (${table.accessType} = 'membership' AND ${table.membershipId} IS NOT NULL)
      OR (${table.accessType} IN ('day_pass', 'other') AND ${table.membershipId} IS NULL)
    )`),
    check('climbing_records_duration_check', sql`${table.activeDurationSeconds} IS NULL OR ${table.activeDurationSeconds} >= 0`),
    check('climbing_records_rating_check', sql`${table.rating} IS NULL OR (
      ${table.rating} >= 0.5 AND ${table.rating} <= 5 AND mod(${table.rating}, 0.5) = 0
    )`),
  ],
);

export const recordPauses = pgTable(
  'record_pauses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id').notNull().references(() => climbingRecords.id, { onDelete: 'cascade' }),
    pausedAt: timestamp('paused_at', { withTimezone: true }).notNull(),
    resumedAt: timestamp('resumed_at', { withTimezone: true }),
  },
  (table) => [
    index('record_pauses_record_idx').on(table.recordId),
    uniqueIndex('record_pauses_open_uidx').on(table.recordId).where(sql`${table.resumedAt} IS NULL`),
    check('record_pauses_time_range_check', sql`${table.resumedAt} IS NULL OR ${table.resumedAt} >= ${table.pausedAt}`),
  ],
);

export const recordCounts = pgTable(
  'record_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id').notNull(),
    gymId: uuid('gym_id').notNull(),
    gymGradeId: uuid('gym_grade_id').notNull(),
    gymSectorId: uuid('gym_sector_id').notNull(),
    attempts: integer('attempts').notNull(),
    sends: integer('sends').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.recordId, table.gymId],
      foreignColumns: [climbingRecords.id, climbingRecords.gymId],
      name: 'record_counts_record_gym_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.gymGradeId, table.gymId],
      foreignColumns: [gymGrades.id, gymGrades.gymId],
      name: 'record_counts_grade_gym_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.gymSectorId, table.gymId],
      foreignColumns: [gymSectors.id, gymSectors.gymId],
      name: 'record_counts_sector_gym_fk',
    }).onDelete('restrict'),
    uniqueIndex('record_counts_record_grade_sector_uidx').on(table.recordId, table.gymGradeId, table.gymSectorId),
    index('record_counts_record_idx').on(table.recordId),
    check('record_counts_nonnegative_check', sql`${table.attempts} >= 0 AND ${table.sends} >= 0`),
    check('record_counts_sends_check', sql`${table.sends} <= ${table.attempts}`),
  ],
);

export const membershipUsages = pgTable(
  'membership_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    membershipId: uuid('membership_id').notNull().references(() => memberships.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').references(() => climbingRecords.id, { onDelete: 'set null' }),
    type: membershipUsageType('type').notNull(),
    delta: integer('delta').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('membership_usages_record_type_uidx').on(table.recordId, table.type),
    index('membership_usages_membership_time_idx').on(table.membershipId, table.occurredAt),
    check('membership_usages_balance_check', sql`${table.balanceAfter} >= 0`),
    check('membership_usages_delta_check', sql`${table.delta} <> 0`),
  ],
);

export const recordShares = pgTable(
  'record_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id').notNull().references(() => climbingRecords.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
    status: recordShareStatus('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('record_shares_record_idx').on(table.recordId),
    index('record_shares_expires_idx').on(table.expiresAt),
    check('record_shares_lifecycle_check', sql`(
      (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)
      OR (${table.status} IN ('active', 'expired') AND ${table.revokedAt} IS NULL)
    )`),
  ],
);
