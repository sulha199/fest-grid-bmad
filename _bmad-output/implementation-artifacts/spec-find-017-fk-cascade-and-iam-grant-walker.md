---
title: 'FIND-017: FK cascade on profile deletion + generalized IAM env-var/grant test'
type: 'bugfix'
created: '2026-09-18T00:00:00Z'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: '57631c39ab24e4be654ec4e19f8591d946735caf'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 2 of FIND-017's 3 sub-gaps (Split B, from the approved 4-item batch spec `spec-bug-015-find-020-find-017-idea-015-backend-resiliency-batch.md`): (1) `brightdataPendingJobs.profileId`/`apifyPendingJobs.profileId`/`scraperActorRuns.profileId` use the default `onDelete: no action`, so deleting a `social_media_account_profiles` row with existing pending-job/actor-run children fails instead of cascading; (2) the IAM-grant regression test (`festgrid-backend-stack.test.ts` #13b) only covers the one past `AI_PROCESSING_QUEUE_URL` incident, not the general env-var-references-a-queue-with-no-matching-grant class, and `apiLambda` still carries an unused, ungranted `DATA_INGESTION_QUEUE_URL` env var that the narrow test can't catch.

**Approach:** Add `{ onDelete: 'cascade' }` to the 3 FK refs via `drizzle-kit generate` (never hand-edit SQL); replace test #13b with a generic walker that, for every synthesized Lambda, matches `*_QUEUE_URL` env vars that are a direct `Ref` to a template-defined `AWS::SQS::Queue` against that Lambda's IAM role's granted SQS actions on that queue's ARN; remove `apiLambda`'s dead `DATA_INGESTION_QUEUE_URL` line so the new generic test passes clean.

## Boundaries & Constraints

**Always:**
- Match the existing cascade convention already used elsewhere in `schema.ts` (e.g. `favorites.eventId`, `calendarAdditions.userId`) — `{ onDelete: 'cascade' }` on the FK ref, migration produced only via `pnpm --filter database generate`.
- Confirm via `pnpm --filter infrastructure test festgrid-backend-stack.test.ts` that the new generic test both (a) passes against the current (fixed) stack and (b) would fail if `apiLambda` still had `DATA_INGESTION_QUEUE_URL` with no grant — verify by temporarily re-adding the line locally, observing the failure, then removing it again (do not leave that probe in the diff).

**Never:**
- Do NOT implement FIND-017 Gap 2 (real Apify `GET /v2/users/me/limits` capacity check) — explicitly deferred, needs its own persistence/refresh-policy design.
- Do NOT touch BUG-015 (already shipped, commit `55a8b4e`) or FIND-020 (already deferred to `deferred-work.md`).
- Do NOT extend the generic walker to Secrets Manager env vars — `secret.secretValue.unsafeUnwrap()` synthesizes as a `{{resolve:secretsmanager:...}}` dynamic-reference *string*, not a `Ref`/`Fn::GetAtt` object, so it isn't mechanically walkable the same way as a queue's `Ref`-based `queueUrl`; scope the walker to queue env vars only (the actual shape of the DW-088 incident class) and note the secrets gap in Design Notes rather than faking coverage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| FK cascade | Delete a `social_media_account_profiles` row with existing `brightdata_pending_jobs`/`apify_pending_jobs`/`scraper_actor_runs` rows | Delete succeeds; child rows removed | N/A (previously blocked by FK violation) |
| Generic walker, granted queue | Lambda env has `AI_PROCESSING_QUEUE_URL: Ref(AIProcessingQueue)`, apiLambda's role has `sqs:SendMessage` on that queue's ARN | Test passes for that var | N/A |
| Generic walker, ungranted queue | A future Lambda env var is a direct `Ref` to a queue with no matching IAM statement on its role | Test fails, naming the Lambda + env var + queue logical id | N/A |

</frozen-after-approval>

## Code Map

- `packages/database/schema.ts` -- add `{ onDelete: 'cascade' }` to the 3 `profileId` FK refs (currently plain `.references(() => socialMediaAccountProfiles.id).notNull()` at lines ~94, ~109, ~317).
- `packages/database/migrations/` -- new migration produced by `drizzle-kit generate` (next sequence after `0058_nice_liz_osborn.sql`).
- `apps/infrastructure/lib/festgrid-backend-stack.ts:279` -- delete the `DATA_INGESTION_QUEUE_URL: dataIngestionQueue.queueUrl,` line from `apiLambda`'s `environment` (confirmed unread: only `process-ai-job.ts`/`ingestor.ts` read `env.dataIngestionQueueUrl`, both run in other Lambdas).
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts:192-210` -- replace test block 13b with the generic walker described above.

## Tasks & Acceptance

**Execution:**
- [x] `packages/database/schema.ts` -- add `{ onDelete: 'cascade' }` to `brightdataPendingJobs.profileId`, `apifyPendingJobs.profileId`, `scraperActorRuns.profileId` -- FIND-017 Gap 1.
- [x] Run `pnpm --filter database generate` -- produces the migration; do not hand-edit the generated SQL.
- [x] `apps/infrastructure/lib/festgrid-backend-stack.ts` -- remove the unused `DATA_INGESTION_QUEUE_URL` line from `apiLambda`'s environment block -- FIND-017 Gap 3.
- [x] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` -- replace test 13b with a generic test: build a `logicalId -> resourceType` map from `template.toJSON().Resources`; for every `AWS::Lambda::Function`, for every env var ending `_QUEUE_URL` whose value is `{ Ref: <id> }` where `<id>` is an `AWS::SQS::Queue`, assert some `AWS::IAM::Policy` attached to that Lambda's role (`Properties.Roles` containing `{ Ref: <lambda's role logicalId> }`) has a statement with an `sqs:*` action and a `Resource` containing `{ 'Fn::GetAtt': [<id>, ...] }` -- generalizes DW-088's regression coverage to the whole class.
- [x] Manually verify the new test's failure mode once (temporarily re-add the removed env var, confirm the test fails naming `apiLambda`/`DATA_INGESTION_QUEUE_URL`, then remove it again) before finalizing the diff.

**Acceptance Criteria:**
- Given a `social_media_account_profiles` row with existing child rows in all 3 tables, when that profile row is deleted, then the delete succeeds and the child rows are removed.
- Given the generalized stack test runs against the current stack, when it walks every Lambda's queue-URL env vars, then it passes with `DATA_INGESTION_QUEUE_URL` removed from `apiLambda`.
- Given a hypothetical future Lambda env var is a direct `Ref` to a queue with no matching grant, when the generalized test runs, then it fails naming the offending Lambda + env var.

## Spec Change Log

- **2026-09-18, review finding (intent_gap, shipped narrow):** Blind Hunter and Edge Case Hunter both independently found the AC1 cascade fix incomplete for the realistic case — `scraperActorRuns.id` is also referenced by `posts.scraperActorRunId`, `unprocessedScraperPayloads.scraperActorRunId`, and `brightdataPendingJobs.scraperActorRunId`, none of which have any `onDelete` action, so profile deletion still fails one level deeper whenever the profile's actor runs produced actual posts/payloads. The root cause is inside `<frozen-after-approval>` (the originally-authorized scope named only the 3 direct `profileId` FKs) and extending it further is a data-retention product decision (`set null` vs `cascade` on the 3 downstream refs), not something to infer. Per explicit direction, shipped the originally-authorized narrow scope as-is rather than expanding it unilaterally; tracked the gap as new backlog row FIND-037 and `deferred-work.md` instead. **KEEP:** the 3-FK cascade fix, the generic IAM walker, and the dead-env-var removal are all correct and complete as scoped — nothing about them needs re-deriving.
- **2026-09-18, review finding (patch):** Generic walker's `roleLogicalId` could be `undefined` for a Lambda whose role isn't a direct in-template `Fn::GetAtt`, which combined with a policy `Roles` entry also lacking a `Ref` produced an `undefined === undefined` false-positive match. Fixed with an explicit `assert.ok(roleLogicalId, ...)` guard naming the real cause. Also added a `checkedCount > 0` assertion (guards against the walker silently checking zero vars if the `_QUEUE_URL` suffix convention ever changes) and extracted the walker into its own top-level `test(...)` instead of an anonymous block inside the 289-line resource-provisioning test, so a walker failure can't mask/abort the unrelated checks after it.
- **2026-09-18, review finding (patch):** `apiLambda`'s `DATA_INGESTION_INLINE_FALLBACK_ENABLED` env var was left in place after removing its paired (also-dead) `DATA_INGESTION_QUEUE_URL` — same "unused, ungranted, no code path reads it on apiLambda" reasoning applies (`env.dataIngestionInlineFallbackEnabled` is only read by `process-ai-job.ts`, which only runs in `aiProcessorLambda`, and that Lambda doesn't even set the var either). Removed for consistency.

## Design Notes

The generic walker only covers `Ref`-typed queue URL env vars (the actual mechanical shape of every queue wiring in this stack, and of the DW-088 incident it generalizes). Secrets Manager env vars use a `{{resolve:secretsmanager:...}}` dynamic-reference string at synth time, not a `Ref`/`Fn::GetAtt` structure, so they can't be walked the same way without a regex-based heuristic on that string format — out of scope here; secrets stay covered only by the existing per-secret `grantRead` calls and manual review.

**Known gap (not fixed here, tracked as FIND-037):** deleting a `social_media_account_profiles` row still fails whenever its `scraper_actor_runs` are referenced by `posts`/`unprocessed_scraper_payloads`/`brightdata_pending_jobs.scraper_actor_run_id` — none of which cascade or null out. AC1 below is accurate only for the narrower case (actor runs with zero downstream references); the common real-world case (a profile that was actually scraped, producing posts) still fails deletion, just one FK deeper than before this fix. See `deferred-work.md` and backlog row FIND-037 for the two candidate resolutions (`set null` vs `cascade` on the 3 downstream refs).

## Verification

**Commands:**
- `pnpm --filter database generate` -- expected: produces a new migration file, no manual SQL edits
- `pnpm --filter infrastructure test festgrid-backend-stack.test.ts` -- expected: all pass, including the new generic walker
- `pnpm --filter infrastructure build` -- expected: TS compiles clean
</content>
