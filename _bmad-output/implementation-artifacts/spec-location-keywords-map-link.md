---
title: 'Location keywords, slice 2b: keyword map link and UX reversal'
type: 'feature'
created: '2026-11-11'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The map link points at a coordinate whenever the geocoder is "confident" (`isLocationTrustworthy`), so a wrong geocoder match sends people to the wrong place, and a low-confidence match is shown differently (search icon) from a confirmed one. The event page cannot use the place names the extraction now produces (slice 1 `locationKeywords`).

**Approach:** Independent of 2a (`spec-location-keywords-geocoding.md`); needs only the `locationKeywords` GraphQL field that slice 1 shipped. The Google Maps link becomes a text search whose query is the keywords (specific to general, joined by a space), else the display name; coordinates stay only for distance and timezone. One trailing icon, no confidence gate on the link. This REVERSES an earlier UX rule ("a low-confidence match is never presented identically to a confirmed one"), so the UX text and tests are updated with it.

## Boundaries & Constraints

**Always:** `LocationLink` takes `searchQuery` and always links to `https://www.google.com/maps/search/?api=1&query=<encoded>`, never to coordinates; a pure domain helper `buildLocationSearchQuery` builds the query (keywords joined with a space, else the display name; for an account default location, which has no keywords: geocoded place name plus city). One trailing icon (`ExternalLink`); drop the `Search` icon variant and the `coordinates`/`confidence`/`matchType` props. `EventDetailView` passes the schedule's keywords, then the event's, then the display name; select `locationKeywords` wherever `location` is selected in the web GraphQL documents and carry it through the mapper and view types. Keep the `locationDetails` passthrough in the mapper (distance consumers). `SubscribedAccountCard` keeps its `isLocationTrustworthy(location)` gate: that gate decides whether to show a possibly wrong city label at all, not which URL opens; only the link inside it changes (query = place name + city). Update `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (~:417, the "search icon … coordinates absent or below the confidence threshold" sentence) and the AD-14 Rule 2 "Enforced by" map-link gate lines in the architecture spine. Historical story files stay as they are; test header comments citing Story 0.i7z are updated where the tests change.

**Ask First:** Whether the event-detail page's separate map element (the one that also uses `isLocationTrustworthy`) should keep its gate. Default: leave it, since it shows a pin rather than a link and the user did not ask about it.

**Never:** No change to geocoding, the geolocation adapter, the schema or migrations (2a). No removal of `confidence`/`matchType` from GraphQL (Story 0.i7z AC 4 tests cite them). No new GraphQL fields.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Link, keywords | `["Pasar Porosjayan","Gamping","Sleman"]` | query `Pasar Porosjayan Gamping Sleman`, no coordinates | N/A |
| Link, no keywords | display name only | query the name | N/A |
| Link, event-level fallback | schedule has no keywords, event has | event keywords | N/A |
| Account default | place name "Pakuwon Mall", city "Yogyakarta" | query `Pakuwon Mall Yogyakarta` | N/A |
| Low-confidence geocode | `isLocationTrustworthy` false | same link and same icon as a confident one | N/A |
| Subscribed account card | untrusted default location | label hidden as today (gate kept) | N/A |
| Empty | no keywords, no name | no link rendered | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/core/LocationLink.tsx` (+ `.test.tsx`, carries the 0.i7z header), `EventDetailView.tsx` :554-567, `SubscribedAccountCard.tsx` :65-72 (+ test), `EventDetailView.types.ts`
- `apps/web/src/features/events/mapper.ts` :91-93 (+ `mapper.test.ts`), `apps/web/src/features/events/queries.graphql` and any other web document selecting `location` (select `locationKeywords`), generated types (codegen; `fix-codegen.js` must list new enums only if any)
- `packages/domain/src/geolocation/` -- new pure helper `buildLocationSearchQuery` with tests
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-14 Rule 2 "Enforced by"), `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` ~:417

## Tasks & Acceptance

**Execution:**
- [ ] `packages/domain/src/geolocation/` -- `buildLocationSearchQuery` with tests
- [ ] `LocationLink.tsx` -- `searchQuery`, always a text-search URL, single icon; update callers and tests
- [ ] `EventDetailView` / mapper / view types / GraphQL documents -- keywords carried and passed
- [ ] `SubscribedAccountCard.tsx` -- link query from place name + city; gate unchanged
- [ ] AD-14 Rule 2 re-pointing; `EXPERIENCE.md`; touched test header comments

**Acceptance Criteria:**
- Given any location link, when rendered, then its URL contains no coordinates, and with keywords the query is the keywords joined by spaces.
- Given a low-confidence geocode, when the link renders, then it is identical to a confident one (same URL form, same icon).
- Given a subscribed account whose default location is untrusted, when the card renders, then the label stays hidden as before.
- Given the UX docs, when read, then they no longer state that a low-confidence match is presented differently.

## Spec Change Log

- 2026-11-11: split out of the slice 2 spec at the Checkpoint 1 walkthrough; independent of 2a. `SubscribedAccountCard` gate kept (user decision).

## Design Notes

The link no longer depends on geocoder quality, so a wrong or missing geocode cannot send someone to the wrong place; the geocoder still matters for distance and timezone (2a). Keywords make the query more specific than the display text and less likely to be a summary phrase.

## Verification

**Commands:**
- Rebuild domain dist; `pnpm --filter @festgrid/ui test`; `pnpm --filter web build` and web unit tests; domain tests with coverage -- expected: green. No database needed.

**Manual checks:**
- Open an event detail and a subscribed-account card in the web app: links open a map search on the name/keywords, never a coordinate.
