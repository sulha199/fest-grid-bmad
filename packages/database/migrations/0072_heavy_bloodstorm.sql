CREATE TABLE IF NOT EXISTS "event_match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"candidate_event_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_match_candidates_event_id_candidate_event_id_unique" UNIQUE("event_id","candidate_event_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_match_candidates" ADD CONSTRAINT "event_match_candidates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_match_candidates" ADD CONSTRAINT "event_match_candidates_candidate_event_id_events_id_fk" FOREIGN KEY ("candidate_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_match_candidates" ADD CONSTRAINT "event_match_candidates_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_match_candidates_candidate_event_id" ON "event_match_candidates" ("candidate_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_slug_aliases_event_id" ON "event_slug_aliases" ("event_id");