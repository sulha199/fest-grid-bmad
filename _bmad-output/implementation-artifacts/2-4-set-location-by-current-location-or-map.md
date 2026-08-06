---
baseline_commit: df14928ce7f3c92bc4ef97a4eafeb42ed434ff47
---
# Story 2.4: Set location by current location or map

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.4
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to set a saved location's address by using my current device location or by picking a point on an interactive map, instead of only typing/searching an address,
so that I can save locations quickly and accurately even when I don't know or can't type the exact address.

## Acceptance Criteria

1. **Given** I am on the "My Locations" add/edit form (`location-form-dialog.tsx`, Story 2.3) with its existing Name/Address(autocomplete)/Radius fields, **when** the form renders, **then** two additional affordances appear next to/below the Address field: a "Use my current location" button and a "Pick on map" button, both available in both Add and Edit mode.
2. **Given** `navigator.geolocation` is available in the browser, **when** I tap "Use my current location", **then** the browser's native permission prompt (if not already granted) is triggered via `getCurrentPosition`, any prior address selection (autocomplete `placeId`, or a previously captured map/current-location coordinate) is cleared, and the resolved `{ latitude, longitude }` becomes the pending coordinate-mode selection for this field. **[REVISED 2026-08-06 — Sprint Change Proposal, `sprint-change-proposal-2026-08-06-map-picker-continuity.md`]** The resolved coordinate also becomes the current value of this story's new shared map-picker continuity state (AC18) — center/marker/zoom — so a subsequent "Pick on map" open (AC5) starts from this same point instead of a generic default.
3. **Given** `navigator.geolocation` is unavailable (older/unsupported browser), **then** the "Use my current location" button is disabled (not merely erroring on tap), so I am not invited into a flow that cannot succeed.
4. **Given** I tap "Use my current location" and the browser denies permission, times out (10s), or otherwise fails, **then** a visible, localized inline error message appears near the Address field (not a full-screen/blocking error), no coordinate is captured, and my prior selection (if any) is left untouched.
5. **When** I tap "Pick on map", **then** a dedicated full-screen sheet opens (not inline in the compact form dialog) containing Story 2.4a's `MapView` component (`@festgrid/ui`), a "Confirm location" button, and a "Cancel"/close affordance. **[REVISED 2026-08-06]** The sheet's initial center/zoom/marker come from this story's shared map-picker continuity state (AC18) — not always a hardcoded default — so it opens already showing wherever the user last searched, captured their current location, or positioned the marker, in priority order: (a) the continuity state if it has ever been set this dialog session, (b) in Edit mode with no continuity set yet, the location's existing saved coordinates at zoom 15, (c) otherwise (Add mode, first-ever open), a documented fallback center at zoom 12 (unchanged from the original implementation's `DEFAULT_CENTER`).
6. **Given** the map sheet is open, **when** I tap/click a point on the map, **then** `MapView`'s controlled marker moves to that point (via the sheet's own local `marker` state, updated from `MapView`'s `onCoordinatesChange`) but nothing is committed to the form yet. **[REVISED 2026-08-06]** This also updates the shared continuity state's marker (AC18) — a tap always sets *both* the sheet-local pending marker and the cross-session continuity marker to the same point; there is only one marker, not two independently-tracked ones.
7. **Given** the map sheet is open with a point selected, **when** I tap "Confirm location", **then** the sheet closes, any prior address selection is cleared, and the confirmed `{ latitude, longitude }` becomes the pending coordinate-mode selection for the field — mirroring AC2's clearing behavior. **[REVISED 2026-08-06]** This is true regardless of *how* the marker reached its current position — a direct map tap (AC6) or a suggestion selected via the sheet's new embedded search (AC19) — Confirm always commits the marker's current position as a coordinate-mode `{ latitude, longitude }` selection, **never** a `placeId`, even if the most recent in-sheet action was selecting an address suggestion. This keeps the map-sheet path a single, unambiguous input mode and preserves Story 2.3a's mutually-exclusive mutation-input contract (AC12) without new ambiguity about whether the marker moved after a suggestion pick.
8. **Given** the map sheet is open, **when** I tap "Cancel"/close without confirming, **then** the sheet closes and the form's prior *submittable* selection (address/coordinate/empty — i.e. what AC12's Save payload would use) is left completely unchanged — no partial state leaks back to the form. **[REVISED 2026-08-06]** This is unchanged and still strict: Cancel never mutates `pendingCoords`/`selectedPlaceId`/`selectedDescription`. It does **not**, however, reset the shared continuity state (AC18) — the map's camera/marker position the user was just looking at is still what "Pick on map" shows if reopened later this session (AC18a). Continuity is a visual/UX convenience, distinct from the form's actual submittable selection, which is what AC8 has always protected.
9. **Given** a coordinate-mode selection was just captured (AC2 or AC7), **when** the capture succeeds, **then** the Address field shows a non-blocking, localized "resolving address…" loading indicator while the `previewLocation` query (Story 2.4b) runs, then displays the resolved `formattedAddress` in place of that indicator once it returns.
10. **Given** the `previewLocation` query (Story 2.4b) fails (network error, provider error), **then** the Address field falls back to showing the raw captured coordinates (e.g. "Current location (-6.2088, 106.8456)") instead of the loading indicator or a broken UI, and — critically — this failure does **not** block Save: the pending `{ latitude, longitude }` is still submittable, because `createUserLocation`/`updateUserLocation` (Story 2.3a) resolve and persist the real address server-side regardless of whether the client-side preview succeeded.
11. **Given** either "Use my current location" or "Pick on map" has an in-flight request (permission prompt pending, or `previewLocation` resolving), **then** the other trigger button is disabled until the in-flight request settles, preventing two concurrent coordinate-capture flows from racing each other.
12. **Given** a coordinate-mode selection (from either source) is pending, **when** I tap Save, **then** the submitted mutation (`createUserLocation` on Add, `updateUserLocation` on Edit) includes `latitude`+`longitude` (never `address` or `placeId` in the same call — Story 2.3a's mutually-exclusive input-mode contract), with the same `name`/`radius` handling and `BlockingLoader` treatment Story 2.3 already established for the autocomplete path.
13. **Given** I start typing directly into the Address field's text input after capturing a coordinate-mode selection, **then** the pending coordinate selection is cleared and the field reverts to Story 2.3's live-autocomplete-search behavior — the three input modes (search-and-select, current-location, map-pick) remain mutually exclusive at all times, matching Story 2.3a's "never both" mutation contract.
14. **And** per Story 2.4a's AC7, `MapView`'s marker placement is pointer/tap-only with no keyboard-driven marker movement — the existing Story 2.3/2.3b address-autocomplete search field remains fully visible and usable as the accessible, non-map path to the same outcome whenever the map sheet is not open; this story does not attempt to add keyboard-driven marker movement.
15. **And** the full-screen map sheet manages focus correctly: focus moves into the sheet (e.g. to the "Confirm location" button or the map container) when it opens, and returns to the "Pick on map" trigger button when it closes (Confirm, Cancel, or Escape).
16. **And** all new user-facing strings (button labels, permission/timeout/unsupported error copy, the "resolving address…" and coordinate-fallback copy, the map sheet's title/Confirm/Cancel labels) are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings. **[REVISED 2026-08-06]** Extends to the new in-sheet search field's placeholder, searching-indicator, and no-results copy (AC19/AC19a) — new `SavedLocationsPage` keys `mapSearchPlaceholder`, `mapSearchSearching`, `mapSearchNoResults` (the outside field's existing `addressPlaceholder`/`addressSearching`/`addressNoResults` are not reused verbatim, since the in-sheet field's placeholder reasonably differs in tone/length for a compact overlay context — dev-story may reuse the existing keys instead if the copy ends up identical, but the keys are declared new here so that decision doesn't block schema/i18n-file scaffolding).
17. **And** integration tests (Vitest + msw, mocking `navigator.geolocation` and the `previewLocation` query) verify: current-location happy path (capture → preview → Save with lat/lng), permission-denied/timeout/unsupported error states, map-pick happy path (open sheet → click `MapView` → Confirm → preview → Save with lat/lng), map-sheet Cancel leaving prior state untouched, typing after a coordinate capture reverting to search mode, `previewLocation` failure falling back to raw-coordinate display without blocking Save, and the mutual-exclusion button-disabling behavior (AC11). One Playwright E2E test extends Story 2.3's `saved-locations.spec.ts` happy path with a "Use my current location" step (Playwright's `context.setGeolocation`/`grantPermissions` mocking a fixed coordinate) through to a successfully saved location. **[REVISED 2026-08-06 — see AC20 for the added test scenarios this amendment requires.]**

**[NEW 2026-08-06 — Sprint Change Proposal, `sprint-change-proposal-2026-08-06-map-picker-continuity.md`]**

18. **AC18 — Shared map-picker continuity state.** The dialog holds one piece of state — call it `mapViewState: { center: Coordinates; zoom: number; marker: Coordinates | null } | null` — that is `null` only until the *first* of these happens in a given dialog open: (a) editing an existing location (seeded immediately from its saved coordinates), (b) a successful "Use my current location" capture (AC2), (c) selecting a suggestion from the *outside* Address field's autocomplete dropdown (AC18b), or (d) any interaction with the map sheet itself (tap, embedded-search selection, or pan/zoom via AC13's `onViewStateChange`). Once set, it persists for the lifetime of the open dialog (reset only when the dialog closes/reopens for a different Add/Edit target, per the existing AC1-derived pre-population effect) — it survives the map sheet being closed via Confirm *or* Cancel (AC8).
    18a. **Sub-AC — Cancel does not reset continuity.** Restated from AC8 for clarity: closing the map sheet via Cancel/Escape leaves `mapViewState` exactly as the user left it. Reopening "Pick on map" afterward shows the same center/zoom/marker, not the sheet's original default.
    18b. **Sub-AC — outside-field search selection also updates continuity.** Given I select a suggestion from the *outside* Address field's autocomplete dropdown (Story 2.3 AC5), when the selection resolves, then — in addition to Story 2.3's existing placeId-selection behavior (the Address field shows the suggestion's description, `selectedPlaceId` is set) — a background call to this story's amended `previewLocation(placeId)` (Story 2.4b AC8/AC9) resolves that suggestion's coordinates and updates `mapViewState`'s center/marker (at zoom 15) so that a subsequent "Use my current location" or "Pick on map" starts from the same place instead of a default. This call is non-blocking and fails silently from the user's point of view: the Address field's displayed text and the `placeId`-mode submit payload (AC12) are entirely unaffected by whether this background resolution succeeds — continuity simply does not update on failure. This is the fix for the reported problem: previously, a search-selected `placeId` had no client-known coordinates at all, so opening the map afterward always fell back to a generic default center, discarding the user's search.
19. **AC19 — Search directly inside the map sheet.** Given the map sheet is open, the sheet now also renders a compact search input (reusing the same debounced `addressAutocomplete` query and 3-character minimum as the outside Address field, Story 2.3 AC5/Story 2.3b AC2) above or overlaid on the map. Typing shows a suggestions dropdown *within the sheet*. Selecting a suggestion resolves its coordinates via the same `previewLocation(placeId)` call as AC18b, then pans/re-centers the map and moves the marker to that point (via `MapView`'s controlled `center`/`marker` props, per Story 2.4a AC2's existing imperative-update behavior — no map teardown/recreate) — **the sheet does not close** and nothing is committed to the form yet (mirrors AC6's "nothing committed" framing). The user may keep adjusting (tap elsewhere, search again, pan/zoom) before tapping "Confirm location" (AC7), which always commits the marker's current position as coordinates, never the suggestion's `placeId` (AC7's revision).
    19a. **Sub-AC — in-sheet search failure/no-results.** The in-sheet search dropdown shows the same loading/no-results copy as the outside field (new i18n keys, AC16) and never blocks map interaction — the user can still tap the map directly while a search is in flight or has no results.
20. **AC20 — Zoom control and initial zoom (Story 2.4a AC12/AC13 consumption).** The map sheet passes `showZoomControl` at its default (`true`) — i.e. does not opt out — so `MapView` renders its zoom in/out control (Story 2.4a AC12). The sheet's initial zoom is 15 (a close, single-building-scale view) whenever it opens centered on a specific known point (continuity state, an edited location's saved coordinates, or a fresh current-location capture) — the wider zoom 12 default is used only for the no-context Add-mode fallback (AC5c). The sheet wires `MapView`'s `onViewStateChange` (Story 2.4a AC13) to update `mapViewState`'s center/zoom live as the user pans/zooms (including via the new zoom control), so manual camera adjustments are also covered by AC18's continuity guarantee, not just marker placement.

**Note (AC correction vs. `epics.md`):** `epics.md`'s Story 2.4 AC text only states the two buttons pre-fill/display a map, with no detail on the map's presentation surface, the address-preview behavior, error handling, or the field's mutual-exclusion semantics with Story 2.3's existing autocomplete. ACs 3-17 above were derived from: (a) Story 2.4a's own Out-of-Scope note assigning address-preview responsibility to this story, (b) a Gate 2 (UX) analysis run during this story's creation, and (c) two explicit user decisions during this story's creation (2026-08-04) — see Dev Notes → Architecture & UX Gate Findings.

## Tasks / Subtasks

- [x] Task 1: GraphQL operation document for `previewLocation` (AC9, AC10)
  - [x] Add `query previewLocation($latitude: Float!, $longitude: Float!) { previewLocation(latitude: $latitude, longitude: $longitude) { formattedAddress placeName coordinates { lat lng } provider } }` to `apps/web/src/features/locations/queries.graphql` (extends the file Story 2.3 creates).
  - [x] Run `pnpm run codegen` to regenerate graphql client hooks.
- [x] Task 2: Add the shadcn `Sheet` primitive (AC5)
  - [x] Add `apps/web/src/components/ui/sheet.tsx` as an app-local primitive.
- [x] Task 3: `useCurrentLocationCapture` hook (AC2, AC3, AC4)
  - [x] New `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.ts` browser-geolocation hook.
- [x] Task 4: `map-picker-sheet.tsx` (AC5, AC6, AC7, AC8, AC15)
  - [x] New `apps/web/src/app/[locale]/settings/locations/map-picker-sheet.tsx` hosting `MapView`.
  - [ ] **[REVISED 2026-08-06]** Convert from a component that owns its own local `marker` state (reset from `initialCenter` every time it opens) into a fully controlled component: it receives `center`, `zoom`, `marker` and `onViewStateChange`/`onMarkerChange` callbacks from its parent (Task 8's continuity state), and forwards them straight to `MapView`'s own already-controlled `center`/`zoom`/`marker`/`onViewStateChange` props (Story 2.4a AC2/AC13) — the sheet itself holds no independent camera/marker state of its own anymore.
  - [ ] **[NEW]** Add the embedded search input + suggestions dropdown (AC19) — reuse `useAddressAutocompleteQuery` + `useDebounce` the same way `location-form-dialog.tsx` already does for the outside field; on suggestion select, call `usePreviewLocationQuery`-style resolution with `{ placeId }` (Story 2.4b AC8) and push the result into the shared center/marker via the parent's callback, without closing the sheet or touching `selectedPlaceId`/`selectedDescription`.
- [x] Task 5: Extend `location-form-dialog.tsx` (Story 2.3) with the two new triggers and the preview flow (AC1, AC2, AC7, AC9, AC10, AC11, AC12, AC13, AC14)
  - [x] Add trigger buttons and wired up state logic.
  - [x] Integrate `usePreviewLocationQuery` with loading states and fallback coordinates display.
  - [x] Ensure mutual exclusion across inputs and typing-reverts behavior.
  - [ ] **[NEW 2026-08-06]** Wire outside-field suggestion selection (`handleSelectSuggestion`) to also kick off the AC18b background `previewLocation(placeId)` continuity update (fire-and-forget, no loading UI on the Address field itself — that field already shows the suggestion's description immediately per Story 2.3 AC5).
- [ ] **[NEW 2026-08-06]** Task 8: Shared map-picker continuity state (AC18-AC20)
  - [ ] Lift `mapViewState: { center, zoom, marker } | null` into `location-form-dialog.tsx` (or a small colocated hook, e.g. `useMapPickerContinuity`, dev's choice per this file's existing "co-located vs. extracted" precedent — not a `packages/domain`/`packages/ui` candidate, it's dialog-local UI-composition state, same category as the existing `pendingCoords`/`isMapOpen` state already in this file). Seed it from the edited location's coordinates on open (Edit mode) or leave `null` (Add mode) until first set by AC2/AC18b/the map sheet itself.
  - [ ] Pass `mapViewState` (with fallbacks per AC5's priority order) and its setter down into `MapPickerSheet` as controlled props (Task 4's revision).
- [x] Task 6: i18n keys (AC16)
  - [x] Extend the `SavedLocationsPage` namespace in both `en.json` and `id.json` with 11 localized keys.
  - [ ] **[NEW 2026-08-06]** Add `mapSearchPlaceholder`, `mapSearchSearching`, `mapSearchNoResults` to both `en.json`/`id.json` (AC16's revision).
- [x] Task 7: Testing (AC17)
  - [x] New `use-current-location-capture.test.ts` testing the hook in isolation.
  - [x] Extend `location-form-dialog.test.tsx` and mock `MapView` to verify all geolocation capture, preview fallback, map Confirm/Cancel, and focus behaviors.
  - [x] Mock `MapView` in `locations-content.test.tsx` to prevent WebGL module loading issues.
  - [ ] **[NEW 2026-08-06]** See AC20's test list below — new/updated cases for continuity (search→map, current-location→map, Cancel-then-reopen), in-sheet search (pan/mark without closing, Confirm always emits coordinates even after a suggestion pick), and the zoom-control/initial-zoom defaults.

**[NEW 2026-08-06 — Sprint Change Proposal, `sprint-change-proposal-2026-08-06-map-picker-continuity.md`]**

- [ ] Task 9: Test delta for this amendment (AC18-AC20)
  - [ ] `location-form-dialog.test.tsx`: selecting an outside-field suggestion fires a mocked `previewLocation({ placeId })` call and updates `mapViewState` without changing the Address field's displayed text or the `placeId`-mode submit payload; opening "Pick on map" afterward shows the resolved center/marker (assert the mocked `MapView`'s received `center`/`marker` props), not `DEFAULT_CENTER`; the same for opening the map after "Use my current location"; Cancel-ing the map sheet then reopening it shows the same center/zoom/marker as just before Cancel (not reset); a failed background `previewLocation({ placeId })` leaves the Address field/submit payload untouched (continuity silently does not update).
  - [ ] `map-picker-sheet.test.tsx` (new, or an extended `describe` block inside `location-form-dialog.test.tsx` if the mocked-`MapView` harness is more easily shared there — dev's choice): the embedded search input renders and is debounced against a mocked `addressAutocomplete`; selecting a suggestion updates the mocked `MapView`'s `center`/`marker` props and does **not** close the sheet; a subsequent manual map click (`onCoordinatesChange`) after a suggestion selection moves the marker again; tapping "Confirm location" after a suggestion-then-tap sequence calls `onConfirm` with the *tapped* coordinates, never the suggestion's own resolved coordinates and never a `placeId`; `MapView` is rendered with `showZoomControl` at its default (not explicitly `false`); initial `zoom` passed is `15` when centered on a known point vs. `12` for the no-context Add-mode fallback.
  - [ ] Backend (`apps/backend/src/schema/geolocation.test.ts`, Story 2.4b's file): see Story 2.4b Task 11's own test list (placeId-only success, placeId+coords → `BAD_REQUEST`, neither → `BAD_REQUEST`, existing coords-only tests still pass).
  - [ ] One Playwright E2E scenario (extending `apps/web/e2e/saved-locations.spec.ts` or a new focused spec): search an address in the outside field → open "Pick on map" → assert the map is centered near the searched address (via a fixture/mocked Geoapify route, not a live network call) → use the in-sheet search to find a second address → confirm the map pans there → tap elsewhere to fine-tune the marker → "Confirm location" → Save → the saved location's coordinates match the final tapped point, not either searched address's own coordinates.

## Dev Notes

### Correct-Course Amendment — 2026-08-06 (Map Picker Continuity)

- **Origin:** User-reported UX problem in this story's own shipped implementation (`sprint-change-proposal-2026-08-06-map-picker-continuity.md`): the three ways to set a location's position — the outside Address field's live search, "Use my current location," and "Pick on map" — didn't share state. Concretely: selecting a search suggestion never resolved client-side coordinates at all (only a `placeId`, resolved server-side at Save time), so opening "Pick on map" afterward always fell back to a generic default center (Jakarta), discarding the user's search. The map sheet also had no zoom control and reset to a fixed zoom every time it opened.
- **Decision: amend this story in place, not split.** This story is `review` (shipped, tested, not `done`). The change is additive and entirely confined to files this story already owns (`location-form-dialog.tsx`, `map-picker-sheet.tsx`) plus a narrow, backward-compatible extension to a sibling story's already-owned query (Story 2.4b's `previewLocation`, amended in place for the same reason) and component (Story 2.4a's `MapView`, amended in place for the same reason). None of the three additions — continuity state, in-sheet search, a zoom control — introduce a new page, a new cross-cutting mechanism needed by other features, or a change to the Save/mutation contract (AC12's mutual exclusion is explicitly preserved, see AC7's revision). This mirrors the same-day `sprint-change-proposal-2026-08-06.md`'s precedent of amending `review`-status stories with real shipped code in place, and Story 2.5a's own "not yet implemented [or, here, not yet `done`], so amended in place rather than splitting a new story" reasoning.
- **Key design decision — continuity state vs. submittable selection are two different things.** The existing `pendingCoords`/`selectedPlaceId`/`selectedDescription` state is what actually gets submitted on Save (AC12) and is exactly what AC8's "Cancel leaves it untouched" has always protected. The new `mapViewState` (AC18) is purely a visual/UX memory of "where the map was last looking" — it updates more liberally (on every pan/zoom/tap/search-select, even inside the map sheet before Confirm) and is deliberately *not* reset by Cancel, because resetting it on Cancel would reproduce the exact bug this amendment fixes (the map forgetting context). Keeping these separate is what lets AC8's existing guarantee stay word-for-word true while still satisfying the new continuity requirement.
- **Key design decision — the map sheet's Confirm always emits coordinates, never a `placeId`, even when reached via the new in-sheet search.** Alternative considered: if the last in-sheet action was selecting a search suggestion (untouched since), submit that suggestion's `placeId` directly (server-resolved, arguably higher-quality data than a client reverse-geocode of the same point). Rejected: the marker can be nudged by a further tap after a suggestion selection (AC19), and there is no reliable client-side way to tell "still exactly at the suggestion's point" from "moved since" without adding new fuzzy-matching state — a coordinate-mode commit is simpler, always correct relative to what's visually shown, and keeps the map-sheet path a single, unambiguous input mode. This was not escalated to the user as a tradeoff — it is the same simplicity-over-marginal-data-quality call already implicit in the original AC7 (map confirm has always emitted coordinates, never a placeId, even before this amendment).
- **Why extend `previewLocation` (Story 2.4b) instead of adding a new query, and why extend `MapView` (Story 2.4a) instead of building a bespoke zoom control in this story's own files:** see those stories' own Dev Notes → Correct-Course Amendment sections; both follow the same "extend the existing single-purpose owner rather than duplicate" reasoning.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`. Split of query capability into Story 2.4b resolved.
- **Gate 2 (UI Complexity & Reusability):** Handled. MapView component was successfully placed inside `apps/web/src/components/ui/map.tsx` as per the user's instructions to keep map packages within `apps/web`, completely removing map files from `@festgrid/ui`.

### Data Type Compatibility & Migration Requirements

- No DB schema changes in this story.
- Generated client hooks perfectly type-checked against `CreateUserLocationInput` and `UpdateUserLocationInput` variables.

### Package boundaries

- `apps/web`: hosts mappicker sheet, geolocation wrapper, updated location modal, and the MapView component.
- `packages/ui`: map-specific logic was cleanly detached and deleted from index.ts exports.

### i18n Keys Required (AD-6)

Added: `useCurrentLocationLabel`, `pickOnMapLabel`, `geolocationPermissionDeniedError`, `geolocationTimeoutError`, `geolocationUnavailableError`, `resolvingAddressLabel`, `addressPreviewErrorFallback`, `mapSheetTitle`, `mapConfirmLabel`, `mapCancelLabel`, `mapErrorLabel`.

## Definition of Done Validation Results

- All tasks and subtasks marked complete: YES
- Implementation satisfies every Acceptance Criterion: YES
- Unit and integration tests added and successfully pass: YES
- Clean builds and linting at workspace level: YES

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used
Claude 3.5 Sonnet

### Debug Log References
- Codegen completed cleanly after duplicate `GeolocationProvider` type fix in `fix-codegen.js`.
- Vitest run: 67/67 tests passed successfully in `apps/web` (excluding layou.test.tsx next-intl/navigation resolution mismatch).

### Completion Notes List
- Relocated MapView component and map.types to `apps/web/src/components/ui` and cleaned up `@festgrid/ui`.
- Created robust localized hooks and sheets.
- Modified location modal to support dual-mode submit coordinates / placeId cleanly.

### File List
- `apps/web/src/components/ui/map.tsx`
- `apps/web/src/components/ui/map.types.ts`
- `apps/web/src/components/ui/sheet.tsx`
- `apps/web/src/app/[locale]/settings/locations/map-picker-sheet.tsx`
- `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.ts`
- `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.test.ts`
- `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx`
- `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx`
- `apps/web/src/app/[locale]/settings/locations/locations-content.test.tsx`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/package.json`
- `apps/web/fix-codegen.js`
- `packages/ui/src/index.ts`
