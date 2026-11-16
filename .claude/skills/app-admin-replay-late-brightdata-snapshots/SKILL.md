---
name: app-admin-replay-late-brightdata-snapshots
description: 'Recover Bright Data scrape results that were dropped because the snapshot finished after its job had expired (run TIMED_OUT, job EXPIRED, snapshot still `ready` at Bright Data), by replaying them into prod through apps/backend/scripts/replay-late-brightdata-snapshots.ts: dry run first, then --apply. Use when the user says "replay the late Bright Data snapshots", "recover lost Bright Data posts", "TIMED_OUT Bright Data runs have data", or after a day where many Bright Data runs ended TIMED_OUT with "Run status from stale-job-sweep: PENDING".'
---

# App admin: replay late Bright Data snapshots

**Goal:** put posts back that Bright Data did deliver but the app never stored, because the snapshot finished after the 180-minute job expiry. Since PR #118 the webhook accepts such a delivery itself; this is for what was lost before that, or lost any other way while the snapshot is still downloadable (Bright Data keeps snapshots 30 days, so there is a deadline).

This writes to **prod** and queues **paid AI extraction**. Follow the safety rules; they are not optional.

## Safety rules

1. **The writer credential needs the user's go-ahead for this session.** Prod `DATABASE_URL` is the Secrets Manager secret `festgrid-database-url-prod` (region us-east-1, role `postgres`, bypasses RLS, can write). Fetch it only after the user has said so in this conversation; an approval from an earlier session does not carry over.
2. **Fetch it inside the same command that uses it** (`export DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id festgrid-database-url-prod --query SecretString --output text)"`), never print it, never write it to a file or `.env`, `unset` it afterwards. Report only its length if you need to show it was fetched.
3. **Dry run first, always.** `--apply` only after the user has seen the dry-run totals and said to write. The dry run reads only.
4. **Say what apply does before asking:** it records each run `SUCCEEDED`, saves the new posts, stamps `lastScrapedAt`, completes the jobs, and queues the new posts for AI extraction (Gemini) unless `AI_PROCESSING_QUEUE_URL` is left unset (then posts are saved but not extracted; tell the user that is the alternative).
5. Never use `--from`/`--to` windows you have not confirmed: the script has no default window on purpose.

## Step 1: find out whether there is anything to replay (read-only)

Use the read-only prod role per `reference_prod_readonly_db_access` in memory (`PROD_BACKUP_DATABASE_URL` in `.env.local`, wrapped in `BEGIN READ ONLY ... ROLLBACK`; `readonly_2` sees nothing since the RLS migration). Candidates are Bright Data runs ended `TIMED_OUT` whose job is `EXPIRED`:

```sql
SELECT r.started_at::date d, count(*) runs
FROM scraper_actor_runs r JOIN brightdata_pending_jobs j ON j.snapshot_id = r.run_id
WHERE r.vendor = 'BRIGHTDATA' AND r.status = 'TIMED_OUT' AND j.status = 'EXPIRED'
GROUP BY 1 ORDER BY 1 DESC;
```

If the webhook Lambda log (`FestgridBackendStack-prod-Webhookprod...`) shows `delivered after its expiry` for a day, those were already processed by the webhook; the script then finds nothing for that day.

## Step 2: dry run

From `apps/backend` (use plain `npx tsx`; do **not** set `MSYS_NO_PATHCONV=1` for it, that makes Node look for `tsx` under `C:\c\...` and nothing runs):

```bash
export DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id festgrid-database-url-prod --query SecretString --output text)" \
  && npx tsx scripts/replay-late-brightdata-snapshots.ts --from <YYYY-MM-DD> --to <YYYY-MM-DD>; unset DATABASE_URL
```

`--to` is exclusive (UTC), matched against the run's `started_at`. It lists every expired job in the window, the items Bright Data still holds for it, and how many are "not yet stored". Treat that last number as an **upper bound**: it matches by post URL, and posts that exist under another URL form (`/p/` vs `/reel/`) are rejected later by the unique index. On 2026-10-30: 200 estimated, 88 actually created.

## Step 3: apply (after the user says so)

Run it **in the background** (`run_in_background`): each job takes about 10-15 s, and a foreground command is capped at 10 minutes (the first real run timed out at 560 s after 16 of 20 jobs). Add the extraction queue so new posts are extracted like a normal webhook delivery:

```bash
export AI_PROCESSING_QUEUE_URL="$(aws lambda get-function-configuration --function-name <prod ScraperLambda name> --query Environment.Variables.AI_PROCESSING_QUEUE_URL --output text)"
export DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id festgrid-database-url-prod --query SecretString --output text)" \
  && npx tsx scripts/replay-late-brightdata-snapshots.ts --from <YYYY-MM-DD> --to <YYYY-MM-DD> --apply \
     > "$CLAUDE_JOB_DIR/tmp/replay-apply.log" 2>&1; unset DATABASE_URL
```

Prod Scraper Lambda name: `aws lambda list-functions --query "Functions[?contains(FunctionName,'ScraperLambda') && contains(FunctionName,'prod')].FunctionName"`.

It is **idempotent**: a processed job becomes `COMPLETED` and drops out of the selection, so if it times out or is interrupted, just run the same command again for the rest.

## Step 4: verify (read-only) and report

- Run summary: `grep -E "^(APPLY|Total)|Replay failed"` on the log.
- The log will hold many `duplicate key value violates unique constraint "posts_platform_post_identity_idx"` errors. They are expected: the post already exists, the persist step logs and moves on. Not data loss.
- Confirm in the database: the window's Bright Data runs are `SUCCEEDED` (a job whose snapshot had 0 items stays `TIMED_OUT`, correct), `brightdata_pending_jobs` are `COMPLETED`, and new rows exist: `SELECT count(*), count(*) FILTER (WHERE queued_for_extraction_at IS NOT NULL OR is_extracted) FROM posts WHERE created_at > now() - interval '90 minutes'`.
- Report to the user: jobs replayed, items found, posts actually created, how many were queued for extraction, and that the credential was held in memory only.

## What not to do

- Do not widen the window to "everything": old windows may belong to jobs that were reconciled another way.
- Do not run `--apply` twice in parallel; run it once, in the background, and wait for it.
- Do not copy the credential anywhere to "reuse" it in a later command; fetch again, in the command that uses it.
