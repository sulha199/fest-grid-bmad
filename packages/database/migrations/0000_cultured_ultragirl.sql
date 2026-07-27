DO $$ BEGIN
 CREATE TYPE "public"."event_category" AS ENUM('MUSIC', 'ARTS_AND_CULTURE', 'FOOD_AND_DRINK', 'SPORTS_AND_FITNESS', 'FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS', 'BUSINESS_AND_NETWORKING', 'HEALTH_AND_WELLNESS', 'HOLIDAY', 'CHARITY_AND_CAUSES', 'CIVIC_AND_COMMUNITY', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_type" AS ENUM('EXHIBITION', 'COMPETITION', 'FESTIVAL', 'PERFORMANCE', 'WORKSHOP', 'SEMINAR', 'MARKET', 'GATHERING', 'PROMOTION', 'FUNDRAISER', 'CIVIC', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_encrypted" text NOT NULL,
	"provider" text NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"invalid_attempts" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"event_name" text NOT NULL,
	"types" text[],
	"categories" text[],
	"location" text NOT NULL,
	"organizer_name" text,
	"contact_info" text,
	"description" text,
	"confidence_score" double precision,
	"source_social_media_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"event_id" uuid NOT NULL,
	"is_main_schedule" boolean DEFAULT true NOT NULL,
	"event_start_date" date NOT NULL,
	"event_end_date" date,
	"event_start_time" time,
	"event_end_time" time,
	"title" text,
	"performers" text[],
	"location" text,
	"ticket_price" text,
	"location_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"platform" text NOT NULL,
	"display_name" text NOT NULL,
	"username" text NOT NULL,
	"profile_image_url" text,
	"description" text,
	"last_post_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedules" ADD CONSTRAINT "schedules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_name_idx" ON "events" ("event_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_types_idx" ON "events" ("types");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_categories_idx" ON "events" ("categories");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_location_idx" ON "events" ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_performers_idx" ON "schedules" ("performers");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_location_idx" ON "schedules" ("location");