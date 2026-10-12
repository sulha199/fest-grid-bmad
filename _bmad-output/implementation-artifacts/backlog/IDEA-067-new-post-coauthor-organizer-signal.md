---
backlog_id: IDEA-067
title: "Count the new post own co-author/publisher associations in the organizer signal"
captured: 2026-10-12
---

# IDEA-067 — Count the new post own co-author/publisher associations in the organizer signal

## Capture

`resolveOrganizerMatch` checks only `sourcePost.accountId` (plus the account resolved from `organizerHandle`) against the candidate's linked-post associations. A new post that credits the venue or organizer as `COAUTHOR` gains nothing from that credit.

## Scope

Read the new post's `PUBLISHER` and `COAUTHOR` association rows and check all of those accounts with `buildEventAccountMatchCondition`. One query plus tests. Needs an AD-30 Rule 7 amendment. Depends on BUG-058 (done): for roundup and curator items the posting account stays discounted, so decide whether their associations count.
