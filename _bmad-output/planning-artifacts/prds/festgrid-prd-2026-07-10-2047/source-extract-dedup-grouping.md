# Source extract: dedup and grouping (for the PRD update)

Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (4,153 lines), AD-30 Rules 7, 9, 10 (lines 1724-2093), AD-36 (2516-3301), AD-38 (3393-3666). PRD read: `prd.md` (1,725 lines). Extract only; no PRD edit made.

How to read the tags. Every item carries the spine's own tag text in quotes and spine line numbers (`s.NNNN`).
- **A#** = ADOPTED (user-confirmed / user-directed / user-accepted). Only these may become PRD requirements. Sections 1-5.
- **B#** = AS BUILT: no tag, but the spine says "as built, verified against code". Current behaviour; PRD may describe it, not extend it.
- **U#** = UNTAGGED: the spine states it with no status. Do not promote without owner confirmation.
- **P#** = PROPOSED / ASSUMPTION. Section 8. Do not write as requirements.
- Where a clause inside an ADOPTED rule has its own PROPOSED/ASSUMPTION tag, it is listed in Section 8 and cross-referenced.

---

## 1. Dedup (the same event posted twice)

### 1.1 ADOPTED

- **A1 Exact repeat is shown once (live path).** Tag: `[ADOPTED, user-directed 2026-10-20, both paths; the preconditions come from review R4 and from the sample read on 2026-10-20]` (s.1985-1987). A pair posted by the **same poster** with the same normalized name, the same place (`isSamePlace` = `same`), and the **same date range and start time on the main schedule** is a repeat post of one event. When a new post is such a repeat of an existing event, the new post is linked to the existing event and **no second event is created** (s.1989-1992). Shipped behind its own switch `exact_repeat_live`, **default off until the sweep's first capped run has been read** (s.1991-1992). The sentence the spine intends for the PRD, quoted: "If a poster posts the same event twice (same name, place, date and time), FestGrid shows it once." (s.1996-1997). The PRD does not contain it today.
- **A2 Exact repeats that already exist are merged automatically, not queued** (same tag as A1, "both paths"; s.1993-1996). The one-time sweep merges them as the seeded user `system-dedup`, journaled and undoable, "because a queue nobody works cannot clear it". The merged-away event is soft-deleted (s.2003-2004 sizes it as about 94 events on the first unattended run).
- **A3 The date test is identity, not overlap** (same tag; s.1998-2008). Date ranges must be identical. "Shoptember Reward" (1 to 30 Sep against 7 Sep to 31 Oct), "King of the Month" (1 to 13 Sep against 13 Sep) and "Frenzy Bite" (24 to 29 Sep against 28 Sep) are a promo and a sub-event or extension, not repeats. The 32 overlapping-but-not-identical pairs "stay `mid`" (queued for a moderator). Measured upper bound with identical ranges: 195 pairs, 56 clusters, 150 events (s.2003).
- **A4 Never auto-merged ("none optional", s.2009-2016, same tag):** (a) a moderator already marked the pair "not a duplicate" (a `rejected` row wins); (b) the AD-38 Rule 6 exclusions: (i) both events linked to the same post under different ordinals (the extractor said they are distinct), (ii) every cross pair of places is `different` (this exclusion is itself an `[ASSUMPTION]`, P7); (c) either event has an applied or pending correction or a pending report; (d) different countries; (e) the schedule differs on any of (start date, end date, start time, place).
- **A5 Undo stays undone** (same tag; s.2018-2022). Every automatic merge is journaled with `source = exact_repeat`. Undoing an automatic merge records a rejection for the pair when none exists, so neither the live path nor the sweep merges it again. A hard delete of the winner of a non-undone merge is refused unless forced (s.2023-2025). The seeded `system-dedup` user must not have the moderator role (so no moderator alert email goes to it) (s.2022-2024).
- **A6 First live sweep is supervised** (same tag; s.2006-2008, 2016-2020). The sweep is a script with a dry-run default that prints clusters. The first live run is capped at 20 clusters (the largest, a random sample, every cluster whose place texts differ) and reported before the cap is lifted. "The owner reads the dry-run list before the cap is lifted."
- **A7 One-time sweep over existing events.** Tag: `[ADOPTED scope, user-agreed]` (s.1947). Pairs scored `high` are merged (journaled, undoable); `mid` pairs become suggested matches in the moderator queue; `low` pairs are ignored (s.1939-1943). The spine adds: "auto-merging `high` pairs in the sweep needs one PRD sentence (the PRD says moderators merge duplicates and `high` links at ingest)" (s.1947-1948). The queue-insert cap is a separate ASSUMPTION (P3).

### 1.2 AS BUILT (current behaviour; "Story 3.6v as built, verified against code", s.1858-1859)

- **B1 Three outcomes at ingest** (s.1876-1895): score = organizer 0.40 + shared registration/ticket link 0.20 + mean(name similarity, date proximity) x 0.25 + venue 0.15. **High >= 0.75** links the new post to the existing event, no moderator step. **Mid >= 0.45** is ingested as its own new event and a suggested match is queued. Below that, a new event. Candidates need a schedule date within +/-2 days and name similarity above 0.3, at most 20 candidates. "changing any value below is a spine amendment, not a code-only edit" (s.1860-1861).
- **B2 While a mid-band pair waits, the user sees two events, and the second notifies at creation unless it is a stub** (s.1893-1895). Approving the suggestion merges (existing event wins); rejecting records a dismissal; undo returns the suggestion to pending (s.1900-1904).
- **B3 An event absorbs at most one item per post** (s.1849-1851); a roundup- or curator-sourced item earns the organizer weight only through an organizer its caption explicitly tags (s.1884-1888).
- **B4 Merge** (s.2049-2071): the loser is soft-deleted; favorites and reports move to the winner with no per-user duplicates; calendar entries follow schedules and are never deleted; links to the loser redirect. Undo has **no server-side expiry**: the 6-second toast is the only "window" and undo stays callable afterwards, "the accepted behavior" (s.2067-2071).

### 1.3 UNTAGGED

- **U1 Shared-link candidates (BUG-070, amended 2026-10-18, s.1905-1926).** A candidate is also admitted when it shares a normalized event link and has a schedule within +/-90 days; a candidate with no schedule within +/-2 days is capped at `mid` and never auto-linked ("a moderator decides"). Not marked built or adopted.
- **U2 Pair classes (s.1949-1967).** Same-name pairs more than two days apart are series members, not duplicates. A rejected pair is not re-queued. The sweep also applies the +/-2-day cap: a same-link, same-name pair weeks apart "is queued for a moderator, not folded" (s.1963-1966).
- **U3 Duplicate key (AD-38 Rule 6, s.3611-3616):** same organizer, normalized name, a date within 2 days, and the place. Never a candidate when both are linked to the same post under different ordinals ("already shipped", s.3614-3615); exclusion (b) is P7.

---

## 2. Grouping (different events that belong together)

### 2.1 What an event is, and the place split (AD-38)

- **A8 Definition.** `[ADOPTED, user-confirmed 2026-10-19]` (s.3414-3415): "An event is one activity at one place-set; its schedules are the dates of that activity at that place-set." The table that follows (s.3417-3424) gives: one activity, one place, several dates = one event with N schedules, no group. One activity at different places (Riot Jogja "Wednesday Night Run" at three venues) = one event per place, group kind `series`. Different activities under one named umbrella, even at one venue (SCH "8th Anniversary": circus, line dance, zumba, fireworks) = one event per activity, kind `programme`. A route (extractor-flagged `isRoute`) = one event. Dependent stages of one competition = one event, stages are schedules. A schedule with no place of its own stays with the sibling that owns the earliest dated schedule.
- **A9 Write-path order.** `[ADOPTED, user-accepted order; ordinal formula user-accepted 2026-10-20]` (s.3462-3487): extraction (one Gemini call per post), place normalizer, per-event loop (geocode, timezone, guards), per-event matcher, group attach, notification due time. User consequence stated: "an unsplit three-place event never matches its per-place duplicates", and the group is attached after the events exist (s.3474-3476).
- **A10 Backfill scope.** `[ADOPTED scope, user-directed; mechanics PROPOSED]` (s.3537): only events with an open (upcoming) schedule; past events are left as they are (s.3538-3539). Split children never notify (A36).
- **A11 Backfill key.** `[ADOPTED, user-directed 2026-10-20]` (s.3558-3566): re-extraction uses only the keys of contributors who subscribe to the account that posted the event. A post whose account has no such subscriber is not re-extracted and "its event stays unsplit".

### 2.2 Group model and detection

- **A12 Cross-account membership.** `[ADOPTED, settled — not a fork]` (s.2575): an event from any account can join a group regardless of who posted it.
- **A13 Two kinds.** `[ADOPTED, user-confirmed: the two kinds, series rolling, programmes time-bound; the derivation test and the organizer key are PROPOSED by the architect review]` (s.2731-2733). A **series** is members with the same activity at different places or times, who are the same audience (Riot Jogja's "Wednesday Night Run" at three venues; a Wacoal promo at several malls). A **programme** is members with different activities under one named umbrella, each with its own audience (SCH "8th Anniversary"). The kind is stored on the group "so a moderator can correct it" (s.2734-2739). There is no "unknown kind".
- **A14 SCH is a programme.** `[ADOPTED, user-directed 2026-10-20: SCH is a programme, because each of its events must be promoted individually]` (s.2740-2741).
- **A15 A series rolls.** Under the A13 header (s.2926-2946): a new member joins the open series when its first date is within `GAP` of the latest date of any existing member; otherwise "it opens a new series (a new season). Past members stay as the archive." A group with at most one active member, or a series with no upcoming member, is **dormant**: nothing to collapse, still reachable from any member's page. Detection is deterministic, no model call.
- **A16 Programmes are time-bound.** Under the A13 header (s.2947-2949): identity is name plus date window; a member outside the window extends it; next year's edition is a new group; a year inside the name keeps annual events apart.
- **A17 Gap windows.** `[ADOPTED, user-directed 2026-10-20; the two values stay start values]` (s.2939-2942): `GAP` is **120 days within one account** and **30 days across accounts**. (The earlier 60-day value is superseded, s.2927-2928.)
- **A18 Cross-account series.** `[ADOPTED, user-directed 2026-10-20]` (s.2760-2766): branch promos posted by each place's own account (Sports Station, J.CO, Wacoal) are series. A member of a different account joins when the weighted name score reaches the bar (0.85, a start value, P11), the schedules overlap or fall within `GAP` (30 days across accounts), the places differ (`isSamePlace` = `different`; `unresolved` "is not enough, it would label a probable duplicate 'also at 1 other place'"), and the country scope A21 holds.
- **A19 Collapse policy "option B", no moderator gate.** `(option B, user-directed)` (s.2766-2770): members whose canonical key equals the group's stem **collapse in Discovery from the start**; members that joined by a score of 0.85 to 0.99 or by tag evidence get the "part of" link only. "No moderator gate: moderators resolved 0 of 147 and receive no queue notification, so a gate would make the feature inert."
- **A20 Safety net of A18/A19** (s.2770-2774, same adopted paragraph): the per-detector switch and daily cap (mechanism is P14), a nightly list of newly created cross-account groups for the owner to read (no carrier yet, X3), "the collapse existing only in Discovery (the calendar, favorites, feed and account pages list every event)", every member staying reachable from the group page, and "a dissolve that restores every member".
- **A21 Country scope.** `[ADOPTED, user-directed 2026-10-20; mechanism corrected by review R4]` (s.2793-2795): "events targeted at different countries are never grouped"; the level is a start value `country`. Applies to every group attach (series, programme, place split, moderator), so one group is one country (s.2803-2806). Stated consequence: an event whose country cannot be settled "attaches to nothing"; a missed group is "the status quo, a wrong join hides an event" (s.2802-2809). Example: "erafone Run 2026" in Langkawi does not join the Yogyakarta ones; BWF Denmark and Egypt rounds separate (s.2810-2812).
- **A22 Hashtag evidence is an adopted signal.** `[ADOPTED, user-directed 2026-10-20; the guard on generic campaign tags is an ASSUMPTION]` (s.2873). A tag join is link-only: "a wrong tag join adds a wrong 'part of' link and hides nothing" (s.2898-2899). The rule's details are P12; review R4 adds that it "ships behind its own detector switch, default off" until `isEvidenceTag()` exists (s.2896-2898, PROPOSED).
- **A23 Immediate apply, notify-don't-block.** `[ADOPTED, user-directed, modified from the tier-gated recommendation]` (s.2608-2614): every detector tier writes the group and its members immediately; "nothing in ingestion, matching or display waits on a moderator". Reuses the PRD §3.7 "Default Location: Immediate Apply with Moderator Oversight" posture. Tier 2 and Tier 3 suggestions generate a moderator notification (carrier gap, Q3). Rejected alternative: a pre-approval gate (s.3250-3252).
- **A24 Program-lineup reshape is a committed plan, not built.** `[ADOPTED, user-directed, PLAN-ONLY]` (s.2640-2651): today's `program-lineup` keeps items as hidden schedules of one event. The target is real, visible child events with `group_id` set. "Current production behavior (hidden schedules) stays in force until delivered"; delivery is sequenced with the personalization work (IDEA-074). Needs first: place normalizer, an extraction criterion for "distinct activity", the dedup gate, per-group notifications and the Discovery policy, and a PRD change (s.2652-2660).

### 2.3 Discovery and the group page

- **A25 A series is capped at one card (the cover), globally, not per page** (Rule 13, tag `[ADOPTED, user-accepted; delivery gate and request switch PROPOSED]`, s.2955; text s.2969-2971). The other members collapse behind the cover and are reached through the group surface.
- **A26 A programme is never capped and never collapsed.** Every member competes on its own relevance "so each event reaches its own audience" and carries a **"part of <programme>" chip** (s.2971-2973). The programme anchor gets no cover priority in v1 (s.2996).
- **A27 Optional programme soft cap.** `[ADOPTED, user-directed 2026-10-20]` (s.2974-2977): members beyond `k` take a rank penalty, never removed; behind a flag, **off by default**; turn on only if a shadow run shows one programme flooding a page. `k` and the penalty are `[ASSUMPTION]` start values (P20).
- **A28 A group appears iff at least one member matches the current filters; its cover is the best-ranked matching member** and "may differ with and without a filter, by design" (s.2964-2968).
- **A29 Card text.** The card shows the count of matching members ("+2 more matching sessions"); with one match it is a plain event card with a small "part of <group>" link (s.2994-2996). Wording is deferred to UX (Q7).
- **A30 A series counts as seen if any member was seen**, otherwise the cover rotates to the next occurrence and re-surfaces as new (s.2998-3000).
- **A31 Dissolved groups do not collapse** (s.2986-2988).
- **A32 Collapse exists only in Discovery.** The calendar, favorites, the feed and account pages list every event (s.2962-2963; also in A20).
- **A33 Group surface (new UI).** `[ADOPTED, user-directed; invariant on undo PROPOSED]` (s.3050-3051, 3059-3063): the event page shows "part of <group>" with the active members (a series by place and date, a programme by activity; a concurrent series lists its places with the distance where a pin is trusted; the "concurrent" shape is itself PROPOSED, P8); "every member must be reachable from there". "Layout and copy belong to the UX step." Related Events (shared post) stays a separate affordance (U7).

### 2.4 Who does what, and what is NOT grouped

- **Created by:** detectors, automatically (no model call for the deterministic ones) and a moderator by hand (reserved, U5). **Edited or dissolved by:** a moderator through "review group" (A42). Posters and ordinary users have no group action anywhere in the spine (Q5).
- **Not grouped (ADOPTED):** events of different countries (A21); events whose country cannot be settled (A21); same-place same-name pairs are duplicates, not series, because the places must differ (A18); one activity at one place over several dates is one event, no group (A8); dependent stages and routes are not split (A8).
- **Not grouped (UNTAGGED):** a poster's agenda heading "is not a group", and a programme item held at two places stays in the programme (s.2950-2953); the personalization taxonomy (`interests[]`, `segments[]`, `costTier`) "is not a grouping signal in v1" (s.2899-2905); one group per event (s.2550-2554, U6); the existing event backlog is not grouped until deduplication has run (U10).

### 2.5 UNTAGGED group rules (context only)

- **U5 Tiers (s.2578-2607).** Tier 1 `title_pattern`: same-account "Umbrella - Child" with 2+ distinct children (measured 19 groups, 56 events; SCH is not among them). Tier 2 `keyword_organizer`: a seeded keyword anchor plus its organizer; "Precision is NOT measured". Tier 3: `extraction_field` (reserved, not built) and `moderator` (a moderator creating or editing a group by hand). The decision that SCH is a programme stands, but it becomes one only when a moderator creates the group with its `(keyword, organizer)` seed (s.2603-2607).
- **U6 Group is not a merge and not a schedule; one group per event** (s.2538-2554).
- **U7 A group and Related Events differ** (Rule 8, s.2680-2686): related = linked by a shared post, group = linked by a named programme; both may show on the event page.
- **U8 Edits are reversible, not a hard delete** (Rule 5, s.2631-2635): detaching, renaming and dissolving are logged and reversible; dissolving never deletes the member events.
- **U9 Merge of a grouped event** (Rule 7, s.2661-2679): the winner keeps its group, or inherits the loser's when it has none; if both have different groups the merge still proceeds, keeps the winner's group, and flags a moderator notification; undo restores the group only into an active group.
- **U10 Dedup before grouping** (Rule 10, s.2698-2718): grouping must not run over the existing backlog of unmerged duplicates; going-forward grouping of newly ingested events is not held to the gate (that split is an ASSUMPTION, P19).
- **U11 Place split mechanics** (AD-38 Rule 2, s.3439-3457): deterministic, no model call, never for `dependent-stages` or `isRoute`; a sibling's name is the schedule title when it follows "Umbrella - Child", else "<event name> - <venue name>"; at most 10 places per event and a post-split cap (values are ASSUMPTIONs, P6).

---

## 3. Notifications for grouped events

- **A34 One notification per (group, source post).** `[ADOPTED, user-directed: one per group and post, sent after a short delay; mechanism user-confirmed 2026-10-20: a database due time claimed by the existing drain, because the SQS delay does not fit the shipped queue topology]` (s.3015-3018). "A grouped event does not notify on its own. One notification is sent per `(group, source post)`: a later post that adds members to an existing group notifies once for those members. An ungrouped event notifies per event, as today." (s.3019-3023). The spine states: "This replaces the PRD rule 'push notifications are sent per event, not per post' for grouped events, so the PRD changes before this ships."
- **A35 Short delay.** Ingestion of a grouped, eligible event sets a due time and the existing scheduled drain sends one notification per (group, primary post) (s.3029-3037). The count N in the message is the events actually covered, "not `member_count`, which includes the archive" (s.3037-3038). User-visible delay = due time plus up to one drain cycle (about 6 minutes in production); "a lower bound, not a promise" (s.3038-3040). The 90-second due delay is a start value (P21).
- **A36 Eligibility is per event.** A roundup-sourced or curator-sourced stub never gets a due time and is never stamped, so its one future first-organizer-post notification is not consumed (s.3041-3043). A sibling that lands after the claim for its own (group, post) sends nothing (s.3043-3045). **A split child inherits "already notified": a split never notifies** (s.3045-3046). An event that leaves its group before the claim is notified per event (s.3046-3047).
- **A37 Failure.** A failed send is logged and alerted, never retried (s.3048-3049).
- **A38 Suppress per (user, group).** `[ADOPTED, user-directed 2026-10-20]` (s.3206-3223). "A user subscribed to three malls that post one promo is told once, not once per `(group, post)`, for what Discovery shows as one card." Stated consequences: a user who subscribes to a second mall after the first claim "is still not told about that mall's branch"; a user who subscribed to none of the earlier posters "is told at the first claim that reaches them"; a **new season is a new group, so it notifies again**; a dissolved group's records are irrelevant; merging two groups keeps the earliest "sent" time per user; a failed push may still be recorded as sent ("the same posture as `notified_at`"). Ungrouped events keep today's path. The claim for a cross-account group is on events "whose primary post is `$post`" (s.3202-3204, PROPOSED mechanism).
- **B5 Per-event baseline, as built** (AD-30 Rule 10, s.2081-2093): an event notifies at ingestion iff its primary post is not a roundup and not curator-sourced; a roundup stub never notifies at ingestion; when a later primary makes the event organizer-authored and it has never notified, exactly one notification is sent; a merge keeps the earliest "notified" time so it can never re-fire. The 2026-10-19 amendment (s.2089-2093) only redirects grouped events to the A34 path.

---

## 4. Favorites and calendar entries when an event is split or grouped

- **A39 Favorites are per event, never per group; calendar additions stay per schedule** and carry both the schedule and the event (s.3050-3053). Grouping changes neither.
- **A40 A split copies every user's favorite to every child event, keeping the source `created_at`** (the Favorites list orders by it). Tags: AD-36 Rule 15 `[ADOPTED, user-directed; invariant on undo PROPOSED]` (s.3050-3055); AD-38 Rule 4 `[PROPOSED direction; the favorites copy is ADOPTED, user-confirmed]` (s.3489, 3515).
- **A41 Where a favorite count is a ranking input, a series counts distinct users over its members, not the sum** (s.3056-3058).
- **B6 Merge, as built (see B4):** favorites move to the survivor deduplicated per user; calendar entries follow schedules (matched by date, and since the 2026-10-19 amendment by (start date, place)) and are never deleted (s.2049-2060, 2072-2079; the amendment is UNTAGGED).
- **Not adopted (P5):** where the calendar entry of a moved schedule points after a split (the schedule keeps its id, the entry's event pointer is repointed), the "original event stays the first child", and undo of a split (invariant "every user with an active favorite on any child ends with exactly one on the original", PROPOSED; refused with `SPLIT_DIVERGED` once a child changed, e.g. gained a favorite).
- **Grouping does not touch calendar or favorites lists:** they list every event (A32). The group page is how a user reaches a collapsed member they favorited (A33).

---

## 5. Moderator-facing behaviour (in user terms)

- **A42 Review group.** Under A23 (s.2612-2614): Moderator Tools gains a "review group" action: detach a wrongly suggested child, rename, or dissolve the group. It is "a revert, never a block". Tier 2 and Tier 3 suggestions generate a moderator notification.
- **Dissolve** restores every member (A20). Detach and dissolve are logged and reversible (U8). Confirm and "merge groups" actions are P15.
- **Exact-repeat merges** are done by the system, not a moderator, are journaled, and a moderator can undo them; the undo is permanent (A5). A moderator's "not a duplicate" always wins (A4).
- **Queue (B2, A7).** Mid-band pairs are queued; accept = merge, reject = dismissal. The 2026-10-19 production check found 147 pending, 0 merges, 75 older than 7 days (s.2026-2028); the moderator "is not notified (BUG-069, IDEA-090)". Today a moderator is emailed for only five event types (dangerous report, default-location change, two scraper alerts), so "'review after the fact' depends on IDEA-090" (s.3272-3274).
- **Switches and caps (P14):** the safety net the adopted paragraph relies on (A20) is a per-detector switch and a daily cap on creations, plus a bulk undo that restores every member; their mechanism is PROPOSED (P14).
- **Moderator split action** ("split event", AD-38 Rule 4) is PROPOSED direction (P5). The moderator merge of split siblings "is the exception that ends in the AD-38 Rule 4 undo" and is guarded: a merge of events whose places do not intersect is refused unless forced (s.2072-2080, UNTAGGED).

---

## 6. Where this CONFLICTS with the current PRD

Types: **CONTRADICTS** (PRD says the opposite), **SUPERSEDES** (PRD sentence stays true only for part), **CLARIFY** (PRD wording becomes ambiguous or wrong), **ADD** (new text needed, no contradiction). Conflicts counted: C1-C6 definite, C7-C10 clarify or future.

| # | PRD line and sentence start | Type | What changes | Source |
|---|---|---|---|---|
| C1 | 96 "Notifications: Push notifications are sent per event, not per post." | CONTRADICTS (for grouped events) | Grouped event: one per (group, source post), after a short delay, and once per user per group. Ungrouped and roundup-stub rules stay. | A34, A38; spine says so itself s.3021-3023 |
| C2 | 102 "First-Organizer-Post Notification: ... **one** notification is sent for it" | SUPERSEDES (for grouped events) | The per-event marker stays, but a grouped event's notification goes through the group claim and per-user suppression; a stub's future notification is not consumed. | A34-A36, A38; s.2089-2093 |
| C3 | 103 "Merge and Redirect: A moderator can merge two events that are duplicates"; also 195 "offers a merge action for duplicate events"; also 483 (4.1 `mergedIntoEventId`) "Set when a moderator merged this event" | SUPERSEDES | The system also merges: exact repeats automatically (sweep, then live link), and `high` pairs in the one-time sweep; merged-away events get `mergedIntoEventId` without a moderator. Moderator can undo. | A1, A2, A7; s.1947-1948 |
| C4 | 99 "Matching: ... overlapping schedule dates (within 2 days) ... A **high** score links ... A **mid** score creates ..." | SUPERSEDES (partial) | Exact repeats are raised to high (A1). Not adopted: shared-link candidates up to 90 days and the cross-poster rule (U1, P2). | A1; U1 (untagged); P2 |
| C5 | 87-88 "The AI agent decides the grouping within the same single extraction call" and rule 1 "...or a different venue." | SUPERSEDES (partial) | "Different venue means separate events" is no longer left to the prompt; code enforces it after extraction (place split). An event is "one activity at one place-set". Rules 3 and 4 (7 days; dependent stages) stand. | A8, A9; s.1820-1831 (untagged amendment); U11 |
| C6 | 900-904 (4.7) `extractedEventCount`: "The number of events created from this post by extraction" | CONTRADICTS | Spine: `extracted_event_count` "stays the pre-split count"; a place split creates more events from a post than the count says. | s.3275-3276 (untagged); A8 |
| C7 | 90 "Items within about 7 days ... under one title and venue are one event ... (`program-lineup`)" and 898 `groupingReason` doc | CLARIFY (future) | True today and until the activity split ships; the plan (A24) makes distinct lineup items separate visible events in a `programme` group. PRD should record the planned supersession, not change today's rule. | A24 |
| C8 | 103 "A merge can be undone within the moderator undo window." | CLARIFY | As built, the only window is the 6-second toast; undo is callable afterwards with no expiry; undo of an automatic merge adds a permanent "not a duplicate". | B4, A5 |
| C9 | 62 "3.4.1 Default View: All event discovery pages (main discovery, subscribed events)" and 31-37 (3.1) | CLARIFY / ADD | Collapse applies to the main Discovery document only; the feed, calendar, favorites and account pages list every event. 3.1 has no grouping text: add collapse, "part of" chip, "+N more matching" (copy deferred). | A25, A26, A32 |
| C10 | 100 "Primary Post: ... (2) the post whose extraction gave more schedules with a complete date and location" | TAG MISMATCH | The PRD states as fact a clause the spine tags `[ASSUMPTION]` (s.1856). No change forced; owner should confirm. | s.1856 |

ADD only (no PRD sentence contradicted): 41 (3.2.1) add "favorites are per event; a split copies them to every child; a series counts distinct users" (A39-A41); 106 (Related Events) add the separate "part of" group section on the event page (A33, U7); 195 (3.9.3) add "review group" (A42), and group conflicts on merge (U9); 196 badge: whether group items count is undecided (Q3); 167 "Schedule Consistency" (3.9.1) assumes an event's schedules may sit at different locations, which A8 narrows to one place-set per event (CLARIFY, not a contradiction).

---

## 7. Open questions that block writing a requirement

- **Q1 Repeat notification inside one group.** A34 says "a later post that adds members to an existing group notifies once for those members". A38 says a user is told once per group, and "a new season is a new group, so it notifies again", which implies nothing inside a season. For a weekly run by one account (Riot Jogja), is a subscriber notified for each later week or only for the first? Both are ADOPTED and they disagree (X1).
- **Q2 Does per-user suppression (A38) apply to programmes?** Its stated reason is "what Discovery shows as one card". A programme is never collapsed (A26) and SCH is a programme "because each of its events must be promoted individually" (A14). The mechanism is written for every group.
- **Q3 How is a moderator told?** Tier 2/3 group notifications, merge-conflict flags and queue items have no carrier (IDEA-090, BUG-069). Do group items count toward the Moderator Pending-Item Badge (PRD 196)? Not stated.
- **Q4 Are the exact-repeat preconditions (A3-A6) owner-confirmed?** The tag says they "come from review R4 and from the sample read"; the live path is off until the owner reads the sweep result. Can the PRD promise "shows it once" now, or only after the switch is on?
- **Q5 Who can create, move or dissolve?** ADOPTED: detach, rename, dissolve by a moderator. Not stated: a "move member to another group" action; a user or poster action; whether a moderator can create a group by hand today (reserved, U5). "Confirm" and "merge groups" are PROPOSED (P15).
- **Q6 "Same poster" and "organizer".** Exact repeats use "same-poster"; series use the organizer-authored publisher or co-author (AD-31 Rule 3, P11). The PRD needs one definition per rule.
- **Q7 Labels and layout are deferred** ("+N more sessions", "also at N other places", the "part of" chip text, group-page layout): `Deferred` s.3270-3271.
- **Q8 Notification timing wording.** The due delay (90 s) and `GAP` are start values (s.3267-3269); the PRD cannot give a number beyond "a short delay plus up to one drain cycle".
- **Q9 Delivery order.** Discovery collapse is gated after the ranked list (IDEA-074/076/080) (PROPOSED, P10); programme/lineup reshape is PLAN-ONLY (A24); grouping of the existing backlog waits for dedup (U10, 80% gate is P19). Which of these must the PRD mark as "not yet shipped"?
- **Q10 Tag evidence** is adopted but ships default off until `isEvidenceTag()` exists (P12). Is it a requirement or a conditional feature?
- **Q11 Cap on events per post.** PRD 94 caps a post at 10 events; the place split adds a post-split cap whose values are ASSUMPTIONs (s.3448-3449). Which cap applies to a caption with many places?
- **Q12 Cost of the country scope.** An Indonesian event with only a wrong foreign pin and no area key stays ungrouped (about 27% of pins by weight lie outside the Indonesia box); "a Round 4 count sizes it" (s.2806-2809). Accepted by the owner as stated, but unsized.

---

## 8. Not adopted - do not write as requirements

Each item keeps its tag. Cross-referenced from Sections 1-7.

- **P1** Stub-vs-stub same-poster signal of 0.20 (replaces the discounted organizer term; ceiling 0.60 so never auto-merges). `[PROPOSED]` (s.1977-1984); weight "arithmetic, not yet replayed".
- **P2** Cross-poster duplicate rule: normalized name equal, `isSamePlace` = `same`, date ranges sharing a date, any posters, yields `mid` (queued, never auto-merged). Inside `[PROPOSED; corrected by review R4]` (s.2029-2038); repeated as AD-36 Rule 17.7 under "`[PROPOSED by the review]` unless marked" (s.3120-3122, 3237-3242). The user-visible effect would be more mid-band suggestions for one event posted by several accounts (7 of 24 cross-account clusters).
- **P3** Sweep queue bound `max(0, 50 - pending)`: `(start value [ASSUMPTION])` (s.1945-1946); counting only pending candidates younger than 7 days, derived expiry, reopen a `superseded` pair, bound applies to the one-time sweep: `[PROPOSED; corrected by review R4]` (s.2029-2036).
- **P4** Primary-post rule clause (2), more schedules with a complete date and location: `[ASSUMPTION]` (s.1856).
- **P5** Split mechanics: `[PROPOSED direction; the favorites copy is ADOPTED]` (s.3489-3535): original stays first child with its id/slug/favorites/links; moved schedules keep ids and their calendar entries follow; one main schedule per child; pending corrections/reports block the backfill; undo only for an untouched child else `SPLIT_DIVERGED`; ingestion-time split writes the same journal. Undo-by-invariant is `PROPOSED` in AD-36 Rule 15 (s.3051, 3056-3057).
- **P6** Backfill mechanics `PROPOSED` (s.3537, 3542-3555); "about ten events" `[PROPOSED]` (s.3578); two signals for a split `[ASSUMPTION]` (s.3554-3555); place and post caps `[ASSUMPTION]` (s.3448-3449); rollout flags `place-normalizer`, `discovery-group-collapse`, `group-notifications`, `area-exposure`, default off `[PROPOSED]` (s.3627-3632).
- **P7** Duplicate exclusion (b), place sets all `different`: `[ASSUMPTION]` (s.3617); `isSamePlace` similarity threshold `[ASSUMPTION]` (s.3433).
- **P8** Series "two shapes" (over time / concurrent) and card labels "also at N other places" / "+N more sessions": `[PROPOSED]` (s.2742-2750).
- **P9** Series cover is the member nearest the user: `[PROPOSED]` (s.2978-2985).
- **P10** Rule 13 delivery gate (after IDEA-074/076/080) and request switch `groupCollapse` default false (only Discovery sets it): "delivery gate and request switch PROPOSED" (s.2955-2962).
- **P11** Kind derivation (series only if every member's text after a trailing spaced dash is its own place, or members share one normalized name; else programme), series identity `(organizer, stem)`, the canonical key and link-tier score, bar 0.85 `[ASSUMPTION]` (s.2862), `MIN_VENUE_EVENTS` 15 `[ASSUMPTION]` (s.2843-2844), cross-account numbers "`[ASSUMPTION]` all numbers" (s.2792), group name from the first two members, moderator can rename `[ASSUMPTION]` (s.2910); "the derivation test and the organizer key are PROPOSED by the architect review" (s.2732-2733); canonical-key revision `[PROPOSED]` (s.2833).
- **P12** Tag-evidence rule: a pair at weighted score 0.70 to 0.85 joins if it shares one hashtag on at most 12 events, not a mall or city tag, with rare words, and both events are the only event of their post; "Proposed use" (s.2886-2890); guard `[ASSUMPTION]` (s.2890); default-off switch until `isEvidenceTag()` exists (R4, s.2896-2898).
- **P13** Tier 1 also notifies moderators at lower priority: `[ASSUMPTION]` (s.2615-2617). Tier 2 needs a seeded anchor; third-party captions never attach on their own: `[ASSUMPTION]` review gaps G6/G7 (s.2591-2599).
- **P14** Switches and caps: unconfirmed group's only effect is the "part of" link and Discovery policy, inheritance only for confirmed groups, a switch and daily cap per detector: `[ASSUMPTION]` review gap G4 (s.2618-2625); AD-36 Rule 16 whole, `[PROPOSED by the architect review]` (s.3064-3118): one writer, precedence `moderator > place_split > series_stem / title_pattern > keyword_organizer > extraction_field > series_phrase`, detector table (`confirmed_at` set at creation for Tier 1, stem, place split, moderator; null for cross-account series and Tier 2), dissolve nulls members' group and is journaled, a daily cap bounds creations (a capped event retried nightly, a cap hit raises an alert).
- **P15** Moderator actions "confirm" and "merge groups" (Rule 5 amendment, s.2636-2639, rooted in Rule 16); `dissolveBySource` bulk undo and a nightly new-groups list, "unobserved" until IDEA-090 (Rule 17.8, s.3243-3247).
- **P16** AD-36 Rule 17 items 1-4, 6-8 `[PROPOSED by the review]` (s.3120-3247): per-member collapse key (equal keys collapse; link-only otherwise); a rename or relocation can turn a member link-only or detach it; detach/dissolve record an exclusion "cleared only by a moderator" so a dissolved group does not re-form; country stored on the event and enforced by the database, a late sibling never attaches to a dissolved group, a place-split group is created only with at least two same-country children; curator or roundup stubs neither create nor join a series until promoted; nightly reconcile and bridge items.
- **P17 (UNTAGGED, not a requirement)** Rule 4 2026-10-20 amendment: per-member collapse key instead of the group's `confirmed_at` (s.2626-2630, UNTAGGED correction under R4).
- **P18 (UNTAGGED, not built)** Location inheritance from an anchor "must not ship" before BUG-068 is fixed and verified (Rule 9, s.2687-2697, UNTAGGED); audience-area inheritance "is an open decision (AD-39, Deferred)".
- **P19** Dedup gate: 80% of reachable pairs `[ASSUMPTION]` (s.2713-2714); going-forward grouping not held to the gate `[ASSUMPTION]` (s.2703-2707).
- **P20** Programme soft cap `k` and penalty: `[ASSUMPTION]` start values (s.2976-2977).
- **P21** 90-second due delay and the `GAP` values are start values; "Added 2026-10-19: the values of `GAP` and the due delay ... to calibrate" (s.3267-3269).

---

## 9. Spine inconsistencies found

- **X1** AD-36 Rule 14 (s.3019-3021, ADOPTED) "a later post that adds members to an existing group notifies once for those members" against Rule 17.5 (s.3206-3223, ADOPTED) once per (user, group) until a new season. See Q1.
- **X2** Deferred list (s.3270-3271) says "still open: the carrier ..., the attach serialisation key when no organizer is shared, and the join rule against chaining"; Rule 12 (s.2815-2817) says all three are "decided" (by Rules 17.1/17.3, which are PROPOSED). Stale text or an undecided decision.
- **X3** The per-detector switch and daily cap are named inside the ADOPTED safety net (s.2771-2773) but tagged `[ASSUMPTION]` in Rule 4 (s.2623-2625) and `[PROPOSED]` in Rule 16 (s.3105). The nightly owner list needs a carrier and "until IDEA-090 ships it is unobserved" (s.3245-3247).
- **X4** `undoEventSplit` invariant: AD-38 Rule 4 (s.3515-3516) places `[ADOPTED, user-confirmed]` next to it, while AD-36 Rule 15 (s.3051) says "invariant on undo PROPOSED". Treated here as PROPOSED.
- **X5** Stale inline text: s.2749-2751 says a concurrent series posted by each place's own account "is **not** grouped, because the series key includes the organizer"; it is marked "superseded 2026-10-20" in the same sentence by A18. The identity key still reads `(organizer_account_id, stem)` (s.2831).
- **X6** Rule 4 amendment (s.2619-2623) says an unconfirmed group's only effect is the link and the Discovery policy; cross-account series are created with `confirmed_at` null yet collapse from the start (s.3095). The spine acknowledges this at s.2626-2630.
- **X7** Two meanings of "duplicate": same organizer (AD-38 Rule 6, s.3611-3612) against "any posters" (P2).
