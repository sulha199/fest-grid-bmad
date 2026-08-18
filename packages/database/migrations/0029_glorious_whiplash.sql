DO $$ BEGIN
 CREATE TYPE "public"."apify_job_status" AS ENUM('PENDING', 'COMPLETED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apify_pending_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"webhook_token" text NOT NULL,
	"status" "apify_job_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apify_pending_jobs_run_id_unique" UNIQUE("run_id"),
	CONSTRAINT "apify_pending_jobs_webhook_token_unique" UNIQUE("webhook_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apify_pending_jobs" ADD CONSTRAINT "apify_pending_jobs_profile_id_social_media_account_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_apify_pending_jobs_status_expires" ON "apify_pending_jobs" ("status","expires_at");