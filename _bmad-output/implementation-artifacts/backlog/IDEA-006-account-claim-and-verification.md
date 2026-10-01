---
backlog_id: IDEA-006
title: "Epic 8 — self-service account claim and ownership verification"
captured: 2026-09-02
parent: CC-018
---

# IDEA-006 — Self-service account claim and verification

## Capture

Placeholder only in epics.md (`epic-8: backlog`); needed its own `bmad-prd` pass before any
story.

## Resolved, 2026-09-11 (bmad-prd, joint pass with IDEA-008)

PRD 3.17 (added) resolves the flow:

- Bio-code-challenge verification (reuses Section 3.7's scraper-adapter/profile-lookup infra,
  no OAuth/DM dependency).
- 24h code window (`CLAIM_VERIFICATION_WINDOW_HOURS`, default 24).
- A VERIFIED claim grants only self-service `isImageStorageOptedIn`/
  `imageStorageOptInSource: 'ACCOUNT_OWNER'` (no new `defaultLocation` capability).
- Contested claims go through Moderator Tools (`REVOKE`).
- Abandoned claims silently `EXPIRE` with no moderator step.

New `AccountClaim` interface at PRD 4.20; `SocialMediaAccountProfile.claimedByUserId`/
`imageStorageOptInSource` comments updated to point here instead of epics.md.

## Interaction with IDEA-008

Resolved in the same PRD 6 edit: a claimed account's own `Subscription` still counts against
IDEA-008's subscription cap — claiming and the moderator cap-exemption are explicitly two
different mechanisms.

## Status

epics.md's Epic 8 placeholder itself is unchanged (out of this pass's scope per CLAUDE.md's
Planning Isolation guardrail); still needs `bmad-create-epics-and-stories` before any story.
