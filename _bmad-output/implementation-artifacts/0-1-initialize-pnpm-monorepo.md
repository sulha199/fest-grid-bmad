---
baseline_commit: 1c36b8e5bfd8eae626ef3fcbdc8f158bad523119
---

# Story 0.1: Initialize pnpm monorepo

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** developer,  
**I want** to initialize a pnpm monorepo with a Next.js frontend app and a shared-types package,  
**so that** I can start building the FestGrid application with a scalable and maintainable codebase.

## Acceptance Criteria

1. **Given** I am in the project's root directory
2. **When** I run `pnpm install`
3. **Then** all dependencies for the frontend app and shared-types package are installed successfully.
4. **And** the Next.js application can be started in development mode without errors.
5. **And** the `shared-types` package can be imported into the Next.js application.

## Tasks / Subtasks

- [x] Task 1: Scaffolding Monorepo structure (AC: 1, 2)
  - [x] Create `pnpm-workspace.yaml` with configured paths: `apps/*` and `packages/*`
  - [x] Set up root-level `package.json` with workspace devDependencies (e.g. `turbo`, `typescript`, `eslint`)
- [x] Task 2: Configure shared-types package (AC: 3, 5)
  - [x] Initialize `packages/shared-types` with its own `package.json` and basic types
  - [x] Configure `tsconfig.json` for shared-types, ensuring it matches project-context guidelines (strict mode, etc.)
- [x] Task 3: Scaffold Next.js frontend application (AC: 4, 5)
  - [x] Initialize Next.js 15+ & React 19 application inside `apps/web` or similar as per monorepo structure
  - [x] Configure Next.js application to import `@festgrid/shared-types` from workspace packages
- [x] Task 4: Verify Monorepo configuration (AC: 3, 4, 5)
  - [x] Run `pnpm install` at root and verify dependency resolution and symlinking
  - [x] Run next-dev server and ensure there are no compilation errors during import

## Dev Notes

- **Workspace Path Aliases:** Must use `@festgrid/shared-types` (defined via monorepo path aliases) for all internal package imports [Source: `_bmad-output/project-context.md#General Architecture`].
- **Tech Stack Compliance:** Next.js 15+ and React 19, strict mode enabled in all tsconfig.json configurations.
- **Pnpm & Turbo:** The project uses `pnpm` as the package manager and `turbo` for monorepo task execution.

### Project Structure Notes

- Pure business logic must eventually reside in a `packages/domain` workspace package [Source: `_bmad-output/project-context.md#Code Organization`]. However, for this initialization story, we are scaffolding the core `apps/web` and `packages/shared-types`.

### References

- **Project Context Rules:** See `_bmad-output/project-context.md` sections "Technology Stack & Versions" and "General Architecture".

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (via VS Code Cline)

### Debug Log References

None. Build succeeded cleanly with `pnpm install --ignore-scripts` and `turbo run build`.

### Completion Notes List

- Successfully initialized the pnpm workspace with configured paths `apps/*` and `packages/*`.
- Configured a private root `package.json` with workspace dependencies including `turbo`, `typescript`, and `eslint`.
- Scaffolded `@festgrid/shared-types` package with a strict `tsconfig.json` and basic types (e.g. `Event`, `User`).
- Scaffolded a Next.js 15+ App Router application under `apps/web` referencing the workspace packages.
- Added a root-level `turbo.json` config.
- Installed workspace dependencies cleanly and executed `pnpm exec turbo run build`, verifying that TypeScript types are successfully imported from `@festgrid/shared-types` and compiled without any errors.

### File List

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `packages/shared-types/package.json`
- `packages/shared-types/tsconfig.json`
- `packages/shared-types/src/index.ts`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next-env.d.ts`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`

### Review Findings

- [x] [Review][Defer] Missing next-intl integration vs. project i18n constraint — deferred, pre-existing (Reason: To address i18n setup in a dedicated workspace setup story)
- [x] [Review][Patch] Namespace Inconsistency in Workspace Configurations [packages/eslint-config/package.json:2]
- [x] [Review][Patch] Next.js ESLint Plugin Version Mismatch [packages/eslint-config/package.json:12]
- [x] [Review][Patch] Redundant React import in Next.js 15 + React 19 pages [apps/web/src/app/page.tsx:1]
- [x] [Review][Patch] Ambiguous Event Date Representation [packages/shared-types/src/index.ts:13]
