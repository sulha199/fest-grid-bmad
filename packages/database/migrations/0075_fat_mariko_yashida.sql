DO $$ BEGIN
 CREATE TYPE "public"."suggested_event_match_status" AS ENUM('pending', 'accepted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"winner_event_id" uuid NOT NULL,
	"loser_event_id" uuid NOT NULL,
	"suggestion_id" uuid,
	"performed_by_moderator_id" uuid NOT NULL,
	"loser_prior_slug" text NOT NULL,
	"winner_notified_at_changed" boolean DEFAULT false NOT NULL,
	"winner_prior_notified_at" timestamp with time zone,
	"loser_prior_notified_at" timestamp with time zone,
	"repointed_favorite_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deduped_favorite_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repointed_calendar_addition_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deduped_calendar_addition_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repointed_report_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repointed_event_post_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repointed_alias_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_match_candidates" ADD COLUMN "status" "suggested_event_match_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_match_candidates" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_match_candidates" ADD COLUMN "resolved_by_moderator_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merges" ADD CONSTRAINT "event_merges_winner_event_id_events_id_fk" FOREIGN KEY ("winner_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merges" ADD CONSTRAINT "event_merges_loser_event_id_events_id_fk" FOREIGN KEY ("loser_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merges" ADD CONSTRAINT "event_merges_suggestion_id_event_match_candidates_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."event_match_candidates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_merges" ADD CONSTRAINT "event_merges_performed_by_moderator_id_users_id_fk" FOREIGN KEY ("performed_by_moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_match_candidates" ADD CONSTRAINT "event_match_candidates_resolved_by_moderator_id_users_id_fk" FOREIGN KEY ("resolved_by_moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_match_candidates_status" ON "event_match_candidates" ("status");