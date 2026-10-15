---
baseline_commit: 8a9d9a163b38e2a48a4220cf61f735870cb061f6
---

# Story 9.8: Rate-limit prompt resolution

## Story Details

- Epic: 9
- Story ID: 9.8
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user paying for my own Gemini key,
I want `resolvePromptToEventFilter` to be rate limited,
so that bigger prompts and retries cannot burn my quota unnoticed.

## Acceptance Criteria

1. **AC1 — exceeding the per-user limit returns a typed error without calling Gemini (epics.md AC1):** Given an authenticated user, when they exceed the per-user limit on `resolvePromptToEventFilter`, then:
   - The mutation throws a `GraphQLError` with `extensions.code: 'RATE_LIMITED'` and a clear, non-translated message (matching this resolver's existing `NO_API_KEY`/`QUOTA_EXHAUSTED`/`TEMPORARILY_BUSY` convention — none of those are routed through next-intl either; see Dev Notes).
   - `callGemini` is never invoked for the denied attempt — proven in the integration test by asserting the injected Gemini mock's call count does not increase.
   - The check runs immediately after the existing prompt-shape validation (1-2000 chars), before the existing `NO_API_KEY` candidate-key lookup — a denied request costs one row read, not a wasted key lookup.

2. **AC2 — the limit is configurable and covered by a test (epics.md AC2; absorbs BUG-059: DW-082):**
   - Both the max request count and the window length are read from `BackendEnv` (`apps/backend/src/env.ts`), sourced from `PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS` / `PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES`, following this file's existing `parseNonNegativeInt(...)`-with-default pattern (e.g. `geminiPostsPerKeyPerCycle`).
   - Resolved default (no number was specified anywhere upstream — `SPEC.md`, `epics.md`, `backlog.yaml`'s `BUG-059`/`DW-082`, and `epic-9-readiness.md` all leave the exact figures to this story): **10 requests per 10-minute rolling-fixed window per user.** Rationale recorded in Dev Notes.
   - A unit test (`packages/domain`) exercises both the max-requests and window-length parameters directly against the pure evaluation function, and an integration test (`apps/backend`) exercises the configured default end-to-end through the mutation.

3. **AC3 — the per-user counter is persisted in Postgres via Drizzle, not an in-process counter (epics.md AC3; `epic-9-readiness.md` Gate 1 correction):**
   - A new, narrowly-scoped table (`prompt_filter_rate_limits`) is added to `packages/database/schema.ts` and shipped as a Drizzle-kit-generated SQL migration file checked into the repository (`packages/database/migrations/`) — never an in-process/module-level variable, which would reset on every Lambda cold start and provide no real limiting in production.
   - The dev agent generates this migration with the repo's own tooling (`pnpm --filter @festgrid/database generate`) and applies it only to the local sandbox Postgres (`pnpm --filter @festgrid/database migrate`) per this session's environment constraints — never against Supabase/production, and never hand-written SQL.

4. **AC4 — this limiter is additive to, never a merge/replacement of, the existing per-key `callVendor` guard (epics.md AC4):**
   - `resolvePromptToEventFilter` already inherits a per-key lock/timeout/backoff guard via `callGemini` → `callVendor` (Story 0.i2a/0.i2c, confirmed live in `apps/backend/src/lib/ai-gateway/adapter.ts` / `apps/backend/src/lib/vendor-gateway/guarded-call.ts`). That mechanism bounds concurrent/duplicate-billable calls on one Gemini **key**; this story's new check bounds how often one **user** may call this **mutation**, regardless of key contention.
   - The two checks remain structurally separate: the new rate-limit check is a standalone pre-check inside the resolver (not a parameter/option added to `callVendor` or `callGemini`), and a code comment at the call site states this explicitly so a future reader does not attempt to collapse them.

**Depends on:** none (per `epics.md`; confirmed no other Epic 9 story's scope overlaps this resolver's rate-limiting concern).

**Note (epic-9-readiness, 2026-10-14, Gate 1 + Gate 3):** cited and elaborated in Dev Notes → Architecture & UX Gate Findings below.

## Tasks / Subtasks

- [ ] 1. **(AC3)** Add the `prompt_filter_rate_limits` table to `packages/database/schema.ts`:
  ```ts
  export const promptFilterRateLimits = pgTable('prompt_filter_rate_limits', {
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
    requestCount: integer('request_count').default(0).notNull(),
    windowStartAt: timestamp('window_start_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  });
  ```
  One row per user (`userId` is itself the primary key — this table has no independent identity, mirroring `vendorCallLocks`'s `lockKey`-as-primary-key shape rather than `apiKeys`' separate-`id` shape, since there is exactly one active window per user at a time). Export it alongside the existing table exports (no barrel file needed — `packages/database/index.ts` already does `export * from './schema.js'`).

- [ ] 2. **(AC3)** Generate and apply the migration locally, using only the repo's own tooling:
  - Run `pnpm --filter @festgrid/database generate` (drizzle-kit, reads local `DATABASE_URL` from `packages/database/.env`) — produces a new numbered `.sql` file under `packages/database/migrations/` plus its `meta/_journal.json`/snapshot entries. Do not hand-edit the generated SQL.
  - Run `pnpm --filter @festgrid/database migrate` (`tsx migrate.ts`) against the local sandbox Postgres only. Confirm it completes with "Migrations completed successfully" (the session's own startup hook already shows this script runs cleanly against the local DB).
  - Never point either command at a non-`localhost`/non-`127.0.0.1` `DATABASE_URL` (no network access exists in this session regardless, but this is also a standing project rule — Supabase is cloud-only).

- [ ] 3. **(AC1, AC2)** Add `packages/domain/src/ai-event-filters/prompt-filter-rate-limit.ts` — pure, dependency-free logic (no DB/ORM/Node-only import), 100% unit-tested:
  ```ts
  export interface PromptFilterRateLimitState {
    requestCount: number;
    windowStartAt: string; // ISO-8601
  }

  export interface PromptFilterRateLimitDecision {
    allowed: boolean;
    // Always the row the caller should persist when `allowed` is true. When `allowed` is false,
    // equals the input state unchanged -- the caller must NOT write anything on a denial (no
    // "wasted" increment for a request that was never allowed to proceed).
    nextState: PromptFilterRateLimitState;
  }

  export function isRateLimitWindowElapsed(windowStartAt: string, windowMinutes: number, now: Date): boolean {
    const startMs = new Date(windowStartAt).getTime();
    const windowMs = windowMinutes * 60 * 1000;
    return now.getTime() - startMs >= windowMs;
  }

  export function evaluatePromptFilterRateLimit(
    state: PromptFilterRateLimitState | null,
    maxRequests: number,
    windowMinutes: number,
    now: Date
  ): PromptFilterRateLimitDecision {
    if (state === null || isRateLimitWindowElapsed(state.windowStartAt, windowMinutes, now)) {
      return { allowed: true, nextState: { requestCount: 1, windowStartAt: now.toISOString() } };
    }
    if (state.requestCount >= maxRequests) {
      return { allowed: false, nextState: state };
    }
    return { allowed: true, nextState: { requestCount: state.requestCount + 1, windowStartAt: state.windowStartAt } };
  }
  ```
  `isRateLimitWindowElapsed` deliberately mirrors `packages/domain/src/ai-gateway/usage-cycle.ts`'s `isCycleElapsed` shape (start-time + duration vs. `now`) but takes `windowMinutes` rather than `cycleDays`, since reusing `isCycleElapsed` by passing a fractional-day value for a 10-minute window would be a confusing misuse of a days-denominated API — see Dev Notes decision 1. `evaluatePromptFilterRateLimit` additionally centralizes ALL branching (no row yet, window elapsed/reset, under limit, at/over limit) in one pure function so the DB-coupled store (Task 4) is a thin read-evaluate-write wrapper with no business logic of its own to test twice.
  Add `prompt-filter-rate-limit.test.ts` covering: no prior state → allowed, count 1; under limit → allowed, incremented, same window; at limit → denied, state unchanged; over limit → denied; window elapsed with a stale high count → allowed, reset to count 1 with a fresh `windowStartAt`; a boundary case where `now` is exactly `windowMinutes` after `windowStartAt` (inclusive — must count as elapsed, matching `isCycleElapsed`'s own `>=` convention).
  Export both from `packages/domain/src/ai-event-filters/index.ts` (new `export * from './prompt-filter-rate-limit.js';` line, additive only).

- [ ] 4. **(AC1, AC3)** Add `apps/backend/src/lib/ai-event-filters/prompt-filter-rate-limit-store.ts`:
  ```ts
  import { eq } from 'drizzle-orm';
  import { promptFilterRateLimits } from '@festgrid/database';
  import { evaluatePromptFilterRateLimit } from '@festgrid/domain/ai-event-filters';
  import { db } from '../../db/client.js';
  import { loadBackendEnv } from '../../env.js';

  // Returns true iff the request is allowed to proceed (and the allowed attempt has already been
  // recorded). Returns false iff the user is over their configured limit -- the caller must then
  // throw RATE_LIMITED and must NOT call Gemini.
  export async function checkAndRecordPromptFilterRateLimit(userId: string): Promise<boolean> {
    const env = loadBackendEnv();
    const now = new Date();

    const [row] = await db.select().from(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, userId));
    const state = row ? { requestCount: row.requestCount, windowStartAt: row.windowStartAt.toISOString() } : null;

    const decision = evaluatePromptFilterRateLimit(
      state,
      env.promptFilterRateLimitMaxRequests,
      env.promptFilterRateLimitWindowMinutes,
      now
    );

    if (!decision.allowed) {
      return false;
    }

    const nextWindowStartAt = new Date(decision.nextState.windowStartAt);
    if (!row) {
      await db.insert(promptFilterRateLimits).values({
        userId,
        requestCount: decision.nextState.requestCount,
        windowStartAt: nextWindowStartAt,
      });
    } else {
      await db.update(promptFilterRateLimits).set({
        requestCount: decision.nextState.requestCount,
        windowStartAt: nextWindowStartAt,
        updatedAt: now,
      }).where(eq(promptFilterRateLimits.userId, userId));
    }

    return true;
  }
  ```
  This is a plain read-then-write, not a single atomic upsert — deliberately matching the existing `apps/backend/src/lib/ai-gateway/usage-store.ts#recordSuccessfulUsage` precedent (same read-row → decide → write-row shape for a per-entity usage counter) rather than introducing a new locking/upsert pattern for this one caller. See Dev Notes decision 2 for why this is an accepted, precedent-matching tradeoff here and not a race-condition bug to fix.

- [ ] 5. **(AC1, AC4)** Wire the check into `resolvePromptToEventFilter` in `apps/backend/src/schema/resolvers.ts`:
  - Import `checkAndRecordPromptFilterRateLimit` from `../lib/ai-event-filters/prompt-filter-rate-limit-store.js`.
  - Immediately after the existing prompt-length/shape validation block (around line 328) and before the `// NO_API_KEY Pre-Check` comment, insert:
    ```ts
    // Story 9.8 -- per-user request-volume guard, distinct from and additive to callVendor's
    // per-key lock/timeout/backoff (callGemini -> callVendor, Story 0.i2a/0.i2c below). This
    // check bounds how often THIS USER may call this mutation; it never replaces or is replaced
    // by that per-key mechanism. Runs before the candidate-key lookup so a denied request never
    // pays for it.
    const rateLimitAllowed = await checkAndRecordPromptFilterRateLimit(authUser.userId);
    if (!rateLimitAllowed) {
      throw new GraphQLError('You are sending prompts too quickly. Please wait a few minutes and try again.', {
        extensions: { code: 'RATE_LIMITED' }
      });
    }
    ```
  - No GraphQL schema (`.graphql`) change: `extensions.code` on a `GraphQLError` is error metadata, not a typed schema field -- confirmed by inspecting the existing `NO_API_KEY`/`QUOTA_EXHAUSTED`/`TEMPORARILY_BUSY` codes this same resolver already throws, none of which appear in any `.graphql` enum (the unrelated `ExtractionErrorCode` enum in `extraction.graphql` backs a different field, `ExtractionJob.errorCode`, not this resolver's thrown errors). No codegen regeneration needed.

- [ ] 6. **(AC1, AC2, AC4)** Add integration tests to `apps/backend/src/schema/ai-event-filters.test.ts` (existing `resolvePromptToEventFilter` suite in this file):
  - **Denial case:** seed a `promptFilterRateLimits` row for `testUser.id` with `requestCount` at the configured max (read `loadBackendEnv().promptFilterRateLimitMaxRequests` directly in the test, or override `process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS` to a small deterministic value with save/restore, following this file's own `GEMINI_VERIFICATION_TIMEOUT_MS` override convention in `api-keys.test.ts`) and `windowStartAt: new Date()` (fresh). Call the mutation once; assert `result.errors[0].extensions.code === 'RATE_LIMITED'` and that the injected `setCallGeminiGenerateContent` mock's call counter did not increase (wrap the mock in a counting shim for this assertion).
  - **Window-reset case:** seed the same row with `requestCount` at/above the max but `windowStartAt` far enough in the past to have elapsed under the configured window; call the mutation; assert it succeeds (reaches the Gemini mock) and the row's `requestCount` is reset to 1 with a fresh `windowStartAt` afterward.
  - **Cleanup:** add `await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));` to the file's existing `t.after(...)` cleanup block (alongside the existing `aiEventFilters`/`apiKeys`/`vendorCallLocks` deletes), and import `promptFilterRateLimits` in this file's existing `@festgrid/database` import line.
  - Do not add a case that actually exhausts the real default (10 calls) — seed the counter state directly instead, both for test speed and to avoid coupling the test to the exact default value (AC2 — the default is configurable and could change).

- [ ] 7. **(Verification)** Run `pnpm --filter @festgrid/domain test`, `pnpm --filter @festgrid/domain lint`, `pnpm --filter @festgrid/domain build`; `pnpm --filter @festgrid/backend test`, `pnpm --filter @festgrid/backend lint`, `pnpm --filter @festgrid/backend build` — all against the local sandbox Postgres only. Confirm the migration from Task 2 is applied before running backend tests (restart/re-run `pnpm --filter @festgrid/database migrate` if the schema was regenerated after the first apply). Confirm zero network calls and zero live Gemini API calls were made at any point (this session has no network access regardless, but this is also this story's explicit environment constraint).

## Dev Notes

### Architecture & UX Gate Findings

Per `_bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md` (`swept: true`, 2026-10-14, `stories_covered` explicitly includes `'9.8'`), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide + story-specific, cited):** the readiness report's own "One gap found and corrected directly" section is about *this exact story*: "Story 9.8 ('Rate-limit prompt resolution') specified a per-user limit on `resolvePromptToEventFilter` without saying where that counter is persisted. This stack has no Redis/in-memory layer durable across Lambda cold starts... so a counter needs a real table + migration, not an in-process variable." That correction was applied directly to `epics.md`'s AC3 (now reproduced verbatim in this story's AC3) rather than spun into a separate prerequisite story, since it is a single-story-scoped fix, not an epic-wide or cross-epic one. This story's Task 1-2 implement exactly that correction.
- **Gate 3 (epic-wide + story-specific, cited):** the readiness report's Gate 3 section explicitly cross-checked this story against Epic 0.i2 (guarded outbound vendor calls) and concluded: "Epic 0.i2's 'rate limit' wording describes lock-based call serialization, not a true per-user quota; Story 9.8's per-user mutation-rate-limit is a genuinely distinct, not-yet-built concern" — corrected into `epics.md`'s AC4 (reproduced in this story's AC4). It also explicitly declined to generalize this into a new Epic 0 utility: "`resolvePromptToEventFilter` is the only mutation in `epics.md` today that needs a per-user, per-mutation volume quota... Generalizing now, with one consumer, would be premature," citing Story 3.7e's identical precedent. This story's Task 3-4 therefore live under `packages/domain/src/ai-event-filters/` and `apps/backend/src/lib/ai-event-filters/` (scoped to this one consumer), not a new shared/generic package.
- **Lightweight guard (this story, checked fresh — per the workflow's "reason whether this story's scope contains anything the epic-wide sweep plausibly didn't anticipate" instruction):** no new gap found. The only genuinely new artifact this story introduces beyond what the sweep already named — a specific table shape (`userId` as primary key, `requestCount`/`windowStartAt` columns) and specific default numbers (10 requests / 10 minutes) — are exactly the kind of story-level implementation detail the sweep explicitly deferred to this story ("the AC is corrected above to say so explicitly rather than leaving the boundary implicit"; no specific schema or numbers were dictated). Nothing here calls a new external service, bypasses the backend/API layer, or depends on unbuilt shared infrastructure.
- **Gate 2 (UI Complexity & Reusability, run fresh via the Agent tool, Freya persona, per this session's explicit dispatch instruction): No gap found.** Freya's verdict, verbatim: "This story adds no component — it reuses the AI-filter overlay's existing error slot, already built in Story 7.4 and already exercised by `NO_API_KEY`/`QUOTA_EXHAUSTED`/parse-failure paths... `use-ai-filter.ts`'s `onError` is already a generic string-passthrough with no code-branching logic for any existing error — `RATE_LIMITED` is simply one more value flowing through that same path... I checked `design-artifacts/UX-festgrid-run-1/DESIGN.md` and `EXPERIENCE.md`, and PRD §3.15... directly — none specifies a distinct visual/interaction treatment for a rate-limit case... Story 7.4's own AC already settled this precedent: 'a resolution error... surfaces inline in the overlay, not a silent failure' — generic by design." Confirmed directly in `apps/web/src/features/events/use-ai-filter.ts`: `onError: (err: any) => { ...; setError(err?.response?.errors?.[0]?.message || err?.message || 'Resolution failed'); }` — a brand-new `RATE_LIMITED` error message flows through this exact unmodified path with zero client code change. **No `apps/web`/`packages/ui` file is touched by this story.**

**No gap found by any gate.** This story proceeds as scoped, as a pure `packages/domain` + `apps/backend` change.

### Design decisions (resolved defaults — minimised per this session's dispatch instruction, not left as open questions)

1. **A new `isRateLimitWindowElapsed(windowStartAt, windowMinutes, now)` function is added rather than reusing `packages/domain/src/ai-gateway/usage-cycle.ts`'s existing `isCycleElapsed(usageCycleResetAt, cycleDays, now)`.** The two are mathematically interchangeable (`isCycleElapsed` could be called with `cycleDays = windowMinutes / 1440`), but doing so would mean calling a days-denominated API with a fractional-day argument computed backwards from minutes — a confusing misuse that invites a units bug the first time someone edits either call site without noticing the hidden conversion. A second, minutes-denominated sibling function with an identical shape is cheap, keeps each call site's units self-evident, and does not touch `isCycleElapsed`'s existing (already-tested, already-depended-upon by `apiKeys`/scraper usage) behavior at all.
2. **The rate-limit store (Task 4) is a plain read-then-write, not a single atomic SQL upsert (unlike `callVendor`'s lock-claim, which uses `onConflictDoUpdate` with a conditional `setWhere` specifically because it must prevent two concurrent callers from both believing they hold the same lock).** A per-user prompt-rate-limit has a fundamentally different concurrency profile: the realistic race is the same single user double-clicking "submit" or firing two tabs within milliseconds, not a distributed lock-contention scenario — and the existing, already-shipped precedent for exactly this shape of problem (`apps/backend/src/lib/ai-gateway/usage-store.ts#recordSuccessfulUsage`, counting `apiKeys.usageCount` against `usageCycleResetAt`) already accepts the same non-atomic read-then-update race without issue in production. Introducing a different (atomic upsert) pattern for this one new table, when an matching non-atomic pattern already exists and is accepted for the structurally identical `apiKeys` usage-counting problem, would be inconsistent precedent-wise for no proven benefit — at worst a user's burst of near-simultaneous requests is undercounted by one in a vanishingly rare race, never overcounted into a false denial, and never a security/cost control bypassed by more than a request or two at the margin.
3. **Resolved default: 10 requests per 10-minute window per user.** No specific number was ever specified upstream — `SPEC.md` (no price/rate-limit details beyond deferring numeric price to v2), `epics.md`'s Story 9.8 AC1/AC2 (says "configurable", gives no figure), `backlog.yaml`'s `BUG-059`/`DW-082` (describes the *absence* of a limit, not a target figure), and `epic-9-readiness.md` (corrects *where* the counter lives, not *what* the limit is) all leave this to the implementing story. Framing from the story's own user-story statement — "bigger prompts and retries cannot burn my quota unnoticed" — points at catching accidental retry storms/loops, not at being a strict anti-abuse throttle on legitimate interactive use (a user iterating through a few re-prompts while refining a filter, per CAP-1/CAP-3's re-prompt-to-change workflow, must not be blocked). 10 requests in 10 minutes comfortably covers several rounds of genuine re-prompting in one sitting while still catching a runaway retry loop (e.g. a buggy client auto-retrying on every render) well before it burns a meaningful amount of the user's own Gemini quota. Both figures are environment-configurable (AC2) so this default can be tuned later without a code change.
4. **No `docs/infrastructure/architecture-diagram.md`/`high-level-overview.md` update is made.** CLAUDE.md's upkeep rule triggers on a service, queue, Lambda, scraper, database, hosting provider, or major library being added/removed/replaced. This story adds one new table inside the already-documented, already-diagrammed Postgres database (`docs/infrastructure/index.md` → `3-database.md` already documents "PostgreSQL via Drizzle ORM" generically) — not a new database, service, or infrastructure component in the sense that document tracks. Matches the precedent already recorded by Stories 9.3 (new `ai_event_filters.expression` column) and 9.7 (own explicit note on this point): adding fields/tables to an existing, already-diagrammed Postgres instance does not independently warrant a diagram update.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: a new table is added; no existing type/column is changed, narrowed, or removed.**
- **Impacted fields/contracts:** `packages/database/schema.ts` gains one new `pgTable` export (`promptFilterRateLimits`) and no changes to any existing table. `packages/domain/src/ai-event-filters`'s public surface gains two new, additive exports (`isRateLimitWindowElapsed`, `evaluatePromptFilterRateLimit`, plus the `PromptFilterRateLimitState`/`PromptFilterRateLimitDecision` types) — nothing existing is renamed or altered. No `.graphql` schema file changes (see Task 5's note — `extensions.code` is error metadata, not a typed field), so no `graphql.ts` codegen regeneration is needed on either side.
- **Required DB migration changes:** one new Drizzle-kit-generated migration adding the `prompt_filter_rate_limits` table (`user_id uuid primary key references users(id) on delete cascade`, `request_count integer not null default 0`, `window_start_at timestamptz not null default now()`, `created_at`/`updated_at timestamptz not null default now()`), generated and applied per Task 2.
- **Backward compatibility and rollout notes:** purely additive — no existing row, column, query, or API contract is touched. A stale deployed backend bundle mid-rollout (pre-migration code running against a post-migration DB, or vice versa) is unaffected: old code never references the new table at all, and the new table has no foreign dependents, so it can exist unused with zero behavioral effect until the matching backend code deploys.
- **Verification checks:** `prompt-filter-rate-limit.test.ts` (pure logic, `packages/domain`, 100% branch coverage per Task 3); the two new integration cases in `ai-event-filters.test.ts` (Task 6) prove the real DB-backed path end to end against the locally-migrated table; `pnpm --filter @festgrid/database migrate` succeeding locally (Task 2) is itself the schema-compatibility proof for this environment.

### Previous Story Intelligence

Story 9.7 (`review`, implemented, the immediately-preceding story in this epic) is pure test/CI tooling with zero production-code overlap with this story — its own Out of Scope explicitly lists "Stories 9.8 (rate limiting)... unrelated, independent scope." The one thing worth carrying forward from it is procedural, not architectural: Story 9.7's Dev Notes decision 7 and Architecture & UX Gate Findings established the exact citation pattern (quote the readiness report's own text, state the lightweight-guard reasoning explicitly, run only Gate 2 fresh) this story's own Dev Notes follow verbatim. Story 9.4 (`review`, implemented) remains the structural owner of `resolvePromptToEventFilter`'s current shape (prompt validation → `NO_API_KEY` precheck → `callGemini` → parse → transform → resolve account ids → respond) that this story's Task 5 inserts into, unchanged apart from the new early-return branch. No prior Epic 9 story has added a database table (9.1a-9.7 are all `packages/domain`/resolver/UI/CI changes against already-existing tables), so this story is the first in the epic to exercise Task 1-2's migration-generation flow — there is no epic-local precedent for the generate/apply sequence itself, only the project-wide one already demonstrated by every other epic's table-adding stories (e.g. `vendor_call_locks` in Story 0.i2a).

### Git Intelligence Summary

`git log --oneline -8` shows the tip is `8a9d9a1 feat(9.7): golden-prompt evals for the AI filter (review)`, preceded entirely by `wip(9.7)`/`chore(9.6)` commits — confirming 9.7 is the immediately-preceding, now-`review` work and there is no other concurrent epic work to reconcile against. `git status --short` is clean. Commit message convention observed: `type(scope): short description`, e.g. `wip(9.8): ...`, `feat(9.8): ...`, `chore(9.8): ...` — this story's dev-story pass should follow the same pattern.

### Project Structure Notes

- `packages/database/schema.ts` is UPDATEd (Task 1, additive new `pgTable` export only).
- `packages/database/migrations/<next-number>_<auto-generated-name>.sql` is NEW, drizzle-kit-generated (Task 2) — do not hand-author.
- `apps/backend/src/env.ts` is UPDATEd (new Task, folded into Task 3/4's wiring below — see note) — two new `BackendEnv` fields + their `loadBackendEnv()` parsing, following the existing `parseNonNegativeInt(...)` pattern used by `geminiPostsPerKeyPerCycle`.
- `packages/domain/src/ai-event-filters/prompt-filter-rate-limit.ts` is NEW (Task 3).
- `packages/domain/src/ai-event-filters/prompt-filter-rate-limit.test.ts` is NEW (Task 3).
- `packages/domain/src/ai-event-filters/index.ts` is UPDATEd (Task 3, one new `export *` line, additive only).
- `apps/backend/src/lib/ai-event-filters/prompt-filter-rate-limit-store.ts` is NEW (Task 4).
- `apps/backend/src/schema/resolvers.ts` is UPDATEd (Task 5, one new import + one new early-return branch inside `resolvePromptToEventFilter` only — no other resolver touched).
- `apps/backend/src/schema/ai-event-filters.test.ts` is UPDATEd (Task 6, two new `t.test(...)` cases + one new cleanup line + one import addition).
- No `apps/web`, `packages/ui`, or `.graphql` schema file is touched by this story (confirmed by Gate 2's "no gap" verdict and Task 5's note above).
- No `.github/workflows/*` file is touched — out of scope for this session regardless (no workflow-scope push access) and not needed: this story adds no CI job, only existing-suite test cases that already run under the existing `pnpm --filter @festgrid/domain test` / `pnpm --filter @festgrid/backend test` steps.
- No conflicts detected with the unified project structure.

**Note on `env.ts`:** the task list above (Tasks 1-7) folds the `env.ts` change into Task 3/4's scope rather than giving it its own numbered task, since it has no independent AC of its own — it exists only to make AC2's "configurable" requirement concrete for Tasks 3-4 to consume. The dev agent should still treat it as its own discrete edit when implementing (add the two `BackendEnv` fields and their `loadBackendEnv()` lines before writing the store in Task 4, which reads them via `loadBackendEnv()`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.8: Rate-limit prompt resolution] — authoritative ACs this story elaborates (already includes the epic-readiness sweep's AC3/AC4 corrections).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] — Gate 1/3 epic-wide sweep findings cited above; confirms `9.8` is in `stories_covered` and carries this story's own named correction.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#BUG-059, BUG-011] — the originating backlog row ("resolvePromptToEventFilter has no rate limit, so repeated prompts burn the user's own Gemini key quota") and its parent.
- [Source: _bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml#DW-082] — the original code-review finding this story absorbs (AC2).
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md] — confirms no numeric rate-limit figure is specified anywhere upstream (Dev Notes decision 3).
- [Source: apps/backend/src/schema/resolvers.ts#resolvePromptToEventFilter, lines ~321-385] — read in full; the exact production call path this story's Task 5 inserts into (prompt validation → NO_API_KEY precheck → callGemini → parse → transform → account-id resolution → response), and the existing `NO_API_KEY`/`QUOTA_EXHAUSTED`/`TEMPORARILY_BUSY` error-code convention `RATE_LIMITED` follows.
- [Source: apps/backend/src/lib/vendor-gateway/guarded-call.ts] — read in full; confirms `callVendor`'s per-key lock/timeout/backoff mechanism is structurally distinct from (and unaware of) any per-user request-volume concept, grounding AC4.
- [Source: apps/backend/src/lib/ai-gateway/usage-store.ts, packages/domain/src/ai-gateway/usage-cycle.ts] — read in full; the exact `isCycleElapsed`/read-then-update precedent this story's pure logic (Task 3) and store (Task 4) deliberately mirror, and the reasoning (Dev Notes decisions 1-2) for why a sibling function and the same non-atomic pattern are used rather than reusing/generalizing the existing ones.
- [Source: apps/backend/src/schema/resolvers.ts#selectPostsForExtraction quota check, lines ~2108-2140] — read; confirmed to be a *different* mechanism (a selection-count quota against `apiKeys.usageCount`/cycle), not reusable for this per-mutation rate limit — corroborates `epic-9-readiness.md`'s own finding that no existing mechanism already covers this.
- [Source: packages/database/schema.ts#vendorCallLocks, apiKeys, aiEventFilters, timestamps] — read in full; the exact `pgTable`/column-style conventions (`uuid`/`text`/`integer`/`timestamp` imports from `drizzle-orm/pg-core`, the shared `...timestamps` spread, a single-column primary key for a one-row-per-key table) Task 1's new table follows.
- [Source: packages/database/migrate.ts, drizzle.config.ts, package.json] — read in full; confirms the `generate`/`migrate` scripts this story's Task 2 must use, and that `migrate.ts` already special-cases a `localhost`/`127.0.0.1` `DATABASE_URL` (no SSL) — matching this session's local-sandbox-only environment constraint with no code change needed.
- [Source: apps/backend/src/env.ts] — read in full; the exact `BackendEnv` interface shape, `parseNonNegativeInt` validator, and `loadBackendEnv()` wiring pattern (e.g. `geminiPostsPerKeyPerCycle`) the two new env fields follow.
- [Source: apps/backend/src/schema/ai-event-filters.test.ts] — read in full; the exact resolver-level integration-test setup (shared `yoga` instance, `mockUser`, `setCallGeminiGenerateContent` seam, `t.after` cleanup block already deleting `aiEventFilters`/`apiKeys`/`vendorCallLocks` rows for `testUser`) Task 6 extends.
- [Source: apps/backend/src/schema/api-keys.test.ts, lines ~400-436] — the existing `process.env.X = '...'` override-with-save/restore convention Task 6's denial-case test may reuse for a deterministic small limit.
- [Source: apps/web/src/features/events/use-ai-filter.ts] — read in full; confirms the client's fully generic `onError` error-surfacing path, grounding Gate 2's "no gap" verdict and this story's "no `apps/web` change" scope.
- [Source: packages/domain/package.json, packages/database/package.json] — confirms the `./ai-event-filters` subpath export (already consumed by `resolvers.ts`/`use-ai-filter.ts`) and the `generate`/`migrate`/`test` script names used throughout this story.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, the epic-level-sweep citation rule, and the lightweight-guard instruction this story's Architecture & UX Gate Findings section follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database & Performance (Drizzle-only DB access, no Supabase client for queries; local-vs-Supabase environment split in `migrate.ts` already matches "all migrations... must work seamlessly across both"); Credential Management (no new credentials introduced — this story adds no `.env` secret, only two plain numeric config vars); Code Organization (`packages/domain` purity — Task 3's new module is pure TypeScript with zero DB/ORM/Node-only import; Testing Rules' 100%-unit-test-coverage convention for `packages/domain`, satisfied by Task 3's test file).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — no PRD section is directly implicated (the AI prompt filter feature itself is PRD §3.15/§4.18, amended by Story 9.9z, not this story; this story is a backend hardening/guard addition with no new user-facing capability or PRD-level behavior change).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file follows its canonical 15-section order, status vocabulary, and Pre-Coding Approval Gate/Implementation Plan structure exactly.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no new AD section is implicated; this story extends existing, already-spine-covered mechanisms (Drizzle schema/migrations, the existing GraphQL error-extension convention) without introducing a new architectural decision; full file not loaded, consistent with Stories 9.1a-9.7's own precedent.
- [x] `docs/infrastructure/index.md` — not applicable as a new infrastructure component (see Dev Notes decision 4 — a new table inside the already-documented Postgres database does not warrant a diagram update); full infra shards not loaded beyond what was already needed to confirm this.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `packages/database/schema.ts` (Task 1 — new `promptFilterRateLimits` table).
  - NEW `packages/database/migrations/<next>_<auto-name>.sql` + updated `meta/` snapshot/journal (Task 2, drizzle-kit-generated).
  - UPDATE `apps/backend/src/env.ts` (two new `BackendEnv` fields + parsing, folded into Task 3/4 per the Project Structure Notes above).
  - NEW `packages/domain/src/ai-event-filters/prompt-filter-rate-limit.ts` + `.test.ts` (Task 3).
  - UPDATE `packages/domain/src/ai-event-filters/index.ts` (Task 3, one new export line).
  - NEW `apps/backend/src/lib/ai-event-filters/prompt-filter-rate-limit-store.ts` (Task 4).
  - UPDATE `apps/backend/src/schema/resolvers.ts` (Task 5, `resolvePromptToEventFilter` only).
  - UPDATE `apps/backend/src/schema/ai-event-filters.test.ts` (Task 6).
- **Rule Mapping:**
  - AC1 (deny over-limit without calling Gemini) → Task 5 (resolver wiring), Task 6 (denial-case test with Gemini-call-count assertion).
  - AC2 (configurable + tested) → Task 3 (`env.ts` fields, folded in), Task 3 (pure-function unit tests), Task 6 (integration test exercising the configured default/override).
  - AC3 (Postgres-persisted, Drizzle migration, local-only apply) → Task 1 (schema), Task 2 (generate + migrate, local sandbox only — this session's environment constraint).
  - AC4 (additive, not merged with `callVendor`) → Task 5's explicit code comment and structural separation; Dev Notes' Architecture & UX Gate Findings citation of the readiness report's own Gate 3 correction.
  - `packages/domain` purity/100%-coverage convention (project-context.md) → Task 3's module is pure TypeScript, zero DB/ORM/Node-only import, fully unit-tested.
  - Drizzle-only DB access / local-vs-Supabase migration rule (project-context.md) → Task 2's explicit local-only `generate`/`migrate` instructions.
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md` plus the lightweight-guard reasoning above; Gate 2 run fresh via the Agent tool (Freya persona) — no gap found, documented in Architecture & UX Gate Findings above.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — new `prompt-filter-rate-limit.test.ts` passes with full branch coverage; full existing `domain` suite stays green.
  - `pnpm --filter @festgrid/domain lint`/`build` — clean.
  - `pnpm --filter @festgrid/database generate` then `pnpm --filter @festgrid/database migrate` — against the local sandbox Postgres only; confirm "Migrations completed successfully" and the new table exists (e.g. via `pnpm --filter @festgrid/database studio` or a direct `psql`/query check, dev agent's discretion) before running backend tests.
  - `pnpm --filter @festgrid/backend test` — the two new `ai-event-filters.test.ts` cases pass (denial + window-reset), the Gemini-mock call-count assertion proves AC1's "never calls Gemini" claim, and the full existing backend suite (including the row-count ratchet) stays green — the new cleanup line in `t.after` is what keeps the ratchet passing for this table.
  - `pnpm --filter @festgrid/backend lint`/`build` — clean.
  - Manual: confirm no network call and no live Gemini API call is made at any point during this story's implementation or verification (this session's explicit environment constraint — matches Story 9.7's identical constraint, re-affirmed here since this story does touch a resolver that calls Gemini in its *unblocked* path, even though this story's own test doubles that call via the existing `setCallGeminiGenerateContent` seam, never the real API).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — one new `packages/database` table + migration (generated and applied locally only), two new `BackendEnv` config fields, one new `packages/domain` pure module + its tests, one new `apps/backend` DB-backed store module, a one-branch addition to one existing resolver, two new integration-test cases plus a cleanup-line addition in an existing test file; zero GraphQL schema change, zero `apps/web`/`packages/ui` touch, zero `.github/workflows` touch, zero live-network or live-Gemini call made by the dev agent at any point.
- [ ] Architecture and boundary confirmation — Gate 1/3 cited from `epic-9-readiness.md` (both findings are this story's own named corrections, already folded into the ACs above) plus a lightweight-guard reasoning pass (no new gap); Gate 2 run fresh via the Agent tool (Freya persona) found no gap (the new error code flows through the AI-filter overlay's existing generic error-surfacing path with zero client change).
- [ ] Testing plan confirmation — `packages/domain`: 100%-branch-covering unit tests on the new pure window/decision logic. `apps/backend`: two new DB-backed integration tests (denial, window-reset) against the locally-migrated table, with an explicit assertion that the Gemini mock is never called in the denial case, plus a new row-count-ratchet cleanup line for the new table.
- [ ] Explicit human approval state — APPROVED by user (dispatch instruction for this Epic 9 batch: "skip Gate 1/3 and run Gate 2 only... Minimise questions: choose the recommended default and record it in Dev Notes," plus this story's own explicit environment constraints: local sandbox Postgres only; any migration generated with the repo's drizzle tooling and applied only locally via the repo's own migrate script; no network; must not call the live Gemini API; cannot push `.github/workflows` files so no workflow changes are planned; do not edit `backlog.yaml`; do not push), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above (decisions 1-4), matching Stories 9.1a-9.7's own identical precedent for this same batch. The one decision with a real, non-mechanical tradeoff — the exact numeric rate-limit default (Dev Notes decision 3) — has no upstream-specified figure to defer to, so per the dispatch instruction it is resolved to the documented, lower-risk default (generous enough not to block genuine re-prompting, per CAP-1/CAP-3) rather than raised as a blocking question.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap beyond this story's own already-applied AC corrections (cited, plus lightweight-guard reasoning above). Gate 2: no gap, N/A (run fresh). No prerequisite story is created by this story.

## Testing Requirements

- [ ] Unit tests (`tsx --test`, `packages/domain`): `prompt-filter-rate-limit.test.ts` — `isRateLimitWindowElapsed` (not elapsed, elapsed, exact-boundary) and `evaluatePromptFilterRateLimit` (no prior state, under limit, at limit, over limit, window-elapsed reset) with 100% branch coverage.
- [ ] Integration tests (`apps/backend`, `node:test` via `ai-event-filters.test.ts`): denial case (seeded at-limit row → `RATE_LIMITED`, Gemini mock not called) and window-reset case (seeded stale row outside the window → succeeds, counter resets).
- [ ] Regression check: `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/backend test` (full existing suites, including the row-count ratchet) stay green — the new cleanup line is required for the ratchet to pass.
- [ ] E2E tests: not applicable — no new route/page/critical-flow surface (confirmed by Gate 2's "no gap" verdict); this story is a backend-only guard with no new UI path.
- [ ] Manual DB check: confirm the new migration applies cleanly against the local sandbox Postgres (`pnpm --filter @festgrid/database migrate`) before running the backend integration suite.

## Deliverables Checklist

- [ ] `packages/database/schema.ts` exports `promptFilterRateLimits`; a corresponding migration file exists under `packages/database/migrations/` and applies cleanly to the local sandbox Postgres.
- [ ] `apps/backend/src/env.ts`'s `BackendEnv` carries `promptFilterRateLimitMaxRequests`/`promptFilterRateLimitWindowMinutes`, both configurable via `PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS`/`PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES`, defaulting to 10/10.
- [ ] `packages/domain/src/ai-event-filters/prompt-filter-rate-limit.ts` exports `isRateLimitWindowElapsed`/`evaluatePromptFilterRateLimit`, 100%-branch-tested, re-exported from the package's `ai-event-filters` barrel.
- [ ] `apps/backend/src/lib/ai-event-filters/prompt-filter-rate-limit-store.ts` exists and is consumed by `resolvePromptToEventFilter`.
- [ ] `resolvePromptToEventFilter` throws `GraphQLError` with `extensions.code: 'RATE_LIMITED'` when the per-user limit is exceeded, before any `callGemini` invocation, and the existing `NO_API_KEY`/`QUOTA_EXHAUSTED`/`TEMPORARILY_BUSY` error paths are unchanged.
- [ ] `ai-event-filters.test.ts` carries the two new cases plus the new cleanup line; all new and existing tests pass.
- [ ] `pnpm --filter @festgrid/domain test`/`lint`/`build` and `pnpm --filter @festgrid/backend test`/`lint`/`build` all green; no live network or Gemini call made at any point.

## Out of Scope

- **Any change to `callVendor`/`callGemini`'s per-key lock/timeout/backoff mechanism** — this story's guard is additive and structurally separate (AC4); the existing mechanism is read-only reference context, never modified.
- **Any UI/client change in `apps/web`** — Gate 2 found the existing generic error-surfacing path in `use-ai-filter.ts` already adequate; a future, dedicated-copy/translated rate-limit message is a legitimate backlog idea (per Freya's Gate 2 note) but is not this story's scope and is not split into a new prerequisite story, since nothing in the authoritative UX artifacts mandates it today.
- **Generalizing the rate-limit mechanism into a new shared/Epic 0 utility** — `epic-9-readiness.md`'s Gate 3 explicitly declined this (one consumer today), matching Story 3.7e's precedent; revisit only if a second BYOK-gated synchronous mutation needs the same guard.
- **Any `.github/workflows/*` change** — out of scope for this story's actual need (no CI job is added, only test cases inside already-covered suites) and additionally blocked in this session (no workflow-scope push access).
- **Promoting/updating `_bmad-output/implementation-artifacts/backlog.yaml` or `BUG-059`'s status** — explicitly deferred per this session's dispatch instruction; `sprint-status.yaml`'s own `development_status` entry for this story is updated by the standard `bmad-create-story`/`bmad-dev-story` status-transition mechanics only, not by a story Task.
- **Applying the migration anywhere other than the local sandbox Postgres** (no Supabase/production apply) — explicitly out of scope and not possible in this session regardless (no network access).
- No new Gate 1/2/3 gap was found by this story beyond its own already-applied AC corrections (cited above); no new prerequisite story results from it.

## Definition of Done

- [ ] AC1-AC4 satisfied and verified by their respective tests/edits.
- [ ] Required tests passing: `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/backend test` (including the row-count ratchet, satisfied by the new cleanup line).
- [ ] Lint and type checks passing: `pnpm --filter @festgrid/domain lint`/`build`, `pnpm --filter @festgrid/backend lint`/`build`.
- [ ] The migration from Task 2 is generated via `pnpm --filter @festgrid/database generate` and applied only to the local sandbox Postgres via `pnpm --filter @festgrid/database migrate` — never hand-written SQL, never applied to a non-local `DATABASE_URL`.
- [ ] Zero network call, zero live Gemini API call, made by the dev agent at any point during implementation or verification.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
