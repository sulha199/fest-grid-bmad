ALTER TABLE "posts" ADD COLUMN "original_post_url" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "deleted_at" timestamp with time zone;