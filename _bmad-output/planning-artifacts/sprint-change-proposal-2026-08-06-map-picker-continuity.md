---
backlog_id: CC-006
title: "Sprint Change Proposal: Map Picker Continuity & In-Sheet Search (Story 2.4)"
status: "approved"
created: "2026-08-06T00:00:00Z"
---

# Sprint Change Proposal: Map Picker Continuity & In-Sheet Search (Story 2.4)

## 1. Issue Summary

Story 2.4's shipped "Set location by current location or map" flow gives users three separate ways to set a saved location's position: the outside Address field's live search-and-select, "Use my current location," and "Pick on map." These three flows do not share state:

- Selecting a search suggestion only ever records a `placeId` client-side — no coordinates are known until the server resolves them at Save time. So opening "Pick on map" right after a search always falls back to a generic hardcoded default center (Jakarta), discarding the location the user just searched for.
- The map sheet resets to a fixed zoom (12) and a locally-owned marker every time it opens — there is no way to zoom in/out with a control, and nothing carries over if the user closes the sheet and reopens it.
- There is no way to search for an address from *inside* the map sheet — a user who opens "Pick on map" and realizes they'd rather search has to cancel, go back to the outside Address field, search there, then reopen the map.

Net effect: switching between the three input modes loses map context every time, forcing the user to bounce between separate interaction surfaces instead of one continuous picking experience.

**Discovered by:** the user, describing the problem directly and specifying the desired outcome (continuous center/zoom/marker state across all three flows; search reachable from inside the map sheet; a zoom control; a closer initial zoom).

## 2. Impact Analysis

**Epic Impact:**
- **Epic 2** (`in-progress`): Story 2-4 (frontend picker UI, `review`) gets its AC2/AC5-AC8 revised and AC18-AC20 added (shared continuity state, in-sheet search, zoom-control consumption). Story 2-4a (`MapView`, `review`) gets two small additive props (AC12 zoom control, AC13 camera-change notifications) — needed by 2-4's amendment, useful to any future `MapView` consumer. Story 2-4b (`previewLocation` query, `review`) gets its query signature loosened to also accept a `placeId` (AC8/AC9) — needed so the map sheet can resolve a search suggestion's coordinates client-side.
- No epic added/removed/resequenced; no new story created; no epic becomes obsolete.

**Artifact Conflicts:**
- **Story files 2-4, 2-4a, 2-4b:** amended in place (detailed below) — all three are `review`, not `done`, so amending was viable, consistent with the same-day precedent in `sprint-change-proposal-2026-08-06.md` (Stories 0.18/2-3a/2-3) and Story 2.5a's own "not yet `done`, so amended in place rather than splitting a new story" reasoning.
- **`epics.md`:** not touched. Story 2.4's own file already carries a standing "Note (AC correction vs. `epics.md`)" flagging that document's Story 2.4 text as non-authoritative for ACs beyond the bare add/edit-form framing; this amendment is folded into that same story-file-is-authoritative convention rather than re-editing `epics.md`.
- **UX artifacts (`design-artifacts/`):** no change needed. Neither `DESIGN.md` nor `EXPERIENCE.md` in `UX-festgrid-run-1` mention "map" at all (confirmed by Story 2.4a's own prior grep, re-confirmed here); the only map-adjacent UX artifact, `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`, describes the address field only at the level of "a search box that uses a map/geolocation service" — it does not specify or constrain the map sheet's internal interaction model, so this amendment doesn't conflict with or require updating it.
- **PRD:** no change — no new field, entity, or business rule; this is a UX/interaction refinement to an already-specified capability (§3.3 Saved Location Preferences).
- **`project-context.md`:** no change — no new architectural rule is introduced; the amendment follows existing rules (Adapter Pattern, controlled-component pattern, i18n via `labels`/next-intl, package boundaries) rather than adding new ones.

**Technical Impact:** Real. Story 2-4's shipped, tested code (`location-form-dialog.tsx`, `map-picker-sheet.tsx`) is now stale against its own story file's ACs and needs re-implementation; Story 2-4a's shipped `MapView` (`apps/web/src/components/ui/map.tsx` — see Dependency/Contract Impacts below for the real-path note) needs two additive props; Story 2-4b's shipped `previewLocation` resolver/SDL needs a backward-compatible signature change plus new tests. No code was changed as part of this proposal — that is the follow-up `bmad-dev-story` pass this proposal hands off to.

## 3. Recommended Approach

**Selected: Option 1 — Direct Adjustment, amend in place.** Effort: Medium (three stories touched, none new). Risk: Low (additive, backward-compatible changes to shipped code; no mutation/submit contract change). Rollback (Option 2) does not apply — there is no simpler prior design to revert to; the prior design is the bug. MVP/scope review (Option 3) does not apply — no feature scope changed, this is a UX continuity fix to an existing feature's mechanism.

**Decision — amend Story 2.4 in place, do not split** (deliverable #2's explicit ask): all three stories touched are `review`, not `done`, and every addition is additive and confined to files/queries/components those stories already own outright:
- The continuity state (AC18) and in-sheet search (AC19) live entirely inside `location-form-dialog.tsx`/`map-picker-sheet.tsx` — files Story 2.4 already owns and already modifies per its own Task 5's "Extend `location-form-dialog.tsx`" framing. No new route, page, or independently-trackable feature is introduced.
- The zoom control and camera-change callback (2.4a AC12/AC13) are two small, optional, backward-compatible props on a component with exactly one real consumer (Story 2.4 itself) — there is no second consumer or cross-cutting mechanism that would justify a separate story, unlike Story 0.22's genuinely cross-cutting split in the same-day `sprint-change-proposal-2026-08-06.md`.
- The `previewLocation` placeId mode (2.4b AC8/AC9) extends a query that already exists for exactly this purpose ("resolve a location-identifying input to `LocationDetails`") — reusing the adapter's already-built `PLACE_ID` mode (Story 2.3b AC6) rather than adding a near-duplicate second query.

None of the three touch the Save/mutation contract: `createUserLocation`/`updateUserLocation`'s mutually-exclusive `address`/`coordinates`/`placeId` input modes (Story 2.3a) are unchanged, and the map sheet's Confirm action still always emits a coordinate-mode selection (see AC7's revision) — the constraint to "preserve the mutually-exclusive input-mode contract for submit payload" is satisfied by construction, not by added validation.

## 4. Detailed Change Proposals

### 4.1 Story 2-4 (`2-4-set-location-by-current-location-or-map.md`)

- **AC2 revised:** a successful "Use my current location" capture now also seeds the new shared continuity state (AC18), not just the field's own pending selection.
- **AC5 revised:** the map sheet's initial center/zoom/marker now derive from the continuity state (priority: continuity state → edited location's saved coordinates at zoom 15 → the original hardcoded default at zoom 12), instead of always falling back to a hardcoded default whenever no coordinate-mode capture had happened yet.
- **AC6 revised:** a map tap updates the continuity state's marker, not just the sheet's own local pending marker — there is one marker, not two independently-tracked ones.
- **AC7 revised:** Confirm always commits the marker's *current* position as `{ latitude, longitude }`, regardless of whether that position was reached by a direct tap or by selecting a suggestion via the new in-sheet search (AC19) — never a `placeId` from the map-sheet path. This is the load-bearing decision that keeps the mutually-exclusive submit contract intact without new validation.
- **AC8 clarified (not behaviorally changed):** restates that Cancel still leaves the form's actual *submittable* selection (`pendingCoords`/`selectedPlaceId`/`selectedDescription`) completely untouched — but explicitly does **not** reset the new continuity state, which is a separate, more liberally-updated piece of state by design (see Dev Notes → Correct-Course Amendment in the story file for why these two must stay separate).
- **New AC18 (+ 18a, 18b):** defines the shared `mapViewState` continuity state, what sets it (current-location capture, outside-field search selection via a new background `previewLocation(placeId)` resolution, or any interaction with the map sheet itself), and confirms it survives both Confirm and Cancel.
- **New AC19 (+ 19a):** the map sheet gains an embedded search input (same debounced `addressAutocomplete` query, same 3-character minimum as the outside field) that pans/marks the map on suggestion selection without closing the sheet or committing anything.
- **New AC20:** the map sheet consumes Story 2.4a's new `showZoomControl` (stays at its default `true`) and `onViewStateChange` (wired to keep the continuity state's center/zoom current as the user pans/zooms/uses the zoom control), and opens at zoom 15 when centered on a known point vs. zoom 12 for the no-context Add-mode fallback.
- **AC16/AC17 revised:** three new i18n keys for the in-sheet search field; the integration/E2E test list extended (see §4.4/Test Delta below — mirrored into the story file's own Task 7/Task 9).
- **Tasks 4-7 revised, new Task 8/9:** `map-picker-sheet.tsx` becomes a fully controlled component (no more locally-owned camera/marker state) plus the embedded search UI; `location-form-dialog.tsx` wires outside-field selections to the new background continuity resolution; a new Task 8 lifts the continuity state; a new Task 9 enumerates this amendment's test delta.
- Full detail: see the story file's own ACs 2/5-8/16-20 and Tasks 4-9, and its new "Correct-Course Amendment — 2026-08-06" Dev Notes subsection.

### 4.2 Story 2-4a (`2-4a-set-up-frontend-map-integration-and-reusable-map-component.md`)

- **New AC12 — zoom control:** optional `showZoomControl?: boolean` prop (default `true`) adds a `maplibre-gl` `NavigationControl` (zoom buttons only, no compass) to the map's top-right corner — real, keyboard-focusable DOM buttons, a partial accessibility improvement distinct from AC7's inherently pointer-only marker placement (which is unchanged).
- **New AC13 — camera-change notifications:** optional `onViewStateChange?: (state: { center: Coordinates; zoom: number }) => void` prop, fired on `moveend`/`zoomend` (not the high-frequency `move`/`zoom` events) whenever the user pans/zooms the map (drag, gesture, or the new zoom control) — lets a consumer track the live camera without polling.
- **AC4's prop list revised** to include both new props.
- **New Tasks 11/12** implement and test both additions against the file's existing mocked-`maplibre-gl` test harness.
- **Dependency-impact note carried into the story file:** the real, shipped `MapView` lives at `apps/web/src/components/ui/map.tsx` (a documented Gate 2 deviation from this story's original `packages/ui/src/core/map.tsx` plan, made during Story 2.4's implementation) — both new props apply to that real file.

### 4.3 Story 2-4b (`2-4b-extend-the-geolocation-adapter-with-a-reverse-geocode-preview-query.md`)

- **New AC8:** `previewLocation`'s signature loosens from `previewLocation(latitude: Float!, longitude: Float!)` to `previewLocation(latitude: Float, longitude: Float, placeId: String): LocationDetails!` — exactly one of `{latitude AND longitude}` or `{placeId}` required, `BAD_REQUEST` otherwise. Purely additive: existing `{latitude, longitude}` callers (Story 2.4's own original AC9/AC10 usage) are unaffected.
- **New AC9:** the `placeId` branch calls `resolveLocation({ kind: 'PLACE_ID', placeId })` — the same adapter call Story 2.3b's mutations already make; no new adapter capability needed.
- **New Tasks 8-11:** SDL change, resolver validation + branch, codegen re-run, and four new/confirmed integration test cases (placeId-only success, placeId+coords → `BAD_REQUEST`, neither → `BAD_REQUEST`, existing coords-only tests unaffected).

### 4.4 Test Delta (deliverable #4)

**New/updated integration tests — `apps/web`:**
- `location-form-dialog.test.tsx`: outside-field suggestion selection triggers a mocked `previewLocation({ placeId })` call and updates the map-continuity state without altering the Address field's displayed text or the `placeId`-mode submit payload; opening "Pick on map" after a search-selection or after "Use my current location" shows the resolved center/marker (not the hardcoded default); Cancel-ing the map sheet then reopening it shows the same center/zoom/marker as before Cancel; a failed background `previewLocation({ placeId })` call leaves the Address field/submit payload untouched.
- `map-picker-sheet.test.tsx` (new, or an extended block in `location-form-dialog.test.tsx`): embedded search input renders, is debounced, and is backed by a mocked `addressAutocomplete`; selecting a suggestion updates the mocked `MapView`'s `center`/`marker` props without closing the sheet; a manual map tap after a suggestion selection moves the marker again; Confirm after a suggestion-then-tap sequence commits the *tapped* coordinates, never the suggestion's own coordinates and never a `placeId`; `MapView` receives `showZoomControl` at its default; initial `zoom` is `15` when centered on a known point vs. `12` for the no-context fallback.

**New/updated component tests — `packages/ui`/`apps/web/src/components/ui`:**
- `map.test.tsx`: `NavigationControl` added to the mocked `Map` by default, omitted when `showZoomControl={false}`; simulated `moveend`/`zoomend` events call `onViewStateChange` with the mocked `getCenter()`/`getZoom()` values mapped to `{ latitude, longitude }`/`zoom`; not called when the prop is omitted.

**New/updated integration tests — `apps/backend`:**
- `geolocation.test.ts` (Story 2.4b's file): `placeId`-only call returns the mocked adapter's `LocationDetails` (asserts `resolveLocation` called with `{ kind: 'PLACE_ID', placeId }`); `placeId` + coordinates together → `BAD_REQUEST`; neither supplied → `BAD_REQUEST`; existing coordinates-only test cases continue to pass unmodified (proves the loosened SDL is backward-compatible).

**E2E (Playwright):**
- One new/extended scenario (`apps/web/e2e/saved-locations.spec.ts` or a focused new spec): search an address in the outside field → open "Pick on map" → assert the map is centered near the searched address (via a mocked Geoapify route, not live network) → use the in-sheet search to find a second address → assert the map pans there → tap elsewhere to fine-tune the marker → "Confirm location" → Save → assert the saved location's persisted coordinates match the final tapped point, not either searched address's own coordinates.

## 5. Dependency and Contract Impacts (deliverable #3)

| Story | Impact | GraphQL/query change? |
|---|---|---|
| **2.3** (Manage saved locations) | No AC change. Its file (`location-form-dialog.tsx`) is further modified by this amendment, consistent with Story 2.4's own already-established precedent of extending that Story-2.3-owned file. The outside Address field's own search-and-select behavior (Story 2.3 AC5) and its `placeId`-mode submit path (Story 2.3a) are unchanged — the amendment only adds a *non-blocking, silent-on-failure* background coordinate resolution triggered by that same selection. | None. |
| **2.3b** (Address autocomplete) | No change. `addressAutocomplete(input: String!): [AddressSuggestion!]!` is reused as-is by both the outside field and the new in-sheet search — same query, same 3-character minimum, same no-caching behavior. | None. |
| **2.4a** (MapView component) | Amended in place: two new optional, backward-compatible props (`showZoomControl`, `onViewStateChange`). `MapView`'s existing controlled `center`/`marker`/`zoom` props (already designed to update imperatively without teardown, per its original AC2/Task 2) are exactly what continuity needs — no change to that existing contract. | N/A (frontend component, not a query). |
| **2.4b** (`previewLocation` query) | Amended in place: signature loosened to accept an optional `placeId` alongside the now-optional `latitude`/`longitude`. Backward-compatible for existing callers. **Yes** — see §4.3/Test Delta. Codegen must be re-run (`pnpm run codegen`) so both `apps/backend`'s and `apps/web`'s generated types pick up the loosened arguments. | **Yes**, additive-only. |

No change to `createUserLocation`/`updateUserLocation` (Story 2.3a), `deleteUserLocation`, the `user_locations` table, or any DB migration.

## 6. Rollback / Risk Notes (deliverable #5)

**Risk:**
- Loosening `previewLocation`'s required `Float!` args to optional `Float` is a schema-widening change to a shipped, tested query — low risk (additive; existing clients that always pass both args are unaffected; validated by the new mutual-exclusion tests).
- Embedding a second `addressAutocomplete` consumer (the in-sheet search) alongside the existing outside-field one introduces a second independent debounce/dropdown-open state — each must stay scoped to its own component instance (standard pattern, already used once in this codebase; low risk, but flagged so the dev-story implementer doesn't accidentally share one dropdown-open boolean between both fields).
- Lifting camera/marker state out of `map-picker-sheet.tsx`'s local state into the parent is the largest structural change in this amendment — the main risk is regressing AC8's "Cancel leaves the form's prior selection untouched" guarantee while wiring the new, more liberally-updated continuity state. Mitigated by keeping the two states explicitly separate (Dev Notes → Correct-Course Amendment, Story 2.4) and by the dedicated Cancel-then-reopen test case in the Test Delta above.
- MapLibre's `moveend`/`zoomend` events can also fire for programmatic (prop-driven) camera changes, not only user-driven ones, on some library versions/configurations — Story 2.4a's Task 12 flags this as a known, accepted limitation to verify against the real library during implementation rather than a blocking design gap; worst case, a continuity update fires redundantly with no incorrect end state (it would just re-set the state to the value it was already prop-driven to).

**Rollback:** All changes are additive (new optional props/args, new ACs) with no data migration and no change to what gets persisted. If any part needs to be reverted post-implementation, reverting the relevant commit(s) is sufficient — there is no forward-only migration or destructive step anywhere in this proposal.

**Migration notes:** None. No database schema, column, or data change.

**Accessibility:** The existing non-map fallback requirement (Story 2.4a AC7 — the outside Address-field search remains the accessible, keyboard-usable path whenever the map sheet is closed) is unchanged and unaffected — the outside field is neither removed nor altered in its own interaction model, only extended with a silent background side effect. The map sheet's new zoom control (AC12) is a net accessibility improvement (real focusable buttons) but does not change the pointer-only nature of marker placement itself, which remains documented and accepted per Story 2.4a's existing AC7.

**i18n:** Three new `SavedLocationsPage` keys (`mapSearchPlaceholder`, `mapSearchSearching`, `mapSearchNoResults`) are required in both `en.json`/`id.json` for the in-sheet search field (Story 2.4 AC16, Task 6) — not yet added to the locale files (that is the follow-up dev-story pass's job, consistent with this proposal changing no source/locale files directly).

## 7. Implementation Handoff

**Scope classification: Moderate.** Three stories touched (one frontend, two backend/component), all amended in place, no new story, no epic restructuring, no PRD/MVP scope change, no DB migration, no change to the Save/mutation contract.

- **Route to:** Product Owner / Developer agents (`bmad-dev-story`) for each amended story.
- **Sequencing:** Story 2.4a (MapView's two new props) and Story 2.4b (`previewLocation`'s `placeId` mode) have no dependency on each other and can be re-implemented in either order or in parallel. Story 2.4 (the frontend picker UI) depends on both landing first — it is the consumer of both new capabilities and should re-verify against the real, codegen'd `previewLocation` and the real `MapView` props rather than msw/mocked shapes once both are done, mirroring this project's own established Definition-of-Done pattern for cross-story dependencies (e.g. Story 2.3's own DoD gate on 2.3a/2.3b).
- **Developer agent:** each story's existing content now carries the specific new ACs/Tasks needing implementation; normal `bmad-dev-story` flow applies.
- **Success criteria:** `map.test.tsx` covers the zoom control and `onViewStateChange`; `geolocation.test.ts` covers the `placeId` preview mode and its validation errors; `location-form-dialog.test.tsx`/`map-picker-sheet.test.tsx` cover continuity across all three input modes, the in-sheet search, and Confirm's always-coordinates behavior; the extended E2E scenario passes; `pnpm build`/`pnpm lint`/`pnpm run codegen`/full test suite clean at the repo root for each story as it lands.
