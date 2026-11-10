ALTER TABLE "posts" ADD COLUMN "extraction_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "extraction_failure_reason" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "extraction_next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "extraction_first_failure_at" timestamp with time zone;--> statement-breakpoint
-- Partial (drizzle-kit 0.21.4 does not serialize the WHERE; same hand edit as idx_user_locations_active in 0009).
CREATE INDEX IF NOT EXISTS "idx_posts_extraction_next_attempt_at" ON "posts" ("extraction_next_attempt_at") WHERE extraction_next_attempt_at IS NOT NULL;