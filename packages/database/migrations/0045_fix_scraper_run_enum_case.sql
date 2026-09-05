-- Migration 0032 created scraper_run_vendor/scraper_run_trigger_mode with lowercase
-- enum values ('apify'/'brightdata', 'sync'/'async'), but schema.ts and every call
-- site (record-actor-run.ts, webhook.ts, resolvers.ts, the GraphQL ActorRunVendor/
-- ActorRunTriggerMode enums) have always used uppercase literals ('APIFY'/'BRIGHTDATA',
-- 'SYNC'/'ASYNC'). No migration ever renamed the values to match -- the drizzle-kit
-- snapshot journal was updated to reflect uppercase (see meta/0034_snapshot.json
-- onward) without a corresponding SQL migration ever being committed. Any database
-- built from this migration folder alone (including a fresh CI test DB or a
-- from-scratch production DB) is left with the original lowercase labels, causing:
--   - queryActorRuns' vendor filter to throw "invalid input value for enum" whenever
--     a moderator filters the Actor Runs tab by APIFY or BRIGHTDATA
--   - recordActorRunStart/recordActorRunResult/recordSyncActorRun to silently fail
--     (their own try/catch swallows the error) whenever they insert/update a row,
--     degrading the actor-run audit trail without a visible error anywhere
--
-- RENAME VALUE is a catalog-only, non-destructive rename: it does not touch existing
-- row data (rows keep referencing the same internal enum OID) and does not require
-- dropping/recreating the type or its dependent columns, unlike the old, unused
-- packages/database/fix-enum-case.sql script. Each rename is guarded so this migration
-- is a no-op on any database where the value has already been corrected by hand.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'scraper_run_vendor' AND e.enumlabel = 'apify'
  ) THEN
    ALTER TYPE "public"."scraper_run_vendor" RENAME VALUE 'apify' TO 'APIFY';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'scraper_run_vendor' AND e.enumlabel = 'brightdata'
  ) THEN
    ALTER TYPE "public"."scraper_run_vendor" RENAME VALUE 'brightdata' TO 'BRIGHTDATA';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'scraper_run_trigger_mode' AND e.enumlabel = 'sync'
  ) THEN
    ALTER TYPE "public"."scraper_run_trigger_mode" RENAME VALUE 'sync' TO 'SYNC';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'scraper_run_trigger_mode' AND e.enumlabel = 'async'
  ) THEN
    ALTER TYPE "public"."scraper_run_trigger_mode" RENAME VALUE 'async' TO 'ASYNC';
  END IF;
END $$;
