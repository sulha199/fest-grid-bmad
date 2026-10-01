---
backlog_id: IDEA-008
title: "Max 5 subscribed accounts (normal user), upgrade-account 'coming soon' CTA + PostHog event, moderator exempt"
captured: 2026-09-06
---

# IDEA-008 — Subscribed-account cap for free-tier users

## Capture

From `apps/ux-rework2.md` L19-21, via `ux-rework2-tracking.md` item #7. PRD 8.2 (Phase 2
`free_user` tier) only vaguely capped accounts at "e.g., 2" with no upgrade-CTA/PostHog/
moderator-exemption language, and the number conflicted with this item's "5" — needed
reconciling. Real feature work (server-side guard + upgrade UI flow + analytics), not polish;
no backlog row or story existed before this audit.

## Resolved, 2026-09-11 (bmad-prd, joint pass with IDEA-006)

Resolved to 5 — PRD 6 now states the cap plainly as `MAX_SUBSCRIBED_ACCOUNTS_FREE_USER`
(default 5) with reasoning recorded: the old "e.g., 2" was always a placeholder example, never
a decided number; 5 is the only value actually arrived at deliberately, via this row's own
ux-rework2 audit.

PRD 6 also adds:
- Cap enforcement (counts active `Subscription` rows, not `AccountVote`).
- The moderator exemption (role-based, `UserRole.MODERATOR`, independent of tier).
- The upgrade CTA + `subscription_cap_upgrade_cta_shown`/`_clicked` PostHog events in a defined
  "coming soon" state.

## Interaction with IDEA-006

Answered in the same PRD 6 edit: a claimed account's own `Subscription` still counts against
the cap; the moderator exemption is a separate mechanism from a claimed owner's grant (PRD
3.17), not the same one.

No open question remains on this row.
