SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "climbing_records" DROP COLUMN "session_type";--> statement-breakpoint
DROP TYPE "public"."record_session_type";