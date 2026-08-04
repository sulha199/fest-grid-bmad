DO $$ BEGIN
 CREATE TYPE "public"."geolocation_query_type" AS ENUM('GEOCODE', 'REVERSE_GEOCODE', 'PLACE_DETAILS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geolocation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"query_type" "geolocation_query_type" NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geolocation_cache_cache_key_unique" UNIQUE("cache_key")
);
