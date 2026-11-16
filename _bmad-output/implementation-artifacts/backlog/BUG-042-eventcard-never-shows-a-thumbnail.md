---
backlog_id: BUG-042
title: "EventCard never shows a thumbnail image -- missing the imageUrl->imageFallbackUrl (durableImageUrl) pattern EventImage/EventDetailView already has"
captured: 2026-09-26
---

# BUG-042: EventCard never shows a thumbnail image -- missing the imageUrl->imageFallbackUrl (durableImageUrl) pattern EventImage/EventDetailView already has

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Fixed 2026-09-27 (bmad-quick-dev): added durableImageUrl to the 3 gap GraphQL queries, threaded imageFallbackUrl through EventCard/EventCardMediaSlot/EventCardCalendarGridItem/WeeklyCalendarView, and fixed VM1's AC-IMG-3 gap (scale="large" favorite badge on total image failure). Code-review loopback caught a real bug in the first pass: the retry chain only fired on onError, missing the common case where imageUrl is null from the start. See spec-bug-042-eventcard-family-image-fallback-chain.md for full detail.
