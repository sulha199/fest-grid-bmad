CREATE TABLE IF NOT EXISTS "scraper_provider_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"items_used_this_cycle" integer DEFAULT 0 NOT NULL,
	"usage_cycle_reset_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraper_provider_usage_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "last_scraped_at" timestamp with time zone;