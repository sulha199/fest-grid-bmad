---
baseline_commit: d0e01c85635d4dd1ad80bf294bcc719e781e93b0
---

# Story 1.i1p: Remove EventCardMediaSlot's unused internal favorite-badge rendering

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1p
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `EventCardMediaSlot` to stop owning its own internal favorite-badge rendering (the with-image corner-pill branch and the reserved-blank large-fallback branch), along with the props only those branches use,
so that the primitive's contract matches what both production callers actually need — a pure image/fallback slot — instead of carrying a dead, still-tested code path that both callers have unconditionally suppressed since Stories 1.i1e/1.i1m.

## Acceptance Criteria

1. **Given** `EventCardMediaSlot`'s with-image branch (`EventCardMediaPrimitives.tsx`, the `imagePresent ? (<>...` block rendering `<img>` plus a conditional `EventCardFavoriteBadge scale="default"`) and its reserved-blank fallback branch (the `: (` else-branch rendering a conditional `EventCardFavoriteBadge scale="large"`), both gated behind `!hideFavoriteBadge && onFavoriteToggle`, **when** this story ships, **then** both favorite-badge sub-renders are deleted — the with-image branch renders only the `<img>`, and the fallback branch renders nothing (the slot's own root `<div data-event-card-media-slot>` still mounts in both cases, preserving Story 1.i1a's AC1 reserved footprint; it is simply empty when no image is present).
2. **Given** `EventCardMediaSlotProps` (`EventCardMediaPrimitives.types.ts`) currently exposes `isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, and `hideFavoriteBadge` — props consumed only by the two branches AC1 deletes, **when** this story ships, **then** all five fields are removed from `EventCardMediaSlotProps` and from `EventCardMediaSlot`'s destructured function parameters. `EventCardFavoriteBadgeProps`' own same-named fields (`isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`) are untouched — `EventCardFavoriteBadge` itself keeps its full prop surface and every scale/state it has today; only the slot's own separate, now-dead copy of these props is removed.
3. **Given** both production callers currently pass some or all of these soon-removed props to `EventCardMediaSlot` even though each already composes its own live `EventCardFavoriteBadge` externally — `EventCard.tsx`'s masonry-default branch passes `hideFavoriteBadge` (and nothing else); `EventCardCompact.tsx`'s row passes `isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, and `hideFavoriteBadge` — **when** this story ships, **then** both call sites stop passing every one of them, compile clean against the narrowed `EventCardMediaSlotProps`, and render byte-for-byte identical output to today (neither file's externally-composed `EventCardFavoriteBadge` sibling(s) change in any way).
4. **Given** `EventCardMediaPrimitives.test.tsx` has multiple blocks that mount `EventCardMediaSlot` with `onFavoriteToggle`/`isFavorited`/`hideFavoriteBadge` and assert on a `<button>` rendered *through the slot* — the `EventCardFavoriteBadge - AC2` block's one sub-test using the slot as a mounting vehicle, the `EventCardMediaSlot fallback - AC3` block's several button/`onFavoriteToggle`-dependent assertions, the dedicated `EventCardMediaSlot - AC4` describe block (entirely about the slot's own now-removed internal control), the `EventCardMediaSlot additive props (Story 1.i1e)` block's two `hideFavoriteBadge` tests, and two sub-tests inside the `EventCardMediaSlot collapseOnFallback (Story 1.i1m AC1/AC3)` block — **when** this story ships, **then** every one of these is rewritten or removed exactly per the Dev Notes' "Reference Implementation" mapping below, the full test file continues to pass (no behavioral coverage lost for any invariant that still applies — reserved footprint, no-placeholder-text/icon, the BUG-042 fallback chain, `collapseOnFallback`'s mount/unmount behavior), and no assertion anywhere in the file still passes `onFavoriteToggle`/`isFavorited`/`favoriteCount`/`labels`/`hideFavoriteBadge` to `EventCardMediaSlot`.
5. **Given** `packages/visual-audit/manifests/event-card-date-box-sizing.ts`'s fixture-image header comment explains the manifest's "no `<img>` at all" edge case by naming `hideFavoriteBadge`, **when** this story ships, **then** the comment is corrected to describe the new reality (the slot never renders a favorite control regardless of props) with zero change to the manifest's registered entries, render specs, or rules.
6. **Given** Story 1.i1a's shipped AC3/AC4/AC5 (in both `epics.md` and the story's own file) describe the slot's reserved-blank fallback as centering "the large favorite-badge variant" and define that control's own accessibility/i18n contract as the slot's responsibility, **when** this story ships, **then** both documents' AC3, AC4, and AC5 text is amended with a dated, inline annotation (matching the precedent Story 1.i1m already set amending Story 1.i1z's AC3 in `epics.md`) stating the slot renders no favorite control of its own as of this story, and that the accessibility/i18n guarantees these ACs describe now live entirely in `EventCardFavoriteBadge` and at the consumer-composition level.
7. **Given** Story 1.i1e's shipped AC4 (in both `epics.md` and the story's own file) parenthetically attributes the one live favorite control to *"`EventCardMediaSlot`'s corner or large-fallback badge, per Story 1.i1a"*, **when** this story ships, **then** that parenthetical is corrected in both documents to name the actual (and, after this story, only possible) mechanism — an externally-composed `EventCardFavoriteBadge` sibling of `RootTag` — with a dated annotation, not a silent rewrite.
8. **Given** Story 1.i1m's shipped AC4 (in both `epics.md` and the story's own file) names the now-removed `hideFavoriteBadge` prop as part of the composition it describes ("following the same `hideFavoriteBadge` + `onImagePresenceChange` composition `EventCard.tsx`'s masonry branch already uses"), **when** this story ships, **then** both documents' AC4 text is amended with a dated annotation dropping the now-nonexistent prop name while leaving the described behavior (external composition, scale following image presence, `onImagePresenceChange` wiring) stated as unchanged.
9. **Given** Architecture Spine AD-15 Rule 4 ("The favorite badge is always one live control...") currently cites *"the same test file's AC4 suite (single-focusable + min hit area)"* as its sole enforcement, and that describe block is deleted by AC4 above, **when** this story ships, **then** Rule 4's text is reworded to state the guarantee is proven at the consumer level (each real caller proves its own single-control composition independently), not as a property the primitive itself still enforces, and its "Enforced by" line is repointed to `EventCard.test.tsx`'s existing `renders exactly one focusable favorite-toggle control (outer top-right button suppressed) when onFavoriteToggle is provided` test and `EventCardCompact.test.tsx`'s existing `Image-present vs. image-absent favorite-badge placement` describe block.
10. **Given** Story 1.i1z's own AC5 anticipates exactly this situation — *"a future edit that weakens or deletes [a ratchet-marked test block] is a deliberate, visible act rather than silent drift"* — and AC4 above trims the favorite-badge-dependent sub-assertions out of its two ratchet-marked blocks (`EventCardMediaSlot - AC1 ...` is untouched; `EventCardMediaSlot fallback - AC3 ...` loses its button/`onFavoriteToggle` assertions but keeps every placeholder-text/reserved-footprint assertion), **when** this story ships, **then** Story 1.i1z's own file gains a new, dated `## Change Log` entry naming exactly which sub-assertions were dropped and confirming the surviving assertions still fully enforce the narrowed AC1/AC2/AC3 it ratchets — not a silent diff.
11. **Given** this is a `packages/ui`/`packages/visual-audit` presentational dead-code removal with zero behavior change, **when** this story ships, **then** no file under `apps/backend`, `packages/database`, or any other backend/DB package is touched, no migration is created, and the Definition of Done's "Lint and type checks passing" requirement scopes to `packages/ui` and `packages/visual-audit` only.

## Tasks / Subtasks

- [x] Task 1 — Delete the dead branches and their props from `EventCardMediaSlot` (AC1, AC2)
  - [x] 1.1 In `EventCardMediaPrimitives.tsx`, remove `isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, `hideFavoriteBadge` from `EventCardMediaSlot`'s destructured parameters.
  - [x] 1.2 Delete the with-image branch's conditional `EventCardFavoriteBadge scale="default"` render (the `{!hideFavoriteBadge && onFavoriteToggle && (...)}` block inside the `imagePresent ? (<>...` fragment) — the fragment's `<img>` is now the branch's only content; simplify `imagePresent ? (<>...<img/>...</>) : (...)` to `imagePresent && (<img .../>)`, since there is nothing left in the `imagePresent` branch beyond the `<img>` and nothing left in the else-branch at all.
  - [x] 1.3 Delete the reserved-blank fallback branch's conditional `EventCardFavoriteBadge scale="large"` render entirely (the `!hideFavoriteBadge && onFavoriteToggle && (<div>...<EventCardFavoriteBadge scale="large" .../></div>)` block) — per 1.2, nothing replaces it; the outer `<div data-event-card-media-slot>` still mounts unconditionally (preserving the reserved footprint), simply with no children when `imagePresent` is `false`.
  - [x] 1.4 Remove the now-unused `EVENT_CARD_BADGE_MIN_TOUCH_REM` import from `event-card-media-tokens` at the top of `EventCardMediaPrimitives.tsx` (its only use in this file was the deleted fallback branch's `minHeight` style; it stays exported from `event-card-media-tokens.ts` and stays imported/used by `EventCard.tsx`, which has its own, unrelated use of it for its external favorite-badge wrapper).
  - [x] 1.5 Update `EventCardMediaPrimitives.types.ts`: remove the `isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, `hideFavoriteBadge` fields (and their doc comments) from `EventCardMediaSlotProps`. Do **not** touch `EventCardFavoriteBadgeProps` or `EventCardFavoriteBadgeLabels` — both stay exactly as they are (still imported/used by `EventCardFavoriteBadgeProps.labels`).
  - [x] 1.6 Update `EventCardMediaPrimitives.tsx`'s file-header doc comment and `EventCardMediaSlotProps`'/`EventCardMediaSlot`'s own doc comments to describe the new, narrower contract (image-or-nothing, no favorite rendering of its own) instead of the retired "switches between a small corner favorite pill ... and the large centered favorite control" description.

- [x] Task 2 — Update both call sites (AC3)
  - [x] 2.1 `EventCard.tsx`: remove the `hideFavoriteBadge` prop from its one `<EventCardMediaSlot>` call (masonry-default composition) — no other change to this file; the externally-composed `EventCardFavoriteBadge` sibling (lines ~372-440) is untouched.
  - [x] 2.2 `EventCardCompact.tsx`: remove `isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, `hideFavoriteBadge` from its one `<EventCardMediaSlot>` call — keep `layout`, `size`, `imageUrl`, `imageFallbackUrl`, `imageAlt`, `collapseOnFallback`, `onImagePresenceChange` unchanged. Update the inline comment above this call (currently explaining why the slot's own badge is hidden) and the longer comment above the `!imagePresent && <EventCardFavoriteBadge scale="large" .../>` block further down (currently citing `planning-artifacts/event-pages-followup-2026-10-05.md, step 5` as where the removal is tracked) to state plainly that the slot renders no favorite control of its own at all now — not citing a still-open tracker item, since this story is that item landing.
  - [x] 2.3 Confirm via `pnpm --filter @festgrid/ui build` (or `tsc --noEmit` on `packages/ui`) that both files compile clean against the narrowed `EventCardMediaSlotProps`. (`tsc --noEmit` fails repo-wide on a pre-existing, unrelated `TS5101` baseUrl-deprecation error, confirmed present identically on the pre-story baseline commit via `git stash`; used `pnpm --filter @festgrid/ui lint` plus the full Vitest suite as the compile-clean proof instead — see Completion Notes.)

- [x] Task 3 — Rewrite/trim `EventCardMediaPrimitives.test.tsx` (AC4)
  - [x] 3.1 `EventCardFavoriteBadge - AC2` block: rewrite the one sub-test currently mounting via `<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />` to instead render `<EventCardFavoriteBadge scale="large" onFavoriteToggle={vi.fn()} />` directly — same assertions (icon inline-style size), different mounting vehicle.
  - [x] 3.2 `EventCardMediaSlot fallback - AC3` block: for every test that currently passes `onFavoriteToggle={vi.fn()}` purely to get a button to assert against (the "no image" test, the "both absent" test, the "onError switch" test, and the two BUG-042 fallback-chain tests that end in a button assertion), drop `onFavoriteToggle` and replace the button assertion with a check that the slot's own root element (`[data-event-card-media-slot]`) is still mounted (and, where it reads more naturally, empty via `toBeEmptyDOMElement()`). The "no image, no placeholder" test and the "both imageUrl and onFavoriteToggle absent" test can be merged into one test now that `onFavoriteToggle` no longer exists as a slot prop — see the Reference Implementation below for the exact merged test. Every assertion about `<img>` absence/presence and placeholder-text absence is unchanged.
  - [x] 3.3 Delete the entire `EventCardMediaSlot - AC4 (one live favorite-toggle control, adequate tap target, no extra focus stop)` describe block (its 4 tests are all about the slot's own, now-removed, internal control). Replace it with a short comment (see Reference Implementation) explaining the retirement and pointing at where the equivalent guarantee is proven today (`EventCard.test.tsx`, `EventCardCompact.test.tsx`).
  - [x] 3.4 `EventCardMediaSlot additive props (Story 1.i1e)` block: delete the two `hideFavoriteBadge` tests entirely; keep the two `onImagePresenceChange` tests, dropping `onFavoriteToggle` from each render call (that prop played no role in either assertion). Rename the describe block to `EventCardMediaSlot additive props (onImagePresenceChange, Story 1.i1e)` and add a one-line comment noting `hideFavoriteBadge` was retired by this story.
  - [x] 3.5 `EventCardMediaSlot collapseOnFallback (Story 1.i1m AC1/AC3)` block: drop `onFavoriteToggle` from all four tests. For the first test ("defaults to false and preserves the exact reserved-blank fallback when omitted"), replace the `within(slot).getByRole('button', ...)` assertion with `expect(slot).toBeEmptyDOMElement()`. For the second and third tests (collapse-to-null tests), no assertion needs to change beyond dropping the now-nonexistent prop. For the fourth test ("keeps the with-image branch byte-identical..."), drop the trailing button assertion — the `<img>` src assertion already fully proves the with-image branch is unaffected.
  - [x] 3.6 Remove the now-unused `EVENT_CARD_BADGE_MIN_TOUCH_REM` import (used only by the deleted AC4 block) and the now-unused `within` import (used only by the two collapseOnFallback assertions rewritten in 3.5) from the top of the test file.
  - [x] 3.7 Run `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` and confirm the full file passes (this story's own dev-agent dry run confirmed 84/84 passing against the exact diff in the Reference Implementation below — re-verify, don't assume). **Re-verified: 84/84 passing.**

- [x] Task 4 — Fix the stale visual-audit manifest comment (AC5)
  - [x] 4.1 In `packages/visual-audit/manifests/event-card-date-box-sizing.ts`, correct the `FIXTURE_IMAGE_DATA_URI` header comment's clause naming `hideFavoriteBadge` — see Reference Implementation for the exact replacement wording. No other line in this file changes.
  - [x] 4.2 Confirm (read-through, no new run required — the manifest's registered entries/render specs/rules are untouched) that this is comment-only and changes no registered `ManifestEntry`.

- [x] Task 5 — Amend Stories 1.i1a / 1.i1e / 1.i1m's shipped ACs (AC6, AC7, AC8)
  - [x] 5.1 **`epics.md` check first, do not skip:** re-verified at implementation time per this subtask's own instruction — `epics.md`'s condensed entries for Stories 1.i1a, 1.i1e, and 1.i1m (and this story's own already-present `epics.md` section) still carry no favorite-badge-ownership language needing amendment; no drift since story creation. No `epics.md` edit made.
  - [x] 5.2 Verified `_bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md` already carries the exact AC3/AC4/AC5 annotations specified below, word-for-word (pre-existing in the baseline commit — confirmed via `git status`/`git diff` showing no pending changes to this file). No edit needed.
  - [x] 5.3 Verified `_bmad-output/implementation-artifacts/1-i1e-adopt-the-primitive-into-the-masonry-default-state.md` already carries the exact AC4 annotation specified below, word-for-word. No edit needed.
  - [x] 5.4 Verified `_bmad-output/implementation-artifacts/1-i1m-drop-the-calendar-rows-reserved-image-slot.md` already carries the exact AC4 annotation specified below, word-for-word. No edit needed.

- [x] Task 6 — Amend Architecture Spine AD-15 Rule 4 (AC9)
  - [x] 6.1 Verified `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`'s AD-15 Rule 4 already carries the exact reworded text and re-pointed "Enforced by" citation specified below, word-for-word. No edit needed.

- [x] Task 7 — Add Story 1.i1z's Change Log entry (AC10)
  - [x] 7.1 Verified `_bmad-output/implementation-artifacts/1-i1z-ratchet-no-card-surface-sizes-or-falls-back-locally.md`'s `## Change Log` section already carries the exact new, dated entry specified below, word-for-word. No edit needed.

- [x] Task 8 — Verification (all ACs)
  - [x] 8.1 `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` — 84/84 passing, no regressions.
  - [x] 8.2 `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCard.test.tsx src/features/events/EventCardCompact.test.tsx` — 87/87 passing, files unmodified (proves AC3's "byte-for-byte identical output" claim). Required building `packages/domain` first (`pnpm --filter @festgrid/domain build`, pre-existing missing-`dist` issue unrelated to this story — confirmed via `git stash`) for Vite to resolve `@festgrid/domain/geolocation`.
  - [x] 8.3 `pnpm --filter @festgrid/ui lint` — 0 errors. `tsc --noEmit` fails repo-wide (pre-existing `TS5101` baseUrl-deprecation error, confirmed on the pre-story baseline too) — not a regression introduced by this story; lint + the full test suite serve as this story's compile-clean proof.
  - [x] 8.4 `pnpm --filter @festgrid/visual-audit lint` — 0 errors; the one comment-only manifest edit parses/compiles clean.
  - [x] 8.5 Confirmed via `git diff --stat` — only files under `packages/ui`, `packages/visual-audit`, and this story's own `_bmad-output/implementation-artifacts` file (plus `sprint-status.yaml`'s status field) were touched; no edit was needed in any of the Task 5-7 target docs since all were already amended in the baseline.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) — No gap found.** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md` (swept: true, 2026-09-13), which ran Gate 1 epic-wide across Epic 1.i1. **Lightweight guard, applied fresh:** this story's actual scope is narrower than anything the sweep anticipated — it removes code and props, touches no DB/ORM/domain package, no external service, no new API surface, no auth/secrets, and introduces no new infra dependency at all. No fresh Gate 1 run warranted.
- **Gate 2 (UI Complexity & Reusability) — run fresh, per story-split-gate.md's per-story requirement.** Dispatched to a Freya-persona one-shot analysis against this story's exact scope. **Verdict: NO SPLIT.** Verbatim: *"Verified against the code: `EventCardMediaSlot`'s two badge branches are gated `!hideFavoriteBadge && onFavoriteToggle` ... Both already compose `EventCardFavoriteBadge` externally as DOM siblings ... matching the story's description exactly. This cleanup was pre-scoped in `event-pages-followup-2026-10-05.md` Step 5 with the identical file list. Nothing reusable is being introduced (deletion only), no hook/util is added, and no DESIGN.md/EXPERIENCE.md state changes since rendered output is byte-for-byte unchanged at both call sites — `EventCardFavoriteBadge` itself, the only component with real states, is untouched."*
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Sourced from the same swept `epic-1-i1-readiness.md`. No i18n/analytics/global-shell/codegen dependency is implicated — this story adds no new user-facing string, no new shared mechanism, and touches no file outside `packages/ui`/`packages/visual-audit`/the planning docs listed above.

### Why this story exists, and why it isn't a silent one-liner

`IDEA-048` (the backlog row that originally found the compact-row's favorite-pill corner-overlay bug) was closed 2026-10-05 once direct code verification confirmed its fix had already shipped out-of-band (commit `d3414728`, 2026-10-03): both `EventCard.tsx` and `EventCardCompact.tsx` now compose their favorite control externally and unconditionally pass `hideFavoriteBadge` to `EventCardMediaSlot`. That closing note flagged the slot's own internal badge branches as "unused by production callers but still tested; removal is a separate step" — carved out explicitly rather than folded into IDEA-048's own close, and tracked as Step 5 of `planning-artifacts/event-pages-followup-2026-10-05.md` (not edited by this story — it is cited, not owned, per `backlog-spec.md` §8's citation/owned-artifact distinction).

The reason this needs a dedicated story rather than a one-line `bmad-quick-dev` fix is that the dead code is load-bearing for **four already-`review`'d stories' shipped Acceptance Criteria** (1.i1a, 1.i1e, 1.i1m, 1.i1z) and one Architecture Spine rule (AD-15 Rule 4) — all of which describe, cite, or enforce the exact capability being deleted. Silently deleting it would leave those documents actively wrong on re-read, which is exactly the "silent drift" Story 1.i1z's own AC5 was written to prevent. Gate 3 (run during this story's own creation, per `bmad-create-story`'s workflow) enumerated every one of these and got explicit user confirmation (via `AskUserQuestion`, 2026-10-06) to amend all of them in the same pass, plus to reword AD-15 Rule 4 (not just repoint its citation) — see "User-Resolved Design Decisions" below.

### User-Resolved Design Decisions (AskUserQuestion, 2026-10-06)

1. **Scope of AC amendments — amend all four affected stories, not just the two the triggering prompt named literally.** The triggering request named only "Story 1.i1e" and "AC4" by name; a full read of the test file and all four stories' Acceptance Criteria found the actual contradiction surface is wider — Story 1.i1a's own AC3/AC4/AC5 (the primitive's original contract), Story 1.i1m's AC4 (names the retired prop by name), and Story 1.i1z's ratchet-marked test blocks (lose their button-based sub-assertions). Two options were presented: (a) amend all four stories' ACs plus AD-15 Rule 4, so every shipped doc stays accurate; (b) amend only the two literally-named targets, leaving 1.i1a's AC3/4/5 and 1.i1m's AC4 describing removed behavior. **User selected (a).**
2. **Architecture Spine AD-15 Rule 4 — reword the claim itself, not just its citation.** Since Rule 4's cited enforcement (the slot's own "AC4" test suite) is deleted, its citation needs to move regardless; the open question was whether Rule 4's prose itself ("the favorite badge is always one live control") should also be reworded to state this is now a consumer-level, not primitive-level, guarantee. Two options: (a) reword Rule 4's claim to match the new reality; (b) leave the claim's wording as-is and only repoint "Enforced by". **User selected (a)** — Rule 4 now explicitly states the guarantee is proven independently by each consumer.

### Reference Implementation (validated against the real test suite; not yet applied to the working tree)

This story's own creation pass drafted and ran the full diff below against the actual codebase — `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` passed **84/84** — then reverted it, since `bmad-create-story` must not modify application source (that is `bmad-dev-story`'s job). Everything below is a verified-correct reference for Tasks 1-4, not a promise to re-derive from scratch.

**`EventCardMediaPrimitives.tsx` — `EventCardMediaSlot`'s destructured params** (Task 1.1):
```tsx
export function EventCardMediaSlot({
  imageUrl,
  imageFallbackUrl,
  imageAlt,
  layout,
  className = '',
  size = 'default',
  onImagePresenceChange,
  collapseOnFallback = false,
}: EventCardMediaSlotProps) {
```

**`EventCardMediaPrimitives.tsx` — the render body** (Task 1.2, 1.3), replacing the entire `imagePresent ? (<>...</>) : (...)` ternary:
```tsx
      {
        // Reserved-blank fallback (AC3, Story 1.i1a): no image, no placeholder icon, no
        // placeholder text, and — as of Story 1.i1p — no favorite control either. The slot
        // keeps its exact AC1 footprint (this outer `<div>` always mounts, unless
        // `collapseOnFallback` short-circuited the whole component above) regardless of
        // whether an image is present; favorite-control composition is entirely the
        // caller's responsibility (`EventCard.tsx`/`EventCardCompact.tsx` each compose
        // `EventCardFavoriteBadge` as an external sibling — see this file's header comment).
        imagePresent && (
          <img
            src={currentImgSrc}
            alt={imageAlt ?? ''}
            onError={handleImageError}
            className="object-cover w-full h-full"
          />
        )
      }
    </div>
  );
}
```

**`EventCardMediaPrimitives.tsx` — import cleanup** (Task 1.4):
```tsx
import {
  eventCardBadgeIconSizeStyle,
  badgeFontSizeStyleFor,
} from './event-card-media-tokens';
```
(drops `EVENT_CARD_BADGE_MIN_TOUCH_REM`, which has no remaining use in this file.)

**`EventCardMediaPrimitives.types.ts` — `EventCardMediaSlotProps`** (Task 1.5, 1.6): remove the `isFavorited?`, `favoriteCount?`, `onFavoriteToggle?`, `labels?`, `hideFavoriteBadge?` fields and their doc comments; update the interface's own header comment to read (replacing the old "owns ... the badge scale" / "switches between a small corner favorite pill ... and the large centered favorite control" description):
```
/**
 * The media/thumbnail slot of the shared event-card primitive. It owns image-slot
 * dimensions and the reserved-blank fallback — it does NOT own any date/locale
 * formatting, and (as of Story 1.i1p) it does NOT own any favorite-control rendering
 * either.
 *
 * `EventCardMediaSlot` internally tracks an `onError` state identical to
 * `EventCard`'s existing `imgError` detection and switches between:
 *  - image present + ok → `<img>` (object-cover filling the reserved footprint)
 *  - image absent/errored → nothing rendered in the slot (the slot's own root
 *    element still mounts, preserving its AC1 footprint — see `collapseOnFallback`
 *    below for the one opt-in exception) — per `DESIGN.md` § thumbnail_default_fallback
 *    / § event_card_compact_thumbnail_fallback
 *
 * Favorite-badge composition is entirely the caller's responsibility in both branches:
 * every real consumer (`EventCard.tsx`'s masonry-default state, `EventCardCompact.tsx`'s
 * row) renders `EventCardFavoriteBadge` as an external sibling of this slot, not through
 * it. Story 1.i1a originally gave this slot its own internal favorite-badge rendering
 * (suppressible via a `hideFavoriteBadge` prop added by Story 1.i1e); Story 1.i1p removed
 * that internal rendering and the `hideFavoriteBadge`/`isFavorited`/`favoriteCount`/
 * `onFavoriteToggle`/`labels` props entirely once both production callers were found to
 * always suppress it.
 */
```

**`EventCard.tsx`** (Task 2.1) — the one `<EventCardMediaSlot>` call drops `hideFavoriteBadge`:
```tsx
            <EventCardMediaSlot
              layout="flex-fill"
              size="default"
              imageUrl={imageUrl}
              imageFallbackUrl={imageFallbackUrl}
              imageAlt={finalImageAlt}
              onImagePresenceChange={setDefaultThumbnailImagePresent}
            />
```

**`EventCardCompact.tsx`** (Task 2.2) — the one `<EventCardMediaSlot>` call drops `isFavorited`/`favoriteCount`/`onFavoriteToggle`/`labels`/`hideFavoriteBadge`:
```tsx
        <EventCardMediaSlot
          layout="fixed-square"
          size="compact"
          imageUrl={imageUrl}
          imageFallbackUrl={imageFallbackUrl}
          imageAlt={eventName}
          collapseOnFallback
          // The with-image favorite pill is composed externally below (card-corner position,
          // like the TILL tag) -- the slot itself renders no favorite control at all (Story
          // 1.i1p removed that capability once every real caller was found to suppress it).
          onImagePresenceChange={setImagePresent}
        />
```
and the later comment above the `!imagePresent && <EventCardFavoriteBadge scale="large" .../>` block becomes:
```tsx
        {/* Story 1.i1m AC1/AC4: the favorite control, externally composed as a plain flex
            sibling (not absolutely positioned — unlike masonry's `EventCard.tsx` overlay,
            this row has no image to overlay when collapsed, so the badge is simply the
            row's last flex child) whenever the media slot above has collapsed to `null`.
            With an image present, the externally composed corner pill above renders
            instead (the slot itself never renders a favorite control of its own — Story
            1.i1p removed that capability from `EventCardMediaSlot` entirely), so this and
            that pill are mutually exclusive, never both. */}
```

**`EventCardMediaPrimitives.test.tsx`** (Task 3) — the full set of changes, in file order:
- Imports: drop `within` from the `@testing-library/react` import, and drop `EVENT_CARD_BADGE_MIN_TOUCH_REM` from the `event-card-media-tokens` import.
- `EventCardFavoriteBadge - AC2` block's last test: change `render(<EventCardMediaSlot layout="flex-fill" onFavoriteToggle={vi.fn()} />)` to `render(<EventCardFavoriteBadge scale="large" onFavoriteToggle={vi.fn()} />)`; everything else in that test is unchanged.
- `EventCardMediaSlot fallback - AC3` block: merge the "renders no image, no placeholder text, and no filler..." and "renders nothing at all in the slot when both imageUrl and onFavoriteToggle are absent" tests into one:
  ```tsx
  it('renders no image, no placeholder text, and no favorite control when imageUrl is absent (the slot owns no favorite rendering of its own, Story 1.i1p)', () => {
    const { container } = render(<EventCardMediaSlot layout="flex-fill" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(screen.queryByText(/no image available/i)).toBeNull();
    // The slot's own root element still mounts, preserving its AC1 reserved footprint.
    expect(slotRoot(container)).not.toBeNull();
  });
  ```
  Rewrite the "switches to the reserved-blank fallback when the image onError fires" test to drop `onFavoriteToggle` and swap its final assertion for `expect(slotRoot(container)).not.toBeNull();` (capturing `container` from `render(...)`). Rewrite the "falls through to the reserved-blank fallback if the imageUrl-absent fallback itself errors" test the same way. Rewrite the "falls through to the reserved-blank fallback when both imageUrl and imageFallbackUrl error" test the same way. Every other test in this block (the BUG-042 tests that never used `onFavoriteToggle`) is untouched.
- Delete the entire `describe('EventCardMediaSlot - AC4 ...', () => { ... })` block (its `afterEach` plus 4 `it` blocks), replacing it with:
  ```tsx
  // Story 1.i1a's original "AC4" (one live favorite-toggle control owned by the slot itself,
  // adequate tap target, no extra focus stop) is retired: Story 1.i1p removed EventCardMediaSlot's
  // internal favorite-badge rendering entirely, once both production callers (EventCard.tsx,
  // EventCardCompact.tsx) were found to always suppress it via the since-removed
  // `hideFavoriteBadge` prop. That invariant now lives entirely at the consumer level instead --
  // see EventCard.test.tsx's "renders exactly one focusable favorite-toggle control (outer
  // top-right button suppressed) when onFavoriteToggle is provided" and
  // EventCardCompact.test.tsx's "Image-present vs. image-absent favorite-badge placement"
  // describe block, each of which proves it for their own composed `EventCardFavoriteBadge`
  // sibling. `EventCardFavoriteBadge` itself keeps its own min-h-11/min-w-11 tap-target and
  // single-accessible-name guarantees -- see its own "AC5" describe block below.
  ```
- `EventCardMediaSlot additive props (Story 1.i1e)` block: delete the `hideFavoriteBadge suppresses...` and `renders the internal badge normally when hideFavoriteBadge is omitted...` tests entirely; keep the two `onImagePresenceChange` tests, dropping `onFavoriteToggle={vi.fn()}` from each; rename the describe to `'EventCardMediaSlot additive props (onImagePresenceChange, Story 1.i1e)'` and add a one-line comment above it noting `hideFavoriteBadge` was retired by this story.
- `EventCardMediaSlot collapseOnFallback (Story 1.i1m AC1/AC3)` block: drop `onFavoriteToggle` from all 4 tests; in the first test, replace `expect(within(slot as HTMLElement).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();` with `expect(slot).toBeEmptyDOMElement();`; in the fourth test, delete the trailing `expect(within(slot as HTMLElement).getByRole('button', { name: 'Toggle favorite' })).toBeInTheDocument();` line (the `<img>` `src` assertion right above it already proves the with-image branch).

**`packages/visual-audit/manifests/event-card-date-box-sizing.ts`** (Task 4.1) — the `FIXTURE_IMAGE_DATA_URI` header comment's third/fourth lines change from:
```
 * `imageUrl` would render the reserved-blank fallback instead (no `<img>` at all in the masonry
 * default composition, since `hideFavoriteBadge` is set and no `onFavoriteToggle` is passed at
 * this call site), which would trivially "pass" this check for the wrong reason (both siblings
```
to:
```
 * `imageUrl` would render the reserved-blank fallback instead (no `<img>` at all in the masonry
 * default composition -- `EventCardMediaSlot` never renders a favorite control of its own as of
 * Story 1.i1p, so there's nothing else in that slot to size against either), which would
 * trivially "pass" this check for the wrong reason (both siblings
```

### Story-File AC Amendment Wording (Task 5, exact text for AC6/AC7/AC8)

Per Task 5.1, `epics.md`'s own condensed entries for these three stories do **not** need editing (verified at this story's creation — see Task 5.1's note); all of the following go into each story's own full file only.

Append to Story 1.i1a's **AC3**, as a new trailing sentence in the same bullet:

> ***Amended 2026-10-06 (Story 1.i1p):*** *the clause "and the large favorite-badge variant (AC2) is centered inside it in place of the small corner pill" is retired — `EventCardMediaSlot` no longer renders any favorite control of its own in this branch (or the with-image branch). Favorite-control rendering moved entirely to the caller (`EventCard.tsx`/`EventCardCompact.tsx` each compose `EventCardFavoriteBadge` externally); the slot's only remaining job on image absence/error is to stay mounted, empty, preserving its AC1 footprint.*

Append to AC4:

> ***Amended 2026-10-06 (Story 1.i1p):*** *this AC described `EventCardMediaSlot`'s own internal favorite control, which no longer exists. The accessibility guarantee itself (one live, reachable favorite-toggle button, `min-h-11 min-w-11` tap target, no extra focus stop) is unchanged and unaffected — it is proven today at `EventCardFavoriteBadge`'s own level (unaffected by this story) and at each consumer's own composition (`EventCard.test.tsx`, `EventCardCompact.test.tsx`), not at the slot's.*

Append to AC5:

> ***Amended 2026-10-06 (Story 1.i1p):*** *this AC's i18n label-fallback convention was already, and remains, `EventCardFavoriteBadge`'s own contract (unaffected by this story) — it never actually described a separate convention owned by the slot. Clarified here only because the slot no longer forwards a `labels` prop of its own at all.*

Append to Story 1.i1e's **AC4**:

> ***Amended 2026-10-06 (Story 1.i1p):*** *the parenthetical "(`EventCardMediaSlot`'s corner or large-fallback badge, per Story 1.i1a)" is corrected — the live control was already, and remains, the externally-composed `EventCardFavoriteBadge` sibling of `RootTag` this story's own Task 2.3/Dev Notes describe; `EventCardMediaSlot` itself never owns it after Story 1.i1p removed that capability entirely.*

Append to Story 1.i1m's **AC4**:

> ***Amended 2026-10-06 (Story 1.i1p):*** *"the same `hideFavoriteBadge` + `onImagePresenceChange` composition" is corrected to "the same `onImagePresenceChange` composition" — `hideFavoriteBadge` was removed by Story 1.i1p along with the internal rendering it suppressed, since the slot's behavior no longer needs a flag to stay suppressed. The described behavior itself (external composition, scale following image presence) is unchanged.*

### Architecture Spine AD-15 Rule 4 Amendment Wording (Task 6, exact text for AC9)

Replace Rule 4's current text and citation:

> 4.  **The favorite badge is always one live control, at a real tap target.** Both scales render as a
>     single focusable favorite-toggle `<button>` sharing one accessible name/role — never a decorative
>     label, never an extra independent focus stop. The `large` fallback variant keeps a `min-h-11
>     min-w-11` (≥44px) tap target per `components.nav.item_hit_area`'s convention and
>     EXPERIENCE.md's reachable-control rule.
>     - **Enforced by:** the same test file's AC4 suite (single-focusable + min hit area).

with:

> 4.  **The favorite badge is always one live control, at a real tap target.** Both scales render as a
>     single focusable favorite-toggle `<button>` sharing one accessible name/role — never a decorative
>     label, never an extra independent focus stop. The `large` fallback variant keeps a `min-h-11
>     min-w-11` (≥44px) tap target per `components.nav.item_hit_area`'s convention and
>     EXPERIENCE.md's reachable-control rule.
>
>     **Narrowed to a consumer-level guarantee, 2026-10-06 (Story 1.i1p).** This rule used to be
>     enforced *inside* `EventCardMediaSlot` itself (the primitive rendered the control directly).
>     Story 1.i1p removed that internal rendering once both real consumers were found to always
>     suppress it in favor of composing `EventCardFavoriteBadge` externally — `EventCard.tsx`'s
>     masonry-default state and `EventCardCompact.tsx`'s row each already proved this invariant for
>     their own composition before this story, and continue to. The rule's substance is unchanged;
>     only who is responsible for upholding it moved from the primitive to each consumer.
>     - **Enforced by:** `EventCardFavoriteBadge`'s own AC5 suite (`EventCardMediaPrimitives.test.tsx`
>       — single accessible name, `min-h-11 min-w-11` tap target, unchanged by Story 1.i1p) plus each
>       consumer's own single-control proof: `EventCard.test.tsx`'s
>       `renders exactly one focusable favorite-toggle control (outer top-right button suppressed) when onFavoriteToggle is provided`
>       and `EventCardCompact.test.tsx`'s `Image-present vs. image-absent favorite-badge placement`
>       describe block.

### Story 1.i1z Change Log Amendment Wording (Task 7, exact text for AC10)

Append as a new, third bullet under Story 1.i1z's existing `## Change Log` section:

> - 2026-10-06 (Story 1.i1p): `EventCardMediaSlot`'s internal favorite-badge rendering was removed entirely (both production callers had always suppressed it). This story's own `describe('EventCardMediaSlot fallback - AC3 ...')` ratchet block (enforcing AD-15 Rule 2 / this story's AC2) lost its `onFavoriteToggle`/button-presence sub-assertions, which proved nothing about AC2's actual claim (no placeholder icon/text, reserved footprint) — those assertions survive unchanged. The sibling `describe('EventCardMediaSlot - AC1 ...')` block (AD-15 Rule 1 / this story's AC1) is untouched. This is the deliberate, visible act this story's own AC5 anticipated, not silent drift.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: `EventCardMediaSlotProps` loses five optional fields (`isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, `hideFavoriteBadge`) — a narrowing, not a widening, of an existing TypeScript interface in `packages/ui`. No GraphQL schema, resolver, or database column is touched.
- Required DB migration changes: None — this story touches no persistence layer.
- Required TypeScript type changes: As listed above. Both call sites (`EventCard.tsx`, `EventCardCompact.tsx`) are updated in the same story so the removal compiles clean; no other file in the repo passes these props to `EventCardMediaSlot` (confirmed by a repo-wide grep during this story's creation — only `EventCard.tsx` and `EventCardCompact.tsx` call `EventCardMediaSlot` in production code; `EventCardCalendarGridItem.tsx` only mentions it in a comment).
- Backward compatibility and rollout notes: This is a breaking change to `EventCardMediaSlotProps`'s TypeScript surface (removed, not deprecated, optional fields), acceptable because (a) it is an internal `packages/ui` component type, not a published/versioned external package, and (b) a repo-wide grep confirmed zero other call sites. No runtime rollout risk — both real call sites already fully suppressed the removed behavior, so production output is unaffected.
- Verification checks: Task 8's full verification pass (vitest on the primitives test file, `EventCard.test.tsx`, `EventCardCompact.test.tsx`; lint; `tsc --noEmit`) proves no behavioral or type-level regression. The `height-matches-thumbnail`/`width-consistency-1-vs-2-digit` visual-audit manifest entries (`event-card-date-box-sizing.ts`) are unaffected (comment-only edit) but worth a visual re-check at implementation time since they render `EventCard` directly.

### Project Structure Notes

- Alignment with unified project structure: All production-code changes stay within `packages/ui/src/features/events/` (Domain Features per `project-context.md`'s UI Components & Scalability rule) and `packages/visual-audit/manifests/` — no new files, no relocation.
- No `packages/domain` involvement: pure presentational deletion, no business logic touched.
- No state-management, loader, i18n, analytics, or cloud/external-service scope: this story introduces no new user-facing behavior of any kind — every rendered pixel is unchanged at both call sites.
- Detected conflicts or variances: None.
- No PRD impact: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` describes no feature/constraint this story's internal `packages/ui` dead-code removal could contradict — consistent with Story 1.i1z's own precedent ("no PRD feature/constraint change; this is a CI-enforcement story for an already-shipped UX invariant").

### References

- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-048] (closed 2026-10-05; this story is the carved-out "removal is a separate step" item from its own close-out note)
- [Source: _bmad-output/planning-artifacts/event-pages-followup-2026-10-05.md] (Step 5 — cited, not edited, per `backlog-spec.md` §8's citation/owned-artifact distinction; this story is that step landing)
- [Source: _bmad-output/implementation-artifacts/backlog-spec.md §4, §8, §13] (ID freshness rule; citation vs. owned-artifact ref rule; promotion-intake mechanics for FIND-073)
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-i1-readiness.md] (Gate 1 + Gate 3 sweep, swept: true)
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] (Gate 2 run fresh; Epic-Level Sweep Mode for Gate 1/3)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.tsx] (read in full — confirmed both dead branches' exact gating and line positions)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.types.ts] (read in full)
- [Source: packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx] (read in full — confirmed every affected describe/it block, including the pre-existing brace-nesting quirk around the "AC3"/"AC4" blocks, which this story's edits do not need to fix to stay correct)
- [Source: packages/ui/src/features/events/EventCard.tsx] (read in full — confirmed the one `hideFavoriteBadge` call site and the untouched external `EventCardFavoriteBadge` composition)
- [Source: packages/ui/src/features/events/EventCardCompact.tsx] (read in full — confirmed all five now-removed props' call site and the untouched external compositions)
- [Source: packages/visual-audit/manifests/event-card-date-box-sizing.ts] (read in full — confirmed the one stale comment, and that the manifest's actual rendered output does not depend on `hideFavoriteBadge`)
- [Source: packages/ui/src/features/events/EventCard.test.tsx:1323] (`renders exactly one focusable favorite-toggle control...` — the consumer-level proof AD-15 Rule 4 now cites)
- [Source: packages/ui/src/features/events/EventCardCompact.test.tsx] (`Image-present vs. image-absent favorite-badge placement` describe block — the other consumer-level proof AD-15 Rule 4 now cites)
- [Source: _bmad-output/implementation-artifacts/1-i1a-extend-the-shared-event-card-primitive-to-own-thumbnail-sizing-and-fallback.md] (AC3/AC4/AC5 amended by this story)
- [Source: _bmad-output/implementation-artifacts/1-i1e-adopt-the-primitive-into-the-masonry-default-state.md] (AC4 amended by this story)
- [Source: _bmad-output/implementation-artifacts/1-i1m-drop-the-calendar-rows-reserved-image-slot.md] (AC4 amended by this story)
- [Source: _bmad-output/implementation-artifacts/1-i1z-ratchet-no-card-surface-sizes-or-falls-back-locally.md] (Change Log entry appended by this story)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-15] (Rule 4 reworded + re-cited by this story)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.i1a, #Story 1.i1e, #Story 1.i1m] (read in full at this story's creation — confirmed their condensed bullets do not carry the specific favorite-badge-ownership language the full story files do, so only this story's own new `epics.md` section is added, not an amendment to these three)

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components & Scalability rule (Domain Features → `packages/ui/src/features/<domain>/`, unchanged by this story); no State Management/Loader/i18n/analytics rule is implicated (no new behavior of any kind).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 (Event Card Media Primitive), Rule 4 amended by this story (AC9).
- [x] `docs/infrastructure/index.md` — consulted; not applicable, this story touches no backend compute, queues, EventBridge/cron, API Gateway, or database provisioning.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` (delete both dead branches + their props, trim one import, update doc comments — Task 1)
  - Modified: `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` (narrow `EventCardMediaSlotProps` — Task 1.5/1.6)
  - Modified: `packages/ui/src/features/events/EventCard.tsx` (drop `hideFavoriteBadge` from its one call site — Task 2.1)
  - Modified: `packages/ui/src/features/events/EventCardCompact.tsx` (drop 5 props from its one call site, update 2 comments — Task 2.2)
  - Modified: `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx` (rewrite/trim/delete test blocks per Task 3 — see Reference Implementation for the exact diff)
  - Modified: `packages/visual-audit/manifests/event-card-date-box-sizing.ts` (one stale comment — Task 4)
  - Modified: `_bmad-output/planning-artifacts/epics.md` (add this story's own Story 1.i1p section only — Task 5.1 confirmed the three existing entries need no edit)
  - Modified: `_bmad-output/implementation-artifacts/1-i1a-...md`, `1-i1e-...md`, `1-i1m-...md` (AC amendments in each story's own file only — Task 5)
  - Modified: `_bmad-output/implementation-artifacts/1-i1z-...md` (Change Log entry — Task 7)
  - Modified: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-15 Rule 4 — Task 6)
  - **Not touched:** `EventCardFavoriteBadge`/`EventCardDateBox`/`EventCardStatusBadge`/`EventCardNearbyBadge`/`EventCardRepeatBadge` and their own types/tests; `WeeklyCalendarView.tsx`/`.test.tsx` (delegates to `EventCardCompact.tsx`, not touched directly); any `apps/backend`/`packages/database` file.
- **Rule Mapping:**
  - UI Components & Scalability rule (project-context.md) → no relocation, stays in `features/events/`.
  - Architecture spine discipline → AD-15 Rule 4 amendment (AC9, Task 6).
  - `story-content-structure.md`'s canonical shape → this file's own structure.
  - Dead-code/test-coverage discipline (this workflow's "leave the system working end-to-end" principle) → every amended AC/doc (Task 5-7) exists specifically so no shipped artifact is left silently wrong.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` — full pass (validated at story-creation time: 84/84).
  - `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCard.test.tsx src/features/events/EventCardCompact.test.tsx` — full pass, unmodified.
  - `pnpm --filter @festgrid/ui lint` and `tsc --noEmit` — 0 errors.
  - Manual read-through confirming every amended AC/doc cites real, existing content (no invented line numbers/test names).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — delete `EventCardMediaSlot`'s two dead favorite-badge branches and their 5 unused props; update both call sites; rewrite/trim the affected tests; fix one stale comment; amend 4 stories' ACs + AD-15 Rule 4 for consistency. No backend/DB scope.
- [ ] Architecture and boundary confirmation — `packages/ui`/`packages/visual-audit` only; no `packages/domain` involvement; AD-15 Rule 4 amendment is a narrowing/re-citation, not a new rule.
- [ ] Testing plan confirmation — Task 8's full verification pass (unit tests for the touched file + both consumer test files, lint, typecheck).
- [x] Explicit human approval state — **Approved 2026-10-06 via `AskUserQuestion`**: user confirmed (1) amending all four affected stories' ACs rather than only the two literally named, and (2) rewording AD-15 Rule 4 itself (not just its citation). See Dev Notes — User-Resolved Design Decisions.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 & Gate 3: no gap (`epic-1-i1-readiness.md`, swept, plus a fresh lightweight guard). Gate 2: run fresh (Freya-persona one-shot analysis) — verdict NO SPLIT.

## Testing Requirements

- [ ] Integration/component tests (Vitest + Testing Library) — `EventCardMediaPrimitives.test.tsx`'s rewritten/trimmed blocks (Task 3), re-run to green.
- [ ] Integration/component tests — `EventCard.test.tsx` and `EventCardCompact.test.tsx`, re-run unmodified to green (proves zero behavioral change at both call sites).
- [ ] E2E tests — Not applicable. No user-facing behavior changes (both call sites' rendered output is byte-for-byte identical); nothing new exists for an E2E test to exercise.

## Deliverables Checklist

- [ ] `EventCardMediaSlot`'s two dead favorite-badge branches deleted; `isFavorited`/`favoriteCount`/`onFavoriteToggle`/`labels`/`hideFavoriteBadge` removed from `EventCardMediaSlotProps`
- [ ] `EventCard.tsx` and `EventCardCompact.tsx` updated to stop passing the removed props; both files' doc comments updated
- [ ] `EventCardMediaPrimitives.test.tsx` rewritten/trimmed per Task 3; full file green
- [ ] `event-card-date-box-sizing.ts`'s stale comment fixed
- [ ] Stories 1.i1a (AC3/4/5), 1.i1e (AC4), 1.i1m (AC4) amended in their own story files (`epics.md`'s condensed entries confirmed not to need the same edit — Task 5.1)
- [ ] Story 1.i1z's Change Log amended
- [ ] Architecture Spine AD-15 Rule 4 reworded + re-cited

## Out of Scope

- Any change to `EventCardFavoriteBadge`, `EventCardDateBox`, `EventCardStatusBadge`, `EventCardNearbyBadge`, or `EventCardRepeatBadge` — all untouched.
- Any change to `WeeklyCalendarView.tsx` directly — it delegates to `EventCardCompact.tsx` (already touched) and has no `EventCardMediaSlot` call of its own.
- Any visual/behavioral change to either real call site — this is a pure dead-code/doc-consistency story.
- Re-litigating IDEA-048's own fix (already shipped, already closed) — this story only removes the now-dead code IDEA-048's close-out explicitly carved out.

## Definition of Done

- [ ] AC1–AC11 satisfied.
- [ ] `EventCardMediaPrimitives.test.tsx` passing; `EventCard.test.tsx`/`EventCardCompact.test.tsx` passing unmodified.
- [ ] Lint and type checks passing for `packages/ui` and `packages/visual-audit`.
- [ ] All four amended stories' `epics.md` + own-file AC text, Story 1.i1z's Change Log, and AD-15 Rule 4 updated and internally consistent (no stale line/test-name citation left behind).

## Completion Status

- [x] Implementation complete, ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCardMediaPrimitives.test.tsx` → 84/84 passing.
- `pnpm --filter @festgrid/ui exec vitest run src/features/events/EventCard.test.tsx src/features/events/EventCardCompact.test.tsx` → 87/87 passing (files unmodified).
- `pnpm --filter @festgrid/ui lint` → 0 errors.
- `pnpm --filter @festgrid/visual-audit lint` → 0 errors.
- `pnpm --filter @festgrid/ui exec tsc --noEmit` → fails with a pre-existing, unrelated `TS5101` ("Option 'baseUrl' is deprecated") error before any file-level type checking runs; confirmed identical on the pre-story baseline commit (`d0e01c8`) via `git stash`/`git stash pop`, so this is environment noise, not a regression from this story's changes.
- `pnpm --filter @festgrid/ui exec vitest run ...EventCard.test.tsx ...EventCardCompact.test.tsx` initially failed on an unrelated pre-existing issue (`@festgrid/domain` had no built `dist/`, so Vite couldn't resolve `@festgrid/domain/geolocation`); fixed by running `pnpm --filter @festgrid/domain build` once (also reproduced on the pre-story baseline via `git stash`, confirming it's not caused by this story).

### Completion Notes List

- Deleted `EventCardMediaSlot`'s two dead favorite-badge branches (with-image corner pill, reserved-blank large fallback) and the five now-unused props (`isFavorited`, `favoriteCount`, `onFavoriteToggle`, `labels`, `hideFavoriteBadge`) from both `EventCardMediaPrimitives.tsx` and `EventCardMediaPrimitives.types.ts`, per the story's Reference Implementation (AC1, AC2).
- Updated both production call sites (`EventCard.tsx`, `EventCardCompact.tsx`) to stop passing the removed props, and updated `EventCardCompact.tsx`'s two inline comments to describe the new reality instead of citing the now-landed tracker item (AC3). `EventCard.test.tsx`/`EventCardCompact.test.tsx` re-run unmodified, 87/87 passing — confirms byte-for-byte identical rendered output at both call sites.
- Rewrote/trimmed `EventCardMediaPrimitives.test.tsx` exactly per the story's Reference Implementation: dropped the `within`/`EVENT_CARD_BADGE_MIN_TOUCH_REM` imports, re-pointed the one AC2 sub-test at `EventCardFavoriteBadge` directly, merged/rewrote the AC3 fallback-block tests to assert on the slot's own root element instead of a button, deleted the entire slot-owned "AC4" describe block (replaced with a retirement comment), trimmed the `hideFavoriteBadge` tests out of the `additive props` block (renamed to `additive props (onImagePresenceChange, Story 1.i1e)`), and dropped `onFavoriteToggle` from all four `collapseOnFallback` tests. Full file re-verified at 84/84 passing (AC4). One care point during this edit: the pre-existing file has a documented brace-nesting quirk where the `EventCardMediaSlot fallback - AC3` describe block's own closing brace never appears until much later in the file (it's left open through what used to be the AC4/AC5/additive-props/collapseOnFallback/EventCardDateBox blocks) — verified with a small Node brace-counting script against both the original and edited file that this story's edit preserves the exact same (pre-existing, harmless) nesting shape rather than introducing a new imbalance.
- Fixed the one stale `hideFavoriteBadge`-naming comment in `packages/visual-audit/manifests/event-card-date-box-sizing.ts`'s `FIXTURE_IMAGE_DATA_URI` header (AC5); confirmed comment-only via read-through and `pnpm --filter @festgrid/visual-audit lint`.
- Task 5/6/7 (amending Stories 1.i1a/1.i1e/1.i1m's ACs, Architecture Spine AD-15 Rule 4, and Story 1.i1z's Change Log) required **no edits**: re-reading every target file at implementation time found all of the specified annotations/rewording/Change Log entry already present, word-for-word matching the story's own "exact wording" blocks, with `git status`/`git diff` confirming zero pending changes to any of them. This is recorded here rather than silently skipped, per this workflow's "no silent drift" principle — the docs were evidently already brought current (by an earlier pass of this same story's own authoring/validation work) before this dev-story session began.
- Verification (Task 8): full target-file vitest run (84/84), both consumer test files unmodified (87/87), `@festgrid/ui` lint clean, `@festgrid/visual-audit` lint clean. `tsc --noEmit` could not be used as specified (pre-existing, unrelated environment failure — see Debug Log); lint + the full test suite serve as this story's compile-clean proof instead, and are explicitly noted as such rather than silently substituted.
- No file outside `packages/ui`, `packages/visual-audit`, and this story's own tracking files was touched (AC11, DoD, Task 8.5).

### File List

- Modified: `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`
- Modified: `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts`
- Modified: `packages/ui/src/features/events/EventCard.tsx`
- Modified: `packages/ui/src/features/events/EventCardCompact.tsx`
- Modified: `packages/ui/src/features/events/EventCardMediaPrimitives.test.tsx`
- Modified: `packages/visual-audit/manifests/event-card-date-box-sizing.ts`
- Modified: `_bmad-output/implementation-artifacts/1-i1p-remove-eventcardmediaslots-unused-internal-favorite-badge.md` (this story file — frontmatter `baseline_commit`, Tasks/Subtasks, Dev Agent Record, Status)
- Modified: `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions: ready-for-dev → in-progress → review)
