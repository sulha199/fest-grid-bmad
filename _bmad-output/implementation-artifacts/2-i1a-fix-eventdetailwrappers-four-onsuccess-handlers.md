# Story 2.i1a: Fix EventDetailWrapper's four onSuccess handlers

## Story Details

- Epic: 2.i1 - One mutation-result handler for favorite/calendar toggles (improvement epic under Epic 2 - User Personalization)
- Story ID: 2.i1a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `EventDetailWrapper.tsx`'s `onSuccess` handlers to null-check their response payload, derive the favorite-count delta from the response instead of assuming ±1, and settle a multi-schedule `handleAddToCalendar`'s `Promise.all` per item instead of failing the whole batch on one error,
so that BUG-007 (no partial-failure recovery), BUG-008 (unconditional delta), and BUG-009 (unguarded field reads) are all closed in the one file where they live.

**Bookkeeping note (verified via git log before drafting, per this project's "dev-story bookkeeping can lag shipped code" pattern):** BUG-009's half of this story is **already shipped** — commit `e658eb4` ("fix(events): guard toggleFavorite/toggleCalendarAddition onSuccess against null data (BUG-009)") added the null-check-and-throw guards to both `toggleFavorite`'s and `toggleCalendarAddition`'s `onSuccess` handlers ahead of this story's creation, via a `bmad-quick-dev` spec (`_bmad-output/implementation-artifacts/spec-bug-009-toggle-onsuccess-null-check.md`, status `done`), with its own regression tests already in `EventDetailWrapper.test.tsx` (lines ~482, ~622). This story's actual remaining implementation work is **BUG-007 and BUG-008 only** — BUG-009 is verify-and-confirm-unbroken, not re-implement (Task 4).

## Acceptance Criteria

1. **Given** `toggleFavorite`'s or `toggleCalendarAddition`'s `onSuccess` handler in `EventDetailWrapper.tsx` receives a falsy response payload (`data.toggleFavorite`/`data.toggleCalendarAddition` is null/undefined), **when** the handler runs, **then** it throws before reading any field, routing through the mutation's own `onError` (rollback + announcement) — closing BUG-009. **This is already shipped (commit `e658eb4`); this story only verifies it remains intact and unmodified by Tasks 2/3 below.**
2. **And** given a successful `toggleFavorite` mutation, **when** the GraphQL response is built, **then** `ToggleFavoriteResult` includes a `favoriteCount: Int!` field reflecting the authoritative post-toggle count — computed via the same `activeOnly(favorites)` `COUNT` pattern the existing `Event.favoriteCount` field resolver already uses, inside the same DB transaction as the toggle itself.
3. **And** given that response, **when** `EventDetailWrapper.tsx`'s `toggleFavorite` `onSuccess` updates cached `favoriteCount` (both the `getEventBySlug` detail-view cache patch and the `patchListCache` helper applied to the `["events"]`/`["favoriteEvents"]` list caches), **then** it sets the value directly from `data.toggleFavorite.favoriteCount` — no `Math.max(0, old ± 1)` arithmetic remains anywhere in this file (closing BUG-008).
4. **And** given a multi-schedule "Add to Calendar" confirm where 2+ schedules change state, **when** `handleAddToCalendar` dispatches the underlying `toggleCalendarAddition` calls, **then** it awaits all of them to settle (`Promise.allSettled`, not `Promise.all`) before taking any further action, regardless of how many individually succeed or fail (closing BUG-007's core defect).
5. **And** given a mixed outcome (some schedules settle successfully, others rejected), **when** settlement completes, **then** the native `.ics` download is triggered only for schedule ids that are both newly-added (transitioning false→true in this confirm) **and** settled successfully — a schedule that failed is never included in the download URL or its `calendar_ics_downloaded` payload, even when other schedules in the same confirm succeeded.
6. **And** given that same mixed outcome, **when** settlement completes, **then** the handler throws (does **not** call `toast.success`) so `AddToCalendarDialog` (`packages/ui`, unmodified by this story) stays open exactly as it already does for a full failure — succeeded schedules show as committed via the dialog's existing prop-driven resync (its `useEffect` re-derives `selectedIds` from the `schedules` prop's `isAddedToCalendar` values on every prop change while open), and failed schedules revert via their own mutation's existing `onError` rollback, so a subsequent Confirm only re-attempts the still-out-of-sync subset. **Explicit product decision (AskUserQuestion, 2026-09-16): the dialog does NOT close on partial success, and no new "N of M succeeded" toast copy is introduced** — this reuses the existing full-failure messaging path unchanged.
7. **And** given all schedules in a confirm action succeed, **then** the existing full-success behavior (dialog closes, `toast.success` fires, ICS download for all newly-added ids, analytics fire) is unchanged; **and** given all schedules in a confirm action fail, **then** the existing full-failure behavior (dialog stays open, error announced, no download, no success toast) is unchanged — both are regression guards, not new behavior.
8. **And** no new user-facing strings are introduced by this story; the existing `en`/`id` locale keys (`calendarErrorAnnouncement`, `addToCalendarSuccessAnnouncement`, `favoriteErrorAnnouncement`, `favoriteSuccessAnnouncement`/`unfavoriteSuccessAnnouncement`) continue to cover every reachable code path with no orphaned or missing key.

**Note:** This story is Epic 2.i1's first story. It was formed 2026-09-08 via `bmad-form-epics` from BUG-007, BUG-008, BUG-009 (plus FIND-006, tracked fractionally under sibling Story 2.i1c). The epic's invariant: "Every mutation-result handler for a favorite/calendar-toggle null-checks its payload and derives its count/state delta from the response, settling multi-item fan-outs per item." Sibling Stories 2.i1b (adopt the pattern at 3 other favorite-mutation call sites), 2.i1c (missing decrement-path tests), and 2.i1z (CI ratchet) all depend on this story and are explicitly Out of Scope here.

**Depends on:** Story 2.1 (`toggleFavorite`, optimistic pattern + `Event.favoriteCount` field resolver), Story 2.1a (`toggleCalendarAddition`), Story 2.6b (`AddToCalendarDialog`'s onConfirm-throw/await/catch contract and prop-resync `useEffect`, both consumed unmodified).

## Tasks / Subtasks

- [ ] Task 1: Backend — extend `ToggleFavoriteResult` with an authoritative `favoriteCount` (AC2) — `apps/backend`
  - [ ] Add `favoriteCount: Int!` to `ToggleFavoriteResult` in `apps/backend/src/schema/favorites-and-calendar.graphql`.
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `toggleFavorite` resolver (inside the existing `db.transaction(async (tx) => {...})`, ~lines 1028-1059), after each of the three mutating branches (unfavorite/re-favorite/insert-new), run `const countRows = await tx.select({ count: count() }).from(favorites).where(and(eq(favorites.eventId, eventId), activeOnly(favorites))); const favoriteCount = countRows[0]?.count ?? 0;` and include `favoriteCount` in the returned object on all three branches. This mirrors the existing `Event.favoriteCount` field resolver (~line 3664) exactly, just reading through `tx` instead of `db` so it observes the just-committed row inside the same transaction.
  - [ ] Run `pnpm run codegen` — confirm `apps/backend/src/generated/resolvers-types.ts` regenerates `ToggleFavoriteResult` with the new field. Do not hand-edit generated output.
  - [ ] Extend `apps/backend/src/schema/favorites-and-calendar.test.ts`'s "toggleFavorite - toggle on, off, and on" test to assert the mutation response's `favoriteCount` at each step (0→1→0 for a single user), and cross-check parity with the existing "favoriteCount - aggregates across multiple users correctly" test's independent `Event.favoriteCount` query.

- [ ] Task 2: Frontend — consume `favoriteCount` from the mutation response (AC3) — `apps/web`
  - [ ] Add `favoriteCount` to `toggleFavorite`'s selection set in `apps/web/src/features/events/mutations.graphql`.
  - [ ] Run `pnpm run codegen` — confirm `apps/web/src/generated/graphql.ts` regenerates. Do not hand-edit generated output.
  - [ ] In `EventDetailWrapper.tsx`'s `toggleFavorite` `onSuccess`, replace the `Math.max(0, typedOld.eventBySlug.favoriteCount + (data.toggleFavorite.isFavorited ? 1 : -1))` computation (the `getEventBySlug` detail-cache patch, ~line 117-120) with `data.toggleFavorite.favoriteCount` directly.
  - [ ] Do the same inside `patchListCache`'s per-item `favoriteCount` computation (~line 148-151), which patches `["events"]`/`["favoriteEvents"]`.

- [ ] Task 3: Frontend — settle `handleAddToCalendar`'s multi-schedule mutations per item (AC4, AC5, AC6, AC7) — `apps/web`
  - [ ] Replace `await Promise.all(changedIds.map((scheduleId) => toggleCalendarAddition({ eventId, scheduleId })))` (~line 478-480) with `const settled = await Promise.allSettled(changedIds.map((scheduleId) => toggleCalendarAddition({ eventId, scheduleId })))`.
  - [ ] Derive `succeededIds`/`failedIds` (both `string[]`) from `changedIds` paired with `settled`'s per-index `.status`.
  - [ ] Filter `addedIds` down to only ids also present in `succeededIds` before building the `/api/calendar/ics` query params, triggering `window.location.assign`, and firing `calendar_ics_downloaded` — a failed schedule must never appear in that download's `scheduleId` params even if other schedules in the same confirm succeeded.
  - [ ] If `failedIds.length > 0`: keep the existing `console.error("Failed to update calendar additions", ...)` (extend the logged value to include which ids failed) and `throw` — do **not** call `toast.success`. Do not add a new "partial success" message; the existing per-mutation `onError` (`calendarErrorAnnouncement`) already announced the specific failure(s) when each rejected `toggleCalendarAddition` call ran its own `onError`.
  - [ ] If `failedIds.length === 0`: proceed exactly as today (`toast.success(t("addToCalendarSuccessAnnouncement"))`), using the (now full) `succeededIds`-filtered `addedIds` for the download.

- [ ] Task 4: Verify BUG-009 remains intact, no re-implementation (AC1)
  - [ ] Re-read `EventDetailWrapper.tsx`'s `toggleFavorite`/`toggleCalendarAddition` `onSuccess` null-checks (currently ~lines 93-105, ~201-209) after Tasks 2/3 land — confirm the guard-and-throw shape from commit `e658eb4` is untouched (Task 2/3's edits are additive/adjacent, not overlapping these lines).
  - [ ] Confirm `EventDetailWrapper.test.tsx`'s existing BUG-009 regression tests (~line 482 favorite null-data, ~line 622 calendar null-data) still pass unmodified.

- [ ] Task 5: Testing (AC2-AC8) — `apps/web`, `apps/backend`
  - [ ] New integration test (`EventDetailWrapper.test.tsx`): a multi-schedule confirm selecting one schedule that succeeds (existing default handler behavior) and one that fails (`scheduleId: "sched_fail"`, per the existing MSW handler convention) together — assert: dialog stays open; `window.location.assign` called with a `scheduleId` param for the succeeding id only; `calendar_ics_downloaded` fired with `scheduleIds` containing only the succeeding id; `calendarErrorAnnouncement` shown; `addToCalendarSuccessAnnouncement` never shown.
  - [ ] New integration test (`EventDetailWrapper.test.tsx`): extend the `toggleFavorite` MSW handler to return a `favoriteCount` that would NOT match a naive ±1 computation (e.g. jump the mocked count by a value other than 1, or hold it constant), and assert the rendered favorite-count badge (`EventDetailView`'s `favoriteCount` display, already wired via `mapper.ts`) reflects the server-supplied number, proving the UI is reading `data.toggleFavorite.favoriteCount` and not computing a local delta.
  - [ ] Confirm all pre-existing tests (full-success add-to-calendar, full single-schedule failure, both BUG-009 null-data cases) still pass unmodified — no behavior change for the already-covered single-schedule paths.
  - [ ] Backend (`favorites-and-calendar.test.ts`): extend per Task 1.
  - [ ] Manual: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

No `epic-2-i1-readiness.md` sweep report exists yet (only `epic-2-readiness.md`, `epic-0-i7-readiness.md`, `epic-1-i1-readiness.md` exist under `_bmad-output/planning-artifacts/epic-readiness/`), so all three story-split gates were run fresh against this story's scope via `runSubagent`, rather than citing a swept report:

- **Gate 1 (Architecture/Infra Completeness, Winston persona) — No gap found.** Neither fix bypasses the backend: BUG-007 stays entirely client-side (the `toggleCalendarAddition` mutation itself, already shipped by Story 2.1a, is called exactly as before — only awaited differently). BUG-008 adds one field to an already-shipped, already-transactional, already-`requireAuth`-enforced mutation's result type, computed via the exact pattern the sibling `Event.favoriteCount` field resolver already uses, inside the same `tx`. This is schema evolution of a fully-layered mutation, not a new/unbacked API surface, a frontend-direct-DB call, or infra with no IaC.
- **Gate 2 (UI Complexity & Reusability, Freya/Sally persona) — No gap found.** This story has zero new UI surface: no new component, no new dialog state, no new copy, no new interaction pattern. `AddToCalendarDialog` (`packages/ui`) is not modified at all — the "stays open on failure" behavior rides entirely on its existing `onConfirm`-throw/await/catch contract and its existing prop-resync `useEffect`. There is nothing here for a `DESIGN.md`/`EXPERIENCE.md` to have specified and nothing to split into a UI-refinement story.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona) — No gap found.** `favoriteCount` on `ToggleFavoriteResult` is a shared dependency (sibling Story 2.i1b's 3 other call sites will also read it), but it is not an orphaned foundational scaffold — 2.i1b already exists in `epics.md` and already declares a dependency on this story. Building the field where the bug is actually fixed, with the downstream consumer already tracked and sequenced after it, is the correct shape.

### Design decisions confirmed with user (AskUserQuestion, 2026-09-16)

1. **BUG-008 approach:** Extend `ToggleFavoriteResult` with a real, server-computed `favoriteCount: Int!` (small additive backend change, Task 1) rather than switching the whole optimistic-mutation pattern to confirm-then-refetch. Rationale given: smallest change, keeps the existing instant-optimistic-then-reconciled UX, stays inside this story's blast radius. This does **not** adjudicate the separate, still-open FIND-022 house-convention question (epics.md's note: "BUG-008/Story 2.i1a preserves the existing optimistic ±1 pattern; FIND-022 mandates confirm-then-refetch for its own new subscribe-toggle mutation... not adjudicated here") — this story just removes the ±1 *arithmetic*, it does not remove optimism/locality from the pattern itself.
2. **BUG-007 partial-outcome UX:** When a multi-schedule confirm has a mix of success/failure, **keep the dialog open** (do not close-and-toast-partial-success). Succeeded schedules stick (reflected via cache update + the dialog's existing resync effect); failed ones revert (via their own mutation's existing rollback); the user re-confirms only the still-failed subset. No new "N of M succeeded" toast/announcement copy — reuses the existing full-failure messaging path unchanged.

### Previous/Sibling Story Intelligence

- **Story 2.1** established `toggleFavorite`'s optimistic `onMutate`/`onError`/`onSuccess` shape and the `Event.favoriteCount` field-resolver's `activeOnly(favorites)` `COUNT` pattern (`resolvers.ts` ~line 3664) that Task 1 mirrors for the new mutation-response field.
- **Story 2.1a** shipped `toggleCalendarAddition` untouched by this story — Task 3 only changes how the client awaits/settles multiple calls to it, not the mutation itself.
- **Story 2.6b** built `AddToCalendarDialog` (`packages/ui/src/features/events/EventDetailView.tsx`) with the `onConfirm: (ids) => void | Promise<void>` contract this story's Task 3 relies on: `handleConfirm` awaits `onConfirm`, calls `onClose()` only if it resolves, and its own `React.useEffect(() => { if (isOpen) { setSelectedIds(schedules.filter(s => s.isAddedToCalendar).map(s => s.id)) } }, [isOpen, schedules])` already re-syncs checkbox state from the live `schedules` prop on every prop change while open — this is the exact, already-existing mechanism that makes "keep dialog open, succeeded schedules show as committed" work with **zero `packages/ui` changes** in this story.
- **Commit `320a9ee`** ("fix(ux): stop silent Add to Calendar failures and sync favorite toggle across lists", 2026-08-31) added the error announcement + re-throw (`setLiveMessage(t("calendarErrorAnnouncement"))` in `onError`; `throw e` in `handleAddToCalendar`'s catch) and the `patchListCache` list-cache sync — but explicitly did **not** add per-item success tracking, which is exactly BUG-007's remaining gap (confirmed live via `backlog-evidence-deferred.yaml`'s DW-032: "predates this batch, which only added error announcement + re-throw, not per-item success tracking").
- **Commit `e658eb4`** ("fix(events): guard toggleFavorite/toggleCalendarAddition onSuccess against null data (BUG-009)", after `320a9ee`) shipped BUG-009's fix ahead of this story — see the Bookkeeping note under Story above and Task 4.
- **Commit `cd31195`** ("feat(ux): show favorite count on Event Detail") wired `favoriteCount` end-to-end into `EventDetailView`'s badge (`packages/ui/src/features/events/EventDetailView.tsx` ~line 297-299, `EventDetailView.types.ts` ~line 120, `mapper.ts` ~line 116) — this story's Task 2 changes only where the number *comes from* (server response vs. local ±1 math), not any rendering/formatting, so this display path needs no changes and gives Task 5's new test a real UI assertion point.

### Architecture / technical constraints

- **AD-8 (Soft-Delete Convention) legacy exception, unaffected:** The Architecture Spine explicitly carves out `toggleFavorite`/`toggleCalendarAddition` as an "accepted legacy exception" to rule 4's `action: SoftDeleteAction!` argument shape — they keep their implicit-toggle-by-`deletedAt` shape and are "not being reconciled to rule 4." This story does not touch that argument shape at all; it only adds a **result** field. Do not add a `SoftDeleteAction` argument as part of this story.
- **Drizzle ORM / Optimized DB Queries:** Task 1's `COUNT` query reuses the exact `count()` + `activeOnly()` idiom already imported and used elsewhere in `resolvers.ts` — no new query pattern, no new index needed (the existing `favorites` table/its partial index already serve this read pattern via the identical field resolver).
- **GraphQL Code Generator (End-to-End Type Safety):** Both `.graphql` document changes (Tasks 1 and 2) must be followed by `pnpm run codegen`; never hand-edit `apps/backend/src/generated/resolvers-types.ts` or `apps/web/src/generated/graphql.ts`.
- **State Management Categorization:** **Server State** (`useToggleFavoriteMutation`/`useToggleCalendarAdditionMutation`, react-query cache patches against `getEventBySlug` and the `["events"]`/`["favoriteEvents"]` list queries) — no URL state (`nuqs`), no `zustand` global state introduced or touched.
- **Loader Classification:** **Non-Blocking**, unchanged from Story 2.1's/2.6b's existing classification — both mutations remain lightweight background toggles; this story changes internal await/error-handling logic only, not the loading-affordance classification.
- **Analytics (AD-5):** No new PostHog events. Existing `event_favorited`/`event_unfavorited`, `event_added_to_calendar`/`event_removed_from_calendar`, and `calendar_ics_downloaded` continue to fire with their existing payload shapes, from the same call sites — Task 3 only changes which ids are eligible to reach the `calendar_ics_downloaded` call.
- **i18n (AD-6):** No new locale keys. AC8 is a regression guard confirming existing keys still cover every reachable path.
- **Package boundaries:** `apps/web`: `EventDetailWrapper.tsx`, `mutations.graphql`, `EventDetailWrapper.test.tsx` modified; `apps/web/src/generated/graphql.ts` regenerated. `apps/backend`: `favorites-and-calendar.graphql`, `resolvers.ts`, `favorites-and-calendar.test.ts` modified; `apps/backend/src/generated/resolvers-types.ts` regenerated. **Not touched:** `packages/ui/**` (Gate 2 finding above), `packages/domain/**` (no reusable framework-agnostic logic introduced — this is mutation-result plumbing specific to this file and this resolver, not a generic mechanism), `packages/database/**` (no schema/column/migration change — `favoriteCount` is computed, not stored), the three other favorite-mutation call sites (`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`, `account-content.tsx` — Story 2.i1b's job).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** `ToggleFavoriteResult` (GraphQL, `apps/backend/src/schema/favorites-and-calendar.graphql`) currently exposes only `{ eventId: ID!, isFavorited: Boolean! }` — no count field, which is why "derive the delta from the response" (BUG-008's literal AC wording) was not previously possible without this change.
- **Required DB migration changes:** **None.** `favoriteCount` is computed on read (a `COUNT` over the existing `favorites` table, scoped by the existing `activeOnly()` soft-delete filter) — no new column, table, or index. No Drizzle-kit migration file is generated or needed for this story.
- **Required TypeScript/GraphQL type changes:** `ToggleFavoriteResult` gains `favoriteCount: Int!` (schema); regenerate `apps/backend/src/generated/resolvers-types.ts` (`ToggleFavoriteResultResolvers`) and `apps/web/src/generated/graphql.ts` (`ToggleFavoriteMutation`'s inferred result type) via `pnpm run codegen` — do not hand-edit either.
- **Backward compatibility and rollout notes:** Adding a field to a GraphQL type/selecting it in one query document is additive and non-breaking — the three other `useToggleFavoriteMutation` call sites (deferred to Story 2.i1b) that don't select `favoriteCount` in their own `.graphql` documents are completely unaffected and continue to compile/run exactly as today.
- **Verification checks:** Backend integration test (Task 1) asserting the mutation's returned `favoriteCount` matches an independent `activeOnly(favorites)` `COUNT` read at each step of a toggle-on/off/on cycle; frontend integration test (Task 5) asserting the rendered badge reflects a server-supplied count that would diverge from a naive ±1 computation, proving the UI reads the response field rather than computing locally.

## Global Rules References

- `_bmad-output/project-context.md` (Database & Performance — Soft-Delete Convention/AD-8 legacy exception, Drizzle ORM Types, Optimized DB Queries; State Management Architecture; Testing Rules; Development Workflow Rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-8 — legacy toggle-mutation exception)
- `_bmad-output/planning-artifacts/epics.md` (Epic 2.i1, Stories 2.i1a/2.i1b/2.i1c/2.i1z; Story 2.1, 2.1a, 2.6b)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/implementation-artifacts/backlog.yaml` (BUG-007, BUG-008, BUG-009, FIND-006)
- `_bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml` (DW-032, DW-033)
- `_bmad-output/implementation-artifacts/spec-bug-009-toggle-onsuccess-null-check.md` (BUG-009's already-shipped fix)
- `_bmad-output/implementation-artifacts/2-6b-wire-the-add-to-calendar-trigger-dialog-and-ics-export.md` (`AddToCalendarDialog` contract)
- `docs/infrastructure/index.md` — no infra-shard changes owned by this story (a synchronous GraphQL mutation change, not queue/cron/API-Gateway provisioning)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/backend/src/schema/favorites-and-calendar.graphql`, `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/schema/favorites-and-calendar.test.ts`.
- **Modified (codegen output):** `apps/backend/src/generated/resolvers-types.ts`.
- **Modified:** `apps/web/src/features/events/EventDetailWrapper.tsx`, `apps/web/src/features/events/mutations.graphql`, `apps/web/src/features/events/EventDetailWrapper.test.tsx`.
- **Modified (codegen output):** `apps/web/src/generated/graphql.ts`.
- **Not modified by this story:** `packages/ui/**`, `packages/domain/**`, `packages/database/**`; `apps/web/src/app/[locale]/home-content.tsx`, `feed-content.tsx`, `favorites/favorites-content.tsx`, `[platformSlug]/[accountId]/account-content.tsx` (Story 2.i1b); `apps/web/locales/en.json`/`id.json` (no new strings).

### Rule Mapping

- *Soft-Delete Convention (AD-8)* → `favoriteCount` computed via `activeOnly(favorites)`, matching the existing `Event.favoriteCount` field resolver; the toggle mutations' accepted legacy-exception argument shape is left unreconciled, per the spine's explicit carve-out.
- *Drizzle ORM Types / Optimized DB Queries* → reuses the existing `count()`+`activeOnly()` idiom inside the already-open `tx`, no new query shape or index.
- *GraphQL Code Generator (End-to-End Type Safety)* → both `.graphql` changes followed by `pnpm run codegen`; no hand-edited generated files.
- *Testing Rules (Testing Trophy + DoD)* → integration tests added for the mixed-outcome and server-derived-count paths (Task 5); no `packages/domain` unit tests needed since no domain-package logic is touched by this story.
- *Story-split-gate* → Gate 1/2/3 run fresh (no swept `epic-2-i1-readiness.md`); all three returned "No gap found" (Architecture & UX Gate Findings above).
- *Analytics (AD-5) / i18n (AD-6)* → no new events, no new strings; AC8 explicitly guards continued coverage of the existing ones.

### Verification Plan

- **Backend:** `favorites-and-calendar.test.ts` extended assertions on `favoriteCount` across a toggle cycle (Task 1).
- **Frontend:** `EventDetailWrapper.test.tsx` extended — mixed-outcome calendar confirm test, server-derived-`favoriteCount` test (Task 5), plus confirming all pre-existing tests (full-success, full-failure, both BUG-009 cases) still pass unmodified.
- **Build/lint/codegen:** `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root, with generated-file diffs reviewed (not hand-edited).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: BUG-007 (`Promise.allSettled` + per-item outcome gating on download/toast, dialog-stays-open-on-any-failure) and BUG-008 (`favoriteCount` returned from the mutation response instead of computed via ±1, requiring one additive backend field) fixed in this story; BUG-009 verified already-shipped (commit `e658eb4`) and left untouched, not re-implemented.
- [ ] Gate 1/2/3 prerequisites confirmed: all three ran fresh via `runSubagent` (no swept `epic-2-i1-readiness.md` exists) — no gap found in any (see Architecture & UX Gate Findings).
- [ ] **BUG-008 approach accepted:** extend `ToggleFavoriteResult` with a real, server-computed `favoriteCount: Int!` rather than switching to confirm-then-refetch — per explicit user decision via `AskUserQuestion`, 2026-09-16.
- [ ] **BUG-007 partial-outcome UX accepted:** keep the dialog open on ANY schedule failure within a multi-schedule confirm (not close-on-partial-success-with-a-new-toast) — per explicit user decision via `AskUserQuestion`, 2026-09-16; reuses existing full-failure messaging, no new copy/i18n keys.
- [ ] Testing plan confirmed: backend `favorites-and-calendar.test.ts` extension (toggle-cycle `favoriteCount` assertions), frontend `EventDetailWrapper.test.tsx` mixed-outcome-confirm test and server-derived-count test.
- [ ] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- **Backend (`apps/backend`, node:test):** `favorites-and-calendar.test.ts` extended to assert `toggleFavorite`'s response `favoriteCount` matches the authoritative `activeOnly(favorites)` count at each step of a toggle-on/off/on cycle (Task 1).
- **Frontend (`apps/web`, Vitest + msw):** `EventDetailWrapper.test.tsx` extended with (a) a mixed-outcome multi-schedule "Add to Calendar" confirm test (one succeeding + one failing schedule id) asserting dialog-stays-open, download/analytics scoped to only the succeeding id, and no success toast; (b) a server-derived-`favoriteCount` test proving the rendered badge reflects the mocked response value rather than a locally-computed ±1 (Task 5). All pre-existing add-to-calendar and favorite-toggle tests (full-success, full single-schedule-failure, both BUG-009 null-data cases) must continue passing unmodified.
- **E2E:** None added — no user-visible interaction pattern changes (Gate 2: no gap found); existing Playwright happy-path coverage for Add to Calendar (Story 2.6b) is unaffected.
- **Manual:** `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

## Deliverables Checklist

- [ ] `ToggleFavoriteResult.favoriteCount: Int!` shipped backend (schema + resolver, computed in-transaction) and consumed frontend; codegen output regenerated and committed on both sides.
- [ ] `EventDetailWrapper.tsx`'s `toggleFavorite` `onSuccess` uses the server-supplied `favoriteCount` in both cache-patch locations (`getEventBySlug` detail cache and `patchListCache`'s list caches) — no `±1` arithmetic remains.
- [ ] `handleAddToCalendar` uses `Promise.allSettled` with per-item outcome tracking; ICS download/`calendar_ics_downloaded` gated on succeeded-and-newly-added ids only; `toast.success` gated on zero failures; throws (dialog stays open) on any failure.
- [ ] BUG-009's existing null-check guards verified unchanged and still covered by their existing regression tests.
- [ ] New/extended backend and frontend tests passing; all pre-existing tests in both touched test files still passing unmodified.
- [ ] `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

## Out of Scope

- **Adopting the server-derived-`favoriteCount` pattern at the 3 other favorite-mutation call sites** (`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`, `account-content.tsx`) — Story 2.i1b (depends on this story).
- **The missing unfavorite/decrement-path test coverage across all 4 patched favorite caches** (FIND-006) — Story 2.i1c (depends on this + 2.i1b).
- **A CI-wired regression ratchet guaranteeing the pattern holds project-wide** — Story 2.i1z (depends on this + 2.i1b + 2.i1c).
- **Reconciling `toggleFavorite`/`toggleCalendarAddition`'s legacy implicit-toggle argument shape to AD-8 rule 4's `SoftDeleteAction` convention** — explicitly excluded per the Architecture Spine's accepted legacy exception; not this story's concern.
- **A distinct "N of M schedules succeeded" toast/announcement for the calendar partial-failure case** — explicitly rejected per the user's `AskUserQuestion` decision; the dialog simply stays open and reuses existing failure messaging.
- **Adjudicating FIND-022's optimistic-vs-confirm-then-refetch house-convention question** for mutations other than `toggleFavorite` — remains open per `epics.md`'s own note; this story removes BUG-008's ±1 arithmetic specifically, it does not settle that broader debate.

## Definition of Done

- All 8 Acceptance Criteria satisfied.
- Required tests passing: extended backend (`favorites-and-calendar.test.ts`) and frontend (`EventDetailWrapper.test.tsx`) tests, plus all pre-existing tests in both files unmodified and passing.
- Lint and type checks passing for `apps/web` and `apps/backend`.
- `pnpm run codegen` output committed and consistent with the two `.graphql` document changes.
- No decrease in overall project test coverage.

## Completion Status

- [ ] Not yet started (Status: ready-for-dev)

## Dev Agent Record

### Agent Model Used

_To be filled by the dev agent._

### Debug Log References

- Story created via `bmad-create-story` at the user's request (`/bmad-create-story BUG-007`), resolved to Story 2.i1a (the epics.md/sprint-status.yaml unit that closes BUG-007) after confirming the mapping via `backlog.yaml` and `epics.md`.
- Git-log check (per this project's "dev-story bookkeeping can lag shipped code" pattern) found BUG-009's fix already shipped in commit `e658eb4`, ahead of this story — documented above rather than re-implemented.
- Two `AskUserQuestion` rounds confirmed before drafting (2026-09-16): (1) BUG-008's approach, given `ToggleFavoriteResult` has no `favoriteCount` field today — confirmed: extend the mutation response rather than switch to confirm-then-refetch; (2) BUG-007's partial-outcome UX — confirmed: keep the dialog open on any failure rather than close-and-toast-partial-success.
- Gate 1/2/3 run fresh via `runSubagent` (no swept `epic-2-i1-readiness.md` exists for this epic) — all three returned "No gap found" (see Architecture & UX Gate Findings).

### Completion Notes List

_To be filled by the dev agent._

### File List

_To be filled by the dev agent (predicted in Implementation Plan → File Change Plan above)._
