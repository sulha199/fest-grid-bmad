---
backlog_id: CC-261124-vjh
date: 2026-11-24
trigger_story: none (POC-driven owner request; change trigger = planning-artifacts/registration-extraction-correct-course-input-2026-11-24.md)
scope: Major
mode: Batch (unattended scheduled run; nobody could answer questions)
status: proposed (awaiting owner approval; NOT approved)
revision: 7 (2026-11-27, input section 16: owner accepted the recommendations for Q7 to Q12; reviewer summary added; consistency pass)
---

# Sprint Change Proposal: registration, CTA bar, highlight, honest dates and the extraction update

## Reviewer summary

Status **proposed, not approved**. 32 stories in two new epics; no question open (Q1 to Q12 answered, section 11).

**Epic 11 Extraction and honest dates (21):**
11.1 Prompt seam in the extraction request builder · 11.2 Replay release gate, fresh caption set per release ·
11.3 New columns (stage, display flag and dates, facts, highlight, core name, tiers) · 11.4 Stage per schedule row,
main flag derived in code · 11.5 Title rule v2 in the domain package · 11.6 Extract prizes, promos, inclusions, free
flag, speakers · 11.7 Highlight composer, card highlight stored, recompute for active events · 11.8 One
post-extraction call (location, tiers, core name) · 11.9 No geocoding for online-only locations · 11.10 Race-pack
posts matched into the main event · 11.11 Backfill active events from stored data (layer 1) · 11.12 Healing sweep of
display flags on active events · 11.13 Display flags on every write path, field map on display columns · 11.14 Grid
card redesign, highlight list, dummy-date labels · 11.15 Re-read captions of active events locally (layer 2) ·
11.16 Clear wrong pins of active online-only schedules · 11.19 Account default location only for confirmed organizer
or venue accounts, marked · 11.20 Investigate wrong-city matches, city check only on a verified cause · 11.21
Re-geocode active never-attempted pins, nothing found clears the pin · 11.22 Time dropdown with next 7 days and the
viewer's day (BUG-097) · 11.z Ratchet: highlight and flags only from their domain functions.

**Epic 12 Registration, CTA bar and prices (11):**
12.1 Registration options table · 12.3 Uncached read with safe descriptors only · 12.4 `/go/` link endpoint, also for
the Story 0.37 event links · 12.5 Action bar on phones, side card on desktop · 12.6 Sheet for several options ·
12.7 Event price tiers and "from" price beside the buttons · 12.8 Deterministic phone detector and text scrub ·
12.9 Phone retention sweep · 12.10 WhatsApp and phone actions revealed on action · 12.z Ratchet: organizer
destinations only as `/go/` links · 12.2 QR decoding, last, behind the memory gate.

**Implementation order** (section 8): (1) 11.9, 11.19, 11.20, then 11.16 and 11.21 (owner go-ahead); 11.22 any time;
(2) 11.1 -> 11.2, 11.5 in parallel; (3) 11.3 -> 11.4 -> 11.13 -> 11.6 -> 11.7 -> 11.8 -> 11.10; (4) 11.11 -> 11.12
-> 11.14; (5) 12.1 -> 12.3 -> 12.4 -> 12.5 -> 12.6 -> 12.7; (6) 12.8 -> 12.9 -> 12.10; (7) 11.15; (8) 11.z, 12.z;
(9) 12.2.

**Out of scope** (backlog children of `CC-261124-vjh`, section 10): `IDEA-261124-8jo` Own cover slide per event
(Story 11.17 reserved) · `IDEA-261124-f6n` Slide map merged into the tier call · `IDEA-261124-wk6` Image tier call on
the stepped path · `IDEA-261124-15a` Filter header changes other than the time filter · `IDEA-261124-nta` "Remind
me" epic · `IDEA-261124-ofm` Tier call reading images (only if the gate triggers it) · `IDEA-261124-xdv`
Button-to-tier reference · `IDEA-261124-gj0` GENERAL price rule for multi-event posts. Skipped: `IDEA-261124-5yi`
Ask the model for windows or trust its main flag · `IDEA-261124-ibh` `evidence` copy field · `IDEA-261124-dtk` OCR
instead of the slide-map call · `IDEA-261124-jz4` Database trigger for `is_display`. Also outside: PR #270
(`BUG-261126-pwb` THIS_WEEK window across a month boundary).

## Revision 7 (2026-11-27): what changed since revision 6

Source: section 16 of the input file (owner accepted the recommendations for Q7 to Q12). Status stays **proposed,
not approved**.

1. **Q7 to Q12 decided** and written as decided text: highlight recompute for active events only (C4, C10, PRD
   edit 13, AD-59, Story 11.7, A14); inheritance only for confirmed organizer or venue accounts, with the 2026-11-27
   counts (C11, PRD edit 11, AD-14, UX, Stories 11.19 and 11.21, A15); nothing found clears the pin (C11, AD-14,
   Story 11.21); event-link ids derived at read time (3.3, AD-57 scope, Story 12.4, I13); old `UPCOMING` links read
   as "Kapan saja" (C12, PRD edit 12, UX, Story 11.22); the viewer's day and no extra SQL (C12, PRD edit 12, AD-20,
   Story 11.22, I12). Section 11 records the answers; "recommendation" and "open" wording for them removed.
2. **PR #270** (`BUG-261126-pwb`) noted in Story 11.22: same file, another function.
3. **Reviewer summary** added above. **Consistency pass:** story counts (21 + 11 = 32), ids, titles, dependency
   order and the 5.4 keys re-checked against `epics.md`, `sprint-status.yaml` (no `epic-11`/`epic-12` key) and the
   spine (last AD is AD-54) after merging the base branch and `master`; planning order step 1 and the success
   criteria updated. Backlog note of `CC-261124-vjh` updated; the note of `IDEA-261124-ofm` shortened to one fact
   (board check 15 flagged it at 437 characters).
4. **Doubtful, not decided here** (for the owner's review):
   - The Q8 count (167 + 203 + 59 = 429 active pins without location text, account from the earliest linked post)
     and the 11.21 count (197 never-attempted active pins without text, 2026-11-26) select different rows and do not
     reconcile; the 11.21 dry run gives the real numbers before any apply.
   - Story 11.22 sits in Epic 11 as a planning assumption (A8; the owner said "into an epic").
   - PR #270 is open; whichever of PR #270 and Story 11.22 lands second merges `master` first (same file).

## Revision 6 (2026-11-26): what changed since revision 5

Source: sections 14 and 15 of the input file and handoff sections 11 and 13E. Status stays **proposed, not approved**.

1. **Event links onto `/go/` (input 14):** the organizer links that Story 0.37 (Extract and display event links)
   renders today move onto the first-party endpoint **inside Story 12.4**, with acceptance criteria; the
   "follow-up, not part of this course" wording and assumption A12 are removed; ratchet 12.z covers them (C1, 4.1
   edit 1, 4.3, 5.2, A12).
2. **Wrong pins in Epic 11 (input 15, handoff 11 and 13E):** three new stories, 11.19 (Inherit the account default
   location only for organizer and venue accounts, and mark it), 11.20 (Investigate wrong-city geocoding matches and
   add a city check if the cause supports it), 11.21 (Re-geocode active schedules never attempted by the current
   path); new change C11; assumption A9 replaced; `FIND-261124-axb` now points at them.
3. **Backfills cover active events only (input 15):** C10, section 3.5, Stories 11.11, 11.12 (its sweep and drift
   count), 11.15, 11.16 and 11.21; retitled 11.11, 11.12, 11.15, 11.16 (ids unchanged, proposed keys renamed).
   Past events stay as they are, including their pins. The highlight recompute step of 11.7 is not named by the
   owner; it is kept to active events as a recommendation (Q7).
4. **Next-7-days time filter (input 15):** new Story 11.22 (Replace the temporal toggle with a time dropdown with the
   next 7 days, and use the viewer's date), new change C12, with acceptance criteria and the BUG-097 fix; assumption
   A8 replaced; `IDEA-261124-15a` keeps only the other header changes.
5. **Numbering:** new stories take 11.19 to 11.22; 11.17 stays reserved and the ratchet keeps its proposed key
   `11-18z`, so no existing id moves. Epic 11 has **21** stories, **32** in total.
6. **Code read (read only, 2026-11-26)** for the new criteria: account kinds, the default-location path, the temporal
   filter in domain, GraphQL and the four pages, and the event-link render (sections 5.1 and 5.2).
7. **Master moved:** PR #269 (Stop re-buying Bright Data posts, store caption-less posts, link every scraping
   account) merged. It drops the one-scraping-source-per-post index (migration 0105, AD-25 Rule 2 amended), so a
   post can now have several scraping accounts: this matters for which account's default location 11.19 inherits
   (Q8). Caption-less posts are now stored (empty caption kept distinct from a cleared one): layer 2 (11.15) treats
   an empty caption like a missing one.
8. **Section 11:** six new questions (Q7 to Q12) with recommendations.

## Revision 5 (2026-11-26): what changed since revision 4

Source: section 13 of the input file (owner answer to Q5). Status stays **proposed, not approved**.

1. **List highlights carry a count (Q5):** a highlight that lists two or more items writes the item count in
   parentheses after the label and keeps every item ("Penampil (4): Band A, Band B, Band C, Band D"); one item
   gets no count; single values (price hook, free entry) get no count. Applies to every list label (performers,
   speakers, instructors, judges, prizes, take-home items, promos and the like). The count is part of the stored
   text, no count column; a later format change goes through `highlight_rules_version` and the recompute step.
   "+N" and the cut to two names are withdrawn (C4, PRD edits 3 and 6, AD-59, UX 4.4, Stories 11.7 and 11.14,
   decision 3, A11c, handoff 13F and S50, backlog note).
2. **Section 11:** Q5 recorded as answered. Q6 (a list whose values already start with the label word) followed
   from Q5 and was answered by the owner the same day as recommended (input section 13, last bullet): in a list of
   two or more, the label word at the start of a value is dropped. **No question remains open.**
3. **Backlog note of `CC-261124-vjh` shortened** to one fact under 300 characters (board check 15 flagged the
   revision 4 note); the history stays in these revision notes.

## Revision 4 (2026-11-26): what changed since revision 3

Source: section 12 of the input file (owner answers to the four questions of revision 3; it overrides earlier
wording, including the 40-character rule of input sections 2 and 8). Status stays **proposed, not approved**.

1. **Card highlight, no length limit (Q1):** the card highlight is the first item of the detail list, stored
   whole; the UI ends it with an ellipsis when it does not fit. The 40-character limit, the skip-if-too-long rule
   and the buy-get cut at the condition word are removed everywhere (C4, section 3.3, PRD edits 3 and 6, AD-59, UX
   4.4, Stories 11.3, 11.7 and 11.14, decision 3, handoff F, backlog note). Removing academic degrees after the
   first comma of a name stays. The production code has no highlight column and no length limit today (checked,
   read only); the limit lives only in the POC composer (`MAX = 40` in `compose-highlight.mjs`), so Story 11.7
   ports the composer **without** it. The 0.86 composer precision was measured with the length rule: the first
   release with this change sets a new baseline (A4, Story 11.2).
2. **Dummy dates, option A (Q2):** `display_is_dummy` = flagged and stage neither `event` nor `other`; the card
   label comes from the stage; a competition `submission` row keeps its real start and end dates and shows "Submit
   s/d"; only a flagged `registration` row uses its end date as the start date (section 3.5, C6, AD-58, Stories 11.3
   and 11.13; I9 resolved).
3. **Story 12.2 memory gate (Q3):** replay peak memory with QR decoding at most 10% above the same replay without
   it, and below 80% of the Lambda's configured memory (C1, C9, AD-57, Story 12.2).
4. **Option B trigger (Q4):** per release 40 fresh posts read by eye, Claude first, doubtful posts to the owner;
   option B is built when two or more ticket prices visible on the images were not returned; one is reported and
   watched; a price label on a single product is not a ticket price. **First reading 2026-11-26: 0 of 40**
   (findings 11.22), option B not built (C9, Story 11.2, backlog `IDEA-261124-ofm`).
5. **A4 accepted as written** (release gate pass criteria); recorded in section 7 and Story 11.2.
6. **Section 11** is now a record of the owner's answers; one new question (Q5, performer list on the card) that
   follows from Q1 and an earlier wording rule.
7. **Master moved:** PR #268 (normalize extracted times before the Postgres time insert) and PR #266 (AI-processor
   memory logging) merged; notes added to Stories 11.4, 11.13 and 12.2.

## Revision 3 (2026-11-26): what changed since revision 2

Source: sections 8, 9, 10 and 11 of the input file (binding; where a later section differs from an earlier one,
the later one wins) and POC findings 11.18 to 11.22. Status stays **proposed, not approved**. One line per change:

1. **All twelve open decisions are decided** (section 6): 1 (clear the online pins after 11.9), 2 (flag every
   non-counting row), 3 (hybrid highlight), 4 (cover per event deferred, Story 11.17 not built in Epic 11),
   5 (short label on the card, sentence on the detail), 6 (no tier call on the stepped path), 7 (slide map stays
   separate), 9 (no evidence field, code sets `lowConfidence`), 10 (tiers belong to the event, buttons carry no
   price), 11 (QR adopted, Story 12.2 last behind a memory gate), 12 (`other` does not count unless all rows are
   `other`). Decision 8 was decided in revision 2.
2. **List query design (input section 9)**: `schedules.is_display` flag kept by one domain function
   `computeDisplayFlags` on every write path plus a healing step in the scheduled sweep (no trigger); generated
   columns `display_start_date`, `display_end_date`, `display_is_dummy`; partial index
   `schedule_display_date_idx`; the AD-17 field map points at the `display_*` columns. Works when one event has
   several main schedules. Section 3.5 rewritten: the "enable the readers after the gate" switch is gone.
3. **Stories 11.12 and 11.13 redefined**: 11.12 (Recompute display flags in the scheduled sweep and report
   drift), 11.13 (Compute display flags on every write path and point the field map at the display columns).
   11.11 and 11.z changed to match; AD-58, AD-17 and AD-20 amendments rewritten.
4. **Core event name** (`coreEventName`, `activityType`): inside Stories 11.3, 11.8, 11.10, with first fill by a
   code rule in 11.11 and by the local re-read in 11.15. Matching field only, never displayed.
5. **Tier call input (input section 11)**: the tier call reads the caption **and** the per-event price string
   the main extraction returned. **`ticketPrice` stays an output of the main extraction for new events**; tier
   options are added beside it. Every revision 2 wording that said a per-option price replaces `ticketPrice` was
   changed (C5, PRD edits 6 and 7, Story 0.35 note, handoff D5). The images variant (option B) is not built;
   carved out as a backlog row.
6. **Release gate (C9, Story 11.2)** gains four measurements: ticket prices on images that the extraction did not
   return (the trigger for option B), events with a missing or extra tier on multi-event posts, the core name
   inside the merged call, and (for 12.2) the replay peak memory.
7. **Hybrid highlight (decision 3)**: stored card highlight plus a rules version and a recompute step; read-time
   detail list from the same function. Story 11.7 now also stores the card highlight on every write path; Story
   11.14 also renders the detail list.
8. **Epic 12 order**: 12.2 (QR) moved last behind a memory gate; 12.7 retitled (prices are the event's tiers, not
   per button).
9. **Epic 11 has 17 stories** (11.17 deferred to backlog `IDEA-261124-8jo`); 28 stories in total.
10. **Proposed sprint-status keys** are now listed (section 5.4); ids checked against `sprint-status.yaml`,
    `epics.md`, the spine (last AD is AD-54) and the backlog tooling.
11. **Backlog**: five new child rows (three open, two skipped), notes of `IDEA-261124-8jo`, `IDEA-261124-f6n`
    and `IDEA-261124-wk6` updated to the decisions (section 10).
12. **Correction carried from findings 11.9**: prices only on the poster are not rare (31% of priced events with a
    caption in production, not 1 of 53).
13. **New section 11 "Questions for the owner"**: four points that the input leaves undecided or contradictory.

Revision 2 change note (2026-11-24, kept for the record): stage rollout rule (now replaced by item 2 above), title
rule v2 Story 11.5, race-pack Story 11.10, QR as an open decision, Story 0.35 reference, sixth stage `other`,
relative gate threshold (A4), decision 8 (windows stay schedule rows), split into Epics 11 and 12, the `/go/` link
endpoint (Story 12.4, ratchet 12.z), the master-merge process rule, the requests-per-post figure 2.04.

Produced by `bmad-correct-course` in an unattended cloud session. Planning only: nothing under `apps/` or
`packages/` changed, `sprint-status.yaml` and `epics.md` were not edited. Every edit below is a **proposal**
to be applied after the owner approves this document (workflow step 5 was not run).

Read with: `_bmad-output/project-context.md`, the PRD
(`prds/festgrid-prd-2026-07-10-2047/prd.md`), the change trigger
(`registration-extraction-correct-course-input-2026-11-24.md`, sections C1 to C10 below follow its numbering),
the handoff `event-registration-cta-handoff-2026-11-20.md` (sections 1-2, 9-13, J-O) and
`poc/registration-extraction/findings.md` (sections 9-11.22).

How this run handled decisions:
- **Owner decisions** (input sections 3, 7, 8, 9, 10, 11 and handoff D1-D12 where not withdrawn) are applied as
  final. A later input section wins over an earlier one.
- **Open decisions**: none left (section 6 records each decision).
- Points the input leaves undecided or contradictory are **not** decided here: section 11 lists them. Since
  revision 7 every question raised so far (Q1 to Q12) has an owner answer; none is open. Other workflow questions
  were answered with the most conservative option (section 7).

---

## 1. Issue summary

**Problem.** The owner wants the event card and the detail page to show one highlight, a registration bar
(bottom bar on phones, side card on desktop), price tiers and honest dates. The POC showed this is not a
UI change: the extraction must produce new facts (stage per schedule row, prizes, promos, take-home items, a
free flag, performers from speaker lines), a second small text call must produce price tiers, location
keywords and a core event name for matching, and the existing data needs a backfill. The database today has
`events.types`, `schedules.performers` and `schedules.ticket_price`, but **no column** for prizes, promos,
inclusions, free flag, stage, tiers, highlight, display flag or core name.

**Category.** New requirement from the owner, backed by a measured POC; plus defects found on the way
(online locations geocoded to wrong places, a curator account's default location pinned on events, a geocoding
match in the wrong city, registration windows winning the card date). Revision 6 adds the owner's time filter
"next 7 days" (input 15).

**Evidence (from the POC, all redacted, sample ids only).**
- QR: 14.8% of posts carry a decodable QR, 43% of codes sit on later slides, 68% of URL codes are behind
  redirectors; a model "QR option" was a support/donation/link-in-bio code in 12 of 15 runs (findings 9.3-9.4).
- Stage: required `stage` filled on 191 of 191 rows; the model's own main flag sat on a non-counting row on
  11% of main rows and 2-3 events had no main row; one post collapsed 3 events to 1 (findings 10.1, 11.1).
- Highlight composer: first-look precision 0.86 / recall 0.85 on a fresh 60-caption set; facts vary between
  runs on 23% of captions (findings 11.15, 11.17). Measured with the 40-character rule that revision 4 drops, so
  it is not the baseline for the first release with the change (A4).
- Tiers: separate call equal to the merged call on 58 of 59 posts; the merged call put prices on the wrong
  event in 1 of 7 multi-event posts (findings 11.10, 11.12).
- Tier input (findings 11.22): amounts found 32 of 68 from the caption alone, 67 of 68 with the extraction's
  price strings, 68 of 68 with images; tiers emitted when due 12, 20 and 20 of 20. No missed ticket price in 40
  posts without a stored price (images call; 95% upper bound about 7%).
- Prices only on the poster: 131 of 417 priced events with a caption (31%) in production; this corrects the
  earlier "1 of 53" of findings 11.9, which came from a sample picked by caption price cues.
- Stepped path (findings 11.18): the image tier call found one real tier list in 32 long carousels and read
  promo price lists as tiers on 3; the caption-only call found nothing.
- Button-to-tier pairing (findings 11.19): no caption in 2,992 states "audience X registers through channel Y".
- Core event name (findings 11.21): same-series pairs found 88% (raw names 43%, code rule 73%), precision 1.00;
  13 of 15 activity items find their main event by exact core name; it changes 6 of 13 ordinary names, so it is
  a matching field only.
- OCR for the slide map (findings 11.20): 1 of 5 dedicated slides found (model 5 of 5).
- Online locations: all 72 online-only schedules in production carry a wrong pin (handoff L).
- Dates: 103 stored events have only non-counting rows by title rule v2 (handoff M).
- Pins of active schedules (production read-only, 2026-11-26, active by Jakarta date): 1,436 active schedules,
  1,344 with a pin; 486 pins never attempted by the current geocoding path, 111 of them outside an Indonesia
  bounding box (approximate); 289 of the 486 have location text (206 distinct texts), 197 have none; 3,271
  never-attempted pins of past schedules are left alone (input 15).

---

## 2. Checklist record (`checklist.md`)

| Item | Status | Note |
|---|---|---|
| 1.1 Trigger story | [N/A] | No story; trigger is the POC input file (owner request + POC). |
| 1.2 Core problem | [x] | New requirement + two data defects (section 1). |
| 1.3 Evidence | [x] | Findings 9-11.22, handoff J-O. |
| 2.1 Current epic | [x] | No single epic owns this; Epic 3 (extraction) and Epic 1/1.i1 (card, detail) are touched but can finish as planned. |
| 2.2 Epic-level change | [!] | **Two new epics proposed** (Epic 11 Extraction and honest dates, Epic 12 Registration, CTA bar and prices; sections 5.1-5.2). Existing epics get notes, not new scope. Revision 6: Epic 11 also takes the wrong-pin stories and the next-7-days filter (input 15). |
| 2.3 Future epics | [x] | Epic 9 (AI filter, `isFree`), Epic 10 (re-extract preview) touched, section 3.2. |
| 2.4 Obsolete / new epics | [x] | None obsolete. Two new epics; "Remind me" and the cover per event stay carved out. |
| 2.5 Order | [x] | Section 8. |
| 3.1 PRD | [!] | Many sections, section 4.1. MVP goals unchanged; scope grows. |
| 3.2 Architecture | [!] | New AD-55 to AD-61 and amendments, section 4.3. |
| 3.3 UX | [!] | Card, detail highlight list, bar, side card, sheet, dummy-date labels, section 4.4. |
| 3.4 Other artifacts | [!] | `docs/infrastructure/architecture-diagram.md` + `high-level-overview.md` (QR library, new table, sweep steps, `/go/`); extraction eval docs; RLS test; handoff D5 and D7. |
| 4.1 Direct adjustment | Viable | As two new epics inside the current plan. Effort High, risk Medium. |
| 4.2 Rollback | Not viable | Nothing shipped to roll back. |
| 4.3 MVP review | Not needed | MVP goals hold; the work is additive. |
| 4.4 Path | [x] | Direct adjustment through two new feature epics, gated by a replay gate (section 3.3). |
| 5.x Proposal parts | [x] | This document. |
| 6.1-6.2 Review | [x] | Self-reviewed; inconsistencies in section 9, owner questions in section 11. |
| 6.3 Approval | [!] | **Not obtained (unattended run). Stops here.** |
| 6.4 sprint-status | [N/A until approval] | Not edited. Proposed keys in section 5.4. |
| 6.4a backlog.yaml | [x] | Row `CC-261124-vjh` (status `triaged`) and 13 child rows; checks run (section 10). |
| 6.5 Handoff | [x] | Section 8. |

---

## 3. Impact analysis

### 3.1 Change by change (C1-C10)

Every item lists: PRD effect, epics/stories affected, new stories (ids in section 5), ADs.

**C1. Registration separate from schedules; bottom bar and side card; phone and WhatsApp; QR link.**
- PRD: new feature section "Event registration and call to action" (owner ask 1-8, D1-D12); new
  `RegistrationOption` interface in section 4 (no price field: decision 10); privacy amendment to 4.1
  (`contactInfo`/`hasPrivateContact`), 3.16 and 5 Security (D1: a public registration phone may be stored for
  registration only; D2: hard delete at event end + 1 day, and on takedown, permanent delete and a re-extract that
  no longer finds it; raw caption blanked 30 days after expiry, handoff 8). QR rule: a button needs a **decoded**
  payload; a payment payload is never a Register button; the destination host is always shown.
- Stories affected: 3.6i (Classify and discard private contact; reversed for registration phones only, slice
  2), 3.6l (Single-request carousel extraction; QR decoding reads the same slides), 3.6v (Match and enrich in
  place) and 3.6w (Moderator merge): both must union registration options; 1.6 / 1.6a / 1.6e / 1.6f (Event
  detail view and refinements): header loses heart/calendar/share to the bar (D10); 4.2 + 10.6 (AI-assisted
  correction, re-extract on the job engine): preview shows options, persists nothing until apply (AD-40).
- Owner rule (revision 2): destinations that come from organizer or scraped data are not put in the page; the
  page links to a first-party endpoint that checks and answers 302 (shape in section 4.3, AD-55 and AD-57
  amendments). **The organizer links shown today move onto `/go/` inside Story 12.4 (owner decision, input 14):**
  Story 0.37 (Extract and display event links; sprint-status key `0-37-extract-and-display-event-links`, status
  `review`, no epics.md section) renders `events.links` as plain `<a href={url}>` in `EventDetailView.tsx`, and the
  public `Event.links` field returns the full `url`. Both change in Story 12.4; ratchet 12.z covers them.
- **QR: decided (decision 11, option B).** The decoder is adopted, but Story 12.2 ships **last** in Epic 12 behind
  a memory gate: only after the cause of the AI-processor Lambda out-of-memory seen since 2026-11-20 is
  understood, and the replay shows the peak memory with decoding at most 10% above the same replay without it and
  below 80% of the Lambda's configured memory (owner answer Q3, input section 12);
  decoding runs on a downscaled copy of the image. Slice 1 (buttons from caption links, phone, WhatsApp) does not
  wait for QR.
- **Low confidence (decision 9, option A):** no `evidence` field; an option whose source is an image gets
  `lowConfidence` set by code; the moderator opens the original post. D7's quoted evidence is withdrawn.
- New stories: 12.1 (registration table), 12.3 (descriptor read), 12.4 (link endpoint, also for the existing
  event links of Story 0.37), 12.5 (action bar), 12.6 (sheet) (slice 1); 12.8 (phones), 12.9 (retention), 12.10 (WhatsApp and phone) (slice 2); 12.7 (prices, slice
  3); 12.2 (QR, last); 12.z (link ratchet).
- ADs: new **AD-55 (Registration options table, bounded-retention contact, AD-8 hard-delete exception, cache
  split)**, new **AD-56 (Deterministic phone detector and contact scrub)**, new **AD-57 (QR decode step and
  link trust policy)**; amends **AD-8 (Soft-delete convention)** exception list, **AD-29 (Extraction audit
  log)** retention of numbers, **AD-33 (Z-index tiers)** bar on `z-overlay-sticky`, **AD-40 (Write-free
  re-extract preview)**, **AD-30 Rule 7 (Cross-post matching)** for a `sharedLink` clue and **AD-30 Rule 9
  (Enrichment and merge)** for the option union. Infra docs updated in the same change as zxing-wasm (CLAUDE.md
  section 4).

**C2. Stage per schedule row; main flag and display flag derived in code.**
- PRD: 4.4 Schedule gains required `stage` (`event | registration | submission | announcement | preparation |
  other`); `isMainSchedule` and the new `isDisplay` are derived in code from the stages of all rows of the event
  (one function, `computeDisplayFlags`), never taken from the model. The registration **window** stays a schedule
  row with `stage = registration` (decision 8); the multi-event rule "registration windows are schedules of the
  event" (PRD 3.7) **stays**.
- **`other` (decision 12, option A):** a row with stage `other` does not count as an event day, but an event whose
  rows are all `other` is treated as `event` (its rows count), so no event disappears.
- Rollout: section 3.5 (migration flags every row, so behaviour is identical until stages and flags are written;
  no reader switch).
- Stories affected: 3.6s (Multi-event extraction with grouping rules; prompt gains stage), 3.6p (Extraction
  audit log; record stage-guard repairs), 4.1 / 4.1b (Manual correction form; writes a stage and calls
  `computeDisplayFlags`), FR28 calendar title (unchanged wording, fed by the derived main flag).
- New stories: 11.3 (columns), 11.4 (stage on write), 11.12 (healing sweep), 11.13 (flags on write and field map).
- ADs: amends **AD-30 Rule 5 (Extraction contract)**: payload gains `stage`, grouping rule (4) unchanged;
  new **AD-58 (Stage per schedule row; display flag and generated display dates)**; amends **AD-17** and **AD-20**.

**C3. Facts for the highlight in the extraction call.**
- PRD: 4.1 EventInfo gains `prizes[]`, `promos[]`, `inclusions[]`, `isFree`; 4.4 `performers` also filled from
  "Bersama / Pembicara / Pemateri" lines. Bounded shapes, request-level `maxOutputTokens`, **no `evidence` copy
  field** on free text (decision 9), new instructions at the end of the prompt. `ticketPrice` stays in the
  extraction output (C5).
- Stories affected: 3.6s (prompt), 3.6j (Performer-contact leakage guard; must still run on the wider performer
  rule), 3.6p (audit log), Epic 9 / PRD 4.18 (AI filter `isFree` exact-match on `ticketPrice` text; a stored
  `isFree` can serve it later, not in this course).
- New stories: 11.1 (prompt seam), 11.6 (facts).
- ADs: **AD-30 Rule 5**, **AD-49 (Truncation and usage reporting)** for the output cap; the Gemini
  `responseSchema` size limit (project-context, 2026-10-30) applies to every new enum.

**C4. Highlight composed in code from the facts.**
- PRD: 3.1 Event Discovery and 4.1: one card highlight per event, stored whole with no length limit (the UI ends it
  with an ellipsis when it does not fit; owner answer Q1), composed by one function
  from typed facts with the owner rules listed in the input (type ladder and precedence; promo needs a cue and a
  figure; early bird wording; names are valid and come **before "free" on every type**; stated free counts and
  the model's `isFree` needs a free word; competition common perks are not highlights, workshop take-home items
  are; PROMOTION price hook, performer last resort; academic degrees after the first comma of a name removed; no
  doubled "Hadiah"; vague
  prize is not a prize). The buy-get cut at its condition word existed only to fit 40 characters and is dropped
  (revision 4). D12: no highlight when absent; scope or category labels are not highlights; a highlight
  is never a paid slot (Mary R8). The model never writes the highlight.
- **Decided (decision 3, hybrid):** the **card** highlight is stored (`events.highlight`, no length limit)
  with `events.highlight_rules_version`; a light recompute step (no LLM, from the stored facts) refreshes rows
  of **active** events whose version is older than the code's when the rules change (owner answer Q7: past events
  keep their stored text); every write path (extraction, manual correction,
  merge, re-extract apply) computes it through the one shared function. The **event detail** composes at read
  time with no character limit: the same function in a `detail` mode returns an ordered list of highlights from
  every rung of the type ladder that has content (all names, all prizes, promos, price hook, free, take-home
  items). The card highlight is the first item of that list, stored whole, so card and detail cannot disagree;
  no cut and no skip for length, the UI shows an ellipsis (owner answer Q1).
- **List items carry a count (owner answer Q5, revision 5):** an item that lists two or more values writes the
  number of values in parentheses after the label and keeps every value: "Penampil (4): Band A, Band B, Band C,
  Band D". Every list label does this (performers, speakers, instructors, judges, prizes, take-home items, promos
  and the like); a list of one value gets no count ("Penampil: Band A"); single values (price hook, free entry)
  never get a count. The count is the number of values written (after de-duplication and the vague-value filter),
  part of the stored text, with no separate count column. "+N" and the cut to two names are withdrawn; a count in
  front of the label ("4 Penampil") was rejected by the owner. The label is never repeated (owner answer Q6): a
  single value that already starts with its label is written as it is ("Hadiah Rp5 juta"); in a list of two or more,
  a label word at the start of a value is dropped ("Hadiah (2): Rp5 juta, Rp3 juta").
- Stories affected: 1.3b (Reusable EventCard), Epic 1.i1 primitives (status/nearby badge 1.i1i, date box
  1.i1k), 1.6a (detail view), 4.2 / 10.6 (re-extract preview shows the composed highlight).
- New stories: 11.7 (composer, stored card highlight, recompute step), 11.14 (card and detail list).
- ADs: new **AD-59 (Highlight is composed in code by one shared function; card stored, detail at read time)**;
  **AD-17** (the stored column is a plain list field, no per-row resolver).

**C5. One post-extraction text call (location keywords, tiers, core event name).**
- PRD: 3.8 gains a request budget per post (section 3.4). 4.4: **`ticketPrice` stays an output of the main
  extraction for every new event** (on poster-only posts it is the only record of the price the tier call sees);
  the tier options are stored **beside** it, never instead of it. Tiers only when two distinct amounts exist
  **inside one event**; `fromPrice` = lowest positive PUBLIC amount; audience enum `PUBLIC, STUDENT, CHILD,
  MEMBER, LOCAL_RESIDENT, GROUP, OTHER`. Tiers belong to the **event**; registration buttons carry no price
  (decision 10, option C; an optional reference from a button to a tier is carved out).
- **Tier call input (input section 11, option A):** the tier part (merged call for one event, separate per-event
  call for several) reads the caption **and the `ticketPrice` string the main extraction returned for each
  event** in the same run. The images variant (option B) is **not built**; the release gate measures the case
  that would trigger it (C9). Multi-event posts with one fee for many events stay weak (the strings repeat the
  extraction's per-event inconsistency); the gate counts events with a missing or extra tier. A rule "a price
  stated for all events is GENERAL" is untested and carved out.
- **Core event name (decided 2026-11-26):** the same call returns `coreEventName` (a stand-alone name without
  activity words) and `activityType` per event, at no extra request. Used only as matching input (Story 11.10),
  never displayed. Measured only as a separate call; it is measured inside the merged call before release (11.8,
  11.2).
- **Low confidence (decision 9):** a tier option whose amount is not found in the caption text came from the
  poster through the price string; code sets `lowConfidence` on it.
- **Stepped path (decision 6, option A):** no tier call on the stepped (cursor) path; location stays per step;
  the limit is documented in AD-60 (findings 11.18).
- Stories affected: Story 0.35 (Fix ticketPrice "from" label pairing for free-text prices; not in `epics.md`:
  sprint-status key `0-35-fix-ticketprice-from-label-pairing-for-free-text-prices`, spec
  `implementation-artifacts/0-35-fix-ticketprice-from-label-pairing-for-free-text-prices.md`): stays in force for
  the displayed `ticketPrice` string; `fromPrice` from tiers is shown beside it only where tiers exist (no
  supersession), the location-keywords quick-dev spec (`implementation-artifacts/spec-location-keywords-extraction.md`)
  and its deferred findings row (backlog FIND for the keywords call: replayed cursor step repeats the paid call).
- New stories: 11.8 (post-extraction call), 12.7 (show the event's tiers).
- ADs: new **AD-60 (Post-extraction call shape, inputs and request budget per post)**; amends **AD-30 Rule 5**
  ("one Gemini call per post" describes the extraction call only), **AD-52 (Retry policy)** for a best-effort
  second call, **AD-46 / AD-51 (Stepped extraction, bounded work)**: no tier call on the stepped path.

**C6. Dates for events without an event-day row.**
- PRD: 3.1 Default View and Event Status Badge: the card date comes from rows flagged for display. Owner rules,
  all applied by `computeDisplayFlags` to all rows of one event (input section 9, decisions 2 and 12):
  1. A row with stage `event` counts. `other` counts only when all rows of the event are `other`.
  2. COMPETITION without a competition day: its `submission` row counts.
  3. Registration window with no event day (competition, anthology open call): the `registration` row is the
     dummy date, shown at the **end** of registration.
  4. Race pack without a main event (after the dedup of Story 11.10): end of registration, else the pickup row.
  5. Any other event with no counting row (decision 2, option A): every non-counting row is flagged; the query
     picks the nearest upcoming one, the card labels it by its stage, and the event leaves the list after its
     last phase.
  6. A ticket-sale row with one date is the event day (title rule v2 fix).
  A dummy date always carries a label so the card never claims an event day (decision 5: card "Daftar s/d 6 Nov",
  "Pengumuman 17 Okt", "Ambil kit 13 Nov", "Submit s/d 12 Nov"; detail "Pendaftaran sampai 6 November 2026").
  Dummy dates (owner answer Q2, option A): a flagged row is a dummy date when its stage is neither `event` nor
  `other`; the card label comes from the stage. A competition `submission` row keeps its real start and end dates
  (it counts as the event date) and shows "Submit s/d"; only a flagged `registration` row uses its end date as the
  start date. Title rule v2 is the first pass for old rows and a
  fallback, with the three fixes (Story 11.5).
- **Several schedules or several main schedules in one event:** every row carries its own flag; the list ORDER BY
  picks the nearest upcoming flagged row (then main, then earliest), so an event with two `event` rows on
  different dates shows the next one and leaves the list only after its last flagged row ends. No date copy lives
  on the `events` row.
- Matching rule for **new** race-pack posts (revision 2): a race-pack collection is first deduplicated into its
  main event through the AD-30 Rule 7 scoring, never a name key; `activityType = RACE_PACK_COLLECTION` is the
  race-pack signal and `coreEventName` feeds the name similarity (C5). If no main event exists it is shown as it
  is, with the dummy date and its label. The same matcher serves the stored race-pack events in the backfill.
- Stories affected: 0.i5d (Temporal filter in the FilterHub; AD-20), `selectDisplaySchedule` and the
  `Query.events` ORDER BY subqueries (list query; AD-17, AD-20), 1.i1i (status badge), 3.6v (Match new posts to
  existing events and enrich them in place), backlog IDEA-261121-tvh (Do not auto-promote a repost that matches a
  multi-event sibling; related, not in scope).
- New stories: 11.5 (title rule v2), 11.10 (race-pack posts), 11.12 (healing sweep), 11.13 (flags on write and
  field map).
- ADs: **AD-58**, amends **AD-20 (Temporal filter `!ended`)** and **AD-17 (list field map)**.

**C7. Online-only locations are not geocoded.**
- PRD: 4.3 LocationDetails / 4.4 Schedule: an online-only location has no coordinates and no map pin; it never
  falls back to the account's default location; a hybrid text is still geocoded. Resolution value `online` (new
  member of the TypeScript `LocationResolution` type; column is text, no migration).
- **Decided (decision 1, option A):** the existing wrong pins are cleared after Story 11.9 ships, by Story
  11.16's script (`--dry-run`, `--apply`, rollback copy), with the owner's go-ahead and the writer role. **Active
  schedules only (input 15):** the 72 counted on 2026-11-24 include past ones, which stay as they are; the dry run
  counts the active ones.
- Stories affected: 0.i7a-0.i7c (Confidence-aware Geoapify resolution; the map link gate must also hide on
  `online`), 1.6e (detail schedule location link).
- New stories: 11.9; existing-row cleanup in 11.16 (active only). The other wrong-pin causes are C11.
- ADs: amends **AD-14 (Geoapify confidence propagation)** with the `online` resolution.

**C8. Own cover per event on multi-event carousels: deferred (decision 4, option A).**
- Not built in Epic 11; Story 11.17 is not part of the epic. Tracked as backlog `IDEA-261124-8jo` (Give each
  event its own cover slide on multi-event carousels). The deterministic OCR alternative was measured and is not
  good enough (findings 11.20); recorded as skipped `IDEA-261124-dtk`. The slide map stays a separate call when
  the cover is built (decision 7); a merge POC runs only then (`IDEA-261124-f6n`).
- The rule notes for later (bytes owned by the post under AD-30 Rule 1; consent gate **AD-12 Rule 7** and face
  blur **AD-28** on every copied slide; AD-13 for the slide-map call) move to the backlog row; no AD amendment in
  this course.

**C9. Release gate (replay) for any extraction prompt or schema change.**
- PRD: section 5 "AI Extraction Quality" gains the gate (interleaved A/B on real posts with images, 6+ runs,
  events and schedules counted against production; a fresh never-read caption set per release, labels written
  before the composer output is read; first-look precision is the number that counts, judged relative to the
  previous release on that fresh set (A4); zero output-cap hits).
- **New measurements (revision 3):**
  1. **Option B trigger** (input section 11): on a fresh sample of posts read by eye, count ticket prices visible
     on the images that the main extraction did not return. Per release 40 fresh posts are read by eye (Claude
     first; only doubtful posts go to the owner); option B is built when two or more such prices are found; one is
     reported and watched; a price label on a single product is not a ticket price (owner answer Q4). First
     reading 2026-11-26: 0 of 40 (findings 11.22), so option B is not built.
  2. **Multi-event tiers:** count events with a missing or an extra tier on multi-event posts.
  3. **Core event name inside the merged call** (Story 11.8): same-series pairs found and activity type
     stability compared with the separate-call POC figures (88% pairs, precision 1.00, 29 of 30 repeats).
  4. **Peak memory** of the AI-processor Lambda on the replay, with and without QR decoding, for the Story 12.2
     gate (at most +10% and below 80% of the configured memory; owner answer Q3).
- Stories affected: every story that changes the prompt or schema (11.4 Stage on write, 11.6 Facts, 11.8
  Post-extraction call, 12.2 QR); the extraction accuracy eval
  (`docs/infrastructure/extraction-accuracy-eval.md`, `packages/domain/src/extraction-eval/`).
- New stories: 11.1 (prompt seam), 11.2 (gate).
- ADs: new **AD-61 (Replay release gate for extraction changes)**.

**C10. Backfill of active events (after C2-C7 ship).**
- PRD: none beyond the fields above; a one-off data operation (results into the new columns; moderator edits never
  overwritten).
- **Scope (owner decision, input 15): every backfill covers active events only**, meaning still running or
  upcoming: the schedule's end date, else its start date, is not past in its own time zone. An event is active when
  at least one of its schedules is; its rows are then all written, because `computeDisplayFlags` reads every row of
  the event (A14). Past events stay as they are. This replaces revision 5's "layer 1 for all events" and also limits
  the recompute sweep of Story 11.12, the re-geocode of Story 11.21 and the highlight recompute step of Story 11.7
  (owner answer Q7).
- Layers: (1) code only, for active events: stage by rule v2 with the C6 fixes, display and main flags through
  `computeDisplayFlags`, tiers from the stored "NAME: Rp..." string, performer highlight and the stored card
  highlight, a first `core_event_name` and `activity_type` by a code rule (about 73% of same-series pairs on the
  test set, an optimistic figure because the rule was written after seeing those names); (2) caption re-read for
  the 414 of 809 upcoming/ongoing events with a caption or the 129 with only an image, run in a **local Claude
  session, not Gemini**, validated by the same schema and code; it also fills `core_event_name` and
  `activity_type` for the events the code rule left empty, and its tier input is the caption and the stored price
  string (which can come from another merged post: already what the site shows, so no new error, but not proof
  that this post states it); 266 events get layer 1 only; (3) a script with `--dry-run`, `--apply` and a rollback
  copy, run only with the owner's go-ahead and the writer credential. Race-pack events merge through the dedup
  scoring (the 11.10 matcher); three stored duplicate events of one project go to the dedup flow (if still
  active). Online pins: Story 11.16; never-attempted pins: Story 11.21.
- Stories affected: 3.6v / 3.6w (merge), 3.4o (curator caption nulling) and the 30-day caption blanking (fewer
  captions over time; run layer 2 early after the code ships).
- New stories: 11.11 (layer 1), 11.15 (layer 2), 11.16 (online pins), 11.21 (never-attempted pins); all active
  events only.
- ADs: **AD-30 Rule 7 and Rule 9** (race-pack merge, moderator edits preserved); **AD-45 (CI bridge for a
  credential-less agent)** does not cover writes of this kind: the apply step stays with the owner.

**C11. Wrong pins beyond online locations (revision 6; input 15, handoff 11 and 13E; replaces A9).**
- Owner routing: the wrong-coordinates defect of handoff 10 goes into this course (handoff 11, 2026-11-21);
  confirmed 2026-11-26 (input 15). Covers backlog `FIND-261124-axb`.
- **Silent account-default location (code and data), first, next to Story 11.9.** Code today
  (`resolve-account-and-locations.ts`, read only): a schedule with no location text of its own and no event-level
  text is geocoded from the account's `default_location` address, for every account, and nothing records that (the
  code comment says inherited coordinates carry no `location_resolution`). The account used is `posts.account_id`
  (`message.accountId`), which the code itself notes is not reliably the publisher; since PR #269 a post can have
  several scraping accounts. Account kinds exist: `social_media_account_profiles.account_type`
  (`ORGANIZER_VENUE_EVENT | PERSONAL | CURATOR_GUIDE`, nullable) with `account_type_status`
  (`CONFIRMED | AWAITING_APPROVAL`), classified per PRD 3.16. **Decided (owner answer Q8, 2026-11-27):** the
  account default location is inherited only when the post's `PUBLISHER` account (else `posts.account_id`) is
  `ORGANIZER_VENUE_EVENT` with status `CONFIRMED`; every other case (`AWAITING_APPROVAL`, no account type,
  `PERSONAL`, `CURATOR_GUIDE`) gets no pin; an inherited pin is marked with the new resolution `account_default`.
  Production read-only count of 2026-11-27 (active pins without location text, account taken from the event's
  earliest linked post, approximate): organizer or venue confirmed 167 (kept), curator confirmed 203 and no account
  type 59 (no pin under the rule). Story 11.19.
- **City check on the geocoding result (code): investigate first.** The Semarang case (keywords naming the venue,
  the city and the province resolved by the first keyword step to a point about 120 km away) has no verified
  cause. Story 11.20 investigates and adds a check only if the cause supports it.
- **Re-geocode never-attempted pins (data), next to Story 11.16, active schedules only:** 486 such pins on
  2026-11-26 (289 with text, 197 without); writer go-ahead needed. Story 11.21. **Decided (owner answer Q9):** a
  re-geocode that finds nothing clears the pin; schedules without text follow the Q8 rule; the dry run shows the
  counts per outcome to the owner before apply.
- PRD: 3.7 Default Location (inheritance rule and source mark), 4.3 (`account_default` resolution). ADs: amends
  **AD-14** (`account_default`, the inheritance rule, a city check if 11.20 adds one).

**C12. Time filter "next 7 days" (revision 6; input 15; replaces A8 for the time filter only).**
- A time dropdown `Kapan saja | 7 hari ke depan | Hari ini` (EN `Anytime | Next 7 days | Today`) replaces the
  `Hari ini | Mendatang | Semua` toggle on the home, feed, favorites and account pages. The label is not "Minggu
  ini": `THIS_WEEK` means Monday to Sunday in `buildEventsQueryCondition.ts` (checked).
- Range: today to today + 6 days; schedules that already ended today are excluded, as the Today filter does; no new
  SQL (the same `overlaps` and `notEnded` conditions). The old value `UPCOMING` stays accepted for old links and
  stored filters: an old `?temporal=UPCOMING` link is read as "Kapan saja" and the URL is rewritten without a
  history entry; GraphQL, the domain and saved AI filters keep `UPCOMING` with its meaning (owner answer Q11).
  BUG-097 (these filters use the UTC date) is fixed in the same story: the viewer's day comes from `users.timezone`
  when set, else the browser's IANA time zone, else `Asia/Jakarta`; no new SQL beyond what BUG-097 needs, reusing
  `schedule_past_cutoff_date` (owner answer Q12).
- Independent of every other story; it uses the same `overlaps` field, so Story 11.13 (field map on the display
  columns) applies to it automatically.
- Only the time filter: the scrolling facet row, chevrons, the AI button on the search row, icon buttons and the
  collapse motion stay in backlog `IDEA-261124-15a`.
- Stories affected: 0.i5d (Temporal filter in the FilterHub; sprint-status `review`), BUG-097. New story: 11.22.
  ADs: amends **AD-20** (new value, viewer's date). PRD: 3.12 and the `TemporalFilter` enum.

### 3.2 Epics touched

| Epic | Effect |
|---|---|
| Epic 3 (Social Media Event Integration), in progress | Notes on 3.6i, 3.6j, 3.6l, 3.6p, 3.6s, 3.6v, 3.6w; no new stories here (they go to Epics 11 and 12). |
| Epic 1 (Core App and Event Discovery) and Epic 1.i1 (One card primitive), in progress | Card redesign (11.14) supersedes the date box and footer of 1.3b/1.i1k; detail stories 1.6/1.6a/1.6e/1.6f gain the bar (12.5) and the highlight list (11.14). Do not fork the card; go through EVENT-CARD-DESIGN.md. |
| Epic 0.i7 (Confidence-aware Geoapify resolution), in progress | `online` resolution must be honoured by 0.i7c's map-link gate; the new `account_default` resolution (11.19), a possible city check (11.20) and the re-geocode of active never-attempted pins (11.21) build on its ladder. |
| Sweep 0.i5 (Temporal filter, 0.i5d), in review | The Today / Upcoming / All toggle becomes the time dropdown of Story 11.22; `UPCOMING` stays accepted. |
| Story 0.37 (Extract and display event links), in review, no epic section | Its links render through `/go/` (Story 12.4); the public read stops returning the full URL. |
| Epic 4 (Data Quality and Moderation) | 4.1/4.1b correction form writes a stage and calls `computeDisplayFlags` and the composer; 4.2 preview shows composed highlight and options. |
| Epic 9 (AI Prompt Filter v1.1), backlog | `isFree` column available later; no change now. |
| Epic 10 (Background vendor jobs), in progress | 10.6/10.6a re-extract preview must run the new post-extraction call and composer and keep AD-40's write-free rule; re-extract apply calls `computeDisplayFlags`. |
| **Epic 11 (new): Extraction and honest dates** | Section 5.1. |
| **Epic 12 (new): Registration, CTA bar and prices** | Section 5.2. |

### 3.3 Technical impact
- New columns on `schedules`: `stage` (NOT NULL, default `event`), `stage_source` (assumption A10),
  `is_display boolean NOT NULL DEFAULT true`, and three generated columns `display_start_date`,
  `display_end_date`, `display_is_dummy` (section 3.5); partial index `schedule_display_date_idx`.
- New columns on `events`: facts (`prizes`, `promos`, `inclusions`, `is_free`), `highlight` (`text`, no length
  limit) and `highlight_rules_version`, `core_event_name`, `activity_type`; tiers (table or jsonb, AD-60) with
  `low_confidence`; `fromPrice` derived. `schedules.ticket_price` stays and stays written for new events.
- New table `registration_options` (AD-55), with no price column.
- Steps on an existing scheduled sweep (no new Lambda, queue or rule expected): the display-flag healing step
  (11.12), the highlight recompute step (11.7, or a script; AD-59 decides), the phone purge (12.9). Which sweep
  hosts them is an AD-58 choice.
- New library: `zxing-wasm` (about 2 MB with WASM embedded) in the AI-processor Lambda bundle (decision 11), decoding
  a downscaled copy, shipped last behind the memory gate; `libphonenumber-js` for slice 2.
- New first-party link endpoint `/go/{opaqueId}` (Story 12.4): one more hop on every registration click and on
  every click on an event link of Story 0.37, and a new single point of failure for those clicks (section 4.3);
  placement (web route or API Lambda) is an architecture decision; an event link's opaque id is derived at read
  time, with no stored id and no data write (owner answer Q10).
- `LocationResolution` gains `account_default` (11.19) beside `online` (11.9); the column is text, no migration.
- `TemporalFilter` gains `NEXT_7_DAYS` in the domain enum, the GraphQL enum (`EventFilterInput`, `EventFilter`), the
  UI type and the `?temporal=` parser (11.22); no new SQL for the range.
- New pure domain functions in `packages/domain`: stage guard, `computeDisplayFlags` (display and main flags),
  title rule v2 (Story 11.5), `composeHighlight` (card and detail modes), `decideTiersPerEvent`, a core-name code
  rule (backfill), `isOnlineOnlyLocation` (next to `GENERIC_KEYWORDS`), `detectRegistrationPhones`,
  `scrubContactData`, `resolveEventActions`, `isAllowedDestination` (scheme allow-list and blocklist for `/go/`).
  All 100% unit tested (PR template rule).
- `Query.events` is the hottest endpoint: the list query keeps its shape; the date subqueries read the `display_*`
  columns through the AD-17 field map; registrations come from a separate **uncached** query (cache leak in
  `get-event-by-slug-cached.ts`).

### 3.4 Requests per post (Gemini)

| Post shape | Requests today | Requests under this plan | Share of posts |
|---|---|---|---|
| One event | 2 (extraction, location keywords) | **2** (extraction, merged location + tier + core-name call) | ~96% |
| Two or more events | 2 | **3** (extraction, location + core-name call, per-event tier call) | ~4% |
| Stepped (cursor) path, off by default | unchanged | **unchanged** (no tier call: decision 6) | n/a |

The cover per event (C8) is deferred, so no slide-map request is planned. QR decoding, phone detection, the
composer, the stage guard and `computeDisplayFlags` cost **0** requests (code). Backfill layer 2 costs **0** Gemini
requests (local Claude session). Average: 0.96 x 2 + 0.04 x 3 = **2.04** requests per post. Tokens: the extraction
call rises by about +770 prompt and +76 output tokens per post (+11% and +19%); reading the price strings adds
about +114 prompt and +153 output tokens to the tier part (findings 11.22: 802/66 caption only, 916/219 with
strings); the core name adds output tokens not yet measured inside the merged call (gate, C9). Where the core name
sits on a multi-event post (location call or tier call) is an AD-60 choice; it adds no request either way. The PRD
3.8 capacity formula must be re-run with these numbers.

### 3.5 Display flag and rollout (revision 3, input section 9; replaces revision 2's three-step reader switch)

**Columns.** `schedules.is_display boolean NOT NULL DEFAULT true`, written only by `computeDisplayFlags`.
Generated columns (Postgres derives them from the row itself, so they cannot go stale against the real dates;
column names are the current `event_start_date` / `event_end_date`):
- `display_start_date` = the real `event_start_date`; for a flagged `registration` row the real end of the window
  (`COALESCE(event_end_date, event_start_date)`); NULL when `is_display` is false.
- `display_end_date` = the real `event_end_date`; NULL for a flagged `registration` row (a one-day dummy) and when
  `is_display` is false.
- `display_is_dummy` = flagged and stage neither `event` nor `other` (owner answer Q2, option A; replaces input
  section 9's "stage `registration`" only): flagged `registration`, `submission`, `announcement` and `preparation`
  rows are dummy dates and the card label comes from the stage. Only a flagged `registration` row moves its end
  date into `display_start_date`; a competition `submission` row keeps its real dates and shows "Submit s/d".
Whether the time columns need display twins is checked by Story 11.13 against the BUG-096 per-schedule timezone
cutoff (migration 0090), which itself is untouched.

**List query.** Its shape does not change: `overlaps`, `notEnded` and the three ORDER BY subqueries (next
upcoming, main, earliest) read `display_start_date` / `display_end_date` through the AD-17 field-map descriptor
(`startCol`, `endCol`) with the condition `is_display`; the partial index
`schedule_display_date_idx ON schedules (event_id, COALESCE(display_end_date, display_start_date), display_start_date) WHERE is_display`
carries them. No copy of a date lives on `events`.

**Who keeps the flag.** One domain function, called by every schedule write path: extraction ingestion, manual
correction, merge, set primary post, re-extract apply, backfill, admin scripts; guarded by ratchet 11.z. A step of
an existing scheduled sweep recomputes the flags of every **active** event (input 15), repairs those that differ
and logs the number repaired (non-zero = some write path forgot the function) (Story 11.12). Past events are not
swept. No database trigger (it would duplicate
the rules in plpgsql; skipped `IDEA-261124-jz4`).

| Step | What ships or runs | Effect on the list | Stories |
|---|---|---|---|
| (a) | Migration: `stage` default `event`, `stage_source` default `default`, `is_display` default true, generated `display_*` columns, partial index | none: every row flagged, `display_*` equal the real dates | 11.3 |
| (b) | Readers point at `display_*`; every write path calls `computeDisplayFlags`; extraction writes `stage` | new events honest from the start; old rows unchanged | 11.4, 11.13 |
| (c) | Layer-1 backfill sets stages (title rule v2) and recomputes flags, active events only | registration windows of active events stop winning the date; past events unchanged | 11.11 |
| (d) | Healing step in the scheduled sweep (active events); read-only consistency check | drift repaired and counted on active events | 11.12 |

Readers can switch at once (step b), because the defaults keep today's behaviour; there is no reader gate. Story
11.12 is a consistency check, not a switch.

---

## 4. Detailed change proposals (old -> new)

### 4.1 PRD (`prds/festgrid-prd-2026-07-10-2047/prd.md`), to be applied by `bmad-prd` (update)

1. **New section 3.19 "Event registration and call to action"** (after 3.18).
   OLD: none.
   NEW: owner ask 1-8 and D1-D12 (D5, D6 and D7 as amended): registration options separate from schedules
   (links, phones, QR-decoded links); bottom bar below `lg`, sticky side card at `lg` and up, modal sticky footer in
   the `@modal` route (D11); one primary CTA + up to three icons + kebab; state table "first match wins" (handoff
   4); multi-option sheet; WhatsApp + phone icon, `tel:` only on touch, "Copy number" on desktop; message preview
   before opening; trust line; Share; CTA label per event type with fallback "Register" (D8); multi-event posts
   attach a phone only when the post yields one event or the option names its event (D4). A destination that
   comes from organizer or scraped data is never put in the page; the page links to a first-party endpoint that
   checks it and redirects; the destination host stays visible; a phone number is shown only when the user acts.
   Buttons carry no price; the event's tiers and "from" price are shown beside them (decision 10). An option read
   from an image carries a low-confidence mark (decision 9). QR-decoded links follow the memory gate of decision 11.
   The same endpoint serves the event's other organizer links (ticketing, RSVP, link-in-bio: Story 0.37); every link
   and CTA of the event detail that comes from organizer or scraped data goes through it (owner, input 14).
   Rationale: owner ask; slicing per D3.
2. **3.7 multi-event grouping rule (line ~93).**
   OLD: "Registration and sign-up windows are schedules of the event they belong to, never separate events."
   NEW: keep the sentence; add: "Each schedule carries a `stage`; a registration window is a schedule row with
   `stage = registration`. How to register (links, phones) is held in registration options (3.19); prices are the
   event's tiers." (decision 8).
3. **3.1 Event Discovery: card highlight and honest dates.** Add the highlight rules of C4 (stored card highlight,
   detail list from the same function, decision 3) and the date rules of C6 (the six rules, several schedules,
   `other` rule of decision 12, decision 2's next-phase rule). The card highlight is the first detail item stored
   whole, with no length limit; the card ends it with an ellipsis when it does not fit. A list item of two or more
   values reads "<Label> (<count>): <every value>" ("Penampil (4): Band A, Band B, Band C, Band D"); one value and
   single values have no count; no "+N" (owner answer Q5); the label is never repeated (Q6). A dummy date is a flagged
   row whose stage is neither `event` nor `other`. Dummy-date labels (decision 5): card "Daftar s/d
   6 Nov", "Pengumuman 17 Okt", "Ambil kit 13 Nov", "Submit s/d 12 Nov"; detail "Pendaftaran sampai 6 November
   2026" (EN: "Register by 6 Nov", full sentence on the detail).
4. **3.8 Gemini API management.** Add the request budget table of section 3.4, the rule that the post-extraction
   call is best effort (location, tiers and core name validated separately), its inputs (caption and the
   extraction's per-event price strings) and that the stepped path has no tier call.
5. **3.16 Data minimization and 5 Security.**
   OLD: raw private contact is discarded and never stored.
   NEW: a phone published by the organizer for registration is stored only in the registration option, only as
   E.164, never with a person's name; deleted at event end + 1 day and on takedown, permanent delete and a
   re-extract that no longer finds it; raw captions blanked 30 days after expiry; free text passes the contact
   scrub. Online-only locations are not geocoded.
6. **4.1 EventInfo.** Add `prizes`, `promos`, `inclusions`, `isFree` (bounded shapes), `highlight` (card, stored,
   the first detail item stored whole, no length limit, with a rules version; a list item carries its count in
   parentheses after the label, part of the text, no count field; the detail list is composed at read
   time), `fromPrice` (derived
   from the event's tiers), `coreEventName` and `activityType` (matching only, never displayed); note on
   `contactInfo`/`hasPrivateContact` (D1).
7. **4.3 LocationDetails / 4.4 Schedule.**
   OLD (revision 2 proposal): "`ticketPrice` legacy for old rows only (D5)".
   NEW: add `stage` (required; `event | registration | submission | announcement | preparation | other`);
   `isMainSchedule` and `isDisplay` derived in code; `performers` also from speaker lines; **`ticketPrice` stays an
   extraction output for every schedule, new and old; price tiers are stored beside it on the event (4.23)**;
   online-only resolution `online`.
8. **New 4.22 RegistrationOption** (no price field) and **4.23 PriceTier** (belongs to the event: label, kind
   `CATEGORY | TIME_WINDOW | OTHER`, audience enum, conditions <= 80 chars, price, optional dates, event,
   `lowConfidence`).
9. **5 AI Extraction Quality.** Add the C9 replay gate with the A4 pass criteria (accepted by the owner
   2026-11-26), the four revision 3 measurements, the option B threshold (two or more missed image prices in 40
   posts read by eye) and the Story 12.2 memory limit. **5 Security:** add the `/go/` rule (no open redirect, scheme allow-list, blocklist, kill switch,
   phone revealed on action with a per-IP rate limit).
10. **Frontmatter `updated`** and a change note referencing this proposal.
11. **3.7 Default Location for Subscriptions (revision 6, C11).**
   OLD: "If the AI agent does not find an explicit location in a post, it will use this default location for the
   event."
   NEW: "If the AI agent does not find an explicit location in a post, the schedule takes this default location only
   when the post's publisher account (else the account the post was collected from) is a confirmed organizer,
   venue or event account (Section 3.16 classification: `ORGANIZER_VENUE_EVENT` with status `CONFIRMED`), and the
   schedule records that its location came from the account default. For curator, personal, unclassified and
   not-yet-confirmed accounts the schedule has no map pin." (Owner answer Q8.) The 3.15 Venue Type Source sentence ("included whenever a
   schedule inherits its account's Default Location") stays true for the inheriting case.
12. **3.12 / 3.15 temporal filter and the `TemporalFilter` enum (revision 6, C12).** The manual time control is a
   dropdown Anytime | Next 7 days | Today (ID Kapan saja | 7 hari ke depan | Hari ini); Next 7 days = today to
   today + 6, schedules already ended excluded; dates use the viewer's day, not UTC (BUG-097): `users.timezone`
   when set, else the browser's IANA time zone, else `Asia/Jakarta` (owner answer Q12); the enum gains
   `NEXT_7_DAYS` and keeps `UPCOMING` for saved AI filters and the API with its meaning; an old `?temporal=UPCOMING`
   link opens as Anytime (owner answer Q11). Line ~307 "the Today/Upcoming
   toggle stay live" becomes "the time dropdown stays live". The AI filter vocabulary is unchanged.
13. **Data backfills (revision 6, C10).** Add to 3.7 or 5: "Backfills, re-geocoding and recompute sweeps touch
   active events only (still running or upcoming in the schedule's own time zone); past events are left as they
   are, including their pins and their stored card highlight" (the highlight recompute step included: owner answer
   Q7).

### 4.2 Epics and stories (`epics.md`), to be applied after approval by correct-course edits, not by `bmad-create-epics-and-stories`

- **Add an "Epic 11: Extraction and honest dates" section and an "Epic 12: Registration, CTA bar and prices"
  section** with the stories of sections 5.1 and 5.2 (titles, one-line goals and the acceptance criteria of
  section 5; full ACs come from `bmad-create-story` after `bmad-architecture`).
- **Notes on existing stories** (one line each, no AC rewrite of shipped work):
  - Story 3.6s (Multi-event extraction with grouping rules): "Stage per schedule row added by Story 11.4;
    grouping rule (4) unchanged; `ticketPrice` per event stays in the output."
  - Story 3.6i (Classify and discard private contact): "Registration phones are kept per D1/D2 by Story 12.8;
    every other private contact is still discarded."
  - Story 3.6l (Single-request carousel extraction): "QR decode (12.2) reads the same slides on a downscaled copy;
    the single-request rule holds for extraction."
  - Story 3.6v (Match new posts to existing events and enrich them in place): "A new race-pack post is matched into
    its main event by the dedup scoring first, with `coreEventName` and `activityType` as inputs, never a name key
    (Story 11.10); registration options and tiers are unioned on enrich; flags recomputed."
  - Story 3.6w (Let moderators merge duplicate events): "Registration options and tiers are unioned on merge;
    `computeDisplayFlags` and the composer run on the merged event; moderator edits never overwritten."
  - Story 1.3b (Reusable EventCard) and 1.i1k (Date box chrome): "Card layout replaced by Story 11.14 through
    EVENT-CARD-DESIGN.md."
  - Story 4.1 (Manual correction): "Writes a stage and its stage source, then calls `computeDisplayFlags` and the
    composer (11.13, 11.7)."
  - Story 0.i7c (Map link gate): "Also hidden for resolution `online` (11.9)."
  - Story 0.i5d (Add the temporal filter to the FilterHub): "The toggle is replaced by the time dropdown of Story
    11.22 (Anytime, Next 7 days, Today); `UPCOMING` stays accepted for old links and stored filters."
- Story 0.37 (Extract and display event links) has **no `epics.md` section** (sprint-status `review`); its move onto
  `/go/` is an acceptance criterion of Story 12.4, recorded here and in the Epic 12 section.
- Story 0.35 (Fix ticketPrice "from" label pairing for free-text prices) has **no `epics.md` section**; its
  relation to `fromPrice` (shown beside `ticketPrice` where tiers exist; 0.35 stays in force) is recorded in this
  proposal only.

### 4.3 Architecture (`festgrid-architecture-spine.md`), to be written by `bmad-architecture`

New ADs (the spine ends at AD-54, checked 2026-11-26; `bmad-architecture` assigns the final numbers):
- **AD-55 Registration options**: table shape (no price column), RLS, AD-8 hard-delete exception, retention sweep
  and read predicate, uncached read path, exclusion from meta/share/analytics, `lowConfidence` for an option read
  from an image (decision 9).
- **AD-56 Phone detector and contact scrub**: deterministic, mobile only, cue proximity, the phone column is the
  only place a number lives.
- **AD-57 QR decode step and link trust**: decode in the AI-processor Lambda on a downscaled copy, redirector
  policy, pairing a code with its label, payment payload never a Register button, `sharedLink` dedup clue; the
  memory gate of decision 11 (cause of the out-of-memory since 2026-11-20 understood; replay peak with decoding at
  most 10% above the same replay without it and below 80% of the configured memory) before the decode step ships.
- **AD-58 Stage, display flag and generated display dates**: required stage + code guard; `computeDisplayFlags`
  as the only writer of `is_display` and the derived main flag, with the six rules of C6 and the `other` rule;
  generated `display_start_date`, `display_end_date`, `display_is_dummy` (flagged and stage neither `event` nor
  `other`; only a flagged `registration` row uses its end date as the start date); partial index
  `schedule_display_date_idx`; the write paths that must call it (ratchet 11.z); the healing step on an existing
  scheduled sweep (which sweep: hourly or 5-minute, an AD choice), logging the repaired count; no trigger;
  `stage_source`; correct for several main schedules in one event; the healing step covers active events only
  (input 15).

**Owner rule for the event detail, as amendments to the proposed AD-55 and AD-57 (revision 2).** The spine
has no rule on outbound links that this contradicts (checked: AD-54's rule on `javascript:` URLs in notification
templates and the AD-16/AD-35 canonical-slug redirects are about other things), so the reviewer's analysis is adopted:
- **AD-55 amendment (read shape).** The registration read (Story 12.3) returns only safe descriptors: option id
  (opaque), label, type (`LINK | WHATSAPP | PHONE | FILE | CONTACT`), destination host, masked phone (for example
  `+62 8** **** 12`). It never returns the full URL or the phone number. The number is returned only when the user
  acts: a POST (GraphQL mutation or JSON route, declared public under AD-7) with a per-IP rate limit, following
  the `takeAlertEmailBudget` precedent; desktop shows "Copy number", touch navigates to `tel:`.
- **AD-57 amendment (link endpoint).** Every action goes through a first-party link
  `<a href="/go/{opaqueId}" target="_blank" rel="noopener noreferrer">` (an option id, or an event-link id since
  revision 6); the endpoint checks and answers
  **302**. Never `window.open` after an async fetch (popup blockers drop it because the user gesture is gone).
  The endpoint accepts only an opaque option id, never a URL (no open redirect). Checks on every request:
  scheme allow-list (`https`, `wa.me` over https, `tel`); a host blocklist that applies at once to old events
  too; a kill switch per option; an unknown, expired or blocked id answers a first-party page, not a redirect.
  Click logging is by POST, or GET logging is accepted as noisy (link prefetchers trigger GET).
- **Scope.** Destinations that come from organizer or scraped data: registration links, QR-derived links,
  WhatsApp, phone, files and brochures, contacts, **and the event links of Story 0.37 (`events.links`)** (owner,
  input 14). Not first-party navigation (calendar, share, map link). **Event-link ids (owner answer Q10):** derived
  at read time from the event and the link, resolved by the endpoint from `events.links`; no stored id and no data
  write, so every event works, past ones included. The public `Event.links` stops returning `url`; the correction
  dialog and the re-extract preview read full URLs through a gated query.
- **UI.** The destination host stays visible next to the action (trust line).
- **Costs and limits.** The endpoint is a new single point of failure for every registration click and adds
  one round trip of latency. Validation on write (AD-57 link trust) stays the main control; the endpoint adds the
  blocklist, the kill switch and the gate on phone numbers.
- Stories: 12.3 (read shape), 12.4 (endpoint and the existing event links), 12.10 (phone on action), 12.z
  (ratchet).

- **AD-59 Highlight composer** (decision 3, hybrid): one function `composeHighlight(facts, mode)`; `detail` mode
  returns the ordered list from every ladder rung with content, read time, no limit; `card` mode is the first item
  of that list, whole (no length limit, no skip, no cut; degrees after the first comma of a name removed; no
  buy-get cut), and is stored in `events.highlight` with `highlight_rules_version`; a list item of two or more
  values is "<Label> (<count>): <every value>", one value or a single value has no count, no "+N" (owner answer
  Q5), a label word at the start of a list value is dropped (Q6); the count lives only in the text, a format change bumps `highlight_rules_version` and the recompute step
  rewrites the stored rows;
  every write path (extraction, manual correction, merge, re-extract apply, backfill) computes it; a recompute step
  (no LLM) refreshes rows of **active** events with an older version, past events keep their stored text (owner
  answer Q7); the re-extract preview uses the same function.
- **AD-60 Post-extraction call**: merged call for one event, separate per-event tier call for several; inputs =
  caption and the extraction's per-event `ticketPrice` strings (option A; images not sent); outputs = location
  keywords, priced options, `coreEventName`, `activityType`; `ticketPrice` stays an output of the extraction;
  tiers belong to the event, buttons carry no price (decision 10); `lowConfidence` set by code when an amount is
  not in the caption (decision 9); request budget; best effort; **no tier call on the stepped path, location per
  step** (decision 6, findings 11.18).
- **AD-61 Replay release gate**: C9 with the four revision 3 measurements, the A4 pass criteria (accepted), the
  option B threshold and the Story 12.2 memory limit; the composer baseline restarts with the no-limit composer.

Amendments: AD-7 (public phone-reveal and click-log fields with a rate limit), AD-8 (exception list), AD-14
(`online`; revision 6: `account_default`; inheritance only when the post's `PUBLISHER` account, else
`posts.account_id`, is `ORGANIZER_VENUE_EVENT` with status `CONFIRMED` (owner answer Q8); a re-geocode that finds
nothing clears the pin (Q9); a city check if Story 11.20 adds one), **AD-17** (the field-map descriptor's `startCol` / `endCol` point at `display_start_date` /
`display_end_date` with the condition `is_display`; `highlight` is a plain list column), **AD-20** (`!ended` and
the temporal filter read the display columns; BUG-096 cutoff untouched; revision 6: `NEXT_7_DAYS` = `overlaps`
today to today + 6 AND `notEnded`, `UPCOMING` kept with its meaning, the viewer's day instead of UTC for BUG-097
from `users.timezone`, else the browser's IANA zone, else `Asia/Jakarta`, reusing `schedule_past_cutoff_date` for
any SQL (Q12)), AD-29 (number retention), AD-30 Rule 5
(payload, "one call" wording), Rule 7 (race pack for new posts and backfill with `coreEventName` and
`activityType` as scoring inputs, `sharedLink`, a wider candidate date window for race-pack candidates if Story
11.10 measures that it is needed), Rule 9 (union, moderator edits, flags and highlight recomputed), AD-33 (bar
tier), AD-40 (preview), AD-46/AD-51 (no tier call on the stepped path), AD-49 (output cap), AD-52 (second call
retries). No amendment to AD-12 Rule 7, AD-13, AD-28 or AD-30 Rule 1 in this course (C8 deferred).
Infra docs: `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md` with zxing-wasm (Story 12.2),
`registration_options`, the sweep steps (flag healing, highlight recompute, phone purge) and the `/go/` endpoint,
each in the change that adds it (CLAUDE.md section 4).

### 4.4 UX (`design-artifacts/UX-festgrid-run-1/`), to be applied by `bmad-ux`
- `EVENT-CARD-DESIGN.md`: grid card from the owner mock (handoff 9): one status/date badge in the thumbnail,
  footer left slot (distance, else "Gratis", else start time, else "+N jadwal" / "+N more", the count of other
  schedules, unrelated to Q5), right slot event type, green area =
  performers or the stored card highlight (2 lines, ending in an ellipsis when it does not fit; the data has no
  character limit). A list highlight starts with its label and count ("Penampil (4): Band A, Band B, ..."), so the
  count stays visible when the end is cut by the ellipsis; the card never computes or appends a count of its own
  (owner answer Q5). Container-query text size. Dummy-date label (decision 5),
  short form by stage: "Daftar s/d 6 Nov" / "Register by 6 Nov", "Pengumuman 17 Okt", "Ambil kit 13 Nov", "Submit
  s/d 12 Nov" (EN copy to be written with the same pattern).
- Event detail: the full ordered highlight list (no character limit) from the composer's `detail` mode; the full
  dummy-date sentence ("Pendaftaran sampai 6 November 2026"); price tiers and "from" price beside the buttons, not
  inside them; a low-confidence mark on an option read from an image, with a link to the original post.
- `DESIGN.md` / `EXPERIENCE.md`: bottom bar, side card, modal footer, multi-option sheet, phone/WhatsApp
  actions, message preview, trust line, state table; tokens only, lucide icons, EN + ID copy, `z-overlay-sticky`.
- Prototypes to translate (not copy): `prototypes/registration-cta/` (card, list, detail, sheets).
- Revision 6: the time dropdown (Story 11.22) on the home, feed, favorites and account pages: Kapan saja | 7 hari ke
  depan | Hari ini (EN Anytime | Next 7 days | Today), placed first in the facet row, using the existing facet
  trigger (`Button variant="outline"` in a `Popover`); an old `?temporal=UPCOMING` link shows "Kapan saja"
  selected and the URL is rewritten without a history entry (owner answer Q11); the shared chevron trigger, the
  scrolling row and the other header changes stay in `IDEA-261124-15a`. Event links of Story 0.37 keep their list on the detail page with the
  label and the destination host visible (trust line). A schedule without its own location whose deciding account
  is not a confirmed organizer or venue account (11.19, owner answer Q8) has no pin, and neither has a schedule
  whose re-geocode found nothing (11.21, Q9): the distance slot falls through to its next rung and the map link is
  hidden.

---

## 5. Stories

Two epics (owner, finding 9); **21 stories in Epic 11 and 11 in Epic 12, 32 in total** (revision 6). Both numbers
are free (checked again 2026-11-27 after merging the base branch and `master`): `epics.md` ends at Epic 10, `sprint-status.yaml` has no
`epic-11` or `epic-12` key and the spine ends at AD-54 (checked 2026-11-27 after merging `master` and the base
branch). Nothing was added to `sprint-status.yaml`; proposed keys are in section 5.4.

### 5.1 Proposed Epic 11: "Extraction and honest dates"

| Id | Short title | Change | Depends on |
|---|---|---|---|
| 11.1 | Add a prompt seam to the extraction request builder | C9, C3 | AD-61 |
| 11.2 | Build the replay release gate with a fresh caption set per release | C9 | 11.1 |
| 11.3 | Add stage, display flag, display dates, fact, highlight, core-name and tier columns | C2, C3, C4, C5, C6 | AD-58, AD-59, AD-60 |
| 11.4 | Require a stage per schedule row and keep the main flag derived in code | C2 | 11.2, 11.3 |
| 11.5 | Port title rule v2 with its three fixes to the domain package | C6, C10 | AD-58 |
| 11.6 | Extract prizes, promos, inclusions, free flag and speaker performers | C3 | 11.2, 11.3 |
| 11.7 | Port the highlight composer and store the card highlight on every write path | C4 | 11.3, 11.6 |
| 11.8 | Merge location keywords, tiers and core event name into one post-extraction call | C5 | 11.2, 11.3 |
| 11.9 | Skip geocoding for online-only locations | C7 | none |
| 11.10 | Match new race-pack posts into the main event through the dedup scoring | C6 (rule 4) | 11.4, 11.5, 11.8 |
| 11.11 | Backfill active events from stored data (layer 1) | C10 | 11.5, 11.7, 11.9, 11.13 shipped; race-pack step after 11.10 |
| 11.12 | Recompute display flags of active events in the scheduled sweep and report drift | C6, C10 | 11.13 |
| 11.13 | Compute display flags on every write path and point the field map at the display columns | C2, C6 | 11.3, 11.4 |
| 11.14 | Redesign the grid card and show the highlight list and dummy-date labels | C4, C6 | 11.7, 11.13, UX |
| 11.15 | Backfill active events by re-reading captions in a local session (layer 2) | C10 | 11.11 |
| 11.16 | Clear the wrong pins of active online-only schedules | C7, C10 | 11.9 shipped (decision 1) |
| 11.19 | Inherit the account default location only for organizer and venue accounts, and mark it | C11 | none (first, next to 11.9) |
| 11.20 | Investigate wrong-city geocoding matches and add a city check if the cause supports it | C11 | none |
| 11.21 | Re-geocode active schedules never attempted by the current path | C11, C10 | 11.9 and 11.19 shipped; after 11.20 if it adds a check |
| 11.22 | Replace the temporal toggle with a time dropdown with the next 7 days, and use the viewer's date | C12 | none |
| 11.z | Ratchet: highlight, main flag and display flag come only from their domain functions | C2, C4, C6 | 11.7, 11.13 |

Not in Epic 11: **11.17** (Give each event its own cover slide on multi-event carousels) is deferred (decision 4);
the id stays reserved and the work is backlog `IDEA-261124-8jo`. The ratchet 11.z keeps its proposed key `11-18z`;
the revision 6 stories take 11.19 to 11.22, so no earlier id moves.

Acceptance criteria to carry into `bmad-create-story`:
- **11.2 (Replay gate):** interleaved A/B, 6+ runs, events and schedules counted against production; fresh caption
  set with labels written first; zero output-cap hits; A4 criteria (accepted by the owner 2026-11-26). The first
  release with the no-limit composer (11.7) sets a new composer precision baseline; 0.86 was measured with the
  40-character rule. Reports every release: (1) ticket prices visible on the images of 40 fresh posts, read by eye
  (Claude first, doubtful posts to the owner), that the main extraction did not return; two or more trigger
  option B (`IDEA-261124-ofm`), one is reported and watched, a price label on a single product is not a ticket
  price (first reading 2026-11-26: 0 of 40); (2) events with a missing or extra tier on multi-event posts; (3) for
  11.8, `coreEventName` same-series pairs and `activityType` stability inside the merged call; (4) for 12.2, the
  AI-processor Lambda's peak memory on the replay with and without QR decoding.
- **11.3 (Columns):** `schedules.stage` NOT NULL default `event`; `stage_source` (`default | model | rule_v2 |
  moderator`, default `default`, A10); `schedules.is_display boolean NOT NULL DEFAULT true`; generated
  `display_start_date`, `display_end_date`, `display_is_dummy` as defined in section 3.5 (Q2 answered); partial index
  `schedule_display_date_idx ON schedules (event_id, COALESCE(display_end_date, display_start_date), display_start_date) WHERE is_display`
  (hand-written SQL, like the 0055 expression index; drizzle-kit cannot express it); on `events`: `prizes`,
  `promos`, `inclusions`, `is_free`, `highlight` (`text`, no length limit: no `varchar(n)` and no length CHECK),
  `highlight_rules_version`,
  `core_event_name`, `activity_type`; tiers with `low_confidence`. Given the migration has run and nothing else,
  when `Query.events` runs, then every row has `is_display = true` and `display_*` equal the real dates
  (behaviour identical to today, checked by a test on a fixture with a registration row).
- **11.4 (Stage on write):** extraction writes `stage` and `stage_source = model`; the code guard fills a missing
  stage; the main flag is never taken from the model; manual correction and merge write their own source. Master
  note (PR #268, merged 2026-11-26): `buildEventInsertValues` and `mapExtractionPayloadToProposedCorrection` now pass
  extracted times through `normalizeExtractedTime` (unparseable times stored as null and logged by
  `warnDroppedScheduleTimes`); adding `stage` there must keep that normalization and its tests.
- **11.5 (Title rule v2):** ports `poc/registration-extraction/stage-classifier-v2.mjs` to `packages/domain` with
  the three fixes: (1) a ticket-sale row with one date is the event day; (2) "collection" or "launch" in a product
  post is an event, not a phase; (3) a title that mixes an announcement with a presentation or a prize-giving is
  the final day (counts). 100% unit tested, with the POC's cases as fixtures (sample ids only).
- **11.7 (Composer and stored card highlight):** `composeHighlight(facts, 'detail')` returns the ordered list from
  every ladder rung with content; `'card'` is its first item, whole. The port removes the POC's length rule:
  no `MAX = 40`, no skip of a candidate that is too long, no buy-get cut at the condition word; academic degrees
  after the first comma of a name are always removed (owner answer Q1). The port also removes the POC's
  "+N" suffix and its two-names-then-one loop: a list item of two or more values writes every value with the count
  in parentheses after the label (owner answer Q5), for every list label (performers, speakers, instructors,
  judges, prizes, take-home items, promos and the like). The production code has no highlight length limit today (checked, read only), so there is nothing
  else to remove. Extraction,
  manual correction, merge, re-extract apply and the backfill write `events.highlight` and
  `highlight_rules_version` through it; a recompute step (no LLM) rewrites every row of an **active** event whose
  version is older than the code's and logs the count (owner answer Q7: active events only; past events keep their
  stored text, with a test on a past fixture event stored with an older version that stays unchanged); the re-extract preview shows the same output without writing (AD-40). Given a
  fact set, the card highlight equals the first detail item (property test); a test with a first item longer than
  40 characters stores it whole.
  Acceptance criteria and tests for the count (owner answer Q5; values below are placeholders, no real names):
  - Given four performers, the item is "Penampil (4): Band A, Band B, Band C, Band D": every value kept, no "+N",
    the count equals the number of values written.
  - Given one performer, the item is "Penampil: Band A" with no count (one item, no count); the same holds for one
    prize, one take-home item and one promo.
  - Given two values that are the same after de-duplication (or after the degree removal), the item has one value
    and no count.
  - A price hook ("Mulai dari Rp50.000") and free entry ("Gratis") never carry a count.
  - Label the value already starts with: given one prize whose value starts with "Hadiah" ("Hadiah Rp5 juta"), the
    item is "Hadiah Rp5 juta", not "Hadiah Hadiah Rp5 juta" and with no count. Given two such values ("Hadiah Rp5
    juta", "Hadiah Rp3 juta"), the item is "Hadiah (2): Rp5 juta, Rp3 juta" (owner answer Q6); a list where only
    some values start with the label drops the word only from those.
  - A fact set that yields no "+" followed by a digit anywhere in the composed text (regression test against the
    POC format).
  - The recompute step rewrites a row stored with an older `highlight_rules_version` in the POC format into the
    count format.
- **11.8 (Post-extraction call):** one merged call for a one-event post (location keywords, priced options,
  `coreEventName`, `activityType`); for two or more events, the location call plus a separate per-event tier call.
  The tier part reads the caption **and the `ticketPrice` string the main extraction returned for each event**;
  no images. `ticketPrice` stays in the extraction output and in `schedules.ticket_price`; tier options are stored
  beside it. Tiers only when two distinct amounts exist inside one event; `fromPrice` = lowest positive PUBLIC
  amount. An option whose amount does not appear in the caption text gets `lowConfidence = true` (code). Parts are
  validated separately; a failed part leaves the others. Not run on the stepped path (decision 6). Before release,
  the gate (11.2) measures the core name inside the merged call against the separate-call POC figures.
- **11.10 (New race-pack posts):** a new event with `activityType = RACE_PACK_COLLECTION` is first matched against
  stored main events through the AD-30 Rule 7 dedup scoring, with `coreEventName` as the name-similarity input and
  the dates; never an exact key. High tier merges, mid tier queues a suggestion; no main event: shown as it is with
  its dummy date (end of registration, else the pickup date) and label. Stored main events without a core name are
  matched on their raw name until 11.11 and 11.15 fill it. The Rule 7 candidate window (2 days) may miss a pickup
  several days before the race: the story measures it and proposes a wider window for race-pack candidates only.
  `coreEventName` is never displayed (test: no UI or GraphQL list field exposes it).
- **11.11 (Layer-1 backfill, active events only):** selects active events (at least one schedule whose end date,
  else start date, is not past in its own time zone; the BUG-096 per-schedule cutoff gives that day); past events are
  not read or written, and a test with one past and one active fixture event proves it. On the active events it sets
  `stage` by title rule v2 (11.5) with `stage_source = rule_v2` on every row whose source is still `default`; recomputes the flags through `computeDisplayFlags`; splits stored price strings
  into tiers (leaving `ticket_price` as it is); writes the stored card highlight; fills `core_event_name` and
  `activity_type` by the code rule (first fill, about 73% on the test set, optimistic) where empty; moderator edits
  never overwritten; `--dry-run`, `--apply`, rollback copy; apply only with the owner's go-ahead and the writer
  credential; the dry run prints the number of active events and rows it would change. Its race-pack step feeds the
  active ones among the 17 stored race-pack events through the 11.10 matcher (suggestions unless high tier).
- **11.12 (Healing sweep, active events only):** a step of an existing scheduled sweep (AD-58 names it) recomputes
  the flags of every **active** event with `computeDisplayFlags`, repairs rows that differ and logs the number
  repaired; past events are never swept (otherwise the sweep would rewrite them, input 15), with a test on a past
  fixture event whose stored flags differ from the computed ones and stay unchanged. The drift count is measured on
  active events; a read-only mode (script or SQL, for the owner or the CI bridge read path) only counts. After 11.11
  has run, the count is 0; a non-zero count names the write path to fix. Infra docs updated for the new sweep step.
- **11.13 (Flags on write and field map):** `computeDisplayFlags(rowsOfOneEvent)` implements the six rules of C6
  and the `other` rule (100% unit tested); it reads `activityType` when present (race-pack rule) and otherwise
  falls back to rule 5. Every schedule write path calls it: extraction ingestion, manual correction, merge, set
  primary post, re-extract apply, backfill, admin scripts. The AD-17 field-map descriptor's `startCol` / `endCol`
  point at `display_start_date` / `display_end_date` with the condition `is_display`; `overlaps`, `notEnded` and the
  three ORDER BY subqueries keep their shape; `selectDisplaySchedule` uses the same columns. Tests, each on a
  fixture: (1) an event with two `event` rows on different dates shows the nearer upcoming one, then the next, and
  leaves the list after the last; (2) an event with several main schedules keeps every one flagged and the order
  key picks the nearest upcoming; (3) an event with an `event` row and a registration window shows the `event`
  row, never the window; (4) a competition with only a registration window shows the end of registration as a
  dummy date; (5) an event whose rows are all `other` shows like `event`; (6) a non-competition event with an
  announcement and a preparation row shows the nearest upcoming one and leaves the list after the last; (7) the
  BUG-096 timezone cutoff behaves as before; (8) `EXPLAIN` on the list query uses `schedule_display_date_idx`;
  (9) `display_is_dummy` is true for flagged `registration`, `submission`, `announcement` and `preparation` rows and
  false for `event` and `other` rows; a competition `submission` row keeps its real start and end dates (Q2). Master
  note (PR #268): schedule times reaching `computeDisplayFlags` and the BUG-096 cutoff are already normalized
  `HH:MM:SS` or null; fixtures should include a null time from a dropped value.
- **11.14 (Card and detail):** card per `EVENT-CARD-DESIGN.md` with the stored card highlight (ellipsis when it
  does not fit; no character limit in the component; the component shows the stored text as is and adds no count
  or "+N" of its own, so "Penampil (4): ..." keeps its count visible at the start) and the short dummy-date label by stage; the detail page shows the ordered highlight list and the full dummy-date sentence; EN
  + ID copy.
- **11.15 (Layer 2, active events only):** local Claude session (not Gemini), same schema and code; re-reads
  captions and images for the active events with a caption (414) or only an image (129) as counted 2026-11-24, recounted
  at run time; an empty caption (stored since PR #269) counts as no caption; fills facts, highlight, `core_event_name` and `activity_type` where the code rule left them
  empty; tier input = caption and the stored price string (noted as possibly from another merged post); same
  `--dry-run` / `--apply` / rollback and owner go-ahead.
- **11.16 (Online pins, active schedules only):** script with `--dry-run`, `--apply` and a rollback copy (from
  `poc/registration-extraction/online-locations-review.sql`) clears the pins of the **active** online-only
  schedules once 11.9 has shipped (decision 1); pins of past schedules stay (input 15); the dry run reports the active
  count next to the 72 of 2026-11-24; apply with the owner's go-ahead and the writer role.
- **11.z (Ratchet):** a source scan fails when a schedule write path does not call `computeDisplayFlags`, when
  code writes `is_display`, `is_main_schedule` or `events.highlight` outside their domain functions, or when a UI or
  GraphQL list field exposes `coreEventName`.
- **11.19 (Account-default location, revision 6):** code facts checked read only on 2026-11-26:
  `resolveAccountAndLocations` (`apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts`) geocodes the
  account's `default_location` address for a schedule with no own text and no event text, for any account, and
  records no `location_resolution`; the account is `posts.account_id` (`message.accountId`), not reliably the
  publisher; since PR #269 a post can have several `SCRAPING_SOURCE` accounts. Criteria:
  - Given a schedule with no own location text and no event-level text, when the deciding account (owner answer
    Q8: the post's `PUBLISHER` account, else `posts.account_id`) has `account_type = ORGANIZER_VENUE_EVENT` and
    `account_type_status = CONFIRMED`, then the schedule takes the default location and `location_resolution =
    account_default` (new `LocationResolution` member; text column, no migration).
  - Given the same schedule and an account that is `CURATOR_GUIDE`, `PERSONAL`, has no account type, or is
    `ORGANIZER_VENUE_EVENT` with status `AWAITING_APPROVAL`, then the schedule gets no coordinates (no pin; the card's distance slot falls through; the map link is hidden). The account default may
    still bias a text lookup as today (`proximityFor`), never become the pin.
  - A schedule with its own text, or with event-level text, follows the keyword ladder unchanged; an online-only
    text never inherits (11.9 wins).
  - Same rule on the extraction and the re-extract apply paths (both call `buildExtractedEventMessage`); the stepped
    path too. Unit tests for each account kind and status, 100% coverage of the new decision function.
  - Old rows are not rewritten here; active rows are handled by 11.21. For scale (production read-only, 2026-11-27,
    active pins without location text, account from the event's earliest linked post, approximate): 167 organizer
    or venue confirmed (kept), 203 curator confirmed and 59 with no account type (no pin under the rule); the 11.21
    dry run shows the real counts before apply. PRD 3.7 amended (4.1 edit 11), AD-14 amended.
- **11.20 (City check, investigate first, revision 6):**
  - Step 1, read only: reproduce the Semarang case (keywords naming the venue, the city and the province; the first
    keyword step returned a point about 120 km from the city) offline with the stored keywords and a recorded provider
    response; write in the story file whether the provider, `select-best-candidate` or the trust check caused it.
    Sample ids only.
  - Step 2, only if the cause is a candidate whose city or province does not match the keywords: a check rejects such
    a candidate (the ladder moves to its next step) and records why; unit tests with the case as a fixture; the check
    is measured on a read-only sample of active `kw1` / `kw2` pins (how many it would reject) before release.
  - If the cause is something else, the story closes with the finding written down and no check; it never ships a
    check without a verified cause.
- **11.21 (Re-geocode, active schedules only, revision 6):** script with `--dry-run`, `--apply` and a rollback copy.
  - Selects active schedules (same rule as 11.11) whose pin was never attempted by the current path (no
    `location_resolution`); counts on 2026-11-26: 486, 111 of them outside an Indonesia box (approximate), 289 with
    text (206 distinct texts), 197 without. Past schedules (3,271 never-attempted pins) are not read or written, with
    a test.
  - With text: the current path (keywords call and ladder, 11.9's online rule, 11.20's check if shipped) runs once
    per distinct text; the result and its `location_resolution` are written. Without text: the 11.19 rule decides
    (inherit with `account_default`, or no pin). When nothing is found, the pin is cleared (owner answer Q9: no pin
    is better than a wrong one).
  - Moderator-set locations are never overwritten; the dry run prints counts by outcome (replaced, cleared,
    unchanged, inherited) for the owner before any apply; apply only with the owner's go-ahead and the writer role.
- **11.22 (Time dropdown with the next 7 days, revision 6):** code facts checked read only on 2026-11-26: domain
  `TemporalFilter { TODAY, UPCOMING }` and `buildTemporalCondition` in
  `packages/domain/src/events/buildEventsQueryCondition.ts` (UPCOMING = `overlaps` from tomorrow with no end; TODAY =
  `overlaps` today AND `notEnded`); GraphQL `enum TemporalFilter { TODAY UPCOMING }` on `EventFilterInput` and
  `EventFilter` (`apps/backend/src/schema/events.graphql`); UI `TemporalFilterToggle` (radiogroup, `packages/ui`)
  wired by `useTemporalFilter` (`?temporal=`, `parseAsStringEnum(["TODAY", "UPCOMING"])`) on the four pages
  `home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx` and
  `[platformSlug]/[username]/account-content.tsx`; no page passes a time zone, so `resolveTodayISO` uses the UTC
  date (BUG-097). Criteria:
  - A dropdown `Kapan saja | 7 hari ke depan | Hari ini` (EN `Anytime | Next 7 days | Today`) replaces the toggle on
    the four pages; `Kapan saja` is the null value (today's "Semua"); EN + ID copy through next-intl with the locale
    parity ratchet; the PostHog `temporal_filter_changed` event carries the new value.
  - `NEXT_7_DAYS` is added to the domain enum, the GraphQL enum, the UI type and the URL parser.
    `buildTemporalCondition('NEXT_7_DAYS')` = `overlaps` {from: today, to: today + 6} AND `notEnded` (the TODAY
    pair), no new SQL. Tests: a schedule that ended earlier today is excluded; one on today + 6 is included; one
    starting on today + 7 is excluded; a multi-day schedule that started before today and runs into the window is
    included.
  - `UPCOMING` stays accepted: GraphQL, the domain and saved AI filters keep it with its current meaning (tomorrow
    onward). Owner answer Q11: given an old link `?temporal=UPCOMING`, the page opens without error with "Kapan saja"
    selected and the URL rewritten without `temporal` and without a new history entry (test).
  - BUG-097 fixed in the same story: "today" for TODAY, NEXT_7_DAYS and UPCOMING, `notEnded` and the `Query.events`
    next-upcoming sort key come from the viewer's day, not UTC; the pages pass a time zone to `resolveTodayISO`
    (the option exists, unused). Owner answer Q12: the zone is `users.timezone` when set, else the browser's IANA
    time zone, else `Asia/Jakarta`; no new SQL beyond what BUG-097 needs, and where `notEnded` or the sort key need
    the per-schedule rule they reuse `schedule_past_cutoff_date` (any such SQL is named in the story). The shared
    ended-cases fixture gains a case at 00:00-07:00 WIB.
  - The filter reads dates through the AD-17 field map, so after 11.13 it uses the display columns with no change of
    its own; whichever of 11.13 and 11.22 lands second adds a test with a registration-window fixture.
  - The AI filter vocabulary (its `THIS_WEEK` anchor and "next 7 days" span) is unchanged. The other header changes
    stay in `IDEA-261124-15a`. PRD 3.12 and the enum amended (4.1 edit 12), AD-20 amended.
  - Related, outside this proposal: PR #270 (BUG-261126-pwb, A THIS_WEEK date filter is 37 days long when the week
    crosses a month or year boundary; open, not merged on 2026-11-27) changes `resolveDateRangeFilter` in the same
    file, `buildEventsQueryCondition.ts`. Story 11.22 changes `buildTemporalCondition` and the today resolution, not
    `resolveDateRangeFilter`; merge `master` first and keep PR #270's week-window tests green.

### 5.2 Proposed Epic 12: "Registration, CTA bar and prices"

| Id | Short title | Change | Depends on |
|---|---|---|---|
| 12.1 | Store registration links in their own table | C1 (slice 1) | AD-55 |
| 12.3 | Read registration options through a separate uncached query that returns safe descriptors only | C1 (slice 1) | 12.1 |
| 12.4 | Add the first-party link endpoint `/go/` with allow-list, blocklist and kill switch, and move the existing event links onto it | C1, owner rule (input 14) | AD-55, AD-57, 12.1 (the event-link part needs only AD-57) |
| 12.5 | Show the event action bar on phones and the side card on desktop | C1 (slice 1) | 12.3, 12.4, UX |
| 12.6 | Open a sheet when an event has several registration options | C1 (slice 1) | 12.5 |
| 12.7 | Show the event's price tiers and the "from" price beside the registration buttons | C5 (slice 3) | 11.8, 12.6 |
| 12.8 | Detect registration phones deterministically and scrub free text | C1 (slice 2) | AD-56, 12.1 |
| 12.9 | Delete registration phones after the event ends (retention sweep) | C1 (slice 2) | 12.8 |
| 12.10 | Add WhatsApp and phone actions with a message preview, revealed on action | C1 (slice 2) | 12.4, 12.5, 12.8 |
| 12.z | Ratchet: the event detail renders organizer or scraped destinations only as `/go/` links | C1, owner rule | 12.4, 12.5 |
| 12.2 | Decode QR codes into registration links (last, behind the memory gate) | C1 | AD-57, 12.1, 11.2, memory gate |

Acceptance criteria to carry into `bmad-create-story`:
- **12.1 (Table):** no price column (decision 10); an option whose value was read from an image gets
  `lowConfidence` (decision 9).
- **12.2 (QR, last):** ships after every other Epic 12 story. Gate before merge: (1) the cause of the AI-processor
  Lambda out-of-memory seen since 2026-11-20 is understood and written down; (2) the replay (11.2) shows the peak
  memory with decoding is at most 10% above the same replay without it and below 80% of the Lambda's configured
  memory (owner answer Q3); (3) decoding runs on a downscaled copy of the image. Master note: PR #266 (merged) added
  JS heap, sharp and per-post memory logging to the AI processor; use those logs for (1) and (2).
  A button needs a decoded payload; a payment payload is never a Register button. Infra docs updated in the same
  change (zxing-wasm). Slice 1 does not wait for it.
- **12.4 (Link endpoint and the existing event links):** shape in section 4.3 (AD-55 and AD-57 amendments). The
  descriptor read of 12.3 never carries a full URL or a phone number; the endpoint takes only an opaque id, never a
  URL. **Event links of Story 0.37 (owner decision, input 14):**
  - Given an event with `events.links`, when its detail page renders (page and `@modal` route, both cached through
    `get-event-by-slug-cached.ts`), then each link is `<a href="/go/{opaqueId}" target="_blank" rel="noopener
    noreferrer">` showing its label and destination host; the full URL is not in the HTML (test on the rendered
    page).
  - The public `Event.links` read returns descriptors (opaque id, label, host) and no `url`; the correction dialog
    (`correction-dialog.tsx`, which seeds its form from the event's links) and the moderator re-extract preview get
    the full URL through a gated read (owner answer Q10).
  - The endpoint applies to event links the same checks as to options: scheme allow-list, host blocklist (effective
    at once for every event, past ones included), kill switch per link, and a first-party page for an unknown,
    blocked or removed id. Writes still pass `sanitizeEventLinks`.
  - Owner answer Q10: the opaque id of an event link is derived at read time from the event and the link (for
    example the event's public id and the link's position, or a keyed hash; the exact form is an AD-57 choice) and
    resolved by the endpoint from `events.links`; no stored id, no data write. It works for every event that has
    links, past ones included, so this is not a backfill and the active-only rule does not apply. Test: a link of a
    past fixture event redirects through `/go/` with no row written.
  - Ratchet 12.z covers `EventDetailView.tsx`'s link list.
- **12.7 (Prices):** reads the event's tiers (11.8); buttons carry no price; `fromPrice` and the tiers sit beside
  the buttons; `ticketPrice` is shown as today where the event has no tiers; low-confidence tiers carry the mark.
- **12.10 (Phone actions):** the number is returned only when the user acts (POST, per-IP rate limit, declared
  public under AD-7); "Copy number" on desktop, `tel:` on touch; WhatsApp goes through `/go/`.
- **12.z (Ratchet):** a source scan fails when an event-detail component puts a URL from an option, a QR, a
  contact, a brochure or an event link (`events.links`, Story 0.37) into `href`, `window.open` or `location` other
  than a `/go/` link; first-party
  navigation (calendar, share, map link) is exempt by name.

### 5.3 Id maps

Revision 1 -> revision 2: 11.1->11.1, 11.2->11.2, 11.3->11.3, 11.4->11.4, 11.5 (Facts)->11.6, 11.6
(Composer)->11.7, 11.7 (Post-extraction call)->11.8, 11.8 (Display dates)->11.13, 11.9->11.9, 11.10 (Registration
table + QR)->12.1 and 12.2, 11.11 (Uncached read)->12.3, 11.12 (Action bar)->12.5, 11.13 (Sheet)->12.6,
11.14->11.14, 11.15 (Prices)->12.7, 11.16 (Phones)->12.8, 11.17 (Retention)->12.9, 11.18 (WhatsApp)->12.10, 11.19
(Own cover)->11.17, 11.20 (Layer 1)->11.11, 11.21 (Layer 2)->11.15, 11.22 (Online pins)->11.16, 11.z->11.z.

Revision 2 -> revision 3 (ids kept, scope changed): 11.3 (Columns: adds display flag and generated dates,
highlight, core name), 11.7 (Composer: adds stored card highlight and recompute step), 11.8 (Post-extraction call:
adds core name and the price-string input), 11.10 (adds core name and activity type as inputs), 11.12 (Stage gate
check -> Recompute display flags in the scheduled sweep and report drift), 11.13 (Display date behind the gate ->
Compute display flags on every write path and point the field map at the display columns), 11.14 (adds the detail
highlight list), 11.17 (removed from Epic 11, deferred), 12.2 (moved last, memory gate), 12.7 (prices are the
event's tiers).

Revision 5 -> revision 6 (ids kept, no renumbering): retitled 11.11, 11.12, 11.15, 11.16 (active events only) and
12.4 (also the existing event links); new 11.19 (Account-default location), 11.20 (City check), 11.21 (Re-geocode
active never-attempted pins), 11.22 (Time dropdown with the next 7 days). 11.17 stays reserved; the ratchet keeps
`11-18z`.

### 5.4 Proposed sprint-status keys (to be added after approval; not added now)

Checked 2026-11-26 (again in revision 6, after merging the base branch and `master`) with
`scripts/sprint-status-tool.py get epic-11` / `epic-12`: neither key exists. The two ratchets took the next free
number with the `z` suffix when they were proposed, as `10-14z` does; 11.17 is skipped because its id is reserved
for the deferred cover story. The revision 6 stories take 11.19 to 11.22 after the ratchet's `11-18z` rather than
moving it (no renumbering).

```yaml
  epic-11: backlog
  11-1-add-a-prompt-seam-to-the-extraction-request-builder: backlog
  11-2-build-the-replay-release-gate-with-a-fresh-caption-set-per-release: backlog
  11-3-add-stage-display-flag-display-dates-fact-highlight-core-name-and-tier-columns: backlog
  11-4-require-a-stage-per-schedule-row-and-keep-the-main-flag-derived-in-code: backlog
  11-5-port-title-rule-v2-with-its-three-fixes-to-the-domain-package: backlog
  11-6-extract-prizes-promos-inclusions-free-flag-and-speaker-performers: backlog
  11-7-port-the-highlight-composer-and-store-the-card-highlight-on-every-write-path: backlog
  11-8-merge-location-keywords-tiers-and-core-event-name-into-one-post-extraction-call: backlog
  11-9-skip-geocoding-for-online-only-locations: backlog
  11-10-match-new-race-pack-posts-into-the-main-event-through-the-dedup-scoring: backlog
  11-11-backfill-active-events-from-stored-data-layer-1: backlog
  11-12-recompute-display-flags-of-active-events-in-the-scheduled-sweep-and-report-drift: backlog
  11-13-compute-display-flags-on-every-write-path-and-point-the-field-map-at-the-display-columns: backlog
  11-14-redesign-the-grid-card-and-show-the-highlight-list-and-dummy-date-labels: backlog
  11-15-backfill-active-events-by-re-reading-captions-in-a-local-session-layer-2: backlog
  11-16-clear-the-wrong-pins-of-active-online-only-schedules: backlog
  11-18z-ratchet-highlight-main-flag-and-display-flag-come-only-from-their-domain-functions: backlog
  11-19-inherit-the-account-default-location-only-for-organizer-and-venue-accounts-and-mark-it: backlog
  11-20-investigate-wrong-city-geocoding-matches-and-add-a-city-check-if-the-cause-supports-it: backlog
  11-21-re-geocode-active-schedules-never-attempted-by-the-current-path: backlog
  11-22-replace-the-temporal-toggle-with-a-time-dropdown-with-the-next-7-days-and-use-the-viewers-date: backlog
  epic-11-retrospective: optional
  epic-12: backlog
  12-1-store-registration-links-in-their-own-table: backlog
  12-2-decode-qr-codes-into-registration-links-behind-the-memory-gate: backlog
  12-3-read-registration-options-through-a-separate-uncached-query-that-returns-safe-descriptors-only: backlog
  12-4-add-the-first-party-link-endpoint-and-move-the-existing-event-links-onto-it: backlog
  12-5-show-the-event-action-bar-on-phones-and-the-side-card-on-desktop: backlog
  12-6-open-a-sheet-when-an-event-has-several-registration-options: backlog
  12-7-show-the-events-price-tiers-and-the-from-price-beside-the-registration-buttons: backlog
  12-8-detect-registration-phones-deterministically-and-scrub-free-text: backlog
  12-9-delete-registration-phones-after-the-event-ends-retention-sweep: backlog
  12-10-add-whatsapp-and-phone-actions-with-a-message-preview-revealed-on-action: backlog
  12-11z-ratchet-the-event-detail-renders-organizer-or-scraped-destinations-only-as-go-links: backlog
  epic-12-retrospective: optional
```

Carved out (backlog children of `CC-261124-vjh`, section 10): own cover per event (deferred), slide map merged into
the tier call, image tier call on the stepped path, the filter header changes other than the time filter, the
"Remind me" epic, the images variant of the tier call, a button-to-tier reference, a GENERAL-price rule for
multi-event posts, and four skipped approaches.

---

## 6. Decisions (all twelve answered)

| # | Decision | Answer (date, source) |
|---|---|---|
| 1 | Clear the 72 existing online pins | **Decided, option A** (2026-11-26, input 10; active schedules only since input 15, past pins stay): clear them after Story 11.9 ships, with Story 11.16's `--dry-run`, `--apply` and rollback copy; owner go-ahead and writer role. |
| 2 | Date for non-competition events with only non-counting rows | **Decided, option A** (2026-11-26, input 10): flag every non-counting row; the query picks the nearest upcoming one, the card labels it by its stage, the event leaves the list after its last phase (C6 rule 5, Story 11.13). |
| 3 | Highlight stored or composed at read time | **Decided, hybrid** (2026-11-25, input 8; length amended 2026-11-26, input 12): card highlight = first detail item, stored whole, no length limit, ellipsis in the UI, with a rules version and a recompute step; detail composed at read time as an ordered list from the same function (AD-59, Story 11.7). List items carry their count in parentheses after the label, no "+N", the label is never repeated (2026-11-26, input 13, owner answers Q5 and Q6). |
| 4 | Own cover per event on carousels | **Decided, option A, deferred** (2026-11-26, input 10): Story 11.17 not built in Epic 11; backlog `IDEA-261124-8jo`; OCR alternative not good enough (findings 11.20). |
| 5 | Wording of the dummy-date label | **Decided, option A** (2026-11-26, input 10): short on the card ("Daftar s/d 6 Nov", "Pengumuman 17 Okt", "Ambil kit 13 Nov", "Submit s/d 12 Nov"), full sentence on the detail ("Pendaftaran sampai 6 November 2026"). |
| 6 | Whether the cursor path gets the post-extraction call | **Decided by POC, option A** (2026-11-25, input 8, findings 11.18): no tier call on the stepped path; location per step; limit documented in AD-60. |
| 7 | Merge the slide map into the per-event tier call | **Decided, option A** (2026-11-26, input 10): stays separate; a merge POC only when the cover per event is built (`IDEA-261124-f6n`). |
| 8 | Do D6's deletion and handoff 8C's overturn still hold? | **Decided** (2026-11-24, input 7): windows stay schedule rows with `stage = registration`; D6 deletion withdrawn. |
| 9 | Evidence field for options read from images | **Decided, option A** (2026-11-25, input 8): no `evidence` field; code sets `lowConfidence` on options whose source is an image; the moderator opens the original post. Handoff D7 amended. |
| 10 | One price structure | **Decided by evidence, option C** (2026-11-25, input 8, findings 11.19): tiers belong to the event; registration buttons carry no price; a button-to-tier reference is an optional later field (`IDEA-261124-xdv`). The owner may overrule. |
| 11 | QR scope | **Decided, option B** (2026-11-25, input 8): adopt the decoder; Story 12.2 ships last in Epic 12 behind a memory gate; decoding on a downscaled copy; slice 1 does not wait. |
| 12 | Does a stage `other` row count? | **Decided, option A** (2026-11-25, input 8): `other` does not count as an event day, but an event whose rows are all `other` is treated as `event`. |

Also decided after revision 2: the list query design (input 9), the core event name inside Stories 11.3, 11.8,
11.10, 11.11 and 11.15 (input 10), and the tier call input (option A, input 11). Decided 2026-11-26 for revision 6:
the event links of Story 0.37 move onto `/go/` inside Story 12.4 (input 14); the wrong-pin gaps are part of Epic 11;
every backfill covers active events only, including the Story 11.12 sweep; the next-7-days time filter is a story
in Epic 11 (input 15; the epic is a planning assumption, the owner said "into an epic"). Decided 2026-11-27 for
revision 7 (input 16, all as recommended): Q7 to Q12 (section 11): highlight recompute for active events only,
account-default inheritance only for confirmed organizer or venue accounts, a re-geocode that finds nothing clears
the pin, event-link ids derived at read time, an old `UPCOMING` link reads as "Kapan saja", the viewer's day from
`users.timezone`, else the browser's zone, else `Asia/Jakarta`.

---

## 7. Assumptions made in this unattended run

- **A2** Mode = Batch (no one could review edits one by one).
- **A3** New work goes into **new Epics 11 and 12** (split agreed by the owner, finding 9), not into Epic 3.
- **A4** Release gate pass criteria, **accepted by the owner as written on 2026-11-26** (input section 12): the new arm must not lose events or schedules on any gate post more often than
  the production arm does on the same post; first-look composer precision on that release's fresh, never-read
  caption set must be **not worse than the previous release** on its own fresh set, read with the sampling noise of
  a 60-caption set in mind (0.86 was measured with the 40-character rule, so the first release with the no-limit
  composer sets a new baseline); zero output-cap hits; performer/prize extraction variance, the B-trigger count,
  multi-event tier errors and the core-name figures are reported, not gated.
- **A7** The backlog row is registered with status `triaged` (analysed, no story); this is not an approval.
- **A8** (revised in revision 6, input 15) The time filter of handoff 9 is in scope as Story 11.22 (C12). The other
  filter-header changes of handoff 9 and 11 (scrolling facet row, chevrons, AI button on the search row, icon
  buttons, collapse motion) stay carved out in `IDEA-261124-15a`. Putting 11.22 in Epic 11 rather than another epic
  is a planning assumption (the owner said "into an epic").
- **A9** (replaced in revision 6, input 15) The wrong-pin gaps of handoff 13E are part of Epic 11: Stories 11.19,
  11.20 and 11.21 (C11). The never-attempted count is now the active one (486 on 2026-11-26), not the 3,703 of all
  dates; past pins stay.
- **A10** `stage_source` is kept next to `stage`. Revision 3 no longer uses it for a reader gate; it still tells
  the backfill (11.11) which rows to fill and protects moderator-set stages. Any equivalent marker chosen by
  `bmad-architecture` works.
- **A11** The handoff's D5 and D7 lines are amended in the same strike-through style revision 2 used for D6 (input
  section 11 asks for every replace-`ticketPrice` wording to change; decision 9 withdraws D7's quoted evidence).
- **A11b** (revision 4) The handoff's highlight lines (Mary's "about 30-40 chars", the composer summary, rule F and the
  first-look figures) are amended in the same strike-through style for owner answer Q1.
- **A11c** (revision 5) The handoff's "+N" lines (composer summary, rule F table rows for PERFORMANCE and FESTIVAL,
  S50 "+n accepted") are amended in the same strike-through style for owner answer Q5. The footer's "+N jadwal"
  (count of other schedules) is a different slot and stays.
- **A12** (replaced in revision 6, input 14) The organizer links that Story 0.37 renders move onto `/go/` inside
  Story 12.4, with acceptance criteria; ratchet 12.z covers them.
- **A13** (revision 3) Where the core name sits on a multi-event post (location call or tier call) and which
  scheduled sweep hosts the healing, recompute and purge steps are left to `bmad-architecture` (AD-60, AD-58);
  neither changes the request count.
- **A14** (revision 6) "Active" is decided per schedule (end date, else start date, not past in its own time zone);
  an event is active when at least one schedule is. Backfills that work per event (11.11, 11.15, the 11.12 sweep,
  the 11.7 recompute, owner answer Q7) write every row of an active event, because the display flags are computed
  from all rows of one event; 11.16 and 11.21 work per schedule.
- **A15** (revision 6; resolved in revision 7) The Story 11.19 rule is now an owner decision (Q8, 2026-11-27): the
  deciding account is the post's `PUBLISHER` account, else `posts.account_id`; only `ORGANIZER_VENUE_EVENT` with
  status `CONFIRMED` inherits; inherited pins are marked `account_default`. Kept as a record; no assumption remains.
- A1, A5, A6 of earlier revisions are now owner decisions (8, 4, 12) and were removed.

---

## 8. Recommended approach, order and handoff

**Path:** Direct adjustment through two new feature epics (Option 1), gated by the replay gate. Effort **High**
(32 stories: 21 in Epic 11, 11 in Epic 12, across extraction, data, geocoding, UI and backfill), risk **Medium** (prompt
changes can collapse events; mitigated by C9), timeline: Epics 11 and 12 can run in parallel after the architecture
pass; Epic 12 needs Epic 11 only for prices (12.7 waits for 11.8) and the replay gate (12.2 waits for 11.2).

**Scope:** **Major** (PRD, architecture and UX change; two new epics). Route to PM (`bmad-prd`), UX (`bmad-ux`) and
Architect (`bmad-architecture`), then PO/Dev for stories.

**Process rule (revision 2, owner, finding 10):** every working branch and every planning run starts by merging
`master` (fetch `master`, merge it into the branch) before the first edit, again before every push and before a
pull request is opened; cloud routine prompts start with that fetch and merge.

**Planning order (after owner approval):**
1. Owner answers section 11: Q1 to Q6 answered 2026-11-26, Q7 to Q12 answered 2026-11-27 (input 16). No question
   is open; the owner approves this document.
2. `bmad-prd` (update): section 4.1 edits.
3. `bmad-ux`: section 4.4.
4. `bmad-architecture`: AD-55 to AD-61, the AD-55/AD-57 link-endpoint amendments and the amendments in 4.3.
5. Apply the epics.md edits of 4.2 and the sprint-status keys of 5.4 (correct-course follow-up), then
   `bmad-epic-readiness-check` on Epic 11 and on Epic 12, then `bmad-create-story` story by story. Never run
   `bmad-create-epics-and-stories` on Epic 3, Epic 1 or any epic that already has content.

**Dependency order (Epic 11):**
```
11.9 (online, independent) -> 11.16 (online pins of active schedules, decision 1)
11.19 (account-default rule, independent; first, next to 11.9)
11.20 (city check, investigation first, independent)
11.9 + 11.19 (+ 11.20 if it adds a check) -> 11.21 (re-geocode active never-attempted pins)
11.22 (time dropdown and BUG-097, independent; any time)
11.1 -> 11.2 -> 11.3 -> 11.4 -> 11.13 (flags on write, field map)
                    \-> 11.6 -> 11.7 (composer, stored card highlight)
                    \-> 11.8 (post-extraction call, core name)
11.5 (title rule v2, independent of the gate)
11.4 + 11.5 + 11.8 -> 11.10 (race-pack posts)
11.5 + 11.7 + 11.9 + 11.13 -> 11.11 (layer 1) -> 11.15 (layer 2)
11.13 -> 11.12 (healing sweep; count 0 after 11.11)
11.7 + 11.13 -> 11.14 (card and detail)
11.7 + 11.13 -> 11.z (ratchet)
```
**Dependency order (Epic 12):**
```
12.1 -> 12.3 ;  12.1 -> 12.4
12.3 + 12.4 -> 12.5 (bar) -> 12.6 (sheet) -> 12.7 (prices, also needs 11.8)
12.1 -> 12.8 (phones) -> 12.9 (retention);  12.4 + 12.5 + 12.8 -> 12.10 (WhatsApp, phone)
12.4 + 12.5 -> 12.z (link ratchet)
all of the above + 11.2 + memory gate -> 12.2 (QR, last)
```

**Implementation order:**
1. 11.9 Skip geocoding for online-only locations and 11.19 Inherit the account default location only for
   organizer and venue accounts (small, independent, both stop new wrong pins); 11.20 investigation in parallel;
   then 11.16 Clear the wrong pins of active online-only schedules and 11.21 Re-geocode active never-attempted pins
   (owner go-ahead, writer role; 11.21 after 11.20's outcome). 11.22 Time dropdown can be built at any point.
2. 11.1 Prompt seam -> 11.2 Replay gate; 11.5 Title rule v2 in parallel (pure domain code).
3. 11.3 Columns (rollout step a) -> 11.4 Stage on write -> 11.13 Flags on write and field map (step b) -> 11.6
   Facts -> 11.7 Composer -> 11.8 Post-extraction call (each prompt change through the gate) -> 11.10 Race-pack
   posts.
4. 11.11 Layer-1 backfill (step c; owner go-ahead, writer credential) -> 11.12 Healing sweep (step d) -> 11.14 Card
   and detail.
5. Registration slice 1: 12.1 -> 12.3 -> 12.4 Link endpoint -> 12.5 -> 12.6; then 12.7 (prices).
6. Slice 2: 12.8 -> 12.9 -> 12.10.
7. 11.15 Layer 2 (owner go-ahead, writer credential).
8. Ratchets 11.z and 12.z.
9. 12.2 QR decode, last, once the memory gate passes.

**Success criteria:** gate green on every prompt or schema change; no card shows a registration window as the event
day when the event has an event-day row; every dummy date carries its label; the healing step's repaired count is 0
after the backfill on active events; `EXPLAIN` of the list query uses `schedule_display_date_idx` and its cost
stays within AD-17; no active online-only schedule has a pin; no new schedule takes a curator, personal or
unclassified account's default location as its pin, and every inherited pin is marked `account_default`; no active
schedule is left never attempted by the current path (a re-geocode that finds nothing leaves no pin); past events
unchanged by every backfill and by the highlight recompute; "7 hari ke depan" shows today to today + 6 by the
viewer's day, and old `?temporal=UPCOMING` links open as "Kapan saja"; every Register button has a decoded or extracted link (never a payment QR) and
reaches it only through `/go/`; no full organizer URL (registration option or event link) or phone number in the
event-detail HTML; phones gone at
event end + 1 day; `ticketPrice` still written for new events; `coreEventName` never displayed; EN + ID copy and the
AD-33 and locale ratchets green.

---

## 9. Inconsistencies found between the input and the PRD, epics and spine

- **I1 (resolved 2026-11-24)** Registration windows: resolved by decision 8; handoff lines marked withdrawn.
- **I2** C8 cites "AD-30 Rule 1" and then "consent gate (Rule 7)". In the spine the consent gate is **AD-12 Rule 7**;
  **AD-30 Rule 7** is cross-post matching. Face blur is AD-28. (C8 is deferred; the note travels with
  `IDEA-261124-8jo`.)
- **I3 (resolved 2026-11-25)** D7 (quoted evidence) vs no `evidence` field: resolved by decision 9; handoff D7
  amended.
- **I4 (resolved 2026-11-25)** D3 slice 3 / D5 (price per registration option) vs C5 (tiers): resolved by decision
  10 (tiers on the event, buttons carry no price) and input section 11 (`ticketPrice` stays); handoff D5 amended.
- **I5** C5 says a post costs 2 requests today; AD-30 Rule 5 and AD-13 say "one Gemini call per post". The spine
  wording needs an amendment (AD-60).
- **I6** Handoff 13F's CIVIC ladder puts "free" before speakers, while the later owner rule (handoff O, input C4)
  puts the speaker before "free" on every type. The composer's CIVIC row follows the later rule.
- **I7** project-context reports about 200 requests per day for the lite model; the POC STATUS reports 500 per day
  for the local key. The capacity formula (PRD 3.8) should use the production key's real limit.
- **I8** PRD 4.1 / 5 still say private contact is discarded; D1 needs the PRD amendment before slice 2 ships (known).
- **I9 (revision 3)** Input section 9 defines `display_is_dummy` as "flagged and stage `registration`", but the later
  decisions 2 and 5 (input section 10) flag and label rows of other stages too ("Pengumuman", "Ambil kit", "Submit
  s/d"). **Resolved 2026-11-26** (owner answer Q2, option A).
- **I10 (revision 3)** Input section 8 says the card highlight is the first detail item "cut to 40 characters";
  the owner rule of C4 says a value that does not fit is skipped, never cut (except two repairs). **Resolved
  2026-11-26** (owner answer Q1): no limit, stored whole, ellipsis in the UI.
- **I11 (revision 3)** Input section 8 calls the healing step's host "the existing scheduled sweep (the one that also
  deletes phone numbers)", but that purge step is itself new (Story 12.9) and Epic 11 may ship first. The plan puts
  both steps on one existing sweep chosen by AD-58; no owner decision needed.
- **I12 (revision 6)** Input 15 says the next-7-days filter needs "no new SQL" and also that BUG-097 is fixed in the
  same story; the BUG-097 note says the fix needs "the same per-schedule zone rule as BUG-096", which may need SQL in
  `notEnded` and the sort key. The range itself needs none. Raised as Q12; **resolved 2026-11-27** (owner answer
  Q12: no new SQL beyond what BUG-097 needs, reusing `schedule_past_cutoff_date`).
- **I13 (revision 6)** Every backfill covers active events only, but the event links of Story 0.37 must go through
  `/go/` on every event page, past ones included. If the opaque link ids were stored, past events would need a data
  write. Raised as Q10; **resolved 2026-11-27** (owner answer Q10: ids derived at read time, no data write).
- **I14 (revision 6)** Input 15 calls the next-7-days story "independent of the other stories", while the
  `IDEA-261124-15a` header work it leaves behind includes the shared chevron trigger the owner mock uses for this
  dropdown. Story 11.22 uses the existing facet trigger; the chevron comes with `IDEA-261124-15a`. No owner decision
  needed unless the owner wants the chevron with 11.22.

---

## 10. Backlog registration

Row `CC-261124-vjh` (Registration options, CTA bar, composed highlight, honest dates and the extraction update;
proposal, `triaged`, note updated for revision 7) and these children in
`_bmad-output/implementation-artifacts/backlog.yaml`:
- `IDEA-261124-8jo` Own cover slide per event on multi-event carousels (backlog; decision 4: deferred, Story 11.17
  not built in Epic 11).
- `IDEA-261124-f6n` Merge the slide map into the per-event tier call (backlog; decision 7: stays separate, merge POC
  only when the cover is built).
- `IDEA-261124-wk6` Image-aware tier call on the stepped extraction path (backlog; decision 6 keeps it off; title
  updated from "Decide whether..." because the decision is taken; possible later story with a gate that stops promo
  price lists).
- `IDEA-261124-15a` Filter header: scrolling facet row, chevrons, AI button on the search row, icon buttons,
  collapse motion (backlog; retitled in revision 6: the time filter left it for Story 11.22).
- `IDEA-261124-nta` "Remind me" before a deadline or start, own epic (backlog; D9).
- `FIND-261124-axb` Remaining geocoding gaps (backlog until Stories 11.19, 11.20 and 11.21 exist; note updated in
  revision 6: covered by those stories, active schedules only). BUG-097 (TODAY/UPCOMING use the UTC date) is fixed
  by Story 11.22; its row is not edited by this run and is linked when 11.22 is created.
- `IDEA-261124-ofm` (new) Let the tier call read the post images (option B), only if the gate finds missed poster
  prices (backlog; threshold decided 2026-11-26: two or more in 40 posts read by eye; first reading 0 of 40).
- `IDEA-261124-xdv` (new) Optional reference from a registration button to a price tier (backlog; decision 10).
- `IDEA-261124-gj0` (new) Rule: a price stated for all events of a multi-event post is GENERAL (backlog; untested).
- `IDEA-261124-5yi` Ask the model for registration windows or trust its main flag (skipped).
- `IDEA-261124-ibh` Required `evidence` copy field on free-text extraction fields (skipped).
- `IDEA-261124-dtk` (new) Deterministic OCR instead of the slide-map model call (skipped; findings 11.20).
- `IDEA-261124-jz4` (new) Database trigger to keep `schedules.is_display` (skipped; input section 9).

---

## 11. Owner answers (record) and remaining questions

Revision 6 raised six questions (Q7 to Q12); the owner accepted every recommendation on 2026-11-27 (input section
16). **No question is open.**

Q1 to Q4 were asked in revision 3 and answered by the owner on 2026-11-26 (input section 12, which overrides
earlier wording). Q5 was asked in revision 4 and answered the same day (input section 13). The earlier
recommendation is kept next to each answer for the record.

- **Q1. Card highlight longer than 40 characters** (I10). Revision 3 recommended: two repairs, then the next item
  that fits. **Answer: no cut and no skip for length.** The card highlight is the first item of the detail list,
  stored whole; the UI shows an ellipsis when it does not fit. No 40-character limit in the data or the composer
  (column, validation, acceptance criteria, PRD and UX text). The buy-get cut at the condition word is dropped;
  removing academic degrees after the first comma of a name stays. The composer precision of 0.86 was measured
  with the length rule, so the first release with this change sets a new baseline. Applied in C4, 3.3, 4.1, 4.3,
  4.4, Stories 11.2, 11.3, 11.7, 11.14, decision 3, A4, handoff F and the backlog note.
- **Q2. Which flagged rows are dummy dates** (I9). **Answer: option A, as recommended.** `display_is_dummy` =
  flagged and stage neither `event` nor `other`; the card label comes from the stage. A competition `submission`
  row keeps its real start and end dates (it counts as the event date) and shows "Submit s/d". Only a flagged
  `registration` row uses its end date as the start date. Applied in C6, 3.5, AD-58, Stories 11.3 and 11.13.
- **Q3. Memory limit for the Story 12.2 gate. Answer: as recommended.** Replay peak memory with QR decoding at most
  10% above the measured peak of the same replay without it, and below 80% of the Lambda's configured memory.
  Applied in C1, C9, AD-57 and Story 12.2.
- **Q4. When the release gate triggers option B. Answer: as recommended.** Per release, 40 fresh posts are read by
  eye; option B is built when two or more ticket prices visible on the images were not returned by the
  extraction; one is reported and watched. Claude reads first; only doubtful posts go to the owner. A price label
  on a single product is not a ticket price. **First reading 2026-11-26: 0 of 40** (findings 11.22), so option B
  is not built. Applied in C9, Story 11.2 and backlog `IDEA-261124-ofm`.
- **A4. Release gate pass criteria: accepted as written in revision 3** (section 7).

- **Q5. Performer line on the card now that there is no length limit** (asked in revision 4). Revision 4
  recommended: every name in the item, the card stores it whole, "+N" no longer written into the data.
  **Answer (2026-11-26, input section 13):** a highlight that lists two or more items writes the item count in
  parentheses after the label and keeps every item ("Penampil (4): Band A, Band B, Band C, Band D"); the card
  stores that text whole and the UI ends it with an ellipsis, so the count stays visible. Applies to every list
  label; one item gets no count; single values (price hook, free entry) get no count; the count is part of the text,
  no count column; a format change goes through the rules version and the recompute step. "+N" and the cut to two
  names are withdrawn (this replaces the earlier acceptance of "+n"); a count in front of the label ("4 Penampil")
  was rejected. Applied in C4, 4.1 (edits 3 and 6), AD-59, 4.4, Stories 11.7 and 11.14, decision 3, A11c, the
  handoff (13F, rule F table, S50) and the backlog note.

- **Q6. A list whose values already start with the label word** (raised in revision 5, follows from Q5 and the
  "no doubled label" rule). Recommended: drop the leading label word from each list value that starts with it.
  **Answer (2026-11-26, input section 13, last bullet): as recommended.** In a list of two or more, a label word at
  the start of a value is dropped ("Hadiah (2): Rp5 juta, Rp3 juta"); a single item keeps the current rule (value as
  written, label not added a second time, no count). Applied in C4, 4.1 edit 3, AD-59, Story 11.7 and decision 3.

### Questions raised in revision 6, answered 2026-11-27 (input section 16: all as recommended)

- **Q7. Highlight recompute step (Story 11.7) for active events only? Answer: yes, as recommended.** The recompute
  step rewrites only rows of active events whose `highlight_rules_version` is older than the code's; past events keep
  the text stored when they were last written. Applied in C4, 4.1 edit 13, AD-59, Story 11.7, A14 and the success
  criteria.
- **Q8. Which accounts keep the default-location inheritance (Story 11.19)? Answer: as recommended.** Inherited only
  when the post's `PUBLISHER` account (else `posts.account_id`) is `ORGANIZER_VENUE_EVENT` with status `CONFIRMED`;
  every other case (`AWAITING_APPROVAL`, no account type, `PERSONAL`, `CURATOR_GUIDE`) gets no pin; inherited pins
  are marked `account_default`. Production read-only count of 2026-11-27 (active pins without location text,
  account taken from the event's earliest linked post, approximate): organizer or venue confirmed 167 (kept),
  curator confirmed 203 and no account type 59 (no pin under the rule). The 11.21 dry run shows the real counts
  before apply. Applied in C11, 4.1 edit 11, AD-14, 4.4, Stories 11.19 and 11.21, A15.
- **Q9. Re-geocode outcome when nothing is found (Story 11.21). Answer: as recommended.** The pin is cleared;
  schedules without text follow the Q8 rule; the dry run shows the counts per outcome to the owner before apply.
  Applied in C11, AD-14, 4.4 and Story 11.21.
- **Q10. Opaque ids for the event links of Story 0.37 (Story 12.4). Answer: as recommended.** Ids are derived at read
  time; no stored id and no data write; the public `Event.links` stops returning `url`; the correction dialog and the
  re-extract preview read full URLs through a gated query. The alternative (copy links into `registration_options`)
  is not taken. Applied in 3.3, 4.3 (AD-57 scope), Story 12.4 and I13.
- **Q11. What an old `?temporal=UPCOMING` link shows (Story 11.22). Answer: as recommended.** It is read as "Kapan
  saja" and the URL is rewritten without a history entry; GraphQL, the domain and saved AI filters keep `UPCOMING`
  with its meaning. Applied in C12, 4.1 edit 12, 4.4, Story 11.22 and the success criteria.
- **Q12. BUG-097 inside Story 11.22: the viewer's day, and SQL (I12). Answer: as recommended.** The viewer's day comes
  from `users.timezone` when set, else the browser's IANA time zone, else `Asia/Jakarta`; no new SQL beyond what
  BUG-097 needs, reusing `schedule_past_cutoff_date`. Applied in C12, 4.1 edit 12, AD-20, Story 11.22 and I12.
- **Outside the proposal:** the month-boundary bug of `THIS_WEEK` is fixed separately in PR #270 (BUG-261126-pwb, A
  THIS_WEEK date filter is 37 days long when the week crosses a month or year boundary); it touches the same file as
  Story 11.22 but another function, noted in Story 11.22.
