---
backlog_id: IDEA-014
title: "Bump cron-scrape SCRAPE_RESULTS_LIMIT from 10 to 30 so a missed/delayed cron cycle doesn't silently skip an account's older posts"
captured: 2026-09-11
fixed: 2026-09-11
---

# IDEA-014 — Bump SCRAPE_RESULTS_LIMIT to 30

## Capture

Reported by user via `bmad-help`. Both vendor triggers read `env.scrapeResultsLimit` (Apify's
`resultsLimit` in `trigger-apify-for-target.ts:41`, Bright Data's `numOfPosts` in
`trigger-brightdata-for-target.ts:28`), which defaulted to 10 in `env.ts:157` when
`SCRAPE_RESULTS_LIMIT` is unset.

**Not a pure env-var change:** `festgrid-backend-stack.ts`'s `scraperLambda` (the Lambda
EventBridge actually invokes for the daily batch) never forwarded `SCRAPE_RESULTS_LIMIT` into
its environment block at all (only `apiLambda` did) — the cron path always ran on the
code-level default regardless of any env var set elsewhere.

## Implemented, 2026-09-11

1. `env.ts:157` default raised to 30.
2. `SCRAPE_RESULTS_LIMIT` added to `scraperLambda`'s environment block in
   `festgrid-backend-stack.ts` with an explanatory comment.
3. `.env.example`/`SETUP_WALKTHROUGH.md` documented defaults updated.
4. `instagram-adapter.test.ts`'s `resultsLimit` assertion updated to 30.

Verified: infra CDK test (`festgrid-backend-stack.test.ts`) passes, backend typecheck clean,
`instagram-adapter.test.ts` passes against the code default (only fails if a developer's local,
gitignored `.env` still pins `SCRAPE_RESULTS_LIMIT=10` — not a code defect).

Not committed/deployed as of capture; deploy is via the normal push-to-master CI/CD path
(`ci.yml` `deploy-infrastructure`, prod only).
