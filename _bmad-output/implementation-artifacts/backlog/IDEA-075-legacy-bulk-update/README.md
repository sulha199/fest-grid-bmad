---
backlog_id: IDEA-075
title: "Legacy accounts: bulk-update runbook (look, apply, rollback, after) and its self-check"
captured: 2026-10-18
---

# IDEA-075 — legacy accounts: bulk update (decision 2026-10-18)

Sets every **never-classified account that has no default location** to `CURATOR_GUIDE` / `CONFIRMED`. Never-classified accounts that *already have* a location are **not** changed (product owner's decision). Nothing else is touched: scraping is unchanged, no caption is deleted, no country or time-zone column exists yet.

Run in order, with a database URL that can write (`psql "$DATABASE_URL" -f <file>`):

| file | does |
|---|---|
| `01-look.sql` | read-only: states, the set, the accounts mid-classification. **Read the list: every row should be a curator.** |
| `02-apply.sql` | one transaction: snapshot into `_bak_account_type_20261018`, update, verify the count, commit. Aborts and writes nothing if the set is empty, larger than `max_rows` (300; edit on purpose), or a row changed in between. A second run is refused while the backup table exists. |
| `03-rollback.sql` | only if needed: restores the snapshot for rows still exactly as `02` left them |
| `04-after.sql` | read-only: result, remaining never-classified accounts, and the residual-risk list (never-classified accounts with a location whose events are scattered over 5+ cities) |
| `test-on-scratch-db.sh` | re-runs the tests below against an EMPTY scratch database (`DATABASE_URL=… ./test-on-scratch-db.sh`); it applies the repository's migrations, seeds six made-up accounts and asserts every scenario. It refuses to run if the schema is already present, so it cannot touch real data |

**Tested** (by `test-on-scratch-db.sh`, which can be re-run) on a scratch PostgreSQL 16 built from the repository's 80 migrations, with six seeded accounts: happy path, a refused second run, rollback, and the three abort paths (too many rows, an account that started classification in between, an empty set) — the abort paths leave the database untouched and no backup table behind. **Not run on production data**, and the claim that the set consists of curators is the product owner's, not verified.

What it changes for those accounts (from the code): future captions are cleared after extraction and images not re-hosted (Story 3.4o); future events are ingested as `stub` and no longer count as organizer-authored for the primary-post choice and the first-organizer notification (`isOrganizerAuthoredPost`: until now a null-typed curator counted as an organizer). Captions already stored are kept; deleting them would also remove the ability to re-extract those posts and is a separate decision.

`_bak_account_type_20261018` is a scratch table outside the drizzle migrations (AD-3): export it if you want to keep it, then `DROP TABLE _bak_account_type_20261018;`.
