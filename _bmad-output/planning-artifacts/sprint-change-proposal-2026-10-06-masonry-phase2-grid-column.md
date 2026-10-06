---
status: proposed
---

# Sprint Change Proposal — Masonry Phase 2 items stretch across the full grid width

**Date:** 2026-10-06 · **Author:** Developer (bmad-correct-course) · **Mode:** Batch · **Scope:** Minor

## 1. Issue Summary

**Trigger story:** 0.48 `mount-stable-masonry-engine-fix-reflow-remount-and-focus-loss` (sprint status `review`, commit `9348909`). Parent spec: Story 0.45 / Architecture Spine AD-27.

**Problem (technical limitation / wrong premise in the spec).** In `GridContainer`'s measured phase (Phase 2, `hasMeasured === true`) every item is `position: absolute` with `gridColumn: colIndex + 1` (`packages/ui/src/core/grid-container.tsx:230`). That sets only the start line (`grid-column: N / auto`). For an absolutely positioned child of a grid container, an `auto` end line resolves to the container's padding edge, not to the next column line.

**Observed (mobile Discover list, 2026-10-06 screenshot):**
- Column-0 cards (English Days 2026) render the full container width.
- Column-1 cards (Menata Hati, OCT 18) start at the column-2 line and run to the right edge, painting over the left cards.
- The wide left cards also hide the "Oct 17 Talk" card behind them.

**Root cause in the spec.** Story 0.48 AC2 / Dev Notes assert that "an absolutely-positioned element with explicit `grid-column` ... resolves its containing block to that grid area, so `width: 100%` fills exactly its assigned column's track". That holds only when the start AND end lines are both definite. Only the start was specified.

**Why nothing caught it.**
- `grid-container*.test.tsx` and `useMasonryLayout.test.ts` run in jsdom, which has no layout engine.
- The visual-audit manifests (`grid-container-masonry.ts`, `masonry-column-width-invariant.ts`) never see Phase 2. The first uses `renderToStaticMarkup` (SSR, Phase 1 only). The second is a synthetic flex row that does not mount `GridContainer` at all. AC10 covers only the Phase 1 non-collapsed height.

## 2. Impact Analysis

| Area | Impact |
|---|---|
| Epic 0 (shared primitives) | Story 0.48 stays in `review`; do not mark `done` until this lands. 0.45 and 0.31 are unaffected. |
| Consumers | 1.3i (list/masonry toggle), 1.i1e (EventCard in masonry), Feed/Favorites/Discovery masonry views: all fixed by the single primitive change. |
| PRD | None. |
| Architecture (AD-27) | One clarification: Phase 2 items need a definite two-line `grid-column`. |
| UX (DESIGN.md `components.grid.masonry`) | None. Visual intent is unchanged. |
| Tests / tooling | Add a jsdom style assertion and a real-browser Phase 2 visual-audit proof (see §4). |
| Infra / CI / sprint-status | No new stories, epics or renumbering. |

## 3. Recommended Approach

**Option 1 — Direct Adjustment** (effort: Low, risk: Low). Reopen Story 0.48 with one corrective task and one tightened gate. Rollback (reverting 0.48) is not viable: it would reintroduce the FIND-052 remount and focus-loss bug. MVP scope is unaffected.

## 4. Detailed Change Proposals

### 4.1 Code — `packages/ui/src/core/grid-container.tsx` (~line 230)

OLD:
```ts
gridColumn: colIndex + 1,
position: 'absolute',
```
NEW:
```ts
gridColumn: `${colIndex + 1} / ${colIndex + 2}`,
position: 'absolute',
```
Rationale: gives the abspos item a definite grid area, so `width: 100%` resolves to one column track. Phase 1 (in-flow items) is unchanged; a single-line `gridColumn: N` is valid there.

### 4.2 Story 0.48 — AC2 and Dev Notes corrections

OLD (AC2, Phase 2): "KEEPS its `gridColumn` placement ..."
NEW: "KEEPS its column placement as a two-line `gridColumn: 'N / N+1'` ..., because an absolutely positioned grid child with an `auto` end line spans to the container's padding edge."

Also add:
- **New AC14:** In Phase 2, every item's computed width equals one column track width (within 2px), and items in adjacent columns do not overlap horizontally.
- **New Task 6:** apply 4.1, update the Dev Notes' CSS-spec claim (line ~107), and add a Change Log entry referencing this proposal.

### 4.3 Tests

- **`grid-container.test.tsx`** (jsdom): in the measured phase, assert each item's inline `gridColumn` is `"N / N+1"`, not a bare number. This is a cheap guard that does not prove real layout.
- **`packages/visual-audit`** (real browser, the actual gate): add a manifest entry or Playwright proof that mounts `GridContainer layout="masonry"` through the `react-component` RenderSpec (client-rendered, so Phase 2 is reached) at the 390px mobile viewport. It must assert:
  1. `[data-grid-container-layout="masonry"]` has the measured-phase `position: relative` style (proof that Phase 2 was reached);
  2. every `[data-grid-container-item]` has the same width (±2px) via the existing `sibling-dimension` rule;
  3. no two items' bounding boxes intersect.
- **`masonry-column-width-invariant.ts`**: retarget it from the synthetic flex row to the real mounted component, or document it as intentionally synthetic and rely on the new entry. I recommend the new entry, which keeps the synthetic one as the rule-engine proof it was written to be.
- **Negative canary** in `manifests-proof.spec.ts`: revert to a single-line `gridColumn` via a CSS or style override and confirm the new proof fails, so it is shown to be able to fail.

### 4.4 Architecture Spine AD-27 (one-line clarification)

Add to Rule 3: "Phase 2 items must use a definite two-line `grid-column` (`N / N+1`); an `auto` end line spans an absolutely positioned item to the container edge."

## 5. Implementation Handoff

- **Scope:** Minor, direct implementation by the Developer agent (`bmad-dev-story` on Story 0.48 with the new Task 6 and AC14, or `bmad-quick-dev`).
- **Responsibilities:**
  - Dev: 4.1–4.3.
  - Dev or architect: 4.4 wording.
  - Test architect (optional): review the new visual-audit proof (`bmad-testarch-test-review`).
- **Success criteria:**
  1. The mobile list renders one card per column at equal width with no overlap, checked in a real browser.
  2. The new visual-audit Phase 2 proof is green, and its canary fails against the old behavior.
  3. Story 0.48 moves `review → done`.

## 6. Open Questions

None blocking. Carve-outs for the backlog board:
- Decide whether `masonry-column-width-invariant` should be retargeted (4.3). Default taken: keep it, add the new entry.
