---
baseline_commit: 6f0256417732c9cb585b9df8177e46e43783ad21
---

# Story 3.9: Implement API key quota management

## Story Details

- **Epic:** 3
- **Story ID:** 3.9
- **Status:** ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** user who has subscribed to a popular account,
**I want** the system to fairly use the API keys from all subscribers,
**So that** event extraction is reliable and not dependent on a single user's quota.

## Acceptance Criteria

1. **Given** there are multiple users subscribed to the same social media account, **when** the system needs to process a post from that account, **then** it uses the AI Gateway Adapter's (Story 0.13) Tier 1/Tier 2 quota-management algorithm to select which user's API key to use — this story does not reimplement key-selection or usage-tracking logic, which already lives in Story 0.13. [epics.md AC1]
2. **And** end-to-end/integration tests confirm the observable behavior across ≥2 real subscribers: when Subscriber A's key is exhausted/invalid, extraction continues using Subscriber B's key, and per-key usage counters visibly reset at the start of a new billing cycle. [epics.md AC2]
3. **And** the new Tier 2 (multi-subscriber) tests exercise the real subscriber-derivation path (`getActiveSubscriberUserIds`, Story 3.6) feeding into the real AI Gateway Adapter (`callGemini`, Story 0.13) against a real local Postgres database — not a fully mocked selection/usage layer — so the test proves the two already-built pieces are correctly wired together, not just that each works in isolation (both already have their own passing unit/integration tests from Stories 0.13 and 3.6).
4. **And** the billing-cycle-reset behavior is proven through the real `usage-store.ts` DB round trip (a key seeded with an elapsed `usageCycleResetAt`), not only through `packages/domain`'s existing pure `usage-cycle.ts` unit tests — those prove the pure date-math is correct in isolation; this story proves the persisted row is actually read/written correctly when a real cycle boundary has passed.

**Note:** AC corrected by Gate 1 (`story-split-gate.md`), surfaced by the Epic 3 readiness sweep (`bmad-epic-readiness-check`) — FR24's quota algorithm is already fully implemented by Story 0.13's AC. This story is narrowed from "implement the algorithm" to "verify its observable multi-subscriber behavior end-to-end," avoiding two stories independently owning the same logic. [epics.md Note]

**Note (2026-08-11, added via `bmad-create-story` during this story's own creation):** Story 0.13's own `Out of Scope` section anticipated "Story 3.9 (UI-facing aspects)" would build an in-app quota/queue-status display, tied to PRD FR23. Investigation during this story's creation found FR23 is mapped to Epic 3 in the PRD's FR-to-epic table but implemented by no story anywhere — Story 3.9's AC was narrowed away from any UI by the Epic 3 readiness sweep's Gate 1 correction (above), orphaning FR23. Surfaced via Gate 2 (fresh Freya-persona pass, since this story's own scope has no UI) and confirmed with the user via `AskUserQuestion`: split into a new prerequisite story, **Story 3.9a: Display in-app queue status and API key health** (see epics.md and `## Out of Scope` below), rather than re-absorb the UI into this story or leave FR23 permanently unowned.

**Depends on:** Story 0.13, Story 3.6 (for the real `getActiveSubscriberUserIds` subscriber-derivation seam this story's tests drive — see AC3).

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2, AC3) — Real-DB Tier 2 multi-subscriber round-robin/fallback tests in `apps/backend/src/lib/ai-gateway/adapter.test.ts`:** Extend the existing suite (which today only ever calls `callGemini` with a single-user `subscriberUserIds` array, i.e. Tier 1) with a new `t.test(...)` block seeding **two distinct real `users` rows**, each with their **own real `apiKeys` row** (`provider: 'gemini'`, distinct `keyEncrypted` values), and calling `callGemini({ subscriberUserIds: [userA.id, userB.id], ... })` (Tier 2, since `subscriberUserIds.length > 1`) via `setDecryptApiKey`/`setCallGeminiGenerateContent` (existing DI seams — no new mocking mechanism needed):
  - [ ] Sub-case: Subscriber A's key returns `GeminiInvalidKeyError` (mocked in `setCallGeminiGenerateContent`, keyed off which plaintext key is passed) → assert the call still succeeds using Subscriber B's key, assert A's `apiKeys.invalidAttempts` incremented in the DB, and assert B's `apiKeys.usageCount` incremented in the DB (AC2's "exhausted/invalid ... continues using Subscriber B's key").
  - [ ] Sub-case: Subscriber A's key returns `GeminiRateLimitedError` (`retryAfterSeconds` near-zero, matching the existing rate-limit sub-case's `0.01` pattern to keep the test fast) → assert fallback to B succeeds the same way, without touching A's `invalidAttempts`/`isValid` (rate-limiting is transient, per Story 0.13's Dev Notes "Invalid-key vs. rate-limited distinction").
  - [ ] Sub-case (Tier 2 fairness ordering): both A and B have valid keys with different `usageCount` seed values (e.g. A=8, B=2) and both succeed on first try → assert the **lower-`usageCount` key (B)** is the one actually invoked first (per `selectApiKey`'s existing Tier 2 "sorted by `usageCount` ascending" fairness rule, already unit-tested in `packages/domain` but never exercised here against two real, distinct-user DB rows).
  - [ ] `t.after` cleanup deletes both new `apiKeys` rows and both new `users` rows (mirrors the existing suite's cleanup pattern).
- [ ] **Task 2 (AC2, AC4) — Real-DB billing-cycle-reset test, same file:** Add a `t.test(...)` case that seeds a key with `usageCycleResetAt` set far enough in the past to have elapsed under the default 30-day cycle (`API_KEY_USAGE_CYCLE_DAYS`, `apps/backend/src/env.ts`) and a non-zero `usageCount` (e.g. `usageCount: 40`), calls `callGemini` (Tier 1, single subscriber, success path — reuses the existing mocked success seam) and asserts the **persisted row** now has `usageCount === 1` (reset, not incremented from 40) and `usageCycleResetAt` bumped forward to a new future date — proving `usage-store.ts`'s `recordSuccessfulUsage` reset branch (`isCycleElapsed` → `nextCycleReset`) round-trips correctly through the real DB, not just `packages/domain`'s pure-function unit tests.
- [ ] **Task 3 (AC1, AC3) — Real-subscriber-derivation-to-adapter integration test, new file `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts`:** Seed a real `socialMediaAccountProfiles` row, two real `subscriptions` rows (one per subscriber user from Task 1's pattern, both `isNewlyAdded: true`, no `deletedAt`) linking both users to that account, and each user's own real `apiKeys` row. Call `getActiveSubscriberUserIds(profile.id)` (Story 3.6's real function, not mocked) to derive `subscriberUserIds`, then call `callGemini` directly with that real, derived array (Story 0.13's real adapter, not mocked) — **not** through `processAiJob`'s `setCallGeminiSeam` (which every existing `process-ai-job.test.ts` case uses to mock `callGemini` away entirely, and which already separately proves — in `process-ai-job.test.ts`'s Case A — that `processAiJob` correctly derives and forwards `subscriberUserIds` to whatever `callGemini` seam is installed). Mock only `setCallGeminiGenerateContent` to simulate Subscriber A's key failing and Subscriber B's succeeding, then assert the result succeeds and the correct DB-level usage/invalid-attempt changes land on the correct user's key. This is the story's most literal reading of epics.md's "Given multiple users subscribed to the same account, When the system needs to process a post from that account" framing, without re-testing `processAiJob`'s own AJV/transform/SQS-enqueue logic (already covered by Story 3.6's own test suite) or re-testing `callGemini`'s Tier 2 mechanics a second time (Task 1 already covers those in isolation) — this test's unique value is proving the **real subscriber lookup → real adapter** hand-off specifically.
  - [ ] `t.after` cleanup deletes the new `subscriptions`, `socialMediaAccountProfiles`, `apiKeys`, and `users` rows.
- [ ] **Task 4 — Verification (AC1-AC4):**
  - [ ] `pnpm --filter backend test` (or the wired `tsx --test src/**/*.test.ts` script) — all new and existing `apps/backend` suites pass, including the untouched pre-existing Tier 1 cases in `adapter.test.ts` and all of `process-ai-job.test.ts`.
  - [ ] Confirm the new tests actually fail if `selectApiKey`'s Tier 2 branch or `usage-store.ts`'s reset branch is deliberately broken (a quick local sanity check before finalizing — not a committed step, just a correctness gate on the test-writing itself).
  - [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
  - [ ] Record in Completion Notes that this story adds no new product code — `packages/domain`, `apps/backend/src/lib/ai-gateway/*`, and `apps/backend/src/lib/ai-processor/*` source files are unmodified; only test files are added/extended.

## Dev Notes

- **This story adds zero new product/business logic.** Every function under test (`selectApiKey`, `isCycleElapsed`/`nextCycleReset`, `callGemini`, `usage-store.ts`, `getActiveSubscriberUserIds`) already exists and already ships in Stories 0.13 and 3.6 (both `review` status — implemented, not yet marked `done`). This story's entire deliverable is new/extended test files proving the **observable, cross-story behavior** epics.md's AC requires, which no existing test currently covers (see "Why This Story Is Needed" below).
- **Why this story is needed — the exact gap, confirmed by reading every existing test file that touches this code:**
  - `packages/domain/src/ai-gateway/select-api-key.test.ts` (Story 0.13): pure unit tests of `selectApiKey` prove Tier 2 fairness ordering against **plain in-memory `ApiKeyCandidate[]` objects** — no DB, no real users.
  - `apps/backend/src/lib/ai-gateway/adapter.test.ts` (Story 0.13): already a real-DB test (inserts real `users`/`apiKeys` rows, only mocks the KMS-decrypt and Gemini-SDK-call boundaries) — but **every existing case calls `callGemini` with `subscriberUserIds: [testUser.id]`** (a single user, i.e. always Tier 1, even in the "key1 fails, key2 succeeds" case — both keys belong to the *same* user). It never seeds two distinct users, so Tier 2's real round-robin-across-different-owners path, and its `usageCount`-ascending-across-owners fairness rule, has never been exercised against real DB rows. It also never seeds an elapsed `usageCycleResetAt` — the reset branch is untested at the DB level.
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (Story 3.6): proves `processAiJob` correctly **derives and forwards** `subscriberUserIds` to `callGemini` (Case A asserts `req.subscriberUserIds` equals the real subscriber's id) — but every case uses `setCallGeminiSeam` to replace `callGemini` with a stub, so **the real Story 0.13 adapter never actually runs** in any of these tests.
  - Net result: real subscriber-derivation and the real Tier 1/2 selection algorithm have each been proven correct **in isolation**, but never proven correct **together**, and Tier 2's real-DB multi-owner path plus the real-DB cycle-reset path have never been exercised at all. That is precisely this story's scope (Tasks 1-3).
- **Test architecture decision — direct `callGemini` (+ real `getActiveSubscriberUserIds`) rather than full `processAiJob`:** epics.md's AC language ("When the system needs to process a post from that account") could be read as requiring a full pipeline test through `processAiJob`. This story deliberately tests at the `getActiveSubscriberUserIds` → `callGemini` boundary instead (Task 3), because `processAiJob`'s own AJV-validation/transform/SQS-enqueue behavior is already fully covered by Story 3.6's test suite, and re-driving all of that through `processAiJob` here would only add incidental setup noise (geolocation/timezone/SQS seam stubbing) unrelated to what this story is actually verifying — the quota/key-selection behavior. Testing at the real boundary between the two pieces this story cares about (subscriber derivation and key selection) gives the same proof of correct wiring with less unrelated surface area.
- **Testing framework — `node:test`/`tsx --test`, not Vitest/MSW:** `apps/backend` has never adopted Vitest, even for stories that call external HTTP-backed adapters (e.g. Story 0.16's `geoapify-client.test.ts` uses `node:test` + `node:test`'s `mock`). Story 0.10 ("Set up testing frameworks foundation") wired Vitest+MSW into `apps/web`, `packages/database`, and `packages/analytics` only — `apps/backend` was explicitly not one of the three packages in its Task 5. All 14+ existing `apps/backend` test files, including every AI Gateway/AI Processor/Geolocation test, consistently use `node:test` plus constructor/module-level dependency-injection setter functions (`setCallGeminiGenerateContent`, `setDecryptApiKey`, `setCallGeminiSeam`, etc.) to swap out the true external-I/O boundary while keeping everything else — including real DB reads/writes — genuinely real. This story follows that same established, consistent pattern rather than introducing Vitest/MSW into `apps/backend` for the first time, which would be an unrelated, cross-cutting testing-infrastructure change out of proportion to this story's actual scope (verifying already-built quota logic). If `apps/backend` is ever migrated to Vitest, that is its own foundational (Gate 3) decision for a future story, not something this story should decide as a side effect.
- **No product code changes.** `packages/domain/src/ai-gateway/*`, `apps/backend/src/lib/ai-gateway/*`, and `apps/backend/src/lib/ai-processor/process-ai-job.ts` are all read-only inputs to this story — confirmed via the File Change Plan below.
- **No PostHog/analytics events (AD-5)** — no new user-facing interaction.
- **No i18n strings (AD-6)** — no new user-facing text; this story ships no UI.
- **No state-management categorization applies** — backend test-only story.
- **No async loader (blocking/non-blocking) categorization applies** — no UI renders anything in this story.
- **No Unified Query DSL (AD-1/AD-2) involvement** — no new event-collection retrieval.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Cited from swept `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md` (`swept: true`, `stories_covered` explicitly includes `3.9`; verdict: "Epic 3 is highly mature and ready for continued story execution"). No Gate 1/3 gap applies — this story adds tests only, introduces no new external service, data entity, or infra dependency, and the AI Gateway Adapter/three-queue architecture it exercises (`packages/domain`'s pure selection logic + `apps/backend`'s KMS/Gemini-SDK orchestration, per `project-context.md`'s Adapter Pattern rule) is already fully built and swept.
  - **Lightweight escape-hatch guard:** re-checked this story's specific scope (writing multi-subscriber/cycle-reset tests against already-built code) against anything the epic-wide sweep couldn't have anticipated at planned-AC granularity. Nothing new surfaced on the Gate 1/3 axis — no new service, table, or cross-cutting tooling need. (The one real gap this story's creation *did* surface — FR23's orphaned in-app queue-status UI — is a Gate 2, not Gate 1/3, finding; see below and `## Out of Scope`.)
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona pass (required per-story even when the epic sweep is used, since UI scope is story-specific). The subagent grepped both authoritative UX artifact pairs (`design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`) for "quota", "rate limit", "throttl", "usage count", "billing cycle", "round-robin", "key selection", "queue status" — **zero hits across all eight terms in all four files**, confirming this story (backend tests only) has no UI surface. **Verdict: No gap for Story 3.9 itself.**
  - **Related finding, not a Story 3.9 gap but surfaced during the same pass:** the subagent additionally found non-authoritative draft UX content at `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.6-quota-management-display.md`, `04.7-email-notification-quota.md`, and `04.8-in-app-queue-status.md` describing a quota/queue-status UI that was never promoted into the authoritative specs and that no story currently owns. Cross-referencing this against Story 0.13's own `Out of Scope` (which named "Story 3.9 (UI-facing aspects)" as this UI's anticipated owner) and the PRD's FR-to-epic table (FR23 → Epic 3, no implementing story) confirmed a genuine orphaned requirement. **Resolved via `AskUserQuestion` with the user: split into new prerequisite Story 3.9a** (`3-9a-display-in-app-queue-status-and-api-key-health`, see epics.md and `## Out of Scope` below) rather than absorb it into this story (which would reopen the Epic 3 readiness sweep's own deliberate narrowing of 3.9 to backend-only) or leave it unowned (the exact failure mode `story-split-gate.md` exists to prevent).

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story adds test files only; it reads and writes exclusively through already-existing, already-migrated columns (`api_keys.usage_count`, `api_keys.usage_cycle_reset_at`, `api_keys.is_valid`, `api_keys.invalid_attempts` — all added by Story 0.13's migration; `subscriptions`/`social_media_account_profiles`/`users` — all pre-existing from Stories 1.1/3.1a).
- Impacted fields/contracts: None (no schema, GraphQL, or TypeScript-interface changes).
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: Not applicable — test-only addition, no runtime behavior change to any deployed Lambda or resolver.
- Verification checks: The new tests themselves (Tasks 1-3) are the verification mechanism — they read back persisted `usageCount`/`usageCycleResetAt`/`invalidAttempts`/`isValid` values via direct `db.select()` calls against the real local Postgres instance to confirm the already-migrated columns behave as documented.

### Project Structure Notes

- **Modified:** `apps/backend/src/lib/ai-gateway/adapter.test.ts` (new Tier 2 multi-user and cycle-reset `t.test()` cases appended to the existing suite — Tasks 1-2).
- **New:** `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts` (Task 3).
- **Not modified:** every product source file this story exercises — `packages/domain/src/ai-gateway/*.ts`, `apps/backend/src/lib/ai-gateway/{adapter,usage-store,gemini-client,kms}.ts`, `apps/backend/src/lib/ai-processor/process-ai-job.ts`, `apps/backend/src/lib/subscriptions/get-active-subscriber-user-ids.ts`, `packages/database/schema.ts`, any `.graphql` schema, `apps/web` (zero UI).
- Detected conflicts or variances: None — this story's scope is additive test coverage against stable, already-shipped interfaces.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.9, #Story-3.9a] — this story's authoritative AC/Note, and the new 3.9a prerequisite story this story's own creation split off.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report covering `3.9`; verdict "highly mature."
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, numbering rule (applied to the new 3.9a split).
- [Source: _bmad-output/implementation-artifacts/0-13-set-up-ai-gateway-adapter-layer-for-gemini.md] — the AI Gateway Adapter this story tests; its Dev Notes ("Billing-Cycle Interpretation", "Invalid-key vs. rate-limited distinction") and its `Out of Scope` (source of the FR23/Story 3.9 UI-aspects note resolved above); its `File List` for the exact product files this story must not modify.
- [Source: _bmad-output/implementation-artifacts/3-6-process-posts-from-the-queue-and-extract-event-information.md] — `getActiveSubscriberUserIds`'s real caller/context and `process-ai-job.test.ts`'s existing seam-mocking pattern this story extends without duplicating.
- [Source: apps/backend/src/lib/ai-gateway/adapter.ts, usage-store.ts, gemini-client.ts, kms.ts] — exact function signatures (`callGemini`, `fetchCandidateKeys`, `recordSuccessfulUsage`, `recordInvalidAttempt`, `setDecryptApiKey`, `setCallGeminiGenerateContent`) this story's new tests call directly.
- [Source: apps/backend/src/lib/ai-gateway/adapter.test.ts] — existing Tier 1 test pattern (real DB + DI-seam mocking) this story's Task 1/2 extend.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts, process-ai-job.test.ts] — `setCallGeminiSeam`'s existing mock-the-whole-adapter-away pattern, and why Task 3 deliberately does not use it (see Dev Notes "Test architecture decision").
- [Source: apps/backend/src/lib/subscriptions/get-active-subscriber-user-ids.ts, .test.ts] — real-subscriber-lookup function and its own existing real-DB test fixture pattern, reused by Task 3.
- [Source: apps/backend/src/env.ts] — `apiKeyUsageCycleDays` (default 30, `API_KEY_USAGE_CYCLE_DAYS`) and `apiKeyInvalidAttemptsThreshold` (default 5) defaults used to construct realistic elapsed-cycle/threshold test fixtures.
- [Source: _bmad-output/implementation-artifacts/0-10-set-up-testing-frameworks-foundation.md] — confirms `apps/backend` was not one of the three packages (`apps/web`, `packages/database`, `packages/analytics`) wired to Vitest/MSW, informing the "stay on `node:test`" decision above.
- [Source: design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.6-quota-management-display.md, 04.8-in-app-queue-status.md] — draft UX content backing the new Story 3.9a's AC.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md] — FR23 ("dedicated section within the user menu will display the real-time queue status of posts pending extraction") and FR24 (quota algorithm) definitions; §3.4/§3.8 quota-management context.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Testing Rules ("testing trophy" approach for `apps/*`; `packages/domain` 100%-coverage rule does not apply here since this story adds no `packages/domain` code), Security (credential handling — this story's tests never log/persist decrypted key material, matching the existing `adapter.test.ts` pattern).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no dedicated AD exists for the AI Gateway/quota algorithm (confirmed by Story 0.13, re-confirmed here); governed by `project-context.md` and PRD §3.4/§3.8.
- [ ] `docs/infrastructure/2-backend.md`, `docs/infrastructure/high-level-overview.md` — confirms the AI Processor Lambda's role as the adapter's real caller, unchanged by this story.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified: `apps/backend/src/lib/ai-gateway/adapter.test.ts` (new Tier 2 multi-user round-robin/fallback/fairness cases + billing-cycle-reset case — Tasks 1-2).
  - New: `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts` (real subscriber-derivation-to-adapter integration test — Task 3).
  - Not modified: any file under `packages/domain`, `apps/backend/src/lib/ai-gateway/{adapter,usage-store,gemini-client,kms}.ts`, `apps/backend/src/lib/ai-processor/process-ai-job.ts`, `apps/backend/src/lib/subscriptions/get-active-subscriber-user-ids.ts`, `packages/database/schema.ts`, any `.graphql` schema, `apps/web`, `apps/infrastructure`, `.env.example`, `SETUP_WALKTHROUGH.md`.
- **Rule Mapping:**
  - "This story does not reimplement key-selection or usage-tracking logic" (epics.md AC1) → File Change Plan above shows zero product-code changes.
  - Testing trophy / integration-test emphasis (`project-context.md` Testing Rules) → Tasks 1-3, all real-DB integration tests exercising observable behavior, not new unit tests of pure functions (those already exist and are unmodified).
  - Adapter Pattern (`project-context.md`) → this story proves, rather than changes, that all Gemini calls still route exclusively through `callGemini`.
  - Gate 1/2/3 → Architecture & UX Gate Findings above; Gate 2's FR23 finding → new Story 3.9a (epics.md, sprint-status.yaml).
- **Verification Plan:**
  - Task 1's three Tier 2 sub-cases (invalid-key fallback, rate-limit fallback, fairness ordering) each assert both the returned `result.text` and the resulting DB row state (`usageCount`/`invalidAttempts`/`isValid`) for both subscriber's keys.
  - Task 2's cycle-reset case asserts the persisted `usageCount`/`usageCycleResetAt` after a simulated elapsed cycle.
  - Task 3 asserts `getActiveSubscriberUserIds`'s real output feeds correctly into `callGemini`'s real Tier 2 selection and produces the correct per-key DB state.
  - `pnpm --filter backend test`, `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions (Task 4).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: add real-DB integration tests proving Story 0.13's Tier 1/Tier 2 quota algorithm and Story 3.6's subscriber-derivation logic behave correctly together across ≥2 real subscribers, and that per-key usage counters reset at a billing-cycle boundary — zero product code changes.
- [ ] Architecture and boundary confirmation: tests stay within `apps/backend`'s existing `node:test` + DI-seam pattern (`setDecryptApiKey`, `setCallGeminiGenerateContent`); no Vitest/MSW introduced into `apps/backend` (see Dev Notes "Testing framework" decision).
- [ ] Testing plan confirmation: Task 1 (Tier 2 fallback + fairness, `adapter.test.ts`), Task 2 (cycle-reset, `adapter.test.ts`), Task 3 (real subscriber-derivation → real adapter, new file) as specified above.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 cited from swept `epic-3-readiness.md` (no gap, `3.9` explicitly covered); Gate 2 run fresh via Freya persona (no gap for this story's own scope) — the FR23 UI gap it surfaced is split off to new **Story 3.9a**, added to `epics.md` and `sprint-status.yaml` as `backlog`, and explicitly accepted by the user (via `AskUserQuestion`) as deferred rather than blocking this story.
- [ ] **Test-architecture decision accepted:** confirm testing at the `getActiveSubscriberUserIds` → `callGemini` boundary (Task 3) — rather than a full `processAiJob` pipeline test — is sufficient to satisfy AC1/AC2's "process a post from that account" framing, given `processAiJob`'s own AJV/transform/SQS logic is already covered by Story 3.6's suite (see Dev Notes rationale).
- [ ] **Story 3.9a acceptance:** confirm the in-app queue-status UI (FR23) remaining unbuilt until Story 3.9a is separately picked up is acceptable, and is not silently expected to ship alongside this story.

## Testing Requirements

- [ ] Integration tests (required, real local Postgres DB — no mocks below the KMS-decrypt/Gemini-SDK-call boundary): `apps/backend/src/lib/ai-gateway/adapter.test.ts`'s new Tier 2 multi-user cases (Task 1) and cycle-reset case (Task 2); `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts` (Task 3).
- [ ] Unit tests: None new — this story adds no `packages/domain` code (the 100%-coverage rule does not apply; `select-api-key.test.ts`/`usage-cycle.test.ts` already cover the pure logic in isolation and are unmodified).
- [ ] E2E tests: Not applicable — no UI in this story.
- [ ] Manual verification: Not applicable — no external Gemini/KMS credentials needed (all boundaries mocked via existing DI seams, matching Story 0.13's own established pattern).

## Deliverables Checklist

- [ ] `apps/backend/src/lib/ai-gateway/adapter.test.ts` extended with real-DB Tier 2 (two distinct subscriber users) round-robin-on-invalid-key, round-robin-on-rate-limit, and fairness-ordering cases, all passing.
- [ ] `apps/backend/src/lib/ai-gateway/adapter.test.ts` extended with a real-DB billing-cycle-reset case, passing.
- [ ] New `apps/backend/src/lib/ai-processor/process-ai-job.multi-subscriber-quota.test.ts` proving real `getActiveSubscriberUserIds` → real `callGemini` Tier 2 fallback, passing.
- [ ] `pnpm build`/`pnpm lint`/`pnpm test` clean at the repo root.
- [ ] New Story 3.9a (`3-9a-display-in-app-queue-status-and-api-key-health`) present in `epics.md` and `sprint-status.yaml` as `backlog`.

## Out of Scope

- **In-app queue-status / API key health UI (FR23)** — split into new prerequisite **Story 3.9a: Display in-app queue status and API key health** (`3-9a-display-in-app-queue-status-and-api-key-health`, `backlog`), per this story's own Gate 2 finding above. See `epics.md` Story 3.9a.
- Any change to the AI Gateway Adapter's selection/backoff/cycle algorithm itself, or to `usage-store.ts`'s persistence logic — both are Story 0.13's exclusive scope; this story only tests them.
- Any change to `getActiveSubscriberUserIds` or `processAiJob`'s AJV/transform/SQS-enqueue logic — Story 3.6's exclusive scope, already covered by its own test suite.
- A full real-Gemini + real-KMS round trip — still deferred pending Story 0.14's real `BYOK_KMS_KEY_ID` provisioning, exactly as Story 0.13 originally deferred it; this story's tests use the same DI-seam mocking, not live credentials.
- Migrating `apps/backend` onto Vitest/MSW — a separate, cross-cutting testing-infrastructure decision (see Dev Notes), not this story's scope.
- Story 3.10's email-notification-on-quota-exhaustion behavior (FR35) and the manual-post-selection quota progress bar (draft `04.6-quota-management-display.md`, Epic 5 territory) — both unrelated, separately-scoped concerns.

## Definition of Done

- [ ] AC 1-4 satisfied.
- [ ] All new/extended tests in `adapter.test.ts` and the new `process-ai-job.multi-subscriber-quota.test.ts` passing.
- [ ] No regressions in any existing `apps/backend` test suite.
- [ ] `pnpm lint` and `pnpm build` passing for `apps/backend`.
- [ ] Story 3.9a present in `epics.md` and `sprint-status.yaml`.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins, including the test-architecture decision and the Story 3.9a deferral.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
