CREATE TABLE IF NOT EXISTS "scraper_batch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"targets_found" integer DEFAULT 0 NOT NULL,
	"dispatched_succeeded" integer DEFAULT 0 NOT NULL,
	"dispatched_failed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scraper_batch_runs_started_at" ON "scraper_batch_runs" ("started_at");