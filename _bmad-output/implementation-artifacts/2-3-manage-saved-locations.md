---
baseline_commit: 7d47fc5a52aa10839fafd393ff4ea1d5a26a052a
---
# Story 2.3: Manage saved locations

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.3
- Status: ready-for-dev

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
9. **And** each location row is wrapped in `SwipeToReveal` (Story 0.19) revealing a "Delete" action (with its built-in always-present non-touch equivalent control for desktop/keyboard users — never swipe-only, per Story 0.19 AC4). Tapping/activating "Delete" calls `useSoftDeleteWithUndo`'s `markPending(id, commit)` (Story 0.18) — the row does **not** disappear immediately; it greys out in place and a toast with an "Undo" action appears (Story 0.18's `SoftDeleteToaster`, already mounted app-wide). This follows `EXPERIENCE.md`'s canonical "Soft Delete with Undo" pattern, which explicitly names "a saved location" as a covered case — **no** blocking "Are you sure?" confirmation dialog is shown (a per-story user decision recorded in Dev Notes → Architecture & UX Gate Findings, resolving a real conflict between `EXPERIENCE.md`'s state pattern and the narrative UX scenario's confirmation-dialog wording).
10. **And** clicking "Undo" (in the toast) reverts the row to its normal, saved state — no mutation is ever sent to the server for that action.
11. **And** if I navigate away from `/settings/locations` (the page fully unmounts) while one or more rows are still "pending removal" (Undo never clicked), the `deleteUserLocation` mutation (Story 2.3a) fires for each still-pending location exactly once, committing the delete server-side. The next time I load `/settings/locations`, those locations are correctly absent.
12. **And** an empty state, a loading skeleton (matching row-shaped skeletons, not `EventCard`'s skeleton), and an error state are all shown as appropriate for the list load — none of these currently exist in any UX artifact for this page, so their copy is authored fresh in this story (see Dev Notes → i18n Keys Required).
13. **And** all user-facing labels, the empty/loading/error copy, the modal form's field labels/placeholders, and the delete toast/Undo strings are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings.
14. **And** integration tests (Vitest + msw) verify: auth redirect, list render (empty/populated/error), add flow (autocomplete search → select suggestion → save → appears in list, `BlockingLoader` shown), edit flow (pre-populated form; save with unchanged address omits `placeId`; save with a newly-selected address includes the new `placeId`), Save button disabled until a valid selection/radius exist, swipe/delete reveals the action, mark-pending grey-out + toast, Undo cancels with no mutation call, and unmount commits all still-pending deletes exactly once via `deleteUserLocation`. One Playwright E2E test covers the authenticated happy path: open "My Locations" → add "Home" via autocomplete → see it in the list → edit its radius → save → swipe "Home" and delete → Undo → still present → delete again → navigate away → revisit the page → "Home" is gone.

**Note (AC correction vs. `epics.md`):** `epics.md`'s Story 2.3 AC text only covers add (name + address)/list/delete, with no mention of editing, the delete-interaction mechanism, or the address-input UX. ACs 3-11 above were derived from extensive discussion with the user (2026-08-03) resolving concrete design questions this terse AC text left open (see Dev Notes → Architecture & UX Gate Findings) and are authoritative for this story going forward — including a new, currently-unbuilt backend dependency (Story 2.3b) this story's own creation surfaced.

## Tasks / Subtasks

- [ ] Task 1: GraphQL operation documents (AC2, AC5, AC6, AC8)
  - [ ] Create `apps/web/src/features/locations/queries.graphql`: `query getMyLocations { myLocations { id name locationDetails { formattedAddress placeName coordinates { latitude longitude } } radius createdAt updatedAt } }` and `query addressAutocomplete($input: String!, $sessionToken: String) { addressAutocomplete(input: $input, sessionToken: $sessionToken) { placeId description } }` (Story 2.3b's not-yet-existing query — this document cannot be codegen'd until 2.3b ships, see Pre-Coding Approval Gate).
  - [ ] Create `apps/web/src/features/locations/mutations.graphql`: `createUserLocation`, `updateUserLocation`, `deleteUserLocation` mutations matching Story 2.3a's/2.3b's contracts exactly (`input: { name, placeId, radius }` for create; `id`, `input: { name, placeId, radius }` all-optional for update; `id` for delete returning `Boolean!`).
  - [ ] Run `pnpm run codegen` once Stories 2.3a and 2.3b are merged (blocked until then — see Pre-Coding Approval Gate).
- [ ] Task 2: Route and data layer (AC1, AC2, AC3, AC12)
  - [ ] New `apps/web/src/app/[locale]/settings/locations/page.tsx` (Server Component, `generateMetadata` via a new `Metadata.locationsTitle`/`Metadata.locationsDescription` i18n pair + `apps/web/src/lib/metadata.ts`'s `buildPageMetadata` helper, mirroring `apps/web/src/app/[locale]/favorites/page.tsx`) rendering a new colocated `locations-content.tsx` (Client Component).
  - [ ] In `locations-content.tsx`: auth gate via `useAuthSession()` (`router.push('/login')` if no session — AC1); `useGetMyLocationsQuery` (generated, no pagination args — AC3); skeleton/empty/error states (AC12).
- [ ] Task 3: Location row + delete interaction (AC9, AC10, AC11)
  - [ ] Build the row markup directly inside `locations-content.tsx` (or a small colocated, single-consumer `location-row.tsx` if the file grows unwieldy — a dev-time judgment call, not a `packages/ui` component per Gate 2's finding that this row is single-consumer today) wrapping each location's content in `SwipeToReveal` (`@festgrid/ui`, Story 0.19) with a "Delete" `action`, `onAction` wired to `useSoftDeleteWithUndo`'s `markPending(location.id, commit)` (Story 0.18) where `commit` calls `useDeleteUserLocationMutation`.
  - [ ] Apply a greyed-out visual treatment to a row while `isPending(location.id)` is true (a local Tailwind class toggle — no new `packages/ui` prop needed, unlike `EventCard`'s `pendingRemoval` prop in Story 2.2, since this row markup is not a shared component here).
  - [ ] Confirm (via test, not assumption) that unmounting `locations-content.tsx` (navigating away) triggers `useSoftDeleteWithUndo`'s commit-on-unmount for every still-pending row exactly once (AC11).
- [ ] Task 4: Add/Edit modal form (AC4, AC5, AC6, AC7, AC8)
  - [ ] New `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx` (`"use client"`) — a shadcn `Dialog` accepting an optional `location` prop (undefined → Add mode; a `UserLocation` → Edit mode, pre-filling `name`/`locationDetails.formattedAddress`(display-only)/`radius`(km-converted)).
  - [ ] Address field: a debounced (`useDebounce`, `packages/ui`) live-search combobox — on input change, call `useAddressAutocompleteLazyQuery` (or equivalent generated lazy-query hook once Story 2.3b's codegen exists) with a session token generated once per dialog-open (`crypto.randomUUID()`, native, no new dependency) and reused across calls until a suggestion is selected or the dialog closes; render the returned suggestions in a dropdown; selecting one stores its `placeId` and replaces the visible text with the suggestion's `description`, clearing any previously-selected `placeId` if the user starts typing again.
  - [ ] Radius field: a slider (shadcn `Slider`) operating in km (1-50 inclusive), converting to/from the backend's meter-based `radius` (`km * 1000`) only at the mutation-call boundary — no `packages/domain` extraction for this trivial, single-story, two-call-site conversion (see Dev Notes → Package boundaries for why this doesn't meet the reusable-mechanism bar).
  - [ ] Save button disabled unless: `name` is non-empty, radius is a valid 1-50 km value, and (Add mode: a `placeId` is selected) or (Edit mode: either a new `placeId` is selected or the address was left untouched — no address selection required to save an edit that only changes `name`/`radius`).
  - [ ] On submit, show `BlockingLoader` (`@festgrid/ui`, Story 1.7a) for the mutation's duration (AC6, AC8); call `useCreateUserLocationMutation`/`useUpdateUserLocationMutation` as appropriate; on success, close the dialog and invalidate/refetch `getMyLocations` (or optimistically append/patch the react-query cache — dev's choice) so the list reflects the change without a manual refresh.
- [ ] Task 5: Empty/loading/error states + i18n (AC12, AC13)
  - [ ] Author and add new `SavedLocationsPage` i18n namespace keys (Dev Notes → i18n Keys Required) to both `en.json`/`id.json`, plus `Metadata.locationsTitle`/`Metadata.locationsDescription`.
  - [ ] Row-shaped skeleton on initial load (not `EventCard`'s skeleton — a simpler list-row shape), empty state with "Add a New Location" CTA, error state.
- [ ] Task 6: Analytics (AD-5)
  - [ ] Fire `saved_location_added` (`{ locationId: string, name: string }`) on `createUserLocation` success.
  - [ ] Fire `saved_location_updated` (`{ locationId: string }`) on `updateUserLocation` success.
  - [ ] Fire `saved_location_deleted` (`{ locationId: string }`) only at actual commit time (unmount-triggered mutation success, mirroring Story 2.2's `event_unfavorited` timing) — never at mark-pending time, and never if Undo was clicked.
- [ ] Task 7: Testing (AC14)
  - [ ] Integration tests (`apps/web`, Vitest + msw): new `locations-content.test.tsx` (auth redirect, list states, delete/undo/commit-on-unmount) and `location-form-dialog.test.tsx` (autocomplete search/select, Save-button gating, add submit, edit submit with/without address change, `BlockingLoader` shown during submit).
  - [ ] One Playwright E2E happy-path test: `apps/web/e2e/saved-locations.spec.ts` (mirrors `discovery.spec.ts`/`event-details.spec.ts`'s existing conventions), per AC14's scripted flow.
  - [ ] Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root, once Stories 2.3a/2.3b are merged.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.3` listed in `stories_covered`) — the epic-wide sweep found no new gaps, citing Story 2.3a as the identified backend prerequisite.
  - **Lightweight escape-hatch guard (reasoned fresh for this story, no subagent — the epic-wide sweep could not have anticipated this, since it depends on a user decision made *during* this story's own creation):** The user directed that Story 2.3 build a real live address-autocomplete/typeahead experience (matching the UX scenario's "selects the correct address from the results" language) rather than a plain single-field/single-geocode form. Neither Story 0.16's Geolocation adapter nor Story 2.3a's `CreateUserLocationInput`/`UpdateUserLocationInput` expose any predictions/autocomplete capability or a `placeId` input mode — confirmed via grep of Story 0.16's full story file (only `geocodeAddress`/`reverseGeocode`/`getPlaceDetails`/`resolveLocation`/`resolveTimezone` exist; no `autocomplete`/`predictions` method) and of the actual `packages/database/schema.ts`/`packages/shared-types` (neither yet has Story 2.3a's changes applied at all — both are `ready-for-dev`, not `done`). **Judged a genuine Gate 1 gap, not absorbable into this story:** it is new backend API surface (a new GraphQL query, a new adapter method wrapping a Google API endpoint 0.16 never called) that Story 2.3a's already-fixed contract does not cover. **Action taken:** split into new **Story 2.3b** ("Extend the Geolocation adapter and saved-locations API with address autocomplete support"), written as a full section into `epics.md` (positioned immediately after Story 2.3a, before Story 2.3) and added as a `backlog` entry to `sprint-status.yaml`. This story (2.3) consumes 2.3b's `addressAutocomplete` query and `placeId` input mode (Task 1, Task 4) rather than building them ad hoc.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya-persona subagent against `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`, `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s State Patterns and Information Architecture sections, and a full-text check of `DESIGN.md` (zero "location" matches — no existing tokens for a location row/list-item component). Findings:
  1. **Real conflict found and resolved by explicit user decision, not absorbed silently:** `EXPERIENCE.md`'s canonical "Soft Delete with Undo" state pattern explicitly names "a saved location" as a covered case (grey-out + toast + Undo + deferred commit-on-navigate-away, no confirmation dialog) — but the narrative UX scenario `02.1-manage-locations.md` describes a different mechanism for the same action (swipe → Delete → a blocking "Are you sure you want to delete 'Work'?" confirmation dialog → confirm → immediately removed, no grey-out/toast/undo at all). Freya's analysis: the Soft-Delete-with-Undo pattern is the canonical, cross-feature mechanism (already the as-designed precedent in Story 2.1a's own Dev Notes and Story 2.2's real implementation for an analogous "remove a user-created item from a list" action) and is arguably the *safer* pattern for permanent data (a longer, page-visit-length regret window vs. a modal's regret window closing the instant "confirm" is tapped) — the scenario doc's confirmation-dialog narrative is treated as pre-dating/not-yet-reconciled with the later-authored canonical state pattern, not a competing authoritative spec. **User confirmed: build Soft-Delete-with-Undo, no confirmation dialog** (AC9, AC10, AC11, Task 3).
  2. **Real gap found and split into Story 2.3b (not absorbed):** the address input's "selects the correct address from the results" language commits to live typeahead with multiple candidates — a capability that does not exist anywhere in the backend today. Building a plain single-field/single-geocode form instead would be a real, user-visible spec deviation, not a transparent equivalent. **User confirmed: build live autocomplete now**, which requires Story 2.3b (see Architecture & UX Gate Findings above and Out of Scope).
  3. **Scope-boundary question resolved by explicit user decision:** `epics.md`'s literal Story 2.3 AC text never mentions editing an existing location, but the UX scenario devotes a full "Editing a Location" section to it (same form, pre-populated, tap "Save"), and Story 2.3a's backend already built `updateUserLocation` to support exactly this. **User confirmed: include edit in this story's scope** (AC7, AC8, Task 4) rather than deferring it to a separate follow-up story, avoiding an artificial add-only half-feature against an already-designed, backend-ready update path.
  4. **No new reusable component warranted for the location row itself:** the row is single-consumer (only this page); the two genuinely reusable mechanisms it wires together (`useSoftDeleteWithUndo`/`SoftDeleteToaster` from Story 0.18, `SwipeToReveal` from Story 0.19) are already their own stories, and Story 2.3 is correctly positioned as their first real consumer, not a candidate for yet another split (mirrors Story 2.2's identical reasoning for not extracting its own row markup).
  5. **Gap noted, not this story's concern:** the backend (Story 2.3a) also supports a raw `latitude`/`longitude` input mode (for a future "current location"/map-pick flow), but no UI for that mode exists in any UX artifact for the add/edit form. This is explicitly Story 2.4's scope ("Set location by current location or map") per `epics.md`'s own story split and Story 2.3a's Out of Scope — Story 2.3's form only wires the `placeId`-based autocomplete path; Story 2.4 will extend this same form with a "Use current location"/map-pick affordance later.
  - **Verdict:** Two real Gate 1/2 gaps found; one split into a new prerequisite story (2.3b), the other two resolved as in-scope decisions per explicit user direction (Soft-Delete-with-Undo, include edit) — mirroring how Stories 2.1a/2.2/2.3a each resolved their own terse-AC ambiguities via recorded user decisions rather than silent assumptions.

### Data Type Compatibility & Migration Requirements

- **No DB schema changes in this story.** `user_locations`'s `location_details` column and the `UserLocationPreference.locationDetails` shared-type extension are Story 2.3a's scope; the `placeId`-capable mutation inputs and `addressAutocomplete` query are Story 2.3b's scope. This story is a pure `apps/web` consumer of both.
- **Compatibility finding:** No mismatch — this story only consumes contracts Stories 2.3a/2.3b define; it introduces no new fields of its own.
- **Impacted fields/contracts:** `apps/web/src/features/locations/queries.graphql`/`mutations.graphql` (new operation documents against the not-yet-existing `myLocations`/`addressAutocomplete`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation` schema fields); `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited, once 2.3a/2.3b ship).
- **Required DB migration changes:** None (this story touches no database code).
- **Required TypeScript type changes:** None beyond the codegen'd hooks that will exist once 2.3a's and 2.3b's schemas are merged and `pnpm run codegen` is re-run — this story cannot compile/type-check against real generated types until then (see Pre-Coding Approval Gate).
- **Backward compatibility and rollout notes:** Purely additive new route/components; no existing page or shared package is modified except `locales/en.json`/`id.json` (new keys only) and `apps/web/src/lib/metadata.ts`'s consumers gaining one more call site (no change to the helper itself).
- **Verification checks:** `pnpm build` after Stories 2.3a/2.3b land and codegen is re-run, proving the new operation documents type-check against the real generated schema; integration tests (Task 7) against msw-mocked versions of the same operations in the interim.

### Package boundaries

- `apps/web`: the route, the modal form, the autocomplete debounce/session-token wiring, the swipe/soft-delete-with-undo wiring, the km↔meter radius conversion — all inherently React/react-query/UI-state-coupled, not `packages/domain` material.
- `packages/domain`: **no change.** The km↔meter conversion (`km * 1000`) was evaluated against `project-context.md`'s Code Organization rule and judged **not** to meet the "reusable, framework-agnostic mechanism" bar that would justify a `packages/domain` extraction with mandatory 100% unit-test coverage overhead — it is a single arithmetic operation used at exactly two call sites within this one story's own form (km→m on submit, m→km on display), not a cross-feature mechanism like `buildEventsQueryCondition` (Story 2.2, reused across three call sites across two features) or `validateLocationInput`/`validateRadiusMeters` (Story 2.3a, genuinely reused validation logic with real branching). If a second, independent feature later needs the same conversion, extracting it at that point is a trivial follow-up, not a rearchitecture.
- `packages/ui`: **no new component.** This story consumes three already-spec'd primitives (`BlockingLoader` — Story 1.7a, already implemented; `useSoftDeleteWithUndo`/`SoftDeleteToaster` — Story 0.18, not yet implemented; `SwipeToReveal` — Story 0.19, not yet implemented) and the existing `useDebounce` hook. It builds no new `packages/ui` export.
- `apps/backend`: **no change.** All backend work for this feature belongs to Stories 2.3a (already fully designed) and 2.3b (this story's own Gate 1 split).

### Architecture / technical constraints

- **AD-1/AD-2 (Unified Query DSL / Unified Event Querying) do not bind this story.** `myLocations` and `addressAutocomplete` are not event-collection queries; they are correctly dedicated, non-DSL queries per Story 2.3a's own precedent (`myLocations` is not an event collection either).
- **AD-7 (Authenticated Context):** `myLocations`, `addressAutocomplete`, and all three mutations are already `requireAuth`-scoped server-side (Stories 2.3a/2.3b); this story's client-side `/login` redirect (AC1) is a UX layer on top, not a substitute, matching Story 2.2's identical framing.
- **AD-8 (Soft-Delete Convention) does not apply at the database layer here** — `user_locations` has no `deletedAt` column (Story 2.3a confirmed this is intentional; hard delete). This story's frontend "soft delete" (grey-out + Undo + deferred commit) is a **UI-layer** deferred-commit pattern only, not a database soft-delete — the eventual `deleteUserLocation` call is still a genuine hard delete once committed (mirrors Story 2.2's identical framing for `toggleFavorite`).
- **List Navigation invariant (`project-context.md`):** Interpreted as **not** applying to this page (AC3) — the rule's own examples (Discovery, Favorites, Subscriptions-events-feed) are all potentially-large event collections; a personal saved-locations list is realistically single-digit-sized, matching `EXPERIENCE.md`'s treatment of the analogous API Keys/Subscriptions settings lists as small, fully-loaded tables rather than infinite-scroll feeds.
- **GraphQL abuse prevention:** Already configured server-wide (Story 0.8, `graphql-armor`, `maxDepth: 10`); this story's flat queries/mutations add no new nesting depth.

### i18n Keys Required (AD-6)

New `SavedLocationsPage` namespace (both `en`/`id`), plus two new `Metadata` keys:
- `Metadata.locationsTitle`, `Metadata.locationsDescription` (mirroring `Metadata.discoveryTitle`/`discoveryDescription`'s naming convention).
- `SavedLocationsPage`: `title`, `emptyState`, `errorState`, `addButtonLabel`, `addModalTitle`, `editModalTitle`, `nameLabel`, `namePlaceholder`, `addressLabel`, `addressPlaceholder`, `addressSearching`, `addressNoResults`, `radiusLabel`, `radiusUnit` (e.g. "{count} km"), `saveButtonLabel`, `cancelButtonLabel`, `deleteButtonLabel`, `savingAnnouncement` (the `BlockingLoader` label, e.g. "Saving location..."), `locationSavedAnnouncement`, `locationSaveErrorAnnouncement`.
- Delete toast/Undo strings consumed via Story 0.18's `useSoftDeleteWithUndo(id, commit, labels?)` third-argument override (exact prop shape confirmed once 0.18 lands) — likely override the hook's English fallback ("Item removed"/"Undo") with a location-specific message (e.g. "Location removed") for tonal consistency with Story 2.2's own override, if 2.2's final copy is available for cross-reference at implementation time.

### Analytics Events Required (AD-5)

- `saved_location_added` — `{ locationId: string, name: string }`, fired on `createUserLocation` success.
- `saved_location_updated` — `{ locationId: string }`, fired on `updateUserLocation` success.
- `saved_location_deleted` — `{ locationId: string }`, fired only at commit time (unmount-triggered mutation success), never at mark-pending time — mirrors Story 2.2's `event_unfavorited` timing precedent exactly.

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** `myLocations` query, `addressAutocomplete` lazy query (fired per debounced keystroke), and the `createUserLocation`/`updateUserLocation`/`deleteUserLocation` mutations (the last fired deferred, on unmount, per Story 0.18's contract).
- **URL State (`nuqs`):** none — this settings page has no shareable filters/search params.
- **Client Global State (`zustand`):** none required — the modal's open/edit-target state and the autocomplete session token are local component state, scoped to `locations-content.tsx`/`location-form-dialog.tsx`.

### Loader Classification

- Initial `myLocations` list load: **Non-blocking, Skeleton** (row-shaped skeleton, distinct from `EventCard`'s skeleton — no infinite-scroll spinner needed since the list is unpaginated, AC3).
- `addressAutocomplete` suggestions while typing: **Non-blocking**, a small inline loading indicator within the dropdown — never a full-screen loader for a debounced typeahead.
- `createUserLocation`/`updateUserLocation` submit (the modal's "Save" action): **Blocking** (`BlockingLoader`, Story 1.7a) — `project-context.md`'s UI Patterns rule literally names "saving a location" as its Blocking-loader example.
- `deleteUserLocation` (fired on unmount-commit): **Non-blocking** — the user has already navigated away by the time this fires; there is nothing to block.
- Mark-pending / Undo: **Non-blocking**, instant local visual state change.

### Previous/Sibling Story Intelligence (Stories 2.1a, 2.2, 2.3a, 0.16, 0.18, 0.19)

- Story 2.3a is this story's direct backend dependency but is **not yet implemented** (`ready-for-dev` in `sprint-status.yaml`; confirmed via reading `packages/database/schema.ts` and `packages/shared-types/src/index.ts` directly — neither has 2.3a's `locationDetails` column/field yet) — see Pre-Coding Approval Gate.
- Story 2.3b (this story's own new Gate 1 split) is likewise not yet implemented — it does not even exist as its own story file yet, only as an `epics.md` section and a `sprint-status.yaml` backlog entry created during this story's creation.
- Story 0.16 (Geolocation adapter), which both 2.3a and 2.3b depend on, is itself only `ready-for-dev`, not `done` — confirmed via `sprint-status.yaml` and an absent `apps/backend/src/lib/geolocation/` directory. This is therefore a **three-deep** not-yet-built dependency chain (0.16 → {2.3a, 2.3b} → 2.3), the deepest of any story so far in this epic.
- Stories 0.18 (`useSoftDeleteWithUndo`/`SoftDeleteToaster`) and 0.19 (`SwipeToReveal`) are both `ready-for-dev`, zero real consumers exist in the codebase yet. Story 2.2 (`ready-for-dev`) is expected to consume 0.18 first for Favorites; Story 2.3 (this story) is the first story to consume **both** 0.18 and 0.19 together, exactly as Story 0.19's own Dev Notes anticipated ("a plausible future pairing is Story 0.18's `useSoftDeleteWithUndo.markPending` as the `onAction` implementation inside a Favorites/Saved Locations/... list").
- `SoftDeleteToaster` is already mounted once, app-wide, in `apps/web/src/app/[locale]/layout.tsx` by Story 0.18's own Task 5 — this story does **not** need to mount it again.
- Story 2.2's `pendingRemoval`-visual-state precedent (a grey-out prop added to a shared `EventCard`) does not directly apply here, since this story's row markup is not a shared `packages/ui` component (Gate 2 finding 4) — the grey-out is a local class toggle instead.
- `useDebounce` (`packages/ui/src/hooks/useDebounce.ts`) already exists and is reused as-is for the address-autocomplete input, no new debounce implementation needed.

### Project Structure Notes

- New: `apps/web/src/app/[locale]/settings/locations/page.tsx`, `.../locations-content.tsx`, `.../locations-content.test.tsx`, `.../location-form-dialog.tsx`, `.../location-form-dialog.test.tsx`.
- New: `apps/web/src/features/locations/queries.graphql`, `apps/web/src/features/locations/mutations.graphql`.
- New: `apps/web/e2e/saved-locations.spec.ts`.
- Modified: `apps/web/locales/en.json`/`id.json` (new `SavedLocationsPage` namespace + two `Metadata` keys).
- Regenerated (not hand-edited): `apps/web/src/generated/graphql.ts`, once Stories 2.3a/2.3b ship and `pnpm run codegen` runs.
- Depends on (not modified by this story): `packages/ui`'s `BlockingLoader` (exists), `useSoftDeleteWithUndo`/`SoftDeleteToaster` (Story 0.18, not yet built), `SwipeToReveal` (Story 0.19, not yet built), `useDebounce` (exists).
- No `apps/backend`, `packages/database`, `packages/domain`, or `packages/shared-types` changes in this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.3`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.3b`] (new, this story's own Gate 1 split)
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`]
- [Source: `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`] (full page walkthrough — Viewing/Adding/Editing/Deleting sections)
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#State Patterns — Soft Delete with Undo`, line 71 ("saved location" named explicitly)]
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Information Architecture`, line 29 (`/settings/locations` route)]
- [Source: `_bmad-output/implementation-artifacts/2-3a-build-the-saved-locations-backend-graphql-api-layer.md`]
- [Source: `_bmad-output/implementation-artifacts/2-2-view-favorited-events.md`] (Soft-Delete-with-Undo consumption precedent, analytics commit-timing precedent)
- [Source: `_bmad-output/implementation-artifacts/0-18-build-the-reusable-soft-delete-with-undo-ui-primitive.md`, `0-19-build-the-reusable-swipe-to-reveal-action-ui-primitive.md`]
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
- *Story-split-gate Gate 1* → address-autocomplete backend capability split into new **Story 2.3b**, not absorbed (Dev Notes → Architecture & UX Gate Findings).
- *Story-split-gate Gate 2* → Soft-Delete-with-Undo vs. confirmation-dialog conflict resolved (Soft-Delete-with-Undo wins) and edit-scope-inclusion resolved (included), both via explicit user decision (Dev Notes → Architecture & UX Gate Findings).
- *AD-6 (i18n)* → all user-facing copy sourced via new `SavedLocationsPage`/`Metadata` next-intl keys (Task 5, Dev Notes → i18n Keys Required).
- *AD-5 (Analytics)* → `saved_location_added`/`updated`/`deleted` events (Task 6, Dev Notes → Analytics Events Required).

### Verification Plan

- Integration tests (`apps/web`, Vitest + msw): auth redirect; list empty/populated/error states; add flow with autocomplete search/select and Save-button gating; edit flow with/without address change; swipe-reveal + mark-pending grey-out + toast; Undo cancels with no mutation; unmount commits all still-pending deletes exactly once.
- One Playwright E2E happy-path test (`saved-locations.spec.ts`) per AC14's scripted flow.
- Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root, once Stories 2.3a/2.3b are merged and this story's operation documents can be codegen'd against the real schema.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: `apps/web`-only (new `/settings/locations` route, form, list, delete interaction) — no backend/database/domain/packages-ui changes (all backend work belongs to Stories 2.3a/2.3b).
- [ ] **Three-deep hard dependency chain confirmed:** Story 0.16 (Geolocation adapter) → Stories 2.3a (saved-locations CRUD API) and 2.3b (autocomplete + `placeId` input mode, newly split by this story's own creation) → this story (2.3). As of this story's creation, **none** of 0.16, 2.3a, or 2.3b are `done` (0.16 and 2.3a are `ready-for-dev`; 2.3b is freshly `backlog`, not yet even drafted as its own story file). Confirm proceeding with this story's non-blocked prep work now (route scaffolding, i18n keys, static UI/form structure, tests written against msw-mocked operation shapes) while 0.16/2.3a/2.3b are drafted/built in parallel, or direct that this story wait until all three are `done`. If built in parallel, this story's Definition of Done requires re-verifying against the *real*, codegen'd GraphQL operations once all three land (mirrors Story 2.3a's identical handling of its own dependency on the not-yet-built Story 0.16).
- [ ] **New prerequisite Story 2.3b accepted:** address-autocomplete/typeahead requires new backend capability (a Geolocation-adapter predictions method + a new `addressAutocomplete` query + a `placeId` input mode on Story 2.3a's mutations) that does not exist today. Split into Story 2.3b, written into `epics.md` (after Story 2.3a) and `sprint-status.yaml` (`backlog`) during this story's creation. Confirm this sequencing (2.3b before 2.3 can fully ship) is accepted.
- [ ] **Soft-Delete-with-Undo (not a confirmation dialog) accepted:** resolves a real conflict between `EXPERIENCE.md`'s canonical state pattern and the narrative UX scenario's confirmation-dialog wording, in favor of the canonical pattern (per Dev Notes → Architecture & UX Gate Findings, finding 1).
- [ ] **Editing included in this story's scope accepted:** beyond `epics.md`'s literal add/list/delete AC text, per Dev Notes → Architecture & UX Gate Findings, finding 3.
- [ ] **Unpaginated (no infinite-scroll) list treatment accepted:** per Dev Notes → Architecture / technical constraints' List Navigation interpretation.
- [ ] Architecture and data/API boundaries confirmed: `apps/web`-only; no direct DB/domain/Geolocation-API access from the frontend at any point (all resolution happens server-side via Stories 2.3a/2.3b).
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (no gap at the epic-sweep level) plus a fresh, this-story-specific Gate 1 gap (new Story 2.3b, per the escape-hatch guard) — not absorbed. Gate 2 run fresh via subagent — two real findings, both resolved via explicit user decision (Soft-Delete-with-Undo, include edit), not silently assumed.
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
- [ ] New Story 2.3b written into `epics.md` and added as a `backlog` entry in `sprint-status.yaml` (Gate 1 split — already completed during this story's creation).

## Out of Scope

- **Story 2.3b** ("Extend the Geolocation adapter and saved-locations API with address autocomplete support") — the actual backend implementation of the `addressAutocomplete` query, the adapter's predictions method, and the `placeId` input-mode wiring. This story (2.3) only *consumes* that contract once built; it is a hard blocking prerequisite, not built here.
- **Story 2.3a**'s actual backend implementation (`myLocations`/`createUserLocation`/`updateUserLocation`/`deleteUserLocation` resolvers, the `location_details` migration) — this story only consumes that contract.
- **Story 0.16**'s Geolocation adapter implementation, **Story 0.18**'s `useSoftDeleteWithUndo`/`SoftDeleteToaster`, and **Story 0.19**'s `SwipeToReveal` — all consumed, none built here.
- **"Use current location"/map-pick UI** for the add/edit form's Address field (raw latitude/longitude input mode) — explicitly **Story 2.4**'s scope ("Set location by current location or map"), per `epics.md`'s own split and Story 2.3a's Out of Scope. This story's form only wires the `placeId`-based autocomplete path.
- **Geo-distance/"nearby" event filtering** using saved locations (Story 2.5a/2.5) — this story only manages the saved-location records themselves.
- A blocking confirmation dialog before delete — explicitly rejected in favor of Soft-Delete-with-Undo (Dev Notes → Architecture & UX Gate Findings, finding 1).

## Definition of Done

- [ ] AC1-AC14 satisfied.
- [ ] Required tests passing (`apps/web` integration tests for the list/form/delete interaction; one Playwright E2E happy-path test).
- [ ] Lint and type checks passing for `apps/web`.
- [ ] Stories 0.16, 2.3a, and 2.3b are all `done`, and this story's GraphQL operation documents have been re-verified (codegen re-run, `pnpm build` clean) against their real, merged schemas — not just msw-mocked shapes.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`. Gate 1/3 sourced from the swept `epic-2-readiness.md` report (no epic-wide gap); a fresh, this-story-specific Gate 1 gap was found and split into new **Story 2.3b** (address-autocomplete backend capability), written into `epics.md` and `sprint-status.yaml` during this story's creation.
- Gate 2 (UI Complexity & Reusability) run fresh via a Freya-persona subagent against `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md` and `EXPERIENCE.md`'s State Patterns/Information Architecture sections; surfaced a real Soft-Delete-with-Undo-vs-confirmation-dialog conflict, the address-autocomplete gap (→ Story 2.3b), and an edit-scope-inclusion question. All three were presented to the user via `AskUserQuestion` before drafting (per this workflow's design-tradeoff-surfacing rule) — user selected: Soft-Delete-with-Undo (recommended), build live autocomplete now (accepting the new Story 2.3b prerequisite), and include edit in this story's scope (recommended).
- Confirmed via direct file reads that Stories 0.16, 2.3a are `ready-for-dev` (not `done`) and neither `packages/database/schema.ts` nor `packages/shared-types/src/index.ts` yet reflect 2.3a's changes — flagged as a three-deep dependency chain in Pre-Coding Approval Gate.

### Completion Notes List

### File List
