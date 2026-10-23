---
baseline_commit: 4e2663e35ee0efdeed36dbe79fee3444757bd6fe
---

# Story 9.6: Show long expression summaries in the AI filter overlay and FilterHub

## Story Details

- Epic: 9
- Story ID: 9.6
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a long summary to stay readable in FilterHub's single collapsed row,
so that complex prompts do not break the layout.

## Acceptance Criteria

1. **AC1 — FilterHub's collapsed AI-filter row stays one row, with truncate and expand, and caveats always visible (epics.md AC1):** Given an active AI filter whose rendered summary (Story 9.5's `renderFilterExpressionSummary`) is long (a non-flat/grouped expression typically renders longer than a flat one), when `FilterHub` renders its collapsed AI-filter layout (`FilterHub.tsx:77-113`), then:
   - By default the summary text is single-line, clipped with an ellipsis (CSS truncate) — it never wraps the row onto multiple lines or grows the row's height, regardless of how long the underlying sentence is.
   - A "Show more" control appears **only when the summary text is actually long enough that it could be clipped** (a fixed character-count heuristic, mirroring this codebase's own existing precedent for this exact problem — see Dev Notes); clicking it reveals the full, un-clipped text (the row may then grow beyond one line — expected, since the user asked to see everything) and the control's label switches to "Show less"; clicking again re-collapses.
   - This new toggle is functionally and visually distinct from the pre-existing "Edit / Expand" button (`onAIExpand`/`aiExpandLabel`, which converts the active AI filter back into manual FilterHub controls) — they must never be confused in naming, copy, or behavior (see Dev Notes decision 1).
   - The caveats text (`aiCaveatsText`) is never subject to the truncate/expand treatment — it renders in full at all times, collapsed or expanded, exactly as it does today.
   - Both the new "Show more"/"Show less" labels are sourced via `next-intl` (`FilterHub` namespace, `en`/`id`) — never hardcoded strings — matching `project-context.md`'s Locale-Sensitive Data Rendering rule.

2. **AC2 — the overlay gains example prompts (including one grouped example) and the existing "too complex" caveat is proven to reach the user (epics.md AC2):** Given a user viewing `AIFilterOverlay` before any prompt has resolved, when the overlay renders, then:
   - A short, static list of example prompts appears near the textarea (new content — none exists today beyond a single disappearing placeholder string), sourced via `next-intl` (`FilterHub` namespace, `en`/`id`) exactly like every other overlay string.
   - Exactly one of the examples is a grouped (AND/OR/NOT) prompt — reusing the SPEC's own CAP-6 worked example, "jazz or blues in Sleman or Bantul this weekend, not workshops" — so a user discovers the grouped-prompt capability without reading documentation.
   - Clicking an example fills the textarea with that example's exact text (and focuses it) — it does **not** auto-submit; the user can still edit before submitting, consistent with the existing "always a focused overlay, no silent action" convention.
   - Submitting a prompt that exceeds Story 9.1a's node/depth limits still surfaces Story 9.4's existing, unchanged caveat text ("Your prompt described more conditions than the filter supports, so some were dropped.") in the overlay's existing amber caveat block (`AIFilterOverlay.tsx:181-185`) — this AC is about **proving the existing end-to-end path still works and is covered by a test**, not about adding a new caveat-type-specific visual style (see Dev Notes decision 3 for why no new per-caveat styling is introduced).

3. **AC3 — no UI path to edit a saved filter is introduced (epics.md AC3):** This story touches only `FilterHub.tsx`, `AIFilterOverlay.tsx`, `use-ai-filter.ts`, and the three Discovery/Feed/Favorites call sites' label wiring — it does not touch `ai-filters-content.tsx` ("My AI Filters") or any saved-filter read/write path at all, so the SPEC's permanent "re-prompt is the only way to change a filter" stance (CAP-3) is preserved trivially, by not being in scope.

**Depends on:** Story 9.4, Story 9.5 (both `review`/implemented — see Previous Story Intelligence).

## Tasks / Subtasks

- [x] 1. **(AC1)** In `packages/ui/src/features/events/FilterHub.tsx`, inside the `if (aiFilterSummary)` collapsed-layout branch (lines 77-113):
  - Add a module-local constant and a local `isSummaryExpanded` state:
    ```ts
    /** Fixed character-count heuristic for "is this summary long enough to need truncation" --
     * mirrors this codebase's own existing precedent for the same problem (no real
     * scrollWidth/clientWidth overflow measurement exists anywhere in this repo either --
     * see Dev Notes decision 2). Approximate by design, not pixel-exact. */
    const AI_SUMMARY_TRUNCATE_THRESHOLD = 70;
    ```
    ```tsx
    const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(false);
    const summaryHasMore = (aiFilterSummary?.length ?? 0) > AI_SUMMARY_TRUNCATE_THRESHOLD;
    ```
  - Change the summary `<span>` (today: `<span className="leading-tight">{aiFilterSummary}</span>`) to:
    ```tsx
    <span
      className={
        !isSummaryExpanded && summaryHasMore
          ? 'leading-tight block truncate min-w-0'
          : 'leading-tight'
      }
    >
      {aiFilterSummary}
    </span>
    ```
  - Give the summary's wrapping `<div>` (today: `className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mr-auto"`) `min-w-0 flex-1` so the summary span actually has a bounded width to truncate against inside the outer `flex flex-wrap` row:
    ```tsx
    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium mr-auto min-w-0 flex-1">
    ```
  - Immediately after the `aiCaveatsText` block (still inside the same wrapping `<div>`, so it sits next to the summary, not inside the truncated span — the caveats text is a sibling element and is therefore never clipped), add the new toggle, rendered only when `summaryHasMore`:
    ```tsx
    {summaryHasMore && (
      <button
        type="button"
        onClick={() => setIsSummaryExpanded((prev) => !prev)}
        aria-expanded={isSummaryExpanded}
        className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-semibold shrink-0 whitespace-nowrap"
      >
        {isSummaryExpanded
          ? labels.aiSummaryShowLessLabel || 'Show less'
          : labels.aiSummaryShowMoreLabel || 'Show more'}
      </button>
    )}
    ```
  - Add `aiSummaryShowMoreLabel?: string;` and `aiSummaryShowLessLabel?: string;` to `FilterHubProps['labels']`'s type (alongside the existing `aiTriggerTooltip?`/`aiClearLabel?`/`aiExpandLabel?` keys) — **nested in `labels` only**, deliberately not duplicated as flat top-level override props the way `aiExpandLabel`/`aiClearLabel`/`aiTriggerTooltip` are (see Dev Notes decision 1 for why: that flat-prop duplication is confirmed dead code today — none of the three call sites ever pass it — and a brand-new label has no reason to copy a dead pattern).

- [x] 2. **(AC1, Testing)** Update `packages/ui/src/features/events/FilterHub.test.tsx`:
  - Add a case: render with a long `aiFilterSummary` (e.g. a fixture string over 70 characters, such as the rendered form of the SPEC CAP-6 worked example) and `labels` including `aiSummaryShowMoreLabel: 'Show more'`/`aiSummaryShowLessLabel: 'Show less'`. Assert a `Show more` button exists, the summary `<span>` carries the `truncate` class, clicking it flips the button's accessible name to `Show less` and `aria-expanded` to `true`, and the span no longer carries `truncate`. Click again and assert it reverts.
  - Extend the existing "renders the collapsed AI filter summary layout" test (short `aiFilterSummary="Events about jazz in Work"`, 26 chars) with an explicit assertion that **no** `Show more`/`Show less` button is rendered — locks in the threshold behavior so a future change to the heuristic doesn't silently regress the short-summary case.
  - Add a case proving `aiCaveatsText` stays rendered and unchanged both before and after toggling the new expand control, using a summary long enough to trigger truncation alongside a non-empty `aiCaveatsText` — the literal "caveats remain visible" assertion.

- [x] 3. **(AC2, i18n)** Add new keys to the existing `FilterHub` namespace in **both** `apps/web/locales/en.json` and `apps/web/locales/id.json` (alongside the existing `aiTriggerTooltip`/`aiClearLabel`/`aiExpandLabel`/`aiOverlay*` keys at the same nesting level):
  ```json
  "aiSummaryShowMoreLabel": "Show more",
  "aiSummaryShowLessLabel": "Show less",
  "aiOverlayExamplePromptsLabel": "Try an example:",
  "aiOverlayExamplePrompt1": "free jazz events in Kota Yogyakarta this weekend",
  "aiOverlayExamplePrompt2": "upcoming concerts in the next 7 days",
  "aiOverlayExamplePromptGrouped": "jazz or blues in Sleman or Bantul this weekend, not workshops"
  ```
  Indonesian (`id.json`) equivalents:
  ```json
  "aiSummaryShowMoreLabel": "Tampilkan lebih banyak",
  "aiSummaryShowLessLabel": "Tampilkan lebih sedikit",
  "aiOverlayExamplePromptsLabel": "Coba contoh:",
  "aiOverlayExamplePrompt1": "acara jazz gratis di Kota Yogyakarta akhir pekan ini",
  "aiOverlayExamplePrompt2": "konser yang akan datang dalam 7 hari ke depan",
  "aiOverlayExamplePromptGrouped": "jazz atau blues di Sleman atau Bantul akhir pekan ini, bukan workshop"
  ```
  `aiOverlayExamplePrompt1` reuses the PRD §3.15/SPEC "success signal" canonical v1 example verbatim; `aiOverlayExamplePromptGrouped` reuses the SPEC CAP-6 worked example verbatim (both already used as worked examples elsewhere in this epic's own stories, e.g. Story 9.5's test fixtures) — not newly invented copy.

- [x] 4. **(AC2)** In `packages/ui/src/features/events/AIFilterOverlay.tsx`:
  - Extend `AIFilterOverlayProps`:
    ```ts
    examplePrompts?: string[];
    ```
    and add `examplePromptsLabel?: string;` to the existing `labels` object type (microcopy, alongside `resolvedSummaryTitle`/`rePrompt`).
  - Destructure `examplePrompts` in the component's props.
  - Immediately after the `<textarea>` element (before the `{error && (...)}` block, lines ~166-171), add:
    ```tsx
    {!resolvedSummary && examplePrompts && examplePrompts.length > 0 && (
      <div className="flex flex-wrap items-center gap-2 justify-center">
        <span className="text-xs text-muted-foreground">
          {labels.examplePromptsLabel || 'Try an example:'}
        </span>
        {examplePrompts.map((example) => (
          <button
            key={example}
            type="button"
            disabled={isLoading}
            onClick={() => {
              setPrompt(example);
              textareaRef.current?.focus();
            }}
            className="text-xs rounded-full border border-input px-3 py-1 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    )}
    ```
    Gated on `!resolvedSummary` (not `!resolvedSummary && !isLoading`) so the chips don't disappear mid-request — only their `disabled` state changes — matching the textarea's own `disabled={isLoading || !!resolvedSummary}` pattern one step more granularly (chips are irrelevant, not actively wrong, once a summary exists, so they fully unmount then rather than just disabling, which also keeps the resolved-state layout uncluttered).

- [x] 5. **(AC2, Testing)** Update `packages/ui/src/features/events/AIFilterOverlay.test.tsx`:
  - Add a case: render with `examplePrompts={['prompt one', 'jazz or blues, not workshops']}` and `labels.examplePromptsLabel`; assert both appear as buttons, clicking the second sets the textarea's value to `'jazz or blues, not workshops'` (assert via the textarea's `value`), and the chips are disabled when `isLoading={true}`.
  - Add a case: render with `resolvedSummary` set and `examplePrompts` also passed; assert no example-prompt button is rendered (the `!resolvedSummary` gate).
  - Add a case proving the exact Story 9.4 "too complex" caveat text renders unchanged through the existing amber block: `resolvedCaveats="- Your prompt described more conditions than the filter supports, so some were dropped."` renders verbatim (this is the literal, already-shipped caveat string — see Dev Notes decision 3 for why no new styling is added here).

- [x] 6. **(AC1, AC2, Data Type Compatibility)** In `apps/web/src/features/events/use-ai-filter.ts`:
  - Add a memoized example-prompts list and label, using the same `tFilterHub` instance already used for `overlayLabels`:
    ```ts
    const examplePrompts = useMemo(
      () => [
        tFilterHub('aiOverlayExamplePrompt1'),
        tFilterHub('aiOverlayExamplePrompt2'),
        tFilterHub('aiOverlayExamplePromptGrouped'),
      ],
      [tFilterHub]
    );
    ```
  - Add `examplePromptsLabel: tFilterHub('aiOverlayExamplePromptsLabel'),` to the existing `overlayLabels` object.
  - Add `examplePrompts,` to the returned `overlayProps` object (alongside `labels: overlayLabels`).
  - **No change to `filterHubProps`** is needed in this file — `aiSummaryShowMoreLabel`/`aiSummaryShowLessLabel` reach `FilterHub` via the `labels` object each call site already constructs and passes straight through (Task 7), not via a hook-returned prop, since they're static microcopy, not derived state (consistent with how `aiTriggerTooltip`/`aiClearLabel`/`aiExpandLabel` already reach `FilterHub` today — via `labels`, not `filterHubProps`).

- [x] 7. **(AC1, i18n wiring)** In **each** of the three identical `filterLabels` `useMemo` blocks that already include `aiTriggerTooltip`/`aiClearLabel`/`aiExpandLabel` — `apps/web/src/app/[locale]/home-content.tsx` (~line 173), `apps/web/src/app/[locale]/feed/feed-content.tsx` (~line 91), `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (~line 127) — add two more keys using the same `tFilterHub` instance already in scope in each file:
  ```ts
  aiSummaryShowMoreLabel: tFilterHub('aiSummaryShowMoreLabel'),
  aiSummaryShowLessLabel: tFilterHub('aiSummaryShowLessLabel'),
  ```
  No other change is needed in these three files — `<AIFilterOverlay {...aiFilter.overlayProps} />` already spreads the whole `overlayProps` object (Task 6 added `examplePrompts` to it), and `<EventDiscoveryPanel>`'s `filterLabels={filterLabels}` already forwards the whole `labels` object to `<FilterHub>` unchanged.

- [x] 8. **(AC1, AC2, Testing)** Update the three content files' tests — `home-content.test.tsx`, `feed-content.test.tsx`, `favorites-content.test.tsx` — only if any of them asserts the exact shape of `filterLabels` or the mocked `useAIFilter()` return value (check each file's existing `useAIFilter` mock before assuming a change is needed; if a test mocks `useAIFilter` wholesale, it already supplies its own `overlayProps`/`filterHubProps` shape and needs no edit purely for this story's additive fields unless it does an exact-equality/snapshot assertion on either object).

- [x] 9. **(Verification)** Run `pnpm --filter @festgrid/ui test`/`lint`/`build` (FilterHub/AIFilterOverlay changes) and `pnpm --filter @festgrid/web test`/`lint`/`build` (use-ai-filter.ts, the three content files, and their locale JSON). No `packages/domain` change in this story, so no domain-package command is required, though the existing `turbo` build graph will still build it transitively as a dependency of `apps/web`/`packages/ui`.
  - Run after session resume: `pnpm --filter @festgrid/ui test` (68 files / 911 tests passed), `pnpm --filter @festgrid/ui lint` (clean), `pnpm --filter @festgrid/ui build` (no build script on this package -- it's consumed as source, built transitively via `web`'s own build, consistent with the task's own note). `pnpm --filter web test` (78 files / 649 tests passed -- includes the previously-failing `home-content.test.tsx`/`feed-content.test.tsx`/`favorites-content.test.tsx` 9.4a tests, now green after the hook-hoist fix), `pnpm --filter web lint` (exit 0, only pre-existing unrelated warnings, no errors), `pnpm --filter web build` (succeeded, all 39 routes generated).

## Dev Notes

### Architecture & UX Gate Findings

Per `epic-9-readiness.md` (`swept: true`, 2026-10-14, `stories_covered` includes `9.6`), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide, cited):** "No epic-wide bypass found... The upgrade is confined to `packages/domain` (types/schema/compiler), existing GraphQL resolvers, the existing Gemini transform, and existing UI (`FilterHub`)." Confirmed consistent for this story specifically: it touches only two already-existing `packages/ui` presentational components (`FilterHub.tsx`, `AIFilterOverlay.tsx`), one already-existing `apps/web` hook (`use-ai-filter.ts`), three already-existing page call sites' label wiring, and locale JSON — zero new API surface, zero new resolver, zero new Lambda/queue/IaC, zero new GraphQL operation.
- **Gate 3 (epic-wide, cited):** no new Epic 0/cross-cutting dependency gap found for the epic; this story is exactly the UI-polish layer Gate 3 already anticipated. i18n/analytics/codegen foundations are all pre-existing and already adopted; this story only adds translation keys within the existing `next-intl`/`FilterHub` namespace.
- **Lightweight guard (this story, checked fresh):** does 9.6's actual scope contain anything the epic-wide sweep plausibly didn't anticipate? No — a CSS truncate/expand toggle and a static example-prompt chip list are ordinary `packages/ui` presentational work using mechanisms (the existing `labels` prop pattern, the existing `AIFilterOverlay` local `prompt` state) the epic-wide sweep already accounted for. No Gate 1/3 re-run warranted.
- **Gate 2 (UI Complexity & Reusability, run fresh via `runSubagent`, Freya persona, per this session's explicit dispatch instruction): No gap found.** Freya independently verified (not just cited) against both `DESIGN.md` (read in full — zero AI-filter/FilterHub/truncate/example-prompt content, confirmed by grep) and `EXPERIENCE.md` (Voice and Tone + Component Patterns headings — no AI-filter-adjacent heading, no truncate/expand pattern specified anywhere; the only existing truncate-with-expand precedent anywhere in the repo, `apps/web/src/app/[locale]/moderator/tools/payload-list-item.tsx`'s `isExpanded`/`aria-expanded`/character-count-heuristic pattern, lives in app-only moderator tooling, not `packages/ui`, and reveals a secondary panel rather than doing a one-line CSS clamp — a useful naming/`aria` precedent to mirror, not a component to reuse directly). Verdict against the three heuristics: (1) no reusable component with non-trivial states — the truncate/expand toggle has exactly one consumer (`FilterHub`'s single collapsed-row rendering path, itself used identically by all three Discovery/Feed/Favorites call sites through one shared component instance) and is one boolean + one CSS class, not a complex component; the example-prompt chip list likewise has exactly one consumer (`AIFilterOverlay`); (2) no complex hook/util multiple components depend on — no new hook is introduced, `use-ai-filter.ts`'s change is one more `useMemo` of the same shape as its existing ones; (3) no UX-spec'd visual/interaction detail omitted — confirmed zero relevant content in either artifact. No split, no prerequisite, no `epics.md`/`sprint-status.yaml` change from this gate.

**No gap found by any gate.** This story proceeds as scoped.

### Design decisions (resolved defaults — minimised per this session's dispatch instruction, not left as open questions)

1. **The new truncate/expand toggle is deliberately named and labeled apart from the pre-existing `onAIExpand`/"Edit / Expand" control, and is NOT duplicated into flat top-level override props the way `aiExpandLabel`/`aiClearLabel`/`aiTriggerTooltip` are.** `onAIExpand` (`use-ai-filter.ts`'s `handleAIExpand`) converts the active AI filter back into manual `type`/`category`/`q` FilterHub controls — a completely different operation from "reveal the rest of this truncated sentence." Reusing the word "expand" or the same prop/label for both would be a real, user-facing ambiguity bug, not just an internal naming nit — hence distinct new prop names (`aiSummaryShowMoreLabel`/`aiSummaryShowLessLabel`) and distinct new copy ("Show more"/"Show less", never "Expand"). Separately: `FilterHubProps` already has a confirmed-dead pattern where `aiTriggerTooltip`/`aiClearLabel`/`aiExpandLabel` exist as both nested `labels.X` fields and flat top-level override props (`X || labels.X || 'default'`), but none of the three `apps/web` call sites (`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`) ever pass the flat variant — confirmed by reading all three call sites' JSX in full. The two new labels are added only to `labels`, not replicated as a second, equally-dead flat prop pair.
2. **The "does this summary need truncating" check is a fixed character-count heuristic (70 chars), not a real `scrollWidth`/`clientWidth` overflow measurement.** No existing component anywhere in this repo (`packages/ui` or `apps/web`) measures real DOM overflow for a truncate decision — the closest and only precedent, `apps/web/src/app/[locale]/moderator/tools/payload-list-item.tsx`, uses the identical fixed-character-count pattern (`errorMessage.length > 80`) for the same kind of decision. Matching that established, accepted precedent is preferable to introducing this codebase's first `ResizeObserver`/ref-measurement-based truncation check for a cosmetic refinement story — a real measurement would also need to react to viewport resize and font-size changes, disproportionate complexity for this scope. 70 (vs. `payload-list-item.tsx`'s 80) accounts for `FilterHub`'s row being narrower on average (shares space with the Sparkles icon, caveats text, and two action buttons, unlike a full-width error row). This is an approximation, not a correctness guarantee, by design — on an unusually narrow viewport a sub-threshold summary could still visually clip without a "Show more" control appearing, and on an unusually wide one a just-over-threshold summary might not have actually needed clipping; this tradeoff is accepted as consistent with the existing precedent's own imprecision, not a new limitation this story introduces.
3. **The "too complex" caveat (AC2) gets no new visual treatment distinguishing it from any other caveat — this story proves the existing path still works end-to-end via a new test, rather than building new per-caveat-type styling.** Two things independently support this: (a) by the time a caveat reaches either UI component, Story 9.5's `joinCaveats` has already flattened the `caveats: string[]` array into one joined string (`resolvedCaveats`/`aiCaveatsText`) — the individual caveat identities aren't available to the UI layer at all today, so distinguishing "too complex" from any other caveat visually would require a new data-flow change (threading the raw array through `use-ai-filter.ts` → `AIFilterOverlay`/`FilterHub`) that neither `epics.md`'s AC text nor any UX artifact calls for; (b) Story 9.4's Dev Notes already recorded, as a deliberate and still-current decision, that caveat strings stay plain hardcoded English and are not part of this feature's `next-intl` surface — a new per-type visual treatment would be the first place this feature distinguishes caveats by type at all, which is a bigger design commitment than this story's scope (a UI-polish/readability story) warrants. The existing amber (`text-amber-600 dark:text-amber-400`) block already visually distinguishes "this is a caveat" from the plain-foreground resolved-summary text above it — that distinction already satisfies "shows a caveat."
4. **Example-prompt chips fully unmount (rather than just visually hide) once a summary has resolved**, matching the existing `{resolvedSummary && (...)}`/else-branch button-row split already present in this file for the save/apply/re-prompt vs. cancel/submit button groups — one more instance of the same established conditional-rendering convention, not a new pattern.
5. **No new PostHog analytics event is introduced for the new "Show more"/"Show less" toggle or for clicking an example prompt.** Checked: no event in this AI-filter feature area (`use-ai-filter.ts`, `FilterHub.tsx`, `AIFilterOverlay.tsx`) has ever been instrumented with PostHog across Stories 7.4/7.5/9.3/9.4a/9.5 — not a gap this story introduces, and neither `epics.md`'s AC nor the SPEC calls for tracking either interaction. Not adding one here is consistent with the zero precedent in this exact feature area, not an oversight.
6. **No new `min-h-11` touch-target requirement is imposed on the new toggle/chip buttons.** `EXPERIENCE.md`'s Accessibility Floor section is explicitly scoped ("*Scoped to Global Navigation for this pass*") and the `min-h-11`/`min-w-11` hit-area convention it documents is applied elsewhere in this codebase to primary nav items and toast actions, not to every small inline text-link-style button — the new controls match the sizing of the adjacent, already-shipped "Edit / Expand"/"Clear" buttons (`size="sm"`, effectively `h-8`) for visual consistency rather than introducing a new, larger size class found nowhere else on this same row.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story touches no database schema, no GraphQL schema/operation, and no `packages/domain` type. It adds: two optional string props to `FilterHubProps['labels']`; one optional `string[]` prop plus one optional `labels.examplePromptsLabel` string to `AIFilterOverlayProps`; new `next-intl` locale JSON keys under the existing `FilterHub` namespace; and one new `useMemo`-derived array plus one new label field inside `use-ai-filter.ts`'s existing `overlayLabels`/`overlayProps` objects.
- **Impacted fields/contracts:** `FilterHubProps['labels'].aiSummaryShowMoreLabel?`/`.aiSummaryShowLessLabel?` (new, optional, additive); `AIFilterOverlayProps.examplePrompts?`/`.labels.examplePromptsLabel?` (new, optional, additive). No existing prop/field is renamed, narrowed, or removed — every existing call site of `FilterHub`/`AIFilterOverlay` that doesn't pass the new fields keeps its current behavior exactly (the new "Show more" control and example-prompt chips simply don't render when their inputs are absent).
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the additive, optional prop/label extensions above — no `graphql.ts` regeneration, since no `.graphql` operation document changes.
- **Backward compatibility and rollout notes:** Purely additive UI/i18n change. A user on a stale client bundle mid-deploy sees the pre-existing (non-truncating, no-examples) behavior, never a broken or partially-hydrated state, since every new prop is optional with a safe default (no toggle/chips render without them).
- **Verification checks:** Vitest/RTL coverage on the extended `FilterHub.test.tsx` and `AIFilterOverlay.test.tsx` (Tasks 2, 5); `use-ai-filter.test.ts` coverage on the new `examplePrompts`/`examplePromptsLabel` fields and the "too complex" caveat end-to-end assertion (Task 6); `pnpm --filter @festgrid/ui test`/`lint`/`build`, `pnpm --filter @festgrid/web test`/`lint`/`build`.

### Previous Story Intelligence

Story 9.5 (`review`, immediately preceding, same epic) is this story's direct prerequisite for content: it built `renderFilterExpressionSummary` and wired it into `use-ai-filter.ts`'s `summaryResult`/`resolvedSummaryResult` and into `ai-filters-content.tsx`'s row rendering — meaning a non-flat/grouped AI filter's summary is already real, correctly-rendered, potentially-long text by the time this story runs (not a hypothetical future case). Story 9.5's own Dev Notes decision 7 explicitly scoped FilterHub's truncate/expand treatment and the overlay's example prompts/caveat styling to *this* story (9.6) and left them completely untouched — confirmed by reading `9-5-render-expression-summaries-in-english-and-indonesian.md`'s Dev Agent Record/File List: it touched zero files under `packages/ui`. Story 9.4 (`review`) is this story's other dependency, solely because it is the story that produces the exact "too complex" caveat text this story's Task 5/6 tests assert against (`transform-gemini-response-to-filter-expression.ts:181`, unchanged by this story) and documented, in its own Dev Notes, the deliberate decision that caveat strings stay plain hardcoded English outside the `next-intl` system — a decision this story's design decision 3 explicitly builds on rather than revisits.

### Git Intelligence Summary

Recent commits (`git log --oneline -8`) are all `wip(9.5): dev-story progress` / `wip(9.5): use-ai-filter wiring` — confirming 9.5 is the immediately-preceding, now-`review` work in this batch, with a clean working tree and no other concurrent epic work to reconcile against. Commit message convention observed: `type(scope): short description` (e.g. `feat(9.6): ...`, `wip(9.6): ...`).

### Project Structure Notes

- `packages/ui/src/features/events/FilterHub.tsx` is UPDATEd (truncate/expand toggle, two new `labels` keys) — `FilterHub.test.tsx` UPDATEd accordingly.
- `packages/ui/src/features/events/AIFilterOverlay.tsx` is UPDATEd (example-prompt chips, `examplePromptsLabel`) — `AIFilterOverlay.test.tsx` UPDATEd accordingly.
- `apps/web/locales/en.json`, `apps/web/locales/id.json` are UPDATEd (`FilterHub` namespace, additive keys only).
- `apps/web/src/features/events/use-ai-filter.ts` is UPDATEd (`examplePrompts` memo, `examplePromptsLabel`, passed through `overlayProps`) — `use-ai-filter.test.ts` UPDATEd accordingly.
- `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/feed/feed-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx` are UPDATEd (two new keys added to each file's existing `filterLabels` `useMemo`) — their test files checked, updated only if they assert an exact `filterLabels`/`useAIFilter()` shape (Task 8).
- No `packages/domain` file is touched by this story.
- No `ai-filters-content.tsx` ("My AI Filters") file is touched by this story (AC3).
- No conflicts detected with the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.6: Show long expression summaries in the AI filter overlay and FilterHub] — authoritative ACs this story elaborates.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] — Gate 1/3 epic-wide sweep findings cited above; confirms `9.6` is in `stories_covered`.
- [Source: _bmad-output/implementation-artifacts/9-5-render-expression-summaries-in-english-and-indonesian.md#Design decisions 7, #Out of Scope] — the exact scope boundary this story inherits ("FilterHub's one-row truncate+expand treatment... Story 9.6's exclusive scope"; "the overlay's example prompts... and the 'too complex' caveat's visual styling... Story 9.6's exclusive scope").
- [Source: _bmad-output/implementation-artifacts/9-4-upgrade-gemini-extraction-to-expression-trees-with-node-level-caveats.md#Dev Notes decision 5, Out of Scope] — the deliberate "caveat text stays plain hardcoded English" decision this story's design decision 3 relies on; the exact "too complex" caveat copy this story's tests assert against.
- [Source: _bmad-output/implementation-artifacts/7-4-add-the-ai-filter-prompt-entry-point-to-filterhub.md] — original `FilterHub`/`AIFilterOverlay` architecture split (presentational `packages/ui`, data/mutation wiring in `apps/web` call sites) this story preserves exactly; confirms `AIFilterOverlay` was always meant to stay prop-driven with no direct GraphQL/data-fetching.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md#CAP-5, CAP-6] — CAP-5 ("FilterHub renders exactly one row... never both the summary and the full manual control set at once") is the literal requirement AC1's truncate treatment protects; CAP-6's worked example is this story's grouped example-prompt copy.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.15] — "a small icon-only trigger... adding no permanent width to FilterHub... a single collapsed row" (FilterHub Entry Point bullet); "free jazz events in Kota Yogyakarta next week"-style success-signal example this story's `aiOverlayExamplePrompt1` reuses (adapted to "this weekend" to match the SPEC's own success-signal phrasing exactly).
- [Source: packages/ui/src/features/events/FilterHub.tsx, FilterHub.test.tsx] — read in full; the exact collapsed-layout JSX, props, and existing test shape this story extends.
- [Source: packages/ui/src/features/events/AIFilterOverlay.tsx, AIFilterOverlay.test.tsx] — read in full; the exact overlay JSX/props/test shape this story extends; confirms no example-prompt list or truncate/expand pattern exists anywhere in it today.
- [Source: apps/web/src/features/events/use-ai-filter.ts, use-ai-filter.test.ts] — read in full; the exact `overlayLabels`/`overlayProps`/`filterHubProps` construction and `mockTranslate` (`t(key) => key`) test-mock convention this story's new fields and tests follow.
- [Source: apps/web/src/app/[locale]/home-content.tsx, apps/web/src/app/[locale]/feed/feed-content.tsx, apps/web/src/app/[locale]/favorites/favorites-content.tsx] — read in full; confirmed identical `filterLabels` `useMemo` shape and `EventDiscoveryPanel`/`AIFilterOverlay` wiring across all three.
- [Source: packages/ui/src/features/events/EventDiscoveryPanel.tsx#L92-122] — confirms `FilterHub` receives `labels={filterLabels}` as one forwarded object (no per-field prop threading needed for the two new keys).
- [Source: apps/web/src/app/[locale]/moderator/tools/payload-list-item.tsx] — the only existing truncate-with-expand-toggle precedent in this repo (`isExpanded`/`aria-expanded`/fixed-character-count heuristic); this story's naming/`aria` convention mirrors it, per Dev Notes decision 2.
- [Source: packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts#L180-182] — the exact, unchanged "too complex" caveat text this story's Task 5/6 tests assert against end-to-end.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EXPERIENCE.md] — read in full / via outline+full-text-search respectively (Gate 2, Freya persona, run fresh for this story); confirms zero AI-filter-summary/FilterHub/truncate/example-prompt-specific content exists in either.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, the epic-level-sweep citation rule, Gate 2's required action (independently re-verified, not rubber-stamped, per this story's own fresh subagent run).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui` stays presentational/prop-driven; no GraphQL/data-fetching added inside `FilterHub.tsx`/`AIFilterOverlay.tsx`), Locale-Sensitive Data Rendering (all new strings `next-intl`-sourced, never hardcoded), UI Patterns & UX Invariants (CAP-5's "exactly one collapsed row" invariant this story protects) — all cited above.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — Section 3.15 ("FilterHub Entry Point" bullet: single collapsed row, clear/expand actions) covers this capability at the PRD level; no PRD change is made by this story (Story 9.9z owns any PRD/vocabulary amendment, and this story makes no vocabulary/grammar change).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section is implicated (no new infra/architecture decision; this story is pure `packages/ui` presentational work plus `apps/web` i18n/data wiring), per `epic-9-readiness.md`'s Gate 1 citation above; full file not loaded, consistent with Stories 9.1a-9.5's own precedent.
- [x] `docs/infrastructure/index.md` — not applicable (no Lambda, queue, DB, or hosting change); confirmed via the `epic-9-readiness.md` citation above; full infra shards not loaded.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `packages/ui/src/features/events/FilterHub.tsx` (Task 1) + `.test.tsx` (Task 2).
  - UPDATE `apps/web/locales/en.json`, `apps/web/locales/id.json` (Task 3).
  - UPDATE `packages/ui/src/features/events/AIFilterOverlay.tsx` (Task 4) + `.test.tsx` (Task 5).
  - UPDATE `apps/web/src/features/events/use-ai-filter.ts` (Task 6) + `.test.ts` (Task 6/7).
  - UPDATE `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/feed/feed-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (Task 7) + their `.test.tsx` files only if needed (Task 8).
- **Rule Mapping:**
  - AC1 (one row, truncate, expand, caveats always visible) → Task 1 (`FilterHub.tsx`'s clamp/toggle), Task 2 (tests), Design decisions 1-2, 6.
  - AC2 (example prompts incl. one grouped; "too complex" caveat still surfaces) → Task 3 (locale keys), Task 4 (`AIFilterOverlay.tsx` chips), Task 5-6 (tests/wiring), Design decisions 3-5.
  - AC3 (no saved-filter edit UI) → satisfied by scope exclusion (no `ai-filters-content.tsx` touch) — documented, not implemented.
  - `packages/ui` presentational-only boundary (project-context.md, Story 7.4 precedent) → every new control in `FilterHub.tsx`/`AIFilterOverlay.tsx` is local state + props, zero data-fetching/GraphQL/i18n-hook calls added inside `packages/ui`; all `next-intl` resolution happens in `use-ai-filter.ts`/the three call sites, as today.
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md`; Gate 2 run fresh via `runSubagent` (Freya persona) — no gap found, documented in Architecture & UX Gate Findings above.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — new/updated cases in `FilterHub.test.tsx` and `AIFilterOverlay.test.tsx` pass; full existing `ui` suite stays green.
  - `pnpm --filter @festgrid/ui lint`/`build` — clean.
  - `pnpm --filter @festgrid/web test` — updated/new cases in `use-ai-filter.test.ts` pass (and in the three content-page test files, only if Task 8 found an edit necessary); full existing `web` suite stays green.
  - `pnpm --filter @festgrid/web lint`/`build` — clean.
  - Manual: re-grep `FilterHub.tsx`/`AIFilterOverlay.tsx` for any hardcoded English word outside a `labels.X ?? 'default-fallback'`/`labels.X || 'default-fallback'` pattern — confirms every new user-facing word is locale-sourced, fallback defaults aside (same check Story 9.5 ran on the domain renderers).

## Pre-Coding Approval Gate

- [x] Scope confirmation — two `packages/ui` presentational-component edits (no new file, no new component) + their tests; six new/updated locale keys; one `apps/web` hook extension (one new memo, one new label field, one new passthrough field) + its test; two new label keys added to three already-identical `filterLabels` blocks; zero new components, zero DB migration, zero GraphQL schema/operation change, zero touch to any saved-filter surface.
- [x] Architecture and boundary confirmation — Gate 1/3 cited from `epic-9-readiness.md` (no gap); Gate 2 run fresh via `runSubagent` (Freya persona) found no gap (independently re-verified against `DESIGN.md`/`EXPERIENCE.md`, not rubber-stamped from prior stories' precedent).
- [x] Testing plan confirmation — Vitest/RTL coverage extended on `FilterHub.test.tsx` (truncate/expand toggle, caveats-stay-visible, threshold non-regression) and `AIFilterOverlay.test.tsx` (example-prompt chips, click-fills-textarea, resolved-state hides chips, "too complex" caveat renders verbatim); `use-ai-filter.test.ts` extended for the new `examplePrompts`/`examplePromptsLabel` fields and an end-to-end "too complex" caveat assertion.
- [x] Explicit human approval state — APPROVED by user (dispatch instruction for this Epic 9 batch: "skip Gate 1/3 and run Gate 2 only... Minimise questions: choose the recommended default and record it in Dev Notes"), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above (decisions 1-6), matching Stories 9.1a-9.5's own identical precedent for this same batch. No decision in this story carries the kind of real, non-mechanical tradeoff that would otherwise warrant a standalone question (the closest candidate — whether to add new per-caveat-type visual styling, decision 3 — is resolved toward the lower-cost, spec-literal reading: prove the existing path works via a test, since neither the AC text nor any UX artifact calls for new styling, and the raw caveat array isn't even threaded to the UI layer today).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap, N/A (cited). Gate 2: no gap, N/A (run fresh). No prerequisite story is created by this story.

## Testing Requirements

- [x] Integration tests (Vitest/RTL): `FilterHub.test.tsx` — long-summary truncation + "Show more"/"Show less" toggle + `aria-expanded`; short-summary non-regression (no toggle rendered); caveats remain visible/unchanged across the toggle's collapsed/expanded states.
- [x] Integration tests (Vitest/RTL): `AIFilterOverlay.test.tsx` — example-prompt chips render and fill the textarea on click; chips disabled while `isLoading`; chips absent once `resolvedSummary` is set; the exact Story 9.4 "too complex" caveat string renders verbatim in the existing amber block.
- [x] Integration tests (Vitest): `use-ai-filter.test.ts` — `overlayProps.examplePrompts` is a 3-element array sourced via `tFilterHub` (asserted against the mock's identity-return keys, per this file's existing `t(key) => key` convention) and includes the grouped-example key; an end-to-end assertion that a mocked over-limit-style resolve response's caveat text reaches `overlayProps.resolvedCaveats` unchanged.
- [x] Integration tests: `home-content.test.tsx`/`feed-content.test.tsx`/`favorites-content.test.tsx` — updated only if Task 8 finds an exact-shape assertion on `filterLabels` or the mocked `useAIFilter()` return value that the two new fields would break.
- [x] E2E tests: not applicable — no new route/page/critical-flow surface in the Playwright-covered-critical-flow sense (confirmed by Gate 2's "no gap" verdict above; this story refines an already-E2E-covered flow — Story 7.4's own E2E happy path — with presentational-only additions fully exercised by the Vitest/RTL integration tests above).

## Deliverables Checklist

- [x] `FilterHub.tsx`'s collapsed AI-filter row stays visually one line by default for a long summary, with a working "Show more"/"Show less" toggle that never collides with the pre-existing "Edit / Expand" control, and caveats text stays visible at all times.
- [x] `AIFilterOverlay.tsx` shows a short list of example prompts (including one grouped AND/OR/NOT example reusing the SPEC CAP-6 worked example) before a prompt resolves; clicking one fills the textarea without auto-submitting.
- [x] An over-limit prompt's existing "too complex" caveat is proven, by a new test, to still reach and render in the overlay unchanged.
- [x] `en.json`/`id.json` carry the six new `FilterHub` namespace keys in both locales.
- [x] `use-ai-filter.ts` exposes `examplePrompts`/`examplePromptsLabel` via `overlayProps`; all three Discovery/Feed/Favorites call sites' `filterLabels` carry the two new `FilterHub` labels.
- [x] No saved-filter ("My AI Filters") file or path is touched.
- [x] All new/updated test files passing; `pnpm --filter @festgrid/ui test`/`lint`/`build`, `pnpm --filter @festgrid/web test`/`lint`/`build` all green.

## Out of Scope

- **Any `packages/domain` change** — this story is `packages/ui` presentational work plus `apps/web` i18n/data wiring only; the summary-rendering logic it displays was completed in Story 9.5 and is unchanged here.
- **Any new visual/data-flow distinction between caveat types** (e.g. styling "too complex" differently from any other caveat) — confirmed not required by any AC or UX artifact (Design decision 3); would require threading the raw `caveats: string[]` array through the UI layer, which this story does not do.
- **A generic, reusable `packages/ui/core` "truncate + expand" primitive** — confirmed single-consumer by Gate 2; built inline in `FilterHub.tsx` instead, matching this project's own "defer generalization until a second consumer actually appears" precedent (Story 3.7e).
- **Any change to `ai-filters-content.tsx` ("My AI Filters")** — AC3's "no edit UI" invariant holds by not touching this surface at all.
- **i18n or styling of the caveat strings themselves** — Story 9.4's deliberate "plain hardcoded English, not next-intl-sourced" decision for caveat text stands unchanged (Design decision 3).
- **New PostHog analytics events** for the new toggle or example-prompt clicks — no precedent anywhere in this feature area; not required by any AC (Design decision 5).
- **Stories 9.7 (golden-prompt evals), 9.8 (rate limiting), 9.9z (ratchet + PRD amendment)** — unrelated, independent scope.
- No new Gate 1/2/3 gap was found by this story; no new prerequisite story results from it.

## Definition of Done

- [x] AC1-AC3 satisfied and verified by their respective tests.
- [x] Required tests passing: `pnpm --filter @festgrid/ui test` and `pnpm --filter @festgrid/web test`.
- [x] Lint and type checks passing: `pnpm --filter @festgrid/ui lint`/`build`, `pnpm --filter @festgrid/web lint`/`build`.

## Completion Status

- [x] Implementation complete (Tasks 1-9); all ACs satisfied, all verification commands run and green (session resume after an earlier tool-execution outage). Status advanced to `review`.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (bmad-dev-story, Epic 9 batch dispatch)

### Debug Log References

- **Tasks 1-8 implemented exactly per the Implementation Plan/File Change Plan.** `pnpm --filter @festgrid/ui test` was run once, successfully, early in this session (68 files / 911 tests passed) -- this was BEFORE Task 1's FilterHub.tsx edit landed, confirming the pre-edit baseline was green.
- **`pnpm --filter web test` was run once, successfully to completion, after all of Tasks 1-8 landed.** Result: 3 test files failed (6 tests) -- `home-content.test.tsx`, `feed-content.test.tsx`, `favorites-content.test.tsx` -- each on exactly two "Story 9.4a (AI filter expression wiring)" tests ("uses the compiled expression condition..."/"treats two different non-flat expressions..."), with the same root error: `Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.`
  - **Root-caused, not assumed:** `packages/ui/src/features/events/FilterHub.tsx`'s `if (aiFilterSummary) { return (...); }` early return sat BEFORE this component's `useQueryState` hook calls for `selectedTypes`/`selectedCategories` -- in BOTH the pre-9.6 baseline (confirmed via `git show 4e2663e:...FilterHub.tsx`, read in full) and my own first pass at Task 1 (which only added one new hook, `isSummaryExpanded`, ALSO before the early return, so it didn't change this pre-existing shape). A `FilterHub` instance that mounts with no active AI filter calls those two hooks every render; the failing tests seed `ai_filter`/`ai_expression` via `nuqs` AFTER initial mount, so on the next render `aiFilterSummary` becomes truthy and the SAME mounted instance hits the early return having called 0 (baseline) or 1 (my first pass) hooks instead of 2/3 -- a hard violation of React's rules of hooks, not a story-9.6-introduced regression (the defective shape pre-dates this story; 9.6 only became the first story whose tests exercise this exact transition's render path in a way that already-existing `ai_expression`-seeding tests from Story 9.4a hit it).
  - **Fix applied (in `FilterHub.tsx`, same file this story already edits):** hoisted the pre-existing `useQueryState('types', ...)`/`useQueryState('categories', ...)` calls to run unconditionally, above the `if (aiFilterSummary)` branch, alongside the new `isSummaryExpanded` state -- same hook count on every render regardless of branch taken, with zero change to the hooks' own behavior (they were already irrelevant to, and unused by, the AI-active branch; only their position in the function moved). Documented inline in the file with a comment pointing back to this record.
  - **Could not re-run `pnpm --filter web test` (or any other `pnpm`/`node`/`python3 subprocess`/Monitor invocation) after applying this fix, or run any `lint`/`build` command for either package, for the remainder of this session.** Starting partway through this session, every Bash/Monitor call that attempts to actually execute a toolchain binary (`pnpm --version`, `node -e`, `node <script>`, `python3 -c`, a `vitest` binary invoked directly, a wrapper shell script, foreground and background alike) fails immediately with `Tool permission request failed: AbortError: Stream closed` -- while trivial commands (`echo`, `git log`/`status`/`diff`/`show`, `ls`, `which`, `cp`, `node --version`, `python3 --version`) keep working throughout. This reproduced consistently across more than a dozen varied retries (different commands, different wrapping, background vs foreground, after real-time waits) and did not self-recover, so it is reported here as a session-level tool outage rather than retried further, per this story's own dispatch instruction not to loop on the same command.
- **Net effect at that point:** the fix was reasoned from first principles (confirmed root cause via direct source diff against the pre-9.6 baseline) and was a minimal, mechanical hook-hoist with no behavioral change, but was unverified by an actual test run before the session hit its account session limit and was cut off.
- **Session resumed (new session, same WIP already auto-committed as `76feaf9`).** `pnpm --version` and all other tool execution worked normally on resume -- the outage was specific to the prior session and did not persist. Task 9 verification was then run to completion, each command once:
  - `pnpm --filter @festgrid/ui test` → 68 files / 911 tests passed.
  - `pnpm --filter @festgrid/ui lint` → clean (`eslint . --max-warnings 0`, zero output).
  - `pnpm --filter @festgrid/ui build` → "None of the selected packages has a 'build' script" -- expected; `@festgrid/ui` has no standalone build step and is built transitively as a source dependency of `web`'s own build, per Task 9's own note.
  - `pnpm --filter web test` → 78 files / 649 tests passed, **including** the previously-failing `home-content.test.tsx`/`feed-content.test.tsx`/`favorites-content.test.tsx` Story-9.4a tests -- confirms the hook-hoist fix was correct and resolved the regression.
  - `pnpm --filter web lint` → exit 0; only pre-existing warnings unrelated to this story's files (`no-explicit-any`/`no-unused-vars` in files/lines this story didn't touch), no errors.
  - `pnpm --filter web build` → succeeded, all 39 routes generated cleanly.
  - `git status --short` after the full run → clean (no `tsconfig.tsbuildinfo` or other build artifact left modified/untracked).

### Completion Notes List

- Tasks 1-9 (all functional/i18n/test code for AC1-AC3, plus verification) are implemented and passing exactly per the Implementation Plan. Pre-Coding Approval Gate's provenance (Epic 9 batch dispatch instruction) honored as already ticked in this story file.
- One additional, in-scope correctness fix was required and applied (not a scope expansion): hoisting two pre-existing `useQueryState` hook calls in `FilterHub.tsx` above the `if (aiFilterSummary)` early return to fix a pre-existing rules-of-hooks violation exposed by `home-content.test.tsx`/`feed-content.test.tsx`/`favorites-content.test.tsx`'s existing Story-9.4a tests. See Debug Log References for full root-cause analysis; confirmed correct by the full `pnpm --filter web test` run going green after the fix.
- All Definition of Done items satisfied: AC1-AC3 verified by their tests; `pnpm --filter @festgrid/ui test`/`lint` and `pnpm --filter web test`/`lint`/`build` all green (no build script on `@festgrid/ui` itself, as expected); File List complete; only permitted story sections modified.
- Story Status advanced to `review` in both the story file and `sprint-status.yaml`.

### File List

- `packages/ui/src/features/events/FilterHub.tsx` (UPDATE -- Task 1 truncate/expand toggle + labels; plus the hook-hoist correctness fix described above)
- `packages/ui/src/features/events/FilterHub.test.tsx` (UPDATE -- Task 2)
- `packages/ui/src/features/events/AIFilterOverlay.tsx` (UPDATE -- Task 4)
- `packages/ui/src/features/events/AIFilterOverlay.test.tsx` (UPDATE -- Task 5)
- `apps/web/locales/en.json` (UPDATE -- Task 3)
- `apps/web/locales/id.json` (UPDATE -- Task 3)
- `apps/web/src/features/events/use-ai-filter.ts` (UPDATE -- Task 6)
- `apps/web/src/features/events/use-ai-filter.test.ts` (UPDATE -- Task 6)
- `apps/web/src/app/[locale]/home-content.tsx` (UPDATE -- Task 7)
- `apps/web/src/app/[locale]/feed/feed-content.tsx` (UPDATE -- Task 7)
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (UPDATE -- Task 7)
- (Task 8: `home-content.test.tsx`, `feed-content.test.tsx`, `favorites-content.test.tsx` checked -- none required an edit; none asserts an exact `filterLabels`/`useAIFilter()` shape that the two new additive fields would break)

## Epic 9 code-review amendments (2026-10-23)

The Epic 9 code review (`implementation-artifacts/epic-9-code-review-2026-10-23.md`) changed behaviour this story's text still describes. Read the code and this note, not the superseded wording below.

- **Supersedes AC3 / Out of Scope ("does not touch `ai-filters-content.tsx`"):** see Story 9.5's amendment; the overlay hides *Save* for an extraction with no conditions (P16) and FilterHub resets its expanded state when the summary changes (P19).
- **Edit / Expand (D2):** offered only when manual controls (keyword, types, categories) can represent the whole filter; a compound filter, or a flat one that also has a date, place, price or account, has no Expand, and the search box is ANDed onto it instead.
