DO $$ BEGIN
 CREATE TYPE "public"."brightdata_job_status" AS ENUM('PENDING', 'COMPLETED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brightdata_pending_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"snapshot_id" text NOT NULL,
	"webhook_token" text NOT NULL,
	"status" "brightdata_job_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brightdata_pending_jobs_snapshot_id_unique" UNIQUE("snapshot_id"),
	CONSTRAINT "brightdata_pending_jobs_webhook_token_unique" UNIQUE("webhook_token")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "platform" text;--> statement-breakpoint
UPDATE "posts" p SET "platform" = (SELECT "platform" FROM "social_media_account_profiles" WHERE "id" = p."account_id") WHERE "platform" IS NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "platform" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brightdata_pending_jobs" ADD CONSTRAINT "brightdata_pending_jobs_profile_id_social_media_account_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_brightdata_pending_jobs_status_expires" ON "brightdata_pending_jobs" ("status","expires_at");