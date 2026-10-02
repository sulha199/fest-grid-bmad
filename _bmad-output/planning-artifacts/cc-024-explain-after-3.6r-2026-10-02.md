# CC-024 — EXPLAIN re-run after Story 3.6r (2026-10-02)

**Purpose:** the "after" half of Story 3.6r's AC6 (Architecture Spine AD-30 Rule 4: same join count
and no new Seq Scan on `Query.events` / `Query.eventBySlug` after the `event_posts`/multi-event schema
change). Compared against `cc-024-explain-baseline-2026-10-01.md`.

**Setup:** Linux container, native local PostgreSQL 16, `pg_trgm` 1.6 installed (default `public` schema).
`pnpm --filter @festgrid/database seed:volume` = **30,000 events, 30,000 posts, 41,935 schedules, 200
profiles, 5,625 favorites, 910 calendar entries** (same shape as the baseline's Windows/PostgreSQL 18.4
capture), `ANALYZE` run after load by `seed-volume.ts` itself. Captured via the promoted script,
`apps/backend/src/explain-events-queries.ts`: the real GraphQL schema (`createSchema({ typeDefs,
resolvers })`), the web client's own `getEvents`/`getEventBySlug` operations (parsed and re-printed
verbatim from `apps/web/src/features/events/queries.graphql`), executed through `graphql()` as the
fixture moderator user, SQL captured via `db/client.ts`'s new SQL-capture sink (the module every
resolver actually queries through), each captured statement re-run under `EXPLAIN (ANALYZE, BUFFERS)`.
`seed:volume:clean` run immediately after capture (volume rows break DB-backed tests).

| Scenario | Statements | Main select | `totalCount` select | Seq scans in main select |
|---|---|---|---|---|
| `getEvents` plain, limit 20 | 4 | **898.7 ms** | 152.3 ms | schedules, posts, social_media_account_profiles |
| `getEvents` temporal filter `UPCOMING` | 4 | **916.6 ms** | 186.7 ms | schedules, posts, social_media_account_profiles |
| `getEvents` filtered by a subscribed account | 4 | **1.1 ms** | 0.1 ms | none |
| `eventBySlug` (mid-table event) | 6 | **0.1 ms** | — | none |

## Comparison vs. baseline

| Scenario | Statements before -> after | Seq scans before -> after |
|---|---|---|
| `getEvents` plain, limit 20 | 4 -> 4 | schedules, posts, social_media_account_profiles -> **same** |
| `getEvents` temporal filter `UPCOMING` | 4 -> 4 | schedules, posts, social_media_account_profiles -> **same** |
| `getEvents` filtered by a subscribed account | 4 -> 4 | none -> **same (none)** |
| `eventBySlug` (mid-table event) | 6 -> 6 | none -> **same (none)** |

**AC6 verdict: PASS.** Every scenario's statement (join) count is unchanged, and no scenario introduces a
new Seq Scan. `events LEFT JOIN posts` remains the only join touching an events/posts-family table on the
hot path; `event_posts`/`event_slug_aliases` are read by none of these four queries, matching AD-30 Rule 4's
requirement exactly.

The absolute millisecond figures are **not** directly comparable to the baseline's (different hardware — this
capture ran on a Linux container, the baseline on native Windows/PostgreSQL 18.4 — the baseline doc itself
notes this limitation isn't about absolute timing). What AC6 actually gates — statement count and the
specific set of relations hit by a Seq Scan per scenario — matches exactly, scenario for scenario. The
pre-existing, CC-024-unrelated cost of the plain/`UPCOMING` "next upcoming schedule" sort key over the full
table (recorded in the baseline as pre-existing, not a regression) reappears here too, consistent with the
baseline's own expectation.

## `event_post_id_idx` decision (Task 10.4): **KEEP**

The account-filtered `getEvents` plan (the one scenario that touches `events.post_id` directly, joining
`posts` to `events`) was inspected in full:

```
->  Index Scan using event_post_id_idx on events  (cost=0.29..14.79 rows=1 width=167) (actual time=0.011..0.011 rows=1 loops=3)
      Index Cond: (post_id = posts.id)
      Filter: (NOT (SubPlan 7))
```

The planner actively chose `event_post_id_idx` over the new `events_post_id_extraction_ordinal_unique`
composite index, even though both have `post_id` as their leading column (a composite index's leading
column alone usually *can* serve an equality lookup). The reason the two are not interchangeable here, by
design, not planner quirk: `event_post_id_idx` is a **partial** index (`WHERE deleted_at IS NULL`, AD-8's
soft-delete convention), while the new `(post_id, extraction_ordinal)` unique is **deliberately
unconditional on `deleted_at`** (AD-30 Rule 1 requires this — a soft-deleted event must not be
re-creatable by a re-run, so the uniqueness check cannot exclude soft-deleted rows). Dropping
`event_post_id_idx` would force every `post_id`-keyed lookup back onto the unconditional composite index,
which carries every soft-deleted event's row too — a real (if currently small, at 12-30,000 events with
few soft-deletes) regression that only grows as soft-deleted events accumulate over the product's lifetime.

**Decision: `event_post_id_idx` is kept, not dropped.** `postIdIdx` stays in `packages/database/schema.ts`
and no `DROP INDEX` was added to migration `0065_naive_martin_li.sql`.
