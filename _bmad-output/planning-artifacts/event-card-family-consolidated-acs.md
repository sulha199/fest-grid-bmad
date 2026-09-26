# Event-Card Family — Consolidated Specification

**Status:** DRAFT — Phase A of the user's 3-phase directive (2026-09-26): consolidate ACs first,
then reconcile backlog/stories (Phase B), then resume coding (Phase C). Do not implement against
this document until Phase B has run and the open questions below are resolved.

**Why this document exists:** live-deployment audit (fest-grid.vercel.app/id) plus a string of
piecemeal bug fixes (BUG-040/041/042/043/044) showed that fixing one Event-Card surface at a time
does not converge — each fix re-exposed a sibling gap on a different view-mode or schedule
scenario that was never specified together. This document is the single cross-cutting reference:
every view-mode × every element, one AC set, so Phase B can diff it against the real backlog/story
inventory and Phase C can implement once, consistently, everywhere.

---

## 1. View-mode inventory

The "Event-Card family" is not one component — it is rendered compositions across 3 source files,
sharing primitives from `EventCardMediaPrimitives.tsx`:

**Note (2026-09-26):** every `event_card_*` design token cited below (and throughout this
document as "DESIGN.md") now lives in
`design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md`, split out of `DESIGN.md` because this
family had grown into that file's single largest, most-revised block. `DESIGN.md` keeps a
cross-reference comment where the block used to be. Read the two together — this consolidation
doc is `EVENT-CARD-DESIGN.md`'s listed companion.

| # | View-mode | Component / branch | Design token (EVENT-CARD-DESIGN.md) | Design status |
|---|---|---|---|---|
| VM1 | Masonry, prominent poster (`prominentPoster=true`) | `EventCard.tsx` non-`isMasonryDefault` branch | `event_card_masonry` + `event_card_date_box.base` | Documented, prototype-validated |
| VM2 | Masonry, default/small-thumbnail (`prominentPoster=false`) | `EventCard.tsx` `isMasonryDefault` branch | `event_card_masonry` + `event_card_date_box.base_default` | Documented, prototype-validated |
| VM3 | Masonry, no-image/broken-image fallback | Sub-state of VM2 (`EventCardMediaSlot`'s reserved-blank branch) | `event_card_masonry.thumbnail_default_fallback` | Documented |
| ~~VM4~~ | ~~Standard variant~~ | **not applicable — see below** | n/a | n/a |
| VM5 | Calendar desktop grid, single-day cell item | `WeeklyCalendarView.tsx`'s `CalendarCard` `variant='grid'` (plain-text pill, does **not** use `EventCardCalendarGridItem`) — **to be replaced by `EventCardCalendarGridItem`, see below** | `event_card_calendar_grid_item` (already covers this composition) | **Wiring gap only, not a design gap — corrected below** |
| VM6 | Calendar desktop grid, multi-day spanning bar | `MultiDaySpanningBar` → `EventCardCalendarGridItem` | `event_card_calendar_grid_item` | Documented, prototype-validated |
| VM7 | Calendar mobile/list row | `CalendarCard` `variant='list'` | `event_card_compact` + `event_card_compact_thumbnail_fallback` | Documented |
| VM8 | Calendar overflow dialog item | `CalendarOverflowDialog` (reuses VM6/VM7's own components per surface — desktop vs mobile) | Inherits VM6/VM7 | Inherits VM6/VM7's gaps |

Out of scope for this document: `EventDetailView.tsx`/`EventImage.tsx` (a full-page view, not a
"card"; already implements the correct `imageUrl → imageFallbackUrl` fallback pattern and is cited
below only as the reference implementation).

**VM4 resolved — not applicable, dead code, excluded from this consolidation.** Checked every
production call site: `EventListView.tsx` (the only place `<EventCard>` is ever rendered in
`apps/web`) always passes `variant="masonry"` explicitly, and a repo-wide search found
`variant='standard'` referenced nowhere in `apps/web` at all — only as `EventCard.tsx`'s own
default parameter value and inside `EventCard.test.tsx`/`EventListView.test.tsx` fixtures. No
production page has ever reached this branch, which is also why it has no `DESIGN.md` token
(unlike every real view-mode). Recommendation for Phase B: register a small cleanup backlog item
to delete the `variant='standard'` branch and its tests rather than carry dead code forward — do
not spend any AC-consolidation effort on it.

**VM5 resolved — reuse `EventCardCalendarGridItem`, no new design pass needed.** Checked
`design-artifacts/UX-festgrid-run-1/prototypes/event-card-calendar-grid-item/thumbnail-fallback.html`:
`EventCardCalendarGridItem`'s existing no-image composition (title+favorite row / venue+nearby-badge
row) is already validated for exactly this case — its `showImage` gate
(`isMultiDay && !!imageUrl && !imgError`) means a **single-day** event always renders this same
no-image composition today, in the component that already exists and is already wired into the
multi-day spanning bar (VM6). VM5's gap is therefore that `WeeklyCalendarView.tsx`'s desktop day-cell
`CalendarCard` (`variant='grid'`) never adopts this already-built, already-designed primitive —
it independently renders a bare untokened text pill instead. **Fix is component substitution, not
a new design item.** This also resolves the VM5 date-box open question (§3): VM5 inherits
`event_card_calendar_grid_item`'s "deliberately has NO date box" rule the same way VM6 does, and
resolves the VM5 status-badge gap noted in §2.6 the same way — `EventCardCalendarGridItem` already
renders `EventCardNearbyBadge`; it has never rendered `EventCardStatusBadge` on either its with- or
without-image branch, so that specific gap (§2.6) still needs a real decision, now scoped as an
amendment to `EventCardCalendarGridItem` itself (affecting VM5 **and** VM6 together, not VM5 alone).

**Design-artifact action needed (Phase B):** with VM4 excluded and VM5 resolved as a wiring fix,
no view-mode in this family actually needs a brand-new `bmad-ux`/prototype pass. What VM1/VM2/VM6/
VM7's existing `DESIGN.md` tokens need is **amendment** for the cross-cutting AC changes below
(new date-box computation, nearby-badge distance text, date-box sizing invariants) — a token-doc
update reflecting corrected behavior, the same weight of change `event_card_date_box.base_default`
already went through twice this project (2026-09-11, 2026-09-14 corrections), not a from-scratch
design item.

---

## 2. Cross-cutting element ACs

These apply to every view-mode listed above unless a view-mode's row in §3 says otherwise.

### 2.1 Image fallback chain (BUG-042)

**AC-IMG-1:** Every surface that renders an event thumbnail must try, in order: (a) `imageUrl`,
(b) on missing/`onError`, `imageFallbackUrl` (`durableImageUrl`), (c) on both missing/erroring,
the reserved-blank fallback (no broken-image icon, no placeholder text/icon — matches
`EventCardMediaSlot`'s existing reserved-blank convention). This is the exact pattern
`EventImage.tsx`/`EventDetailView.tsx` already ships; every Event-Card surface must replicate it,
not reinvent it.

**AC-IMG-2 (backend/data, resolved by investigation, not a bug):** `durableImageUrl` is populated
only for posts that were rehosted while the account's image-storage opt-in was active at
processing time (`process-ai-job.ts`'s `isOptedIntoImageStorage` gate, write-time only). A row can
legitimately carry a populated `durableImageUrl` even if the account's opt-in has since been
revoked — already-durable images are not retroactively invalidated on read. This is expected
behavior, confirmed via Playwright + code reading against the user's flagged example
(`bdaae37d-...`, "Ambarrukmo Shopfest October Rewards"); no backend change needed.

**Gap inventory (which surfaces are missing which half of AC-IMG-1):**

| Surface | `imageUrl` | `imageFallbackUrl` wired? | Fix location |
|---|---|---|---|
| VM1/VM2/VM3 (`EventCard`, Discovery/Feed/Favorites/Account) | yes | **no** — `EventCard.types.ts` has no `imageFallbackUrl` field; `mapper.ts:115` computes it and drops it | `EventCard.types.ts`, `EventCard.tsx`, `EventListView.tsx` prop threading |
| Archive page | yes | **no** — `getArchivedEvents` query never selects `durableImageUrl` | `apps/web/src/features/events/queries.graphql` + codegen |
| VM5/VM6/VM7 (Calendar) | yes (`schedule.imageUrl`) | **no** — `getEventsForCalendar`/`getEventsForMyCalendar` never select `durableImageUrl`, and `WeeklyCalendarViewScheduleShape` has no fallback field | queries.graphql + codegen + `WeeklyCalendarViewScheduleShape` + `EventCardMediaSlot` call sites in `WeeklyCalendarView.tsx`/`EventCardCalendarGridItem.tsx` |

**AC-IMG-3 (error/expired-image fallback → scaled-up favorite control, user-directed 2026-09-26):**
On every card variant, once step (c) of AC-IMG-1's chain is reached (both `imageUrl` and
`imageFallbackUrl` missing or erroring), the image area is not left as a bare blank box — it is
**replaced by the favorite-toggle control, scaled up to fill that area's reserved dimensions**,
with the heart icon and count stacked **vertically** (icon above count), not the small
horizontal corner-pill shape used when an image is present. Applies to every variant that has a
favorite toggle at all — a variant rendered with no `onFavoriteToggle` still shows the plain
reserved-blank area (AC-IMG-1(c) unchanged), it just has no control to scale up.

**Compliance check against today's implementation:**

| Surface | Current behavior on image error/absence | Compliant? |
|---|---|---|
| VM2/VM3 (masonry default) | `EventCardMediaSlot`'s reserved-blank branch already renders `EventCardFavoriteBadge scale="large"` (`flex-col items-center` — vertical icon+count), centered and sized via `minHeight`/the slot's own dimensions | ✅ already compliant |
| VM7 (calendar list row) | `EventCardMediaSlot` with `collapseOnFallback` removes the image element entirely; a sibling `EventCardFavoriteBadge scale="large"` is composed externally when `!imagePresent`, same vertical shape | ✅ already compliant |
| VM5/VM6 (`EventCardCalendarGridItem`) | Its no-image composition already places a `scale="large"` (vertical) favorite badge in the layout, prototype-validated (`thumbnail-fallback.html`) — not literally "filling a reserved image area" (this card never reserves image space to begin with, DESIGN.md's explicit rule) but the same vertical-icon-over-count treatment is already present | ✅ already compliant, different composition shape by design |
| **VM1 (prominent poster)** | **No fallback at all.** `EventCard.tsx`'s non-`isMasonryDefault` branch (lines ~401-408) renders `{!imgError && imageUrl ? <img .../> : null}` with nothing in the `else` case — the poster area goes fully blank on error, and the corner favorite-heart button (rendered unconditionally, small/horizontal, absolutely positioned) never changes shape or position when this happens. | **❌ real gap — needs the same scaled-up/vertical treatment as every other variant** |

VM1 is therefore a genuine, newly-identified gap for Phase B/C — not just a documentation
inconsistency — since it is the one variant with a favorite toggle that currently has zero
fallback behavior on image failure.

### 2.2 Date-box content (BUG-040 reversal + new AC)

**User direction (2026-09-26): do not touch `formatShortEventDateTimeParts`,
`formatShortEventDateTime`, `formatRelativeDayOrDate`, or any other existing date-formatting
function.** Those stay exactly as-is for whatever else already consumes them. The date-box gets
its **own**, new, dedicated computation — `formatShortEventDateTimeParts` is not reused, extended,
or forked; a fresh function replaces it as the date-box's sole content source.

**The "context-date" concept.** Every date-box render is anchored to a **context date** — the date
the card is being shown *as of*:
- **Masonry (VM1/VM2)**: context date = today (`now`). There is no per-day framing on these
  surfaces; this is the same "now"-anchored semantics AC-DATE-3 (below) always meant, just named
  explicitly so the same rule generalizes to calendar surfaces without a second, divergent
  mechanism.
- **Calendar list row (VM7)**: context date = the day-column/day-row the card is rendered under.
  This concept already exists in the codebase today — `currentDayStr` (`WeeklyCalendarView.tsx`
  `CalendarCard` props, threaded into the existing
  `computeCalendarSegmentDateBoxContent`/`computeCalendarSegmentTillText`, `format-event-date.ts:
  413-484`) is exactly this context date, already wired for VM7 specifically. The new function
  below **replaces** `computeCalendarSegmentDateBoxContent`'s date-portion logic (its till-text
  computation, `computeCalendarSegmentTillText`, is unaffected and keeps its own separate call
  site — see resolution below).
- **Calendar grid (VM5/VM6)**: no date-box at all (§1) — context date is not applicable here.

**New function** (name/location TBD at implementation time, e.g.
`computeEventCardDateBoxParts(locale, timezone, contextDate, startDate, startTime, endDate,
endTime): { month: string; day: string }`):

**AC-DATE-1 (numeric-only, supersedes Story 1.i1n's word-variant mechanism):** The date-box's day
slot renders **only** a numeric day-of-month (1–31) — never a word ("Today"/"Tomorrow"/
"Yesterday") and never a bare time string. The new function has no word branches to begin with —
this AC is satisfied by construction, not by stripping branches out of the old one. Once nothing
calls `formatShortEventDateTimeParts` for the date-box any more (its other callers, if any, are
unaffected per the user direction above), `EventCardDateBox`'s `dayVariant='word'` sizing branch
(`EventCardMediaPrimitives.tsx:319-324`, built by Story 1.i1n specifically to fit that word content)
becomes dead and should be deleted, not kept "just in case." **Story 1.i1n's BUG-040 fix is
superseded, not extended, by this AC.**

**AC-DATE-2 (relative-day info is not lost):** Today/Tomorrow/relative-day semantics remain
available to the user via `EventCardStatusBadge`'s existing 8-state text (`Now`/`Ends Today`/
`In {n} hour(s)`/`Tomorrow`/weekday name/`In {n} days`/`Upcoming`/`Ended`), computed independently
of the date-box (`formatEventStatus`, also untouched). No information is lost by making the
date-box numeric-only on any view-mode that also renders the status badge (VM1/VM2/VM7). VM5/VM6's
status-badge gap (§2.6) is tracked as its own `EventCardCalendarGridItem` amendment (§1), separate
from this date-box change.

**AC-DATE-3 (ongoing, relative to context date → show end date; resolves BUG-022 and the former
VM7 open question in one rule):** Given the context date above, the new function's rule is:
- `started` = context date is on/after the event's start (`contextDate >= startDateTime` for
  masonry's "now" context; `currentDayStr >= schedule.eventStartDate` for a per-day calendar
  context — mirrors the day-string comparison `computeCalendarSegmentDateBoxContent` already uses).
- `notYetEnded` = context date is before the event's effective end (`contextDate < endDateTime` /
  `currentDayStr < effectiveEnd`).
- If `started && notYetEnded`: month/day show the **end date** (real digits, from
  `effectiveEndDate`/`endDateTime` — the same values the TILL badge itself already derives,
  `EventCard.tsx:199-200`; reuse that computation, don't re-derive a second one).
- Otherwise: month/day show the **start date**.

This single rule replaces two previously-divergent mechanisms: masonry's "now"-only BUG-022 gap
(the date-box always showed `startDate` even once `started` was true — contradicting its own TILL
sub-badge) **and** VM7's till-repurposing hack (`computeCalendarSegmentDateBoxContent`'s "continuing
segment" branch, which showed a real end date in month/day but its "last/only day" branch instead
overloaded `month` with the till-label text and `day` with a time string — itself a violation of
"date-box = date only"). Under the unified rule, VM7's last/only-day case just shows real end-date
digits like every other case; the till/time text moves entirely to the badge row
(`computeCalendarSegmentTillText`, which already exists as a separate, non-date-box-bound function
and needs no change) instead of overloading the date-box's own slots. **Resolved — no longer an
open question for Phase B.**

### 2.3 Date-box sizing (masonry-scoped, new AC)

**AC-DATE-4 (fixed width regardless of digit count):** In masonry view-modes (VM1/VM2), the
date-box's rendered width must be identical whether the day is 1-digit ("3") or 2-digit ("23").
Today's `dayClasses` (`text-5xl`/`text-3xl font-extrabold leading-none`, no explicit width) lets
the box's total width shift with glyph width. Needs an explicit min-width (or `tabular-nums` +
fixed width) on the day slot, sized to the 2-digit case, so 1-digit days don't narrow the box.

**AC-DATE-5 (height matches thumbnail height):** In VM2 (masonry default), the date-box's rendered
height must equal the adjacent thumbnail's height. The row is already `flex items-stretch` with
the media slot at `h-full` (`EventCard.tsx:348-370`), which should make the thumbnail match the
date-box's intrinsic height automatically — this AC may already be structurally satisfied and only
need live-render verification, or there may be a hidden `aspect-square`/`min-height` override
breaking it (not yet diagnosed; this is a Phase B/C investigation item, not a design decision).

**Confirmed masonry-only (2026-09-26):** AC-DATE-4/5 apply to VM1/VM2 only. VM7's `size='compact'`
date-box is unaffected — no cross-family invariant intended.

### 2.4 Nearby-badge shows radius, not the word "nearby" (new AC)

**AC-NEARBY-1:** `EventCardNearbyBadge` must render the actual computed distance (e.g. "2.3 km"),
localized, not a static translated word. Today it renders a fixed label string
(`defaultLabels.nearbyBadge`, default `"Nearby"`) plus a `Navigation` icon — the `distanceKm` value
it already receives and gates on (`< thresholdKm`) is discarded, never shown
(`EventCardMediaPrimitives.tsx:381-404`).

**AC-NEARBY-2:** The threshold-gating behavior (`< 8km` default, AD-24 Rule 2, self-gating —
render nothing when `distanceKm == null || >= thresholdKm`) is unchanged; only the badge's
**content** changes from a static word to a distance-carrying string.

**AC-NEARBY-3 (decimal precision, user-directed 2026-09-26):** `distanceKm >= 2` renders with **no
decimal place** (e.g. "5 km"); `distanceKm < 2` renders with **1 decimal place** (e.g. "1.2 km").
Applies regardless of which view-mode renders the badge.

**Implementation shape:** the existing codebase already has precedent for a function-shaped label
that takes a runtime value (`WeeklyCalendarViewProps.labels.moreLabel: (n: number) => string`,
`labels.multiDaySegmentLabel: (dayNumber, totalDays) => string`). `nearbyBadge` should become the
same shape: `nearbyBadge: (distanceKm: number) => string`, replacing the current bare-string
default — this is a **breaking prop-shape change**, so every call site
(`EventCard.tsx`, `WeeklyCalendarView.tsx`'s list variant, `EventCardCalendarGridItem.tsx`) needs
updating together, not incrementally.

### 2.5 i18n / labels wiring (BUG-044)

**AC-I18N-1:** No Event-Card-family component may ship a hardcoded English default that reaches
production untranslated. Every label — TILL prefix, all 8 status-badge states, favorite-toggle
`aria-label`, the new distance-carrying nearby-badge text (§2.4), the overflow-dialog's
`moreLabel`/`titleLabel` — must be sourced from `next-intl`'s `useTranslations` at the page level
(`home-content.tsx` and its siblings) and threaded down through `EventListView`/`WeeklyCalendarView`
props, never left to the components' own `defaultLabels` fallback in a live locale.

**Gap confirmed:** `home-content.tsx` already calls `useTranslations('DiscoveryPage')` for other
UI text but never builds or passes a `labels` object to `EventListView`/`EventCard` at all — so
100% of Event-Card-family label text ships as the English `defaultLabels` regardless of active
locale (verified live on `/id`). This is not a partial gap (e.g. "till" only) — it is the entire
labels surface, on every page that renders an `EventCard` or `WeeklyCalendarView`.

### 2.6 Status badge coverage (new gap, surfaced by AC-DATE-2's dependency)

**AC-STATUS-1:** VM5 (calendar desktop single-day grid item) currently renders no status badge and
no nearby badge at all — it is a bare `eventName` + optional favorite/added-to-calendar icons
(`WeeklyCalendarView.tsx:1202-1234`), unlike every sibling view-mode. Since AC-DATE-2 relies on the
status badge to carry relative-day meaning once the date-box goes numeric-only, VM5 needs the same
`EventCardStatusBadge`/`EventCardNearbyBadge` treatment VM6/VM7 already have, or an explicit,
separately-justified exception — not a silent gap.

### 2.7 Calendar desktop gridlines (new AC)

**AC-GRID-1:** The day-column vertical gridlines must remain visible as one continuous line per
column boundary across all three stacked grid blocks (day-header row, multi-day spanning-banner
row, day-cell row) — never obscured or made discontinuous by which/how-many cards happen to render
in a given week.

**Root-cause candidate (Phase B/C investigation, not decided here):** `GRID_WEEKLY_CLASS = "grid
grid-cols-7 divide-x divide-gray-200"` is reused verbatim across all three blocks
(`WeeklyCalendarView.tsx:35, 683, 701, 721`). Tailwind's `divide-x` draws its border via the
`> * + *` DOM-sibling-adjacency selector, which only lines up with real column boundaries when a
block's DOM children map 1:1, in visual order, to the 7 columns — true for the header row and the
day-cell row (always exactly 7 children), but **not** true for the spanning-banner row, which
renders only as many `<MultiDaySpanningBar>` elements as there are multi-day schedules (0–7),
explicitly placed into arbitrary columns via inline `gridColumn` CSS. `divide-x`'s border therefore
lands on schedule-index boundaries in that row, not column boundaries — a structurally different
mechanism from the other two blocks, which is very likely why cards visually "erase" the gridline
wherever they sit. Recommended direction for Phase C (not a decision made here): stop deriving
column separators from DOM-sibling adjacency; use a fixed background layer (e.g. a `repeating-
linear-gradient` or absolutely-positioned column-boundary lines) shared by all three blocks so the
gridline exists independently of how many/which cards are present in any given render.

### 2.8 Masonry grid column-count causes horizontal scrollbar (new, not previously registered)

**Symptom (live, `/id`):** the masonry grid overflows its container horizontally, producing a page
scrollbar.

**Investigated:** `GridContainer`'s masonry path (`grid-container.tsx`) derives `columnCount` from
a **viewport-breakpoint** table (`computeGridContainerColumnCounts`'s `base`/`md`/`lg`/`xl`/`twoXl`,
keyed off Tailwind breakpoint matches), not from the container's own measured width. `useMasonryLayout`
(AD-27, `useMasonryLayout.ts`) itself only does column-assignment/height-measurement — it takes
`columnCount` as a given input and has no opinion on sizing. So the likely defect is a breakpoint
vs. actual-rendered-container-width mismatch (e.g. a narrower content column due to page
padding/sidebar still gets the wider breakpoint's column count), not a flaw in the shortest-column
placement algorithm itself.

**Recommendation (not a unilateral decision — flag for confirmation):** fix this within the
existing AD-27 custom engine rather than adopting a third-party masonry library. AD-27's own Dev
Notes ("Library vs. hand-rolled decision", Story 0.45) already evaluated and rejected a library for
reasons that still apply (SSR-safe round-robin first paint, incremental per-item height
measurement via `ResizeObserver`, tight integration with `useInfiniteScroll`'s growing item count
without visual reshuffling — see that hook's own header comment). Swapping to a library now would
re-open a tradeoff already decided, for a bug that looks like a straightforward column-count-vs.
-measured-width fix (e.g. drive `columnCount` off a `ResizeObserver` on the grid container itself,
the same measurement idiom this codebase already uses elsewhere, instead of a viewport breakpoint
table). Register as a new bug (proposed **BUG-045**) in Phase B; root-cause fully during that
story's own investigation before deciding the exact fix.

### 2.9 Infinite-scroll locked to the next-page anchor (new, not previously registered)

**Symptom (live, `/id`):** the page keeps scrolling back to the bottom every time the next page of
results renders, instead of preserving the viewer's scroll position — distinct from BUG-043
(pagination stops after one page); this is a scroll-position bug, not a data-fetching bug.

**Likely cause (not yet confirmed by code reading — flag for Phase B/C investigation):** this
symptom is the classic signature of browser scroll anchoring locking onto the infinite-scroll
sentinel/trigger element — as new content is appended, the browser (or an explicit
`scrollIntoView`/anchor-follow call) keeps that sentinel at a fixed viewport position, which reads
as "snapping back to the bottom." Common fixes are narrow and local: `overflow-anchor: none` on the
sentinel, or repositioning the sentinel outside the anchoring browser's default heuristic — not a
data/library-architecture change.

**Recommendation (not a unilateral decision — flag for confirmation):** root-cause and fix locally
rather than adopting a virtualization/infinite-scroll library. The existing
`useInfiniteScroll`/`useListPaginationController` hooks are already tightly integrated with the
custom masonry engine's incremental item-count growth (`useMasonryLayout.ts`'s own header comment
documents this coupling explicitly); this symptom's usual fix is a small, targeted CSS/DOM change,
not a reason to re-architect the pagination layer. Register as a new bug (proposed **BUG-046**) in
Phase B; confirm the actual mechanism (scroll anchoring vs. an explicit imperative scroll call)
before committing to a fix.

---

## 3. Per-view-mode composition (which cross-cutting ACs apply)

| View-mode | AC-IMG-1 | AC-IMG-3 | AC-DATE-1/2/3 | AC-DATE-4/5 | AC-NEARBY-1/2/3 | AC-I18N-1 | AC-STATUS-1 | AC-GRID-1 |
|---|---|---|---|---|---|---|---|---|
| VM1 prominent poster | ✅ | **❌ gap — see §2.1** | ✅ (single-line box — confirm the new function's output still fits this box's one-line layout, not the two-tier stack) | n/a (single-line, not masonry's two-tier box) | ✅ | ✅ | n/a (already has it) | n/a |
| VM2 masonry default | ✅ | ✅ already compliant | ✅ | ✅ | ✅ | ✅ | n/a (already has it) | n/a |
| VM3 no-image fallback | ✅ (defines the fallback) | ✅ already compliant (defines it) | inherits VM2 | inherits VM2 | inherits VM2 | inherits VM2 | n/a | n/a |
| VM5 calendar grid single-day | ✅ | ✅ already compliant (via `EventCardCalendarGridItem`'s no-image composition) | n/a — inherits `EventCardCalendarGridItem`'s no-date-box composition (§1) | n/a | ✅ (add via `EventCardCalendarGridItem` amendment) | ✅ | ✅ (gap, §2.6 — amend `EventCardCalendarGridItem` for both VM5+VM6) | ✅ |
| VM6 calendar grid multi-day | ✅ | ✅ already compliant | n/a (deliberately no date-box, DESIGN.md) | n/a | ✅ | ✅ | ✅ (same amendment as VM5, §2.6) | ✅ |
| VM7 calendar list row | ✅ | ✅ already compliant | ✅ (unified rule, §2.2 — resolves former till-repurposing divergence) | n/a (masonry-only, §2.3) | ✅ | ✅ | n/a (already has it) | n/a |
| VM8 overflow dialog | inherits VM6/VM7 per surface | inherits VM6/VM7 | inherits | inherits | inherits | inherits | inherits | n/a |

VM4 is excluded entirely (§1 — dead code, not part of this family).

---

## 4. Backlog cross-reference (for Phase B, not resolved here)

Known existing backlog rows this consolidation directly supersedes, extends, or must be reconciled
against — Phase B's job is to work this list, not this document:

- **BUG-040 / Story 1.i1n** (`fix-eventcarddatebox-overflow-on-word-time-content`, status `done`):
  fixed overflow of word content in the date-box. AC-DATE-1 removes word content from the date-box
  entirely, which makes 1.i1n's fix (and its `dayVariant='word'` mechanism) dead code once landed.
  Needs explicit supersession, not silent deletion.
- **BUG-022** (`promoted`, ref'd against the long-done Story 1.3b): the ongoing-event
  startDate-vs-TILL-badge contradiction. This is exactly AC-DATE-3 — same finding, still open,
  never actually fixed despite being registered 2026-09-07.
- **BUG-041** (till-badge padding, done): unaffected by this consolidation, no action needed.
- **BUG-042** (image fallback, in progress/paused): superseded by §2.1's full 3-surface AC-IMG-1
  breakdown — this document is BUG-042's actual scope, more precisely stated. AC-IMG-3's VM1 gap
  (prominent poster has zero image-error fallback — the poster area just goes blank, favorite
  button never scales up) is a newly-identified sibling gap, folded into the same fix, not a
  separate bug.
- **BUG-043** (pagination stops after one page): explicitly **not** part of this consolidation —
  it's a data-fetching concern, not an Event-Card element. Stays on the backlog independently.
- **BUG-044** (labels never wired): superseded by §2.5's AC-I18N-1, scoped to the full labels
  surface rather than "till" alone.
- **Story 1.i1k / IDEA-042** (two-tier date-box chrome): still the right base shape: AC-DATE-1/3/4/5
  amend it, they don't replace it.
- **Story 1.i1i** (shared status/nearby badge primitives): `EventCardNearbyBadge`'s shape changes
  (§2.4) are an amendment to this story's delivered primitive, not a new component.
- **Story 1.i1f** (`EventCardCalendarGridItem` itself): needs two amendments — (a) VM5 adoption
  (wire it into `WeeklyCalendarView.tsx`'s desktop day-cell `CalendarCard`, replacing the plain-text
  pill, §1), (b) add `EventCardStatusBadge` to both its with-image and no-image compositions for
  VM5+VM6 together (§2.6). Not a from-scratch design item — the no-image composition is already
  prototype-validated (`thumbnail-fallback.html`).
- **New backlog item (cleanup, no ID assigned yet):** delete `EventCard.tsx`'s `variant='standard'`
  branch and its dedicated test coverage — confirmed dead code, no production call site (§1).
- **New backlog item, proposed BUG-045** (§2.8): masonry grid horizontal-scrollbar overflow —
  `GridContainer`'s breakpoint-driven `columnCount` likely mismatches the actual measured container
  width. Recommended: fix within the existing AD-27 engine, not a library swap.
- **New backlog item, proposed BUG-046** (§2.9): infinite-scroll re-anchors to the bottom on every
  new page load — distinct from BUG-043. Recommended: root-cause the scroll-anchoring/sentinel
  mechanism and fix locally, not a library swap.
- **1-3k** (`ready-for-dev`, day-of-week recurring + repeat badge): not yet implemented — Phase B
  should check whether `EventCardRepeatBadge`'s planned slot (between status and nearby badges,
  per `EventCardStatusBadge`'s own doc comment) needs any adjustment given AC-NEARBY-1's shape
  change to its neighbor.

---

## 5. Open questions requiring a user decision before Phase B closes out the backlog

All four original open questions are resolved (2026-09-26): VM4 excluded as dead code (§1); VM7's
till-repurposing unified under the single context-date rule (§2.2); AC-DATE-4/5 confirmed
masonry-only (§2.3); VM5 confirmed date-box-free via `EventCardCalendarGridItem` reuse (§1).

Remaining open items are the two new investigations flagged in §2.8/§2.9 (BUG-045/BUG-046) — not
decisions for the user to make, but root-cause work Phase B/C needs to do before committing to an
exact fix. No blocking open questions remain for Phase B to start reconciling the backlog against
§4.
