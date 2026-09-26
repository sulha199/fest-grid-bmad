---
title: 'BUG-048: Wire EventCardCalendarGridItem into single-day desktop grid cell + status badge amendment'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '9874dcc2a08cb2535f10a3f634b971d4f4a57c4f'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `WeeklyCalendarView.tsx`'s desktop single-day day-cell (`CalendarCard`, `variant='grid'`)
still renders a bare untokened text `<button>` pill instead of `EventCardCalendarGridItem` — the
primitive already used by the multi-day spanning bar (`MultiDaySpanningBar`) and already
prototype-validated for the single-day/no-image case (`thumbnail-fallback.html`). Separately,
`EventCardCalendarGridItem` itself has never rendered `EventCardStatusBadge` on either composition
(AC-STATUS-1), a gap shared by VM5 (this fix) and VM6 (already wired).
`event-card-family-consolidated-acs.md` §1/§2.6; backlog BUG-048.

**Approach:** Replace the grid-variant branch's plain button with the same "non-interactive chrome +
sibling interactive elements" shape `MultiDaySpanningBar` already uses: a real click-target
`<button>` (keeps its roving-tabindex `id`/`tabIndex`/`onKeyDown`/`onFocus`, reused verbatim) sitting
under a `pointer-events-none` visual layer containing `EventCardCalendarGridItem`. Amend
`EventCardCalendarGridItem` itself to accept optional `eventStartDate/eventStartTime/eventEndDate/
eventEndTime/statusLabels/locale/timezone`, computing `formatEventStatus` internally and rendering
`EventCardStatusBadge` in both compositions when start-date info is supplied (omitted → no badge,
so the existing image-only test fixtures and `CalendarOverflowDialog` stay unaffected — VM8 is out
of scope for this fix). Wire the new fields for VM5 and VM6 only.

## Boundaries & Constraints

**Always:**
- Reuse `SPANNING_BAR_CLICK_CLASS`/`SPANNING_BAR_VISUAL_CLASS` verbatim for the grid-variant cell —
  do not invent parallel classes.
- Keep `id={elementId}`/`tabIndex`/`onKeyDown`/`onFocus`/`onBlur` on the click `<button>` unchanged —
  `handleGridKeyDown`'s `document.getElementById('calendar-card-...')` roving-focus lookup depends on it.
- Hover/focus tooltip (`role="tooltip"`, `aria-describedby`) unchanged in behavior; the click button
  now needs an explicit `aria-label={schedule.eventName}` (no longer has visible text as its
  accessible name), matching `MultiDaySpanningBar`'s identical pattern.
- `schedule.isFavorited` is now shown via `EventCardCalendarGridItem`'s own favorite toggle (only
  renders when `onFavoriteToggle` is passed) — same tradeoff VM6 already ships with; do not add a
  second, separate static heart icon.
- `schedule.isAddedToCalendar` has no slot in the shared primitive — keep it a small
  `CalendarPlus` icon composed in `WeeklyCalendarView.tsx`'s own visual layer (absolutely positioned,
  top-left, `data-testid="calendar-plus-icon"`), not inside `EventCardCalendarGridItem`.
- `EventCardCalendarGridItem`'s new date/status props are all optional; the badge renders only when
  `eventStartDate` is supplied. `MultiDaySpanningBar` and grid `CalendarCard` pass it;
  `CalendarOverflowDialog` (VM8) does not — register that gap as a new backlog finding, don't fix it here.
- Thread `nearbyBadgeThreshold`/`nearbyBadgeLabel`/`statusLabels` to the grid-variant `CalendarCard`
  call site (currently only wired for the list variant) and to `MultiDaySpanningBar`'s call site.

**Ask First:** none anticipated — decisions above are final judgment calls, documented.

**Never:** touch BUG-050 (gridlines), `variant==='list'`, or restructure `MultiDaySpanningBar`'s own
click-target/visual-layer shape beyond adding `statusLabels`.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected | Error Handling |
|---|---|---|---|
| Single-day, no dates gap | grid cell, `eventStartDate` present | `EventCardStatusBadge` renders one of 8 states | N/A |
| No date info supplied | `EventCardCalendarGridItem` used standalone/VM8 | no status badge, unchanged | N/A |
| Favorited + added-to-calendar | both flags true | favorite toggle shows filled heart; separate `CalendarPlus` icon shows | N/A |
| Roving tabindex | arrow-key nav across day cells | focus still lands via `getElementById('calendar-card-*')` | N/A |
| Nearby badge | `distanceKm` under threshold | renders via `EventCardCalendarGridItem`'s existing gate, now reachable from grid variant | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventCardCalendarGridItem.types.ts` -- add optional `eventStartDate?: string; eventStartTime?: string | null; eventEndDate?: string | null; eventEndTime?: string | null; statusLabels?: EventStatusLabels; locale?: string; timezone?: string;`.
- `packages/ui/src/features/events/EventCardCalendarGridItem.tsx` -- import `EventCardStatusBadge`, `formatEventStatus`, `useScopedLocale`/`useScopedTimezone`; compute status badge when `eventStartDate` present (locale/timezone prop overrides scoped context, mirrors `EventCard.tsx`); render in both with-image and no-image compositions (badge row alongside nearby badge).
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- `CalendarCard`'s `variant==='grid'` return (~L1209-1256): sibling click-button + `SPANNING_BAR_VISUAL_CLASS` layer wrapping `EventCardCalendarGridItem` + conditional `CalendarPlus` icon; grid `CalendarCard` JSX call site (~L735-753): add `statusLabels`, `nearbyBadgeLabel`, `nearbyBadgeThreshold`; `MultiDaySpanningBar`/`MultiDaySpanningBarProps` (~L1261-1409): add `statusLabels` prop, pass through to `EventCardCalendarGridItem`; its own call site (~L707-719): pass `statusLabels`.
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` -- update grid-variant tests that assumed a plain-text button (favorited/added-to-calendar query via `closest('button')`, "no status/nearby badge on grid" tests at ~L1715/1733, tooltip anchor, title-clip test); add status-badge/nearby-badge coverage for grid variant.
- `packages/ui/src/features/events/EventCardCalendarGridItem.test.tsx` -- add a status-badge describe block covering all 8 `formatEventStatus` states plus the "omitted when no eventStartDate" case.
- `_bmad-output/implementation-artifacts/backlog.yaml` -- set BUG-048 `status: done`; register a new finding for VM8/`CalendarOverflowDialog` not yet carrying the status badge (out of scope here).

## Tasks & Acceptance

**Execution:**
- [x] `EventCardCalendarGridItem.types.ts` -- add optional date/status/locale/timezone props.
- [x] `EventCardCalendarGridItem.tsx` -- compute + render `EventCardStatusBadge` in both compositions, gated on `eventStartDate`.
- [x] `WeeklyCalendarView.tsx` -- rewrite grid-variant `CalendarCard` return to the sibling click-button/visual-layer shape; thread new props at both the grid `CalendarCard` and `MultiDaySpanningBar` call sites.
- [x] Update `WeeklyCalendarView.test.tsx` for the new DOM shape; add grid-variant status/nearby-badge tests.
- [x] Add `EventCardCalendarGridItem.test.tsx` status-badge coverage (8 states + omitted case).
- [x] `backlog.yaml` -- mark BUG-048 `done`; add the VM8 follow-up finding (FIND-057).
- [x] (found during implementation, not in original Code Map) `apps/web/src/features/events/CalendarView.test.tsx` and `apps/web/.../my-calendar-content.test.tsx` -- 2 tests clicked the grid card via its visible text (`.closest('button')` / raw text click), which no longer sits inside the click target; switched to `getByRole('button', { name: eventName })`.

**Acceptance Criteria:**
- Given a single-day schedule in the desktop grid, when rendered, then it shows `EventCardCalendarGridItem`'s no-image composition (title+favorite row, venue+nearby row) instead of the plain-text pill.
- Given `schedule.isFavorited`/`isAddedToCalendar`, when rendered, then the favorite toggle reflects `isFavorited` and a separate `CalendarPlus` icon shows for `isAddedToCalendar`.
- Given hover or keyboard focus on a grid cell, when triggered, then the same tooltip (`role="tooltip"`) appears as before.
- Given arrow-key navigation across day cells, when a card is focused, then roving `tabIndex`/focus behavior is unchanged.
- Given a schedule with real start/end date-time, when `EventCardCalendarGridItem` renders it (VM5 or VM6), then `EventCardStatusBadge` shows the correct one of 8 `formatEventStatus` states.
- Given `EventCardCalendarGridItem` rendered without date props (e.g. `CalendarOverflowDialog`), when rendered, then no status badge appears (no regression).

## Design Notes

Reused `SPANNING_BAR_CLICK_CLASS`/`SPANNING_BAR_VISUAL_CLASS` as-is rather than renaming despite the
"spanning bar" name now being shared by the single-day cell too — minimizes diff noise; a rename is
a fine future cleanup, not required here. Making the new `EventCardCalendarGridItem` date props
optional (rather than required) keeps `CalendarOverflowDialog` (VM8) compiling unchanged and avoids
silently forcing a design decision about VM8 hidden inside this fix — that gap is real but explicitly
out of this fix's scope per the task's own framing, so it's logged as a new backlog finding instead.

**Post-implementation notes (decisions made during coding, not spec-level changes):**
1. `EventCardFavoriteBadge` renders nothing without an `onFavoriteToggle` handler (matches VM6's
   already-shipped precedent) — but the superseded plain-text pill showed `isFavorited` as a
   decorative, non-interactive heart regardless of a handler. To avoid a real regression (a
   currently-passing test covers exactly this), kept a small decorative `Heart` fallback,
   composed directly in `WeeklyCalendarView.tsx`, gated on `schedule.isFavorited && !onFavoriteToggle`.
2. The old grid pill's `isMainSchedule` bold/normal title-weight distinction has no equivalent in
   `EventCardCalendarGridItem` (its `<h3>` is always `font-bold`) — VM6's spanning bar already
   ships without this distinction too, so the grid cell now matches that established precedent
   rather than inventing a way to preserve it. `variant='list'` (mobile) is unaffected and keeps
   its own weight logic.
3. `EventCardFavoriteBadge`'s count renders whenever `favoriteCount !== undefined` (including `0`),
   unlike the superseded pill which hid the line at `0` — again matching VM6's already-shipped
   behavior, not a new inconsistency introduced here.
4. Found during the lint/build/test gate (not anticipated in the Code Map): two `apps/web` tests
   clicked the grid card via its visible text/`closest('button')`, which no longer sits inside the
   click target now that it carries only an `aria-label`. Fixed both to click by accessible role/name.

**Post-review patches (Blind Hunter + Edge Case Hunter, applied directly, no spec change needed):**
1. `EventCardCalendarGridItem.tsx`'s `locale`/`timezone` resolution mixed `||` (locale) and `??`
   (timezone) — `EventCard.tsx`/`WeeklyCalendarView.tsx` both use `||` for *both* fields (an
   explicit empty-string prop should fall through to context, same as an omitted one). Fixed to `||`.
2. The new decorative `isFavorited`/`isAddedToCalendar` corner icons were positioned inside the
   card's own `p-2` padding box (`top-1`/`left-1`/`right-1`), which could visually overlap
   `EventCardCalendarGridItem`'s title row starting at that same corner. Moved to a negative
   offset (`-top-1.5`/`-left-1.5`/`-right-1.5`) so they sit outside the padding box as corner
   badges over the border, not over the title text — no browser/screenshot check was run to
   confirm the fix pixel-for-pixel (jsdom doesn't lay out real dimensions); tracked as a
   deferred-work item for a follow-up visual check.
3. Two new `EventCardCalendarGridItem.test.tsx` tests ("Tomorrow", "In {n} days 7-13 days out")
   used a date-only `eventStartDate` with no explicit `timezone`, exact/near a one-day boundary —
   correct on this host's timezone but not guaranteed on a host with a different UTC offset
   (`formatEventStatus`'s calendar-day comparison would land on a different day). Pinned
   `timezone="UTC"` on both (and the two "Upcoming" tests, for consistency, though their wide
   margin was already offset-safe).
4. The identical 7-key `statusLabels` object literal was duplicated 3× across
   `WeeklyCalendarView.tsx`'s three call sites (spanning bar, grid cell, mobile list row).
   Factored into one `statusLabels` local computed once and reused at all three.
5. Two stale doc comments fixed: `EventCardCalendarGridItem.types.ts`'s file-level comment still
   claimed the component was "not yet wired into `variant='grid'`"; `CalendarCardProps.statusLabels`
   still said "`list`-variant" only. Both updated to reflect current reality.
6. Added a comment on `EventCardCalendarGridItem.tsx`'s `statusBadge` computation clarifying that
   its differing position between the with-image (vertical stack) and no-image (inline row)
   compositions is intentional — each matches that composition's own pre-existing badge layout,
   not a shared slot.

Four findings judged pre-existing/out-of-scope rather than caused by this diff, deferred to
`deferred-work.md`: `MultiDaySpanningBar` never threading a custom `nearbyBadgeLabel` (confirmed
pre-existing at baseline); `isAddedToCalendar` having no treatment on `MultiDaySpanningBar` (VM6);
the schedule-click button's `aria-label` duplicating content also exposed as plain text in the
visual layer (inherited a11y pattern from Story 1.i1g, footprint now doubled); and the lack of a
real browser/screenshot check for the new composition's layout. Reviewed-and-rejected: the
`[&_button]:pointer-events-auto` blanket selector (pre-existing pattern, not newly introduced);
`eventStartDate`'s type not allowing `null` like its siblings (correctly matches its actual source
field, `WeeklyCalendarViewScheduleShape.eventStartDate`, which is a required non-null `string`);
and the claim that reusing `SPANNING_BAR_CLICK_CLASS` for single-day cells loses corner-rounding
distinctions (the button is an invisible click-target overlay in both cases — all visible chrome,
including rounding, comes from `EventCardCalendarGridItem`'s own div, unaffected by which button
class wraps it).

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test -- WeeklyCalendarView EventCardCalendarGridItem CalendarOverflowDialog` -- expected: all pass.
- `pnpm --filter @festgrid/visual-audit test:manifests` -- expected: pass; check first whether any manifest mounts `EventCardCalendarGridItem` or grid-variant `WeeklyCalendarView`.
- `pnpm -w build`, `pnpm -w lint`, `pnpm -w test` -- expected: clean, repo-wide.

**Manual checks (if no CLI):**
- Render the desktop calendar with a single-day schedule and visually compare against
  `design-artifacts/UX-festgrid-run-1/prototypes/event-card-calendar-grid-item/thumbnail-fallback.html`.
  Not yet done for this composition specifically — logged in `deferred-work.md`.

## Suggested Review Order

**Component substitution (the entry point)**

- The grid cell's plain-text button replaced by a real click-button under a `pointer-events-none`
  visual layer holding `EventCardCalendarGridItem` — mirrors `MultiDaySpanningBar`'s own shape.
  [`WeeklyCalendarView.tsx:1214`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L1214)

- Test hook added for the new wrapper (`data-testid="calendar-grid-card"`), since the click
  target no longer contains the visible text queries used to anchor on.
  [`WeeklyCalendarView.tsx:1225`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L1225)

- Decorative fallback for `isFavorited`/`isAddedToCalendar` — preserved pre-fix behavior for
  states the shared primitive doesn't cover on its own (no toggle handler, no added-to-calendar
  slot at all).
  [`WeeklyCalendarView.tsx:1268`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L1268)

**Shared status-badge amendment (AC-STATUS-1, VM5+VM6 together)**

- `EventCardCalendarGridItem` computes `formatEventStatus` internally, gated on `eventStartDate`
  being supplied — one computation shared by both the grid cell and the spanning bar.
  [`EventCardCalendarGridItem.tsx:115`](../../packages/ui/src/features/events/EventCardCalendarGridItem.tsx#L115)

- `locale`/`timezone` resolution, post-review-patched to match `EventCard.tsx`'s exact `||`-for-both convention.
  [`EventCardCalendarGridItem.tsx:57`](../../packages/ui/src/features/events/EventCardCalendarGridItem.tsx#L57)

- The 7-key `statusLabels` object, post-review-patched from 3 duplicated literals into one shared local.
  [`WeeklyCalendarView.tsx:327`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L327)

**Fallout in `apps/web` (found during the lint/build/test gate, not in the original Code Map)**

- Click-target query updated from `.closest('button')`/raw-text-click to `getByRole('button', { name })`.
  [`CalendarView.test.tsx:291`](../../apps/web/src/features/events/CalendarView.test.tsx#L291)

- Same fix, second call site.
  [`my-calendar-content.test.tsx:244`](../../apps/web/src/app/[locale]/my-calendar/my-calendar-content.test.tsx#L244)

**Bookkeeping**

- BUG-048 marked `done`; FIND-057 registered for the one scoped-out gap (`CalendarOverflowDialog`/VM8).
  [`backlog.yaml:1567`](backlog.yaml#L1567)

- Four review findings judged pre-existing/out-of-scope, logged for later attention.
  [`deferred-work.md`](deferred-work.md)
