DO $$ BEGIN
 CREATE TYPE "public"."instagram_oembed_status" AS ENUM('AVAILABLE', 'UNAVAILABLE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instagram_oembed_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_url" text NOT NULL,
	"status" "instagram_oembed_status" NOT NULL,
	"html" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_oembed_cache_post_url_unique" UNIQUE("post_url")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_instagram_oembed_cache_expires_at" ON "instagram_oembed_cache" ("expires_at");