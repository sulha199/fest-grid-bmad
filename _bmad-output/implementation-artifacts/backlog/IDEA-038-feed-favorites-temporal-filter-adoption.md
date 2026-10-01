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
