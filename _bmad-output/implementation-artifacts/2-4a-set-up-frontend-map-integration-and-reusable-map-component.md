---
baseline_commit: 94d87d4be32711f0ce433a82207955e97fd1a5c3
---
# Story 2.4a: Set up frontend map integration and reusable Map component

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.4a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, domain-agnostic `MapView` component in `packages/ui` that renders interactive map tiles via MapLibre GL JS using a Geoapify-hosted, HTTP-referrer-restricted frontend API key, displays a single controlled marker, and emits the user-selected coordinates back to its parent,
so that Story 2.4 (and any future map-based location-picking UI) has the infrastructure needed to let users pick a location on a map without calling an unmanaged external service directly from a feature page or exposing Story 0.16's backend Geolocation adapter key.

## Acceptance Criteria

1. **AC1 — Renders Geoapify-hosted tiles via MapLibre GL JS:** Given a valid frontend API key, when `MapView` mounts, then it constructs the Geoapify style URL `https://maps.geoapify.com/v1/styles/{mapStyle}/style.json?apiKey={apiKey}` (default `mapStyle`: `osm-bright`, confirmed a valid Geoapify style name) and instantiates a `maplibre-gl` `Map` against it, successfully rendering tiles.
2. **AC2 — Controlled marker:** `MapView` accepts a `marker: Coordinates | null` prop (reusing `@festgrid/shared-types`'s existing `Coordinates` interface, not a new type). When `marker` is non-null, a single `maplibre-gl` `Marker` is rendered/repositioned at those coordinates without tearing down and recreating the underlying `Map` instance; when `marker` is `null`, no marker is rendered (or an existing one is removed).
3. **AC3 — Coordinate emission on interaction:** When the user clicks/taps the map surface, `MapView` reads the clicked point's `lngLat`, converts it to the shared `Coordinates` shape (`{ latitude, longitude }`), and calls the required `onCoordinatesChange(coordinates: Coordinates)` prop. `MapView` does not manage its own persisted marker state beyond what `marker` dictates — the parent is responsible for updating `marker` in response to `onCoordinatesChange`, mirroring the controlled-component pattern already established by `MultiSelect` (Story 1.5a).
4. **AC4 — Domain-agnostic prop API:** `MapView` accepts only generic props (`apiKey`, `center: Coordinates`, `zoom?`, `marker`, `onCoordinatesChange`, `mapStyle?`, `labels?`, `className?`) — no FestGrid-specific business logic, enum imports, or knowledge of events/locations/subscriptions, so it can be reused by any future feature needing a map.
5. **AC5 — Loading state:** While the underlying `Map`'s style/tiles have not yet fired their `load` event, `MapView` renders a visible loading placeholder over the map container instead of a blank or partially-rendered canvas.
6. **AC6 — Error state:** If the `Map` instance fires an `error` event (e.g. invalid/rejected API key, referrer restriction rejection, network failure), `MapView` renders a visible error message instead of a blank or broken canvas, and does not throw or crash the parent component tree.
7. **AC7 — Accessibility (documented, pointer-primary):** The map container is keyboard-focusable (`tabIndex={0}`) with a descriptive `aria-label` sourced from `labels?.ariaLabel` (English default provided). Marker placement itself is pointer/tap-only — this is a deliberate, documented, industry-wide limitation of canvas/WebGL-rendered interactive maps (MapLibre, Mapbox, Google Maps all share it: rendered content has no DOM structure for assistive tech to read or for keyboard-driven marker movement). Any consumer of `MapView` (e.g. Story 2.4) **must** provide a non-map fallback (e.g. an address-search field) as the accessible path to the same outcome; `MapView` itself does not implement keyboard-driven marker movement.
8. **AC8 — Encapsulation of the raw library:** All `maplibre-gl` imports (including its `maplibre-gl.css` stylesheet) are confined entirely to `packages/ui/src/core/map.tsx`. No feature page or other package imports `maplibre-gl` directly — consumers only ever import `MapView`/`MapViewProps` from `packages/ui`.
9. **AC9 — i18n-readiness via `labels` override:** `MapView` accepts an optional `labels?: { loadingLabel?: string; errorLabel?: string; ariaLabel?: string }` prop with English defaults (`"Loading map…"`, `"Unable to load the map."`, `"Interactive map"`), following the same pattern `MultiSelect`'s `labels.clearLabel` and `EventCard`'s `labels` prop already established, so `packages/ui` stays free of a direct `next-intl` dependency while a consuming `apps/web` page can localize it via `next-intl` at the call site (AD-6).
10. **AC10 — Separate, referrer-restricted frontend credential:** The Geoapify API key used by `MapView` is never hardcoded and is never Story 0.16's backend-only `GEOAPIFY_API_KEY`. The consuming app reads a new `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` env var and passes it into `MapView` as the required `apiKey` prop. This key is a second API key added within the same Geoapify project used by Story 0.16, restricted by HTTP referrer in the Geoapify MyProjects dashboard (a restriction that is meaningfully enforceable here, unlike Story 0.16's backend-only key, because this key is called directly from the user's browser).
11. **AC11 — Documented & exported for reuse:** `MapView` (and its prop types) is exported from `packages/ui`'s public entry point (`packages/ui/src/core/map.tsx`), with prop-level TSDoc, and has component tests (with `maplibre-gl` mocked — see Dev Notes) proving style-URL construction, marker prop-driven rendering, click-to-coordinate emission, loading/error states, the `aria-label`/focusability, and `labels` overrides, so it is discoverable and reusable across features.

## Tasks / Subtasks

- [x] Task 1: Add the dependency and scaffold the component (AC1, AC4, AC8, AC11)
  - [x] Add `maplibre-gl` (`^6.1.0`, latest stable as of this story's creation) and `@festgrid/shared-types` (`workspace:*`, for the `Coordinates` type — not previously a `packages/ui` dependency) to `packages/ui/package.json`.
  - [x] Create `packages/ui/src/core/map.tsx` and `packages/ui/src/core/map.types.ts`, following the existing `packages/ui/src/core/` co-location convention (mirrors `multi-select.tsx`/`multi-select.types.ts`).
  - [x] Import `maplibre-gl` and `maplibre-gl/dist/maplibre-gl.css` exclusively inside `map.tsx` (AC8) — component named `MapView` (not `Map`) to avoid shadowing both the JS built-in `Map` and `maplibre-gl`'s own exported `Map` class within the same file.
- [x] Task 2: Map instantiation and style URL (AC1, AC4, AC10)
  - [x] On mount (`useEffect` + `useRef` for the container `div` and the `Map` instance — raw `maplibre-gl`, no `@vis.gl/react-maplibre` wrapper, per project decision), construct the style URL from `apiKey`/`mapStyle` (default `'osm-bright'`) and instantiate `new maplibregl.Map({ container, style, center: [center.longitude, center.latitude], zoom: zoom ?? 12 })`.
  - [x] Call `map.remove()` in the effect's cleanup function on unmount.
  - [x] If `center`/`zoom` props change after initial mount, update the existing `Map` instance imperatively (`map.setCenter(...)`, `map.setZoom(...)`) rather than tearing down and recreating it.
- [x] Task 3: Marker rendering and coordinate emission (AC2, AC3)
  - [x] Keep a `maplibregl.Marker` instance in a ref; create/reposition it (`marker.setLngLat(...)`) when the `marker` prop is non-null, and remove it (`marker.remove()`) when `marker` is `null`.
  - [x] Register a `map.on('click', (e) => ...)` handler that reads `e.lngLat.lat`/`e.lngLat.lng`, builds a `Coordinates` object (`{ latitude, longitude }`), and calls `onCoordinatesChange`.
- [x] Task 4: Loading and error states (AC5, AC6)
  - [x] Track local `status: 'loading' | 'ready' | 'error'` state, initialized to `'loading'`.
  - [x] Register `map.on('load', () => setStatus('ready'))` and `map.on('error', () => setStatus('error'))`; render an overlay/placeholder while `'loading'` and a visible message while `'error'`, both absent once `'ready'`.
- [x] Task 5: Accessibility (AC7)
  - [x] Set `tabIndex={0}` and `aria-label={labels?.ariaLabel ?? 'Interactive map'}` on the map container element.
  - [x] Document (Dev Notes, already below) that marker placement is pointer/tap-only by deliberate, accepted design — no keyboard-driven crosshair/marker-movement implementation in this story.
- [x] Task 6: i18n-readiness `labels` prop (AC9)
  - [x] Add `labels?: { loadingLabel?: string; errorLabel?: string; ariaLabel?: string }` to `MapViewProps`, with English fallback defaults applied at render time (`labels?.loadingLabel ?? 'Loading map…'`, etc.).
- [x] Task 7: Export and document (AC8, AC11)
  - [x] Export `MapView`, `MapViewProps` from `packages/ui/src/core/map.tsx` (re-exporting `map.types.ts`).
  - [x] Add `export * from './core/map';` to `packages/ui/src/index.ts`, preserving all existing barrel export lines.
  - [x] Add TSDoc comments to the component and `MapViewProps` documenting purpose, the controlled-marker pattern, and the pointer-only a11y limitation.
- [x] Task 8: Tests (AC1-AC11)
  - [x] Mock the `maplibre-gl` module entirely (`vi.mock('maplibre-gl', ...)` with fake `Map`/`Marker` classes exposing the same method surface used by the component: `on, remove, setCenter, setZoom, setLngLat`) — MapLibre GL JS requires a real WebGL canvas context unavailable in `jsdom`, so no real `Map`/`Marker` can be instantiated in Vitest.
  - [x] Component tests (`packages/ui/vitest.config.ts`) covering: correct style URL construction from `apiKey`/`mapStyle` (default and override); `Map` instantiated with the given `center`/`zoom`; marker created/repositioned/removed as the `marker` prop changes across renders; a simulated map click converts `lngLat` to `Coordinates` and calls `onCoordinatesChange` with it; loading overlay shown before the mocked `'load'` event fires, hidden after; error message shown after the mocked `'error'` event fires; container has the expected `aria-label` and is focusable (`tabIndex={0}`); custom `labels` overrides replace the English defaults; `map.remove()` is called on unmount (verifying no leaked `Map` instance).
- [x] Task 9: Frontend credential setup (AC10)
  - [x] Add `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY=""` to `.env.example` and `apps/web/.env` (empty/placeholder — never a real key committed).
  - [x] Add `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` to `turbo.json`'s `globalEnv` array and to the `build`/`lint`/`test`/`dev` tasks' `env` arrays, matching the existing `NEXT_PUBLIC_SUPABASE_URL` entries' pattern exactly.
  - [x] Extend `SETUP_WALKTHROUGH.md`'s existing "6. Geolocation Adapter (Geoapify)" section with a new step describing how to add a **second** API key within the same Geoapify MyProjects project used by Story 0.16, restricted by HTTP referrer to the app's domain(s), stored as `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` (explicitly distinct from the unrestricted, backend-only `GEOAPIFY_API_KEY`).
- [x] Task 10: Infrastructure docs (AC1, AC10)
  - [x] Extend `docs/infrastructure/5-geolocation.md` to document that the same Geoapify project now issues two independently-restricted API keys: the existing backend geocoding/reverse-geocoding/place-details key (unrestricted, server-to-server), and this story's new HTTP-referrer-restricted frontend Maps-tiles key.
  - [x] Update `docs/infrastructure/high-level-overview.md`'s mermaid diagram to add a direct `User's Browser -- loads map tiles from --> Geoapify` edge, distinct from the existing `L_API -- resolves location via --> Geoapify` edge — this is the one deliberate, documented case of a frontend-to-third-party direct call in the architecture (map tile rendering only; all geocoding/place-resolution calls remain backend-only via Story 0.16).

## Dev Notes

- **This story is pure infrastructure — no product page consumes `MapView` yet.** Story 2.4 ("Set location by current location or map", `backlog`) is the first real caller, composing `MapView` into `location-form-dialog.tsx` (built by Story 2.3) alongside a "Use my current location" affordance and the existing address-autocomplete field (Story 2.3b). This mirrors the "reserved slot, not implemented" pattern already established by Stories 0.16, 0.18, and 0.19 — verification here is via mocked component tests, not a live page; full real-Geoapify-key visual confirmation is deferred to whenever Story 2.4 consumes it (same deferral precedent as Story 0.16's real-API-round-trip note).
- **Component named `MapView`, not `Map` (a naming decision, not in epics.md's literal text):** `map.tsx` needs to reference `maplibre-gl`'s own exported `Map` class (`new maplibregl.Map(...)`) inside the same file that exports this story's component. Naming the exported component `Map` would shadow both the JS/TS built-in `Map` collection type and create confusing same-name collisions with `maplibregl.Map` at every call site. `MapView` is unambiguous and matches the noun-first naming convention already used by `EventCard`/`MultiSelect`.
- **Why raw `maplibre-gl`, not `@vis.gl/react-maplibre` (user-confirmed decision, 2026-08-04):** Two integration approaches were presented — the raw core library wired manually via `useRef`/`useEffect`, versus the declarative React-bindings wrapper package. The user chose raw `maplibre-gl`, consistent with the precedent every existing `packages/ui/src/core/` component already sets (`AppShell`, `MultiSelect`, `EventCard`'s siblings): no framework-coupling wrapper libraries beyond React itself, smaller dependency footprint, full imperative control over the `Map`/`Marker` lifecycle, and a single library surface to mock in Vitest tests (mocking `@vis.gl/react-maplibre`'s React component tree would be materially more complex than mocking two classes' method calls).
- **Pointer-only marker placement is a deliberate, user-confirmed scope decision (2026-08-04), not an oversight:** A Gate 2 (UX) analysis flagged that MapLibre GL JS (like all WebGL-canvas-rendered maps — Mapbox, Google Maps included) has no DOM structure for screen readers or native keyboard-driven marker movement. Two options were presented: (1) pointer-only interaction with a focusable, labeled container and an explicit requirement that consumers provide a non-map fallback path, or (2) building custom keyboard crosshair/marker-movement handling as new scope. The user chose (1). AC7/Task 5 implement this; Story 2.4's own Dev Notes must carry forward the requirement that its form provides the address-search field (Story 2.3b) as the accessible equivalent path, not just a visual nicety.
- **Why `Coordinates` is reused, not redefined:** `@festgrid/shared-types`'s `Coordinates` (`{ latitude, longitude }`) already exists and is the exact shape Story 0.16's `resolveLocation`, Story 2.3a's `UserLocationPreference.coordinates`, and Story 2.3b all already use — reusing it here means `MapView`'s `onCoordinatesChange` output can be handed directly to Story 2.4's eventual `createUserLocation`/`updateUserLocation` calls with no mapping layer, avoiding the kind of shape-duplication `LocationDetails.provider` (Story 0.16) was added specifically to prevent. This is `packages/ui`'s first dependency on `@festgrid/shared-types` — a new, additive workspace dependency (Task 1), not a change to the shared-types package itself.
- **Why no `packages/domain` involvement:** The only non-trivial logic in this story is converting a MapLibre `LngLat` (`{ lng, lat }`) into the shared `Coordinates` shape (`{ latitude, longitude }`) — a single-line, single-call-site field rename with no branching. This was evaluated against `project-context.md`'s "reusable, framework-agnostic mechanism" bar and judged not to meet it, using the identical reasoning Story 2.3's Dev Notes already applied to its own km↔meter radius conversion (a trivial, single-story, two-call-site operation, not a cross-feature mechanism).
- **Why the API key is a required prop, not read from `process.env` inside `packages/ui`:** `packages/ui` components stay environment/framework-agnostic (no direct `next-intl`, no direct `process.env` reads elsewhere in the package) — the consuming `apps/web` call site reads `process.env.NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` and passes it down as `apiKey`, the same boundary `useScopedLocale`/`useScopedTimezone` already draw between "app-level config" and "framework-agnostic package."
- **Why a second Geoapify API key in the same project, not a second project:** Confirmed via Geoapify's own documentation (checked 2026-08-04) that a single Geoapify MyProjects project supports multiple independently-restricted API keys — there is no need to create a second project just to get independent HTTP-referrer restriction on a second key. This keeps Story 0.16's existing project/setup intact and only adds one new key.
- **Latest Tech Information (checked 2026-08-04):** `maplibre-gl` latest stable is `6.1.0`. Geoapify's Map Tiles style.json endpoint: `GET https://maps.geoapify.com/v1/styles/{style-name}/style.json?apiKey={key}`, Mapbox-GL-style-spec-compatible (works directly with `maplibre-gl`). Confirmed valid style names include `osm-bright` (this story's default), `osm-bright-grey`, `osm-carto`, `positron`, `dark-matter`, among others — `osm-bright` is Geoapify's own recommended general-purpose default. Geoapify's dashboard supports adding multiple API keys per project, each independently restrictable by HTTP referrer/IP/origin.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.4a` listed in `stories_covered`) — this story *is itself* the report's named resolution to its own Gate 1 finding ("Frontend Map Tile Integration... Addressed via Story 2.4a"). No further Gate 1/3 subagent pass is re-run here per `story-split-gate.md`'s Epic-Level Sweep Mode.
  - **Lightweight escape-hatch guard:** Checked this story's specific implementation-level scope for anything the epic-wide sweep (which reasons over `epics.md`'s planned ACs, not implementation detail) would not have anticipated. Nothing new found: (1) `maplibre-gl` + the Geoapify Maps API key are a client-side JS library plus a third-party SaaS credential, not an AWS-provisioned resource — no new `apps/infrastructure` IaC is needed, mirroring Story 0.16's identical conclusion for its own Geoapify key; (2) the trivial `LngLat`→`Coordinates` conversion does not meet the `packages/domain` reusable-mechanism bar (see Dev Notes above), matching Story 2.3's identical km/m-conversion precedent; (3) no new database, GraphQL, or auth surface is touched at all — this story is entirely frontend/`packages/ui` plus env/docs config.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya-persona (UX) analysis against this story's draft scope (2026-08-04). **Verdict: no further split.** The component's scope — tile rendering, single controlled marker placement, coordinate emission — is one cohesive interaction dimension ("user interacts with a map surface, component reports a point"), unlike the original Story 1.5 combobox that stacked four independent complex-state dimensions (search-filter, multi-toggle, keyboard-nav, popover open/close) and warranted a split into 1.5a. This sits at the same complexity tier as `EventCard`/`MultiSelect` — cohesive, not decomposable.
  - **AC gaps the analysis surfaced, folded into this story's ACs rather than split out:** an explicit loading state (AC5 — absent from `epics.md`'s bare-bones draft text), an explicit error state for tile-load/referrer-rejection failures (AC6 — a first-class risk given this story's own AC is *about* a restricted key), an i18n-readiness `labels` override prop (AC9, mirroring `MultiSelect`/`EventCard`'s established pattern), and an explicit accessibility AC (AC7) rather than leaving the canvas-rendering a11y limitation undocumented.
  - **Confirmed correctly out of scope for this story (belongs to Story 2.4, the consumer):** the geocoder/address-search box UI (already Story 2.3/2.3b's scope), the "Use my current location" browser-geolocation button, and reverse-geocoding a clicked point's coordinates back into a human-readable address string — `MapView` only ever emits raw `{ latitude, longitude }`.
  - **Known a11y limitation, explicitly accepted (not silently ignored) — see Dev Notes' "Pointer-only marker placement" note above** for the two options presented and the user's confirmed choice.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No mismatch.** `MapView` reuses `@festgrid/shared-types`'s existing `Coordinates` interface (`{ latitude, longitude }`) verbatim for both its `center`/`marker` props and its `onCoordinatesChange` callback payload — no new shared type is introduced.
- Impacted fields/contracts: `packages/ui/package.json` (new dependencies: `maplibre-gl`, `@festgrid/shared-types`); new package-local `MapViewProps`/`MapViewLabels` types in `packages/ui/src/core/map.types.ts` (not shared-types — these are `packages/ui`-local prop shapes, the same treatment `MultiSelectProps` already gets).
- Required DB migration changes: None — this story touches no database code.
- Required TypeScript type changes: None to `@festgrid/shared-types` itself (reused as-is); new local types only in `packages/ui`.
- Backward compatibility and rollout notes: Purely additive new component and new env var; no existing `packages/ui` export, prop, or consumer is changed.
- Verification checks: `packages/ui`'s component tests (Task 8) proving style-URL construction, marker/coordinate wiring, and loading/error states against a mocked `maplibre-gl`; TypeScript strict-mode type-check for `packages/ui` confirming `Coordinates` is consumed with no shape mismatch.

### Project Structure Notes

- New: `packages/ui/src/core/map.tsx`, `packages/ui/src/core/map.types.ts`, `packages/ui/src/core/map.test.tsx`.
- Modified: `packages/ui/src/index.ts` (extend barrel with `export * from './core/map';`); `packages/ui/package.json` (new `maplibre-gl`, `@festgrid/shared-types` dependencies); `.env.example` and `apps/web/.env` (new `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` placeholder); `turbo.json` (new env var in `globalEnv` + `build`/`lint`/`test`/`dev` task env arrays); `SETUP_WALKTHROUGH.md` (extend existing §6, no new numbered section — same Geoapify project, second key); `docs/infrastructure/5-geolocation.md` (document the second key); `docs/infrastructure/high-level-overview.md` (new diagram edge).
- Not modified: any `apps/web` route/page (no live consumer — Story 2.4's scope), `apps/backend`, `packages/database`, `packages/domain`, `apps/infrastructure` (no AWS resource; a Geoapify API key is a third-party SaaS credential, mirroring Story 0.16's identical conclusion for its own key).
- Detected conflicts or variances: None. `packages/ui`'s Vitest scaffolding (`packages/ui/vitest.config.ts`, `@festgrid/testing-config/vitest-react`) already exists (established by Stories 1.3b/1.5a) — this story extends it, it does not create it.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.4a`] — story AC source and the `Note:` explaining its Gate 1 origin.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.4`, `#Story 2.3`] — confirms Story 2.4 is this component's first real consumer, and Story 2.3's Dev Notes finding #5 (raw lat/lng input mode exists in the backend but no UI for it yet — explicitly Story 2.4's scope, not this story's).
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`] — Gate 1 sweep finding ("Frontend Map Tile Integration"), `swept: true`, this story's own origin.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, Epic-Level Sweep Mode.
- [Source: `_bmad-output/project-context.md#Technology-Stack`, `#UI-Components-Scalability`, `#Security`, `#Code-Quality-Style-Rules`] — Core Primitive placement rule, Credential Management rule, package-dependency conventions.
- [Source: `design-artifacts/C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`] — the only UX-artifact mention of a map ("search box that uses a map/geolocation service"); confirmed via grep that neither `DESIGN.md` nor `EXPERIENCE.md` in `design-artifacts/UX-festgrid-run-1/` mention "map" at all.
- [Source: `_bmad-output/implementation-artifacts/1-5a-build-the-reusable-multiselect-component.md`] — controlled-component pattern, `labels` override i18n-readiness pattern, Core Primitive file/export conventions, Gate 2 "no further split" precedent reasoning.
- [Source: `_bmad-output/implementation-artifacts/0-16-set-up-geolocation-adapter-with-caching-layer.md`] — `Coordinates`/`LocationDetails` reuse precedent, third-party-SaaS-credential-not-an-AWS-resource precedent, "reserved slot, not implemented" pattern, deferred-real-key-verification precedent.
- [Source: `_bmad-output/implementation-artifacts/2-3-manage-saved-locations.md`] — trivial-conversion-doesn't-meet-`packages/domain`-bar precedent (km/m radius conversion), and its Gate 2 finding #5 confirming Story 2.4 (not 2.3) owns the map-pick UI.
- [Source: `packages/shared-types/src/index.ts`] — confirmed `Coordinates` interface's exact current shape.
- [Source: `packages/ui/package.json`, `packages/ui/src/index.ts`, `packages/ui/src/core/multi-select.tsx`] — confirmed current dependency list, barrel export convention, and controlled-component/`labels`-prop implementation pattern to follow.
- [Source: `apps/web/next.config.ts`, `apps/web/.env`, `.env.example`, `turbo.json`] — confirmed no `transpilePackages` config exists (existing `packages/ui` components already resolve fine without it) and the exact `NEXT_PUBLIC_*` env var wiring pattern (`.env`/`.env.example`/`turbo.json` `globalEnv` + per-task `env` arrays) to replicate for the new key.
- [Source: `docs/infrastructure/5-geolocation.md`, `docs/infrastructure/high-level-overview.md`, `SETUP_WALKTHROUGH.md` §6] — existing Geoapify documentation this story extends rather than duplicates.
- [Web research, 2026-08-04: apidocs.geoapify.com/docs/maps/map-tiles/] — style.json URL format, confirmed valid style names including `osm-bright` (recommended default), Mapbox-GL-style-spec compatibility with MapLibre GL JS.
- [Web research, 2026-08-04: npmjs.com/package/maplibre-gl] — latest stable version `6.1.0`.
- [Web research, 2026-08-04: Geoapify documentation] — confirmed a single Geoapify project supports multiple independently HTTP-referrer-restricted API keys.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack; UI Components & Scalability (Core Primitives placement); Security (Credential Management — separate, restricted frontend key); Code Quality (package-dependency conventions); Testing Rules (testing-trophy, component-test approach).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n-readiness via `labels` prop); AD-4 does not apply (no Server/URL/Client-Global state introduced by this story — see State Management note below); AD-1/2/3/5/7/8 do not apply (no query, no DB, no analytics event, no auth, no soft-delete involved).
- [ ] `docs/infrastructure/index.md`, `docs/infrastructure/5-geolocation.md`, `docs/infrastructure/high-level-overview.md` — infra docs this story extends (Task 10).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- NEW `packages/ui/src/core/map.tsx`: the `MapView` component — raw `maplibre-gl` initialization, controlled marker, click-to-coordinate emission, loading/error states, a11y wiring.
- NEW `packages/ui/src/core/map.types.ts`: `MapViewProps`, `MapViewLabels` types.
- NEW `packages/ui/src/core/map.test.tsx`: component tests against a mocked `maplibre-gl`.
- UPDATE `packages/ui/src/index.ts`: add `export * from './core/map';`.
- UPDATE `packages/ui/package.json`: add `maplibre-gl` (`^6.1.0`) and `@festgrid/shared-types` (`workspace:*`) dependencies.
- UPDATE `.env.example`, `apps/web/.env`: add `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` (placeholder/empty).
- UPDATE `turbo.json`: add `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` to `globalEnv` and the `build`/`lint`/`test`/`dev` task `env` arrays.
- UPDATE `SETUP_WALKTHROUGH.md`: extend §6 with the second-API-key/HTTP-referrer-restriction step.
- UPDATE `docs/infrastructure/5-geolocation.md`: document the second (frontend) key alongside the existing backend key.
- UPDATE `docs/infrastructure/high-level-overview.md`: add the `User's Browser --> Geoapify` diagram edge.
- **Consumed, not modified by this story:** `@festgrid/shared-types`'s `Coordinates` (read-only reuse, no changes to that package's source).

### Rule Mapping

- Core Primitive placement (`project-context.md` Code Organization) → `MapView` built in `packages/ui/src/core/map.tsx`, domain-agnostic (AC4).
- Credential Management (`project-context.md` Security) → API key never hardcoded, sourced from `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY`, passed as a required prop, restricted by HTTP referrer, kept separate from Story 0.16's backend key (AC10).
- i18n-readiness (AD-6) → `labels` override prop with English defaults, no direct `next-intl` dependency inside `packages/ui` (AC9).
- Accessibility (WCAG-pragmatic precedent from `MultiSelect`/`EventCard`) → focusable container with `aria-label`, explicitly documented pointer-only limitation rather than an unaddressed gap (AC7).
- Reuse boundary (Gate 2 finding) → built once in `packages/ui/src/core/`, consumed by Story 2.4 and any future map-needing feature.
- Testing Philosophy (testing trophy) → integration-style component tests via Vitest + Testing Library against a mocked `maplibre-gl`, matching `MultiSelect`'s approach.
- Adapter/isolation principle (`project-context.md` General Architecture) → the third-party mapping library (`maplibre-gl`) is fully encapsulated behind `MapView`'s generic prop API, exactly as the Adapter Pattern rule intends for external services (AC8).

### Verification Plan

- Component test: constructs the correct Geoapify style URL from `apiKey`/default and custom `mapStyle`.
- Component test: `maplibregl.Map` instantiated with the given `center`/`zoom`, and `map.remove()` is called on unmount.
- Component test: marker created when `marker` prop is set, repositioned on prop change, removed when `marker` becomes `null`.
- Component test: simulated map click converts `lngLat` to `Coordinates` and calls `onCoordinatesChange` with the exact `{ latitude, longitude }` shape.
- Component test: loading overlay visible before the mocked `'load'` event, hidden after.
- Component test: error message visible after the mocked `'error'` event, no thrown exception.
- Component test: container has `tabIndex={0}` and the expected `aria-label` (default and `labels.ariaLabel` override).
- Component test: `labels.loadingLabel`/`labels.errorLabel` overrides render instead of the English defaults.
- `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, and TypeScript strict-mode type-check for `packages/ui` all clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `MapView` as a standalone, presentation-only, domain-agnostic `packages/ui/src/core/` component wrapping raw `maplibre-gl`; no live `apps/web` page consumes it in this story (that is Story 2.4).
- [ ] Architecture confirmed: raw `maplibre-gl` (not `@vis.gl/react-maplibre`), API key passed as a required prop (never read from `process.env` inside `packages/ui`), all `maplibre-gl` imports confined to `map.tsx`.
- [ ] Testing plan confirmed: Vitest + `@testing-library/react` component tests against a fully mocked `maplibre-gl` module (no real WebGL context in `jsdom`).
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from swept `epic-readiness/epic-2-readiness.md` (this story is itself the named resolution); Gate 2 run fresh, verdict "no further split," AC gaps (loading, error, `labels`, explicit a11y AC) folded into ACs above; pointer-only a11y limitation explicitly accepted per user decision (2026-08-04), with the requirement that Story 2.4 must supply a non-map accessible fallback.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [ ] Component tests (Vitest + `@testing-library/react`, `maplibre-gl` mocked) for: style-URL construction, marker create/update/remove, click-to-coordinate emission, loading/error states, `aria-label`/focusability, `labels` overrides, cleanup-on-unmount.
- [ ] No E2E test required for this story — no live page consumes `MapView` yet (E2E coverage for the map-pick flow arrives with Story 2.4's own E2E test).

## Deliverables Checklist

- [ ] `MapView` component implemented at `packages/ui/src/core/map.tsx`, wrapping raw `maplibre-gl`.
- [ ] Strictly-typed `MapViewProps`/`MapViewLabels` (`map.types.ts`).
- [ ] Controlled marker (`marker: Coordinates | null`) with click-driven `onCoordinatesChange` emission.
- [ ] Loading and error states for tile/style load failures.
- [ ] Accessibility: focusable container, `aria-label`, documented pointer-only limitation.
- [ ] `labels` i18n-override prop with English defaults.
- [ ] Exported from `packages/ui`'s public entry point with TSDoc.
- [ ] New, separate, HTTP-referrer-restricted `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` wired through `.env`/`.env.example`/`turbo.json`.
- [ ] `SETUP_WALKTHROUGH.md`, `docs/infrastructure/5-geolocation.md`, `docs/infrastructure/high-level-overview.md` updated.
- [ ] Component tests written and passing.

## Out of Scope

- The geocoder/address-search box UI, the "Use my current location" browser-geolocation button, and reverse-geocoding a clicked point into a human-readable address — all Story 2.4 (the consumer), per the Gate 2 findings above and Story 2.3's own Dev Notes finding #5.
- Any live `apps/web` route/page rendering `MapView` — Story 2.4's scope.
- Full keyboard-driven marker placement (arrow-key crosshair movement) — explicitly evaluated and rejected in favor of a documented, accepted pointer-only limitation (user decision, 2026-08-04); Story 2.4 must provide a non-map accessible fallback instead.
- Multiple simultaneous markers, clustering, polygons/shapes, or any drawing tools — this story ships a single-point picker only.
- Storybook, visual-regression, or design-system tooling — not set up anywhere in this project yet (same conclusion as Story 1.5a).
- A new AWS IaC resource — the Geoapify Maps API key is a third-party SaaS credential, not an AWS-provisioned resource (mirrors Story 0.16).

## Definition of Done

- Acceptance criteria (AC1-AC11) satisfied.
- Required component tests pass.
- Lint and TypeScript strict-mode checks pass for `packages/ui`.
- `MapView` exported from `packages/ui`'s public entry point and documented with TSDoc.
- `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY` documented in `.env.example`/`SETUP_WALKTHROUGH.md`/infrastructure docs.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used
- Claude 3.5 Sonnet

### Debug Log References
- Vitest tests run and passed successfully for @festgrid/ui package (18 test files, 140 tests).

### Completion Notes List
- Implemented robust `MapView` component in `packages/ui` wrapping raw `maplibre-gl`.
- Fully satisfied AC1 to AC11.
- Updated env config (`.env.example`, `apps/web/.env`, `turbo.json`) for `NEXT_PUBLIC_GEOAPIFY_MAPS_API_KEY`.
- Updated documentation (`docs/infrastructure/5-geolocation.md`, `docs/infrastructure/high-level-overview.md`, `SETUP_WALKTHROUGH.md`).

### File List
- `packages/ui/src/core/map.tsx`
- `packages/ui/src/core/map.types.ts`
- `packages/ui/src/core/map.test.tsx`
- `packages/ui/src/index.ts`
- `packages/ui/package.json`
- `.env.example`
- `apps/web/.env`
- `turbo.json`
- `SETUP_WALKTHROUGH.md`
- `docs/infrastructure/5-geolocation.md`
- `docs/infrastructure/high-level-overview.md`
