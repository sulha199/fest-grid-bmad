---
backlog_id: BUG-041
title: "EventCard masonry-default's TILL badge is cropped -- the card has no padding around the date-box+thumbnail row, unlike the validated prototype"
captured: 2026-09-25
---

# BUG-041: EventCard masonry-default's TILL badge is cropped -- the card has no padding around the date-box+thumbnail row, unlike the validated prototype

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

User-reported, confirmed by direct code comparison: the validated prototype wraps its date-box+thumbnail row in a p-2 padding container (default-with-thumbnail.html:62), giving the till badge's -top-1.5/-left-1.5 corner offset room inside the card's overflow-hidden bounds. EventCard.tsx's real isMasonryDefault composition (:325, touched by Stories 1.i1e/1.i1k/1.i1l) had no padding wrapper at all -- the row sat flush against the <article>'s own edges, so the till badge poked outside the card and got clipped. Fixed via bmad-quick-dev (commit 77a236b5): added the p-2 wrapper, then corrected two other absolutely-positioned overlays that assumed zero row padding (the no-thumbnail favorite-badge overlay's inline math, the thumbnail-present favorite badge's stale top-1/right-1 offset) -- caught during the same pass, not left as follow-on gaps. statusBadge checked and confirmed to need no change. Verified independently: 68/68 EventCard tests, lint clean, repo-wide build 8/8. SUPERSEDED 2026-09-27 (see design-artifacts/UX-festgrid-run-1/MASONRY-CARD-SESSION-CHANGES-2026-09-27.md item 1): the pixel-perfect masonry pass removed this p-2 padding again -- the date-box+thumbnail row is flush against the card's edges once more, and the TILL/favorite badges moved from negative (floating-past-edge) to positive (just-inside-edge) offsets instead, with the outer card's overflow-hidden restored. Do NOT re-add p-2 padding to fix a cropped till badge -- that's this closed bug's fix, now reversed on purpose.
