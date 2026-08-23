CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."membership_type" AS ENUM('count', 'period');--> statement-breakpoint
CREATE TYPE "public"."record_mode" AS ENUM('easy', 'normal');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" uuid,
	"outcome" "audit_outcome" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "climbing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gym_id" uuid NOT NULL,
	"membership_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"rating" numeric(2, 1),
	"mode" "record_mode" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "climbing_records_time_range_check" CHECK ("climbing_records"."ended_at" >= "climbing_records"."started_at"),
	CONSTRAINT "climbing_records_rating_check" CHECK ("climbing_records"."rating" IS NULL OR ("climbing_records"."rating" >= 0.5 AND "climbing_records"."rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "gym_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"rank" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"branch_name" text,
	"address" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"facilities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gym_id" uuid,
	"name" text NOT NULL,
	"type" "membership_type" NOT NULL,
	"total_uses" integer,
	"remaining_uses" integer,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"note" text,
	"home_favorite" boolean DEFAULT false NOT NULL,
	"home_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_valid_range_check" CHECK ("memberships"."valid_until" >= "memberships"."valid_from"),
	CONSTRAINT "memberships_type_fields_check" CHECK ((
      ("memberships"."type" = 'count' AND "memberships"."total_uses" IS NOT NULL AND "memberships"."remaining_uses" IS NOT NULL
        AND "memberships"."total_uses" >= 0 AND "memberships"."remaining_uses" >= 0 AND "memberships"."remaining_uses" <= "memberships"."total_uses")
      OR ("memberships"."type" = 'period' AND "memberships"."total_uses" IS NULL AND "memberships"."remaining_uses" IS NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "record_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"gym_grade_id" uuid NOT NULL,
	"sector_code" text,
	"attempts" integer NOT NULL,
	"sends" integer NOT NULL,
	CONSTRAINT "record_counts_record_grade_sector_uidx" UNIQUE NULLS NOT DISTINCT("record_id","gym_grade_id","sector_code"),
	CONSTRAINT "record_counts_nonnegative_check" CHECK ("record_counts"."attempts" >= 0 AND "record_counts"."sends" >= 0),
	CONSTRAINT "record_counts_sends_check" CHECK ("record_counts"."sends" <= "record_counts"."attempts")
);
--> statement-breakpoint
CREATE TABLE "refresh_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "saved_gyms" (
	"user_id" uuid NOT NULL,
	"gym_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"wall_name" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"home_region_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "climbing_records" ADD CONSTRAINT "climbing_records_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_grades" ADD CONSTRAINT "gym_grades_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_counts" ADD CONSTRAINT "record_counts_record_id_climbing_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."climbing_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_counts" ADD CONSTRAINT "record_counts_gym_grade_id_gym_grades_id_fk" FOREIGN KEY ("gym_grade_id") REFERENCES "public"."gym_grades"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_gyms" ADD CONSTRAINT "saved_gyms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_gyms" ADD CONSTRAINT "saved_gyms_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_events" ADD CONSTRAINT "setting_events_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_actor_time_idx" ON "audit_events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_time_idx" ON "audit_events" USING btree ("action","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_request_idx" ON "audit_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "climbing_records_user_created_idx" ON "climbing_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "climbing_records_user_started_idx" ON "climbing_records" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "climbing_records_gym_started_idx" ON "climbing_records" USING btree ("gym_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_grades_gym_code_uidx" ON "gym_grades" USING btree ("gym_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "gym_grades_gym_rank_uidx" ON "gym_grades" USING btree ("gym_id","rank");--> statement-breakpoint
CREATE INDEX "gyms_name_idx" ON "gyms" USING btree ("name");--> statement-breakpoint
CREATE INDEX "login_attempts_key_time_idx" ON "login_attempts" USING btree ("key_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempts_time_idx" ON "login_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "record_counts_record_idx" ON "record_counts" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_user_idx" ON "refresh_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_family_idx" ON "refresh_sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_expires_idx" ON "refresh_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_gyms_user_gym_uidx" ON "saved_gyms" USING btree ("user_id","gym_id");--> statement-breakpoint
CREATE INDEX "setting_events_gym_starts_idx" ON "setting_events" USING btree ("gym_id","starts_at");