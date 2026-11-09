---
backlog_id: FIND-013
title: "ViewModeToggle removal left dead markup, unused i18n keys, and an ignored URL param"
captured: 2026-09-05
---

# FIND-013: ViewModeToggle removal left dead markup, unused i18n keys, and an ignored URL param

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

DW-021, DW-022, DW-023. Fixed 2026-09-14 (bmad-quick-dev, commit c55b5e4): removed the single-child flex wrapper divs around EventListView left over from the removed ViewModeToggle in home/feed/archive/favorites/account content (DW-021); removed the unused layoutSwitcherListLabel/MasonryLabel/Announcement locale keys from all 5 event-page sections of en.json and id.json, keeping en/id key parity intact (DW-022); and confirmed the stale ?layout= URL param read/parse code was already fully removed with the toggle (DW-023) - a shadowed ?layout=list/masonry param is simply ignored by the app with no dead read code left to strip. Pure dead-code removal, no behavior change, verified via eslint, tsc, and affected page tests (26 pass).
