# CC-024 — EXPLAIN baseline before Story 3.6r (2026-10-01)

**Purpose:** the "before" half of Story 3.6r's acceptance criterion (Architecture Spine AD-30: same join
count and no new Seq Scan on `Query.events` / `Query.eventBySlug` after the schema change). Re-run the same
four scenarios after 3.6r and compare against this file.

**Setup:** native Windows PostgreSQL 18.4 (local), `pnpm --filter @festgrid/database seed:volume` =
**30,000 events, 30,000 posts, 41,935 schedules, 200 profiles, 5,625 favorites, 910 calendar entries**, plus
the 12 hand-written fixture events; `ANALYZE` run after load; the real resolvers executed through a
`graphql()` call with the web client's own field selections (`getEvents`, `getEventBySlug` without
`instagramEmbed`), logged-in moderator user (fixture user A), second (warm) run measured, SQL captured from the
postgres.js `debug` hook and re-run under `EXPLAIN (ANALYZE, BUFFERS)`. Full plans:
`cc-024-explain-baseline-2026-10-01-plans.txt`.

| Scenario | Statements | Main select | `totalCount` select | Seq scans in main select |
|---|---|---|---|---|
| `getEvents` plain, limit 20 | 4 | **217.6 ms** | 73.3 ms | schedules, posts, social_media_account_profiles |
| `getEvents` temporal filter `UPCOMING` | 4 | **225.1 ms** | 97.4 ms | schedules, posts, social_media_account_profiles |
| `getEvents` filtered by a subscribed account | 4 | **2.9 ms** | 1.3 ms | none |
| `eventBySlug` (mid-table event) | 6 | 0.1 ms (all six ≈ 0.2 ms total) | — | none |

## What the baseline shows
- **`eventBySlug` is fast and index-only** (`events_slug_unique`, `posts_pkey`, `idx_favorites_event_id`, ...).
  This is the plan 3.6r must not change.
- **`getEvents` filtered by account** is index-driven (`account_id_idx`, `event_post_id_idx`).
- **`getEvents` with no selective filter scales with the table**: the main statement computes the "next
  upcoming schedule" sort key through correlated subplans for ~24.7k rows, then top-N heap sorts (≈ 216 ms at
  30k events). This is **pre-existing behavior, not caused by CC-024** — recorded here so 3.6r's "unchanged"
  check compares like with like, and it is a candidate backlog finding for the AD-17 performance work.

## Reproducing
Seed: `pnpm --filter @festgrid/database seed:volume` (clean: `seed:volume:clean`). The capture script was a
throwaway (`graphql()` against `createSchema({typeDefs, resolvers})`, SQL captured by wrapping `postgres`'s
`debug` option, then `EXPLAIN (ANALYZE, BUFFERS)` per statement); Story 3.6r should promote a clean version of
it. Environment note: `@aws-sdk/client-cloudfront` (added by Story 3.6q) was not installed locally and was
stubbed inside the throwaway script; run `pnpm install` before reusing the real resolvers.
