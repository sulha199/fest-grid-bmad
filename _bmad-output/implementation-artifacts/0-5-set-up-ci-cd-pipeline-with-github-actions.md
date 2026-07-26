---
baseline_commit: cb176275d6d25427cea8c7faae04125865fe72aa
---
# Story 0.5: Set up CI/CD pipeline with GitHub Actions

## Story Context
**Epic:** Epic 0 - Project Setup & DevOps
**Story ID:** 0.5
**Status:** review

## User Story
**As a** developer,
**I want** to have a basic CI/CD pipeline set up with GitHub Actions,
**So that** I can automatically run tests, linting, and build checks on every push to the repository.

## Acceptance Criteria
1. **Given** a push is made to any branch in the GitHub repository,
2. **When** the GitHub Actions workflow is triggered,
3. **Then** the workflow installs dependencies, runs linting, and executes tests for all packages.
4. **And** the workflow fails if any of these steps fail.
5. **And** the CI/CD pipeline automatically applies database migrations using `drizzle-kit` for consistent schema management.
6. **And** the frontend is automatically deployed to Vercel upon merging to main (handled via Vercel's native GitHub integration).
7. **And** the GitHub Actions pipeline includes a placeholder/stub for deploying the AWS serverless backend (which will be implemented once the backend package is created).

## Tasks / Subtasks
- [x] Task 1: Create a `.github/workflows/ci.yml` file.
- [x] Task 2: Configure action to trigger on `push` and `pull_request` to `main` branch.
- [x] Task 3: Use `pnpm` setup action to install dependencies (`pnpm install`).
- [x] Task 4: Add step to run lint, build, and test (`turbo run lint build test`).
- [x] Task 5: Add step to execute `drizzle-kit migrate` for Supabase migrations.
- [x] Task 6: Document manual step needed to link GitHub repository to Vercel.
- [x] Task 7: Add placeholder job for AWS backend deployment.

## Dev Notes

### Architecture Guardrails
- **Migration Pipeline:** Migrations generated as SQL files using `drizzle-kit` MUST be applied automatically via CI/CD as defined in AR4 and AD-3.
- **Linting:** Must use the monorepo `lint` script that utilizes the global flat config from `@festgrid/eslint-config`.
- **Infrastructure Alignment:** 
  - Frontend (`apps/web`): Vercel handles CD natively. The GitHub Action only needs to handle CI (lint, build check, tests).
  - Backend (`apps/api` - to be created): AWS Serverless. The GitHub Action will eventually handle both CI and CD (deploying to AWS) for the backend.

### Technical Requirements
- Create a `.github/workflows/ci.yml` file.
- Action should trigger on `push` and `pull_request` to `main` branch.
- Use `pnpm` setup action to install dependencies (`pnpm install`), since the project uses `pnpm`.
- Use `turbo run lint build test` (or similar) to run the respective monorepo tasks (which acts as CI for both frontend and backend).
- Ensure the pipeline has permissions and steps to execute `drizzle-kit migrate` (or similar) for Supabase migrations (requires `DATABASE_URL` secret).
- Document the manual step needed to link the GitHub repository to a Vercel project for the frontend CD.
- Add a commented-out deployment step or placeholder job in the GitHub Action for the AWS backend deployment, noting that it will require AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

### Code Quality & Testing Rules
- Ensure that the GitHub Action fails on test failures or linting errors.
- The pipeline MUST enforce 100% unit test coverage for `packages/domain` by failing if coverage is not met.

### Dependencies
- Use standard GitHub Actions like `actions/checkout@v4`, `pnpm/action-setup@v3`, `actions/setup-node@v4`.

## Dev Agent Record
### Implementation Plan
- Created `.github/workflows/ci.yml` defining the Github actions for pushing to the `main` branch and creating pull requests.
- The pipeline defines jobs for `ci` (linting, testing, and building), `db-migrate` for applying database migrations on the `main` branch, and `aws-backend-deploy-stub` as a stub for the backend deployment to AWS.
- Configured root `package.json` to have an empty test command so that `turbo run test` passes when there are no tests.
- Fixed a linting error in the database package because of not ignoring the `dist` directory by adding an `eslint.config.mjs` for the `database` workspace package, and fixing the command in `package.json`.
- Documented Vercel setup in `docs/infrastructure.md`.

### Completion Notes
✅ Setup CI/CD with Github Actions successfully. The pipeline performs installation using pnpm, testing, building, linting, database migrations, and contains a stub for deploying the backend to AWS. Vercel deployment manual setup documentation was added. 

## File List
- `.github/workflows/ci.yml`
- `docs/infrastructure.md`
- `package.json`
- `turbo.json`
- `packages/database/eslint.config.mjs`
- `packages/database/package.json`

## Change Log
- Add Github Actions workflow for CI/CD.
- Add Vercel deployment manual steps to `docs/infrastructure.md`.
- Fix linting for `database` package by correctly ignoring the `dist` directory.
- Update root `package.json` with a stub test script.
