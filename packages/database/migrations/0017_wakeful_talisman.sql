DO $$ BEGIN
 CREATE TYPE "public"."default_location_change_status" AS ENUM('PENDING_REVIEW', 'ACCEPTED', 'REVERTED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "default_location_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"previous_location" jsonb,
	"new_location" jsonb NOT NULL,
	"status" "default_location_change_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"reviewed_by_moderator_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "default_location_change_requests" ADD CONSTRAINT "default_location_change_requests_account_id_social_media_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "default_location_change_requests" ADD CONSTRAINT "default_location_change_requests_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "default_location_change_requests" ADD CONSTRAINT "default_location_change_requests_reviewed_by_moderator_id_users_id_fk" FOREIGN KEY ("reviewed_by_moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_default_location_change_requests_account_status" ON "default_location_change_requests" ("account_id","status");