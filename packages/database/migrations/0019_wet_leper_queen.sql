DO $$ BEGIN
 CREATE TYPE "public"."schedule_timezone_status" AS ENUM('RESOLVED', 'NEEDS_CLARIFICATION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "timezone_status" "schedule_timezone_status";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text;