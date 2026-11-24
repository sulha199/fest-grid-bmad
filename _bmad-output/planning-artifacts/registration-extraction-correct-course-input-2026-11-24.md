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
