---
baseline_commit: e0caeb789506f65f354251fdb4781b7e3efebbf8
---

# Story 1.i1m: Drop the calendar row's reserved image slot and let its content reflow

## Story Details

- Epic: 1.i1
- Story ID: 1.i1m
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the calendar compact row to omit its image element from the DOM entirely when the image is absent or errored — content expanding to fill the freed width, and the favorite control sitting at the row's end with no reserved wrapper, growing into the space it gained —
so that the row card stops following masonry's reserved-space convention, which the 2026-09-14 pass explicitly reversed for this card family by direct user direction, and which the row has been rendering against spec ever since Story 1.i1d shipped the pre-reversal version.

## Acceptance Criteria

1. **No reserved element in the DOM when the image is absent or errored.** **Given** `WeeklyCalendarView.tsx`'s `CalendarCard` `variant === 'list'` branch renders `EventCardMediaSlot layout="fixed-square" size="compact"` unconditionally (`:1128-1136`) — a `w-16 h-16 shrink-0` footprint that today stays mounted and blank-but-reserved whenever `imageUrl` is absent or its `onError` fires — **when** this story ships, **then** no element occupying that footprint exists in the DOM in either case: not on initial render with no `imageUrl`, and not after the `<img>`'s `onError` fires post-mount. Per DESIGN.md `event_card_compact_thumbnail_fallback` ("no area for image at all … the image element is omitted from the DOM entirely … `base: null` — deliberately no chrome of its own, no reserved dimensions") and EXPERIENCE.md's "Reserved space, not reflow — masonry ONLY as of 2026-09-14."
2. **Content expands into the freed width.** **And** `EventCardMediaPrimitives.tsx`'s content column (currently the sibling `<button className="min-w-0 flex-1 …">`, `:1075`) occupies the row's full available width when the image is omitted, exactly as it would with one fewer flex sibling — no explicit width math, this falls out of the flex row (`flex items-stretch gap-2`) losing a child.
3. **`EventCardMediaSlot`'s contract carries the divergence, not a local reimplementation.** **Given** `EventCardMediaSlot` (`EventCardMediaPrimitives.tsx:55-135`) is the single shared primitive both `EventCard.tsx`'s masonry branch and this row consume, and masonry's own reserved-space convention (`event_card_masonry.thumbnail_default_fallback`) is explicitly and permanently **unchanged** — **when** this story ships, **then** the primitive itself gains the new behavior as an explicit, opt-in prop (e.g. `collapseOnFallback?: boolean`, defaulting to `false` so every existing consumer — masonry's own two call sites, and this row's with-image path — keeps today's exact reserved-blank behavior with zero code changes on their part). Only this row's `EventCardMediaSlot` call site passes the new prop `true`. **And** AD-15 Rules 1 ("slot dimensions come from the surrounding chrome, never the image") and 2 ("fallback is reserved-blank, not a placeholder") in `festgrid-architecture-spine.md` are amended with a dated note narrowing their scope to masonry's `prominentPoster=false` branch only — the calendar-compact row is no longer bound by either rule, and the amendment explains why (this story) rather than reading as a silent contradiction to a future reader.
4. **The favorite control renders at the row's end with no fixed-width reserved wrapper**, per DESIGN.md `event_card_compact_thumbnail_fallback` ("`{components.event_card_favorite_count_badge_large}` sits directly at the row's end with no fixed-width wrapper reserved for it"). **And** it remains the exact same live `EventCardFavoriteBadge` `scale="large"` control in both cases (image present vs. collapsed) — composed externally as a sibling of the row's content button, following the same `hideFavoriteBadge` + `onImagePresenceChange` composition `EventCard.tsx`'s masonry branch already uses (`EventCard.tsx:339-346` for the slot side, `:310-317` for the externally-composed badge) — not a second, independently-built favorite control.
5. **The favorite control grows with the space it gains.** **Given** the validated prototype (`prototypes/event-card-calendar-row/thumbnail-fallback.html`, round 6 — the current, final state) shows the favorite icon at `w-9 h-9` (36px) at the row's real 326px narrow-mobile width and `w-14 h-14` (56px) at its real 655px widest-mobile width (this surface is `md:hidden`, so only these two real widths — and the continuum between them — are ever reached; there is no desktop breakpoint to key off), **when** this story ships, **then** the icon's size is driven by **the row's own rendered width**, continuously between (at minimum) those two validated points, not by a viewport breakpoint and not by a third fixed discrete step. **And** the favorite count text steps `text-sm` (14px) at the narrow width to `text-base` (16px) at the wide width (same prototype, round 6), which — unlike the icon — MAY be implemented as a second container-query-stepped class pair (extending the existing `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`/`EVENT_CARD_CONTAINER_CLASS` mechanism in `EventCardMediaPrimitives.tsx:42-74`, which already solves exactly this "step off the container's own width, not the viewport" problem for masonry's badges) rather than requiring a continuous formula, since two discrete text sizes at 11px-floor-respecting steps satisfy the prototype exactly.
6. **The AD-15 icon-scale custom property survives the slot's removal.** **Given** removing the slot removes the element that declares `--event-card-badge-font-size` (`EventCardMediaPrimitives.tsx:85`, via `badgeFontSizeStyleFor(size)`), so without a deliberate fix the favorite icon silently falls through to `eventCardBadgeIconSizeStyle`'s inline `0.75rem` fallback and *shrinks* from 28px (today's compact-row corner badge, `size="compact"` → `0.875rem` × `5/3`) to 24px (the bare `0.75rem` × `2` `large`-scale fallback) — a regression that would ship silently — **when** this story ships, **then** the custom property is declared on the row's own outer wrapper (`WeeklyCalendarView.tsx:1043`'s `<div className={...} flex items-stretch gap-2>`) rather than (or in addition to) the slot's own root, so it reaches the externally-composed favorite badge via ordinary CSS custom-property inheritance whether or not the slot itself is mounted. **And** a test asserts the custom property's declared value is present on a common ancestor of the favorite badge in both the with-image and no-image states.
7. **CSS-only, no JS pixel measurement**, consistent with this file's own stated design principle ("no JS-side pixel math per consumer") and with the precedent Story 1.i1l's AC7 already established (a CSS container query, `[container-type:inline-size]` on the row's own wrapper, reusing the exported `EVENT_CARD_CONTAINER_CLASS` constant rather than a second copy of the same literal) for solving "this surface's own rendered width, not the viewport, must drive a size step." **And**, mirroring 1.i1l Task 7.1's empirical-verification requirement, the mechanism is proven against the **built** stylesheet, not just asserted in JSDOM (which does not evaluate container queries or `clamp()`/`cq*`-unit expressions) — a class or declaration Tailwind's build cannot parse emits nothing and would look correct in a unit test while doing nothing in the browser.
8. **Story 1.i1z's AC3 is amended, not silently contradicted.** **Given** Story 1.i1z's shipped AC3 in `epics.md` asserts that *every* card surface including the calendar compact row "renders reserved-but-blank on image error with no layout shift," and its two live CI ratchet tests in `WeeklyCalendarView.test.tsx` — `renders the reserved-blank fallback with a large centered favorite badge when imageUrl is absent (AC2)` (~`:1189`) and `switches to the reserved-blank fallback when the image onError fires (AC2)` (~`:1221`) — assert exactly that for this row, **when** this story ships, **then** AC3 is narrowed in `epics.md` to masonry only, with a dated note recording that the 2026-09-14 user-directed reversal superseded it for the row/grid-item card families. **And** the two named tests are **replaced with inverted ratchets** (not deleted) — asserting no media-slot element exists in either the no-image or onError case, the content column occupies the row's full width, and the externally-composed favorite badge still renders and remains interactive — so the reversal is itself protected in CI rather than leaving a silent gap where a regression back to reserved-space would go unnoticed.
9. **i18n.** No new user-facing string is introduced by this story (the favorite-toggle accessible name is unchanged, already threaded via `favoriteToggleLabel`/`labels.favoriteToggle`); no locale key changes are required.
10. **WCAG 2.4.3 tradeoff recorded, not silently accepted.** **And** the reflow-predictability cost this reversal accepts (a control's position on the row shifts depending on image presence, which WCAG 2.4.3 "Focus Order" generally advises against) is recorded in this story's Dev Notes as a deliberate, user-directed, already-accepted-at-the-design-level tradeoff (EXPERIENCE.md frames it exactly that way) — not re-litigated by this story, but not silently absent from the record either, so a future accessibility sweep reads this as a documented decision rather than an unreviewed regression.

## Tasks / Subtasks

- [x] **Task 1 — `EventCardMediaSlot` contract extension (AC3).** Prerequisite for Tasks 2-4.
  - [x] 1.1 Add `collapseOnFallback?: boolean` (default `false`) to `EventCardMediaSlotProps` (`EventCardMediaPrimitives.types.ts`) and thread it through `EventCardMediaSlot` (`EventCardMediaPrimitives.tsx:55-135`): when `true` and `imagePresent` is `false` (absent or errored), the component returns `null` instead of its current reserved-footprint fallback branch. When `false` (every existing consumer's default), behavior is byte-identical to today.
  - [x] 1.2 Confirm by reading masonry's two call sites (`EventCard.tsx:339`, and its `prominentPoster=true` path if it also uses the slot) that neither passes the new prop — they keep the reserved-blank behavior with no code change.
  - [x] 1.3 Amend `festgrid-architecture-spine.md` AD-15 Rules 1 and 2 with a dated note narrowing their binds to masonry's `prominentPoster=false` branch only, per AC3, and update Rule 2's "Enforced by" citation of the two `WeeklyCalendarView.test.tsx` tests this story inverts (Task 6) to point at their new (inverted) names/roles instead of silently going stale.
- [x] **Task 2 — Adopt the collapsing slot into the compact row (AC1, AC2).**
  - [x] 2.1 At `WeeklyCalendarView.tsx:1128-1136`, pass `collapseOnFallback` and `hideFavoriteBadge` (mirroring `EventCard.tsx:339-346`'s existing composition pattern) plus `onImagePresenceChange` wired to new local state in `CalendarCard` (e.g. `imagePresent`, seeded from `!!schedule.imageUrl`, mirroring `EventCard.tsx:117-118`'s own seeding pattern — local component state only, not Server/URL/Global).
  - [x] 2.2 Confirm the row's flex layout (`:1043`, `flex items-stretch gap-2`) reflows correctly with zero, one, or two siblings (date box, content button, and conditionally the slot) — no explicit width recalculation needed, this is inherent flex behavior, but verify visually/in a screenshot at both validated widths.
- [x] **Task 3 — Externally-composed favorite control (AC4, AC6).**
  - [x] 3.1 Render `EventCardFavoriteBadge` as a plain sibling flex child at the end of the row's wrapper div (not absolutely positioned — unlike masonry's `EventCard.tsx:295-317` overlay, this row has no image to overlay, so the badge is simply the row's last flex child), `scale={imagePresent ? 'default' : 'large'}`, forwarding `isFavorited`/`favoriteCount`/`onFavoriteToggle`/`labels` exactly as the slot's own internal badge does today (so behavior is unchanged in the with-image case — the badge just moves from being the slot's internal child to the row's external sibling, rendering identically).
  - [x] 3.2 Move the `badgeFontSizeStyleFor('compact')` custom-property declaration (or add a second declaration) onto the row's own outer wrapper div (`:1043`) so the externally-composed badge — now a sibling, not a descendant, of the slot — still inherits `--event-card-badge-font-size` via ordinary CSS custom-property inheritance regardless of whether the slot is mounted.
  - [x] 3.3 Confirm the moved/duplicated declaration does not change the with-image case's rendered icon size (28px, `size="compact"` × `default` ratio) — it shouldn't, since custom properties are idempotent when redeclared to the same value at a closer ancestor.
- [x] **Task 4 — Continuous icon growth + stepped text growth (AC5, AC7).**
  - [x] 4.1 Declare `[container-type:inline-size]` (reuse the exported `EVENT_CARD_CONTAINER_CLASS` constant, `EventCardMediaPrimitives.tsx:75`) on the row's own outer wrapper div (`:1043`) — the row itself is the right container root here, not the slot (which may not exist) and not a per-badge wrapper.
  - [x] 4.2 Add a new icon-size mechanism to `event-card-media-tokens.ts` expressing continuous growth via `clamp()` + container-query width units (`cqi`), calibrated against the two validated data points (36px @ 326px container width, 56px @ 655px). Worked reference calculation (verify empirically, do not trust blindly): linear interpolation gives `icon_px ≈ 16.2px + 6.08 × containerWidthPercent`, i.e. `clamp(36px, calc(16.2px + 6.08cqi), 56px)` — floored at the narrow validated size (never smaller, in case a real device renders narrower than 326px) and capped at the wide validated size (this surface never renders wider than the widest mobile viewport it's gated to, `md:hidden`). Export this as a named function/constant alongside the existing `eventCardBadgeIconSizeStyle`/`badgeFontSizeStyleFor`, not an inline literal at the call site.
  - [x] 4.3 Add the second container-query-stepped text-size pair for the favorite count (`text-sm` narrow → `text-base` wide), following the exact pattern `EVENT_CARD_BADGE_TEXT_SIZE_CLASS` already established (`:42-64`) — pick (or add) a `min-width` threshold between the two validated real widths and verify it lands correctly at both.
  - [x] 4.4 Per AC7: build `apps/web`, inspect the generated stylesheet, and confirm the new `@container`/`clamp()`/`cqi` declarations actually emit real CSS (Story 1.i1l's Task 7.1 hit exactly this failure mode — a class Tailwind can't parse compiles to nothing and looks correct in JSDOM). Verify the rendered icon size in a real browser (not JSDOM) at both 326px and 655px container widths matches the two validated points before moving on.
- [x] **Task 5 — Invert the Story 1.i1z ratchet tests (AC8).**
  - [x] 5.1 Replace `renders the reserved-blank fallback with a large centered favorite badge when imageUrl is absent (AC2)` (~`WeeklyCalendarView.test.tsx:1189`) with an inverted assertion: no `[data-event-card-media-slot]` element exists, the content column's rendered width fills the row, and the (now externally composed) favorite-toggle button still renders and is interactive.
  - [x] 5.2 Replace `switches to the reserved-blank fallback when the image onError fires (AC2)` (~`:1221`) with an inverted assertion: after `fireEvent.error` on the `<img>`, the `[data-event-card-media-slot]` element is removed from the DOM entirely (not merely emptied), and the favorite-toggle button still renders and is interactive.
  - [x] 5.3 Amend Story 1.i1z's AC3 text in `epics.md` with a dated supersede note narrowing it to masonry only, referencing this story.
- [x] **Task 6 — Tests (all ACs).**
  - [x] 6.1 New: `collapseOnFallback` defaults to `false` and preserves today's exact reserved-blank rendering for both existing masonry call sites (`EventCardMediaPrimitives.test.tsx`) — the regression guard for AC3's back-compat claim.
  - [x] 6.2 New: with `collapseOnFallback=true`, no image and an `onError`-fired image both render no slot element (`EventCardMediaPrimitives.test.tsx`, primitive-level; `WeeklyCalendarView.test.tsx`, consumer-level — the inverted ratchets from Task 5).
  - [x] 6.3 New: the custom-property declaration is present on a shared ancestor of the favorite badge in both the with-image and no-image row states (AC6).
  - [x] 6.4 Build-level: the generated stylesheet contains the new `@container`/`clamp()`/`cqi` declarations (AC7), following 1.i1l's precedent check.
  - [x] 6.5 New: `variant='grid'` (the desktop day-cell path) is unaffected — this story touches only `variant='list'`.
- [x] **Task 7 — Verification.** Full `packages/ui` test run, `lint`, `tsc --noEmit`; `git diff` confirming `EventCard.tsx`'s masonry rendering, `EventCardCalendarGridItem.tsx`, and the `variant='grid'` block are untouched (grid-item already has no reserved slot at all — nothing for this story to do there).

## Dev Notes

### Files read in full before drafting this story

Current-state summary, so `bmad-dev-story` does not re-derive it:

- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — `EventCardMediaSlot` (`:55-135`, including the `imagePresent`/`imgError` detection and the `onImagePresenceChange` effect), `EventCardFavoriteBadge` (`:141-196`), the `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`/`EVENT_CARD_CONTAINER_CLASS` container-query mechanism (`:42-74`, Story 1.i1l).
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` — `EventCardMediaSlotProps` in full, including the existing `hideFavoriteBadge`/`onImagePresenceChange`/`size` props this story reuses rather than reinvents.
- `packages/ui/src/features/events/event-card-media-tokens.ts` — AD-15's icon-scale token family in full: `eventCardBadgeIconSizeStyle`, `badgeFontSizeStyleFor`, `EVENT_CARD_BADGE_FONT_SIZE_BY_SIZE`, `EVENT_CARD_BADGE_MIN_TOUCH_REM`. This story adds a new export alongside these, per the file's own "a `style` object is used deliberately… Tailwind's build-time content scanner…" precedent — the new `clamp()`/`cqi` mechanism follows the same discipline (no JS-side pixel math, everything expressed as CSS).
- `packages/ui/src/features/events/WeeklyCalendarView.tsx` — the full `variant === 'list'` branch (`:1042-1136`): the row's outer wrapper div (`:1043`), the content `<button>` (`:1075`), and today's unconditional `EventCardMediaSlot` call (`:1128-1136`). `variant === 'grid'` (`:1137+`) is untouched by this story.
- `packages/ui/src/features/events/EventCard.tsx` — the masonry `prominentPoster=false` composition this story's mechanism mirrors: the externally-composed favorite badge (`:310-317`), its `hideFavoriteBadge`/`onImagePresenceChange`-wired slot call (`:339-346`), and the local `imagePresent`-equivalent state seeding (`:117-118`). This story's own composition is structurally *simpler* than masonry's — no absolute positioning is needed (the row has no image to overlay when collapsed; the badge is just the row's last flex child), so nothing from `EventCard.tsx`'s `left: calc(dateBoxSize.w + 0.5rem)` overlay math applies here.
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx` — the two Story 1.i1z ratchet tests this story inverts (~`:1189`, ~`:1221`), read in full including their exact assertions, so Task 5 replaces rather than guesses at them.
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `event_card_compact` (`:104-159`) and `event_card_compact_thumbnail_fallback` (`:159-172`) read in full; `event_card_favorite_count_badge_large` (`:333-349`) and `event_card_masonry.thumbnail_default_fallback` (unchanged counterpart, `:333-341`).
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` — the "Missing/expired image fallback — REVERSED 2026-09-14" paragraph (`:222`) and "The favorite control's own box actively grows…" paragraph (`:224`), which state the reversal and the growth requirement in prose.
- `design-artifacts/UX-festgrid-run-1/prototypes/event-card-calendar-row/thumbnail-fallback.html` — read in full; this story's AC5/Task 4 numbers (36px @ 326px, 56px @ 655px, `text-sm`→`text-base`) are read directly off this file's current (round 6, final) markup, not off the prose summary in `validation-log.md`, which records intermediate rounds.
- `design-artifacts/UX-festgrid-run-1/prototypes/validation-log.md` — the round 3-6 history for this file, confirming round 6 is the final validated state and explaining why earlier rounds' numbers (e.g. round 4's `w-7`/`w-10`) are superseded, not a second valid data point.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 in full (`:391-436`), including Rules 1 and 2's exact "Enforced by" citations this story must update (Task 1.3).
- `_bmad-output/implementation-artifacts/1-i1l-apply-the-six-unowned-prototype-fidelity-rules.md` — this story's sibling; used as the structural template and for AC7's container-query precedent (its own Task 7.1's empirical-verification requirement, mirrored here).
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` — Gate 1/3 sweep, `swept: true`.

### Architecture & UX Gate Findings

`epic-1-i1-readiness.md` is `swept: true` for Epic 1.i1 (swept 2026-09-13, `stories_covered` lists 1.i1a-e/1.i1z — narrower than this story), so Gates 1 and 3 are cited from it per the workflow's default, with the lightweight escape-hatch guard applied since the sweep predates this story's own scope.

- **Gate 1 — no gap.** This story touches no resolver, query, mutation, DB/ORM call, external service or new API surface — pure `packages/ui` presentational work, identical reasoning to sibling Story 1.i1l and every other Epic 1.i1 story citing this sweep.
  - **Escape-hatch check:** the new `clamp()`/`cqi` mechanism (AC7) is assessed the same way 1.i1l's AC7 assessed the repo's *first* container query — it extends an already-shipped, dependency-free technique (Tailwind 3.4's arbitrary-variant/arbitrary-property form, no `apps/web/tailwind.config.ts` change, no new package) to a second, closely related use. Not a new Gate 1 finding.
- **Gate 3 — no gap.** No global shell, i18n foundation, analytics wiring or codegen dependency is implicated; AC9 confirms no new user-facing string.
- **Gate 2 — run fresh (Freya persona, general-purpose subagent standing in, 2026-09-21), verdict: no gap, build in place.** Evaluated specifically whether (a) the continuous icon-growth mechanism, (b) the masonry/row divergence on `EventCardMediaSlot`'s contract, or (c) inverting the two 1.i1z CI ratchet tests should be split into a separate story. Verdict on all three: **no** — build in place, following the Story 1.i1k precedent (a comparable primitive-contract extension, adding a `size` prop with two variants to the same primitive family, was correctly kept as one self-contained story rather than split).
  - (a) is a same-file, same-token-layer extension of the already-battle-tested `EVENT_CARD_BADGE_TEXT_SIZE_CLASS`/`EVENT_CARD_CONTAINER_CLASS` technique (Story 1.i1l) to a `clamp()` formula — one consumer, no new component, no new hook, no internal state/lifecycle, fails every Gate 2 reusability trigger.
  - (b) is a narrow, mechanical extension of an already-orthogonal contract (`layout`/`size` are documented, 1.i1k Dev Notes, as deliberately independent props precisely so one consumer's behavior can diverge from another's) — one more explicit, non-inherited branch (`collapseOnFallback`) on the same pattern, not a new architectural axis.
  - (c) is the direct, same-PR consequence of the behavioral change these tests assert the opposite of, in the exact file this story already touches (1.i1k's own Task 5.3 did a comparable "real rewrite, not just tolerance" of a shipped CI assertion as ordinary in-story work). Splitting it out would leave CI either red or silently un-asserting the pre-change behavior between two stories — a strictly worse interim state.
  - Full reasoning recorded by the subagent; summarized here per the workflow's reporting rule.
  - **Nothing was split from this story.**

### Residuals explicitly NOT covered by this story

Tracked separately, not absorbed — both are the **with-image** counterpart to this story's no-image composition, sitting in the same `event_card_compact` token block:

- **`event_card_compact.venue` is not rendered at all**, and **`image_wrapper`/`favorite_badge`'s stack reversal** (favorite pill moves from a corner overlay on the thumbnail to its own pill below it) — backlog `IDEA-048`, child of `IDEA-046`. Explicitly carved out during Story 1.i1l's drafting as belonging with *this* story's restructure rather than 1.i1l's class-level fixes — but this story's own scope (per its own Gate 2 split from 1.i1l) is bounded to the no-image reversal, so `IDEA-048` remains its own future pass, not silently folded in here. Flagging this rather than either silently building it or silently forgetting it again.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no mismatch found.**
- **Impacted contracts:** `EventCardMediaSlotProps` gains one new optional boolean prop (`collapseOnFallback`, default `false`) — additive, back-compatible, internal to `packages/ui`. No GraphQL, DB, or cross-package contract is touched.
- **Required DB migration changes:** none — no DB or GraphQL schema is touched.
- **Required TypeScript type changes:** the one new optional prop above; no removed or narrowed types.
- **Backward compatibility / rollout:** `packages/ui` has exactly one consumer (`apps/web`); the new prop defaults preserve every existing call site's behavior unchanged (verified by Task 1.2/6.1). No staged rollout needed.
- **Verification:** Task 6's suite plus Task 7's full `test`/`lint`/`tsc --noEmit`.

### State management categorization

The only new state this story introduces is the row's own local `imagePresent` boolean (seeded from `!!schedule.imageUrl`, updated via `onImagePresenceChange` — mirrors `EventCard.tsx:117-118`'s identical pattern). This is **local UI component state** (React `useState` inside `CalendarCard`), not Server State (React Query), URL State (nuqs), or Client Global State (zustand) — it derives from a prop already passed down and drives only this component's own render branch, matching the categorization `EventCard.tsx`'s own equivalent state already received.

### Async / loader categorization

Not applicable — this story introduces no new asynchronous process (the image load/error path already exists and is unchanged; this story only changes what renders around it).

### Accessibility tradeoff record (AC10)

The favorite control's position on the row shifts depending on whether an image is present (with-image: after the thumbnail; no-image: at the row's end, in the width the thumbnail would have occupied). This is a real WCAG 2.4.3 "Focus Order"-adjacent cost — a control's position in the row is not stable across states of the same card. It is accepted, not overlooked: EXPERIENCE.md's own framing ("Reserved space, not reflow — masonry ONLY as of 2026-09-14") explicitly names this as the tradeoff the 2026-09-14 user-directed reversal accepts for this card family specifically, distinct from masonry, which keeps reserved space (and therefore stable control position) for exactly this reason. No further mitigation is in scope for this story.

### Project Structure Notes

- **Modifies:** `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`, `EventCardMediaPrimitives.types.ts`, `event-card-media-tokens.ts`, `WeeklyCalendarView.tsx`, `WeeklyCalendarView.test.tsx`, `EventCardMediaPrimitives.test.tsx`; `_bmad-output/planning-artifacts/epics.md` (Story 1.i1z's AC3 amendment); `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-15 Rules 1/2 amendment).
- **New files:** none expected.
- **No `packages/domain` involvement** — pure presentational `packages/ui` work, matching this epic's established precedent.
- **Explicitly not touched:** `EventCard.tsx`'s masonry rendering (behavior must be byte-identical after this story, verified by Task 6.1's regression guard), `EventCardCalendarGridItem.tsx` (already has no reserved slot — nothing for this story to do there, per its own Story 1.i1f Out of Scope note), `WeeklyCalendarView.tsx`'s `variant='grid'` branch, `packages/ui/src/features/posts/PostCard.tsx`.

### References

- `_bmad-output/implementation-artifacts/backlog/IDEA-046-prototype-fidelity-residuals.md` — the board row this story implements rule 7 of (`IDEA-046`, promoted 2026-09-21).
- `_bmad-output/implementation-artifacts/1-i1l-apply-the-six-unowned-prototype-fidelity-rules.md` — sibling story; source of the Gate 2 split that created this story, and the structural/AC7-precedent template for this one.
- `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `event_card_compact_thumbnail_fallback`, `event_card_favorite_count_badge_large` — token source of truth for every class literal quoted in the ACs.
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` — the reversal's own framing and the growth requirement's prose.
- `design-artifacts/UX-festgrid-run-1/prototypes/event-card-calendar-row/thumbnail-fallback.html` — the validated HTML this story's concrete pixel numbers are read from (round 6, final).
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15, amended by this story (Task 1.3).
- `_bmad-output/planning-artifacts/epics.md` — Story 1.i1z, amended by this story (Task 5.3).

## Global Rules References

- `_bmad-output/project-context.md` — Code Organization (`packages/ui` component placement, no React in `packages/domain`), UI Patterns & UX Invariants, Testing Rules (testing-trophy — component/integration tests for `packages/ui`, not `packages/domain` unit-coverage rules).
- `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order and status vocabulary.
- `_bmad-output/planning-artifacts/story-split-gate.md` — the three gates; Gate 2 run fresh above, verdict "no gap."
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — **AD-15** (Event Card Media Primitive), amended by this story rather than merely cited — Rules 1/2 narrowed to masonry-only.
- `docs/infrastructure/index.md` — no shard read; this story touches no backend compute, queue, API Gateway or database layer.
- `_bmad-output/implementation-artifacts/backlog-spec.md` — §13 promotion mechanics, applied to `IDEA-046` (already promoted by Story 1.i1l's own `on_complete` step, carrying both story keys).

## Implementation Plan (Rule-Compliant)

### File Change Plan

| File | Change |
|---|---|
| `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` | `collapseOnFallback` prop on `EventCardMediaSlot` (T1); container-type marker reused, not redefined (T4.1) |
| `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` | New `collapseOnFallback?: boolean` on `EventCardMediaSlotProps` (T1.1) |
| `packages/ui/src/features/events/event-card-media-tokens.ts` | New continuous icon-growth `clamp()`/`cqi` export (T4.2); new stepped text-size pair for the favorite count (T4.3) |
| `packages/ui/src/features/events/WeeklyCalendarView.tsx` | Row wrapper gets container-type + custom-property declaration (T3.2, T4.1); conditional slot call with `collapseOnFallback`/`hideFavoriteBadge`/`onImagePresenceChange` (T2.1); externally-composed favorite badge as row's last flex child (T3.1) |
| `EventCardMediaPrimitives.test.tsx`, `WeeklyCalendarView.test.tsx` | Updated + new assertions (T6); the two inverted Story 1.i1z ratchets (T5) |
| `_bmad-output/planning-artifacts/epics.md` | Story 1.i1z AC3 amendment (T5.3) |
| `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` | AD-15 Rules 1/2 amendment (T1.3) |

### Rule Mapping

- *project-context.md* Code Organization → every change stays in `packages/ui/src/features/events/`; nothing is a candidate for `packages/domain` (all presentational).
- *project-context.md* i18n → no new string, no locale JSON change (AC9).
- *Architecture Spine AD-15* → this story is the first to **narrow** (not just cite) AD-15's Rules 1/2, recorded in both the spine doc itself and this story's Dev Notes.
- *Story 1.i1l's AC7 precedent* → AC7/Task 4.4 mirror its empirical-verification requirement for CSS mechanisms JSDOM cannot evaluate.
- *story-split-gate.md* Gate 2 → run fresh, verdict "no gap," reasoning recorded in Dev Notes.
- *AD-15's own "no JS-side pixel math" principle* → the new growth mechanism is CSS-only (`clamp()`/`cqi`), never a `ResizeObserver` or other JS measurement.

### Verification Plan

1. `pnpm --filter @festgrid/ui test` — full suite green (Story 1.i1l's baseline: 57 files / 652 tests).
2. `pnpm --filter @festgrid/ui lint` and `tsc --noEmit` — zero errors in every touched file.
3. **Generated-CSS check (AC7):** build and confirm the stylesheet contains the new `@container`/`clamp()`/`cqi` declarations — a JSDOM assertion alone cannot catch a class or expression that compiled to nothing.
4. **Visual check at both real row widths** (326px, 655px) — icon size and count text size validated against the prototype's round-6 numbers (36px/56px icon, `text-sm`/`text-base` count) in an actual browser, not JSDOM.
5. **Regression check:** masonry's rendering (`EventCard.tsx`) is byte-identical before/after — `collapseOnFallback` defaults preserve it.
6. `git diff --stat` — confirm `EventCardCalendarGridItem.tsx`, `EventDetailView.tsx`, `PostCard.tsx`, and the `variant='grid'` block are absent from the diff.

## Pre-Coding Approval Gate

- [x] **Scope confirmed** — rule 7 of `IDEA-046` (the calendar row's reserved-slot reversal), inherited as this story's full scope from Story 1.i1l's Gate 2 split. `IDEA-048` (the with-image counterpart) is explicitly *not* here.
- [x] **Gate 1/3 — no gap**, cited from `epic-1-i1-readiness.md`'s sweep; the new `clamp()`/`cqi` mechanism assessed under the same escape-hatch reasoning 1.i1l's AC7 established and found not to be a Gate 1 finding.
- [x] **Gate 2 — run fresh, no gap, build in place** — reasoning recorded in Dev Notes; nothing split from this story.
- [x] **Architecture and boundary confirmed** — pure `packages/ui` presentational work; `EventCardMediaSlot`'s contract fork is additive/opt-in, preserving masonry's behavior exactly.
- [x] **AD-15 amendment approved as part of this story** — Rules 1/2 narrowed to masonry-only, dated and cross-referenced to this story rather than silently going stale.
- [x] **Shipped-AC amendment approved** — Story 1.i1z's `epics.md` AC3 is narrowed to masonry only, with its two CI ratchet tests inverted (not deleted) in the same change.
- [x] **Accessibility tradeoff accepted** — the WCAG 2.4.3 reflow-predictability cost is recorded (AC10/Dev Notes), per EXPERIENCE.md's own framing; not a blocker, a documented decision.
- [x] **Testing plan confirmed** — approved 2026-09-21 as scoped in Testing Requirements below (2 inverted 1.i1z ratchets, ≥5 new component tests, 1 build-level CSS check).
- [x] **Human approval:** granted 2026-09-21 ("Go") — implementation authorised on branch `claude/project-thread-4l1x3u`, including amending Story 1.i1z's shipped AC3 and narrowing AD-15's Rules 1/2.

## Testing Requirements

- Per project-context.md's testing-trophy rule, these are component/integration tests in `packages/ui`, not unit tests — `packages/domain` is untouched, so its 100%-coverage rule does not apply here.
- **Updated (2, inverted not deleted):** the two Story 1.i1z ratchet tests in `WeeklyCalendarView.test.tsx` (~`:1189`, ~`:1221`) — see Task 5.
- **New (≥5):** `collapseOnFallback` defaults to `false`/preserves masonry (`EventCardMediaPrimitives.test.tsx`); the custom-property declaration reaches the externally-composed badge in both row states; the icon-growth mechanism's build-level CSS check; the count-text step's build-level CSS check; `variant='grid'` unaffected.
- **Build-level (1):** the generated stylesheet contains the new `@container`/`clamp()`/`cqi` declarations (AC7).
- No E2E test is warranted — no user flow changes, only rendered chrome and DOM presence/absence of one element.

## Deliverables Checklist

- [x] Task 1 — `EventCardMediaSlot` contract extension + AD-15 amendment
- [x] Task 2 — adopt the collapsing slot into the compact row
- [x] Task 3 — externally-composed favorite control + custom-property relocation
- [x] Task 4 — continuous icon growth + stepped text growth, empirically verified
- [x] Task 5 — invert the two Story 1.i1z ratchet tests + amend its `epics.md` AC3
- [x] Task 6 — new + updated tests (all ACs)
- [x] Task 7 — full test / lint / typecheck, and the untouched-files diff check

## Out of Scope

- **`IDEA-048`** — the compact row's missing venue line, and its `image_wrapper`/`favorite_badge` stack reversal (the with-image composition change). Not this story's rule; a separate future pass.
- **`FIND-046`** — `prototypes/validation-log.md`'s rounds 5-8 screenshot re-validation gap. Not a prerequisite for this story (its own prototype file, `thumbnail-fallback.html`, carries a complete, current round-6 record — the gap `FIND-046` describes is in the *log's own summary*, not in this file).
- **`EventCardCalendarGridItem.tsx`** — already conditionally renders its image (`showImage`) and already has no reserved slot; nothing for this story to do there (per Story 1.i1f's own Out of Scope note).
- **Masonry's reserved-space convention** — explicitly and permanently unchanged; this story only narrows AD-15's binds, never masonry's actual rendered behavior.
- **Wiring `next-intl` for any label in this file family** — a pre-existing, cross-cutting gap this epic has deferred consistently since Story 1.i1d.

## Definition of Done

- [x] All ten ACs satisfied, each traceable to its DESIGN.md/EXPERIENCE.md token or its AD-15/Story-1.i1z amendment.
- [x] Full `packages/ui` test suite green, including the two inverted ratchets and the new assertions (57 files / 662 tests).
- [x] `lint` and `tsc --noEmit` clean in every touched file (repo-wide lint 7/7 green; `tsc --noEmit` clean except a pre-existing, unrelated `TS5101` warning).
- [x] AC7's generated-CSS check passing — the `@container(min-width:490px)` text-step class is present in the built stylesheet; the `clamp()`/`cqi` icon-growth mechanism is a deliberate inline `style` (not a Tailwind class, matching this file's existing `eventCardBadgeIconSizeStyle` pattern to dodge the static-scanner blind spot), so it correctly never appears in the compiled CSS — verified in a real Chromium browser instead (see Debug Log).
- [x] Visual check at both real row widths (326px, 655px) confirms icon/text sizes match the validated prototype (36.0156px≈36px icon/14px text @ 326px; 56px icon/16px text @ 655px, verified via Playwright/Chromium).
- [x] `git diff` confirms masonry's rendering, `EventCardCalendarGridItem.tsx`, `EventDetailView.tsx`, `PostCard.tsx`, and the `variant='grid'` block are absent from the diff.
- [x] `epics.md`'s Story 1.i1z AC3 amendment applied and dated.
- [x] `festgrid-architecture-spine.md`'s AD-15 Rules 1/2 amendment applied and dated.

## Completion Status

Created 2026-09-21 via `bmad-create-story` from backlog row `IDEA-046` (rule 7), per Story 1.i1l's Gate 2 split. Implementation completed 2026-09-21 via `bmad-dev-story`: all 7 tasks/10 ACs delivered and verified (662 tests, lint/build/typecheck clean, real-browser CSS verification). Status: `review`.

## Dev Agent Record

### Agent Model Used

Claude Code, running the `bmad-dev-story` skill.

### Debug Log References

- **JSDOM/`cssstyle` cannot parse `clamp()` expressions containing container-query units (`cqi`).** An initial test asserting `heart?.style.width` equalled the literal `clamp(36px, calc(16.2px + 6.08cqi), 56px)` string failed because JSDOM's CSS parser mangled it into a nonsense string. Fixed by splitting coverage in two: a DOM-plumbing test using a plain `42px` override (proves the `iconSizeStyle` prop reaches the rendered element) and a separate pure-function unit test on `eventCardRowFavoriteIconGrowingStyle()`'s return value (no DOM involved, exercises the exact calibrated `clamp()` string).
- **Real-browser verification (Playwright/Chromium, `/opt/pw-browsers/chromium`), performed because JSDOM does not evaluate `@container`/`clamp()`/`cqi` at all (per AC7/Task 4.4, mirroring Story 1.i1l's Task 7.1 precedent):** at a 326px container width, the icon rendered 36.0156px (≈36px, the calibrated floor) and the favorite-count text rendered 14px (`text-sm`); at 655px, the icon rendered exactly 56px (the calibrated ceiling) and the text rendered 16px (`text-base`) — both container widths match the validated prototype (`thumbnail-fallback.html`, round 6) exactly.
- **AC7 stylesheet-check nuance:** the `@container(min-width:490px)` text-size step is a genuine Tailwind arbitrary-variant class and does appear in the built stylesheet. The `clamp()`/`cqi` icon-growth mechanism is deliberately an inline `style` object, not a Tailwind class — following this file's own existing `eventCardBadgeIconSizeStyle` precedent, which sidesteps Tailwind's static-scanner blind spot for computed values. It therefore correctly never appears in the compiled CSS; its correctness was confirmed via the real-Chromium check above instead of a stylesheet grep.
- **Transient build failure:** an initial `run-check.ts --kind build` run failed with a generic error; a direct `pnpm --filter web build` succeeded (exit 0, full route output), and a subsequent `run-check.ts --kind build` run also succeeded (7/7). Treated as a transient/environment issue, not a defect in the diff — consistent with Story 1.i1l's own noted egress/font-fetch caveat.
- Full verification: `packages/ui` test suite 57 files / 662 tests green; repo-wide `lint` 7/7 green; repo-wide `build` 7/7 green; `tsc --noEmit` clean except a pre-existing, unrelated `TS5101` warning; `git diff --stat` confirmed only the 10 expected files were touched.

### Completion Notes List

- All 7 tasks and 10 ACs implemented and verified as scoped; no deviation from the story's Implementation Plan.
- `EventCardMediaSlot` gained the additive, default-`false` `collapseOnFallback` prop; both masonry call sites are unchanged (verified by the regression-guard test), so AD-15's reserved-blank convention is preserved there exactly.
- The AD-15 icon-scale custom property (`--event-card-badge-font-size`) was relocated to the row's own outer wrapper so it survives the slot's conditional removal, reaching the externally-composed favorite badge via ordinary CSS inheritance in both row states.
- The favorite icon's continuous growth is a pure-CSS `clamp()` + `cqi` mechanism (no `ResizeObserver` or other JS measurement), calibrated by linear interpolation between the two validated prototype data points and confirmed correct in a real browser.
- AD-15 Rules 1/2 and Story 1.i1z's shipped AC3 were amended (not silently contradicted) with dated notes narrowing their scope to masonry only; the two Story 1.i1z CI ratchet tests were inverted (not deleted) to protect the reversal itself in CI.
- The WCAG 2.4.3 reflow-predictability tradeoff (AC10) was already recorded in Dev Notes at draft time; no further mitigation was added, per the story's own scope.
- Two carve-outs remain explicitly out of scope, as drafted: `IDEA-048` (the with-image venue/stack-reversal counterpart) and `FIND-046` (an unrelated prototype-log gap).

### File List

- `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`
- `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts`
- `packages/ui/src/features/events/event-card-media-tokens.ts`
- `packages/ui/src/features/events/WeeklyCalendarView.tsx`
- `packages/ui/src/features/events/WeeklyCalendarView.test.tsx`
- `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-i1m-drop-the-calendar-rows-reserved-image-slot.md`

## Change Log

| Date | Change |
| --- | --- |
| 2026-09-21 | Story drafted by `bmad-create-story` from backlog row `IDEA-046` rule 7, per Story 1.i1l's Gate 2 split (sibling, not a prerequisite). Gate 2 run fresh (Freya persona via subagent): no gap found, build in place. Status `ready-for-dev`, pending Pre-Coding Approval Gate. |
| 2026-09-21 | Pre-Coding Approval Gate signed off ("Go"); Tasks 1-7 implemented and verified (662 tests, lint/build/typecheck clean, real-Chromium verification of the `clamp()`/`cqi` and `@container` mechanisms); AD-15 Rules 1/2 and Story 1.i1z's AC3 amended and dated; Status moved `ready-for-dev` → `review`. |

## Status

**review**
