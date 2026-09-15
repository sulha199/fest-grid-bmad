---
backlog_id: IDEA-031
title: "Event detail platform account element (fallback icon, subscribe toggle)"
captured: 2026-09-15
---

# IDEA-031 — Event detail platform account element

## Capture

User request via `bmad-help` (2026-09-15). Changes to the platform account
element shown on the event-detail page:

1. **Profile-image fallback** — if the account has no profile image, fall back
   to the colored platform icon (reuse the existing platform-registry
   mapping, `packages/domain/src/scraper/platform-registry.ts`).
2. **Subscribe toggle instead of text button** — rather than a button with
   `subscribe` text, replace it with a toggle of the subscribe action:
   - `subscribe-action` icon in the not-subscribed state,
   - `subscribe-checked` icon in the subscribed state,
   - with a **different icon color for each state** so the current state is
     obvious at a glance.
