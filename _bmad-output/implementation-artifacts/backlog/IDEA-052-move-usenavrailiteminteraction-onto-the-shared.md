---
backlog_id: IDEA-052
title: "Move useNavRailItemInteraction onto the shared useHoverFocusTooltip hook (three hand-rolled hover+focus tooltip copies exist)"
captured: 2026-09-30
---

# IDEA-052: Move useNavRailItemInteraction onto the shared useHoverFocusTooltip hook (three hand-rolled hover+focus tooltip copies exist)

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Found 2026-09-30 (Wave A readiness Gate 3): hover+focus+Escape tooltip state is hand-rolled in CalendarCard, MultiDaySpanningBar (both WeeklyCalendarView.tsx) and packages/ui/src/hooks/useNavRailItemInteraction.ts. Story 1-3k extracts useHoverFocusTooltip and adopts it in the first two; this row is the optional follow-up to adopt it in the nav rail, behavior-preserving, after 1-3k lands.
