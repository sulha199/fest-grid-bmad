---
baseline_commit: HEAD
---

# Story 0.4: Set up Drizzle ORM for schema migrations

Status: review

## Story

**As a** developer,
**I want** to set up Drizzle ORM and `drizzle-kit` in the monorepo,
**So that** I can define database schemas in TypeScript and generate SQL migrations from them.

## Acceptance Criteria

1. **Given** the pnpm monorepo is initialized,
2. **When** I define a new Drizzle schema for a table (e.g., a dummy table to test generation),
3. **Then** I can run a `pnpm` script to generate a new SQL migration file.
4. **And** the generated migration can be successfully applied to the database.

## Tasks / Subtasks

- [x] Task 1: Install Drizzle ORM and Drizzle Kit dependencies
- [x] Task 2: Configure drizzle-kit (drizzle.config.ts)
- [x] Task 3: Create a dummy schema to test generation (CRITICAL: Do not create the final application tables yet, as those are handled in Story 1.1)
- [x] Task 4: Add `pnpm run generate` and `pnpm run migrate` scripts
- [x] Task 5: Verify that migrations can be generated and applied successfully

## Developer Context & Guardrails

- **Architecture Compliance:** Database access must be handled through Drizzle ORM. Supabase client should not be used for data queries as per `project-context.md`.
- **Database Schema & Migrations Location:** We are using Supabase (PostgreSQL). Create a dedicated `packages/database` package (or `packages/domain` as per project context if preferred for all business logic, but a separate DB package is standard in monorepos, though `packages/database` is preferable) to house the Drizzle ORM schema, the `drizzle.config.ts`, and the generated SQL migration files. The migration files should be stored within this package, not inside the Next.js app or backend lambda apps.
- **CRITICAL:** Do NOT create the full `users`, `events`, `schedules` tables upfront as part of this story. Story 1.1 is strictly for creating the initial database tables. We just need to make sure Drizzle ORM is set up and functional. A dummy `testing` or `health_check` table is sufficient to verify setup.

## Latest Tech Information
- Ensure to use the latest Drizzle ORM version compatible with our TypeScript and Node environment.

## Project Context Reference
Please refer to `_bmad-output/project-context.md` for overall architecture rules.

## Dev Agent Record

### Implementation Plan
- Create `packages/database` package
- Install `drizzle-orm` and `drizzle-kit`
- Configure `drizzle.config.ts` and `schema.ts`
- Add dummy table `dummy_testing`
- Write migration script `migrate.ts`
- Verify locally with docker postgres instance

### Completion Notes
✅ All tasks completed successfully. Drizzle ORM is set up, schemas are generated, and test migrations applied to a local postgres instance.

## File List
- `packages/database/package.json`
- `packages/database/tsconfig.json`
- `packages/database/drizzle.config.ts`
- `packages/database/schema.ts`
- `packages/database/migrate.ts`
- `packages/database/.env`
- `packages/database/migrations/0000_broken_meggan.sql`
- `packages/database/migrations/0001_square_typhoid_mary.sql`
- `packages/database/migrations/meta/0000_snapshot.json`
- `packages/database/migrations/meta/0001_snapshot.json`
- `packages/database/migrations/meta/_journal.json`

## Change Log
- Added `packages/database` workspace package
- Installed `drizzle-orm` and `postgres` dependencies
- Set up `drizzle-kit` with a dummy schema for testing migrations
- Updated dummy schema to use UUID as requested in PR review
