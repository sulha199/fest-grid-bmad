---
backlog_id: IDEA-085
title: "Duplicate events: sweep the legacy pairs, let stub pairs reach the candidate threshold, work the moderator queue"
captured: 2026-10-19
---

# IDEA-085 — what the production numbers say the work is

**Status:** triaged 2026-10-19 (scope agreed on my recommendation; no story yet). Evidence: `planning-artifacts/event-insight-poc/prod-check-results-review-2026-10-19.md` §2 and `results/recall-classes-prod-2026-10-19.txt`.

## What the numbers say (production, 2026-10-19, 446 same-account, same-normalized-name pairs)

The first query version mis-dated pairs (fixed 2026-10-19, `recall-classes.fixture.sql`), so these are the *uncorrected* sizes; the direction survives: class 2 shrinks, classes 3 and 4 can only grow.

| class | pairs (uncorrected) | meaning |
|---|--:|---|
| same post | 1 | by design (sibling guard) |
| created before the matcher's first candidate | ≤ 193 | **legacy**: the matcher only runs on a *new* ingest, so no tuning will ever touch these |
| dates more than 2 days apart | ≥ 86 | mostly recurring events, not misses |
| reachable by the matcher | ≥ 166 (≥ 168 after the fix) | 23 in the candidate list in total; recall on this class **≤ 23 / 168 ≈ 14%** |

## Scope (three parts, one idea)

1. **Sweep of the legacy pairs.** A one-time job that scores the existing pairs with the matcher's own `computeMatchScore` offline, first as a dry run with counts per tier. Policy to confirm at story time: `high` pairs merged through `mergeEvents` (journaled, undo window); `mid` pairs written as candidates; `low` ignored. The PRD says a `high` score links automatically at ingest and that moderators merge duplicates; auto-merging in a sweep needs one PRD sentence. **The sweep must not add `mid` candidates without a queue plan**: 147 are pending today, none resolved (AD-36 gap G4).
2. **Stub scoring.** Hypothesis from the code, not yet measured: for a roundup- or curator-sourced item the organizer weight (0.40) is discounted on purpose (BUG-058), so two such events with the same name and date score at most 0.25 + 0.15 (same venue) = 0.40, under the 0.45 `mid` threshold: never a candidate unless they share a link. Test: `recall-class4-stubs.sql` (Round 2), then an offline replay of `computeMatchScore` over the pairs (not built). Candidate rules, to choose after the replay: count the same posting account as a smaller signal when both items are stubs; or an exact-name, same-date rule. The BUG-058 intent (an aggregator is not the organizer of what it lists) must still hold for pairs that span different accounts.
3. **The moderator queue.** 147 pending, 75 older than 7 days, 0 merges ever. Capacity, a triage view, and a rule for pairs nobody will ever review belong to the story; the number to move is "candidates older than 7 days".

## Proposed gate for AD-36 Rule 10 (replaces "recall above the observed 5%")

"Of the reachable same-name pairs (class 4 of `recall-classes.sql`), at least 80% are merged, dismissed, or have a candidate no older than 7 days, and the legacy class has been swept." The two queries are the acceptance test; run them before and after.
