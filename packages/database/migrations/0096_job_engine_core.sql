DO $$ BEGIN
 CREATE TYPE "public"."job_attempt_outcome" AS ENUM('SUCCEEDED', 'FAILED', 'EMPTY', 'TIMED_OUT', 'OVER_QUOTA', 'SKIPPED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."job_status" AS ENUM('QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'SUCCEEDED_WITH_LIMITS', 'FAILED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."job_trigger" AS ENUM('USER', 'SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"provider" "scraper_run_vendor" NOT NULL,
	"outcome" "job_attempt_outcome" NOT NULL,
	"budget_ms" integer NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"reason_code" text,
	"scraper_actor_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"owner_user_id" uuid,
	"trigger" "job_trigger" NOT NULL,
	"input_key" text NOT NULL,
	"input" jsonb,
	"status" "job_status" DEFAULT 'QUEUED' NOT NULL,
	"phase" text,
	"reason_code" text,
	"error_message" text,
	"result_data" jsonb,
	"deadline_at" timestamp with time zone NOT NULL,
	"completed_after_deadline" boolean DEFAULT false NOT NULL,
	"worker_claimed_at" timestamp with time zone,
	"admitted_at" timestamp with time zone,
	"resume_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_attempts" ADD CONSTRAINT "job_attempts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_attempts" ADD CONSTRAINT "job_attempts_scraper_actor_run_id_scraper_actor_runs_id_fk" FOREIGN KEY ("scraper_actor_run_id") REFERENCES "public"."scraper_actor_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_attempts_job_id" ON "job_attempts" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_owner_created_at" ON "jobs" ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_status_deadline" ON "jobs" ("status","deadline_at");
--> statement-breakpoint
-- Server-only tables: RLS on, no policy (the backend connects as the owner; the Jobs page reads through GraphQL, Story 10.4).
-- Required for every new table (migration 0084; apps/backend/src/db/row-level-security.test.ts fails CI otherwise).
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "job_attempts" ENABLE ROW LEVEL SECURITY;
