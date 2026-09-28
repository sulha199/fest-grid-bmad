---
title: "Masonry Event-Card — session changes, 2026-09-27"
status: "committed 2026-09-28"
created: "2026-09-27T00:00:00Z"
updated: "2026-09-28T00:00:00Z"
scope: "packages/ui/src/features/events (EventCard.tsx, EventCardMediaPrimitives.tsx, format-event-date.ts), design-artifacts/UX-festgrid-run-1 prototypes/EVENT-CARD-DESIGN.md, packages/database/seed.ts, apps/web label wiring + query-cache favorite toggling"
related_docs:
  - "design-artifacts/UX-festgrid-run-1/EVENT-CARD-DESIGN.md"
  - "_bmad-output/planning-artifacts/event-card-family-consolidated-acs.md"
---

# Masonry Event-Card — session changes (2026-09-27)

Recap of everything changed in this session on the **masonry** card family
(`EventCard.tsx`'s `variant="masonry"`, both `prominentPoster=false`/VM2 "default" and
`prominentPoster=true`/VM1 unless noted). Written as a changelog for a future session/regression
pass to orient against — not a replacement for `EVENT-CARD-DESIGN.md`, which stays the
authoritative token spec and has already been updated in place for each item below.

None of this is committed yet as of this writing. See `git status`/`git diff` for the live diff.

## 1. Pixel-perfect layout pass (VM2 "default" composition) — rounds 1-5

Driven by user screenshots of the small-thumbnail and no-image states. Iterated in rounds within
this session, with two interim experiments explicitly reverted (noted below). Final state:

- **Date-box and thumbnail split the row's width equally** (`flex-1 min-w-0` on both, was
  date-box `shrink-0` + thumbnail `flex-1`) — exact 50/50 split regardless of day-digit-count or
  thumbnail content (also satisfies AC-DATE-4's width-invariant requirement as a side effect).
- **Row is flush** — no padding (`p-2`), no gap (`gap-2`) between date-box and thumbnail, and no
  gap against the card's own edges (superseded BUG-041's `p-2` fix).
- **Thumbnail owns its own height via aspect-ratio**, not by stretching to match the date-box:
  `aspect-[5/6]` (portrait) below a 1200px *viewport* width, widening to `aspect-square` (1:1, the
  max) at/above it — `aspect-[5/6] min-[1200px]:aspect-square`. The date-box now stretches
  (`items-stretch` on the row) to match the thumbnail's height, not the reverse.
- **No border radius** on either the date-box or the thumbnail — square corners, flush at the
  seam and at the card's own edge.
- **TILL badge and favorite badge sit INSIDE the card, not floating past its edge.** An interim
  round (2-3) removed the outer card's `overflow-hidden` and floated both badges on *negative*
  offsets (`-top-1.5 -left-1.5` / `-top-1.5 -right-1.5`) past the card's true corner — **this was
  reverted** (round 4) per user feedback ("the till box should be inside the card not outside" /
  "area outside of the card should not be visible"). Final: `overflow-hidden` restored on the
  outer `<article>`, both badges use *positive* offsets (`top-1.5 left-1.5` / `top-1.5 right-1.5`)
  sitting just inside the card's own edge.
  - `eventCardTillLabelClass('default')` (masonry non-prominent) now returns `top-1.5 left-1.5`.
    `eventCardTillLabelClass('prominent')` (VM1) is **unchanged** — still `-top-3 -left-1.5`,
    floating past its own poster's edge; VM1 was never in scope for this pass.
  - The external sibling favorite badge in `EventCard.tsx` (the with-thumbnail corner pill) moved
    from `top-3 right-3` (BUG-041's old inset) to `top-1.5 right-1.5`, mirroring the TILL badge.
- **`locationName` (VM2 only):** no `MapPin` icon, centered (`text-center`), breaks mid-word if a
  single long word overflows (`break-all`), and stays a **single line** (`line-clamp-1` — a later
  correction; an interim round let it wrap to multiple lines, which the user then said should be
  single-line only). VM1 (`prominentPoster=true`) is **unaffected** — keeps its icon + left-aligned
  single-line truncate treatment; the two states now diverge (`EventCard.tsx` branches on
  `isMasonryDefault`).
- **Date-box month/day centering (round 5):** once the box grew much wider (`flex-1`, matching
  the thumbnail's share of the row), the flex column's default cross-axis alignment
  (`align-items: stretch`) stretched the month/day text to the box's full width without
  centering it, reading as pushed toward the right edge. Fixed with `items-center` on
  `EventCardDateBox`'s root span and `text-center` on the month span (day already had it via
  AC-DATE-4) — masonry `size='default'` only, `size='compact'` (calendar list row) unaffected.

Files: `EventCard.tsx`, `EventCardMediaPrimitives.tsx` (`EventCardDateBox`, `EventCardMediaSlot`'s
`flex-fill` layout, `eventCardTillLabelClass`), both masonry prototypes
(`prototypes/event-card-masonry/default-with-thumbnail.html` /
`default-thumbnail-fallback.html`), `EVENT-CARD-DESIGN.md`.

## 2. Favorite-icon sizing

- **With-thumbnail corner pill:** an interim change made this icon inherit masonry
  `size='default'`'s larger badge-font-size token (1.125rem basis, ~30px icon) — **reverted**
  per user feedback ("fav-icon on small-thumbnail mode is too big, use the previous size"). It's
  back to its original standalone sizing (`eventCardBadgeIconSizeStyle('default')`'s 0.75rem
  fallback, ~20px icon), i.e. no override at all.
- **No-thumbnail (reserved-blank fallback) icon:** bumped from the shared
  `EVENT_CARD_BADGE_ICON_SCALE_LARGE` (2x, used by every other `scale="large"` consumer — VM1's
  own image-fallback, `EventCardCalendarGridItem`, the calendar row's fallback) to a
  **masonry-only** 4x ratio (`EVENT_CARD_BADGE_ICON_SCALE_MASONRY_NO_IMAGE`, exactly
  `calc(var(--event-card-badge-font-size, 0.75rem) * 4)` per the user's own spec), applied via
  `EventCardFavoriteBadge`'s existing `iconSizeStyle` override prop so the shared ratio/other
  consumers are untouched.

Files: `event-card-media-tokens.ts` (new `eventCardBadgeIconSizeStyleForRatio` helper +
`EVENT_CARD_BADGE_ICON_SCALE_MASONRY_NO_IMAGE` constant), `EventCard.tsx`.

## 3. TILL badge / status badge — "ends today" rule

- **TILL badge no longer shows when the end date is today**, in any case (previously showed
  `till hh:mm` when an end time was known, or a bare `till` otherwise) — the status badge below
  now covers this state directly instead, so the TILL tag was pure duplication.
- **Status badge: `Ends hh:mm` replaces the generic `Ends Today`** once the end time is known.
  New `statusEndsAt` label (`{time}`-templated, e.g. `"Ends {time}"` / id: `"Berakhir {time}"`),
  added to both `EventStatusLabels` (masonry) and `WeeklyCalendarViewLabels` (calendar), wired
  into both locale files (`en.json`/`id.json`, `EventCard` + `WeeklyCalendarView` namespaces) and
  all 9 page-level `cardLabels`/`statusLabels` mappings that pass `statusEndsToday` through.
- **Translation bug found and fixed:** calling next-intl's `t('statusEndsAt')` /
  `t('statusInHours')` / `t('statusInDays')` — templated ICU messages fetched *without* supplying
  their placeholder value, so `formatEventStatus` can `.replace()` it in manually after computing
  the value — throws a `FORMATTING_ERROR`/`INVALID_MESSAGE` and falls back to rendering the raw
  dotted key (e.g. literally `"EventCard.statusEndsAt"` on screen). Fixed by switching all three
  keys, at all 9 consumer call sites, from `t(key)` to **`t.raw(key)`** (bypasses ICU processing
  entirely, returns the authored string as-is) — matching this codebase's own pre-existing
  convention for the same pattern (`keywordTemplate` in the AI-filter summary already does this).

Files: `format-event-date.ts` (+ `.test.ts`), `EventCard.types.ts`, `WeeklyCalendarView.tsx` (+
`.types.ts`), `apps/web/locales/{en,id}.json`, and all 9 page files that map `cardLabels`/
`statusLabels` (`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`,
`archive-content.tsx`, `account-content.tsx`, `AccountCalendarView.tsx`, `CalendarView.tsx`,
`FeedCalendarView.tsx`, `my-calendar-content.tsx`).

## 4. Favorite badge "missing" investigation — real root cause found

User reported not seeing the with-thumbnail corner favorite badge. Root cause: **not** an
`EventCard.tsx` bug — `apps/backend/src/schema/resolvers.ts`'s `Post.imageUrl` field resolver
calls `resolveServedImageUrl()` (`packages/domain/src/events/resolveServedImageUrl.ts`), which
only returns the real `imageUrl` if `imageUrlExpiresAt` is set **and still in the future**;
otherwise it falls through to `isImageStorageOptedIn` (defaults `false` on every account) and
returns flat `null` — *regardless* of whether the URL itself is valid. Since no seeded post had
`imageUrlExpiresAt` set, `imageUrl` resolved to `null` for **every** event via GraphQL, so the
real with-thumbnail state was never reachable at all with the existing seed data (every card fell
back to the no-image/reserved-blank state, which never renders the corner pill). This is a
real gap affecting the original 27 scraped-post fixtures too, not just this session's additions —
flagged, not yet fixed project-wide (out of the scope asked for).

## 5. Favorite badge "floating outside/clipped" at some viewport widths (e.g. 1381px)

Reported for the first couple of cards in a masonry grid. Root cause: the no-image-mode
favorite badge's absolute position (`left`/`height`) depends on `dateBoxSize`, which was measured
**exactly once at mount** via a plain `useLayoutEffect` with no dependencies. In a grid where many
cards mount simultaneously, the earliest-mounting cards can capture a size from a layout pass that
hasn't fully settled into its final CSS-Grid column width yet, so a stale, too-wide measurement
pushes the badge's `left` offset past the thumbnail's real edge, where the card's own
`overflow-hidden` clips it. Fixed by attaching a `ResizeObserver` to the date-box (matching this
codebase's existing pattern in `swipe-to-reveal.tsx`/`useMasonryLayout.ts`) so the measurement
stays live instead of one-shot; careful to re-read `offsetWidth`/`offsetHeight` from the element
inside the observer callback rather than using `entry.contentRect` (border-box vs. content-box
mismatch would otherwise make the badge jump on the first resize).

Files: `EventCard.tsx`.

## 6. Seed data — masonry card-mode investigation fixtures

Added 8 new posts/events/schedules to `packages/database/seed.ts` (ids `...028`-`...035` /
`40000000-...-005` through `...012` / `50000000-...-006` through `...013`), all using the user's
supplied CloudFront image
(`https://d176dubv4u3onh.cloudfront.net/posts/27b51505-70f8-4357-9585-f3ab377e05aa`), covering:
with-thumbnail not-started / ongoing (TILL shown) / ends-today, no-image-fallback not-started /
ongoing, prominentPoster (VM1) not-started / ongoing, and a nearby-badge case (<8km from the
seeded "Home Jakarta" location). Each with-thumbnail/prominent fixture post also sets
`imageUrlExpiresAt` far in the future — required for `imageUrl` to actually resolve through
GraphQL per item 4 above; without it these fixtures would have silently rendered as no-image
fallback despite having a real `imageUrl` in the DB.

## 7. Calendar-grid card (VM5/VM6, `EventCardCalendarGridItem`) — status badge reverted, multi-day layout change

Out of scope for the masonry family itself, but changed in this same session and previously
undocumented here:

- **Status badge removed again.** BUG-048 (AC-STATUS-1) had added a shared `EventCardStatusBadge`
  (computed via `formatEventStatus`) to both VM5 (single-day grid cell) and VM6 (multi-day
  spanning bar). Per user feedback ("don't show the now/ending_at badge"), this is **reversed**:
  the `eventStartDate`/`eventStartTime`/`eventEndDate`/`eventEndTime`/`statusLabels`/`locale`/
  `timezone` props, the `useScopedLocale`/`useScopedTimezone` calls, and the `statusBadge` render
  in both compositions are all removed from `EventCardCalendarGridItem.tsx`; the corresponding
  props are deleted from `EventCardCalendarGridItem.types.ts`. This restores the original
  2026-09-14 "no status badge" decision that BUG-048 had marked as "being revisited."
- **Multi-day schedules with no thumbnail now reuse the with-image 3-column row layout** instead
  of falling through to VM5's single-day 2-row stacked composition — the `<img>` element is
  simply omitted when absent/errored (`isMultiDay` now gates the branch, not `showImage`). Per
  user feedback: "replace the grid layout to use the grid from multiday span with thumbnail, with
  the thumbnail not displayed." Single-day schedules (`!isMultiDay`) are unaffected.
- **Card background opacity:** `bg-violet-50` → `bg-violet-50/50` on both compositions, so the
  underlying weekly-grid lines stay visible through the card ("I should see the grid, make the
  card's bg color to have 50% opacity").

Files: `EventCardCalendarGridItem.tsx`, `EventCardCalendarGridItem.types.ts`,
`EventCardCalendarGridItem.test.tsx`.

## 8. `id.json` — `tillLabel` translation change

`EventCard.tillLabel` and `WeeklyCalendarView.tillLabel` (Indonesian) changed from `"sampai"` to
`"s.d."` (abbreviation of "sampai dengan"). Not otherwise covered above since it's a plain string
edit, not part of items 1-6's layout/logic work — flagged here for completeness since it's an
uncommitted change in the same locale file items 3 touches.

## 9. Masonry prominent (VM1) TILL badge — overlap with date-pill text, fixed for real

Item 1's "same top position as non-prominent" fix (`eventCardTillLabelClass('prominent')` moved
from `-top-3` to `top-1.5`, nesting the tag inside the small date-pill) had an unreported side
effect: VM1's date-pill is a small single-line chip (unlike VM2's full-height date box, which has
room to spare above its centered month/day text), so the nested tag at `top-1.5` covered most of
the pill's own date text. A same-day follow-up attempt to fix this by moving the date-pill/
favorite-icon up to a flat `top-2` (removing their old `top-5`-when-TILL-present clearance) made
it *worse* — moving the pill doesn't change the tag's position *relative to the pill* at all, so
it only shrank the card's own top margin for no benefit ("rather than moving till-box down, you
moved the datebox and fav-icon up which make the tillbox covering more datebox area").

**Real fix:** the date-pill and favorite-icon are back to their original `top-5`-when-TILL-
present / `top-2`-otherwise conditional (unmoved from before item 1). The TILL tag is pulled back
*out* of the pill entirely — it's now its own floating sibling `<span>` positioned directly
against the poster's top-left corner (`absolute top-1 left-2`, sized/colored identically to
`eventCardTillLabelClass`'s own chrome, but not routed through that helper since it now targets a
different container), landing in the empty strip the pill's own `top-5` shift opens up above it.
No overlap, and the pill/icon never move.

Files: `EventCard.tsx`.

## 10. `home-content.tsx` — `toggleFavorite` crash + calendar-view icon not updating

- **Crash:** `onMutate`'s `queryClient.setQueriesData({ queryKey: ['events'] }, ...)` matches
  every query cached under the `['events', ...]` prefix, including `CalendarView.tsx`'s own
  `useGetEventsForCalendarQuery` (a plain `useQuery`, not the paginated `useInfiniteQuery` the
  updater assumed — its cache shape is `{ events: { items } }`, no `.pages`). Toggling a favorite
  while the calendar tab was mounted threw `TypeError: Cannot read properties of undefined
  (reading 'map')` at `old.pages.map(...)`.
- **Fix, round 1:** guarded the updater to skip anything without `.pages` — stopped the crash, but
  meant the calendar view's own cached `isFavorited`/`favoriteCount` never got optimistically
  flipped, so its favorite icon silently stayed stale until a refetch.
- **Fix, round 2 (final):** the updater now handles both cache shapes — `old.pages` (the paginated
  card-list/`navigation-hook.ts` shape) and `old.events.items` (`CalendarView`'s plain-query
  shape) — sharing one `toggleItem` helper, so both the card list's and the calendar view's
  favorite icon update immediately. The rollback snapshot also changed from one hardcoded query
  key to `getQueriesData({ queryKey: ['events'] })` (every matched entry), so `onError` restores
  all of them, not just the card list's, if the mutation fails.

Files: `home-content.tsx`.

## 11. Status badge color — `endingSoon`/`startingSoon` variants added

`EventCardStatusBadge` previously had exactly one color exception (`happeningNow` → solid
emerald); every other of the 8 `formatEventStatus` states shared one neutral `bg-muted`. Per user
request, two more states now get their own solid color, extending that exception:

- **`statusEndsAt`/`statusEndsToday`** (event ending soon/today) → `bg-amber-700 text-white`,
  reusing the masonry TILL tag's own amber (already verified ~5.03:1 contrast in
  `EVENT-CARD-DESIGN.md`) so amber reads as one consistent "end-time" color across the card
  family.
- **`statusInHours`** (event starting soon) → `bg-sky-600 text-white` — distinct from amber
  (ending) and emerald (live now); sky rather than indigo/violet since the calendar card's own
  chrome already uses `violet-50/200`.

Mechanically: `EventStatusResult.isHappeningNow: boolean` is replaced with
`variant: 'default' | 'happeningNow' | 'endingSoon' | 'startingSoon'` (`format-event-date.ts`),
`EventCardStatusBadgeProps.isHappeningNow` → `variant` (`EventCardMediaPrimitives.types.ts`), and
`EventCardStatusBadge` now looks up its color from a `variant`-keyed class table instead of one
boolean branch (`EventCardMediaPrimitives.tsx`). Both call sites (`EventCard.tsx`,
`WeeklyCalendarView.tsx`) updated to pass `variant` through. Existing tests referencing the old
`isHappeningNow` boolean prop are not yet updated — pending the user's go-ahead for a check pass.

Files: `format-event-date.ts`, `EventCardMediaPrimitives.types.ts`, `EventCardMediaPrimitives.tsx`,
`EventCard.tsx`, `WeeklyCalendarView.tsx`.

## Known-open items / not done this session

- Item 4's `imageUrlExpiresAt` gap is real for the original 27 scraped-post fixtures too — not
  fixed project-wide.
- The `>1200px` aspect-ratio breakpoint (item 1) keys off raw **viewport** width
  (`min-[1200px]:aspect-square`), not the masonry grid's actual column-driven **card** width —
  flagged earlier in this session as an open question, never resolved with the user.
- No full lint/test/build verification pass has been run on any edit in this document (favorite-
  icon revert, date-box centering, `ResizeObserver` fix, item 9's TILL-badge restructure, item
  10's query-cache fix, item 11's `isHappeningNow`→`variant` rename) — pending the user's explicit
  go-ahead before the next full check, per their standing instruction this session. Item 11 in
  particular leaves `EventCard.test.tsx`/`EventCardMediaPrimitives.test.tsx`/
  `WeeklyCalendarView.test.tsx`'s existing `isHappeningNow` prop assertions unreconciled with the
  new `variant` API until that check runs.
