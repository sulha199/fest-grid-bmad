# Reconciliation: dedup and grouping extract against the amended PRD

Scope. `source-extract-dedup-grouping.md` (ADOPTED A1-A42, conflicts C1-C10, questions Q1-Q12, spine inconsistencies X1-X7) checked against `prd.md` as amended on 2026-10-21 (commit ea81cb3). Also read: the owner's 2026-10-21 decisions and Round 4 facts, `.memlog.md` of the architecture folder entries 143-152 (note: entries 143-145 are dated 2026-10-20; the 2026-10-21 decisions are entries 150 and 152, Round 4 results are 151), `round-4-analysis-2026-10-21.md`, and the current spine (AD-30 Rule 7, AD-36, AD-38, AD-39; the spine is now 4,230 lines, so its line numbers in the extract are stale and this file cites rules instead).

Citations. `PRD:n` = line n of the current `prd.md`. Status words: CAPTURED (the PRD says it), WEAK (the PRD says part; the gap is named), MISSING (not in the PRD).

Counts. ADOPTED: 26 captured, 11 weak, 5 missing (42). Conflicts: 7 resolved, 2 partial, 1 standing (10).

## 1. ADOPTED items

| ID | Spine item | Status | Where in the PRD, or what is missing |
|---|---|---|---|
| A1 | Exact repeat shown once (live path) | WEAK | Core sentence at PRD:341 and PRD:103 ("linked ... whatever its score"); live switch off until the sweep is read, PRD:345. Missing: (i) "same poster" is never defined (publisher, co-author, curator account?), the series rule uses "organizer" (Q6); (ii) how a missing start time counts. Spine AD-30 Rule 7 and Round 4 section 3 show 28 of the 38 first-run groups have no start time ("same start time" means "both missing"), so this decides most of the first run, yet PRD:341 reads as if a start time is required; (iii) the test is on the main schedule only. |
| A2 | Existing exact repeats merged automatically, not queued | CAPTURED | PRD:342, with the reason ("the moderator queue has not been worked", 0 of 147). Not stated: first-run scale (Round 4 re-run: 38 groups, 107 events, 69 soft deletes; the extract's "about 94" is superseded; 39 of the 69 are curator stubs, 25 groups already ended). |
| A3 | Date test is identity, not overlap | CAPTURED | PRD:341 last sentence ("a promo window and a single day inside it are different events"). Examples dropped (Shoptember Reward, King of the Month, Frenzy Bite); the 32 overlapping pairs staying in the moderator queue is only implied by PRD:342. |
| A4 | Never auto-merged list | CAPTURED | PRD:343 covers (a), (b)(i), (c), (d); (e) is the identity test in PRD:341. (b)(ii) is an ASSUMPTION and rightly absent. |
| A5 | Undo stays undone | CAPTURED | PRD:344 ("Undoing it records 'not a duplicate' ..."). Hard delete of a winner refused unless forced, and `system-dedup` having no moderator role, are implementation. |
| A6 | First live sweep supervised | CAPTURED | PRD:344-345 (dry run, cap 20, owner reads before the cap is lifted). Composition of the capped run (largest, random sample, every cluster whose place texts differ) not stated; that last clause is the risk the cap exists for. |
| A7 | One-time sweep: high merged, mid queued, low ignored | CAPTURED | PRD:342, PRD:107. |
| A8 | An event is one activity at one place-set (+ table) | WEAK | The definition is not stated as a rule. PRD:363 states only the planned place split and lineup reshape. Missing table rows: a route is one event; dependent stages are schedules; a schedule with no place stays with the sibling owning the earliest dated schedule. Not annotated: PRD:171 (3.9.1 Schedule Consistency still lets a schedule carry its own location), PRD:94 (rule 3), PRD:1000 (`groupingReason`). |
| A9 | Write-path order and its user consequence | MISSING | "An unsplit three-place event never matches its per-place duplicates" and "the group is attached after the events exist". Low importance. |
| A10 | Backfill scope: open schedules only | CAPTURED | PRD:363 (past events left as they are); split children never notify, PRD:361. |
| A11 | Backfill key: subscribers of the posting account only | MISSING | PRD:363 says existing events are "planned to be re-extracted" but not that only keys of subscribers to the account that posted are used, nor that a post whose account has none is not re-extracted and "its event stays unsplit". Related: curator captions are cleared after extraction (PRD:384, 3.16; memlog 147c), so curator events cannot be re-extracted; extraction is BYOK-only (PRD:81, 3.8), so the backfill spends subscribers' quota. |
| A12 | Cross-account membership | CAPTURED | PRD:356. |
| A13 | Two kinds; kind stored and correctable | CAPTURED | PRD:349-352, PRD:365, PRD:1463-1468 (4.21). |
| A14 | SCH is a programme (each event promoted individually) | CAPTURED | PRD:352 (mall anniversary with circus, line dance, fireworks; "promoted on its own"). The creation path is the problem, see gap 2. |
| A15 | Series roll; dormant group | WEAK | PRD:355 (join within gap, else new season, past stays as archive). Missing: dormant state (at most one active member, or no upcoming member: nothing to collapse, still reachable from any member's page). "Archive" (PRD:355, PRD:1471) is never said to be user-visible or not. |
| A16 | Programmes are time-bound | CAPTURED | PRD:355. "A member outside the window extends it" dropped (minor). |
| A17 | Gap windows 120 / 30 days | CAPTURED | PRD:355, flagged `[ASSUMPTION]` start values (the spine also keeps them start values). Reason dropped: 8 of about 318 grouped pairs exceed 60 days (tours); cross-account pairs never exceed 30. |
| A18 | Cross-account series conditions | WEAK | PRD:356. "The places differ" does not say positively different: spine requires `different`, and `unresolved` "is not enough, it would label a probable duplicate 'also at 1 other place'". The 0.85 bar is rendered only as "near-identical". |
| A19 | Collapse option B, no moderator gate | CAPTURED | PRD:359 (collapses only where the promo name is the same; looser joins get a "part of" link). Reason for no gate ("moderators resolved 0 of 147, a gate would make the feature inert") is given for 3.18 and 3.20 but not at PRD:354 where the rule sits. |
| A20 | Safety net | CAPTURED | PRD:364, PRD:359, PRD:360; switch and daily limit flagged `[ASSUMPTION]`. |
| A21 | Country scope | WEAK | PRD:357 and PRD:343 say "events aimed at different countries". "Aimed at" is the audience country (PRD:380), but the rule uses the country where the event takes place, as PRD:382 itself says. Disambiguating examples dropped: BWF Denmark and Egypt rounds, "erafone Run 2026" in Langkawi, AKMU Asia Tour. Cost ("attaches to nothing") is captured. |
| A22 | Hashtag evidence is link-only | CAPTURED | PRD:356 (planned, off, never collapses). The principle "a wrong tag join adds a wrong link and hides nothing" dropped. |
| A23 | Immediate apply, notify, never block | CAPTURED | PRD:354; carrier gap acknowledged at PRD:200. The rejected alternative (pre-approval gate) and why are not recorded. |
| A24 | Program-lineup reshape: committed plan, not built | WEAK | PRD:363. Missing preconditions (place normalizer, an extraction criterion for "distinct activity", the dedup gate, per-group notifications, Discovery policy) and sequencing with the personalization work. PRD:94 and PRD:1000 still describe today's rule with no pointer to the plan (C7). |
| A25 | Series capped at one card globally, not per page | WEAK | PRD:359 "appears as one card". Not stated that the cap is global across pages (members do not resurface on page 2). |
| A26 | Programme never capped or collapsed; "part of" chip | CAPTURED | PRD:359, PRD:40. "No cover priority for the anchor in v1" dropped. |
| A27 | Optional programme soft cap (flag, off by default) | MISSING | PRD:359 says "never capped" without the adopted off-by-default flag (rank penalty beyond k, turned on only if a shadow run shows one programme flooding a page). |
| A28 | Group appears iff a member matches; cover may differ | CAPTURED | PRD:359. |
| A29 | Card text: count; single match is a plain card | WEAK | PRD:359 and PRD:40 give the count of other matching occurrences (wording to UX). Missing: with one match the card is a plain event card with a small "part of <group>" link. |
| A30 | A series counts as seen if any member was seen | MISSING | The PRD has no "seen" concept to host it; belongs with the ranked-list / personalization work. Low. |
| A31 | Dissolved groups do not collapse | CAPTURED | PRD:1469-1470 (4.21 `status` and its comment). |
| A32 | Collapse only in Discovery | CAPTURED | PRD:359 last sentence (calendar, favorites, feed, account pages list every event). |
| A33 | Group surface on the event page | CAPTURED | PRD:360. |
| A34 | One notification per (group, source post) | CAPTURED | PRD:361, PRD:100. |
| A35 | Short delay; N = events covered | CAPTURED | PRD:361 (start value 90 s `[ASSUMPTION]`, "counting the events it covers"). "A lower bound, not a promise" dropped. |
| A36 | Eligibility is per event | WEAK | PRD:361 (split never notifies), PRD:106 (an event that never notified keeps its one future notification). Missing: roundup or curator stubs never get a due time; a sibling landing after the claim for its own (group, post) sends nothing; an event that leaves its group before the claim is notified alone. |
| A37 | Failure: logged, alerted, never retried | MISSING | PRD silent. Also silent on the 2026-10-21 decision to release the claim when Firebase fails to initialise (memlog 152), and on BUG-073 (the sending Lambdas cannot push today) as a prerequisite of grouped notifications; PRD:200 names BUG-073 only for moderator mail. |
| A38 | Suppress per (user, group) | WEAK | PRD:361 now carries the 2026-10-21 scope (series only, 7-day window `[ASSUMPTION]`). Missing: the window runs from the user's last push for that group, which is what lets a weekly run keep its weekly push (the reason for the scope); a user who subscribes to a second mall after the first claim is not told about it; a user who followed none of the earlier posters is told at the first claim that reaches them; merging two groups keeps the earliest sent time; the record can say "sent" for a failed push; no audience before release (2 users, both the owner's, push off). |
| A39 | Favorites per event; calendar per schedule | CAPTURED | PRD:362. |
| A40 | Split copies favorites, keeping source `created_at` | WEAK | PRD:362 has the copy. The kept `created_at` (the Favorites list orders by it) is missing. |
| A41 | Series counts distinct users | CAPTURED | PRD:362. |
| A42 | Review group | CAPTURED | PRD:199, PRD:365 (detach, rename, dissolve, none a gate). |

## 2. Conflicts C1-C10

| # | PRD sentence | Verdict | Evidence |
|---|---|---|---|
| C1 | "Push notifications are sent per event, not per post" | RESOLVED | PRD:100 keeps the sentence and appends "(Amended 2026-10-21, FR119) For an event that belongs to an event group the notification is sent per group and source post, not per event (Section 3.19)." |
| C2 | First-Organizer-Post Notification, "one notification" | RESOLVED | PRD:106 "For an event in a group the notification goes through the group rule (Section 3.19); an event that has never notified keeps its one future notification until then." |
| C3 | Merge and Redirect (moderators only); 3.9.3 merge action; `mergedIntoEventId` | RESOLVED | PRD:107 "The system also merges events on its own in two cases ..."; PRD:199 adds the list of automatic merges with undo; PRD:559-564 (4.1) comment amended. |
| C4 | Matching: high / mid / low | RESOLVED | PRD:103 adds "A new post that is an exact repeat ... is linked to that existing event whatever its score". Unadopted U1 and P2 correctly left out. |
| C5 | "Different venue" left to the model | RESOLVED (as planned) | PRD:92 "planned to stop depending on the model alone ... Until that ships, the rule above applies as written." |
| C6 | `extractedEventCount` | RESOLVED | PRD:1003-1004 "stays the count before any place split". |
| C7 | `program-lineup` is one event | PARTIAL | The plan is recorded at PRD:363, but PRD:94 (rule 3) and the `groupingReason` doc at PRD:1000 carry no pointer; a reader of 3.7 or 4.7 never learns the rule is slated to change. |
| C8 | "A merge can be undone within the moderator undo window" | PARTIAL | PRD:107 keeps the sentence. As built the only "window" is the 6-second toast and undo stays callable with no expiry. The new system-merge text (PRD:344, PRD:199) says "can be undone" with no window, so the PRD now holds two readings. |
| C9 | Default View and 3.1 had no grouping text | RESOLVED | PRD:40 (3.1), PRD:359 last sentence; PRD:66 (3.4.1) is not contradicted. |
| C10 | Primary Post clause (2) stated as fact; spine tags it `[ASSUMPTION]` | STANDING | PRD:104 unchanged; the spine still tags it (AD-30 Rule 7, "more schedules with a complete date and location [ASSUMPTION]"). Logged as open item 10 in the PRD memlog only. |

ADD-only items from the extract: favorites per event in 3.2.1 (PRD:45) not edited, covered at PRD:362; Related Events vs group, PRD:360; badge counts group items, PRD:201 (2026-10-21 decision 6); 3.9.1 one place-set per event not touched (see A8).

## 3. Open questions Q1-Q12 and spine inconsistencies

| # | Status | Note |
|---|---|---|
| Q1 weekly series vs once per group | RESOLVED | Owner 2026-10-21 (memlog 150, item 1) -> PRD:361. Residual: "within 7 days" should read "of the user's last push for that group". |
| Q2 suppression for programmes | RESOLVED | PRD:361 "series only, never programmes". |
| Q3 how a moderator is told; badge | PARTIAL | Badge resolved, PRD:201. Carrier depends on BUG-073 / IDEA-090, PRD:200. |
| Q4 can the PRD promise "shows it once" now | RESOLVED | PRD:341 states it, PRD:345 holds the live check off. |
| Q5 who can create, move, dissolve | PARTIAL | Kind correction added, PRD:365. Hand-created groups, "move member", user or poster actions not stated. |
| Q6 "same poster" vs "organizer" | STANDING | PRD:341, 343-345 "poster"; PRD:356 account-level; no definition. |
| Q7 labels and layout | DEFERRED TO UX | PRD:359-360. |
| Q8 timing wording | RESOLVED | PRD:361 "short delay plus up to one processing cycle", start values flagged. |
| Q9 delivery order / what is not shipped | PARTIAL | "Planned" marks at PRD:363, 4.21 comment, PRD:356. Not marked: Discovery collapse waits behind the ranked-list work; grouping of the existing backlog waits for dedup. |
| Q10 tag evidence conditional | RESOLVED | PRD:356 "planned, switched off". |
| Q11 cap of 10 events per post vs place split | STANDING | PRD:98 cap unchanged; PRD:363 silent. |
| Q12 cost of country scope | RESOLVED | PRD:357 states the cost (unsized). |
| X1, X2 | FIXED in spine | memlog 148, 150. |
| X3 switch tagging | PRD flags `[ASSUMPTION]` | PRD:364. |
| X4, X5, X6 | not PRD-level | PRD silent, correctly. |
| X7 two meanings of "duplicate" | PARTIAL | PRD:358 defines a duplicate as same place and same name regardless of poster, which is the PROPOSED cross-poster reading; PRD:345 correctly keeps cross-poster pairs under Cross-Post Matching. |

## 4. PRD statements with no or weaker spine support

| PRD | Statement | Issue |
|---|---|---|
| PRD:354 + PRD:352 | "The system creates groups from the events themselves" with a mall anniversary as the programme example | Spine: Tier 1 does not detect SCH (19 Tier-1 groups, SCH not among them); Tier 2 needs a seeded keyword and organizer; SCH becomes a programme only when a moderator creates the group (untagged U5). The PRD gives moderators no create action. |
| PRD:357, 343 | "aimed at different countries" | Wrong noun for the adopted rule (place country), contradicted by PRD:382. |
| PRD:1474-1476 | `placeCount`, `concurrent` ("also at N other places") | From the PROPOSED "two shapes" (P8); no `[ASSUMPTION]` tag in the PRD. |
| PRD:199 | Moderator Items lists "the automatic merges the system made" | Spine has a journal (`source = exact_repeat`) and an undo path, not a listing surface. Not an item "awaiting action", so it should not feed the badge (PRD:201 does not say). |
| PRD:1844 | KPI "Duplicate and Grouping Quality" | PRD-authored; no spine or owner source; needs the journal and group events to be countable. |
| PRD:341 | "FestGrid shows it once" | The PRD is FestDaily throughout (20 uses); the spine sentence was copied verbatim. |
| PRD:358 | Duplicate = same place, same name | See X7. |

## 5. Rationale and examples the structure dropped (ranked by what they would cost)

1. The governing asymmetry: a missed group is the status quo, a wrong collapse hides an event, a wrong link hides nothing. It explains link-only tag joins, link-only 0.85-0.99 joins, "attaches to nothing" for an unsettled country, and "never a gate". The PRD states each rule but never the principle.
2. The weekly-run example behind the 7-day window, and the three-malls example behind per-user suppression.
3. BWF Denmark and Egypt, Langkawi, AKMU: the cases that show the country rule is about where an event happens.
4. Both-missing start times and the BWF / Denmark Open curator stubs: the real population of the first sweep.
5. `unresolved` place is not "different": the reason an uncertain pair is not labelled "also at 1 other place".
6. Wacoal, Sports Station, J.CO branch promos as the cross-account series examples (PRD:356 uses a generic shoe-store promo).

## 6. Gaps ranked by what a UX designer or epic writer would get wrong

1. Country wording (A21, PRD:357, PRD:343). An epic keyed to PRD:380's audience country would group BWF Denmark and Egypt rounds, which the owner constrained against. Say "events that take place in different countries", name the examples, and cross-reference PRD:382.
2. How programmes come to exist (PRD:354, PRD:365). Automatic creation is claimed; the mall anniversary is the one case the detectors do not find. Epic writers will either build a detector that cannot work or omit manual creation; designers will not draw a "create group" action. Needs an owner decision (U5 is untagged).
3. Exact-repeat boundaries (A1, A2, A6). Define "poster", state how a missing start time counts, state "main schedule", and give the first-run scale and population (about 38 groups, 69 soft deletes, mostly curator stubs and already-ended events), since the owner approves the dry run on these.
4. Notification behaviour and prerequisites (A36-A38). Window semantics and consequences, never-retried failure, claim release on Firebase initialisation failure, BUG-073 as a prerequisite, no audience before release.
5. The principle in section 5 item 1, in one sentence at the top of 3.19.
6. Discovery edge behaviour (A15, A25, A27, A29, A30): global one-card cap, single-match card, dormant group and whether the archive is visible, the off-by-default programme soft cap, whether the Embeddable Widget, AI-filter results and search collapse (spine request switch is Discovery-only, PROPOSED).
7. Backfill and the place-set definition (A8, A11, A24): cost to BYOK quota, curator events that cannot be re-extracted, 10-event cap (Q11), and the three unannotated PRD sentences (PRD:94, PRD:171, PRD:1000).
8. Stale or unsourced statements: C8 undo window, C10 primary-post assumption, 4.21 `concurrent` untagged, list of system merges, KPI bullet, product name.
