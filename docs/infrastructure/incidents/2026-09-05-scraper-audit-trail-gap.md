# Incident: Scraper Audit-Trail Silent Gaps

**Date:** 2026-09-05
**Status:** Root cause fixed and alerting wired up (moderators now notified going forward). Historical backfill of already-orphaned rows not yet started — pending backfill data, see "Backfilling" below.

## Summary

`scraper_actor_runs` (the audit-trail table for every Apify/Bright Data scraper run) and its dependent tables — `unprocessed_scraper_payloads`, `posts`, `apify_pending_jobs`, `brightdata_pending_jobs` — silently ended up with a NULL/missing `scraper_actor_run_id` link whenever the audit-row insert failed, or a downstream FK insert was rejected. Payloads captured for reprocessing (`unprocessed_scraper_payloads`) had no way to be traced back to the run that produced them, and no moderator was ever notified this was happening.

## Investigation

Traced via `/bmad-help` to three silent-catch sites, all pre-existing:

- `apps/backend/src/lib/scraper/record-actor-run.ts` — `recordActorRunStart`, `recordActorRunResult`, `recordSyncActorRun` each caught DB errors and only `console.error`'d, returning `null`/`void`. A failed insert into `scraper_actor_runs` was therefore invisible, and any table that had been given that (never-created) run id ended up with the FK column simply unset.
- `apps/backend/src/lib/posts/persist-unprocessed-payload.ts` — on a Postgres `23503` FK violation (the given `scraperActorRunId` didn't reference an existing row), the code caught the error, `console.warn`'d, and retried the insert **with the FK column dropped**, discarding the run link permanently instead of preserving any trace of it.
- No alerting mechanism was wired to either path — only `console.error`/`console.warn`, which flows to CloudWatch but nothing watches it.

## Root Cause

Two independent failure modes converge on the same symptom:

1. **Missing audit rows.** If `recordActorRunStart`'s insert into `scraper_actor_runs` failed (a real, if rare, DB error), the caller degraded to `scraperActorRunId: undefined` and every downstream write inherited a NULL link — with zero visibility.
2. **Discarded links on FK violation.** If a `scraperActorRunId` was passed to `persistUnprocessedPayload` that didn't (or no longer) reference a real `scraper_actor_runs` row, the retry-without-FK path silently and permanently dropped the association.

## Fix

Implemented via `bmad-quick-dev` (spec: [`_bmad-output/implementation-artifacts/spec-scraper-audit-trail-alerting.md`](../../../_bmad-output/implementation-artifacts/spec-scraper-audit-trail-alerting.md)), reviewed by three independent adversarial passes (2x Blind Hunter, 1x Edge Case Hunter):

1. New `sendScraperAuditAlert` module (`apps/backend/src/lib/notifications/send-scraper-audit-alert.ts`) — emails every `role='moderator'` user, mirroring the existing `send-dangerous-report-moderator-alerts.ts` pattern. Wired into all three `record-actor-run.ts` catch blocks and `persist-unprocessed-payload.ts`'s FK-violation branch, **awaited** at every call site (not fire-and-forget — a Lambda execution environment can freeze before an un-awaited promise completes, which would have silently defeated this fix; confirmed safe since `sendScraperAuditAlert` structurally can never throw).
2. `persist-unprocessed-payload.ts`'s FK-violation retry now preserves the dropped id as `context.orphanedScraperActorRunId` on the retried row instead of discarding it, so it can be backfilled later (see below).
3. New `SCRAPER_AUDIT_TRAIL_FAILURE_ALERT` email template (`packages/domain/src/email/{types,templates}.ts`).

Deferred (logged to `_bmad-output/implementation-artifacts/deferred-work.md` and backlog rows `FIND-020`/`FIND-021`): alert throttling/cooldown, extracting a shared `notifyAllModerators` helper now that this is the 2nd real call site, `render-template.ts`'s pre-existing lack of HTML-escaping, and the alert path's inherent dependency on the same DB it may be reporting failures about.

**This fix stops new gaps from happening silently. It does not retroactively fix rows that were already orphaned before it shipped** — that's the backfill below.

## Backfilling already-orphaned rows

### 1. Size the gap (read-only, no data needed)

```bash
pnpm --filter @festgrid/database run backfill-scraper-actor-runs sizing
```

or on Windows:

```powershell
./scripts/backfill-scraper-actor-runs.ps1
```

This counts `scraper_actor_run_id IS NULL` rows across `unprocessed_scraper_payloads`, `posts`, `apify_pending_jobs`, and `brightdata_pending_jobs`, and reports how many `unprocessed_scraper_payloads` rows already carry a preserved `orphanedScraperActorRunId` (i.e. orphaned *after* this fix shipped, which is directly reconstructible without external data — see "What doesn't need the data request" below).

### 2. What actually needs the data request

`apify_pending_jobs`/`brightdata_pending_jobs` carry the vendor's own run id directly (`run_id`/`snapshot_id`), so those can only be orphaned if the matching `scraper_actor_runs` row was never created in the first place — reconstructible once you supply that run's data (below).

`unprocessed_scraper_payloads` and `posts` have no independent key back to a run at all (unless the payload's `context.orphanedScraperActorRunId` marker exists, from this fix). For every other orphaned row, the *only* way to know which run produced it is to supply the run's own data — this repo's DB has nothing left to reconstruct it from.

### 3. Data request template

Per scraper run you want backfilled, provide:

| Field | Required | Notes |
|---|---|---|
| `vendor` | yes | `APIFY` or `BRIGHTDATA` |
| `vendor_run_id` | yes | the vendor's own run/snapshot id (what you'd look up directly against Apify's or Bright Data's dashboard/API) |
| `instagram_profile_id` | yes | the Instagram account this run scraped — either the platform's native account id or the `@username`, **not** our internal database UUID. The script resolves this against `social_media_account_profiles` (`platform='instagram'`, matching `account_id` or `username`); if it matches more than one row, that run is skipped and reported, never guessed. |
| `started_at` | yes | ISO 8601 timestamp — used to search for candidate `posts`/`unprocessed_scraper_payloads` rows in a time window around it (see "Fuzzy matching" below) |
| `raw_input` | if available | whatever was originally sent to the actor. Optional — omit if you don't have it. |
| `raw_output` | yes | the run's output items. Also used to derive `status` (`SUCCEEDED` if a non-empty array, `FAILED` otherwise, unless overridden) and `item_count`. |

As a **JSON file** (an array, one object per run) — see `packages/database/backfill-scraper-actor-runs.ts` for the type:

```json
[
  {
    "vendor": "APIFY",
    "vendor_run_id": "abc123xyz",
    "instagram_profile_id": "some_influencer_account",
    "started_at": "2026-08-30T12:00:00Z",
    "raw_input": { "usernames": ["some_influencer_account"] },
    "raw_output": [ { "url": "https://instagram.com/p/...", "...": "..." } ]
  }
]
```

Two optional fields not in your list, with defaults if omitted: `trigger_mode` (`SYNC`|`ASYNC`, default `ASYNC`) and `status` (default derived from `raw_output` as above) — only needed if you want to override the derived value.

### 4. Run the backfill

Always dry-run first — it writes nothing until `--apply` is passed:

```bash
pnpm --filter @festgrid/database run backfill-scraper-actor-runs backfill --input path/to/runs.json
```

```powershell
./scripts/backfill-scraper-actor-runs.ps1 -Mode Backfill -InputFile .\runs.json
```

Review the dry-run output, then commit:

```bash
pnpm --filter @festgrid/database run backfill-scraper-actor-runs backfill --input path/to/runs.json --apply
```

```powershell
./scripts/backfill-scraper-actor-runs.ps1 -Mode Backfill -InputFile .\runs.json -Apply
```

Re-running with `--apply` is safe/idempotent: an already-inserted run (matched on `vendor` + `vendor_run_id`) is reused rather than duplicated, and pending-job relinks only ever touch rows still `NULL`.

### 5. Running in production

Production `DATABASE_URL` only exists as a GitHub Actions secret (`environment: production`) and inside AWS (Secrets Manager, via the CDK stack) — it is never available on a local machine. Production backfills therefore run via a dedicated, **manual-only** job in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml): `backfill-scraper-audit-trail`, gated on `workflow_dispatch` (never runs on `push`/`pull_request`), reusing the same `secrets.DATABASE_URL` and AWS credentials the existing `db-migrate`/`deploy-infrastructure` jobs already use against `environment: production`.

**Before triggering it, always dry-run locally first** against a restored copy of prod data (a `pg_dump`/snapshot restore into a scratch Postgres, with `DATABASE_URL` pointed at that) — the local dry-run's fuzzy-match candidate counts (§4 above, `posts`/`unprocessed_scraper_payloads`) are the only real check that the `±2h`/profile heuristic isn't about to relink the wrong rows before you run `--apply` for real.

**Staging the input file (never public, never committed):** GitHub Actions `workflow_dispatch` inputs are size-capped well below what these files reach, and the JSON must never be committed to the repo or embedded in a workflow input/log. Instead it's uploaded ahead of time to `OpsBackfillBucket-prod` — a private S3 bucket added specifically for this (`apps/infrastructure/lib/festgrid-backend-stack.ts`, CDK output `opsBackfillBucketName`) with `blockPublicAccess: BLOCK_ALL`, SSE-S3 encryption, `enforceSSL`, and a 7-day object expiration lifecycle rule as a backstop. The workflow itself also deletes the object immediately after running (`always()` cleanup step), so nothing lingers pending the lifecycle rule.

To run it:

1. Upload the input file:
   ```bash
   BUCKET=$(aws cloudformation describe-stacks --stack-name FestgridBackendStack-prod \
     --query "Stacks[0].Outputs[?OutputKey=='opsBackfillBucketName'].OutputValue" --output text)
   aws s3 cp ./runs.json "s3://$BUCKET/backfill-runs/$(date +%s)-runs.json"
   ```
2. Trigger the workflow (GitHub UI → Actions → "CI/CD Pipeline" → "Run workflow", or `gh workflow run ci.yml`) with:
   - `backfill_s3_key`: the key you uploaded to (e.g. `backfill-runs/1735689600-runs.json`)
   - `apply`: unchecked for a dry run (**always do this first**), checked once you've reviewed the dry-run output
   - `window_hours`: optional, defaults to `2`
3. The job downloads the file from S3, **skips itself entirely (no DB write, no backfill script invocation) if the file is empty or an empty JSON array `[]`**, otherwise runs the same `backfill-scraper-actor-runs.ts backfill` script against prod `DATABASE_URL`, then deletes the S3 object regardless of outcome.
4. Review the job's logs (dry-run candidate counts, skipped/ambiguous profiles) before re-running with `apply: true`.

### What the script does per run

1. Resolves `instagram_profile_id` to an internal `social_media_account_profiles.id` (skips + reports if ambiguous or not found).
2. Inserts a `scraper_actor_runs` row (idempotent — reuses an existing one on `vendor`+`vendor_run_id` conflict).
3. **Exact-match relink** (`apply` only, always safe): `apify_pending_jobs`/`brightdata_pending_jobs` rows whose own `run_id`/`snapshot_id` equals `vendor_run_id` and are still unlinked.
4. **Fuzzy-match candidates** (`posts`/`unprocessed_scraper_payloads`, no exact key exists): rows still unlinked, within `±2h` (`-WindowHours`/`--window-hours` to change) of `started_at` — for `posts`, also scoped to the resolved profile. Always reported as candidates; only written with `--apply`. Review the candidate counts before trusting `--apply` on a run with an unusually wide time window or a very active account.

## Follow-ups (not yet done)

- The fuzzy `posts`/`unprocessed_scraper_payloads` matching is a best-effort heuristic (time window + profile), not a guarantee — spot-check a sample of relinked rows after any real `--apply` run.
- See `_bmad-output/implementation-artifacts/deferred-work.md` ("Deferred from: quick-dev fix of scraper-audit-trail-alerting") and backlog rows `FIND-020`/`FIND-021` for the alerting-side follow-ups (throttling, shared moderator-notify helper, HTML-escaping, the DB-outage correlated blind spot).
