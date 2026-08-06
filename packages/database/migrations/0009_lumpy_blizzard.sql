DROP INDEX IF EXISTS "idx_user_locations_user_id";--> statement-breakpoint
ALTER TABLE "user_locations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
-- Hand-edited to add WHERE clause due to drizzle-kit generate bug (drizzle-orm#3349) dropping .where() clauses on generation
CREATE INDEX IF NOT EXISTS "idx_user_locations_active" ON "user_locations" ("user_id") WHERE deleted_at IS NULL;
