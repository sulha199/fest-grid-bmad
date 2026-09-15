---
backlog_id: CC-020
title: "Sprint Change Proposal: getEvents/eventBySlug Performance Hardening (AD-17)"
status: "approved"
created: "2026-09-15T00:00:00Z"
approved: "2026-09-15T00:00:00Z"
---

# Sprint Change Proposal: getEvents/eventBySlug Performance Hardening

## 1. Issue Summary

A `bmad-agent-architect` performance audit (2026-09-15), requested against `Query.events`
(`getEvents`) and its Discovery/Feed/Favorites/event-detail usage, found that
`buildOptimizedDrizzleSelect` (`packages/graphql-select/optimized-select.ts`) only maps
requested GraphQL fields to physical columns of the `events`/`schedules` tables — it has no
way to batch *computed* fields. Because the shared `getEvents.graphql`/`getEventBySlug.graphql`
documents request `favoriteCount`, `isFavorited`, and `schedules{...}` on every item, each falls
through to its own per-parent `Event.*`/`Schedule.*` field resolver in
`apps/backend/src/schema/resolvers.ts`, issuing one DB round trip **per row, per field** —
roughly `1 + 1 + 3N` queries for a page of `N` events (BUG-030), and a materially identical
pattern scoped to one event's schedule list on the event-detail page (BUG-033). A follow-up
audit pass on the event-detail page also found: an ungated `totalCount` second query
(FIND-027), a missing partial index that would make the fix's own correlated subqueries
sequential-scan the `favorites` table instead of using an index (BUG-034), missing
`staleTime` on the three `getEvents` consumer hooks (FIND-028), the `eventBySlug` resolver's
entire fan-out running twice per pageview because `generateMetadata`'s server-side fetch is
discarded then re-fetched client-side (BUG-035), and an unconditional
`useGetMySubscriptionsQuery` call on the event-detail page with no shell-level warm cache
(FIND-030).

A dedicated `bmad-architecture` pass (recorded 2026-09-15) already decided the batching
mechanism for all of the above except BUG-035's fix shape: extend
`buildOptimizedDrizzleSelect` with an optional `virtualFields` parameter that reuses the
`events` resolver's existing `fieldMap` `EXISTS`-subquery expressions (today wired only into
`WHERE`-clause filtering) directly in the output `SELECT`, and batch the one-to-many
`schedules` relation as one additional `IN (...)` query attached to each parent row before
return — never a per-request DataLoader. See Architecture Spine **AD-17** for the full rule
set. This proposal is Phase 2a of
`_bmad-output/planning-artifacts/event-pages-followthrough-plan.md`, turning AD-17's decided
mechanism (and this proposal's own resolution of BUG-035's open fix-shape question, see
Section 3) into two sequenced Epic 1 stories.

**Issue type:** Technical limitation discovered during implementation review — an architecture
audit of already-shipped, `review`-status stories (1.3a, 1.6, 1.6a, 1.6b), not a new
requirement or a misunderstanding of scope.

## 2. Impact Analysis

### Epic Impact

- **Epic 1 (Core App and Event Discovery):** Stories 1.3a (`events`/`eventBySlug`/`event`
  resolver layer), 1.6 (event-detail page), 1.6a (event-detail component), and 1.6b (list
  navigation hook) are all `review`/shipped and are amended by two new lettered stories —
  **1.3j** and **1.6c** — following this epic's existing split-story convention (1.3a-1.3i,
  1.6a-1.6b). No epic-level scope change: this is a **Direct Adjustment** (Section 3, Option 1),
  the same pattern as CC-010/CC-012/CC-019.
- **No other epic is affected.** Discovery, Feed (Epic 3), and Favorites (Epic 2) all consume
  the shared `events`/`getEvents` resolver as callers only — their own story scope is
  unchanged; they simply get faster/cheaper for free once Story 1.3j ships, with zero query
  or type changes on their side.
- **No new epic required; no epic removed, resequenced, or invalidated.** This is exactly the
  case `event-pages-followthrough-plan.md` identified: Epic 1 already owns this entire surface,
  so `bmad-correct-course` amending it directly is the right tool, not `bmad-form-epics`.

### Artifact Conflicts

**PRD** (`prds/festgrid-prd-2026-07-10-2047/prd.md`):
- No conflict. §"Performance" (added 2026-09-15, same investigative session) already states:
  *"`Query.events` (`getEvents`) is the highest-traffic endpoint in the system... it must be
  held to a stricter budget than the general 500ms API target above, and any change to it or
  its field resolvers requires an explicit query-count/cost check."* This proposal is exactly
  that fix, not a new requirement — no PRD text changes needed.

**Architecture** (`festgrid-architecture-spine.md`):
- No new Architectural Decision needed for the batching mechanism itself — **AD-17** already
  fully specifies Rules 1-4 and explicitly assigns BUG-030/FIND-027/BUG-034/FIND-028 to one
  story and BUG-033/BUG-035 to a second, sequenced story (Rule 5). This proposal operationalizes
  that assignment as concrete Epic 1 stories (1.3j, 1.6c).
- **One open question AD-17 explicitly left unresolved:** Rule 5 states BUG-035's fix shape
  "is not decided by this AD... left for story-drafting to resolve." Resolved in this proposal
  (confirmed with the user, no other viable path forward without a live decision) as
  **HydrationBoundary + `dehydrate` cache seeding** — `generateMetadata`'s existing full-document
  server fetch is dehydrated into the client's React Query cache instead of discarded, so
  `EventDetailWrapper`'s client-side `useGetEventBySlugQuery` hydrates from it rather than
  issuing a second network request. This was chosen over the narrower alternative (shrinking
  `generateMetadata`'s own query to the 2 scalar fields it reads) because it actually eliminates
  the duplicate fetch rather than only cheapening one side of it. **This introduces a pattern
  with zero existing precedent in `apps/web`** — verified: no `React.cache`, `unstable_cache`,
  or `HydrationBoundary` usage exists anywhere in `apps/web/src` today. Recommend
  `project-context.md` documents this as the canonical convention for future SSR+client-fetch
  pages once Story 1.6c ships (a follow-up documentation task, not part of this story's own
  scope — see Section 5, Handoff).

**UX** (`DESIGN.md`/`EXPERIENCE.md`): No impact. This proposal is data-layer/performance work
only — no visual, interaction, or copy change on any surface.

**Other artifacts:** `project-context.md`'s Database & Performance section (lines 81, 87)
already documents both hotspots as "mechanism decided 2026-09-15, not yet built — see
Architecture Spine AD-17." Once Stories 1.3j/1.6c ship, that language needs updating to reflect
built status — noted in Section 5, Handoff, not performed by this proposal.

### Technical Impact

- `packages/graphql-select/optimized-select.ts`: `buildOptimizedDrizzleSelect` gains an
  optional `virtualFields: Record<string, SQL>` parameter (Story 1.3j).
- `apps/backend/src/schema/resolvers.ts`: `events` resolver's `db.select({...})` call gains
  `virtualFields` wiring and a batched `schedules` `IN (...)` query (Story 1.3j); `totalCount`
  query (~3163-3170) gated on `info` field selection (Story 1.3j, FIND-027); `event`/
  `eventBySlug` resolvers reuse the same batched-schedules mechanism with an added
  `isAddedToCalendar` `virtualFields` entry (Story 1.6c, BUG-033); `Event.isFavorited`/
  `Event.favoriteCount`/`Event.isAddedToCalendar`/`Event.schedules`/`Schedule.isAddedToCalendar`
  field resolvers become parent-value passthroughs with defensive per-row fallbacks.
- `packages/database/schema.ts` + a new Drizzle-kit migration: partial index
  `idx_favorites_event_id` on `favorites (event_id) WHERE deleted_at IS NULL`, hand-edited per
  AD-8 Rule 3's documented drizzle-kit `WHERE`-clause-dropping limitation (Story 1.3j, BUG-034).
- `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`,
  `favorites/favorites-content.tsx`: add `staleTime: 30_000` to their `getEvents` query hooks
  (Story 1.3j, FIND-028).
- `apps/web/src/app/[locale]/events/[slug]/page.tsx` and
  `@modal/(.)events/[slug]/page.tsx`: wrap `EventDetailWrapper` in a `HydrationBoundary` seeded
  from `generateMetadata`'s existing server fetch (Story 1.6c, BUG-035).
- `apps/web/src/features/events/EventDetailWrapper.tsx`: `useGetEventBySlugQuery` hydrates from
  the boundary instead of always fetching (Story 1.6c, BUG-035); `useGetMySubscriptionsQuery`
  (~58-64) gains an `event.sourceSocialMediaAccountProfile`-aware `enabled` condition (Story
  1.6c, FIND-030).

## 3. Recommended Approach

**Direct Adjustment (Option 1).** No rollback, no PRD/MVP scope change. Two new lettered
Epic 1 stories, sequenced (1.6c depends on 1.3j), matching AD-17 Rule 5's own sequencing
rationale.

- **Effort:** Medium. Spans 7 backlog rows across 2 stories, but the hard design work — the
  batching mechanism itself — was already done by AD-17; this proposal's own remaining
  judgment call (BUG-035's fix shape) is resolved above.
- **Risk:** Low for Story 1.3j (mechanism fully specified by AD-17, reuses existing `fieldMap`
  expressions verbatim, additive index). Low-medium for Story 1.6c's BUG-035 AC specifically,
  since `HydrationBoundary`/`dehydrate` has no precedent in this codebase yet — mitigated by
  keeping the pattern narrowly scoped to this one route pair rather than retrofitting it
  elsewhere, and by the recommended `project-context.md` follow-up documentation once it ships
  and is proven.
- **Rejected:** Rollback — nothing here contradicts already-shipped work in a way rollback would
  simplify; these are pure hardening/perf fixes to resolvers already in `review`.
- **Rejected:** MVP scope reduction — not applicable; this closes a gap against an existing
  Performance NFR, it does not change what ships.
- **Rejected (BUG-035 alternative):** Narrowing `generateMetadata`'s own query to 2 scalar
  fields without cache-seeding — this cheapens the wasted server-side fetch but leaves the
  actual duplication (two full resolver fan-outs per pageview) in place, which does not fully
  resolve BUG-035's stated defect.

## 4. Detailed Change Proposals

### 4.1 PRD

No changes. §"Performance" already covers this work as a standing requirement.

### 4.2 Architecture

No new AD. AD-17 already specifies the mechanism; BUG-035's fix shape is resolved in Section 3
above and reflected in Story 1.6c's ACs below.

### 4.3 Epic 1 — New Story 1.3j

```
### Story 1.3j: Batch computed Event fields and gate totalCount/staleTime on the events query

**As a** developer,
**I want** `Query.events`'s computed fields (`isFavorited`, `favoriteCount`,
`isAddedToCalendar`, `schedules`) resolved via one batched select instead of per-row field
resolvers, its `totalCount` sub-query gated on actual field selection, and its three
list-consumer hooks given a short `staleTime`,
**So that** the app's highest-traffic query (per the PRD's Performance NFR) stops costing
`1 + 1 + 3N` DB round trips per page and stops refetching on every remount/refocus.

**Acceptance Criteria:**

*   **Given** AD-17 Rule 1, **when** `apps/backend/src/schema/resolvers.ts`'s `events`
    resolver builds its `db.select({...})`, **then** `packages/graphql-select/optimized-select.ts`'s
    `buildOptimizedDrizzleSelect` gains an optional `virtualFields: Record<string, SQL>`
    parameter, and the resolver passes its existing `fieldMap`'s `isFavorited`/
    `isAddedToCalendar` `EXISTS` expressions (today wired only into `buildDrizzleWhere`) plus a
    new `favoriteCount` entry (`(SELECT count(*) FROM favorites WHERE favorites.event_id =
    events.id AND favorites.deleted_at IS NULL)`) as `virtualFields`, each included only when
    the corresponding GraphQL field is actually requested per `info` — the same signal
    `buildOptimizedDrizzleSelect` already uses for `items`.
*   **And** `Event.isFavorited`/`Event.favoriteCount`/`Event.isAddedToCalendar` field resolvers
    become passthroughs reading the pre-populated parent value, falling back to today's
    per-row query only when the value is absent (a defensive fallback for a caller that
    somehow reaches the field resolver without pre-population — never the expected path once
    this ships).
*   **Given** AD-17 Rule 2, **when** the `events` resolver has fetched its page of parent rows
    and `schedules` (or a nested `Schedule` field, per AD-17 Rule 3) was requested, **then** it
    issues one additional `db.select({...buildOptimizedDrizzleSelect(schedules, info, {path:
    'schedules', virtualFields: {...}})}).from(schedules).where(inArray(schedules.eventId,
    ids))` query, groups the results by `eventId` in JS, and attaches them to each parent row
    as `item.schedules` before returning. `Event.schedules` becomes a passthrough reading
    `parent.schedules`, falling back to its current per-row query only when absent.
*   **Given** FIND-027, **when** the `events` resolver's `totalCount` second query
    (`resolvers.ts` ~3165-3170) runs, **then** it is gated on `info`'s field selection actually
    requesting `totalCount`, the same technique `buildOptimizedDrizzleSelect` already applies to
    `items`.
*   **Given** BUG-034, **when** the migration for this story runs, **then** a partial index
    `CREATE INDEX idx_favorites_event_id ON favorites (event_id) WHERE deleted_at IS NULL;` is
    added via a Drizzle-kit-generated migration, hand-edited to include the `WHERE` clause per
    AD-8 Rule 3's documented drizzle-kit `WHERE`-clause-dropping limitation (matching
    `idx_favorites_active`'s existing hand-edit precedent) — this index ships in this story
    because Rule 1's per-row correlated subqueries are only viable with an `eventId`-leading
    index; without it they would force a sequential scan of `favorites` once per output row
    inside a single query execution, which is worse than today's separate per-row queries, not
    a fix.
*   **Given** FIND-028, **when** `apps/web/src/app/[locale]/home-content.tsx`,
    `feed/feed-content.tsx`, and `favorites/favorites-content.tsx`'s `getEvents`-consuming query
    hooks are configured, **then** each is given `staleTime: 30_000` (30s), cutting refetch
    volume on remount/window-refocus without materially staling Discovery/Feed/Favorites data.
*   **And** existing DSL/resolver behavior is unchanged and regression-verified: `eq`/`ne`/
    `contains`/`in`/`notIn` operators and the existing `fieldMap` entries continue to behave
    exactly as before (existing `resolvers`/`drizzle-where` tests pass unmodified).
*   **And** a query-count integration test asserts that fetching a page of N events (N > 1)
    now costs a small constant number of queries, not `O(N)` — the concrete regression target
    for the PRD's Performance NFR's "explicit query-count/cost check" requirement.
*   **And** this story does not change the `event(id)`/`eventBySlug` resolvers — those are
    Story 1.6c's scope, which reuses this story's `virtualFields`/batched-schedules mechanism
    rather than reimplementing it.

**Note:** This story exists because of a `bmad-agent-architect` performance audit (2026-09-15)
of `Query.events`, the app's highest-traffic query per the PRD's Performance NFR (added
2026-09-15, same session). The audit found BUG-030 (the N+1 itself), FIND-027 (an ungated
`totalCount` query), BUG-034 (a missing index that blocks BUG-030's own fix from being viable),
and FIND-028 (missing `staleTime`) — batched into one story per AD-17 Rule 5's explicit
grouping, since all four touch the same resolver/query surface and FIND-027/FIND-028 are
"trivial to include, not worth a separate story" in AD-17's own words. The batching mechanism
itself (`virtualFields` extending `buildOptimizedDrizzleSelect`, reusing `fieldMap` rather than
introducing DataLoader) was decided by a dedicated `bmad-architecture` pass — see Architecture
Spine **AD-17**. Positioned as the last lettered suffix in the 1.3 family (after 1.3i),
immediately before Story 1.3 — discovered after every other 1.3-family split, following this
epic's "discovery order, not alphabetical" placement convention (per Story 1.3g's own note).

**Depends on:** Story 1.3a (the `events` resolver this story amends), Story 0.8
(`buildOptimizedDrizzleSelect`, extended here).
```

### 4.4 Epic 1 — New Story 1.6c

```
### Story 1.6c: Batch Schedule.isAddedToCalendar, dedupe the eventBySlug double-fetch, and gate
the event-detail subscriptions query

**As a** developer,
**I want** the event-detail page's `eventBySlug`/`event` resolver to reuse Story 1.3j's
batched-schedules mechanism for `Schedule.isAddedToCalendar`, its server/client double-fetch
eliminated via cache hydration, and its subscriptions query gated on actually needing it,
**So that** opening an event's detail page costs one resolver fan-out instead of two, and does
not issue a schedule-count-sized number of extra queries or an unconditional subscriptions
call.

**Acceptance Criteria:**

*   **Given** AD-17 Rule 3 (BUG-033), **when** `event`/`eventBySlug` resolves `schedules`,
    **then** it reuses Story 1.3j's Rule 2 batched `IN (...)` query verbatim — the same code
    path, not a separate implementation — whose `virtualFields` map additionally includes an
    `isAddedToCalendar` entry (`exists(db.select(...).from(calendarAdditions).where(and(
    eq(calendarAdditions.userId, userId), eq(calendarAdditions.scheduleId, schedules.id),
    activeOnly(calendarAdditions))))`, gated on `userId` being known). `Schedule.isAddedToCalendar`
    becomes a passthrough reading `parent.isAddedToCalendar`, falling back to today's
    per-schedule query only when absent. This applies identically whether `event`/`eventBySlug`
    returns one row — an `IN (...)` query over a one-element id array is the same query shape as
    Story 1.3j's page case, no resolver-arity special-casing needed.
*   **Given** BUG-035, and the confirmed fix direction (HydrationBoundary + `dehydrate` cache
    seeding — the codebase's first use of this pattern; verified no `React.cache`/
    `unstable_cache`/`HydrationBoundary` usage exists anywhere in `apps/web/src` today),
    **when** `apps/web/src/app/[locale]/events/[slug]/page.tsx` and the intercepted
    `@modal/(.)events/[slug]/page.tsx` run their existing server-side `generateMetadata` fetch
    (`graphqlClient.request(GetEventBySlugDocument, {slug})`), **then** that same full-document
    fetch result is dehydrated (`dehydrate(queryClient)`) into a `HydrationBoundary` wrapping
    `EventDetailWrapper`, keyed to match `useGetEventBySlugQuery`'s own React Query key, so
    `EventDetailWrapper.tsx`'s client-side query hydrates from that cache on initial render
    instead of issuing its own network request. `generateMetadata` itself is unchanged in scope
    (still reads only `eventName`/`description` from the result) — the full document is no
    longer wasted work once it is reused for hydration.
*   **And** `EventDetailWrapper.tsx:317-326`'s `router.prefetch()` for the adjacent next/prev
    event is unaffected by this change — out of scope, a separate speculative prefetch, not
    part of BUG-035's doubled-fetch defect.
*   **And** a regression test confirms that a first page load of `/events/[slug]` (and the
    intercepted modal route) issues exactly one `GetEventBySlugDocument` network request to the
    backend, not two — verified via a request-count assertion in an integration/E2E test around
    the page route.
*   **Given** FIND-030, **when** `EventDetailWrapper.tsx:58-64` calls
    `useGetMySubscriptionsQuery`, **then** its `enabled` condition is narrowed from `!!session`
    alone to `!!session && !!event.sourceSocialMediaAccountProfile` — matching FIND-030's own
    stated fix direction (gate on the event actually having a linked source account) over
    lifting it to shell level, since — unlike `useMeQuery` — no other route needs this query
    warmed at shell level, and gating removes the call entirely for the common case of an event
    with no linked account.
*   **And** existing resolver behavior for `event`/`eventBySlug` is otherwise unchanged and
    regression-verified: `sourceSocialMediaAccountProfile`, `isFavorited`, `favoriteCount`,
    `isHiddenForCurrentUser` continue to resolve exactly as before.

**Note:** This story exists because of the same `bmad-agent-architect` audit (2026-09-15) that
produced Story 1.3j, scoped to the `eventBySlug`/event-detail-page surface rather than the list
surface. AD-17 Rule 5 sequences this story after 1.3j because Rule 3's `isAddedToCalendar`
batching reuses Rule 2's mechanism verbatim, and keeps it a separate story because it targets a
different route (event-detail vs. the three list views) and bundles a materially different fix
category (frontend SSR-hydration caching, not DB-layer batching) that doesn't belong in 1.3j's
DB-layer change set. BUG-035's fix direction — left open by AD-17 itself ("not decided by this
AD... left for story-drafting to resolve") — was resolved via this Sprint Change Proposal in
favor of HydrationBoundary + `dehydrate` seeding over the narrower "cheapen `generateMetadata`'s
own query" alternative, since it actually eliminates the duplicate fetch rather than only
cheapening one side of it (Section 3); this introduces a new SSR-hydration pattern to `apps/web`
with no prior precedent — recommend `project-context.md` documents it as the canonical
convention for future SSR+client-fetch pages once this story ships (a follow-up documentation
task, see Section 5, not this story's own scope). FIND-030 is folded in as an additional AC
rather than a third story per this proposal's own rationale (Section 2/3) — it shares this
story's exact page/component (`EventDetailWrapper.tsx`) and is small, but is a different
mechanism (a missing gate condition, not DB batching) from BUG-033/BUG-035, so it does not
warrant its own story. Positioned as the last lettered suffix in the 1.6 family (after 1.6b),
immediately before Story 1.6 — discovered after 1.6a/1.6b, following this epic's discovery-order
placement convention.

**Depends on:** Story 1.3j (reuses its batched-schedules-query mechanism verbatim), Story 1.6
(patches `page.tsx`/`EventDetailWrapper.tsx`, and the `event`/`eventBySlug` resolvers it
introduced via Story 1.3a).
```

### 4.5 Backlog rows carved

None. All 7 rows in scope (BUG-030, BUG-033, BUG-034, BUG-035, FIND-027, FIND-028, FIND-030) are
fully covered by Story 1.3j or Story 1.6c above — no remainder to carve into a child row.

## 5. Implementation Handoff

**Scope classification: Minor-to-Moderate.** No epic restructuring, no PRD/MVP change, no new
Architectural Decision (AD-17 already exists) — but introduces one genuinely new pattern
(HydrationBoundary/dehydrate) to the frontend codebase, which is why it is called out
explicitly rather than left implicit in Story 1.6c's ACs.

**Handoff sequence:**
1. **`bmad-create-story`** (Phase 3, a later session per
   `event-pages-followthrough-plan.md`) — turn Story 1.3j and Story 1.6c's draft ACs above into
   final implementation-artifact story files, running `story-split-gate.md`'s gates (Gate 1 is
   unlikely to fire further — AD-17 already did that analysis — but Gate 2 should confirm the
   `virtualFields` parameter's exact TypeScript shape against `buildOptimizedDrizzleSelect`'s
   current signature before finalizing Story 1.3j's ACs into tasks).
2. **`bmad-quick-dev`/`bmad-dev-story`** — implement, per this project's existing
   delegate-to-cline-cli convention for coding tasks, with independent verification before
   merge (per this project's own testing-trophy convention: query-count regression tests are
   not optional here, they are this proposal's own success criteria).
3. **Documentation follow-up (not part of either story's own scope):** once Story 1.6c ships,
   update `project-context.md`'s Database & Performance section (lines 81, 87) to reflect built
   status instead of "mechanism decided, not yet built," and add a short note under whatever
   section documents frontend data-fetching conventions describing HydrationBoundary+dehydrate
   as the canonical pattern for future SSR+client-fetch pages, citing Story 1.6c as the
   reference implementation.

**Sprint-status.yaml impact (checklist 6.4):** N/A at this stage — no story files exist yet
(Phase 3, a separate later session, per `event-pages-followthrough-plan.md`). No epics
added/removed/renumbered; Epic 1 gains two lettered stories in `epics.md` only.

**Success criteria:** A page of N Discovery/Feed/Favorites events costs a small constant number
of DB queries regardless of N (not `1 + 1 + 3N`); `favorites` has a usable `(event_id)` index;
`totalCount`/consumer-hook `staleTime` behave per FIND-027/FIND-028; opening `/events/[slug]`
issues exactly one `GetEventBySlugDocument` network request and a schedule-count-independent
number of DB queries for `isAddedToCalendar`; `useGetMySubscriptionsQuery` no longer fires for
events with no linked source account. All backed by query-count/request-count regression tests,
per the PRD's Performance NFR.
