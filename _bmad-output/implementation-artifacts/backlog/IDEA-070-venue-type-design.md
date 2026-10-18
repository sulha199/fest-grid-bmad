---
backlog_id: IDEA-070
title: "Venue type: design before it becomes a filter"
captured: 2026-10-18
---

# IDEA-070 — Venue type: design before it becomes a filter

**Captured:** 2026-10-18 · **Status:** needs a design discussion before any story.
Spawned by the AI-filter bug "exiting outdoor event for kids in weekend" (BUG-062).

## What happened

The prompt resolved to `categories: FAMILY_AND_KIDS … at OUTDOOR` and returned **zero** events,
though an obvious match existed (`ig_p_Dej1mMNAU5_`, a `FAMILY_AND_KIDS` event). The model had
emitted `venueType: "OUTDOOR"`; the query compares it with a case-sensitive `eq` against
`schedules.location_details->>'venueType'`.

**Nothing ever wrote that field.** `geoapify-client.ts` stored address, city, province, country
and timezone only; `venueType` was set solely by the dev seed (`seed-volume.ts`). So every
`venueType` filter, AI or otherwise, matched nothing in production. The PRD (§3.15, §4.3) lists the
field as part of the locked vocabulary, but no data fed it.

## What was done on 2026-10-18 (interim)

- **AI filter:** `venueType` is no longer offered to the model (prompt + response schema); a
  place word ("outdoor", "cafe", "mall") becomes a caveat and every other condition still applies.
  `dropUnsupportedVenueTypes` drops any leaf that slips through (legacy flat shape), including
  under `NOT`. A golden-fixture ratchet test enforces that no fixture models a `venueType` leaf.
- **Data:** `geoapify-client.ts` now stores Geoapify's `category` as `LocationDetails.venueType`
  (forward + reverse geocode: `category`; place details: most specific of `categories`). Raw and
  hierarchical, e.g. `commercial.shopping_mall`, `leisure.park`. Street/address/city results carry
  none. Verified live against Geoapify for Yogyakarta places.

## Open design questions

1. **Source of the value — Geoapify only, or AI?** Geoapify gives a closed, reliable vocabulary for
   *named places* but nothing for street addresses, informal venues or unnamed spots (probe:
   "Malioboro Mall" -> `commercial.shopping_mall`, "Taman Pintar" -> `leisure.park`,
   "Jl. Malioboro" -> none, "Lapangan Denggung" -> no category). AI could classify from the place
   name/caption (indoor/outdoor especially), at the cost of wrong guesses and a per-event call.
   Likely hybrid: Geoapify first, AI only where it is silent.
2. **Closed set vs free text.** Free text compared with `eq` cannot work reliably with an LLM
   emitting values. Suggest a small closed set stored on the schedule: a *setting*
   (`INDOOR` / `OUTDOOR` / `MIXED` / unknown) and a *venue kind* (cafe, mall, park, hall, ...),
   mapped from Geoapify categories by a table in `packages/domain`.
3. **`NOT` semantics.** The nested filter supports `NOT` (depth 3, 12 nodes), compiled as
   `IS DISTINCT FROM`, which **keeps rows with no value** (PRD §3.15, by design). So "indoor" via
   `NOT outdoor` would include every unclassified venue, and `outdoor` is not the complement of
   `indoor` for hybrid venues. "Indoor" needs to be a *positive* value, not the absence of outdoor.
4. **When classification runs:** at geocode time with a backfill, or lazily on first filter use.
5. **Matching:** case-insensitive / hierarchical (`commercial` matches `commercial.shopping_mall`)
   instead of `eq`.

## Re-enabling it in the AI filter (when the design lands)

Add the field back to `build-filter-extraction-request.ts` (instruction + schema, with the real
vocabulary as an `enum`), retire or narrow `dropUnsupportedVenueTypes`, flip the golden-fixture
"no venueType" ratchet, restore the six fixtures that modelled venue words (`and-id-02`,
`or-en-01`, `not-en-03`, `nesting-en-01`, `nesting-id-02`, `out-of-vocabulary-en-02`) and add
indoor/outdoor/`NOT outdoor` cases, and update PRD §3.15/§4.3.

## Related

- IDEA-071 — backfill (cached geocodes and existing schedules have no value yet).
- BUG-062 — the AI-filter bug that exposed this.
