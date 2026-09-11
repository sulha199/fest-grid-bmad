---
title: 'Fix scrape-results-limit and image-serving relative-datetime test failures'
type: 'bugfix'
created: '2026-09-11'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
---

# Fix scrape-results-limit and image-serving relative-datetime test failures

## Intent

**Problem:** Two backend tests were failing under `pnpm test`. (1) `instagram-adapter.test.ts`'s `getNewestPosts` subtest expected `resultsLimit: 30`, but the local `.env` set `SCRAPE_RESULTS_LIMIT="10"` (the `.env.example`/code default and backlog IDEA-015 both specify 30). (2) `resolvers.test.ts`'s "Event image serving and consent gates (Story 3.6h)" Case 3 expected a "still-valid" original image URL, but the mock used a hardcoded absolute `futureDate` (`2026-09-10`) that had already passed, so the resolver (which compares `imageUrlExpiresAt` against the real current time) treated it as expired and returned `null`.

**Approach:** Align the local scrape-results-limit config with the documented default (30) and make the image-consent test's expiry timestamps relative to "now" (past vs. future deltas) so the mock data stays valid regardless of when the suite runs.

## Suggested Review Order

- `resolvers.test.ts` — expiry timestamps are now relative deltas from now, so expiry outcome no longer drifts over time
  [`resolvers.test.ts:1459`](../../apps/backend/src/schema/resolvers.test.ts#L1459)

- `.env` — `SCRAPE_RESULTS_LIMIT` bumped 10 → 30, matching `.env.example` and the test's expected `resultsLimit`
  [`.env:53`](../../.env#L53)
