# Story 0.1: Initialize the orchestrator project scaffold

## Story Details

- Epic: 0
- Story ID: 0.1
- Status: done

## Story

As a developer setting up the orchestrator,
I want a working TypeScript project with pnpm, the pinned dependency set, and the structural-seed directory layout in place,
So that every subsequent story has somewhere correct to add code.

## Acceptance Criteria

1. **Given** an empty project directory, **when** the scaffold story is complete, **then** `package.json` pins `packageManager: "pnpm@9.15.4"` and `engines.node: ">=22.0.0"`, `tsconfig.json` targets TypeScript 6.0.3 in strict mode, and `eslint.config.js` is a standalone flat config (not `@festgrid/eslint-config`). [epics.md AC1]
2. **And** the `src/core/`, `src/adapters/`, `src/config/`, `src/logging/` directory skeleton from the architecture spine's Structural Seed exists with empty/placeholder files. [epics.md AC2]
3. **And** `vitest` is installed with a `vitest.config.ts`, and `package.json` has `test`/`lint`/`build` scripts wired to it, ESLint, and `tsc` respectively — every story from 0.2 onward writes a Vitest test, so the runner must exist before any of them can. [epics.md AC3]
4. **And** `pnpm install` and `pnpm build` both succeed with zero source files beyond placeholders, and `pnpm test` succeeds (trivially, with zero test files). [epics.md AC4]

## Tasks / Subtasks

- [x] Task 1: Create the orchestrator project package.json with pinned packageManager, engines, and dependencies/scripts. (AC: 1, 3)
- [x] Task 2: Configure TypeScript 6.0.3 strict mode via tsconfig.json. (AC: 1, 4)
- [x] Task 3: Create a standalone ESLint flat configuration (eslint.config.js). (AC: 1, 4)
- [x] Task 4: Establish the directory skeleton (src/core/, src/adapters/, src/config/, src/logging/) from the Structural Seed with placeholder index.ts/index.test.ts files. (AC: 2)
- [x] Task 5: Configure Vitest with vitest.config.ts and verify it works cleanly. (AC: 3)
- [x] Task 6: Run `pnpm install`, `pnpm build`, `pnpm lint`, and `pnpm test` to verify the scaffold builds and tests successfully. (AC: 4)

## Dev Notes

- **Architecture and Technical Constraints**: Standalone Node.js project under the monorepo root (at `ai-dev-orchestrator/`), but as a standalone initiative. The stack requires Node 22, TypeScript 6.0.3, ESLint 9.x, Vitest 4.1.11, etc.
- **File/Path Expectations**: All source code under `ai-dev-orchestrator/src/`.
- **Data/API Boundary Constraints**: Not applicable for scaffold.
- **References to Source Artifacts**: `_bmad-output/planning-artifacts/ai-dev-orchestrator/epics.md`, `ARCHITECTURE-SPINE.md`.
- **Architecture & UX Gate Findings**: Cites findings from `epic-0-readiness.md` (`swept: true`). Gate 1 and Gate 3 findings are already covered in the readiness check. Story 0.1 gained Vitest/lint setup requirements from the readiness sweep Gate 3 findings to avoid ad-hoc test runner setup later. Gate 2 (UI) is not applicable because it's a CLI tool. Verdict: No UI gap found.

## Global Rules References

- Project Context: `_bmad-output/project-context.md`
- Story Content Structure: `_bmad-output/planning-artifacts/story-content-structure.md`
- Architecture Spine: `_bmad-output/planning-artifacts/architecture/architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md`
- Infrastructure Docs: `_bmad-output/planning-artifacts/ai-dev-orchestrator/implementation-readiness-report-2026-08-21.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `ai-dev-orchestrator/package.json` (NEW)
- `ai-dev-orchestrator/tsconfig.json` (NEW)
- `ai-dev-orchestrator/eslint.config.js` (NEW)
- `ai-dev-orchestrator/vitest.config.ts` (NEW)
- `ai-dev-orchestrator/src/core/index.ts` (NEW)
- `ai-dev-orchestrator/src/adapters/index.ts` (NEW)
- `ai-dev-orchestrator/src/config/index.ts` (NEW)
- `ai-dev-orchestrator/src/logging/index.ts` (NEW)

### Rule Mapping
- Monorepo alignment: Uses pnpm@9.15.4 and Node.js >=22.0.0.
- Package isolation: Not importing `@festgrid/eslint-config` or React libraries since it's a standalone CLI.
- Pure typescript skeleton.

### Verification Plan
- Verify with terminal commands: `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm test` all exit cleanly.

## Pre-Coding Approval Gate

- [x] Scope confirmation: The scope is limited strictly to establishing the project directory layout, configuration files, and placeholders.
- [x] Architecture and boundary confirmation: No domain, frontend, or backend dependencies are leaked; it remains a standalone node/pnpm project.
- [x] Testing plan confirmation: Vitest configured as the test runner.
- [x] Human approval state: [x] Approved

## Testing Requirements

- Vitest installed as devDependency.
- Configuration file `vitest.config.ts` exists.
- `test` script in `package.json` executes `vitest run` or similar.

## Deliverables Checklist

- [x] `ai-dev-orchestrator/package.json`
- [x] `ai-dev-orchestrator/tsconfig.json`
- [x] `ai-dev-orchestrator/eslint.config.js`
- [x] `ai-dev-orchestrator/vitest.config.ts`
- [x] `ai-dev-orchestrator/src/core/index.ts`
- [x] `ai-dev-orchestrator/src/adapters/index.ts`
- [x] `ai-dev-orchestrator/src/config/index.ts`
- [x] `ai-dev-orchestrator/src/logging/index.ts`

## Out of Scope

- Implementing any functional adapters (9Router LLM adapter, local exec adapter, etc.).
- Designing any CLI command-line parameters parser beyond a stub.
- Implementing graph nodes or LangGraph state machine.

## Definition of Done

- Pinned node and pnpm versions match `engines` and `packageManager`.
- Project compiles cleanly via `tsc`.
- Linter runs with no errors.
- Vitest test runner runs with zero failing tests.

## Completion Status

- done

## Dev Agent Record

- (leave blank or standard placeholders)
