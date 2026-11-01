---
backlog_id: IDEA-038
title: "Extend the Today/Upcoming/All temporal filter to Feed and Favorites once they adopt useListPaginationController"
captured: 2026-09-17
parent: IDEA-019
---

# IDEA-038 — Extend temporal filter to Feed/Favorites

## Capture

Carved out of IDEA-019 during its Story 0.i5d promotion (`bmad-create-story`, 2026-09-17).
EXPERIENCE.md's "Temporal Filter" section text says each consuming page
(`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`) owns the committed value via
`useListPaginationController`, but Story 0.i5d only wires Discovery's card view — Feed/Favorites
haven't adopted `useListPaginationController` at all yet (Story 0.i5b/0.i5c only cover
Discovery/moderator-tools respectively), and Favorites/Feed are still missing FilterHub's
Location/AI-filter buttons entirely per the still-open BUG-025.

## Status

Blocked in practice on Feed/Favorites first adopting the pagination controller and BUG-025's
fix landing — not actionable as its own story yet, hence `effort: m` (adoption work, not a
one-file tweak) rather than `xs`.

**AMENDED 2026-09-19 (`bmad-create-story`):** attempting to create this story surfaced that
the "Feed/Favorites adopting `useListPaginationController`" prerequisite named above had no
story anywhere in epic-0-i5 (only Discovery `0.i5b` and moderator-tools `0.i5c` were scoped;
`0.i5d`'s temporal-filter sweep is Discovery/card-view only). User chose to create that missing
prerequisite first rather than draft this story against an unbuilt foundation. It is now
**Story 0-i5e** (`0-i5e-adopt-the-controller-in-feed-and-favorites`, `ready-for-dev`), which
itself also depends on Story `1-3l` (BUG-025) landing first — see 0-i5e's own Dev Notes for the
full sequencing rationale. This row remains not-actionable until **both** 0-i5e and 1-3l reach
`done`. EXPERIENCE.md's Temporal Filter section already names `feed-content.tsx`/
`favorites-content.tsx` as anticipated future `useListPaginationController` adopters,
corroborating the gap.

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

AMENDED 2026-09-19: missing prerequisite carved to Story 0-i5e (ready-for-dev); still blocked on 0-i5e + 1-3l both landing. Full detail in backlog/IDEA-038-feed-favorites-temporal-filter-adoption.md. AMENDED 2026-09-30 (batch-event-pages-wave-a-readiness.md): also depends on Story 0-i5d -- it builds TemporalFilterToggle / EventFilterInput.temporalFilter, which this row extends to Feed/Favorites. Unblock chain is 1-3l + 0-i5e + 0-i5d, each at least `review`. AMENDED 2026-09-30 (Story 0-i5e completion): 0-i5e's own scope (Feed/Favorites adopting useListPaginationController) is now landed -- that prerequisite in the unblock chain is closed. Remaining blockers: 0-i5d and 1-3l, each still needing to reach at least `review`. UPDATED 2026-09-30 (after Wave A batch): 0-i5d, 1-3l and 0-i5e are now all at `review` -- the unblock chain is satisfied; this row is ready for `bmad-create-story IDEA-038`. CLOSED 2026-10-05: already implemented out-of-band by commit d3414728 (2026-10-03) -- `useTemporalFilter` + `temporalFilter` wired into Feed, Favorites and Account, and `buildFeedQueryCondition`/`buildAccountEventsQueryCondition` accept it. No story was ever created; do not run create-story.
