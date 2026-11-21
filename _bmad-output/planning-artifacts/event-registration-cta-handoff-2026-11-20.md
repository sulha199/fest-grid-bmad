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

POC outcome (2026-11-20): see `_bmad-output/poc/registration-extraction/findings.md`. Owner decisions 2026-11-20: (1) caption `posts.content` is blanked 30 days after the event expires, for all accounts (curator accounts already are), which amends D2 to two clocks (structured phone: event end + 1 day; raw caption: expiry + 30 days); (2) business, venue and shopper numbers DO get a CTA, with a role-based label (not a person's name), which refines D8. See findings section 7 for consequences. Still open: review of the draft labels.

Prototypes (2026-11-20, from the owner mocks, real tokens and real widths): `design-artifacts/UX-festgrid-run-1/prototypes/registration-cta/` (`event-card/card-states.html`, `event-list/list-real-widths.html`, `event-detail/bar-states.html`, `registration-sheets.html`, `detail-mobile-page.html`, `detail-desktop-tablet-modal.html`). Owner decisions taken for them: the mock card replaces the masonry date-box card; distance chip on the image bottom-left; emerald "Now" / amber urgent / neutral rest. Open design calls are listed at the bottom of each file.

**A. Evidence (local session)**
- [x] Section 7A counts collected and recorded (`_bmad-output/poc/registration-extraction/out/7a-counts.txt`, summary in findings.md section 2)
- [~] 50-100 caption sample labelled: 95 real + 5 synthetic captions, **draft labels by Claude, owner review pending** (private/labels-for-review.md)
- [x] AD-29 audit log / job / log retention verified (findings.md 3.1); gaps found: `posts.content` keeps captions, `UNPROCESSED_PAYLOAD_RETENTION_DAYS` never read
- [x] Share/prev-next/modal behaviours verified (findings.md 3.2): no Share; detail sits inside an Embla carousel in the modal

**B. POC (local session)**
- [x] Phone detector P/R measured (dev 100%/100% tuned; fresh held-out about 92-94% / 97-99%)
- [x] Scrub function verified on free-text fields (20/20 synthetic, 0 leaks over 2,992 captions)
- [x] Highlight + registrations extraction prompt trialled, grounding rate measured (numbers 100% grounded; eligibility/instruction never filled; slice 3 not ready)
- [x] Template extraction trialled, preview/length/abuse cases listed (0.17% prevalence; hostile templates copied through; guards listed in findings.md 5.4)
- [x] D4 multi-event attribution measured (model ties inconsistently; 3.4% of phone captions; keep the simple rule)
- [x] Findings report written (`_bmad-output/poc/registration-extraction/findings.md`)

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

## 9. Owner design decisions, 2026-11-21 (event list and card)

Prototypes: `design-artifacts/UX-festgrid-run-1/prototypes/registration-cta/` (`event-card/grid-card-owner-layout.html`, `event-card/card-states.html`, `event-list/list-real-widths.html`, `event-list/filter-header.html`; checks: `event-card/check-grid-card.cjs`, `event-list/check-filter-header.cjs`). Owner mock files: `Layout_Grid_Event_Minimalis_1.html` (card) and `layout_grid_event_minimalis (1).html` (filter header). No application code was changed.

- **Grid card:** the owner's mock replaces the masonry card. Status and date are ONE badge in the thumbnail (emerald "s/d 12 Des" while running; amber for urgent: "hari terakhir" / "Last day", "Dalam 3 jam", "s/d 18.00"; neutral for "besok", weekday, date). Footer: left slot = distance (< `nearbyBadgeThreshold`, 8 km), else "Gratis", else start time, else "+N jadwal", else empty; right slot = event type; green area = performers (Pertunjukan, Festival) or highlight (others), 2 lines max. Gap 1em between left and right slot, left slot never wraps, right slot truncates.
- **Text size:** badge and footer 10px only when the card is narrower than 145px (about 320px screens), 12px otherwise (container query on the card). English copy for the same slots verified; EN "+N more" replaces "+N schedules".
- **New labels (next-intl EN + ID, locale parity ratchet):** "hari terakhir" / "Last day". Existing `statusEndsToday` stays "Berakhir Hari Ini" / "Ends Today" unless the owner wants it replaced.
- **List grid:** CSS grid with equal row height, `gap-3.5` (14px) and page padding 14px on phone (live: 8px gap, 16px padding). Needs the list query to include `schedules.performers` for the green area.
- **Filter header:** the Today | Upcoming | All segmented toggle becomes a dropdown **Anytime | This week | Today** (ID: Kapan saja | Minggu ini | Hari ini), placed first and inline with the Type and Category dropdowns. **Behaviour change to decide in correct-course:** "This week" replaces "Upcoming" (all future events), so `TemporalFilterValue`, the list query condition, `?temporal=` and `TemporalFilterToggle` change; the AI filter already has a THIS_WEEK anchor.
- **Shared dropdown trigger:** every dropdown trigger (time, type, category, nearby) has a chevron-down icon. Today there is no shared dropdown component and no chevron anywhere in `packages/ui`: the facet triggers in `FilterHub.tsx` are `Button variant="outline"` inside `Popover`. Implementation needs one shared trigger (spec in `filter-header.html` section 4: 28px visible, 44px touch target, indigo active state, count badge for multi-select, chevron rotates when open). The per-facet X button inside the trigger is dropped (count badge + "Semua" pill + "Hapus filter" replace it).
- **Collapse on scroll:** keep the shipped `useCollapseHeaderOnScroll` rules (collapse past header height, min 80px; floating panel on pill tap; deferred while a dropdown is open); add the owner's active-filter dot on the "Tampilkan filter" pill. The owner's in-flow expand (max-height animation) is not adopted because it moves content under the reader.

---

## 10. Two real events, 2026-11-21 (multi-event post and QR registration link)

Source: public pages `ig_p_De5_lHHk3Ux~2` (Kopi Kenangan BRI QRIS) and `ig_p_Df7A2ZYRjSm` (Dolan Fest 2). Prototypes: `design-artifacts/UX-festgrid-run-1/prototypes/registration-cta/event-list/real-events-list.html`, `event-detail/real-events-detail.html`.

- **Multi-event post:** one post (`SEPARATE_EVENTS`, 4 events: BCA, BRI Debit, BRI QRIS, CIMB Niaga; slugs base, `~1`, `~2`, `~3`). Siblings never merge with each other: `match-event-to-existing.ts` excludes any candidate already linked to the same post (line ~191). Even without that guard their trigram name similarity is 0.54-0.72, below the 0.85 auto-link floor.
- **Residual dedup risk (not fixed):** a later single-event repost with a generic title ("Kopi Kenangan Payday Promo") scores 0.86 against the BCA event and, if the posting account or a link matches and the start date is shared, would be promoted to `high` and merged into BCA. `namesContradict` does not catch a differing word. Proposal for the correct-course: do not auto-promote a candidate that belongs to a multi-event post unless the strict names are equal.
- **List display:** keep four separate cards; the green highlight line (the schedule title, verbatim) is what tells them apart because they share one thumbnail. A grouped "4 promo" card was sketched and rejected (ambiguous favorite, different end dates, filters work per event, needs a new list kind).
- **QR registration link:** the Dolan Fest flyer's QR decodes with OpenCV on the first try (960x1280 original) to a live Google Form short link. Today nothing reads QR codes (no QR code in `apps/backend/src`; `registrationUrl` is null; registration is stored as a "Timeline Pendaftaran" schedule row). Proposal: deterministic QR scan of each post image at extraction, URL-only, through `sanitize-event-links`, stored as a LINK registration option with source "qr"; UI always shows the destination host; payment QR (QRIS) is never a Register button; the shared form link becomes a dedup signal (`sharedLink`, weight 0.2, 90-day window). Measured on one poster only.
- **Data defects seen:** both events carry wrong coordinates (Kopi Kenangan pinned near Muara Bungo, Jambi, not Yogyakarta; Dolan Fest pinned in Purbalingga, not Semarang). This blanks the distance slot and would send "Petunjuk arah" to the wrong place.

---

## 11. Owner decisions and filter-header changes, 2026-11-21 (later)

- **Routing of the section 10 findings:** QR registration-link scan (D4 context: a QR-derived link is a LINK option with source "qr", host always shown, payment QR never a Register button) and the wrong-coordinates defect on both events go into the **current correct-course** scope. The dedup guard (do not auto-promote a repost that matches an event from a multi-event post unless the strict names are equal) is filed on the backlog as `IDEA-261121-tvh` (Do not auto-promote a repost that matches an event from a multi-event post), not part of the course.
- **Filter header, padding fix:** `event-list/filter-header.html` section 1 had lost the 14px horizontal padding on the filter container while at the top of the page (the collapse script toggled the floating-panel class list, which contained `px-3.5`, off when the header was expanded), so search, dropdown row and the Kartu/Kalender tab row touched the frame edge. Padding now lives on a layer the script never touches; search, dropdown row, tab row and cards all start at the same x (checked in all four live frames).
- **Filter header, full row (owner decision 2026-11-21, supersedes the Nearby text/icon question):** the AI filter button sits on the SEARCH row, to the right of the search input (34px, same height as the input, 46px touch target; the app today puts it last in the dropdown row at 40px). The dropdown row (Anytime | Type | Category | Nearby) is ONE line that scrolls horizontally: it bleeds to the screen edge (`-mx-3.5 px-3.5`) so a clipped chip hints at more, chips are `shrink-0`, and 8px vertical padding inside the scroll port keeps the 46px touch target from being clipped by `overflow-x`. Nearby is an ICON trigger (owner, same day): the arrow icon also used for the distance on cards; idle = icon + chevron (46px wide, "Nearby" only as aria-label), active = icon + "5 km" + chevron (aria-label "Nearby: 5 km", the saved-location name is not shown on the trigger); logged-in users only. "Clear filters" is an icon button (funnel with a cross, 30px, 46px touch target, aria-label and tooltip) right of the scrolling row, not inside it, shown only while a filter is active, so it never overlaps a chip. With the icon the full row (390px) now fits without scrolling at 390px when nothing is selected; it still scrolls at narrower widths and with filters selected. Cost: icon-only controls (AI, Nearby, clear) are less discoverable than text and rely on aria-labels and tooltips; mouse users need shift + wheel to scroll the row (no impact on touch). The shipped `FilterHub.tsx` is a wrapping flex row, so the app change is: move the AI button out of `FilterHub` into the search row, and make the facet row `flex-nowrap overflow-x-auto`.
- **Collapse and expand motion:** now the owner's transition from `layout_grid_event_minimalis (1).html`: panel `max-height` to 0 over 0.28s `cubic-bezier(0.4, 0, 0.2, 1)` and opacity over 0.22s; the "Tampilkan filter" pill fades in at the same time (the owner's file shows it instantly). The floating panel (pill tap) uses the same transition and does not change the document height. Closed content is `inert` and `visibility: hidden` after the fade; `prefers-reduced-motion` turns the transition off. Checked in a headless browser: transition values read back from computed style, and an in-between frame sampled at about 100ms in both directions and for the floating panel.
- **Not done:** the shipped hook animates nothing today; implementing this needs the hook to set an explicit pixel max-height before collapsing and to release it to `none` after expanding, so an open drawer can still grow.

## 12. Follow-up POC, 2026-11-21 (registration window, multi-event A/B, QR)

Report: `_bmad-output/poc/registration-extraction/findings.md` section 9. Consequences for the planning path:
- **Registration window:** do not ask the model for a window field (it returned both dates in 0 of 36 runs). Keep the production prompt, and move windows out of `schedules` in code by title: 257 of 5,683 stored schedules (228 events); 62 events have only window schedules; 36 have the window marked main. Backfill needed.
- **Prompt change risk:** the A/B replay on 11 multi-event posts (real images, 6 runs each) showed no collapse for the extended prompts, with arm B slightly worse and the production prompt unstable on its own for 2 posts. Re-run with more posts before any schema change ships.
- **QR:** 14.8% of posts carry a decodable QR, 43% of codes are on later slides, 68% of URL codes sit behind redirectors or QR-generator hosts. zxing-wasm decodes 94% of the found set at 5 ms median and fits the AI-processor Lambda bundle (about 2 MB) once its WASM is embedded (it downloads it from a CDN by default). A QR channel from the model does not mean "register" (support, donation and link-in-bio codes were emitted as options in 12 of 15 runs).
- **Architecture review:** needed before stories (`bmad-architecture`, section 8 C already lists AD-55, AD-56). Scope in the findings reply: QR step placement and contract, redirector and trust policy, pairing a code with its label, the `RegistrationOption` model with the window reclassification and backfill, caption retention, and the replay harness as a gate for prompt changes. Update `docs/infrastructure/architecture-diagram.md` when the QR library lands.

## 13. Stage enum, price tiers and highlight composed from fields, 2026-11-21 (owner proposals and POC)

Reports: `_bmad-output/poc/registration-extraction/findings.md` section 10 (stage and tiers replay, title rule against hand labels). The highlight proposal below is **not yet measured**; the replay scripts are ready and wait for Gemini quota.

**A. Schedule stage (owner proposal, tested).** A `stage` on each schedule decides what is an event day and what is only a timeline row (registration, submission, announcement, preparation). Why it matters: `selectDisplaySchedule` (packages/domain/src/events/selectDisplaySchedule.ts, mirrored by the backend `Query.events` ORDER BY subquery) takes the earliest upcoming schedule with no regard to its kind, so a registration window that precedes the event day wins the card date.
- Enum for the date logic: `event`, `registration`, `submission`, `announcement`, `preparation`, `other`. `qualification` and `supporting` are not needed for dates: both count as event days and the title rule cannot tell them from `event` (29 of 48 v1 errors); keep them only if the UI needs them.
- Rules (findings 10.1): the model fills `stage` on 85% of rows even when required, ignores the main-flag instruction on 11% of main rows, adds about 2% runaway output, and one 3-event post became 1. So: stage required in the schema AND guarded in code, `isMainSchedule` derived in code from the stage, runaway handling, replay gate. A separate text-only classification call over titles is the preferred alternative and is written but not run (`classify-titles-call.ts`).
- Title rule v2 (`stage-classifier-v2.mjs`) as backfill first pass and fallback: 128/130 on held-out hand labels, estimated recall/precision near 1.0 on confident labels, but 10% of titles are mixed and unresolvable by rule, and the no-keyword bucket was sampled at 40 (up to about 180 non-counting titles could hide there).
- Decision still open: 43 events (in the replay) and 101 stored events consist only of non-counting rows; their date policy (unknown date versus the window as the only date).

**B. Price tiers.** Separate from schedules: a tier is a priced option (category or time-boxed batch), not a time slot. Model tiers are not ready (false positives on single prices and promos, count unstable on 5 of 24 posts). Backfill with the deterministic "NAME: Rp..." split; do model tiers only after a stricter rule (at least two distinct prices) and a replay.

**C. Highlight composed in code (owner proposal 2026-11-21, to measure).** Instead of asking the model for a highlight sentence (precision 75%, findings 5.1), ask for typed facts and compose the text in code with templates and a priority ladder.
- Fields: `performers` per schedule (already stored), event-level `prizes[]` (kind, value as written, isTotal; amount or named item required, vague claims have no slot), `promos[]` (kind, value as written, short conditions), `inclusions[]` (short phrases, at most 6), `isFree` (boolean, shared with the filter; check whether a column exists). Later, per tier: `originalPrice` (percentage computed in code, never by the model) and tier-level inclusions. Excluded on purpose for now: `limitedSlots`, event scale claims, a headliner flag.
- Where each field lives: lowest level the text can be attached to reliably, rolled up by the composer. Performers on schedules; prizes, promos, isFree on the event (promo validity is the schedule dates themselves); inclusions on the tier when tiers exist, else the event.
- Composer (`compose-highlight.mjs`, offline tests pass): ladder by event type (competition: prize first; performance, festival, market, gathering: performers first; promotion: discount first); candidates that do not fit 40 characters are skipped, never truncated; "Gratis" only when no ticket price is stated elsewhere; a performers line is "Penampil: A, B +N", never "Bintang tamu".
- Cost and risk: every extra schema field costs output tokens and risks the runaway and grouping effects seen in 10.1, so the replay compares arms A (production), F (facts), G (facts + stage, as they would ship together). The alternative is a second enrichment call; it must carry images (234 of 548 live posts have an almost empty caption).
- **POC plan (not run, needs quota):** (1) `--mode captions`: the 37 captions of the first POC, arms F and G x 3 runs, composed highlight against the 95 draft labels, set beside the free-text result (precision 75%, recall 98%); (2) `--mode live`: 53 live posts with images, arms A, F, G, for token cost, runaway, zero-event runs and event or schedule count changes. Tiers (arm E) are NOT combined into these arms: they failed their own check, and `originalPrice` depends on them. Scripts: `arms-highlight.ts`, `ab-highlight.ts`, `ab-highlight-analyze.mjs`.
- Caveat: the labels are the author's drafts, still not reviewed by the owner.

**D. Placement of new instructions, and a prompt seam (2026-11-21, owner question).**
- The earlier arms appended their rules at the END of the system instruction, after the post-level block, outside the per-event section they modify (build-gemini-request.ts line 306 is the closing line they sit before). The owner's concern is that a rule at the bottom carries less weight. The replay now treats placement as a factor: `end` versus `inline` (stage as sub-item 4e after 4d; per-event fields as items 12 to 15 straight after item 11, before "Also report, once for the whole post"). Arms: captions F-end vs F-inline; live A vs G-end vs G-inline (`arms-placement.ts`). The answer decides whether a new schema field can simply be added to the prompt or whether the per-event instruction must be rewritten around it. The earlier stage and tier results (findings 10) are end-placement results.
- Prompt seam: the POC already reaches the same effect without touching `apps/`, by calling the production builder and editing a copy of its `systemInstruction` and `responseSchema`. A real seam would be an optional argument on `buildGeminiExtractionRequest` (a function from the base prompt to the final one, or named extension slots: `perEventItems`, `scheduleItems`, `postLevelItems`, plus extra schema properties), so the replay harness and the production path share one code path. Not implemented: planning isolation applies; it belongs in a story after the architecture pass.

**E. Location context in extraction (answer to the wrong-coordinates question; production read-only, 2026-11-21).**
- Main extraction returns free text only: `location` per event and per schedule (items 4d and 5 of the prompt), no structured city, province or country. A SEPARATE batched text-only call (`generate-location-keywords.ts`, 10 s timeout, best effort) turns each distinct location string into 1 to 5 keywords (venue, district, city, province) plus an ISO country code, using the event name, hashtags and the event-level area as context; a ladder in `resolve-account-and-locations.ts` then geocodes `kw1` (all keywords joined), `kw2` (without the first), falling back to text queries. Default country ID, kill switch `KEYWORD_GEOCODING_ENABLED`.
- Prod: first keywords on 2026-10-15; in the last 7 days 749 of 764 schedules with location text have keywords (98%). Of 5,036 active schedules with coordinates, 3,703 were never attempted (no resolution step) and 992 of them sit outside Indonesia (27%); the kw1 and kw2 rows are 20 of 1,295 outside Indonesia (1.5%).
- The three defects: Kids Fun Family Run rows made 2026-10-31 and 11-06 have text "Kids Fun Parc Yogyakarta", no keywords and no resolution step, pinned at 51.58, 45.96 (Saratov); the same venue made 11-14 resolved by kw1 at the right place in Yogyakarta, so those are legacy rows, not a current-path error. Kopi Kenangan: a schedule with no location text takes the curator account's default location, which is wrong (Jambi). Dolan Fest 2: keywords {Grand Maerakaca, Semarang, Jawa Tengah} resolved kw1 to a point about 120 km from Semarang (country right, city wrong): the keywords path can still pick a wrong match inside the right country; whether `select-best-candidate` or the trust check should have caught it is not verified here.
- For the correct-course: backfill (or at least flag) the 3,703 never-attempted schedules; do not let a schedule without its own location inherit an account default silently; add a check that the geocoded place matches the city and province keywords.

**F. Highlight rule per event type (owner direction 2026-11-21; composer implemented, offline tests pass, replay pending).** The card highlight is composed in code from the typed fields, and each event type has its own ladder and wording (`compose-highlight.mjs`, `TYPE_RULES`; an event with several types takes the first of PROMOTION, COMPETITION, PERFORMANCE, SEMINAR, WORKSHOP, FUNDRAISER, FESTIVAL, EXHIBITION, MARKET, CIVIC, GATHERING, OTHER). The first candidate that exists and fits 40 characters wins; one that does not fit is skipped, never cut.

| Type | Ladder (first that exists) | Wording notes |
|---|---|---|
| PROMOTION | discount, prize, inclusions, free | performers never headline a promotion |
| COMPETITION | prize, free, inclusions, discount | "Total hadiah ...", "Pendaftaran gratis", "Peserta dapat ..."; a doorprize or certificate alone is not a headline |
| PERFORMANCE | performers, discount, free, prize, inclusions | "Penampil: A, B +N" |
| SEMINAR | speakers, inclusions, free, discount, prize | "Pembicara: ...", certificate as "Dapat e-sertifikat" |
| WORKSHOP | inclusions, instructor, free, discount, prize | "Sudah termasuk bahan, sertifikat" leads: what you take home |
| FUNDRAISER | performers, prize, inclusions, discount, free | auction items count as ITEM prizes |
| FESTIVAL | lineup, free, discount, prize, inclusions | "Lineup: A, B +N"; free entry beats a promo |
| EXHIBITION | free, artists, discount, inclusions, prize | "Gratis masuk", "Seniman: ..." |
| MARKET | free, discount, prize, entertainment, inclusions | a doorprize ranks first among prizes |
| GATHERING | free, performers, prize, discount, inclusions | doorprize ranks first among prizes |
| CIVIC | free, speakers, inclusions | "Narasumber: ..." |
| OTHER / none | prize, discount, performers, free, inclusions | the default |

Shared guards: a vague prize ("hadiah menarik", "jutaan") has no slot; "free" is dropped when a ticket price is stated on any schedule; performers need no new field (they already sit on schedules and are read as speakers, instructors or artists by type). Possible later fields per type, deliberately NOT in arm F because they are hard to verify or not yet shown to work: tenant or participant scale (market, festival), a headliner flag (performance), the cause and target amount (fundraiser), the topic (seminar). The replay report now shows, per rule type, how many events got a composed highlight.
