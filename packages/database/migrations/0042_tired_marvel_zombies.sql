DO $$ BEGIN
 CREATE TYPE "public"."account_type" AS ENUM('ORGANIZER_VENUE_EVENT', 'PERSONAL', 'CURATOR_GUIDE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."account_type_status" AS ENUM('CONFIRMED', 'AWAITING_APPROVAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_type_classification_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"proposed_account_type" "account_type",
	"confidence_score" double precision,
	"failure_reason" text,
	"resolved_account_type" "account_type",
	"reviewed_by_moderator_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "account_type" "account_type";--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "account_type_status" "account_type_status";--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "account_type_confidence_score" double precision;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_type_classification_reviews" ADD CONSTRAINT "account_type_classification_reviews_account_id_social_media_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_type_classification_reviews" ADD CONSTRAINT "account_type_classification_reviews_reviewed_by_moderator_id_users_id_fk" FOREIGN KEY ("reviewed_by_moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_type_classification_reviews_account" ON "account_type_classification_reviews" ("account_id");