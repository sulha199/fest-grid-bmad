---
title: 'BUG-049: EventCardNearbyBadge renders real distance, not static "Nearby"'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'bd7106a01cb4394c641ef594cebf00888c8b8a17'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `EventCardNearbyBadge` receives `distanceKm`, self-gates on `< thresholdKm` (default 8,
AD-24 Rule 2, unchanged), but then discards the value and renders a static `labels.nearbyBadge`
string ("Nearby") instead. AC-NEARBY-1/2/3 (`event-card-family-consolidated-acs.md` §2.4).

**Approach:** Change `nearbyBadge` from a bare string to a function-shaped label
`(distanceKm: number) => string`, matching the existing `moreLabel`/`multiDaySegmentLabel`
precedent (`WeeklyCalendarView.types.ts`). Add one shared exported default formatter
(`formatNearbyBadgeDistance`, in `EventCardMediaPrimitives.tsx`) implementing AC-NEARBY-3, and reuse
it as the default everywhere instead of duplicating the rule per call site.

## Boundaries & Constraints

**Always:**
- Threshold-gating (`distanceKm == null || distanceKm >= thresholdKm` → render nothing) is
  UNCHANGED — only the badge's rendered content changes.
- `EventCardStatusBadge` is untouched.
- Update all FOUR call sites together (breaking prop-shape change, no incremental rollout):
  `EventCardMediaPrimitives.tsx` (the primitive's own default), `EventCard.tsx`,
  `WeeklyCalendarView.tsx` (both its own `defaultLabels.nearbyBadge` default AND
  `CalendarCardProps.nearbyBadgeLabel`'s type), `EventCardCalendarGridItem.tsx`. Plus a 4th site
  found during investigation (not named in the original bug report): `CalendarOverflowDialog.tsx`
  / `CalendarOverflowDialogLabels.nearbyBadgeLabel`, which forwards a string into
  `EventCardCalendarGridItem`'s `labels.nearbyBadge` today and breaks type-wise once that becomes a
  function.
- Update every type: `EventCardNearbyBadgeLabels.nearbyBadge`, `EventCardLabels.nearbyBadge`,
  `WeeklyCalendarViewLabels.nearbyBadge`, `CalendarCardProps.nearbyBadgeLabel`,
  `EventCardCalendarGridItemProps.labels.nearbyBadge`, `CalendarOverflowDialogLabels.nearbyBadgeLabel`
  → all become `(distanceKm: number) => string`.
- Update backlog.yaml's BUG-049 note to flag that BUG-044 must pick up i18n for this new
  function-shaped label.

**Ask First:** none anticipated — shape and rounding rule are fully specified below.

**Never:** do not touch `< thresholdKm` gating logic; do not wire next-intl/translations (BUG-044);
do not touch `EventCardStatusBadge`.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected Output | Error Handling |
|----------|-------|------------------|-----------------|
| Round number ≥2km | `distanceKm=5` | `"5 km"` | N/A |
| Exactly 2.0km | `distanceKm=2` | `"2 km"` (no decimal — `>=2` branch) | N/A |
| Sub-2km with fraction | `distanceKm=1.2` | `"1.2 km"` (1 decimal) | N/A |
| 1.95km stays <2km raw | `distanceKm=1.95` | `"1.9 km"` — verified against real JS behavior (not assumed): 1.95 isn't exactly representable in IEEE-754 double, so `(1.95).toFixed(1) === '1.9'`. Branch selection always uses the raw value (still `<2` here regardless), never a rounded one — the digit result is real JS float behavior, not a design choice. | N/A |
| 1.95 vs 2.05 boundary sanity | `distanceKm=2.05` | `"2 km"` (`>=2` branch, `Math.round(2.05)` = 2) | N/A |
| Zero | `distanceKm=0` | `"0.0 km"` (`<2` branch) | N/A |

</frozen-after-approval>

## Code Map

- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` -- `EventCardNearbyBadge` (line ~390-413): add + export `formatNearbyBadgeDistance`, change its own `defaultLabels.nearbyBadge` default to that function, render `defaultLabels.nearbyBadge(distanceKm)`.
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` -- `EventCardNearbyBadgeLabels.nearbyBadge` (line 176): type → `(distanceKm: number) => string`.
- `packages/ui/src/features/events/EventCard.tsx` -- `defaultLabels.nearbyBadge` (line 102) default → import `formatNearbyBadgeDistance`; call site at line 421 unchanged (still forwards `defaultLabels.nearbyBadge`).
- `packages/ui/src/features/events/EventCard.types.ts` -- `EventCardLabels.nearbyBadge` (line ~30): type → function.
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` -- `defaultLabels.nearbyBadge` (line 316) default → `formatNearbyBadgeDistance`; `CalendarCardProps.nearbyBadgeLabel` (line 933/960) type → function; render at line 1154 unchanged (`labels={{ nearbyBadge: nearbyBadgeLabel }}`).
- `packages/ui/src/features/events/WeeklyCalendarView.types.ts` -- `WeeklyCalendarViewLabels.nearbyBadge` (line 96) type → function.
- `packages/ui/src/features/events/EventCardCalendarGridItem.tsx` -- `defaultLabels.nearbyBadge` (line 34) default → `formatNearbyBadgeDistance`.
- `packages/ui/src/features/events/EventCardCalendarGridItem.types.ts` -- inline `labels.nearbyBadge` (line 44) type → function.
- `packages/ui/src/features/events/CalendarOverflowDialog.tsx` -- `defaultLabels.nearbyBadgeLabel` (line 94) default → `formatNearbyBadgeDistance`.
- `packages/ui/src/features/events/CalendarOverflowDialog.types.ts` -- `CalendarOverflowDialogLabels.nearbyBadgeLabel` (line 44) type → function.
- Test files needing updated assertions (replace `getByText('Nearby')`/`toHaveTextContent('Nearby')` with the actual formatted distance for the fixture's `distanceKm`): `EventCardMediaPrimitives.test.tsx`, `EventCard.test.tsx`, `WeeklyCalendarView.test.tsx`, `EventCardCalendarGridItem.test.tsx`, `CalendarOverflowDialog.test.tsx`, `EventListView.test.tsx` (found via `pnpm --filter @festgrid/ui test`), and `apps/web/src/app/[locale]/nearby.test.tsx` (found via the repo-wide unfiltered `pnpm test` — a real 0km-distance masonry integration test unrelated to the same file's other "Nearby" text, which is an unrelated filter-select `<label>`, left untouched).
- `_bmad-output/implementation-artifacts/backlog.yaml` -- BUG-049 note: append the i18n/BUG-044 follow-up mention (already partially present; confirm/extend), mark status `done` after ship.

## Tasks & Acceptance

**Execution:**
- [x] `EventCardMediaPrimitives.tsx` -- add exported `formatNearbyBadgeDistance(distanceKm: number): string` (`>=2` → `` `${Math.round(distanceKm)} km` ``, else → `` `${distanceKm.toFixed(1)} km` ``); use as default; render `defaultLabels.nearbyBadge(distanceKm)`.
- [x] `EventCardMediaPrimitives.types.ts` -- widen `EventCardNearbyBadgeLabels.nearbyBadge` to function type.
- [x] `EventCard.tsx` + `EventCard.types.ts` -- swap default + type.
- [x] `WeeklyCalendarView.tsx` + `WeeklyCalendarView.types.ts` -- swap default + both affected type sites (`WeeklyCalendarViewLabels.nearbyBadge`, `CalendarCardProps.nearbyBadgeLabel`).
- [x] `EventCardCalendarGridItem.tsx` + `.types.ts` -- swap default + type.
- [x] `CalendarOverflowDialog.tsx` + `.types.ts` -- swap default + type (4th site, discovered during investigation).
- [x] Unit tests: add a focused `formatNearbyBadgeDistance` boundary suite (≥2 no-decimal, <2 one-decimal, exactly 2, 1.95, 2.05, 0) in `EventCardMediaPrimitives.test.tsx`; update all 5 existing test files' `'Nearby'` text assertions to the real formatted string for their fixture's `distanceKm`.
- [x] `backlog.yaml` -- confirm/extend BUG-049 note with the BUG-044 i18n follow-up; set `status: done`.

**Acceptance Criteria:**
- Given `distanceKm=5` and default labels, when `EventCardNearbyBadge` renders, then it shows "5 km" (no decimal).
- Given `distanceKm=1.2`, when rendered, then it shows "1.2 km" (1 decimal).
- Given `distanceKm=8` (>= default threshold), when rendered, then nothing renders (gate unchanged).
- Given each of the 4 call sites (`EventCard` masonry, `WeeklyCalendarView` list/mobile row, `EventCardCalendarGridItem`, `CalendarOverflowDialog`), when a schedule with a known sub-threshold `distanceKm` renders, then the badge shows that schedule's real formatted distance, not a fixed word.

## Design Notes

Single shared `formatNearbyBadgeDistance` (exported from `EventCardMediaPrimitives.tsx`, imported by
the other 3 files) avoids re-implementing the `>=2`/`<2` rule 4 separate times — matches this
codebase's existing reuse-first convention for cross-cutting label logic. Branch selection always
uses the raw `distanceKm` (never a rounded display value), so `1.95` stays in the `<2` branch; its
rendered text is `"1.9 km"`, verified against real JS `toFixed` behavior rather than assumed
(`1.95` isn't exactly representable in IEEE-754 double).

**Post-implementation review (patch fixes, no spec change):** two robustness gaps found by adversarial/edge-case review, both fixed directly (no loopback — trivially fixable, not spec-level):
1. Non-finite/negative `distanceKm` (`NaN`, `Infinity`, `-Infinity`, negative) used to be masked by the old static "Nearby" label; rendering it through the new formatter would surface visibly broken text ("NaN km"). Now treated like an unknown distance (badge omitted), in all 5 files' shared gate (`EventCardMediaPrimitives.tsx`).
2. All 5 `defaultLabels` merges changed from `{ nearbyBadge: formatNearbyBadgeDistance, ...labels }` (spread-after-default) to `{ ...labels, nearbyBadge: labels.nearbyBadge ?? formatNearbyBadgeDistance }` (nullish-coalescing after spread) — a caller passing `labels={{ nearbyBadge: undefined }}` used to silently render nothing; with the function shape it would instead throw calling `undefined(distanceKm)`.
Reviewed-and-rejected: rounding vs. the `<8km` gate showing "8 km" at 7.99km, and "0.0 km" at sub-1km distances, are both exactly AC-NEARBY-3 as specified/approved, not defects; hardcoded "km" unit and non-locale-aware number formatting are explicitly deferred to BUG-044 per the frozen intent; a claimed incomplete call-site sweep was checked and found unfounded (repo-wide grep + no Storybook files exist).

## Verification

**Commands:**
- `pnpm --filter @festgrid/ui test -- EventCardMediaPrimitives EventCard WeeklyCalendarView EventCardCalendarGridItem CalendarOverflowDialog` -- expected: all pass, including new boundary tests.
- `pnpm --filter @festgrid/visual-audit test:manifests` -- expected: pass (confirmed via grep: `event-card-date-box-sizing.ts` and `grid-container-masonry.ts` mount real `EventCard` but neither passes `distanceKm`, so the badge never renders there — no manifest changes needed, just confirming no regression).
- `pnpm -w build` and `pnpm -w lint` and `pnpm -w test` -- expected: clean, repo-wide.

**Manual checks (if no CLI):**
- Render each of the 4 call sites with a real sub-threshold `distanceKm` (e.g. via a quick local story/Storybook-less component render or existing test harness) and visually confirm the badge text is the distance, not "Nearby".

## Suggested Review Order

**Shared formatter + primitive (the entry point)**

- New shared formatter implementing AC-NEARBY-3's `>=2`/`<2` rounding rule, exported for reuse by all 4 call sites.
  [`EventCardMediaPrimitives.tsx:391`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L391)

- The badge now calls the label as a function with the real `distanceKm`, replacing the discarded-value bug.
  [`EventCardMediaPrimitives.tsx:406`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L406)

- Post-review fix: nullish-coalescing, not spread-after-default, so an explicit `undefined` label still falls back instead of crashing.
  [`EventCardMediaPrimitives.tsx:418`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L418)

- Post-review fix: non-finite/negative `distanceKm` is now treated like an unknown distance (omitted), not rendered as broken text.
  [`EventCardMediaPrimitives.tsx:425`](../../packages/ui/src/features/events/EventCardMediaPrimitives.tsx#L425)

**Type-shape change (breaking, by design)**

- `nearbyBadge` widened from a bare string to `(distanceKm: number) => string`, the contract every call site now implements.
  [`EventCardMediaPrimitives.types.ts:182`](../../packages/ui/src/features/events/EventCardMediaPrimitives.types.ts#L182)

**The 4 call sites (same default-swap + nullish-coalescing pattern)**

- Masonry variant's default swap, same crash-guard pattern as the primitive.
  [`EventCard.tsx:107`](../../packages/ui/src/features/events/EventCard.tsx#L107)

- Calendar list/mobile-row variant's default swap.
  [`WeeklyCalendarView.tsx:321`](../../packages/ui/src/features/events/WeeklyCalendarView.tsx#L321)

- Desktop calendar grid item's default swap.
  [`EventCardCalendarGridItem.tsx:38`](../../packages/ui/src/features/events/EventCardCalendarGridItem.tsx#L38)

- The 4th call site found during investigation (not named in the original bug report) — forwards into `EventCardCalendarGridItem`'s `labels.nearbyBadge` and would have silently type-broken otherwise.
  [`CalendarOverflowDialog.tsx:99`](../../packages/ui/src/features/events/CalendarOverflowDialog.tsx#L99)

**Bookkeeping**

- BUG-049 marked `done`; note extended with the 4th-call-site finding and the BUG-044 i18n follow-up.
  [`backlog.yaml:1575`](backlog.yaml#L1575)

**Tests (peripheral)**

- New boundary suite for the formatter, including the two review-driven edge-case tests (non-finite/negative distance, explicit-`undefined` label).
  [`EventCardMediaPrimitives.test.tsx:532`](../../packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx#L532)
