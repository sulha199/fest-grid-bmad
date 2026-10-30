---
backlog_id: IDEA-085
title: "Duplicate events: sweep the legacy pairs, let stub pairs reach the candidate threshold, work the moderator queue"
captured: 2026-10-19
---

# IDEA-085 — what the production numbers say the work is

**Status:** triaged 2026-10-19 (scope agreed on my recommendation; no story yet). Evidence: `planning-artifacts/event-insight-poc/prod-check-results-review-2026-10-19.md` §2 and `results/recall-classes-prod-2026-10-19.txt`.

## What the numbers say (production, 2026-10-19, 446 same-account, same-normalized-name pairs; fixed query, `results/recall-classes-prod-2026-10-19-v2.txt`)

| class | pairs | in the candidate list | meaning |
|---|--:|--:|---|
| same post | 1 | 0 | by design (sibling guard) |
| created before the matcher's first candidate | 160 (36%) | 0 | **legacy**: the matcher only runs on a *new* ingest, so no tuning will ever touch these |
| dates more than 2 days apart | 107 (24%) | 0 | mostly recurring events, not misses |
| reachable by the matcher | 178 (40%) | 23 | recall on reachable pairs **23 / 178 = 12.9%**; 155 reachable pairs have no candidate |

The reachable pairs by the matcher's own scoring inputs (`results/recall-class4-stubs-prod-2026-10-19.txt`):

| pair | pairs | candidates | reading |
|---|--:|--:|---|
| at least one stub, no shared link | 122 | **0** | confirmed: the organizer weight is discounted for roundup/curator items, so a same-name, same-day pair scores at most 0.25 + 0.15 = 0.40, under the 0.45 `mid` threshold. 79% of the 155 uncovered pairs |
| at least one stub, shares a link | 10 | 6 | a shared link (+0.20) reaches `mid` |
| both full, no shared link | 46 | 17 | **29 uncovered pairs the stub rule does not explain**: needs the offline `computeMatchScore` replay (organizer match goes through `post_account_associations`, not `events.source_social_media_account_id`; a path that skips the matcher is also possible) |

## Scope (three parts, one idea)

1. **Sweep of the legacy pairs.** A one-time job that scores the existing pairs with the matcher's own `computeMatchScore` offline, first as a dry run with counts per tier. Policy to confirm at story time: `high` pairs merged through `mergeEvents` (journaled, undo window); `mid` pairs written as candidates; `low` ignored. The PRD says a `high` score links automatically at ingest and that moderators merge duplicates; auto-merging in a sweep needs one PRD sentence. **The sweep must not add `mid` candidates without a queue plan**: 147 are pending today, none resolved (AD-36 gap G4).
2. **Stub scoring.** Confirmed by Round 2 (0 of 122 stub pairs without a link are candidates). The code reason: for a roundup- or curator-sourced item the organizer weight (0.40) is discounted on purpose (BUG-058), so two such events with the same name and date score at most 0.25 + 0.15 (same venue) = 0.40, under the 0.45 `mid` threshold: never a candidate unless they share a link. Next: an offline replay of `computeMatchScore` over the 178 reachable pairs (SQL over `post_account_associations`, `similarity()` and the schedule dates; not built), which also decides the 29 both-full pairs. Candidate rules, to choose after the replay: count the same posting account as a smaller signal when both items are stubs; or an exact-name, same-date rule. The BUG-058 intent (an aggregator is not the organizer of what it lists) must still hold for pairs that span different accounts.
3. **The moderator queue.** 147 pending, 75 older than 7 days, 0 merges ever. Capacity, a triage view, and a rule for pairs nobody will ever review belong to the story; the number to move is "candidates older than 7 days".

## Proposed gate for AD-36 Rule 10 (replaces "recall above the observed 5%")

"Of the reachable same-name pairs (class 4 of `recall-classes.sql`), at least 80% are merged, dismissed, or have a candidate no older than 7 days, and the legacy class has been swept." The two queries are the acceptance test; run them before and after.

## Decision 2026-10-20: exact repeats merge without a moderator (AD-30 Rule 7)

Adopted by the owner, both paths: one predicate `isExactRepeat` (same poster, same normalized name, same place, same country, identical date range and start time). The live matcher raises such a candidate to `high` (behind `exact_repeat_live`, default off until the first capped sweep run is read); the sweep merges existing pairs as `system-dedup`. Overlapping but different ranges stay `mid` (a promo window and its final day are not repeats). Size on the owner's export with identical ranges: 195 pairs, 56 clusters, 150 events, about 94 soft deletes (22 curator-guide clusters, 31 venue-event). Not yet measured: start time (not in the export), the stub weight (Round 4 ask 1), precision as read by the owner. Gate before the cap is lifted: the owner reads the dry-run list (largest clusters, a random sample, every cluster whose place texts differ).

## Evidence 2026-10-29 (after PR #102 and the 2026-10-28 drain)

The exact-repeat merge adopted on 2026-10-20 (PRD 3.18, FR116) is still not built, and its absence is visible: of 671 upcoming events, 41 groups (90 events, 13%) are the same account, the identical name and a shared start date, still shown more than once. Causes seen in one group: a stub paired with a full event (the stub rule never does), a roundup-sourced stub with no organizer match, a venue spelled two ways (IDEA-110). These 41 groups are a ready test set for the live check and the sweep. Detail and the flooding risk this feeds: IDEA-112.

## Correction 2026-10-30: the 41 groups were repeated list rows

The public events list repeats and skips rows between pages (BUG-090: the default order ends in a date, not a unique key). The 2026-10-29 figures above (41 groups, 90 of 671 events) were counted on that list. A recount on the production database (read-only, distinct upcoming events: 663; same source account, same strict name, same main start date) finds **16 groups holding 37 events (5.6%)**, which the first count had put at 13%.

| Of the 16 groups | Count |
|---|--:|
| all full events / a stub with a full event / all stubs | 11 / 3 / 2 |
| venue text differs between the events | 12 |
| same start time and end date, venue text differs (the IDEA-110 case) | 8 |
| a pending suggestion exists (queued at mid, blocked by the venue-conflict test) | 11 |
| a different end date or start time between the events (a promo window against a single day is a different event; a missing time on one side is not) | 5 |

## What shrinks it, and what is left (evaluated read-only on production, 2026-10-30)

- IDEA-110 (one place spelled two ways, built, not merged): the drain would auto-link 5 pairs instead of 1 (4 promoted by the rule), and the stub scan would merge 4 events in 3 clusters instead of none. All were read by hand and are genuine repeats.
- Not covered by anything built: events created before the matcher existed (before 2026-10-12) that never got a suggestion row (full against full), and a stub paired with a full event. By hand count on the 2026-10-30 list that is a handful of events, not dozens.

**Recommendation:** do not build the new exact-repeat predicate. The existing mid-to-high promotion already covers the live case once the venue spelling no longer blocks it. If the legacy pairs matter, generalise `--scan-stubs` to full events through `decideMatchTier` (one scan mode, no new rule). Track the measure instead: distinct upcoming events that sit in a same-account, same-name, same-date group (16 groups, 37 events today).
