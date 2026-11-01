---
backlog_id: FIND-056
title: "BUG-047 code review: min-w-[2ch] numeral-width assumption, and a latent date-vs-till-tag mismatch for an unreachable calendar input"
captured: 2026-09-26
---

# FIND-056: BUG-047 code review: min-w-[2ch] numeral-width assumption, and a latent date-vs-till-tag mismatch for an unreachable calendar input

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred from: code review of spec-bug-047-eventcarddatebox-unified-content-rule.md (2026-09-26). 2 findings. PARTIALLY SUPERSEDED 2026-09-28: finding 2 (date-vs-till-tag mismatch for an event rendered on a calendar day after it already ended, via computeCalendarSegmentTillText's `<` vs the date-box's widened `<=`) is now moot -- computeCalendarSegmentTillText was removed entirely on 2026-09-27 (see design-artifacts/UX-festgrid-run-1/MASONRY-CARD-SESSION-CHANGES-2026-09-27.md item 3: the TILL badge no longer shows at all when the end date is today, the status badge covers that case instead). Finding 1 (min-w-[2ch] Latin-numeral-glyph-width assumption, still present at EventCardMediaPrimitives.tsx) is untouched and still open.
