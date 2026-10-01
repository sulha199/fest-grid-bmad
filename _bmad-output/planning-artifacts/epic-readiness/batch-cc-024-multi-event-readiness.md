---
batch: cc-024-multi-event
swept: true
date: 2026-10-01
scope: batch-scoped (not per-epic) — CC-024 (Multi-event posts and cross-post event matching),
  dispatched from cc-024-multi-event-wave-plan.md Waves 2-5
gates: [1, 3]
stories_covered: [3.6r, 3.6s, 3.6t, 3.6u, 3.6v, 3.6w, 3.6x, 3.6y, 3.6z, 3.7f, 3.7g, 3.7h, 3.7i, 3.13, 3.14, 3.15, 3.18]
new_prerequisite_stories: []
---

# Batch Readiness — CC-024 Multi-Event Posts & Cross-Post Matching

Gate 1 (architecture/infra) and Gate 3 (foundational/cross-cutting) run once over the batch. Gate 2
(UI) stays per-story. Epic 3 was last swept whole on 2026-09-11 (`epic-3-readiness.md`), before any
of these 17 stories existed, so this is their first sweep. Every dependency and file reference below
was checked against source and `sprint-status.yaml`, not assumed from the wave plan or proposal.

**Headline:** no new prerequisite stories. Two existing-but-not-yet-created stories need AC
corrections before `create-story` (**3.6t** — title "Ingest multiple events per post, with per-event
slugs and notifications"; **3.6v** — title "Match new posts to existing events and enrich them in
place"), and one already-drafted Epic 0 backlog story needed its scope corrected directly
(**0.i2c** — "Adopt the wrapper in the async inference path"). All three corrections have been applied
to `epics.md` already (see Corrections, below) — no corresponding `sprint-status.yaml` change, since
none of the three changed `done`/`review` status and no new story key was added.

## Verified facts

- **pg_trgm:** confirmed independently (`psql ... pg_available_extensions`) — `pg_trgm` 1.6 is
  available on the local native Windows Postgres 18.4, **not installed** (`installed_version` empty).
  Matches the wave plan's pre-flagged note exactly. AD-30/Story 3.6r's planned
  `CREATE EXTENSION IF NOT EXISTS pg_trgm` (default schema) is the correct fix and needs no change.
- **Schema state:** `packages/database/schema.ts` still has `postIdUnq: unique().on(t.postId)` on
  `events` and none of `event_posts`, `extraction_ordinal`, `detail_level`, `merged_into_event_id`,
  `notified_at`, `platformPostId`/`platformPostType` exist yet — confirms this is genuinely greenfield
  for 3.6r onward, no stale partial implementation to reconcile.
- **Ingestion idempotency today:** `process-ingestion-job.ts`'s `onConflictDoNothing({ target:
  [events.postId] })` confirmed as the exact mechanism AD-30 Rule 3/Story 3.6r/3.6t replace with the
  `(post_id, extraction_ordinal)` target — matches the proposal's description precisely.
- **Message shape:** `ExtractedEventMessage`/`ExtractedScheduleMessage` (`packages/domain/src/events/types.ts`)
  are plain TypeScript interfaces with **no runtime schema validation at the consumer boundary** —
  relevant to the queue-compatibility finding below (Correction 2).
- **EXPLAIN harness:** `pnpm --filter @festgrid/database seed:volume` (`seed-volume.ts`) and
  `cc-024-explain-baseline-2026-10-01.md` both confirmed present and consistent with the wave plan's
  description. No gap.
- **Both Next.js slug routes exist and are near-identical:** `apps/web/src/app/[locale]/events/[slug]/page.tsx`
  (full page) and `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` (intercepted modal) —
  both call the same `getEventBySlugCached()` helper. That helper (`apps/web/src/features/events/get-event-by-slug-cached.ts`)
  **swallows every failure into a plain `null` return** (verified in source, both its `try` blocks) —
  relevant to the redirect finding below (Correction 3).
- **BUG-012/epic-0-i2 status:** 0.i2a/0.i2b/0.i2c/0.i2z all confirmed `backlog` in `sprint-status.yaml`,
  matching the wave plan. But the gap is sharper than "all backlog" — see Gate 3 finding below.
- **Migration ordering 3.6r vs 3.15:** already resolved by AD-31 Rule 5 ("independent tables with no
  FK between them and may land in either order; both edit `schema.ts`, so each ships as its own
  self-contained migration") — re-verified against both stories' ACs, no gap, no action needed.
- **Per-event handling (3.6a/3.6i/3.6j):** each story's 2026-10-01 amendment in `epics.md` already
  defers the explicit per-event AC to 3.6s/3.6t, and Story 3.6s's own AC text already states
  "timezone inference (3.6a), private-contact classification (3.6i) and performer-leakage guards
  (3.6j) run **per event**" — confirmed threaded through correctly, no gap.
- **Prerequisite statuses match the wave plan:** 1.3j, 1.6c = `review`; 1.3k = `review`; 3.4n, 3.4o =
  `review`; 3.5 = `review`; 4.7b = `review`; 0.i6g = `backlog` (coordinate-only, not a hard
  dependency for any story in this batch). Standing rule: build against `review`-status
  prerequisites — no story in this batch needs to wait.

## Gate 1 — Architecture / Infrastructure Completeness

No story in this batch bypasses the backend/API layer, calls an external service directly instead of
through a mandated adapter, or introduces an API surface with no backing layer. Specifically:

- 3.6s's Gemini call continues to go through the existing `callGemini`/`adapter.ts` gateway (one call
  per post, AD-13 quota discipline unchanged) — it does not call the vendor SDK directly.
- 3.6u/3.6x's new reads (`Query.relatedEventIds`, `Event.sourcePosts`) are ordinary GraphQL resolvers
  reusing the existing `buildOptimizedDrizzleSelect`/batched-`IN` idiom (AD-17) — no new ad hoc data
  path.
- 3.6w depends on Story 4.7b (moderator tools shell, `review`) for its surface — backing layer exists.
- 3.7h/3.7i's DB-free oEmbed resolution stays backend-owned per AD-16 Rule 6 — `apps/web` never calls
  Meta directly.

**One load-bearing infra gap found and corrected (shared with Gate 3, reported once, not per story):**
see "Gemini extraction call has no timeout" below — classified under Gate 3 because the gap is in an
already-existing cross-cutting dependency (the Epic 0 vendor-call wrapper), not a new backend layer
this batch itself needs to build.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness (incl. cross-epic reuse)

### Finding 1 — Gemini extraction call has no timeout; Epic 0's existing wrapper doesn't cover it (CORRECTED)

The wave plan's checklist treats "epic-0-i2 stories 0.i2a-0.i2c are all backlog" as sufficient context
and moves on. Verified against source that the gap is sharper: **even once built, 0.i2b and 0.i2c as
originally drafted would still leave the actual extraction call path unguarded.**

- `process-ai-job.ts` (Story 3.6's AI Processor Lambda, extended by 3.6s for multi-event extraction)
  calls `callGemini` (`apps/backend/src/lib/ai-gateway/adapter.ts`), which calls
  `callGeminiGenerateContent` (`apps/backend/src/lib/ai-gateway/gemini-client.ts`) — a direct
  `ai.models.generateContent()` call with **no `AbortController`, no timeout, anywhere**.
- Story 0.i2b's scope names only `verifyGeminiApiKey`/`createApiKey`. Story 0.i2c's scope (as drafted)
  names only `backfillAccountProfileAndInferDefaultLocation` and `resolvePromptToEventFilter`. Neither
  names `callGemini`/`adapter.ts` — the function `process-ai-job.ts` actually calls.
- BUG-012's own backlog note ("Affects `verifyGeminiApiKey`'s synchronous `createApiKey` path
  directly, **not just background jobs**") already hinted the extraction path was in scope, but no
  story's AC ever named it.
- This matters specifically for CC-024: Story 3.6s's multi-event extraction (a 39-event roundup
  response observed in the proposal's own prototype run) and Story 3.6z's automatic enqueueing (more
  posts auto-extracted, higher call volume) both increase exposure on this exact unguarded call site.
  3.6s's own "Prerequisite: BUG-012" note assumed 0.i2a-c already covered it; they did not.

**Correction applied:** Story 0.i2c's scope and ACs amended in `epics.md` to explicitly include
`callGemini`/`adapter.ts` and the response-size/hang scenario. See Corrections §1 below.

### Finding 2 — `DataIngestionQueue` message compatibility during deploy (CORRECTED)

The wave plan pre-flagged this as an open checklist item without resolving it. Verified: 3.6t's
original AC described the new `extractionOrdinal` field on outgoing messages but never stated what
happens to a message already sitting in `DataIngestionQueue` at deploy time with no such field — and
`ExtractedEventMessage`/`ExtractedScheduleMessage` are plain TS interfaces with no runtime validation
at the consumer boundary, so there's no schema layer that would catch or default a missing field for
free. Left unstated, a hand-rolled consumer could either throw on an undefined `extractionOrdinal` or
silently write it as `null`/`undefined` into a column whose unique index (AD-30 Rule 1) treats NULL as
distinct — bypassing idempotency exactly the way AD-30's own `CHECK` constraint exists to prevent.

**Correction applied:** Story 3.6t's AC amended in `epics.md` to require `extractionOrdinal` default to
`0` when absent on a consumed message. See Corrections §2 below.

### Finding 3 — Alias redirect needs both Next.js routes, and `getEventBySlugCached` swallows the signal (CORRECTED)

The wave plan pre-flagged "Next.js alias redirect: a permanent redirect ... in both the full-page and
the intercepted modal route" but left it open. Verified both routes exist
(`apps/web/src/app/[locale]/events/[slug]/page.tsx`,
`apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx`) and both call the same
`getEventBySlugCached()` helper — which wraps its GraphQL call in `try { ... } catch { return null }`,
unconditionally. Today that's correct (any failure degrades to client-side fetch); but once
`eventBySlug` can signal "redirect to canonical slug" (AD-16 Rule 11), that signal would be silently
swallowed into the same `null` as a genuine not-found or network error, and the client-side path would
render its own not-found UI instead of redirecting — directly contradicting `EXPERIENCE.md`'s "no
not-found flash" requirement for this feature. Neither 3.6u's nor 3.6v's original AC named either route
file or this helper.

**Correction applied:** Story 3.6v's AC amended in `epics.md` to require the redirect be wired into
both route files and to require `getEventBySlugCached` distinguish a redirect signal from a genuine
null. See Corrections §3 below.

### No new Epic 0 tooling needed beyond Finding 1's correction

- The shared "organizer-authored" predicate (AD-31 Rule 3) and the event-level account-match helper
  (AD-31 Rule 4) both already have an assigned owning story (created by the first consumer, extended
  by 3.15/3.18) — no ownership gap.
- `pg_trgm` is scoped narrowly to write-path matching inside 3.6r's own migration; it does not need a
  generic cross-epic "trigram helper" abstraction today — no other epic's story currently needs
  trigram search.
- 3.6w's merge/undo mechanism explicitly reuses the existing Soft Delete with Undo pattern
  (`EXPERIENCE.md`) rather than inventing a second one — confirmed by reading the pattern's own text,
  which already documents the merge-specific reversal as an extension, not a new pattern.
- Cross-epic reuse scan: Epic 4 (moderation, via 3.6w/4.7b) and the coauthor-attribution stories
  (3.13-3.19) are the only other epics touching `event_posts`/`post_account_associations`; both are
  already accounted for in this batch's own dependency edges (3.6v depends on 3.13-3.15; 3.6w depends
  on 4.7b). No undiscovered third consumer found.

## Per-story verdicts

| Story | Verdict | Reason |
|---|---|---|
| 3.6r (event–post link table and multi-event schema) | READY | AD-30 fully specifies the migration; post-deletion/promotion AC already present; `pg_trgm` verified available. |
| 3.6s (extract multiple events per post with grouping rules) | READY-WITH-CAVEAT | Correct as drafted; its "Prerequisite: BUG-012" is only real once Correction 1 (0.i2c) ships or an explicit output cap/timeout is added inline — flag at dispatch time if 0.i2c is still backlog. |
| 3.6t (ingest multiple events per post, with per-event slugs and notifications) | READY-WITH-CORRECTION | Correction 2 (queue message default ordinal). |
| 3.6u (show all source posts and related events on the event detail page) | READY | Depends on 1.3j/1.6c (`review`) — standing rule allows. |
| 3.6v (match new posts to existing events and enrich them in place) | READY-WITH-CORRECTION | Correction 3 (both Next.js routes + `getEventBySlugCached`). |
| 3.6w (let moderators merge duplicate events, with slug redirects) | READY | 4.7b is `review`. |
| 3.6x (show all events from a post on a post collection page) | READY | Reuses existing list UI per its own AC; no parallel implementation risk found. |
| 3.6y (respect weekday-narrowed schedules in day-of-week filtering) | READY | 1.3k (`review`) already ships the column/calendar rendering; this story is the backend filter gap only, confirmed narrow. |
| 3.6z (automatically enqueue new scraped posts for extraction within quota) | READY-WITH-CAVEAT | Same BUG-012 exposure as 3.6s (Finding 1) — higher call volume compounds it; no AC change needed on 3.6z itself since the fix belongs on the shared call site. |
| 3.7f (capture platform post id/permalink type at scrape time) | READY | Pure parser addition, well-scoped, 100%-coverage AC already present. |
| 3.7g (build platform-prefixed event slugs at ingestion) | READY | Depends on 3.7f; AD-16 Rules 1/3/4 fully specify it. |
| 3.7h (resolve Instagram oEmbed from the event slug without a DB lookup) | READY | AD-16 Rule 6 fully specifies it; legacy-slug fallback AC present. |
| 3.7i (fetch the event-detail oEmbed in parallel with the event query) | READY | Depends on 1.6c (`review`) — standing rule allows. |
| 3.13 (normalize Apify vendor coauthor/publisher roles) | READY | Scoped explicitly to Apify only; Bright Data correctly excluded pending fresh payload capture. |
| 3.14 (deduplicated, provenance-tracked subscribable profiles) | READY | Depends on 3.13; AC chain intact. |
| 3.15 (post-account association table + lossless migration) | READY | AD-25/AD-31 fully resolve DDL and role semantics; "blocked" status note is confirmed stale (now `backlog`, matches). |
| 3.18 (union-of-associations account filtering) | READY | Depends on 3.15, 3.6r — both accounted for; AD-31 Rule 4's helper hand-off (3.6v → 3.18) is explicit in both stories' text. |

## Corrections (applied 2026-10-01 — `epics.md` updated; see each story's inline correction)

1. **0.i2c** ("Adopt the wrapper in the async inference path"): scope and ACs extended to explicitly
   name `callGemini`/`apps/backend/src/lib/ai-gateway/adapter.ts` (the call path `process-ai-job.ts`
   actually uses) alongside the two functions already listed, with an added AC bounding a large/slow
   extraction response (the 39-event roundup case) by the wrapper's timeout. A `Note:` records the
   gate, the verified source evidence, and that Stories 3.6s/3.6z raise this from latent to load-bearing.
2. **3.6t** ("Ingest multiple events per post, with per-event slugs and notifications"): added an AC
   requiring a `DataIngestionQueue` message enqueued before this story's deploy (no `extractionOrdinal`
   field at all) to be treated as ordinal `0` on consumption, never a validation failure — noting the
   message types carry no runtime schema validation today.
3. **3.6v** ("Match new posts to existing events and enrich them in place"): added an AC requiring the
   alias redirect to be wired into both
   `apps/web/src/app/[locale]/events/[slug]/page.tsx` and
   `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx`, and requiring
   `apps/web/src/features/events/get-event-by-slug-cached.ts` to distinguish a redirect signal from a
   genuine null/not-found rather than swallowing both into the same `catch`.

No story needed a new prerequisite story number (Epic 0 or lettered) — all three findings were
corrections to an existing story's own AC, applied directly per `story-split-gate.md`'s allowance for
an unambiguous, epic-wide fix.

## Backlog / tracking notes (not epics.md changes — for `cc-024-multi-event-wave-plan.md`/`backlog.yaml`)

- Wave plan's Wave 1 item "epics.md: add FR113 and FR114 to the requirements inventory and coverage
  map" is still open — out of this sweep's scope (Gate 1/3 only), left for whoever closes Wave 1.
- Consider whether BUG-012's backlog note should be updated to point at `adapter.ts`/`callGemini`
  explicitly now that Finding 1 has located the real gap, so a future reader doesn't have to re-derive
  it from 0.i2c's corrected AC alone.
- Story 3.6s's "Prerequisite: BUG-012" is prose-only (not in its `Depends on:` line) — a minor
  inconsistency in how the dependency is recorded; worth normalizing when 3.6s is created via
  `bmad-create-story`, not fixed here since it doesn't change meaning.

## Next step

Create this batch's stories one at a time via `bmad-create-story`, in `cc-024-multi-event-wave-plan.md`
Wave order (3.7f → 3.7g → 3.7h → 3.7i alongside 3.13 → 3.14 → 3.15, then 3.6r → 3.6s → 3.6t → 3.6u/3.6y/3.6z →
3.6v → 3.6w/3.6x/3.18). Each will cite this report and skip Gate 1/Gate 3, running only Gate 2 (UI
Complexity & Reusability).
