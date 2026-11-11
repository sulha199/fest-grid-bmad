DO $$ BEGIN
 CREATE TYPE "public"."job_vendor_snapshot_status" AS ENUM('PENDING', 'COLLECTED', 'GAVE_UP');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_vendor_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"provider" "scraper_run_vendor" NOT NULL,
	"snapshot_id" text NOT NULL,
	"status" "job_vendor_snapshot_status" DEFAULT 'PENDING' NOT NULL,
	"wait_until" timestamp with time zone NOT NULL,
	"collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_vendor_snapshots_snapshot_id_unique" UNIQUE("snapshot_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_vendor_snapshots" ADD CONSTRAINT "job_vendor_snapshots_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_vendor_snapshots_status_wait_until" ON "job_vendor_snapshots" ("status","wait_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_vendor_snapshots_job_id" ON "job_vendor_snapshots" ("job_id");
--> statement-breakpoint
ALTER TABLE "job_vendor_snapshots" ENABLE ROW LEVEL SECURITY;
