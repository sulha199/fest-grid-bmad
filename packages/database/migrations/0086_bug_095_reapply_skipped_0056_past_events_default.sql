-- BUG-095: re-run of 0056_wide_chimera, which prod never applied.
--
-- drizzle's migrator only applies a migration whose journal `when` is newer than the newest
-- one already recorded in __drizzle_migrations. 0056's `when` (2026-09-14) is older than 0055's
-- (2026-09-15), so once 0055 had run on prod, 0056 was skipped for good. Prod therefore kept the
-- old column default of 7 and every logged-in user's settings row kept 7, which showed events
-- for up to 7 days after they ended. A fresh database applies everything in one run, so local
-- and CI never showed it. 0056 and its journal entry stay as they are (applied history).
--
-- Both statements are idempotent: on a database where 0056 did run they change nothing.
ALTER TABLE "user_settings" ALTER COLUMN "hide_past_events_after_days" SET DEFAULT 0;
--> statement-breakpoint
-- Blanket backfill is safe for the reason 0056 gave: no web code writes this field (the web
-- only ever sends pushNotificationsEnabled), so a row at 7 got there only through the old
-- insert default, never a deliberate choice. A row at any other value was set on purpose and is
-- left untouched.
UPDATE "user_settings" SET "hide_past_events_after_days" = 0 WHERE "hide_past_events_after_days" = 7;
