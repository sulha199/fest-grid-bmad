---
backlog_id: FIND-026
title: "Calendar overflow cap (max_events_per_day) tuned for the old text-only pill, not the new richer grid-item card"
captured: 2026-09-14
parent: IDEA-026
---

# FIND-026 — Calendar overflow cap needs re-tuning for the richer card

## Capture

Surfaced while resolving IDEA-026's desktop calendar-grid-item card: real-dimension validation
(`day_cell` ~174x128px, "+N more" popover 200px inner width) showed the new
`event_card_calendar_grid_item` card cannot fit the fixed-height `day_cell`, so single-day
events attach to the existing "+N more" popover instead of rendering inline.
`event_rendering.discovery_view.max_events_per_day` (currently 5) was tuned against the old
small text-only pill's fit envelope, not this new richer card's — whether 5 is still the right
cutoff, now that popover overflow surfaces a card with a thumbnail/badges instead of a one-line
pill, was explicitly flagged during the design pass and deliberately left open rather than
guessed. Needs a product/UX call (does a bigger overflow card change how many should render
inline before overflowing?) before or during whichever story implements IDEA-026.

## Resolved (bmad-ux, 2026-09-17)

Grew into a bigger, cross-surface correction — user flagged the mobile day-list's existing
uncapped-always-render behavior (2026-08-24) as a real production scalability risk, not just a
desktop layout question. Both surfaces now cap, sized from the real card's rendered dimensions
against available space (not a fixed number; a flat 20-per-day backend fetch is an acceptable
fallback shape if precise measurement proves too costly); multi-day segments are exempt from
the cap on both surfaces, mirroring desktop's existing spanning-bar exemption, so the original
continuity guarantee (a multi-day segment must never vanish behind "+N more") is preserved
rather than dropped; "+N more" now opens one shared, responsive infinite-scroll dialog/sheet,
replacing desktop's old static `max-h-56` popover entirely. See EXPERIENCE.md "Calendar
Overflow: Scalable Cap + Infinite-Scroll Popup" and DESIGN.md `calendar_overflow_dialog`. Still
open at that point, flagged for `bmad-architecture`: the actual per-day pagination data-fetch
contract — WeeklyCalendarView currently receives one fully-loaded week batch with no per-day
cursor mechanism at all.

## Promoted (2026-09-17 via bmad-create-story)

Deterministic match — Story 1.i1h's own epics.md section cites this row by id. The per-day
pagination data-fetch contract this row flagged as still-open is resolved by AD-23 and
delivered by Story 1.i1h (window-function fetch + reused `Query.events` pagination + resolver
tie-break sort), alongside BUG-036's own fix. Not yet implemented — Story 1.i1h is itself still
`backlog` and has no story file on disk yet; once it's drafted, fold this history into its Dev
Notes.
