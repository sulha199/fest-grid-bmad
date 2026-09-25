---
baseline_commit: fb50c887
---

# Story 1.i1n: Fix EventCardDateBox overflow on word/time content

## Story Details

- Epic: 1.i1 (One card primitive for every event-card image slot and badge)
- Story ID: 1.i1n
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `EventCardDateBox`'s day slot (`packages/ui/src/features/events/EventCardMediaPrimitives.tsx`) to render word/time content ("Today"/"Tomorrow"/"Yesterday"/a time string like "3:00 PM") without overflowing or clipping its card — instead of its current bare `text-5xl`/`text-3xl font-extrabold leading-none` treatment, sized only for a 1-2 digit numeric day-of-month, with no `max-width`/`whitespace-nowrap`/word-variant handling,
so that the whole card stops overflowing/clipping in production for the (majority-of-the-time) relative-date states — confirmed by this session's own visual-fidelity audit to overflow the entire 175px mobile masonry card by ~107px for "Tomorrow" — a real, user-visible layout break, not a cosmetic mismatch, and unrelated to (not covered by) backlog `IDEA-046`/Stories `1.i1l`/`1.i1m`, which fixed seven other prototype-fidelity gaps but never touched `dayClasses`.

## Acceptance Criteria

1. **Given** `EventCardDateBoxProps` today only exposes `size: 'default' | 'compact'` (no signal of whether `day`'s content is a short number or a longer word/time string), **when** this story ships, **then** `EventCardDateBoxProps` gains a new optional prop `dayVariant?: 'number' | 'word'` (default `'number'` — back-compat for any caller that omits it, matching this file family's established explicit-prop convention, e.g. Story 1.i1k's `size`, Story 1.i1m's `collapseOnFallback`). `EventCardDateBox` does not infer this from `day`'s rendered content (it stays a caller-formatted `ReactNode`, per this component's existing "no date/locale logic reimplemented here" contract) — the caller already knows which branch of its own formatter fired.
2. **And** when `dayVariant === 'word'`, the day slot (`data-event-card-date-box-day`) renders at a smaller, word-safe font-size (down from the numeric case's `text-5xl`/`text-3xl`) that fits every real word/time content variant — "Today", "Tomorrow", "Yesterday", and a locale-formatted time string (e.g. "3:00 PM", "15:00") — within the date box's real rendered width at both the mobile masonry 175px 2-col slot and the calendar compact row's own width, with **no `scrollWidth > clientWidth` overflow and no visual clipping** (Enforced by: AC5's extended `packages/visual-audit` overflow rule — see Dev Notes). The exact font-size/line-height value is an implementation-detail choice for `bmad-dev-story`, gated by that automated check rather than fixed by this story (no DESIGN.md token exists for this content variant — see Dev Notes' Gate 2 finding) — whichever value passes the check is the accepted value; a two-line `line-clamp-2`/wrap treatment is an acceptable fallback only if a single-line size cannot be found that also clears `EXPERIENCE.md`'s 11px legibility floor.
3. **And** when `dayVariant === 'number'` (the default/omitted case), `EventCardDateBox`'s rendered output is **byte-for-byte unchanged** from today — same `text-5xl`/`text-3xl font-extrabold leading-none` classes, same `data-event-card-date-box-day` element shape. Verified via test: every existing `EventCardMediaPrimitives.test.tsx`/`EventCard.test.tsx`/`WeeklyCalendarView.test.tsx` assertion referencing the day slot's classes passes unmodified.
4. **And** both real consumers pass the correct `dayVariant` explicitly, computed from the same branch their existing formatter call already took — no new formatter function, no duplicated branch logic:
   - `EventCard.tsx`'s `isMasonryDefault` branch: `formatShortEventDateTimeParts` is extended to also return a `dayVariant: 'number' | 'word'` discriminant alongside its existing `{ month, day }` (`'word'` for the `dayDiff===0`/`dayDiff===1`/`dayDiff===-1` branches, `'number'` for the real-date fallback branch) — `EventCard.tsx` forwards `dateBoxParts.dayVariant` to `EventCardDateBox`'s new prop, no separate re-derivation of `dayDiff` at the call site.
   - `WeeklyCalendarView.tsx`'s `variant === 'list'` branch: `computeCalendarSegmentDateBoxContent` is extended the same way — `'word'` for the last/only-day branch (which shows a till-label/time pair), `'number'` for the continuing-segment branch (which shows a real end-date month/day) — and `WeeklyCalendarView.tsx` forwards `dateBoxContent.dayVariant` the same way.
5. **And** `packages/visual-audit/manifests/event-card-date-box-react-mount.ts` (which already mounts the real `EventCardDateBox` via a `react-component` `RenderSpec`, including its Clock-icon-when-`hasTime`-and-today rendering path) gains a new sibling manifest entry, `event-card-date-box-overflow.ts`, with an `overflow`-kind rule (AD-26 Rule 5) targeting `formatShortEventDateTimeParts` at `packages/ui/src/features/events/format-event-date.ts`, mounted inside a fixture matching the real 175px mobile masonry card width (`event_card_masonry.max_width`'s `175px` 2-col-slot case, per DESIGN.md), selector `[data-event-card-date-box-day]`. This is a **real, automated, re-runnable AC** — `bmad-dev-story` runs it like any other test, and the story is not `done` until it passes — not a one-off manual before/after screenshot.
6. **And** because `formatShortEventDateTimeParts`'s content-variant space includes a content-bearing **ternary** nested inside its `dayDiff===0` branch's return expression (`hasTime ? formatEventTime(...) : (labels?.today ?? 'Today')`) — a shape `packages/visual-audit/src/content-variants.ts`'s existing `ts-morph` branch walker does not enumerate today (it only walks `if`/`else if`/`else`/`switch` control flow, not a `ConditionalExpression` embedded in a branch's own return value) — `enumerateContentVariants` is extended to also recurse into a `ConditionalExpression` found inside a branch's return expression (an object literal property value, matching this exact shape), yielding two sub-variants (`{label} (true)` / `{label} (false)`) instead of silently collapsing to whichever string literal `extractSampleText` happens to find first. This is a small, generic engine fix (benefits any future formatting function with the same shape), not a one-off hack scoped to this manifest alone. Verified via test: `content-variants.test.ts` gains a fixture function with this exact shape and asserts both sub-variants are enumerated, including a real time-string sample (not just "Today").
7. **And** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`'s AD-26 section gains a one-line "Enforced by" note under Rule 5 (overflow/clipping) citing this story's manifest entry and the `content-variants.ts` ternary-enumeration fix, matching this codebase's own established "Enforced by" citation convention (e.g. Story 1.i1z's AD-15 citations).

## Tasks / Subtasks

- [ ] Task 1: Add `dayVariant` discriminant to both formatter functions (AC1, AC4) — `packages/ui/src/features/events/format-event-date.ts`
  - [ ] 1.1 Extend `formatShortEventDateTimeParts`'s return type to `{ month: string; day: string; dayVariant: 'number' | 'word' }`. `dayVariant: 'word'` for the `dayDiff===0`/`dayDiff===1`/`dayDiff===-1` branches; `dayVariant: 'number'` for the trailing real-date fallback branch. No change to any existing branch's `month`/`day` computation.
  - [ ] 1.2 Extend `computeCalendarSegmentDateBoxContent`'s return type to `{ month: string; day: string; tillLabel: string | undefined; dayVariant: 'number' | 'word' }`. `dayVariant: 'word'` for the last/only-day branch (till-label/time pair); `dayVariant: 'number'` for the continuing-segment branch (real end-date month/day).
  - [ ] 1.3 Update `format-event-date.test.ts`'s existing direct unit tests for both functions to assert the new `dayVariant` field on every branch (extend existing assertions, don't add a parallel duplicate test suite).

- [ ] Task 2: Add `dayVariant` prop to `EventCardDateBox` and the word-safe day style (AC1, AC2, AC3) — `packages/ui/src/features/events/EventCardMediaPrimitives.tsx`, `EventCardMediaPrimitives.types.ts`
  - [ ] 2.1 Add `dayVariant?: 'number' | 'word'` to `EventCardDateBoxProps` (`EventCardMediaPrimitives.types.ts`), documented per AC1 — default `'number'` inside the component when omitted.
  - [ ] 2.2 In `EventCardDateBox`, branch `dayClasses` on `dayVariant` in addition to the existing `size` branch: `dayVariant === 'number'` keeps today's exact `text-5xl`/`text-3xl font-extrabold leading-none` (AC3, byte-for-byte); `dayVariant === 'word'` uses a new, smaller word-safe class pair — start from a candidate (e.g. `text-xl`/`text-base font-extrabold leading-none whitespace-nowrap`) and tune against AC5's overflow check until it passes for every enumerated variant at the real 175px width; do not guess-and-ship without running the check.
  - [ ] 2.3 If AC2's single-line word-safe size cannot clear both the overflow check and `EXPERIENCE.md`'s 11px legibility floor at 175px, fall back to a `line-clamp-2`/`whitespace-normal break-words` two-line treatment for the word variant instead of shrinking further — record which path was taken and why in Dev Notes (do not silently pick one without the comparison).

- [ ] Task 3: Migrate both consumers to pass `dayVariant` explicitly (AC4) — `EventCard.tsx`, `WeeklyCalendarView.tsx`
  - [ ] 3.1 `EventCard.tsx`'s `isMasonryDefault` branch: add `dayVariant={dateBoxParts.dayVariant}` to its existing `<EventCardDateBox size="default" month={...} day={dateBoxParts.day} tillLabel={...} />` call. Confirm (via `git diff`) the `prominentPoster=true` overlay branch (not using `EventCardDateBox` at all) is untouched.
  - [ ] 3.2 `WeeklyCalendarView.tsx`'s `variant === 'list'` branch: add `dayVariant={dateBoxContent.dayVariant}` to its existing `<EventCardDateBox size="compact" month={...} day={...} tillLabel={...} />` call. Confirm (via `git diff`) the `variant === 'grid'` branch is untouched.

- [ ] Task 4: Extend `packages/visual-audit`'s ternary-enumeration gap (AC6) — `packages/visual-audit/src/content-variants.ts`, `packages/visual-audit/content-variants.test.ts` (or wherever this package's existing `tsx --test` suite for this file lives — confirm exact path before adding)
  - [ ] 4.1 In `enumerateContentVariants`'s branch-collection walk, when a branch's terminal `ReturnStatement`'s expression is (or contains, at the top level of an object-literal property value) a `ConditionalExpression`, emit two variants instead of one: `${label} (true)` sourced from the ternary's `whenTrue` sub-expression text, `${label} (false)` from `whenFalse` — reusing the existing `extractSampleText` literal-extraction logic on each sub-expression's own text rather than the whole branch's return-expression text.
  - [ ] 4.2 Add a fixture function to `content-variants.test.ts` mirroring `formatShortEventDateTimeParts`'s exact `dayDiff===0` branch shape (`return { month: '', day: hasTime ? formatEventTime(...) : (labels?.today ?? 'Today') };`) and assert both `(true)`/`(false)` sub-variants are enumerated, with the `(false)` sub-variant's sample text being `'Today'` and the `(true)` sub-variant falling back to `content-variants.ts`'s existing `DEFAULT_SAMPLE_TEXT_FALLBACK` representative-length placeholder (no string literal exists in the `formatEventTime(...)` call itself — matching this file's own existing, already-accepted "no literal → representative placeholder" behavior, not a regression).
  - [ ] 4.3 Run this package's existing test command for `content-variants.ts` (confirm exact script from `packages/visual-audit/package.json` before assuming `tsx --test` vs. Vitest — this package's own Testing Rules tier, per `project-context.md`'s Meta-Testing/Tooling Packages section, established in Story 0.44) and confirm all existing + new assertions pass.

- [ ] Task 5: Add the new overflow manifest entry (AC5) — `packages/visual-audit/manifests/event-card-date-box-overflow.ts`
  - [ ] 5.1 New manifest entry, sibling to `event-card-date-box-react-mount.ts`, `mode: 'rule'`, `viewport: { width: 175, height: 160 }` (the real mobile 2-col masonry slot width, per DESIGN.md `event_card_masonry.max_width`'s own documented 175px case — not an arbitrary width).
  - [ ] 5.2 `rules: [{ kind: 'overflow', selector: '[data-event-card-date-box-day]', formattingFunction: { filePath: 'packages/ui/src/features/events/format-event-date.ts', functionName: 'formatShortEventDateTimeParts' }, buildFixtureHtml }]`. `buildFixtureHtml(variantLabel)` renders the real `EventCardDateBox` via `react-dom/server`'s `renderToStaticMarkup` (mirroring `render.ts`'s own `renderReactComponentToHtml` pattern — reuse it if it's exported, don't hand-roll a second copy) with `size="default"`, `day={variantLabel}`, `dayVariant` set correctly per the variant's own branch (word variants → `'word'`, the fallback variant → `'number'`) so the fix under test actually applies per-variant, not a fixed guess.
  - [ ] 5.3 Register the entry (`registerManifestEntry`) and add it to `packages/visual-audit/manifests/index.ts`'s existing registration list (confirm this file's exact registration mechanism before assuming — read it first).
  - [ ] 5.4 Run this package's own proof-manifest execution path (however `event-card-date-box-react-mount.ts`'s sibling entries are currently run — confirm the exact command from this package's own README/`package.json` before assuming) and confirm the new entry passes against the Task 2/3 fix, and that it would have failed against the pre-fix `text-5xl`/`text-3xl`-only code (verify this directly — temporarily revert Task 2's `dayVariant` branch, confirm the check fails with a real overflow message, then re-apply — don't just trust that it *would* fail).

- [ ] Task 6: Architecture Spine citation (AC7) — `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
  - [ ] 6.1 Under AD-26 Rule 5's overflow/clipping bullet, append a short "Enforced by" note citing `event-card-date-box-overflow.ts` and the `content-variants.ts` ternary-enumeration extension, matching Story 1.i1z's AD-15 citation style (small, factual, not a rewrite of the rule's own text).

- [ ] Task 7: Full verification and record-keeping
  - [ ] 7.1 Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `tsc --noEmit` for `packages/ui`; confirm no new failures (this package's `tsc --noEmit` has pre-existing unrelated errors per Story 1.i1k's Dev Notes — diff before/after, don't assume a clean baseline).
  - [ ] 7.2 Run `packages/visual-audit`'s own test/manifest-verification commands (Task 4.3, Task 5.4).
  - [ ] 7.3 Confirm (via `git diff`) no `packages/domain`, GraphQL, or `apps/backend` files were touched.
  - [ ] 7.4 Record Dev Agent Record (File List, test results, lint/build status).

## Dev Notes

- **Files read in full before drafting this story:**
  - `packages/ui/src/features/events/EventCardMediaPrimitives.tsx` — full file read. `EventCardDateBox` (lines ~278-299) is the exact component this story modifies; confirmed today's `dayClasses` is a flat `size`-only ternary with no word/number distinction.
  - `packages/ui/src/features/events/EventCardMediaPrimitives.types.ts` — full file read. `EventCardDateBoxProps` (lines ~131-142) confirmed as the exact interface Task 2.1 extends.
  - `packages/ui/src/features/events/format-event-date.ts` — `formatShortEventDateTimeParts` (lines ~355-379) read in full; confirmed its exact `dayDiff` branch structure (the basis for Task 1.1's `dayVariant` discriminant and Task 4's ternary-enumeration gap finding).
  - `packages/visual-audit/src/manifest.ts`, `engine.ts`, `render.ts`, `rules/overflow.ts`, `content-variants.ts` — all read in full. Confirmed `OverflowRule.buildFixtureHtml`'s exact signature (`(variantLabel: string) => string`, synchronous, called directly by `runOverflowRule` — not routed through the entry's own `render` spec), `enumerateContentVariants`'s exact `ts-morph` walk (confirmed it only recurses into `IfStatement`/`Block`/`SwitchStatement` nodes, never a `ConditionalExpression` — the exact gap AC6/Task 4 fixes), and `render.ts`'s `renderReactComponentToHtml` helper (currently module-private to `render.ts`; Task 5.2 should check whether exporting it is warranted vs. a small local re-implementation in the manifest, following whichever pattern `event-card-date-box-react-mount.ts` itself already uses for its own `react-component` render).
  - `packages/visual-audit/manifests/event-card-date-box-react-mount.ts` — full file read (the story's dispatching brief's own cited example). Confirmed it already mounts the real `EventCardDateBox` via `@festgrid/ui/event-card-media-primitives`, resolving the lucide-react/Playwright-JSX interop bugs that previously blocked mounting this exact file — Task 5's new entry can reuse the same import path and mounting approach without re-solving those bugs.
  - `packages/visual-audit/manifests/masonry-column-width-invariant.ts` — read as the package's own `mode: 'rule'` precedent (no golden reference, hand-declared expected structure).
  - `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` AD-26 (full section, lines 1143-1267) — Rule 5's exact overflow/clipping wording, cited verbatim in this story's AC2/AC5/AC6.
  - `design-artifacts/UX-festgrid-run-1/DESIGN.md` — `event_card_date_box.base_default` token (month/day classes) and `event_card_masonry.max_width` (`"max-w-[230px]"`, with the mobile 2-col slot's real 175px width documented in the token's own comment) both confirmed — cited in AC2/AC5.
  - `_bmad-output/implementation-artifacts/1-i1k-give-eventcarddatebox-the-design-specified-two-tier-chrome.md`, `1-i1z-...md` — read for this epic's established house style (explicit-prop-over-inference convention, "Enforced by" citation pattern, `data-event-card-date-box*` attribute-selector convention already on the component).
  - `_bmad-output/planning-artifacts/event-pages-dev-story-tracking.md` — "Known conflicts for any new event-card story" section (this story's own origin note) read in full; see "1.3k sequencing" below.
  - `_bmad-output/implementation-artifacts/backlog.yaml` `BUG-040` — full entry read; this story's motivating bug report.

- **HIL-shaped decision made directly, not escalated (recorded per the workflow's own allowance for a mechanically-necessary call, not a genuine product ambiguity):** AC6/Task 4's `content-variants.ts` ternary-enumeration extension. The story's own dispatching brief explicitly required the AC to cover "a time string" as a real, ts-morph-derived content variant — but `enumerateContentVariants`'s current walker cannot produce that variant at all (it only walks `if`/`else`/`switch` control flow, never a `ConditionalExpression` nested inside a branch's return value, which is exactly how `formatShortEventDateTimeParts`'s `hasTime ? ... : ...` is shaped). Two options existed: (a) extend the shared engine generically (chosen — small, reusable by any future formatter with the same shape, keeps AD-26 Rule 5's "derived via static analysis, not hand-authored fixtures" promise honest for this exact case) or (b) hand-fake a second manifest entry/fixture specifically for the time-string case, bypassing the ts-morph enumeration for that one variant (rejected — would silently violate AD-26 Rule 5's own stated method and just relocate the blind spot rather than closing it). Chosen directly because the brief's own explicit requirement leaves no real alternative that still satisfies "a real, ts-morph-driven... enumeration," not because this was treated as a low-stakes implementation detail matter-of-course.
- **HIL-shaped decision made directly, not escalated:** the exact word-safe font-size value (AC2/Task 2.2/2.3) is deliberately left unfixed by this story, gated by the automated overflow check instead of a guessed literal — because no DESIGN.md token exists for this content variant (confirmed: DESIGN.md's `event_card_date_box` tokens document only the numeric case) and Gate 2's fresh review (below) explicitly found this is not a "spec exists but wasn't followed" gap needing a UX pass, but a genuine void a mechanically-verifiable check is better positioned to close than a second guess would be.

### Architecture & UX Gate Findings

*(`epic-1-i1-readiness.md` is `swept: true` but its `stories_covered` list — 1.i1a-1.i1e, 1.i1z — predates this story, matching the same situation Stories 1.i1k/1.i1l/1.i1m/1.i1z already handled by citing the sweep plus a fresh lightweight guard, rather than re-running Gate 1/3 from scratch.)*

- **Gate 1 (Architecture/Infrastructure Completeness) — NO GAP**, cited from `epic-1-i1-readiness.md`'s sweep and reconfirmed directly: this story is pure `packages/ui` presentational work (a new prop, a font-size branch) plus a small, self-contained fix to `packages/visual-audit`'s own tooling internals (a meta-testing/tooling-tier package per `project-context.md`'s Testing Rules, Story 0.44) — no resolver/query/mutation, no DB/domain/external-service call, no new API surface. The `packages/visual-audit` change is a bug fix to existing static-analysis logic, not new infrastructure requiring its own IaC/deploy story.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — NO GAP**, cited from `epic-1-i1-readiness.md`'s sweep; independently reconfirmed no new global-shell/i18n-foundation/analytics/codegen dependency is introduced. The `content-variants.ts` fix generalizes an already-established mechanism (AD-26 Rule 5's ts-morph branch walker) rather than introducing a new one.
- **Gate 2 (UI Complexity & Reusability, Freya persona, run fresh via subagent) — NO SPLIT.** Verbatim verdict: "This is correctly scoped as a single, contained story within Epic 1.i1's existing pattern. `dayVariant?: 'number' | 'word'` is the same shape as Story 1.i1k's `size` and 1.i1m's `collapseOnFallback` — an optional, caller-supplied prop on an already-adopted primitive, with both real call sites already possessing the exact information needed to pass it... The absence of a locked [DESIGN.md] token for the word-variant font-size is real, but it's not a 'spec exists elsewhere and got dropped' gap — DESIGN.md's silence here isn't an oversight to reconcile, it's a genuine void (this content variant was never prototyped, which is why the bug shipped)... the engineer's guess is mechanically falsifiable via the extended overflow rule... except unlike a designer's guess, that's exactly the kind of implementation-detail call this project already delegates to automated verification rather than a fresh UX pass... No carve-out candidates: the manifest extension is additive to existing tooling (not new infra), the prop is additive to an existing interface, and the value tuning is bounded and testable in-story." Full transcript available on request; not reproduced in full here per this workflow's token-efficiency guidance.

### 1.3k sequencing (resolved, not just flagged)

`event-pages-dev-story-tracking.md`'s "Known conflicts for any new event-card story" section flagged exactly this risk in advance: Story `1-3k-render-day-of-week-recurring-schedules-and-repeat-badge` is `ready-for-dev`, not yet started, and its own `epics.md` `Depends on:` line names "Story 1.i1a-e (the shared `EventCardMediaPrimitives.tsx` primitives this story adds to)" while its own AC touches `EventCard.tsx`/`WeeklyCalendarView.tsx` regression tests across those same shared primitives this story also touches (`EventCardDateBox`, `EventCard.tsx`, `WeeklyCalendarView.tsx`). **Resolved as part of this story's own creation** (not left as a flagged risk): `epics.md`'s Story 1.3k section's `Depends on:` line is amended in this same commit to add `1-i1n` (see the corresponding `epics.md` diff), and `event-pages-dev-story-tracking.md`'s "Known conflicts" section is updated to record this as resolved via an actual dependency declaration. This story (`1.i1n`) should land and reach at least `review` before `1-3k`'s `bmad-dev-story` is dispatched.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: `EventCardDateBoxProps` gains an optional `dayVariant` field (internal `packages/ui` component prop interface, 2 in-repo consumers, both migrated in this same story); `formatShortEventDateTimeParts`'s and `computeCalendarSegmentDateBoxContent`'s return types each gain a `dayVariant` field (both are internal `packages/ui` function return shapes, not GraphQL/DB contracts). `packages/visual-audit`'s `OverflowRule`/`ManifestEntry` types are unchanged (this story adds a new manifest entry and a `content-variants.ts` internal fix, not a type-shape change to the engine's public interfaces).
- Required DB migration changes: No changes required — no DB/GraphQL schema touched by this story.
- Required TypeScript type changes: as listed above — all additive, all internal to `packages/ui`/`packages/visual-audit`, no generated-type or resolver impact.
- Backward compatibility and rollout notes: `dayVariant`'s default (`'number'`) preserves today's exact rendered output for any caller that omits it (AC3); both real call sites are migrated in the same commit (Task 3), so no transitional mixed-state window exists.
- Verification checks: Task 1.3's unit tests, Task 4.2's `content-variants.test.ts` fixture, Task 5's overflow-manifest run (including the deliberate pre-fix-must-fail check, Task 5.4), Task 7's full `packages/ui`/`packages/visual-audit` test/lint/typecheck.

### Project Structure Notes

- Modifies: `packages/ui/src/features/events/{EventCardMediaPrimitives.tsx, EventCardMediaPrimitives.types.ts, format-event-date.ts, EventCard.tsx, WeeklyCalendarView.tsx, format-event-date.test.ts}`; `packages/visual-audit/src/content-variants.ts` and its test file; `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (small AD-26 citation); `_bmad-output/planning-artifacts/epics.md` (this story's own section + the 1.3k `Depends on:` amendment); `_bmad-output/planning-artifacts/event-pages-dev-story-tracking.md` (Known-conflicts resolution note).
- New files: `packages/visual-audit/manifests/event-card-date-box-overflow.ts`.
- No `packages/domain` involvement (pure `packages/ui` presentational work plus a `packages/visual-audit` tooling-tier fix, matching this epic's own established precedent).
- No state management, no async/loader classification, no analytics/i18n/cloud-service change — this story adds no user-triggered flow, no new tracked interaction, no new user-facing string beyond content already rendered today.

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Components rule (`packages/ui/src/features/events` placement, no new `packages/domain` logic); Meta-Testing/Tooling Packages testing tier (Story 0.44) governs the `packages/visual-audit` changes (Task 4's `tsx --test`-pattern unit test, qualitative coverage bar); Locale-Sensitive Data Rendering rule unaffected (no new date/locale formatting is introduced — `dayVariant` is a styling discriminant, not a formatting change).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — no PRD feature/constraint change; this is a targeted bug fix to an already-shipped UI primitive.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-15 (Event Card Media Primitive, the component this story extends) and AD-26 (Visual-Fidelity Audit Tool, this story's own verification mechanism and the motivating source of the bug itself) — Task 6 keeps AD-26's Rule 5 citation current.
- [x] `docs/infrastructure/index.md` — not applicable; no backend/infra/queue/deploy layer touched by this story (frontend `packages/ui` + a tooling-package fix only).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:** `packages/ui/src/features/events/{EventCardMediaPrimitives.tsx, EventCardMediaPrimitives.types.ts, format-event-date.ts, EventCard.tsx, WeeklyCalendarView.tsx, format-event-date.test.ts}`; `packages/visual-audit/src/content-variants.ts` + its existing test file; `packages/visual-audit/manifests/{event-card-date-box-overflow.ts (new), index.ts}`; `_bmad-output/planning-artifacts/{festgrid-architecture-spine.md, epics.md, event-pages-dev-story-tracking.md}`.
- **Rule Mapping:** AD-15 → Tasks 2-3 (the primitive's own `dayVariant` prop and both consumers' migration); AD-26 Rule 5 → Tasks 4-6 (the overflow check itself, the ts-morph engine fix, and the spine citation); project-context.md's Meta-Testing/Tooling Packages tier → Task 4's test approach for `packages/visual-audit`; project-context.md's UI Components rule → all `packages/ui` changes stay inside `packages/ui/src/features/events/`, no `packages/domain` leakage.
- **Verification Plan:** Task 1.3/Task 4.2's unit tests green; Task 5.4's overflow-manifest run passing post-fix and confirmed failing pre-fix (a real red/green proof, not an assumed one); Task 3's `git diff` confirming both consumers migrated and their untouched sibling branches (`prominentPoster=true`, `variant === 'grid'`) stay byte-for-byte unchanged; Task 7's full `packages/ui`/`packages/visual-audit` test/lint/typecheck clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: fix `EventCardDateBox`'s day-slot overflow for word/time content via a new caller-supplied `dayVariant` prop, migrate both real consumers, extend `packages/visual-audit`'s overflow-check manifest and its `ts-morph` ternary-enumeration gap, and amend `epics.md`/`event-pages-dev-story-tracking.md`'s Story 1.3k sequencing note — no new component, no DESIGN.md token authored (none exists for this content variant), no `packages/ui`-wide changes beyond this one primitive and its two call sites.
- [ ] Architecture and boundary confirmation: no `packages/domain`/GraphQL/`apps/backend` changes; `packages/visual-audit` changes are confined to its own tooling-tier internals (`content-variants.ts` + a new manifest entry), not a public-API-shape change to `manifest.ts`'s exported types.
- [ ] Testing plan confirmation: Task 1.3/4.2's unit-test extensions and Task 5's overflow-manifest addition reviewed, including the explicit pre-fix-must-fail verification step (Task 5.4) that proves the check is real, not trivially passing.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: **NO GAP on all three** (Gate 1/3 cited from the swept `epic-1-i1-readiness.md` sweep plus a fresh lightweight guard; Gate 2 run fresh, verdict NO SPLIT — see Dev Notes for the full verbatim finding). No new prerequisite story was created by this story's own gates.
- [ ] 1.3k sequencing confirmed: `epics.md`'s Story 1.3k `Depends on:` line now names `1-i1n`; this story should reach at least `review` before `1-3k`'s `bmad-dev-story` is dispatched.
- [ ] Explicit human approval state (Default: pending approval).

## Testing Requirements

- [ ] Unit tests (Vitest) — `format-event-date.test.ts` (Task 1.3): `dayVariant` asserted on every branch of both extended functions.
- [ ] Unit tests (`tsx --test`, meta-testing/tooling tier per Story 0.44) — `content-variants.test.ts` (Task 4.2): ternary-enumeration fixture, both sub-variants asserted.
- [ ] Integration/component tests (Vitest + Testing Library) — `EventCardMediaPrimitives.test.tsx` (new `dayVariant`-branch assertions, AC2/AC3), `EventCard.test.tsx`/`WeeklyCalendarView.test.tsx` (regression-only, confirm existing day-slot assertions pass unmodified for the `'number'` default).
- [ ] Visual-audit rule execution — `packages/visual-audit`'s own manifest-run command against `event-card-date-box-overflow.ts` (Task 5.4), including the explicit red-then-green proof.
- [ ] E2E tests — Not introduced by this story, matching this epic's own testing-trophy precedent: component-level + tooling-level coverage is the testing-trophy-appropriate level for this presentational fix; no user-facing flow/route changes.

## Deliverables Checklist

- [ ] `EventCardDateBox` renders every real content variant (numeric day, "Today", "Tomorrow", "Yesterday", a time string) without overflow/clipping at the real mobile masonry (175px) and compact-row widths.
- [ ] `dayVariant='number'` (default) path byte-for-byte unchanged from today's shipped output.
- [ ] Both real consumers (`EventCard.tsx`, `WeeklyCalendarView.tsx`) pass `dayVariant` explicitly, computed from their existing formatter's own branch (no duplicated branch logic).
- [ ] `packages/visual-audit`'s `content-variants.ts` now enumerates a ternary nested inside a branch's return expression (generic engine fix, not a one-off hack).
- [ ] New `event-card-date-box-overflow.ts` manifest entry registered, passing post-fix, confirmed failing pre-fix.
- [ ] `festgrid-architecture-spine.md` AD-26 Rule 5 gains an "Enforced by" citation.
- [ ] `epics.md`'s Story 1.3k `Depends on:` line amended to add `1-i1n`; `event-pages-dev-story-tracking.md`'s Known-conflicts note updated to reflect the resolved dependency.
- [ ] Full `packages/ui`/`packages/visual-audit` test/lint/typecheck green.

## Out of Scope

- **A DESIGN.md token for the word/time-content day-slot treatment.** No prototype ever depicted this content variant (that's why the bug shipped); Gate 2 explicitly found this is not a missing-spec gap needing its own UX pass — the value is chosen and verified mechanically by this story's own overflow check instead.
- **`EventCard.tsx`'s `prominentPoster=true` overlay branch and `WeeklyCalendarView.tsx`'s `variant === 'grid'` path.** Neither uses `EventCardDateBox` — unaffected by this story, matching Story 1.i1k/1.i1z's own established scope boundary for this file family.
- **A full `fixtures.mount()`-backed Playwright stories/gallery pipeline for `packages/visual-audit`.** This story extends the existing `react-component`/`isolated-html` render backends (Story 0.43's own documented, accepted approach) — not a new rendering mechanism.
- **i18n string-length variance for the word/time content** (e.g. how a non-English "Tomorrow" translation of different length behaves). AD-26 Rule 5 explicitly accepts this as a known, unsolved blind spot — this story does not attempt to close it.
- **Retroactively auditing every other `packages/visual-audit` manifest/formatter for the same ternary-enumeration gap.** Task 4 fixes the engine generically (so any *future* manifest benefits), but auditing/backfilling every existing manifest against the newly-capable enumerator is a separate, unbounded-scope sweep not undertaken here.

## Definition of Done

- [ ] AC 1-7 satisfied.
- [ ] Required tests passing (Task 1.3, 4.2, 5.4, 7.1-7.2).
- [ ] Lint and type checks passing for `packages/ui` and `packages/visual-audit`.
- [ ] Story status updated to `review` in this file and in `sprint-status.yaml`.

## Completion Status

Story drafted via `bmad-create-story` (2026-09-25) from backlog `BUG-040`. Not yet implemented.

## Dev Agent Record

### Agent Model Used

_To be filled by `bmad-dev-story`._

### Debug Log References

_To be filled by `bmad-dev-story`._

### Completion Notes List

_To be filled by `bmad-dev-story`._

### File List

_To be filled by `bmad-dev-story`._

## Change Log

- 2026-09-25: Story created via `bmad-create-story` from backlog `BUG-040` (found by this session's own `packages/visual-audit` — Story 0.43 — audit of the event-card family). Gate 1/3 cited from `epic-1-i1-readiness.md`'s sweep plus a fresh lightweight guard (no new gap found); Gate 2 run fresh via subagent (Freya persona) — verdict NO SPLIT. Story 1.3k's `epics.md` `Depends on:` line amended to add this story; `event-pages-dev-story-tracking.md`'s Known-conflicts note updated to record the resolution. `backlog.yaml`'s `BUG-040` row updated with `stories: [1-i1n-fix-eventcarddatebox-overflow-on-word-time-content]`, status re-derived to `promoted`.
