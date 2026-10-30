---
backlog_id: BUG-063
title: "AI filter region match (adminArea) and area ordering have no data: nothing in production writes LocationDetails.adminArea"
captured: 2026-10-18
---

# BUG-063 — `adminArea` is read and offered to the model, but never written

**Captured:** 2026-10-18 · **Status:** not reproduced — found by reading code while building the
personalized-discovery proposal (`planning-artifacts/event-insight-poc/proposal-personalized-discovery.md` §9).
Same defect class as BUG-062 / IDEA-070 (`venueType`): a spec'd, queryable field with no production writer.

## Evidence (code reading)

| piece | where | what it does |
|---|---|---|
| reader | `apps/backend/src/schema/resolvers.ts` (`fieldMap.adminArea`) | `(schedules.location_details->>'adminArea')`, compared with `eq` by `buildLocationCondition` (`packages/domain/src/events/buildEventsQueryCondition.ts`) |
| query producer | `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts` | instructs the model to emit `{ location: { adminArea: "Sleman" } }` (also `Bantul`, `Yogyakarta`, `Jakarta`) |
| **writer** | `apps/backend/src/lib/geolocation/geoapify-client.ts` `mapGeocodeResult` | stores `city`, `province` (= `state` ‖ `province` ‖ `county`), `countryCode`, `timezone`, `venueType`. **Never `adminArea`.** |
| only other writer | `packages/database/seed-volume.ts` | dev seed |

Expected symptom: an AI filter such as "events in Sleman" compiles to `adminArea = 'Sleman'` against a field no
production path populates and returns nothing — BUG-062's symptom, for regions. PRD §4.3 describes `adminArea` as
"derived from the geolocation provider's most granular reliable admin-area field (falling back to `city`)"; that
derivation does not exist.

## Underneath it

- `county` (the **regency** — Sleman, Bantul — the level Indonesians name) is only a fallback for `province`; it is
  never stored on its own. I could not check what Geoapify returns for Indonesian places (no key in the session);
  IDEA-070's author probed categories live, the same probe is needed for admin levels.
- The comparison is a case-sensitive `eq` on free text (IDEA-070 Q5): "sleman" would not match "Sleman".
- Location filters join only the main schedule (see BUG-064).

## Fix direction

Do not write `adminArea` as one more free-text field. Store a canonical **area path** at geocode time and match
hierarchically and case-insensitively — IDEA-073.

## To verify first

One query against a real database: `SELECT count(*) FROM schedules WHERE location_details ? 'adminArea'`.
