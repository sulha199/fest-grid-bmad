---
batch: event-pages-closeout-wave-a
swept: true
date: 2026-09-30
scope: batch-scoped (not per-epic) — stories dispatched from event-pages-closeout-wave-plan.md Wave A, plus Wave B dependents
gates: [1, 3]
stories_covered: [1.6d, 1.6c, 1.3k, 0.i5d, 0.i5e, 0.38, 1.6e, 0.i6e]
new_prerequisite_stories: []
---

# Batch Readiness — Event Pages Closeout, Wave A (+ Wave B dependents)

Gate 1 (architecture/infra) and Gate 3 (foundational/cross-cutting) run once over the batch.
Gate 2 (UI) stays per-story. No epic 0.i5 / 0.i6 / 1 report covered these stories before
(`epic-1-readiness.md` and `epic-0-readiness.md` predate them), so this is their first sweep.
Every dependency and file reference was checked against source and `sprint-status.yaml`.

**Headline:** no new prerequisite stories. **1.3k must be amended before dispatch**; 1.6e, 0.i6e
and 0.i5e need small AC corrections; 1.6d, 1.6c, 0.i5d, 0.38 are ready.

## Verified facts
- Prerequisite statuses match the wave plan: 1.3j, 1.3l, 0.i5a, 0.i5b, 0.38a, 0.42 = `review`; 1.i1n = `done`.
- Prerequisite code exists: `useListPaginationController`, `usePrefersReducedMotion`, `usePwaInstallPrompt`,
  `useAmbientCapabilityAskSlot`, `AppShell` `ambientBanner` prop; 1.3l landed in feed/favorites;
  1.3j batched query is inline in the `events` resolver (~3461), so 1.6c Task 1's extraction is real.
- `idx_calendar_additions_active(userId, scheduleId)` exists. AD-17/19/20/21 exist in the spine.
- Nothing in `apps/web/src` uses `cache()` yet (1.6c "first use" is true).
- `@radix-ui/react-radio-group` only in `apps/web`; 0.i5d already adds it to `packages/ui`.

## Gate 1 — Architecture / Infrastructure
No gap found for 1.6c, 1.6d, 1.6e, 0.i6e, 0.i5d, 0.i5e, 1.3k (additive nullable column + GraphQL
field; all three schedules selects pass it through; AD-23 stays safe).

Non-blocking notes:
- **0.38 installability:** AD-21 excludes PWA installability, yet the story calls architecture
  "complete". Manifest/icons/`start_url` have no AD; the caching SW is scoped to `/{locale}/events/`.
  Task 3.3 (manual Lighthouse) must confirm install works. If Lighthouse objects, do NOT widen SW
  scope (breaks AD-21 Rule 3). Add a short AD-21 amendment or story note. Reconcile icon paths:
  story adds `/icons/icon-192.png`; `push-notifications.ts` references non-existent `/icon-192x192.png`.
- **0.i5d + day-of-week schedules:** TODAY/UPCOMING ignore `applicableDaysOfWeek` — this is
  BUG-026's still-open matching fix, not a new gap.

## Gate 3 — Foundational / cross-cutting (incl. cross-epic reuse)
No new Epic 0 tooling needed.
- **1.3k `useHoverFocusTooltip` premise is stale:** three hand-rolled copies exist — `CalendarCard`
  (~1083), `MultiDaySpanningBar` (~1461, unmentioned in 1.3k), `useNavRailItemInteraction`.
  In-story narrow hook remains proportionate; AC11/Task 4 must name `MultiDaySpanningBar` as a
  mandatory consumer; nav-rail refactor is an optional follow-up.
- **LocationLink ↔ AD-14 / 0.i7z ratchet coupling:** `mapper.test.ts` "mapUrl gating (Story 0.i7c /
  0.i7z)" is the CI enforcer cited by AD-14 Rule 2 and the 0.i7z story (`review`). 1.6e AC6 deletes
  it without mentioning the ratchet.
- `mapper.ts` is the only Google Maps URL builder, so 1.6d centralises cleanly.
- 0.i5d's `TemporalFilterToggle` / `EventFilterInput.temporalFilter` is what IDEA-038 extends, so
  **IDEA-038 also depends on 0.i5d** (wave plan lists only 0.i5e; tracking doc says "0.i5e + 1.3l done").
- 0.38 is first consumer of 0.42's `pwa-install` slot; ordering already correct.

## Per-story verdicts
| Story | Verdict | Reason |
|---|---|---|
| 1.6d | READY | Prereqs present. Add AC: blank `name` renders nothing (correction 2). |
| 1.6c | READY | 1.3j `review`; page/wrapper premises match code. |
| 0.i5d | READY | New `packages/ui` dep and i18n namespace already handled. |
| 0.38 | READY | 0.38a, 0.42 `review`; see installability note. |
| 0.i5e | READY-WITH-CORRECTION | Correction 4. |
| 1.6e | READY-WITH-CORRECTION | Needs 1.6d. Corrections 2, 3. |
| 0.i6e | READY-WITH-CORRECTION (minor) | Needs 1.6d. Correction 3 (ratchet-cite new consumer). |
| 1.3k | **DO NOT DISPATCH AS WRITTEN** | Drafted 2026-09-17 against a since-changed `WeeklyCalendarView` (1.i1f/g/h/j, BUG-047/048). Correction 1. |

## Corrections (applied 2026-09-30 — story files, AD-14 spine line, wave plan, tracking doc and backlog.yaml updated; see each story's "Readiness correction 2026-09-30" note)
1. **1.3k**
   - AC4/AC5: ignores `spanningSchedules`/`MultiDaySpanningBar` (bars built from raw start/end ~490–520;
     a Monday-only Sep 7–28 schedule would render a week-wide bar). `spanningScheduleIds` (~541)
     excludes by schedule id, so Mon+Tue run plus isolated Friday loses Friday. Require run-based
     entries, segment-level exclusion, and "+N more"/overflow counting isolated occurrences.
   - AC5 "Day X of N": `multiDayBadgeText` no longer exists; logic is `computeCalendarSegmentDateBoxContent`
     in `format-event-date.ts` and must take run bounds.
   - AC8: grid cell is now separate `EventCardCalendarGridItem` with absolutely-positioned corner
     `isAddedToCalendar` icon (~1373); no leading-icon row. Badge also needed in spanning bar and grid item.
   - Stale refs: list variant no longer shows `isFavorited` icon; line numbers stale (`CalendarCard`
     tooltip ~1083; `Event.schedules` resolver ~3946); Gate 3 rationale wrong.
   - AC3: "after 0058" → "next sequential number at dev time" (last is `0060_square_pretty_boy.sql`).
   - Depends-on: add BUG-047, BUG-048, 1.i1f, 1.i1g, 1.i1j, 1.i1k, 1.i1l, 1.i1m.
   - Optional: split data slice (column + GraphQL field + mapping) as `1.3ka` if too large.
2. **1.6e / 1.6d:** `scheduleLocation = schedule.location || event.location` (line 467) — with
   `LocationLink`, an event-level fallback becomes a search link and empty name an empty `<a>`.
   Specify intended behavior; add 1.6d AC that blank `name` renders nothing.
3. **1.6d / 1.6e / 0.i6e:** replace enforcement before deleting the `mapper.test.ts` block:
   `LocationLink.test.tsx` carries a 0.i7z ratchet header and covers confidence boundaries
   (`>=0.5`, `full_match`, `null`, `undefined`); update AD-14 "Enforced by" (~spine 376–380) to cite
   `packages/ui/src/core/LocationLink.test.tsx` + mapper passthrough test; cite 0.i6e's new consumer.
   (`git show d95d05b^` cited by 1.6e does not resolve here; AC2 inlines markup, harmless.)
4. **0.i5e:** `feed-content.tsx` lines 171/199 use exact-key `getQueryData`/`setQueryData`
   (`["events","feed",{q,types,categories,subscriptions}]`); after 1.3l added `nearby`/`aiFilter`
   the key never matches, so favorite-toggle rollback silently no-ops (adding `resetToken` worsens it).
   Extend AC6 to fix rollback (snapshot via `getQueriesData`) or log a finding.

## Backlog / tracking notes
- Add 0.i5d to IDEA-038's unblock chain; reconcile "at least `review`" (wave plan) vs "`done`" (tracking doc).
- Consider rows: move `useNavRailItemInteraction` onto `useHoverFocusTooltip`; 0.i5d TODAY/UPCOMING
  ignoring `applicableDaysOfWeek` (BUG-026).

## Recommended dispatch order (sequential; shared-file hazards)
1. **1.6d** — small, unlocks Wave B; only shared edit is `packages/ui/src/index.ts` barrel.
2. **1.6e**, then **0.i6e** — both edit `EventDetailView.tsx`, `mapper.ts`, `.types.ts`, `.test.tsx`;
   0.i6e also `queries.graphql` + codegen. 1.6e first (removes `mapUrl` block).
3. **1.6c**, then **0.38** — both edit `EventDetailWrapper.tsx`; 1.6c first so its "zero client
   `getEventBySlug` after load" test isn't confounded by 0.38's service worker.
4. **0.i5d** — `EventDiscoveryPanel.tsx`, `home-content.tsx`, `buildEventsQueryCondition.ts`,
   `drizzle-where.ts`, `resolvers.ts` (different region from 1.6c), `events.graphql`, `format-event-date.ts`.
5. **0.i5e** — only `feed-content.tsx`, `favorites-content.tsx`; land before 1.3k.
6. **1.3k, last, after amendment.** Overlaps `buildEventsQueryCondition.ts`/`format-event-date.ts`
   (0.i5d), mapping call sites (0.i5d/0.i5e), `queries.graphql` (0.i6e). Also land Wave 1/3 quick-fixes
   FIND-053 (`EventCard.tsx` dead branch) and IDEA-048 (`EventCardMediaPrimitives.tsx`) before it.

Hygiene: `apps/web/src/generated/graphql.ts` is regenerated by 0.i5d, 1.3k, 0.i6e — never hand-merge,
re-run codegen after each rebase. `en.json`/`id.json` touched by 0.38, 1.3k, 0.i5d (adjacent-line
merges). Only 1.3k adds a migration. No Wave A story edits `FilterHub.tsx` itself.
