ALTER TABLE "events" ADD COLUMN "deleted_at" timestamp with time zone;
--> statement-breakpoint
DROP INDEX IF EXISTS "event_name_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "event_types_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "event_categories_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "event_location_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "event_post_id_idx";
--> statement-breakpoint
-- Hand-edited to add WHERE clause due to drizzle-kit generate bug (drizzle-orm#3349) dropping .where() clauses on generation
CREATE INDEX IF NOT EXISTS "event_name_idx" ON "events" ("event_name") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_types_idx" ON "events" ("types") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_categories_idx" ON "events" ("categories") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_location_idx" ON "events" ("location") WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_post_id_idx" ON "events" ("post_id") WHERE deleted_at IS NULL;
