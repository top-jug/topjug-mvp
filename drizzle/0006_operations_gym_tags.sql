ALTER TABLE "gym_tags" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "gym_tags" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gym_tags" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "gym_tags" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "gym_tags" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE TEMPORARY TABLE "_topjug_facility_tag_backfill" ON COMMIT DROP AS
SELECT
	"gyms"."id" AS "gym_id",
	CASE
		WHEN lower(trim("facility"."value")) IN ('shower', '샤워실') THEN 'shower'
		WHEN lower(trim("facility"."value")) IN ('kilter_board', '킬터보드') THEN 'kilter_board'
		WHEN lower(trim("facility"."value")) IN ('stretching_zone', '스트레칭', '스트레칭존') THEN 'stretching_zone'
		WHEN lower(trim("facility"."value")) IN ('parking', '주차', '주차가능') THEN 'parking'
		WHEN lower(trim("facility"."value")) IN ('shoe_rental', '암벽화 대여') THEN 'shoe_rental'
		ELSE 'facility_' || substr(md5(lower(trim("facility"."value"))), 1, 16)
	END AS "code",
	CASE
		WHEN lower(trim("facility"."value")) IN ('shower', '샤워실') THEN '샤워실'
		WHEN lower(trim("facility"."value")) IN ('kilter_board', '킬터보드') THEN '킬터보드'
		WHEN lower(trim("facility"."value")) IN ('stretching_zone', '스트레칭', '스트레칭존') THEN '스트레칭존'
		WHEN lower(trim("facility"."value")) IN ('parking', '주차', '주차가능') THEN '주차가능'
		WHEN lower(trim("facility"."value")) IN ('shoe_rental', '암벽화 대여') THEN '암벽화 대여'
		ELSE trim("facility"."value")
	END AS "label",
	CASE
		WHEN lower(trim("facility"."value")) IN ('shower', '샤워실') THEN 10
		WHEN lower(trim("facility"."value")) IN ('kilter_board', '킬터보드') THEN 20
		WHEN lower(trim("facility"."value")) IN ('stretching_zone', '스트레칭', '스트레칭존') THEN 30
		WHEN lower(trim("facility"."value")) IN ('parking', '주차', '주차가능') THEN 40
		WHEN lower(trim("facility"."value")) IN ('shoe_rental', '암벽화 대여') THEN 50
		ELSE 1000
	END AS "sort_order"
FROM "gyms"
CROSS JOIN LATERAL unnest("gyms"."facilities") AS "facility"("value")
WHERE nullif(trim("facility"."value"), '') IS NOT NULL;--> statement-breakpoint
INSERT INTO "gym_tags" ("code", "label", "sort_order")
SELECT "code", min("label"), min("sort_order")
FROM "_topjug_facility_tag_backfill"
GROUP BY "code"
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "gym_tag_assignments" ("gym_id", "tag_id")
SELECT DISTINCT "backfill"."gym_id", "gym_tags"."id"
FROM "_topjug_facility_tag_backfill" AS "backfill"
INNER JOIN "gym_tags" ON "gym_tags"."code" = "backfill"."code"
ON CONFLICT ("gym_id", "tag_id") DO NOTHING;--> statement-breakpoint
DROP TABLE "_topjug_facility_tag_backfill";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_tag_assignments_tag_idx" ON "gym_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_tags_active_order_idx" ON "gym_tags" USING btree ("is_active","sort_order","label");
