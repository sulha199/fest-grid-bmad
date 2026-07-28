---
baseline_commit: NO_VCS
---

# Story 1.2: Seed database with mock data

## Story Details
- Epic: 1 - Core App and Event Discovery
- Story ID: 1.2
- Status: done

## Story
As a developer,
I want to have a script that seeds the database with mock event data,
so that I can develop and test event discovery features with realistic fixtures.

## Acceptance Criteria
- AC1: Given the database schema is set up, when the seed script is run, then the database is populated with mock users, user locations, subscriptions, API keys, events, and schedules with valid foreign key relationships.
- AC2: Seed data includes ongoing, upcoming, and past event scenarios for future filtering behavior tests.
- AC3: The seed process is deterministic and produces stable reference fixtures across runs.
- AC4: Rerunning the seed is idempotent and does not create duplicates.
- AC5: Cleanup plus insert is transaction-safe so partial failures do not leave inconsistent FK state.
- AC6: An integration test verifies expected record counts and relational integrity after seeding.
- AC7: Running seed twice yields identical counts and fixture identity invariants (ids/slugs remain stable).

## Tasks / Subtasks
- [x] T1 (AC1, AC2, AC3, AC4, AC5): Implement deterministic fixture definitions and transactional seeding logic in packages/database/seed.ts.
- [x] T1.1 (AC3, AC7): Use fixed fixture ids and slugs for events/schedules and fixed fixture values for related tables.
- [x] T1.2 (AC4, AC5): Implement explicit cleanup ordering and wrap cleanup + insert in one transaction.
- [x] T1.3 (AC1): Insert realistic linked data for users, locations, subscriptions, api keys, events, and schedules.
- [x] T2 (AC1): Export and wire a runnable seed entry script through packages/database/package.json.
- [x] T3 (AC6, AC7): Add integration test for seed counts, FK integrity checks, and idempotent rerun behavior.
- [x] T4 (AC1-AC7): Run package lint/type-check and seed integration test successfully.

## Dev Notes

### Architecture and technical constraints
- Seed script must use Drizzle ORM for all data writes.
- No hardcoded fallback credentials; rely on DATABASE_URL from env loading utilities.
- Keep implementation in the database package with TypeScript strict mode compliance.
- Prefer deterministic committed fixture constants over random generation.

### Data and API boundary constraints
- Use only schema-defined tables from story 1.1: users, user_locations, subscriptions, api_keys, events, schedules.
- Keep FK-safe deletion order and perform write operations in one transaction.

### Source references
- _bmad-output/project-context.md
- _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md
- packages/database/schema.ts

## Global Rules References
- Drizzle ORM only for DB access.
- Deterministic and idempotent seeding required for reliable local and test workflows.
- Story status consistency must remain aligned with sprint-status.yaml.

## Implementation Plan (Rule-Compliant)

### File change plan
- Modify: packages/database/package.json
- Add: packages/database/seed.ts
- Add: packages/database/seed.integration.test.ts

### Rule mapping
- AC1/AC5 -> transaction with explicit delete ordering.
- AC3/AC7 -> fixed ids/slugs fixture constants.
- AC4 -> delete-then-insert deterministic rerun behavior.
- AC6 -> integration test verifies counts, links, and rerun invariants.

### Verification plan
- Run seed integration test against local DB.
- Assert expected table counts and zero orphan schedules.
- Assert second seed run keeps counts and deterministic slugs unchanged.

## Pre-Coding Approval Gate
- [x] Scope confirmed for story 1.2 deliverables only.
- [x] Architecture and boundaries confirmed (Drizzle-only, env-driven, strict TS).
- [x] Testing plan confirmed (integration test for counts/FK/idempotency).
- [x] Human approval to start coding explicitly granted on 2026-07-28.

## Testing Requirements
- Integration test must run seed once and assert non-zero expected counts per core table.
- Integration test must validate relational integrity for schedules -> events and user-linked tables.
- Integration test must run seed twice and confirm idempotency and deterministic fixture invariants.

## Deliverables Checklist
- [x] Seed script implemented.
- [x] package.json seed command added.
- [x] Deterministic fixture strategy implemented in code.
- [x] Integration test for idempotency and relational integrity added.

## Out of Scope
- Production data migration scripts.
- Third-party non-mock ingestion flows.

## Definition of Done
- All acceptance criteria AC1-AC7 satisfied.
- Seed script runs successfully with local database configuration.
- Integration test passes.
- Lint and type checks pass for touched package files.

## Completion Status
- Story is complete.

## Dev Agent Record

### Debug Log
- 2026-07-28: Story normalized to canonical structure and coding gate approved.
- 2026-07-28: Implemented deterministic transactional seed logic in packages/database/seed.ts.
- 2026-07-28: Added seed integration test for counts, relationship validity, and idempotent reruns.
- 2026-07-28: Ran corepack pnpm --filter @festgrid/database lint, build, and test:seed successfully.

### Completion Notes
- Added deterministic fixture data for users, user locations, subscriptions, API keys, events, and schedules.
- Implemented explicit FK-safe deletion order and wrapped cleanup plus inserts in a single transaction.
- Added package scripts for running seed and seed integration tests.
- Verified AC coverage with passing lint/build and integration test runs.

## File List
- _bmad-output/implementation-artifacts/1-2-seed-database-with-mock-data.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- packages/database/package.json
- packages/database/seed.ts
- packages/database/seed.integration.test.ts

## Change Log
- 2026-07-28: Reworked story 1.2 into canonical structure with explicit AC mapping, tasks, and approval gate.
- 2026-07-28: Implemented deterministic seed script and integration test, then advanced story status to review.
- 2026-07-28: Applied code-review fixes and advanced story status to done.

### Review Findings
- [x] [Review][Patch] Harden destructive seed target detection to only allow local hosts by default [packages/database/seed.ts:212]
- [x] [Review][Patch] Make seed integration test fail when DATABASE_URL is missing instead of skipping silently [packages/database/seed.integration.test.ts:31]
- [x] [Review][Patch] Add explicit assertions for past/ongoing/upcoming seed scenarios required by AC2 [packages/database/seed.integration.test.ts:132]