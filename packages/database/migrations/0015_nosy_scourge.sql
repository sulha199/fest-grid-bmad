ALTER TABLE "api_keys" ADD COLUMN "key_last4" text NOT NULL;--> statement-breakpoint
-- Hand-edited partial active index where deleted_at IS NULL (drizzle-orm #3349, drizzle-kit-mirror #461 workaround)
CREATE INDEX IF NOT EXISTS "idx_api_keys_active" ON "api_keys" ("user_id") WHERE "deleted_at" IS NULL;
