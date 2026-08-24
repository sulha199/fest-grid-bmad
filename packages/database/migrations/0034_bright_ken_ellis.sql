DO $$ BEGIN
 CREATE TYPE "public"."default_location_change_source" AS ENUM('USER', 'AI_INFERENCE', 'MODERATOR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "default_location_change_status" ADD VALUE 'SUPERSEDED';--> statement-breakpoint
ALTER TABLE "default_location_change_requests" ADD COLUMN "change_source" "default_location_change_source" DEFAULT 'USER' NOT NULL;
