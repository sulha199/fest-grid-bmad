---
baseline_commit: ff277ee70d49baea9ac7a4e4c821b1e1d08692de
---
# Story 4.8: View archived (hidden) personal events

## Story Details

- Epic: 4
- Story ID: 4.8
- Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a dedicated "Archive" page listing my favorited, calendar-added, and subscribed-account events that have been hidden by the platform's default visibility rules (expired past events, moderator soft-deletes, events I've reported for any reason),
so that I can still find and review events I have a personal connection to, even after they've dropped out of the main Feed, Discovery, Favorites, or My Calendar views.

## Acceptance Criteria

1. **Given** I am logged in and navigate to the "Archive" page from the user menu, **when** the page loads, **then** I see events that are (a) excluded by at least one of the default visibility rules — Story 2.7's past-event auto-hide, Story 4.4a's moderator soft-delete (`events.deletedAt`), or Story 4.3a/4.3c's `isHiddenForCurrentUser`/self-report exclusion (any report I've filed, any reason, any status) — retrieved via a new, explicit opt-in `includeMyArchived: Boolean` argument on `Query.events` that bypasses those default rules, requires authentication (`UNAUTHENTICATED` if anonymous), and is server-side forced to only ever return events I have a personal connection to (never usable to browse other users' hidden events) — **and** (b) are either favorited by me, added to my calendar, or sourced from a social media account I subscribe to (Epic 3).
2. **And** each entry indicates *why* it is hidden (expired / removed by moderation / hidden by me), computed from data already established by the Story 2.7/4.3a/4.4a/4.3c resolvers (event's schedule dates, `events.deletedAt`, `isHiddenForCurrentUser`) — no new hide-reason storage (table/column) is introduced by this story.
3. **And** the page reuses the existing list/infinite-scroll/card patterns (`EventListView`, `useInfiniteScroll`, `EventDiscoveryPanel`'s card-view shell — Stories 1.3b/1.3c/1.3d) rather than inventing new ones; the page has no search/filter surface (Archive is a fixed, personal-connection query, not a user-filterable list).
4. **And** clicking an archived card opens the normal event detail view (`/events/:slug`), which works correctly for a moderator-soft-deleted event when — and only when — the viewer is the archive's own owner: `Query.event(id)`/`Query.eventBySlug(slug)` gain a matching owner-scoped `includeMyArchived: Boolean` argument that, when true, requires authentication and only bypasses `activeOnly(events)` for that specific event if the caller is verified (server-side) to have a personal connection to it (favorited it, added it to their calendar, subscribes to its source account, or has personally reported it) — never a blanket "any authenticated caller can view any soft-deleted event" bypass. Past-event and self-report exclusions never applied to single-event lookups in the first place (Story 2.7 AC8, Story 4.3c AC2), so this argument only ever needs to affect the moderator-soft-delete case.
5. **And** Archive is a read-only browsing view for this story — no "un-hide"/restore/withdraw action exists yet for any of the three reasons, including "hidden by me" (deferred; see Out of Scope).
6. **And** unauthenticated visitors to `/archive` are redirected to `/login`, mirroring the existing Favorites/My Calendar/Reports pattern.
7. **And** the empty state and all locale-sensitive rendering (dates, enum labels, the three "why hidden" reason labels) follow `project-context.md`'s i18n rules — no raw/unformatted values.

## Tasks / Subtasks

- [ ] **Task 1: Backend — `includeMyArchived` bypass on `Query.events` (AC1, AC2)** — `apps/backend`
  - [ ] In `apps/backend/src/schema/events.graphql`, add `includeMyArchived: Boolean` to `Query.events`'s argument list (alongside the existing moderator-only `includeSoftDeleted`), and add matching `includeMyArchived: Boolean` arguments to `Query.event(id: ID!)` and `Query.eventBySlug(slug: String!)` (see Task 3 for those two).
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `Query.events` resolver (~line 1322), when `includeMyArchived === true`: call `requireAuth(context)` (throw `UNAUTHENTICATED` if anonymous, mirroring `includeSoftDeleted`'s `requireModerator` precedent but with a plain-user check).
  - [ ] Add three new boolean-fragment `fieldMap` entries, following the *exact* existing `userId ? exists(...) : sql\`false\`` pattern already used for `isFavorited`/`isAddedToCalendar`/`isFromSubscribedAccount` (`resolvers.ts:1404-1431`):
    - `isPastEvent`: the precise logical negation of Story 2.7's `overlaps` predicate for the same `hidePastEventsAfterDays`-derived `threshold` already computed in this resolver (~line 1349-1355) — `sql\`NOT EXISTS (SELECT 1 FROM ${schedules} WHERE ${schedules.eventId} = ${events.id} AND daterange(${schedules.eventStartDate}, COALESCE(${schedules.eventEndDate}, ${schedules.eventStartDate}), '[]') && daterange(${threshold}::date, NULL, '[]'))\`` — reuse the same `threshold` variable Story 2.7 already computes; do not recompute it differently.
    - `isHiddenByModeration`: `sql\`(${events.deletedAt} IS NOT NULL)\``.
    - `isReportedByCurrentUser`: `userId ? exists(db.select({ id: reports.id }).from(reports).where(and(eq(reports.reporterUserId, userId), eq(reports.eventId, events.id)))) : sql\`false\`` — **if Story 4.3c has already shipped this exact `fieldMap` entry by the time this story is implemented, reuse it as-is rather than adding a duplicate; only add it here if 4.3c's entry is not yet present** (see Dev Notes → "Story 4.3c Dependency" and the Pre-Coding Approval Gate item).
  - [ ] When `includeMyArchived === true`, replace the normal filtering branch (the `defaultVisibilityConditions` AND-composition at ~line 1434-1440, and the `includeSoftDeleted`/`activeOnly(events)` branch at ~line 1443-1447) with: skip `defaultVisibilityConditions` entirely, skip `activeOnly(events)` entirely, and instead AND together (a) the caller's own `query` argument if provided (composed exactly as today), (b) a server-forced "hidden by ≥1 rule" condition — `{ operator: 'or', conditions: [{ field: 'isPastEvent', operator: 'eq', value: true }, { field: 'isHiddenByModeration', operator: 'eq', value: true }, { field: 'isReportedByCurrentUser', operator: 'eq', value: true }] }` — and (c) a server-forced "personal connection" condition — `{ operator: 'or', conditions: [{ field: 'isFavorited', operator: 'eq', value: true }, { field: 'isAddedToCalendar', operator: 'eq', value: true }, { field: 'isFromSubscribedAccount', operator: 'eq', value: true }] }`. Both (b) and (c) must be appended **server-side, unconditionally** — never accepted as or overridable by the client's `query` argument — this is the AC1 safety guarantee ("never usable to view other users' hidden events" / never a bare-favorited-events leak of the normal, non-hidden kind).
  - [ ] Confirm `includeMyArchived: true` and `includeSoftDeleted: true` are mutually exclusive request shapes in practice (different auth gates: `requireAuth` vs `requireModerator`) but not code-conflicting — if a caller somehow sets both, `requireModerator` still applies for `includeSoftDeleted`'s own branch; keep the two branches structurally independent (`if/else if`), do not attempt to support both simultaneously since no consumer needs that.
  - [ ] Confirm the `totalCount` query (reusing the same `whereClause` variable) picks up the new filtering automatically — no separate change needed (mirrors Story 2.7/4.3c's identical confirmation step).

- [ ] **Task 2: Backend — expose "why hidden" fields on `Event` (AC2)** — `apps/backend`
  - [ ] In `apps/backend/src/schema/events.graphql`, add `deletedAt: String` to the `Event` type **only if not already present** (Story 4.7, in-flight, may add this first — check the file at implementation time; do not declare it twice). Add a new `isExpiredForCurrentUser: Boolean!` field to `Event` (reuses `isHiddenForCurrentUser`'s existing per-request-context field-resolver style, `resolvers.ts:1627-1637`).
  - [ ] Add the `Event.isExpiredForCurrentUser` field resolver in `resolvers.ts`'s `Event` type-resolver map: reads the caller's `hidePastEventsAfterDays` (via `getOrCreateUserSettings`, same as `Query.events` already does) and re-derives the identical past-event predicate used in Task 1's `isPastEvent` fragment, scoped to `parent.id`. Anonymous callers (no `requireAuth`) resolve to `false` (mirrors `isHiddenForCurrentUser`'s try/catch-to-`false` pattern) — Archive is always an authenticated view so this only matters for defensive correctness, not a real Archive-page code path.
  - [ ] `Event.deletedAt` needs no new field resolver — it is a plain column, `buildOptimizedDrizzleSelect` already derives any requested plain column generically (per Story 4.7's Dev Notes confirming this same fact).
  - [ ] `Event.isHiddenForCurrentUser` needs no changes — reuse as-is for the "hidden by me" reason.

- [ ] **Task 3: Backend — owner-scoped bypass on `Query.event`/`Query.eventBySlug` (AC4)** — `apps/backend`
  - [ ] In `apps/backend/src/schema/events.graphql`, add `includeMyArchived: Boolean` to both `Query.event(id: ID!)` and `Query.eventBySlug(slug: String!)`.
  - [ ] In `resolvers.ts`, both resolvers (~line 1521-1551) currently do `.where(and(eq(events.id, id), activeOnly(events)))` / `.where(and(eq(events.slug, slug), activeOnly(events)))` unconditionally. When `includeMyArchived === true`: call `requireAuth(context)`, then replace the unconditional `activeOnly(events)` clause with `or(activeOnly(events), and(isNotNull(events.deletedAt), <personal-connection-to-this-specific-event EXISTS check>))` — i.e., the row is returned if it's active as normal, OR it's soft-deleted **and** the caller has a personal connection to that exact `event.id`/`event.slug` (favorited, calendar-added, subscribed-source, or has reported it — reuse the same four EXISTS shapes as Task 1, scoped to the single resolved event id rather than a set). Do not widen this to "any authenticated caller can view any soft-deleted event" — the personal-connection check is mandatory whenever `deletedAt IS NOT NULL`.
  - [ ] No change to the past-event or self-report behavior of these two resolvers — they remain intentionally unfiltered by those two rules (Story 2.7 AC8, Story 4.3c AC2), so `includeMyArchived` only ever needs to affect the moderator-soft-delete branch here.
  - [ ] Integration tests: soft-deleted event, owner (favorited) with `includeMyArchived: true` → returned; same event, a different authenticated user (no personal connection) with `includeMyArchived: true` → `null`/not found; same event, owner without the flag (`includeMyArchived` omitted/false) → `null` (unchanged existing behavior); active (non-soft-deleted) event, any caller, flag on or off → returned as normal (regression).

- [ ] **Task 4: Frontend — `packages/ui` `EventCard`/`EventListView` "why hidden" badge slot (AC2, AC3)** — `packages/ui`
  - [ ] Extend `StatusBadge`'s `variant` union (`packages/ui/src/core/status-badge.tsx`) with three new values: `'expired'`, `'removedByModeration'`, `'hiddenByMe'` — each a new `case` in the existing `switch`, with a visually distinct Tailwind class following the established `active`/`invalid`/`pending` pattern (e.g. `expired` → muted/slate; `removedByModeration` → red, matching `invalid`'s severity; `hiddenByMe` → amber/neutral, matching `pending`'s "self-initiated, not urgent" tone — final color choice at implementer's discretion within the existing palette, this is a cosmetic detail with no behavioral impact).
  - [ ] Add `statusBadge?: ReactNode` to `EventCardProps` (`packages/ui/src/features/events/EventCard.types.ts`) — a small, additive, generic slot (not report/archive-specific), consistent with `EventCardProps`'s existing optional-prop style.
  - [ ] In `EventCard.tsx`, render `statusBadge` (if provided) as an absolutely-positioned badge in the top-right corner of the image container (`packages/ui/src/features/events/EventCard.tsx:154`, the `relative h-48 w-full` div) — e.g. `<div className="absolute top-2 right-2 z-10">{statusBadge}</div>` — additive, does not alter existing layout/tests for cards that don't pass it.
  - [ ] Update `EventCard.test.tsx`/`EventListView` snapshot or interaction tests as needed for the new optional prop (regression-safe: prop is optional and additive).

- [ ] **Task 5: Frontend — Archive page (AC1, AC3, AC5, AC6, AC7)** — `apps/web`
  - [ ] `apps/web/src/features/events/queries.graphql`: add a `getArchivedEvents($limit: Int, $offset: Int)` query requesting `events(limit: $limit, offset: $offset, includeMyArchived: true) { items { id slug eventName imageUrl location categories types schedules { isMainSchedule eventStartDate ticketPrice } deletedAt isHiddenForCurrentUser isExpiredForCurrentUser } hasMore totalCount }` — no `query:` argument passed (AC3: no search/filter surface), matching `getEventsForMyCalendar`'s shape for an argument-light list query.
  - [ ] `apps/web/src/app/[locale]/archive/page.tsx`: Server Component following the `favorites/page.tsx` pattern exactly — `generateMetadata` via `getTranslations({ namespace: 'Metadata' })` reading new `archiveTitle`/`archiveDescription` keys and `buildPageMetadata`, wrapping `<ArchiveContent />` in `<Suspense fallback={<RouteLoader />}>`.
  - [ ] `apps/web/src/app/[locale]/archive/archive-content.tsx`: Client Component modeled directly on `favorites-content.tsx`'s structure but simplified (no `EventDiscoveryPanel` filter/search UI per AC3 — a plain `EventListView` is sufficient; no `nuqs` query-state needed since there is no filterable/shareable state): unauthenticated → redirect to `/login` (mirrors `favorites-content.tsx:142-146`); paginated via `useInfiniteQuery` + `useInfiniteScroll` calling `getArchivedEvents`; `getCardProps` maps each item's `deletedAt`/`isHiddenForCurrentUser`/`isExpiredForCurrentUser` to exactly one `statusBadge` (priority order when more than one is true, e.g. a soft-deleted event that's also past its date: moderation-removed > hidden-by-me > expired, since moderation is the most authoritative/severe reason) using the new `StatusBadge` variants from Task 4, `onClick` navigating to `/events/${event.slug}` (Task 3's backend change makes this resolve correctly for the owner); no favorite-toggle/pending-removal affordance (Archive cards are read-only per AC5 — omit `onFavoriteToggle`).
  - [ ] Empty state: single centered muted-text message (no "no results for your search" variant needed, per AC3/Freya's Gate 2 finding) — new `ArchivePage.emptyState` key.
  - [ ] Error state: reuse `EventListView`'s built-in `errorMessage`/`errorDetail`, matching `favorites-content.tsx`'s pattern exactly.
  - [ ] PostHog analytics (AD-5): capture `archive_page_viewed` once per successful load, payload `{ archivedCount: number }` — mirrors `favorites_page_viewed`'s existing shape/dedup-via-ref pattern (`favorites-content.tsx:183-198`).

- [ ] **Task 6: Frontend — user menu entry (AC1)** — `packages/ui`, `apps/web`
  - [ ] `packages/ui/src/core/app-shell/profile-menu-entries.ts`: add `{ id: 'archive', labelKey: 'archive', href: '/archive', icon: Archive }` (import `Archive` from `lucide-react`), positioned directly after the existing `reports` entry and before the moderator-only divider/entry — grouping it with the other personal-data pages.
  - [ ] `apps/web/locales/en.json`/`id.json`: add `"archive": "Archive"` (localized equivalent for `id.json`) to the `UserMenu` namespace; add a new `ArchivePage` namespace mirroring `FavoritesPage`'s key shape minus the search-related keys (`title`, `errorState`, `emptyState`, `loadingMore`); add `archiveTitle`/`archiveDescription` to the `Metadata` namespace, matching `favoritesTitle`/`favoritesDescription`'s pattern.

- [ ] **Task 7: Testing (AC1-AC7)**
  - [ ] `apps/backend/src/schema/resolvers.test.ts`: new test block `'events - includeMyArchived opt-in bypass (Story 4.8)'` — unauthenticated caller with `includeMyArchived: true` → `UNAUTHENTICATED`; authenticated caller, favorited-but-not-hidden event → excluded (fails the "hidden by ≥1 rule" condition); authenticated caller, past-and-favorited event → included with `isExpiredForCurrentUser: true`; soft-deleted-and-calendar-added event → included with `deletedAt` set; self-reported-and-subscribed-sourced event → included with `isHiddenForCurrentUser: true`; a hidden event with **no** personal connection (not favorited/calendar-added/subscribed) → excluded (proves the mandatory personal-connection AND, closing the "arbitrary hidden-event browsing" gap AC1 forbids); a different user's hidden-and-favorited event → excluded for the calling user (per-caller correlation, not global); composition with Story 2.7/4.3c's normal (non-bypassed) `events()` call is unaffected (regression).
  - [ ] `apps/backend/src/schema/resolvers.test.ts`: new block for Task 3's `event(id)`/`eventBySlug` `includeMyArchived` bypass — cases listed in Task 3.
  - [ ] `packages/ui`: `StatusBadge.test.tsx` — three new variants render distinct, correctly-labeled output. `EventCard.test.tsx` — `statusBadge` slot renders when provided, absent when omitted (regression).
  - [ ] `apps/web`: `archive-content.test.tsx` (Vitest + msw, mirroring `favorites-content.test.tsx`) — unauthenticated redirect; loading/empty/error/success states; infinite scroll page-2 fetch; each of the three "why hidden" badges renders for its respective mock event; card click navigates to the event's detail route.
  - [ ] Playwright E2E (critical-path only, per the testing-trophy philosophy): log in as a user with a seeded soft-deleted-but-favorited event, navigate to `/archive` from the user menu, confirm the event renders with the "removed by moderation" badge, click it, confirm the detail page loads (not a 404) — proving Task 3's owner-scoped bypass works end-to-end, not just at the resolver level.

## Dev Notes

### Architecture & UX Gate Findings

`_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md` (`swept: true`, 2026-08-11 re-sweep) explicitly lists Story 4.8 in `stories_covered` and found **no Gate 1/Gate 3 gap** at the epics.md-AC level: "It needs a resolver-level, owner-scoped bypass of the default visibility rule-list ... combined with a favorited/calendar-added/subscribed-sourced OR condition, on the one existing events resolver ... Story 4.8 follows the [Story 3.7 `isFromSubscribedAccount`] precedent: no split, build it in 4.8's own scope when created." Per the swept-epic protocol, Gate 1/Gate 3 subagent calls were skipped for this story and only Gate 2 was run fresh, plus a lightweight guard for anything the epic-wide sweep (which ran before any Story 4.8 code existed) could not have anticipated.

- **Gate 2 (UI Complexity & Reusability), run fresh via Freya-persona subagent: No gap found — build in-story.** Archive is a single new consumer of already-built, already-multi-consumer components (`EventListView` + `useInfiniteScroll` + `EventCard`, both used by ≥2 existing pages) — matching the Story 2.2/Story 3.7 "empty/loading/error states built fresh in-story" precedent this project already established for pages with no UX artifact. The only new UI surface is a small additive `StatusBadge` variant extension (Story 4.7 already set direct precedent for extending `StatusBadge` in-line inside a feature story) and one additive `EventCardProps.statusBadge` slot — neither rises to Gate 2's "≥2-consumer component with net-new complexity" split bar.
- **Lightweight guard (this story's own creation), which surfaced two real implementation-level gaps the epic-wide sweep could not have anticipated (it evaluated epics.md's AC text before any Story 4.8/4.3c code existed):**
  1. **AC1(a)'s premise gap — already resolved by a separate, already-in-flight story, not fixed here.** Direct code read of `Query.events` (`resolvers.ts:1322-1450`) confirmed that, as of this story's creation, Story 4.3a's `isHiddenForCurrentUser` computation was never wired into `Query.events`'s default filtering — it only affected the single-event detail view (`EventDetailWrapper.tsx`), meaning a self-reported event still appeared in Feed/Discovery/Favorites/My Calendar by default, contradicting AC1(a)'s literal premise that this exclusion already exists to "bypass" from. **This is a pre-existing gap, not introduced by 4.8, and has already been surfaced and split into its own story via `bmad-correct-course` before this story's drafting completed: Story 4.3c ("Extend default event-visibility rules to exclude self-reported events from list views", `sprint-change-proposal-2026-08-12.md`, commit `ff277ee`).** Story 4.8 does not re-implement this fix; it depends on Story 4.3c (added to `epics.md`'s Story 4.8 "Depends on" line) and reuses 4.3c's `isReportedByCurrentUser` `fieldMap` entry (Task 1) rather than duplicating it. **As of this story's creation, Story 4.3c is `in-progress`, not yet implemented in code** (`packages/database/schema.ts`'s `reportStatusEnum`/`Query.events`'s `fieldMap` confirmed via direct read to not yet contain 4.3c's changes) — see the Pre-Coding Approval Gate item gating actual coding on 4.3c reaching a real, tested implementation, mirroring the precedent set by Story 4.4/4.4a and Story 4.7/4.3a (proceed with story creation now, gate coding via the approval checklist, not delay creation).
  2. **A second, distinct gap: `Query.event(id)`/`Query.eventBySlug(slug)` unconditionally exclude soft-deleted events for everyone, with no bypass of any kind** (unlike `Query.events`, which at least has the moderator-only `includeSoftDeleted`) — confirmed by direct read of `resolvers.ts:1521-1551`. Consequence: an Archive card for a moderator-removed event would 404 on click, even for the owner, since nothing today lets an authenticated non-moderator view a soft-deleted event's details. **User confirmed via `AskUserQuestion` to fix this in-story** (Task 3) with a strictly owner-scoped, per-row-verified bypass — never a blanket "any authenticated caller sees any soft-deleted event." This was independently corroborated by the Freya-persona Gate 2 subagent (flagged as a Gate-1-adjacent concern while reviewing the page's click-through UX) and confirmed via a fresh Winston-persona Gate 1 subagent review (sketching the exact safe-bypass shape Task 3 implements).
- **Design tradeoff resolved with the user via `AskUserQuestion` (three questions, before drafting):** (1) the 4.3c gap → confirmed already split into its own story, not duplicated here (see above); (2) the `event`/`eventBySlug` detail-link gap → fix in-story (Task 3); (3) whether to add an "un-hide"/"withdraw report" action for the "hidden by me" reason (Freya's Gate 2 recommendation) → **deferred to post-MVP**, user's explicit instruction — Archive ships read-only for all three reasons in this story (AC5, Out of Scope).

### Story 4.3c Dependency

Story 4.8 depends on Story 4.3c for AC1(a) to be behaviorally meaningful (the "hidden by me" bucket must actually be excluded by default somewhere for the Archive page's "opt-in bypass" framing to make sense). Story 4.3c's own Dev Notes document its `isReportedByCurrentUser` `fieldMap` entry shape exactly — Task 1 above reuses that exact field name/shape rather than inventing a parallel one. If, at implementation time, Story 4.3c has already shipped, Task 1's `isReportedByCurrentUser` sub-step is a no-op (reuse only); if it has not yet shipped, do not silently start 4.8's coding — see Pre-Coding Approval Gate.

### `isPastEvent`/Threshold Correctness

Task 1's `isPastEvent` fragment and Task 2's `Event.isExpiredForCurrentUser` field resolver must both derive from the *exact* same `hidePastEventsAfterDays`-threshold logic Story 2.7 already established (`packages/domain/src/events/buildDefaultEventVisibilityConditions.ts`'s `overlaps` semantics, `resolvers.ts:1349-1355`) — negated. Do not reimplement date-threshold math independently in either place; both must produce results consistent with what `Query.events`'s *default* (non-bypassed) path would have excluded, or the Archive page's contents and its "why hidden: expired" badge could disagree with what a user would see if they toggled the bypass off.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no schema/column mismatch found.** This story adds no new table, column, or enum to `packages/database/schema.ts`. All data read (`events.deletedAt`, `reports.reporterUserId`/`reports.eventId`, `favorites`, `calendarAdditions`, `subscriptions`, `schedules.eventStartDate`/`eventEndDate`) already exists from Stories 1.1/2.1a/2.4a/3.1a/4.3a/4.4a.
- **Impacted contracts:** `apps/backend/src/schema/events.graphql` (`Query.events`/`Query.event`/`Query.eventBySlug` gain `includeMyArchived: Boolean`; `Event` gains `deletedAt: String` if not already present via Story 4.7, and `isExpiredForCurrentUser: Boolean!`); `apps/backend/src/schema/resolvers.ts` (new `fieldMap` entries, new field resolver, two resolver branches extended); `packages/ui/src/features/events/EventCard.types.ts` (`statusBadge?: ReactNode`, additive); `packages/ui/src/core/status-badge.tsx` (three additive variants); `apps/web/src/features/events/queries.graphql` (new `getArchivedEvents` query); `apps/web/src/generated/graphql.ts` (codegen regeneration, both `apps/backend` and `apps/web` sides, per the new/changed SDL).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** `apps/backend/src/generated/resolvers-types.ts` regenerated via `codegen` to pick up the new arguments/fields — no manual edits. `apps/web/src/generated/graphql.ts` regenerated to pick up `getArchivedEvents` and the new `Event` fields.
- **Backward compatibility and rollout notes:** Purely additive at the schema level — `includeMyArchived` defaults to falsy/omitted everywhere except the new Archive page, so every existing `Query.events`/`Query.event`/`Query.eventBySlug` caller is unaffected. `Event.isExpiredForCurrentUser`/`Event.deletedAt` are new fields; existing queries that don't request them are unaffected.
- **Verification checks:** Task 7's integration tests covering the full opt-in-bypass matrix (per-caller correlation, mandatory personal-connection AND, mandatory hidden-by-≥1-rule OR, anonymous rejection) for both the plural and singular resolvers; Task 7's E2E proving the click-through-to-detail path actually resolves for an owner viewing a soft-deleted archived item.

### Project Structure Notes

- **New:** `apps/web/src/app/[locale]/archive/page.tsx`, `apps/web/src/app/[locale]/archive/archive-content.tsx`, `apps/web/src/app/[locale]/archive/archive-content.test.tsx`.
- **Modified:** `apps/backend/src/schema/events.graphql`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/resolvers.test.ts`; `packages/ui/src/core/status-badge.tsx` (+ test); `packages/ui/src/features/events/EventCard.types.ts`; `packages/ui/src/features/events/EventCard.tsx` (+ test); `apps/web/src/features/events/queries.graphql`; `packages/ui/src/core/app-shell/profile-menu-entries.ts`; `apps/web/locales/en.json`/`id.json`; `apps/web/src/generated/graphql.ts` / `apps/backend/src/generated/resolvers-types.ts` (codegen, both sides).
- No conflicts detected with the unified project structure — follows the `favorites/` route-folder precedent exactly (`page.tsx` + `*-content.tsx` split for the `generateMetadata`/Server-Component vs. `"use client"` boundary, per `project-context.md`'s Dynamic Page Title & Meta Tags rule).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.8`] — canonical AC/Note source, including the 2026-08-12 amendment adding Story 4.3c as a dependency.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept epic-4 report; Story 4.8 explicitly in `stories_covered`, no Gate 1/3 gap, `isFromSubscribedAccount`/Story 3.7 precedent this story's `includeMyArchived` bypass design follows.
- [Source: `_bmad-output/implementation-artifacts/4-3c-extend-default-event-visibility-rules-to-exclude-self-reported-events-from-list-views.md`] — the `isReportedByCurrentUser` `fieldMap` shape this story's Task 1 reuses; confirms (its own References section) `Query.event`/`eventBySlug` are deliberately left unfiltered by the past-event/self-report rules, the exact fact Task 3/AC4 build on.
- [Source: `apps/backend/src/schema/resolvers.ts:1322-1450` (`Query.events`), `:1521-1551` (`Query.event`/`eventBySlug`), `:1627-1637` (`Event.isHiddenForCurrentUser`)] — confirmed by direct read: no personal-report filtering in the default `events` path pre-4.3c; unconditional `activeOnly(events)` on the two singular lookups with zero bypass; the `isFavorited`/`isAddedToCalendar`/`isFromSubscribedAccount`/`isHiddenForCurrentUser` patterns this story's new fields/fragments mirror.
- [Source: `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts`] — the exact past-event threshold logic Task 1's `isPastEvent`/Task 2's `isExpiredForCurrentUser` must negate consistently.
- [Source: `packages/graphql-select/drizzle-where.ts:80-96`] — the `overlaps` operator's exact `daterange(...) && daterange(...)` SQL shape this story's negated `isPastEvent` fragment must mirror precisely to avoid a threshold-semantics drift.
- [Source: `apps/web/src/app/[locale]/favorites/favorites-content.tsx`, `favorites/page.tsx`] — the list/infinite-scroll/card page pattern (AC3) and unauthenticated-redirect pattern (AC6) this story's Archive page follows structurally.
- [Source: `packages/ui/src/core/status-badge.tsx`; `apps/web/src/app/[locale]/reports/report-list-item.tsx:109`] — the `StatusBadge` component and its existing consumption pattern this story's three new variants extend.
- [Source: `packages/ui/src/features/events/EventCard.tsx:154,186-205`; `EventCard.types.ts`; `EventListView.types.ts`] — the image-container placement point and `getCardProps: (event) => Partial<EventCardProps>` plumbing Task 4/5's `statusBadge` slot integrates through.
- [Source: `packages/ui/src/core/app-shell/profile-menu-entries.ts`; `UserMenu.tsx:74-79`] — the user-menu entry list and role-based filtering (unused for this entry, no `requiresModerator`/`requiresApiKey`) this story's new `archive` entry follows.
- [Source: Gate 2 subagent findings (Freya persona, run fresh this story) and Gate 1 subagent findings (Winston persona, run fresh due to the two lightweight-guard gaps above)] — informed Tasks 1/3/4/5's exact design; both independently confirmed the `event`/`eventBySlug` detail-link gap.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API & Data (GraphQL-only, `Query.events`/`Query.event`/`Query.eventBySlug` extended, no new endpoint per AD-2); Database & Performance (Drizzle-only access, no migration, no over-fetching — `buildOptimizedDrizzleSelect` reused as-is); Security (`includeMyArchived` requires `requireAuth`, never trusts client-supplied personal-connection claims — server-forced conditions); UI Patterns & UX Invariants (List Navigation — infinite scroll reused; Context-Aware Detail Views — Task 3 makes archived-item detail links actually work; Locale-Sensitive Data Rendering — dates/enum labels/reason badges all localized); State Management Architecture (Server State via React Query + `graphql-request`, no URL/Client-Global state needed since AC3 has no filterable state); Code Quality & Style Rules (`packages/ui` component placement for the `StatusBadge`/`EventCard` changes).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1 (Unified Query DSL: new `fieldMap` boolean fragments follow the existing `eq`-against-precomputed-fragment idiom, no new `TerminalOperator`); AD-2 (Unified Event Querying: `includeMyArchived` extends the existing single `events`/`event`/`eventBySlug` endpoints, no new endpoint); AD-7 (identity/authorization: `requireAuth` reused, no hand-rolled role check); AD-8 (soft-delete convention: reads `events.deletedAt`/`activeOnly` as established by 4.4a, introduces no new soft-delete-bound table).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL resolver + frontend work only (no Lambda/SQS/EventBridge involvement), matching Story 4.3a/4.3c's identical precedent.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified (backend):** `apps/backend/src/schema/events.graphql` (`includeMyArchived` on 3 fields; `Event.deletedAt`-if-missing; `Event.isExpiredForCurrentUser`); `apps/backend/src/schema/resolvers.ts` (`Query.events`/`Query.event`/`Query.eventBySlug` extended; new `fieldMap` fragments; new `Event.isExpiredForCurrentUser` resolver); `apps/backend/src/schema/resolvers.test.ts`.
- **Modified (packages/ui):** `packages/ui/src/core/status-badge.tsx` (+ test); `packages/ui/src/features/events/EventCard.types.ts`; `packages/ui/src/features/events/EventCard.tsx` (+ test); `packages/ui/src/core/app-shell/profile-menu-entries.ts`.
- **New/Modified (apps/web):** new `apps/web/src/app/[locale]/archive/{page.tsx,archive-content.tsx,archive-content.test.tsx}`; modified `apps/web/src/features/events/queries.graphql`; modified `apps/web/locales/en.json`/`id.json`.
- **Regenerated:** `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (codegen, no manual edits).
- **Not modified:** `packages/database/schema.ts` (no migration); `packages/graphql-select/drizzle-where.ts`/`packages/domain/src/query/queryDsl.ts` (no new DSL operator); `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts` (Story 4.3c's own scope, not this story's — reused, not modified, here).

### Rule Mapping

- AD-1/AD-2 (Unified Query DSL / single event-querying endpoint) → Task 1's `fieldMap`-fragment reuse pattern, Task 1/3's argument-extension (not new-endpoint) approach → Dev Notes References.
- AD-7 (single enforcement surface) → `includeMyArchived`'s `requireAuth` gate (Tasks 1, 3), server-forced personal-connection conditions never trusting client input.
- AD-8 (soft-delete convention) → reads `events.deletedAt`/reuses `activeOnly(events)` as already established, no new bound table.
- "Leave the system working end-to-end, not just satisfy stated ACs" (this workflow's Step 2/3 mandate) → the two lightweight-guard findings (4.3c dependency correction; `event`/`eventBySlug` detail-link gap, Task 3) → Dev Notes "Architecture & UX Gate Findings".
- Story-split-gate discipline (Gate 1/3 cited from the swept `epic-4-readiness.md`; Gate 2 run fresh, no gap; one real design tradeoff — the unhide/withdraw-action deferral — resolved via `AskUserQuestion`) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".
- `project-context.md` Locale-Sensitive Data Rendering / List Navigation / Context-Aware Detail Views → Task 5 (i18n keys, infinite scroll reuse, working detail-view click-through).

### Verification Plan

- `apps/backend`: `pnpm --filter backend codegen` regenerates cleanly against the extended `events.graphql`; `pnpm --filter backend test` — new integration blocks (Task 7) pass for both the plural and singular `includeMyArchived` bypasses, including the mandatory-AND/mandatory-OR safety-boundary cases; all existing `events`-resolver suites (Story 2.7, 4.3a, 4.3c, 4.4a, 1.3h) remain unmodified and passing.
- `apps/web`: `pnpm --filter web codegen` regenerates `getArchivedEvents`/new `Event` fields cleanly; `pnpm --filter web test` — `archive-content.test.tsx` passes (states, infinite scroll, badge rendering, redirect, detail-view click-through mock); `EventCard.test.tsx`/`StatusBadge.test.tsx` pass with the new additive prop/variants.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- Playwright E2E (Task 7's critical-path scenario): confirms Task 3's owner-scoped bypass actually resolves a real detail page for a real soft-deleted-and-favorited seeded event, not just a mocked assertion.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements the `includeMyArchived` opt-in bypass on `Query.events`/`Query.event`/`Query.eventBySlug` (`apps/backend`), the "why hidden" `Event` fields, the `StatusBadge`/`EventCard` additive extensions (`packages/ui`), and the new `/archive` page (`apps/web`). It does **not** implement Story 4.3c's default-visibility fix (a separate, already-split story) or any unhide/restore/withdraw action (deferred, see Out of Scope).
- [ ] Architecture and boundary confirmation: `includeMyArchived` reuses the existing `fieldMap`-fragment/`eq`-operator DSL idiom (no new `TerminalOperator`, no new endpoint) and the existing `requireAuth`/`requireModerator` authorization primitives — per Gate 1 (cited from swept `epic-4-readiness.md` for the epics.md-level shape; fresh Winston-persona review for the two lightweight-guard-surfaced gaps, both confirmed real and scoped as described above).
- [ ] Testing plan confirmation: `apps/backend`'s new test blocks cover the full per-caller-correlation / mandatory-AND-personal-connection / mandatory-OR-hidden-reason matrix for both the plural and singular resolvers (Task 7), plus one Playwright E2E proving the archived-item detail-view click-through actually works end-to-end (not just resolver-level).
- [ ] **Story 4.3c dependency confirmed done or gap explicitly accepted:** as of this story's creation, Story 4.3c is `in-progress` (not yet implemented in code — confirmed via direct read of `packages/database/schema.ts`/`resolvers.ts` showing no `isReportedByCurrentUser` `fieldMap` entry yet). Do not begin Task 1's `isReportedByCurrentUser` reuse step until 4.3c has shipped and its exact `fieldMap` entry exists to reuse (or, if the user explicitly accepts building 4.3c's equivalent fragment redundantly/early inside this story instead of waiting, record that decision here before coding starts).
- [ ] **Story 4.7's `Event.deletedAt` schema addition checked for collision:** Story 4.7 (`ready-for-dev` as of this story's creation) also plans to add `Event.deletedAt: String` to `events.graphql`. Before Task 2, check whether 4.7 has already shipped this field; if so, do not re-declare it — only add `Event.isExpiredForCurrentUser`.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] Backend integration tests (Vitest, `apps/backend`): full `includeMyArchived` matrix for `Query.events` (Task 7) and for `Query.event`/`Query.eventBySlug` (Task 3/7), including the anonymous-rejection, per-caller-correlation, mandatory-AND, and mandatory-OR safety-boundary cases.
- [ ] Frontend integration tests (Vitest + msw, `apps/web`): `archive-content.test.tsx` — unauthenticated redirect, loading/empty/error/success states, infinite scroll, each of the three "why hidden" badges, card-click navigation.
- [ ] `packages/ui` unit/component tests: `StatusBadge.test.tsx` (three new variants), `EventCard.test.tsx` (new optional `statusBadge` slot, regression for cards without it).
- [ ] E2E (Playwright, critical path only): log in, navigate to `/archive` via the user menu, see a seeded soft-deleted-and-favorited event with the correct badge, click it, confirm the detail page loads successfully (proves Task 3's bypass end-to-end).

## Deliverables Checklist

- [ ] `apps/backend/src/schema/events.graphql`: `includeMyArchived: Boolean` added to `Query.events`/`Query.event`/`Query.eventBySlug`; `Event.isExpiredForCurrentUser: Boolean!` added; `Event.deletedAt: String` present (added here or already present via Story 4.7).
- [ ] `apps/backend/src/schema/resolvers.ts`: all three resolvers extended per Tasks 1/3; new `fieldMap` fragments (`isPastEvent`, `isHiddenByModeration`, `isReportedByCurrentUser`-reused-or-added) and `Event.isExpiredForCurrentUser` field resolver implemented and integration-tested.
- [ ] `packages/ui/src/core/status-badge.tsx`: `expired`/`removedByModeration`/`hiddenByMe` variants added.
- [ ] `packages/ui/src/features/events/EventCard.{types.ts,tsx}`: `statusBadge` slot added.
- [ ] `packages/ui/src/core/app-shell/profile-menu-entries.ts`: `archive` entry added.
- [ ] `apps/web/src/app/[locale]/archive/{page.tsx,archive-content.tsx}`: new Archive page shipped, reusing `EventListView`/`useInfiniteScroll`.
- [ ] `apps/web/src/features/events/queries.graphql`: `getArchivedEvents` query added.
- [ ] `apps/web/locales/en.json`/`id.json`: `UserMenu.archive`, `ArchivePage.*`, `Metadata.archiveTitle`/`archiveDescription` keys added.
- [ ] Full test suite (Task 7) green; codegen regenerated on both `apps/backend` and `apps/web`.

## Out of Scope

- Story 4.3c's own implementation (the default-visibility self-report exclusion fix) — a separate, already-existing story this story depends on, not duplicated here.
- Any unhide/restore/withdraw action for any of the three hide reasons, including "hidden by me" (reversing a personal report) — **explicitly deferred to post-MVP per the user's decision during this story's creation.** Archive ships strictly read-only in this story (AC5). A future story would need: a new mutation scoped to the reporter's own personal-reason reports (not `cancelled`/`dangerous`, which carry moderator audit value), plus corresponding UI.
- Any search/filter surface on the Archive page (AC3) — a fixed, personal-connection query only.
- Any change to the "Moderator Items" page, `resolveReportsForEvent`, or any other Story 4.7 scope.
- Exposing `includeMyArchived`, `isPastEvent`, `isHiddenByModeration`, or `isReportedByCurrentUser` as documented/client-queryable DSL fields beyond the specific new arguments/fields this story adds — they remain server-composed-only or the specific new schema additions listed in Deliverables, consistent with Story 4.3c's identical precedent for `isReportedByCurrentUser`.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] Backend integration tests, `packages/ui` component tests, frontend integration tests, and the E2E critical-path test all passing, per Testing Requirements.
- [ ] Lint and type checks passing for `apps/backend`, `packages/ui`, and `apps/web`.
- [ ] No regression in existing `events`-resolver test suites (Story 2.7, 4.3a, 4.3c, 4.4a, 1.3h) or existing `EventCard`/`StatusBadge` tests.
- [ ] Codegen regenerated and committed on both `apps/backend` and `apps/web`.

## Completion Status

- [x] Done

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
