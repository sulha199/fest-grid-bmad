---
baseline_commit: edccd54be673db4776b940eb0b6e6a8f516e822f
---
# Story 0.i2b: Adopt the wrapper in the Gemini synchronous verification path

## Story Details

- Epic: 0.i2 (Guarded outbound vendor calls)
- Story ID: 0.i2b
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `verifyGeminiApiKey`/`createApiKey` to call through the guarded `callVendor` wrapper (Story 0.i2a) instead of calling `callGeminiGenerateContent` directly,
so that a hung call no longer blocks the caller indefinitely (BUG-012) and the fail-open error-shape classifier no longer trusts an unverified shape (BUG-011/DW-068).

## Acceptance Criteria

1. **Given** `verifyGeminiApiKey` (`apps/backend/src/lib/ai-gateway/gemini-client.ts`), **when** it runs, **then** it calls `callVendor('gemini', { lockKey: undefined, timeoutMs: env.geminiVerificationTimeoutMs, isTransient: isGeminiErrorTransient, call: (signal) => callGeminiGenerateContent(apiKey, { contents: 'ping' }, signal) })` instead of calling `callGeminiGenerateContent` directly. `lockKey` is explicitly `undefined` — no lock claim/release against `vendor_call_locks` occurs — per AD-32 Rule 3's named exception: the key under verification has no `apiKeys.id` yet (`createApiKey` calls this before insert), and nothing else can concurrently bill against a key not yet in the candidate pool. `verifyGeminiApiKey`'s own exported signature (`(apiKey: string): Promise<boolean>`) is unchanged — only its internal implementation changes. [AD-32 Rule 3]
2. **Given** `isGeminiErrorTransient` (already exported from `gemini-client.ts`, built by sibling Story 0.i2c) and `callGeminiGenerateContent` (already accepting an optional third `signal?: AbortSignal` parameter, also built by 0.i2c), **when** this story adopts `callVendor`, **then** both are reused as-is — this story adds **no new classifier function** and makes **no change** to either of those two already-built exports. [AD-32 Rule 4; user decision — reuse 0.i2c's classifier, do not duplicate]
3. **Given** `apps/backend/src/env.ts`, **when** this story ships, **then** `BackendEnv` gains one new field, `geminiVerificationTimeoutMs: number`, loaded as `parseInt(process.env.GEMINI_VERIFICATION_TIMEOUT_MS || '10000', 10)` — a deliberately short, **distinct** bound from the existing `geminiExtractionTimeoutMs` (120000ms default, used by the much larger/slower extraction call, Story 0.i2c). `10000` (10s) is this story's chosen default (user-decided via `AskUserQuestion` during creation): a minimal `{ contents: 'ping' }` call typically returns in well under a second, so 10s gives generous margin above normal latency while still failing a hung verification call roughly 12x faster than the extraction timeout would — directly addressing BUG-012's "blocks the caller indefinitely" complaint for this synchronous, user-facing mutation. [AD-32 Rule 3]
4. **Given** the vendor call hangs past `env.geminiVerificationTimeoutMs`, **when** `callVendor`'s wrapper-level bound elapses, **then** it throws `VendorCallTimeoutError` — always immediate and unretried (AD-32 Rule 4/0.i2a AC5-6, unchanged) — which propagates out of `verifyGeminiApiKey` unmodified (its `catch` block only special-cases `GeminiInvalidKeyError`; everything else, including `VendorCallTimeoutError`, rethrows as today). `createApiKey`'s `catch` block (`apps/backend/src/schema/resolvers.ts`, ~line 530) adds a new `err instanceof VendorCallTimeoutError` branch that throws `new GraphQLError('Unable to verify API key: the request timed out. Please try again.', { extensions: { code: 'VERIFICATION_TIMEOUT' } })` — mirroring the existing `SCRAPE_TIMEOUT` precedent (`ApifyRequestTimeoutError` → `GraphQLError` with its own dedicated code) for an unrelated vendor-timeout case elsewhere in this same file. The mutation fails explicitly and the key is never inserted. [BUG-012; user decision — distinct `VERIFICATION_TIMEOUT` code]
5. **Given** any other error `verifyGeminiApiKey` throws that is **not** the existing `GraphQLError`-wrapped `INVALID_API_KEY` case and **not** `VendorCallTimeoutError` (e.g. a non-transient `GeminiUnknownError`, `GeminiRateLimitedError`, or any other thrown value), **when** `createApiKey`'s `catch` block runs, **then** it throws `new GraphQLError('Unable to verify API key. Please try again later.', { extensions: { code: 'VERIFICATION_FAILED' } })` instead of today's `console.warn(...)` + silent fail-open (continuing to encrypt/insert the key as `isValid: true`). This is an exhaustive replacement — **no code path in this resolver silently treats an unclassified verification error as a valid key** — directly resolving BUG-011/DW-068's "createApiKey's fail-open trust in the error-shape classifier." [BUG-011, BUG-012; user decision — distinct `VERIFICATION_FAILED` code]
6. **Given** the existing, already-handled cases (`isValid === true` → key inserted, unchanged; `isValid === false` → `GraphQLError('Invalid Gemini API key', { extensions: { code: 'INVALID_API_KEY' } })`, unchanged, checked first in the `catch` block before the two new branches above), **when** this story ships, **then** neither case's behavior changes — only the previously-uncovered "any other thrown error" branch is replaced (AC4/AC5).
7. **Given** this story's scope, **when** it ships, **then** it does **not** modify `apps/backend/src/lib/vendor-gateway/guarded-call.ts` (the wrapper itself — Story 0.i2a, already built), does **not** modify `apps/backend/src/lib/ai-gateway/adapter.ts`, `system-key-adapter.ts`, or `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (Story 0.i2c, already landed), does **not** touch `apps/backend/src/lib/scraper/{brightdata-client,trigger-apify-for-target}.ts` (Story 0.i2d's scope), and does **not** add Gemini to the DPA-confirmation gate — `callVendor`'s existing `assertDpaConfirmed` already no-ops unconditionally for `vendor: 'gemini'` (AD-32 Rule 5: Gemini is explicitly **not** in the DPA gate), reconfirmed here, not re-litigated. [AD-32 Rule 5; Gate 3 confirmation]
8. **Given** `createApiKey`'s existing test asserting today's fail-open behavior (`apps/backend/src/schema/api-keys.test.ts`, `'createApiKey proceeds and persists when verification throws a non-invalid-key error (fail-open)'`), **when** this story ships, **then** that test is replaced with an equivalent asserting the new **fail-closed** behavior: the mutation returns a GraphQL error with `extensions.code === 'VERIFICATION_FAILED'` and the key row is confirmed **not** inserted into `apiKeys` (querying by the test's own fixture user, mirroring the replaced test's own cleanup/assertion shape). A new, additional test case covers the `VendorCallTimeoutError` → `VERIFICATION_TIMEOUT` path specifically.
9. **Given** this story's test suite runs, **when** `api-keys.test.ts` and `gemini-client.test.ts` execute, **then** they prove, at minimum: (a) a valid key still verifies and inserts successfully (happy path, regression-checked unchanged); (b) `GeminiInvalidKeyError`/`isValid: false` still produces `INVALID_API_KEY` (regression, unchanged); (c) a hung verification call (`callGeminiGenerateContent`/its SDK seam replaced with a never-resolving promise, `GEMINI_VERIFICATION_TIMEOUT_MS` overridden small for the test's duration and restored after) throws `VendorCallTimeoutError`, surfaces `VERIFICATION_TIMEOUT` to the GraphQL client, and the key is not inserted (AC4/AC8); (d) a generic/unclassified verification error surfaces `VERIFICATION_FAILED` and the key is not inserted (AC5/AC8, replacing the old fail-open test); (e) because `lockKey` is `undefined` for this call path, **zero rows are ever written to `vendor_call_locks`** by `verifyGeminiApiKey` — asserted via a direct `db.select()` count check before/after the full suite (consistent with 0.i2a/0.i2c's own zero-leftover-rows precedent, and with Story 0.51's forthcoming repo-wide row-count ratchet, not yet built — see Dev Notes).

## Tasks / Subtasks

- [ ] **Task 1: `env.ts` — add `geminiVerificationTimeoutMs`** (AC: 3)
  - [ ] In `apps/backend/src/env.ts`'s `BackendEnv` interface, add `geminiVerificationTimeoutMs: number;` with a doc comment mirroring `geminiExtractionTimeoutMs`'s style: cites this story (0.i2b), AD-32 Rule 3, the 10000ms default and why it's deliberately short and distinct from `geminiExtractionTimeoutMs`, and that it is consumed only by `verifyGeminiApiKey`'s synchronous `createApiKey` path (never the extraction pipeline).
  - [ ] In `loadBackendEnv()`, add `geminiVerificationTimeoutMs: parseInt(process.env.GEMINI_VERIFICATION_TIMEOUT_MS || '10000', 10),` with the same `// eslint-disable-next-line turbo/no-undeclared-env-vars` comment line immediately above it, positioned near the existing `geminiExtractionTimeoutMs` loader line.
  - [ ] **Do not** add `GEMINI_VERIFICATION_TIMEOUT_MS` to root `.env.example` — `GEMINI_EXTRACTION_TIMEOUT_MS` and `GEMINI_MAX_OUTPUT_TOKENS` (its direct siblings, same "internal tuning constant with a code default" category) are not documented there either; only the Apify/Bright Data DPA kill-switches (a different category: a feature flag an operator may need to flip) were added to `.env.example` by Story 0.i2a. Mirror the precedent that actually applies to this var.
- [ ] **Task 2: `gemini-client.ts` — route `verifyGeminiApiKey` through `callVendor`** (AC: 1, 2, 4, 7)
  - [ ] Import `callVendor` from `../vendor-gateway/guarded-call.js`.
  - [ ] Inside `verifyGeminiApiKey`, call `loadBackendEnv()` once (matching `system-key-adapter.ts`'s own "call it once, reuse the reference" pattern from Story 0.i2c) and replace `await callGeminiGenerateContent(apiKey, { contents: 'ping' })` with `await callVendor('gemini', { lockKey: undefined, timeoutMs: env.geminiVerificationTimeoutMs, isTransient: isGeminiErrorTransient, call: (signal) => callGeminiGenerateContent(apiKey, { contents: 'ping' }, signal) })`.
  - [ ] Leave `verifyGeminiApiKey`'s outer `try { ... } catch (error) { if (error instanceof GeminiInvalidKeyError) { return false; } throw error; }` structure exactly as-is — `VendorCallTimeoutError` and every other `callVendor`-thrown or `call()`-thunk-thrown error (other than `GeminiInvalidKeyError`) continues to rethrow unmodified, now visible to `resolvers.ts`'s `createApiKey` catch block (Task 3) instead of being swallowed there.
  - [ ] `isGeminiErrorTransient` is already defined/exported in this same file (Story 0.i2c) — reference it directly, do not import it (no cross-file import needed since it's same-file).
- [ ] **Task 3: `resolvers.ts` — fail-closed `createApiKey` catch block** (AC: 4, 5, 6, 7)
  - [ ] Import `VendorCallTimeoutError` from `../lib/vendor-gateway/guarded-call.js`.
  - [ ] In `createApiKey`'s `catch (err: any)` block (~line 530), keep the existing first branch (`if (err instanceof GraphQLError && err.extensions?.code === 'INVALID_API_KEY') { throw err; }`) unchanged. Replace the `console.warn('[createApiKey] Transient error verifying key, failing open:', err);` line (the fail-open branch) with:
    ```
    if (err instanceof VendorCallTimeoutError) {
      throw new GraphQLError('Unable to verify API key: the request timed out. Please try again.', {
        extensions: { code: 'VERIFICATION_TIMEOUT' },
      });
    }
    throw new GraphQLError('Unable to verify API key. Please try again later.', {
      extensions: { code: 'VERIFICATION_FAILED' },
    });
    ```
  - [ ] No change to the resolver's success path (key encryption/insertion), its GraphQL input/output shape, or any other mutation in this file. No `.graphql` schema file changes — `extensions.code` strings are untyped in this codebase's existing convention (confirmed via grep: `INVALID_API_KEY`/`DUPLICATE_API_KEY`/`BAD_REQUEST`/`SCRAPE_TIMEOUT` etc. are all plain string literals, not a GraphQL schema enum — `ExtractionErrorCode` is a distinct, unrelated enum scoped to the async extraction-job polling flow only).
- [ ] **Task 4: Tests** (AC: 8, 9)
  - [ ] `apps/backend/src/schema/api-keys.test.ts`: rewrite the existing `'createApiKey proceeds and persists when verification throws a non-invalid-key error (fail-open)'` test to assert the new fail-closed behavior instead — same `setCallGeminiGenerateContent(async (apiKey) => { if (apiKey === 'transient-error-key') { throw new Error('Some DNS timeout error'); } ... })` setup, but now assert `result.errors` is present with `result.errors[0].extensions.code === 'VERIFICATION_FAILED'`, and that no row was inserted (`db.select().from(apiKeys).where(...)` returns empty for that key). Rename the test description to drop "(fail-open)" and reflect the new fail-closed assertion.
  - [ ] `apps/backend/src/schema/api-keys.test.ts`: add a new test, `'createApiKey rejects with VERIFICATION_TIMEOUT when the vendor call hangs'` — override `process.env.GEMINI_VERIFICATION_TIMEOUT_MS` to a small value (e.g. `'50'`) before the test (restoring it and re-running `loadBackendEnv()`'s cache-bust equivalent after, matching however this codebase's existing env-override test precedent resets `loadBackendEnv()`'s memoization, if any — confirm at dev time), set `setCallGeminiGenerateContent(() => new Promise(() => {}))` (never resolves), assert the mutation returns `extensions.code === 'VERIFICATION_TIMEOUT'` and the key is not inserted.
  - [ ] Confirm (no code change expected) the existing happy-path test (`'createApiKey, myApiKeys, deleteApiKey flow'`) and the existing `'createApiKey rejects with INVALID_API_KEY when verifyGeminiApiKey returns false'` test both still pass unchanged — re-run explicitly, don't assume.
  - [ ] `apps/backend/src/lib/ai-gateway/gemini-client.test.ts`: add a test proving `verifyGeminiApiKey` now goes through `callVendor` with `lockKey: undefined` — assert zero `vendor_call_locks` rows exist (via `db.select()`, real local DB, matching `guarded-call.test.ts`'s own convention) immediately before and after a `verifyGeminiApiKey` call, for both a successful and a failing verification attempt. Confirm the existing `verifyGeminiApiKey` true/false/rethrow test cases (if any already exist in this file) still pass unchanged.
  - [ ] Grep (`git grep -n "failing open\|Transient error verifying key"`) to confirm no other test file or source comment still references the removed fail-open log line/behavior after this story lands.
- [ ] **Task 5: Verification** (AC: 1-9)
  - [ ] `cd apps/backend && TZ=UTC NODE_ENV=test npx tsx --test src/schema/api-keys.test.ts src/lib/ai-gateway/gemini-client.test.ts` passes, including every new/updated case above.
  - [ ] Re-run `src/schema/subscriptions.test.ts` (also exercises `createApiKey` directly) to confirm zero regression — it mocks at its own seam, so should be unaffected, but must still be re-run to prove it.
  - [ ] `pnpm --filter backend build` / `pnpm --filter backend lint` clean (0 errors) for the touched files.
  - [ ] `git grep -n "failing open\|Transient error verifying key"` returns zero matches anywhere in `apps/backend/src` (fail-open branch fully removed).
  - [ ] `git grep` / `git diff --stat` against this story's `baseline_commit` confirms the only files touched are: `env.ts`, `gemini-client.ts`, `gemini-client.test.ts`, `resolvers.ts`, `api-keys.test.ts` — nothing under `vendor-gateway/`, `scraper/`, `adapter.ts`, `system-key-adapter.ts`, `build-gemini-request.ts`, no `.graphql` schema file, no frontend file, no migration (AC7).
  - [ ] Manual `psql` check (matching 0.i2a/0.i2c's own precedent): zero leftover `vendor_call_locks` rows after the full test run (AC9(e); `lockKey: undefined` means this path should never write one in the first place, but confirm empirically, not just by code-reading — and note this is exactly the kind of zero-leftover-rows discipline Story 0.51's forthcoming permanent row-count ratchet will enforce repo-wide once it lands).

## Dev Notes

- **This story is pure call-site adoption of an already-built mechanism — no new table, no new module, no new AWS resource, no new GraphQL schema.** `callVendor`, `VendorCallTimeoutError`, and the `vendor_call_locks` table (Story 0.i2a, status "review" — code and tests exist and pass) and `isGeminiErrorTransient`/`callGeminiGenerateContent`'s signal-aware third parameter (Story 0.i2c, status "review" — also already landed in code, already consumed by `adapter.ts`/`system-key-adapter.ts`) all already exist. This story changes exactly one remaining call site (`verifyGeminiApiKey`) and its one caller's error handling (`createApiKey`).
- **The three AD-32-named entry points into `callGeminiGenerateContent`, and which story owns each:** `callGemini`'s candidate loop and `system-key-adapter.ts`'s AD-10 fallback were Story 0.i2c's scope (done). `verifyGeminiApiKey` (`gemini-client.ts:153` in the current tree, invoked from `createApiKey`, `resolvers.ts:526`) is **this story's** scope — the last of the three. [Source: `festgrid-architecture-spine.md#AD-32`, Binds]
- **Full AD-32 text was read in full** (`festgrid-architecture-spine.md`, lines 1807-1920) before drafting this story — it is the authoritative source for every Rule citation above, including Rule 3's explicit naming of `verifyGeminiApiKey` as "an explicit, named exception to locking, not an oversight" and its mandate for a "new, deliberately short `GEMINI_VERIFICATION_TIMEOUT_MS`."
- **Why the fail-open removal (AC5) is not a re-litigated architecture decision but a direct AC requirement:** Story 0.i2b's own `epics.md` AC text states plainly: "it... does not fail open on an unclassified error shape." BUG-011's backlog note (DW-068) independently names "createApiKey's fail-open trust in the error-shape classifier" as the defect. This story's job is to implement that already-decided direction, not to re-ask whether fail-open should be removed — only *how* the resulting fail-closed error surfaces to the GraphQL client was an open, undecided design question, resolved via `AskUserQuestion` during this story's creation (two distinct codes: `VERIFICATION_TIMEOUT` / `VERIFICATION_FAILED`, see AC4/AC5).
- **Why `GEMINI_VERIFICATION_TIMEOUT_MS` defaults to `10000`ms, not AD-32's unspecified "short":** AD-32 Rule 3 mandates a timeout "distinct from `env.geminiExtractionTimeoutMs`" but leaves the exact number undecided ("needs real timing evidence" language appears elsewhere in this epic for a different constant, the lock TTL — the same spirit applies here). Resolved via `AskUserQuestion`, user-selected `10000`ms: generous margin above a minimal `{contents:'ping'}` call's typical sub-second latency, while failing a hung call ~12x faster than the 120000ms extraction timeout would.
- **Why `maxAttempts`/retry-with-backoff is left at `callVendor`'s own default (`3`), not overridden to `1` for this synchronous path:** Considered overriding to `1` (true single-attempt fail-fast) given AD-32 Rule 3's "must fail fast on a hung key" framing, but `VendorCallTimeoutError` — the actual "hung call" case — is **never retried by `callVendor` regardless of `maxAttempts`** (0.i2a AC5/AC6: timeout is always immediate and unretried, unconditionally). Retry-with-backoff only fires for `isGeminiErrorTransient`'s narrow 5xx/connection-coded slice of `GeminiUnknownError` — a *fast-failing* error, not a hang — so the real worst-case latency added by the default of `3` is bounded by how quickly Gemini's API actually returns an error response, not by `timeoutMs` multiplied by attempt count. This matches Story 0.i2c's own precedent (neither of its two adoption sites overrides `maxAttempts` either) — no override needed here, and none is introduced.
- **Why `.env.example` is not updated (Task 1):** this var's direct sibling, `GEMINI_EXTRACTION_TIMEOUT_MS` (and `GEMINI_MAX_OUTPUT_TOKENS`), are internal tuning constants with sensible code-level defaults and are **not** documented in `.env.example` today (verified via grep) — only the Apify/Bright Data DPA kill-switches (operator-flippable feature flags, a different category) were added there by Story 0.i2a. `GEMINI_VERIFICATION_TIMEOUT_MS` follows its actual sibling's precedent, not the kill-switch precedent.
- **Story 0.51 awareness (not a dependency, not a blocker):** `_bmad-output/implementation-artifacts/sprint-status.yaml`'s `0-51-close-backend-test-row-leaks-and-add-a-permanent-row-count-ratchet` (status `ready-for-dev`, not yet built as of this story's creation) will add a repo-wide guard failing the backend test run if any table holds more rows after the suite than before. This story's own call path writes zero rows to `vendor_call_locks` by design (`lockKey: undefined`, AC1/AC9(e)) and touches no other table, so it is already compliant with that forthcoming ratchet without any extra work — Task 4/5's explicit zero-leftover-rows check exists to prove this empirically now, not merely assert it from reading the code.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh (no `epic-0-i2-readiness.md` sweep report exists, matching 0.i2a/0.i2c's own precedent).** A Winston-persona subagent pass (AD-32 text, the draft scope, and verified code facts from `guarded-call.ts`/`gemini-client.ts`/`resolvers.ts`/`env.ts` provided directly) found **no gap**: this story wires an already-built, already-reviewed backend wrapper into an existing backend-only function; no new resolver/query/mutation, no new table/migration, no frontend file, no new external integration; `createApiKey`'s GraphQL call site is unchanged. `lockKey: undefined` is the wrapper's documented, intentional optional-lock path (0.i2a AC4), not a missing layer.
- **Gate 2 (UI Complexity & Reusability) — run fresh, via a Freya/Sally-persona subagent pass.** **No gap found**: this story touches only `gemini-client.ts`, `env.ts`, `.env.example` (decided against, see Dev Notes), and one internal `catch` block in `resolvers.ts` — zero touchpoints in `apps/web`, `packages/ui`, or any component/hook layer. No GraphQL shape change, no new user-facing error message surface beyond an existing error-handling convention (two new `extensions.code` string literals, same pattern as `SCRAPE_TIMEOUT`/`DUPLICATE_API_KEY`/etc.).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, via a Winston-persona subagent pass.** **No gap found**: the shared mechanism (`callVendor`, its lock table, the DPA gate) was already built and epic-ized by Story 0.i2a; the transient-error classifier (`isGeminiErrorTransient`) was already built by Story 0.i2c and is reused here, not duplicated — confirmed in the actual landed code (`system-key-adapter.ts` already imports and uses it), not just the plan. The new `GEMINI_VERIFICATION_TIMEOUT_MS` constant is narrow and story-local (no other call site needs a short synchronous-verification-specific timeout distinct from the extraction timeout), so it is not a shared mechanism being built ad hoc under this story's cover. The remaining fan-out of Epic 0.i2 (0.i2d for Apify/Bright Data, 0.i2z for the repo-wide ratchet) is already tracked in `epics.md` — nothing here is left homeless.
- **FIND-079 is not this story's concern.** FIND-079 ("subscribe path never checks whether an Instagram account is private," child of FIND-004) was explicitly scoped out of Story 0.i2a (user decision during that story's creation) as orthogonal to AD-32's call-locking/timeout/retry/DPA mechanism. This story (Gemini verification timeout/fail-closed behavior) is equally orthogonal to account-privacy enforcement; FIND-079 remains untouched and open on the backlog board. (Note: this row was renumbered from an earlier, now-reassigned `FIND-073` during a master-merge; `FIND-079` is the current, correct id for the private-account gap — the current `FIND-073` in `backlog.yaml` is an unrelated masonry/EventCard finding.)

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** This story adds no new table, column, migration, or GraphQL-exposed type/field. `BackendEnv` gains one new field (`geminiVerificationTimeoutMs: number`) — additive, no existing field's shape changes. `createApiKey`'s GraphQL mutation signature (input/output types) is unchanged; only two new `extensions.code` string literals are introduced on the existing, already-untyped `GraphQLError` error-reporting convention this resolver already uses for `INVALID_API_KEY`/`DUPLICATE_API_KEY`/`BAD_REQUEST`.
- **Impacted fields/contracts:** None beyond the additive `BackendEnv` field above. `verifyGeminiApiKey`'s exported function signature (`(apiKey: string) => Promise<boolean>`) is unchanged — only its internal implementation changes.
- **Required DB migration changes:** None. `vendor_call_locks` already exists (Story 0.i2a's migration); this call path never writes to it (`lockKey: undefined`).
- **Required TypeScript type changes:** None beyond `BackendEnv`'s additive field (Task 1). No `@festgrid/shared-types`/GraphQL-generated-type changes.
- **Backward compatibility and rollout notes:** The one deliberate, documented behavior change is `createApiKey` now rejecting (rather than silently accepting) an API key whose verification call fails for any reason other than a confirmed-invalid key — this is the intended fix for BUG-011/BUG-012, not an incidental regression, and is covered by the rewritten test (AC8). No other caller of `verifyGeminiApiKey` exists today (confirmed via grep — only `resolvers.ts`'s `createApiKey` calls it), so no other rollout-sequencing risk exists.
- **Verification checks:** The updated/new tests in Task 4 (real local DB for the `vendor_call_locks` zero-rows assertion, `node:test` integration tests for the GraphQL-level behavior) prove the end-to-end fail-closed/timeout behavior against the real resolver and the real wrapper — not a mock of `callVendor` itself.

### Project Structure Notes

- **Modified (expected, no new files):** `apps/backend/src/env.ts`, `apps/backend/src/lib/ai-gateway/gemini-client.ts`, `apps/backend/src/lib/ai-gateway/gemini-client.test.ts`, `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/schema/api-keys.test.ts`.
- **Not modified:** `apps/backend/src/lib/vendor-gateway/*` (the wrapper itself — already built, Story 0.i2a), `apps/backend/src/lib/ai-gateway/{adapter,system-key-adapter}.ts` and `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (Story 0.i2c's scope, already landed), `apps/backend/src/lib/scraper/*` (Story 0.i2d's scope), any `.graphql` schema file, `apps/web`, `packages/ui`, `apps/infrastructure`, `packages/database` (no migration — reuses 0.i2a's existing `vendor_call_locks` table, which this path never writes to).
- **No new directories.** This story stays entirely inside the existing `apps/backend/src/lib/ai-gateway/` and `apps/backend/src/schema/` modules.

### References

- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-32`, lines 1807-1920] — read in full; the authoritative Binds/Prevents/Rule/Considered-and-rejected text every AC above cites, including Rule 3's `verifyGeminiApiKey`-specific exception and Rule 5's "Gemini is not in the DPA gate."
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.i2b`, lines 5262-5273 (current tree)] — original As-a/I-want/So-that and AC source.
- [Source: `_bmad-output/implementation-artifacts/0-i2a-build-the-guarded-vendor-call-wrapper.md`] — read in full; confirmed `callVendor`'s exact signature/options shape and the `lockKey?`-optional contract (AC4) this story relies on.
- [Source: `_bmad-output/implementation-artifacts/0-i2c-adopt-the-wrapper-in-the-async-inference-path.md`] — read in full; confirmed `isGeminiErrorTransient`'s exact classification rule and `callGeminiGenerateContent`'s signal-aware third parameter, both reused as-is (AC2) rather than re-derived.
- [Source: `apps/backend/src/lib/vendor-gateway/guarded-call.ts`] — read in full; confirmed `callVendor`'s real implementation, including that `VendorCallTimeoutError` is unconditionally immediate/unretried and that `assertDpaConfirmed` already no-ops for `vendor === 'gemini'`.
- [Source: `apps/backend/src/lib/ai-gateway/gemini-client.ts`] — read in full; confirmed `verifyGeminiApiKey`'s exact current body (direct `callGeminiGenerateContent` call, `GeminiInvalidKeyError`-only catch branch) and `isGeminiErrorTransient`'s already-landed implementation.
- [Source: `apps/backend/src/schema/resolvers.ts`, lines 500-548] — read in full; confirmed `createApiKey`'s exact current body, including the `console.warn('[createApiKey] Transient error verifying key, failing open:', err)` line this story removes, and every existing `extensions.code` convention in this file (`INVALID_API_KEY`, `DUPLICATE_API_KEY`, `BAD_REQUEST`, `SCRAPE_TIMEOUT` et al.) the two new codes follow.
- [Source: `apps/backend/src/schema/api-keys.test.ts`, lines 324-394] — read in full; confirmed the exact existing `INVALID_API_KEY` test (unchanged) and the fail-open test this story's Task 4 rewrites, including its `setCallGeminiGenerateContent` seam usage.
- [Source: `apps/backend/src/env.ts`] — read in full; confirmed `geminiExtractionTimeoutMs`'s/`geminiMaxOutputTokens`'s exact doc-comment and loader-line style (Task 1 mirrors it) and that neither is present in `.env.example`.
- [Source: `.env.example`] — grepped; confirmed `GEMINI_EXTRACTION_TIMEOUT_MS`/`GEMINI_MAX_OUTPUT_TOKENS` are absent while `APIFY_SCRAPING_CONFIRMED`/`BRIGHTDATA_SCRAPING_CONFIRMED` are present — the evidentiary basis for Task 1's "do not add to `.env.example`" decision.
- [Source: `apps/backend/src/schema/extraction.graphql`, `apps/web/src/generated/graphql.ts`] — grepped; confirmed `ExtractionErrorCode` is a distinct, unrelated schema enum scoped to the async extraction-job polling flow, not a general `extensions.code` registry — basis for AC/Task 3's "no `.graphql` schema change needed."
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml` — `BUG-011`, `BUG-012`, `FIND-079`] — `BUG-012` already lists this story (`0-i2b-adopt-the-wrapper-in-the-gemini-synchronous-verification-path`) under `stories:` from Story 0.i2a's creation; `BUG-011`'s note names this exact "fail-open trust in the error-shape classifier" defect (DW-068); `FIND-079` confirmed as the current, correct id for the private-account gap (renumbered from a now-reassigned `FIND-073` during a master merge) — not this story's concern, see Dev Notes.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 0.51`, lines 1289-1303] — read; confirmed the forthcoming row-count-leak ratchet's scope (four named `lib/posts/` test files, a new `test` npm script) does not name this story's files, and that this story's own zero-`vendor_call_locks`-rows behavior is already compliant with it.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions; all three run fresh this story (no `epic-0-i2-readiness.md` sweep report exists), no gap found by any.
- [Design decisions: `AskUserQuestion`, this story's creation] — `GEMINI_VERIFICATION_TIMEOUT_MS` default (`10000`ms, user-selected) and the fail-closed error-shape design (two distinct codes, `VERIFICATION_TIMEOUT`/`VERIFICATION_FAILED`, user-selected).

## Global Rules References

- `_bmad-output/project-context.md` — Security (Credential Management — no new secret, one new internal-tuning env var); General Architecture (Adapter Pattern for external AI services — this story closes the last of the three direct `callGeminiGenerateContent` callers); Testing Rules (testing-trophy for `apps/*` — this story's tests are `node:test` integration tests against the real local DB and the real resolver, matching `guarded-call.test.ts`/`api-keys.test.ts`'s own precedent, not `packages/domain`'s 100%-coverage rule, which does not apply to `apps/backend`).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-32` — the authoritative decision this story implements (the `verifyGeminiApiKey`/`createApiKey` half of it; `callGemini`/system-key fallback/Apify/Bright Data/the ratchet are siblings' scope).
- `docs/infrastructure/2-backend.md` — confirmed no diagram/shard update needed: no new Lambda, queue, or AWS resource; this story reuses existing backend-internal modules only.
- `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/2/3 definitions; all three run fresh this story, no gap found, no new prerequisite story created.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `apps/backend/src/env.ts`, `apps/backend/src/lib/ai-gateway/gemini-client.ts`, `apps/backend/src/lib/ai-gateway/gemini-client.test.ts`, `apps/backend/src/schema/resolvers.ts`, `apps/backend/src/schema/api-keys.test.ts`.
  - Not modified: `apps/backend/src/lib/vendor-gateway/*`, `apps/backend/src/lib/ai-gateway/{adapter,system-key-adapter}.ts`, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `apps/backend/src/lib/scraper/*`, any `.graphql`/resolver-shape file, `apps/web`, `packages/ui`, `apps/infrastructure`, `packages/database` (no migration), root `.env.example` (deliberately, see Dev Notes).
- **Rule Mapping:**
  - Adapter Pattern for external AI services → `project-context.md` → this story closes the third and final direct `callGeminiGenerateContent` call site (`callGemini`/system-key fallback already closed by 0.i2c).
  - AD-32 Rules 3/4/5 (verification exception to locking, retry-classification reuse, DPA scope) → `festgrid-architecture-spine.md#AD-32` → Task 2 (`lockKey: undefined`, reuse `isGeminiErrorTransient`), AC7 (no DPA-gate change).
  - BUG-011/BUG-012 (fail-open trust, no request-level timeout) → `backlog.yaml` → Task 3 (fail-closed catch block), Task 1 (new short timeout).
  - Testing Rules (testing-trophy for `apps/*`, real-DB integration tests) → Task 4 → every new/updated test runs against the real resolver and, where relevant, the real local `vendor_call_locks` table via `db`, mirroring `guarded-call.test.ts`/`api-keys.test.ts`.
  - Story-split-gate Gate 1/2/3 → all three found no gap fresh → Dev Notes "Architecture & UX Gate Findings."
- **Verification Plan:**
  - `cd apps/backend && TZ=UTC NODE_ENV=test npx tsx --test src/schema/api-keys.test.ts src/lib/ai-gateway/gemini-client.test.ts` passes, covering every AC8/AC9 scenario (Task 4/5).
  - Re-run `src/schema/subscriptions.test.ts` to confirm zero regression at its own seam boundary (Task 5).
  - `pnpm --filter backend build`/`lint` clean (Task 5).
  - `git grep -n "failing open\|Transient error verifying key"` returns zero matches; `git diff --stat` against `baseline_commit` confirms only the listed files changed (Task 5, AC7).
  - Manual `psql` check: zero `vendor_call_locks` rows after the full test run (Task 5, AC9(e)).

## Pre-Coding Approval Gate

- [x] Scope confirmation — adopt `callVendor` into the one remaining AD-32-named `callGeminiGenerateContent` entry point (`verifyGeminiApiKey`); make `createApiKey`'s verification-error handling fail-closed instead of fail-open; add one new, narrow, story-local env var (`GEMINI_VERIFICATION_TIMEOUT_MS`). `callGemini`/system-key fallback (0.i2c), Apify/Bright Data (0.i2d), and the DPA gate (explicitly not Gemini's concern) are out of scope. **Approved — Gate 1/2/3 subagent passes confirmed no gap; scope matches `epics.md#Story 0.i2b` and the two `AskUserQuestion` design decisions below.**
- [x] Architecture and boundary confirmation — all edits stay inside `apps/backend/src/lib/ai-gateway/`, `apps/backend/src/env.ts`, and `apps/backend/src/schema/resolvers.ts`; no new module, package, table, migration, or external dependency; reuses Story 0.i2a's and 0.i2c's already-built, already-tested exports as-is. **Approved — Gate 1 found no gap.**
- [x] Testing plan confirmation — real-local-DB/real-resolver `node:test` integration tests (Task 4) covering the happy path, `INVALID_API_KEY` (regression), the new `VERIFICATION_TIMEOUT` path, the rewritten `VERIFICATION_FAILED` path (replacing the old fail-open test), and a zero-`vendor_call_locks`-rows assertion; no mocked DB for that assertion; the `packages/domain` 100%-coverage rule does not apply (these modules live in `apps/backend`). **Approved.**
- [x] **`GEMINI_VERIFICATION_TIMEOUT_MS` default value — resolved via `AskUserQuestion` during this story's creation:** user selected `10000`ms (10s) over the `5000`ms/`15000`ms alternatives presented. AC3 and Task 1 reflect this choice.
- [x] **Fail-closed error shape — resolved via `AskUserQuestion` during this story's creation:** user selected two distinct `extensions.code` values (`VERIFICATION_TIMEOUT` for `VendorCallTimeoutError`, `VERIFICATION_FAILED` for every other non-`INVALID_API_KEY` error) over a single generic code. AC4, AC5, and Task 3 reflect this choice.
- [x] **Gate 1/2/3 prerequisites confirmed done or gap accepted** — all three gates run fresh during this story's creation (no `epic-0-i2-readiness.md` sweep report exists); **no gap found** by any of the three (independently verified by each subagent against the actual repo code, not just the plan); no new prerequisite story was created.
- [x] Explicit human approval state — the two substantive open design decisions in this story (timeout value, error-shape design) were put to the user via `AskUserQuestion` and answered before this file was written; no other open tradeoff remained after the Gate 1/2/3 passes confirmed a clean, narrow, fully-precedented adoption. **Approved.**

## Testing Requirements

- [ ] Integration tests (required, real local DB + real resolver, no mocks for the `vendor_call_locks` zero-rows assertion): `apps/backend/src/schema/api-keys.test.ts` (rewritten fail-open→fail-closed test, new `VERIFICATION_TIMEOUT` test, regression re-check of the happy-path/`INVALID_API_KEY` tests) and `apps/backend/src/lib/ai-gateway/gemini-client.test.ts` (new `verifyGeminiApiKey`-via-`callVendor` test, including the zero-rows assertion) — every scenario in AC8/AC9.
- [ ] Regression re-run: `apps/backend/src/schema/subscriptions.test.ts` (also exercises `createApiKey` directly) must still pass unchanged.
- [ ] Unit tests: Not applicable in the `packages/domain` 100%-coverage sense — these modules live in `apps/backend` and are covered by the integration suites above per the testing-trophy philosophy.
- [ ] E2E tests: Not applicable — no UI change, no new user-facing surface beyond an existing error-handling convention (a new `extensions.code` string on an already-error-prone mutation).
- [ ] Manual verification: zero leftover `vendor_call_locks` rows after the full test run (`psql`), matching Story 0.i2a/0.i2c's own precedent.

## Deliverables Checklist

- [ ] `env.ts`: `geminiVerificationTimeoutMs` field + loader (default `10000`ms via `GEMINI_VERIFICATION_TIMEOUT_MS`); `.env.example` deliberately unchanged (see Dev Notes).
- [ ] `gemini-client.ts`: `verifyGeminiApiKey` routes through `callVendor('gemini', { lockKey: undefined, ... })`, reusing `isGeminiErrorTransient` and `callGeminiGenerateContent`'s signal parameter as-is.
- [ ] `resolvers.ts`: `createApiKey`'s `catch` block fail-open branch replaced with `VendorCallTimeoutError` → `VERIFICATION_TIMEOUT` and every other non-`INVALID_API_KEY` error → `VERIFICATION_FAILED`.
- [ ] `api-keys.test.ts`: old fail-open test rewritten to assert fail-closed `VERIFICATION_FAILED`; new `VERIFICATION_TIMEOUT` test added; happy-path/`INVALID_API_KEY` tests re-confirmed passing.
- [ ] `gemini-client.test.ts`: new test proving `verifyGeminiApiKey` writes zero `vendor_call_locks` rows.
- [ ] `pnpm build`/`pnpm lint` pass for `apps/backend`.
- [ ] `git grep -n "failing open\|Transient error verifying key"` returns zero matches.

## Out of Scope

- Adopting `callVendor` into `callGemini`'s candidate loop or `system-key-adapter.ts`'s AD-10 fallback — already done, Story 0.i2c (landed in code, status "review").
- Apify/Bright Data adoption of `callVendor` (`trigger-apify-for-target.ts`, `brightdata-client.ts`) — Story 0.i2d's scope, not touched here.
- The repo-wide "no SDK bypass" ratchet test — Story 0.i2z's scope; depends on 0.i2a/0.i2b/0.i2c/0.i2d all landing first.
- Adding Gemini to the DPA-confirmation gate — explicitly rejected at the architecture stage (AD-32 Rule 5) and reconfirmed here via Gate 3; `callVendor`'s `assertDpaConfirmed` already no-ops unconditionally for `vendor: 'gemini'`, unchanged by this story.
- Writing a new Gemini transient-error classifier — `isGeminiErrorTransient` already exists (Story 0.i2c) and is reused as-is; this story adds no second classifier.
- FIND-079 (private-account enforcement at subscribe time) — orthogonal mechanism, unrelated backlog row, explicitly out of scope per Dev Notes.
- Adding `GEMINI_VERIFICATION_TIMEOUT_MS` to root `.env.example` — deliberately not done, per its sibling vars' own precedent (see Dev Notes).
- Any change to the four `apps/backend/src/lib/posts/` test files or the forthcoming row-count-ratchet npm script named in Story 0.51 — unrelated files, this story's own test hygiene is independently verified compliant (zero `vendor_call_locks` rows) without needing that story to land first.

## Definition of Done

- [ ] AC 1-9 satisfied.
- [ ] `api-keys.test.ts`, `gemini-client.test.ts` passing against the real resolver/real local DB (Testing Requirements).
- [ ] `subscriptions.test.ts` re-run and passing with no regression.
- [ ] `pnpm lint` and `pnpm build` passing for `apps/backend`.
- [ ] `git grep -n "failing open\|Transient error verifying key"` returns zero matches; `git diff --stat` against `baseline_commit` shows only the files in the File Change Plan.
- [ ] Manual `psql` check confirms zero leftover `vendor_call_locks` rows after the full test run.
- [ ] Pre-Coding Approval Gate's two `AskUserQuestion`-resolved design decisions (timeout value, error-shape design) implemented exactly as decided.

## Completion Status

- [ ] Not started — story is `ready-for-dev`. Pending `bmad-dev-story`.

## Dev Agent Record

### Agent Model Used

(to be filled in by `bmad-dev-story`)

### Debug Log References

(to be filled in by `bmad-dev-story`)

### Completion Notes List

(to be filled in by `bmad-dev-story`)

### File List

(to be filled in by `bmad-dev-story`)

### Change Log

- 2026-10-07: Story created via `bmad-create-story`. Gate 1/2/3 run fresh (no `epic-0-i2-readiness.md` sweep exists) — all three independently confirmed no gap, verified against the actual repo code. Two design decisions resolved via `AskUserQuestion`: `GEMINI_VERIFICATION_TIMEOUT_MS` default (`10000`ms) and the fail-closed error-shape (`VERIFICATION_TIMEOUT`/`VERIFICATION_FAILED`, two distinct codes). Status set to "ready-for-dev."
