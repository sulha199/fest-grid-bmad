---
backlog_id: BUG-064
title: "Online events are geocoded as places; multi-venue events lose their venues; location filters see only the main schedule"
captured: 2026-10-18
---

# BUG-064 — online and multi-venue events have no model

**Captured:** 2026-10-18 · **Status:** partly reproduced. Gemini behaviour: measured (probe below). Pipeline
consequences: inferred from reading `resolve-account-and-locations.ts` and `resolvers.ts`; **not reproduced**
(no database or Geoapify key in the session).

## What the code does

- Location is resolved **per schedule** (`resolveAccountAndLocations`): schedule `location` → else the event's
  top-level location → else the account's `defaultLocation`. So an event can already have several venues.
- There is **no concept of an online event**: no field, no prompt wording, no handling (`grep zoom|online|virtual` finds nothing).
- Location filters (`adminArea`, `venueType`, `scheduleCoordinates`) join `schedules` on `isMainSchedule = true`
  only, so a venue on any other schedule cannot be matched.

## What production extraction emits (probe: `apps/backend/scripts/poc-event-insight/probe-online.ts`, 4 runs each)

| post | `schedules[].location` | runs |
|---|---|---|
| Zoom-only class | `"Zoom"` | 4/4 |
| Google Meet-only discussion | `"Google Meet"` | 4/4 |
| hybrid seminar (auditorium + Zoom) | `"Auditorium Fakultas Ekonomi UGM & Zoom"` | 4/4 |
| 3-day festival, 3 venues (place only in the schedule title) | `null` on every schedule | 4/4 |
| 2 venues on one day (place only in the title) | `null` on every schedule | 4/4 |

Consequence (inferred): `"Zoom"` is sent to the geocoder as an address; the hybrid string is a confused query;
a `null` location falls back to the **account's default location**, so each day of the festival would be placed at the
organiser's default address instead of its real venue.

## Fixability (same probe, explicit location rule appended to the prompt, 3 runs each)

Online → `location` absent 6/6; hybrid → physical venue only 3/3; festival → correct per-day venues 2/3;
two-venue day → 1/3 (the model collapses two venues on one date into one schedule). A prompt rule fixes online and
hybrid; multi-venue needs venues extracted as their own list tied to schedules (POC: `venues.ts`, 70 runs: 0 online
platforms listed as venues, 0 invented venues).

Related: IDEA-073, IDEA-070. Design: `planning-artifacts/event-insight-poc/proposal-personalized-discovery.md` §9.
