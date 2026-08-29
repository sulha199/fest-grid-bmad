CREATE TABLE IF NOT EXISTS "ai_event_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"resolved_filter" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_event_filters" ADD CONSTRAINT "ai_event_filters_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Hand-edited to add WHERE clause due to drizzle-kit generate bug (drizzle-orm#3349) dropping .where() clauses on generation
CREATE INDEX IF NOT EXISTS "idx_ai_event_filters_active" ON "ai_event_filters" ("owner_user_id") WHERE deleted_at IS NULL;