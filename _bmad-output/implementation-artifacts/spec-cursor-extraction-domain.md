---
title: 'Cursor extraction slice 2: the pure domain (cursor, continue rules, bound, windows, ordinals)'
type: 'feature'
created: '2026-11-10'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The stepped extraction of AD-46 to AD-51 needs decisions that must not live in the model or in I/O code: whether to continue, how big the next window is, whether a request is still allowed, how to split an at-risk window, how to number a step's events and how to recognize an event found twice.

**Approach:** Slice 2 of `_bmad-output/specs/spec-cursor-extraction/build-slices.md`: one pure module in `packages/domain/src/posts/extraction-cursor.ts` that reproduces every row of `continue-rules.md`, the request bound (AD-51 Rule 1), window sizing and splitting (AD-49), the at-risk test, the dedupe key and per-step ordinal ranges (AD-48), plus the one versioned `ExtractionCursor` type (AD-47 Rule 1).

## Boundaries & Constraints

**Always:** Pure functions, no I/O or clock; every table row of `continue-rules.md` has a test; the domain 100% coverage gate holds; ordinal ranges use the existing `assignExtractionOrdinals` order and stay below the Apply's parked ordinal base.

**Ask First:** Changing any starting value (25 events per call, window 2 to 4, 2 empty steps, 10-image follow-up, 90% output share).

**Never:** A migration, a queue, the step handler, the cursor writer, prompt or schema changes, any backend or infra change.

## I/O & Edge-Case Matrix

| Scenario | Input | Output |
|----------|-------|--------|
| Roundup, last step added events | unread slides, bound not reached | continue with a window of 1 to 4 |
| Kill switch off or bound reached | any state with slides unread | stop, partial |
| Lineup | no follow-up yet | one follow-up for up to 10 images in total |
| Nothing found | fewer than 2 empty steps | continue; at 2, stop |
| Range near the ceiling | next ordinal + count at or above 30,000 | throws `OrdinalRangeExhaustedError` |

</frozen-after-approval>

## Code Map

- `packages/domain/src/posts/extraction-cursor.ts` -- the module; `extraction-cursor.test.ts` -- row-by-row tests.
- `packages/domain/src/events/assign-extraction-ordinals.ts` -- reused ordering (ordinals are 0-based; AD-48 Rule 1 corrected to match).

## Tasks & Acceptance

**Execution:**
- [x] `extraction-cursor.ts` and `extraction-cursor.test.ts` -- the pure rules above.
- [x] Export from `packages/domain/src/posts/index.ts`.
- [x] AD-48 Rule 1: ordinals start at 0, so the cursor's next free value starts at n.

**Acceptance Criteria:**
- Given any state, when `decideNextStep` runs, then it returns exactly the action `continue-rules.md` gives for the first matching row.
- Given the domain suite, when it runs, then it passes with 100% coverage.

## Spec Change Log

## Verification

- `pnpm --filter @festgrid/domain test` and `lint` -- clean.
