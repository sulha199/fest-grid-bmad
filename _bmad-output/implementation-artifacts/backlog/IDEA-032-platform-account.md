---
backlog_id: IDEA-032
title: "Platform account location info (moderator card + reusable account element)"
captured: 2026-09-15
---

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
