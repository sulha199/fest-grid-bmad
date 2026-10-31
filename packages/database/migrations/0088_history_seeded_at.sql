ALTER TABLE "social_media_account_profiles" ADD COLUMN "history_seeded_at" timestamp with time zone;--> statement-breakpoint
-- Profiles already being scraped have a seeded history by definition; without this every one of them would
-- reseed (newest 30 posts, up to 30 days back) and push older posts into extraction.
UPDATE "social_media_account_profiles" SET "history_seeded_at" = "last_scraped_at" WHERE "last_scraped_at" IS NOT NULL;
