---
baseline_commit: df14928ce7f3c92bc4ef97a4eafeb42ed434ff47
---
# Story 2.4: Set location by current location or map

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.4
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to set a saved location's address by using my current device location or by picking a point on an interactive map, instead of only typing/searching an address,
so that I can save locations quickly and accurately even when I don't know or can't type the exact address.

## Acceptance Criteria

1. **Given** I am on the "My Locations" add/edit form (`location-form-dialog.tsx`, Story 2.3) with its existing Name/Address(autocomplete)/Radius fields, **when** the form renders, **then** two additional affordances appear next to/below the Address field: a "Use my current location" button and a "Pick on map" button, both available in both Add and Edit mode.
2. **Given** `navigator.geolocation` is available in the browser, **when** I tap "Use my current location", **then** the browser's native permission prompt (if not already granted) is triggered via `getCurrentPosition`, any prior address selection (autocomplete `placeId`, or a previously captured map/current-location coordinate) is cleared, and the resolved `{ latitude, longitude }` becomes the pending coordinate-mode selection for this field.
3. **Given** `navigator.geolocation` is unavailable (older/unsupported browser), **then** the "Use my current location" button is disabled (not merely erroring on tap), so I am not invited into a flow that cannot succeed.
4. **Given** I tap "Use my current location" and the browser denies permission, times out (10s), or otherwise fails, **then** a visible, localized inline error message appears near the Address field (not a full-screen/blocking error), no coordinate is captured, and my prior selection (if any) is left untouched.
5. **When** I tap "Pick on map", **then** a dedicated full-screen sheet opens (not inline in the compact form dialog) containing Story 2.4a's `MapView` component (`@festgrid/ui`), a "Confirm location" button, and a "Cancel"/close affordance.
6. **Given** the map sheet is open, **when** I tap/click a point on the map, **then** `MapView`'s controlled marker moves to that point (via the sheet's own local `marker` state, updated from `MapView`'s `onCoordinatesChange`) but nothing is committed to the form yet.
7. **Given** the map sheet is open with a point selected, **when** I tap "Confirm location", **then** the sheet closes, any prior address selection is cleared, and the confirmed `{ latitude, longitude }` becomes the pending coordinate-mode selection for the field — mirroring AC2's clearing behavior.
8. **Given** the map sheet is open, **when** I tap "Cancel"/close without confirming, **then** the sheet closes and the form's prior selection (address/coordinate/empty) is left completely unchanged — no partial state leaks back to the form.
9. **Given** a coordinate-mode selection was just captured (AC2 or AC7), **when** the capture succeeds, **then** the Address field shows a non-blocking, localized "resolving address…" loading indicator while the `previewLocation` query (Story 2.4b) runs, then displays the resolved `formattedAddress` in place of that indicator once it returns.
10. **Given** the `previewLocation` query (Story 2.4b) fails (network error, provider error), **then** the Address field falls back to showing the raw captured coordinates (e.g. "Current location (-6.2088, 106.8456)") instead of the loading indicator or a broken UI, and — critically — this failure does **not** block Save: the pending `{ latitude, longitude }` is still submittable, because `createUserLocation`/`updateUserLocation` (Story 2.3a) resolve and persist the real address server-side regardless of whether the client-side preview succeeded.
11. **Given** either "Use my current location" or "Pick on map" has an in-flight request (permission prompt pending, or `previewLocation` resolving), **then** the other trigger button is disabled until the in-flight request settles, preventing two concurrent coordinate-capture flows from racing each other.
12. **Given** a coordinate-mode selection (from either source) is pending, **when** I tap Save, **then** the submitted mutation (`createUserLocation` on Add, `updateUserLocation` on Edit) includes `latitude`+`longitude` (never `address` or `placeId` in the same call — Story 2.3a's mutually-exclusive input-mode contract), with the same `name`/`radius` handling and `BlockingLoader` treatment Story 2.3 already established for the autocomplete path.
13. **Given** I start typing directly into the Address field's text input after capturing a coordinate-mode selection, **then** the pending coordinate selection is cleared and the field reverts to Story 2.3's live-autocomplete-search behavior — the three input modes (search-and-select, current-location, map-pick) remain mutually exclusive at all times, matching Story 2.3a's "never both" mutation contract.
14. **And** per Story 2.4a's AC7, `MapView`'s marker placement is pointer/tap-only with no keyboard-driven marker movement — the existing Story 2.3/2.3b address-autocomplete search field remains fully visible and usable as the accessible, non-map path to the same outcome whenever the map sheet is not open; this story does not attempt to add keyboard-driven marker movement.
15. **And** the full-screen map sheet manages focus correctly: focus moves into the sheet (e.g. to the "Confirm location" button or the map container) when it opens, and returns to the "Pick on map" trigger button when it closes (Confirm, Cancel, or Escape).
16. **And** all new user-facing strings (button labels, permission/timeout/unsupported error copy, the "resolving address…" and coordinate-fallback copy, the map sheet's title/Confirm/Cancel labels) are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings.
17. **And** integration tests (Vitest + msw, mocking `navigator.geolocation` and the `previewLocation` query) verify: current-location happy path (capture → preview → Save with lat/lng), permission-denied/timeout/unsupported error states, map-pick happy path (open sheet → click `MapView` → Confirm → preview → Save with lat/lng), map-sheet Cancel leaving prior state untouched, typing after a coordinate capture reverting to search mode, `previewLocation` failure falling back to raw-coordinate display without blocking Save, and the mutual-exclusion button-disabling behavior (AC11). One Playwright E2E test extends Story 2.3's `saved-locations.spec.ts` happy path with a "Use my current location" step (Playwright's `context.setGeolocation`/`grantPermissions` mocking a fixed coordinate) through to a successfully saved location.

**Note (AC correction vs. `epics.md`):** `epics.md`'s Story 2.4 AC text only states the two buttons pre-fill/display a map, with no detail on the map's presentation surface, the address-preview behavior, error handling, or the field's mutual-exclusion semantics with Story 2.3's existing autocomplete. ACs 3-17 above were derived from: (a) Story 2.4a's own Out-of-Scope note assigning address-preview responsibility to this story, (b) a Gate 2 (UX) analysis run during this story's creation, and (c) two explicit user decisions during this story's creation (2026-08-04) — see Dev Notes → Architecture & UX Gate Findings.

## Tasks / Subtasks

- [ ] Task 1: GraphQL operation document for `previewLocation` (AC9, AC10) — **blocked on Story 2.4b shipping**
  - [ ] Add `query previewLocation($latitude: Float!, $longitude: Float!) { previewLocation(latitude: $latitude, longitude: $longitude) { formattedAddress placeName coordinates { lat lng } provider } }` to `apps/web/src/features/locations/queries.graphql` (extends the file Story 2.3 creates), matching Story 2.4b's finalized SDL exactly. **Corrected 2026-08-04 via Story 2.4b's creation:** the sub-selection is `coordinates { lat lng }`, not `{ latitude longitude }` — Story 2.4b's Dev Notes confirm the GraphQL `Coordinates` type (declared in `events.graphql`, already consumed by `Schedule.locationDetails` and already queried as `lat`/`lng` by `apps/web/src/features/events/mapper.ts`) uses `lat`/`lng` field names, distinct from `@festgrid/shared-types`' internal `Coordinates` TS interface (`latitude`/`longitude`), which this story's earlier draft had incorrectly assumed matched the GraphQL field names.
  - [ ] Run `pnpm run codegen` once Story 2.4b is merged (blocked until then — see Pre-Coding Approval Gate).
- [ ] Task 2: Add the shadcn `Sheet` primitive (AC5)
  - [ ] Add `apps/web/src/components/ui/sheet.tsx` via the project's existing shadcn-add convention (mirrors how `dialog.tsx`/`slider.tsx` were added for Stories 0.3/2.3) — a raw, uncustomized shadcn primitive, not a `packages/ui` component (matches the existing `dialog.tsx` precedent: base shadcn primitives live app-local; FestGrid's own composed reusable components live in `packages/ui/src/core`).
- [ ] Task 3: `useCurrentLocationCapture` hook (AC2, AC3, AC4)
  - [ ] New `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.ts` — co-located, single-consumer hook (per Gate 2 finding: isolate for cheap future promotion, but do not extract to `packages/ui` without a second consumer).
  - [ ] Wrap `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }`; expose `{ isAvailable, isCapturing, capture(), error }`, where `isAvailable` is `false` when `navigator.geolocation` is undefined (AC3) and `error` is one of a small typed set (`'permission-denied' | 'timeout' | 'unavailable' | 'unknown'`) mapped to the localized copy at the call site (AC4).
- [ ] Task 4: `map-picker-sheet.tsx` (AC5, AC6, AC7, AC8, AC15)
  - [ ] New `apps/web/src/app/[locale]/settings/locations/map-picker-sheet.tsx` — single-consumer, built directly in `apps/web` per the Gate 2 verdict (no `packages/ui` extraction; Story 3.3 is a speculative, not concrete, second consumer today).
  - [ ] Full-screen `Sheet` (`side="bottom"`, styled to near-full-viewport height) hosting `MapView` (`@festgrid/ui`, Story 2.4a) with local `marker: Coordinates | null` state updated via `onCoordinatesChange` (AC6); a "Confirm location" button (disabled until a marker is set) calling an `onConfirm(coordinates)` prop and closing the sheet (AC7); a Cancel/close (X icon + Escape key, both routed through shadcn `Sheet`'s built-in close handling) that closes without calling `onConfirm` (AC8).
  - [ ] Manage focus per AC15: rely on Radix `Dialog`/`Sheet`'s built-in focus-trap-on-open and focus-return-on-close (already the underlying primitive shadcn's `Sheet` wraps) — verify via test, not just assumption (Task 7).
- [ ] Task 5: Extend `location-form-dialog.tsx` (Story 2.3) with the two new triggers and the preview flow (AC1, AC2, AC7, AC9, AC10, AC11, AC12, AC13, AC14)
  - [ ] Add "Use my current location" and "Pick on map" buttons adjacent to the existing Address field (both modes, Add and Edit).
  - [ ] Wire `useCurrentLocationCapture`; on successful capture, clear `placeId`/any prior coordinate state, store the new `{ latitude, longitude }`, and trigger the `previewLocation` lazy query (AC2, AC9).
  - [ ] Wire `MapPickerSheet`'s `onConfirm`; on confirm, apply the same clear-and-capture-and-preview flow as the current-location path (AC7).
  - [ ] `previewLocation` lazy query: show a "resolving address…" indicator in the Address field while pending; on success, display `formattedAddress` as read-only display text (mirrors Story 2.3's existing edit-mode "display-only" address treatment — AC9); on failure, fall back to a raw-coordinate string, but keep the pending `{ latitude, longitude }` fully submittable (AC10) — this is a UX degrade only, never a hard error blocking Save.
  - [ ] Disable "Use my current location" while `MapPickerSheet` is open or `previewLocation` is pending, and disable "Pick on map" while geolocation capture is in flight or `previewLocation` is pending (AC11).
  - [ ] On any direct keystroke into the Address text input after a coordinate-mode capture, clear the pending coordinate state and revert to Story 2.3's existing search-and-select behavior (AC13).
  - [ ] Save button gating (extends Story 2.3's existing rule): valid submission requires `name` + valid radius + exactly one selected mode among {autocomplete `placeId`, captured current-location coordinates, captured map-pick coordinates} (Add mode), or (Edit mode) any of those three, or the address left entirely untouched.
  - [ ] On submit with a coordinate-mode selection, call `useCreateUserLocationMutation`/`useUpdateUserLocationMutation` with `latitude`/`longitude` (never `address`/`placeId` in the same call — AC12), with the same `BlockingLoader` treatment Story 2.3 already applies.
- [ ] Task 6: i18n keys (AC16)
  - [ ] Extend the `SavedLocationsPage` namespace (Story 2.3) in both `en.json`/`id.json` with: `useCurrentLocationLabel`, `pickOnMapLabel`, `geolocationPermissionDeniedError`, `geolocationTimeoutError`, `geolocationUnavailableError`, `resolvingAddressLabel`, `addressPreviewErrorFallback` (used to prefix the raw-coordinate fallback string), `mapSheetTitle`, `mapConfirmLabel`, `mapCancelLabel`.
- [ ] Task 7: Testing (AC17)
  - [ ] Extend `location-form-dialog.test.tsx` (Story 2.3, Vitest + msw): current-location happy path (mocked `navigator.geolocation.getCurrentPosition`, mocked `previewLocation` msw handler); permission-denied/timeout/unsupported error states; map-pick happy path (render `MapPickerSheet` with a mocked `MapView` — since `MapView` itself requires a mocked `maplibre-gl`, per Story 2.4a's own test approach — simulate `onCoordinatesChange` then Confirm); Cancel leaves prior state untouched; typing after capture reverts to search mode; `previewLocation` failure falls back to raw coordinates without disabling Save; mutual-exclusion button-disabling (AC11); focus moves into/returns from the sheet (AC15).
  - [ ] New `use-current-location-capture.test.ts`: covers `isAvailable=false` when `navigator.geolocation` is undefined, successful capture, and each mapped error type — a small, self-contained hook test (this hook lives in `apps/web`, not `packages/domain`, so the 100%-coverage mandate does not apply, but full branch coverage is still good practice given the hook's small surface).
  - [ ] Extend `apps/web/e2e/saved-locations.spec.ts` (Story 2.3) with a scripted step using "Use my current location" (Playwright `context.grantPermissions(['geolocation'])` + `context.setGeolocation(...)`) through to a successfully saved location, per AC17.
  - [ ] Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root, once Stories 2.3, 2.3a, 2.3b, 2.4a, 2.4b are all merged.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.4` listed in `stories_covered`) — the epic-wide sweep's own Gate 1 finding for this story ("Frontend Map Tile Integration... Addressed via Story 2.4a") is fully resolved by Story 2.4a's existing, already-drafted `MapView` component. No fresh Gate 1/3 subagent pass re-run here per `story-split-gate.md`'s Epic-Level Sweep Mode.
  - **Lightweight escape-hatch guard (found a real gap the epic-wide sweep, reasoning over `epics.md`'s bare-bones planned ACs, could not have anticipated):** Story 2.4a's own Out-of-Scope note explicitly assigns "reverse-geocoding a clicked point into a human-readable address" to this story (2.4), but no existing GraphQL query exposes reverse-geocoding as a standalone read — Story 0.16's `resolveLocation` is only reachable today as a side effect of Story 2.3a's `createUserLocation`/`updateUserLocation` mutations, which persist a database row. This story needs to preview the resolved address *before* the user commits to Save. **Presented to the user as a real tradeoff** (2026-08-04): (a) add a new `previewLocation(latitude, longitude): LocationDetails!` query wrapping the existing adapter, split into a new prerequisite story, vs. (b) skip the live preview and show only raw coordinates until after Save. **User selected (a) — the recommended, spec-faithful option.** Split into new **Story 2.4b** ("Extend the Geolocation adapter with a reverse-geocode preview query"), added to `epics.md` (immediately after Story 2.4a, before Story 2.5a) and `sprint-status.yaml` (`backlog`). This is a single-story gap (needed only by Story 2.4 today), not a re-opening of the epic sweep's own conclusions.
  - **Second real tradeoff surfaced and resolved by explicit user decision:** where should the interactive map surface render — inline within Story 2.3's existing compact modal, or in a dedicated full-screen sheet? Given the UX scenario's stated Mobile platform and the map's need for real pan/zoom/tap precision, inline placement inside a modal already holding Name/Address/Radius fields would be cramped. **User selected a dedicated full-screen sheet — the recommended option** (AC5, Task 2, Task 4).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya-persona (UX) analysis against this story's draft scope (2026-08-04), with the two decisions above already resolved as inputs. **Verdict: no further split**, matching Story 2.3's and Story 2.4a's own "no split" precedents:
  1. **`MapPickerSheet` (the full-screen sheet wrapper) — no split.** It is thin chrome (a `Sheet` + Confirm/Cancel) around an already-extracted, already-generic primitive (`MapView`, Story 2.4a), with exactly one concrete consumer today. Story 3.3 ("Set a default location for a subscription", Epic 3, still `backlog`) is a *plausible* future consumer, but its current AC text has no map-picking language — not a concrete second consumer under Gate 2's evidentiary bar. Build it single-consumer in `apps/web`, mirroring Story 2.3's `location-form-dialog.tsx` precedent; promoting it later stays cheap specifically because `MapView` itself is already generic.
  2. **`useCurrentLocationCapture` — no forced split, but isolate as its own hook file.** The browser-geolocation-capture logic (async call, three error branches, derived-state clearing, integration with `previewLocation`) is non-trivial, but Gate 2's trigger requires a *second* named consumer, and there isn't one yet. Kept co-located in `apps/web/src/app/[locale]/settings/locations/`, not promoted to `packages/ui`, but written as its own hook file rather than inlined directly in `location-form-dialog.tsx` — cheap insurance for frictionless future promotion, not an abstraction paid for today.
  3. **AC gaps folded into this story's ACs (not split out), surfaced by the analysis:** two distinct error surfaces (geolocation-capture failure vs. `previewLocation` failure) needing separate copy and non-blocking treatment (AC4, AC10); an explicit loading state for the address-preview flow (AC9); explicit race/interrupt handling between the two capture triggers (AC11); explicit map-sheet Cancel semantics (AC8); i18n coverage for all new copy as a named AC rather than assumed (AC16); explicit focus-management ACs for the full-screen sheet rather than leaving it unstated (AC15); and Story 2.4a's AC7 non-map-fallback requirement restated as this story's own explicit AC rather than left as only an inherited reference (AC14).
  - **Confirmed correctly out of scope for this story (belongs elsewhere or to a future pass):** the address-autocomplete search field itself and its `placeId` wiring (Story 2.3/2.3b's scope, consumed as-is here); `MapView`'s own rendering/marker/loading/error internals (Story 2.4a's scope, consumed as-is here); keyboard-driven marker movement (explicitly rejected in Story 2.4a's own creation, reaffirmed here per AC14).

### Data Type Compatibility & Migration Requirements

- **No DB schema changes in this story.** This story is a pure `apps/web` consumer of Story 2.3a's already-built dual input-mode mutation contract (`latitude`/`longitude` as a mutually-exclusive alternative to `address`/`placeId`) and Story 2.4b's new `previewLocation` read-only query. It introduces no new database columns, tables, or persisted shapes of its own.
- **Compatibility finding:** No mismatch. `latitude`/`longitude` (both `Float`) and the `LocationDetails` shape returned by `previewLocation` are consumed exactly as Story 2.3a/2.4b define them — no new shared type is introduced by this story.
- **Impacted fields/contracts:** `apps/web/src/features/locations/queries.graphql` (new `previewLocation` operation document, Task 1); `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited, once Story 2.4b ships and `pnpm run codegen` runs).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the codegen'd `usePreviewLocationLazyQuery` hook that will exist once Story 2.4b's schema is merged and `pnpm run codegen` is re-run — this story cannot type-check its `previewLocation` call against real generated types until then (see Pre-Coding Approval Gate).
- **Backward compatibility and rollout notes:** Purely additive extensions to `location-form-dialog.tsx` (Story 2.3) and new single-consumer files; no existing `packages/ui`/`packages/domain`/`apps/backend` export is changed by this story itself (Story 2.4a and Story 2.4b each own their own additive changes).
- **Verification checks:** `pnpm build` after Stories 2.3, 2.3a, 2.3b, 2.4a, 2.4b all land and codegen is re-run, proving `previewLocation`'s operation document type-checks against the real generated schema and that `MapView`'s prop contract matches; integration tests (Task 7) against msw-mocked/mocked versions of the same operations/components in the interim.

### Package boundaries

- `apps/web`: the two new trigger buttons, `useCurrentLocationCapture` (browser API wrapper), `MapPickerSheet` (single-consumer full-screen sheet), the extended Save-gating/mode-clearing logic in `location-form-dialog.tsx`, the new shadcn `Sheet` primitive — all inherently React/browser-API/UI-state-coupled, not `packages/domain` material. No arithmetic/parsing/branching logic in this story rises to `project-context.md`'s "reusable, framework-agnostic mechanism" bar (unlike, e.g., Story 2.3a's `validateLocationInput`).
- `packages/domain`: **no change.**
- `packages/ui`: **no new component from this story.** This story consumes `MapView` (Story 2.4a, `ready-for-dev`, not yet implemented — confirmed via a direct directory listing of `packages/ui/src/core/`, which has no `map.tsx` yet) exactly as that story's finalized prop API (`apiKey`, `center`, `zoom?`, `marker`, `onCoordinatesChange`, `mapStyle?`, `labels?`, `className?`) defines it, plus `BlockingLoader` (Story 1.7a, `review` — implemented) which Story 2.3 already wires for the Save action.
- `apps/backend`: **no change from this story.** The one backend addition this story's own creation surfaced (`previewLocation`) is Story 2.4b's scope, not built here.

### Architecture / technical constraints

- **AD-1/AD-2 (Unified Query DSL / Unified Event Querying) do not bind this story.** `previewLocation` (Story 2.4b) is not an event-collection query, matching `myLocations`'/`addressAutocomplete`'s identical non-binding precedent.
- **AD-7 (Authenticated Context):** `previewLocation` and the `latitude`/`longitude` branch of `createUserLocation`/`updateUserLocation` are already `requireAuth`-scoped server-side (Stories 2.3a/2.4b); this story adds no new auth logic client-side beyond Story 2.3's existing `/login` redirect gate on the whole page.
- **Browser Geolocation API constraint:** `navigator.geolocation.getCurrentPosition` requires a secure context (HTTPS, or `localhost` in dev) — already satisfied by the project's existing deployment/dev setup (no new infra needed); this is a client-side browser capability, not a third-party API call, so it needs no API key, no `.env` entry, and no `SETUP_WALKTHROUGH.md` update.
- **GraphQL abuse prevention:** `previewLocation` (Story 2.4b) is a flat, non-nested query; already covered by the server-wide `graphql-armor` configuration (Story 0.8) with no new nesting depth introduced by this story.
- **Accessibility (AC14, AC15):** Inherits Story 2.4a's documented, user-accepted pointer-only marker-placement limitation; this story's own explicit obligation (per 2.4a's AC7) is to keep the non-map address-search fallback fully available, and to implement correct focus-trap/focus-return semantics for the new full-screen sheet (standard Radix `Dialog`/`Sheet` behavior, verified by test rather than assumed).

### i18n Keys Required (AD-6)

Extends the `SavedLocationsPage` namespace (Story 2.3) in both `en`/`id` with: `useCurrentLocationLabel`, `pickOnMapLabel`, `geolocationPermissionDeniedError`, `geolocationTimeoutError`, `geolocationUnavailableError`, `resolvingAddressLabel`, `addressPreviewErrorFallback`, `mapSheetTitle`, `mapConfirmLabel`, `mapCancelLabel`. No new `Metadata` keys (this story adds no new route — it extends the existing `/settings/locations` page's modal).

### Analytics Events Required (AD-5)

**No new analytics events required.** Story 2.3's existing `saved_location_added`/`saved_location_updated` events (Task 6 of that story) already fire on `createUserLocation`/`updateUserLocation` success regardless of which input mode (`placeId`, `latitude`/`longitude`) produced the submitted coordinates — this story does not need its own dedicated events to satisfy AD-5, since the existing events already capture the outcome this story contributes to. (Per-input-method usage tracking, e.g. distinguishing "saved via current-location" from "saved via map-pick," was considered and judged out of scope: neither `epics.md`'s ACs nor the PRD call for input-method-level analytics, and adding it would be speculative instrumentation, not a requirement this story needs to satisfy.)

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** the new `previewLocation` lazy query (Story 2.4b), fired after either coordinate-capture path succeeds; the existing `createUserLocation`/`updateUserLocation` mutations (Story 2.3a) this story extends with the `latitude`/`longitude` input mode.
- **URL State (`nuqs`):** none — unchanged from Story 2.3.
- **Client Global State (`zustand`):** none required. All new state (captured coordinates, preview status/result, map-sheet open/closed, which input mode is currently pending) is local component state scoped to `location-form-dialog.tsx` and `map-picker-sheet.tsx`, mirroring Story 2.3's identical categorization for its own modal state.

### Loader Classification

- Browser geolocation capture (`getCurrentPosition` in flight): **Non-blocking** — a small inline spinner/disabled state on the "Use my current location" button itself, not a full-screen overlay (this is a quick, cancelable input action, not a critical mutation).
- `previewLocation` resolving after either capture path: **Non-blocking** — an inline "resolving address…" indicator within the Address field, mirroring Story 2.3's identical treatment of `addressAutocomplete`'s in-flight state.
- Map tile/style loading inside `MapPickerSheet`: **Non-blocking**, already fully handled by `MapView`'s own internal loading/error states (Story 2.4a AC5/AC6) — this story adds no additional loader around `MapView` itself.
- `createUserLocation`/`updateUserLocation` submit (the modal's "Save" action): **Blocking** (`BlockingLoader`, Story 1.7a) — unchanged from Story 2.3's existing treatment; this story's coordinate-mode submissions go through the exact same Save path.

### Previous/Sibling Story Intelligence (Stories 2.3, 2.3a, 2.3b, 2.4a, 0.16, 0.17)

- **Story 2.3 ("Manage saved locations," the base form this story extends) is `ready-for-dev` and NOT yet implemented** — confirmed via a fresh file search (`apps/web/src/app/[locale]/settings/` does not exist yet). This story directly extends `location-form-dialog.tsx`, a file Story 2.3 has not yet created — **this is this story's most direct blocking dependency**, deeper than a typical prerequisite: whichever of {2.3, 2.4} is implemented first creates the file, and the other extends it. See Pre-Coding Approval Gate.
- **Story 2.3a (saved-locations backend GraphQL API layer) is `ready-for-dev`, NOT yet implemented.** Its already-finalized dual input-mode contract (`address` **or** `latitude`+`longitude`, never both; reverse-geocode on `latitude`+`longitude`, per its own Dev Notes: *"this is what lets Story 2.4's 'Use current location'/map-pick flows... still populate a displayable `formattedAddress` without inventing a second API shape later"*) is exactly what this story's mutation calls (AC12) rely on — confirmed this contract requires **no changes** for this story; it was deliberately built dual-mode from the start for exactly this purpose.
- **Story 2.3b (address-autocomplete extension) is `ready-for-dev`, NOT yet implemented.** Adds `placeId` as the third mutually-exclusive input mode this story's Address field must clear/coordinate with (AC13).
- **Story 2.4a (`MapView`) is `ready-for-dev`, NOT yet implemented** — confirmed via a direct listing of `packages/ui/src/core/` (no `map.tsx`/`map.types.ts` present). Its finalized prop API (`apiKey`, `center: Coordinates`, `zoom?`, `marker: Coordinates | null`, `onCoordinatesChange(coordinates)`, `mapStyle?`, `labels?`, `className?`) is consumed as-is by `MapPickerSheet` in this story; its AC10 credential (`NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY`) must be read at the `apps/web` call site and passed down — this story does not add or manage that env var itself (Story 2.4a's own scope).
- **Story 0.16 (Geolocation adapter) is `review` and confirmed implemented in code** — `apps/backend/src/lib/geolocation/{adapter,geoapify-client,cache-store}.ts` all exist; `resolveLocation` already supports the `{ kind: 'COORDINATES', coordinates }` mode Story 2.4b's `previewLocation` will wrap.
- **Story 0.17 (GraphQL authenticated context layer) is `review`.** `requireAuth` is available for Story 2.4b's resolver to use.
- **Dependency-chain depth for this story is unusually deep — five siblings, none yet implemented:** Stories 2.3, 2.3a, 2.3b, 2.4a, 2.4b are all `ready-for-dev`/`backlog`, none `done`. This story cannot be meaningfully implemented (let alone type-checked against real generated GraphQL types or a real `MapView` export) until at least 2.3 (for the file it extends) and 2.4a (for the component it consumes) exist in code, and 2.4b (for the preview query) is both drafted as its own story and implemented. See Pre-Coding Approval Gate.

### Project Structure Notes

- New: `apps/web/src/components/ui/sheet.tsx` (shadcn primitive); `apps/web/src/app/[locale]/settings/locations/map-picker-sheet.tsx`; `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.ts`; `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.test.ts`.
- Modified: `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx` (Story 2.3's file — extended, not created, by this story); `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx` (extended); `apps/web/src/features/locations/queries.graphql` (Story 2.3's file — extended with `previewLocation`, blocked on Story 2.4b); `apps/web/e2e/saved-locations.spec.ts` (Story 2.3's file — extended with a current-location scripted step); `apps/web/locales/en.json`/`id.json` (new `SavedLocationsPage` keys, extending Story 2.3's namespace).
- Not modified: `apps/backend`, `packages/database`, `packages/domain`, `packages/ui` (all consumed as built by Stories 2.3a, 2.3b, 2.4a, 2.4b — none of their source is changed by this story).
- Regenerated (not hand-edited): `apps/web/src/generated/graphql.ts`, once Story 2.4b ships and `pnpm run codegen` runs.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.4`, `#Story 2.4a`, `#Story 2.4b`] — story AC source; 2.4a's Out-of-Scope note assigning address-preview to this story; 2.4b's own `Note:` explaining its Gate 1 origin from this story's creation.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`] — Gate 1 sweep finding ("Frontend Map Tile Integration... Addressed via Story 2.4a"), `swept: true`.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, Epic-Level Sweep Mode, numbering rule applied to Story 2.4b.
- [Source: `_bmad-output/implementation-artifacts/2-4a-set-up-frontend-map-integration-and-reusable-map-component.md`] — `MapView`'s finalized prop API, AC7's pointer-only a11y limitation and its explicit requirement that this story supply a non-map fallback, Out-of-Scope note assigning reverse-geocode-to-address to this story.
- [Source: `_bmad-output/implementation-artifacts/2-3-manage-saved-locations.md`] — `location-form-dialog.tsx`'s established shape/conventions (this story's direct extension target), its own Gate 2 finding #5 confirming this story owns the map-pick/current-location UI, its `BlockingLoader`/Save-gating/mode-clearing patterns this story mirrors.
- [Source: `_bmad-output/implementation-artifacts/2-3a-build-the-saved-locations-backend-graphql-api-layer.md`] — the already-built dual input-mode (`address` / `latitude`+`longitude`) mutation contract this story's Save action relies on, confirmed to need no changes.
- [Source: `_bmad-output/implementation-artifacts/2-3b-extend-the-geolocation-adapter-and-saved-locations-api-with-address-autocomplete-support.md`] — the `placeId` third input mode this story's field must clear/coordinate against.
- [Source: `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`] — the only UX-artifact mention of "Use Current Location"/a map/geolocation search box; confirmed via grep that neither `DESIGN.md` nor `EXPERIENCE.md` in `design-artifacts/UX-festgrid-run-1/` mention "map"/"current location" at all — this story's finer interaction details (preview flow, sheet vs. inline, error/race handling) were derived via the Gate 2 analysis and explicit user decisions, not a pre-existing detailed spec.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.3 Saved Location Preferences`] — "A location can be set by using the user's current location or by picking a point on a map."
- [Source: `packages/shared-types/src/index.ts`] — confirmed `Coordinates`/`LocationDetails` interfaces' exact current shapes.
- [Source: `apps/backend/src/lib/geolocation/adapter.ts`] — confirmed `resolveLocation(query: GeolocationQuery)`'s `COORDINATES` mode, which Story 2.4b's `previewLocation` will call directly.
- [Source: `apps/web/src/components/ui/dialog.tsx`] — confirmed shadcn primitives are added app-local (`apps/web/src/components/ui/`), not to `packages/ui`, establishing the same convention this story's new `sheet.tsx` follows.
- [Source: `apps/web/src/lib/metadata.ts`, `apps/web/locales/en.json`] — confirmed `buildPageMetadata` helper and `Metadata`/namespace i18n key conventions (no new usage needed here — this story adds no new route).

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → UI Patterns & UX Invariants, State Management Architecture, Security; Code Quality & Style Rules → Code Organization/UI Components; Testing Rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-5, AD-6, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.3, 2.3a, 2.3b, 2.4, 2.4a, 2.4b)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` (§3.3)
- `docs/infrastructure/index.md` (no shard file touches this story — no backend/infra change here; Story 2.4b owns the one backend addition this story depends on)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- NEW `apps/web/src/components/ui/sheet.tsx`: shadcn `Sheet` primitive.
- NEW `apps/web/src/app/[locale]/settings/locations/map-picker-sheet.tsx`: full-screen sheet hosting `MapView`, Confirm/Cancel.
- NEW `apps/web/src/app/[locale]/settings/locations/use-current-location-capture.ts` (+ `.test.ts`): browser-geolocation wrapper hook.
- UPDATE `apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx` (Story 2.3): new buttons, preview flow, mode-clearing, Save-gating extension.
- UPDATE `apps/web/src/app/[locale]/settings/locations/location-form-dialog.test.tsx` (Story 2.3): new test cases per Task 7.
- UPDATE `apps/web/src/features/locations/queries.graphql` (Story 2.3): add `previewLocation` operation document (blocked on Story 2.4b).
- UPDATE `apps/web/e2e/saved-locations.spec.ts` (Story 2.3): add current-location scripted step.
- UPDATE `apps/web/locales/en.json`/`id.json`: extend `SavedLocationsPage` namespace with 10 new keys.
- **Consumed, not modified by this story:** `packages/ui`'s `MapView` (Story 2.4a), `BlockingLoader` (Story 1.7a); `apps/backend`'s `previewLocation` resolver (Story 2.4b) and existing `createUserLocation`/`updateUserLocation` dual-mode contract (Story 2.3a).

### Rule Mapping

- Core Primitive reuse (`project-context.md` UI Components & Scalability) → consumes `MapView` from `packages/ui/src/core/map.tsx` as-is, no duplication of mapping logic in `apps/web` (AC5, AC6).
- Reuse-evidence bar (Gate 2, `story-split-gate.md`) → `MapPickerSheet`/`useCurrentLocationCapture` built single-consumer in `apps/web`, not prematurely promoted to `packages/ui`, since no second concrete consumer exists today.
- Mutually-exclusive input-mode contract (Story 2.3a) → Save always submits exactly one of `placeId`/`address`/`latitude`+`longitude`, never a combination (AC12, AC13).
- i18n-readiness (AD-6) → all new copy routed through the `SavedLocationsPage` next-intl namespace, no hardcoded strings (AC16).
- Loader Classification invariant (`project-context.md` UI Patterns) → geolocation capture and address-preview are Non-blocking inline indicators; Save remains the sole Blocking action, unchanged from Story 2.3.
- Accessibility inheritance (Story 2.4a AC7) → non-map address-search fallback stays available at all times; new focus-trap/focus-return ACs for the sheet (AC14, AC15).
- Analytics (AD-5) → explicitly no new events required; existing Story 2.3 events already cover this story's outcomes (see Dev Notes → Analytics Events Required).

### Verification Plan

- Integration test: current-location happy path — capture → preview resolves → Save submits `latitude`/`longitude`.
- Integration test: permission-denied, timeout, and `navigator.geolocation` unavailable states, each with correct localized copy and no coordinate captured.
- Integration test: map-pick happy path — open sheet → simulated `MapView` click → Confirm → preview resolves → Save submits `latitude`/`longitude`.
- Integration test: map-sheet Cancel leaves prior form state completely unchanged.
- Integration test: typing into the Address field after a coordinate capture clears the pending coordinate and reverts to search mode.
- Integration test: `previewLocation` failure falls back to raw-coordinate display and Save remains enabled/submittable.
- Integration test: the inactive trigger button is disabled while the other capture flow is in flight (AC11).
- Integration/component test: focus moves into the sheet on open and returns to the "Pick on map" button on close (Confirm, Cancel, and Escape).
- Hook test (`use-current-location-capture.test.ts`): `isAvailable=false` branch, success branch, each error-type branch.
- E2E: extended `saved-locations.spec.ts` happy path including the current-location step.
- `pnpm build`, `pnpm lint`, `pnpm run codegen` clean at the repo root, once Stories 2.3, 2.3a, 2.3b, 2.4a, 2.4b are all merged.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: extend Story 2.3's `location-form-dialog.tsx` with current-location and map-pick input modes, backed by a new `previewLocation` query (Story 2.4b, split off during this story's creation) and Story 2.4a's `MapView`, presented via a dedicated full-screen sheet.
- [ ] Architecture confirmed: no new `packages/ui`/`packages/domain` component (Gate 2 verdict: no split); coordinate-mode mutation calls use Story 2.3a's already-built dual input-mode contract unmodified; `previewLocation` failures degrade gracefully and never block Save.
- [ ] Testing plan confirmed: Vitest + msw integration tests extending `location-form-dialog.test.tsx`; a standalone hook test for `useCurrentLocationCapture`; one extended Playwright E2E scenario.
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from swept `epic-readiness/epic-2-readiness.md`; one fresh Gate 1 escape-hatch gap found and split into Story 2.4b (user confirmed, recommended option); a second real tradeoff (map sheet vs. inline) resolved by user decision (full-screen sheet, recommended option); Gate 2 run fresh, verdict "no further split," AC gaps folded into ACs 3-17 above.
- [ ] **Blocking dependency-chain check — none of this story's five prerequisites are `done` as of this story's creation:** Story 2.3 (`ready-for-dev`, not implemented — this story extends a file 2.3 has not yet created), Story 2.3a (`ready-for-dev`, not implemented), Story 2.3b (`ready-for-dev`, not implemented), Story 2.4a (`ready-for-dev`, not implemented — no `packages/ui/src/core/map.tsx` exists yet), Story 2.4b (`backlog`, not yet drafted as its own story file). **This story cannot be meaningfully implemented until at minimum Story 2.3 and Story 2.4a exist in code, and Story 2.4b is drafted and implemented.** Explicit human approval state (Default: pending approval) — do not begin implementation until this chain is resolved or the user explicitly accepts building against interim mocks/stubs.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted.

## Testing Requirements

- [ ] Integration tests (Vitest + msw, `navigator.geolocation` and `previewLocation` mocked) covering all branches in AC17.
- [ ] Standalone hook test for `useCurrentLocationCapture` covering availability/success/each error type.
- [ ] One extended Playwright E2E test (`saved-locations.spec.ts`) covering the current-location happy path end-to-end.
- [ ] No new unit-test package required — this story adds no `packages/domain` logic.

## Deliverables Checklist

- [ ] "Use my current location" and "Pick on map" buttons added to `location-form-dialog.tsx`, both Add and Edit modes.
- [ ] `useCurrentLocationCapture` hook with availability/permission/timeout error handling.
- [ ] `MapPickerSheet` (full-screen, `MapView`-hosting, Confirm/Cancel, correct focus management).
- [ ] `previewLocation` GraphQL operation document wired to a non-blocking loading/fallback address-preview UI.
- [ ] Mutual-exclusion enforced across the three input modes (search, current-location, map-pick), with correct clearing behavior.
- [ ] Coordinate-mode Save submissions correctly call `createUserLocation`/`updateUserLocation` with `latitude`/`longitude`.
- [ ] All new copy localized (`en`/`id`), no hardcoded strings.
- [ ] Integration, hook, and E2E tests written and passing.

## Out of Scope

- **The `previewLocation` GraphQL query's backend implementation** — split into **Story 2.4b** ("Extend the Geolocation adapter with a reverse-geocode preview query"), per the Gate 1 escape-hatch finding above; this story only consumes it once shipped.
- **The address-autocomplete search field and its `placeId` wiring** — Story 2.3/2.3b's scope, consumed as-is.
- **`MapView`'s own rendering, marker, loading/error internals, and credential wiring** — Story 2.4a's scope, consumed as-is.
- **Keyboard-driven marker movement / any accessible alternative to pointer-based map interaction beyond the existing address-search fallback** — explicitly evaluated and rejected during Story 2.4a's own creation; reaffirmed here (AC14), not reopened.
- **Per-input-method analytics tracking** (distinguishing "saved via current location" vs. "via map-pick" vs. "via search") — considered and judged speculative/out of scope; not required by any AC or the PRD (see Dev Notes → Analytics Events Required).
- **Reverse-geocoding/preview caching beyond what Story 2.4b's `previewLocation` query itself provides** (that story already reuses Story 0.16's existing Postgres-backed cache) — no additional client-side caching layer is built in this story.

## Definition of Done

- Acceptance criteria (AC1-AC17) satisfied.
- Required integration, hook, and E2E tests pass.
- Lint and TypeScript strict-mode checks pass for `apps/web`.
- All new user-facing strings localized in `en`/`id`.
- Story 2.4b implemented and merged (this story's `previewLocation` call type-checks against real generated types, not a hand-written stub).
- Story 2.3, 2.3a, 2.3b, 2.4a all implemented and merged (this story's file extensions and component consumption target real, not planned, code).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
