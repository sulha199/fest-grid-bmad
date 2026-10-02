DO $$ BEGIN
 CREATE TYPE "public"."post_account_role" AS ENUM('PUBLISHER', 'COAUTHOR', 'SCRAPING_SOURCE', 'PUBLISHER_UNKNOWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_account_associations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "post_account_role" NOT NULL,
	"scraper_actor_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_account_associations_post_id_account_id_role_unique" UNIQUE("post_id","account_id","role")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_account_associations" ADD CONSTRAINT "post_account_associations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_account_associations" ADD CONSTRAINT "post_account_associations_account_id_social_media_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_account_associations" ADD CONSTRAINT "post_account_associations_scraper_actor_run_id_scraper_actor_runs_id_fk" FOREIGN KEY ("scraper_actor_run_id") REFERENCES "public"."scraper_actor_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- drizzle-kit 0.21.4 drops the WHERE predicate from generated migration SQL for a partial
-- unique index -- same class of gap as migration 0057's idx_schedules_one_main_per_event.
-- Hand-added here, matching 0057's style.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_post_account_associations_one_publisher_per_post" ON "post_account_associations" ("post_id") WHERE "role" IN ('PUBLISHER', 'PUBLISHER_UNKNOWN');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_post_account_associations_one_scraping_source_per_post" ON "post_account_associations" ("post_id") WHERE "role" = 'SCRAPING_SOURCE';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_post_account_associations_account_id_post_id" ON "post_account_associations" ("account_id","post_id");--> statement-breakpoint
-- Story 3.15 AC1 (FIND-022 CAP-3): one PUBLISHER_UNKNOWN association per pre-existing post,
-- derived only from posts.account_id -- zero data loss, no ownership guessed. PUBLISHER_UNKNOWN
-- (not SCRAPING_SOURCE) per PRD Section 4.7a's PostAccountAssociation doc comment, which
-- explicitly names PUBLISHER_UNKNOWN as "for pre-migration/legacy rows, Story 3.15" -- this
-- preserves continuity with the pre-FIND-022 mental model (accountId == the post's author)
-- while being honest the identity was never verified via role normalization (3.13/3.14 ran
-- only on posts ingested after this migration). AD-31 Rule 3's organizer-authored predicate
-- does not even read this role for legacy posts -- it falls back to posts.accountId directly
-- -- so this choice affects only the association table's own queryability (AC5), not AC1's
-- "zero data loss" guarantee either way. No SCRAPING_SOURCE row is written for legacy posts;
-- AC1 deliberately fills exactly one of the two per-post slots, leaving the other empty
-- (expected, not a constraint violation -- see this story's architecture note in epics.md).
INSERT INTO "post_account_associations" ("post_id", "account_id", "role", "scraper_actor_run_id")
SELECT "id", "account_id", 'PUBLISHER_UNKNOWN', "scraper_actor_run_id" FROM "posts"
ON CONFLICT DO NOTHING;