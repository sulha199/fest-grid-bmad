DO $$ BEGIN
 CREATE TYPE "public"."scraper_run_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scraper_run_trigger_mode" AS ENUM('sync', 'async');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scraper_run_vendor" AS ENUM('apify', 'brightdata');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scraper_actor_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor" "scraper_run_vendor" NOT NULL,
	"trigger_mode" "scraper_run_trigger_mode" NOT NULL,
	"profile_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"status" "scraper_run_status" DEFAULT 'PENDING' NOT NULL,
	"raw_input" jsonb NOT NULL,
	"raw_output" jsonb,
	"item_count" integer,
	"error_message" text,
	"pending_job_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraper_actor_runs_vendor_run_id_unique" UNIQUE("vendor","run_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_actor_runs" ADD CONSTRAINT "scraper_actor_runs_profile_id_social_media_account_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scraper_actor_runs_profile_id" ON "scraper_actor_runs" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scraper_actor_runs_vendor_status" ON "scraper_actor_runs" ("vendor","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scraper_actor_runs_created_at" ON "scraper_actor_runs" ("created_at");