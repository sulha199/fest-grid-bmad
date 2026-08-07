---
baseline_commit: 37715e7629540ac690cfee5ae15f5f53169ce8db
---

# Story 0.13: Set up the AI Gateway adapter layer for Gemini

## Story Details

- Epic: 0
- Story ID: 0.13
- Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a dedicated AI Gateway layer that wraps all outbound Gemini API calls behind a single Adapter interface, with dynamic throttling, intelligent queuing, BYOK API key round-robin selection (Tier 1 user-specific / Tier 2 shared with fairness), and KMS-backed decryption of stored keys,
so that every feature that calls an external AI service (event extraction now; AI-assisted correction later) reuses the same rate-limiting, key-management, and modularity guarantees instead of each feature calling Gemini directly.

## Acceptance Criteria

1. **Given** a feature needs to extract or correct event data using Gemini, **when** it needs to call the Gemini API, **then** it does so exclusively through this Adapter's exposed interface — never the raw Gemini SDK/HTTP API. [epics.md AC1]
2. **And** the Adapter manages outgoing request rate (dynamic throttling/queuing) to prevent rate-limit violations and Google "suspicious activity" flags (PRD §3.8). [epics.md AC2]
3. **And** the Adapter selects which user's API key to use per the quota-management algorithm (Tier 1: sole subscriber's key(s); Tier 2: round-robin across subscribers' keys, prioritizing users with fewer calls this billing cycle). [epics.md AC3]
4. **And** the Adapter decrypts a user's BYOK key in memory only when needed, using AWS KMS, and never logs or persists the decrypted value. [epics.md AC4]
5. **And** the Adapter skips a failed/rate-limited/invalid key and falls through to the next available key per the round-robin. [epics.md AC5]
6. **And** internal per-key usage tracking is reset at the start of each billing cycle. [epics.md AC6]
7. **Given** the `api_keys` table (Story 1.1) has no columns to persist per-key usage counts or a billing-cycle anchor, **when** this story ships, **then** a Drizzle-kit generated migration adds `usage_count` and `usage_cycle_reset_at` columns to `api_keys`, and AC3/AC5/AC6's tracking reads/writes these **persisted** columns — not in-process memory — since each AWS Lambda invocation is a fresh, stateless execution and cannot rely on counters surviving between invocations. [Data Type Compatibility extension — see Dev Notes and dedicated section below]
8. **Given** no feature story calls this Adapter yet (Story 3.6 and Story 4.2 are its first real future consumers), **when** this story ships, **then** the Adapter is a reserved, ready-to-consume capability — no product/pipeline code invokes it in this story. This story proves the Adapter end-to-end via 100%-covered unit tests of its pure selection/backoff/cycle logic (packages/domain) plus a mocked-dependency integration test of the orchestrator (apps/backend); a full real-Gemini + real-KMS round trip is explicitly deferred (see Dev Notes "KMS Key Not Yet Provisioned"). [epics.md Note — mirrors the "reserved slot" pattern from Stories 0.7/0.8/0.9/0.12]

## Tasks / Subtasks

- [x] Task 1: Resolve the `apps/backend` scaffolding sequencing conflict before starting (AC: 1, 2, 4, 5)
  - [x] Confirm whether Story 0.8 ("Set up GraphQL server scaffold...") has been implemented — check for a committed `apps/backend/package.json` (`git ls-files apps/backend`).
  - [x] If Story 0.8 is already implemented: add this story's dependencies to the existing `apps/backend/package.json` and extend the existing `apps/backend/src/env.ts`.
  - [x] If Story 0.8 is **not** yet implemented: per the Pre-Coding Approval Gate sign-off, create only the minimal `apps/backend` scaffold needed for this story to function — `package.json` (unscoped name `backend`, mirroring Story 0.8's planned shape), `tsconfig.json` (extends `@festgrid/typescript-config/base.json`, `module`/`moduleResolution: "NodeNext"`, `outDir: "dist"`), `eslint.config.mjs` (extends `@festgrid/eslint-config/base`). Do **not** build any GraphQL/server code — that remains Story 0.8's exclusive scope.
- [x] Task 2: Scaffold `packages/domain` from zero and build the pure, framework-agnostic AI-Gateway logic (AC: 3, 5, 6, 7)
  - [x] Create `packages/domain/package.json` (name `@festgrid/domain`), `tsconfig.json`, `eslint.config.mjs` mirroring `packages/database`'s Node-run package archetype (`module`/`moduleResolution: "NodeNext"`). No React, no DOM libs, no `apps/backend`/AWS-SDK/Gemini-SDK dependency — this package must stay importable by both Lambda/Node backend code and (hypothetically) future non-React tooling, per `project-context.md`'s "CRITICAL RESTRICTION: Absolutely NO React code in `packages/domain`" and its "may be imported by Node/Backend stacks" allowance. This is the **first** story to scaffold `packages/domain` (confirmed via `git ls-files packages/domain` returning nothing, and Story 0.10's Dev Notes explicitly leaving its scaffolding to "a future domain-logic story"); organize it in a `src/ai-gateway/` subfolder per `project-context.md`'s "organized into sub-folders by domain area" rule, so Story 3.6's later `src/events/` subfolder is additive, not conflicting.
  - [x] Create `packages/domain/src/ai-gateway/types.ts` exporting minimal, DB-decoupled interfaces: `ApiKeyCandidate { id: string; userId: string; usageCount: number; usageCycleResetAt: string /* ISO */; isValid: boolean; invalidAttempts: number }` and `SelectionTier = 'TIER_1_USER_SPECIFIC' | 'TIER_2_SHARED_ROUND_ROBIN'`. Deliberately **not** imported from `@festgrid/database` (no Drizzle/Postgres coupling in `packages/domain`), even though the shapes mirror `apiKeys` — apps/backend maps DB rows to this shape at the boundary.
  - [x] Create `packages/domain/src/ai-gateway/select-api-key.ts` exporting a pure `selectApiKey(candidates: ApiKeyCandidate[], tier: SelectionTier, excludeIds?: Set<string>): ApiKeyCandidate | null`: Tier 1 picks any valid, non-excluded key belonging to the (sole) subscriber, least-recently-used by `usageCount` ascending; Tier 2 round-robins across all subscribers' valid, non-excluded keys, sorted by `usageCount` ascending (fairness — "prioritize keys from users who have contributed fewer API calls in the current billing cycle" per PRD §3.4). Returns `null` when no candidate remains (all excluded/invalid) — the caller (apps/backend orchestrator) is responsible for surfacing that as a "no usable key" outcome. [AC3, AC5]
  - [x] Create `packages/domain/src/ai-gateway/usage-cycle.ts` exporting pure `isCycleElapsed(usageCycleResetAt: string, cycleDays: number, now: Date): boolean` and `nextCycleReset(now: Date, cycleDays: number): string` (ISO string), implementing AC6's "reset at the start of each billing cycle" as a lazy, read-time check (no cron job) — see Dev Notes "Billing-Cycle Interpretation" for the assumed cycle length/semantics.
  - [x] Create `packages/domain/src/ai-gateway/backoff.ts` exporting a pure `computeBackoffDelayMs(attempt: number, retryAfterSeconds?: number): number` — if `retryAfterSeconds` is present (from a Gemini `Retry-After` response header), use it directly; otherwise exponential backoff starting at 1000ms, doubling per attempt, with ±20% jitter, capped at 30000ms (per the researched Gemini 429-handling best practice of honoring `Retry-After` and otherwise backing off exponentially from ~1s). [AC2]
  - [x] Create `packages/domain/src/ai-gateway/select-api-key.test.ts`, `usage-cycle.test.ts`, `backoff.test.ts` using `node:test`/`node:assert` via `tsx --test` (no test framework exists yet — Story 0.10 is still `ready-for-dev`, not `done`; mirrors the `node:test` precedent Stories 0.8/0.11/0.12 already established for pre-Vitest packages). Achieve **100% coverage** of all three modules per `project-context.md`'s "Unit Test Requirement" ("All logic exported from `packages/domain` must have 100% unit test coverage. This is the only place where unit tests should be written."), covering: Tier 1 single-key and multi-key-same-user cases, Tier 2 fairness ordering, exclusion of invalid/excluded keys, the `null`-when-empty case, cycle-elapsed boundary conditions (exactly at/just before/just after the boundary), and backoff with and without `retryAfterSeconds`.
  - [x] Add a `"test": "tsx --test src/**/*.test.ts"` script to `packages/domain/package.json` so `turbo run test` picks it up automatically once wired.
- [x] Task 3: Build the `apps/backend` AI Gateway orchestrator — the Adapter's actual exposed interface (AC: 1, 2, 4, 5)
  - [x] Add `@google/genai` (`^2.14.x`) and `@aws-sdk/client-kms` (`^3.1058.x`) as dependencies of `apps/backend/package.json` only.
  - [x] Create/extend `apps/backend/src/env.ts` (root-`.env`-loading convention, mirroring `packages/database/env.ts`) to load `BYOK_KMS_KEY_ID`, `GEMINI_MODEL`, `API_KEY_INVALID_ATTEMPTS_THRESHOLD` (default `5`, matching the PRD's documented default), `API_KEY_USAGE_CYCLE_DAYS` (default `30`).
  - [x] Create `apps/backend/src/lib/ai-gateway/kms.ts`: a lazy singleton `getKmsClient()` (constructed on first use, not at import time — mirrors Story 0.12's Firebase Admin lazy-init pattern so `apps/backend dev`/`build` don't crash without real AWS credentials locally); exported `decryptApiKey(ciphertextBase64: string): Promise<string>` calling `KMSClient.send(new DecryptCommand({ CiphertextBlob: Buffer.from(ciphertextBase64, 'base64') }))` and returning the plaintext (never logged); exported `encryptApiKey(plaintext: string): Promise<string>` calling `EncryptCommand({ KeyId: env.BYOK_KMS_KEY_ID, Plaintext: Buffer.from(plaintext) })` returning base64 ciphertext for storage in `api_keys.key_encrypted` (direct KMS `Encrypt`/`Decrypt` — no envelope encryption needed, since BYOK Gemini keys are well under KMS's 4KB direct-encryption limit). **`encryptApiKey`'s real first caller is now Story 3.1b's `createApiKey` mutation resolver, not Story 3.1 (see this story's Out of Scope note, corrected 2026-08-07) — if Story 3.1b is implemented before this story, `apps/backend/src/lib/ai-gateway/kms.ts` will not yet exist; Story 3.1b's own Pre-Coding Approval Gate must confirm this file exists (or is built as part of that story) before its `createApiKey` resolver can call `encryptApiKey`.**
  - [x] Create `apps/backend/src/lib/ai-gateway/gemini-client.ts`: a thin wrapper around `@google/genai`'s `GoogleGenAI` client — exported `callGeminiGenerateContent(apiKey: string, request: GeminiCallRequest): Promise<GeminiCallResult>` that constructs a fresh `GoogleGenAI({ apiKey })` per call (no client caching across different users' keys), calls `.models.generateContent(...)`, and classifies failures into typed errors: `GeminiRateLimitedError` (HTTP 429, captures `Retry-After` if present), `GeminiInvalidKeyError` (HTTP 401/403), `GeminiUnknownError` (anything else) — so the orchestrator (next) can branch on error type per AC5.
  - [x] Create `apps/backend/src/lib/ai-gateway/usage-store.ts`: Drizzle-backed reads/writes against `packages/database`'s `apiKeys` table — `fetchCandidateKeys(provider: string, subscriberUserIds: string[]): Promise<ApiKeyCandidate[]>` (maps DB rows to `packages/domain`'s `ApiKeyCandidate` shape, applying `usage-cycle.ts`'s `isCycleElapsed` check and treating an elapsed cycle as `usageCount: 0` for selection purposes, **and filtering to active rows only via `activeOnly(apiKeys)` from `@festgrid/graphql-select` (Story 0.22) — a revoked/soft-deleted key must never be returned as a selection candidate; added 2026-08-07 via Story 3.1b's own creation, whose AC requires a revoked key be immediately excluded from this pool**), `recordSuccessfulUsage(keyId: string): Promise<void>` (increments `usage_count`, and if the cycle had elapsed, resets `usage_count` to `1` and bumps `usage_cycle_reset_at` via `nextCycleReset`), `recordInvalidAttempt(keyId: string, threshold: number): Promise<void>` (increments `invalid_attempts`; sets `is_valid = false` once the threshold is reached).
  - [x] Create `apps/backend/src/lib/ai-gateway/adapter.ts`: the **sole exposed interface** (AC1) — exported `callGemini(request: GeminiCallRequest & { provider: 'gemini'; subscriberUserIds: string[] }): Promise<GeminiCallResult>`. Orchestration loop: fetch candidates (`usage-store`) → determine tier (`subscriberUserIds.length === 1 ? TIER_1 : TIER_2`) → `selectApiKey` (`packages/domain`, excluding already-tried keys this call) → `decryptApiKey` (`kms.ts`) → wait per `computeBackoffDelayMs` if this is a retry (`packages/domain`) → `callGeminiGenerateContent` (`gemini-client.ts`) → on success: `recordSuccessfulUsage`, return result; on `GeminiRateLimitedError`: exclude this key and retry `selectApiKey` with the next candidate (AC5), backing off per `Retry-After`; on `GeminiInvalidKeyError`: `recordInvalidAttempt`, exclude this key, retry with the next candidate (AC5); on `GeminiUnknownError` or exhausted candidates: throw a typed `AiGatewayExhaustedError` for the caller to handle (e.g. re-queue the SQS message, per the three-queue architecture). The decrypted plaintext key is held only in a local variable for the duration of one `callGeminiGenerateContent` call and is never assigned to any logged value, error message, or persisted field (AC4).
  - [x] Create `apps/backend/src/lib/ai-gateway/adapter.test.ts` (`node:test`/`tsx --test`) with `usage-store`/`kms`/`gemini-client` swapped for constructor-injected/module-mocked fakes (no real AWS/Gemini network calls) proving: Tier 1 single-key success path records usage; a rate-limited first key correctly falls through to a second candidate and still succeeds (AC5); an invalid-key error increments `invalid_attempts` and, at threshold, flips `is_valid` via the store call; exhausting all candidates throws `AiGatewayExhaustedError` without ever calling `recordSuccessfulUsage`.
  - [x] Add a `"test": "tsx --test src/**/*.test.ts"` script to `apps/backend/package.json` if none exists yet (mirrors Story 0.11/0.12's precedent).
- [x] Task 4: Add usage-tracking columns to `api_keys` via a Drizzle-kit migration (AC: 6, 7 — see Data Type Compatibility section)
  - [x] Add `usageCount: integer('usage_count').default(0).notNull()` and `usageCycleResetAt: timestamp('usage_cycle_reset_at', { withTimezone: true }).defaultNow().notNull()` to the `apiKeys` table definition in `packages/database/schema.ts`.
  - [x] Run `pnpm --filter database run generate` (drizzle-kit) to produce a new committed migration SQL file (AD-3: schema changes must ship as generated migration files, never hand-written or ad hoc).
  - [x] Confirm `packages/database/seed.ts`'s `FIXTURE_API_KEYS` still seeds correctly with the new columns defaulting (`usage_count = 0`, `usage_cycle_reset_at = now()`) — no seed data changes required since both new columns have DB-level defaults.
- [x] Task 5: Wire environment variables (AC: 2, 4, 6)
  - [x] Add to root `.env.example`: `BYOK_KMS_KEY_ID=` (backend-only — the actual KMS key resource is provisioned by Story 0.14's IaC, not this story; see Dev Notes "KMS Key Not Yet Provisioned"), `GEMINI_MODEL="gemini-2.5-flash"` (a reasonable low-cost default; the actual model choice is not gated by this story), `API_KEY_INVALID_ATTEMPTS_THRESHOLD="5"`, `API_KEY_USAGE_CYCLE_DAYS="30"`.
  - [x] Do **not** add these to `turbo.json`'s `globalEnv`/task `env` arrays — mirrors the existing `DATABASE_URL` precedent (Story 0.8/0.12's Dev Notes): none of these vars are read at build time, only lazily at first runtime call, so no turbo task declaration is needed.
  - [x] No `.github/workflows/ci.yml` changes needed — CI's `build`/`lint`/`test` steps do not require real KMS/Gemini credentials (the mocked-dependency unit/integration tests in Tasks 2–3 need none).
- [x] Task 6: Update `SETUP_WALKTHROUGH.md` with a new AI Gateway (Google Gemini) section (persistent fact: cloud/external service setup)
  - [x] Add a new `## 6. AI Gateway (Google Gemini API)` section after the existing `## 5. Analytics (PostHog)` section, describing: obtaining a free-tier Gemini API key from [Google AI Studio](https://aistudio.google.com/) for local development/testing of the Adapter (this is a *personal test key*, distinct from the BYOK keys real end users will later provide via Story 3.1's onboarding wizard), and explicitly noting that the AWS KMS key referenced by `BYOK_KMS_KEY_ID` is provisioned automatically by Story 0.14's IaC stack — it is not a manual console step, unlike Firebase/PostHog.
- [x] Task 7: Verification (AC: 1-8)
  - [x] `pnpm --filter domain exec tsx --test src/ai-gateway/*.test.ts` (or the wired `test` script) passes with 100% coverage on all three pure modules.
  - [x] `pnpm --filter backend exec tsx --test src/lib/ai-gateway/adapter.test.ts` (or the wired `test` script) passes, proving the mocked-dependency orchestration paths in Task 3.
  - [x] `pnpm --filter database run generate` produced migration applies cleanly against a local Postgres instance (`pnpm --filter database run migrate`), and `packages/database/seed.ts` still runs without error.
  - [x] Run `pnpm build` and `pnpm lint` at the repo root and confirm both are clean.
  - [x] Record in Completion Notes that the full real-AWS-KMS + real-Gemini round trip remains **deferred** until Story 0.14 provisions a real `BYOK_KMS_KEY_ID` (see Dev Notes) — this is expected, not a gap in this story's own verification.

## Dev Notes

- **This story is pure infrastructure/plumbing — no product UI ships, and no pipeline story calls it yet.** Story 3.6 ("Process posts from the queue...") and Story 4.2 ("AI-assisted event data correction") are the first real callers. This mirrors the "reserved slot, not implemented" pattern already established by Stories 0.7, 0.8, 0.9, and 0.12.
- **`apps/backend` scaffolding sequencing conflict (see Pre-Coding Approval Gate) — same recurring Epic 0 pattern as Stories 0.9–0.12.** As of this story's creation, `apps/backend` has no committed `package.json` (`git ls-files apps/backend` returns nothing). Story 0.8 owns scaffolding it from zero and is still `ready-for-dev`. Task 1 handles both orderings explicitly, mirroring Story 0.12's Task 1 resolution exactly.
- **`packages/domain` does not exist yet — this story is its first scaffolding story, not a workaround.** Confirmed via `git ls-files packages/domain` (empty) and Story 0.10's own Dev Notes, which explicitly deferred `packages/domain`'s creation to "a future domain-logic story." Story 3.6's implementation-artifact (already written) plans a `packages/domain/src/events/transformGeminiResponseToEventInfo.ts` and assumes the package already exists by the time it runs — this story is what makes that assumption true, by establishing the package's generic Node-package shape (`package.json`/`tsconfig.json`/`eslint.config.mjs`) with a `src/ai-gateway/` subfolder. Story 3.6 later adds its own `src/events/` subfolder alongside it — no conflict, per `project-context.md`'s "organized into sub-folders by domain area" convention.
- **Why the quota-selection/backoff/cycle-reset logic lives in `packages/domain`, but the KMS/Gemini-SDK-calling code lives in `apps/backend`:** `selectApiKey`, `isCycleElapsed`/`nextCycleReset`, and `computeBackoffDelayMs` are pure functions over plain data (no I/O, no SDK, no network) — exactly the "framework-agnostic business logic" `packages/domain` exists for, and the persistent "reusable mechanism → `packages/domain`" project rule applies cleanly here (unlike Story 0.12's `firebase-admin` wrapper or Story 0.8's `buildOptimizedDrizzleSelect`, which stayed out of `packages/domain` for being SDK-coupled). The KMS decrypt/encrypt calls, the Gemini SDK network call, and the Drizzle DB reads/writes are all I/O- and SDK-coupled — these stay in `apps/backend`, consistent with that same precedent.
- **Why in-process rate-limiting uses a hand-rolled pure backoff calculator instead of a library like `p-queue`:** `p-queue` (latest `^9.x`) is ESM-only with no CommonJS export, and this monorepo's Node packages (`packages/database`, and `apps/backend` per Story 0.8's planned shape) have no `"type": "module"` set, defaulting to CommonJS output under `NodeNext`. Rather than forcing an ESM-only dependency (or pinning an old, unmaintained `p-queue` major), AC2's "dynamic throttling" is implemented as a pure, dependency-free backoff calculator (`backoff.ts`) plus the orchestrator's own sequential retry loop — sufficient for a single Lambda invocation processing one SQS message at a time (per the `AIProcessingQueue` architecture). **True cross-invocation concurrency capping (bounding how many `AI Processor` Lambda instances run Gemini calls simultaneously) is an AWS Lambda reserved-concurrency / SQS batch-size concern, not an application-code concern — that configuration belongs to Story 0.14's IaC stack, not this story.** This boundary is called out explicitly so Story 0.14 doesn't have to rediscover it.
- **Billing-Cycle Interpretation (assumption requiring Pre-Coding Approval Gate sign-off):** Neither the PRD nor `epics.md` defines an exact billing-cycle length or anchor date for AC6's "reset... at the start of each billing cycle." This story implements a pragmatic, lazy (no-cron-job) interpretation: each key's `usage_cycle_reset_at` acts as a rolling window start; on any read, if `now() > usage_cycle_reset_at + API_KEY_USAGE_CYCLE_DAYS days` (default 30), the key is treated as having `usage_count = 0` for selection purposes, and the next successful call resets `usage_count` to `1` and bumps `usage_cycle_reset_at` forward. This avoids needing a scheduled reset job (no new EventBridge rule) at the cost of not aligning to a calendar month boundary. Flagged explicitly for human sign-off since it's a product-behavior interpretation, not just a technical wiring choice.
- **KMS Key Not Yet Provisioned (accepted forward dependency, not a Gate 1 gap):** This story's `kms.ts` calls `@aws-sdk/client-kms` against a `BYOK_KMS_KEY_ID` that Story 0.14 ("Set up AWS IaC for Lambda, SQS, EventBridge, and KMS", still `backlog`) is responsible for provisioning. `epic-0-readiness.md` (`swept: true`) explicitly checked this shape of dependency and found it "an existing, already-documented pattern... does not require action" (citing Story 0.13→1.1 as the precedent; the same reasoning applies to 0.13→0.14). Task 3's `kms.ts` is lazily initialized (mirrors Story 0.12's Firebase Admin pattern) so `apps/backend dev`/`build`/unit-test all work without a real key; the full real-KMS round trip is deferred to whenever 0.14 lands (Task 7's final verification note), the same way Story 0.12 deferred its full real-Firebase round trip to manual, interim verification.
- **Invalid-key vs. rate-limited distinction (AC5):** A `429` (rate-limited) response does **not** increment `invalid_attempts` or touch `is_valid` — it is a transient condition, and the key remains a valid future candidate. Only a `401`/`403` (the key itself is rejected by Google) increments `invalid_attempts`, and only once `API_KEY_INVALID_ATTEMPTS_THRESHOLD` (default `5`, matching the PRD's own documented default for invalid-key-attempt notifications) is reached does `is_valid` flip to `false`. This story implements the counter/flag mechanics only — the user-facing email notification this threshold is meant to trigger (FR35) is Story 0.15's ("Set up outbound email adapter") scope, not this story's.
- **Package dependency isolation (project-context.md, persistent fact):** `@google/genai` and `@aws-sdk/client-kms` are added to `apps/backend` **only**. Neither is added to `packages/domain` (which stays SDK-free) or any other shared package.
- **No `packages/ui` component is introduced.** No React component renders anything in this story. Confirmed via a fresh Gate 2 (UX) subagent pass below.
- **No Unified Query DSL (AD-1/AD-2) involvement** — this story never retrieves an event collection.
- **No PostHog/analytics events (AD-5)** — this story introduces no user-facing interaction to instrument.
- **No i18n strings (AD-6)** — this story ships no user-facing text.
- **No state-management categorization applies** — this is backend-only; nothing is stored in Server State/URL State/Client Global State.
- **No async loader (blocking/non-blocking) categorization applies** — no UI renders a loading state for this story's async functions.
- **Latest Tech Information:** `@google/genai` (Google's current, actively-developed Gemini SDK — the older `@google/generative-ai` package is being phased out in favor of it) latest stable is `2.14.0` (npm, checked 2026-07-31). `@aws-sdk/client-kms` latest stable is `3.1058.0` (npm, checked 2026-07-31), providing `KMSClient`/`EncryptCommand`/`DecryptCommand`. Gemini API rate limits are dimensioned across RPM/TPM/RPD; on `429`, best practice is to honor a `Retry-After` header when present and otherwise back off exponentially starting near 1s — exactly what `backoff.ts` implements.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md` (`swept: true`, `stories_covered` explicitly includes `0.13`). The report's two new findings (missing outbound-email adapter → Story 0.15; missing Geolocation adapter/cache → Story 0.16) are unrelated to the AI Gateway. The report explicitly flags one non-blocking observation about this story: *"Story 0.13 has `Depends on: Story 1.1`, a forward dependency from Epic 0 into Epic 1. This is an existing, already-documented pattern... and does not require action."* No Gate 1/3 gap applies to Story 0.13 itself.
  - **Lightweight escape-hatch guard:** Re-checked this story's specific scope against the sweep. Two genuine new wrinkles surfaced during drafting that the epic-wide sweep (which reasons over `epics.md`'s *planned* ACs, not implementation detail) would not have anticipated at that granularity: (1) `api_keys` lacking usage-tracking columns (a Data Type Compatibility finding, handled below — a normal schema-evolution task squarely within this story's own scope, not a cross-cutting Gate 1/3 gap needing a new prerequisite story), and (2) this story's own forward dependency on Story 0.14's not-yet-provisioned KMS key (an accepted sequencing risk, documented above and in the Pre-Coding Approval Gate, not an architecture-completeness gap — Story 0.14 already exists as the unambiguous owner of that resource, mirroring the epic report's own reasoning about the 0.13→1.1 forward dependency).
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a Freya (`wds-agent-freya-ux`)-persona subagent (required per-story even when the epic sweep is used). The subagent read `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` and `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md` in full and grepped all four for "Gemini"/"BYOK"/"adapter"/"quota"/"rate limit"/"throttl". **Verdict: No gap found.** Both authoritative UX artifacts have zero mentions of any of those terms; the only related surface is a generic `/settings/api-keys` "Manage API Keys" screen and an "In-Table Add Form" pattern, which describe the user-facing key-*management* UI (a separate, already-scoped story) — not this story's backend-only adapter/throttling/round-robin logic. This story ships no React component, page, hook, or util with UI-facing states.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **Mismatch found.** `packages/database/schema.ts`'s `apiKeys` table (created by Story 1.1) has no columns to persist per-key usage counts or a billing-cycle anchor, but AC3/AC5/AC6 require exactly that — and it must be durable, since AWS Lambda invocations are stateless and cannot rely on an in-process counter surviving between SQS-triggered invocations.
- Impacted fields/contracts: `packages/database/schema.ts`'s `apiKeys` table (new columns `usage_count`, `usage_cycle_reset_at`); `packages/domain`'s new `ApiKeyCandidate` type (local to `packages/domain`, not a `@festgrid/shared-types` change — see below); `apps/backend/src/lib/ai-gateway/usage-store.ts`'s row-mapping function.
- Required DB migration changes: Add `usage_count integer not null default 0` and `usage_cycle_reset_at timestamptz not null default now()` to `api_keys` via a `drizzle-kit generate`-produced, committed SQL migration file (Task 4) — never hand-written, per AD-3.
- Required TypeScript type changes: `packages/database/schema.ts`'s `apiKeys` Drizzle table definition gains two typed columns (compile-time inferred, no manual type authored). No changes required to `@festgrid/shared-types` — no `ApiKey` interface exists there today (confirmed via `packages/shared-types/src/index.ts`), and this story does not add one; the only new types are `packages/domain`'s local `ApiKeyCandidate`/`SelectionTier` (deliberately decoupled from the Drizzle row shape, mapped at the `apps/backend` boundary) and `apps/backend`-local request/result/error types for the Adapter's `callGemini` interface.
- Backward compatibility and rollout notes: Purely additive columns with DB-level defaults (`0` / `now()`) — no backfill needed, no existing row becomes invalid, and `packages/database/seed.ts`'s existing `FIXTURE_API_KEYS` entries pick up the defaults automatically without any seed-file edit.
- Verification checks: `packages/domain`'s 100%-covered unit tests proving `selectApiKey`/`isCycleElapsed`/`nextCycleReset`/`computeBackoffDelayMs` correctness (Task 2); `apps/backend`'s mocked-dependency `adapter.test.ts` proving the orchestrator reads/writes the new columns correctly via `usage-store.ts` (Task 3); the generated migration applying cleanly against a local Postgres instance and `seed.ts` still succeeding (Task 7).

### Project Structure Notes

- New `packages/domain` package (first scaffolding of this workspace): `package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/ai-gateway/{types,select-api-key,usage-cycle,backoff}.ts` + matching `.test.ts` files.
- New `apps/backend/src/lib/ai-gateway/{kms,gemini-client,usage-store,adapter}.ts` + `adapter.test.ts`, following the app's `src/lib/`-for-utilities convention (mirrors Story 0.12's `apps/backend/src/lib/firebase-admin.ts`).
- Modified: `packages/database/schema.ts` (two new `apiKeys` columns), a new committed migration file under `packages/database/migrations/`, `apps/backend/package.json` (new dependencies + `test` script if missing), `apps/backend/src/env.ts` (new env vars), `.env.example` (four new entries), `SETUP_WALKTHROUGH.md` (new §6).
- Detected conflicts or variances: `apps/backend` and `packages/domain` both have no committed files as of this story's creation — see Dev Notes' sequencing callouts and Task 1/Task 2's explicit handling. `packages/ui`, `packages/graphql-select`, and `packages/testing-config` remain uncommitted (unrelated to this story).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 0.13] — story AC source, and the epics.md `Note:`/`Depends on:` this story's Dev Notes address directly.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] — Gate 1/3 sweep, `swept: true`, explicitly names Story 0.13's forward dependency on Story 1.1 as a non-blocking, already-documented pattern.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule.
- [Source: _bmad-output/project-context.md#Technology-Stack, #Security, #General-Architecture, #Code-Quality-Style-Rules, #Testing-Rules] — Adapter Pattern mandate, KMS/credential-management rules, `packages/domain` restrictions and 100%-coverage rule, package-isolation rules.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md §3.4, §3.8] — Quota Management Algorithm (Tier 1/2, round-robin fairness, internal usage tracking reset per billing cycle), Gemini API Management and Capacity (suspicious-activity mitigation, QPM/QPD capacity limits), and the documented default `N=5` invalid-attempt threshold.
- [Source: docs/infrastructure/2-backend.md, docs/infrastructure/high-level-overview.md] — confirms the `AI Processor` Lambda (`L_AI`) is this Adapter's real future caller (Story 3.6), and that API Gateway/Lambda-level throttling is a separate, complementary concern from this Adapter's own request pacing.
- [Source: packages/database/schema.ts, migrations/0000_cultured_ultragirl.sql, seed.ts] — existing `apiKeys` table shape (`id`, `userId`, `keyEncrypted`, `provider`, `isValid`, `invalidAttempts`, timestamps) this story extends; confirmed no `usageCount`/cycle column exists prior to this story.
- [Source: packages/shared-types/src/index.ts] — confirmed no `ApiKey` interface exists there, so no shared-type change is required.
- [Source: packages/database/env.ts] — root-`.env`-loading convention mirrored by `apps/backend/src/env.ts`.
- [Source: _bmad-output/implementation-artifacts/0-8-...md, 0-11-...md, 0-12-...md] — precedent for the `apps/backend` sequencing-conflict handling, `node:test`/`tsx --test` pre-Vitest testing pattern, and lazy-SDK-client-initialization pattern this story reuses.
- [Source: _bmad-output/implementation-artifacts/0-10-...md] — explicit Dev Notes confirming `packages/domain` was deliberately left unscaffolded for "a future domain-logic story," which this story is.
- [Source: _bmad-output/implementation-artifacts/3-6-process-posts-from-the-queue-and-extract-event-information.md] — already-written future consumer story that assumes `packages/domain/src/events/...` exists and that Gemini calls route through this story's Adapter — confirms this story's package-split design is consistent with that story's expectations.
- [Web research, 2026-07-31: npm] `@google/genai` latest `2.14.0` (current, actively developed Gemini SDK, supersedes `@google/generative-ai`); `@aws-sdk/client-kms` latest `3.1058.0`; `p-queue` latest `9.3.3` is ESM-only with no CJS export (informed the decision to hand-roll `backoff.ts` instead — see Dev Notes).
- [Web research, 2026-07-31] Gemini API 429 handling best practice: honor the `Retry-After` header when present; otherwise exponential backoff starting near 1s, doubling per attempt.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Technology Stack (Adapter Pattern for external AI services), Security (Credential Management, User API Key Encryption via KMS), Code Quality (`packages/domain` restrictions), Testing Rules (100% `packages/domain` coverage), package-dependency-isolation rules.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated AD exists for the AI Gateway/Adapter Pattern (confirmed via grep); it is governed entirely by `project-context.md` and the PRD's §3.4/§3.8.
- [ ] `docs/infrastructure/2-backend.md`, `docs/infrastructure/high-level-overview.md` — confirms the `AI Processor` Lambda's role and API Gateway's complementary throttling layer.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New `packages/domain` package: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/ai-gateway/{types,select-api-key,usage-cycle,backoff}.ts` + `.test.ts` for each pure module.
  - New in `apps/backend`: `src/lib/ai-gateway/{kms,gemini-client,usage-store,adapter}.ts`, `adapter.test.ts`. New (or Modified, depending on Story 0.8's status): `apps/backend/package.json`, `tsconfig.json`, `eslint.config.mjs`, `src/env.ts`.
  - Modified: `packages/database/schema.ts` (two new `apiKeys` columns) + new committed migration SQL file; `.env.example` (four new entries); `SETUP_WALKTHROUGH.md` (new §6).
  - Not modified: `packages/graphql-select`, `packages/ui`, `packages/shared-types`, `.github/workflows/ci.yml` (no new required secrets for CI's mocked tests), `turbo.json` (no build-time env vars introduced).
- **Rule Mapping:**
  - Adapter Pattern, single exposed interface → `project-context.md` "Adapter Pattern" rule + PRD §3.8 → `apps/backend/src/lib/ai-gateway/adapter.ts`'s `callGemini` (AC1).
  - Pure logic → `packages/domain`, SDK/IO-coupled code → `apps/backend` → persistent "reusable mechanism → `packages/domain`" fact, applied and reasoned through in Dev Notes (AC3/AC5/AC6 split across Task 2/Task 3).
  - KMS decrypt-in-memory-only, never logged/persisted → `project-context.md` "User API Key Encryption" Security rule → `kms.ts` (AC4).
  - Persisted usage tracking (not in-memory) → Data Type Compatibility section → `packages/database/schema.ts` migration + `usage-store.ts` (AC6, AC7).
  - AD-3 (generated migrations only) → Task 4's `drizzle-kit generate` step.
  - Package isolation (`@google/genai`/`@aws-sdk/client-kms` in `apps/backend` only; no SDKs in `packages/domain`) → persistent package-dependency-isolation fact → Task 3/Task 5.
  - Cloud/external-service setup → persistent fact → `SETUP_WALKTHROUGH.md` §6 (Task 6).
  - i18n/analytics/state-management/loader categorization — all evaluated and found not applicable → Dev Notes.
- **Verification Plan:**
  - `packages/domain`'s three modules: 100% `node:test` coverage (Task 2/Task 7), covering Tier 1/Tier 2 selection, cycle-elapsed boundaries, backoff with/without `Retry-After`.
  - `apps/backend/adapter.test.ts`: mocked-dependency orchestration proving key-skip-on-rate-limit, invalid-key-threshold flip, and exhaustion-throws paths (Task 3/Task 7).
  - Migration applies cleanly to local Postgres; `seed.ts` still succeeds with new columns defaulting (Task 4/Task 7).
  - `pnpm build`/`pnpm lint` clean at the repo root.
  - Explicitly recorded as deferred (not a failure): the real-AWS-KMS + real-Gemini round trip, pending Story 0.14's KMS key provisioning.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build the AI Gateway Adapter (`packages/domain`'s pure selection/backoff/cycle logic + `apps/backend`'s KMS/Gemini-SDK/DB orchestration) as a reserved, ready-to-consume capability; add `usage_count`/`usage_cycle_reset_at` to `api_keys`; no UI, no real caller yet (Stories 3.6/4.2 are future consumers).
- [ ] Architecture and boundary confirmation: pure logic confined to `packages/domain` (no SDK deps), KMS/Gemini-SDK/DB code confined to `apps/backend`; `@google/genai`/`@aws-sdk/client-kms` isolated to `apps/backend` only.
- [ ] Testing plan confirmation: `packages/domain` gets 100%-covered `node:test` unit tests (non-negotiable per project Testing Rules); `apps/backend`'s orchestrator gets mocked-dependency tests; no live AWS/Gemini calls in automated tests; a full real round trip is deferred (see below).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-0-readiness.md` (no gap, `0.13` explicitly named, forward dependency on 1.1 noted as non-blocking); Gate 2 run fresh via Freya persona subagent (no gap found).
- [ ] **`apps/backend` sequencing conflict accepted:** mirrors Story 0.12's item exactly — confirm either (a) implement Story 0.8 first, or (b) accept this story creating the minimal `apps/backend` scaffold itself (Task 1).
- [ ] **`packages/domain` first-scaffold accepted:** confirm this story creating `packages/domain` from zero (Task 2) is the intended, non-duplicative owner of that scaffold (no other story currently claims it; Story 3.6's implementation artifact already assumes it exists).
- [ ] **Billing-cycle interpretation accepted:** confirm the assumed 30-day rolling-window, lazy-reset semantics (Dev Notes "Billing-Cycle Interpretation") — no calendar-month alignment, no cron job — is acceptable for MVP, or provide the intended real semantics instead.
- [ ] **KMS-not-yet-provisioned dependency accepted:** confirm that this story ships without a real AWS KMS key (Story 0.14 provisions `BYOK_KMS_KEY_ID`, still `backlog`), with `kms.ts` lazily initialized so local dev/tests are unaffected, and the full real round trip is deferred until 0.14 lands.

## Testing Requirements

- [ ] Unit tests (required, not deferred): `packages/domain/src/ai-gateway/*.test.ts` via `node:test`/`tsx --test`, 100% coverage (project Testing Rules — non-negotiable for `packages/domain`).
- [ ] Integration-style tests (required, mocked dependencies): `apps/backend/src/lib/ai-gateway/adapter.test.ts`, proving the orchestration branches (success, rate-limit-then-succeed, invalid-key-threshold, exhaustion) without real network calls.
- [ ] Integration tests (deferred): a real Vitest+MSW-backed integration test against a mocked Gemini HTTP endpoint, once Story 0.10 lands (currently `ready-for-dev`).
- [ ] E2E tests: Not applicable — no UI in this story.
- [ ] Manual verification (deferred, tracked): full real-AWS-KMS + real-Gemini round trip, once Story 0.14 provisions a real `BYOK_KMS_KEY_ID`.

## Deliverables Checklist

- [ ] `packages/domain` scaffolded with `src/ai-gateway/{select-api-key,usage-cycle,backoff}.ts`, 100%-covered by unit tests.
- [ ] `apps/backend/src/lib/ai-gateway/{kms,gemini-client,usage-store,adapter}.ts` implementing the sole `callGemini` Adapter interface, with passing mocked-dependency tests.
- [ ] `api_keys` table has `usage_count`/`usage_cycle_reset_at` columns via a committed, `drizzle-kit`-generated migration.
- [ ] Four new env vars documented in `.env.example`.
- [ ] `SETUP_WALKTHROUGH.md` §6 (AI Gateway / Google Gemini API) added.
- [ ] `pnpm build`/`pnpm lint` pass at the repo root.

## Out of Scope

- Any actual caller of `callGemini` — Story 3.6 ("Process posts from the queue and extract event information", `ready-for-dev`, `Depends on: Story 0.13`) and Story 4.2 ("AI-assisted event data correction", `backlog`).
- Provisioning the real AWS KMS key (`BYOK_KMS_KEY_ID`) — Story 0.14 ("Set up AWS IaC for Lambda, SQS, EventBridge, and KMS", `backlog`). This story's KMS integration is lazily initialized and unverified against a real key until 0.14 lands.
- The onboarding wizard UI and the `/settings/api-keys` "Add key" UI where a user actually types in their Gemini API key (which this Adapter's `kms.ts` later encrypts/decrypts) — **corrected 2026-08-07:** both now resolve to Story 3.1b ("Manage, add, and revoke API keys", `backlog`), which owns the `createApiKey` mutation and calls this story's `encryptApiKey`; Story 3.1's wizard step reuses that same mutation rather than building its own.
- Any UI displaying quota/queue status to users — Story 3.9 ("Implement API key quota management" UI-facing aspects) and the in-app queue status (FR23), both `backlog`.
- Email notifications triggered by an API key crossing the invalid-attempts threshold or by quota exhaustion (FR22/FR35) — Story 0.15 ("Set up outbound email adapter", `backlog`).
- AWS Lambda reserved-concurrency configuration for true cross-invocation throttling — Story 0.14's IaC scope (see Dev Notes).
- Any AWS Lambda deployment of `apps/backend` itself — Story 0.14. This story's backend code is local-dev-runnable/unit-testable only.
- Automated integration/E2E tests for the Adapter — blocked on Story 0.10 (`ready-for-dev`); tracked as a backfill note in Testing Requirements.

## Definition of Done

- [x] AC 1-8 satisfied.
- [x] `packages/domain` unit tests passing with 100% coverage (Task 2/Testing Requirements — non-negotiable).
- [x] `apps/backend` mocked-dependency orchestration tests passing (Task 3/Testing Requirements).
- [x] Migration committed and applies cleanly; `seed.ts` still succeeds.
- [x] `pnpm lint` and `pnpm build` passing for `packages/domain`, `apps/backend`, `packages/database`.
- [x] `SETUP_WALKTHROUGH.md` updated (Task 6).
- [x] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the `apps/backend`/`packages/domain` sequencing items, the billing-cycle assumption, and the KMS-not-yet-provisioned acceptance.

## Completion Status

- [x] review

## Dev Agent Record

### Agent Model Used
Claude 3.5 Sonnet

### Debug Log References

### Completion Notes List
- Scaffolded `packages/domain/src/ai-gateway` with pure modules (`select-api-key`, `usage-cycle`, `backoff`).
- Generated and fully tested DB-agnostic domain logic with 100% coverage using Node.js built-in testing (`node:test`).
- Added DB migration to track `usage_count` and `usage_cycle_reset_at` to the `api_keys` table.
- Scaffolded orchestrator adapter `apps/backend/src/lib/ai-gateway/adapter.ts` wrapping `@google/genai` and KMS (`@aws-sdk/client-kms`).
- Verified orchestration paths (rate limits fallback, invalid key skipping, exhaust detection) entirely via mock-dependency integration tests without real AWS/Gemini credentials.
- Updated `SETUP_WALKTHROUGH.md` and `.env.example`.
- All integration and unit tests pass successfully.
- Note: A full real-Gemini + real-KMS round trip is explicitly deferred pending Story 0.14 as agreed in Dev Notes.

### File List
- `_bmad-output/implementation-artifacts/0-13-set-up-ai-gateway-adapter-layer-for-gemini.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/backend/package.json`
- `apps/backend/src/env.ts`
- `apps/backend/src/lib/ai-gateway/adapter.test.ts`
- `apps/backend/src/lib/ai-gateway/adapter.ts`
- `apps/backend/src/lib/ai-gateway/gemini-client.ts`
- `apps/backend/src/lib/ai-gateway/kms.ts`
- `apps/backend/src/lib/ai-gateway/usage-store.ts`
- `packages/database/migrations/0014_dark_mach_iv.sql`
- `packages/database/schema.ts`
- `packages/domain/package.json`
- `packages/domain/src/ai-gateway/backoff.test.ts`
- `packages/domain/src/ai-gateway/backoff.ts`
- `packages/domain/src/ai-gateway/index.ts`
- `packages/domain/src/ai-gateway/select-api-key.test.ts`
- `packages/domain/src/ai-gateway/select-api-key.ts`
- `packages/domain/src/ai-gateway/types.ts`
- `packages/domain/src/ai-gateway/usage-cycle.test.ts`
- `packages/domain/src/ai-gateway/usage-cycle.ts`
- `packages/domain/src/index.ts`
- `SETUP_WALKTHROUGH.md`
- `.env.example`
