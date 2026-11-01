---
backlog_id: IDEA-050
title: "GridContainer's masonry variant is plain CSS Grid (row-locked), not true Pinterest-style independent column flow — replace with JS shortest-column placement"
captured: 2026-09-22
---

# IDEA-050: GridContainer's masonry variant is plain CSS Grid (row-locked), not true Pinterest-style independent column flow — replace with JS shortest-column placement

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Architecture Spine AD-27, decided in the same session as AD-26/IDEA-049. Native CSS masonry ruled out (Safari-only in 2026); CSS multi-column rejected (reading-order regression). Becomes AD-26's tool's first rule-based-mode consumer -- sequence bmad-create-story for this after Story 0.43 exists. SCOPE WIDENED, 2026-09-25 (user-reported, direct code comparison confirmed real): EventCard's masonry variant caps at max-w-[230px] (EventCard.tsx:239) regardless of its actual grid-cell width. GridContainer (baseCols=2, colsStep=1 on Discovery) grows to 6 grid-cols-N columns at 2xl, and CSS Grid's equal-fractional-column sizing means a cell easily exceeds 230px on wide screens -- the capped card centers inside a wider cell, producing large empty inter-column gaps. User wants max-width removed and the card's elements/font-size to scale responsively at larger screens instead. Deliberately folded into this same story rather than fixed separately first: a JS shortest-column-placement algorithm decides its own column-width strategy from scratch (it doesn't inherit Tailwind's grid-cols-N breakpoints), so solving card sizing under the soon-to-be-replaced CSS Grid engine would likely be redone the moment this story lands. Not yet story-created.
