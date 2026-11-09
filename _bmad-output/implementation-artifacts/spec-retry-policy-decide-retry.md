---
title: 'One retry policy: classify the failure, decide the action, adopted by the Gemini path'
type: 'feature'
created: '2026-11-09'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retry rules live in four places that disagree: `callVendor` (a yes/no `isTransient`, fixed backoff), the Gemini key loop in `adapter.ts`, `sendSqsMessageWithRetry` (linear) and `eval-retry-policy.ts` (the only one that reads the "retry in 42s" hint and gives up on a daily quota, used only by the eval script). A cut-off response, a safety block and a bad request are treated like a network blip or not at all.

**Approach:** Per AD-52 Rules 1-3: a pure `decideRetry(situation, attempt, hint)` in `packages/domain/src/retry/` over a closed set of situations, with a Gemini classifier mapping errors and responses (AD-49 signals) to situations; `callVendor` runs only `retry_now` decisions inside its budget; the Gemini key loop and the eval policy read the same table. No migration, no other client changed.

## Boundaries & Constraints

**Always:** The table in AD-52 Rule 2 is the contract; backoff keeps the shape of `computeBackoffDelayMs` (exponential, jitter, cap) and a server hint overrides it; the per-attempt and overall timeouts, the per-key lease and the DPA gate of AD-32 are unchanged; existing public signatures stay compatible (`isTransient` still accepted, mapped onto situations); a decision is logged as `[retry-decision] subject=... situation=... action=... attempt=... delayMs=...`.

**Ask First:** Changing the starting values (5 attempts, 24 hours, one-day quota cap) or the table; adopting any client other than Gemini.

**Never:** A DB migration, the durable ledger or status (slice 1c), a split loop (cursor slices), Apify, Bright Data, SQS or internal API changes, prod writes.

## I/O & Edge-Case Matrix

| Scenario | Input | Decision | Error Handling |
|----------|-------|----------|----------------|
| 429 with "retry in 42s" | `rate_limited`, hint 42s | delay 43s; `switch_credential` if another key exists; `retry_now` only if it fits the budget, else `retry_later` | N/A |
| 429 per-day quota | `quota_exhausted_daily` | `retry_later` at the next reset, capped one day | N/A |
| 503, reset | `unavailable`, attempts 1-3 | jittered backoff 1s, 2s, 4s, capped | N/A |
| Cut off | `truncated` | `split_window`, never the same request | N/A |
| Safety block, bad request | `blocked`, `bad_request` | `give_up` now | reason returned |
| Invalid key | `invalid_credential` | `switch_credential`; none left: `give_up` | N/A |
| Budget too small | delay would exceed the overall budget | `retry_later`, no sleep | typed outcome |

</frozen-after-approval>

## Code Map

- `packages/domain/src/retry/` (new) -- situations, `decideRetry`, backoff; `packages/domain/src/ai-gateway/backoff.ts` -- existing `computeBackoffDelayMs` to reuse.
- `apps/backend/src/lib/vendor-gateway/guarded-call.ts` -- `isTransient`, the retry loop and `MIN_RETRY_ATTEMPT_MS`.
- `apps/backend/src/lib/ai-gateway/gemini-client.ts`, `adapter.ts` -- error classes, key loop; a new classifier next to them.
- `apps/backend/src/lib/ai-gateway/eval-retry-policy.ts` -- folds into the table.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/domain/src/retry/` -- situations, `decideRetry`, table tests for every row (100% coverage) -- AD-52 Rules 1-2.
- [ ] Gemini classifier -- map `GeminiRateLimitedError`, `GeminiInvalidKeyError`, 5xx and connection codes, `finishReason`/`blockReason` and parse failure to situations -- the only vendor-specific code.
- [ ] `guarded-call.ts` -- execute only `retry_now`, keep `isTransient` as a compatible adapter, return other actions as typed outcomes -- AD-52 Rule 3.
- [ ] `adapter.ts`, `eval-retry-policy.ts` -- read the same table; log the decision line -- one policy.

**Acceptance Criteria:**
- Given each situation in the table, when `decideRetry` runs, then it returns the action and delay the table gives (hint overrides backoff, daily quota never retries within the run).
- Given a Gemini call that fails twice with 503 then succeeds, when `callVendor` runs, then it retries with growing jittered delays and returns the result, as today.
- Given a safety-blocked response, when the Gemini path runs, then no retry happens and the reason is returned.
- Given the existing test suites, when they run, then they pass unchanged apart from the eval policy's moved tests.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` and the ai-gateway, vendor-gateway and ai-processor suites -- expected: all pass
- `pnpm lint` and `pnpm build` -- expected: clean
