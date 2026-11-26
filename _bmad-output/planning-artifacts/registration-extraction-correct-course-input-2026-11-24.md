# Registration, CTA bar, highlight and extraction update: input for `bmad-correct-course` (2026-11-24)

Status: planning input, nothing implemented, no application source touched. It condenses the local POC session
(findings 11.x of `_bmad-output/poc/registration-extraction/findings.md`, handoff sections J to O) into the changes to
plan and the decisions already taken. The longer record stays in the files listed at the end.

## 0. How to use this

1. Start a fresh session. Read, in this order: `_bmad-output/project-context.md`, the active PRD
   (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`), this file, then the handoff
   `event-registration-cta-handoff-2026-11-20.md` (sections 1 to 2 and 9 to 13 for the owner's original ask and decisions; J to O for this session).
2. Run `bmad-correct-course` with this file as the change trigger. After it: `bmad-prd` (update), `bmad-ux`, `bmad-architecture`, then stories.
3. Do **not** run `bmad-create-epics-and-stories` on an epic that already has content (it regenerates the epic); use correct-course, architecture and create-story.
4. Planning isolation: nothing under `apps/` or `packages/` changes until stories exist. Label every story, backlog and AD id with a short title (the owner reads on mobile).

## 1. Why a course correction

The owner wants the event card and detail page to show one highlight, a registration bar, per-option prices and honest dates. The POC showed this
needs more than a UI change: the extraction must produce new facts (stage per schedule row, prizes, promos, take-home items, a free flag, performers),
a second small model call must produce tiers and location keywords, and the old data needs a backfill. The database today has `events.types`,
`schedules.performers` and `schedules.ticket_price`, but **no column** for prizes, promos, inclusions, free flag, stage, tiers or highlight.

## 2. Changes to plan (each with evidence, owner decisions and what is still open)

**C1. Registration separate from schedules, bottom bar and side card, phone and WhatsApp, QR link.** The owner's original ask and decisions D1 to D12 are in
handoff sections 1, 2, 9 to 11 and are unchanged. POC facts: 14.8% of posts carry a decodable QR, 43% of codes are on later slides, 68% of URL codes sit behind
redirectors; a decoder (zxing-wasm, about 2 MB with its WASM embedded) fits the AI-processor Lambda. A QR option from the model does not mean "register" (support, donation
and link-in-bio codes appeared as options in 12 of 15 runs): a payment payload is never a Register button, and a button needs a decoded payload. If the decoder is adopted,
update `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md` in the same change (CLAUDE.md section 4).

**C2. Stage per schedule row, main flag derived in code.** The registration window stays a schedule row; the model does not emit `opensOn` and `closesOn`.
`stage` (event, registration, submission, announcement, preparation) is a **required** field plus a code guard (when optional, a whole post lost it in a smoke run; when required 191 of 191 rows had it).
`isMainSchedule` is derived from the stage in code: the model's own flag sat on a non-counting row in 11% of main rows and 2 to 3 events had no main row. Stage varies between runs on 9% of rows.
Cost: about +770 prompt and +76 output tokens per post. Gate: one post collapsed 3 events to 1 after the added instruction, so the replay gate stays (see C9).

**C3. Facts for the highlight in the same extraction call.** Fields: `prizes`, `promos`, `inclusions`, `isFree`, `performers` (filled from "Bersama / Pembicara / Pemateri" lines too),
in bounded shapes with a request-level `maxOutputTokens`; **no `evidence` copy field** for free text (it caused runaway output, 2.2% of calls, and glued-on text). The new instructions go at the end of the prompt.
Open risk: the model leaves `performers` or `prizes` empty in one of two runs on about 4 of 60 captions, and never writes a vague prize such as "jutaan rupiah"; this is extraction variance to measure in the gate.

**C4. The highlight is composed in code from the facts (never written by the model).** Port `compose-highlight.mjs` (POC) to `packages/domain`. Owner rules in force:
- One highlight per event, at most 40 characters; a value that does not fit is skipped, never cut (except the two repairs below).
- Rule row by event type (`TYPE_RULES`, precedence PROMOTION, COMPETITION, PERFORMANCE, SEMINAR, WORKSHOP, FUNDRAISER, FESTIVAL, EXHIBITION, MARKET, CIVIC, GATHERING, OTHER); ladder per type.
- A promo needs a discount cue and a figure (a mention such as "diskon buku" is not an offer unless it is a free item, a buy-get or a bundle); an early-bird or presale price counts and is worded "Early bird <price>".
- Names of speakers, performers, instructors are valid highlights (also an account name); the speaker or performer comes **before "free"** on every type; a name that does not fit loses its degrees after the first comma.
- Stated free entry counts as a highlight; the model's `isFree` needs a free word in the caption.
- For a competition, what every participant gets (jersey, medal, bib, snack, refreshment, drinks, certificate, goodie bag) is not a highlight; for a workshop the take-home items are.
- PROMOTION: a price that is the hook ("Mulai dari 22K", "Hanya Rp11.000") is a highlight; a performer is the last resort.
- A long buy-get value is cut at its condition word; "Hadiah" is not written twice; a vague prize ("hadiah eksklusif") is not a prize.
Open: stored as a column or composed at read time (architecture decision); the same function must serve the card, the detail page and the re-extract preview.

**C5. One post-extraction text call (location keywords and tiers).** Today a post costs 2 requests (extraction and location keywords); this keeps it at 2 for a post with one event by merging the tier call into the location call (same input kind, both best-effort, parts validated separately, output cap = the sum).
Tier decisions are made in code from the model's list of every priced option (label, kind, audience, conditions, price, optional dates): tiers only when two distinct amounts exist **inside one event**; `fromPrice` = the lowest positive PUBLIC amount; audience enum PUBLIC, STUDENT, CHILD, MEMBER, LOCAL_RESIDENT, GROUP, OTHER.
For a post with two or more events the call needs the event list (it runs after extraction) and each option names its event; in the merged form it broke once in 7 posts (prices on the wrong events), so keep a **separate per-event tier call** there, or add a code check (identical options on one event, or an event without an option while others have one).
Requests per post under this plan: one event = 2 (extraction, one post-extraction call); several events = 3 (extraction, location, per-event tier; about 3% of posts); a multi-event carousel that adopts C8 = 4 (plus the slide map, about 1% of posts). Merging the slide map into the per-event tier call (both need the event list and, for the map, the images) would give 3 but is **not tested**; until it is, the slide map is its own call. Not valid on the stepped (cursor) extraction path, where location runs per step and tiers need all events; that path is off by default.
Measured: tier decision equal to the separate call on 58 of 59 posts; location differs only in style (same most specific keyword on 87% of strings, same country on all except online strings).

**C6. Dates for events without an event-day row.** Title rule v2 (`stage-classifier-v2.mjs`) is the first pass for old rows and a fallback (128 of 130 on held-out hand labels; 10% of titles are mixed). Fixes needed: a ticket-sale row with one date ("Presale 2", "Normal Ticket Sale") is the **event day** (sales stay open until the event starts); "collection" and "launch" in a product post are events, not preparation; titles that mix an announcement with a presentation or a prize-giving are the final day of the event (the rule checks "announcement" first and is wrong on them).
Owner decisions: (a) a competition with no competition day: the **submission** row counts as the event date; (b) a registration window with no event day (competition, anthology open call): the **end of registration** is the dummy event date shown in the list; (c) a race pack collection typed COMPETITION: dedup into the main event first (search the existing event), otherwise show it as it is with the end of registration as the dummy date (the pickup date when there is none); (d) dummy dates need a label ("Pendaftaran sampai 6 Nov") so the card does not claim an event day.
Open: events of other types with only non-counting rows (a workshop registration, a product launch not caught by the fix): suggestion = the next upcoming phase with its label, the event leaves the list after its last phase. Size: 103 stored events only have non-counting rows by rule v2 (21 are rule faults), 31 are real windows, about 30 are one registration date of unknown meaning.

**C7. Online-only locations are not geocoded.** All 72 online-only schedules found in production have a map pin and every pin is wrong (36 point to "Online" in Montpellier, 20 to "Sumber Air Online" in Bandung, businesses in the US and elsewhere). Cause: `normalizeLocationKeywords` drops "online", "zoom", "virtual" as generic, then `resolveSource` geocodes the raw text.
Change: a pure predicate in `packages/domain/src/events` next to `GENERIC_KEYWORDS` (true when no place is named after removing online words and meeting platforms); applied in `resolve-account-and-locations.ts` before `resolveSource` and `resolveText`; after the skip the schedule must **not** fall back to the account's default location; resolution value "online" (new value of the TypeScript `LocationResolution` type; the column is text). A hybrid text ("Online and offline at Hotel X") is still geocoded. Review SQL for the existing rows: `poc/registration-extraction/online-locations-review.sql` (read-only part, rollback copy, rolled-back UPDATE). Recommended for the 72 existing rows: clear the pin; needs the owner's go-ahead and the writer role.

**C8. Own cover per event on multi-event carousels (optional, own story).** The model says which events each slide shows; code gives each event the slide that shows it with the fewest events (only a slide dedicated to that event; otherwise the post cover). Stable on 6 carousels, right where a dedicated slide exists (five badminton draws; two category posters when the event names are right), safe fallback otherwise. It depends on the extraction finding the right events and on the slides the single request reads (cover plus `MAX_CAROUSEL_IMAGES`, default 5). Rule changes if adopted: bytes stay owned by the post (AD-30 Rule 1), the event stores a slide index pointing to a post-owned copy; only chosen slides are copied; consent gate (Rule 7) and face blur apply to every copied slide (today the blur covers the cover only); slides of a post without storage consent expire with the Instagram link (about 5 days). About 1 post in 100 is a multi-event carousel; decide whether it is worth it.

**C9. Release gate (replay) for any extraction prompt or schema change.** A new field or rule collapsed a real flyer to one event in 17 to 50% of runs in an earlier case; adding instructions collapsed 3 events to 1 here. Gate: interleaved A/B on real posts with images (6 or more runs), count events and schedules against production; a **fresh, never-read caption set per release** with labels written before the composer output is read; the number that counts is the first-look precision (the composer scored 0.86 precision and 0.85 recall on a fresh set before fixes and found five faults in 60 captions; fitted sets scored 1.00).

**C10. Backfill of existing events, after C2 to C7 are implemented.** Results go into the new database columns. Three layers: (1) code only, from stored data, for all events: stage (title rule v2 with the C6 fixes), main flag, tiers (the stored "NAME: Rp..." price string splits deterministically), performer highlight, online locations; (2) re-reading the caption for events that still have one: of 809 upcoming or ongoing events, 414 have a caption, 261 a usable image, 132 both, 129 only an image, **266 neither** (those get layer 1 only); the LLM extraction for this layer runs in a **local Claude session, not Gemini**, validated by the same schema and the same code; (3) a script with `--dry-run` and `--apply` and a rollback copy, run only with the owner's go-ahead and the writer credential. Moderator edits must not be overwritten; the grouping gate of C9 applies. Also: race pack events merge into their main event (16 of 17 had a same-name event; the dedup scoring must decide, a name key is too loose); three stored "Southblast Project" events are duplicates for the dedup flow.

## 3. Owner decisions already taken (do not reopen)

Phones stored for registration only with end + 1 day retention (D1, D2); slicing of the work (D3); speaker, performer and instructor names are highlights; the speaker comes before "free"; free entry counts; a promo needs a figure; take-home items count for workshops, not for competitions; PROMOTION price hook and performer as last resort;
online locations are not geocoded; submission row is the event date of a competition without a competition day; end of registration is the dummy date for windows, anthologies and race packs without a main event; race pack dedups into the main event first; the backfill runs after the implementation; ticket-sale rows with one date are the event day.

## 4. Open decisions for the planning session

| # | Decision | Suggestion |
|---|---|---|
| 1 | Clear the 72 existing online pins | Clear, with a rollback copy; owner go-ahead and writer role needed |
| 2 | Date for non-competition events with only non-counting rows | Next upcoming phase with its label; leaves the list after the last phase |
| 3 | Highlight stored as a column or composed at read time | Architecture decision; one shared function either way |
| 4 | Own cover per event on carousels | Optional story, after the extraction finds the right events |
| 5 | Wording of the dummy-date label on the card | "Pendaftaran sampai <date>" |
| 6 | Whether the cursor path gets the post-extraction call | Keep it off; document that C5 does not apply there |
| 7 | Merge the slide map into the per-event tier call for multi-event carousels | Untested; measure it only if C8 is adopted, otherwise keep a separate call |

## 5. Not recommended (measured or judged)

A required `evidence` field on free text (runaway output); asking the model for registration windows (reclassify the schedule row by title instead); one merged tier call for multi-event posts without the check of C5;
a QR channel taken from the model without a decoded payload; geocoding any location that names no place; trusting the model's main flag; claiming composer precision from a caption set that was used to write the rules.

## 6. Source map (all under `_bmad-output/`)

- `planning-artifacts/event-registration-cta-handoff-2026-11-20.md`: original ask, decisions D1 to D12, sections 9 to 13 and J to O (this session's results and owner answers).
- `poc/registration-extraction/findings.md`: sections 9 to 11.17 (QR, stage, tiers, composer, merged call, cover slides, poster timeline, fresh-set results); `STATUS.md`: what was done and what is left.
- `poc/registration-extraction/`: `compose-highlight.mjs` and its tests, `tier-options.mjs`, `slide-cover.mjs`, `stage-classifier-v2.mjs`, `online-locations-review.sql`, `merge-call.ts`, `slide-map.ts`, `ab-highlight.ts` (replay), `quota-budget.mjs` (POC only).
- Real captions, labels and post URLs stay in the gitignored `poc/registration-extraction/private/`; nothing real was committed.

## 7. Owner answers after the review of PR #265 (2026-11-24)

The numbers are those of the review findings of the Sprint Change Proposal (PR #265). Use them in the revision round.

- **Finding 1 (old events have no stage, so no date rule):** the owner proposes to avoid the problem by rollout order: the UI that reads `stage` is deployed (or enabled) only after the layer-1 backfill has run. Assessed as feasible with a gate; the revision writes it as a rollout rule: (a) deploy the migration (column with default `event`) and the extraction that writes `stage`, with nothing reading it; (b) run the layer-1 backfill; (c) enable the readers (display date, card) when a check finds no schedule row without a real stage. The default `event` keeps today's behaviour for any row created in between, so the rule needs no extra fallback code.
- **Finding 3 (a new race-pack post must merge into the main event first):** follow the reviewer's suggestion: add the matching rule for new posts (note on Story 3.6v plus a story in the new epic), not only in the backfill.
- **Finding 6 (sixth stage `other`):** yes, `other` stays as a sixth stage value. Open sub-question for the revision: does a row with stage `other` count as an event day (suggestion: no, but an event whose rows are all `other` is treated as `event`, so no event is hidden).
- **Finding 8 (Open decision 8):** decided: registration windows **stay schedule rows** with `stage = registration`; only links, phones and prices move to registration options. The D6 deletion of legacy registration schedule rows is withdrawn; update the PRD and the handoff so they no longer say "overturn the registration-windows-are-schedules rule".
- **Finding 9 (size of Epic 11):** agreed: split it into two epics, one for extraction and dates, one for registration and CTA, at the epic readiness check.
- **Finding 10 (stale base):** process rule: always pull `master` into the working branch before pushing, before opening a PR and before a planning run (cloud routine prompts start with a fetch of `master`).
- Findings 2, 4, 5 and 7 (a story for title rule v2, QR scope as a decision, Story 0.35 reference, the gate threshold) were not answered; the revision includes them as proposals.
- **New rule proposed by the owner (event detail):** links and call-to-action targets that come from organizer or scraped data are not put in the page; the page asks an endpoint and follows its answer (opens a new tab or a phone or WhatsApp action). Under assessment: see the analysis in the review thread; the revision decides its shape (AD-55 and AD-57).

## 8. Owner decisions in the popup round of 2026-11-25 (open decisions of the proposal)

Numbers are the proposal's open decisions (section 6). Use them in the next revision round; they replace the proposals in the table.

- **Open decision 3 (highlight stored or read-time): DECIDED, hybrid.** The highlight of the **list card** is stored (40 characters), together with a rules-version number; a light recompute job (no LLM, from the stored facts) refreshes rows whose version is old when the rules change; every write path (extraction, manual correction, merge, re-extract apply) computes it through the one shared function. The **event detail** composes at read time and has no character limit: the same function in a "detail" mode returns an ordered list of highlights from all rungs of the type ladder that have content (all names, all prizes, promos, price hook, free, take-home items). The card highlight is the first item of that list, cut to 40 characters, so card and detail cannot disagree.
- **Open decision 6 (cursor path): DECIDED by POC, option A.** No tier call on the stepped path; location stays per step; document the limit in AD-60. Evidence: findings 11.18 (the caption is mostly gone on long carousels, so the text-only call finds nothing; the image call found a real tier list on 1 post in 32 and read promo price lists as tiers on 3).
- **Open decision 9 (evidence): DECIDED, option A.** No `evidence` field; options whose source is an image get `lowConfidence` set by code; the moderator opens the original post.
- **Open decision 10 (one price structure): DECIDED by evidence, option C.** Tiers belong to the event; registration buttons carry no price (a reference from a button to a tier is an optional later field). Request count is the same for all options; the pairing is too rare to measure (findings 11.19). The owner may overrule.
- **Open decision 11 (QR): DECIDED, option B.** Adopt the decoder, but Story 12.2 ships last in Epic 12, behind a memory gate: only after the cause of the AI-processor Lambda out-of-memory (since 2026-11-20) is understood and the replay shows the peak memory does not rise above a set limit; decoding runs on a downscaled copy of the image. Slice 1 (buttons from caption links, phone, WhatsApp) does not wait for QR.
- **Open decision 12 (`other` stage): DECIDED, option A.** `other` does not count as an event day, but an event whose rows are all `other` is treated as `event`.
- Still open: 1 (clear the 72 online pins), 2 (date for non-competition events with only non-counting rows), 4 (own cover per event), 5 (wording of the dummy-date label), 7 (slide map merged into the tier call).

## 9. Owner decisions of 2026-11-25: how the list query handles `other`, dummy dates and several schedules

These replace the earlier idea of storing three copied dates (and the "enable the readers after the gate" switch of rollout rule 3.5).

- **Decided: a flag on the schedule row (the owner's idea) plus generated date columns.** Add `schedules.is_display boolean NOT NULL DEFAULT true`. The application keeps only this boolean, through one domain function (`computeDisplayFlags`) that applies every date rule to all rows of one event: stage `event` counts; `other` counts only when all rows of the event are `other` (then the event is treated as `event`); a competition without a competition day: its `submission` row counts; a registration window with no event day (competition, anthology open call): the `registration` row is the dummy date; a race pack without a main event: the end of registration, else the pickup row. A flagged row is a dummy date exactly when its stage is `registration`.
- **Generated columns (Postgres derives them from the row itself, so they cannot go stale against the real dates):** `display_start_date` (the real start date; the real END date for a flagged `registration` row), `display_end_date`, and `display_is_dummy` (flagged and stage `registration`), all NULL or false when `is_display` is false. Several schedules or several main schedules in one event are fine: every row has its own flag, and the order key still picks the nearest upcoming one among the flagged rows. No copy lives on the parent `events` row.
- **List query:** its shape does not change. `overlaps` and `notEnded` and the three ORDER BY subqueries (next upcoming, main, earliest) read the `display_*` columns through the AD-17 field-map descriptor (`startCol`, `endCol`) with the condition `is_display`; a partial index `schedule_display_date_idx ON schedules (event_id, COALESCE(display_end_date, display_start_date), display_start_date) WHERE is_display` carries them. The per-schedule timezone cutoff (BUG-096, migration 0090) is untouched.
- **Rollout:** the migration adds `is_display` with default true, so every row is flagged and `display_*` equals the real dates (behaviour identical to today); the readers can switch at once. The layer-1 backfill sets stages and recomputes the flags, which is what changes the rows that differ (registration windows stop winning the date). New events are honest from the start. Story 11.12 becomes the consistency check (recompute the flags of every event and compare), not a switch; Story 11.13 becomes "compute the flags on write and point the field map at the `display_*` columns". AD-58, AD-17 and AD-20 get amendments.
- **Who keeps the flag: decided, application function plus a healing sweep.** The one function is called by every schedule write path (extraction ingestion, manual correction, merge, set primary post, re-extract apply, backfill, admin scripts), guarded by the ratchet 11.z; a step of the existing scheduled sweep (the one that also deletes phone numbers after the event) recomputes the flags of every event, repairs the ones that differ and logs the number repaired (a non-zero count means some write path forgot the function). No database trigger (it would duplicate the rules in plpgsql).

## 10. Owner decisions of 2026-11-26 (the last five open decisions) and two POC results

- **Open decision 1 (72 online pins): DECIDED, option A.** Clear them after Story 11.9 ships, with the script's `--dry-run`, `--apply` and rollback copy (Story 11.16); needs the owner's go-ahead and the writer role.
- **Open decision 2 (non-competition events with no counting row): DECIDED, option A.** Flag every non-counting row of the event; the query picks the nearest upcoming one, the card labels it by its stage, and the event leaves the list after its last phase.
- **Owner idea under decision 2, measured (findings 11.21):** the post-extraction call also returns `coreEventName` (a stand-alone name without the activity words) and `activityType`. It finds 88% of same-series pairs against 43% for raw names and 73% for a code rule, never merged two different series, and finds the main event of 13 of 15 activity items by exact name; the two near-misses need the dedup scoring. Use it as a matching input for the race-pack matcher (Story 11.10), never as the displayed name; add it to the post-extraction call (no extra request) and measure it inside the merged call before release.
- **Open decision 4 (own cover per event): DECIDED, option A, deferred** (backlog IDEA-261124-8jo; Story 11.17 not built in Epic 11). The deterministic OCR alternative the owner asked about was measured and is not good enough (findings 11.20: 1 of 5 dedicated slides found, the model 5).
- **Open decision 5 (dummy-date label): DECIDED, option A.** Short on the card, full on the detail: "Daftar s/d 6 Nov" ("Register by 6 Nov"), "Pengumuman 17 Okt", "Ambil kit 13 Nov", "Submit s/d 12 Nov"; the detail page writes the full sentence ("Pendaftaran sampai 6 November 2026").
- **Open decision 7 (slide map merged into the tier call): DECIDED, option A.** Stays separate; run a merge POC only when the cover per event is built (backlog IDEA-261124-f6n).
- All twelve open decisions of the proposal are now answered (8, 3, 6, 9, 10, 11, 12 earlier; 1, 2, 4, 5, 7 here).
- **Core event name, DECIDED 2026-11-26 (owner: "correct course", not backlog).** It is part of this course, inside existing stories, not a new one:
  - Story 11.3 (columns): add `core_event_name` and `activity_type` on `events`.
  - Story 11.8 (post-extraction call): return `coreEventName` and `activityType` in the same call (no extra request); measure it inside the merged call before release (only the separate call was measured).
  - Story 11.10 (race-pack matching): use them as input to the dedup scoring (name similarity and dates), never an exact key; `activityType = RACE_PACK_COLLECTION` is the race-pack signal. Matching only, never the displayed name.
  - Existing events have no core name, and a new race pack is matched against stored main events: the revision plans how to fill them (a code rule in the layer-1 backfill, Story 11.11, as a first fill, about 73% on the test set, an optimistic figure; the local-session re-read, Story 11.15, for the rest).

## 11. Input of the tier call (owner decision of 2026-11-26) and one correction

- **DECIDED: option A, with B as fallback only if A proves insufficient.** The post-extraction tier call (merged or per event) reads the caption **and the price string the main extraction returned for each event**, not the caption alone. This changes C5 and Story 11.8.
- Measured (findings 11.22): amounts found 32 of 68 with the caption alone, 67 of 68 with the strings, 68 of 68 with the images; tiers emitted when due 12, 20 and 20 of 20. In 40 posts with no stored price the images call found no missed ticket price, so **B is not built**.
- **`ticketPrice` stays an output of the main extraction for new events**, because on poster-only posts it is the only record of the price the tier call sees. Any wording that says a per-option price replaces `ticketPrice` for new events must be changed: the tier options are added beside it.
- The release gate (C9) measures what would trigger B: ticket prices visible on the images that the extraction did not return, on a fresh sample read by eye.
- Multi-event posts with one fee for many events stay weak (strings repeat the extraction's per-event inconsistency). The gate counts events with a missing or extra tier; a rule "a price stated for all events is GENERAL" is not tested.
- Backfill layer 2: the stored price string of a merged event can come from another post; it is already what the site shows, so it adds no new error, but it is not proof that this post states it.
- **Correction:** the earlier statement that prices only on the poster are rare (findings 11.9, 1 of 53) was drawn from a sample picked by caption price cues. In production 131 of 417 priced events with a caption (31%) have the amount only on the images.

## 12. Owner answers to the four questions of revision 3 (2026-11-26)

These override any earlier wording, including the 40-character rule in section 2 and in section 8 (open decision 3).

- **Q1, card highlight length: no cut and no skip for length.** The card highlight is the first item of the detail list, stored whole; the UI shows an ellipsis when it does not fit. There is no 40-character limit in the data or the composer (column, validation, acceptance criteria, PRD and UX text). The cut of a buy-get promotion at its condition word existed only to fit, so it is dropped; removing academic degrees after the first comma of a name stays. The composer precision of 0.86 was measured with the length rule, so the first release with this change sets a new baseline.
- **Q2, which flagged rows are dummy dates: option A.** `display_is_dummy` = flagged and stage neither `event` nor `other`; the card label comes from the stage. A competition `submission` row keeps its real start and end dates (it counts as the event date) and shows the "Submit s/d" label. Only a flagged `registration` row uses its end date as the start date, as in section 9.
- **Q3, memory gate of the QR story (12.2): decided as recommended.** Replay peak memory with QR decoding at most 10% above the measured peak of the same replay without it, and below 80% of the Lambda's configured memory.
- **Q4, trigger of option B (the tier call reading images): decided as recommended.** Per release, 40 fresh posts are read by eye; option B is built when two or more ticket prices visible on the images were not returned by the extraction; one is reported and watched. The reading is done by Claude first; only doubtful posts go to the owner. A price label on a single product is not a ticket price.
- **First reading, 2026-11-26: 0 of 40 posts** (findings 11.22), so option B is not built.
- **A4, release gate pass criteria: accepted as written in revision 3.** The new arm does not lose events or schedules on a gate post more often than the production arm; first-look composer precision on the release's fresh caption set is not worse than the previous release's (read with the sampling noise of a 60-caption set); zero output-cap hits; the other figures are reported, not gated.

## 13. Owner answer to question 5 of revision 4: list highlights carry a count (2026-11-26)

- **DECIDED:** a highlight that lists two or more items writes the number of items in parentheses after the label and keeps every item: `Penampil (4): Band A, Band B, Band C, Band D`. The card stores that text whole and the UI ends it with an ellipsis, so the count stays visible at the start.
- Applies to every list label (performers, speakers, instructors, judges, prizes, take-home items, promos and the like). One item gets no count. Single values (price hook, free entry) get no count.
- The count is part of the composed text; **no separate count column**. A later format change is handled by the highlight rules version and the recompute job.
- **"+N" and the cut to two names are withdrawn** (this replaces the earlier acceptance of "+n"). A count in front of the label ("4 Penampil") was rejected because it reads wrongly for some labels ("3 Peserta dapat").
- **Label not repeated (owner agreed 2026-11-26):** in a list of two or more items, a label word at the start of a value is dropped ("Hadiah (2): Rp5 juta, Rp3 juta", not "Hadiah (2): Hadiah Rp5 juta, Hadiah Rp3 juta"). A single item keeps the current rule: the value as written, the label not added a second time.

## 14. Owner review of the proposal's story list (2026-11-26)

- **DECIDED: the organizer links shown today move onto `/go/` inside Story 12.4.** The owner rule "every link and CTA goes through the first-party endpoint" covers the links of Story 0.37 (Extract and display event links) too. This replaces assumption A12 and the "follow-up, not part of this course" sentence in section 3 of the proposal; the ratchet 12.z covers them.
