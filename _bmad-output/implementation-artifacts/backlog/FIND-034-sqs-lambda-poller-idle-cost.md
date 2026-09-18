---
backlog_id: FIND-034
title: "Lambda SQS event-source pollers run 24/7 on idle queues, burning free-tier request quota"
captured: 2026-09-17
---

# FestDaily backlog note: FIND-034

## Finding

Investigated via AWS CLI (2026-09-17) after AWS billing alert: account
944921953880 hit 85%+ of the September AWSQueueService free-tier limit
(867,586 / 1,000,000 requests as of 09/16).

Root cause: `festgrid-backend-stack.ts` wires all 6 non-DLQ SQS queues
(scraping/data-ingestion/ai-processing × dev/prod) to their consumer Lambdas
via `eventSources.SqsEventSource`
([festgrid-backend-stack.ts:391](../../../apps/infrastructure/lib/festgrid-backend-stack.ts#L391),
[:406](../../../apps/infrastructure/lib/festgrid-backend-stack.ts#L406),
[:411](../../../apps/infrastructure/lib/festgrid-backend-stack.ts#L411)),
unconditionally for every stage. Lambda's internal SQS poller long-polls
continuously regardless of queue content — confirmed via CloudWatch
`NumberOfEmptyReceives`, Sept 1–17:

| Queue | Empty receives | Real messages |
|---|---|---|
| scraping-dev | 142,401 | 0 |
| scraping-prod | 142,394 | 3 |
| data-ingestion-dev | 142,399 | 0 |
| data-ingestion-prod | 142,418 | 196 |
| ai-processing-dev | 142,402 | 0 |
| ai-processing-prod | 142,406 | 285 |

854,420 of the 867,586 reported requests (98.5%) were empty polls. Half of
that (~427k) came from the 3 **dev** queues, which processed zero real
messages all month.

## Mitigation already applied (manual, will not survive redeploy)

Disabled the 3 dev Lambda event-source-mappings directly via
`aws lambda update-event-source-mapping --uuid <uuid> --no-enabled`:

- `3d7b0f35-b644-43e5-8eb4-90556711ffb7` (scraping-queue-dev)
- `d4a56e04-819d-41cf-a903-dda317f4cd9e` (data-ingestion-queue-dev)
- `c5dfb5c2-3f63-47ff-89c2-ede9a9cb4192` (ai-processing-queue-dev)

This is a **stopgap only** — the next `cdk deploy` of the dev stack re-enables
them, since the stack has no stage-based gate on the ESM wiring.

## Proposed architectural fix

Two parts, confirmed with the user (2026-09-17):

**1. Dev: gate ESM `enabled` on stage, default off.**

```ts
const enableQueuePolling = stageName !== 'dev'
  || this.node.tryGetContext('enableDevQueuePolling') === 'true';
```

Apply to all 3 dev `addEventSource(... , { enabled: enableQueuePolling })`
calls. Dev testing becomes explicit opt-in:
`cdk deploy FestgridBackendStack-dev -c enableDevQueuePolling=true`.

**2. Prod: replace all 3 continuous Lambda ESMs with scheduled poll-and-drain
(5 minute interval).** User confirmed scraping, AI extraction, and data
ingestion can all tolerate delay in minutes.

- CDK: drop `SqsEventSource` for `scraperLambda`, `aiProcessorLambda`,
  `ingestorLambda`; add `events.Rule` + `Schedule.rate(Duration.minutes(5))`
  targeting each, mirroring the existing daily seed-run/notifier rule pattern
  already in the stack (`scraperScheduleRule`, `notifierScheduleRule`).
- Handlers: each gets a new branch (distinguished via a marker payload on the
  scheduled `RuleTargetInput`) that does its own `ReceiveMessage` (long-poll,
  batch of 10) → processes with the existing per-message logic already used
  by the SQS-event path → `DeleteMessage` on success. Failed messages are
  left undeleted; the existing `maxReceiveCount: 3` redrive policy still
  auto-DLQs them since that's a queue-level attribute, unaffected by which
  consumer mechanism is polling.
- Drop `reportBatchItemFailures` (ai-processor, ingestor) — superseded by the
  delete-only-on-success pattern above.
- Note: `scraperLambda` and `ingestorLambda`'s handlers already branch on
  event shape today (scraper already distinguishes an SQS event from its
  existing daily EventBridge seed-run trigger), so this is a third branch on
  an existing pattern, not a new one.

### Projected impact (modeled from the CloudWatch data above)

| | Continuous ESM (current) | Scheduled poll, 5 min, all 3 prod queues |
|---|---|---|
| Prod daily SQS requests | ~25,506 | ~950 (96% cut) |
| Sept month-end projection | ~1,224,670 (~225k over free tier) | ~905,447 (~95k under) |
| Steady-state monthly pace | ~765k/month from idle polling alone | ~28,500/month |

Fixes the recurring problem, not just this month — future months would sit
at roughly 3% of the free-tier budget from idle polling instead of ~77%.

## Status

~~Triaged~~ **Promoted, 2026-09-18 via `bmad-create-story`, into Story 0.40.**

Story 0.40 fully covers this row's settled design (above) plus one extension: staging
(unaddressed by the original design) is treated the same as dev rather than left on the old
always-on ESM, resolved via AskUserQuestion with the user during story creation, alongside a
second resolved gap (poll-and-drain loops until drained/time-budget, not a single fixed batch
of 10). No uncovered remainder — no child row carved.

**Blocks BUG-002 remains UNRESOLVED until Story 0.40 reaches `done`** (creating the story
doesn't yet ship the fix): that row's missing-timeout gap is framed against the current
ESM-invocation model this fix removes for `aiProcessorLambda`/`ingestorLambda` — resolve this
first, then re-scope BUG-002 against the new scheduled poll-and-drain model.
