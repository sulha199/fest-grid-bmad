# Running the production check safely

`apps/backend/scripts/poc-event-insight/prod-readonly-check.ts` answers, with **aggregates only**, what the scratch-database work could not: the production `jit` setting, the real size of the catalogue, events per post, how many events and schedules have a location, the country mix of stored pins, how many legacy accounts the bulk update would touch, and what today's list query does on the real data.

## Why it runs on your machine, not in the cloud session

The cloud sandbox reaches the internet through an HTTPS proxy that **does not carry raw-TCP databases** (its own documentation lists them as unsupported and says to report rather than work around). A Postgres connection from there will not work even with valid credentials — so putting a production `DATABASE_URL` in the cloud environment would expose it to every process in the session and gain nothing. Run the check where the database is reachable, and send back only the report.

## Steps

1. **Pick the target.** Best: a read replica, a restored snapshot or a Supabase branch. Next best: the primary, off-peak. `EXPLAIN (ANALYZE)` *executes* the two list statements it checks.
2. **Create the role.** Edit the password in `01-create-readonly-role.sql` (do not commit it) and run it as the database owner. It creates `festgrid_poc_ro`: not a superuser, read-only sessions, 10 s statement timeout, 2 connections, and **column-level `SELECT` only** on the five tables the check reads — no captions (`posts.content`), no users, API keys, push tokens, settings, saved locations, subscriptions, calendar entries or favorite owners. If row-level security is on for those tables, add the policies noted in the file. **If you created the role before 2026-10-19**, run the file again (it is idempotent): the pack now also reads `events.links` and `posts.additional_image_urls` (their JSON type only, to size BUG-068).
3. **Run the check** from `apps/backend`. The connection string comes **only** from `PROD_RO_DATABASE_URL`; the script never reads `DATABASE_URL` or any `.env` file (the backend's env loader would otherwise pull in the repository's `.env`, which holds the application's own owner-privileged URL). The user name must start with `festgrid_poc_ro` or it refuses.
   ```
   cd apps/backend
   export PROD_RO_DATABASE_URL='postgres://festgrid_poc_ro:…@HOST:PORT/DB'   # type it, or `source` a separate file; not your main .env
   npx tsx scripts/poc-event-insight/prod-readonly-check.ts --label replica --out /tmp/prod-report.md
   ```
   Flags: `--label <text>` names the target in the report ("replica", "primary, off-peak"); `--no-explain` skips the two `EXPLAIN (ANALYZE)` runs; `--stats` adds `pg_stat_statements` (needs the extension and `GRANT pg_read_all_stats` on a replica).
   *Optional second query:* `results/prod-findings-review-2026-10-19-queries/recall-classes.sql` (IDEA-085) needs `event_posts` and `event_match_candidates`, which this role deliberately cannot read; run it with the role you used for the 2026-10-19 report.
4. **Read the report before sharing it.** It holds counts, ratios, plan text, and the port, database name and a *masked* host (`*.*.supabase.co`); no row data, no credentials.
5. **Pass it back** — see the next section.
6. **Remove the role:** run `02-drop-readonly-role.sql`.

## Doing it with a local Claude Code session, and passing the result back to the cloud session

> **2026-10-19:** the current brief for the local session (three checks: the corrected pack, the recall split, the optional Geoapify probe) is [`local-session-brief-2026-10-19.md`](./local-session-brief-2026-10-19.md); the prompt below is the original single-check version.

There is no channel I can rely on from your machine into the cloud session; the two reliable hand-offs are the chat and git.

**Prepare (once, in your terminal):**
```
git fetch origin && git checkout claude/ecstatic-shannon-e8eh9h      # the scripts exist only on this branch
pnpm install
export PROD_RO_DATABASE_URL='postgres://festgrid_poc_ro:…@HOST:PORT/DB'   # in THIS shell, then start Claude from it
claude
```
Do not put the URL in `.env`, and do not ask the local Claude to open, `cat` or print any `.env` file or the variable: whatever it reads enters its context and the stored transcript.

**Prompt to give the local Claude:**
> Check out branch `claude/ecstatic-shannon-e8eh9h`. Read `_bmad-output/planning-artifacts/event-insight-poc/prod-readonly/README.md`. Run the production check exactly as it says, using the environment variable `PROD_RO_DATABASE_URL` that is already set in this shell, with `--label "<replica | primary off-peak>"` and `--out /tmp/prod-report.md`. Do not open, read or print any `.env` file and do not print the variable. Show me the report and stop. Do not commit or push anything until I tell you to.

(You can equally run the one `npx tsx …` command yourself in the terminal; the local Claude adds nothing the script does not already do.)

**Pass the result back — pick one:**
* **Paste** the contents of `/tmp/prod-report.md` into the cloud session. Nothing is stored in git. It is about 100 lines.
* **Commit and push** the report, then tell the cloud session to pull it. After you have read it, tell the local Claude: *"Copy `/tmp/prod-report.md` to `_bmad-output/planning-artifacts/event-insight-poc/results/prod-readonly-report-<YYYY-MM-DD>.md`, stage only that file (no `git add -A`), commit it and push to `claude/ecstatic-shannon-e8eh9h`."* The cloud session then runs `git pull` and reads it. Production aggregates will then live in the repository history; skip this route if you would rather they did not.

Then say in the cloud session: "the report is in the chat" or "pull the branch".

## What stops a write (any one is enough)

* The check takes its URL **only** from `PROD_RO_DATABASE_URL` and refuses any user name that does not start with `festgrid_poc_ro` — it never falls back to `DATABASE_URL` or a `.env` file (verified: with `DATABASE_URL` and a repository `.env` both pointing elsewhere it dialled only the read-only URL).
* It also **refuses to start** if the connecting role is a superuser or can INSERT/UPDATE/DELETE/TRUNCATE any hot or user-data table (verified against the owner role).
* Every statement runs inside `BEGIN READ ONLY` with `SET LOCAL statement_timeout`, on one connection named `festgrid-poc-readonly`.
* Every statement passes `assertReadOnlySql` (single `SELECT`/`SHOW`/`EXPLAIN` of one; no DML/DDL; no `pg_sleep`, `set_config`, `nextval`, `pg_terminate_backend`, …; comments and literals cannot hide a keyword).
* The role itself has no write privilege (verified: `INSERT` and `UPDATE` are denied even in an explicit read-write transaction) and `default_transaction_read_only = on`.
* The pack's statements never name a user-data table or a caption/handle/email column — a unit test enforces it.

The other measurement scripts (`perf-*.ts`, `plan-guard-run.ts`) **refuse any database that is not on this machine** (`scratch-guard.ts`): they add columns and indexes and run captured writes. They can never be pointed at production.

## What is verified and what is not

Verified on a scratch PostgreSQL 16 built from the repository's migrations: the role SQL applies and is idempotent; the role can run the whole pack and the two list statements; it is denied `users`, `posts.content`, `favorites.user_id` and every write; the pack refuses a superuser role; 9 unit tests cover the statement policy and the URL rules, and 3 the local-only guard. **Not verified:** Supabase specifics (row-level security on these tables, the pooler's handling of `SET LOCAL`, whether `pg_stat_statements` is readable) and that production's column names match the migrations (they are the repository's, so they should).
