CREATE TYPE "public"."gym_media_type" AS ENUM('logo', 'cover', 'photo', 'map', 'sector_map');--> statement-breakpoint
CREATE TYPE "public"."gym_operation_status" AS ENUM('active', 'temporarily_closed', 'closed', 'opening_soon');--> statement-breakpoint
CREATE TYPE "public"."gym_price_type" AS ENUM('day_pass', 'shoe_rental');--> statement-breakpoint
CREATE TYPE "public"."gym_source_type" AS ENUM('operator', 'official_site', 'public_data', 'user_report');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."membership_usage_type" AS ENUM('consume', 'restore', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."record_access_type" AS ENUM('day_pass', 'membership', 'other');--> statement-breakpoint
CREATE TYPE "public"."record_session_type" AS ENUM('free', 'training', 'project');--> statement-breakpoint
CREATE TYPE "public"."record_share_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."setting_event_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "gym_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"instagram_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "gym_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"type" "gym_media_type" NOT NULL,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_operating_hour_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"date" date NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "gym_operating_overrides_value_check" CHECK ((
      ("gym_operating_hour_overrides"."is_closed" AND "gym_operating_hour_overrides"."opens_at" IS NULL AND "gym_operating_hour_overrides"."closes_at" IS NULL)
      OR (NOT "gym_operating_hour_overrides"."is_closed" AND "gym_operating_hour_overrides"."opens_at" IS NOT NULL AND "gym_operating_hour_overrides"."closes_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "gym_operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "gym_operating_hours_day_check" CHECK ("gym_operating_hours"."day_of_week" BETWEEN 0 AND 6),
	CONSTRAINT "gym_operating_hours_value_check" CHECK ((
      ("gym_operating_hours"."is_closed" AND "gym_operating_hours"."opens_at" IS NULL AND "gym_operating_hours"."closes_at" IS NULL)
      OR (NOT "gym_operating_hours"."is_closed" AND "gym_operating_hours"."opens_at" IS NOT NULL AND "gym_operating_hours"."closes_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "gym_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"type" "gym_price_type" NOT NULL,
	"amount" integer,
	"currency" text DEFAULT 'KRW' NOT NULL,
	"raw_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_prices_amount_check" CHECK ("gym_prices"."amount" IS NULL OR "gym_prices"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "gym_sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"wall_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"map_media_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_sectors_id_gym_unique" UNIQUE("id","gym_id")
);
--> statement-breakpoint
CREATE TABLE "gym_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"type" "gym_source_type" NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"external_id" text,
	"verified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_tag_assignments" (
	"gym_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "gym_tag_assignments_gym_id_tag_id_pk" PRIMARY KEY("gym_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "gym_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "gym_tags_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gym_walls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"map_media_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_walls_id_gym_unique" UNIQUE("id","gym_id")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"checksum_sha256" text,
	"status" "media_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_assets_byte_size_check" CHECK ("media_assets"."byte_size" >= 0),
	CONSTRAINT "media_assets_lifecycle_check" CHECK ((
      ("media_assets"."status" = 'pending' AND "media_assets"."ready_at" IS NULL AND "media_assets"."deleted_at" IS NULL)
      OR ("media_assets"."status" = 'ready' AND "media_assets"."ready_at" IS NOT NULL AND "media_assets"."deleted_at" IS NULL)
      OR ("media_assets"."status" = 'deleted' AND "media_assets"."deleted_at" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "membership_gyms" (
	"membership_id" uuid NOT NULL,
	"gym_id" uuid NOT NULL,
	CONSTRAINT "membership_gyms_membership_id_gym_id_pk" PRIMARY KEY("membership_id","gym_id")
);
--> statement-breakpoint
CREATE TABLE "membership_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"record_id" uuid,
	"type" "membership_usage_type" NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_usages_balance_check" CHECK ("membership_usages"."balance_after" >= 0),
	CONSTRAINT "membership_usages_delta_check" CHECK ("membership_usages"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "record_pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"paused_at" timestamp with time zone NOT NULL,
	"resumed_at" timestamp with time zone,
	CONSTRAINT "record_pauses_time_range_check" CHECK ("record_pauses"."resumed_at" IS NULL OR "record_pauses"."resumed_at" >= "record_pauses"."paused_at")
);
--> statement-breakpoint
CREATE TABLE "record_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"media_asset_id" uuid,
	"status" "record_share_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_shares_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "record_shares_lifecycle_check" CHECK ((
      ("record_shares"."status" = 'revoked' AND "record_shares"."revoked_at" IS NOT NULL)
      OR ("record_shares"."status" IN ('active', 'expired') AND "record_shares"."revoked_at" IS NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"parent_code" text,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "regions_level_check" CHECK ("regions"."level" >= 0)
);
--> statement-breakpoint
CREATE TABLE "setting_event_sectors" (
	"setting_event_id" uuid NOT NULL,
	"gym_sector_id" uuid NOT NULL,
	"gym_id" uuid NOT NULL,
	CONSTRAINT "setting_event_sectors_setting_event_id_gym_sector_id_pk" PRIMARY KEY("setting_event_id","gym_sector_id")
);
--> statement-breakpoint
ALTER TABLE "climbing_records" DROP CONSTRAINT "climbing_records_time_range_check";--> statement-breakpoint
ALTER TABLE "climbing_records" DROP CONSTRAINT "climbing_records_rating_check";--> statement-breakpoint
ALTER TABLE "climbing_records" DROP CONSTRAINT "climbing_records_membership_id_memberships_id_fk";
--> statement-breakpoint
ALTER TABLE "record_counts" DROP CONSTRAINT "record_counts_record_id_climbing_records_id_fk";
--> statement-breakpoint
ALTER TABLE "record_counts" DROP CONSTRAINT "record_counts_gym_grade_id_gym_grades_id_fk";
--> statement-breakpoint
ALTER TABLE "climbing_records" ALTER COLUMN "ended_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD COLUMN "access_type" "record_access_type";--> statement-breakpoint
ALTER TABLE "climbing_records" ADD COLUMN "status" "record_status" DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD COLUMN "session_type" "record_session_type" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD COLUMN "active_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "gym_grades" ADD COLUMN "standard_code" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "region_code" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "nearby_directions" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "operating_hours_note" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "parking_info" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "operation_status" "gym_operation_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "calendar_color" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "calendar_text_color" text;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "record_counts" ADD COLUMN "gym_id" uuid;--> statement-breakpoint
ALTER TABLE "record_counts" ADD COLUMN "gym_sector_id" uuid;--> statement-breakpoint
ALTER TABLE "setting_events" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "setting_events" ADD COLUMN "status" "setting_event_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "setting_events" ADD COLUMN "note" text;--> statement-breakpoint
UPDATE "climbing_records" AS record
SET "membership_id" = NULL
WHERE "membership_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "memberships" AS membership
    WHERE membership."id" = record."membership_id"
      AND membership."user_id" = record."user_id"
  );--> statement-breakpoint
INSERT INTO "membership_gyms" ("membership_id", "gym_id")
SELECT "id", "gym_id" FROM "memberships" WHERE "gym_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "membership_gyms" ("membership_id", "gym_id")
SELECT DISTINCT "membership_id", "gym_id" FROM "climbing_records" WHERE "membership_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "climbing_records"
SET "access_type" = CASE WHEN "membership_id" IS NULL THEN 'other'::"record_access_type" ELSE 'membership'::"record_access_type" END,
    "active_duration_seconds" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("ended_at" - "started_at")))::integer);--> statement-breakpoint
ALTER TABLE "climbing_records" ALTER COLUMN "access_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_gym_id_gyms_id_fk";--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "gym_id";--> statement-breakpoint
UPDATE "memberships" SET "home_favorite" = false, "home_order" = NULL
WHERE ("home_favorite" AND ("home_order" IS NULL OR "home_order" NOT BETWEEN 0 AND 2))
   OR (NOT "home_favorite" AND "home_order" IS NOT NULL);--> statement-breakpoint
WITH duplicate_home_orders AS (
  SELECT "id", row_number() OVER (PARTITION BY "user_id", "home_order" ORDER BY "created_at", "id") AS position
  FROM "memberships" WHERE "home_favorite"
)
UPDATE "memberships" SET "home_favorite" = false, "home_order" = NULL
WHERE "id" IN (SELECT "id" FROM duplicate_home_orders WHERE position > 1);--> statement-breakpoint
ALTER TABLE "record_counts" DROP CONSTRAINT "record_counts_record_grade_sector_uidx";--> statement-breakpoint
UPDATE "record_counts" AS count
SET "gym_id" = record."gym_id"
FROM "climbing_records" AS record
WHERE record."id" = count."record_id";--> statement-breakpoint
INSERT INTO "gym_walls" ("gym_id", "code", "name", "sort_order")
SELECT DISTINCT record."gym_id", 'legacy', 'Legacy', 0
FROM "record_counts" AS count
JOIN "climbing_records" AS record ON record."id" = count."record_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH normalized_sectors AS (
  SELECT DISTINCT record."gym_id", COALESCE(NULLIF(BTRIM(count."sector_code"), ''), 'unspecified') AS code
  FROM "record_counts" AS count
  JOIN "climbing_records" AS record ON record."id" = count."record_id"
), ordered_sectors AS (
  SELECT "gym_id", code, row_number() OVER (PARTITION BY "gym_id" ORDER BY code) - 1 AS sort_order
  FROM normalized_sectors
)
INSERT INTO "gym_sectors" ("gym_id", "wall_id", "code", "name", "sort_order")
SELECT sector."gym_id", wall."id", sector.code, sector.code, sector.sort_order
FROM ordered_sectors AS sector
JOIN "gym_walls" AS wall ON wall."gym_id" = sector."gym_id" AND wall."code" = 'legacy'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "record_counts" AS count
SET "gym_sector_id" = sector."id"
FROM "gym_sectors" AS sector
WHERE sector."gym_id" = count."gym_id"
  AND sector."code" = COALESCE(NULLIF(BTRIM(count."sector_code"), ''), 'unspecified');--> statement-breakpoint
CREATE TEMPORARY TABLE "record_count_merge" ON COMMIT DROP AS
SELECT min("id"::text)::uuid AS keep_id, "record_id", "gym_grade_id", "gym_sector_id",
       sum("attempts")::integer AS attempts, sum("sends")::integer AS sends
FROM "record_counts"
GROUP BY "record_id", "gym_grade_id", "gym_sector_id"
HAVING count(*) > 1;--> statement-breakpoint
UPDATE "record_counts" AS count
SET "attempts" = merged.attempts, "sends" = merged.sends
FROM "record_count_merge" AS merged
WHERE count."id" = merged.keep_id;--> statement-breakpoint
DELETE FROM "record_counts" AS count
USING "record_count_merge" AS merged
WHERE count."record_id" = merged."record_id"
  AND count."gym_grade_id" = merged."gym_grade_id"
  AND count."gym_sector_id" = merged."gym_sector_id"
  AND count."id" <> merged.keep_id;--> statement-breakpoint
ALTER TABLE "record_counts" ALTER COLUMN "gym_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "record_counts" ALTER COLUMN "gym_sector_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "record_counts" DROP COLUMN "sector_code";--> statement-breakpoint
UPDATE "setting_events" SET "title" = NULLIF(BTRIM("wall_name"), '');--> statement-breakpoint
UPDATE "setting_events" SET "ends_at" = NULL WHERE "ends_at" < "starts_at";--> statement-breakpoint
ALTER TABLE "setting_events" DROP COLUMN "wall_name";--> statement-breakpoint
UPDATE "climbing_records" SET "rating" = NULL
WHERE "rating" IS NOT NULL AND ("rating" < 0.5 OR "rating" > 5 OR mod("rating", 0.5) <> 0);--> statement-breakpoint
UPDATE "gyms" SET "latitude" = NULL, "longitude" = NULL
WHERE ("latitude" IS NULL) <> ("longitude" IS NULL)
   OR "latitude" NOT BETWEEN -90 AND 90
   OR "longitude" NOT BETWEEN -180 AND 180;--> statement-breakpoint
INSERT INTO "regions" ("code", "name", "level", "sort_order")
SELECT DISTINCT "home_region_code", "home_region_code", 0, 0
FROM "users" WHERE "home_region_code" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_id_gym_unique" UNIQUE("id","gym_id");--> statement-breakpoint
ALTER TABLE "gym_grades" ADD CONSTRAINT "gym_grades_id_gym_unique" UNIQUE("id","gym_id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_id_user_unique" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "setting_events" ADD CONSTRAINT "setting_events_id_gym_unique" UNIQUE("id","gym_id");--> statement-breakpoint
ALTER TABLE "gym_media" ADD CONSTRAINT "gym_media_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_media" ADD CONSTRAINT "gym_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_operating_hour_overrides" ADD CONSTRAINT "gym_operating_hour_overrides_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_operating_hours" ADD CONSTRAINT "gym_operating_hours_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_prices" ADD CONSTRAINT "gym_prices_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_sectors" ADD CONSTRAINT "gym_sectors_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_sectors" ADD CONSTRAINT "gym_sectors_map_media_asset_id_media_assets_id_fk" FOREIGN KEY ("map_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_sectors" ADD CONSTRAINT "gym_sectors_wall_gym_fk" FOREIGN KEY ("wall_id","gym_id") REFERENCES "public"."gym_walls"("id","gym_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_sources" ADD CONSTRAINT "gym_sources_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_tag_assignments" ADD CONSTRAINT "gym_tag_assignments_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_tag_assignments" ADD CONSTRAINT "gym_tag_assignments_tag_id_gym_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."gym_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_walls" ADD CONSTRAINT "gym_walls_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_walls" ADD CONSTRAINT "gym_walls_map_media_asset_id_media_assets_id_fk" FOREIGN KEY ("map_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_gyms" ADD CONSTRAINT "membership_gyms_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_gyms" ADD CONSTRAINT "membership_gyms_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_usages" ADD CONSTRAINT "membership_usages_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_usages" ADD CONSTRAINT "membership_usages_record_id_climbing_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."climbing_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_pauses" ADD CONSTRAINT "record_pauses_record_id_climbing_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."climbing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_shares" ADD CONSTRAINT "record_shares_record_id_climbing_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."climbing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_shares" ADD CONSTRAINT "record_shares_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_code_regions_code_fk" FOREIGN KEY ("parent_code") REFERENCES "public"."regions"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_event_sectors" ADD CONSTRAINT "setting_event_sectors_event_gym_fk" FOREIGN KEY ("setting_event_id","gym_id") REFERENCES "public"."setting_events"("id","gym_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_event_sectors" ADD CONSTRAINT "setting_event_sectors_sector_gym_fk" FOREIGN KEY ("gym_sector_id","gym_id") REFERENCES "public"."gym_sectors"("id","gym_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gym_media_gym_asset_type_uidx" ON "gym_media" USING btree ("gym_id","media_asset_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_media_type_order_uidx" ON "gym_media" USING btree ("gym_id","type","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_media_cover_uidx" ON "gym_media" USING btree ("gym_id") WHERE "gym_media"."type" = 'cover';--> statement-breakpoint
CREATE UNIQUE INDEX "gym_media_logo_uidx" ON "gym_media" USING btree ("gym_id") WHERE "gym_media"."type" = 'logo';--> statement-breakpoint
CREATE INDEX "gym_media_gym_idx" ON "gym_media" USING btree ("gym_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_operating_overrides_date_sequence_uidx" ON "gym_operating_hour_overrides" USING btree ("gym_id","date","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_operating_hours_day_sequence_uidx" ON "gym_operating_hours" USING btree ("gym_id","day_of_week","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_prices_gym_type_uidx" ON "gym_prices" USING btree ("gym_id","type");--> statement-breakpoint
CREATE INDEX "gym_prices_gym_idx" ON "gym_prices" USING btree ("gym_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_sectors_wall_code_uidx" ON "gym_sectors" USING btree ("wall_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_sectors_wall_order_uidx" ON "gym_sectors" USING btree ("wall_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_sources_name_external_uidx" ON "gym_sources" USING btree ("source_name","external_id");--> statement-breakpoint
CREATE INDEX "gym_sources_gym_idx" ON "gym_sources" USING btree ("gym_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_walls_gym_code_uidx" ON "gym_walls" USING btree ("gym_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_walls_gym_order_uidx" ON "gym_walls" USING btree ("gym_id","sort_order");--> statement-breakpoint
CREATE INDEX "media_assets_owner_idx" ON "media_assets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_usages_record_type_uidx" ON "membership_usages" USING btree ("record_id","type");--> statement-breakpoint
CREATE INDEX "membership_usages_membership_time_idx" ON "membership_usages" USING btree ("membership_id","occurred_at");--> statement-breakpoint
CREATE INDEX "record_pauses_record_idx" ON "record_pauses" USING btree ("record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "record_pauses_open_uidx" ON "record_pauses" USING btree ("record_id") WHERE "record_pauses"."resumed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "record_shares_record_idx" ON "record_shares" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "record_shares_expires_idx" ON "record_shares" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "regions_parent_idx" ON "regions" USING btree ("parent_code");--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_membership_owner_fk" FOREIGN KEY ("membership_id","user_id") REFERENCES "public"."memberships"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_membership_gym_fk" FOREIGN KEY ("membership_id","gym_id") REFERENCES "public"."membership_gyms"("membership_id","gym_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_brand_id_gym_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."gym_brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_region_code_regions_code_fk" FOREIGN KEY ("region_code") REFERENCES "public"."regions"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_counts" ADD CONSTRAINT "record_counts_record_gym_fk" FOREIGN KEY ("record_id","gym_id") REFERENCES "public"."climbing_records"("id","gym_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_counts" ADD CONSTRAINT "record_counts_grade_gym_fk" FOREIGN KEY ("gym_grade_id","gym_id") REFERENCES "public"."gym_grades"("id","gym_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_counts" ADD CONSTRAINT "record_counts_sector_gym_fk" FOREIGN KEY ("gym_sector_id","gym_id") REFERENCES "public"."gym_sectors"("id","gym_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_region_code_regions_code_fk" FOREIGN KEY ("home_region_code") REFERENCES "public"."regions"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_occurred_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "climbing_records_user_active_uidx" ON "climbing_records" USING btree ("user_id") WHERE "climbing_records"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "gyms_region_idx" ON "gyms" USING btree ("region_code");--> statement-breakpoint
CREATE INDEX "gyms_brand_idx" ON "gyms" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_home_order_uidx" ON "memberships" USING btree ("user_id","home_order");--> statement-breakpoint
CREATE UNIQUE INDEX "record_counts_record_grade_sector_uidx" ON "record_counts" USING btree ("record_id","gym_grade_id","gym_sector_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_revoked_idx" ON "refresh_sessions" USING btree ("revoked_at");--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_status_check" CHECK ((
      ("climbing_records"."status" = 'in_progress' AND "climbing_records"."ended_at" IS NULL)
      OR ("climbing_records"."status" IN ('completed', 'cancelled') AND "climbing_records"."ended_at" IS NOT NULL)
    ));--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_access_check" CHECK ((
      ("climbing_records"."access_type" = 'membership' AND "climbing_records"."membership_id" IS NOT NULL)
      OR ("climbing_records"."access_type" IN ('day_pass', 'other') AND "climbing_records"."membership_id" IS NULL)
    ));--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_duration_check" CHECK ("climbing_records"."active_duration_seconds" IS NULL OR "climbing_records"."active_duration_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_time_range_check" CHECK ("climbing_records"."ended_at" IS NULL OR "climbing_records"."ended_at" >= "climbing_records"."started_at");--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_rating_check" CHECK ("climbing_records"."rating" IS NULL OR (
      "climbing_records"."rating" >= 0.5 AND "climbing_records"."rating" <= 5 AND mod("climbing_records"."rating", 0.5) = 0
    ));--> statement-breakpoint
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_coordinates_pair_check" CHECK (("gyms"."latitude" IS NULL) = ("gyms"."longitude" IS NULL));--> statement-breakpoint
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_latitude_check" CHECK ("gyms"."latitude" IS NULL OR "gyms"."latitude" BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_longitude_check" CHECK ("gyms"."longitude" IS NULL OR "gyms"."longitude" BETWEEN -180 AND 180);--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_home_order_check" CHECK ((
      ("memberships"."home_favorite" AND "memberships"."home_order" IS NOT NULL AND "memberships"."home_order" BETWEEN 0 AND 2)
      OR (NOT "memberships"."home_favorite" AND "memberships"."home_order" IS NULL)
    ));--> statement-breakpoint
ALTER TABLE "setting_events" ADD CONSTRAINT "setting_events_time_range_check" CHECK ("setting_events"."ends_at" IS NULL OR "setting_events"."ends_at" >= "setting_events"."starts_at");
