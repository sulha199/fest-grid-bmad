# Event registration, CTA bar and highlight extraction: handoff (2026-11-20)

Status: **pre-PRD analysis, nothing implemented, no app source touched.** Produced in a cloud session
(personas: Sally UX, Mary analyst, Winston architect). Continue in a local session that (1) analyses
existing production data and (2) builds a throwaway extraction POC. Then run
`bmad-correct-course` -> `bmad-prd` (update) -> `bmad-ux` -> `bmad-architecture` -> epics/stories.

Per CLAUDE.md: planning output goes to `_bmad-output/`; do not modify application source during
planning. The POC lives under `_bmad-output/poc/registration-extraction/` for that reason.

---

## 1. What the owner asked for

1. Registration data is separated from `schedules` (today registration windows are inserted as
   schedule rows).
2. Event detail page shows a register button (when any registration exists) at the bottom, replacing
   the default bottom nav bar.
3. Handle: multiple registration links; private-contact registration (phone number: WhatsApp-icon
   labelled button that opens a WhatsApp link, plus a smaller phone-icon button that opens the phone
   app on mobile; multiple numbers).
4. Phones are not extracted today. Detect them **deterministically** (not AI), e.g. `08xxxx`,
   `[country-code]8xxx`, and store them. Retain reasonably, delete when the event ends.
5. With registration separate, eligibility can be detected; event-list DB queries get cheaper
   (registration schedules skipped).
6. Multiple registration methods with different eligibility and different prices.
7. Added after seeing two HTML mock layouts (grid card + detail timeline page): also extract
   - the **main pulling factor** (prize, discount, etc.), shown on the card footer and detail page;
   - the **registration instruction**, including a **pre-defined message** to send via WhatsApp.
8. The register button is the call to action: put CTA-related actions in the bottom bar. Is a bottom
   bar right on desktop? List the possible CTAs.

Mock files (static Tailwind-CDN prototypes, design reference only, not app code), in
`design-artifacts/UX-festgrid-run-1/prototypes/registration-cta-mocks/`: `event-list-grid-minimalist.html`,
`event-detail-timeline-minimalist.html`. Key traits: 2-col grid card with status badge, favorite,
title, location, footer = one highlight + `s/d <end date>` pill; detail page with fixed top header
(back, prev/next, share, heart, kebab: Correct data / Report), title + status chip, organizer row with
follow, description, "Informasi & Berkas" tiles (contact, guide, floor plan, brochure), vertical
timeline of stages with per-stage add-to-calendar and derived status chips (Sedang Berlangsung /
Mendatang / Puncak Acara), shared-location badge, collapsible Instagram source posts, related events,
fixed bottom bar (registration status left, one CTA right).

---

## 2. Decisions (owner said "use defaults")

| # | Decision |
|---|---|
| D1 | Storing a publicly posted registration phone is allowed **for registration purposes only**. Needs an explicit PRD amendment (reverses PRD 4.1 / 5 "raw private contact discarded, never stored"). Owner approves; legal review optional. |
| D2 | Retention: delete the phone **event end + 1 day** (hard delete). Also delete on moderator takedown, `deleteEventPermanently`, and a re-extract that no longer finds it. Retention is computed from `schedules` at sweep time (no `purge_at` column to drift). Reads apply the same predicate. |
| D3 | Slicing: **slice 1** = registration separated + bottom bar/side card + multi-option sheet + links + highlight; **slice 2** = phone, WhatsApp, message template; **slice 3** = price and eligibility per option. |
| D4 | Multi-event posts: attach a detected number only when the post yields exactly one event, or the AI explicitly ties the option to an event. Otherwise keep today's "see the original post" message. |
| D5 | Per-option price replaces `ticketPrice` for new events; legacy schedule price kept until backfill. |
| D6 | Existing registration schedules: dry-run-first backfill script, then delete legacy rows (expand then contract). Dual-read in the UI meanwhile. |
| D7 | Flyer-only posts cannot be string-checked: accept with a low-confidence mark, model returns the quoted evidence, measured in the extraction eval. |
| D8 | CTA label per event type: extractor supplies a short label, fallback "Register". |
| D9 | In scope: Share (cheap). prev/next buttons: separate story. "Remind me" reminder: its own epic (needs a scheduling backend; push infra exists). |
| D10 | Heart, calendar and share move from the header to the bar (mobile) and side card (desktop). Header keeps back, prev/next, kebab. |
| D11 | Layout: **below `lg` (1024px)** bottom bar replaces the tab bar; **`lg` and up** a sticky right-hand side card in a two-column detail page. If the detail opens in the `@modal` route, the CTA is the modal's sticky footer. Fallback if scope is tight: bar everywhere, content-width, offset by the rail (`ms-16 xl:ms-56`). |
| D12 | Highlight slot rule: highlight wins the card footer slot; distance stays on the existing nearby badge; **no highlight when absent**. Scope or category labels ("Nasional", "Promo Mall") are not highlights. |

---

## 3. Review summaries

### Sally (UX)
- Registration appears 3 times in the mock (title chip, timeline card, bar). Keep the timeline card
  (its reminder is useful) but derive all three from the same registration option window.
- One option: full-width primary with label + price. 2+ options: "Pilih pendaftaran (N)" opens a bottom sheet.
  Each sheet row: label, price chip, eligibility chip, deadline, action. Open options first, closed
  dimmed with "Closed", never hidden. Never put 3+ buttons in the bar.
- Phone option: wide WhatsApp button + small phone-icon button. `tel:` only on touch devices; on desktop
  show "Copy number". Several numbers: first primary, rest in the sheet ("Contact 2"), cap about 3, never show names.
- WhatsApp: show the message preview (+ copy) before opening; placeholders like `[Nama]` stay visible, never auto-filled from the user profile.
- The generic "Kontak Info" tile must not display a phone outside the retention path: it opens the registration sheet or is dropped.
- Mock problems to translate: raw slate/indigo/emerald/amber, FontAwesome, `text-[10px]/[11px]`,
  raw `z-30/40/50`, hard-coded Indonesian, no dark mode, centered `max-w-3xl` ignoring the desktop rail.
  Use semantic tokens, lucide icons, next-intl EN+ID (parity ratchet 0.50), `z-overlay-sticky` (45) for the bar (AD-33 ratchet 0.49e).
- Card `s/d <date>` pill replaces the date box: a card-family change; go through `bmad-ux` and
  `design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md`, do not fork the card.
- Add a trust line near phone actions: "Number from the organizer's public post, removed after the event."

### Mary (analyst)
- Pulling factor = the single fact that most makes a stranger care (prize, discount, free entry, headline
  guest). Short `highlight` (about 30-40 chars) + kind; optional detail lines for the detail page.
  **Amounts must appear verbatim in the source or the highlight is dropped** (a wrong prize is the biggest trust failure).
- Registration instruction and message template: extracted verbatim, never composed; if absent, none; keep post language, no translation.
- R1 policy reversal needs a visible PRD amendment (purpose, basis, retention, public-registration-contact only).
- R2 a contact person is an individual: store the number only, never the name. A number inside a performer line is not a registration contact.
- R3 detector false positives (prices "Rp 150.000", dates, order codes, venue landlines) and false negatives (spaced/dashed numbers, number only inside the flyer image).
- R4 two sources of truth during migration; dedup (`match-scoring.ts`, registration link clue, `registration-vs-event-day` clue) and merge (`merge-events.ts`) must read/union the new table.
- R5 retention only works if every write path also deletes.
- R6 a hostile post could pre-fill a spam/phishing message into a user's chat: length cap, preview before opening, existing report path.
- R7 free text can smuggle PII: **the phone column is the only place a number lives**; highlight, eligibility, instruction and template pass a deterministic scrub (numbers, emails, `wa.me` links).
- R8 a highlight must never become a paid-placement slot.

### Winston (architect)
- New table `registration_options` (event_id FK cascade, sort_order, label, price_text, eligibility_text,
  opens_on, closes_on, channel_kind LINK|PHONE, link_url, phone_e164, instruction, message_template).
  No `deletedAt`: a documented AD-8 hard-delete exception. RLS policy + test required (`row-level-security.test.ts`).
- `events` gets `highlight` (short), `highlight_kind`, and a detail `text[]`. Only the first two are read by list queries (add to the select field map).
- Pure domain functions in `packages/domain`: `detectRegistrationPhones(caption)` (library
  `libphonenumber-js`, mobile type only, default region ID, registration-cue proximity: "daftar", "reg", "WA", "CP", "info", "hubungi"; also `wa.me/`, `api.whatsapp.com`), and `scrubContactData`.
- Phones come from the deterministic detector, not Gemini. Gemini schema gains `highlight` and `registrations[]` (label, link, price, eligibility, opens, closes, instruction, messageTemplate, channel hint).
- **Cache leak:** `apps/web/src/features/events/get-event-by-slug-cached.ts` caches the detail payload. Registrations must come from a **separate uncached query**, and be excluded from meta tags, share previews and analytics (log option id only, AD-5).
- Re-extract (AD-40): preview shows numbers to the moderator, persists nothing until apply.
- Multi-event posts (AD-30): see D4.
- Frontend: a bottom-bar slot in `AppShell` (precedent: `post-selection/components/summary-bar.tsx`); one `EventActionPanel` with `variant='bar'|'aside'`; pure `resolveEventActions(event, registrations, now, timezone)` returns primary / secondary / overflow. Time-dependent states computed client-side from the event timezone (like `formatEventStatus`).
- wa.me URL built client-side: `https://wa.me/<digits>?text=<encodeURIComponent(template)>`; template never rendered as HTML.
- New ADs to write: **AD-55** (registration table, bounded-retention contact, AD-8 hard-delete exception, cache split), **AD-56** (deterministic phone detector, scrub invariant, grounding).
- Update `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md` in the same change (CLAUDE.md section 4): new table, purge step on the existing scheduled sweep (no new Lambda/queue expected).

---

## 4. CTA catalog and bar rules

| CTA | Intent | Exists today | Placement |
|---|---|---|---|
| Register / RSVP / Join / Get tickets | Take part | plain link rows only | Primary |
| WhatsApp the organizer (prefilled message) | Register by chat | no | Primary (slice 2) |
| Call | Register by phone | no | Small icon, touch only |
| Add to calendar | Don't forget | yes, per schedule | Primary if registration closed/absent, else icon |
| Directions | Get there | yes (`LocationLink`) | Primary while live or within about 24h, else icon |
| Join online | Attend remotely | no (needs classified link) | Primary for online events |
| Save / favorite | Come back later | yes | Icon |
| Share (WhatsApp first) | Invite friends | no | Icon |
| Remind me (before deadline/start) | Don't miss it | push infra yes, scheduling no | Icon or primary, own epic |
| Notify if registration reopens | Waitlist | no | Later |
| Follow organizer | Future events | yes | Overflow / organizer row |
| View source post | Verify | yes | Body |
| Brochure, guide, floor plan | Read more | yes as links | Body tiles |
| Correct data / Report | Fix or flag | yes | Overflow |

Bar composition: one primary + up to three 44px icons (save, calendar, share) + kebab. Drop the status
text (title chip already shows it); keep only an urgency line ("closes in 2 days").

Primary by state, first match wins: (1) registration open -> Register, or WhatsApp for a phone option;
(2) live or starts within 24h with a location -> Directions; (3) online event live -> Join online;
(4) registration closed/absent, upcoming -> Add to calendar; (5) ended -> no bar, "Follow organizer" in page.

---

## 5. Code pointers already found

- `packages/database/schema.ts`: `events` (line ~483, `contactInfo` 505, `hasPrivateContact` 506), `schedules` (~755, `ticketPrice` ~771), `posts` (~309, caption is `posts.content`).
- PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`): 4.1 EventInfo (contact/private-contact fields ~line 455-470), 4.4 Schedule (~623), 3.16 minimization, 5 Security (personal data, ~1799), multi-event rule ~line 93 ("Registration and sign-up windows are schedules of the event they belong to": **to be overturned**).
- Extraction: `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (prompt rule 5a private contact ~285, performer contact rule ~289), `packages/domain/src/events/transform-gemini-response-to-event-info.ts` (discard-at-classification), `apps/backend/src/validation/extracted-event.schema.ts`, `sanitize-event-links.ts` (story 0.37, `events.links` jsonb).
- UI: `packages/ui/src/features/events/EventDetailView.tsx` (contact block ~425, links ~460, schedules ~478), `packages/ui/src/core/app-shell/AppShell.tsx` (mobile tab bar line ~134, rail ~169), `packages/ui/src/features/events/EventCard.tsx` (ignores `priceFrom`), `apps/web/src/features/events/EventDetailWrapper.tsx`.
- Dedup/merge: `packages/domain/src/events/match-scoring.ts`, `dedup-decision-clues.ts`, `apps/backend/src/lib/events/merge-events.ts`.
- Existing sweeps/jobs to attach the purge to: `apps/backend/src/lib/aws/poll-and-drain-queue.ts`, `lib/extraction/sweep-stale-manual-extraction-jobs.ts`.
- Tooling to reuse for the POC: `apps/backend/scripts/poc-ingestion-preview.ts` (scrape + Gemini, never writes DB, caches in `scripts/.poc-cache/`), `scripts/run-extraction-accuracy-eval.ts` + `docs/infrastructure/extraction-accuracy-eval.md` (field-level scorer in `packages/domain/src/extraction-eval/`), `scripts/fixtures/extraction-eval-synthetic`, replay scripts for the read-only-then-`--apply` pattern.
- Governing docs: `_bmad-output/project-context.md` (tokens, AD-33 z tiers), `AD-8` soft delete, `AD-29` audit log, `AD-30` event-post M:N, `AD-40` re-extract preview.

---

## 6. Open verifications (not decisions)

- [ ] What do the AD-29 extraction audit log, job records and Sentry/log lines keep? They must not retain raw extracted numbers past the retention window.
- [ ] Production counts (section 7A). The cloud session only had seed data.
- [ ] Does any existing path already store a registration link into `events.links`? How do registration schedules look in real data (titles, language, `isMainSchedule`)?
- [ ] Is a Share button truly absent everywhere (cloud review saw none in the detail view)?
- [ ] How does the detail page render when opened in the `@modal` parallel route on desktop?

---

## 7. Local session work

### 7A. Existing-data analysis (read-only production DB)

Write one script under `_bmad-output/poc/registration-extraction/` that runs read-only queries and writes
**aggregate counts and redacted samples only**. Never print or commit real phone numbers or personal names
(replace digits with `x`, redact names).

Suggested queries (adapt to real column names):

```sql
-- 1. Events that flagged a private contact (today the number was discarded)
select count(*) total, count(*) filter (where has_private_contact) private_contact from events;

-- 2. Schedules that look like registration windows, and how often per event
select count(*) total,
       count(*) filter (where title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi)') reg_like
from schedules;
select event_id, count(*) n from schedules
 where title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi)'
 group by event_id having count(*) > 1;

-- 3. How many events have more than one distinct registration-like link?  (events.links jsonb)
-- 4. Distribution of ticket_price text (free / digits / TBA) and events with several different prices
-- 5. Posts whose caption has a phone-like pattern or a wa.me link:
select count(*) total,
       count(*) filter (where content ~ '(\+?62|0)8[0-9][ .-]?[0-9]') phone_like,
       count(*) filter (where content ~* 'wa\.me|api\.whatsapp\.com|whatsapp') wa_mention
from posts where content is not null;
-- 6. Share of posts with cue words near numbers: daftar|pendaftaran|reg|cp|contact|info|hubungi|konfirmasi
-- 7. Prize/discount cues in captions: hadiah|juta|jt|rb|diskon|promo|gratis|free|doorprize|total hadiah|%
-- 8. Events per post-type: how many have 2+ events per post (AD-30) and a phone-like caption (drives D4)
```

Then build a **stratified sample of about 50-100 captions** (phone present / absent; link-only; promo;
competition; multi-event post) into a gitignored folder, and hand-label: registration channel(s),
phone(s) (as E.164), eligibility text, price tiers, highlight, message template. Keep labels out of git
if they contain real numbers; commit only redacted fixtures.

### 7B. Extraction POC (throwaway, no app source changes, no DB writes)

1. `detectRegistrationPhones` prototype (libphonenumber-js, mobile only, region ID, cue proximity,
   `wa.me` parsing, E.164 normalisation, dedupe). Report **precision/recall** against the hand labels, with
   the false-positive classes from R3 (prices, dates, order codes, landlines, performer contacts).
2. `scrubContactData` prototype: strips numbers/emails/`wa.me` from free text; test on instruction/template/eligibility/highlight strings.
3. Prompt + schema experiment (copy the request builder, do not edit production): add `highlight`,
   `highlightKind`, `registrations[]` (label, link, price, eligibility, opens, closes, instruction,
   messageTemplate, channel hint) plus `evidence` quotes. Run through the same Gemini client as the
   eval harness, N=3 runs.
4. Grounding check: amounts in `highlight` and every `messageTemplate` must be found (normalised) in the
   caption; report how many pass, how many are image-only (cannot be checked), and how many are dropped.
5. Multi-event posts: test D4 attribution; count how many phone-bearing posts yield 1 event vs several.
6. Measure: phone-detector P/R; highlight acceptable/grounded rate; template extracted verbatim rate;
   registration option count accuracy; eligibility and price-tier capture; token/cost delta of the larger schema.
7. Output a short findings report `_bmad-output/poc/registration-extraction/findings.md` (numbers, redacted
   examples, recommendation per slice, and any decision in section 2 that the data contradicts).

### 7C. Guardrails for the local session

- Read-only DB access; never run `--apply`-style writes. Credentials come from the local `.env`, never echoed.
- No real phone numbers, names or captions committed. Redact in reports and fixtures.
- Do not modify `apps/` or `packages/` source; POC code and outputs stay under `_bmad-output/poc/registration-extraction/`.
- Prefer deterministic code over AI for anything the detector can do; spend Gemini quota only on the prompt experiment.

---

## 8. Checklists

**A. Evidence (local session)**
- [ ] Section 7A counts collected and recorded
- [ ] 50-100 caption sample labelled
- [ ] AD-29 audit log / job / log retention verified (section 6)
- [ ] Share/prev-next/modal behaviours verified (section 6)

**B. POC (local session)**
- [ ] Phone detector P/R measured
- [ ] Scrub function verified on free-text fields
- [ ] Highlight + registrations extraction prompt trialled, grounding rate measured
- [ ] Template extraction trialled, preview/length/abuse cases listed
- [ ] D4 multi-event attribution measured
- [ ] Findings report written

**C. Planning path (after the POC)**
- [ ] `bmad-correct-course`: change proposal covering this handoff
- [ ] `bmad-prd` (update): privacy amendment (4.1, 5, 3.16), new `RegistrationOption` entity, overturn the "registration windows are schedules" rule, highlight, CTA bar
- [ ] `bmad-ux`: bottom bar, side card, sheet, card footer highlight, state table; reconcile with `EVENT-CARD-DESIGN.md`
- [ ] `bmad-architecture`: AD-55, AD-56, retention sweep, cache split, bottom-bar slot
- [ ] `bmad-create-epics-and-stories`: slice 1 / 2 / 3 as in D3, card redesign as its own story, reminder epic separate
- [ ] `bmad-check-implementation-readiness`
- [ ] `docs/infrastructure/architecture-diagram.md` + `high-level-overview.md` updated with the change that adds the table/purge

**D. Definition of done for the whole feature (for later stories)**
- [ ] RLS policy + test on `registration_options`
- [ ] Retention sweep + read-path predicate + takedown/re-extract deletion paths tested
- [ ] Registrations absent from cached detail payload, meta tags, share previews, analytics, logs
- [ ] Dedup scoring and merge/undo handle registrations
- [ ] EN + ID labels, locale parity ratchet green; tokens only, no raw z-index (AD-33 ratchets green)
- [ ] Extraction eval extended with the new fields and a baseline
