---
title: 'Cheap empty ticks for poll-and-drain (queue-depth gate)'
type: 'bugfix'
created: '2026-11-22'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** In prod, the scraper, AI processor and ingestor Lambdas run `pollAndDrainQueue` every 5 minutes (288/day each). Every receive long-polls for 20 s, so an empty tick, and the final empty receive after every drain, is billed for 20 s. Idle polling is about 15,100 GB-s/day, roughly 92% of the 400,000 GB-s/month Lambda free tier, which runs out around day 24 (same class as FIND-034).

**Approach:** Gate every receive on "is there work?". Short-poll first (`WaitTimeSeconds: 0`); if that is empty, ask `GetQueueAttributes` for `ApproximateNumberOfMessages`; only a depth above 0 earns the existing 20 s long poll. Short polling alone is not enough: it samples a subset of servers and can return empty while messages exist.

## Boundaries & Constraints

**Always:**
- The gate applies to every receive in the loop, so the final receive after a drain is cheap too.
- `pollAndDrainQueue`'s signature, options (`timeBudgetMs`, `perMessageBudgetMs`, `minRemainingMs`, `getRemainingTimeInMillis`) and behavior stay as they are. The long poll stays bounded by the same time budget and remaining-time guard.
- `setReceiveSqsMessages` and `setDeleteSqsMessage` keep working. The depth call is a new seam in the same style (`getQueueDepth` / `setGetQueueDepth`).
- A `GetQueueAttributes` error follows the existing receive-error path: `console.error`, return, next 5-minute tick retries. Never throw out of the handler.
- A long poll that comes back empty ends the cycle (no loop on a depth that stays above 0).
- An unreadable depth attribute fails open (treated as work, so it long-polls) so a message is never skipped.

**Ask First:** Any change to IAM, schedules, memory sizes or timeouts. (IAM was checked: `grantConsumeMessages` already grants `sqs:GetQueueAttributes` on all 3 queues and `festgrid-backend-stack.test.ts` asserts it, so none is planned.)

**Never:** Touch the dev/staging `SqsEventSource` path, cost alarms, or the three Lambda handlers' call sites. No deploy, no prod DB access. Do not rely on short polling alone.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty queue | short poll empty, depth 0 | return; no long poll; one receive + one depth call | N/A |
| Short poll misses | short poll empty, depth > 0 | long poll (20 s) runs; its messages handled; loop continues | long poll empty: return |
| Messages present | short poll non-empty | handled as today; no depth call | N/A |
| Depth fails | short poll empty, depth throws | log with `console.error`, return | does not reject |
| Drain finishes | batch handled, next short poll empty, depth 0 | return cheaply | N/A |
| Guard / budget | remaining-time or `perMessageBudgetMs` limits hit | same behavior as before the gate | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/aws/poll-and-drain-queue.ts` -- receive seam (`WaitTimeSeconds: 20` today), loop, error path.
- `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts` -- existing seam-based tests (node:test).
- `apps/backend/src/lambdas/{scraper,ai-processor,ingestor}.test.ts` -- mock receive with empty queues, so they would reach the real depth call; they need the new seam stubbed.
- `apps/infrastructure/lib/festgrid-backend-stack.ts` (~L749-761) and its test (~L703-740) -- consume grants, already include `sqs:GetQueueAttributes`.
- `docs/infrastructure/2-backend.md` -- Queuing System section.
- `_bmad-output/implementation-artifacts/backlog.yaml` -- new row `FIND-261122-q5w` (minted with `scripts/backlog-new-id.py`).

## Tasks & Acceptance

**Execution:**
- [ ] `apps/backend/src/lib/aws/poll-and-drain-queue.ts` -- add optional `waitTimeSeconds` (default 20) to `receiveSqsMessages`; add `getQueueDepth` + `setGetQueueDepth`; gate each loop receive (short, then depth, then long) with errors on either call caught on the existing path -- cuts the idle 20 s block
- [ ] `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts` -- stub depth (0) in existing suites; add gate tests for the I/O matrix rows; confirm guard and `perMessageBudgetMs` tests still pass unmodified in intent
- [ ] `apps/backend/src/lambdas/{scraper,ai-processor,ingestor}.test.ts` -- stub and restore `setGetQueueDepth` in each poll-and-drain suite's setup/teardown
- [ ] `docs/infrastructure/2-backend.md` -- 1-2 sentences on the gate and why
- [ ] `_bmad-output/implementation-artifacts/backlog.yaml` -- add `FIND-261122-q5w` (finding, `app:backend`, `app:infrastructure`; ref this spec)

**Acceptance Criteria:**
- Given an empty queue, when a tick runs, then it makes one `WaitTimeSeconds: 0` receive and one depth call and returns without any 20 s receive.
- Given a short poll that missed messages (depth > 0), when the tick runs, then the long poll runs and its messages are handled and deleted.
- Given the stack test, when synthesized, then each consumer Lambda still holds `sqs:GetQueueAttributes` on its queue (no IAM change).

## Design Notes

Idle cost is 1 short receive + 1 `GetQueueAttributes` per tick: about 1,730 SQS requests/day across the 3 queues, well inside the 1M/month SQS free tier. `ApproximateNumberOfMessages` is eventually consistent, so a just-sent message can wait one extra 5-minute tick. It counts visible messages only; delayed and in-flight ones are picked up on later ticks, as today.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/database build` -- expected: dist rebuilt
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/aws/poll-and-drain-queue.test.ts src/lambdas/{scraper,ai-processor,ingestor}.test.ts` -- expected: pass (two known unrelated local failures named if they appear)
- `cd apps/backend && npx tsc --noEmit` and `cd apps/infrastructure && npx tsc --noEmit` -- expected: clean
- `cd apps/infrastructure && pnpm run test` (stack test) -- expected: pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: no failure naming `FIND-261122-q5w`
