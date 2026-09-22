---
baseline_commit: dc39a681217e21ba0cf7b2046ec4abbc768f6c14
---

# Story 0.44: Define the testing standard for meta-testing/tooling packages

## Story Details

- Epic: 0
- Story ID: 0.44
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `project-context.md`'s Testing Rules section amended with an explicit third tier for a "meta-testing/tooling package" — a package whose job is to help verify *other* code (e.g. `packages/visual-audit`), rather than implement application/domain logic or a user-facing `apps/*` surface itself,
so that Story 0.43 and its future adopters (the AD-27 masonry engine story, the BUG-040 date-box fix story, and any later package in this same category) share one deliberate, project-wide testing/DoD convention instead of each inventing or silently copying whatever the first one happened to do.

## Acceptance Criteria

1.  **Given** `project-context.md`'s Testing Rules section today defines exactly two tiers — `packages/domain` (100% unit coverage, "the *only* place unit tests should be written") and `apps/*` (testing-trophy: integration-first via Vitest/msw, E2E for critical paths only) — with no tier that fits a package like `packages/visual-audit` that is neither pure domain logic nor a user-facing app, **When** this story ships, **Then** `project-context.md` gains a third, explicitly named tier — **"Meta-Testing / Tooling Packages"** — inserted after the existing two tiers in the Testing Rules section, so the section reads as a closed three-way partition rather than two tiers plus an implicit gap.
2.  **Given** the new tier must state what "done" testing looks like for such a package, **When** the tier is written, **Then** it states: unit tests for the package's own pure logic (comparison/tolerance/clustering/parsing functions — anything with no browser/AST-tool dependency) are required, using the `tsx --test *.test.ts` pattern already established by `packages/graphql-select` (not Vitest/testing-trophy, and not `packages/domain`'s 100%-coverage rule) — because a small, dependency-light workspace package with a `test`/`lint`/`build` script triad is the existing precedent this tier codifies, not a new invention.
3.  **Given** the 100%-unit-coverage rule is `packages/domain`'s defining trait and does not automatically transfer, **When** the tier addresses coverage, **Then** it explicitly states the 100%-coverage bar does **not** apply to a meta-testing/tooling package — coverage is judged qualitatively (are the pure-logic branches that matter covered), matching `packages/graphql-select`'s own unenforced-percentage precedent, not `packages/domain`'s.
4.  **Given** a meta-testing/tooling package's own hardest-to-unit-test surface is code that itself drives browser automation or static-analysis tooling (e.g. `packages/visual-audit`'s Playwright `fixtures.mount()` render harness, its `toHaveScreenshot()` pixel-diff wiring, its `ts-morph` AST branch-enumeration) — meta-testing in the literal sense of testing the tester — **When** the tier addresses this, **Then** it states that such surfaces are **not** required to carry their own unit tests in the traditional sense; instead, the package's own example/proof artifacts (e.g. `packages/visual-audit`'s 1–2 example manifest entries actually running end-to-end against a real fixture) serve as this surface's integration proof, and running them successfully (not just existing) is a Definition-of-Done requirement. This deliberately avoids the trap of writing mocked/stubbed tests for a tool whose entire value is exercising real browser/AST behavior — a mock of Playwright's `getComputedStyle()` or `ts-morph`'s AST walker would validate the mock, not the tool.
5.  **Given** this tier will be reused by future packages in the same category, **When** the tier is written, **Then** it gives a decidable one-line test (not just examples) for "does a package belong in this tier" — e.g. *a package that ships zero production UI/API surface, is never bundled into an `apps/*` production build, and exists to verify other code's behavior rather than implement product behavior* — so a future `bmad-create-story` Gate 3 pass can classify a new package without re-litigating this decision from scratch.
6.  **Given** Story 0.43's own Dev Notes/Definition of Done already shipped a scoped, self-declared testing decision under its Gate 3 finding's Escape Hatch clause (AC13: `tsx --test` unit tests for pure logic + example manifest entries as integration proof, pending this story), **When** this story ships, **Then** Story 0.43's self-declared decision is checked against the new tier's rule: **confirmed to already match** (same `tsx --test` pattern, same no-100%-coverage stance, same example-manifest-as-integration-proof shape) — so Story 0.43 is amended (see Dev Notes below and the separate 0.43 file amendment) to reference this story's now-canonical rule instead of re-declaring its own scoped DoD, rather than requiring a substantive redesign of 0.43's testing plan.
7.  **Given** `project-context.md`'s Usage Guidelines call for the file to stay lean, **When** the new tier is added, **Then** it is scoped to testing/DoD content only — it does not restate `packages/domain`'s or `apps/*`'s existing rules, does not introduce a new lint/CI mechanism, and does not touch any other section of `project-context.md` (Technology Stack, Critical Implementation Rules, etc.).

## Tasks / Subtasks

- [x] Task 1 — Draft the new Testing Rules tier (AC: #1, #2, #3, #4, #5, #7)
  - [x] Insert a new "Meta-Testing / Tooling Packages" subsection into `_bmad-output/project-context.md`'s `### Testing Rules` section, positioned after the existing `packages/domain` and `apps/*` bullets so the three-tier partition reads in order.
  - [x] State the unit-testing requirement for pure logic (`tsx --test` pattern, `packages/graphql-select` precedent cited by name).
  - [x] State the no-100%-coverage stance explicitly (qualitative judgment, not a percentage gate).
  - [x] State the example/proof-artifact-as-integration-proof rule for browser-automation/AST-analysis surfaces that cannot be meaningfully unit-tested without mocking away the thing being verified.
  - [x] State the one-line classification test for "does a package belong in this tier."
- [x] Task 2 — Reconcile Story 0.43 against the new rule (AC: #6)
  - [x] Confirm Story 0.43's AC13/Dev Notes/Definition of Done testing decision matches the new tier exactly (it does — see Dev Notes below for the side-by-side).
  - [x] Amend Story 0.43's file (`_bmad-output/implementation-artifacts/0-43-visual-fidelity-audit-tool.md`) and its `epics.md` section: add a `Depends on: Story 0.44` note, revise/replace AC13 to reference this story's tier instead of self-declaring, and add a Pre-Coding Approval Gate note blocking `bmad-dev-story` for 0.43 until this story reaches `done` — **already performed in a prior commit (`dc39a681`, same session that created both story files); verified during this session's dev-story run to already match this story's shipped tier exactly (Depends-on note at line 8/915, revised AC13 at line 32/935, blocking Pre-Coding Approval Gate item at line 140/1038), so no further edit to either file was needed.**
- [x] Task 3 — Verification (AC: #1–#7)
  - [x] Re-read the amended `project-context.md` Testing Rules section end-to-end to confirm it reads as a coherent three-tier partition with no contradiction against the existing two tiers.
  - [x] Confirm no other `project-context.md` section was touched (diff review).

## Dev Notes

- **This is a documentation-only story.** It ships zero code, zero package, zero test file of its own — its sole deliverable is an amendment to `_bmad-output/project-context.md`'s Testing Rules section, plus the downstream amendment to Story 0.43's file. There is nothing in `packages/domain` or `apps/*` for this story itself to test; "testing" this story means verifying the written rule is internally consistent and correctly reconciled against 0.43, which Task 3 covers via direct read-through rather than an automated test suite. This is itself a small piece of evidence for AC5's classification test working as intended (a policy-writing story is trivially *not* a meta-testing/tooling *package*, so it doesn't need to apply its own new tier to itself).
- **Why this story exists:** split via a Gate 3 finding (`story-split-gate.md`, `FIND-047`) surfaced during `bmad-create-story`'s Story 0.43 drafting (2026-09-22, Winston persona). Story 0.43 is the first-of-a-kind dev-tooling/meta-testing package in this repo, and `project-context.md`'s Testing Rules section is a closed two-tier partition (`packages/domain`: 100%-unit; `apps/*`: testing-trophy) that fits neither. Left undecided, Story 0.43 would have set an ad-hoc precedent by accident rather than a deliberate, project-wide rule — and its own future adopters (the AD-27 masonry engine story, the BUG-040 fix story) would inherit whatever that accident produced.
- **User's explicit sequencing decision (2026-09-22):** when asked whether Story 0.43 should proceed immediately under its own self-declared scoped DoD (the Escape Hatch/AC13 path) or wait for this story to properly define the standard first, the user chose **0.44 first, then 0.43** — rejecting the Escape Hatch path in favor of proper sequencing. This is why Story 0.43's file is being amended (Task 2) to depend on this story rather than proceeding under its own AC13, even though AC13 was written to allow exactly that.
- **Side-by-side: Story 0.43's self-declared decision vs. this story's tier** (confirms AC6's "already matches" finding):
  - Unit-test pattern: 0.43 Dev Notes cite `tsx --test *.test.ts` mirroring `packages/graphql-select` → this story's tier states the identical pattern.
  - Coverage bar: 0.43's Task 10 implies coverage of "pure comparison/tolerance/clustering/branch-enumeration logic" without claiming 100% → this story's tier explicitly makes the no-100%-rule a first-class statement rather than an implication.
  - Integration proof: 0.43's AC11/Task 9/Task 10 treat its 1–2 example manifest entries as the story's "own integration proof" → this story's tier generalizes this into the permanent rule (AC4).
  - Net effect: no substantive redesign of Story 0.43's testing plan is needed — only its AC13 text changes (from self-declaring to referencing), per Task 2.
- **Package boilerplate/testing precedent referenced by this story (already load-bearing for the rule, not new research):**
  - `packages/graphql-select/package.json`: `"test": "tsx --test *.test.ts"`, `"lint"`, `"build"` script triad, `@festgrid/eslint-config`/`@festgrid/typescript-config` devDependencies — the shape this tier's unit-testing rule points to.
  - `packages/testing-config/package.json`: exists as the shared Vitest/msw/testing-library setup consumed by `apps/*`'s testing-trophy tier — confirms that tier's tooling is deliberately separate from `packages/graphql-select`'s plain `tsx --test`, i.e. the monorepo already has precedent for "not every package uses the same test runner," which is the structural fact this new tier formalizes for a third case.
  - `_bmad-output/implementation-artifacts/0-43-visual-fidelity-audit-tool.md` (read in full for this story's drafting): its Playwright `fixtures.mount()` component-render harness and `ts-morph` AST branch-enumeration are the concrete "testing the tester" surfaces AC4 is written to cover — a tool that renders components and reads `getComputedStyle()`/`scrollWidth` cannot be meaningfully unit-tested by mocking Playwright's own DOM introspection without validating the mock instead of the tool; its value can only be proven by actually running it against a real fixture, which is exactly what an example manifest entry does.

### Architecture & UX Gate Findings

- **Gate 1 (Winston, Architecture/Infrastructure Completeness): No gap found.** This story edits a single markdown documentation file (`project-context.md`) and, as a follow-on amendment, a second story file (`0-43-...md`) plus its `epics.md` section. No production code, no package, no API surface, no database/GraphQL/infra touchpoint of any kind. Nothing to bypass, no external service call, no IaC.
- **Gate 2 (Freya, UI Complexity & Reusability): No gap found.** This story ships zero UI. There is no component, hook, or visual surface to evaluate for split-worthiness.
- **Gate 3 (Winston, Foundational/Cross-Cutting Dependency Completeness): No gap found — self-referential check considered and dismissed.** The obvious question this gate must ask of a story that is itself the product of a prior Gate 3 finding is whether *this* story implicitly depends on some other not-yet-built foundational piece. Reasoned check: the only "consumer" of this story's output today is Story 0.43 (handled directly by this story's own Task 2, not deferred to a new split), and the only other named future consumers (AD-27's masonry story, BUG-040's fix story) do not yet exist as stories, so there is nothing further to split off on their behalf — when they are drafted, they simply inherit the now-canonical tier like any other package, the same way a new `apps/*` story today inherits the testing-trophy tier without needing its own foundational story. No shared infrastructure, i18n, analytics, or code-generator dependency applies to a documentation-only story. Confirmed via direct review of `project-context.md`'s full Testing Rules and Usage Guidelines sections (read in Step 2/3 above) that no other section needs a corresponding update for this change to be coherent.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story introduces no database schema, no GraphQL types, and no TypeScript models of any kind.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required.
- Backward compatibility and rollout notes: Not applicable — a documentation rule addition has no runtime surface to break.
- Verification checks: Direct read-through of the amended `project-context.md` section (Task 3) is sufficient; no build/lint/test command applies to a markdown-only change.

### Project Structure Notes

- No new package, no new directory. The only files touched are `_bmad-output/project-context.md` (new subsection under existing `### Testing Rules`), `_bmad-output/implementation-artifacts/0-43-visual-fidelity-audit-tool.md` (amendment), and `_bmad-output/planning-artifacts/epics.md` (Story 0.43's section, amendment).
- No conflicts detected with the existing monorepo structure.

### References

- [Source: _bmad-output/project-context.md#Testing-Rules] — the two-tier section this story amends.
- [Source: _bmad-output/implementation-artifacts/0-43-visual-fidelity-audit-tool.md] — the originating story; AC13, Dev Notes, Gate 3 finding, and Pre-Coding Approval Gate item all read in full for this story's drafting.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.44] — this story's epics.md section, already drafted by Gate 3 during Story 0.43's creation; read and reconciled against, not duplicated with divergent wording.
- [Source: packages/graphql-select/package.json, packages/testing-config/package.json] — existing small-package/testing-tooling precedent cited by the new tier.

## Global Rules References

- [x] project-context.md — this story amends the Testing Rules section directly; no other section touched.
- [x] story-content-structure.md — canonical section order followed.
- [x] architecture spine — not applicable (no AD touched; this is a project-context.md process rule, not an architecture decision).
- [x] infrastructure docs — not applicable.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `_bmad-output/project-context.md` (new "Meta-Testing / Tooling Packages" subsection under `### Testing Rules`)
  - Modified: `_bmad-output/implementation-artifacts/0-43-visual-fidelity-audit-tool.md` (Depends-on note, AC13 revision, Pre-Coding Approval Gate note)
  - Modified: `_bmad-output/planning-artifacts/epics.md` (Story 0.43's section, mirroring the same amendment)
- **Rule Mapping:** AC1→tier insertion/positioning; AC2→unit-test pattern statement; AC3→no-100%-coverage statement; AC4→example-artifact-as-integration-proof statement; AC5→one-line classification test; AC6→Story 0.43 reconciliation; AC7→scope discipline (no other section touched).
- **Verification Plan:** Direct read-through of the amended `project-context.md` Testing Rules section for internal consistency; direct read-through of Story 0.43's amended AC13/Pre-Coding Approval Gate for correct reconciliation. No automated test/build/lint command applies (documentation-only change).

## Pre-Coding Approval Gate

- [x] Scope confirmation: documentation-only — one new `project-context.md` subsection plus the Story 0.43/epics.md reconciliation amendment; no code, no package.
- [x] Architecture and boundary confirmation: no AD, no infra, no API surface.
- [x] Testing plan confirmation: read-through verification only, per Data Type Compatibility section's Verification checks.
- [x] Explicit human approval state: user already confirmed the sequencing decision that makes this story a prerequisite ("0.44 first, then 0.43") — no further approval blocker.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates returned "No gap found" (see Architecture & UX Gate Findings above).

## Testing Requirements

- [ ] Read-through verification of the amended `project-context.md` Testing Rules section for internal consistency (three-tier partition, no contradiction).
- [ ] Read-through verification that Story 0.43's amended AC13/Pre-Coding Approval Gate correctly references this story's tier.

## Deliverables Checklist

- [ ] `project-context.md` gains the "Meta-Testing / Tooling Packages" Testing Rules tier (AC1–AC5, AC7)
- [ ] Story 0.43's file amended: `Depends on: Story 0.44` note, revised AC13, new Pre-Coding Approval Gate blocking note (AC6)
- [ ] `epics.md`'s Story 0.43 section amended to match (AC6)

## Out of Scope

- Building or modifying `packages/visual-audit` itself — that remains Story 0.43's own scope.
- Any change to `packages/domain`'s or `apps/*`'s existing Testing Rules tiers — untouched, per AC7.
- Retroactively classifying any other existing package (e.g. `packages/testing-config`, `packages/graphql-select` itself) under the new tier — the new tier's classification test (AC5) is available for future use but this story does not re-audit past packages against it.

## Definition of Done

- [ ] AC satisfaction (AC1–AC7)
- [ ] `project-context.md` Testing Rules section reads as a coherent three-tier partition
- [ ] Story 0.43 and its `epics.md` section amended and reconciled

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`), via `bmad-dev-story`.

### Debug Log References

- Initial `npx tsx src/run-check.ts --kind test` (unfiltered) reported 1 failure in `web`, traced to every `next-intl`-importing test file failing with `Failed to resolve import "next-intl"`. Root cause: a broken pnpm symlink in `apps/web/node_modules/next-intl` pointing at a `.pnpm` store entry that did not exist on disk — a pre-existing local environment defect, unrelated to this story's documentation-only change (verified: the diff touches only `_bmad-output/project-context.md`, `_bmad-output/implementation-artifacts/0-44-...md`, and `sprint-status.yaml`; nothing under `apps/web`). Fixed by running `pnpm install --frozen-lockfile` at the repo root (lockfile unchanged, only missing/broken node_modules entries were restored). Re-ran `--kind test --filter web` afterward: all green. Re-ran the full unfiltered `--kind test` afterward: 11/11 tasks passed.
- Confirmed via `git diff -- _bmad-output/project-context.md` that only the Testing Rules section changed (AC7 scope discipline).
- Confirmed Story 0.43's `Depends on: Story 0.44` note, revised AC13, and blocking Pre-Coding Approval Gate item — plus the mirrored amendment in `epics.md`'s Story 0.43 section — were already present from the prior session's commit (`dc39a681`) that created both story files together, and match this story's shipped tier text exactly (same `tsx --test` pattern, same no-100%-coverage stance, same example-manifest-as-integration-proof shape). No further edit to either file was required for Task 2/AC6.

### Completion Notes List

- Task 1: Inserted the "Meta-Testing / Tooling Packages" tier into `_bmad-output/project-context.md`'s `### Testing Rules` section, positioned after the existing `packages/domain` and `apps/*` bullets. Covers: unit-test requirement for pure logic via `tsx --test` (packages/graphql-select precedent, named), explicit no-100%-coverage stance (qualitative judgment), the example/proof-manifest-as-integration-proof rule for browser-automation/AST-analysis surfaces, and a one-line classification test. No other `project-context.md` section touched (AC7; verified via `git diff`).
- Task 2: Verified Story 0.43's file and its `epics.md` section already carry the correct reconciliation (added in the prior session alongside this story's own creation) — AC6 confirmed satisfied without further edits needed.
- Task 3: Read through the amended Testing Rules section end-to-end — reads as a coherent, closed three-tier partition with no contradiction against the two existing tiers. Diff-reviewed `project-context.md` to confirm no other section was touched.
- This is a documentation-only story: no application code, package, or test file was added. Per the story's own Dev Notes, "testing" this story means direct read-through verification (Task 3), not new automated tests. The mandatory `run-check.ts` test/lint/build gates were still run in full per the skill's own requirement and all passed clean (11/11 test tasks, 7/7 lint tasks, 7/7 build tasks) — the one failure encountered along the way was a pre-existing, unrelated environment defect (see Debug Log References), not caused by or curable within this story's own change.

### File List

- `_bmad-output/project-context.md` (modified) — new "Meta-Testing / Tooling Packages" Testing Rules tier
- `_bmad-output/implementation-artifacts/0-44-define-testing-standard-for-meta-testing-tooling-packages.md` (modified) — this story file: baseline_commit frontmatter, Tasks/Subtasks checkboxes, Dev Agent Record, File List, Change Log, Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — status `ready-for-dev` → `in-progress` → `review`
- `_bmad-output/implementation-artifacts/0-43-visual-fidelity-audit-tool.md` and `_bmad-output/planning-artifacts/epics.md` (verified, not modified this session — already amended in prior commit `dc39a681`; confirmed to match this story's shipped tier, satisfying AC6/Task 2)

## Change Log

- 2026-09-22: Drafted and shipped the "Meta-Testing / Tooling Packages" Testing Rules tier in `project-context.md` (AC1-AC5, AC7); verified Story 0.43's already-existing reconciliation matches exactly (AC6, no further edit needed). Verified `npx tsx src/run-check.ts --kind test|lint|build` (unfiltered) all green — 11/11 test tasks, 7/7 lint tasks, 7/7 build tasks — after fixing an unrelated pre-existing broken `next-intl` pnpm symlink via `pnpm install --frozen-lockfile` (no lockfile change). Status moved `ready-for-dev` → `in-progress` → `review`.
