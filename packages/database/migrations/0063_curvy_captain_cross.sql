ALTER TABLE "social_media_account_profiles" ADD COLUMN "first_seen" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "last_seen" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "discovery_source" jsonb;--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "is_verified_for_discovery" boolean DEFAULT true NOT NULL;