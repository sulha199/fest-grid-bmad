---
backlog_id: BUG-087
title: "LocationDetails.city is often a kecamatan and the province is spelled two ways, so any area read from a pin's city string is wrong"
captured: 2026-10-27
---

# BUG-087 — The geocoder's `city` is often a kecamatan, not a city

## Capture

Found 2026-10-27 while settling how a venue named without an address becomes a target area (`planning-artifacts/event-insight-poc/target-area-spec-2026-10-27.md`, sections 10 and 11). Read-only PROD query on `schedules.location_details` (the column is a JSON string in prod, `(location_details #>> '{}')::jsonb`).

## Evidence

DIY schedules, by the stored `city` and `province`:

| `city` | schedules | what it really is |
|---|--:|---|
| Depok | 352 | kecamatan of Sleman (and a different place, Kota Depok, in West Java) |
| Yogyakarta | 240 + 35 | the city (but see the province spelling) |
| Sleman | 63 + 18 | the kabupaten |
| Mlati | 48 + 13 | kecamatan of Sleman |
| Banguntapan | 26 + 15 | kecamatan of Bantul |
| Pisangan | 24 | a kelurahan or desa |
| Pakem | 13 | kecamatan of Sleman |

The province appears as "Special Region of Yogyakarta" and as "Yogyakarta". `LocationDetails` has no kabupaten (`county`) field: its keys are `confidence, matchType, formattedAddress, coordinates, province, countryCode, venueType, provider, timezone, city, placeId`.

## Impact

- An area built from `city` is wrong for Sleman and Bantul venues: Plaza Ambarrukmo, Pakuwon Mall Jogja and Jogja City Mall come out as "Depok" and "Mlati".
- "Depok" collides with Kota Depok (West Java) in any name-based lookup.
- A filter or tier keyed on the province string misses half of DIY unless both spellings are handled.

## Fix direction

Resolve the geocoder's `city` INSIDE its province through the gazetteer hierarchy (kecamatan, kabupaten, province), with the narrowest match, and normalise the province aliases. The POC has both pieces: `area-resolver.ts` (`resolveArea(..., within)`) and `venue-resolution.ts` (`resolveGeocoderArea`), tested with these cases. Blocker: the POC gazetteer is a hand-typed sample; the real one must come from the official administrative-code list (Kemendagri / BPS) after checking its licence and revision.

Related: BUG-063 (admin area never written), IDEA-073 (canonical area ladder), IDEA-081 (target-area resolver), IDEA-105 (target area in production).
