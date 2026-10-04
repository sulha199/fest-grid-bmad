DO $$ BEGIN
 CREATE TYPE "public"."manual_extraction_job_status" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manual_extraction_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"request_payload" jsonb NOT NULL,
	"status" "manual_extraction_job_status" DEFAULT 'PENDING' NOT NULL,
	"result_data" jsonb,
	"error_code" text,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "manual_extraction_jobs" ADD CONSTRAINT "manual_extraction_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manual_extraction_jobs_user_created_at" ON "manual_extraction_jobs" ("requested_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_manual_extraction_jobs_status_created_at" ON "manual_extraction_jobs" ("status","created_at");