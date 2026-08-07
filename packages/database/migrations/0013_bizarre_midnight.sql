CREATE TABLE IF NOT EXISTS "social_media_account_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"platform" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"profile_image_url" text,
	"description" text,
	"last_post_date" timestamp with time zone,
	"default_location" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_media_account_profiles_platform_account_id_unique" UNIQUE("platform","account_id")
);
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "subscription_id_idx";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "account_id";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "account_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "account_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "is_newly_added" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_account_id_social_media_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_social_media_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_id_idx" ON "posts" ("account_id");--> statement-breakpoint
-- Hand-edited to add WHERE clause due to drizzle-kit generate bug (drizzle-orm#3349) dropping .where() clauses on generation
CREATE INDEX IF NOT EXISTS "idx_subscriptions_active" ON "subscriptions" ("user_id") WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "subscription_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "platform";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "display_name";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "username";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "profile_image_url";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "description";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_post_date";