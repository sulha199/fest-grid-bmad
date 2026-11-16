CREATE TABLE IF NOT EXISTS "alert_email_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"send_count" integer DEFAULT 0 NOT NULL,
	"window_start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- Server-only rate-limit table: RLS on, no policy (the backend connects as the owner). Required for every new table
-- (migration 0084; apps/backend/src/db/row-level-security.test.ts fails CI otherwise).
ALTER TABLE "alert_email_rate_limits" ENABLE ROW LEVEL SECURITY;
