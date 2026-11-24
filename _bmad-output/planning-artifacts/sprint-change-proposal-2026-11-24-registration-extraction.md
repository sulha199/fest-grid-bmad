---
backlog_id: CC-261124-vjh
date: 2026-11-24
trigger_story: none (POC-driven owner request; change trigger = planning-artifacts/registration-extraction-correct-course-input-2026-11-24.md)
scope: Major
mode: Batch (unattended scheduled run; nobody could answer questions)
status: proposed (awaiting owner approval; NOT approved)
---

# Sprint Change Proposal: registration, CTA bar, highlight, honest dates and the extraction update

Produced by `bmad-correct-course` in an unattended cloud session. Planning only: nothing under `apps/` or
`packages/` changed, `sprint-status.yaml` and `epics.md` were not edited. Every edit below is a **proposal**
to be applied after the owner approves this document (workflow step 5 was not run).

Read with: `_bmad-output/project-context.md`, the PRD
(`prds/festgrid-prd-2026-07-10-2047/prd.md`), the change trigger
(`registration-extraction-correct-course-input-2026-11-24.md`, sections C1 to C10 below follow its numbering),
the handoff `event-registration-cta-handoff-2026-11-20.md` (sections 1-2, 9-13, J-O) and
`poc/registration-extraction/findings.md` (sections 9-11.17).

How this run handled decisions:
- **Owner decisions already taken** (input section 3, handoff D1-D12) are applied as final.
- **Open decisions** (input section 4) are listed in section 6 as "Open decision N" with the input's suggestion
  marked **Proposal**; nothing was guessed.
- Any other question the workflow would ask was answered with the most conservative option, listed in section 7
  ("Assumptions").

---

## 1. Issue summary

**Problem.** The owner wants the event card and the detail page to show one highlight, a registration bar
(bottom bar on phones, side card on desktop), per-option prices and honest dates. The POC showed this is not a
UI change: the extraction must produce new facts (stage per schedule row, prizes, promos, take-home items, a
free flag, performers from speaker lines), a second small text call must produce price tiers and location
keywords, and the existing data needs a backfill. The database today has `events.types`,
`schedules.performers` and `schedules.ticket_price`, but **no column** for prizes, promos, inclusions, free
flag, stage, tiers or highlight.

**Category.** New requirement from the owner, backed by a measured POC; plus two defects found on the way
(online locations geocoded to wrong places, registration windows winning the card date).

**Evidence (from the POC, all redacted, sample ids only).**
- QR: 14.8% of posts carry a decodable QR, 43% of codes sit on later slides, 68% of URL codes are behind
  redirectors; a model "QR option" was a support/donation/link-in-bio code in 12 of 15 runs (findings 9.3-9.4).
- Stage: required `stage` filled on 191 of 191 rows; the model's own main flag sat on a non-counting row on
  11% of main rows and 2-3 events had no main row; one post collapsed 3 events to 1 (findings 10.1, 11.1).
- Highlight composer: first-look precision 0.86 / recall 0.85 on a fresh 60-caption set; facts vary between
  runs on 23% of captions (findings 11.15, 11.17).
- Tiers: separate call equal to the merged call on 58 of 59 posts; the merged call put prices on the wrong
  event in 1 of 7 multi-event posts (findings 11.10, 11.12).
- Online locations: all 72 online-only schedules in production carry a wrong pin (handoff L).
- Dates: 103 stored events have only non-counting rows by title rule v2 (handoff M).

---

## 2. Checklist record (`checklist.md`)

| Item | Status | Note |
|---|---|---|
| 1.1 Trigger story | [N/A] | No story; trigger is the POC input file (owner request + POC). |
| 1.2 Core problem | [x] | New requirement + two data defects (section 1). |
| 1.3 Evidence | [x] | Findings 9-11.17, handoff J-O. |
| 2.1 Current epic | [x] | No single epic owns this; Epic 3 (extraction) and Epic 1/1.i1 (card, detail) are touched but can finish as planned. |
| 2.2 Epic-level change | [!] | **New epic proposed** (Epic 11, section 5.1). Existing epics get notes, not new scope. |
| 2.3 Future epics | [x] | Epic 9 (AI filter, `isFree`), Epic 10 (re-extract preview) touched, section 3.2. |
| 2.4 Obsolete / new epics | [x] | None obsolete. One new epic; a "Remind me" epic stays separate (D9), carved out. |
| 2.5 Order | [x] | Section 8. |
| 3.1 PRD | [!] | Many sections, section 4.1. MVP goals unchanged; scope grows. |
| 3.2 Architecture | [!] | New ADs and amendments, section 4.3. |
| 3.3 UX | [!] | Card, detail bar, side card, sheet, dummy-date label, section 4.4. |
| 3.4 Other artifacts | [!] | `docs/infrastructure/architecture-diagram.md` + `high-level-overview.md` (QR library, new table, purge step); extraction eval docs; RLS test. |
| 4.1 Direct adjustment | Viable | As a new epic inside the current plan. Effort High, risk Medium. |
| 4.2 Rollback | Not viable | Nothing shipped to roll back. |
| 4.3 MVP review | Not needed | MVP goals hold; the work is additive. |
| 4.4 Path | [x] | Direct adjustment through a new feature epic, gated by a replay gate (section 3.3). |
| 5.x Proposal parts | [x] | This document. |
| 6.1-6.2 Review | [x] | Self-reviewed; inconsistencies listed in section 9. |
| 6.3 Approval | [!] | **Not obtained (unattended run). Stops here.** |
| 6.4 sprint-status | [N/A until approval] | Not edited. Proposed keys in section 5.1. |
| 6.4a backlog.yaml | [x] | Row `CC-261124-vjh` (status `triaged`) and 8 child rows added; checks run (section 10). |
| 6.5 Handoff | [x] | Section 8. |

---

## 3. Impact analysis

### 3.1 Change by change (C1-C10)

Every item lists: PRD effect, epics/stories affected, new stories (ids proposed in section 5.1), ADs.

**C1. Registration separate from schedules; bottom bar and side card; phone and WhatsApp; QR link.**
- PRD: new feature section "Event registration and call to action" (owner ask 1-8, D1-D12); new
  `RegistrationOption` interface in section 4; privacy amendment to 4.1 (`contactInfo`/`hasPrivateContact`),
  3.16 and 5 Security (D1: a public registration phone may be stored for registration only; D2: hard delete at
  event end + 1 day, and on takedown, permanent delete and a re-extract that no longer finds it; raw caption
  blanked 30 days after expiry, handoff 8). QR rule: a button needs a **decoded** payload; a payment payload is
  never a Register button; the destination host is always shown.
- Stories affected: 3.6i (Classify and discard private contact; reversed for registration phones only, slice
  2), 3.6l (Single-request carousel extraction; QR decoding reads the same slides), 3.6v (Match and enrich in
  place) and 3.6w (Moderator merge): both must union registration options; 1.6 / 1.6a / 1.6e / 1.6f (Event
  detail view and refinements): header loses heart/calendar/share to the bar (D10); 4.2 + 10.6 (AI-assisted
  correction, re-extract on the job engine): preview shows options, persists nothing until apply (AD-40).
- New stories: 11.10, 11.11, 11.12, 11.13 (slice 1), 11.16, 11.17, 11.18 (slice 2). Slice 3 (price and
  eligibility per option) is covered by the tier work of C5, see Open decision 10.
- ADs: new **AD-55 (Registration options table, bounded-retention contact, AD-8 hard-delete exception, cache
  split)**, new **AD-56 (Deterministic phone detector and contact scrub)**, new **AD-57 (QR decode step and
  link trust policy)**; amends **AD-8 (Soft-delete convention)** exception list, **AD-29 (Extraction audit
  log)** retention of numbers, **AD-33 (Z-index tiers)** bar on `z-overlay-sticky`, **AD-40 (Write-free
  re-extract preview)**, **AD-30 Rule 7 (Cross-post matching)** for a `sharedLink` clue and **AD-30 Rule 9
  (Enrichment and merge)** for the option union. Infra docs updated in the same change as zxing-wasm (CLAUDE.md
  section 4).

**C2. Stage per schedule row; main flag derived in code.**
- PRD: 4.4 Schedule gains required `stage` (`event | registration | submission | announcement | preparation`;
  the POC enum also has `other`, see assumption A6); `isMainSchedule` becomes a value derived in code from the
  stage, never taken from the model. The registration **window** stays a schedule row (the model does not emit
  `opensOn`/`closesOn`); the multi-event rule "registration windows are schedules of the event" (PRD 3.7, line
  ~93) **stays**. See inconsistency I1 and Open decision 8.
- Stories affected: 3.6s (Multi-event extraction with grouping rules; prompt gains stage), 3.6p (Extraction
  audit log; record stage-guard repairs), 4.1 / 4.1b (Manual correction form; edits the main schedule, which is
  now derived; the form needs a stage field or a rule for which row is main), FR28 calendar title (unchanged
  wording, now fed by the derived flag).
- New stories: 11.3 (schema), 11.4.
- ADs: amends **AD-30 Rule 5 (Extraction contract)**: payload gains `stage`, grouping rule (4) unchanged;
  new **AD-58 (Stage per schedule row; main flag and display date derived in code)**.

**C3. Facts for the highlight in the extraction call.**
- PRD: 4.1 EventInfo gains `prizes[]`, `promos[]`, `inclusions[]`, `isFree`; 4.4 `performers` also filled from
  "Bersama / Pembicara / Pemateri" lines. Bounded shapes, request-level `maxOutputTokens`, **no `evidence` copy
  field** on free text (input section 5), new instructions at the end of the prompt.
- Stories affected: 3.6s (prompt), 3.6j (Performer-contact leakage guard; must still run on the wider performer
  rule), 3.6p (audit log), Epic 9 / PRD 4.18 (AI filter `isFree` exact-match on `ticketPrice` text; a stored
  `isFree` can serve it later, not in this course).
- New stories: 11.1 (prompt seam), 11.5.
- ADs: **AD-30 Rule 5**, **AD-49 (Truncation and usage reporting)** for the output cap; the Gemini
  `responseSchema` size limit (project-context, 2026-10-30) applies to every new enum.

**C4. Highlight composed in code from the facts.**
- PRD: 3.1 Event Discovery and 4.1: one highlight per event, at most 40 characters, composed by one function
  from typed facts with the owner rules listed in the input (type ladder and precedence; promo needs a cue and a
  figure; early bird wording; names are valid and come **before "free" on every type**; stated free counts and
  the model's `isFree` needs a free word; competition common perks are not highlights, workshop take-home items
  are; PROMOTION price hook, performer last resort; buy-get cut at its condition word; no doubled "Hadiah"; vague
  prize is not a prize). D12: no highlight when absent; scope or category labels are not highlights; a highlight
  is never a paid slot (Mary R8). The model never writes the highlight.
- Stories affected: 1.3b (Reusable EventCard), Epic 1.i1 primitives (status/nearby badge 1.i1i, date box
  1.i1k), 1.6a (detail view), 4.2 / 10.6 (re-extract preview shows the composed highlight).
- New stories: 11.6 (port `compose-highlight.mjs` to `packages/domain`), 11.14 (card).
- ADs: new **AD-59 (Highlight is composed in code by one shared function)**; **AD-17 (Computed field batching /
  list field map)** if stored or composed on the list path; Open decision 3 (column vs read time).

**C5. One post-extraction text call (location keywords and tiers).**
- PRD: 3.8 gains a request budget per post (section 3.4 below); 4.4 `ticketPrice` replaced for new events by
  priced options/tiers (D5); tiers only when two distinct amounts exist **inside one event**; `fromPrice` = lowest
  positive PUBLIC amount; audience enum `PUBLIC, STUDENT, CHILD, MEMBER, LOCAL_RESIDENT, GROUP, OTHER`.
- Stories affected: 0.35 (ticketPrice "from" label pairing; superseded by `fromPrice` for new events, kept for
  legacy rows until backfill), the location-keywords quick-dev spec
  (`implementation-artifacts/spec-location-keywords-extraction.md`) and its deferred findings row
  (backlog FIND for the keywords call: replayed cursor step repeats the paid call).
- New stories: 11.7.
- ADs: new **AD-60 (Post-extraction call shape and request budget per post)**; amends **AD-30 Rule 5**
  ("one Gemini call per post" describes the extraction call only), **AD-52 (Retry policy)** for a best-effort
  second call, **AD-46 / AD-51 (Stepped extraction, bounded work)**: C5 does not apply on the stepped path
  (Open decision 6).

**C6. Dates for events without an event-day row.**
- PRD: 3.1 Default View and Event Status Badge: the card date comes from counting rows (stage `event`);
  owner rules (a) COMPETITION without a competition day: submission row counts; (b) window without event day
  (competition, anthology open call): end of registration is the dummy date; (c) race pack typed COMPETITION:
  dedup into the main event first, else end of registration (pickup date when none); (d) a dummy date always
  carries a label so the card never claims an event day. Ticket-sale rows with one date are the event day.
  Title rule v2 is the first pass for old rows and a fallback, with the three fixes in the input.
- Stories affected: 0.i5d (Temporal filter in the FilterHub; AD-20), `selectDisplaySchedule` and the
  `Query.events` ORDER BY subquery (Story 1.x list query; AD-17, AD-20), 1.i1i (status badge), 3.6v
  (race-pack merge uses the dedup scoring, not a name key), backlog IDEA-261121-tvh (Repost guard for multi-event
  siblings; related, not in scope).
- New stories: 11.8.
- ADs: **AD-58** (above), amends **AD-20 (Temporal filter `!ended`)** and **AD-17**; Open decisions 2 and 5.

**C7. Online-only locations are not geocoded.**
- PRD: 4.3 LocationDetails / 4.4 Schedule: an online-only location has no coordinates and no map pin; it never
  falls back to the account's default location; a hybrid text is still geocoded. Resolution value `online` (new
  member of the TypeScript `LocationResolution` type; column is text, no migration).
- Stories affected: 0.i7a-0.i7c (Confidence-aware Geoapify resolution; the map link gate must also hide on
  `online`), 1.6e (detail schedule location link).
- New stories: 11.9; existing-row cleanup in 11.22.
- ADs: amends **AD-14 (Geoapify confidence propagation)** with the `online` resolution.

**C8. Own cover per event on multi-event carousels (optional).**
- PRD: 3.4 (3.3.5 media) and 3.16: an event may show a dedicated slide of its post as thumbnail.
- Stories affected: 3.6l, 3.6n / 3.20 / 3.21 (face blur covers the cover only today), 3.6h (consent-gated
  re-hosting).
- New stories: 11.19 (optional, gated by Open decisions 4 and 7).
- ADs: **AD-30 Rule 1 (Tables and columns)**: the event stores a slide index pointing to a post-owned copy,
  bytes stay with the post; **AD-12 Rule 7 (Consent gate)** and **AD-28 (Face-blurred thumbnails)** apply to
  every copied slide; **AD-13 (Single-request carousel extraction)** for the slide-map call. See inconsistency
  I2 about "Rule 7".

**C9. Release gate (replay) for any extraction prompt or schema change.**
- PRD: section 5 "AI Extraction Quality" gains the gate (interleaved A/B on real posts with images, 6+ runs,
  events and schedules counted against production; a fresh never-read caption set per release, labels written
  before the composer output is read; first-look precision is the number that counts).
- Stories affected: every story that changes the prompt or schema (11.4, 11.5, 11.7); the extraction accuracy
  eval (`docs/infrastructure/extraction-accuracy-eval.md`, `packages/domain/src/extraction-eval/`).
- New stories: 11.1 (prompt seam), 11.2 (gate).
- ADs: new **AD-61 (Replay release gate for extraction changes)**.

**C10. Backfill of existing events (after C2-C7 ship).**
- PRD: none beyond the fields above; it is a one-off data operation (results into the new columns; moderator
  edits never overwritten).
- Layers: (1) code-only for all events (stage by rule v2 with C6 fixes, main flag, tiers from the stored
  "NAME: Rp..." string, performer highlight, online locations); (2) caption re-read for the 414 of 809
  upcoming/ongoing events with a caption or the 129 with only an image, extraction run in a **local Claude
  session, not Gemini**, validated by the same schema and code; 266 events get layer 1 only; (3) a script with
  `--dry-run`, `--apply` and a rollback copy, run only with the owner's go-ahead and the writer credential.
  Race-pack events merge through the dedup scoring; three stored duplicate events of one project go to the dedup
  flow.
- Stories affected: 3.6v / 3.6w (merge), 3.4o (curator caption nulling) and the 30-day caption blanking (fewer
  captions over time; run layer 2 early after the code ships).
- New stories: 11.20, 11.21, 11.22.
- ADs: **AD-30 Rule 7 and Rule 9** (race-pack merge, moderator edits preserved); **AD-45 (CI bridge for a
  credential-less agent)** does not cover writes of this kind: the apply step stays with the owner.

### 3.2 Epics touched

| Epic | Effect |
|---|---|
| Epic 3 (Social Media Event Integration), in progress | Notes on 3.6i, 3.6j, 3.6l, 3.6p, 3.6s, 3.6v, 3.6w, 3.6n/3.20/3.21; no new stories here (they go to Epic 11). |
| Epic 1 (Core App and Event Discovery) and Epic 1.i1 (One card primitive), in progress | Card redesign (11.14) supersedes the date box and footer of 1.3b/1.i1k; detail stories 1.6/1.6a/1.6e/1.6f gain the bar (11.12). Do not fork the card; go through EVENT-CARD-DESIGN.md. |
| Epic 0.i7 (Confidence-aware Geoapify resolution), in progress | `online` resolution must be honoured by 0.i7c's map-link gate. |
| Epic 4 (Data Quality and Moderation) | 4.1/4.1b correction form vs derived main flag; 4.2 preview shows composed highlight and options. |
| Epic 9 (AI Prompt Filter v1.1), backlog | `isFree` column available later; no change now. |
| Epic 10 (Background vendor jobs), in progress | 10.6/10.6a re-extract preview must run the new post-extraction call and composer and keep AD-40's write-free rule. |
| **Epic 11 (new)** | Section 5.1. |

### 3.3 Technical impact
- New columns: `schedules.stage`; event facts (`prizes`, `promos`, `inclusions`, `is_free`); tiers (table or
  jsonb, AD decision); `fromPrice`; possibly `highlight` (Open decision 3); new table `registration_options`
  (AD-55); a purge step on the existing scheduled sweep (no new Lambda or queue expected).
- New library: `zxing-wasm` (about 2 MB with WASM embedded) in the AI-processor Lambda bundle; `libphonenumber-js`
  for slice 2.
- New pure domain functions in `packages/domain`: stage guard and derived main flag, display-date rule, title
  rule v2, `composeHighlight`, `decideTiersPerEvent`, `isOnlineOnlyLocation` (next to `GENERIC_KEYWORDS`),
  `detectRegistrationPhones`, `scrubContactData`, `resolveEventActions`. All 100% unit tested (PR template rule).
- `Query.events` is the hottest endpoint: any new list field goes through the AD-17 field map, no new per-row
  resolver; registrations come from a separate **uncached** query (cache leak in `get-event-by-slug-cached.ts`).

### 3.4 Requests per post (Gemini)

| Post shape | Requests today | Requests under this plan | Share of posts |
|---|---|---|---|
| One event | 2 (extraction, location keywords) | **2** (extraction, merged location + tier call) | ~96% |
| Two or more events | 2 | **3** (extraction, location call, per-event tier call) | ~3% |
| Multi-event carousel with C8 adopted | 2 | **4** (above + slide map); 3 only if the untested merge of the slide map into the tier call is adopted (Open decision 7) | ~1% |
| Stepped (cursor) path, off by default | unchanged | **unchanged** (C5 not valid there; Open decision 6) | n/a |

QR decoding, phone detection, the composer, the stage guard and the date rule cost **0** requests (code).
Backfill layer 2 costs **0** Gemini requests (local Claude session). Average without C8 is about 2.03 requests
per post; token cost of the extraction call rises by about +770 prompt and +76 output tokens per post (+11% and
+19%). The PRD 3.8 capacity formula must be re-run with these numbers.

---

## 4. Detailed change proposals (old -> new)

### 4.1 PRD (`prds/festgrid-prd-2026-07-10-2047/prd.md`), to be applied by `bmad-prd` (update)

1. **New section 3.19 "Event registration and call to action"** (after 3.18).
   OLD: none.
   NEW: owner ask 1-8 and D1-D12: registration options separate from schedules (links, phones, QR-decoded links);
   bottom bar below `lg`, sticky side card at `lg` and up, modal sticky footer in the `@modal` route (D11); one
   primary CTA + up to three icons + kebab; state table "first match wins" (handoff 4); multi-option sheet;
   WhatsApp + phone icon, `tel:` only on touch, "Copy number" on desktop; message preview before opening;
   trust line; Share; CTA label per event type with fallback "Register" (D8); multi-event posts attach a phone
   only when the post yields one event or the option names its event (D4).
   Rationale: owner ask; slicing per D3.
2. **3.7 multi-event grouping rule (line ~93).**
   OLD: "Registration and sign-up windows are schedules of the event they belong to, never separate events."
   NEW: keep the sentence; add: "Each schedule carries a `stage`; how to register (links, phones, prices) is held
   in registration options (3.19), not in schedules." (Assumption A1, Open decision 8.)
3. **3.1 Event Discovery: card highlight and honest dates.** Add the highlight rules of C4 and the date rules of
   C6 (counting rows, submission row for competitions, dummy date with a label, ticket-sale single date = event
   day). Status badge wording for a dummy date: Open decision 5.
4. **3.8 Gemini API management.** Add the request budget table of section 3.4 and the rule that the
   post-extraction call is best effort (location and tiers validated separately).
5. **3.16 Data minimization and 5 Security.**
   OLD: raw private contact is discarded and never stored.
   NEW: a phone published by the organizer for registration is stored only in the registration option, only as
   E.164, never with a person's name; deleted at event end + 1 day and on takedown, permanent delete and a
   re-extract that no longer finds it; raw captions blanked 30 days after expiry; free text passes the contact
   scrub. Online-only locations are not geocoded.
6. **4.1 EventInfo.** Add `prizes`, `promos`, `inclusions`, `isFree` (bounded shapes), `highlight` (derived,
   storage per Open decision 3), `fromPrice`; note on `contactInfo`/`hasPrivateContact` (D1).
7. **4.3 LocationDetails / 4.4 Schedule.** Add `stage` (required); `isMainSchedule` derived in code; `performers`
   also from speaker lines; `ticketPrice` legacy for old rows only (D5); online-only resolution `online`.
8. **New 4.22 RegistrationOption** and **4.23 PriceTier** interfaces (label, kind `CATEGORY | TIME_WINDOW |
   OTHER`, audience enum, conditions <= 80 chars, price, optional dates, event).
9. **5 AI Extraction Quality.** Add the C9 replay gate.
10. **Frontmatter `updated`** and a change note referencing this proposal.

### 4.2 Epics and stories (`epics.md`), to be applied after approval by correct-course edits, not by `bmad-create-epics-and-stories`

- **Add "Epic 11" section** with the stories of section 5.1 (titles and one-line goals only; full ACs come from
  `bmad-create-story` after `bmad-architecture`).
- **Notes on existing stories** (one line each, no AC rewrite of shipped work):
  - Story 3.6s (Multi-event extraction with grouping rules): "Stage per schedule row added by Story 11.4;
    grouping rule (4) unchanged."
  - Story 3.6i (Classify and discard private contact): "Registration phones are kept per D1/D2 by Story 11.16;
    every other private contact is still discarded."
  - Story 3.6l (Single-request carousel extraction): "QR decode (11.10) and slide map (11.19) read the same
    slides; the single-request rule holds for extraction."
  - Story 3.6v (Match and enrich) / 3.6w (Merge duplicates): "Registration options and tiers are unioned on merge;
    moderator edits never overwritten (11.20)."
  - Story 0.35 (ticketPrice from-label pairing): "Superseded for new events by `fromPrice` (11.7)."
  - Story 1.3b (Reusable EventCard) and 1.i1k (Date box chrome): "Card layout replaced by Story 11.14 through
    EVENT-CARD-DESIGN.md."
  - Story 4.1 (Manual correction): "Main schedule is derived from stage after 11.4; the form follows."
  - Story 0.i7c (Map link gate): "Also hidden for resolution `online` (11.9)."

### 4.3 Architecture (`festgrid-architecture-spine.md`), to be written by `bmad-architecture`

New ADs (numbers are proposals; `bmad-architecture` assigns the final ones):
- **AD-55 Registration options**: table shape, RLS, AD-8 hard-delete exception, retention sweep and read
  predicate, uncached read path, exclusion from meta/share/analytics.
- **AD-56 Phone detector and contact scrub**: deterministic, mobile only, cue proximity, the phone column is the
  only place a number lives.
- **AD-57 QR decode step and link trust**: where it runs (AI-processor Lambda, before or beside extraction),
  redirector policy, pairing a code with its label, payment payload never a Register button, `sharedLink` dedup
  clue.
- **AD-58 Stage and derived dates**: required stage + code guard; main flag derived; display date rules (C6);
  one domain function shared by `selectDisplaySchedule` and the `Query.events` ORDER BY.
- **AD-59 Highlight composer**: one function for card, detail and re-extract preview; stored vs read-time (Open
  decision 3).
- **AD-60 Post-extraction call**: merged call for one event, separate per-event tier call (or code check) for
  several, request budget, best effort, not on the stepped path.
- **AD-61 Replay release gate**.

Amendments: AD-8 (exception list), AD-12 Rule 7 and AD-28 (only if C8), AD-13 (only if C8), AD-14 (`online`),
AD-17 (new list fields), AD-20 (display date), AD-29 (number retention), AD-30 Rule 1 (only if C8), Rule 5
(payload, "one call" wording), Rule 7 (race pack, `sharedLink`), Rule 9 (union, moderator edits), AD-33 (bar
tier), AD-40 (preview), AD-46/AD-51 (C5 not on stepped path), AD-49 (output cap), AD-52 (second call retries).
Infra docs: `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md` with zxing-wasm,
`registration_options` and the purge step.

### 4.4 UX (`design-artifacts/UX-festgrid-run-1/`), to be applied by `bmad-ux`
- `EVENT-CARD-DESIGN.md`: grid card from the owner mock (handoff 9): one status/date badge in the thumbnail,
  footer left slot (distance, else "Gratis", else start time, else "+N"), right slot event type, green area =
  performers or highlight (2 lines), container-query text size; dummy-date label.
- `DESIGN.md` / `EXPERIENCE.md`: bottom bar, side card, modal footer, multi-option sheet, phone/WhatsApp
  actions, message preview, trust line, state table; tokens only, lucide icons, EN + ID copy, `z-overlay-sticky`.
- Prototypes to translate (not copy): `prototypes/registration-cta/` (card, list, detail, sheets).

---

## 5. Stories

### 5.1 Proposed Epic 11: "Registration, CTA bar, highlight and honest dates"

Proposed sprint-status keys follow the usual slug form; nothing was added to `sprint-status.yaml`.

| Id | Short title | Change | Depends on |
|---|---|---|---|
| 11.1 | Add a prompt seam to the extraction request builder | C9, C3 | AD-61 |
| 11.2 | Build the replay release gate with a fresh caption set per release | C9 | 11.1 |
| 11.3 | Add stage, fact, tier and price columns | C2, C3, C5 | AD-58, AD-59, AD-60 |
| 11.4 | Require a stage per schedule row and derive the main flag in code | C2 | 11.2, 11.3 |
| 11.5 | Extract prizes, promos, inclusions, free flag and speaker performers | C3 | 11.2, 11.3 |
| 11.6 | Port the highlight composer to the domain package | C4 | 11.5 |
| 11.7 | Merge location keywords and tiers into one post-extraction call | C5 | 11.2, 11.3 |
| 11.8 | Pick the card date from counting rows, with labelled dummy dates | C6 | 11.4 |
| 11.9 | Skip geocoding for online-only locations | C7 | none |
| 11.10 | Store registration links in their own table, with QR-decoded links | C1 (slice 1) | AD-55, AD-57 |
| 11.11 | Read registration options through a separate uncached query | C1 (slice 1) | 11.10 |
| 11.12 | Show the event action bar on phones and the side card on desktop | C1 (slice 1) | 11.11, UX |
| 11.13 | Open a sheet when an event has several registration options | C1 (slice 1) | 11.12 |
| 11.14 | Redesign the grid card with one badge, highlight and footer slots | C4, C6 | 11.6, 11.8, UX |
| 11.15 | Show per-option prices and the "from" price | C5 (slice 3) | 11.7, 11.13 |
| 11.16 | Detect registration phones deterministically and scrub free text | C1 (slice 2) | AD-56, 11.10 |
| 11.17 | Delete registration phones after the event ends | C1 (slice 2) | 11.16 |
| 11.18 | Add WhatsApp and phone actions with a message preview | C1 (slice 2) | 11.16, 11.12 |
| 11.19 | Give each event its own cover slide on multi-event carousels (optional) | C8 | Open decisions 4, 7 |
| 11.20 | Backfill old events from stored data (layer 1) | C10 | 11.3-11.9 shipped |
| 11.21 | Backfill old events by re-reading captions in a local session (layer 2) | C10 | 11.20 |
| 11.22 | Clear the wrong pins of existing online locations | C7, C10 | 11.9, Open decision 1 |
| 11.z | Ratchet: highlight, main flag and display date come only from their domain functions | C2, C4, C6 | 11.4, 11.6, 11.8 |

Carved out (backlog children of `CC-261124-vjh`, section 10): own cover per event (C8 idea), slide map merged
into the tier call, post-extraction call on the stepped path, filter header changes (handoff 9/11), the "Remind
me" epic (D9), remaining geocoding gaps (handoff 13E), and two skipped approaches.

---

## 6. Open decisions (not decided; suggestions are proposals only)

| # | Open decision | Proposal (from the input, not decided) |
|---|---|---|
| 1 | Clear the 72 existing online pins | **Proposal:** clear, with a rollback copy; needs the owner's go-ahead and the writer role (Story 11.22). |
| 2 | Date for non-competition events with only non-counting rows | **Proposal:** next upcoming phase with its label; the event leaves the list after its last phase. |
| 3 | Highlight stored as a column or composed at read time | **Proposal:** architecture decision (AD-59); one shared function either way. |
| 4 | Own cover per event on carousels | **Proposal:** optional story (11.19), after the extraction finds the right events. |
| 5 | Wording of the dummy-date label on the card | **Proposal:** "Pendaftaran sampai <date>". |
| 6 | Whether the cursor path gets the post-extraction call | **Proposal:** keep it off; document that C5 does not apply there. |
| 7 | Merge the slide map into the per-event tier call | **Proposal:** untested; measure only if C8 is adopted, otherwise a separate call. |
| 8 | (added by this run, from inconsistency I1) Do D6's "delete legacy registration schedule rows" and handoff 8C's "overturn the registration-windows-are-schedules rule" still hold, now that C2 keeps windows as schedule rows with a stage? | **Proposal (conservative):** windows stay schedule rows with `stage = registration`; only links, phones and prices move to registration options; no legacy schedule rows are deleted. |
| 9 | (added, from I3) D7 asked the model for quoted evidence on flyer-only posts; C3 and input section 5 forbid an `evidence` copy field. | **Proposal (conservative):** no evidence field; flyer-only options get the low-confidence mark of D7 without a quote. |
| 10 | (added, from I4) Is slice 3's "price and eligibility per option" (D3, D5) the same thing as C5's tiers with audience? | **Proposal:** yes, one price model (tiers with audience and conditions), attached to registration options where an option names it. |

---

## 7. Assumptions made in this unattended run

- **A1** Registration windows stay schedule rows (C2 is the later, measured decision); see Open decision 8.
- **A2** Mode = Batch (no one could review edits one by one).
- **A3** New work goes into a **new Epic 11**, not into Epic 3 (Epic 3 is large and mostly in review); the
  epic number is a proposal.
- **A4** Release gate pass criteria where the input gives none: the new arm must not lose events or schedules on
  any gate post more often than the production arm does on the same post; first-look composer precision on the
  fresh set must be at least the measured 0.86; zero output-cap hits; performer/prize extraction variance is
  reported, not gated. The owner can change these.
- **A5** C8 is not planned for implementation until Open decision 4 is taken; only its story id is reserved.
- **A6** The POC enum value `other` is kept as a sixth stage value for rows that fit none of the five (input C2
  lists five); `other` does not count as an event day.
- **A7** The backlog row is registered with status `triaged` (analysed, no story) because the board's checks
  flag a proposal without a row; this is not an approval.
- **A8** Filter-header changes from handoff 9/11 ("This week" replaces "Upcoming") are outside C1-C10 and were
  carved out, not planned here.
- **A9** The 3,703 never-attempted schedule geocodes, the silent account-default inheritance and the city check
  (handoff 13E) are outside C7 (online only) and were carved out.

---

## 8. Recommended approach, order and handoff

**Path:** Direct adjustment through a new feature epic (Option 1), gated by the replay gate. Effort **High**
(about 23 stories across extraction, data, UI and backfill), risk **Medium** (prompt changes can collapse
events; mitigated by C9), timeline: the extraction track and the registration track can run in parallel after
the architecture pass.

**Scope:** **Major** (PRD, architecture and UX change; a new epic). Route to PM (`bmad-prd`), UX (`bmad-ux`) and
Architect (`bmad-architecture`), then PO/Dev for stories.

**Planning order (after owner approval):**
1. Owner answers Open decisions 1-10 (at least 3, 6, 8, 9, 10 before architecture).
2. `bmad-prd` (update): section 4.1 edits.
3. `bmad-ux`: section 4.4.
4. `bmad-architecture`: AD-55 to AD-61 and the amendments in 4.3.
5. Apply the epics.md edits of 4.2 and the sprint-status keys of 5.1 (correct-course follow-up), then
   `bmad-epic-readiness-check` on Epic 11, then `bmad-create-story` story by story. Never run
   `bmad-create-epics-and-stories` on Epic 3, Epic 1 or any epic that already has content.

**Implementation order:**
1. 11.9 Skip geocoding for online-only locations (small, independent, stops new wrong pins).
2. 11.1 Prompt seam -> 11.2 Replay gate.
3. 11.3 Columns -> 11.4 Stage -> 11.5 Facts (each through the gate) -> 11.6 Composer -> 11.7 Post-extraction call.
4. 11.8 Display dates -> 11.14 Card.
5. Registration slice 1: 11.10 -> 11.11 -> 11.12 -> 11.13; then 11.15 (prices).
6. Slice 2: 11.16 -> 11.17 -> 11.18.
7. Backfill: 11.20 -> 11.21 -> 11.22 (owner go-ahead, writer credential).
8. 11.z Ratchet. 11.19 only if Open decision 4 says yes.

**Success criteria:** gate green on every prompt or schema change; no card shows a registration window as the
event day; no online-only schedule has a pin; every Register button has a decoded or extracted link (never a
payment QR); phones gone at event end + 1 day; `Query.events` cost unchanged per AD-17; EN + ID copy and the AD-33
and locale ratchets green.

---

## 9. Inconsistencies found between the input and the PRD, epics and spine

- **I1** C2 keeps the registration window as a schedule row, but owner ask 1, D6 ("delete legacy rows") and handoff
  8C ("overturn the registration-windows-are-schedules rule") say windows leave `schedules`; the input also says
  D1-D12 are unchanged. -> Open decision 8.
- **I2** C8 cites "AD-30 Rule 1" and then "consent gate (Rule 7)". In the spine the consent gate is **AD-12 Rule 7**;
  **AD-30 Rule 7** is cross-post matching. Face blur is AD-28.
- **I3** D7 (quoted evidence from the model) vs C3 / input section 5 (no `evidence` field). -> Open decision 9.
- **I4** D3 slice 3 / D5 (price per registration option) vs C5 (tiers from a separate call). -> Open decision 10.
- **I5** C5 says a post costs 2 requests today; AD-30 Rule 5 and AD-13 say "one Gemini call per post". The location
  keyword call already exists outside that wording, so the spine wording needs an amendment.
- **I6** Handoff 13F's CIVIC ladder puts "free" before speakers, and handoff M says "no change needed" for CIVIC,
  while the later owner rule (handoff O, input C4) puts the speaker before "free" on every type. The composer's
  CIVIC row must follow the later rule.
- **I7** project-context reports about 200 requests per day for the lite model; the POC STATUS reports 500 per day
  for the local key. The capacity formula (PRD 3.8) should use the production key's real limit.
- **I8** PRD 4.1 / 5 still say private contact is discarded; D1 needs the PRD amendment before slice 2 ships (known).

---

## 10. Backlog registration

Row `CC-261124-vjh` (proposal, `triaged`) and these children in
`_bmad-output/implementation-artifacts/backlog.yaml`:
- `IDEA-261124-8jo` Own cover slide per event on multi-event carousels (backlog; Open decision 4).
- `IDEA-261124-f6n` Merge the slide map into the per-event tier call (backlog; untested, Open decision 7).
- `IDEA-261124-wk6` Post-extraction call on the stepped extraction path (backlog; Open decision 6).
- `IDEA-261124-15a` Filter header: "This week" dropdown, scrolling facet row, AI button on the search row
  (backlog; handoff 9/11, outside C1-C10).
- `IDEA-261124-nta` "Remind me" before a deadline or start, own epic (backlog; D9).
- `FIND-261124-axb` Remaining geocoding gaps: never-attempted schedules, silent account-default inheritance, city
  check (backlog; handoff 13E).
- `IDEA-261124-5yi` Ask the model for registration windows or trust its main flag (skipped; measured, input section 5).
- `IDEA-261124-ibh` Required `evidence` copy field on free-text extraction fields (skipped; runaway output).
