# Story 1.i1a: Extend the shared event_card_* primitive to own thumbnail sizing and fallback

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the `event_card_*` tokens already specified by the 2026-09-11 `bmad-ux` pass — `event_card_date_box.base_default`, `event_card_masonry.thumbnail_default`/`thumbnail_default_fallback`, `event_card_compact_thumbnail_fallback`, `event_card_favorite_count_badge_large` — implemented as one primitive that owns image-slot dimensions, fallback rendering and badge scale,
so that every surface has one thing to adopt instead of re-deciding sizing and fallback locally.

This is the **build** story only. It creates and unit/component-tests the primitive in isolation under `packages/ui/src/features/events/` — it does **not** wire it into `EventCard.tsx` or `WeeklyCalendarView.tsx`. Adoption is deliberately split into Stories 1.i1b (favorite-icon scale on `EventCard`'s existing corner badge), 1.i1c (`EventCard`'s broken-image fallback), 1.i1d (`WeeklyCalendarView`'s compact row), and 1.i1e (`EventCard`'s masonry default state) — see `epics.md` Epic 1.i1. This is confirmed as the correct, first-of-its-kind story establishing this invariant, not a deferral of something that should already exist (grep across `packages/`/`apps/` confirms no `event_card_*` primitive code exists yet — only the design-token spec in `DESIGN.md`).

## Acceptance Criteria

1. **Given** the shared primitive's image/media slot, **when** it renders in either of its two layout configurations (masonry: `flex-1 h-full` sized to match a sibling date box's own height via `items-stretch`; calendar-compact: fixed `w-16 h-16`), **then** the slot's dimensions come from the surrounding chrome (date-box height / row height), never from the image's own natural size — so nothing shifts when the image loads or fails.
2. **Given** the primitive's favorite-badge, **when** it renders in either its small/default (image present, corner-pill) or large (image missing/errored, centered, no pill) variant, **then** its icon size derives from a single shared, exported scale token/formula keyed off the date box's own `text-xs` font-size — never an independently hardcoded pixel class on either variant. The large variant is calibrated to land on DESIGN.md's explicit `w-6 h-6` (24px) target (i.e. its ratio = 24px ÷ 12px = 2×); the default/small variant uses its own distinct, smaller ratio from the same token family (see Dev Notes — Icon-Scale Token for the resolved mechanism and guardrails). Story 1.i1b later re-points `EventCard`'s existing hardcoded `w-5 h-5` corner icon at this same token — the token this story exports must already be generic enough to serve that adoption without modification.
3. **Given** the primitive's media slot, **when** `imageUrl` is absent or its `onError` fires, **then** the reserved slot renders with no image, no placeholder icon, and no placeholder text (not even `EventCard`'s current "No image available" caption) — the slot keeps its exact AC1 footprint, and the large favorite-badge variant (AC2) is centered inside it in place of the small corner pill.
4. **Given** the large favorite-badge variant rendered inside an empty/fallback slot, **when** it is inspected for accessibility, **then** it remains the same live favorite-toggle control as the small variant (not a decorative label) with a real `min-h-11 min-w-11` tap target (per `EXPERIENCE.md`'s "Missing-image fallback stays a real, reachable control" rule and `components.nav.item_hit_area`'s existing convention), and it introduces no new independent focus stop distinct from the corner-pill variant's own focusability — both variants are reached the same way (one favorite-toggle button per card), consistent with `EXPERIENCE.md`'s documented DOM/reading order (date box → its badges → the card's single existing focusable region, non-interactive chrome never intercepts tab order).
5. **Given** any text the primitive renders directly (the favorite-toggle's accessible name/label — it renders no other copy), **when** a caller does not override it, **then** it falls back to an English default exactly like `EventCard`'s existing `labels` prop convention (`EventCardLabels.favoriteToggle`), and accepts the same override shape so 1.i1b–1.i1e can thread existing i18n label plumbing through without inventing a second convention.
6. **Given** the codebase's architecture spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`), **when** this story ships, **then** a new `### AD-15: Event Card Media Primitive` entry is added (current highest is AD-14) documenting the Binds/Prevents/Rule shape established here — not deferred to the 1.i1z ratchet story, which only enforces it.

## Tasks / Subtasks

- [ ] Task 1 — Build the primitive module (AC1, AC3, AC4)
  - [ ] 1.1 Create `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` exporting:
    - `EventCardMediaSlot` — the image/fallback slot. Props: `imageUrl?: string`, `imageAlt?: string`, `layout: 'flex-fill' | 'fixed-square'` (flex-fill → masonry's `flex-1 h-full min-w-0`; fixed-square → compact's `w-16 h-16 shrink-0`), plus favorite-control passthrough props (`isFavorited?`, `favoriteCount?`, `onFavoriteToggle?`, `labels?`). Internally tracks `imgError` via `onError` (same detection `EventCard.tsx`'s existing `imgError` state uses) and switches between: image present+ok → `<img>` (`object-cover w-full h-full rounded-md`) + small corner favorite badge (`absolute top-1 right-1 z-10`); image absent/errored → nothing rendered in the slot except the large, centered favorite badge (AC3/AC4).
    - `EventCardFavoriteBadge` — the favorite heart+count control, `scale: 'default' | 'large'` prop selecting which icon-scale token ratio and layout (small pill w/ background vs. large borderless, per DESIGN.md's `event_card_favorite_count_badge` vs. `event_card_favorite_count_badge_large`) it uses. Exported standalone (not only as `EventCardMediaSlot`'s internal implementation detail) so 1.i1b can import it directly to replace `EventCard`'s current inline corner-heart JSX.
    - `EventCardDateBox` — thin styled wrapper (`event_card_date_box.base_default`'s classes: `relative flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-white shadow-sm text-xs font-semibold shrink-0`) taking `children` (the caller's already-formatted date text/icon) — it does **not** reimplement any date/locale formatting (that stays in `format-event-date.ts`, untouched by this story). Extracted so (a) 1.i1d/1.i1e's flex-stretch row composition has a real shared component to place beside `EventCardMediaSlot`, and (b) it is the concrete font-size source the icon-scale token (AC2) keys off.
  - [ ] 1.2 Create `packages/ui/src/features/events/event-card-media-tokens.ts` exporting the icon-scale mechanism (see Dev Notes — Icon-Scale Token) and any shared constants (e.g. the two named ratios).
  - [ ] 1.3 Create `EventCardMediaPrimitives.types.ts` for the exported prop interfaces, matching this package's existing `*.types.ts` convention (see `EventCard.types.ts`).
- [ ] Task 2 — Icon-scale token (AC2)
  - [ ] 2.1 Implement the CSS-custom-property mechanism resolved in Dev Notes — Icon-Scale Token (not literal nested `em`, since the date box and favorite badge are DOM siblings, not ancestor/descendant, in every real layout this primitive will be adopted into).
  - [ ] 2.2 Calibrate the `large` ratio to exactly 2× (24px ÷ 12px `text-xs`), matching DESIGN.md's explicit value.
  - [ ] 2.3 Choose and document (inline comment in `event-card-media-tokens.ts`) a `default` ratio distinct from and smaller than `large`'s 2× — pick a value that keeps the corner badge visually close to `EventCard.tsx`'s current `w-5 h-5` (20px) corner heart so 1.i1b's later swap reads as a proportion fix (BUG-023), not a jarring resize. Do not hardcode 20px directly; derive it from the ratio × `text-xs`.
- [ ] Task 3 — Reserved-blank fallback (AC3)
  - [ ] 3.1 Confirm both `layout` variants render zero content (no icon, no text, no distinct fill) in the image area on error/absence — only the `EventCardFavoriteBadge scale="large"` renders, centered.
- [ ] Task 4 — Accessibility (AC4)
  - [ ] 4.1 Verify both `EventCardFavoriteBadge` variants share one accessible name/role and neither introduces a separate `tabIndex`/focusable wrapper beyond the single `<button>` — write a component test asserting exactly one focusable element renders per `EventCardMediaSlot` instance regardless of `layout`/error state.
  - [ ] 4.2 Verify the `large` variant's hit area computes to at least 44×44px (`min-h-11 min-w-11`).
- [ ] Task 5 — i18n label plumbing (AC5)
  - [ ] 5.1 Match `EventCard.tsx`'s existing `labels`/`defaultLabels` merge pattern exactly (same key name `favoriteToggle`, same default string) — do not invent a second labels shape.
- [ ] Task 6 — Architecture spine (AC6)
  - [ ] 6.1 Append `### AD-15: Event Card Media Primitive` to `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, following the existing AD-14 format (Binds / Prevents / Rule, with "Enforced by" pointing at this story's new test file(s)).
- [ ] Task 7 — Testing (all ACs)
  - [ ] 7.1 `EventCardMediaPrimitives.test.tsx` — component tests (Vitest + Testing Library) covering AC1 (both `layout` values render the documented className shape), AC2 (icon-scale token produces the calibrated 24px large size and a smaller, distinct default size), AC3 (blank fallback, no text/icon nodes), AC4 (single focusable element, hit-area size), AC5 (label override + default).
  - [ ] 7.2 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter @festgrid/ui build` (or the monorepo-root equivalents) and record results in Dev Agent Record.
- [ ] Task 8 — Export wiring
  - [ ] 8.1 Add `export * from './EventCardMediaPrimitives';`, `export * from './EventCardMediaPrimitives.types';`, and `export * from './event-card-media-tokens';` to `packages/ui/src/features/events/index.ts` (matching the existing flat re-export convention already used for every other file in that directory).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13), which ran Gate 1 epic-wide across all of Epic 1.i1's stories: no DB/ORM/domain call from `apps/web`/a UI package, no external-service call from the frontend, no new API surface, no auth/secrets/business rules in frontend code, no infra requiring IaC. This story is pure presentational `packages/ui` work. Lightweight guard: this story's actual scope (a styled primitive + a CSS-variable-based icon-scale token, no new external service/data entity/infra dependency) matches exactly what the epic-wide sweep anticipated — no fresh Gate 1 run warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh per story-split-gate.md's per-story requirement.** Dispatched to a Freya-persona subagent against this story's draft scope (masonry flex-stretch pairing vs. calendar-compact fixed-64px shape, plus the underspecified icon-scale ratio). Verdict: **no split** — both consumer shapes are one primitive's two sizing variants sharing an identical fallback/a11y contract, not independently complex components; splitting would force each half to re-derive the same contract, reproducing the exact "every surface re-decides locally" problem this epic exists to fix. The subagent did surface two real gaps, both closed by adding AC4 above (tap-target/focusability for the large fallback badge; no independent focus stop) — the original draft AC set only covered the image's visual absence, not the badge's interactive contract.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`. Confirms the primitive's home is `packages/ui/src/features/events/`, **not** `packages/ui/src/core/` — its content (a favorite-count badge, a date box) is event-domain-specific, fails `core/`'s domain-agnostic test, and precedent (`EventCard.tsx` already lives in `features/events/`) points the same way. No i18n/analytics/global-shell/codegen dependency is implicated.
- **Naming-adjacency disambiguation (Gate 3 sweep item 5, non-blocking):** `EventImage.tsx` (`features/events`, used by `EventDetailView`/`InstagramEmbed`) is a **separate, differently-scoped** component — variable-height, icon+text-based fallback ("Video unavailable"/"View original post"), video support via `videoUrl`. Do not conflate it with or reuse it for this primitive; the new files use `EventCardMedia*`/`event-card-*` naming specifically to avoid the collision.
- **User-resolved design decision (AskUserQuestion, 2026-09-13):** DESIGN.md gives no concrete icon-to-date-badge ratio formula (only the large badge's fixed 24px target, with an explicit admission the scaling itself was never decided). Since this story writes a new durable architecture invariant (AD-15) that Story 1.i1b binds `EventCard`'s existing corner icon to, this was treated as a genuine design decision, not dev latitude to silently guess. User confirmed: (a) **one shared ratio-based token family** serves both the large fallback badge and the (to-be-adopted-in-1.i1b) small corner badge, calibrated off the large badge's known 24px target, rather than hard-deriving only the large badge and leaving the corner badge fully undecided; (b) the mechanism is **CSS-based** (not a JS-computed pixel value each consumer must remember to call).

### Icon-Scale Token (resolves AC2 — implementation guardrail)

The user chose CSS em-based inheritance as the mechanism, but a literal nested-`em` implementation does **not** actually work here: in every real layout this primitive will be adopted into (masonry's `top_row_default`, the calendar-compact row), the date box and the favorite badge are **DOM siblings**, not ancestor/descendant — plain CSS em-inheritance only propagates down a subtree, not sideways between siblings. The CSS-based mechanism that actually satisfies the user's intent (automatic, cascade-driven, no per-consumer JS math) is a **CSS custom property**:

1. `EventCardMediaSlot`'s (and/or `EventCardDateBox`'s) root declares `--event-card-badge-font-size: theme('fontSize.xs')` (0.75rem / 12px) — confirm the exact Tailwind arbitrary-property syntax (`[--event-card-badge-font-size:...]` bracket notation vs. an inline `style` prop) against the installed Tailwind version at implementation time; both packages/ui and packages/web should already show the project's chosen convention for arbitrary CSS custom properties elsewhere — grep for an existing `[--` usage before deciding.
2. Both `EventCardFavoriteBadge` scale variants size their icon via `calc(var(--event-card-badge-font-size) * <ratio>)` (large: ratio 2; default: a smaller, chosen-and-documented ratio per Task 2.3) — expressed as a Tailwind arbitrary value (e.g. `w-[calc(var(--event-card-badge-font-size)*2)]`) rather than a fixed `w-6`/`w-5` class.
3. This keeps the whole family calibrated off one declared value with no JS-side pixel math, and guarantees 1.i1b's later adoption (retargeting `EventCard`'s existing corner icon at this same token) can't silently diverge from the large badge's calibration.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None. This story adds no DB columns, no GraphQL fields/resolvers, and no changes to `EventCardProps`/`EventCardLabels` or any other existing TypeScript model — it only adds new, additive, unconsumed component/prop types under `packages/ui/src/features/events/`.
- Required DB migration changes: No changes required — purely presentational `packages/ui` primitive, no persistence layer touched.
- Required TypeScript type changes: No changes required to existing types. New types are additive-only (`EventCardMediaPrimitives.types.ts`).
- Backward compatibility and rollout notes: No consumer is touched by this story (adoption is 1.i1b–1.i1e), so there is zero behavior-change risk to any shipped surface from this story alone. The primitive ships dark (built + tested, not wired in) until the adoption stories land.
- Verification checks: New component tests (Task 7.1) plus existing `EventCard.test.tsx`/`WeeklyCalendarView.test.tsx` suites are expected to pass unmodified, confirming no accidental coupling was introduced.

### Project Structure Notes

- Alignment with unified project structure: New files land in `packages/ui/src/features/events/` (Domain Features per project-context.md's UI Components & Scalability rule — event-domain-specific content, confirmed by the Gate 3 sweep, not `packages/ui/src/core/`).
- No `packages/domain` involvement: this primitive is pure presentation (styling/composition/a11y), not business logic — nothing here qualifies for or requires extraction into `packages/domain`.
- Detected conflicts or variances: None. `packages/ui/src/features/events/index.ts`'s existing flat `export * from './X'` convention is followed exactly (Task 8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1a] (and sibling Stories 1.i1b–1.i1z for adoption/ratchet context)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true)
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md#event_card_masonry, #event_card_compact, #event_card_compact_thumbnail_fallback, #event_card_favorite_count_badge_large, #event_card_favorite_count_badge, #event_card_date_box]
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Masonry EventCard: Date Box, TILL Badge, and Status/Nearby Badge Row, #Calendar Row Card: Thumbnail and Fallback, #Masonry EventCard Badge Row (Accessibility Floor)]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-14] (format precedent for the new AD-15 entry)
- [Source: packages/ui/src/features/events/EventCard.tsx] (current corner-heart JSX at lines ~177-200, current broken-image fallback at lines ~229-240 — both are what Stories 1.i1b/1.i1c will later replace, not this story)
- [Source: packages/ui/src/features/events/EventImage.tsx] (naming-adjacency disambiguation only — not reused or modified)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features → `packages/ui/src/features/<domain>/`); Loaders/UX invariants (not directly applicable — no async operation here); i18n `labels` convention (AC5).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — this story adds AD-15 (AC6); format follows AD-14's precedent.
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`
  - New: `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts`
  - New: `packages/ui/src/features/events/event-card-media-tokens.ts`
  - New: `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx`
  - Modify (append-only, additive): `packages/ui/src/features/events/index.ts` (3 new `export * from` lines)
  - Modify (append-only, additive): `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (new `### AD-15` section)
  - **Not touched:** `EventCard.tsx`, `EventCard.types.ts`, `WeeklyCalendarView.tsx` — reserved for Stories 1.i1b–1.i1e.
- **Rule Mapping:**
  - Domain Features placement rule (project-context.md) → new files under `features/events/`, confirmed by Gate 3.
  - i18n-readiness convention (`EventCard`'s `labels`/`defaultLabels` pattern) → AC5, Task 5.
  - Architecture spine discipline (this file's own AD numbering convention) → AC6, Task 6.
  - Accessibility floor (`EXPERIENCE.md`'s reachable-control + reserved-space rules) → AC3, AC4, Task 3, Task 4.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new `EventCardMediaPrimitives.test.tsx` passes; existing `EventCard.test.tsx`/`WeeklyCalendarView.test.tsx` suites remain green (proving no accidental coupling).
  - `pnpm --filter @festgrid/ui lint` — 0 errors.
  - `pnpm --filter @festgrid/ui build` (or `tsc --noEmit`) — clean, strict-mode compliant.
  - Manual/visual spot-check (no automated visual regression exists in this repo): render both `layout` variants and both `EventCardFavoriteBadge` scales in isolation (e.g. a throwaway harness page or via the test file's rendered DOM snapshot) against the reference screenshots cited in DESIGN.md/EXPERIENCE.md (`imports/masonry-default-*.png`, `imports/calendar-row-card-*.png`) to confirm the large badge visually reads distinctly larger than the default badge.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — build-only primitive under `packages/ui/src/features/events/`; no adoption into `EventCard.tsx`/`WeeklyCalendarView.tsx` (that's 1.i1b–1.i1e).
- [ ] Architecture and boundary confirmation — `features/events/` (not `core/`) placement; no `packages/domain` involvement; AD-15 addition to the architecture spine.
- [ ] Testing plan confirmation — component tests per Task 7.1, plus lint/build per Task 7.2.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap (epic-1-i1-readiness.md, swept). Gate 2: no split, two ACs (AC4) added to close the tap-target/focus-order gap it surfaced. Icon-scale ratio scope/mechanism: user-resolved via AskUserQuestion (2026-09-13) — one shared ratio family, CSS-custom-property mechanism (see Dev Notes — Icon-Scale Token).

## Testing Requirements

- [ ] Integration/component tests (Vitest + Testing Library) — `EventCardMediaPrimitives.test.tsx` covering AC1–AC5 (Task 7.1).
- [ ] E2E tests — Not applicable to this story. The primitive is not wired into any live route/surface yet (deliberately deferred to Stories 1.i1d/1.i1e); an E2E test would have nothing real to exercise. E2E/visual coverage belongs to the adoption stories once the primitive is actually rendered on a page.

## Deliverables Checklist

- [ ] `EventCardMediaPrimitives.tsx` (`EventCardMediaSlot`, `EventCardFavoriteBadge`, `EventCardDateBox`)
- [ ] `EventCardMediaPrimitives.types.ts`
- [ ] `event-card-media-tokens.ts` (icon-scale CSS-custom-property mechanism + calibrated ratios)
- [ ] `EventCardMediaPrimitives.test.tsx` (AC1–AC5 coverage)
- [ ] `index.ts` updated with the three new re-exports
- [ ] `festgrid-architecture-spine.md` updated with `### AD-15`

## Out of Scope

- Wiring the primitive into `EventCard.tsx`'s corner favorite icon (Story 1.i1b).
- Wiring the primitive into `EventCard.tsx`'s broken-image fallback (Story 1.i1c).
- Wiring the primitive into `WeeklyCalendarView.tsx`'s compact row (Story 1.i1d).
- Wiring the primitive into `EventCard.tsx`'s masonry default (`prominentPoster=false`) state, including the TILL badge reposition/recolor (Story 1.i1e).
- The repo-wide CI ratchet sweep test (Story 1.i1z).
- No Gate-1/3 deferred scope exists for this story (both reported no gap).

## Definition of Done

- [ ] AC1–AC6 satisfied.
- [ ] `EventCardMediaPrimitives.test.tsx` passing; existing `EventCard.test.tsx`/`WeeklyCalendarView.test.tsx` suites still passing unmodified.
- [ ] Lint and type checks passing for `packages/ui`.
- [ ] `festgrid-architecture-spine.md`'s AD-15 entry added, following the AD-14 format.
- [ ] `index.ts` re-exports added.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used



### Debug Log References

### Completion Notes List

### File List
