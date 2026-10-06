---
baseline_commit: 658c5875c9f4f6fcc7dacaa319ad979184977530
---

# Story 0.49: Close backend integration test row leaks and add a permanent row-count ratchet (FIND-064)

## Story Details

- Epic: 0
- Story ID: 0.49
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want FestGrid's backend integration test suite (`apps/backend/src/**/*.test.ts`, run via `tsx --test` / node:test) to stop leaving extra rows behind in whichever Postgres database `DATABASE_URL` points at, and a permanent automated check that fails the run the instant any test regresses on this,
So that running the backend suite — repeatedly, against my own persistent local dev DB, or against CI's own ephemeral one — never again silently accumulates rows that later break or slow down tests, the way it did today (dev DB held 72 `posts` rows vs. the known 35-row fixture-seed baseline, confirmed live during this story's drafting) and the way an unrelated 30k-row volume-seed pollution incident separately failed 12 tests and ran the suite ~7x slower (`FIND-064`, `packages/database/seed-volume.ts`'s own header comment documents that incident).

## Acceptance Criteria

1. **Given** `apps/backend/src/lib/posts/persist-post-account-associations.test.ts` creates `socialMediaAccountProfiles` and `posts` rows via its own `makeProfile`/`makePost` helpers across every sub-test, and the file has zero cleanup today (confirmed: no `.delete(`, `t.after`, or `t.afterEach` anywhere in the file), **When** this story ships, **Then** the file gains a `t.after` (or per-sub-test `t.afterEach`) block that explicitly `db.delete()`s every profile/post row it created, in FK-safe order (`postAccountAssociations`/`posts` before `socialMediaAccountProfiles`) — matching the existing per-file explicit-delete convention already used by ~95 of this directory's ~99 DB-touching sibling test files (e.g. `apps/backend/src/schema/favorites-and-calendar.test.ts`'s `t.afterEach`/`t.after` blocks), not a new abstraction.

2. **Given** `apps/backend/src/lib/posts/mark-post-extracted.test.ts` inserts rows via its own helpers with zero cleanup today (confirmed: no `.delete(`/`t.after`/`t.afterEach`), **When** this story ships, **Then** it receives the same treatment as AC1.

3. **Given** `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts`'s existing `t.after` callback (line ~14) only restores the mocked `sendSqsMessage` and never deletes the `socialMediaAccountProfiles` profile or the `posts` rows created across its sub-tests (8 `.insert(` call sites total), **When** this story ships, **Then** that same `t.after` block is EXTENDED (the existing mock-restore line is preserved, not replaced) to also delete every post/profile row the file created, in FK-safe order.

4. **Given** `apps/backend/src/lib/posts/persist-unprocessed-payload.test.ts`'s existing `t.afterEach` only restores the mocked `sendScraperAuditAlert` and never deletes the `unprocessedScraperPayloads` row(s) that `persistUnprocessedPayload()` inserts on the test's behalf (the file itself calls no `.insert(` directly — the production function under test does), **When** this story ships, **Then** that `t.afterEach` is similarly extended to delete the payload row(s) created in that test run.

5. **Given** `packages/database/delete-order.ts`'s `getTablesInDeleteOrder()` already derives a FK-safe deletion order from the live Drizzle schema via real introspection (not hand-maintained), and is used today only internally by `seed.ts`'s full-wipe reseed, **When** this story ships, **Then** `packages/database/index.ts` additionally re-exports it (`export * from './delete-order.js';`, alongside the existing `export * from './schema.js';`) so `apps/backend` can consume it without a second, duplicated FK-walk implementation. `packages/database`'s own `delete-order.test.ts` continues to pass unchanged — this is a barrel addition, not a behavior change to the function itself.

6. **Given** there is no automated check today that a backend test run leaves the database with no more rows than it started with, **When** this story ships, **Then** `apps/backend` gains a new wrapper script, `apps/backend/scripts/run-tests-with-row-count-ratchet.ts`, that:
   - (a) snapshots `COUNT(*)` for every table returned by the newly-exported `getTablesInDeleteOrder()` (AC5), via the existing `db` client (`apps/backend/src/db/client.ts`) — no second Postgres connection;
   - (b) spawns the real test command as a child process — the exact argv apps/backend's `test` script runs today, `tsx --test --test-concurrency=1 "src/**/*.test.ts"` — with `stdio: 'inherit'` so output/exit behavior is unchanged from the developer's perspective;
   - (c) snapshots every table's count again once the child process exits;
   - (d) compares before/after per table;
   - (e) if any table's after-count is greater than its before-count, prints exactly which table(s) grew and by how much, then exits non-zero — **even when the child test process itself exited 0** (every individual test can pass while the suite as a whole still leaks rows; this is precisely the gap that let the 4 files in AC1-4 go unnoticed).
   - If the child process itself exits non-zero (a real test failure), the wrapper still runs the after-snapshot and reports any leak found, but propagates the child's own original exit code rather than masking a test failure as a leak failure or vice versa.

7. **Given** `apps/backend/package.json`'s `"test"` script is currently `cross-env NODE_ENV=test tsx --test --test-concurrency=1 "src/**/*.test.ts"`, **When** this story ships, **Then** it becomes `cross-env NODE_ENV=test tsx scripts/run-tests-with-row-count-ratchet.ts` (the wrapper internally spawns the unchanged original command — see AC6b — so `NODE_ENV=test` is still set exactly once, by `cross-env`, before the wrapper's own `db` import resolves `DATABASE_URL`).

8. **Given** the root `pnpm run test` (invoked by `.github/workflows/ci.yml`'s `Run tests` step) already delegates per-package via `turbo run test` to each package's own `test` script, and CI already runs its own `migrate`+`seed` steps against its isolated, ephemeral `festgrid_test` Postgres service container before that step — unchanged by this story, **When** this story ships, **Then** CI picks up the new ratchet automatically with **zero edits to `.github/workflows/ci.yml` or `turbo.json`**. The only externally-observable change in CI is that `pnpm --filter backend test` now also fails if a *future* test leaks rows within a single CI run — it does not today, and nothing about CI's existing migrate/seed/test sequence changes.

9. **Given** AC1-4 fix the 4 currently-known-leaking files and AC6-7 add the ratchet, **When** the full backend suite is then run once, locally, against a dev DB whose state is whatever it is at that moment (no forced reseed — see Dev Notes "Why not force a reseed"), **Then** the ratchet reports **zero row growth across every table**. If it does not, this is proof the 4 named files were not the only leak: bisect using the same snapshot mechanism (run the ratchet, or a one-off scoped variant of it, around a single suspect test file at a time) to find and fix whatever else leaked, and record exactly what was found and fixed in this story's own Dev Agent Record — AC1-4 name the leaks found and verified during story drafting (via static analysis of `.insert(`/`.delete(`/`t.after`/`t.afterEach` presence across all 99 DB-touching test files), not an exhaustive dynamic/runtime audit of every file; the ratchet itself is what proves completeness, not the static list.

10. **Given** two files were specifically investigated during story drafting as candidates that looked suspicious by the same static heuristic (DB import present, no literal `.delete(` in the file) but turned out to already be clean — `apps/backend/src/lib/scraper/usage-store-test-helpers.test.ts` (calls its own `clearApifyProviderUsage()` helper both before AND after its one insert) and `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (its existing `t.afterEach`, line ~232, already calls `clearApifyProviderUsage()`, which covers the one `scraperProviderUsage` row it inserts at line ~716) — **When** this story ships, **Then** neither file is modified; AC9's full-suite ratchet run is what re-confirms this (rather than re-deriving it from scratch).

11. **Given** the user's explicit 2026-10-06 decision superseding `FIND-064`'s original "dedicated test database" framing (recorded in `backlog.yaml`'s `FIND-064` row note), **When** this story ships, **Then** it introduces **no new database, schema, per-run template copy, or environment variable** — `DATABASE_URL` continues to be the one connection string every script, migration, and test reads, identically in local dev and in CI.

12. i18n: N/A — no user-facing strings (pure backend test-hygiene and dev-tooling; verified by Gate 2 below).

## Tasks / Subtasks

- [ ] Task 1 — Export the FK-safe table helper (AC: #5)
  - [ ] Add `export * from './delete-order.js';` to `packages/database/index.ts`.
  - [ ] Run `pnpm --filter @festgrid/database test` and `pnpm --filter @festgrid/database lint` to confirm the barrel change breaks nothing (including `delete-order.test.ts` itself).

- [ ] Task 2 — Fix the 4 known-leaking test files (AC: #1, #2, #3, #4)
  - [ ] `persist-post-account-associations.test.ts`: add FK-safe cleanup for every profile/post created.
  - [ ] `mark-post-extracted.test.ts`: add FK-safe cleanup for every row created.
  - [ ] `enqueue-post-for-processing.test.ts`: extend the existing `t.after` (preserve the `setSendSqsMessage` restore) to also delete the profile/post rows.
  - [ ] `persist-unprocessed-payload.test.ts`: extend the existing `t.afterEach` (preserve the `setSendScraperAuditAlert` restore) to also delete the payload row(s).

- [ ] Task 3 — Build the row-count ratchet (AC: #6, #7)
  - [ ] Add `apps/backend/scripts/run-tests-with-row-count-ratchet.ts` (snapshot → spawn real test command → snapshot → diff → report/exit, per AC6).
  - [ ] Update `apps/backend/package.json`'s `"test"` script to invoke the wrapper (AC7).
  - [ ] Confirm `apps/backend`'s `lint`/`build` (tsconfig already includes `scripts/`, matching the existing convention set by `apps/backend/scripts/debug-apify.ts` etc.) pass with the new file.

- [ ] Task 4 — Prove completeness and confirm CI needs no changes (AC: #8, #9, #10)
  - [ ] Run the full backend suite once with the new ratchet in place; confirm zero growth across all tables. If not, bisect and fix (document findings in Dev Agent Record).
  - [ ] Spot-check `usage-store-test-helpers.test.ts` and `instagram-adapter.test.ts` remain untouched and still pass.
  - [ ] Re-read `.github/workflows/ci.yml` and `turbo.json` to confirm no edit is needed there (AC8) — do not edit either file as part of this story.

- [ ] Task 5 — No new isolation mechanism (AC: #11, #12)
  - [ ] Confirm no new env var, `.env` key, database, or schema was introduced anywhere in the diff.

## Dev Notes

### Why the dedicated-test-database idea was dropped

`FIND-064` was originally captured (`packages/database/seed-volume.ts`'s header comment, and the backlog row itself) suggesting "a dedicated test database or per-test cleanup" as alternatives. This story's drafting pass (2026-10-06) opened with an `AskUserQuestion` proposing three dedicated-test-DB mechanisms (separate database, separate schema, per-run template copy) plus how dev/CI would select one and how migrations would apply. The user explicitly rejected ALL of them: parallel development sessions already run in separate containers/accounts, each with its own local Postgres (per `project-context.md`'s "Local development will use a local PostgreSQL database" rule) — so cross-session collision was never the real risk. The actual, reproducible problem is narrower: specific test files leak rows **within a single developer's own run**, against whichever `DATABASE_URL` they already have configured. The user re-scoped the story to exactly what AC1-10 describe: fix the leaking files, add a permanent automated guard against a repeat, touch nothing about how the test target is selected. Do not reintroduce a dedicated-DB/schema/template mechanism as part of implementing this story — that path was deliberately closed, not merely deferred.

### Why not force a reseed before every test run

An alternative design considered (and rejected) during drafting: have the new wrapper script (or the `test` command) run `pnpm --filter @festgrid/database run seed` (a full wipe-and-reseed to the known 35-row fixture baseline) before every test run, so every run starts from a deterministic state. Rejected because `apps/backend`'s tests share the same `DATABASE_URL` a developer also uses for manual exploratory use of the running app locally — forcibly wiping that database on every `pnpm test` invocation would destroy any manually-created data outside the fixture seed, which is a bigger behavior change than this story's scope. The chosen design (AC6) only compares **before vs. after the run**, so it works correctly regardless of whatever absolute row counts exist when the run starts, and never deletes or reseeds anything itself.

### The established per-file cleanup convention (follow this, do not invent a new one)

Of the ~99 backend test files that import `db` from `../db/client.js` (various relative depths), ~95 already follow one consistent, hand-written pattern: a `t.after` (whole-file) or `t.afterEach` (per-sub-test) callback that issues explicit, targeted `db.delete(table).where(eq(table.someId, createdId))` calls for every row the test created, in FK-child-before-parent order. Example (`apps/backend/src/schema/favorites-and-calendar.test.ts`):

```ts
t.after(async () => {
  if (testUser) {
    await db.delete(favorites).where(eq(favorites.userId, testUser.id));
    await db.delete(calendarAdditions).where(eq(calendarAdditions.userId, testUser.id));
  }
  if (testEventId) {
    await db.delete(schedules).where(eq(schedules.eventId, testEventId));
    await db.delete(events).where(eq(events.id, testEventId));
  }
  if (createdTestUser2 && testUser2) {
    await db.delete(users).where(eq(users.id, testUser2.id));
  }
});
```

AC1-4's fixes must follow this exact same shape — targeted deletes by the specific row(s)/id(s) the file itself created, in FK-safe order — not a blanket `TRUNCATE`, not a new shared "cleanup registry" abstraction, and not a dependency on the new ratchet script (the ratchet is a safety net that catches *future* regressions; it is not how these 4 known files get fixed).

### Full audit evidence (static analysis performed during story drafting — 2026-10-06)

Of 99 files matching `grep -rl "db/client" --include="*.test.ts" apps/backend/src`, 12 had no `.delete(` call anywhere in the file. Each was individually inspected:

| File | `.insert(` count | Verdict |
|---|---|---|
| `lib/posts/persist-post-account-associations.test.ts` | 2 (+ more via helpers) | **Leak — fixed by AC1** |
| `lib/posts/mark-post-extracted.test.ts` | 2 | **Leak — fixed by AC2** |
| `lib/posts/enqueue-post-for-processing.test.ts` | 8 | **Leak — fixed by AC3** |
| `lib/posts/persist-unprocessed-payload.test.ts` | 0 direct (via `persistUnprocessedPayload()`) | **Leak — fixed by AC4** |
| `lib/scraper/usage-store-test-helpers.test.ts` | 1 | Clean — self-cleans via `clearApifyProviderUsage()` before AND after (AC10) |
| `lib/scraper/instagram-adapter.test.ts` | 1 | Clean — existing `t.afterEach` calls `clearApifyProviderUsage()` (AC10) |
| `backfill-post-media-keys.test.ts` | 0 | Clean — pure logic, no DB at all |
| `schema/user-timezone.test.ts` | 0 | Clean — only `UPDATE`s an existing seeded user, restores it after |
| `schema/schedule-timezone.test.ts` | 0 | Clean — only `UPDATE`s existing seeded schedules |
| `lib/ai-processor/resolve-schedule-timezones.test.ts` | 0 | Clean — only `UPDATE`s existing seeded users, restores after |
| `lib/scraper/scraper-audit-integration.test.ts` | 0 | Clean — `db.insert` fully mocked via `t.mock.method` |
| `lib/scraper/record-actor-run.test.ts` | 0 | Clean — `db.insert` fully mocked via `t.mock.method` |

The remaining ~87 files all already call `.delete(` somewhere and were not individually re-verified here (that is a static grep, not proof of zero net growth per file) — AC9's full-suite ratchet run is the actual proof mechanism for the whole 99-file population, not this table.

Live evidence, captured during drafting: `SELECT count(*) FROM posts;` against the current local dev DB returned **72**, against the known 35-post fixture-seed baseline — confirming the leak is real and currently present, not stale/historical.

### Story Split Gate evaluation (story-split-gate.md) — all three run fresh

`epic-0-readiness.md` (the only Epic 0 readiness sweep on file) is scoped to Stories 0.1-0.19 only (`stories_covered` frontmatter) and dated 2026-08-03, long before this story's subject existed — it does not cover this story's scope, so all three gates were run fresh rather than cited from that report, per `story-split-gate.md`'s own fallback rule.

#### Architecture & UX Gate Findings

- **Gate 1 (Winston, Architecture/Infrastructure Completeness): No gap found.** This story is confined to backend test tooling and an internal package export; it adds no GraphQL resolver/query/mutation/API surface, touches no frontend code, and depends on no undeployed infra (no new DB/queue/Lambda/IaC — AC11).
- **Gate 2 (Freya/Sally, UI Complexity & Reusability): No gap found.** Zero UI/React/component surface of any kind — pure Node test-file edits, a barrel export, and a CLI script. No DESIGN.md/EXPERIENCE.md-governed surface is touched.
- **Gate 3 (Winston, Foundational/Cross-Cutting Dependency Completeness): No gap found**, with one explicit design note: the new row-count-ratchet mechanism (AC6) is deliberately scoped to `apps/backend` only, not extracted into `packages/testing-config` (that package's charter is Vitest/MSW config for Vitest-based apps; `apps/backend`'s tests run under `node:test`/`tsx --test`, a runner mismatch) or any other shared package. There is currently exactly one consumer (`apps/backend`) — `packages/database`'s own DB-backed integration tests (`seed.integration.test.ts`, `unique-index.integration.test.ts`) follow a deliberately different pattern (full wipe-and-reseed) and are out of this story's scope. Extracting a shared abstraction now, from a single data point, would be speculative generality. **Forward-looking note for a future epic-readiness review:** if a second DB-touching package/app ever wants the same "fail on net row growth" guard, that is the trigger to extract a runner-agnostic version of this mechanism into its own small shared package — not `packages/testing-config`. Not a blocker for this story.
- **Gate 3 watch-item (non-blocking, out of scope for this story):** the new ratchet script only ever reads (`COUNT(*)`) — it performs no deletes or writes itself — so it introduces no new destructive risk. The pre-existing, broader condition that `apps/backend`'s test suite (today, independent of this story) has no guard preventing it from being pointed at a non-local `DATABASE_URL` (unlike `packages/database/seed.ts`'s `assertSafeSeedTarget`/`isLocalConnectionString` guard, which exists specifically for the destructive `seed`/`seed:volume` commands) is noted here for awareness but is explicitly **not** part of this story's scope — it predates this story and applies to the whole suite, not something this story's changes introduce or worsen.

### Package boundary / testing-framework notes

`project-context.md`'s Testing Rules describe a "testing trophy" approach (Vitest + msw for `apps/*`) as the general target, and a separate workflow persistent-fact says shared testing config belongs in `@festgrid/testing-config`. Neither applies here: `apps/backend`'s integration tests already run under Node's built-in `node:test` runner (`tsx --test`), a pre-existing, established convention for this package (see `apps/backend/package.json`'s `"test"` script, unchanged in kind by this story — AC7 only changes which script is invoked, not the underlying test runner or framework). This story does not introduce Vitest to `apps/backend`, does not touch `packages/testing-config`, and does not change the test runner for any file — it only adds cleanup calls to existing `node:test` files and wraps the existing `tsx --test` invocation.

### File/path expectations

- `packages/database/index.ts` — add one export line (AC5).
- `apps/backend/src/lib/posts/persist-post-account-associations.test.ts` — add cleanup (AC1).
- `apps/backend/src/lib/posts/mark-post-extracted.test.ts` — add cleanup (AC2).
- `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts` — extend existing `t.after` (AC3).
- `apps/backend/src/lib/posts/persist-unprocessed-payload.test.ts` — extend existing `t.afterEach` (AC4).
- `apps/backend/scripts/run-tests-with-row-count-ratchet.ts` — new file (AC6). `apps/backend/scripts/` already exists and already holds standalone `tsx`-run dev tools (`debug-apify.ts`, `debug-process-scrape-job.ts`, `poc-ingestion-preview.ts`), and is already covered by `apps/backend/tsconfig.json`'s `"include": ["."]` and the package's base ESLint config (only `dist/` and `src/generated/` are ignored) — no tsconfig/eslint config changes needed to make this new file build- and lint-checked.
- `apps/backend/package.json` — change the `"test"` script (AC7).
- **Do not touch:** `.github/workflows/ci.yml`, `turbo.json` (AC8), `.env`/`.env.example` (AC11), `packages/database/seed.ts` / `seed-volume.ts` / migrations (no schema/seed changes of any kind).

### Suggested implementation shape for the ratchet script (illustrative, not mandatory verbatim)

```ts
// apps/backend/scripts/run-tests-with-row-count-ratchet.ts
import { spawn } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { getTablesInDeleteOrder } from '@festgrid/database';
import { db } from '../src/db/client.js';

async function snapshotCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const table of getTablesInDeleteOrder()) {
    const name = getTableConfig(table).name;
    const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(table);
    counts.set(name, count);
  }
  return counts;
}

function runRealTests(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn('tsx', ['--test', '--test-concurrency=1', 'src/**/*.test.ts'], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const before = await snapshotCounts();
  const testExitCode = await runRealTests();
  const after = await snapshotCounts();

  const leaks = [...before].filter(([table, count]) => (after.get(table) ?? count) > count);
  if (leaks.length > 0) {
    console.error('\nRow-count ratchet FAILED — this run left extra rows behind:');
    for (const [table, beforeCount] of leaks) {
      console.error(`  ${table}: ${beforeCount} -> ${after.get(table)}`);
    }
    process.exit(testExitCode !== 0 ? testExitCode : 1);
  }
  process.exit(testExitCode);
}

main();
```

Note the test command's glob (`'src/**/*.test.ts'`) is passed as a single argv element with `shell` left at its Node default (`false`) — matching how the string is already *quoted* (not shell-expanded) in today's `package.json` script, so `tsx --test`'s own internal glob resolution behaves identically to today.

### References

- [Source: `packages/database/seed-volume.ts` header comment — the 30k-row volume-pollution incident this finding also cites]
- [Source: `apps/backend/src/db/client.ts` — the shared `db` singleton every backend test and this story's new script read through]
- [Source: `packages/database/delete-order.ts`, `delete-order.test.ts` — the FK-safe table helper being exported]
- [Source: `packages/database/seed.ts` — existing precedent for `getTablesInDeleteOrder()` usage and the `assertSafeSeedTarget`/`isLocalConnectionString` destructive-target guard (Gate 3 watch-item, out of scope)]
- [Source: `_bmad-output/project-context.md#Database & Performance` — "Local development will use a local PostgreSQL database... Supabase is strictly used as the cloud database for production"]
- [Source: `.github/workflows/ci.yml` — CI's existing migrate+seed+test sequence against its own ephemeral `festgrid_test` Postgres service, unchanged by this story]
- [Source: `docs/infrastructure/3-database.md` — no infra/IaC changes required by this story]
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml` `FIND-064` row — original finding and the 2026-10-06 re-scope note]

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — this story adds no columns, tables, or API fields, and changes no TypeScript type/interface shapes.
- Required DB migration changes: No changes required — no schema/DDL change of any kind.
- Required TypeScript type changes: No changes required.
- Backward compatibility and rollout notes: N/A — purely additive test-hygiene and tooling; no runtime behavior change for production code paths.
- Verification checks: `pnpm --filter @festgrid/database test` (confirms the barrel export doesn't break `delete-order.test.ts` or anything else re-exported from `index.ts`); `pnpm --filter backend test` (confirms the 4 fixed files and the new ratchet script all pass, and that the ratchet reports zero row growth per AC9).

### Project Structure Notes

- Fully aligned with the existing monorepo structure: all changes are within `apps/backend` and `packages/database`, following each package's own established conventions (per-file `node:test` cleanup blocks; `packages/database`'s existing barrel-export pattern; `apps/backend/scripts/`'s existing standalone-tsx-script convention).
- No conflicts or variances detected.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Database & Performance section (local-Postgres-for-dev rule), Testing Rules section (testing-trophy philosophy — not directly applicable to this backend-internal node:test tooling change, but confirmed non-conflicting).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order followed.
- [ ] Architecture spine — no architecture-spine AD is affected; confirmed via Gate 1/3 above.
- [ ] Infrastructure docs — `docs/infrastructure/3-database.md`, `docs/infrastructure/index.md` — confirmed no infra/IaC change needed.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/database/index.ts` (+1 export line)
  - `apps/backend/src/lib/posts/persist-post-account-associations.test.ts` (add cleanup block)
  - `apps/backend/src/lib/posts/mark-post-extracted.test.ts` (add cleanup block)
  - `apps/backend/src/lib/posts/enqueue-post-for-processing.test.ts` (extend existing `t.after`)
  - `apps/backend/src/lib/posts/persist-unprocessed-payload.test.ts` (extend existing `t.afterEach`)
  - `apps/backend/scripts/run-tests-with-row-count-ratchet.ts` (new file)
  - `apps/backend/package.json` (`"test"` script value change, one line)
- **Rule Mapping:**
  - AC1-4 → the established per-file `t.after`/`t.afterEach` targeted-delete convention (Dev Notes).
  - AC5-8 → packages/database barrel export reused by a new backend-only wrapper script, zero CI/turbo edits (Gate 1/Gate 3 findings).
  - AC9-10 → the full-suite ratchet run is the completeness proof, not the static audit table.
  - AC11-12 → explicit confirmation the rejected dedicated-DB/schema/template/env-var path was not reintroduced.
- **Verification Plan:**
  - `pnpm --filter @festgrid/database test` and `pnpm --filter @festgrid/database lint` after Task 1.
  - `pnpm --filter backend test` (now running through the new ratchet) after Tasks 2-3 — must exit 0 with zero reported row growth.
  - `pnpm --filter backend lint` and `pnpm --filter backend build` to confirm the new script type-checks and lints cleanly.
  - Manual diff review of `.github/workflows/ci.yml` and `turbo.json` confirming neither needed a change (AC8).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — fix the 4 named leaking files + add the row-count ratchet; no dedicated test DB/schema/template/env var (per the user's 2026-10-06 re-scope).
- [ ] Architecture and boundary confirmation — Gate 1/2/3 all ran fresh, all three report "No gap found" (see Dev Notes).
- [ ] Testing plan confirmation — AC9's full-suite ratchet run is the completeness proof; bisect further only if it reports non-zero growth after the 4 named fixes.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, no gaps found, nothing deferred.

## Testing Requirements

- [ ] Integration tests — the 4 fixed files, re-run and confirmed to still pass their own assertions after adding cleanup.
- [ ] E2E tests — N/A (backend-internal test-hygiene and tooling; no user-facing flow).

## Deliverables Checklist

- [ ] `packages/database/index.ts` re-exports `getTablesInDeleteOrder`.
- [ ] 4 named test files each have correct, targeted, FK-safe cleanup.
- [ ] `apps/backend/scripts/run-tests-with-row-count-ratchet.ts` exists and behaves per AC6.
- [ ] `apps/backend/package.json`'s `"test"` script invokes the wrapper.
- [ ] A full `pnpm --filter backend test` run reports zero row growth.
- [ ] `.github/workflows/ci.yml` and `turbo.json` are unmodified.

## Out of Scope

- A dedicated test database, schema, or per-run template-copy mechanism for backend integration tests (explicitly rejected by the user on 2026-10-06 — see Dev Notes "Why the dedicated-test-database idea was dropped").
- Any new environment variable for selecting a test-specific connection target (same rejection).
- Forcing a reseed-to-baseline before every test run (see Dev Notes "Why not force a reseed").
- Extracting the row-count-ratchet mechanism into `packages/testing-config` or any other shared package (Gate 3: no gap found now; revisit only if/when a second DB-touching package or app wants the same guard — not a prerequisite for this story).
- Adding a guard preventing `apps/backend`'s test suite from being pointed at a non-local `DATABASE_URL` (Gate 3 watch-item; a pre-existing, broader condition unrelated to this story's own changes).
- Any fix beyond the 4 named files unless AC9's full-suite ratchet run actually surfaces one — this story does not mandate a line-by-line rewrite of the other ~95 already-compliant files.

## Definition of Done

- [ ] AC1-12 satisfied.
- [ ] `pnpm --filter @festgrid/database test`, `pnpm --filter @festgrid/database lint`, `pnpm --filter backend test`, `pnpm --filter backend lint`, `pnpm --filter backend build` all pass.
- [ ] A full backend test run through the new ratchet reports zero net row growth.
- [ ] `.github/workflows/ci.yml` / `turbo.json` confirmed unchanged.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
