# Story 3.7c: Event-list image display — hotlink-only with graceful degrade and opted-in prominent card

## Story Details

- Epic: 3
- Story ID: 3.7c
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user browsing the event list/grid,
I want an account's private profile photo to never surface on an event card, regardless of that account's image-storage opt-in state,
so that opting into richer image display never becomes a backdoor for exposing personal profile imagery FestDaily was never meant to display on a card.

**Scope note (see Amendment below):** `epics.md`'s original Story 3.7c also specified the hotlink-default-state rendering and graceful-degrade fallback mechanics (its AC1/AC2). Those are **not** built by this story — they are independently and more thoroughly owned by Epic 1.i1's Stories 1.i1a/1.i1c/1.i1e (see Dev Notes). This story implements only what nothing else covers: the `profileImageUrl` guard (epics.md AC4) and a regression check that the already-shipped opted-in prominent card (epics.md AC3, Story 1.3b AC17) survives Epic 1.i1's changes intact.

## Acceptance Criteria

1. **[epics.md AC4]** `SocialMediaAccountProfile.profileImageUrl` is never queried, passed, or rendered by any event-list/grid surface — the masonry `EventCard` variant (Discovery/Feed/Favorites/Archive/Account pages, all routed through the shared `EventListView`) or the standard `EventCard` variant — for any account, opted-in or not (PRD §4.5/§3.16, unconditional). This must be enforced by an automated regression test, not left as an unenforced current-state fact.
2. **[epics.md AC4, cont.]** On the one page where an account's `profileImageUrl` and its events coexist in the same component scope (`apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` — the account's own profile header already reads `profile.profileImageUrl` for its `AccountAvatar`), no event card rendered on that page ever receives that same value as an image-slot prop, even though nothing in the code today wires them together.
3. **[epics.md AC3, regression]** After Stories 1.i1a/1.i1c/1.i1e ship, the already-shipped opted-in "prominent card" treatment (Story 1.3b AC17: `prominentPoster=true` → enlarged `aspect-[2/3]` full-width poster, `EventListView`'s `prominentPoster: event.durableImageUrl != null` derivation) continues to render exactly as it does today — verified by `EventCard.test.tsx`'s existing "Prominent poster (masonry, AC17)" suite continuing to pass with its assertions unmodified.

## Tasks / Subtasks

- [ ] **Task 1 (AC1) — Lock the GraphQL query layer against ever requesting a profile image on a list surface:**
  - [ ] Create `apps/web/src/features/events/queries.graphql.test.ts`. Using the `graphql` package's `parse()` (already a direct dependency of `apps/web`, used by the codegen pipeline — no new dependency needed) on the raw text of `queries.graphql`, extract the `getEvents`, `getEventsForCalendar`, `getEventsForMyCalendar`, and `getArchivedEvents` operation definitions (the four list-view queries that feed `EventListView`/masonry cards — confirmed by reading `EventListView.tsx`'s consumers).
  - [ ] Recursively walk each operation's `SelectionSet` and assert that no selection is named `sourceSocialMediaAccountProfile` (the only field path `profileImageUrl` can be nested under, confirmed via `mapper.ts`'s `accountPlatformIconUrl: event.sourceSocialMediaAccountProfile?.profileImageUrl` mapping, which reads from the separate `getEventBySlug` detail query, not any list query) or `profileImageUrl` directly.
  - [ ] Deliberately exclude `getEventBySlug` from this test — it is the event-*detail* query (Story 3.7d's page), out of this story's "list/grid" scope per the user story above, and already legitimately selects `sourceSocialMediaAccountProfile.profileImageUrl` for account-attribution display there.
  - [ ] Add a one-line comment above the four covered operations in `queries.graphql` itself, pointing at this test, so a future editor adding a field to one of them sees why it might fail.

- [ ] **Task 2 (AC2) — Add the behavioral regression test at the one real-risk call site:**
  - [ ] In `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.test.tsx`, extend the existing `profileImageUrl: 'http://test.com/avatar.png'` fixture's test coverage (or add a new `it(...)` alongside "displays the list of events sourced from the account") to assert: after the event list renders, query all rendered `<img>` elements and confirm none has `src="http://test.com/avatar.png"` — i.e. the profile avatar's URL appears exactly once (inside the `AccountAvatar` header), never inside any `EventCard`'s image slot.
  - [ ] Use event fixture `imageUrl`/`durableImageUrl` values that are deliberately distinct from the profile-image sentinel, so the assertion is a real proof, not a coincidence of matching test data.

- [ ] **Task 3 (AC3) — Verification-only, no new code expected:** Once Stories 1.i1a/1.i1c/1.i1e are implemented, run `packages/ui`'s `EventCard.test.tsx` "Prominent poster (masonry, AC17)" describe block (`uses the enlarged aspect-[2/3] poster treatment when prominentPoster is true` / `keeps the default aspect-[3/4] poster treatment when prominentPoster is false/omitted`) and confirm both still pass with their existing assertions unchanged. If either needs to change, that is a signal 1.i1e regressed the already-shipped AC17 behavior — raise it against that story rather than editing this test to match new behavior. Record the outcome in this story's Completion Notes.

- [ ] **Task 4 — Full verification:** `pnpm --filter @festgrid/ui test` (Task 3); `pnpm --filter web test` (Tasks 1-2); `pnpm build`, `pnpm lint`, `pnpm test` at the repo root.

## Dev Notes

- **This story is frontend-test-only.** No production code path changes — `EventCardProps` has no `profileImageUrl` field today (confirmed by reading `EventCard.types.ts` in full) and no list query selects it (confirmed by reading `queries.graphql` in full), so AC1/AC2 are already true; this story's job is to make that fact regression-proof rather than an unenforced accident. AC3 is a citation/verification of behavior owned entirely by other stories' code.
- **Why the query-level guard (Task 1) is the effective enforcement point, not a runtime prop check:** GraphQL Code Generator (already established, project-context.md) derives `apps/web/src/generated/graphql.ts`'s `GetEventsQuery` item type directly from `queries.graphql`'s selection set. If `sourceSocialMediaAccountProfile` is never selected there, the generated type has no such field at all — so `EventListView.tsx` or any page's `getCardProps` callback referencing `event.sourceSocialMediaAccountProfile.profileImageUrl` would fail to compile. Locking the query is therefore a stronger, earlier guard than a runtime assertion inside `EventCard`/`EventListView` would be, and needs no change to either component.
- **`account-content.tsx` is the one genuine risk surface**, not a theoretical one: it is the only page among the five `EventListView` consumers (Discovery/`home-content.tsx`, Feed, Favorites, Archive, Account) where `profile.profileImageUrl` is already fetched and in scope in the same component (for its own `AccountAvatar` header, unrelated and correct) alongside the event list's `getCardProps` callback. The other four pages never fetch a profile image at all, so they carry no equivalent risk today. Read `account-content.tsx` in full — confirmed its current `getCardProps` only returns `isFavorited`/`favoriteCount`/`onFavoriteToggle`, no image field.

### Amendment (2026-09-12, scope narrowed during this story's own creation)

`epics.md`'s Story 3.7c originally specified four ACs (hotlink-default-state rendering, graceful-degrade fallback, opted-in prominent card, and the `profileImageUrl` guard), with its visual specifics deferred to "reference mockups the product owner would provide later." Those mockups arrived and were fully tokenized by a 2026-09-11 `bmad-ux` pass (`DESIGN.md`/`EXPERIENCE.md`, see References) — but that same day, `bmad-form-epics` independently turned the same findings (`FIND-023`, `IDEA-017`) into `Epic 1.i1`'s Stories 1.i1a/1.i1c/1.i1e, which fully re-specify the hotlink-default-state and graceful-degrade mechanics (this story's original AC1/AC2) via a shared `event_card_*` primitive with its own ratchet test (1.i1z), without cross-referencing this still-undrafted 3-7c. Read `packages/ui/src/features/events/EventCard.tsx` in full and confirmed neither the new default-state layout (date box beside a thumbnail) nor the new fallback treatment exists yet — both plans are unimplemented, so this is a live sequencing decision, not a stale doc.

Presented to the user via `AskUserQuestion` with three options (narrow-and-depend / keep-self-contained-and-accept-duplication / mark-superseded-and-cancel). **User chose: narrow 3.7c and depend on Epic 1.i1.** This story's scope above reflects that choice — see `epics.md`'s own Amendment to Story 3.7c for the epics-level record of this same decision.

### Architecture & UX Gate Findings

- **Epic-level sweep status:** `epic-readiness/epic-3-readiness.md` (`swept: true`, re-swept 2026-09-11) explicitly covers `3-7c` in `stories_covered` and found **no Gate 1 or Gate 3 gap** anywhere in Epic 3 (verified: "every DB write/read goes through `apps/backend` GraphQL resolvers... every mutation/query has a backing resolver"). Per `story-split-gate.md`'s epic-level-sweep-mode, Gate 1/3 are cited from that report rather than re-run.
  - **Lightweight guard (non-subagent check):** this story's narrowed scope (a query-shape regression test + one component-level rendering assertion) introduces no new external service, no new data entity, and no new infra dependency the epic-wide sweep wouldn't have anticipated — the sweep's verdict stands unmodified for this story.
- **Gate 2 (UI Complexity & Reusability) — run fresh via `runSubagent`, Freya-lens persona (per-story regardless of sweep status):** **No gap found.** The narrowed scope builds zero components, hooks, or utils — it is a regression test asserting an absence, not new behavior. The actual reusable `event_card_*` primitive is correctly owned by Epic 1.i1, which this story depends on rather than duplicates. Checked `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`: `profileImageUrl`-as-avatar is spec'd exactly once, for Story 5.1's unrelated post-selection account-tab pills (`EXPERIENCE.md` ~L163) — not as part of any event-card composition — so there is no missing or conflicting visual spec for this story's guard to reconcile.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story introduces no new database column, GraphQL field/type/query/mutation, or `packages/shared-types` change. `EventCardProps` (`packages/ui/src/features/events/EventCard.types.ts`) has no `profileImageUrl` field today and none is being added; the four list queries in `queries.graphql` do not select `sourceSocialMediaAccountProfile` today and this story locks that absence in rather than changing it.
- **Impacted fields/contracts:** None (test-only story).
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required — no `.graphql` schema edits, so no codegen regeneration is needed for this story.
- **Backward compatibility and rollout notes:** Purely additive (new test files/cases); no behavior change for any existing user. Sequencing note: Task 3's regression check is only meaningful after Stories 1.i1a/1.i1c/1.i1e ship — if this story is implemented first, Task 3 should still run against the current (pre-1.i1) `EventCard.test.tsx` state to confirm the baseline passes, and be re-run once 1.i1e lands as part of that story's own verification rather than blocking this story's own completion.
- **Verification checks:** Task 1's `queries.graphql.test.ts` (new); Task 2's extended `account-content.test.tsx` assertion; Task 3's citation of `EventCard.test.tsx`'s existing AC17 suite.

### Project Structure Notes

- **New:** `apps/web/src/features/events/queries.graphql.test.ts`.
- **Modified:** `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.test.tsx` (new assertion/test case); `apps/web/src/features/events/queries.graphql` (comment only, no field changes).
- **Not modified:** `packages/ui/src/features/events/EventCard.tsx`, `EventCard.types.ts`, `EventListView.tsx` (no production code change — the guard lives at the query layer and in tests); `packages/database/schema.ts`; any GraphQL schema file; `apps/backend/**`.
- No conflicts with the unified project structure — test files are colocated with the source they test, matching this codebase's existing convention (e.g. `EventCard.test.tsx` beside `EventCard.tsx`, `use-ai-filter.test.ts` beside `use-ai-filter.ts`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.7c] — this story's original AC list and its 2026-09-12 Amendment narrowing scope against Epic 1.i1.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1.i1] — Stories 1.i1a/1.i1b/1.i1c/1.i1d/1.i1e/1.i1z, the sibling epic this story now depends on for the hotlink/fallback mechanics.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — `swept: true`, 2026-09-11 re-sweep; `3-7c` listed in `stories_covered`; Gate 1/3 "no blocking layering gap found" verdict cited above.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate definitions, epic-level-sweep-mode, and numbering rule.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_date_box / event_card_masonry / event_card_favorite_count_badge_large] — the 2026-09-11 `bmad-ux` pass tokens that seeded both this story's original scope and Epic 1.i1's formation; read in full to confirm no `profileImageUrl` token exists in any event-card composition.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Masonry-EventCard / Calendar-Row-Card] — same pass's behavioral spec; confirmed the only `profileImageUrl`-as-avatar reference in the whole document is Story 5.1's unrelated post-selection tabs.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml — FIND-023, IDEA-016, IDEA-017] — the findings `bmad-form-epics` turned into Epic 1.i1; FIND-023's own note explicitly (and, per this story's Amendment, incompletely) anticipated folding into "the still-undrafted 3-7c story."
- [Source: packages/ui/src/features/events/EventCard.tsx, EventCard.types.ts, EventCard.test.tsx] — read in full; confirmed no `profileImageUrl` prop/reference exists, and confirmed the existing "Prominent poster (masonry, AC17)" test suite (L594-625) this story's Task 3 cites.
- [Source: packages/ui/src/features/events/EventListView.tsx] — read in full; confirmed all five consumer pages route through this one shared component and its `derivedProps`/`getCardProps` merge pattern.
- [Source: apps/web/src/features/events/queries.graphql] — read in full; confirmed `getEvents`/`getEventsForCalendar`/`getEventsForMyCalendar`/`getArchivedEvents` never select `sourceSocialMediaAccountProfile`, while `getEventBySlug` (detail query, out of scope) does.
- [Source: apps/web/src/features/events/mapper.ts] — confirmed `sourceSocialMediaAccountProfile.profileImageUrl` maps to `accountPlatformIconUrl` only for the event-*detail* view, not any list card.
- [Source: apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx, account-content.test.tsx] — read in full; confirmed this is the one page where `profile.profileImageUrl` and event `getCardProps` coexist in scope, confirmed the existing `profileImageUrl: 'http://test.com/avatar.png'` test fixture this story's Task 2 extends, and confirmed today's `getCardProps` callback carries no image field.
- [Source: apps/web/src/app/[locale]/home-content.tsx, favorites/favorites-content.tsx, feed/feed-content.tsx, archive/archive-content.tsx] — confirmed via `getCardProps` grep that none of these four pages fetches or references a profile image at all.
- [Source: packages/ui/src/features/events/EventImage.tsx] — read in full; confirmed this is a distinct, unrelated component (event-*detail* media display with video support), not the masonry/standard card's image handling, and out of this story's scope.
- [Source: _bmad-output/project-context.md#Technology-Stack, #Testing-Rules] — `graphql` package already a direct dependency (codegen pipeline) used by Task 1; "testing trophy" approach (integration tests) applies since this is `apps/web`, not `packages/domain`.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Testing Rules (testing-trophy approach for `apps/web`, no `packages/domain` code touched so the 100%-unit-coverage rule doesn't apply); Technology Stack (`graphql` package, GraphQL Code Generator type-safety cascade relied on by Task 1's guard).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD is touched or newly created by this story (test-only, no schema/API/architecture change).
- [x] `docs/infrastructure/index.md` — confirmed not applicable: frontend-test-only, no backend compute/queue/EventBridge/DB-provisioning change.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/features/events/queries.graphql.test.ts`.
  - Modified: `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.test.tsx`; `apps/web/src/features/events/queries.graphql` (comment only).
  - No files touched in `packages/ui`, `packages/domain`, `packages/database`, or `apps/backend`.
- **Rule Mapping:**
  - PRD §4.5/§3.16 (`profileImageUrl` never rendered, unconditional) → AC1/AC2, Tasks 1-2.
  - Story 1.3b AC17 / PRD §3.16 (opted-in prominent card) → AC3, Task 3 (verification only).
  - Story-split-gate discipline (epic-level-sweep-mode citation for Gate 1/3, fresh Gate 2 via `runSubagent`) → Dev Notes "Architecture & UX Gate Findings".
  - Reuse over duplication (this story's own core decision — depend on Epic 1.i1 rather than rebuild its scope) → Dev Notes "Amendment".
  - Testing-trophy (integration/regression tests, no E2E needed for a guard-only change) → Tasks 1-2, Testing Requirements below.
- **Verification Plan:**
  - `apps/web`: `pnpm --filter web test` — new `queries.graphql.test.ts` passes (Task 1); extended `account-content.test.tsx` assertion passes (Task 2).
  - `packages/ui`: `pnpm --filter @festgrid/ui test` — existing `EventCard.test.tsx` "Prominent poster (masonry, AC17)" suite still passes unmodified (Task 3).
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, confirming no regression anywhere else that reads `queries.graphql` or `account-content.tsx`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — this story is now limited to: (1) a static regression test locking the four list-view GraphQL queries against ever selecting `sourceSocialMediaAccountProfile`/`profileImageUrl`; (2) a behavioral regression test on `account-content.tsx` proving the profile avatar never leaks into an event card's image slot; (3) a verification-only citation that Story 1.3b AC17's prominent-card treatment survives Epic 1.i1's changes. No production code in `packages/ui`, `packages/domain`, or `apps/backend` is touched.
- [ ] Architecture and boundary confirmation — no new API surface, DB column, or component; the guard is enforced at the GraphQL-query/codegen-type layer, consistent with this codebase's existing pattern of type-safety-as-enforcement.
- [ ] Testing plan confirmation — as specified in the Verification Plan above; no E2E test needed (no new user-facing flow, a guard against an absence rather than a new interaction).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: cited from `epic-3-readiness.md`'s `swept: true` re-sweep (no gap, `3-7c` explicitly covered), plus a lightweight guard confirming this narrowed scope introduces nothing the sweep wouldn't have anticipated. Gate 2: no gap (run fresh via `runSubagent`, Freya-lens persona).
- [ ] **Scope-narrowing decision confirmed (user input already given via `AskUserQuestion` during this story's creation, no further approval needed on this point):** this story depends on Epic 1.i1's Stories 1.i1a/1.i1c/1.i1e for the hotlink-default-state and graceful-degrade mechanics rather than rebuilding them — user chose this over keeping 3.7c fully self-contained (accepting duplicate work) or marking it superseded (cancelling it outright).

## Testing Requirements

- [ ] Integration/regression tests (required, `apps/web`, Vitest): `queries.graphql.test.ts` (new, Task 1) — asserts the four list-view GraphQL operations never select `sourceSocialMediaAccountProfile`/`profileImageUrl`. `account-content.test.tsx` (extended, Task 2) — asserts no rendered event-card `<img>` ever matches the page's own profile-avatar URL.
- [ ] Regression citation (required, `packages/ui`, Vitest, Task 3): `EventCard.test.tsx`'s existing "Prominent poster (masonry, AC17)" suite continues to pass unmodified after Epic 1.i1 ships.
- [ ] E2E tests: not required — this is a guard against an absence with no new user-facing flow or interaction to exercise end-to-end.

## Deliverables Checklist

- [ ] `apps/web/src/features/events/queries.graphql.test.ts` created, passing, covering all four list-view queries (AC1).
- [ ] `account-content.test.tsx` extended with the profile-avatar-never-in-a-card assertion (AC2).
- [ ] `EventCard.test.tsx`'s AC17 prominent-poster suite confirmed still passing after Epic 1.i1 ships, with outcome recorded in Completion Notes (AC3).
- [ ] `epics.md`'s Story 3.7c section carries the 2026-09-12 Amendment recording this scope decision (already applied during this story's creation).

## Out of Scope

- The hotlink-default-state rendering and graceful-degrade fallback mechanics (`epics.md`'s original AC1/AC2 for this story) — owned by Epic 1.i1's Stories **1.i1a**, **1.i1c**, **1.i1e** (all `backlog`), per this story's Amendment above.
- The WeeklyCalendarView compact-row thumbnail (`IDEA-016`) — owned by Epic 1.i1's Story **1.i1d**, unrelated to this story's masonry/standard-card scope.
- Any change to `EventCard.tsx`, `EventCard.types.ts`, or `EventListView.tsx` — this story adds tests only; the components themselves are Epic 1.i1's responsibility to modify.
- The event-*detail* page's account-attribution avatar (`sourceSocialMediaAccountProfile.profileImageUrl` via `mapper.ts`'s `accountPlatformIconUrl`) — legitimate, pre-existing, and out of this story's "event list/grid" scope; not a violation of AC1/AC2 since it is not a "card."

## Definition of Done

- [ ] AC1-3 satisfied.
- [ ] Required tests passing: new `queries.graphql.test.ts`; extended `account-content.test.tsx`; existing `EventCard.test.tsx` AC17 suite confirmed unaffected.
- [ ] Lint and type checks passing for `apps/web` and `packages/ui`.
- [ ] No production code changes outside test files and one comment in `queries.graphql` (any other diff should be treated as scope creep and questioned).
- [ ] `epics.md`'s Amendment and this story file's own Amendment are both present and consistent with each other.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
