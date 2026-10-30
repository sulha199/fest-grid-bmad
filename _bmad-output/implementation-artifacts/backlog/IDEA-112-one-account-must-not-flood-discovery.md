---
backlog_id: IDEA-112
title: "Keep one account from flooding Discovery: collapse repeats and cap per-account volume in the default list (a risk; no abusive case seen yet)"
captured: 2026-10-29
---

# IDEA-112 — One account must not be able to flood Discovery

## What the owner said (2026-10-29)

Deduplication matters because an account could abuse it by posting its events repeatedly. Example: a tour or travel agent posts many tour posts, with the same schedule and place, or different ones, over and over; unfiltered, that looks like spam to users. The owner has no real example yet but sees the possibility.

## Evidence: no abusive account in the data, but the exposure exists

Read from the public events API on 2026-10-29 (671 upcoming events, 164 accounts), after the 2026-10-28 dedup drain:

- No travel-agent pattern yet: 23 upcoming events are in the travel-and-tourism category, at most 2 per account.
- The biggest accounts are curators and malls (60, 49, 48, 47, 37 upcoming events), which is normal volume.
- **But one account with several events of the IDENTICAL name already shows more than once:** 46 groups, 100 events (15% of the upcoming list). In 41 of those groups, 90 events, the events also share a start date, which is what a user sees as the same event twice. Examples: "SCH Halloween Dance Competition 2026" 5 times and "SCH Choir Competition 2026" 4 times (one mall account), "Swaranusa 2026 - Lomba Solo Vokal Nasional" 3 times. 13 of those events have a legacy slug (no `ig_` prefix). The other 5 groups are on different dates (occurrences of a series or rounds).
- Why they were not merged, from one group inspected (the Halloween dance competition, three events on 2026-10-31 at 14:00): one is a roundup stub and the others are full events, the stub rule never pairs a stub with a full event, a roundup-sourced stub has no organizer match so the mid-to-high promotion cannot lift it, and the venue is spelled two ways ("Ground Floor" / "Lantai GF", IDEA-110).

So the owner's worry is already visible without any abuse: the repeat-handling the PRD specifies is not complete.

## Three layers, and what exists for each

| Layer | Case | Specified | Built |
|---|---|---|---|
| 1. Exact repeat | the same account posts the same event twice (same name, place, dates, time) | PRD 3.18 "An Exact Repeat Is Shown Once" (FR116), adopted 2026-10-20 | **No.** IDEA-085 (sweep and live check) is `triaged`. PR #102 added the stub-repeat rule, the shared-date promotion and the drain, which cover part of it |
| 2. Series | the same tour or activity on different dates or places | PRD 3.19 "Discovery Shows a Series Once" (FR118) | **No.** Event groups are not built (no table, no code); blocked by IDEA-084 |
| 3. Volume | one account posts very many different events | nothing | **No.** The only cap is `perDayLimit` (events per day), not per account |

A travel agent that reposts one tour hits layer 1; one that posts the same trip for ten departure dates hits layer 2; one that posts thirty different trips hits layer 3, and no dedup rule can help, only a presentation rule.

## Proposal (to decide)

1. **Finish layer 1 first** (IDEA-085): the exact-repeat rule must also pair a stub with a full event and a roundup-sourced stub with its own account's post; add the venue-spelling fix (IDEA-110). The 41 groups above are the test set.
2. **Layer 2** comes with event groups (IDEA-084, FR118): a series is one card with a count.
3. **Layer 3, new:** in the default Discovery list, no single account holds more than N cards in a page or window (the rest collapse behind "more from this account"); a repeat-rate signal for moderators: an account whose new posts are mostly repeats of its own events in a week.
4. A measure to keep: the share of upcoming events that sit in a same-account identical-name same-date group (13% today, target near 0).

## Open questions

1. Is a cap per account in the default list acceptable for a legitimate large account (a mall with 49 upcoming events)? The cap would have to count cards after series collapse.
2. Should an account that repeats itself be flagged to moderators or silently collapsed?
3. Should posting-rate abuse also be limited at scraping or subscription time, or only at display?

Related: IDEA-085 (duplicate sweep, exact-repeat merge), IDEA-084 (event groups), IDEA-110 (venue spelling variants), IDEA-107 (expire past suggestions), IDEA-103 (reposts), PRD 3.18 and 3.19.

## Owner answers 2026-10-29

- A cap per account in the default list is acceptable (open question 1: yes). It counts cards after series collapse.
- Limits also at scraping: an alarm when an account has too many posts in a month, and a stop for the rest of that month at a hard limit. This is its own mechanism: IDEA-113.
- "Flag an account that repeats itself": the owner asked what the case exactly is. The answer (four cases, only one of them harmful to users, and that one a dedup defect) is in IDEA-113; the proposal is no separate repeat flag, the intake alarm reports posts per event instead. Still to confirm.
- Part of personalisation (owner 2026-10-29): the per-account display cap is a bounded term in the default ordering (plan Phase B, Revision 12), and the intake side belongs with the BYOK to paid-product move (IDEA-113, CC-032).

## Correction 2026-10-30

The figures in "Evidence" (46 groups, 100 events; 41 groups, 90 events with a shared start date) were counted on the public events list, which repeats and skips rows between pages (BUG-090). On the production database the same-account, same-strict-name, same-start-date groups number **16, holding 37 of 663 upcoming events**. The exposure argument stands (no per-account cap, series not collapsed); the size of today's problem is about 6%, not 13 to 15%. Detail: IDEA-085.
