ALTER TABLE "jobs" ADD COLUMN "queued_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "leader_job_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "jobs" ADD CONSTRAINT "jobs_leader_job_id_jobs_id_fk" FOREIGN KEY ("leader_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_leader" ON "jobs" ("leader_job_id");