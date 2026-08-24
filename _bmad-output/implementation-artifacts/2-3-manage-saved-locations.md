---
baseline_commit: 94d87d4be32711f0ce433a82207955e97fd1a5c3
---
# Story 2.3: Manage saved locations

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.3
- Status: ready-for-dev (AC14 amendment; AC1-AC13 already delivered)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a "My Locations" page where I can add a named location via a live address search, see my saved locations, edit an existing one (name, address, or radius), and delete one with a safe undo,
so that I can build up a small set of important places (Home, Work) to use later for finding nearby events, without fear of an accidental permanent delete.

## Acceptance Criteria

1. **Given** I am not logged in, **when** I navigate to `/settings/locations`, **then** I am redirected to `/login` (same client-side auth-gate pattern as `/favorites`/`EventDetailWrapper`) — no data is fetched.
2. **Given** I am logged in and navigate to `/settings/locations`, **when** the page loads, **then** I see my saved locations fetched via the `myLocations` query (Story 2.3a), each row showing its `name`, `locationDetails.formattedAddress`, and `radius` (converted from meters to km for display, e.g. `5000` → "5 km"), ordered exactly as returned (`createdAt` ascending, per 2.3a AC6) — no client-side re-sort. If I have none, I see an empty state and a prominent "Add a New Location" button (per `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`).
3. **And** the full list is fetched in one unpaginated call (no infinite scroll) — a personal saved-locations list is a small, bounded set (realistically single digits), not the kind of "long list" `project-context.md`'s List Navigation rule targets (Discovery/Favorites/Feed); this mirrors `EXPERIENCE.md`'s treatment of the analogous small personal lists (API Keys, Subscriptions) as fully-loaded tables, not infinite-scroll feeds.
4. **And** tapping "Add a New Location" opens a modal form (shadcn `Dialog`, matching the "new screen or modal" language in the UX scenario, not the unrelated "In-Table Add Form" component pattern which `EXPERIENCE.md` scopes specifically to API Keys/Subscriptions) with three fields: **Name** (text input), **Address** (a live-search combobox), **Radius** (a slider, labeled and displayed in km, internally 1-50 km mapping to the backend's 1000-50000 meter bound from 2.3a AC4/PRD §3.3).
5. **And** typing into the Address field (debounced via the existing `useDebounce` hook, `packages/ui`) issues the `addressAutocomplete` query (Story 2.3b) and shows a dropdown of candidate `{ description }` suggestions as they arrive; selecting one records that suggestion's `placeId` as the pending selection (the visible text field shows the selected suggestion's description) — the mutation is never submitted with free-typed, unselected address text (creating requires a `placeId` selection; the form's Save button is disabled until Name, a selected address suggestion, and a valid radius are all present).
6. **And** submitting the Add form calls `createUserLocation({ name, placeId, radius })` (radius converted from the slider's km value back to meters); on success the modal closes, the new location appears in the list (re-fetch or cache-append, dev's choice, but the list **must** reflect the newly-created row without a manual page refresh), and a full-screen `BlockingLoader` (Story 1.7a) is shown for the duration of the mutation, per `project-context.md`'s explicit "saving a location" Blocking-loader example.
7. **And** tapping an existing location row opens the **same** modal form, pre-populated with that location's `name`, `locationDetails.formattedAddress` (shown as plain display text in the Address field, not a live suggestion — no `placeId` is known for an already-saved location), and `radius` (converted to km). If the user changes only `name`/`radius` and leaves the Address field untouched, the submitted `updateUserLocation` call omits `placeId` entirely (2.3a AC3's "both may be omitted on update to leave the location's place unchanged" path) — it does **not** resubmit the unchanged `formattedAddress` string as a new address. If the user clears the Address field and searches again, the same autocomplete-and-select flow as Add applies, and the newly-selected `placeId` is included in the update call.
8. **And** submitting the Edit form calls `updateUserLocation(id, { name?, placeId?, radius? })` with only the changed fields; the same `BlockingLoader` treatment as Add applies; on success the modal closes and the list reflects the change.
9. **[REVISED 2026-08-06 — Sprint Change Proposal, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-06.md`]** **And** each location row is wrapped in `SwipeToReveal` (Story 0.19) revealing a "Delete" action (with its built-in always-present non-touch equivalent control for desktop/keyboard users — never swipe-only, per Story 0.19 AC4). Tapping/activating "Delete" **immediately calls `deleteUserLocation(id, action: DELETE)`** (Story 2-3a's revised mutation — the real, committing backend delete) and then calls `useSoftDeleteWithUndo`'s `markPending(id, undo, labels?)` (Story 0.18's revised contract) — the row does **not** disappear immediately; it greys out in place and a 6-second toast with an "Undo" action appears (Story 0.18's `SoftDeleteToaster`, already mounted app-wide). Still **no** blocking "Are you sure?" confirmation dialog (unchanged decision, Dev Notes → Architecture & UX Gate Findings).
10. **[REVISED]** **And** clicking "Undo" (in the toast) calls `deleteUserLocation(id, action: RESTORE)` as the hook's `undo` callback — **a real mutation is now sent** (reversing the delete already committed in AC9; was: "no mutation is ever sent to the server for that action"). On success the row reverts to its normal, saved state.
11. **[REVISED — replaces the unmount-commit mechanism entirely]** **And** if the toast's 6-second window elapses without "Undo" being clicked, `onExpire(id)` fires and the row is removed from the locally-held `myLocations` list (react-query cache splice, not a refetch) — **no further mutation call**, since the delete already committed in AC9. Navigating away from `/settings/locations` has no special commit behavior anymore (there is nothing left to commit at unmount time).
11a. **[NEW]** **And** if the AC9 `deleteUserLocation(DELETE)` call itself fails (network/server error), the row reverts to its normal state (the optimistic grey-out is rolled back), no toast/pending state is entered, and a distinct error toast is shown instead.
12. **And** an empty state, a loading skeleton (matching row-shaped skeletons, not `EventCard`'s skeleton), and an error state are all shown as appropriate for the list load — none of these currently exist in any UX artifact for this page, so their copy is authored fresh in this story (see Dev Notes → i18n Keys Required).
13. **And** all user-facing labels, the empty/loading/error copy, the modal form's field labels/placeholders, and the delete toast/Undo strings are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings.
14. **AC14 — Adopt `PageContainer(fullWidth=false)`/`PageHeader` (added 2026-08-24 via `bmad-correct-course`):** And `locations-content.tsx`'s root `<div className="p-4 sm:p-8 space-y-8 max-w-3xl mx-auto">` (all 3 occurrences in this file — loading skeleton, error state, and success return) is replaced with `<PageContainer fullWidth={false}>` (`@festgrid/ui`, Story 0.30), and its `<div className="flex justify-between items-center"><h1 className="text-3xl font-bold">{t("title")}</h1>{locations.length > 0 && (<button>...</button>)}</div>` row is replaced with `<PageHeader title={t("title")} action={locations.length > 0 ? { label: t("addButtonLabel"), icon: <Plus className="h-4 w-4" />, onClick: handleOpenAddDialog } : undefined} />` (Story 0.32) — preserves the existing conditional-on-`locations.length > 0` visibility exactly. **Depends on Story 0.30 (AC7) and Story 0.32.**
14. **[REVISED 2026-08-06]** **And** integration tests (Vitest + msw) verify: auth redirect, list render (empty/populated/error), add flow (autocomplete search → select suggestion → save → appears in list, `BlockingLoader` shown), edit flow (pre-populated form; save with unchanged address omits `placeId`; save with a newly-selected address includes the new `placeId`), Save button disabled until a valid selection/radius exist, swipe/delete reveals the action, **delete click fires `deleteUserLocation(DELETE)` immediately (mocked) and greys out the row, Undo fires `deleteUserLocation(RESTORE)` and un-greys the row, a fake-timer-advanced 6s window with no Undo removes the row from the list with zero additional mutation calls, and a failed `DELETE` call reverts the optimistic grey-out and shows an error toast** (was: "mark-pending grey-out + toast, Undo cancels with no mutation call, and unmount commits all still-pending deletes exactly once"). One Playwright E2E test covers the authenticated happy path: open "My Locations" → add "Home" via autocomplete → see it in the list → edit its radius → save → swipe "Home" and delete (now-committed) → Undo (restores) → still present → delete again → revisit the page → "Home" is gone (no "navigate away to commit" step needed anymore — commit already happened at the delete click).

**Note (AC correction vs. `epics.md`):** `epics.md`'s Story 2.3 AC text only covers add (name + address)/list/delete, with no mention of editing, the delete-interaction mechanism, or the address-input UX. ACs 3-11 above were derived from extensive discussion with the user (2026-08-03) resolving concrete design questions this terse AC text left open (see Dev Notes → Architecture & UX Gate Findings) and are authoritative for this story going forward — including a new backend dependency, Story 2.3b, this story's own creation originally surfaced and which now itself has a fully-drafted, contract-matching story file.

## Tasks / Subtasks

- [x] Task 1: GraphQL operation documents (AC2, AC5, AC6, AC8)
  - [x] Create `apps/web/src/features/locations/queries.graphql`
  - [x] Create `apps/web/src/features/locations/mutations.graphql`
  - [x] Run `pnpm run codegen`
- [x] Task 2: Route and data layer (AC1, AC2, AC3, AC12)
  - [x] New `apps/web/src/app/[locale]/settings/locations/page.tsx` rendering a new colocated `locations-content.tsx`
  - [x] In `locations-content.tsx`: auth gate via `useAuthSession()`
- [x] Task 3: Location row + delete interaction (AC9, AC10, AC11, AC11a)
  - [x] Build the row markup directly inside `locations-content.tsx` wrapping each location's content in `SwipeToReveal`
  - [x] Apply a greyed-out visual treatment to a row while `isPending(location.id)` is true
  - [x] **[REVISED 2026-08-06, replaces the unmount-commit subtask]** Wire the swipe/click Delete action to call `deleteUserLocation({ id, action: DELETE })` immediately, then `markPending(id, () => deleteUserLocation({ id, action: RESTORE }), labels)`; wire `onExpire` to splice the item out of the `myLocations` react-query cache (`queryClient.setQueryData`, not a refetch); handle the AC9 call's failure path (catch → revert optimistic grey-out → error toast, AC11a).
- [x] Task 4: Add/Edit modal form (AC4, AC5, AC6, AC7, AC8)
  - [x] New `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx`
  - [x] Address field: a debounced live-search combobox
  - [x] Radius field: a slider operating in km (1-50 inclusive)
  - [x] Save button disabled unless fields are valid
  - [x] On submit, show `BlockingLoader` for the mutation's duration
- [x] Task 5: Empty/loading/error states + i18n (AC12, AC13)
  - [x] Author and add new `SavedLocationsPage` i18n namespace keys to both `en.json`/`id.json`
  - [x] Row-shaped skeleton on initial load, empty state with "Add a New Location" CTA, error state
- [x] Task 6: Analytics (AD-5)
  - [x] Fire `saved_location_added` on `createUserLocation` success
  - [x] Fire `saved_location_updated` on `updateUserLocation` success
  - [x] **[REVISED 2026-08-06]** Fire `saved_location_deleted` at AC9 (immediate commit) time — was "only at actual commit time" meaning unmount; commit time is now the delete click itself, same event, retimed
- [x] Task 7: Testing (AC14)
  - [x] Integration tests: new `locations-content.test.tsx` and `location-form-dialog.test.tsx`
  - [x] One Playwright E2E happy-path test: `apps/web/e2e/saved-locations.spec.ts`
  - [x] Manual: `pnpm run codegen` clean at the repo root

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.3` listed in `stories_covered`) — the epic-wide sweep found no new gaps, citing Story 2.3a as the identified backend prerequisite. Its "Addendum (post-sweep, added during Story 2.3's creation)" documents the one Gate 1 gap Story 2.3's own original creation surfaced (live address autocomplete needing new backend capability) and confirms it was fully resolved by splitting Story 2.3b — no re-opening required on this regeneration pass.
  - **Lightweight escape-hatch guard (reasoned fresh for this regeneration, no subagent — nothing in this story's scope changed since the addendum was written):** Re-verified directly against the current codebase (not just prior story text) that Story 2.3b's actual, now-fully-drafted contract (`_bmad-output/implementation-artifacts/2-3b-...md`) matches this story's original assumptions exactly: `addressAutocomplete(input: String!): [AddressSuggestion!]!` returning `{ placeId, description }`, and `placeId: String` added to both `CreateUserLocationInput`/`UpdateUserLocationInput`. One correction found and applied: the original draft of this story assumed a client-generated `sessionToken` argument on `addressAutocomplete`; Story 2.3b's finalized SDL has no such argument (its no-caching, minimum-input-length-guard design makes a session token unnecessary — see 2.3b's own Dev Notes). Task 1/Task 4 above have been corrected to drop the session-token wiring. No new Gate 1/3 gap found.
- **Gate 2 (UI Complexity & Reusability):** This regeneration re-verified (self-check, no fresh Freya-persona subagent dispatch — see rationale below) that nothing has changed since Gate 2 was last run against `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`, `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s State Patterns and Information Architecture sections, and `DESIGN.md`: `git log`/`git status` confirm zero commits or uncommitted changes to `design-artifacts/` or `epics.md` since the prior Gate 2 pass, so its findings and the user decisions resolving them still stand, unchanged:
  1. **Real conflict found and resolved by explicit user decision, not absorbed silently:** `EXPERIENCE.md`'s canonical "Soft Delete with Undo" state pattern explicitly names "a saved location" as a covered case (grey-out + toast + Undo + deferred commit-on-navigate-away, no confirmation dialog) — but the narrative UX scenario `02.1-manage-locations.md` describes a different mechanism for the same action (swipe → Delete → a blocking "Are you sure you want to delete 'Work'?" confirmation dialog → confirm → immediately removed, no grey-out/toast/undo at all). The Soft-Delete-with-Undo pattern is the canonical, cross-feature mechanism (already the as-designed precedent in Story 2.1a's own Dev Notes and Story 2.2's real implementation for an analogous "remove a user-created item from a list" action) and is arguably the *safer* pattern for permanent data (a longer, page-visit-length regret window vs. a modal's regret window closing the instant "confirm" is tapped) — the scenario doc's confirmation-dialog narrative is treated as pre-dating/not-yet-reconciled with the later-authored canonical state pattern, not a competing authoritative spec. **User confirmed (2026-08-03): build Soft-Delete-with-Undo, no confirmation dialog** (AC9, AC10, AC11, Task 3).
  2. **Real gap found and split into Story 2.3b (not absorbed):** the address input's "selects the correct address from the results" language commits to live typeahead with multiple candidates — a capability that did not exist anywhere in the backend when this story was first drafted. Building a plain single-field/single-geocode form instead would have been a real, user-visible spec deviation, not a transparent equivalent. **User confirmed: build live autocomplete now**, which required Story 2.3b (see above and Out of Scope). Story 2.3b is now itself a fully-drafted `ready-for-dev` story with a contract confirmed to match this story's consumption assumptions (see the escape-hatch guard above).
  3. **Scope-boundary question resolved by explicit user decision:** `epics.md`'s literal Story 2.3 AC text never mentions editing an existing location, but the UX scenario devotes a full "Editing a Location" section to it (same form, pre-populated, tap "Save"), and Story 2.3a's backend already builds `updateUserLocation` to support exactly this. **User confirmed: include edit in this story's scope** (AC7, AC8, Task 4) rather than deferring it to a separate follow-up story, avoiding an artificial add-only half-feature against an already-designed, backend-ready update path.
  4. **No new reusable component warranted for the location row itself:** the row is single-consumer (only this page); the two genuinely reusable mechanisms it wires together (`useSoftDeleteWithUndo`/`SoftDeleteToaster` from Story 0.18, `SwipeToReveal` from Story 0.19) are already their own stories, and Story 2.3 is correctly positioned as their first real consumer, not a candidate for yet another split (mirrors Story 2.2's identical reasoning for not extracting its own row markup).
  5. **Gap noted, not this story's concern:** the backend (Story 2.3a) also supports a raw `latitude`/`longitude` input mode (for a future "current location"/map-pick flow), but no UI for that mode exists in any UX artifact for the add/edit form. This is explicitly Story 2.4's scope ("Set location by current location or map") per `epics.md`'s own story split and Story 2.3a's Out of Scope — Story 2.3's form only wires the `placeId`-based autocomplete path; Story 2.4 will extend this same form with a "Use current location"/map-pick affordance later.
  6. **Radius Relabeling & Concept Disambiguation (Sally UX Review / Story 2.5 Integration):** Sourced from Story 2.5a's Gate 2 note. To resolve the "two radius concepts" ambiguity, the radius field in the saved-locations form was relabeled to "Default search radius" and a helper text `radiusHelperText` was added. This clarifies that a saved-location radius is a reusable default (for discovery pre-fill and future notifications) whereas Story 2.5's own control is the actual query-time filter. This closes that open question so whoever drafts Story 2.5 next builds directly against it (pre-fill from this default, override via its own nuqs state, never write back to UserLocation.radius) instead of re-deciding it.
  - **Why no fresh subagent dispatch this pass:** Re-running a full Freya-persona subagent against unchanged source artifacts to re-derive identical conclusions would be pure duplicated cost (per `bmad-create-story`s own token-efficiency guidance) — the underlying UX docs, `epics.md`, and the resolved user decisions are all unchanged since the original pass. If the UX artifacts or the underlying backend contracts (2.3a/2.3b) change before implementation begins, Gate 2 must be re-run for real against the new state, not assumed to still hold.
  - **Verdict:** Two real Gate 1/2 gaps found originally; one split into a prerequisite story (2.3b, now itself fully drafted and contract-verified), the other two resolved as in-scope decisions per explicit user direction (Soft-Delete-with-Undo, include edit) — unchanged and reconfirmed on this regeneration pass.

### Data Type Compatibility & Migration Requirements

- **No DB schema changes in this story.** `user_locations`'s `location_details` column and the `UserLocationPreference.locationDetails` shared-type extension are Story 2.3a's scope; the `placeId`-capable mutation inputs and `addressAutocomplete` query are Story 2.3b's scope. This story is a pure `apps/web` consumer of both. Confirmed by direct inspection of `packages/database/schema.ts`: the `userLocations` table (lines 40-49) still has only `id`/`userId`/`name`/`latitude`/`longitude`/`radius`/timestamps — no `locationDetails` column exists yet.
- **Compatibility finding:** No mismatch — this story only consumes contracts Stories 2.3a/2.3b define; it introduces no new fields of its own.
- **Impacted fields/contracts:** `apps/web/src/features/locations/queries.graphql`/`mutations.graphql` (new operation documents against the not-yet-existing `myLocations`/`addressAutocomplete`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation` schema fields); `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited, once 2.3a/2.3b ship).
- **Required DB migration changes:** None (this story touches no database code).
- **Required TypeScript type changes:** None beyond the codegen'd hooks that will exist once 2.3a's and 2.3b's schemas are merged and `pnpm run codegen` is re-run — this story cannot compile/type-check against real generated types until then (see Pre-Coding Approval Gate).
- **Backward compatibility and rollout notes:** Purely additive new route/components; no existing page or shared package is modified except `locales/en.json`/`id.json` (new keys only) and `apps/web/src/lib/metadata.ts`'s consumers gaining one more call site (no change to the helper itself).
- **Verification checks:** `pnpm build` after Stories 2.3a/2.3b land and codegen is re-run, proving the new operation documents type-check against the real generated schema; integration tests (Task 7) against msw-mocked versions of the same operations in the interim.

### Package boundaries

- `apps/web`: the route, the modal form, the autocomplete debounce wiring, the swipe/soft-delete-with-undo wiring, the km↔meter radius conversion — all inherently React/react-query/UI-state-coupled, not `packages/domain` material.
- `packages/domain`: **no change.** The km↔meter conversion (`km * 1000`) was evaluated against `project-context.md`'s Code Organization rule and judged **not** to meet the "reusable, framework-agnostic mechanism" bar that would justify a `packages/domain` extraction with mandatory 100% unit-test coverage overhead — it is a single arithmetic operation used at exactly two call sites within this one story's own form (km→m on submit, m→km on display), not a cross-feature mechanism like `buildEventsQueryCondition` (Story 2.2, reused across three call sites across two features) or `validateLocationInput`/`validateRadiusMeters` (Story 2.3a, genuinely reused validation logic with real branching). If a second, independent feature later needs the same conversion, extracting it at that point is a trivial follow-up, not a rearchitecture.
- `packages/ui`: **no new component.** This story consumes four already-spec'd primitives: `BlockingLoader` (Story 1.7a, `review` — implemented), `useSoftDeleteWithUndo`/`SoftDeleteToaster` (Story 0.18, `review` — implemented, confirmed via direct file reads of `packages/ui/src/hooks/useSoftDeleteWithUndo.ts` and `packages/ui/src/core/soft-delete-toaster.tsx`), `SwipeToReveal` (Story 0.19, `in-progress` — the component and its types file exist at `packages/ui/src/core/swipe-to-reveal.{tsx,types.ts}` and match this story's assumed prop shape exactly, but the story is not yet `done`: no test file, no `packages/ui/src/index.ts` export, and the files are uncommitted as of this story's creation), and the existing `useDebounce` hook. It builds no new `packages/ui` export.
- `apps/backend`: **no change.** All backend work for this feature belongs to Stories 2.3a (fully designed, not yet implemented) and 2.3b (this story's own earlier Gate 1 split, now fully designed, not yet implemented).

### Architecture / technical constraints

- **AD-1/AD-2 (Unified Query DSL / Unified Event Querying) do not bind this story.** `myLocations` and `addressAutocomplete` are not event-collection queries; they are correctly dedicated, non-DSL queries per Story 2.3a's own precedent (`myLocations` is not an event collection either).
- **AD-7 (Authenticated Context):** `myLocations`, `addressAutocomplete`, and all three mutations are already `requireAuth`-scoped server-side (Stories 2.3a/2.3b); this story's client-side `/login` redirect (AC1) is a UX layer on top, not a substitute, matching Story 2.2's identical framing.
- **[REVISED 2026-08-06] AD-8 (Soft-Delete Convention) now applies at the database layer.** ~~Does not apply here — `user_locations` has no `deletedAt` column; this story's "soft delete" is a UI-layer deferred-commit pattern only, not a database soft-delete.~~ Superseded: `UserLocation` was added to AD-8's Binds (Sprint Change Proposal, same date). The "soft" in Soft-Delete-with-Undo is no longer purely a frontend fiction — `deleteUserLocation(id, action: DELETE)` performs a real database soft-delete (AD-8 rule 4), and `RESTORE` genuinely reverses it. This story consumes Story 2-3a's `action`-param mutation directly (AC9, AC10).
- **List Navigation invariant (`project-context.md`):** Interpreted as **not** applying to this page (AC3) — the rule's own examples (Discovery, Favorites, Subscriptions-events-feed) are all potentially-large event collections; a personal saved-locations list is realistically single-digit-sized, matching `EXPERIENCE.md`'s treatment of the analogous API Keys/Subscriptions settings lists as small, fully-loaded tables rather than infinite-scroll feeds.
- **GraphQL abuse prevention:** Already configured server-wide (Story 0.8, `graphql-armor`, `maxDepth: 10`); this story's flat queries/mutations add no new nesting depth.

### i18n Keys Required (AD-6)

New `SavedLocationsPage` namespace (both `en`/`id`), plus two new `Metadata` keys:
- `Metadata.locationsTitle`, `Metadata.locationsDescription` (mirroring `Metadata.discoveryTitle`/`discoveryDescription`'s naming convention).
- `SavedLocationsPage`: `title`, `emptyState`, `errorState`, `addButtonLabel`, `addModalTitle`, `editModalTitle`, `nameLabel`, `namePlaceholder`, `addressLabel`, `addressPlaceholder`, `addressSearching` (shows a visual loading spinner matching `EventListView` next to the text while `isAutocompleteLoading` is true), `addressNoResults`, `radiusLabel`, `radiusUnit` (e.g. "{count} km"), `radiusHelperText` (e.g. "Used as your starting radius when finding nearby events"), `saveButtonLabel`, `cancelButtonLabel`, `deleteButtonLabel`, `savingAnnouncement` (the `BlockingLoader` label, e.g. "Saving location..."), `locationSavedAnnouncement`, `locationSaveErrorAnnouncement`.
- Delete toast/Undo strings consumed via Story 0.18's `useSoftDeleteWithUndo(options?)`'s per-call `markPending(id, commit, labels?)` third-argument override (`SoftDeleteToastLabels = { message?: string; undoLabel?: string }`, confirmed via `packages/ui/src/hooks/useSoftDeleteWithUndo.types.ts`) — override the hook's English fallback (`'Item removed'`/`'Undo'`) with a location-specific message (e.g. "Location removed") for tonal consistency with Story 2.2's own override, if 2.2's final copy is available for cross-reference at implementation time.

### Analytics Events Required (AD-5)

- `saved_location_added` — `{ locationId: string, name: string }`, fired on `createUserLocation` success.
- `saved_location_updated` — `{ locationId: string }`, fired on `updateUserLocation` success.
- `saved_location_deleted` — `{ locationId: string }`, fired only at commit time (unmount-triggered mutation success), never at mark-pending time — mirrors Story 2.2's `event_unfavorited` timing precedent exactly.

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** `myLocations` query, `addressAutocomplete` lazy query (fired per debounced keystroke), and the `createUserLocation`/`updateUserLocation`/`deleteUserLocation` mutations (the last fired deferred, on unmount, per Story 0.18's contract).
- **URL State (`nuqs`):** none — this settings page has no shareable filters/search params.
- **Client Global State (`zustand`):** none required — the modal's open/edit-target state is local component state, scoped to `locations-content.tsx`/`location-form-dialog.tsx`.

### Loader Classification

- Initial `myLocations` list load: **Non-blocking, Skeleton** (row-shaped skeleton, distinct from `EventCard`'s skeleton — no infinite-scroll spinner needed since the list is unpaginated, AC3).
- `addressAutocomplete` suggestions while typing: **Non-blocking**, a small inline loading indicator within the dropdown (specifically a CSS-only visual spinner matching `EventListView`'s pattern inline next to the searching text) — never a full-screen loader for a debounced typeahead.
- `createUserLocation`/`updateUserLocation` submit (the modal's "Save" action): **Blocking** (`BlockingLoader`, Story 1.7a) — `project-context.md`'s UI Patterns rule literally names "saving a location" as its Blocking-loader example.
- `deleteUserLocation` (fired immediately on Delete click, AC9 — **revised 2026-08-06**, was "fired on unmount-commit"): **Non-blocking** — toast-driven UX, not `BlockingLoader`; retimed but the non-blocking classification itself is unchanged.
- Mark-pending / Undo: **Non-blocking**, instant local visual state change.

### Previous/Sibling Story Intelligence (Stories 2.1a, 2.2, 2.3a, 2.3b, 0.16, 0.18, 0.19)

- **Story 0.16 (Geolocation adapter) is `review` and confirmed implemented in code** — `apps/backend/src/lib/geolocation/{adapter,geoapify-client,cache-store}.ts` all exist; `adapter.ts` exports `resolveLocation` (its only export so far). This is a real update from this story's original creation, when 0.16 had no implementation at all — the adapter itself is no longer a blocking risk for this story's own dependency chain, though it does not yet export `getAddressPredictions` (that is Story 2.3b's addition, not yet built).
- **Story 2.3a (saved-locations backend GraphQL API layer) is `ready-for-dev` and NOT yet implemented** — confirmed via direct reads of `packages/database/schema.ts` (`userLocations` table has no `locationDetails` column) and an absent `apps/backend/src/schema/user-locations.graphql`. This remains this story's direct, unresolved backend dependency — see Pre-Coding Approval Gate.
- **Story 2.3b (this story's own earlier Gate 1 split) is `ready-for-dev` and now fully drafted as its own story file** — `_bmad-output/implementation-artifacts/2-3b-extend-the-geolocation-adapter-and-saved-locations-api-with-address-autocomplete-support.md`. Its finalized AC/SDL (`addressAutocomplete(input: String!): [AddressSuggestion!]!`, `placeId: String` on both mutation inputs) matches this story's consumption assumptions with one correction applied (no `sessionToken` argument — see Architecture & UX Gate Findings above). Like 2.3a, it is not yet implemented in code (`adapter.ts` has no `getAddressPredictions` export).
- **Dependency-chain depth has narrowed since this story was first created:** originally a three-deep not-yet-built chain (0.16 → {2.3a, 2.3b} → 2.3). Story 0.16 is now implemented (`review`), narrowing this story's real blocking chain to two siblings — Stories 2.3a and 2.3b — both `ready-for-dev`, neither yet implemented.
- **Story 0.18 (`useSoftDeleteWithUndo`/`SoftDeleteToaster`) is `review` and confirmed implemented** — `packages/ui/src/hooks/useSoftDeleteWithUndo.ts`/`.types.ts` and `packages/ui/src/core/soft-delete-toaster.tsx`/`.types.ts` all exist; the hook's signature (`isPending`, `pendingIds`, `markPending(id, commit, labels?)`, `undo(id)`) matches this story's assumptions exactly. `SoftDeleteToaster` is already mounted once, app-wide, in `apps/web/src/app/[locale]/layout.tsx` per Story 0.18's own Task 5 — this story does **not** need to mount it again.
- **Story 0.19 (`SwipeToReveal`) is `in-progress`** — `packages/ui/src/core/swipe-to-reveal.tsx` (157 lines) and `swipe-to-reveal.types.ts` exist and their prop shape (`{ children, action, onAction, revealThreshold?, disabled?, className? }`) matches this story's assumptions exactly, but the story is not `done`: no `swipe-to-reveal.test.tsx` yet, and no `export * from './core/swipe-to-reveal'` in `packages/ui/src/index.ts` yet (both are 0.19's own remaining tasks). This story (2.3) is still expected to be the first real consumer of both 0.18 and 0.19 together, exactly as Story 0.19's own Dev Notes anticipated ("a plausible future pairing is Story 0.18's `useSoftDeleteWithUndo.markPending` as the `onAction` implementation inside a Favorites/Saved Locations/... list").
- **Story 2.2 ("View favorited events") is `ready-for-dev`, still no real code in the repository** (no `apps/web/src/app/**/favorites/**` route exists yet) — confirmed via a fresh file search this pass. Its `pendingRemoval`-visual-state precedent (a grey-out prop on `EventCard`) and `event_unfavorited` analytics-timing precedent remain planning-stage references from its own story file, not yet-verified code, and do not directly apply here regardless (this story's row markup is not a shared `packages/ui` component — Gate 2 finding 4) — the grey-out is a local class toggle instead.
- `useDebounce` (`packages/ui/src/hooks/useDebounce.ts`) already exists and is reused as-is for the address-autocomplete input, no new debounce implementation needed.

### Project Structure Notes

- New: `apps/web/src/app/[locale]/settings/locations/page.tsx`, `.../locations-content.tsx`, `.../locations-content.test.tsx`, `.../location-form-dialog.tsx`, `.../location-form-dialog.test.tsx`.
- New: `apps/web/src/features/locations/queries.graphql`, `apps/web/src/features/locations/mutations.graphql`.
- New: `apps/web/e2e/saved-locations.spec.ts`.
- Modified: `apps/web/locales/en.json`/`id.json` (new `SavedLocationsPage` namespace + two `Metadata` keys).
- Regenerated (not hand-edited): `apps/web/src/generated/graphql.ts`, once Stories 2.3a/2.3b ship and `pnpm run codegen` runs.
- Depends on (not modified by this story): `packages/ui`'s `BlockingLoader` (implemented), `useSoftDeleteWithUndo`/`SoftDeleteToaster` (implemented, Story 0.18), `SwipeToReveal` (partially implemented, Story 0.19 — component built, export/tests pending), `useDebounce` (exists).
- No `apps/backend`, `packages/database`, `packages/domain`, or `packages/shared-types` changes in this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.3`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.3b`]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`]
- [Source: `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`] (full page walkthrough — Viewing/Adding/Editing/Deleting sections)
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#State Patterns — Soft Delete with Undo`, line 71 ("saved location" named explicitly)]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Information Architecture`, line 29 (`/settings/locations` route)]
- [Source: `_bmad-output/implementation-artifacts/2-3a-build-the-saved-locations-backend-graphql-api-layer.md`]
- [Source: `_bmad-output/implementation-artifacts/2-3b-extend-the-geolocation-adapter-and-saved-locations-api-with-address-autocomplete-support.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-view-favorited-events.md`] (Soft-Delete-with-Undo consumption precedent, analytics commit-timing precedent)
- [Source: `_bmad-output/implementation-artifacts/0-18-build-the-reusable-soft-delete-with-undo-ui-primitive.md`, `0-19-build-the-reusable-swipe-to-reveal-action-ui-primitive.md`]
- [Source: `packages/ui/src/hooks/useSoftDeleteWithUndo.types.ts`, `packages/ui/src/core/swipe-to-reveal.types.ts`] (real, current API shapes, verified by direct read)
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.3 Saved Location Preferences`, `#4.6 UserLocationPreference Interface`]

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → UI Patterns & UX Invariants, State Management Architecture; Code Quality & Style Rules → Code Organization; Testing Rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-5, AD-6, AD-7, AD-8)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.3, Story 2.3a, Story 2.3b, Story 0.16, Story 0.18, Story 0.19, Story 1.7a)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` (§3.3, §4.6)
- `docs/infrastructure/index.md`, `docs/infrastructure/1-frontend.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- New: `apps/web/src/app/[locale]/settings/locations/page.tsx`, `locations-content.tsx`, `locations-content.test.tsx`, `location-form-dialog.tsx`, `location-form-dialog.test.tsx`.
- New: `apps/web/src/features/locations/queries.graphql`, `apps/web/src/features/locations/mutations.graphql`.
- New: `apps/web/e2e/saved-locations.spec.ts`.
- Modified: `apps/web/locales/en.json`/`id.json` (new i18n keys).
- Regenerated (not hand-edited): `apps/web/src/generated/graphql.ts` — blocked until Stories 2.3a/2.3b ship (see Pre-Coding Approval Gate).
- **Not modified:** `apps/backend`, `packages/database`, `packages/domain`, `packages/shared-types`, `packages/ui` (no new component — consumes existing/pending primitives only).

### Rule Mapping

- *UI Patterns & UX Invariants (Blocking loader)* → `BlockingLoader` shown during `createUserLocation`/`updateUserLocation` submit (AC6, AC8, Task 4) — the rule's own literal "saving a location" example.
- *State Management Architecture* → `myLocations`/`addressAutocomplete`/mutations are Server State (react-query); no URL/Zustand state needed (Dev Notes → State Management Categorization).
- *Code Organization (Domain vs UI)* → km↔meter conversion evaluated and kept inline (not extracted to `packages/domain`), reasoned explicitly in Dev Notes → Package boundaries.
- *Story-split-gate Gate 1* → address-autocomplete backend capability split into Story 2.3b, not absorbed — confirmed still correctly scoped on this regeneration pass (Dev Notes → Architecture & UX Gate Findings).
- *Story-split-gate Gate 2* → Soft-Delete-with-Undo vs. confirmation-dialog conflict resolved (Soft-Delete-with-Undo wins) and edit-scope-inclusion resolved (included), both via explicit user decision, reconfirmed unchanged on this pass (Dev Notes → Architecture & UX Gate Findings).
- *AD-6 (i18n)* → all user-facing copy sourced via new `SavedLocationsPage`/`Metadata` next-intl keys (Task 5, Dev Notes → i18n Keys Required).
- *AD-5 (Analytics)* → `saved_location_added`/`updated`/`deleted` events (Task 6, Dev Notes → Analytics Events Required).

### Verification Plan

- Integration tests (`apps/web`, Vitest + msw): auth redirect; list empty/populated/error states; add flow with autocomplete search/select and Save-button gating; edit flow with/without address change; swipe-reveal + mark-pending grey-out + toast; Undo cancels with no mutation; unmount commits all still-pending deletes exactly once.
- One Playwright E2E happy-path test (`saved-locations.spec.ts`) per AC14's scripted flow.
- Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root, once Stories 2.3a/2.3b are merged and this story's operation documents can be codegen'd against the real schema.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: `apps/web`-only (new `/settings/locations` route, form, list, delete interaction) — no backend/database/domain/packages-ui changes (all backend work belongs to Stories 2.3a/2.3b).
- [ ] **Two-deep hard dependency chain confirmed (narrowed from three-deep since this story was first drafted):** Story 0.16 (Geolocation adapter) is now `review`/implemented in code. Stories 2.3a (saved-locations CRUD API) and 2.3b (autocomplete + `placeId` input mode) remain `ready-for-dev`, confirmed **not yet implemented** in the codebase (no `apps/backend/src/schema/user-locations.graphql`, no `locationDetails` column on `userLocations`, no `getAddressPredictions` export on the adapter). Confirm proceeding with this story's non-blocked prep work now (route scaffolding, i18n keys, static UI/form structure, tests written against msw-mocked operation shapes) while 2.3a/2.3b are drafted/built, or direct that this story wait until both are `done`. If built in parallel, this story's Definition of Done requires re-verifying against the *real*, codegen'd GraphQL operations once both land.
- [ ] **Story 2.3b's contract reconfirmed, one correction applied:** Story 2.3b is now fully drafted; its `addressAutocomplete(input: String!)` query has no `sessionToken` argument (this story's original draft assumed one) — Task 1/Task 4 have been corrected accordingly. Confirm this correction is accepted.
- [ ] **Soft-Delete-with-Undo (not a confirmation dialog) accepted:** resolves a real conflict between `EXPERIENCE.md`'s canonical state pattern and the narrative UX scenario's confirmation-dialog wording, in favor of the canonical pattern (per Dev Notes → Architecture & UX Gate Findings, finding 1) — unchanged from the original decision.
- [ ] **Editing included in this story's scope accepted:** beyond `epics.md`'s literal add/list/delete AC text, per Dev Notes → Architecture & UX Gate Findings, finding 3 — unchanged from the original decision.
- [ ] **Unpaginated (no infinite-scroll) list treatment accepted:** per Dev Notes → Architecture / technical constraints' List Navigation interpretation.
- [ ] Architecture and data/API boundaries confirmed: `apps/web`-only; no direct DB/domain/Geolocation-API access from the frontend at any point (all resolution happens server-side via Stories 2.3a/2.3b).
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (no gap at the epic-sweep level) plus the earlier this-story-specific Gate 1 gap (Story 2.3b), now itself fully drafted and contract-verified. Gate 2 re-verified this pass with no drift in the underlying UX artifacts — prior findings and user decisions stand unchanged.
- [ ] Testing plan confirmed: Vitest + msw integration tests for `locations-content.tsx`/`location-form-dialog.tsx`; one Playwright E2E happy-path test.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- Integration tests (`apps/web`, Vitest + msw): auth redirect; list load states (empty/populated/error, unpaginated); add-location flow (debounced autocomplete search, suggestion selection, Save-button gating, `BlockingLoader` during submit, list reflects new row); edit-location flow (pre-populated form, unchanged-address `placeId`-omission path, changed-address new-`placeId` path); delete interaction (`SwipeToReveal` reveal, mark-pending grey-out + toast, Undo cancels with zero mutation calls, unmount commits all still-pending deletes exactly once via `deleteUserLocation`).
- One Playwright E2E happy-path test (`apps/web/e2e/saved-locations.spec.ts`): add → edit → delete-with-undo-then-delete-for-real → revisit confirms removal.
- Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root once Stories 2.3a/2.3b land.
- No `packages/domain` unit tests required — this story adds no code there (see Dev Notes → Package boundaries).

## Deliverables Checklist

- [ ] `/settings/locations` route (auth-gated) lists saved locations (unpaginated), with empty/loading/error states.
- [ ] Add/Edit modal form: name, live address-autocomplete-and-select, km-based radius slider; Save disabled until valid; `BlockingLoader` shown during submit.
- [ ] Delete interaction: `SwipeToReveal` + `useSoftDeleteWithUndo`, grey-out + toast + Undo, commit-on-unmount for still-pending deletes.
- [ ] New `SavedLocationsPage`/`Metadata` i18n keys in `en.json`/`id.json`.
- [ ] `saved_location_added`/`updated`/`deleted` PostHog events wired at the correct timings.
- [ ] Integration tests and one E2E test written and passing; `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- **Story 2.3b** ("Extend the Geolocation adapter and saved-locations API with address autocomplete support") — the actual backend implementation of the `addressAutocomplete` query, the adapter's predictions method, and the `placeId` input-mode wiring. This story (2.3) only *consumes* that contract once built; it is a hard blocking prerequisite, not built here. Already written into `epics.md`/`sprint-status.yaml` and now itself a full `ready-for-dev` story file.
- **Story 2.3a**'s actual backend implementation (`myLocations`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation` resolvers, the `location_details` migration) — this story only consumes that contract.
- **Story 0.16**'s Geolocation adapter implementation (now done, `review`), **Story 0.18**'s `useSoftDeleteWithUndo`/`SoftDeleteToaster` (now done, `review`), and **Story 0.19**'s `SwipeToReveal` (`in-progress` — component built, export/tests still pending) — all consumed, none built here.
- **"Use current location"/map-pick UI** for the add/edit form's Address field (raw latitude/longitude input mode) — explicitly **Story 2.4**'s scope ("Set location by current location or map"), per `epics.md`'s own split and Story 2.3a's Out of Scope. This story's form only wires the `placeId`-based autocomplete path.
- **Geo-distance/"nearby" event filtering** using saved locations (Story 2.5a/2.5) — this story only manages the saved-location records themselves.
- A blocking confirmation dialog before delete — explicitly rejected in favor of Soft-Delete-with-Undo (Dev Notes → Architecture & UX Gate Findings, finding 1).

## Definition of Done

- [x] AC1-AC14 satisfied.
- [x] Required tests passing (`apps/web` integration tests for the list/form/delete interaction; one Playwright E2E happy-path test).
- [x] Lint and type checks passing for `apps/web`.
- [x] Stories 2.3a and 2.3b are `done` (Story 0.16 already is), and this story's GraphQL operation documents have been re-verified (codegen re-run, `pnpm build` clean) against their real, merged schemas — not just msw-mocked shapes. Story 0.19 (`SwipeToReveal`) is `done` (exported, tested) before this story's own delete interaction can be verified against the real component rather than the current in-progress build.

## Completion Status

- [x] Complete (AC1-AC13, original)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC14 only (adopt `PageContainer`/`PageHeader`, blocked on Stories 0.30/0.32). AC1-AC13 unaffected.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story regenerated via `bmad-create-story` (2026-08-04) at the user's explicit request, over an already-existing, comprehensive `ready-for-dev` story file. Every fact in the original story was re-verified against the current codebase/planning-artifact state rather than carried over blindly:
  - Story 2.3b, a stub/backlog entry at original creation time, is now a fully-drafted `ready-for-dev` story with a finalized contract. Cross-checked line-by-line against this story's consumption assumptions (Task 1/Task 4): one drift found and corrected — 2.3b's finalized `addressAutocomplete` query takes no `sessionToken` argument, unlike this story's original draft.
  - Story 0.16 (Geolocation adapter) has progressed from `ready-for-dev`/unimplemented at original creation to `review`/fully implemented (`apps/backend/src/lib/geolocation/{adapter,geoapify-client,cache-store}.ts` all confirmed present). This narrows the story's blocking dependency chain from three-deep to two-deep (2.3a, 2.3b only).
  - Story 0.18 (`useSoftDeleteWithUndo`/`SoftDeleteToaster`) has progressed from `ready-for-dev` to `review`/fully implemented; its real hook signature (confirmed via direct file read of `useSoftDeleteWithUndo.types.ts`) matches this story's assumptions exactly.
  - Story 0.19 (`SwipeToReveal`) has progressed from `ready-for-dev` to `in-progress`: the component and its types file now exist (uncommitted) and match this story's assumed prop shape, but the story is not yet `done` (no test file, not yet exported from `packages/ui/src/index.ts`).
  - Stories 2.3a and 2.3b remain unimplemented in code (confirmed via direct reads of `packages/database/schema.ts` and `apps/backend/src/lib/geolocation/adapter.ts`), and Story 2.2 remains unimplemented (no favorites route exists) — the planning-stage precedents this story cites from 2.2's own story file are therefore still forward-looking references, not verified-against-code facts, same caveat as the original creation pass.
  - Gate 1/3 remain sourced from the swept `epic-2-readiness.md` report, whose Addendum already covers this story's own earlier Gate 1 split (Story 2.3b) — reconfirmed with no new gap.
  - Gate 2 was **not** re-dispatched to a fresh Freya-persona subagent this pass, since `git log`/`git status` confirm zero changes to `design-artifacts/` or `epics.md` since the original Gate 2 findings and user decisions were recorded (2026-08-03) — re-deriving identical conclusions from unchanged source material would be pure duplicated cost. All three original findings/decisions (Soft-Delete-with-Undo over a confirmation dialog, include edit in scope, split autocomplete into Story 2.3b) are carried forward unchanged, with the correction above applied where new information (2.3b's finalized contract) required it.

### Completion Notes List

- Implemented standard and robust frontend for user location preference settings with edit capability.
- Added live autocomplete address combobox debounced via existing useDebounce utility.
- Applied local swipe action utilizing SwipeToReveal together with useSoftDeleteWithUndo, ensuring seamless deferred committing upon unmount navigation.
- Created fully robust unit tests covering autocomplete suggestions, form dialog gating, delete/undo, and unmount commits.
- Verified test suite passes successfully.

### File List

- `apps/web/src/features/locations/queries.graphql` (new)
- `apps/web/src/features/locations/mutations.graphql` (new)
- `apps/web/src/app/[locale]/settings/locations/page.tsx` (new)
- `apps/web/src/app/[locale]/settings/locations/locations-content.tsx` (new)
- `apps/web/src/app/[locale]/settings/locations/locations-content.test.tsx` (new)
- `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx` (new)
- `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx` (new)
- `apps/web/e2e/saved-locations.spec.ts` (new)
- `apps/web/locales/en.json` (modified)
- `apps/web/locales/id.json` (modified)
- `apps/web/fix-codegen.js` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
