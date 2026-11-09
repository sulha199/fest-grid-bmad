---
title: 'One retry policy: classify the failure, decide the action, adopted by the Gemini path'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: 'd9f29394d36b21919d3ee4119a69dd06ef8bead0'
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
- [x] `packages/domain/src/retry/` -- situations, `decideRetry`, table tests for every row (100% coverage) -- AD-52 Rules 1-2.
- [x] Gemini classifier -- map `GeminiRateLimitedError`, `GeminiInvalidKeyError`, 5xx and connection codes, `finishReason`/`blockReason` and parse failure to situations -- the only vendor-specific code.
- [x] `guarded-call.ts` -- execute only `retry_now`, keep `isTransient` as a compatible adapter, return other actions as typed outcomes -- AD-52 Rule 3.
- [x] `adapter.ts`, `eval-retry-policy.ts` -- read the same table; log the decision line -- one policy.

**Acceptance Criteria:**
- Given each situation in the table, when `decideRetry` runs, then it returns the action and delay the table gives (hint overrides backoff, daily quota never retries within the run).
- Given a Gemini call that fails twice with 503 then succeeds, when `callVendor` runs, then it retries with growing jittered delays and returns the result, as today.
- Given a safety-blocked response, when the Gemini path runs, then no retry happens and the reason is returned.
- Given the existing test suites, when they run, then they pass unchanged apart from the eval policy's moved tests.

## Spec Change Log

## Design Notes

`callVendor` never returns a typed non-retry outcome (that would change the error classes every caller catches). It logs each decision as `[retry-decision]`, reports it through an optional `onDecision` callback, and rethrows the original error for anything but `retry_now`; the durable layer (slice 1c) is the consumer of `retry_later`. A wait decided in the catch is served after the lease is released. `timeout` stays unretried in-call (AD-32 AC5): the policy knows it for the durable layer.

Behavior changes to know: a rate limit on the last key is now waited out in-call (hint plus 1s) when at least `min(timeout, 15s)` of the overall budget remains; the wait before the next key is capped at 60s; a per-day quota skips a key with no backoff; the eval script backs off exponentially instead of linearly; hints that are NaN or negative are ignored.

## Suggested Review Order

**The policy**

- Closed situation set and the one decision table.
  [`decide-retry.ts:95`](../../packages/domain/src/retry/decide-retry.ts#L95)

- Domain tests over every row and the input guards.
  [`decide-retry.test.ts:1`](../../packages/domain/src/retry/decide-retry.test.ts#L1)

**The Gemini classifier**

- The only Gemini-specific code: errors and unusable responses to situations.
  [`gemini-situation.ts:51`](../../apps/backend/src/lib/ai-gateway/gemini-situation.ts#L51)

**Adoption**

- `callVendor` executes only `retry_now`, waits after the lease is released, logs and reports the rest.
  [`guarded-call.ts:265`](../../apps/backend/src/lib/vendor-gateway/guarded-call.ts#L265)

- The key loop: classifier, alternate-credential check, daily quota skip, bounded wait.
  [`adapter.ts:126`](../../apps/backend/src/lib/ai-gateway/adapter.ts#L126)

- The eval policy is now a thin reader of the same table.
  [`eval-retry-policy.ts:29`](../../apps/backend/src/lib/ai-gateway/eval-retry-policy.ts#L29)

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` and the ai-gateway, vendor-gateway and ai-processor suites -- expected: all pass
- `pnpm lint` and `pnpm build` -- expected: clean
