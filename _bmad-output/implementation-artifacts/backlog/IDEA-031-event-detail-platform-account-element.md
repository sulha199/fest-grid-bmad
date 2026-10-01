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

## Promoted, 2026-09-16 (bmad-create-story, Story 0.i6f)

Fully covered, bundled with FIND-010's DW-009 slice per
`event-pages-remaining-backlog-plan.md`, homed under Epic 0.i6 (user-confirmed via
AskUserQuestion) rather than that plan's original "no epic" framing — same class of
internal-contract-change-joins-directly precedent as Stories 0.i6d/0.i6e. Toggle built fully
functional (real unsubscribe), not visual-only, per the user's second AskUserQuestion
confirmation.

Corrected this item's original platform-registry.ts pointer: that file has no icon/color
mapping (slug/display-name only); the real reusable icon logic was `SubscriptionPicker.tsx`'s
private `PlatformIcon`, extracted to `packages/ui/src/core/platform-icon.tsx` by this story
instead.
