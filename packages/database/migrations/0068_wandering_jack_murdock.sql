DO $$ BEGIN
 CREATE TYPE "public"."extraction_audit_face_detection_skipped_reason" AS ENUM('no_face_reported', 'event_relevance_gate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extraction_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"gemini_model" text NOT NULL,
	"is_event" boolean NOT NULL,
	"has_face_image" boolean,
	"face_image_count" integer,
	"actual_face_detection_count" integer,
	"face_detection_skipped_reason" "extraction_audit_face_detection_skipped_reason",
	"min_event_count" integer,
	"actual_event_count" integer NOT NULL,
	"grouping_reason" "post_grouping_reason",
	"events_completeness" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extraction_audit_logs" ADD CONSTRAINT "extraction_audit_logs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_extraction_audit_logs_post_id" ON "extraction_audit_logs" ("post_id");