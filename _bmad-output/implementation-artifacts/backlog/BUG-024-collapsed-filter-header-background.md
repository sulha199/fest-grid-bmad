---
backlog_id: BUG-024
title: "Collapsed discovery filter header ('Show filters' pill) reads as missing a background"
captured: 2026-09-11
fixed: 2026-09-20
---

# BUG-024 — Collapsed discovery filter header background

## Capture

Reported by user via `bmad-help`. `EventDiscoveryPanel.tsx`'s sticky header (lines 57-59)
wraps both the collapsed pill and the expanded search+filter block in one
`sticky top-0 z-10 bg-background/95 backdrop-blur-sm` container, so a background is applied in
code to both states alike. User reports the collapsed state visually reads as backgroundless
regardless — plausibly the `/95` translucency plus backdrop-blur reading as "no background"
against certain scrolled-under card content, or the collapsed row's tighter `py-2` wrapper
(line 64) exposing edges the blur doesn't fully cover. Needed a live-rendering check (not
confirmable from source alone) before scoping a fix — likely candidates: bumping collapsed-state
opacity to solid (`bg-background` instead of `/95`), or giving the collapsed pill its own opaque
backdrop independent of the shared container.

## Fixed, 2026-09-20 (bmad-quick-dev)

Applied the surgical option-1 fix. The collapsed and expanded branches share one simple sticky
container whose className now toggles on the already-derived `isCollapsed` boolean —
`bg-background` (solid) when collapsed, `bg-background/95` when expanded — while keeping
`backdrop-blur-sm` and the border on both. This removes the translucent-plus-blur "no
background" reading specifically in the collapsed state, which is what the user reported.

Verified: targeted `EventDiscoveryPanel` vitest suite passes (12/12).

**Status kept as `done (needs visual confirmation)` rather than `done`** because the original
report explicitly flagged this as a live-rendering concern that cannot be confirmed from source
alone — a human should still eyeball the collapsed sticky header against scrolled-under card
content before treating the row as fully closed.
