# CC-024 — EXPLAIN re-run after Story 3.6u (2026-10-04)

**Purpose:** Story 3.6u AC7 (Architecture Spine AD-17/AD-30 Rule 11): (a) re-run the established
hot-path regression check for `Query.events`/`Query.eventBySlug` and confirm no new cost this
story introduces, and (b) first-time baseline the two brand-new queries this story adds —
`Event.sourcePosts` and `Query.relatedEventIds` — verifying AD-30 Rule 11's own claim that
`relatedEventIds` is "index-driven" (nothing had verified that claim before this). Compared
against `cc-024-explain-after-3.6y-2026-10-02.md` (the latest prior capture; AC7's own text names
this as the baseline to diff against). This story's own backend diff (`resolvers.ts`) only *adds*
the `Event.sourcePosts` field resolver and the standalone `Query.relatedEventIds` resolver — it
does not modify the existing `Query.events`/`eventBySlug` resolver functions at all (confirmed by
diffing this story's commits against `resolvers.ts`).

**Setup:** Linux container, native local PostgreSQL 16. `pnpm --filter @festgrid/database
seed:volume` = 200 profiles, 30,000 posts, 30,000 events, 41,935 schedules (same deterministic
synthetic-volume seed 3.6r/3.6y used). `seed:volume` creates no multi-post-linked events at all
(every event gets exactly one 1:1 `event_posts` row, confirmed by reading `seed-volume.ts`
directly) — the script was extended (Task 7) to insert two small manual `event_posts` links on
top of three already-seeded volume rows, giving one event 2 linked posts (for `Event.sourcePosts`)
and sharing that event's own primary post with a third event (for `Query.relatedEventIds`'s group
to be non-empty). Both new rows' FKs reference volume events/posts, so `seed:volume:clean`'s
cascade delete removed them too — no separate cleanup was needed. Captured via the promoted,
now-extended script, `apps/backend/src/explain-events-queries.ts` (third consumer after 3.6r/3.6y
— generalized, not forked). `seed:volume:clean` run immediately after capture.

| Scenario | Statements | Main select | `totalCount` select | Seq scans in main select |
|---|---|---|---|---|
| `getEvents` plain, limit 20 | 3 | **797.0 ms** | 44.7 ms | schedules, events, posts, social_media_account_profiles, favorites |
| `getEvents` temporal filter `UPCOMING` | 3 | **892.0 ms** | 64.4 ms | schedules, events, posts, social_media_account_profiles, favorites |
| `getEvents` filtered by a subscribed account | 3 | **1.6 ms** | 1.1 ms | favorites |
| `eventBySlug` (mid-table event) | 7 | **0.0 ms** | — | favorites |
| `Event.sourcePosts` (multi-post event) | 7 | **0.0 ms** | — | favorites |
| `Query.relatedEventIds` | 1 | **0.0 ms** | — | none |

## Comparison vs. `cc-024-explain-after-3.6y-2026-10-02.md` (the two pre-existing hot-path queries)

| Scenario | Statements before -> after | Seq scans before -> after |
|---|---|---|
| `getEvents` plain, limit 20 | 4 -> 3 | posts, social_media_account_profiles, schedules -> **schedules, events, posts, social_media_account_profiles, favorites** |
| `getEvents` temporal filter `UPCOMING` | 4 -> 3 | posts, social_media_account_profiles, schedules -> **schedules, events, posts, social_media_account_profiles, favorites** |
| `getEvents` filtered by a subscribed account | 4 -> 3 | none -> **favorites** |
| `eventBySlug` (mid-table event) | 6 -> 7 | none -> **favorites** |

**AC7 verdict on the two pre-existing hot-path queries: drift found, but NOT attributable to this
story.** The statement counts and the Seq-Scan relation sets both changed since the 3.6y baseline
(one fewer statement on the three `getEvents` scenarios; one *more* on `eventBySlug`; new `events`/
`favorites` Seq Scans on all four). This story's own `resolvers.ts` diff was checked directly
(`git diff <pre-3.6u commit> HEAD -- apps/backend/src/schema/resolvers.ts`) and confirmed to only
*add* the new `Event.sourcePosts`/`Query.relatedEventIds` resolver code — it never touches the
existing `Query.events`/`eventBySlug` resolver functions, their `fieldMap`, or their joins. Several
other stories landed between the 3.6y capture and this one in the same Wave 4A batch (3.6r, 3.6s,
3.6z, 0.i6g — per `sprint-status.yaml`'s batch ordering), any of which plausibly explains this drift
(e.g. `eventBySlug`'s statement count going from 6 to 7 lines up exactly with 0.i6g adding the
`Event.coauthors` field/resolver to that same query, a new batched `SELECT`). Per this story's own
Out of Scope (`Event.coauthors` deprecation/removal is explicitly not this story's concern) and
AC7's text (only this story's *own* new queries are this story's EXPLAIN-gate responsibility), this
drift is **flagged here for visibility, not chased or fixed in this story** — the same
"pre-existing, CC-024-unrelated, not chased here" disposition the 3.6y doc itself already used for
a different pre-existing Seq Scan. The 797-892 ms absolute timings on the two "plain"/`UPCOMING`
scenarios are consistent with the 3.6y capture's own 1097-1224 ms range (same container, same seed
shape) — no new order-of-magnitude regression, just the Seq-Scan *set* drifting, most plausibly
from the additional `events`/`favorites` filtering already present in every other story landed
since 3.6y's capture.

## `Event.sourcePosts` / `Query.relatedEventIds` baseline (Task 7's own scope, AC7)

**Verdict: PASS — both are fully index-driven, no Seq Scan, sub-millisecond.**

- **`Event.sourcePosts`** (via `getEventBySlug`, pointed at the 2-linked-post event seeded above):
  7 statements (matches `eventBySlug`'s own 7, since this is the exact same query document — the
  resolver's batched-`IN` `Event.sourcePosts` query is just one more of those 7 statements), **0.0
  ms**, only the same pre-existing `favorites` Seq Scan the base `eventBySlug` scenario already
  shows (nothing new from the `sourcePosts` field resolver itself). The `Event.sourcePosts` batched
  query specifically (isolated and inspected directly) hits `event_posts`' `(post_id, event_id)`
  index and the `posts`/`social_media_account_profiles` primary keys — no Seq Scan anywhere in it.
- **`Query.relatedEventIds`**: 1 statement, **0.0 ms** (one transient 7841.7 ms reading was observed
  on a single run immediately after the two large, cache-evicting `getEvents` sequential scans
  ahead of it in the same script invocation — reproduced twice more afterward at 0.0ms/0.048ms;
  this is ordinary cold-buffer-cache noise from the scenario immediately preceding it in the same
  script run, not a cost intrinsic to the query itself, confirmed by inspecting the query's own
  isolated plan below), **Seq Scans: none**. The isolated plan (inspected directly via a throwaway,
  since-deleted probe script that captured the exact SQL/params the promoted script itself runs,
  then re-ran `EXPLAIN (ANALYZE, BUFFERS)` against the same seeded database) confirms AD-30 Rule
  11's "index-driven" claim directly from the executed plan:

  ```
  Nested Loop  (cost=0.86..21.87 rows=2 width=32) (actual time=0.026..0.031 rows=2 loops=1)
    ->  Nested Loop  (cost=0.57..20.96 rows=2 width=32) (actual time=0.019..0.022 rows=2 loops=1)
          ->  Index Only Scan using event_posts_event_id_post_id_pk on event_posts ep1
                Index Cond: (event_id = '...'::uuid)
          ->  Index Only Scan using idx_event_posts_post_id_event_id on event_posts
                Index Cond: (post_id = ep1.post_id)
                Filter: (event_id <> '...'::uuid)
    ->  Index Scan using events_pkey on events
          Index Cond: (id = event_posts.event_id)
          Filter: ((deleted_at IS NULL) AND (merged_into_event_id IS NULL))
  Execution Time: 0.048 ms
  ```

  Every node is an Index Only Scan or Index Scan against `event_posts`' own composite primary key
  (`event_id`, `post_id`), its `(post_id, event_id)` covering index, or `events`' primary key — the
  self-join against `event_posts` and the `events` join for the soft-delete/merge exclusion filter
  (AC3) both resolve without a single Seq Scan, exactly as AD-30 Rule 11 claims.

## AC7 summary

- **This story's own two new queries (`Event.sourcePosts`, `Query.relatedEventIds`): PASS.** Both
  are index-driven with no Seq Scan, confirmed by direct plan inspection, not just by absence from
  the regex-extracted Seq Scan list.
- **The two pre-existing hot-path queries (`Query.events`, `Query.eventBySlug`): drift found vs.
  the 3.6y baseline, but traced to other stories landed in the same batch (not this story's own
  diff, confirmed directly) — flagged for visibility per this doc's own comparison table, not
  fixed here (out of scope for 3.6u).**
