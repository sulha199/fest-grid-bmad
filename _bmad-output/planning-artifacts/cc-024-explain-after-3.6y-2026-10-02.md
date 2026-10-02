# CC-024 — EXPLAIN re-run after Story 3.6y (2026-10-02)

**Purpose:** Story 3.6y Task 5 / AC6 (Architecture Spine AD-17: the hot-path `Query.events` EXPLAIN
invariant). This story adds a weekday-containment guard (closed-form `unnest`/`EXTRACT(DOW ...)`
arithmetic) inside `drizzle-where.ts`'s existing `overlaps` operator's `EXISTS` subquery. Compared
against `cc-024-explain-after-3.6r-2026-10-02.md` (the latest valid "before" state — 3.6s/3.6t, the
stories between 3.6r and this one, do not touch the `Query.events`/`Query.eventBySlug` resolvers or
the `scheduleDateRange` fieldMap).

**Setup:** Linux container, native local PostgreSQL 16. `pnpm --filter @festgrid/database seed:volume`
= 30,000 events, 30,000 posts, 41,935 schedules, 200 profiles (same deterministic synthetic-volume
seed 3.6r used). Captured via the promoted, unmodified script, `apps/backend/src/explain-events-queries.ts`
(reused as-is, second consumer after 3.6r — not rewritten or forked). `seed:volume:clean` run
immediately after capture.

| Scenario | Statements | Main select | `totalCount` select | Seq scans in main select |
|---|---|---|---|---|
| `getEvents` plain, limit 20 | 4 | **1097.4 ms** | 128.2 ms | posts, social_media_account_profiles, schedules |
| `getEvents` temporal filter `UPCOMING` | 4 | **1224.0 ms** | 208.1 ms | posts, social_media_account_profiles, schedules |
| `getEvents` filtered by a subscribed account | 4 | **0.9 ms** | 0.1 ms | none |
| `eventBySlug` (mid-table event) | 6 | **0.1 ms** | — | none |

## Comparison vs. `cc-024-explain-after-3.6r-2026-10-02.md`

| Scenario | Statements before -> after | Seq scans before -> after |
|---|---|---|
| `getEvents` plain, limit 20 | 4 -> 4 | schedules, posts, social_media_account_profiles -> **same set** |
| `getEvents` temporal filter `UPCOMING` | 4 -> 4 | schedules, posts, social_media_account_profiles -> **same set** |
| `getEvents` filtered by a subscribed account | 4 -> 4 | none -> **same (none)** |
| `eventBySlug` (mid-table event) | 6 -> 6 | none -> **same (none)** |

**AC6 verdict: PASS.** Every scenario's statement (join) count is unchanged, and the exact set of
relations hit by a Seq Scan per scenario is unchanged (the `schedules` Seq Scan on the plain/`UPCOMING`
scenarios is the pre-existing, CC-024-unrelated "next upcoming schedule" sort-key cost already
documented in `cc-024-explain-baseline-2026-10-01.md` and `cc-024-explain-after-3.6r-2026-10-02.md` —
not introduced by this story, and not chased here per this story's Out of Scope). The absolute
millisecond figures match the 3.6r "after" capture closely (same container, same seed shape, same
day); minor deltas are ordinary run-to-run noise, not a regression signal — AC6 gates statement count
and the Seq-Scan relation set, not absolute timing.

## UPCOMING scenario — plan inspection (Task 5.3)

The `UPCOMING` scenario is the one most directly exercising this story's new SQL (its
`scheduleDateRange`/`overlaps` condition is exactly the code path Task 2 changed), so its full plan
was inspected directly (via a throwaway, since-deleted probe script that captured the exact SQL/params
`explain-events-queries.ts` itself would have run, then re-ran `EXPLAIN (ANALYZE, BUFFERS)` against the
same seeded database — not a modification to the promoted script).

Findings, confirmed from the plan text:

- The planner rewrites the `scheduleDateRange`/`overlaps` `EXISTS` condition into a **Nested Loop Semi
  Join** against `schedules` (not a new separate join relation — this is the same `EXISTS`-against-
  `schedules` construct the `overlaps` operator already generated pre-3.6y; the planner's semi-join
  rewrite of an `EXISTS` is standard Postgres behavior, unrelated to this story's SQL addition).
- The new weekday guard shows up **only as a `Filter:` clause** on the pre-existing `Bitmap Heap Scan on
  schedules schedules_1` node (feeding the top-level `scheduleDateRange` condition) and on the
  pre-existing `Index Scan using schedule_event_date_idx on schedules schedules_2` node (feeding the
  `scheduleEndedBoundary`-adjacent/sort-key schedule lookup) — in both cases as:
  `Filter: ((applicable_days_of_week IS NULL) OR (cardinality(applicable_days_of_week) = 0) OR (SubPlan N))`
  with `SubPlan N` being `-> Function Scan on unnest aw (cost=0.00..0.53 rows=3 width=0)` — a tiny,
  bounded (`rows=3`, matching `cardinality(applicable_days_of_week) <= 7`) in-memory filter evaluated
  per already-fetched schedule row, exactly as designed (Dev Notes: "closed-form, O(1)-per-row").
- **No new join, no new subplan touching a different relation, and no new Seq Scan** was introduced by
  the guard. The two Seq Scans present (`posts`, `social_media_account_profiles`, plus the pre-existing
  `schedules` Seq Scan filtered by `NOT is_main_schedule` for sub-schedule lookups) are unchanged from
  the 3.6r "after" capture and predate this story.

This confirms Task 2's design goal directly from the executed plan, not just by inspection of the SQL
text: the weekday-containment guard is purely an additional in-memory row filter inside the already-
existing correlated `EXISTS`/semi-join against `schedules`, never a new join, new subplan against a new
relation, or new Seq Scan.
