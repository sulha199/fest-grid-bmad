---
baseline_commit: b505eb5aff79ba6bac8c59f29465056b55767ff6
---

# Story 0.2: Configure TypeScript and ESLint for the monorepo

Status: done

## Story

**As a** developer,  
**I want** to have TypeScript and ESLint configured for the monorepo with strict rules, using a global configuration that is inherited by all packages,  
**so that** I can ensure code quality and consistency across the project.

## Acceptance Criteria

1. **Given** the pnpm monorepo is initialized,
2. **When** I create a new TypeScript file in either the frontend app or the shared-types package,
3. **Then** the code is type-checked and linted according to the project's rules.
4. **And** running the `lint` script in the root of the monorepo checks all packages.
5. **And** the configuration enforces strict TypeScript settings.
6. **And** there is a global base configuration in `packages/typescript-config` and `packages/eslint-config` that are extended by the individual packages.

## Tasks / Subtasks

- [x] Task 1: Document in project context that all workspace packages extend from packages/eslint-config and packages/typescript-config (AC: 6)
  - [x] Update `_bmad-output/project-context.md` to specify that packages must extend global ESLint configurations from `packages/eslint-config` and TypeScript configurations from `packages/typescript-config`
- [x] Task 2: Configure TypeScript inheritance (AC: 5, 6)
  - [x] Add `@festgrid/typescript-config` as a devDependency in `packages/shared-types/package.json` and `apps/web/package.json`
  - [x] Update `packages/shared-types/tsconfig.json` to extend `@festgrid/typescript-config/base.json`
  - [x] Update `apps/web/tsconfig.json` to extend `@festgrid/typescript-config/nextjs.json`
- [x] Task 3: Configure ESLint Flat Config inheritance (AC: 4, 6)
  - [x] Add `@festgrid/eslint-config` as a devDependency in `packages/shared-types/package.json` and `apps/web/package.json`
  - [x] Create `eslint.config.mjs` in `packages/shared-types` extending `@festgrid/eslint-config/base`
  - [x] Create `eslint.config.mjs` in `apps/web` extending `@festgrid/eslint-config/next-js`
  - [x] Create `eslint.config.mjs` in the monorepo root extending `@festgrid/eslint-config/base`
- [x] Task 4: Verify TypeScript and ESLint configurations (AC: 3, 4)
  - [x] Run `pnpm lint` and ensure all packages are successfully linted without prompting or errors
  - [x] Run `pnpm build` and ensure TypeScript builds without errors

## Dev Notes

- **ESLint v9 Flat Config:** The project uses flat configurations. Config files are named `eslint.config.mjs` to ensure ESM support without requiring `"type": "module"` in root or package level package.json files.
- **Dependency Resolution:** Internal packages are referenced via `workspace:*` in monorepo packages/apps.

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (via VS Code Cline)

### Debug Log References

None.

### Completion Notes List

- Successfully updated the `_bmad-output/project-context.md` to document strict linting and compilation extension requirements.
- Configured deep TypeScript and ESLint flat config inheritance for `@festgrid/shared-types` package, Next.js frontend (`apps/web`), and workspace root.
- Fixed a pre-existing type mismatch in `apps/web/src/app/page.tsx` involving missing `slug` property in mock events, demonstrating that strict typescript compilation is correctly enforced across workspace packages.
- Validated setup with `pnpm lint` and `pnpm build`, with all checks passing completely without error.

### File List

- `_bmad-output/project-context.md`
- `packages/shared-types/package.json`
- `packages/shared-types/tsconfig.json`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `packages/shared-types/eslint.config.mjs`
- `apps/web/eslint.config.mjs`
- `eslint.config.mjs`
- `apps/web/src/app/page.tsx`

### Change Log

- Initialized Story 0.2
- Implemented and verified complete ESLint and TypeScript global configuration inheritance
- Marked Story 0.2 as ready for review
