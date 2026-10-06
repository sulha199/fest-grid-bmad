# CC-024 — EXPLAIN re-run after Story 3.6x (2026-10-05)

**Purpose:** Story 3.6x AC7 (Architecture Spine AD-30 Rule 11): first-time baseline the two new/
widened queries this story adds — `Query.relatedEventIds`'s new `postId` branch, and the new
`Query.postByPlatformIdentifiers` lookup — confirming both are index-driven (the new partial
unique index from AC8, and `event_posts`' existing `(post_id, event_id)` index/PK) with no Seq
Scan. Per AC7's own text, this story does **not** re-verify `Query.events`/`Query.eventBySlug`'s
own per-row cost — neither this story's schema change nor its resolvers touch either of those two
hot-path queries or any shared `fieldMap`/`buildOptimizedDrizzleSelect` code they depend on; the
pre-existing hot-path rows below are captured only because the promoted script always runs all
scenarios in one pass, and are not this story's own scope.

**Setup:** Linux container, native local PostgreSQL 16. `pnpm --filter @festgrid/database
seed:volume` = 200 profiles, 30,000 posts, 30,000 events, 41,935 schedules, 38 subscriptions,
5,625 favorites, 910 calendar additions (same deterministic synthetic-volume seed 3.6r/3.6u/3.6y
used). Reused the exact same seeded shape Story 3.6u's own extension already sets up (three
`vol-event-*` rows; `primaryEvent` gains a second linked post via `secondEvent`'s primary post,
and `primaryEvent`'s own primary post is additionally shared with `thirdEvent`) — no new seed
step for this story's `relatedEventIds(postId)` scenario, since that same shared-post shape
already gives it a non-empty group to probe. `Query.postByPlatformIdentifiers` additionally needs
a real, non-null `(platform, platformPostType, platformPostId)` triple — `seed:volume` sets none
on any row (confirmed by reading `seed-volume.ts` directly) — so the script sets one directly on
`primaryEvent`'s own post via a plain column `UPDATE` (no new row), wiped by `seed:volume:clean`'s
cascade delete same as every other volume row (confirmed afterward: posts/events counts returned
to the 35/12 seed baseline, no residual `explain-probe-*` rows). Captured via the promoted,
further-extended script, `apps/backend/src/explain-events-queries.ts` (fourth consumer after
3.6r/3.6y/3.6u — generalized, not forked, same `runGenericCapturedScenario` shape 3.6u's own two
new queries already used). `seed:volume:clean` run immediately after capture in the same step.

| Scenario | Statements | Main select | `totalCount` select | Seq scans in main select |
|---|---|---|---|---|
| `getEvents` plain, limit 20 | 4 | **1537.8 ms** | 149.5 ms | reports, schedules, posts, social_media_account_profiles |
| `getEvents` temporal filter `UPCOMING` | 4 | **2098.5 ms** | 379.8 ms | reports, schedules, posts, social_media_account_profiles |
| `getEvents` filtered by a subscribed account | 3 | **0.3 ms** | 0.2 ms | post_account_associations, reports |
| `eventBySlug` (mid-table event) | 9 | **0.1 ms** | — | post_account_associations |
| `Event.sourcePosts` (multi-post event) | 9 | **0.1 ms** | — | post_account_associations |
| `Query.relatedEventIds` | 1 | **0.1 ms** | — | none |
| `Query.relatedEventIds` (postId variant) | 1 | **0.1 ms** | — | none |
| `Query.postByPlatformIdentifiers` | 1 | **0.1 ms** | — | none |

## This story's own two new/widened queries baseline (Task 4's own scope, AC7)

**Verdict: PASS — both are fully index-driven, no Seq Scan, sub-millisecond.**

- **`Query.relatedEventIds` (postId variant)**: 1 statement, **0.1 ms**, **Seq Scans: none**. The
  resolver's `postId` branch is a simple, non-self-joined read — `event_posts` filtered by
  `post_id` (hits the table's own `(post_id, event_id)` covering index / primary key, the same
  index the pre-existing `eventId`-keyed branch already relies on) inner-joined to `events` for
  the soft-delete/merge exclusion filter (`events_pkey`). No new index was needed for this branch
  — it reuses exactly what AD-30 Rule 11's `eventId` branch already proved index-driven in the
  3.6u capture.
- **`Query.postByPlatformIdentifiers`**: 1 statement, **0.1 ms**, **Seq Scans: none**. This is the
  new query this story's AC8 migration exists to make index-driven: a `WHERE platform = $1 AND
  platform_post_type = $2 AND platform_post_id = $3` lookup against `posts`, left-joined to
  `social_media_account_profiles` on its primary key. Before migration 0074's new partial unique
  index (`posts_platform_post_identity_idx` on `(platform, platform_post_type, platform_post_id)
  WHERE platform_post_id IS NOT NULL AND platform_post_type IS NOT NULL`), this exact `WHERE`
  shape had no supporting index and would have required a full-table Seq Scan on `posts`; with
  the index in place (applied locally in Task 1, confirmed via `\d posts` to carry the correct
  `WHERE` predicate before this capture ran) the probe query resolves in 0.1 ms with no Seq Scan
  recorded anywhere in its plan — the index is doing exactly the job AC8 specifies.

## Pre-existing hot-path queries (`Query.events`, `Query.eventBySlug`) — out of scope, not re-verified

Per AC7's own text, this story's schema change (AC8's new index on `posts`, three already-indexed
columns) and resolver changes (AC1/AC2) never touch `Query.events`/`Query.eventBySlug`'s own
resolver functions, `fieldMap`, or `buildOptimizedDrizzleSelect` — confirmed directly from this
story's own `resolvers.ts` diff, which only adds the new `postByPlatformIdentifiers` resolver and
the new `postId` branch inside `relatedEventIds` (the pre-existing `eventId` branch is untouched).
The two hot-path rows above are captured only because the promoted script always runs every
scenario in one pass; their absolute timings and Seq-Scan sets are not diffed against the prior
3.6u capture here, consistent with this story's own Out of Scope section ("Re-verifying
`Query.events`/`Query.eventBySlug`'s own hot-path per-row cost (AC7) — this story's resolvers
never touch either.").

## AC7 summary

- **This story's own two new/widened queries (`Query.relatedEventIds` postId variant,
  `Query.postByPlatformIdentifiers`): PASS.** Both are index-driven with no Seq Scan, confirmed by
  the regex-extracted Seq Scan list showing none for either scenario (both queries have a single
  captured statement, directly inspectable, with no multi-statement ambiguity).
- **Pre-existing hot-path queries (`Query.events`, `Query.eventBySlug`): out of scope for this
  story per AC7's own text** — this story's diff never touches either resolver; not re-verified
  or diffed here.
