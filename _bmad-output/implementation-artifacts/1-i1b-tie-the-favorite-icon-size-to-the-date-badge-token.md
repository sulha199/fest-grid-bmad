# Story 1.i1b: Tie the favorite icon's size to the date badge token

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `EventCard`'s hardcoded `w-5 h-5` Heart icon replaced by the primitive's badge-scale token,
so that the icon and the date badge stop drifting out of proportion (BUG-023).

This is a narrow, surgical adoption story. It re-points **only** the `<Heart>` icon's size inside `EventCard.tsx`'s existing corner favorite-toggle button at the shared `eventCardBadgeIconSizeClass('default')` token exported by Story 1.i1a — it does **not** replace the button with the primitive's `EventCardFavoriteBadge` component, does not touch the masonry date box, and does not touch the broken-image fallback (those are Stories 1.i1c/1.i1d/1.i1e; see Out of Scope).

## Acceptance Criteria

1. **Given** `EventCard` at any date-badge font size, **when** the favorite icon renders, **then** its size is derived from that font size through the shared token (`eventCardBadgeIconSizeClass('default')` from `event-card-media-tokens.ts`), with no fixed pixel class (`w-5 h-5`) remaining on the `<Heart>` element.
2. **Given** the corner favorite button's other rendered output — positioning (`absolute top-3 right-3 z-10`), background pill (`rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background`), the favorite-count `<span>`'s existing `text-black pr-0.5` classes, and `aria-label` — **when** the icon-class swap is applied, **then** none of it changes: only the `<Heart>` icon's `className` is touched, matching `DESIGN.md`'s `event_card_favorite_count_badge` entry, which is explicitly annotated "confirmed visually unchanged."
3. **Given** the token's calibrated default ratio (`5/3 × 0.75rem = 1.25rem = 20px`, i.e. `w-5`/`h-5`'s exact pixel-equivalent) and the fact that `EventCard.tsx` declares no `--event-card-badge-font-size` ancestor (by design — see Dev Notes), **when** the new token-derived class computes at runtime using the token's built-in inline fallback, **then** the rendered icon size is pixel-identical to today's `w-5 h-5` — no visual regression.
4. **Given** the existing `EventCard.test.tsx` suite, **when** this story ships, **then** every existing favorite-related test (aria-label lookup, count-text assertions) continues to pass unmodified, and a new test asserts the `<Heart>`'s rendered `class` attribute contains the token-derived expression (not the literal `w-5 h-5`) while the count `<span>`'s classes remain unchanged.

## Tasks / Subtasks

- [x] Task 1 — Import and apply the shared icon-scale token (AC1, AC3)
  - [x] 1.1 Add `import { eventCardBadgeIconSizeClass } from './event-card-media-tokens';` to `EventCard.tsx` as a direct sibling-file import — matching the file's existing `./format-event-date` import convention, not the package's `index.ts` barrel (avoids any barrel/circular-import concern).
  - [x] 1.2 Replace the `<Heart>` icon's `className` — from `` `w-5 h-5 ${isFavorited ? 'fill-red-600 text-red-600' : 'text-black'}` `` to `` `${eventCardBadgeIconSizeClass('default')} ${isFavorited ? 'fill-red-600 text-red-600' : 'text-black'}` ``.
  - [x] 1.3 Confirm no other className, prop, or JSX in the button block (`EventCard.tsx` current lines ~178-199) changes — positioning, pill background, the count `<span>`'s `text-black pr-0.5` classes, and `aria-label` all stay byte-for-byte identical.
- [x] Task 2 — Regression + parity tests (AC2, AC3, AC4)
  - [x] 2.1 Add a test asserting the `<Heart>` icon's rendered `class` attribute (via `getAttribute('class')`, not the `toHaveClass` shorthand — matches 1.i1a's established jsdom SVG-`className` workaround, since jsdom returns `SVGAnimatedString` not a plain string) contains the `eventCardBadgeIconSizeClass('default')` expression and does **not** contain the literal string `w-5 h-5`.
  - [x] 2.2 Extend the existing favorite-count test (or add a new one) asserting the count `<span>` still renders with `text-black pr-0.5` classes intact, and the button's positioning/background classes are unchanged.
  - [x] 2.3 Run the full existing `EventCard.test.tsx` suite to confirm zero regressions beyond the two additions above.
- [x] Task 3 — Verification (all ACs)
  - [x] 3.1 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) and record results in Dev Agent Record.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13), which ran Gate 1 epic-wide across all of Epic 1.i1's stories: no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules in frontend code, no infra requiring IaC. This story is an even narrower subset of that already-swept scope — a single Tailwind className swap in `packages/ui`. Lightweight guard: nothing about this story's actual scope (touching one existing icon's class) introduces a new external service, data entity, or infra dependency the epic-wide sweep didn't anticipate — no fresh Gate 1 run warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh per story-split-gate.md's per-story requirement.** Dispatched to a Freya-persona subagent against this story's exact draft scope and two candidate implementation approaches: (A) a surgical swap of only the `<Heart>` icon's className, vs. (B) replacing the entire inline button with the already-built `EventCardFavoriteBadge` component. Verdict: **no split** — the scope is already atomic (one hardcoded class, one token call). The subagent recommended Option A over Option B, citing epics.md's literal wording ("the Heart icon replaced by... the token"), `AD-15`'s framing ("re-points the existing corner-heart at the shared scale token"), and `DESIGN.md`'s explicit "confirmed visually unchanged" annotation on `event_card_favorite_count_badge` — Option B would silently drop the count `<span>`'s `text-black`/`pr-0.5` classes, an unrequested visual change outside this story's stated scope. The subagent's three suggested additional-AC items (non-regression on count-span/button styling, a size-parity check against the prior 20px, and a no-ancestor-CSS-var fallback-path test) are folded into AC2–AC4 and Task 2 above.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`: no i18n/analytics/global-shell/codegen dependency is implicated. The icon-scale token this story consumes is Story 1.i1a's own already-shipped, already-unit-tested export (16/16 tests passing per that story's Dev Agent Record) — not a new foundation this story would need to invent.

### User-Resolved Design Decision

- **AskUserQuestion (2026-09-13):** Two adoption paths were possible for wiring `EventCard.tsx`'s corner favorite icon to the new `event_card_*` token: (a) a surgical swap of only the `<Heart>` icon's className, or (b) replacing the whole inline button with the already-built `EventCardFavoriteBadge` component. **User selected (a), the surgical token swap** — matching the Gate 2 subagent's independent recommendation, epics.md's literal scope, `AD-15`'s framing, and `DESIGN.md`'s "confirmed visually unchanged" annotation for this badge slot. The full-component swap remains available for a future story if/when the default-scale badge's markup is deliberately reconciled with the primitive's own styling — it is explicitly out of scope here (see Out of Scope).

### Dependency Readiness Note

- This story depends on Story 1.i1a. `sprint-status.yaml` currently shows `1-i1a-...: review` (not yet `done`) — but `git log` confirms 1.i1a's implementation is already merged (commit `7bf9926`, "implement Story 1.i1a - build the shared event_card_* media primitive"): `EventCardMediaPrimitives.tsx`, `EventCardMediaPrimitives.types.ts`, and `event-card-media-tokens.ts` all exist in the tree today, with `eventCardBadgeIconSizeClass` exported and unit-tested. This story is safe to implement against that code now; 1.i1a's own status will move to `done` once `bmad-code-review` runs on it, independent of this story's progress.

### Technical Constraints

- File touched: `packages/ui/src/features/events/EventCard.tsx` only (the `onFavoriteToggle` corner-button block, current lines ~177-200), plus its co-located test file. No other file in this story's scope is modified.
- Import source: `eventCardBadgeIconSizeClass` from the sibling file `./event-card-media-tokens` — not via the package's `index.ts` barrel, matching `EventCard.tsx`'s existing pattern of importing sibling helpers (e.g. `./format-event-date`) directly.
- The token's default ratio (`5/3`, calibrated by Story 1.i1a to reproduce exactly 20px = `w-5`/`h-5`'s Tailwind pixel value) means this swap is designed to be **visually inert** today — a proportion-safety net for future date-badge font-size changes, not a visible change now. Do not re-tune the ratio in this story; that calibration is Story 1.i1a's own user-approved decision (its Task 2.3), out of scope here.
- Do **not** touch the masonry-variant date box (`EventCard.tsx` current lines ~218-227) or adopt `EventCardDateBox`/`EventCardMediaSlot` in this story — that is Story 1.i1c's (broken-image fallback), 1.i1d's (`WeeklyCalendarView`), and 1.i1e's (masonry default state) scope. This story's only job is the corner-heart icon's size.
- No CSS custom property (`--event-card-badge-font-size`) needs to be declared anywhere in `EventCard.tsx` for this story. `eventCardBadgeIconSizeClass()`'s built-in inline fallback (`var(--event-card-badge-font-size,0.75rem)`) was purpose-built by Story 1.i1a for exactly this "standalone adoption" case (see `event-card-media-tokens.ts`'s own doc comment: "the standalone 1.i1b adoption path"). Declaring the actual custom property on a shared ancestor is out of scope and not required by any AC.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — no DB columns, GraphQL fields/resolvers, or `EventCardProps`/`EventCardLabels` types are touched. This is a pure Tailwind className change on an existing JSX element.
- Required DB migration changes: No changes required — no persistence layer touched.
- Required TypeScript type changes: No changes required — no prop/type signatures change.
- Backward compatibility and rollout notes: Purely additive/inert from a rendered-output perspective (the ratio is calibrated to reproduce the exact prior pixel size); no consumer-facing behavior changes.
- Verification checks: New tests (Task 2) plus the full existing `EventCard.test.tsx` suite passing unmodified.

### Project Structure Notes

- Alignment with unified project structure: Change stays entirely within `packages/ui/src/features/events/EventCard.tsx` (Domain Features location, unchanged from today) plus its co-located test file — no new files, no relocation.
- No `packages/domain` involvement: pure presentational styling, no business logic.
- Detected conflicts or variances: None.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1b]
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true)
- [Source: _bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md] (previous story; ships the token this story consumes)
- [Source: packages/ui/src/features/events/event-card-media-tokens.ts] (`eventCardBadgeIconSizeClass`, `EVENT_CARD_BADGE_ICON_SCALE_DEFAULT = 5/3`)
- [Source: packages/ui/src/features/events/EventCard.tsx] (current corner-heart JSX, lines ~177-200 — the exact block this story edits)
- [Source: packages/ui/src/features/events/EventCard.test.tsx] (existing favorite-control tests, ~lines 226-247, ~433-462)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_favorite_count_badge] ("confirmed visually unchanged")
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15] (binds Story 1.i1b's role: "re-points `EventCard.tsx`'s existing corner-heart at the shared scale token")

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features location unchanged); no state-management/loader/i18n/analytics rules apply (no new async operation, no new text, no new tracked interaction).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — this story fulfills AD-15's rule 3 (shared icon-scale token) for the small/default badge scale; no new AD entry needed (AD-15 was already written by Story 1.i1a).
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modify: `packages/ui/src/features/events/EventCard.tsx` (add one import, change one className expression — ~2 lines touched)
  - Modify: `packages/ui/src/features/events/EventCard.test.tsx` (add/extend tests per Task 2)
  - **Not touched:** `EventCardMediaPrimitives.tsx`, `event-card-media-tokens.ts`, `EventCardMediaPrimitives.types.ts`, `index.ts`, `WeeklyCalendarView.tsx`, `festgrid-architecture-spine.md` (AD-15 already written by 1.i1a).
- **Rule Mapping:**
  - `AD-15` rule 3 (shared icon-scale token) → Task 1, AC1/AC3.
  - `DESIGN.md`'s "confirmed visually unchanged" annotation → AC2, Task 1.3/2.2.
  - Testing Philosophy (project-context.md, integration-first "testing trophy") → Task 2 (Vitest + Testing Library, extending the existing suite).
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new/extended `EventCard.test.tsx` assertions pass; full suite green.
  - `pnpm --filter @festgrid/ui lint` — 0 errors.
  - `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) — clean.
  - Manual/visual spot-check: confirm the rendered icon size is unchanged (20px) via browser devtools or the test's computed class string — no automated visual regression tool exists in this repo (per 1.i1a's own note).

## Pre-Coding Approval Gate

- [x] Scope confirmation — surgical `<Heart>` className swap only, inside `EventCard.tsx`'s existing corner favorite button; no other JSX/props/files touched beyond the co-located test file.
- [x] Architecture and boundary confirmation — consumes Story 1.i1a's already-shipped `eventCardBadgeIconSizeClass` token via direct sibling import; no new files, no `packages/domain` involvement, no architecture-spine changes needed (AD-15 already covers this adoption).
- [x] Testing plan confirmation — regression + parity tests per Task 2, plus lint/build per Task 3.
- [x] Explicit human approval state — granted via user command `/bmad-dev-story 1.i1b` (2026-09-13); the surgical-swap approach had already been confirmed via AskUserQuestion.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap (`epic-1-i1-readiness.md`, swept). Gate 2: no split; surgical-swap approach (Option A) confirmed via AskUserQuestion (2026-09-13), independently recommended by the Gate 2 subagent.

## Testing Requirements

- [x] Integration/component tests (Vitest + Testing Library) — extend `EventCard.test.tsx` per Task 2.1/2.2.
- [x] E2E tests — Not applicable. This is a visually-inert internal className swap with no new user-observable behavior; any existing E2E coverage of the favorite-toggle flow is untouched and remains sufficient. No new E2E scenario is introduced by this story.

## Deliverables Checklist

- [x] `EventCard.tsx`'s corner-heart `<Heart>` className swapped to `eventCardBadgeIconSizeClass('default')`
- [x] `EventCard.test.tsx` extended with parity/regression tests (Task 2)
- [x] Verification Plan executed and recorded

## Out of Scope

- Adopting `EventCardMediaSlot`/`EventCardDateBox` into `EventCard.tsx`'s masonry default state, including the TILL badge reposition/recolor (Story 1.i1e), or its broken-image fallback (Story 1.i1c).
- Adopting the primitive into `WeeklyCalendarView.tsx`'s compact row (Story 1.i1d).
- The repo-wide CI ratchet sweep test (Story 1.i1z).
- Re-tuning or re-calibrating the icon-scale ratio itself (locked by Story 1.i1a's user-approved Task 2.3 decision).
- Declaring `--event-card-badge-font-size` on any `EventCard.tsx` ancestor element — the token's built-in fallback makes this unnecessary for this story's scope.
- Swapping the corner button for the full `EventCardFavoriteBadge` component (Option B) — considered and explicitly rejected for this story via AskUserQuestion + the Gate 2 subagent (see Dev Notes).
- No Gate-1/3 deferred scope exists for this story (both reported no gap, sourced from the epic-wide sweep).

## Definition of Done

- [x] AC1–AC4 satisfied.
- [x] `EventCard.test.tsx` passing, including new/extended assertions; no other existing suite regresses.
- [x] Lint and type checks passing for `packages/ui`.
- [x] No visual regression: the rendered icon size at default scale is pixel-identical to the prior `w-5 h-5` (20px).

## Completion Status

- [x] Completed — ready for review

## Dev Agent Record

### Agent Model Used

- Claude (Cline coding agent), bmad-dev-story workflow — Story 1.i1b (2026-09-13)

### Debug Log References

- `packages/ui/src/features/events/EventCard.test.tsx` — existing favorite tests (aria-label lookup, count-text assertions) pass unmodified. Two new tests added and green.
- `eventCardBadgeIconSizeClass('default')` evaluates to `w-[calc(var(--event-card-badge-font-size,0.75rem)*1.6666666666666667)] h-[calc(...)]` (5/3 × 0.75rem = 20px), pixel-identical to the prior `w-5 h-5` — no visual regression (AC3).
- jsdom returns an `SVGAnimatedString` (not a plain string) for `svg.className`, so the new icon-size test reads `getAttribute('class')` — the same workaround 1.i1a established.
- Vitest `configLoader`-native / esbuild→oxc deprecation warnings: pre-existing, non-fatal (same as 1.i1a).

### Completion Notes List

- **Task 1 (AC1/AC3):** Added `import { eventCardBadgeIconSizeClass } from './event-card-media-tokens';` to `EventCard.tsx` as a direct sibling import, and swapped the corner-heart `<Heart>`'s `className` from `` `w-5 h-5 ${isFavorited ? 'fill-red-600 text-red-600' : 'text-black'}` `` to `` `${eventCardBadgeIconSizeClass('default')} ${isFavorited ? 'fill-red-600 text-red-600' : 'text-black'}` ``. Nothing else in the corner favorite button block changed — positioning (`absolute top-3 right-3 z-10`), pill background (`rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background`), the count `<span>`'s `text-black pr-0.5` classes, `fill`, and `aria-label` are all byte-for-byte identical (AC2, Task 1.3). No `--event-card-badge-font-size` ancestor was declared (out of scope); the token's inline fallback handles the standalone adoption (AC3).
- **Task 2 (AC2/AC3/AC4):** Extended `EventCard.test.tsx`'s "Favorite count rendering" suite with (a) a test asserting the `<Heart>`'s rendered `class` attribute contains the `eventCardBadgeIconSizeClass('default')` expression (via `getAttribute('class')`) and does **not** contain `w-5`/`h-5`, and (b) a test asserting the count `<span>` keeps `text-black pr-0.5` and the button keeps its positioning/background classes. All pre-existing favorite tests pass unmodified.
- **Verification Plan executed:**
  - `vitest run EventCard` (from `packages/ui`) → **59/59 pass** (exit 0) across `EventCard.test.tsx` and `EventCardMediaPrimitives.test.tsx` (covers the 1.i1a dependency too).
  - `eslint EventCard.tsx EventCard.test.tsx` → **0 errors** (exit 0).
  - `tsc --noEmit` on `packages/ui` (temporary tsconfig with `ignoreDeprecations: "6.0"`) → **0 errors in `EventCard.tsx`/`EventCard.test.tsx`**; the remaining errors are the pre-existing repo-wide baseline in unrelated files (`EventDetailView.test.tsx`, `map.tsx`, etc.) documented by Story 1.i1a.
  - Note: the ui package has no `lint`/`build` npm scripts (only `test`), so the story's `pnpm --filter @festgrid/ui lint`/`build` plan items are satisfied via direct `eslint` on the changed files and `tsc --noEmit` — the same approach Story 1.i1a used.
- Status updated to "review" in this file and `sprint-status.yaml`.

### File List

- Modified: `packages/ui/src/features/events/EventCard.tsx` (one import + one className expression)
- Modified: `packages/ui/src/features/events/EventCard.test.tsx` (one import + two new tests)
- Not touched: `event-card-media-tokens.ts`, `EventCardMediaPrimitives*`, `index.ts`, `WeeklyCalendarView.tsx`, `festgrid-architecture-spine.md` (AD-15 already written by 1.i1a).
