---
backlog_id: IDEA-032
title: "Platform account location info (moderator card + reusable account element)"
captured: 2026-09-15
---

**Carved 2026-09-15:** this capture bundled two unrelated surfaces. Surface 1 below
(Moderator Tools accounts-tab card) is now tracked as **IDEA-034**. Surface 2 (reusable
account element) stays on **IDEA-032**, this file's owning row. Both rows cite this file.

# IDEA-032 — Platform account location info

## Capture

User request via `bmad-help` (2026-09-15). Two surfaces:

1. **Moderator Tools accounts tab** (`https://fest-grid.vercel.app/en/moderator/
   tools?tab=accounts`) — add location info into the account card, plus:
   - an **edit-location icon** that, when clicked, opens a **select location
     popup**;
   - a **clear-location icon** that, when clicked, opens a **confirmation** to
     set the account's location to empty.
2. **Reusable account element** — it already has a link to open the account
   page; beneath that it currently shows the `accountId`. Replace the
   `accountId` with `<link-to-map>[Location name]<link-to-map>` when the
   account's location is **confirmed / has a good confidence score**
   (reusing IDEA-029's component semantics), and fall back to the accountId
   otherwise.

## Carve detail (verbatim, moved from backlog.yaml 2026-09-18)

Split per §6 of `planning-artifacts/event-pages-followthrough-plan.md` (Phase 0): this row's
original capture bundled a second, unrelated surface — the Moderator Tools accounts-tab card's
location edit/clear icons (Epic 4, Data Quality and Moderation) — which shares no mechanism
with this row's reusable-element change (Epic 1/3, event pages). Split out as IDEA-034 so this
row stays a clean member of the IDEA-029 location-link mechanism cluster.
