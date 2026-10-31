DO $$ BEGIN
 CREATE TYPE "public"."profile_lookup_outcome" AS ENUM('FOUND', 'NOT_FOUND', 'FAILED', 'TIMED_OUT', 'SKIPPED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."profile_lookup_purpose" AS ENUM('LOOKUP', 'CLASSIFICATION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_lookup_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "profile_lookup_purpose" NOT NULL,
	"handle" text NOT NULL,
	"vendor" "scraper_run_vendor" NOT NULL,
	"outcome" "profile_lookup_outcome" NOT NULL,
	"budget_ms" integer NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profile_lookup_attempts_created_at" ON "profile_lookup_attempts" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profile_lookup_attempts_vendor_outcome" ON "profile_lookup_attempts" ("vendor","outcome");
--> statement-breakpoint
-- Server-only audit table: RLS on, no policy (the backend connects as the owner). Required for every new table
-- (migration 0084; apps/backend/src/db/row-level-security.test.ts fails CI otherwise).
ALTER TABLE "profile_lookup_attempts" ENABLE ROW LEVEL SECURITY;
