---
baseline_commit: 600f6133ab027f5890744c54e5c88f847b7896cd
---
# Story 0.i2a: Build the guarded vendor-call wrapper

## Story Details

- Epic: 0.i2 (Guarded outbound vendor calls)
- Story ID: 0.i2a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want one wrapper around outbound vendor calls that enforces a per-key lock, a request timeout, retry backoff, and a DPA-confirmation gate before the call is made,
so that no call site can bypass locking, hang indefinitely, retry without backoff, or fire against a vendor whose DPA was never confirmed.

## Acceptance Criteria

1. **Given** any future code path that needs to call Gemini, Apify, or Bright Data, **when** it calls through this story's new module, **then** exactly one function — `callVendor(vendor, opts)` — is exported from exactly one new module, `apps/backend/src/lib/vendor-gateway/guarded-call.ts` (sibling to `lib/ai-gateway` and `lib/scraper`, not folded into either). [AD-32 Rule 1]
2. **Given** a call with an `opts.lockKey` set, **when** `callVendor` runs, **then** it claims the lease row atomically via one `INSERT ... ON CONFLICT (lock_key) DO UPDATE ... WHERE vendor_call_locks.locked_until < now() RETURNING *`-equivalent Drizzle statement (idiomatic form: `.insert(vendorCallLocks).values(...).onConflictDoUpdate({ target, set, where }).returning()`) against the new `vendor_call_locks(lock_key TEXT PRIMARY KEY, locked_until TIMESTAMPTZ NOT NULL)` table — **never** a Postgres advisory lock (`pg_advisory_lock`/`pg_advisory_xact_lock`), which is unsafe under this project's mandated Supabase transaction-mode pooler (AD-32 Rule 2, incident 2026-08-27). Zero rows returned means the key is busy elsewhere and throws `VendorKeyBusyError`, unretried by `callVendor` itself. [AD-32 Rule 2]
3. **Given** a successful or failed call, **when** the lock was claimed in AC2, **then** it is released in a `finally` block via one `UPDATE vendor_call_locks SET locked_until = now() WHERE lock_key = $1` — guaranteed to run on every exit path (success, transient-retry loop, or final propagated error). [AD-32 Rule 2]
4. **Given** `opts.lockKey` is omitted (undefined), **when** `callVendor` runs, **then** the lock claim/release step is skipped entirely — no DB write, no `VendorKeyBusyError` possible — supporting a future caller (e.g. Story 0.i2b's `verifyGeminiApiKey` adoption) that has no stable credential identity yet to lock against. [AD-32 Rule 3]
5. **Given** any call, **when** `callVendor` runs an attempt, **then** it creates one `AbortController` for that attempt and invokes the caller's thunk as `opts.call(controller.signal)`; if `opts.timeoutMs` elapses before the thunk resolves, `callVendor` calls `controller.abort()` and throws a new `VendorCallTimeoutError` — a generic, wrapper-level bound (via `Promise.race` against a `setTimeout`) that applies even if the thunk ignores the signal entirely, while a thunk that does honor the signal (e.g. Gemini, once 0.i2b/0.i2c thread it through) gets real cancellation, not just a bounded wait. Distinct from Gemini's own existing `GeminiTimeoutError` (which remains `gemini-client.ts`'s own, more precise cancellation, unchanged by this story — `verifyGeminiApiKey`'s adoption of the new signal is 0.i2b/0.i2c's scope). [AD-32 Binds/Rule 1; amended at Pre-Coding Approval Gate, 2026-10-06, user decision]
6. **Given** the caller's `call()` thunk throws, **when** `callVendor` evaluates the error, **then** it retries the same credential with backoff **only if** the caller-supplied `opts.isTransient(error)` predicate returns `true`, reusing `computeBackoffDelayMs` from `@festgrid/domain` (no second backoff formula), up to `opts.maxAttempts` (default `3`) total attempts; a non-transient error, a `VendorCallTimeoutError`, a `VendorKeyBusyError`, or a `VendorDpaNotConfirmedError` is never retried by `callVendor` and propagates immediately. `callVendor` never does multi-credential selection — it operates on exactly one already-identified credential per call, by design. [AD-32 Rule 4]
7. **Given** `vendor` is `'apify'` or `'brightdata'`, **when** `callVendor` runs, **then** it checks `APIFY_SCRAPING_CONFIRMED` / `BRIGHTDATA_SCRAPING_CONFIRMED` respectively — via the existing `parseBooleanDefaultOn()` helper in `apps/backend/src/env.ts` (the same helper already used for `BLUR_FACES_BEFORE_AI`; no new parsing function), **default `true` when unset** — **before** the lock claim (AC2) and before any network call. A `false` value throws `VendorDpaNotConfirmedError`, which always propagates, is never retried, and never excludes a key (it is a vendor-level refusal, not a per-credential one). **Given** `vendor` is `'gemini'`, **when** `callVendor` runs, **then** no DPA check of any kind is performed, and no Gemini-specific flag is ever read — the DPA gate code path does not branch on Gemini at all. [AD-32 Rule 5]
8. **Given** this story ships, **when** the migration is generated, **then** `packages/database/schema.ts` gains a `vendorCallLocks` Drizzle table definition matching AD-32 Rule 2's literal shape, and a drizzle-kit-generated migration file (numbered strictly after the latest file present on `origin/master` at generation time — **never hand-numbered**, and `origin/master` is re-checked immediately before the migration is generated/committed, not just at story-creation time) lands in `packages/database/migrations/`. [AD-32 Rule 2; user-decided mechanism]
9. **Given** this story's scope, **when** it ships, **then** it does **not** modify `apps/backend/src/lib/ai-gateway/{adapter,gemini-client,system-key-adapter}.ts`, `apps/backend/src/lib/scraper/{brightdata-client,trigger-apify-for-target}.ts`, or any GraphQL resolver — no existing call site is adopted onto `callVendor` by this story. Adoption is Stories 0.i2b (Gemini sync verification), 0.i2c (Gemini async inference), and 0.i2d (Apify/Bright Data scraper call sites — new, see Dev Notes). [AD-32 Rule 6; Gate 3 finding]
10. **Given** the new module, **when** this story's test suite runs, **then** `apps/backend/src/lib/vendor-gateway/guarded-call.test.ts` (real local Postgres via the existing `db` client — no mocked DB, matching `cache-store.test.ts`'s precedent, never `apps/backend`'s own `packages/domain` 100%-coverage rule, which does not apply outside `packages/domain`) proves, at minimum: successful claim+release; busy-lock rejection (`VendorKeyBusyError`) when a second claim is attempted before `locked_until` expires; successful claim once an expired lock's `locked_until` has passed; `lockKey`-omitted skips the lock table entirely; a transient error retries with backoff and eventually succeeds; a non-transient error propagates on the first attempt with no retry; `maxAttempts` exhaustion propagates the last error; the wrapper-level timeout fires `VendorCallTimeoutError` on a thunk that never resolves; **the `AbortSignal` passed into the thunk is aborted when the timeout fires** (asserted via a thunk that records `signal.aborted`/listens for the `abort` event); the DPA gate rejects `apify`/`brightdata` when its env var is explicitly `'false'`, allows it when unset (default-true), and is never invoked at all for `vendor: 'gemini'`.

## Tasks / Subtasks

- [ ] **Task 1: Add the `vendor_call_locks` table** (AC: 8)
  - [ ] In `packages/database/schema.ts`, add `export const vendorCallLocks = pgTable('vendor_call_locks', { lockKey: text('lock_key').primaryKey(), lockedUntil: timestamp('locked_until', { withTimezone: true }).notNull() });` — deliberately minimal per AD-32 Rule 2's literal shape: no `id`/`uuid`, no `timestamps`, no soft delete (this is a lease row, not a domain entity).
  - [ ] Immediately before generating the migration, run `git fetch origin master` and confirm the latest file in `packages/database/migrations/` on `origin/master` is still the expected next-after number (`0075_fat_mariko_yashida.sql` was the latest as of this story's creation on 2026-10-06 — re-verify, do not assume it still is). If a newer migration landed since, pull/rebase first so drizzle-kit's auto-incremented number (expected `0076` or later) doesn't collide with one another branch already claimed.
  - [ ] Run the repo's drizzle-kit generate command (`pnpm --filter database run generate` or equivalent — check `packages/database/package.json` scripts) to produce the migration file. **Never hand-author or hand-number the migration file** — let drizzle-kit name it from its own journal sequence.
  - [ ] Run the repo's local migration script (`pnpm --filter database run migrate`, matching this session's own startup-hook output) to apply it locally before writing tests against it.
- [ ] **Task 2: Build `apps/backend/src/lib/vendor-gateway/guarded-call.ts`** (AC: 1, 2, 3, 4, 5, 6, 7, 9)
  - [ ] Define and export: `export type VendorName = 'gemini' | 'apify' | 'brightdata';`, `export class VendorKeyBusyError extends Error`, `export class VendorDpaNotConfirmedError extends Error`, `export class VendorCallTimeoutError extends Error` (each setting `this.name` to its own class name, mirroring `gemini-client.ts`'s existing error-class pattern).
  - [ ] Define `export interface CallVendorOptions<T> { lockKey?: string; timeoutMs: number; maxAttempts?: number; lockTtlMs?: number; isTransient: (error: unknown) => boolean; call: (signal: AbortSignal) => Promise<T>; }` and `export async function callVendor<T>(vendor: VendorName, opts: CallVendorOptions<T>): Promise<T>`.
  - [ ] Implement the per-attempt sequence exactly as AD-32 Rule 1 orders it, repeated by the outer retry loop (bounded by `opts.maxAttempts ?? 3`): (a) if `vendor !== 'gemini'`, run the DPA-gate check (AC7) — throw `VendorDpaNotConfirmedError` and return immediately (no retry, no lock claim) on failure; (b) if `opts.lockKey` is set, claim the lock (AC2) — throw `VendorKeyBusyError` and return immediately (no retry) on a busy lock; (c) create a fresh `AbortController` for this attempt and race `opts.call(controller.signal)` against a `setTimeout`-based timer of `opts.timeoutMs` — on expiry, call `controller.abort()` then throw `VendorCallTimeoutError` (AC5); this bounds every call even if the thunk ignores the signal, while a signal-aware thunk gets real cancellation; (d) release the lock in a `finally`, if claimed (AC3); (e) on any thrown error from (a)-(c) other than the two immediate-throw cases, if `opts.isTransient(error)` is `true` and attempts remain, `await` `computeBackoffDelayMs(attempt, ...)` (imported from `@festgrid/domain`, same as `adapter.ts` already does) then loop; otherwise rethrow.
  - [ ] Lock claim (step b) implementation: use Drizzle's idiomatic `.insert(vendorCallLocks).values({ lockKey, lockedUntil: sql`now() + interval '${ttlSeconds} seconds'` }).onConflictDoUpdate({ target: vendorCallLocks.lockKey, set: { lockedUntil: sql`now() + interval '${ttlSeconds} seconds'` }, where: sql`${vendorCallLocks.lockedUntil} < now()` }).returning()` against the existing `db` client (`apps/backend/src/db/client.ts`) — zero returned rows means busy. Confirm Drizzle's conditional `onConflictDoUpdate({ where })` support against the installed `drizzle-orm@^0.30.10` before relying on it; if unsupported at that version, fall back to a single raw `db.execute(sql\`...\`)` statement using AD-32's literal SQL (acceptable exception to "always use the query builder" here, since this one statement's atomicity is the entire safety property AD-32 Rule 2 depends on — document the fallback choice in Completion Notes if taken).
  - [ ] TTL (`lockTtlMs`) default: do **not** hardcode one global constant. Default to `Math.max(opts.timeoutMs * 2, 60_000)` (floor of 60s) when `opts.lockTtlMs` is omitted — ties the crash-safety-net window to whatever timeout the specific call declares (a short verification call gets a short TTL; a long extraction call gets a longer one) rather than guessing one number for every future vendor/call shape. Callers may override via `opts.lockTtlMs` once real timing evidence (AD-32's own deferred item) justifies a different formula.
  - [ ] DPA gate (step a) implementation: `vendor === 'apify' ? parseBooleanDefaultOn(env.apifyScrapingConfirmed... )` — see Task 3 for the actual env var wiring; this task just wires the lookup into `guarded-call.ts`'s control flow. Gemini must have **zero** branches referencing any DPA flag — not even a no-op check — per AC7's "does not branch on Gemini at all."
- [ ] **Task 3: Add the two new DPA-gate env vars** (AC: 7)
  - [ ] In `apps/backend/src/env.ts`'s `BackendEnv` interface, add `apifyScrapingConfirmed: boolean;` and `brightdataScrapingConfirmed: boolean;`, each with a comment mirroring `blurFacesBeforeAi`'s existing comment style (default-ON rationale, kill-switch framing, cite FIND-004/AD-32).
  - [ ] In `loadBackendEnv()`, add `apifyScrapingConfirmed: parseBooleanDefaultOn(process.env.APIFY_SCRAPING_CONFIRMED, 'APIFY_SCRAPING_CONFIRMED'),` and the Bright Data equivalent — reuse the existing exported `parseBooleanDefaultOn` function verbatim (already exported from this same file for `BLUR_FACES_BEFORE_AI`); do not write a second boolean parser.
  - [ ] Add `APIFY_SCRAPING_CONFIRMED=` and `BRIGHTDATA_SCRAPING_CONFIRMED=` to root `.env.example`, each commented as a default-true kill switch (set to `false` to disable that vendor's calls pending DPA reconfirmation), under the existing Apify/Bright Data env var sections.
- [ ] **Task 4: Tests** (AC: 10)
  - [ ] Create `apps/backend/src/lib/vendor-gateway/guarded-call.test.ts` using `node:test` + `node:assert/strict` against the real local `db` client — mirror `apps/backend/src/lib/geolocation/cache-store.test.ts`'s shape (delete any pre-existing row for the test's `lockKey` before each sub-test; assert both the thrown/returned value and, where relevant, the raw `vendor_call_locks` row state via a direct `db.select()`).
  - [ ] Cover every scenario listed in AC10. For the timeout case, use a `call(signal)` thunk that never resolves (`new Promise(() => {})`) against a short `timeoutMs` (e.g. `50`) so the test stays fast — do not rely on a real slow network call. Additionally assert the thunk's received `signal` is aborted after the timeout fires (e.g. attach `signal.addEventListener('abort', ...)` inside the thunk and assert it fired, or poll `signal.aborted`).
  - [ ] For the busy-lock case, pre-insert a row with `lockedUntil` in the future for the same `lockKey` before calling `callVendor`, and assert `VendorKeyBusyError` is thrown without the thunk ever being invoked (spy/counter on `call`).
  - [ ] For the expired-lock case, pre-insert a row with `lockedUntil` in the past, and assert the claim succeeds (the `WHERE locked_until < now()` branch of the upsert).
- [ ] **Task 5: Verification** (AC: 1-10)
  - [ ] `pnpm --filter database run generate` produced exactly one new migration file, correctly numbered (Task 1).
  - [ ] `pnpm --filter backend exec tsx --test src/lib/vendor-gateway/guarded-call.test.ts` passes.
  - [ ] `pnpm build` and `pnpm lint` are clean at the repo root for `packages/database` and `apps/backend`.
  - [ ] Confirm via `git grep` that no file under `apps/backend/src/lib/ai-gateway/` or `apps/backend/src/lib/scraper/` was modified by this story (AC9) — this story is additive-only.

## Dev Notes

- **This story is pure backend infrastructure/plumbing — it builds the mechanism and adopts nothing.** No existing call site changes behavior as a result of this story landing; `callVendor` exists but is uncalled by production code until Stories 0.i2b/0.i2c/0.i2d land. This mirrors the "reserved slot, not implemented" pattern already established by Stories 0.7, 0.8, 0.9, 0.12, 0.13, 0.15, 0.23.
- **Full AD-32 text was read in full** (`festgrid-architecture-spine.md` lines 1785-1907) — it is the authoritative source for every Rule citation above. Where AD-32 leaves an explicit implementation gap ("sizing deferred to the building story, needs real timing evidence" for the lock TTL), this story makes a concrete, documented choice (Task 2's `Math.max(timeoutMs * 2, 60_000)` formula) rather than leaving it unresolved, since this story *is* "the building story" AD-32 refers to.
- **Why a generic `Promise.race`-based timeout (AC5) that ALSO supplies its own `AbortController` signal to the thunk (amended at Pre-Coding Approval Gate, 2026-10-06, user decision):** The original draft proposed a `Promise.race` bound with no cancellation plumbing, reasoning that mandating per-vendor `AbortController` support before adoption would block Apify/Bright Data (0.i2d) on each adapter first implementing abort support. The user's Pre-Coding Gate decision keeps the `Promise.race` bound (so a thunk ignoring the signal is still never blocked past `timeoutMs`) but has `callVendor` itself own an `AbortController` per attempt, aborting it on timeout and passing `controller.signal` into `opts.call(signal)`. This gives every caller the unconditional bound immediately, *and* gives any signal-aware thunk (Gemini, once 0.i2b/0.i2c thread the signal through — replacing `gemini-client.ts`'s own inline Story-3.6s `AbortController` timeout rather than stacking a second one) genuine cancellation for free, with zero extra work required from Apify/Bright Data's adapters (they simply ignore the signal until 0.i2d chooses to use it). AD-32 Rule 1 itself is unaffected — it specifies that the caller supplies a thunk; the thunk's signature gaining an `AbortSignal` parameter is a compatible, non-breaking detail of this story's own module, not a new architectural rule.
- **Why DPA-gate and lock-claim ordering is DPA-first (AC7 before AC2):** AD-32 Rule 1 orders the sequence "DPA-gate check → lock claim" explicitly — a vendor-level refusal should never touch the lock table (no point claiming/releasing a lease for a call that was never going to happen). Reversing this order would also make `VendorDpaNotConfirmedError` and `VendorKeyBusyError` race against each other in a way AD-32 doesn't describe.
- **Why `isTransient` is a required, caller-supplied parameter, not a built-in classifier:** AD-32 Rule 4 explicitly calls out that transient-failure classification ("network-level failures — connection errors, 5xx") is "not yet distinguished anywhere in this codebase today" and is "the vendor adapter's" responsibility, not the wrapper's. Building a default/shared classifier here would mean guessing Apify's and Bright Data's error shapes without evidence, and would let a future caller silently inherit a wrong-for-their-vendor default instead of being forced to think about it. Stories 0.i2b/0.i2c/0.i2d each supply their own vendor-specific `isTransient` when they adopt `callVendor`.
- **Why `maxAttempts` defaults to `3`, not unbounded:** AD-32 does not specify a cap, but an unbounded retry loop would contradict this entire epic's "never hang indefinitely" premise (BUG-012) by replacing one infinite hang with an infinite retry storm. `3` matches this codebase's existing small-retry-count convention (`computeBackoffDelayMs`'s own doc comment walks through attempts 1-3; `apiKeyInvalidAttemptsThreshold` defaults to `5` for a different, multi-key concern). Overridable per call via `opts.maxAttempts` if a specific future adoption story needs a different bound, with its own justification.
- **`verifyGeminiApiKey`'s eventual `lockKey`-less call (AD-32 Rule 3) and its new `GEMINI_VERIFICATION_TIMEOUT_MS` env var are explicitly Story 0.i2b's scope, not this story's.** This story only has to make `opts.lockKey` optional (AC4) so that future call is possible — it does not touch `gemini-client.ts`, `verifyGeminiApiKey`, or add that env var itself.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh (no `epic-0-i2-readiness.md` sweep report exists).** A Winston-persona pass (full AD-32 text, project-context.md, and verified code facts pasted into the subagent prompt) found **no gap**: this story is a pure backend library module plus a Supabase migration plus two env vars — no new route/resolver, no frontend code, no external call made from a client, and no unbacked API surface, since nothing calls `callVendor` yet (adoption is explicitly deferred to 0.i2b/0.i2c/0.i2d). The table arrives via drizzle-kit migration, this stack's standard IaC mechanism for schema changes — no AWS infra is needed because none is architecturally required here.
- **Gate 2 (UI Complexity & Reusability) — run fresh (no sweep report exists), via a Freya/Sally-persona subagent pass.** **No gap found**: this story has zero touchpoints in `apps/web`, `packages/ui`, or any component/hook layer — it renders nothing and ships no user-facing surface, so there is no reusable/complex UI element and no UX-spec-fidelity question to evaluate.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, via a Winston-persona subagent pass.** **Gap found, confirmed and resolved during this story's creation**: AD-32 Rule 6 itself names the hole — `callVendor`/the DPA gate are built generically for all three vendors, but only Gemini call sites (0.i2b/0.i2c) had adoption stories; `trigger-apify-for-target.ts` (via `instagram-adapter.ts`'s `getApifyClient()`) and `brightdata-client.ts` (via raw `fetch()`) keep calling their APIs directly with no story to change that, even though Story 0.i2z's own ratchet AC ("fails if any file outside the wrapper imports the Gemini, Apify, or Bright Data SDK directly") already presumes that adoption happened. AD-32 itself flagged this as "an epics.md gap... out of this run's scope" rather than writing the story. **Presented to the user via `AskUserQuestion`; user confirmed adding it.** New **Story 0.i2d** ("Adopt the wrapper in the Apify/Bright Data scraper call sites") was added to `epics.md`, positioned after 0.i2c and before 0.i2z within Epic 0.i2 (lettered-suffix placement, per the numbering rule's "cross-cutting gap affecting a shared mechanism already scoped inside one epic" case — not a new Epic 0 number, since the mechanism itself (0.i2a) already lives in this epic), with a matching `sprint-status.yaml` backlog entry and Story 0.i2z's "Depends on" updated to include it. **This is not a blocker for this story (0.i2a) itself** — 0.i2a doesn't depend on 0.i2d; it's the reverse (0.i2d depends on 0.i2a). It is a blocker for 0.i2z's ratchet, which cannot truthfully pass against Apify/Bright Data until 0.i2d lands.
- **FIND-073 scope clarification (user-decided, not a Gate finding):** FIND-073 ("subscribe path never checks whether an Instagram account is private") was listed as an input backlog row for this story but is orthogonal to AD-32's mechanism — it is about account-privacy enforcement at subscribe time, not call locking/timeout/retry/DPA-gating. Per the user's explicit decision during this story's creation, FIND-073 is left untouched: it remains open on the backlog board and is **not** resolved by this story's DPA kill-switch or by Story 0.i2d.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found — this is a greenfield additive table with no existing consumer.** `vendor_call_locks` is new; nothing in `packages/database`, `@festgrid/shared-types`, or any GraphQL contract references it today, and this story adds no GraphQL exposure for it (it is an internal backend-only lease table, never queried by the frontend).
- **Impacted fields/contracts:** `packages/database/schema.ts` gains one new table export (`vendorCallLocks`) — purely additive, no existing table/column changes.
- **Required DB migration changes:** One drizzle-kit-generated migration creating `vendor_call_locks(lock_key TEXT PRIMARY KEY, locked_until TIMESTAMPTZ NOT NULL)` (Task 1). No backfill needed (new table, starts empty).
- **Required TypeScript type changes:** `apps/backend/src/lib/vendor-gateway/guarded-call.ts`'s own new exported types (`VendorName`, `CallVendorOptions<T>`, the three error classes) — additive only, no existing type's shape changes.
- **Backward compatibility and rollout notes:** Fully additive; no existing code path is touched, so there is no rollout risk from this story alone. The real compatibility-sensitive work (threading real credential identities, real `isTransient` classifiers, and real timeout values into existing call sites) happens in 0.i2b/0.i2c/0.i2d, each of which must preserve the exact error-propagation contracts AD-32 Rule 4 already documents (`GeminiRateLimitedError`/`GeminiInvalidKeyError`/`GeminiTimeoutError` never retried by the *outer* `callGemini` loop) when they wire `callVendor` in underneath.
- **Verification checks:** `guarded-call.test.ts`'s real-DB integration suite (Task 4) proves claim/release/busy/expiry/timeout/retry/DPA-gate behavior end-to-end against the actual migrated table — not a mock.

### Project Structure Notes

- **New:** `apps/backend/src/lib/vendor-gateway/guarded-call.ts`, `apps/backend/src/lib/vendor-gateway/guarded-call.test.ts`, one new migration file under `packages/database/migrations/` (number TBD at generation time, ≥`0076`).
- **Modified:** `packages/database/schema.ts` (new `vendorCallLocks` table), `apps/backend/src/env.ts` (`apifyScrapingConfirmed`/`brightdataScrapingConfirmed` fields), root `.env.example` (two new vars), `_bmad-output/planning-artifacts/epics.md` (new Story 0.i2d, 0.i2z's "Depends on" updated — already applied during this story's creation), `_bmad-output/implementation-artifacts/sprint-status.yaml` (new `0-i2d-...` backlog key — already applied), `_bmad-output/implementation-artifacts/backlog.yaml` (BUG-012 and FIND-004 promoted with `stories:` — already applied).
- **Not modified:** `apps/backend/src/lib/ai-gateway/*`, `apps/backend/src/lib/scraper/*`, any GraphQL schema/resolver file, `apps/web`, `packages/ui`, `apps/infrastructure` (no new AWS resource — a DB table via migration is this stack's existing IaC mechanism for schema changes, not a new infra layer).

### References

- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-32`, lines 1785-1907] — read in full; the authoritative Binds/Prevents/Rule/Considered-and-rejected text every AC above cites.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.i2a`, lines 5044-5061] — original AC/Note source; [Source: `#Story 0.i2d`] — new story added this run (Gate 3 finding); [Source: `#Story 0.i2z`] — "Depends on" updated this run.
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml` — `BUG-012`, `FIND-004`, `FIND-073`] — input rows named by the user; `BUG-012`/`FIND-004` promoted with `stories:` this run, `FIND-073` left untouched per user decision.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions, numbering rule (basis for 0.i2d's lettered-suffix-within-epic placement), full gate lifecycle.
- [Source: `apps/backend/src/lib/ai-gateway/gemini-client.ts`] — read in full; confirmed `GeminiRateLimitedError`/`GeminiInvalidKeyError`/`GeminiTimeoutError`/`GeminiUnknownError`'s exact shape and the existing `AbortController`-based timeout this story's generic `VendorCallTimeoutError` is deliberately distinct from.
- [Source: `apps/backend/src/lib/ai-gateway/adapter.ts`] — read in full; confirmed `callGemini`'s existing tiered candidate/exclusion loop (AD-10, unchanged by this story) and its existing `computeBackoffDelayMs` import this story's own retry loop reuses.
- [Source: `apps/backend/src/env.ts`] — read in full; confirmed `parseBooleanDefaultOn()`'s exact signature/behavior (reused verbatim for Task 3) and the full `BackendEnv` shape/pattern this story's two new fields mirror.
- [Source: `packages/domain/src/ai-gateway/backoff.ts`] — read in full; confirmed `computeBackoffDelayMs(attempt, retryAfterSeconds?)`'s exact signature, already exported from `@festgrid/domain`, reused as-is.
- [Source: `apps/backend/src/db/client.ts`] — read in full; confirmed the transaction-mode-pooler (`max:1`/container, `prepare:false`) constraint AD-32 Rule 2 cites, and the single shared `db` client this story's lock-claim/release queries use.
- [Source: `apps/backend/src/lib/geolocation/cache-store.ts`, `cache-store.test.ts`] — read in full; confirmed the existing `onConflictDoUpdate` idiomatic-Drizzle precedent (Task 2) and the real-local-Postgres `node:test` integration-test shape (Task 4) this story's own test suite mirrors.
- [Source: `packages/database/schema.ts` — `apiKeys` table, `packages/database/migrations/0075_fat_mariko_yashida.sql`, `migrations/meta/_journal.json`] — read; confirmed the existing table-definition convention and the latest migration number (`0075`, confirmed identical on `origin/master` as of this story's creation) the Task 1 numbering guardrail is anchored to.
- [Source: `apps/backend/src/lib/scraper/trigger-apify-for-target.ts`, `brightdata-client.ts`] — grepped/read; confirmed both call their vendor directly today (no wrapper), the evidence basis for the Gate 3 finding/Story 0.i2d.
- [Source: `_bmad-output/project-context.md#Database-Performance, #Security, #Testing-Rules`] — Drizzle-ORM-only DB access, connection-pooling/transaction-pooler rule, credential management (env vars, never hardcoded), testing-trophy philosophy for `apps/*` code (this story's tests are integration, not `packages/domain`-style unit tests, since `guarded-call.ts` lives in `apps/backend`).

## Global Rules References

- `_bmad-output/project-context.md` — Database & Performance (Drizzle ORM only, connection-pooling/transaction-pooler rule), Security (Credential Management for the two new env vars), General Architecture (Adapter Pattern), Testing Rules (testing-trophy for `apps/*`; the `packages/domain` 100%-coverage rule does **not** apply here since this module lives in `apps/backend`).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-32` — the authoritative decision this story implements in full.
- `docs/infrastructure/3-database.md`, `docs/infrastructure/2-backend.md` — confirmed no diagram/shard update needed (no new external service, no new Lambda/queue — a DB table via migration is the existing, already-documented mechanism).
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions and the numbering rule applied to Story 0.i2d.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/backend/src/lib/vendor-gateway/guarded-call.ts`, `apps/backend/src/lib/vendor-gateway/guarded-call.test.ts`, one drizzle-kit-generated migration (`packages/database/migrations/00NN_*.sql`, NN ≥ 76, number confirmed at generation time).
  - Modified: `packages/database/schema.ts`, `apps/backend/src/env.ts`, root `.env.example`.
  - Not modified: `apps/backend/src/lib/ai-gateway/*`, `apps/backend/src/lib/scraper/*`, any `.graphql`/resolver file, `apps/web`, `packages/ui`, `apps/infrastructure`.
- **Rule Mapping:**
  - Database Access (Drizzle ORM only) → `project-context.md` → lock claim/release use Drizzle's `onConflictDoUpdate`/`update` builders against the shared `db` client (Task 2), never the Supabase client, raw `pg` driver, or an advisory lock.
  - Connection Pooling / transaction-mode pooler → `project-context.md`, `docs/infrastructure/3-database.md`, AD-32 Rule 2 → lease-row table chosen explicitly *because* an advisory lock is unsafe under this pooler; no transaction held open across the external call.
  - Credential Management (no hardcoded secrets) → `project-context.md` → `APIFY_SCRAPING_CONFIRMED`/`BRIGHTDATA_SCRAPING_CONFIRMED` sourced from `.env`, never hardcoded (Task 3).
  - Drizzle-kit-generated migrations, never hand-numbered → `project-context.md` Critical Implementation Rules (DB schema changes), user's explicit instruction → Task 1's origin/master re-check guardrail.
  - Testing Rules (testing-trophy for `apps/*`) → Task 4 → real-DB `node:test` integration suite, no mocked DB, mirroring `cache-store.test.ts`.
  - Story-split-gate Gate 1/2/3 → Gate 1/2 found no gap; Gate 3 found and split a real gap (new Story 0.i2d) → Dev Notes "Architecture & UX Gate Findings".
- **Verification Plan:**
  - `pnpm --filter database run generate` + `run migrate` apply cleanly locally (Task 1/5).
  - `pnpm --filter backend exec tsx --test src/lib/vendor-gateway/guarded-call.test.ts` passes, covering every AC10 scenario against the real migrated table (Task 4/5).
  - `pnpm build`/`pnpm lint` clean for `packages/database`, `apps/backend` (Task 5).
  - `git grep` confirms zero modifications to `ai-gateway/`/`scraper/` files (AC9/Task 5).
  - `epics.md`/`sprint-status.yaml`/`backlog.yaml` already updated with Story 0.i2d and BUG-012/FIND-004 promotion as part of this story's creation (verify no further action needed at dev time).

## Pre-Coding Approval Gate

- [x] Scope confirmation: build `callVendor` (lock + timeout + retry + DPA gate) and the `vendor_call_locks` migration only; adopt zero existing call sites (that's 0.i2b/0.i2c/0.i2d). **Approved 2026-10-06.**
- [x] Architecture and boundary confirmation: new module lives in `apps/backend/src/lib/vendor-gateway/` (sibling to `ai-gateway`/`scraper`, not folded into either, per AD-32 Rule 1); no new package, no new external dependency. **Approved 2026-10-06.**
- [x] Testing plan confirmation: real-local-Postgres `node:test` integration suite (Task 4) covering every AC10 scenario (including the new signal-abort-on-timeout case); no mocked DB; the `packages/domain` 100%-coverage rule does not apply (module lives in `apps/backend`). **Approved 2026-10-06.**
- [x] Explicit human approval state: **Approved with changes, 2026-10-06** (see below).
- [x] **Gate 1/2/3 prerequisites confirmed:** Gate 1 and Gate 2 found no gap. Gate 3 found a real gap (no Apify/Bright Data adoption story existed) — **user confirmed adding new Story 0.i2d** (already written into `epics.md`/`sprint-status.yaml` as part of this story's creation); confirmed 0.i2d is **not** a blocker for this story's own code/tests (0.i2a doesn't depend on it) but 0.i2z's ratchet cannot truthfully pass until 0.i2d lands. **Approved 2026-10-06.**
- [x] **FIND-073 scope accepted:** confirmed FIND-073 (private-account enforcement) stays untouched and unresolved by this story, per the user's explicit decision during creation — not to be conflated with the DPA kill-switch this story builds. **Approved 2026-10-06.**
- [x] **Timeout design — approved WITH CHANGE (2026-10-06):** user kept the `Promise.race`-based wrapper-level bound but added that `callVendor` creates an `AbortController` per attempt, aborts it when `timeoutMs` elapses, and passes `controller.signal` into the thunk (`call(signal: AbortSignal)`), so a signal-aware thunk gets real cancellation while a signal-ignorant thunk is still bounded by the race. AC5, Task 2, Task 4, and the Dev Notes rationale have been updated accordingly in this file.
- [x] **Lock-TTL formula accepted** (`Math.max(timeoutMs * 2, 60_000)`, Dev Notes): approved as-written, unchanged. **Approved 2026-10-06.**
- [x] **`maxAttempts` default of `3` accepted** (Dev Notes "Why `maxAttempts` defaults to `3`"): approved as-written, unchanged. **Approved 2026-10-06.**

## Testing Requirements

- [ ] Integration tests (required, real local DB, no mocks): `apps/backend/src/lib/vendor-gateway/guarded-call.test.ts` — every scenario in AC10.
- [ ] Unit tests: Not applicable in the `packages/domain` 100%-coverage sense — this module lives in `apps/backend` and is covered by the integration suite above per the testing-trophy philosophy.
- [ ] E2E tests: Not applicable — no UI, no adopted call site yet.
- [ ] Manual verification (deferred, tracked): real end-to-end behavior against a live Gemini/Apify/Bright Data call is only observable once Stories 0.i2b/0.i2c/0.i2d adopt `callVendor` — this story's own verification is necessarily limited to the wrapper's internal behavior against a real DB and a fake `call()` thunk.

## Deliverables Checklist

- [ ] `apps/backend/src/lib/vendor-gateway/guarded-call.ts` exporting `callVendor`, `VendorName`, `CallVendorOptions<T>`, `VendorKeyBusyError`, `VendorDpaNotConfirmedError`, `VendorCallTimeoutError`.
- [ ] `vendor_call_locks` table in `packages/database/schema.ts` + a drizzle-kit-generated migration applied locally.
- [ ] `apps/backend/src/env.ts`/`.env.example` document `APIFY_SCRAPING_CONFIRMED`/`BRIGHTDATA_SCRAPING_CONFIRMED`.
- [ ] `guarded-call.test.ts` passing, covering every AC10 scenario against the real migrated table.
- [ ] `pnpm build`/`pnpm lint` pass for `packages/database`, `apps/backend`.
- [ ] `epics.md`/`sprint-status.yaml`/`backlog.yaml` already carry Story 0.i2d and the BUG-012/FIND-004 promotion (done during this story's creation — confirm still present, do not re-do).

## Out of Scope

- Adopting `callVendor` into `verifyGeminiApiKey`/`createApiKey` (Story 0.i2b), `callGemini`/`resolvePromptToEventFilter`/`backfillAccountProfileAndInferDefaultLocation` (Story 0.i2c), or `trigger-apify-for-target.ts`/`brightdata-client.ts` (new Story 0.i2d — added this run via Gate 3). This story builds the mechanism only.
- The repo-wide source-scan ratchet test (Story 0.i2z) — depends on 0.i2a/0.i2b/0.i2c/0.i2d all landing first.
- `GEMINI_VERIFICATION_TIMEOUT_MS` and any change to `gemini-client.ts`'s `verifyGeminiApiKey` — Story 0.i2b's scope (AD-32 Rule 3).
- Per-vendor `isTransient` classifiers for Gemini/Apify/Bright Data — each adoption story (0.i2b/0.i2c/0.i2d) supplies its own; this story only requires the parameter to exist.
- FIND-073 (private-account enforcement at subscribe time) — explicitly left untouched per the user's decision; unrelated mechanism, separate backlog row.
- Any DB-backed audit table for the DPA gate (confirmed-by/at/evidence) — rejected by the user at the architecture stage (AD-32 "Considered and rejected") as disproportionate to FIND-004's `effort: s` sizing.
- Gating Gemini under the same DPA flag "for uniformity" — rejected by the user at the architecture stage; FIND-066 (Gemini's own, separate data-use posture) remains unresolved and is not this story's concern.

## Definition of Done

- [ ] AC 1-10 satisfied.
- [ ] `guarded-call.test.ts` passing against the real migrated table (Testing Requirements).
- [ ] `pnpm lint` and `pnpm build` passing for `packages/database`, `apps/backend`.
- [ ] Migration generated with a correct, non-colliding number (re-verified against `origin/master` immediately before generation/commit) and applied locally.
- [ ] `git grep` confirms no modification to any `ai-gateway/`/`scraper/` file (additive-only).
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the timeout-design, lock-TTL-formula, and `maxAttempts`-default acceptances.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
