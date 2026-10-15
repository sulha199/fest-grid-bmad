---
backlog_id: BUG-058
title: "Matching gives a roundup/curator posting account the organizer weight"
captured: 2026-10-12
fixed: 2026-10-12
---

# BUG-058 — Matching gives a roundup/curator posting account the organizer weight

## Capture

`resolveOrganizerMatch` (`apps/backend/src/lib/events/match-event-to-existing.ts`) always checked `sourcePost.accountId` against the candidate's linked-post associations. Story 3.6v's amendment discounted only `organizerHandle` for roundup- and curator-sourced items, so an aggregator already on a candidate event kept the 0.40 organizer weight. Two different events from separate roundups with similar names, near dates and the same venue scored 0.80 (high) and auto-merged.

## Fix (done 2026-10-12)

- `MatchSourcePost.accountId` is now `string | undefined`; `processIngestionJob` passes `undefined` when `isRoundupSourced || isCuratorSourced`.
- Tests in `match-event-to-existing.test.ts`: a discounted item scores low; the same account on a non-discounted item still scores mid.
- AD-30 Rule 7 as-built note updated.

## Assumption

The 3.6v amendment text names only the handle. This fix assumes the discount was meant to cover the posting account too.
