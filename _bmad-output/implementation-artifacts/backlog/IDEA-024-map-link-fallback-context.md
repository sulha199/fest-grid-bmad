---
backlog_id: IDEA-024
title: "Build the event-detail map-link's untrusted-confidence fallback from the fullest known location context (place text + city/province/country), not the bare ambiguous string"
captured: 2026-09-13
parent: IDEA-023
---

# IDEA-024 — Map-link fallback needs richer location context

## Capture

Carved out of IDEA-023 via `bmad-create-story` (Story 0.i7c) — the child scope IDEA-023's own
note originally proposed but explicitly deferred as unfinalized: once Story 0.i7c ships and
confidence-gated map links are live in production, real low-confidence examples will exist to
design/tune this against.

Today's (and 0.i7c's) fallback is the bare `s.location` AI-extracted string — likely the very
string that caused low confidence in the first place — handed straight to Google's own search.

## Proposal

Compose the fallback from whatever richer context is available (the schedule's own location
text, the account's `defaultLocation` city/province/country, or Geoapify's own
`formattedAddress`), so an untrusted resolution gets a disambiguated search rather than a
repeat of the original ambiguous one.

## Status

Needs real low-confidence production examples before scoping into a story — do not implement
speculatively.
