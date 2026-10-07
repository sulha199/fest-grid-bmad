---
baseline_commit: dfe45a056b333bd6efa206ef37777134e25c43bf
---

# Story 0.49e: Ratchet — no raw tier-value class, and no inlined Overlay-modal literal

## Story Details

- Epic: 0
- Story ID: 0.49e
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want an enforced, CI-wired Vitest test that fails if any file under `packages/ui/src` or `apps/web/src` contains a raw z-index class matching an approved tier's *value* (40/45/50/60, bare or `z-[N]`) instead of its named token, or if any Overlay-modal-tier consumer inlines `'z-overlay-modal'`/`'z-50'` instead of importing `OVERLAY_MODAL_Z`,
so that a sixth file cannot reintroduce the exact defensive-bump/magic-number pattern Architecture Spine AD-33 exists to close, after Stories 0.49-0.49d have migrated every known site.

## Acceptance Criteria

1. **Given** the full `packages/ui/src` and `apps/web/src` trees (excluding test/spec/story files and any generated output — `*.test.ts(x)`, `*.spec.ts(x)`, `*.stories.ts(x)`, anything under a `__generated__`/`generated` path, and `tailwind.generated.css`), **when** the ratchet test runs, **then** it fails if any file's raw source text contains a Tailwind class matching `z-40`, `z-45`, `z-50`, `z-60`, `z-[40]`, `z-[45]`, `z-[50]`, or `z-[60]` as a whole-token match (not a substring of a longer class/identifier, e.g. not matching inside `z-400` or a CSS custom property name) — this is a check on the numeral's *value* against the four reserved tier values, not a fixed string list of today's two known offending literals (`z-40`/`z-50`), so it also catches a future `z-45`/`z-60` written directly instead of its named token.
2. **Given** the one legitimate exception — `packages/ui/src/core/overlay-z.ts` itself, which must contain the literal string `'z-overlay-modal'` to define the `OVERLAY_MODAL_Z` constant — **when** the ratchet test runs, **then** this file is explicitly exempted from assertion 2 below (not assertion 1 — `overlay-z.ts` contains no raw numeral class at all, so assertion 1 would never flag it regardless).
3. **Given** every other file in `packages/ui/src`/`apps/web/src`, **when** the ratchet test runs, **then** it also fails if any such file's raw source text contains the literal string `'z-overlay-modal'` or a raw `z-50`-class usage written as a hardcoded string instead of referencing the imported `OVERLAY_MODAL_Z` identifier — i.e. a file that imports `OVERLAY_MODAL_Z` and interpolates it is fine; a file that writes the tier's own literal class name directly is not, even though `'z-overlay-modal'` doesn't match assertion 1's raw-numeral pattern.
4. **Given** `z-0`/`z-10`/`z-20`/`z-30` (bare, Local tier) are deliberately **not** ratcheted — AD-33 Rule 4 states there is no reliable static check for "does this component's own root carry `isolate`," so Local-tier correctness stays a code-review convention — **when** the ratchet test runs, **then** it asserts nothing about any `z-0`/`z-10`/`z-20`/`z-30` site; a file using these values freely, with or without `isolate`, is never flagged by this test.
5. **Given** Stories 0.49-0.49d will have migrated every currently-known raw-tier-value site by the time this story lands, **when** the ratchet test runs against the post-migration codebase, **then** it passes cleanly (0 failures) — this story's own Task 2 is to run it against the then-current tree and confirm exactly that, not merely to write a test that passes in isolation against a hand-picked fixture.
6. **Given** AD-33 Rule 4 explicitly mandates "a Vitest test, not an ESLint rule" (because `packages/ui`'s only ESLint config is narrowly scoped and registers nothing for `apps/web/src`), **when** this story ships, **then** the ratchet is implemented as a plain Vitest test file (source-text static analysis, the same "test as static analysis" shape as AD-30 Rule 2's/AD-31 Rule 4's existing source-scan ratchets), wired into whichever existing `pnpm`/CI script already runs the package's Vitest suite — no new CI job, no new script, no ESLint rule of any kind.

## Tasks / Subtasks

- [x] Task 1 — Write the ratchet test (AC1–AC4, AC6)
  - [x] 1.1 Create `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts` (new directory; confirm no existing `__tests__` convention conflicts — `packages/ui`'s existing tests are colocated `*.test.tsx` files, so note this is a repo-wide sweep test, same genre as `grid-container.masonry-mount-stability.test.tsx`, and name/locate it so it's obviously not a per-component test).
  - [x] 1.2 Implement a small recursive file walker (plain `fs.readdirSync`/`fs.readFileSync`, no new dependency) over two roots resolved relative to the test file's own location via `path.resolve(__dirname, ...)` (do not hardcode an absolute path or rely on `process.cwd()`, which varies by how Vitest is invoked):
     - `packages/ui/src` (this package's own source — the walker's `__dirname` is already inside it, so this is a short climb, e.g. `path.resolve(__dirname, '..')` back up to `src`).
     - `apps/web/src` (climb from `packages/ui/src/__tests__` up to the repo root, then down into `apps/web/src` — verify the exact number of `..` segments empirically with a one-off `console.log` + `fs.existsSync` check before trusting it, rather than assuming the directory depth).
  - [x] 1.3 Exclude from the walk: any path segment matching `__tests__`, `.test.`, `.spec.`, `.stories.`, `generated`, or `node_modules`; any non-`.ts`/`.tsx` file.
  - [x] 1.4 **Assertion 1** (AC1): for each remaining file, regex-test its raw text for a whole-token match of `z-40`, `z-45`, `z-50`, `z-60`, `z-[40]`, `z-[45]`, `z-[50]`, `z-[60]` (e.g. a pattern like `` /(? <![\w-])z-(?:40|45|50|60|\[40\]|\[45\]|\[50\]|\[60\])(?![\w-])/ `` — a word-boundary-safe match that won't fire on `z-400` or a longer identifier). Collect every `{file, match}` hit; the test fails (with all hits listed in the failure message, not just the first) if the collected list is non-empty.
  - [x] 1.5 **Assertion 2** (AC2, AC3): for each file except `packages/ui/src/core/overlay-z.ts`, regex-test for the literal string `'z-overlay-modal'` or `"z-overlay-modal"` (either quote style) written as a hardcoded string. Fail with all hits listed if non-empty.
  - [x] 1.6 Write both assertions as separate `it(...)` blocks inside one `describe('AD-33 z-index layering ratchet', ...)`, each with a clear failure message naming every offending file/line so a future violator gets an actionable error, not just "test failed."
- [x] Task 2 — Run it against the post-migration tree and confirm green (AC5)
  - [x] 2.1 **This task only makes sense once Stories 0.49-0.49d are done.** Sequence this story last. Run `pnpm --filter @festgrid/ui exec vitest run src/__tests__/ad33-z-index-layering.ratchet.test.ts` and confirm 0 failures.
  - [x] 2.2 As a deliberate regression check, temporarily reintroduce one raw `z-50` into any already-migrated file (e.g. revert one line of Story 0.49a's `dialog.tsx` change in a scratch/local-only edit), re-run the test, confirm it fails with that exact file/line named, then revert the scratch edit. Do not commit this step's temporary edit.
- [x] Task 3 — Confirm no new CI wiring is needed (AC6)
  - [x] 3.1 Confirm the new test file is picked up automatically by whatever script already runs `packages/ui`'s Vitest suite in CI (it will be, by Vitest's default test-file discovery glob) — no `package.json`/CI config edit expected. If the repo's CI config explicitly lists test paths rather than globbing, update it; otherwise make no CI config change.

## Dev Notes

- Relevant architecture patterns and constraints: AD-33 Rule 4 in full — this story implements it verbatim. The two assertions map 1:1 to Rule 4's two bullets ("No raw tier values" / "No inlined overlay-modal class").
- Source tree components to touch: new file `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`. No production code is modified by this story.
- Testing standards summary: this story *is* a test. No additional test-the-test scaffolding beyond Task 2.2's temporary regression probe (reverted before commit).
- **Depends on:** Stories 0.49-0.49d all being done — this story's AC5 requires the ratchet to pass cleanly against the fully-migrated tree. Writing the test itself (Task 1) has no code dependency, but confirming it passes (Task 2) does; sequence this story last among the six.
- **Precedent for the "source-scan test" pattern in this codebase:** AD-30 Rule 2 and AD-31 Rule 4 are both cited by AD-33 Rule 4 as prior art for "a test that does static analysis via source-text scanning rather than runtime assertions." No existing Vitest test in this repo currently walks *both* `packages/ui/src` and `apps/web/src` from one file — this is the first cross-package sweep test, hence Task 1.2's explicit instruction to verify the relative path climb empirically rather than assume it.

### Architecture & UX Gate Findings

- **Gate 1 — No gap found.** Fresh for this story. A pure static-analysis test file; no backend/API/infra of any kind.
- **Gate 2 — No gap found.** No UI component, no new state/variant/a11y surface — this story adds a test, not a component.
- **Gate 3 — No gap found.** This story is itself the ratchet AD-33 Rule 4 mandates — it is the cross-cutting enforcement mechanism, not a story that depends on one not yet built.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — a test file, no data model.
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: Purely additive (one new test file); cannot regress any existing behavior. Its only "rollout risk" is a false positive against a legitimate future use of `isolate` + a tier-adjacent-looking class, which AC1's word-boundary-safe regex and AC4's explicit Local-tier exemption are designed to avoid.
- Verification checks: Task 2's green-run-against-the-real-tree, plus Task 2.2's deliberate regression probe proving the test actually catches a reintroduced violation (not just that it passes vacuously).

### Project Structure Notes

- New directory `packages/ui/src/__tests__/` — confirm this doesn't collide with any existing colocated-test convention; it is intentionally distinct (a repo-wide sweep, not a per-component test) and should be named/commented as such so a future reader doesn't mistake it for `packages/ui`'s per-file test style.
- No conflicts detected.

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-33] (Rule 4, in full — this story's entire scope)
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] (ratchet-as-executable-check requirement, cited generally by this project's epic-formation-gate.md §4)
- [Source: _bmad-output/implementation-artifacts/0-49-add-z-index-layering-tier-tokens-and-the-overlay-modal-z-constant.md] through [0-49d-...] (the four prerequisite stories this ratchet verifies)

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Layering (z-index tiers)" rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md`
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-33 Rule 4.
- [x] `docs/infrastructure/index.md` — consulted; not applicable.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`
  - **Not touched:** any production source file; any CI config (unless the repo's CI explicitly lists test paths rather than globbing — see Task 3).
- **Rule Mapping:**
  - AD-33 Rule 4 → this story's entire scope, both assertions.
- **Verification Plan:**
  - The ratchet test itself, run clean against the post-0.49d tree (Task 2.1).
  - A deliberate, reverted regression probe proving the test actually fails on a reintroduced violation (Task 2.2).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — one new Vitest source-scan test file, two assertions, zero production-code change.
- [ ] Architecture and boundary confirmation — `packages/ui` only (the test file's location); scans `apps/web/src` by path, not by cross-package import.
- [ ] Testing plan confirmation — Task 2's green run + regression probe.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — no gap for this story; depends on Stories 0.49-0.49d being done (sequencing, not a gate finding).

## Testing Requirements

- [ ] Integration tests — Not applicable (this story's deliverable is itself a test).
- [ ] E2E tests — Not applicable.

## Deliverables Checklist

- [ ] `ad33-z-index-layering.ratchet.test.ts` created with both assertions, passing green against the fully-migrated tree.
- [ ] Task 2.2's regression probe performed and confirmed catching a reintroduced violation (and reverted before commit).

## Out of Scope

- Any production-code migration — Stories 0.49-0.49d.
- Any check for Local-tier `isolate` correctness — explicitly out of scope per AD-33 Rule 4 (a code-review convention, not a CI gate).
- Any ESLint rule — explicitly rejected by AD-33 Rule 4.

## Definition of Done

- [ ] AC1–AC6 satisfied.
- [ ] The ratchet test passes cleanly against the post-0.49d tree and is confirmed (by the Task 2.2 probe) to actually catch a reintroduced violation.
- [ ] No ESLint rule, no new CI script, added.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5)

### Debug Log References

- First run of the new test flagged 2 false-positive hits for Assertion 1 (`z-50`) inside existing JSDoc comments: `packages/ui/src/core/overlay-z.ts:4` (its own doc-comment explaining the anti-pattern it prevents) and `packages/ui/src/features/events/CalendarOverflowDialog.tsx:33` (a transcription of a `DESIGN.md` token's source value inside a doc comment). Both files' actual code already correctly imports/uses `OVERLAY_MODAL_Z`; the matches were against comment prose, not real Tailwind class usage. Added a `stripComments` pass (blanks `/* */` and `//` comment content, preserving newlines/line numbers) before applying both regexes, which resolved both false positives without narrowing the regexes themselves. Re-ran clean (2/2 passing) — `pnpm exec vitest run src/__tests__/ad33-z-index-layering.ratchet.test.ts` from `packages/ui`.
- Task 2.2 regression probe: temporarily replaced `${OVERLAY_MODAL_Z}` with `z-50` on `apps/web/src/components/ui/dialog.tsx:25` (scratch, uncommitted). Re-ran the test: Assertion 1 failed, naming `../../apps/web/src/components/ui/dialog.tsx:25 -> \`z-50\`` exactly. Reverted the file from a pre-edit backup; `git status --short` on the file showed no diff afterward, and the test suite re-ran green (2/2).
- Package-scoped lint: `pnpm --filter @festgrid/ui lint` (eslint, `--max-warnings 0`) — 0 errors/warnings.
- No build/type-check script exists in `packages/ui/package.json` (only `test` and `lint`); none was skipped, none applies.
- Confirmed `.github/workflows/ci.yml`'s test job runs `pnpm run test` (repo-wide, relying on Vitest's default test-file discovery glob), not an explicit list of test paths — no CI config edit needed (Task 3.1 / AC6).

### Completion Notes List

- Implemented both AD-33 Rule 4 assertions as a single new Vitest source-scan test file, `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`: Assertion 1 (AC1) walks `packages/ui/src` and `apps/web/src` for a whole-token match of the four reserved z-index tier values (`z-40/45/50/60`, bare or `z-[N]`); Assertion 2 (AC2/AC3) scans the same files (excluding `packages/ui/src/core/overlay-z.ts`) for a hardcoded `'z-overlay-modal'`/`"z-overlay-modal"` literal. Neither assertion touches `z-0/10/20/30` (AC4 — Local tier stays a code-review convention, not scanned at all).
- No production code was modified — this story's only deliverable is the test file itself, per its Implementation Plan and Out of Scope section.
- Verification Plan executed and confirmed, not just implemented-to-match: Task 2.1's green run against the current (post-0.49/a/b/c/d) tree passed 2/2 with zero failures; Task 2.2's deliberate regression probe (reintroduce raw `z-50` in `apps/web/src/components/ui/dialog.tsx`, confirm the test names that exact file/line, then revert) was performed and confirmed, and the scratch edit was reverted before this commit (`git status --short` on the file is clean).
- Prerequisite check: Stories 0.49, 0.49a, 0.49b, 0.49c, 0.49d are all at sprint-status `review` (not yet `done`), but their migration code is already committed on this branch (commits `6b8e3b87`, `ebdc9608`, `58069bf5`, `dfe45a05`, and `fc90333b`/`e07295f9` for 0.49b) — i.e. the "post-migration tree" AC5 requires already exists. User explicitly approved proceeding on this basis (Pre-Coding Approval Gate) rather than blocking on those stories' sprint-status reaching `done`.
- Package-scoped lint (`pnpm --filter @festgrid/ui lint`) passes with zero errors/warnings. `packages/ui` has no build/type-check script to run. No whole-repo lint/build/test was run, per this story's UI-lane scope.

### File List

- `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts` (new)

## Change Log

- 2026-10-07: Implemented AD-33 Rule 4 ratchet test (both assertions), confirmed green against the post-0.49/a/b/c/d tree, and confirmed the regression probe catches a reintroduced raw `z-50` (reverted before commit). Status moved to review.
