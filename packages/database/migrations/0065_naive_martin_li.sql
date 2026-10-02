DO $$ BEGIN
 CREATE TYPE "public"."event_detail_level" AS ENUM('stub', 'full');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."post_grouping_reason" AS ENUM('single-event', 'program-lineup', 'dependent-stages', 'separate-events', 'roundup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_posts" (
	"event_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"extraction_ordinal" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_posts_event_id_post_id_pk" PRIMARY KEY("event_id","post_id"),
	CONSTRAINT "event_posts_post_id_extraction_ordinal_unique" UNIQUE("post_id","extraction_ordinal")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_slug_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_aliases_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_post_id_unique";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "extraction_ordinal" smallint;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "detail_level" "event_detail_level" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "merged_into_event_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "grouping_reason" "post_grouping_reason";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "extracted_event_count" integer;--> statement-breakpoint
-- Story 3.6r / AD-30 Rule 1 (AC2) backfill -- must run after the new columns exist and before
-- the new events(post_id, extraction_ordinal) unique constraint and the hand-written CHECK
-- below, in this exact order (each step depends on the previous one having committed first
-- within this same migration transaction).
UPDATE "events" SET "extraction_ordinal" = 0 WHERE "post_id" IS NOT NULL;--> statement-breakpoint
INSERT INTO "event_posts" ("event_id", "post_id", "extraction_ordinal", "created_at") SELECT "id", "post_id", 0, "created_at" FROM "events" WHERE "post_id" IS NOT NULL ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Hand-written CHECK (AC2) -- no prior hand-written CHECK constraint exists in this codebase to
-- copy verbatim; uses the same idempotent DO $$ ... EXCEPTION WHEN duplicate_object THEN null;
-- END $$; guard migration 0064 already uses for its FK ALTER TABLE statements. Safe only now
-- that the backfill above has run: NULLs are distinct in a unique index, so a null ordinal on a
-- non-null postId would otherwise bypass idempotency (AD-30 Rule 1).
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_post_id_extraction_ordinal_check" CHECK ("post_id" IS NULL OR "extraction_ordinal" IS NOT NULL);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_posts" ADD CONSTRAINT "event_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_slug_aliases" ADD CONSTRAINT "event_slug_aliases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_posts_post_id_event_id" ON "event_posts" ("post_id","event_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_merged_into_event_id_events_id_fk" FOREIGN KEY ("merged_into_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_post_id_extraction_ordinal_unique" UNIQUE("post_id","extraction_ordinal");--> statement-breakpoint
-- Story 3.6r / AD-30 Rule 1/5 (AC5) -- hand-written: drizzle-kit 0.21 drops WHERE predicates
-- (AD-8 rule 3) and operator-class support is unverified, so this whole block is hand-added
-- rather than generated. Used for write-path matching only (AD-30 Rule 7), never the hot path.
--
-- Supabase's extension-manager UI installs extensions into a dedicated `extensions` schema (not
-- `public`); a raw CREATE EXTENSION IF NOT EXISTS pg_trgm here installs into whichever schema is
-- first on the connection's search_path (ordinarily `public`, matching local native Postgres).
-- The SET LOCAL below is a no-op on local native Postgres (pg_trgm already lands in `public`,
-- already first on the default path) and is the actual fix on Supabase (where it may land in
-- `extensions`) -- it lets the unqualified gin_trgm_ops operator-class reference resolve either
-- way without a per-environment migration fork. The Supabase half of this is NOT verified from
-- this (local-only) environment -- see this story's Dev Agent Record.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SET LOCAL search_path TO public, extensions;
CREATE INDEX IF NOT EXISTS "idx_events_event_name_trgm" ON "events" USING gin ("event_name" gin_trgm_ops) WHERE "deleted_at" IS NULL;
RESET search_path;