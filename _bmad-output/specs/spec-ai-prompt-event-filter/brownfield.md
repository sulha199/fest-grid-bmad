# Brownfield Touchpoints — AI Prompt-Based Event Filter

Existing code and docs this feature extends. See `../../project-context.md` for the project-wide conventions (GraphQL/Zod/AJV, i18n, state-management scopes) that already govern all of these.

## Filter storage

- `Widget.filters: Record<string, unknown>` — PRD §4.16 (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md:936`). This is the untyped shape SPEC.md's `EventFilterInput` decision replaces. Discovery's own filter state (URL query params via `nuqs`, per project-context.md's State Management rules) is the other consumer that should converge on the same typed shape.
- `EventType` / `EventCategory` enums already exist at PRD §4.1 (`prd.md:241`, `prd.md:256`) — CAP-2's `type`/`category` fields reuse these, not new enums.

## Location / Geoapify

- `apps/backend/src/lib/geolocation/geoapify-client.ts` — `geocodeAddress`, `reverseGeocode`, `getPlaceDetails` all currently map only `city` and `province` (`result.state || result.province || result.county`) into `LocationDetails`. Neither the current mapping nor the PRD's `LocationDetails` interface (§4.3, `prd.md:373`) exposes a raw `county` value or a normalized `adminArea` field — both need adding for CAP-2's region-mode filter.
- **Existing PRD/code drift, unrelated to this feature but adjacent:** PRD §4.3's `LocationDetails` interface documents only `coordinates`, `placeName`, `placeId`, `formattedAddress`, `timezone` — it does not list `city`/`province`, even though `geoapify-client.ts` has returned them since Story 2.4b/2.5a. Whoever implements this feature's PRD update should reconcile the interface doc with actual shipped fields while adding `adminArea` and `venueType`, rather than adding onto an already-stale doc.
- `apps/backend/src/lib/geolocation/adapter.ts` — `resolveLocation()` is the single entry point that caches (`cache-store.ts`, Postgres-backed per `docs/infrastructure/5-geolocation.md`) and dispatches to the geoapify-client functions. `resolveAdminRegion()` already exists here as a thin wrapper returning `{ city, province }` for an unrelated purpose — confirm at implementation time whether it should be extended or superseded rather than leaving two overlapping admin-region code paths.
- Live verification transcript (2026-08-28, ad hoc `curl` against the real Geoapify API, not stored as a fixture): reverse-geocoding a point inside Kota Yogyakarta's Kraton area returned `county: "Yogyakarta"`; reverse-geocoding a point in Pakem (Kabupaten Sleman) returned `county: "Sleman Regency"`. A forward-geocode of a Jalan Malioboro address (also solidly within Kota Yogyakarta) returned `county: "Depok"` — an unrelated Sleman sub-district, most likely an OSM boundary-polygon quality issue near the city/regency line. `city` was less consistent across the Sleman samples (`"Pakem"`, `"Depok"` — kecamatan-level town names — rather than `"Sleman"`). This is the basis for SPEC.md's `county`-with-`city`-fallback constraint and its accepted-limitation note.

## Venue type / extraction pipeline

- `_bmad-output/implementation-artifacts/0-13-set-up-ai-gateway-adapter-layer-for-gemini.md` — the Gemini adapter story CAP-2's `venueType` field extends (one more field in the existing per-post extraction schema), per the Adapter Pattern rule in `project-context.md`.
- Default Location fallback logic lives in the Section 3.7 flow (Account Subscription, `prd.md:66` onward) — the "inherit the entire `LocationDetails`" constraint in SPEC.md applies wherever that fallback currently copies location data onto a `Schedule`.

## FilterHub / UI

- `packages/ui/src/features/events/FilterHub.tsx` (+ `FilterHub.test.tsx`) — the component CAP-5's icon-trigger and collapsed-summary-row behavior extends. Per `project-context.md`, this is a domain-feature component in `packages/ui/src/features/events/`, not a core primitive.
- A new "My AI Filters" list page (CAP-3) should reuse the existing Favorites/Subscriptions list page pattern, including infinite scroll (project-context.md's List Navigation rule) and the shared `PageContainer`/`PageHeader`/`GridContainer` primitives where applicable.
- The rendered summary sentence (CAP-4) is user-facing text and must route through `next-intl` per project-context.md's i18n rules — including enum values (`type`, `category`, `venueType`) resolving through their translation namespaces rather than being interpolated raw, and dates within the summary formatted via `Intl.DateTimeFormat`/`useScopedLocale()` rather than a raw ISO string.

## Validation

- Per project-context.md's Runtime Schema Validation rule, the new `EventFilterInput` and its `dateRange`/`location`/`venueType`/`isFree` sub-shapes must be validated with Zod (frontend) / AJV (backend) at the point the AI extraction output enters the system — the extraction task's raw Gemini output is exactly the kind of external-source data that rule targets.
