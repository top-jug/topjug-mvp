CREATE TABLE "email_verification_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"token_hash" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_purpose_check" CHECK ("email_verification_challenges"."purpose" IN ('register', 'reset_password')),
	CONSTRAINT "email_verification_attempts_check" CHECK ("email_verification_challenges"."attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE INDEX "email_verification_email_purpose_idx" ON "email_verification_challenges" USING btree ("email","purpose","created_at");--> statement-breakpoint
CREATE INDEX "email_verification_expires_idx" ON "email_verification_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_token_uidx" ON "email_verification_challenges" USING btree ("token_hash") WHERE "email_verification_challenges"."token_hash" IS NOT NULL;
