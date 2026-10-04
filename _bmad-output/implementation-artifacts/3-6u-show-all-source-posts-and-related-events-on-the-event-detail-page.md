---
baseline_commit: HEAD (set at bmad-create-story time, 2026-10-03; chain: 0.i6c -> 3.16 -> 0.i6g -> 3.6u, all prior links `review`)
---

# Story 3.6u: Show all source posts and related events on the event detail page

## Story Details

- Epic: 3 (CC-024 — Multi-event posts and cross-post event matching, Wave 4A)
- Story ID: 3.6u
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want the event detail to link every post an event came from and to show the other events from the same posts,
so that I can reach the original posts and discover related events.

## Acceptance Criteria

1. **AC1 — `Event.sourcePosts` field (new, AD-30 Rule 11).** `apps/backend/src/schema/events.graphql`'s `Event` type gains `sourcePosts: [EventSourcePost!]!`, a NEW `EventSourcePost` type (not the existing `extraction.graphql` `Post` type — that type belongs to the unrelated Post-Selection-for-extraction bounded context and must not be extended with event-detail-only fields):
   ```graphql
   type EventSourcePost {
     postId: ID!
     isPrimary: Boolean!
     groupingReason: PostGroupingReason
     extractedEventCount: Int
     postedAt: String
     sourcePostUrl: String
     originalPostUrl: String
     account: SocialMediaAccountProfile
     coauthors: [SocialMediaAccountProfile!]!
   }
   enum PostGroupingReason {
     SINGLE_EVENT
     PROGRAM_LINEUP
     DEPENDENT_STAGES
     SEPARATE_EVENTS
     ROUNDUP
   }
   ```
   Resolved in `resolvers.ts`'s `Event.sourcePosts` field resolver following **AD-17's batched-`IN` idiom** (the `1-6c`-established `batchScheduleRowsForEvents`-style pattern, `resolvers.ts:131-155`): one extra `db.select(...).from(eventPosts).innerJoin(posts, eq(eventPosts.postId, posts.id)).where(inArray(eventPosts.eventId, parentEventIds))`, grouped by `eventId` in JS, attached to each parent before returning — **never** a per-row N+1 query. `isPrimary` is `eventPosts.postId === events.postId` (no stored primary flag exists per AD-30 Rule 1 — "primary = `events.post_id`, and a matching `event_posts` row exists" is the single source of truth). Ordering within each event's list: `ORDER BY (event_posts.post_id = events.post_id) DESC, event_posts.extraction_ordinal ASC NULLS LAST, event_posts.created_at ASC` — primary first, then link order (there is no existing "primary-first" sort helper to reuse; this story writes its own, confirmed by research — no prior function name was found). `groupingReason` maps `posts.groupingReason`'s DB enum (`postGroupingReasonEnum`, DB values `'single-event' | 'program-lineup' | 'dependent-stages' | 'separate-events' | 'roundup'`, `packages/domain/src/posts/types.ts:13`, `packages/database/schema.ts:335`) to the new GraphQL `PostGroupingReason` enum (`SINGLE_EVENT` etc. — hyphenated DB values are not legal GraphQL enum literals, so a small `postGroupingReasonToGraphQL()` mapping function is added alongside `POST_GROUPING_REASONS` in `packages/domain/src/posts/types.ts` and used by the resolver; there is no existing enum-value-mapping precedent elsewhere in this schema to follow since every other exposed enum's DB values already match its GraphQL values literally — this is the first case where they diverge). `extractedEventCount` passes through `posts.extractedEventCount` (nullable, `packages/database/schema.ts:336`) unchanged. `postedAt`/`sourcePostUrl`/`originalPostUrl`/`account` mirror `Event`'s own existing primary-post-scoped fields (`publishedAt`, `sourcePostUrl`, `originalPostUrl`, `sourceSocialMediaAccountProfile`) but per-linked-post instead of primary-only, resolving from `posts.publishedAt`/`posts.postUrl`/`posts.originalPostUrl`/`posts.accountId -> socialMediaAccountProfiles` for **that post**, not `events.postId`. `coauthors` resolves per-post by joining `post_account_associations` filtered to `role = 'COAUTHOR'` for **that post's** id, ordered by `created_at` ascending — the exact same join/filter/order `Event.coauthors` (Story 0.i6g, `resolvers.ts:4124-4138`) already does for the primary post, generalized to run once per linked post inside the same batched query rather than copy-pasted as a second per-row resolver. An event with no linked posts (should not occur once `events.post_id` is set, per AD-30's `event_posts` backfill, but defensively) resolves to `[]`, never `null`/an error.

2. **AC2 — `Event.coauthors` superseded by `sourcePosts`, kept as an unused back-compat alias (user-decided, see Dev Notes).** `Event.coauthors`'s GraphQL field and resolver (Story 0.i6g, `resolvers.ts:4124-4138`) are **left completely unmodified** — still resolved, still confined to `getEventBySlug` (AC2's own regression guard from that story). `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` document keeps selecting `coauthors` (needed for the single-linked-post rendering branch, AC4) but the new multi-post rendering branch (AC5) reads coauthors **exclusively** from `sourcePosts[i].coauthors`, never from the flat `coauthors` field, even for the primary entry — one data path per branch, no cross-branch special-casing.

3. **AC3 — `Query.relatedEventIds(eventId: ID!)` (new, AD-30 Rule 11).** `apps/backend/src/schema/events.graphql`'s `Query` gains:
   ```graphql
   relatedEventIds(eventId: ID!): [RelatedEventGroup!]!
   type RelatedEventGroup {
     postId: ID!
     eventIds: [ID!]!
   }
   ```
   An index-driven read of `event_posts` joined to `events`: `SELECT ep2.post_id, ep2.event_id FROM event_posts ep1 JOIN event_posts ep2 ON ep2.post_id = ep1.post_id JOIN events e2 ON e2.id = ep2.event_id WHERE ep1.event_id = $eventId AND ep2.event_id != $eventId AND e2.deleted_at IS NULL AND e2.merged_into_event_id IS NULL`, grouped by `post_id` in JS into `RelatedEventGroup[]`. Excludes the subject event itself and any soft-deleted/merged event, so "See all N" never counts a hidden one (epics.md AC text, AD-30 Rule 11 verbatim). **No new `Query.events` filter and no per-row field resolver** (AD-17 note, AD-30 Rule 11) — this is a standalone top-level query, confirmed by the batch readiness report (`epic-readiness/batch-cc-024-multi-event-readiness.md:72-74`): *"3.6u/3.6x's new reads (`Query.relatedEventIds`, `Event.sourcePosts`) are ordinary GraphQL resolvers reusing the existing `buildOptimizedDrizzleSelect`/batched-`IN` idiom (AD-17) — no new ad hoc data path."* **Scope note:** AD-30 Rule 11 describes this query's eventual signature as `(eventId | postId)` — the `postId` variant is Story 3.6x's own future consumer need (EXPERIENCE.md §3, "the same `Query.relatedEventIds` (post-keyed variant)"), not this story's. This story implements and ships only the `eventId: ID!` argument (required, no optional/mutually-exclusive-arg validation needed yet); widening the signature to also accept `postId` is explicitly Story 3.6x's scope when it lands (Wave 5, depends on this story) — matching this project's established "don't pre-build a future story's unbuilt shape" precedent (Story 0.i6g's own Design Decision #1 did the same for this exact pair of stories in reverse).

4. **AC4 — Single-linked-post event renders exactly as today (regression guard).** Given an event whose `sourcePosts` resolves to exactly one entry, `packages/ui/src/features/events/EventDetailView.tsx` renders the existing Attributions block (today's unmodified markup, lines 587-617: published time + source/original post link + platform icon) and the existing flat-`coauthors` `<ul>` (Story 0.i6g, lines 619-649) **completely unchanged** — byte-identical output, same props, same data source (`EventDetailViewProps.coauthors`, not `sourcePosts`). This branch does not read `sourcePosts` for rendering purposes at all (though the field is still fetched, since `getEventBySlug` always selects it per AC1). No "Primary" label appears in this branch (EXPERIENCE.md §1: *"A single-post event's source area is unchanged from today"* — this applies to the label too, not only the markup, since today's single-post view has never shown one).

5. **AC5 — Multi-linked-post event renders a per-post Source Posts list (AD-30 Rule 11, EXPERIENCE.md §1).** Given `sourcePosts.length > 1`, `EventDetailView.tsx` renders one entry per linked post **in `sourcePosts`' own primary-first-then-link-order sequence** (AC1), replacing the single Attributions block with a list (`<ol>`, since list position carries meaning — primary-first — unlike the coauthors `<ul>`): each entry shows the account name + platform icon (same `detectPlatformFromUrl`/`accountPlatform` derivation the existing Attributions block already uses, now per-entry from `sourcePosts[i].account`), that post's own posted-at time via the existing locale-aware `formatShortEventDateTime`/`Intl.DateTimeFormat` pattern (`project-context.md`'s Locale-Sensitive Data Rendering rule — reused verbatim, not reimplemented, from `sourcePosts[i].postedAt`), a link to that post (`sourcePosts[i].sourcePostUrl`/`originalPostUrl`), and that post's own coauthors rendered as `SubscribedAccountCard` rows (`variant="detail"`, `size="sm"`, the exact same props/subscribe-toggle wiring Story 0.i6g already built — reused, not reimplemented) from `sourcePosts[i].coauthors`. The entry whose `isPrimary` is `true` carries a plain-text "Primary" label (new i18n key, non-positional a11y cue per EXPERIENCE.md §1's accessibility-lens addendum — not conveyed by list position alone). **The embed and the primary image/video stay on the primary post only** — this branch does not touch `Event.instagramEmbed`/`imageUrl`/`videoUrl` rendering at all (those already resolve from `events.postId`, i.e. the primary post, unchanged by this story).

6. **AC6 — Related Events section, lazy-loaded near viewport, two-step read (AD-30 Rule 11, AD-16 Rule 7 precedent).** Below the Source Posts area (single- or multi-post), a new "Related Events" section fires `Query.relatedEventIds({ eventId })` only once a new `useVisibleOnce` sentinel hook (Task 6) reports the section is near the viewport — **never gating primary detail content**, mirroring the existing `Event.instagramEmbed`/`useGetInstagramEmbedBySlugQuery` independent-parallel-fetch precedent (`EventDetailWrapper.tsx:54-57`, AD-16 Rule 7). On success, the returned `RelatedEventGroup[]`'s flattened, deduplicated `eventIds` feed a second query, `Query.events({ filter: { id: { in: [...] } } })`, reusing the **existing** `id in [...]` DSL condition (`fieldMap` already includes `id`, `resolvers.ts:3077-3156`, AD-17/AD-30 Rule 11) — no new `Query.events` filter is added. Each group's account/platform label ("Events from [post/account]") is derived by matching that group's `postId` back to the **already-loaded** `sourcePosts[i].account` entry for the same `postId` — **not** a second account fetch, so the Source Posts area and the Related Events area never name one post two different ways (EXPERIENCE.md §2's explicit requirement). Up to 5 events per group render inline as `EventCardCompact` (Story 3.6ua's new standalone export — see Out of Scope/Pre-Coding Approval Gate); beyond 5, a "See all N events" link to `/posts/{platformSlug}/{postType}/{platformPostId}/events` (EXPERIENCE.md §3's documented future route, AD-16's existing slug-segment convention) — the destination page itself is Story 3.6x's scope (`backlog`, no story file yet, depends on this story per the wave plan); this story ships a correctly-targeted link that 404s until 3.6x lands in the same wave, an accepted, temporary, incremental-delivery gap, not a defect. A group with zero events is hidden entirely (no empty-state placeholder, this app's existing omit-rather-than-placeholder convention). While loading, the section's skeleton matches `EventCardCompact`'s own shape (`project-context.md`'s Keep Skeletons in Sync With Their Real Component rule), carries `aria-busy="true"`; once content resolves, **no live-region announcement fires** (EXPERIENCE.md §2, deliberate quiet reveal matching the Calendar Overflow precedent).

7. **AC7 — EXPLAIN gate: regression check + new-query baseline (user-decided, see Dev Notes).** `Query.events`/`Query.eventBySlug`'s per-row cost is unchanged — re-run the established `apps/backend/src/explain-events-queries.ts` procedure (promoted by Story 3.6r AC6, already run after 3.6r/3.6y) and confirm identical statement counts/no new Seq Scan vs. `cc-024-explain-after-3.6y-2026-10-02.md`'s baseline. **Additionally** (this story's own scope, beyond the literal epics.md AC text — user-confirmed at create-story time): extend that script to also run `EXPLAIN (ANALYZE, BUFFERS)` against the new `Query.relatedEventIds` and `Event.sourcePosts`' batched-`IN` query, confirming both actually hit `event_posts`' `(post_id, event_id)`/PK indexes and `events`' existing indexes with **no Seq Scan** — verifying AD-30 Rule 11's own claim that `relatedEventIds` is "index-driven," which nothing has verified yet. Results recorded in a new `_bmad-output/planning-artifacts/cc-024-explain-after-3.6u-<date>.md`, following the established baseline/diff-doc format and naming convention.

8. **AC8 — i18n.** New next-intl keys (both `en.json`/`id.json`, `EventDetailsPage` namespace, matching Story 0.i6g's key-placement precedent): `sourcePostsPrimaryLabel` ("Primary"), `relatedEventsGroupLabel` (template, e.g. "Events from {account}"), `relatedEventsSeeAllLabel` (template, e.g. "See all {count} events"), `relatedEventsSectionAriaLabel`. Every other label (subscribe/unsubscribe/checking/unknown-account for the per-post coauthor toggles) is reused verbatim from the existing `EventDetailsPage` namespace Story 0.i6g already established — no duplicate copy.

## Tasks / Subtasks

- [x] **Task 1 — GraphQL schema: `EventSourcePost`, `PostGroupingReason`, `Event.sourcePosts`, `RelatedEventGroup`, `Query.relatedEventIds`** (AC: #1, #3)
  - [x] `apps/backend/src/schema/events.graphql` — add the `EventSourcePost` type, `PostGroupingReason` enum, and `Event.sourcePosts: [EventSourcePost!]!` field (directly below `coauthors`, line 141); add `RelatedEventGroup` type and `relatedEventIds(eventId: ID!): [RelatedEventGroup!]!` to the `extend type Query` block (line 159-164).
  - [x] `packages/domain/src/posts/types.ts` — add `postGroupingReasonToGraphQL(reason: PostGroupingReason): 'SINGLE_EVENT' | 'PROGRAM_LINEUP' | 'DEPENDENT_STAGES' | 'SEPARATE_EVENTS' | 'ROUNDUP'` mapping function alongside the existing `POST_GROUPING_REASONS` export (co-located, same file/pattern) — 100% unit tested per `project-context.md`'s `packages/domain` coverage rule.
  - [x] `apps/backend/src/schema/resolvers.ts` — add `Event.sourcePosts` field resolver (AD-17 batched-`IN` idiom, see AC1 for the exact query/ordering/grouping); add `Query.relatedEventIds` top-level resolver (AC3's query, grouped by `post_id` in JS).
  - [x] Run `pnpm --filter backend codegen` — regenerate `apps/backend/src/generated/resolvers-types.ts`; never hand-edit.
- [x] **Task 2 — Backend resolver + query tests** (AC: #1, #3)
  - [x] `apps/backend/src/schema/resolvers.test.ts` — new `Event.sourcePosts resolver (Story 3.6u)` block: seed an event with 3 linked posts (1 primary + 2 manual/extraction-ordinal links in mixed order) and assert primary-first-then-ordinal ordering; assert `groupingReason`/`extractedEventCount` pass through correctly per post; assert each post's own `coauthors` (not the primary's) resolves per entry (seed 2 posts with different `COAUTHOR` sets); assert `[]` for an event with zero linked posts.
  - [x] New `Query.relatedEventIds resolver (Story 3.6u)` block: seed 2 events sharing one linked post plus a 3rd unrelated event; assert the shared post's group includes the other event's id but excludes the subject event itself; assert a soft-deleted and a merged candidate are both excluded; assert `[]` when the event has no co-linked posts.
- [ ] **Task 3 — Frontend query + `EventCardCompact` consumption + codegen** (AC: #1, #2, #3, #6)
  - [x] `apps/web/src/features/events/queries.graphql` — add `sourcePosts { postId isPrimary groupingReason extractedEventCount postedAt sourcePostUrl originalPostUrl account { ...SocialMediaAccountProfileFields } coauthors { accountId platform username displayName profileImageUrl } }` to `getEventBySlug`'s selection (keep the existing flat `coauthors { ... }` selection unchanged, AC2); add a new `getRelatedEventIds(eventId: ID!)` document and a `getEventsByIds` document (or reuse the existing `getEvents`-style document with an `id in [...]` filter — confirm against the existing `Query.events` document's filter-arg shape before adding a new one). **Resolved: reused the existing `getEvents` document** — `navigation-hook.ts`'s favorites-navigation already proves the exact `query: { operator: 'and', conditions: [{ field: 'id', operator: 'in', value: [...] }] }` shape against this same document; no new `getEventsByIds` document added.
  - [x] Confirm via grep that no `Query.events`-based list-view document selects `sourcePosts` (AD-17/AC1's confinement, mirroring 0.i6g's AC2 regression guard for `coauthors`).
  - [x] Run `pnpm --filter web codegen` (runs `fix-codegen.js`) — regenerate `apps/web/src/generated/graphql.ts`. Also added a missing `PostGroupingReason` entry to `fix-codegen.js`'s duplicate-type-stripping list (the new enum caused a `TS2567` enum/type-alias collision until added, same pattern as every other existing enum in that script).
  - [ ] Import Story 3.6ua's exported `EventCardCompact` (`packages/ui/src/features/events/index.ts`) for the Related Events section's inline cards and loading skeleton — **do not** reach into `WeeklyCalendarView.tsx`'s internal `CalendarCard` directly, and do not duplicate its markup.
- [x] **Task 4 — `useVisibleOnce` hook** (AC: #6)
  - [x] `packages/ui/src/hooks/useVisibleOnce.ts` — new, small, single-purpose `IntersectionObserver`-based hook that fires its callback (or flips a returned boolean) exactly once when a sentinel ref becomes visible, then disconnects the observer (no repeated firing, unlike `useInfiniteScroll.ts`'s pagination-shaped repeated-fire design — confirmed via Gate 2 review that reusing `useInfiniteScroll` as-is would be a shape mismatch, and writing this small hook inline is not split-worthy). Default `rootMargin`/`threshold` consistent with `useInfiniteScroll.ts`'s existing `'200px'`/`0` defaults for visual consistency across the codebase's two IntersectionObserver consumers.
  - [x] `useVisibleOnce.test.ts` — unit tests: fires once when intersecting, does not re-fire on a second intersection, disconnects after firing. (9 tests, all passing; also covers non-intersecting entries, unmount cleanup, and default/custom rootMargin-threshold options.)
- [ ] **Task 5 — `EventDetailView` types + presentation (single-post unchanged, multi-post new branch)** (AC: #4, #5, #6, #8)
  - [ ] `packages/ui/src/features/events/EventDetailView.types.ts` — add `EventDetailViewSourcePost` interface (`postId`, `isPrimary`, `groupingReason?`, `extractedEventCount?`, `postedAt`, `sourcePostUrl?`, `originalPostUrl?`, `account?: { platform; username; displayName; profileImageUrl; accountHref }`, `coauthors: EventDetailViewCoauthor[]`); add `EventDetailViewRelatedEventGroup` interface (`postId`, `accountLabel`, `events: EventListItemShape[]`, `totalCount`, `seeAllHref`, `isLoading`). Add to `EventDetailViewProps`: `sourcePosts?: EventDetailViewSourcePost[]; relatedEventGroups?: EventDetailViewRelatedEventGroup[]; isRelatedEventsLoading?: boolean; relatedEventsSentinelRef?: React.Ref<HTMLDivElement>`. Add `sourcePostsPrimaryLabel`/`relatedEventsGroupLabel`/`relatedEventsSeeAllLabel`/`relatedEventsSectionAriaLabel` to `EventDetailViewLabels`.
  - [ ] `EventDetailView.tsx` — gate on `sourcePosts.length > 1`: `> 1` renders the new multi-post `<ol>` (AC5) in place of the existing Attributions block + flat-coauthors `<ul>` (lines 587-649); `<= 1` (or `sourcePosts` absent) renders those exact existing blocks unchanged (AC4). Add the new Related Events section below both branches (AC6), attaching `relatedEventsSentinelRef` to its own wrapper div.
  - [ ] `EventDetailView.test.tsx` — new `sourcePosts (Story 3.6u)` describe block: 1-post case renders exactly as the existing coauthors/Attributions tests already assert (regression, run those existing tests unmodified and green); 3-post case renders 3 entries in primary-first order with the "Primary" label on exactly one; each entry's own coauthors render independently (not the flat prop). New `related events (Story 3.6u)` describe block: groups render capped at 5 with "See all N" beyond; zero-event group renders nothing; loading state renders `EventCardCompact`'s skeleton shape with `aria-busy="true"`; no live-region announcement assertion.
- [ ] **Task 6 — `apps/web` mapper: map `sourcePosts` + related-events two-step orchestration** (AC: #2, #4, #5, #6)
  - [ ] `apps/web/src/features/events/mapper.ts` — `mapGraphQLEventToDetailViewProps` maps `event.sourcePosts` to `EventDetailViewSourcePost[]` (per-post `accountHref` built via `getPlatformSlug` + `account.accountId`, same pattern as the existing source-account derivation); keeps mapping the flat `coauthors` for the single-post branch unchanged (AC2/AC4).
  - [ ] `apps/web/src/features/events/EventDetailWrapper.tsx` — add `useVisibleOnce` wired to a sentinel ref passed to `EventDetailView`; gate `useGetRelatedEventIdsQuery({ eventId: data?.eventBySlug?.id })` on `isVisible && !!data?.eventBySlug?.id` (never gating the primary `useGetEventBySlugQuery`); on success, flatten/dedupe `eventIds`, fire `useGetEventsQuery({ filter: { id: { in: [...] } } })`; group results back by matching each event's id against each `RelatedEventGroup.eventIds`, label each group via `sourcePosts` (no second account fetch, AC6). Reuse the existing `pendingCoauthorAccountId`/coauthor mutation pair (Story 0.i6g, unaffected by which post a coauthor came from — the mutations are accountId-scoped, not post-scoped) for every per-post coauthor toggle in the new multi-post branch.
  - [ ] `mapper.test.ts` — new `sourcePosts mapping (Story 3.6u)` block.
  - [ ] `EventDetailWrapper.test.tsx` — new `related events lazy load (Story 3.6u)` block: `relatedEventIds`/`events` never fire before `useVisibleOnce` reports visible; firing the related-events queries never delays/blocks the primary `eventBySlug` render; grouping/labeling correctness using the already-loaded `sourcePosts` account data. Run the full existing suite (including the 0.i6g coauthor-toggle block and DW-009) unmodified and green.
- [ ] **Task 7 — EXPLAIN gate** (AC: #7)
  - [ ] Extend `apps/backend/src/explain-events-queries.ts` with 2 new scenarios: `Query.relatedEventIds` and `Event.sourcePosts` (via a real `getEventBySlug` call against a multi-post-linked seed event). Run against `seed:volume`, capture via the existing SQL-capture-sink mechanism, re-run each under `EXPLAIN (ANALYZE, BUFFERS)`.
  - [ ] Write `_bmad-output/planning-artifacts/cc-024-explain-after-3.6u-<date>.md` — same format as `cc-024-explain-after-3.6y-2026-10-02.md`, diffing against that baseline for the 2 pre-existing scenarios (must be unchanged) and recording fresh results for the 2 new ones (must show index usage, no Seq Scan).
  - [ ] `pnpm --filter @festgrid/database seed:volume:clean` after capture.
- [ ] **Task 8 — i18n** (AC: #8)
  - [ ] Add `sourcePostsPrimaryLabel`, `relatedEventsGroupLabel`, `relatedEventsSeeAllLabel`, `relatedEventsSectionAriaLabel` to `apps/web/locales/en.json`'s `EventDetailsPage` namespace.
  - [ ] Add the Indonesian equivalents to `apps/web/locales/id.json`'s `EventDetailsPage` namespace.
- [ ] **Task 9 — Verification** (AC: all)
  - [ ] `pnpm --filter backend test` (targeted: `resolvers.test.ts`), `pnpm --filter backend build`/`tsc`, `pnpm --filter backend lint`.
  - [ ] `pnpm --filter domain test` (targeted: `posts/types.test.ts` for `postGroupingReasonToGraphQL`), 100% coverage on the new mapping function.
  - [ ] `pnpm --filter ui test` (targeted: `EventDetailView.test.tsx`, `useVisibleOnce.test.ts`), full suite green; `pnpm --filter ui lint`.
  - [ ] `pnpm --filter web test` (targeted: `EventDetailWrapper.test.tsx`, `mapper.test.ts`), full suite green; `pnpm --filter web lint`; `pnpm --filter web build`.
  - [ ] Root `pnpm build`/`pnpm lint` for no cross-package regressions. Root `pnpm test` once (`TZ=UTC`); triage any failure against known pre-existing/out-of-scope failures (e.g. `apps/infrastructure`'s CDK-template test, flagged by Story 0.i6g) before assuming a new regression.
  - [ ] Confirm Story 3.6ua (compact-card extraction prerequisite) is `review` or `done` before this story's Task 3/5 begin — if still `backlog`/`ready-for-dev`, dev-story for 3.6ua first (Pre-Coding Approval Gate item).

## Dev Notes

### Design Decisions

Three genuine, non-mechanical design questions were surfaced to the user via `AskUserQuestion` before finalizing this story, per this project's standing `bmad-create-story` rule:

1. **How `Event.coauthors` (Story 0.i6g, flat, primary-post-only) reconciles with `Event.sourcePosts` (this story, per-post, all linked posts).** Two options were presented: (a) supersede — `EventDetailView` stops reading the flat `coauthors` prop entirely once an event has 2+ linked posts, rendering every entry's (including the primary's) coauthors from `sourcePosts[i].coauthors` uniformly; `Event.coauthors`'s schema field/resolver stay defined and selected (confined to `getEventBySlug`, unmodified) purely as an inert back-compat alias once superseded for that branch; or (b) keep `Event.coauthors` live and driving the primary entry specifically, with `sourcePosts[].coauthors` only covering the other linked posts, requiring the component to special-case index 0. **Resolved: option (a)**, the recommended choice — one data path per rendering branch (single-post keeps using the flat field exactly as 0.i6g shipped it, AC4; multi-post uses `sourcePosts` exclusively, AC5), no permanent special-casing inside the new multi-post branch, and it matches AD-30 Rule 11's own framing that `sourcePosts` uniformly covers every linked post including the primary. See AC2/AC4/AC5 for the exact branch-by-branch data-source split this produces.
2. **EXPLAIN-gate scope for the new `Query.relatedEventIds` query.** Two options were presented: (a) extend the established `explain-events-queries.ts` regression procedure to also baseline-verify the brand-new `Query.relatedEventIds`/`Event.sourcePosts` queries themselves (beyond epics.md's literal AC text, which only names the two pre-existing hot-path queries); or (b) literal-AC-only, leaving the new query's own performance unverified until a later problem surfaces it. **Resolved: option (a)**, the recommended choice — AD-30 Rule 11 explicitly claims `relatedEventIds` is "index-driven," and nothing would otherwise verify that claim before shipping; this story is the only one that will ever stand up this specific query path for the first time. See AC7.
3. **Gate 2's "mobile calendar compact event card" reuse gap.** Gate 2 (run fresh this session, Freya/UX persona) found that `CalendarCard`/`event_card_compact` is a non-exported subcomponent tightly coupled to `WeeklyCalendarView.tsx`'s own calendar-specific plumbing (day-bucket/segment/popover logic, generic `<TSchedule>` typing) that this story's Related Events section needs in a second, unrelated context. Two options were presented: (a) split the extraction into a new prerequisite story (`3.6ua`, lettered-suffix-off-3.6u pattern, matching `1.3a`/`1.3b`/`1.6a`); or (b) absorb a minimal "export `CalendarCard` as-is with dummy calendar props" into this story's own scope. **Resolved: option (a)**, the recommended choice (and Freya's own gate recommendation) — keeps this story's diff and review surface focused on its own AC, avoids a dummy-prop shape that would drift from the real calendar usage, and matches this project's established single-story-UI-split numbering convention. See Architecture & UX Gate Findings and Out of Scope below; `epics.md` and `sprint-status.yaml` were amended in this same session to add the new `3.6ua` story.

### Architecture & UX Gate Findings

An epic readiness report already covers this story: `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.6u`). Per `story-split-gate.md`'s Epic-Level Sweep Mode, Gate 1 and Gate 3 were **not** re-run fresh for this story — their findings are cited directly from that report instead:

- **Gate 1 (Architecture/Infrastructure Completeness) — READY, no gap** (report line 165: *"3.6u (show all source posts and related events on the event detail page) | READY | Depends on 1.3j/1.6c (`review`) — standing rule allows."*). Report lines 72-74 confirm directly: *"3.6u/3.6x's new reads (`Query.relatedEventIds`, `Event.sourcePosts`) are ordinary GraphQL resolvers reusing the existing `buildOptimizedDrizzleSelect`/batched-`IN` idiom (AD-17) — no new ad hoc data path."* The report's Gate 3 Finding 3 (the `getEventBySlugCached`/alias-redirect correction) was confirmed scoped to Story 3.6v only (report line 135: *"Neither 3.6u's nor 3.6v's original AC named either route file or this helper"* — correction applied only to 3.6v), not this story.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — READY, no gap.** No new global-shell, i18n-foundation, analytics-foundation, or GraphQL-codegen-pipeline gap — every mechanism this story uses (AD-17 batched-IN, `buildOptimizedDrizzleSelect`, next-intl, GraphQL Code Generator) is already established and this story is an ordinary consumer of each, per the report.
- **Lightweight guard (this session) — does 3.6u's actual scope contain anything the batch sweep plausibly didn't anticipate?** No. No new external service, no new data entity (`event_posts`/`posts.groupingReason`/`posts.extractedEventCount` are all Story 3.6r-shipped columns this story only reads), no new infra dependency. The one thing requiring fresh judgment — the exact GraphQL shape of `EventSourcePost`/`RelatedEventGroup` and the `postGroupingReasonToGraphQL` enum mapping — is a mechanical schema-design decision, not an architecture/infra gap.
- **Gate 2 (UI Complexity & Reusability) — run fresh this session** (stays per-story per the Epic-Level Sweep Mode rule, since UI scope is story-specific). Dispatched via `runSubagent` with the Freya/UX persona, DESIGN.md/EVENT-CARD-DESIGN.md's `event_card_compact` tokens and EXPERIENCE.md's CC-024 section pasted directly into the prompt (not re-read cold by the subagent). **Verdict: one real gap found** — the `CalendarCard`/`event_card_compact` reuse problem (Design Decision #3 above; resolved by splitting into new Story 3.6ua). **Two non-gaps confirmed:** the lazy-near-viewport one-shot trigger mechanism (a small, single-purpose hook, not the "complex hook with multiple dependents" Gate 2 targets — built inline as `useVisibleOnce`, Task 4) and the multi-post Attributions restructuring itself (core feature logic, single-consumer, not a reusable unit). One additional finding folded into this story's own AC rather than left as a side risk: the "Primary" label is explicitly named as an AC (AC5) rather than left as an EXPERIENCE.md-only detail that could get silently dropped during implementation (Freya's own flag).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No DB migration required.** This story adds GraphQL fields/resolvers and one new top-level query that read already-existing tables/columns (`event_posts`, `posts.groupingReason`, `posts.extractedEventCount`, `posts.publishedAt`, `posts.postUrl`, `posts.originalPostUrl`, `posts.accountId`, `post_account_associations` — all shipped by Stories 3.6r/3.15) — no schema column, enum, or constraint changes anywhere in `packages/database/schema.ts`.
- **Impacted fields/contracts:** `events.graphql`'s `Event` type gains `sourcePosts: [EventSourcePost!]!` (new, additive); `Query` gains `relatedEventIds` (new, additive); two new GraphQL types (`EventSourcePost`, `RelatedEventGroup`) and one new enum (`PostGroupingReason`). `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` gains one new selection; two new query documents are added. `EventDetailViewProps`/`EventDetailViewLabels` (packages/ui) gain new optional fields — every existing caller of `EventDetailView` that omits them renders exactly as it does today (AC4's single-post branch is the literal default path when `sourcePosts` has ≤1 entry).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** New `EventDetailViewSourcePost`/`EventDetailViewRelatedEventGroup` interfaces (`packages/ui`); a new `postGroupingReasonToGraphQL` mapping function + its reverse type (`packages/domain`); `apps/web/src/generated/graphql.ts`/`apps/backend/src/generated/resolvers-types.ts` regenerated via their respective `codegen` commands — never hand-edited.
- **Backward compatibility and rollout notes:** Purely additive at every layer. `Event.coauthors` is explicitly retained unmodified (Design Decision #1) rather than deprecated/removed, so no breaking change to any hypothetical other consumer even though none currently exists beyond `getEventBySlug`. A single-linked-post event (the overwhelming majority today, same rationale 0.i6g already documented) renders with zero visible change (AC4).
- **Verification checks:** Task 2's backend resolver/query tests (real-DB integration); Task 5/6's frontend unit/mapper/integration tests; Task 7's EXPLAIN-gate doc; `tsc`/lint clean across `apps/backend`, `packages/domain`, `packages/ui`, `apps/web`; both `codegen` commands succeed cleanly against the new schema/query.

### Project Structure Notes

- **Reusable-component placement:** `EventCardCompact` (Story 3.6ua, prerequisite — see Out of Scope) lives in `packages/ui/src/features/events/`, exported from that package's `index.ts`, per `project-context.md`'s UI-component placement rule. This story is purely a new *consumer* of it, not its builder.
- **Reusable-mechanism placement (`packages/domain`):** `postGroupingReasonToGraphQL` (a pure, closed-vocabulary mapping function, no DB/ORM/Node dependency) belongs in `packages/domain/src/posts/types.ts`, alongside the existing `POST_GROUPING_REASONS` export it maps — not `apps/backend`, since it is pure/portable and could in principle be reused by a future frontend-side need (e.g. a moderator tool rendering the same enum). The `Event.sourcePosts`/`Query.relatedEventIds` resolver query logic itself stays backend-only (`apps/backend/src/schema/resolvers.ts`), following `Event.sourceSocialMediaAccountProfile`/`Event.coauthors`'s own placement precedent — a thin Drizzle query, not portable business logic.
- **Reusable-hook placement:** `useVisibleOnce` lives in `packages/ui/src/hooks/`, alongside `useInfiniteScroll.ts` — both are generic, framework-level hooks with no feature-specific coupling.
- **State management categorization:** Server State (React Query) only — `sourcePosts`, `relatedEventIds`/related `events` flow entirely through `useGetEventBySlugQuery`/new `useGetRelatedEventIdsQuery`/`useGetEventsQuery` (GraphQL Code Generator-typed). The `useVisibleOnce` visibility boolean is local, transient, non-shareable UI state — not a `zustand`/`nuqs` candidate, matching Story 0.i6g's own `pendingCoauthorAccountId` precedent.
- **Async/loader categorization:** Non-blocking, localized — the Related Events section's own skeleton (matching `EventCardCompact`'s shape) and `aria-busy` treatment, never a full-screen blocking overlay; matches `project-context.md`'s "Non-Blocking (Initial Load)" rule, generalized to a lazy/deferred-initial-load case via `useVisibleOnce`.
- **No cloud/external service setup** — `SETUP_WALKTHROUGH.md` unaffected.
- **No new npm dependency, no new workspace package.**
- **Current code state (read in full/targeted before drafting this story):**
  - `packages/ui/src/features/events/EventDetailView.tsx` (lines 587-617 Attributions, 619-649 coauthors `<ul>`, Story 0.i6g) — this story's single-post branch (AC4) is this exact existing code, untouched; its multi-post branch (AC5) is new, inserted as an alternate render path gated on `sourcePosts.length > 1`.
  - `apps/web/src/features/events/EventDetailWrapper.tsx` — `useGetInstagramEmbedBySlugQuery` (lines 54-57, fires unconditionally in parallel, no `enabled` gate) is the AD-16 Rule 7 "never gates primary content" precedent this story's related-events fetch follows (gated on visibility, not on `eventBySlug`'s own resolution). The existing `pendingCoauthorAccountId`/coauthor mutation pair (Story 0.i6g) is reused as-is for every per-post coauthor toggle in the new multi-post branch — these mutations are accountId-scoped, not post-scoped, so no new mutation pair is needed.
  - `apps/backend/src/schema/resolvers.ts` — `Event.sourceSocialMediaAccountProfile`/`Event.coauthors` (lines 4110-4138) are the exact patterns `Event.sourcePosts` generalizes to the batched-multi-post case; `fieldMap`/batched-schedules precedent (`resolvers.ts:131-155`, `3077-3156`, Stories 1.3j/1.6c) is the AD-17 idiom `Event.sourcePosts` follows.
  - `packages/database/schema.ts` — `eventPosts` (464-476), `events` (401-457, `postId`/`extractionOrdinal`/`mergedIntoEventId`), `posts` (297-356, `groupingReason`/`extractedEventCount`) all already exist from Story 3.6r; no migration needed.
  - `apps/backend/src/lib/events/set-event-primary-post.ts` — the AD-30 Rule 2 drift-guard write helper; this story only *reads* `events.postId`/`event_posts`, never writes them, so it does not touch this helper or its enforcement test.
  - `apps/backend/src/explain-events-queries.ts` — the real, committed EXPLAIN-gate script (Story 3.6r AC6) this story extends (Task 7), not reinvents.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6u] — this story's AC text
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6ua] — new prerequisite story added this session (Gate 2 finding)
- [Source: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md#Wave 4A] — sequencing: "needs 3.6r, 3.6t, 1.3j, 1.6c; coordinate with 0.i6g; 3.7h/3.7i recommended"
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-30 Rule 11] — `Query.relatedEventIds`/`Event.sourcePosts`'s exact binding contract
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-31] — `post_account_associations.role`/`COAUTHOR` vocabulary this story's per-post `coauthors` resolver reuses
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 verdict for 3.6u (READY), cited directly per Epic-Level Sweep Mode
- [Source: _bmad-output/implementation-artifacts/0-i6g-event-post-detail-coauthor-attribution-ui-with-confirm-then-refetch-toggle.md] — the flat `Event.coauthors` field/resolver/component wiring this story reconciles (Design Decision #1); confirmed this story is explicitly named in 0.i6g's own Dev Notes as the reconciliation point
- [Source: _bmad-output/implementation-artifacts/3-6r-add-the-event-post-link-table-and-multi-event-schema.md, 3-6s-extract-multiple-events-per-post-with-grouping-rules.md, 3-6t-ingest-multiple-events-per-post-with-per-event-slugs-and-notifications.md] — the `event_posts`/`posts.groupingReason`/`extractedEventCount`/extraction-ordinal shapes this story reads
- [Source: _bmad-output/implementation-artifacts/1-3j-batch-computed-event-fields-and-gate-totalcount-staletime.md, 1-6c-batch-isaddedtocalendar-dedupe-eventbyslug-fetch-and-gate-subscriptions-query.md] — the AD-17 batched-`IN`/`fieldMap`/`eventBySlug`-confined-field precedent `Event.sourcePosts` follows
- [Source: _bmad-output/planning-artifacts/cc-024-explain-baseline-2026-10-01.md, cc-024-explain-after-3.6r-2026-10-02.md, cc-024-explain-after-3.6y-2026-10-02.md] — EXPLAIN-gate baseline/procedure this story's AC7 extends
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Multi-Event Posts and Cross-Post Event Matching (CC-024), §1/§2/§3] — full section read; Source Posts Area, Related Events Area, Post Collection Page route contracts
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EVENT-CARD-DESIGN.md#event_card_compact] — read in full; confirmed `event_card_compact` is the only token family relevant here, no `source_post`/`related_event` tokens exist
- [Source: packages/ui/src/features/events/EventDetailView.tsx, EventDetailView.types.ts, EventDetailView.test.tsx, WeeklyCalendarView.tsx] — read in full/targeted ranges
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx, EventDetailWrapper.test.tsx, mapper.ts, mapper.test.ts, queries.graphql] — read in full/targeted ranges
- [Source: apps/backend/src/schema/events.graphql, extraction.graphql, resolvers.ts, resolvers.test.ts] — read in full/targeted ranges
- [Source: packages/database/schema.ts, packages/domain/src/posts/types.ts, packages/domain/src/events/types.ts] — read in full for exact current shapes
- [Source: packages/ui/src/hooks/useInfiniteScroll.ts] — the IntersectionObserver precedent `useVisibleOnce` sits alongside but does not duplicate

## Global Rules References

- [x] `_bmad-output/project-context.md` — API Style (GraphQL; new fields/query go through the existing backend layer); End-to-End Type Safety (both `codegen` commands); Optimized DB Queries (`buildOptimizedDrizzleSelect`/AD-17 batched-IN idiom, AC1/AC3); Locale-Sensitive Data Rendering (per-post posted-at time, AC5); Keep Skeletons in Sync With Their Real Component (Related Events skeleton, AC6); Code Organization (`packages/domain` placement of `postGroupingReasonToGraphQL`, no DB/ORM coupling; `packages/ui` placement of `EventCardCompact`/`useVisibleOnce`)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-30 Rule 11 (binds this story directly), AD-31 (per-post coauthors), AD-17 (batched-IN idiom, EXPLAIN gate)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds GraphQL fields/resolvers only, no new infrastructure resource (no new queue, Lambda, or compute) — matches the no-new-infra precedent of 3.16/0.i6c/0.i6g
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 cited from the batch readiness report (Epic-Level Sweep Mode); Gate 2 run fresh this session (gap found, split into Story 3.6ua)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `apps/backend/src/schema/events.graphql` — `EventSourcePost`, `PostGroupingReason`, `Event.sourcePosts`, `RelatedEventGroup`, `Query.relatedEventIds` (Task 1).
  2. `packages/domain/src/posts/types.ts` — `postGroupingReasonToGraphQL` (Task 1).
  3. `apps/backend/src/schema/resolvers.ts` — `Event.sourcePosts`, `Query.relatedEventIds` resolvers (Task 1).
  4. `apps/backend/src/generated/resolvers-types.ts` — regenerated (Task 1).
  5. `apps/backend/src/schema/resolvers.test.ts` — new test blocks (Task 2).
  6. `apps/web/src/features/events/queries.graphql` — `sourcePosts` selection + new query documents (Task 3).
  7. `apps/web/src/generated/graphql.ts` — regenerated (Task 3).
  8. `packages/ui/src/hooks/useVisibleOnce.ts` + `.test.ts` — new hook (Task 4).
  9. `packages/ui/src/features/events/EventDetailView.types.ts` — new interfaces/props/labels (Task 5).
  10. `packages/ui/src/features/events/EventDetailView.tsx` — single-post branch unchanged; new multi-post branch; new Related Events section (Task 5).
  11. `packages/ui/src/features/events/EventDetailView.test.tsx` — new test blocks (Task 5).
  12. `apps/web/src/features/events/mapper.ts` — `sourcePosts` mapping (Task 6).
  13. `apps/web/src/features/events/EventDetailWrapper.tsx` — `useVisibleOnce` wiring, two-step related-events orchestration (Task 6).
  14. `apps/web/src/features/events/mapper.test.ts`, `EventDetailWrapper.test.tsx` — new test blocks (Task 6).
  15. `apps/backend/src/explain-events-queries.ts` — 2 new scenarios (Task 7).
  16. `_bmad-output/planning-artifacts/cc-024-explain-after-3.6u-<date>.md` — new (Task 7).
  17. `apps/web/locales/en.json`, `apps/web/locales/id.json` — new keys (Task 8).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/3 → cited from batch readiness report (no gap); Gate 2 → fresh, gap found, split into Story 3.6ua (Design Decision #3).
  - AD-30 Rule 11 → AC1/AC3/AC6 implement its exact `Event.sourcePosts`/`Query.relatedEventIds` contract.
  - AD-31 → per-post `coauthors` resolver reuses the closed `COAUTHOR` role vocabulary, no new role invented.
  - AD-17 → AC1/AC3's batched-IN idiom, AC7's EXPLAIN-gate extension (Design Decision #2).
  - `project-context.md`'s Keep Skeletons in Sync rule → AC6's `EventCardCompact`-shaped skeleton.
  - Data Type Compatibility rule (this workflow) → dedicated section above; no DB migration, additive GraphQL/TS types only.
  - Reusable-component/hook rules (this workflow) → `EventCardCompact` deferred to Story 3.6ua; `useVisibleOnce` built here (Gate 2 no-gap finding).
- **Verification Plan:**
  - `pnpm --filter backend test`/`build`/`lint`; `pnpm --filter domain test` (100% coverage on new mapping fn).
  - `pnpm --filter ui test` (`EventDetailView.test.tsx`, `useVisibleOnce.test.ts`, full suite), `pnpm --filter ui lint`.
  - `pnpm --filter web test` (`EventDetailWrapper.test.tsx`, `mapper.test.ts`, full suites), `pnpm --filter web lint`, `pnpm --filter web build`.
  - Root `pnpm build`/`pnpm lint`/`pnpm test` (once) for cross-package regressions.
  - EXPLAIN-gate doc (Task 7) committed alongside the code change.
  - Manual sanity: an event with 3 linked posts (primary + 2 others, at least one with its own coauthors), confirm Primary label on exactly one entry, independent per-post coauthor toggles, and Related Events section loading only once scrolled near.

## Pre-Coding Approval Gate

- [x] Scope confirmation — Tasks 1-9 match the three user-decided design questions (sourcePosts supersedes coauthors per-branch; EXPLAIN gate covers both regression + new-query baseline; CalendarCard extraction split into Story 3.6ua) plus the epics.md-specified AC text.
- [x] Architecture and boundary confirmation — new fields/query go through the existing backend/GraphQL layer only; `postGroupingReasonToGraphQL` placed in `packages/domain` (pure, no DB/ORM coupling); Gate 1/3 cited READY from the batch report, Gate 2 gap resolved via Story 3.6ua split.
- [x] Testing plan confirmation — Tasks 2, 5, 6, 7 cover the new resolvers/query, presentation (both branches), mapping/orchestration, and the EXPLAIN-gate extension.
- [x] Explicit human approval state — **Approved by user via `bmad-dev-story` activation on 2026-10-04** (AskUserQuestion: "Approve - start coding").
- [x] **Gate 1/2/3 prerequisites confirmed done or gap accepted** — Gate 1/3: READY, cited from `epic-readiness/batch-cc-024-multi-event-readiness.md`, no action needed. Gate 2: gap found and resolved by splitting Story 3.6ua into `epics.md`/`sprint-status.yaml` this session. **Verified at dev-story activation (2026-10-04): Story 3.6ua is at `review` status in `sprint-status.yaml`** — hard prerequisite satisfied, Task 3/5 may proceed. Dependency stories 3.6r, 3.6t, 1.3j, 1.6c, 0.i6g all independently confirmed at `review` status in `sprint-status.yaml` as of this story's creation.

## Testing Requirements

- [ ] Backend integration tests — `resolvers.test.ts`'s new `Event.sourcePosts resolver`/`Query.relatedEventIds resolver` blocks (real-DB, Task 2).
- [ ] Domain unit tests — `postGroupingReasonToGraphQL`, 100% coverage.
- [ ] Unit tests — `EventDetailView.test.tsx`'s new `sourcePosts`/`related events` blocks; `useVisibleOnce.test.ts`; existing suites unmodified and green.
- [ ] Unit tests — `mapper.test.ts`'s new `sourcePosts mapping` block.
- [ ] Integration tests — `EventDetailWrapper.test.tsx`'s new `related events lazy load` block (visibility-gating, never-blocks-primary-content, grouping/labeling correctness); full existing suite (including 0.i6g's coauthor-toggle block, DW-009) unmodified and green.
- [ ] E2E tests — not required; this is a new consumer of already-e2e-exempt shared components (`SubscribedAccountCard`, `EventCardCompact` family) with no new critical user flow beyond already-covered navigation/subscribe actions.
- [ ] Migration verification — not applicable; no migration in this story.
- [ ] EXPLAIN-gate verification — Task 7's extended `explain-events-queries.ts` run, new doc committed, no Seq Scan on either new query, no regression on the two existing hot-path queries.
- [ ] Codegen verification — both `pnpm --filter backend codegen` and `pnpm --filter web codegen` succeed cleanly, no hand-edits to generated output.

## Deliverables Checklist

- [ ] `Event.sourcePosts: [EventSourcePost!]!` field + resolver shipped, confined to `getEventBySlug` (AC1, AC2).
- [ ] `Query.relatedEventIds(eventId: ID!): [RelatedEventGroup!]!` shipped, index-driven, excludes subject/soft-deleted/merged events (AC3).
- [ ] Single-linked-post events render byte-identical to today (AC4), full regression suite green.
- [ ] Multi-linked-post events render a primary-first Source Posts list with per-post account/time/link/coauthors and a "Primary" label (AC5).
- [ ] Related Events section lazy-loads near viewport via the two-step `relatedEventIds` -> `events(id in [...])` read, never gating primary content, grouped/labeled/capped/skeletoned per AC6.
- [ ] EXPLAIN-gate doc committed confirming no regression on the two existing hot-path queries and no Seq Scan on either new query (AC7).
- [ ] i18n keys added to both locales (AC8).
- [ ] Story 3.6ua (`EventCardCompact` extraction) added to `epics.md`/`sprint-status.yaml` this session, and reaches `review`/`done` before this story's own dev-story Task 3/5.

## Out of Scope

- **Story 3.6ua (`EventCardCompact` extraction from `CalendarCard`)** — not built here; this story only *consumes* its finished export. Added to `epics.md`/`sprint-status.yaml` this session as a hard prerequisite (Gate 2 finding, Design Decision #3).
- **`Query.relatedEventIds`'s `postId` argument variant** — Story 3.6x's own scope when it widens this query's signature; this story ships only the `eventId: ID!` path (AC3's scope note).
- **Story 3.6x (Post Collection Page, `/posts/{...}/events`)** — not built here; this story's "See all N events" link targets that future route (EXPERIENCE.md §3's documented path), which 404s until 3.6x ships in the same wave — an accepted, temporary gap, not a defect.
- **`Event.coauthors` deprecation/removal** — explicitly not done (Design Decision #1); the field/resolver stay exactly as Story 0.i6g shipped them, purely as an inert back-compat alias once superseded in the multi-post rendering branch.
- **Story 3.6v (matching/enrichment)** — unaffected; this story only reads already-linked `event_posts` rows, never creates/matches new links.
- **Story 3.6w (moderator merge)** — unaffected; this story's Related Events query already excludes merged events (AC3) but does not implement merge logic itself.
- **Story 3.18 (union-of-associations account filtering)** — unaffected; this story does not touch the account-filter/feed-matching logic.
- **Any analytics event for the Related Events section or per-post coauthor toggles** — not added here; the existing coauthor-toggle no-analytics regression guard (Story 0.i6g AC9) is unaffected and continues to apply to every per-post toggle in the new multi-post branch too (same reused mutation pair).

## Definition of Done

- [ ] AC1-8 satisfied.
- [ ] Required tests passing (Tasks 2, 5, 6, 7 + Testing Requirements).
- [ ] Lint and type checks passing for `apps/backend`, `packages/domain`, `packages/ui`, `apps/web`.
- [ ] Both `codegen` commands run clean, no hand-edited generated files.
- [ ] EXPLAIN-gate doc committed, no Seq Scan regressions.
- [ ] Story 3.6ua at `review`/`done` before this story is marked `done`.
- [ ] Pre-Coding Approval Gate's explicit human approval state confirmed before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (bmad-create-story, direct in-session story authoring with parallel research/Gate-2 subagent dispatch).

### Debug Log References

- 2026-10-04: Hit a hard environment blocker partway through Task 1. Every Bash invocation that requires a *fresh* permission grant (`pnpm ...`, `npx ...`, `node -e`, `bash -c`) fails deterministically with `Tool permission request failed: AbortError: Stream closed`, while already-trusted command shapes (`ls`, `find`, `grep`, `cat <abs path>`, `echo`, `python3`, `git`, `node --version`) succeed normally. Reproduced independently from a fresh subagent (ruling out session-local state) and with `dangerouslyDisableSandbox: true` (ruling out a sandbox-profile cause). The `AskUserQuestion` tool subsequently started failing with the identical error on every retry (after succeeding once earlier in this same session for the Pre-Coding Approval Gate check), so I could not even get live user guidance on how to proceed. This blocked every `pnpm --filter ... test/lint/build` command required by Steps 7/9 of the dev-story workflow for every task in this story.
- 2026-10-04 (session 2): A subsequent dev-story session completed the rest of Task 1 (schema/resolvers.ts/codegen) and wrote Task 2's two new `resolvers.test.ts` blocks, but died silently (empty exit) while attempting to run the backend tests — checkboxes were left unticked pending verification.
- 2026-10-04 (session 3, this session, RESUME #2): Permission/tool channel confirmed healthy. Verified the saved backend+domain WIP (commits `fb9133a`, `52c05c5`) against AC1/AC2/AC3/Task 1/Task 2 line-by-line before touching checkboxes: schema diff matches AC1/AC3's exact type/enum/field shapes; `postGroupingReasonToGraphQL` matches the mapping table in AC1; `Event.sourcePosts` resolver matches AC1's batched-IN/primary-first-then-ordinal/per-post-coauthors contract; `Query.relatedEventIds` resolver matches AC3's self-join/exclude-subject/exclude-soft-deleted/exclude-merged contract. Ran: `apps/backend` targeted test (`tsx --test src/schema/resolvers.test.ts`, full file, 96/96 pass including both new `(Story 3.6u)` blocks — confirmed by name in output); `packages/domain` targeted test (`tsx --test src/posts/types.test.ts`, 2/2 pass); `apps/backend` scoped `tsc --noEmit` (0 errors) and `packages/domain` scoped `tsc --noEmit` (0 errors) — the story's `--ignoreDeprecations 6.0` flag errors on this repo's installed TS 5.9.3 (`TS5103: Invalid value`), so ran bare `tsc --noEmit` instead, still 0 errors; `apps/backend` scoped `pnpm lint` (0 errors, only pre-existing warnings) and `packages/domain` scoped `eslint . --max-warnings 0` (0 errors, 0 warnings); re-ran `pnpm --filter backend codegen` and diffed `resolvers-types.ts` byte-for-byte against the committed version — identical, confirming the saved regeneration was not hand-edited. Task 1 and Task 2 checkboxes ticked and committed on this verification. Continuing with Tasks 3-9 in this same session.

### Completion Notes List

- 2026-10-04 (session 1): **Story NOT complete — paused on an environment blocker, not a scope/design issue.** Only the domain piece of Task 1 was implemented and could not be test-executed. Status intentionally left at `in-progress`.
- 2026-10-04 (session 3, this session): Verified session 2's saved backend-slice WIP (Task 1 schema/resolvers/codegen, Task 2 tests) actually satisfies AC1-AC3 and passes: backend `resolvers.test.ts` full run 96/96 green (both new Story 3.6u blocks present and passing); domain `types.test.ts` 2/2 green; both packages' scoped `tsc --noEmit` and lint clean; `backend codegen` re-run confirmed `resolvers-types.ts` matches exactly (no drift, no hand-edit). Tasks 1-2 ticked and committed. Proceeding with Tasks 3-9.

### File List

- `apps/backend/src/schema/events.graphql` (modified — `EventSourcePost` type, `PostGroupingReason` enum, `Event.sourcePosts` field, `RelatedEventGroup` type, `Query.relatedEventIds`, per Task 1/AC1/AC3)
- `apps/backend/src/schema/resolvers.ts` (modified — `Event.sourcePosts` and `Query.relatedEventIds` resolvers, per Task 1/AC1/AC3)
- `apps/backend/src/generated/resolvers-types.ts` (regenerated via `pnpm --filter backend codegen`, re-verified byte-identical this session)
- `apps/backend/src/schema/resolvers.test.ts` (modified — new `Event.sourcePosts resolver (Story 3.6u)` and `Query.relatedEventIds resolver (Story 3.6u)` blocks, per Task 2; verified passing this session)
- `packages/domain/src/posts/types.ts` (modified — added `postGroupingReasonToGraphQL` mapping function + `PostGroupingReasonGraphQL` type, per Task 1)
- `packages/domain/src/posts/types.test.ts` (new — unit tests for `postGroupingReasonToGraphQL`; verified passing this session)
- `apps/web/src/features/events/queries.graphql` (modified — `sourcePosts` selection on `getEventBySlug`, new `getRelatedEventIds` document, per Task 3)
- `apps/web/src/generated/graphql.ts` (regenerated via `pnpm --filter web codegen`)
- `apps/web/fix-codegen.js` (modified — added `PostGroupingReason` to the duplicate-type-stripping list)
- `packages/ui/src/hooks/useVisibleOnce.ts` (new, per Task 4)
- `packages/ui/src/hooks/useVisibleOnce.test.ts` (new, per Task 4; 9 tests passing)
- `packages/ui/src/hooks/index.ts` (modified — export `useVisibleOnce`)

## Change Log

- 2026-10-03: Story created via `bmad-create-story`. Three decisions resolved with the user via `AskUserQuestion`: (1) `Event.sourcePosts` supersedes `Event.coauthors` for the multi-post rendering branch, with `coauthors` kept unmodified as an inert back-compat alias for the unchanged single-post branch; (2) the EXPLAIN gate covers both the existing-query regression check and a first-time baseline of the new `Query.relatedEventIds`/`Event.sourcePosts` queries; (3) the "mobile calendar compact event card" (`CalendarCard`/`event_card_compact`) reuse gap found by a fresh Gate 2 pass is resolved by splitting its extraction into new prerequisite Story 3.6ua rather than absorbing it here. Gate 1/3 cited READY from the existing batch readiness report (`epic-readiness/batch-cc-024-multi-event-readiness.md`, Epic-Level Sweep Mode — no fresh run needed); Gate 2 run fresh via the Freya/UX persona. `epics.md` and `sprint-status.yaml` amended in this same session to add Story 3.6ua.
- 2026-10-04: Backend slice (Task 1 schema/resolvers/codegen, Task 2 tests) implemented across two prior interrupted sessions. This session (RESUME #2) verified the saved work against AC1-AC3 and confirmed it green (tests/tsc/lint/codegen-diff), then ticked Tasks 1-2.
