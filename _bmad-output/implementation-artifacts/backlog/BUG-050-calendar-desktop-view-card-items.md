---
backlog_id: BUG-050
title: "Calendar desktop view: card items make the day-column gridlines invisible -- should remain visible under/around cards"
captured: 2026-09-26
---

# BUG-050: Calendar desktop view: card items make the day-column gridlines invisible -- should remain visible under/around cards

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Fixed 2026-09-26 (bmad-quick-dev): §2.7's divide-x candidate confirmed as sole cause, scoped to the spanning-banner row only (header/day-cell rows were already correct) -- see spec-bug-050-calendar-desktop-gridlines.md for the full root-cause writeup, fix, and committed Playwright geometry proof. CROSS-REFERENCE 2026-09-28 (not a reopen): design-artifacts/UX-festgrid-run-1/MASONRY-CARD-SESSION-CHANGES-2026-09-27.md item 7 fixes a related but distinct symptom of the same 'grid should stay visible under cards' goal -- EventCardCalendarGridItem's own bg-violet-50 fill halved to bg-violet-50/50, since a fully opaque card fill hides the gridlines regardless of the divide-x cause this bug fixed. Both fixes are complementary, not overlapping.
