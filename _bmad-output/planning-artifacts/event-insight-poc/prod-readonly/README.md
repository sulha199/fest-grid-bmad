# Running the production check safely

`apps/backend/scripts/poc-event-insight/prod-readonly-check.ts` answers, with **aggregates only**, what the scratch-database work could not: the production `jit` setting, the real size of the catalogue, events per post, how many events and schedules have a location, the country mix of stored pins, how many legacy accounts the bulk update would touch, and what today's list query does on the real data.

## Why it runs on your machine, not in the cloud session

The cloud sandbox reaches the internet through an HTTPS proxy that **does not carry raw-TCP databases** (its own documentation lists them as unsupported and says to report rather than work around). A Postgres connection from there will not work even with valid credentials — so putting a production `DATABASE_URL` in the cloud environment would expose it to every process in the session and gain nothing. Run the check where the database is reachable, and send back only the report.

## Steps

1. **Pick the target.** Best: a read replica, a restored snapshot or a Supabase branch. Next best: the primary, off-peak. `EXPLAIN (ANALYZE)` *executes* the two list statements it checks.
2. **Create the role.** Edit the password in `01-create-readonly-role.sql` (do not commit it) and run it as the database owner. It creates `festgrid_poc_ro`: not a superuser, read-only sessions, 10 s statement timeout, 2 connections, and **column-level `SELECT` only** on the five tables the check reads — no captions (`posts.content`), no users, API keys, push tokens, settings, saved locations, subscriptions, calendar entries or favorite owners. If row-level security is on for those tables, add the policies noted in the file.
3. **Run the check** from `apps/backend`, with the read-only URL in the environment (a separate file or a one-off variable — **not your main `.env`**):
   ```
   DATABASE_URL='postgres://festgrid_poc_ro:…@HOST:PORT/DB' BACKEND_PORT=4001 \
     npx tsx scripts/poc-event-insight/prod-readonly-check.ts --out prod-report.md
   ```
   Flags: `--no-explain` skips the two `EXPLAIN (ANALYZE)` runs; `--stats` adds `pg_stat_statements` (needs the extension and `GRANT pg_read_all_stats` on a replica).
4. **Read `prod-report.md` before sharing it.** It holds counts, ratios, plan text and the host/port/database name; no row data, no credentials. Share it in the session (or commit it under `results/`).
5. **Remove the role:** run `02-drop-readonly-role.sql`.

## What stops a write (any one is enough)

* The check **refuses to start** if the connecting role is a superuser or can INSERT/UPDATE/DELETE/TRUNCATE any hot or user-data table (so pointing it at the app's own `DATABASE_URL` fails at once — verified).
* Every statement runs inside `BEGIN READ ONLY` with `SET LOCAL statement_timeout`, on one connection named `festgrid-poc-readonly`.
* Every statement passes `assertReadOnlySql` (single `SELECT`/`SHOW`/`EXPLAIN` of one; no DML/DDL; no `pg_sleep`, `set_config`, `nextval`, `pg_terminate_backend`, …; comments and literals cannot hide a keyword).
* The role itself has no write privilege (verified: `INSERT` and `UPDATE` are denied even in an explicit read-write transaction) and `default_transaction_read_only = on`.
* The pack's statements never name a user-data table or a caption/handle/email column — a unit test enforces it.

The other measurement scripts (`perf-*.ts`, `plan-guard-run.ts`) **refuse any database that is not on this machine** (`scratch-guard.ts`): they add columns and indexes and run captured writes. They can never be pointed at production.

## If you start a local Claude Code session instead

A local session can reach the database and read local files. Keep the same discipline: give it the read-only URL through the environment, **do not let it `cat` your `.env`** (the file's contents would enter the model's context and the stored transcript), and review any command that touches the network.

## What is verified and what is not

Verified on a scratch PostgreSQL 16 built from the repository's migrations: the role SQL applies and is idempotent; the role can run the whole pack and the two list statements; it is denied `users`, `posts.content`, `favorites.user_id` and every write; the pack refuses a superuser role; 7 unit tests cover the statement policy and 3 the local-only guard. **Not verified:** Supabase specifics (row-level security on these tables, the pooler's handling of `SET LOCAL`, whether `pg_stat_statements` is readable) and that production's column names match the migrations (they are the repository's, so they should).
