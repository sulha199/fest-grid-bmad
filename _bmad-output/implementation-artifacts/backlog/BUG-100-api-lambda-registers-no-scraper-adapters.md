---
backlog_id: BUG-100
title: "The API Lambda registers no scraper adapters, so every API-side scrape throws"
captured: 2026-11-02
---

# BUG-100: The API Lambda registers no scraper adapters, so every API-side scrape throws

## Capture

On 2026-10-31 14:32:26Z the moderator re-extract rescrape threw `No scraper adapter registered for platform "instagram"` in the
API Lambda (the only occurrence in 45 days of logs). `apps/backend/src/lambdas/api.ts` imports only `buildServer`; the adapters are
registered by `lib/scraper/register-adapters.ts`, which only `src/index.ts` (local dev) and `lambdas/scraper.ts` import. The PR #133
tests register adapters themselves and local dev imports them, so neither exposed it.

The same registry serves `resolvers.ts` extract-by-URL and the profile lookup (`lookupAccountProfile`), so those API-side calls fail
the same way; no log line shows either being exercised in the last 45 days.

## Fix

Import `register-adapters.js` in the API Lambda entry (or in `server.ts`, so local dev and the Lambda share it) and re-run
`apps/infrastructure/lib/lambda-sharp-isolation.test.ts` (the API bundle must still not reach sharp or tfjs). The ratchet is Story
10.14z. Still unverified after the fix: `getPostByUrl`'s 20 s cap inside the 28 s Lambda limit, and Apify's own account cap
(FIND-103).
