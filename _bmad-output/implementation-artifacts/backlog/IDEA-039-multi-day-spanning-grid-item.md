---
backlog_id: IDEA-039
title: "Render multi-day schedules as one spanning EventCardCalendarGridItem across day-columns, instead of N independent per-day segments"
captured: 2026-09-17
parent: IDEA-026
---

# IDEA-039 — Multi-day spanning calendar grid item

## Capture

Carved out of IDEA-026 via `bmad-create-story` (Story 1.i1f's own Gate 2 finding, 2026-09-17):
today's `WeeklyCalendarView.tsx` has no true cross-column CSS-grid spanning mechanism for
multi-day schedules — each overlapping day gets its own independent `CalendarCard` instance,
cosmetically joined only via `multiDayRoundingClass`'s corner-rounding suppression at touching
edges, not one spanning element.

Building a genuine single-spanning-element render path (width = N * `day_cell_width`) is
non-trivial, scoped to one component, and independent of the primitive itself and of the
overflow-dialog work (IDEA-026's other child, folded into BUG-036/FIND-026's own `stories`
field instead of a separate row) — so it was pulled into its own story rather than built
alongside Story 1.i1f's `EventCardCalendarGridItem` primitive.

## Promoted

Story 1.i1g delivers this; single-day rendering is explicitly unaffected (stays with Story
1.i1h's overflow-dialog work). Not yet drafted as a story file — once it is, fold this history
into its Dev Notes.
