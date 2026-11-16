---
backlog_id: BUG-095
title: "Migration 0056 skipped on prod: logged-in users still get a 7-day past-event grace window"
captured: 2026-10-31
---

# BUG-095 — migration 0056 never ran on prod, so logged-in Discovery shows events for 7 days after they ended

## Capture

Found 2026-10-31 against prod. Logged-out Discovery was correct (a past event disappears once it ends). Logged-in Discovery was not:

- A logged-in test account's `mySettings.hidePastEventsAfterDays` was `7`, and its live default Discovery list held 441 events that ended before today.
- Logged-out, the same list uses the default `0` and was correct.
- Prod's column default for `user_settings.hide_past_events_after_days` was still `7` (read from `information_schema.columns`), although `schema.ts` declares `.default(0)`.

## Cause

`0056_wide_chimera.sql` carried the change (`ALTER COLUMN ... SET DEFAULT 0`, then `UPDATE "user_settings" SET "hide_past_events_after_days" = 0 WHERE "hide_past_events_after_days" = 7`). It was recorded in the journal, but prod never applied it.

drizzle-orm's migrator applies a migration only when the newest `created_at` already recorded in `__drizzle_migrations` is older than the migration's journal `when` (`drizzle-orm@0.30.10`, `pg-core/dialect.js` `migrate`: `lastDbMigration.created_at < migration.folderMillis`). In `packages/database/migrations/meta/_journal.json`:

| idx | tag | `when` (UTC) |
|---|---|---|
| 55 | `0055_fix_schedule_event_date_idx` | 1789455600000 (2026-09-15 07:00, a round hand-set value) |
| 56 | `0056_wide_chimera` | 1789404162279 (2026-09-14 16:42) |

0056's `when` is older than 0055's, and it is the only non-monotonic entry in the whole journal. Once 0055 had been applied on prod, 0056 was never newer than the newest recorded migration, so it was skipped, silently, and every later migration kept moving the high-water mark past it.

A fresh database applies all migrations in one run, with nothing recorded yet, so local and CI never showed it.

No web code writes this field (the web only sends `pushNotificationsEnabled`), so every settings row got `7` from the insert default and none from a deliberate choice. That is why a blanket reset of `7` to `0` is safe, as 0056's own comment reasoned.

## Fix (same PR as this row)

1. `0086_bug_095_reapply_skipped_0056_past_events_default.sql`, a custom (data) migration made with `drizzle-kit generate --custom`, so its journal `when` is newer than every earlier entry. It repeats 0056's two statements and is idempotent (`SET DEFAULT 0`; `UPDATE ... WHERE = 7`). 0056 and its journal entry are untouched (applied history stays as it is). A row at any value other than 7 is left alone.
2. `packages/database/migrations-journal-order.ratchet.test.ts`: fails when any journal entry's `when` is not strictly greater than every earlier one. The single named exception is idx 56 / `0056_wide_chimera`; the test also fails if that exception stops being out of order or names the wrong entry.
3. A rule line in `_bmad-output/project-context.md` (Database & Performance).

Prod gets 0086 through the `db-migrate` job in `.github/workflows/ci.yml` on merge to master.

## Verification

- Scratch local Postgres, all 87 migrations from empty: column default `0`.
- Same database put back into prod's state (default `7`, rows at 7, 3 and 0, the 0086 record deleted), then the migrator re-run: only 0086 applied; default `0`; the row at 7 became 0; the row at 3 stayed 3; the row at 0 stayed 0. A second re-run changed nothing.
- Ratchet test passes on the real journal, and fails on (a) 0086's `when` set older than 0085's and (b) 0056's `when` moved back in order (exception no longer needed).

## After it is merged

Check on prod (read-only): the column default is `0`, no `user_settings` row is left at `7`, and a logged-in Discovery list holds no event that ended before today.

## What else this touches

- The root cause was a hand-set `when` on 0055 (a round, later timestamp), after which `drizzle-kit generate` stamped 0056 with the real clock. The ratchet catches the symptom (the next generated entry lands out of order) in the PR that introduces it, not the hand-set value itself.
- Not changed here: a user who really wants a grace window. There is no settings UI for `hidePastEventsAfterDays` yet, so after this reset nobody can have it at 7 on purpose.
