DO $$ BEGIN
 CREATE TYPE "public"."resolution_source" AS ENUM('moderator', 'ai_skill');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "event_match_candidates" ADD COLUMN "resolved_via" "resolution_source";--> statement-breakpoint
ALTER TABLE "event_merges" ADD COLUMN "performed_via" "resolution_source" DEFAULT 'moderator' NOT NULL;
--> statement-breakpoint
-- Every suggestion resolved before this column existed was resolved by a person (the moderator UI, or
-- a script an operator ran): the AI reviewer's apply path does not exist yet. Pending and expired rows
-- stay NULL, because nobody resolved them. event_merges needed no backfill, its column defaults to 'moderator'.
UPDATE "event_match_candidates" SET "resolved_via" = 'moderator' WHERE "status" IN ('accepted', 'rejected') AND "resolved_via" IS NULL;
