ALTER TABLE "user_settings" ALTER COLUMN "hide_past_events_after_days" SET DEFAULT 0;
--> statement-breakpoint
-- Backfill: reset existing rows still at the old untouched default (7) to the new default (0).
-- Safe as a blanket backfill because no settings UI has shipped yet for this field (verified
-- 2026-09-14: no non-test .tsx component in apps/web renders hidePastEventsAfterDays) -- every
-- row at value 7 got there only via getOrCreateUserSettings's insert default, never a deliberate
-- user choice. A row at any OTHER value was set via a real updateUserSettings call and is left
-- untouched, respecting that as a genuine per-user preference (Story 2.6a AC2).
UPDATE "user_settings" SET "hide_past_events_after_days" = 0 WHERE "hide_past_events_after_days" = 7;