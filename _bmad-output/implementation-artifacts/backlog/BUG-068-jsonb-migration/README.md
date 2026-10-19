---
backlog_id: BUG-068
title: "jsonb migration runbook (look, apply, rollback) and its self-check"
captured: 2026-10-19
---

# BUG-068 — converting the stored jsonb strings into objects

Runbook for the **data** half of BUG-068 (the code half is `customJsonb` on the 27 plain `jsonb()` columns; see `../BUG-068-jsonb-columns-double-encoded-by-drizzle.md`). Same shape as `../IDEA-075-legacy-bulk-update/`: look, apply (one transaction), rollback, look again. **Tested on a scratch PostgreSQL 16 built from the repository's migrations (`test-on-scratch-db.sh`); not run on production data.**

**Order matters.** (1) deploy the writer fix, (2) `01-look.sql`, (3) `02-apply.sql`, (4) `01-look.sql` again, (5) run the production pack and read its "JSON encoding" item. Running 02 before the writer fix converts today's rows and leaves tomorrow's new rows as strings.

| File | What |
|---|---|
| `01-look.sql` | read-only. Per column: rows, non-null, JSON-text-in-string (what apply converts), other strings (left alone), objects/arrays, bytes in the string rows. Run it as the database owner (it reads `user_locations`, which the production pack's role cannot) |
| `02-apply.sql` | one transaction. Converts `(col #>> '{}')::jsonb` where the value is a jsonb string holding JSON text of an object or array. **Core** = the 7 columns SQL reads or is about to read (`schedules.location_details`, `social_media_account_profiles.default_location`, `user_locations.location_details`, `default_location_change_requests.previous_location`/`new_location`, `events.links`, `posts.additional_image_urls`). `-v include_rest=1` adds the 20 journal, job, cache and raw-payload columns. Per-column ceiling `-v max_rows=N` (default 200000). Aborts and writes nothing if a ceiling is exceeded, a row changed in between, or there is nothing to convert. Before-state in `_bak_bug068` |
| `03-rollback.sql` | puts the string form back, only for values still exactly as apply left them |
| `test-on-scratch-db.sh` | `DATABASE_URL=postgres://…/EMPTY_scratch_db ./test-on-scratch-db.sh` — refuses a database that already has the schema |

**What it does not do.** It changes no column type and no application code, deletes nothing, and touches only the rows it backed up. Reads through Drizzle work in both shapes (`customJsonb.fromDriver` parses a legacy string), so a rollback is only needed if something SQL-side misbehaves.

**Sizing (production, 2026-10-19, the four columns the read-only role can see):** `schedules.location_details` 1,460 · `social_media_account_profiles.default_location` 28 · `events.links` 247 · `posts.additional_image_urls` 496 = 2,231 rows. The other core columns and all `rest` columns were not counted: run `01-look.sql` first.
