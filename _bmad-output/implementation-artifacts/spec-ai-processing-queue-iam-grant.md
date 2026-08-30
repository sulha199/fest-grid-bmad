---
title: 'Fix missing AIProcessingQueue IAM grant on apiLambda'
type: 'bugfix'
created: '2026-08-30'
status: 'done'
route: 'one-shot'
---

# Fix missing AIProcessingQueue IAM grant on apiLambda

## Intent

**Problem:** `selectPostsForExtraction` fails in prod with `INTERNAL_SERVER_ERROR` / "Unexpected error." — confirmed via CloudWatch logs to be an SQS `AccessDenied`: `apiLambda`'s environment has `AI_PROCESSING_QUEUE_URL` wired but was never granted `sqs:SendMessage` on that queue.

**Approach:** Add the missing `aiProcessingQueue.grantSendMessages(apiLambda)` call in `festgrid-backend-stack.ts`, mirroring the existing sibling `scrapingQueue.grantSendMessages(apiLambda)` grant. Add a regression test asserting the IAM policy statement exists, scoped to `AIProcessingQueue`'s own ARN (verified against actual synthesized CloudFormation, not just source-read).

## Suggested Review Order

**IAM grant fix**

- The missing grant, now added — mirrors the existing `scrapingQueue` grant one line above it.
  [`festgrid-backend-stack.ts:396`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L396)

- Incident-context comment explaining why this line exists and why it must not be silently removed.
  [`festgrid-backend-stack.ts:392-395`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L392-L395)

- Where the env var was already wired (Story 5.1a) without the matching grant — the actual root cause.
  [`festgrid-backend-stack.ts:256`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L256)

**Regression test**

- New assertion confirming `apiLambda`'s policy grants `sqs:SendMessage` scoped to `AIProcessingQueue`'s own ARN (not merged with the `ScrapingQueue` statement) — verified to fail without the fix above and pass with it.
  [`festgrid-backend-stack.test.ts:168-182`](../../apps/infrastructure/lib/festgrid-backend-stack.test.ts#L168-L182)
