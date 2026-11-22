---
title: 'Cheap empty ticks for poll-and-drain (queue-depth gate)'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_commit: '252f4c96ee9a1fea2701cc59c67061369d4e3d6e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** In prod, the scraper, AI processor and ingestor Lambdas run `pollAndDrainQueue` every 5 minutes (288/day each). Every receive long-polls 20 s, so an empty tick, and the final empty receive after every drain, is billed for 20 s. Idle polling is about 15,100 GB-s/day, about 92% of the ~16,500 GB-s/day the account uses, so the 400,000 GB-s/month Lambda free tier runs out around day 24 (same class as FIND-034).

**Approach:** Gate every receive on "is there work?". Short-poll first (`WaitTimeSeconds: 0`); if that is empty, one `GetQueueAttributes` call reads `ApproximateNumberOfMessages`, `ApproximateNumberOfMessagesDelayed` and `ApproximateNumberOfMessagesNotVisible`; only a total above 0 earns the existing 20 s long poll. Short polling alone can return empty while messages exist.

## Boundaries & Constraints

**Always:**
- The gate applies to every receive in the loop, so the final receive after a drain is cheap too.
- `pollAndDrainQueue`'s signature, options (`timeBudgetMs`, `perMessageBudgetMs`, `minRemainingMs`, `getRemainingTimeInMillis`) and behavior stay as they are. `maxMessages` is computed once per iteration and passed to both polls. The guard is rechecked after the depth call, before the long poll.
- `setReceiveSqsMessages` and `setDeleteSqsMessage` keep working. The depth call is a new seam in the same style (`getQueueDepth` / `setGetQueueDepth`) and returns one number: the sum of the three counts.
- Delayed and not-visible messages count as work: AD-47 steps are enqueued with a 10 s delay (shorter than the long poll, so the chain continues in-tick), and a failed message is invisible until its 300 s visibility timeout ends.
- A long poll that comes back empty ends the cycle. A long-poll error takes the existing receive-error path.
- Fail open: the gate returns only when depth `=== 0`. A missing or unparsable attribute counts as work (`NaN` must long-poll).
- A depth error is logged with a distinct `console.error` message and falls back to the long poll; it never throws out of the handler and never stops consumption.
- One log line when a short poll was empty, naming the outcome: `gated-empty`, `long-poll-hit`, `long-poll-miss` or `depth-failed`.

**Ask First:** Any change to IAM, schedules, memory sizes or timeouts. (IAM was checked: `grantConsumeMessages` already grants `sqs:GetQueueAttributes` on all 3 queues, asserted in `festgrid-backend-stack.test.ts`, so none is planned.)

**Never:** Touch the dev/staging `SqsEventSource` path, cost alarms, or add logic to the three Lambda handlers' call sites. No deploy, no prod DB access. Do not rely on short polling alone.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty queue | short poll empty, depth 0 | return; no long poll; 1 receive + 1 depth call | N/A |
| Short poll misses | short poll empty, depth > 0 | long poll (20 s) runs; messages handled; loop continues | long poll empty: return |
| Delayed or in-flight only | short poll empty, visible 0, delayed or not-visible > 0 | long poll runs | N/A |
| Messages present | short poll non-empty | handled as today; no depth call | N/A |
| Depth fails | short poll empty, depth throws | log distinct error, then long poll | does not reject |
| Depth unreadable | depth `NaN` | long poll | N/A |
| Drain finishes | batch handled, next short poll empty, depth 0 | return cheaply, 1 depth call | N/A |
| Guard / budget | remaining-time or `perMessageBudgetMs` limit hit | same behavior as before the gate | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/aws/poll-and-drain-queue.ts` -- receive seam (`WaitTimeSeconds: 20`), loop, error path.
- `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts` -- 3 suites, each with its own `afterEach` restore.
- `apps/backend/src/lambdas/{scraper,ai-processor,ingestor}.test.ts` -- mock empty receives, so they would reach the real depth call.
- `apps/backend/src/lambdas/ai-processor.ts` (L80-82) -- comment says resumed posts are "picked up in this same tick"; becomes stale.
- `apps/infrastructure/lib/festgrid-backend-stack.ts` (~L749-761) and its test (~L703-740) -- consume grants, already include `sqs:GetQueueAttributes`.
- `docs/infrastructure/2-backend.md` -- Queuing System section.
- Story 0.40 AC9 (`0-40-...md`) says `WaitTimeSeconds: 20`; superseded by this change, pointed to from the docs sentence (the story file is not edited).
- `_bmad-output/implementation-artifacts/backlog.yaml` -- new row `FIND-261122-q5w` (empty poll-and-drain ticks block 20 s of billed Lambda time).

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/lib/aws/poll-and-drain-queue.ts` -- `receiveSqsMessages` gets optional `waitTimeSeconds` (default 20, clamped to an integer 0-20; call stays `receiveSqsMessages(queueUrl, undefined, 0)` with no per-message budget); add `getQueueDepth` + `setGetQueueDepth`; gate each loop receive as above -- cuts the idle 20 s block
- [x] `apps/backend/src/lib/aws/poll-and-drain-queue.test.ts` -- install a depth-0 stub at the start of every suite and restore it in `afterEach`; rename the guard test titled "long-poll ate it"; add tests for every I/O row, asserting receive args (`0` then `20`, same `maxMessages` on both) and depth call counts; cover both default implementations with `mock.method(SQSClient.prototype, 'send')` (command inputs, attribute parsing, `NaN` fallback)
- [x] `apps/backend/src/lambdas/{scraper,ai-processor,ingestor}.test.ts` -- install the depth stub at suite start, restore in `t.after`
- [x] `apps/backend/src/lambdas/ai-processor.ts` -- comment-only fix at L80-82 (resumed posts may now wait one tick)
- [x] `docs/infrastructure/2-backend.md` -- 1-2 sentences on the gate and why
- [x] `_bmad-output/implementation-artifacts/backlog.yaml` -- add `FIND-261122-q5w` (empty-tick free-tier finding, `app:backend`, `app:infrastructure`; ref this spec)

**Acceptance Criteria:**
- Given an empty queue, when a tick runs, then it makes one `WaitTimeSeconds: 0` receive and one depth call and no 20 s receive.
- Given a short poll that missed messages, or only delayed or in-flight messages, when the tick runs, then the long poll runs and its messages are handled and deleted.
- Given the depth call throws, when the tick runs, then it logs and long-polls instead of stopping.
- Given the stack test, when synthesized, then each consumer Lambda still holds `sqs:GetQueueAttributes` on its queue.

## Design Notes

Idle cost per tick is 1 short receive + 1 `GetQueueAttributes`: about 1,730 SQS requests/day across the 3 queues, about 5% of the 1M/month SQS free tier. Counts are eventually consistent, so a just-sent message can wait one extra 5-minute tick, including posts the AI processor's resume passes enqueue just before the drain (delay, never loss). The expected idle Lambda cost falls from about 15,100 to roughly 1k GB-s/day; the AI tick still runs its DB resume passes first, so the real figure is to be confirmed from CloudWatch `REPORT` lines. Messages still in flight (a failed handler, a poison message cycling to the DLQ, or one just deleted whose count has not caught up) make the next tick's gate long-poll and miss, so the saving holds for quiet queues, not around failures. Fallback if the gate proves flaky: `WaitTimeSeconds: 1` with no depth call (a long poll, no sampling miss, about 3-4x the cost, does not fix the 10 s chain delay).

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/database build` -- expected: dist rebuilt
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/aws/poll-and-drain-queue.test.ts src/lambdas/{scraper,ai-processor,ingestor}.test.ts` -- expected: pass (two known unrelated local failures named if they appear)
- `cd apps/backend && npx tsc --noEmit` and `cd apps/infrastructure && npx tsc --noEmit` -- expected: clean
- `cd apps/infrastructure && pnpm run test` (stack test) -- expected: pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: no failure naming `FIND-261122-q5w`

**Manual checks (after the next backend deploy):**
- CloudWatch `REPORT` lines of an idle scraper, AI processor and ingestor tick show well under 1 s billed duration; the outcome log shows `gated-empty` dominating.

## Suggested Review Order

**The gate (design entry point)**

- Short poll first; only an empty result consults the depth, and only a clean 0 returns.
  [`poll-and-drain-queue.ts:193`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L193)

- Depth error or `NaN` fails open to the long poll, so a missing permission never stops consumption.
  [`poll-and-drain-queue.ts:198`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L198)

- Guard rechecked before the 20 s wait; outcome log names `depth-failed` for thrown and unreadable depth alike.
  [`poll-and-drain-queue.ts:210`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L210)

**Seams and SQS calls**

- One `GetQueueAttributes` call sums visible, delayed and in-flight counts so AD-47's 10 s steps stay in-tick.
  [`poll-and-drain-queue.ts:51`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L51)

- Receive takes an optional wait (default 20, clamped 0-20), so existing call shapes keep working.
  [`poll-and-drain-queue.ts:18`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L18)

- New `setGetQueueDepth` seam, same style as the receive and delete seams.
  [`poll-and-drain-queue.ts:68`](../../apps/backend/src/lib/aws/poll-and-drain-queue.ts#L68)

**Call-site comment and docs**

- Comment-only: resumed posts may now wait one tick.
  [`ai-processor.ts:82`](../../apps/backend/src/lambdas/ai-processor.ts#L82)

- Docs sentence on why the gate exists and what it supersedes.
  [`2-backend.md:19`](../../docs/infrastructure/2-backend.md#L19)

- Backlog row for this finding.
  [`backlog.yaml:3137`](./backlog.yaml#L3137)

**Tests**

- Gate suite: every I/O row, receive args, depth call counts.
  [`poll-and-drain-queue.test.ts:436`](../../apps/backend/src/lib/aws/poll-and-drain-queue.test.ts#L436)

- Guard recheck after the depth call.
  [`poll-and-drain-queue.test.ts:621`](../../apps/backend/src/lib/aws/poll-and-drain-queue.test.ts#L621)

- Real default implementations via a mocked `SQSClient.send`.
  [`poll-and-drain-queue.test.ts:638`](../../apps/backend/src/lib/aws/poll-and-drain-queue.test.ts#L638)

- Depth stub so the lambda suites never reach the real SQS client.
  [`scraper.test.ts:54`](../../apps/backend/src/lambdas/scraper.test.ts#L54)
