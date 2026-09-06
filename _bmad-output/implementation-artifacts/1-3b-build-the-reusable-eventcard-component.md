# Story 1.3b: Build the reusable EventCard component

## Story Details

- Epic: 1
- Story ID: 1.3b
- Status: review (AC1-AC13 delivered; AC14-AC18 added 2026-09-06 via `sprint-change-proposal-2026-09-04.md`, pending implementation)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable `EventCard` component in `packages/ui`,
so that the main event list (and future views like favorites/calendar) can display events consistently, including their image and loading/empty/error states.

## Acceptance Criteria

1. **AC1 — Name & date:** Given event data (name, a primary schedule's start date/time, and optional metadata), when `EventCard` renders, then it displays the event name and a formatted date, computed via native `Intl.DateTimeFormat` (accepting an optional `locale` prop) — not `next-intl`, since `packages/ui` stays framework-agnostic (see Dev Notes).
2. **AC2 — Image (happy path):** When an `imageUrl` prop is provided and loads successfully, `EventCard` renders it in a plain `<img>` (not `next/image` — see Dev Notes) with a non-empty `alt` text, auto-derived from `eventName` unless an explicit `imageAlt` override is supplied.
3. **AC3 — Image fallback:** When `imageUrl` is absent, or the image fails to load (`onError`), `EventCard` renders a graceful placeholder visual instead of a broken-image icon or blank space.
4. **AC4 — Loading state:** `EventCard` exposes a `loading` boolean prop; when `true`, it renders a skeleton placeholder matching the card's real layout dimensions, with `aria-busy="true"`, and does not attempt to render partial/undefined data underneath the skeleton.
5. **AC5 — Minimal-data resilience:** `EventCard` renders correctly using only the fields guaranteed by the current API contract (`eventName`, a start date) — every other prop (`imageUrl`, `location`, `categories`/`types`, `priceFrom`, favorite state) is optional, and the component must not throw or produce broken layout when any subset of them is omitted.
6. **AC6 — Extended content slots:** `EventCard` accepts optional `location`, `categories`/`types` (rendered as badges), and `priceFrom` props so Stories 1.3, 1.4, and 1.5 can pass this data later without a breaking prop-shape change; each renders only when its value is provided.
7. **AC7 — Favorite slot (reserved, not wired):** `EventCard` accepts optional `isFavorited` and `onFavoriteToggle` props, reserving the "Quick Favorite" affordance mandated by the Event List View design doc. When `onFavoriteToggle` is not provided, no favorite control renders. The actual favorite/unfavorite mutation behavior is out of scope for this story (Story 2.1 / 2.1a).
8. **AC8 — Semantic, keyboard-navigable root:** The card's root is a semantic, keyboard-focusable interactive element (e.g. an `<article>` wrapping an anchor/button driven by an `href`/`onClick` prop) rather than a bare non-interactive `<div>` with a click handler, per WCAG 2.1 AA (UX-DR18).
9. **AC9 — i18n-ready microcopy:** Any internal microcopy the component renders itself (fallback `alt` text default, loading-state label, favorite-button `aria-label`) is exposed via an optional `labels` override prop with sensible English defaults, so the consuming app can localize it via `next-intl` at the call site (AD-6) without coupling `packages/ui` to `next-intl` directly.
10. **AC10 — Documented & exported for reuse:** `EventCard` (and its prop types) is exported from `packages/ui`'s public entry point with prop-level documentation (TSDoc), and has component tests proving the loading / image-success / image-fallback / minimal-data states, so it is discoverable and reusable across features.
11. **(Added 2026-08-25, `bmad-correct-course`/`bmad-create-story` amendment)** **AC11 — Masonry variant:** `EventCard` accepts a new optional `variant?: 'standard' | 'masonry'` prop, defaulting to `'standard'` (today's existing rendering, unchanged). When `variant="masonry"`: the image container uses the poster's native aspect ratio (`event_card_masonry.image` token, `aspect-[3/4] object-cover`) instead of the standard variant's fixed `h-48`; the caption area below the image renders only `eventName` and `locationName` (denser than standard — no categories/types badges, no `priceFrom` row, matching the Pinterest-grid reference screenshot's "title/venue caption" minimalism) with tighter padding (`event_card_masonry.caption`). The masonry variant does **not** own its own grid/column-count logic — that is `EventListView`'s job (Story 1.3d, via `GridContainer(baseCols=2, colsStep=1)`, already locked in `project-context.md`/`DESIGN.md`'s `grid.masonry` token); `EventCard` only renders one card's own visual, regardless of how many columns its parent grid uses.
12. **AC12 — Relative-day date display:** A new shared helper (co-located with `formatEventDate`) computes, for the primary schedule's start date: if the date falls within the next 7 days (today through day+6, inclusive — "same week" per the decision record), a relative-day label (`Today`, `Tomorrow`, or the weekday name for day+2 through day+6, e.g. `Saturday`); otherwise, the existing absolute `formattedDate` output (unchanged, AC1). This applies to **both** `variant="standard"` and `variant="masonry"`: in `standard`, it replaces the existing date text line's content (same position, under the title) with whichever the helper returns; in `masonry`, it additionally renders as a pill overlay on the image (`event_card_relative_day_pill` token, top-left, mirroring the existing favorite-toggle button's glassmorphism treatment on the opposite corner) — masonry's compact caption has no room for a full date line, so the pill is the only place it shows in that variant. Locale-aware: reuses the same `activeLocale`/`activeTimezone` resolution `formatEventDate` already has (AC1), with the same graceful-degradation retry chain for an invalid timezone/locale.
13. **AC13 — Favorite count badge:** `EventCard` accepts a new optional `favoriteCount?: number` prop. When provided **and** `onFavoriteToggle` is also provided (the existing favorite-toggle button renders, AC7), the count renders as text immediately next to the `Heart` icon inside that same button (`event_card_favorite_count_badge` token) — not a separate overlay element. When `favoriteCount` is provided but `onFavoriteToggle` is not, no favorite UI renders at all (unchanged from AC7's existing rule — a read-only count with no interactive control is not a case any current consumer needs; if one emerges later, extend this AC rather than guessing a design for it now). This applies identically to both `standard` and `masonry` variants — masonry's "heart+count" reference is this exact existing button, not a new element.

**(Added 2026-09-06, `bmad-correct-course`/`bmad-create-story` amendment, `sprint-change-proposal-2026-09-04.md` Section 4.4 + `bmad-ux` pass tokens in `DESIGN.md`/`EXPERIENCE.md` "Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row")**

14. **AC14 — TILL badge (masonry variant):** Given `endDate` (and optionally `endTime`), the masonry variant's date box renders a `TILL` sub-badge (`event_card_till_badge` token, anchored to `event_card_date_box`'s bottom edge) per this rule: if `startDate`(+`startTime`) is in the future (event not started), no `TILL` badge. If the event has started (`now >= startDate`+`startTime`) and `endDate` falls on today (same calendar day as `now`, via the existing `getLocalDateInTimezone`/`getCalendarDayDifference` day-granularity comparison, not sub-day instant math), render `till hh:mm` using `endTime` formatted via the existing `formatEventTime` in the viewer's active locale/timezone. If started and `endDate` is tomorrow or later, render `till` with no time. Absent `endDate` is treated as "ends same day as start" for this rule only (matching AC15's identical fallback below, for consistency) — i.e. can still show `till hh:mm` if `endTime` is present and today, else no `TILL` badge once started with no known end. **Deferred to implementation:** exact absent-`endDate` frequency against real data is unverified — if it turns out to be common, revisit whether "no badge" is the right default versus e.g. always showing bare `till`.
15. **AC15 — Status badge (masonry variant):** A new helper `formatEventStatus(locale, timezone, now, startDate, startTime, endDate, endTime, labels)` (co-located with `formatRelativeDayOrDate`/`formatWeekday` in `format-event-date.ts`) computes one of 8 states and returns the final, already-labeled display string (matching `formatRelativeDayOrDate`'s existing return-a-ready-string convention, not a raw enum the caller re-labels). **Note:** this signature adds explicit `locale`/`timezone` params beyond the four positional args (`now, startDate, startTime, endDate, endTime`) + `labels` sketched in the proposal draft — required because the weekday-name state (below) needs `formatWeekday(locale, timezone, ...)` internally, exactly as `formatRelativeDayOrDate` already does; parameter order matches the existing helpers' `(locale, timezone, ...)` convention. State determination (day-granularity via the existing `getCalendarDayDifference` helper, consistent with the rest of this file — not sub-day instant precision except where noted):
    - Let `startDayDiff` = calendar-day difference from `now` to `startDate` (existing `getEventDayDiff`-equivalent computation); let `started` = `now >= combine(startDate, startTime)` (same `parseDateTime` combining logic `EventCard.tsx` already has for `startDate`/`startTime`, reused not duplicated); let `endDayDiff` = calendar-day difference from `now` to the effective end date (`endDate`, or `startDate` if `endDate` is absent, per AC14's identical fallback).
    - `ended`: `endDayDiff < 0`, OR `endDayDiff === 0` AND `endTime` is known AND `now` is past the combined end date+time. (An end date of today with unknown `endTime` is **not** yet `ended` — it's `endsToday`, since the exact end instant is unknown.)
    - `happeningNow`: `started` AND not `ended` AND `endDayDiff > 0` (multi-day event still running, not ending today).
    - `endsToday`: `started` AND not `ended` AND `endDayDiff === 0`.
    - `inHours(n)`: not `started` AND `startDayDiff === 0` (starts later today); `n` = hours from `now` to the combined start date+time, rounded up. **Deferred to implementation** (mirroring AC14's identical defer): if `startTime` is absent for a same-day not-yet-started event, the exact hour count can't be computed — fall back to a generic same-day phrasing (e.g. `n = 0`) rather than guessing a time.
    - `tomorrow`: not `started` AND `startDayDiff === 1`.
    - weekday name: not `started` AND `startDayDiff` in `[2, 6]` — via `formatWeekday`, reusing the exact "same week" boundary `formatRelativeDayOrDate`/AC12 already established, not a new boundary.
    - `inDays(n)`: not `started` AND `startDayDiff` in `[7, 13]` ("next week"); `n = startDayDiff`.
    - `upcoming`: not `started` AND `startDayDiff >= 14`.
    All strings sourced from `labels` with English defaults, matching the existing i18n-readiness pattern (AC9) — see Tasks for the new `EventCardLabels` keys. This badge renders in the new below-image badge row (`event_card_masonry.badge_row`, `event_card_status_badge` token), always present (one of the 8 states always applies), replacing the masonry variant's current lack of any status indicator (today's date-box shows the date, not a status).
16. **AC16 — Nearby badge:** When `distanceKm` is a number `<= 5`, render a "Nearby" badge (`event_card_nearby_badge` token, with its `Navigation` icon — distinct from the caption's `MapPin` icon per the non-color-cue requirement) alongside the status badge in `event_card_masonry.badge_row` (status badge first, nearby badge appended after, per the token's own ordering comment). When `distanceKm` is `null`/`undefined`, or `> 5`, render nothing — no placeholder, no disabled state. `EventCard` performs no geolocation/distance computation itself — see Dev Notes and Out of Scope.
17. **AC17 — Prominent poster (masonry variant):** When `prominentPoster` is `true`, the poster image renders using `event_card_masonry.image_prominent` (`w-full aspect-[2/3] object-cover`); when `false`/omitted, the existing `event_card_masonry.image` (`aspect-[3/4] object-cover`) is unchanged. Both states keep the existing heart+favorite-count overlay (AC7/AC13, confirmed visually unchanged by the `bmad-ux` pass) and the same `event_card_date_box`/`event_card_till_badge`/`event_card_masonry.badge_row` composition — only the poster's own aspect ratio differs.
18. **AC18 — Badge row is additive, not a reversal, of AC11's caption exclusivity:** AC11's rule that masonry renders no categories/types badges is **reconfirmed, not changed** — the new status+nearby badge row (`event_card_masonry.badge_row`) sits below the poster, above the unchanged `eventName`/`locationName` caption, as an additive element. It is not a category/type badge and does not reopen AC11's "no category badges" scope.
- **AC12 amendment note:** AC12's existing top-left relative-day pill (masonry only, `rounded-full`) is **superseded** by `event_card_date_box` (`rounded-md`, otherwise identical slot/z-index/content) plus the new `event_card_till_badge`. The pill's `Today`/`Tomorrow`/weekday logic (`formatShortEventDateTime`, `getEventDayDiff`) is reused verbatim, not duplicated — only the container's rounding class and the new TILL sub-badge are additions. AC15's `formatEventStatus` is a separate, new computation (event *status*, not date display) and does not replace `formatShortEventDateTime`/`formatRelativeDayOrDate`, which continue to back the date box and the standard variant's date line unchanged.

## Tasks / Subtasks

- [x] 1. Create `packages/ui/src/features/events/EventCard.tsx` implementing the base structure, name, and date rendering (AC1, AC5).
- [x] 2. Define a strictly-typed `EventCardProps` interface (all fields beyond `eventName`/start date explicitly optional), co-located as `packages/ui/src/features/events/EventCard.types.ts` (AC5, AC6, AC7).
- [x] 3. Implement locale-aware date formatting via native `Intl.DateTimeFormat`, accepting an optional `locale` prop (AC1).
- [x] 4. Implement image rendering with state-based `onError` fallback swap using a plain `<img>` (no `next/image`) (AC2, AC3).
- [x] 5. Implement the `loading` skeleton state with `aria-busy="true"` and layout-matching placeholder blocks (AC4).
- [x] 6. Implement optional `location`, `categories`/`types` (as badges), and `priceFrom` rendering, each conditionally shown (AC6).
- [x] 7. Implement the reserved favorite slot: render an accessible toggle control only when `onFavoriteToggle` is provided, reflecting `isFavorited` (AC7).
- [x] 8. Wrap the card root in a semantic `<article>` containing an anchor/button driven by `href`/`onClick`, with visible focus styles (AC8).
- [x] 9. Add the `labels` override prop (with English defaults) for all internally-rendered microcopy (AC9).
- [x] 10. Export `EventCard`, `EventCardProps`, and any sub-types from `packages/ui/src/features/events/index.ts`, and re-export via `packages/ui/src/index.ts` (AC10).
- [x] 11. Add TSDoc comments to the component and its props documenting purpose, defaults, and reuse guidance (AC10).
- [x] 12. Write component tests (Vitest + `@testing-library/react`) covering: full data render, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy`, keyboard focus/activation of the card root, and favorite control hidden when `onFavoriteToggle` is absent (AC1–AC10; use `@festgrid/testing-config/vitest-react` per Testing Requirements).
- [x] 13. **(Added 2026-08-25 — AC11 amendment.)** Add `variant?: 'standard' | 'masonry'` to `EventCardProps` (default `'standard'`). In `EventCard.tsx`, branch the image container's className (`h-48` for standard vs. `event_card_masonry.image`'s `aspect-[3/4] object-cover` for masonry) and the caption section (full standard layout vs. masonry's title+locationName-only, tighter padding). Reuse the existing `imgError`/`onError` fallback logic unchanged in both variants.
- [x] 14. **(Added 2026-08-25 — AC12 amendment.)** Add a `formatRelativeDayOrDate(locale, timezone, dateObj, labels)` helper alongside `formatEventDate` in `EventCard.tsx` (or a co-located file if it grows large): compute day-difference in the active timezone between "now" and `dateObj`; return a relative label for 0-6 days out (`Today`/`Tomorrow` via new `labels` entries, else `Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: timezone })`), else fall through to the existing `formatEventDate` output. Wire it into the standard variant's existing date line and, for masonry, additionally render it as the top-left pill (AC12). Add `today`/`tomorrow` to `EventCardLabels` (English defaults: `"Today"`/`"Tomorrow"`) — non-English weekday names come from `Intl.DateTimeFormat` itself via the `locale`/`timezone` props already threaded through, not from `labels`.
- [x] 15. **(Added 2026-08-25 — AC13 amendment.)** Add `favoriteCount?: number` to `EventCardProps`. In the existing favorite-toggle `<button>` (AC7), when `favoriteCount !== undefined`, render `{favoriteCount}` as text next to the `Heart` icon, styled per `event_card_favorite_count_badge`. No change when `onFavoriteToggle` is absent (AC13's own rule).
- [x] 16. **(Added 2026-08-25.)** Extend `EventCard.test.tsx`: masonry variant renders the aspect-ratio image class and the reduced caption (no categories/price even if those props are passed); relative-day pill/text renders `"Today"`/`"Tomorrow"`/a weekday name for dates 0-6 days out and the existing absolute format for dates ≥7 days out (cover a boundary case at exactly day 7); favorite count renders next to the heart icon when both `favoriteCount` and `onFavoriteToggle` are provided, and does not render when `onFavoriteToggle` is absent even if `favoriteCount` is provided.
- [ ] 17. **(Added 2026-09-06 — AC14-AC17 amendment.)** Add `endDate?: Date | string | null`, `endTime?: string | null`, `prominentPoster?: boolean`, and `distanceKm?: number | null` to `EventCardProps` (`EventCard.types.ts`), with TSDoc matching `sprint-change-proposal-2026-09-04.md` Section 4.4's drafted doc-comments verbatim.
- [ ] 18. **(Added 2026-09-06 — AC14 amendment.)** In the masonry branch's date-box container (`EventCard.tsx`), change the pill's class from `rounded-full` to `rounded-md` (`event_card_date_box.base`) — no other class changes; the existing `formatShortEventDateTime`/`Clock`-icon rendering is unchanged. Add the `TILL` sub-badge as a sibling inside the same relatively-positioned date-box container (its own `absolute` positioning needs no extra `relative` wrapper, per `event_card_till_badge`'s DESIGN.md note), computed per AC14's rule, using `formatEventTime` for the `hh:mm` portion.
- [ ] 19. **(Added 2026-09-06 — AC15 amendment.)** Add `formatEventStatus(locale, timezone, now, startDate, startTime, endDate, endTime, labels)` to `format-event-date.ts`, alongside `formatRelativeDayOrDate`/`formatWeekday`, implementing the 8-state logic and boundaries specified in AC15 exactly (including its two explicitly-deferred edge cases). Unlike `getEventDayDiff` (which calls a bare `new Date()` internally), `formatEventStatus` must take `now: Date` as an explicit parameter — do not follow `getEventDayDiff`'s existing pattern here, since AC15/Dev Notes require the 8 state boundaries to be unit-testable without mocking global time. Add new `EventCardLabels` keys: `statusEnded` (default `"Ended"`), `statusHappeningNow` (default `"Happening Now"`), `statusEndsToday` (default `"Ends Today"`), `statusInHours` (default `"In {n} hour(s)"`), `statusInDays` (default `"In {n} days"`), `statusUpcoming` (default `"Upcoming"`), `tillLabel` (default `"till"`, used by Task 18's `TILL` badge) — a simple `.replace('{n}', String(n))` substitution is sufficient for the two parameterized labels, matching this component's existing plain-string (not ICU-plural) i18n-readiness level; the call site can still supply a fully-resolved `next-intl` string with real pluralization if needed, same as every other `labels` entry. Reuse existing `tomorrow` for the `tomorrow` state and `formatWeekday` for the weekday state — do not add duplicate keys for either. Render the result in `event_card_masonry.badge_row` via `event_card_status_badge`'s class string.
- [ ] 20. **(Added 2026-09-06 — AC16 amendment.)** Render the nearby badge (`event_card_nearby_badge` token + `Navigation` icon from `lucide-react`, confirm the exact icon name is exported by the installed `lucide-react` version at implementation time) inside `event_card_masonry.badge_row`, after the status badge, only when `distanceKm != null && distanceKm <= 5`. Add a `nearbyBadge` label key to `EventCardLabels` (default `"Nearby"`).
- [ ] 21. **(Added 2026-09-06 — AC17/AC18 amendment.)** Swap the masonry poster's className between `event_card_masonry.image` and `event_card_masonry.image_prominent` based on `prominentPoster`. Render `event_card_masonry.badge_row` (`flex items-center gap-1.5 flex-wrap`) as the first child inside the existing masonry caption container (`p-3 flex-1 flex flex-col gap-2`, unchanged), above `eventName`/`locationName` — no new wrapper needed since the caption's existing `gap-2` already spaces it correctly (per the token's own comment). Confirm the heart+favorite-count overlay (AC7/AC13) and the `event_card_date_box`/`event_card_till_badge` overlay positioning are both unaffected by this task — visually unchanged per the `bmad-ux` pass.
- [ ] 22. **(Added 2026-09-06 — AC14-AC18 amendment.)** Extend `EventCard.test.tsx`: `TILL` badge renders/omits per AC14's 3 branches (not started / started+ends-today / started+ends-later) plus the absent-`endDate` fallback; `formatEventStatus` unit tests (in a co-located `format-event-date.test.ts` case, matching the existing test file's convention) cover all 8 states and their boundaries (`startDayDiff` 0/1/6/7/13/14, the `ended`-vs-`endsToday` boundary with/without `endTime`); nearby badge renders at `distanceKm=5` and omits at `distanceKm=5.01`/`null`/`undefined`; `prominentPoster` swaps the poster's aspect-ratio class; badge row renders status-then-nearby order and status alone when `distanceKm` is absent.
- [ ] 23. **(Added 2026-09-06 — Gate 2 lightweight guard, per `sprint-change-proposal-2026-09-04.md` Section 5 handoff.)** Confirmed (reasoned directly against this story's own existing Dev Notes rationale below, no fresh subagent call needed — matching this story's own 2026-08-25 precedent for a small, well-scoped addition to an already-gated story): `formatEventStatus` stays co-located in `EventCard.tsx`'s own `format-event-date.ts`, not promoted to a new shared `packages/ui` export. No new gap: `EventListView` (Story 1.3d) still only renders `EventCard` instances and never needs status-formatting logic directly (its AC16 threads raw `endDate`/`endTime` props through, not a formatted status string); no second consumer has emerged since `formatRelativeDayOrDate`'s identical rationale was documented on 2026-08-25.

## Dev Notes

### Amendment (2026-09-06, `bmad-correct-course` / `bmad-create-story`)

AC14-AC18 are new, added per `sprint-change-proposal-2026-09-04.md` Section 4.4, following two user-provided reference screenshots (default and opted-in/prominent-poster states) plus a targeted `bmad-ux` follow-up pass that produced the concrete Tailwind tokens cited throughout (`event_card_date_box`, `event_card_till_badge`, `event_card_status_badge`, `event_card_nearby_badge`, `event_card_masonry.image_prominent`/`badge_row` in `DESIGN.md`, and the matching "Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row" entry in `EXPERIENCE.md`). AC1-AC13/Tasks 1-16 are unchanged and already implemented (confirmed via direct inspection of the live `EventCard.tsx`/`EventCard.types.ts`/`format-event-date.ts` during this amendment).

- **`formatEventStatus`'s signature was expanded beyond the proposal's draft.** Section 4.4 sketched `formatEventStatus(now, startDate, startTime, endDate, endTime, labels)`, omitting `locale`/`timezone`. Those are required in practice: the weekday-name state needs `formatWeekday(locale, timezone, ...)` internally, exactly as `formatRelativeDayOrDate` already does. AC15 above specifies the corrected 8-argument signature, keeping the existing `(locale, timezone, ...)` parameter-order convention rather than inventing a new one.
- **PRD §3.1's status-badge boundaries ("same-week/next-week/next-month... defined in the implementing story") are fully pinned down in AC15**, not left for `bmad-dev-story` to improvise: `startDayDiff` 0/1/[2-6]/[7-13]/14+ map to `inHours`/`tomorrow`/weekday/`inDays`/`upcoming` respectively, and the `ended`/`happeningNow`/`endsToday` split is defined precisely against `endDayDiff` and `endTime` presence.
- **Two edge cases are explicitly deferred to implementation, not silently guessed:** the absent-`endDate` fallback (AC14, "ends same day as start") and the absent-`startTime` same-day `inHours(n)` fallback (AC15). Both mirror this story's own established pattern (see AC13's "deliberately left unhandled" precedent above) of flagging a low-confidence default in the AC text itself rather than either blocking the story or inventing an unstated rule.
- **`distanceKm`/geolocation stays entirely out of `EventCard`'s scope (AC16).** `EventCard` only ever receives an already-computed number or `null`/`undefined` — it has no knowledge of the viewer's location, `useCurrentLocationCapture`, or any permission state, matching this component's existing "accepts plain props, no data-fetching" boundary. See Story 1.3d's AC18 for where the actual computation happens.
- **`prominentPoster` is a plain boolean, not an "opt-in" concept `EventCard` understands (AC17).** Per PRD §3.16's 2026-09-04 amendment, the *trigger* (`durableImageUrl != null`) is Story 1.3d/`EventListView`'s job to derive — `EventCard` only renders whichever poster treatment the caller tells it to, consistent with how it already treats `variant`/`favoriteCount`/every other prop.

### Amendment (2026-08-25, `bmad-correct-course` / `bmad-create-story`)

AC11-AC13 are new, added per `sprint-change-proposal-2026-08-24-ux-rework-batch.md` Sections 4.4 (masonry), 4.9 (relative-day display), and 4.5 (favorite count) — the reference is a user-provided screenshot described as "2-col grid, native-aspect-ratio poster image as card body, relative-day pill, heart+count badge" (proposal Section 1's locked-in decisions table). AC1-AC10/Tasks 1-12 are unchanged and already implemented (confirmed via direct inspection of the live `EventCard.tsx`/`EventCard.types.ts` during this amendment — the story file's own prior `[x]` marks are accurate here, unlike some other stories' tracking this session).

- **Why the relative-day helper stays local to `EventCard.tsx`, not a new shared `packages/ui` export:** the proposal's Section 4.9 describes it as a "shared formatting helper," but the only other card/list consumer is `EventListView` (Story 1.3d), which itself just renders `EventCard` instances — it never needs the date-formatting logic directly. `WeeklyCalendarView` (Story 1.3g) explicitly does **not** adopt this rule (Section 4.9: "calendar already positions items by absolute day column... a card-view/list-view concern only"). With only one real consumer, extracting a separate shared export now would be premature — mirrors this project's own established bar (extract shared abstractions once ≥2 real call sites exist, Story 0.22's `activeOnly()` precedent, also cited by Story 0.24's Dev Notes for an identical judgment call).
- **Masonry's reduced caption (title + locationName only) is a deliberate scope decision, not an oversight.** The reference screenshot shows a denser card than the standard variant's full metadata set (categories/types/price). If a future story needs those on masonry cards too, that's a new AC to add then — not guessed at here.
- **`favoriteCount` display-when-no-toggle case is deliberately left unhandled (AC13).** Every current/planned consumer of `EventCard` (`EventListView`/discovery, `WeeklyCalendarView` is a different component) always provides `onFavoriteToggle` when it provides `favoriteCount`, so this is not a real gap today — flagged in the AC text itself so a future consumer that needs a read-only count doesn't silently get nothing without anyone deciding that on purpose.

### Architecture & UX Gate Findings (AC11-AC13 amendment, 2026-08-25)

- **Lightweight guard only, no fresh subagent calls** — mirrors the precedent already set by this same story's original Gate 1/3 citation (swept `epic-1-readiness.md`) and by Story 0.24's AC12 amendment (small, well-scoped addition to an already-gated story). No gap: no new backend/infra surface (Gate 1), no new foundational/cross-cutting dependency (Gate 3 — `GridContainer`/`grid.masonry` already exist from Story 0.31/the 2026-08-24 batch). Gate 2 (UI complexity): the masonry caption's reduced-field decision and the relative-day pill's placement were both resolved directly against the already-provided reference screenshot and the correct-course proposal's own decision record, not left ambiguous — see Dev Notes above.

- This is a net-new, presentation-only component story — no existing files needed to be read as "files being modified" beyond the `packages/ui` barrel export (`packages/ui/src/index.ts`, currently only re-exporting `./core/app-shell`).
- Previous story in sequence is 1.3a ("Build the events backend GraphQL API layer") — it is backend-only (`apps/backend`), not yet implemented (Completion Status: Incomplete), and has no code overlap with this UI-only story. No previous-story dev-notes/learnings carry over.
- Recent commit history (`0.16`, `0.17`, `0.9` implementation artifacts) shows a consistent pattern of small, tightly-scoped packages/adapters — no frontend-component precedent to reuse besides `packages/ui/src/core/app-shell/AppShell.tsx` (see below).

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-1-readiness.md` is marked `swept: true` and explicitly lists story `1.3b` in `stories_covered`. Its Gate 1 finding states: *"No other Gate 1 violations found: 1.1–1.6/1.3b/1.6a/1.8 all route data access through 1.3a's GraphQL API with no frontend→DB bypass, reusable components correctly scoped to `packages/ui`..."* — no gap applies to this story specifically. The report's one Gate 1/3 gap (missing GraphQL auth-context layer) was already resolved by promoting Story 0.17 into Epic 0; it does not affect this presentation-only component.
- **Gate 2 (run fresh, per-story as required):** Ran via subagent adopting the Freya (`wds-agent-freya-ux`) persona against the draft AC list and the authoritative UX sources (`design-artifacts/D-Design-System/01-event-list-view.md`, `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery/01.1-event-discovery.md`, `design-artifacts/UX-festgrid-run-1/DESIGN.md`). Findings, all folded into this story's AC rather than split further:
  - The Event List View doc mandates a "Quick Favorite" heart icon on every card, but Story 2.1/2.1a (the mutation + auth-gated toggle) don't exist yet — building it now would violate Gate 1 (calling a non-existent mutation). **Resolution:** AC7 reserves the prop slot (`isFavorited`, `onFavoriteToggle`) now so the icon can be wired in later without a breaking prop-shape change; the interactive behavior itself stays out of scope here.
  - Location, schedule date/time, performers, category/type badges, and price all appear in `EventInfo`/the discovery scenario as decision-relevant card content; shipping with only name/date/image risks a breaking prop-shape change when Stories 1.3/1.5 land. **Resolution:** AC6 adds them now as optional, conditionally-rendered props.
  - The image prop contract needed explicit specification given no structured image field exists yet (see Data Type Compatibility below): a decoupled `imageUrl?: string` plus a required-non-empty `alt`. **Resolution:** AC2/AC3.
  - Minor a11y/reuse gaps: skeleton needs `aria-busy` (AC4); the card root must be a semantic, keyboard-navigable element, not a bare `<div onClick>` (AC8); `EventCard` must not be confused with or reuse the separate `event_card_compact` design token (that token is styled for the calendar view's per-schedule compact cards — a different component, out of scope here).
- **Lightweight guard — gaps the epic-wide sweep did not anticipate (Gate 1/3 re-checked narrowly for this story only):**
  1. **Missing image data field (Data Type Compatibility gap, resolved as a new prerequisite story).** Neither the `events` Drizzle table nor the `EventInfo` shared type has any image field — confirmed by reading `packages/database/schema.ts`, `packages/shared-types/src/index.ts`, and `packages/database/seed.ts` (poster URLs are embedded as a substring of the free-text `description` field, e.g. `"Poster image: https://images.example.com/events/past-jazz-night.jpg"`). This is a genuine gap the epic-1 sweep's Gate 1/3 heuristics (layer-bypass, cross-cutting tooling) were not designed to catch, since it's a missing *column*, not a missing *layer*. Deeper investigation (prompted by user review of `packages/shared-types`) found the correct fix is **not** a direct image column on `events` — per the PRD's own data model (§4.1/§4.7), `EventInfo` has no image field because an event's image travels via its source `Post.imageUrl`. The real fix is a `postId` FK on `events` referencing a new `posts` table. Since Story 3.3a already defines that exact table shape but scopes it to Epic 3 (chronologically after Epic 1), a new prerequisite story, **Story 1.2a** (`1-2a-create-posts-table-and-link-seeded-events-to-their-source-post`), was added to `epics.md` and `sprint-status.yaml` (`backlog`, positioned after Story 1.2, before Story 1.3a) to pull that table's creation earlier and link the seeded events to it; Story 3.3a was amended accordingly. Full detail in the **Data Type Compatibility & Migration Requirements** section below. This does not block *this* story: per the Gate 2 review, `EventCard` is intentionally decoupled from any specific backing field via a generic `imageUrl?: string` prop, regardless of whether the underlying mechanism is a direct column or a joined `postId` relation.
  2. **Pre-existing Shadcn/ui location debt (not reopened here).** `project-context.md`'s "Core Primitives" rule requires reusable Shadcn/ui components in `packages/ui/src/core/`, but Story 0.3 installed them directly into `apps/web/src/components/ui/` (`button.tsx`, `card.tsx`, `dialog.tsx`) instead. `AppShell.tsx` (the only existing `packages/ui` component) already works around this by hand-rolling Tailwind markup rather than importing those primitives — `packages/ui` cannot import from `apps/web` anyway (wrong dependency direction in the workspace graph). **Resolution:** `EventCard` follows the same precedent — built with plain Tailwind + native elements, not a Shadcn `Card` import. This gap is flagged so the dev agent does not attempt an invalid cross-package import, and is **not** claimed as fixed by this story; a repo-wide relocation of the Shadcn primitives (which would also touch `Button`/`Dialog` usage across `apps/web`) is out of scope and would need its own story if ever prioritized.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No image field exists on the `events` Drizzle table (`packages/database/schema.ts`) or on the `EventInfo` shared TypeScript type (`packages/shared-types/src/index.ts`) — and per the PRD (§4.1), this is by design: `EventInfo` has no image field because an event's image is meant to travel via its source `Post.imageUrl` (PRD §4.7). Today, no `posts` table exists yet either, so the image URL is stuffed as unstructured text inside `events.description` in the seed fixtures (`packages/database/seed.ts`) as a stopgap.
- **Impacted fields/contracts:** `events` table (DB, needs a `postId` FK), a new `posts` table (DB), `EventInfo` interface (`packages/shared-types`, needs `postId?: string`), the not-yet-implemented Story 1.3a GraphQL resolver's `Event.imageUrl` computed field, and any future mapping from that field → `EventCardProps.imageUrl`.
- **Required DB migration changes:** A new `drizzle-kit`-generated migration (per AD-3) creating a `posts` table (`id`, `subscription_id` FK, `content`, `image_url`, `post_url`, `is_extracted`, `published_at`, timestamps — matching Story 3.3a's originally-specified shape) and adding a nullable `post_id` FK column to `events`, plus a seed-data update linking each of the 3 fixture events to a new fixture `posts` row populated with the URL currently embedded in `description`. **Not this story's responsibility** — `packages/ui` has no database access, and this is a shared-data-ownership concern spanning Epic 1 and Epic 3. Split into a new prerequisite story, **Story 1.2a** (`1-2a-create-posts-table-and-link-seeded-events-to-their-source-post`, `backlog`, added to `epics.md` positioned after Story 1.2 and before Story 1.3a; Story 3.3a amended to depend on it and narrowed to just the scraping-pipeline write path).
- **Required TypeScript type changes:** Add `postId?: string` to `EventInfo` in `packages/shared-types` (Story 1.2a). Story 1.3a's GraphQL `Event` type additionally exposes a runtime-computed `imageUrl: String` field resolved via a `posts` join through `postId` — not a field stored on `EventInfo` itself, mirroring how `isFavorited`/`isAddedToCalendar` are already runtime-computed.
- **Backward compatibility and rollout notes:** `EventCard` is deliberately decoupled from any specific backing field or mechanism — it accepts a generic `imageUrl?: string` prop that whichever caller integrates it is responsible for mapping, regardless of whether that value ultimately comes from a direct column or a joined `posts` relation. This story is therefore **not blocked** on Story 1.2a/1.3a landing. Until they do, real integrations (Story 1.3) will call `EventCard` with `imageUrl={undefined}`, which exercises the already-specified fallback/placeholder path (AC3) as the default real-world behavior — not a degraded/broken state.
- **Verification checks:** This story's own component tests cover both `imageUrl` present and absent (AC2/AC3). End-to-end verification against real event images is not possible until Story 1.2a's migration/seed update and Story 1.3a's AC6 (`imageUrl` resolver) both ship; track that separately when those stories are picked up.

### Project Structure Notes

- New files live under `packages/ui/src/features/events/`, per project-context.md's "Domain Features" convention (`packages/ui/src/features/<domain>/...`), mirroring the documented example `packages/ui/src/features/events/EventCard.tsx`.
- Only existing file touched: `packages/ui/src/index.ts` (add a barrel re-export) — everything else is additive/new. No conflicts with the in-flight `apps/backend` work from Story 1.3a (different package entirely).
- `packages/ui`'s existing component (`AppShell.tsx`) establishes the pattern this story must follow: plain Tailwind classes, native HTML elements (`<a>`, `<button>`), `lucide-react` for icons, no Next.js-specific APIs (`next/link`, `next/image`), no `next-intl` — labels/paths are passed in as already-resolved props by the consuming `apps/web` app.

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Domain vs UI), UI Patterns & UX Invariants (loaders), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-6] — i18n/locale strategy (labels-prop pattern).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3b] and neighboring Stories 1.2a, 1.3, 1.3a, 2.1, 2.1a, 3.3a.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report covering this story.
- [Source: packages/testing-config/] — shared Vitest/MSW config (Story 0.10), consumed via `@festgrid/testing-config/vitest-react`.
- [Source: design-artifacts/D-Design-System/01-event-list-view.md] — Quick Favorite requirement.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] — `card` and `event_card_compact` design tokens.
- [Source: design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.1-event-discovery/01.1-event-discovery.md] — Quick Favorite user scenario.
- [Source: packages/database/schema.ts], [Source: packages/shared-types/src/index.ts], [Source: packages/database/seed.ts] — confirmed missing image field.
- [Source: packages/ui/src/core/app-shell/AppShell.tsx] — established `packages/ui` component conventions (plain Tailwind, no Next.js coupling).
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-04.md] — Section 4.4, source-of-truth draft for AC14-AC18.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] — `event_card_date_box`, `event_card_till_badge`, `event_card_status_badge`, `event_card_nearby_badge`, `event_card_masonry.image_prominent`/`badge_row` tokens (added 2026-09-04).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — Component Patterns § "Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row" and its Accessibility Floor entry (added 2026-09-04).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain Features), UI Patterns & UX Invariants (skeleton/loading), i18n rules.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n/locale strategy).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/features/events/EventCard.tsx` — component implementation.
  - NEW `packages/ui/src/features/events/EventCard.types.ts` — `EventCardProps` and related types.
  - NEW `packages/ui/src/features/events/index.ts` — barrel export for the `events` feature folder.
  - NEW `packages/ui/src/features/events/EventCard.test.tsx` — component tests.
  - UPDATE `packages/ui/src/index.ts` — add `export * from './features/events';`.
  - NEW `packages/ui/vitest.config.ts` — `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`, matching the pattern already used by `packages/analytics/vitest.config.ts` and `apps/web/vitest.config.ts` (Story 0.10's `@festgrid/testing-config` package now exists with `vitest-react.ts`/`msw-handlers.ts` — `packages/ui` just needs to add its own config file, not bootstrap anything from scratch).
  - UPDATE `packages/ui/package.json` — add a `"test": "vitest run"` script and devDependencies `@festgrid/testing-config` (workspace), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` (mirroring `packages/analytics/package.json`'s shape; `@testing-library/react`/`jest-dom` are needed directly since pnpm workspaces don't transitively expose `@festgrid/testing-config`'s own devDependencies to consumers).
- **Rule Mapping:**
  - *UI Components & Scalability (Domain Features)* → component placed in `packages/ui/src/features/events/`.
  - *i18n foundational principle (AD-6)* → `labels` override prop pattern, no direct `next-intl` dependency inside `packages/ui`.
  - *UI Patterns & UX Invariants (Non-Blocking Initial Load)* → the `loading` skeleton state matches the project's mandated skeleton-for-initial-load pattern.
  - *Data Type Compatibility* → `imageUrl` kept generic/decoupled from `EventInfo`, per the section above.
  - *Testing Philosophy (testing trophy)* → integration-style component tests via Vitest + Testing Library, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: full-data render, minimal-guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy` attribute, keyboard focus/activation (Tab + Enter/Space) of the card root, favorite control absent when `onFavoriteToggle` is not passed.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing renders `EventCard` on a real page yet — that lands with Story 1.3).

## Pre-Coding Approval Gate

- [x] Scope confirmed: build `EventCard` as a standalone, presentation-only UI component in `packages/ui`; no backend work, no live-data wiring into any page (that is Story 1.3).
- [x] Architecture confirmed: component built with plain Tailwind + native HTML elements only (no `next/image`, no `next-intl`, no cross-boundary import of `apps/web`'s Shadcn primitives), placed under `packages/ui/src/features/events/`.
- [x] Testing plan confirmed: Vitest + `@testing-library/react` component tests via `packages/ui/vitest.config.ts` importing `@festgrid/testing-config/vitest-react` (Story 0.10's shared testing-config package exists and is already consumed by `packages/analytics`/`apps/web`; `packages/ui` just adds its own config file following that same pattern).
- [x] Data Type Compatibility gap accepted: user accepts that `EventCard` ships now with a generic, decoupled `imageUrl?: string` prop, and that the real image data (`posts` table + `events.postId` + Story 1.3a's `imageUrl` resolver) is deferred to new Story **1.2a** (`backlog`) rather than blocking this story.
- [x] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story); Gate 2 findings (Quick Favorite slot reserved but not wired, extended content props, image prop contract, a11y semantics) are folded into this story's AC rather than split further; the image-data-model gap is split into new Story 1.2a (see above).
- [x] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [x] Component tests (Vitest + `@testing-library/react`) for: full-data render, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton (`aria-busy`), keyboard focus/activation of the card root, and favorite control hidden when `onFavoriteToggle` is absent.
- [x] No E2E test required for this story (no live page consumes `EventCard` yet; E2E coverage arrives with Story 1.3's "happy path").
- [x] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per project-context.md; `packages/ui` follows the "testing trophy" integration-style approach.
- [x] Note: Use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [x] `EventCard` component implemented in `packages/ui/src/features/events/EventCard.tsx`.
- [x] Strictly-typed `EventCardProps` covering all guaranteed and optional fields (`EventCard.types.ts`).
- [x] Loading skeleton state with `aria-busy`.
- [x] Image success + fallback/placeholder handling (no-`imageUrl` and `onError` cases).
- [x] Optional content slots: `location`, `categories`/`types` badges, `priceFrom`.
- [x] Reserved (unwired) favorite slot: `isFavorited`, `onFavoriteToggle`.
- [x] Semantic, keyboard-navigable card root.
- [x] `labels` override prop for i18n-readiness.
- [x] Exported from `packages/ui`'s public entry point with TSDoc prop documentation.
- [x] Component tests written and passing.
- [x] `variant="masonry"` prop implemented (AC11, new 2026-08-25).
- [x] Relative-day date display for both variants (AC12, new 2026-08-25).
- [x] Favorite count badge (AC13, new 2026-08-25).
- [ ] `TILL` badge (AC14, new 2026-09-06).
- [ ] 8-state `formatEventStatus` status badge (AC15, new 2026-09-06).
- [ ] Nearby badge (AC16, new 2026-09-06).
- [ ] Prominent poster treatment (AC17, new 2026-09-06).
- [ ] Below-image badge row composition (AC18, new 2026-09-06).

## Out of Scope

- Wiring `EventCard` into the actual event list/grid page — handled by Story 1.3.
- Live GraphQL data fetching / real event data — handled by Story 1.3a.
- Interactive favorite/unfavorite mutation logic — handled by Story 2.1 and Story 2.1a; this story only reserves the prop slot (AC7).
- Creating the `posts` table, adding `events.postId`, and exposing the resolved `imageUrl` via the GraphQL resolver — split into new Story **1.2a** (schema/seed) and Story 1.3a's AC6 (resolver); not built here (see Data Type Compatibility & Migration Requirements).
- Relocating existing Shadcn/ui primitives from `apps/web/src/components/ui/` into `packages/ui/src/core/` — pre-existing Story 0.3 debt, not reopened by this story.
- Storybook, visual-regression, or design-token tooling — not set up anywhere in this project yet.
- **(Added 2026-09-06)** Client-side geolocation capture, permission handling, or any distance computation — `EventCard` only renders `distanceKm` if the caller supplies it (AC16); the actual computation is Story 1.3d/the `apps/web` call site's job (Story 1.3d AC18).
- **(Added 2026-09-06)** Deriving `prominentPoster` from `durableImageUrl`/opt-in state — `EventCard` only consumes the already-derived boolean (AC17); the derivation itself is Story 1.3d's AC17.

## Definition of Done

- [x] All original Acceptance Criteria (AC1–AC10) are met.
- [x] AC11-AC13 (masonry variant, relative-day display, favorite count — new 2026-08-25) are met.
- [ ] AC14-AC18 (TILL badge, 8-state status badge, nearby badge, prominent poster — new 2026-09-06) are met.
- [x] Required component tests (see Testing Requirements) are written and passing.
- [x] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [x] `EventCard` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [x] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

review (AC1-AC13 delivered; AC14-AC18 drafted 2026-09-06, pending implementation)

**2026-08-25:** AC1-AC10 confirmed already implemented and correct via direct code inspection. AC11-AC13 (masonry variant, relative-day display, favorite count) implemented via cline: 288/288 packages/ui tests pass, build/lint clean.

**2026-09-06 (`bmad-correct-course`/`bmad-create-story` amendment):** Reopened per `sprint-change-proposal-2026-09-04.md` Section 4.4 for AC14-AC18 (TILL badge, 8-state status badge, nearby badge, prominent poster, badge-row composition) — draft AC/task text finalized against the `bmad-ux` pass's `DESIGN.md`/`EXPERIENCE.md` tokens; not yet implemented. Status stays `review` per this project's established precedent (AC11-13's own 2026-08-25 amendment to this same story).

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro (AC1-10, original); cline (`gemini-3.5-flash`) in an isolated worktree (AC11-13 amendment, 2026-08-25)

### Debug Log References

N/A (AC1-10). AC11-13: local Vitest run, 288/288 `packages/ui` tests passing.

### Completion Notes List

- Implemented `EventCard` in `packages/ui` following the UI Patterns & UX Invariants (Skeleton loader).
- Component uses framework-agnostic native elements and plain Tailwind classes.
- Used `Intl.DateTimeFormat` for locale-aware date rendering.
- Fully exported via barrel files.
- Provided component testing via `vitest` + `testing-library/react` and configured `packages/ui` to properly load JSX using `@vitejs/plugin-react`.
- Verified typings and all 9 component tests pass.

**AC11-13 amendment (2026-08-25):** Added `variant?: 'standard' | 'masonry'` prop with a native-aspect-ratio image and reduced caption for masonry. Added `formatRelativeDayOrDate` helper (Today/Tomorrow/weekday name for 0-6 days out, falls through to the existing absolute formatter otherwise), wired into both variants including a top-left pill overlay in masonry. Added `favoriteCount?: number`, rendered next to the `Heart` icon in the existing favorite-toggle button only when `onFavoriteToggle` is also present. Extended `EventCard.test.tsx` with masonry-rendering, relative-day boundary, and favorite-count cases. Independently verified: 288/288 `packages/ui` tests, full repo build (7/7) and lint (0 errors) all pass.

### File List

- `packages/ui/src/features/events/EventCard.tsx` (Modified — AC11-13)
- `packages/ui/src/features/events/EventCard.types.ts` (Modified — AC11-13)
- `packages/ui/src/features/events/EventCard.test.tsx` (Modified — AC11-13)

- `packages/ui/src/features/events/EventCard.tsx`
- `packages/ui/src/features/events/EventCard.types.ts`
- `packages/ui/src/features/events/EventCard.test.tsx`
- `packages/ui/src/features/events/index.ts`
- `packages/ui/src/index.ts`
- `packages/ui/vitest.config.ts`
- `packages/ui/tsconfig.json`
- `packages/ui/package.json`
