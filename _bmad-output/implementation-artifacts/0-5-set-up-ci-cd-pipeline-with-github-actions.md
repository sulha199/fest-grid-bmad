# Story 0.5: Set up CI/CD pipeline with GitHub Actions

## Story Context
**Epic:** Epic 0 - Project Setup & DevOps
**Story ID:** 0.5
**Status:** ready-for-dev

## User Story
**As a** developer,
**I want** to have a basic CI/CD pipeline set up with GitHub Actions,
**So that** I can automatically run tests, linting, and build checks on every push to the repository.

## Acceptance Criteria
- [ ] **Given** a push is made to any branch in the GitHub repository,
- [ ] **When** the GitHub Actions workflow is triggered,
- [ ] **Then** the workflow installs dependencies, runs linting, and executes tests for all packages.
- [ ] **And** the workflow fails if any of these steps fail.
- [ ] **And** the CI/CD pipeline automatically applies database migrations using `drizzle-kit` for consistent schema management.
- [ ] **And** the frontend is automatically deployed to Vercel upon merging to main (handled via Vercel's native GitHub integration).
- [ ] **And** the GitHub Actions pipeline includes a placeholder/stub for deploying the AWS serverless backend (which will be implemented once the backend package is created).

## Developer Context

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
