ALTER TABLE "posts" ADD COLUMN "hashtags" text[];--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_hashtags_idx" ON "posts" USING gin ("hashtags");
