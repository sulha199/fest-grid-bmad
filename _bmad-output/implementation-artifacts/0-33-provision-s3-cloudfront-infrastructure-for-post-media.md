---
baseline_commit: 753f5b5
---
# Story 0.33: Provision S3 + CloudFront infrastructure for post media

## Story Details

- Epic: 0
- Story ID: 0.33
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a new, private S3 bucket for post media (no public bucket access, Origin Access Control only) fronted by a CloudFront distribution that serves objects with `Cache-Control: public, max-age=31536000, immutable`, plus scoped `s3:PutObject` write permission for the `aiProcessorLambda` (the AI-extraction Lambda that already fetches post image bytes for Gemini's vision call) and the bucket name / CDN domain wired into that Lambda's environment,
so that a later story (the durable-image-rehosting pipeline step, Architecture Spine AD-12) has a real, permanently-free-tier-friendly CloudFront-fronted bucket to upload the already-fetched image bytes into and a `posts.durableImageUrl` CDN URL to construct — without inventing any of this ad hoc as a byproduct of that story's own scope.

## Acceptance Criteria

1. **Given** `FestgridBackendStack`'s existing constructs (`apps/infrastructure/lib/festgrid-backend-stack.ts`: the 7 already-provisioned Lambdas including `aiProcessorLambda` — `AIProcessorLambda-${stageName}`, entry `apps/backend/src/lambdas/ai-processor.ts` — and the `removalPolicy`/`definedEnv` helpers already used throughout the file),
2. **When** the stack is synthesized,
3. **Then** a new, private `s3.Bucket` (`PostMediaBucket-${stageName}`) is provisioned with `blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL`, default S3-managed encryption, no explicit `bucketName` (S3 bucket names are globally unique across **all** AWS accounts, not just this one — unlike this file's existing `queueName`/`secretName` conventions, which are only unique per-account; CloudFormation auto-generates a collision-safe name), and `removalPolicy`/`autoDeleteObjects` following the file's existing prod-vs-non-prod pattern (`RETAIN`/no-auto-delete for `prod`, `DESTROY`/`autoDeleteObjects: true` otherwise).
4. **And** a `cloudfront.Distribution` (`PostMediaDistribution-${stageName}`) fronts that bucket via `origins.S3BucketOrigin.withOriginAccessControl(postMediaBucket)` (CDK's L2 Origin Access Control origin — confirmed available at this repo's pinned `aws-cdk-lib@^2.262.0`, well past the ~2.170 minimum), `viewerProtocolPolicy: REDIRECT_TO_HTTPS`, and a `cloudfront.CachePolicy.CACHING_OPTIMIZED` default cache policy — no public S3 URL is ever the intended access path.
5. **And** a `cloudfront.ResponseHeadersPolicy` attached to the distribution's default behavior injects `Cache-Control: public, max-age=31536000, immutable` (`override: true`) on every response, so the header is guaranteed at the CDN layer regardless of what object metadata a future uploader sets — the later upload-logic story does not need to remember to set this itself.
6. **And** `aiProcessorLambda` is granted `postMediaBucket.grantPut(aiProcessorLambda)` (scoped write-only IAM permissions on this bucket specifically) and **no other Lambda** in the stack receives any grant on this bucket — the bucket's only read path is CloudFront's OAC-backed origin access (auto-wired by `S3BucketOrigin.withOriginAccessControl`), and its only write path is `aiProcessorLambda`.
7. **And** `aiProcessorLambda`'s environment gains two new plain (non-secret) values: `POST_MEDIA_BUCKET_NAME` (`postMediaBucket.bucketName`) and `POST_MEDIA_CDN_DOMAIN` (`postMediaDistribution.distributionDomainName`) — added directly to its existing `environment: {...}` object literal, mirroring how `GEOAPIFY_API_KEY`/`DATA_INGESTION_QUEUE_URL` are already wired into that same Lambda.
8. **And** a CDK assertion test (`aws-cdk-lib/assertions`, extending `apps/infrastructure/lib/festgrid-backend-stack.test.ts`) proves: exactly one `AWS::S3::Bucket` with public access fully blocked; exactly one `AWS::CloudFront::Distribution`; exactly one `AWS::CloudFront::OriginAccessControl`; an IAM policy statement granting `s3:PutObject` (bucket-scoped) attached to `aiProcessorLambda`'s execution role; and `aiProcessorLambda`'s environment contains `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN`.
9. **And** this story does not modify `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lib/ai-processor/*`, `apps/backend/src/env.ts`, or `packages/database/schema.ts` — no application code reads the two new env vars yet, no `posts.durableImageUrl` column is added, and no actual image upload happens. That is explicitly the next story in this wave sequence (per AD-12 Rule 1); this story's scope is exclusively the CDK/IaC construct plus the Lambda's env wiring.
10. **And** `cdk synth` succeeds for all three stage instances (`dev`/`staging`/`prod`) with the new bucket/distribution/grants included, and no `cdk deploy` against real AWS is performed as part of this story's verification.

## Tasks / Subtasks

- [x] Task 1: Confirm current state before starting (AC: 1, 9)
  - [x] Confirmed `apps/infrastructure/lib/festgrid-backend-stack.ts` matched this story's read (7 Lambdas incl. `aiProcessorLambda`, `definedEnv`/`removalPolicy` helpers, no existing S3/CloudFront import) before editing.
  - [x] Confirmed `apps/backend/src/lib/ai-processor/build-gemini-request.ts` still performs the `fetch(message.imageUrl)` byte-fetch this story's env wiring will eventually feed (read-only, unmodified).
- [x] Task 2: Provision the private S3 bucket (AC: 2, 3)
  - [x] Added `import * as s3 from 'aws-cdk-lib/aws-s3';` and provisioned `postMediaBucket` (`PostMediaBucket-${stageName}`), positioned after the Secrets Manager section, before the Lambda definitions.
  - [x] `blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL`, no explicit `bucketName`, `encryption: s3.BucketEncryption.S3_MANAGED`, `removalPolicy`/`autoDeleteObjects: stageName !== 'prod'`.
- [x] Task 3: Provision the CloudFront distribution + cache-control response headers policy (AC: 4, 5)
  - [x] Added `import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';` and `import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';`.
  - [x] Provisioned `postMediaCacheHeadersPolicy` (`cloudfront.ResponseHeadersPolicy`, `PostMediaCacheHeadersPolicy-${stageName}`) with the custom `Cache-Control: public, max-age=31536000, immutable` header, `override: true`.
  - [x] Provisioned `postMediaDistribution` (`cloudfront.Distribution`, `PostMediaDistribution-${stageName}`), `defaultBehavior.origin: origins.S3BucketOrigin.withOriginAccessControl(postMediaBucket)`, `viewerProtocolPolicy: REDIRECT_TO_HTTPS`, `cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED`, `responseHeadersPolicy: postMediaCacheHeadersPolicy`.
- [x] Task 4: Wire IAM write grant + Lambda environment (AC: 6, 7)
  - [x] `postMediaBucket.grantPut(aiProcessorLambda);` added in the "5. IAM Permissions" section.
  - [x] Added `POST_MEDIA_BUCKET_NAME: postMediaBucket.bucketName` and `POST_MEDIA_CDN_DOMAIN: postMediaDistribution.distributionDomainName` to `aiProcessorLambda`'s `environment: {...}` object.
- [x] Task 5: Add CDK infrastructure assertion tests (AC: 8)
  - [x] Extended `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: `AWS::S3::Bucket` count is 1 with `PublicAccessBlockConfiguration` all-`true`; `AWS::CloudFront::Distribution` count is 1; `AWS::CloudFront::OriginAccessControl` count is 1; an `AWS::IAM::Policy` statement with `Action` including `s3:PutObject`/`Effect: Allow` exists; `aiProcessorLambda`'s environment contains `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN`, disambiguated via `Timeout: 300` + `DATA_INGESTION_QUEUE_URL`. Also bumped the pre-existing Lambda-count assertion 7→8 (see Dev Notes: "Lambda count bumped to 8" below — a discovered, not planned, CDK side effect).
- [x] Task 6: Update `SETUP_WALKTHROUGH.md` (persistent fact: cloud/external service setup) (AC: 2-7)
  - [x] Added a short note under the `## 2. Backend (AWS Serverless)` → Credentials & Secrets Configuration section: `PostMediaBucket`/`PostMediaDistribution` are fully CDK-managed, no manual console setup, no new Secrets Manager entry.
- [x] Task 7: Verification (AC: 1-10)
  - [x] `pnpm --filter infrastructure exec cdk synth` succeeded for all three stage instances with the new bucket/distribution/grants included (see Dev Notes: "cdk synth env var gap" below for the local-verification env vars needed).
  - [x] `pnpm exec tsx --test lib/**/*.test.ts` (in `apps/infrastructure`) passed: 1/1, including the new Task 5 assertions.
  - [x] `pnpm build --filter=infrastructure` and `pnpm lint --filter=infrastructure` at the repo root both completed cleanly (0 tasks — package defines neither script, matching Story 0.27's identical precedent).
  - [x] Confirmed `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lib/ai-processor/*`, `apps/backend/src/env.ts`, `packages/database/schema.ts` are byte-for-byte unchanged (`git diff --stat` against each returned empty).
  - [x] Recorded in Completion Notes: a real `cdk deploy` against a live AWS account is **not** performed as part of this story's automated verification, mirroring Stories 0.14/0.25/0.27's own precedent.

## Dev Notes

### Why this story has no epics.md section (unlike most Epic 0 stories)

Story 0.33 was added directly to `sprint-status.yaml` via `bmad-correct-course` (`sprint-change-proposal-2026-08-25-video-priority-display.md`, Section 2/Section 7), not through `bmad-create-epics-and-stories`. Per that proposal's own Section 3: "no separate `bmad-prd`/`bmad-architecture` session is needed since... the AD-12 draft (Track A) [is] already fully specified in Section 4, resolved within this workflow run rather than deferred." This story's authoritative source is therefore the sprint-change-proposal (Section 4.4) + Architecture Spine **AD-12** (`festgrid-architecture-spine.md`, applied) directly, not an `epics.md#Story 0.33` section — confirmed via grep, no such section exists. This mirrors how AD-10 (system Gemini key) was cited as this decision's own precedent for "new AD, no epics.md rewrite needed."

### Scope boundary — infra only, this is Wave 1 of a 3-wave plan

This story is explicitly infra-construct-only (the sprint-change-proposal's Section 7 wave plan). The actual byte-upload-during-extraction logic, the `posts.durableImageUrl`/`posts.imageUrlExpiresAt` DB columns, and the Event resolver's original-vs-durable serving logic (AD-12 Rules 1, 3) are later stories in this same proposal's wave sequence — not built here. AC9 makes this explicit and Task 7's verification checks confirm no accidental scope creep into `apps/backend`.

### Which Lambda gets the write grant, and why (resolved ambiguity)

`build-gemini-request.ts`'s `buildGeminiExtractionRequest` (the function that performs the image-byte-fetch AD-12 Rule 1 reuses) is called from **two** places: `apps/backend/src/lib/ai-processor/process-ai-job.ts` (invoked by `aiProcessorLambda` via the `AIProcessingQueue`, Story 3.6's automated extraction pipeline) **and** `apps/backend/src/schema/resolvers.ts`'s `extractEventDataFromUrl` mutation (invoked by `apiLambda`, a manual/on-demand moderator-or-user-triggered preview mutation that does not persist a `Post`/re-hosted image). AD-12 Rule 1 explicitly scopes re-hosting to "Story 3.6's pipeline" and Rule 4 scopes it to "posts that reach a successful extraction" via that same automated pipeline — the manual `extractEventDataFromUrl` path is a preview/no-persistence flow, not part of AD-12's re-hosting scope. This story therefore grants `s3:PutObject` **only** to `aiProcessorLambda`, not `apiLambda`. If a future story extends re-hosting to the manual-extraction path, that is a fresh, explicit AD-12 amendment — not assumed here.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — run fresh** (`epic-0-readiness.md`'s `swept: true` report is dated 2026-08-03, `stories_covered` starts at `0.1` and predates this story by three weeks — same escape-hatch situation Stories 0.23/0.24/0.25/0.27 already recorded for themselves). **Verdict: No gap found.** This is a fully self-contained CDK construct — bucket, distribution, OAC, a scoped IAM grant, and env-var wiring into an already-existing Lambda. No application layer is bypassed, no direct-from-frontend external call is introduced, no new API surface is added. Ran a Gate-1-lens subagent check explicitly against this story's exact scope (bucket/distribution/IAM/env wiring only, no app-code changes) — confirmed no missing architectural layer, with one implementation-detail note folded directly into AC8: "structurally correct" needed a concrete assertion bar (public-access-block proof, OAC-scoped bucket policy, `aiProcessorLambda`-only `s3:PutObject` grant), now made explicit rather than left to interpretation.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — run fresh, same reason.** **Verdict: No gap found — inline, don't abstract.** This is the first S3/CloudFront resource in the project; there is no second known consumer of an "S3 + CloudFront + OAC" pattern anywhere in the proposal (the later re-hosting story reuses this exact bucket/distribution, not a sibling instance). Rule-of-three fails for extracting a generic reusable "CDN-fronted bucket" construct/helper — building one now would be premature abstraction with no second consumer to validate its shape against. Inlining directly into `festgrid-backend-stack.ts`, matching how every other resource in that file (KMS, queues, secrets, SES, all 7 Lambdas) is already inlined rather than factored into shared constructs, is the right call and keeps the file's existing convention consistent. Also confirmed: this repo's pinned `aws-cdk-lib@^2.262.0` (`apps/infrastructure/package.json`) supports the L2 `origins.S3BucketOrigin.withOriginAccessControl` / OAC constructs used in Task 3 (available since ~2.170) — no L1 `CfnOriginAccessControl` fallback needed.
- **Gate 2 (UI Complexity & Reusability) — no subagent dispatched.** This story has **zero UI surface** — pure AWS IaC (CDK stack changes only), no React component, page, hook, or util. Mirrors Story 0.27's identical justification for its own zero-UI infra scope; no grep of `design-artifacts/` is needed since nothing in this story's scope (bucket/distribution/IAM/env var) could plausibly appear in a UX spec. **Verdict: No gap found.**

### Discovered at implementation time: Lambda count bumped to 8, not 7

`s3.Bucket`'s `autoDeleteObjects: stageName !== 'prod'` (Task 2) is a CDK convenience that, under the hood, provisions a singleton `Custom::S3AutoDeleteObjects` custom-resource **Lambda** (shared across the whole CDK app, created once) to empty the bucket before deletion in non-prod stages. This was not anticipated when AC8's test-assertion bar was written and surfaced only when running the test suite: `dev`/`staging` synthesize with 8 `AWS::Lambda::Function` resources (7 application Lambdas + this 1 CDK-internal one), while `prod` (where `autoDeleteObjects` is `false`, matching `removalPolicy: RETAIN`) still synthesizes with exactly 7 — confirmed directly by inspecting all three stage templates' resource-type counts. The pre-existing `template.resourceCountIs('AWS::Lambda::Function', 7)` assertion (written against `stageName: 'dev'`) was updated to 8 with an inline comment explaining why, rather than silently left inconsistent with the actual synthesized template.

### Discovered at implementation time: `cdk synth` requires prod env vars even for local verification

`festgrid-backend-stack.ts`'s existing prod-only required-env-var guard (`SUPABASE_URL`/`FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`SES_FROM_EMAIL_ADDRESS`/`WEB_APP_BASE_URL`) throws at synth time — before any AWS credentials are ever needed — if any are unset, since `bin/infrastructure.ts` instantiates all three stages (including `prod`) in one CDK app and `apps/infrastructure`'s `synth` script (`cdk synth`, no `dotenv` loading) does not automatically read the repo's `.env`. This is **pre-existing behavior, unrelated to this story's own changes** — confirmed directly by stashing this story's diff and reproducing the identical failure against the unmodified `master` stack file. `SES_FROM_EMAIL_ADDRESS`/`WEB_APP_BASE_URL` specifically were absent from this worktree's copied `.env`. Verification `cdk synth` was run with the repo's `.env` sourced into the shell plus two placeholder values for the missing pair (`SES_FROM_EMAIL_ADDRESS=noreply@festdaily.app`, `WEB_APP_BASE_URL=https://festdaily.app` — synth-time-only, never used for a real deploy) — this is a pure presence-check gate, not a value-correctness check, so placeholders are sufficient to prove the template synthesizes correctly. No code change was made to relax or work around this guard; it is orthogonal to this story's scope.

### Design decision: no explicit `bucketName`

Unlike this file's existing `queueName: 'festgrid-scraping-queue-${stageName}'`/`secretName: 'festgrid-...-${stageName}'` conventions (both only need to be unique **within this AWS account**), S3 bucket names must be globally unique across **every** AWS account that has ever existed. Setting an explicit literal name (e.g. `festgrid-post-media-${stageName}`) risks a hard deploy failure if any other AWS account anywhere has already claimed that exact name — a real correctness risk, not a style preference. This story therefore omits `bucketName` entirely and lets CloudFormation auto-generate a collision-safe name; `postMediaBucket.bucketName` (a CDK token resolved at deploy time) is what actually gets threaded into `aiProcessorLambda`'s `POST_MEDIA_BUCKET_NAME` env var either way, so nothing is lost operationally.

### Design decision: `Cache-Control` enforced at the CDN layer, not left to the uploader

AD-12 Rule 2 says objects are "served with `Cache-Control: public, max-age=31536000, immutable`." This could be set either as S3 object metadata at `PutObject` time (the later upload-logic story's responsibility) or enforced centrally via a CloudFront `ResponseHeadersPolicy` with `override: true`. This story chooses the latter (Task 3) so the guarantee lives entirely in this story's infra scope — the later upload-logic story does not need to remember to set correct metadata on every write for the header to be correct; CloudFront overrides whatever the origin sends.

### `grantPut()` scope note

`s3.Bucket.grantPut()` (CDK's standard write-grant helper, used here for parity with this file's existing `.grantRead()`/`.grantSendEmail()`/`.grantEncryptDecrypt()` idiom) grants a small write-adjacent action set beyond bare `s3:PutObject` (object tagging, legal hold/retention, multipart abort) — it does **not** grant any read, list, or delete action. This satisfies AC6/the task's "write (PutObject) to the new bucket; read-only for everything else" requirement: `aiProcessorLambda` gets no read/list/delete access either, matching AD-12's "only CloudFront reads, only the extraction Lambda writes" model exactly.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story provisions/wires AWS infrastructure (CDK) only — no Drizzle schema change, no `packages/database` migration, no `@festgrid/shared-types` change, no GraphQL contract change. `posts.durableImageUrl`/`posts.imageUrlExpiresAt` (AD-12 Rules 1/3) are explicitly a later story's scope (see AC9).
- Impacted fields/contracts: None.
- Required DB migration changes: None.
- Required TypeScript type changes: None. `apps/backend/src/env.ts`'s `BackendEnv` interface is unchanged — the two new env vars are wired to the Lambda's deployed environment only; no backend code reads `process.env.POST_MEDIA_*` yet.
- Backward compatibility and rollout notes: Purely additive — a new S3 bucket, CloudFront distribution, response headers policy, IAM grant, and two Lambda env vars. No existing resource is modified in a breaking way.
- Verification checks: Task 5/7's CDK assertion tests and `cdk synth` prove the wiring is structurally correct; a real end-to-end verification (an actual `PutObject` call succeeding against a deployed bucket, and CloudFront actually serving the header) is deferred to the later upload-logic story plus CI's first real deploy, consistent with Stories 0.14/0.25/0.27's own precedent.

### Project Structure Notes

- **Modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts` (adds `postMediaBucket`, `postMediaCacheHeadersPolicy`, `postMediaDistribution`, `postMediaBucket.grantPut(aiProcessorLambda)`, two new `aiProcessorLambda` env vars), `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (new assertions), `SETUP_WALKTHROUGH.md` (brief note).
- **Not modified:** `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lib/ai-processor/*` (incl. `build-gemini-request.ts`, `process-ai-job.ts`), `apps/backend/src/env.ts`, `packages/database/schema.ts`, `packages/domain`, `packages/graphql-select`, `packages/ui`, `turbo.json`, root `.env.example` (no new secret is introduced; the two new vars are CDK-generated, not `.env`-sourced).
- Detected conflicts or variances: None — `festgrid-backend-stack.ts` (read in full, current `master`) has no existing `aws-s3`/`aws-cloudfront` import and no prior S3/CloudFront construct, confirming this is genuinely the first such resource in the project, consistent with the sprint-change-proposal's own framing.

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-video-priority-display.md`] — Section 1.4 (cost analysis, CloudFront-Always-Free-tier rationale), Section 4.4 (AD-12 full text), Section 7 (wave plan placing this story in Wave 1, independent of Stories 3.3c/1.6a).
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12`] — binding design spec: private bucket + OAC + CloudFront (Rule 2), scope boundary excluding non-extracted posts and `videoUrl` (Rules 3/4), no expiry-triggered deletion (Rule 6).
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.ts`] — read in full (current `master`); confirmed exact `aiProcessorLambda`/`definedEnv`/`removalPolicy` construct names and the existing `secretsmanager.Secret`/`.grantRead()` idiom this story's `s3.Bucket`/`.grantPut()` mirrors.
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.test.ts`] — read in full; current assertion shape (7 Lambdas, 6 SQS queues, 7 Secrets) this story's Task 5 extends without changing those counts.
- [Source: `apps/backend/src/lib/ai-processor/build-gemini-request.ts`] — read in full; confirmed the `fetch(message.imageUrl)` byte-fetch AD-12 Rule 1 reuses, and that it is invoked from both `process-ai-job.ts` (automated pipeline) and `resolvers.ts`'s `extractEventDataFromUrl` (manual preview mutation) — resolved which Lambda gets the grant (see Dev Notes above).
- [Source: `apps/backend/src/schema/resolvers.ts:1091-1220`] — read `extractEventDataFromUrl` in full; confirmed it is a preview/no-persistence flow, out of AD-12's re-hosting scope.
- [Source: `_bmad-output/implementation-artifacts/0-27-provision-the-notifier-lambda-s-infrastructure-and-ses-send-permission.md`] — read in full; mirrored its Gate 1/3 "run fresh, cite escape hatch" reasoning, its Dev Notes/Implementation Plan/Pre-Coding Gate shape, and its precedent for infra-only stories deferring real `cdk deploy` verification.
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml`] — `0-33-provision-s3-cloudfront-infrastructure-for-post-media` entry and its originating comment block.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md`] — confirmed `swept: true` but dated 2026-08-03, `stories_covered` starting at `0.1`; basis for running Gate 1/3 fresh.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, execution protocol, escape-hatch guard.
- [Source: `docs/infrastructure/index.md`] — sharded infra architecture index; no dedicated S3/CloudFront/media-CDN shard exists yet (consistent with this being the first such resource).

## Global Rules References

- `_bmad-output/project-context.md` — Security (Credential Management: the new env vars are plain CDK-generated values, not credentials, so no Secrets Manager entry is warranted), Technology Stack (AWS serverless, CDK).
- `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12` — the binding design spec this story implements (Rule 2 specifically; Rules 1/3/4/5/6 govern the later application-code story).
- `docs/infrastructure/index.md` — no existing shard describes S3/CloudFront; this story adds the first such resource but does not itself update the sharded docs (no shard file currently owns "object storage/CDN" as a topic — left for a documentation pass, not blocking this story's IaC scope).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts`, `apps/infrastructure/lib/festgrid-backend-stack.test.ts`, `SETUP_WALKTHROUGH.md`.
- **Not modified:** `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lib/ai-processor/*`, `apps/backend/src/env.ts`, `packages/database/schema.ts`, `packages/domain`, `packages/graphql-select`, `packages/ui`, `turbo.json`, `.env.example`.

### Rule Mapping

- AD-12 Rule 2 (private bucket, OAC, CloudFront, immutable Cache-Control) → Tasks 2/3: `s3.BlockPublicAccess.BLOCK_ALL`, `origins.S3BucketOrigin.withOriginAccessControl`, `cloudfront.ResponseHeadersPolicy` with `override: true`.
- AD-12 Rule 1 ("only the AI-extraction Lambda writes") → Task 4: `postMediaBucket.grantPut(aiProcessorLambda)` only, no grant to `apiLambda`/other Lambdas (see Dev Notes "Which Lambda gets the write grant").
- "Wire the bucket name / distribution domain into that Lambda's environment configuration the same way `GEOAPIFY_API_KEY`/`SYSTEM_GEMINI_API_KEY` were wired in" (task instructions, Stories 0.25/AD-10 precedent) → Task 4: two new plain values added directly to `aiProcessorLambda`'s existing `environment` object literal, same pattern.
- Gate 1/2/3 — evaluated and resolved directly above (Architecture & UX Gate Findings); no new prerequisite story required.
- "Do NOT run `cdk deploy` or provision anything against real AWS" (explicit task boundary) → Task 7's verification is `cdk synth` + assertion tests only; AC10 makes this explicit.

### Verification Plan

- `pnpm --filter infrastructure exec cdk synth` succeeds for all three (`dev`/`staging`/`prod`) stack instances with the new bucket/distribution/grants included (Task 7).
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts`: extended `aws-cdk-lib/assertions` checks — 1 S3 bucket (public access blocked), 1 CloudFront distribution, 1 OAC, `s3:PutObject` IAM policy statement present, `aiProcessorLambda`'s environment contains the two new vars (Task 5/8).
- `pnpm build`/`pnpm lint` clean at the repo root for `apps/infrastructure`.
- `git diff` against `ai-processor.ts`/`build-gemini-request.ts`/`process-ai-job.ts`/`env.ts`/`schema.ts` is empty, proving this story did not touch application code (Task 7/AC9).
- Explicitly recorded as deferred (not a failure): a real `cdk deploy` plus an actual `PutObject` call against a live bucket and a real CloudFront-served response header check — no AWS credentials available in this development environment (Task 7), mirroring Stories 0.14/0.25/0.27's own precedent.

## Pre-Coding Approval Gate

- [x] Scope confirmation: provision a private S3 bucket + OAC-fronted CloudFront distribution + a Cache-Control response headers policy + a scoped `s3:PutObject` grant to `aiProcessorLambda` only + two new plain env vars on that same Lambda — zero application-code changes (`ai-processor.ts`, `build-gemini-request.ts`, `env.ts`, `schema.ts` all untouched).
- [x] Architecture and boundary confirmation: first S3/CloudFront resource in the project, inlined directly into `festgrid-backend-stack.ts` (Gate 3: no gap, no generic construct extraction — no second consumer exists yet); write grant scoped exclusively to `aiProcessorLambda`, resolving the two-caller ambiguity in `build-gemini-request.ts`'s usage (automated pipeline vs. manual preview mutation) in favor of the automated pipeline per AD-12 Rule 1/4 (see Dev Notes).
- [x] Testing plan confirmation: extended `festgrid-backend-stack.test.ts` assertions (S3 bucket public-access-block, CloudFront distribution + OAC, scoped IAM policy, Lambda env vars) plus `cdk synth`; a real `cdk deploy` and live `PutObject`/CDN-response check against real AWS is explicitly deferred (no AWS credentials in this environment, matches explicit task boundary).
- [x] Explicit human approval state: **pre-authorized.** This story was dispatched as Wave 1 of an already-approved Sprint Change Proposal (`sprint-change-proposal-2026-08-25-video-priority-display.md`), with AD-12 as the binding, already-decided design spec covering every scope item in this story. Gate 1/2/3 (above) found no gap and no undecided design tradeoff requiring `AskUserQuestion` — the only two implementation-mechanics calls made while drafting (omitting an explicit `bucketName`; enforcing `Cache-Control` via a CloudFront response-headers policy rather than upload-time object metadata) are correctness/architecture-fit decisions with a documented rationale, not open product/design tradeoffs, so per this workflow's own guidance they were resolved directly rather than escalated.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — no gap, self-contained IaC. Gate 2 — no gap, zero UI surface. Gate 3 — no gap, first-of-its-kind resource correctly inlined rather than prematurely abstracted; CDK version confirmed to support the L2 OAC constructs used.
- [x] **Write-grant scope accepted:** `aiProcessorLambda` only (not `apiLambda`, despite `apiLambda` also calling `buildGeminiExtractionRequest` via `extractEventDataFromUrl`) — that path is a no-persistence preview mutation, explicitly out of AD-12's re-hosting scope (see Dev Notes).

## Testing Requirements

- [x] Infrastructure assertion tests (required): extended `apps/infrastructure/lib/festgrid-backend-stack.test.ts` via `node:test`/`tsx --test` and `aws-cdk-lib/assertions`, proving the new bucket/distribution/OAC/IAM-grant/env-var wiring (Task 5). Result: 1 pass, 0 fail.
- [x] Synth verification (required): `cdk synth` succeeded for all three stage instances with the new resources included (Task 7).
- [x] Integration tests: Not applicable — no application logic changes in `apps/backend` (Task 7 confirmed zero diff on the relevant application files).
- [x] E2E tests: Not applicable — no UI in this story.
- [ ] Manual verification (deferred, tracked): a real `cdk deploy` plus an actual `PutObject`/CloudFront-response-header check against a live AWS account, verified the first time CI's deploy job runs and the later upload-logic story lands (no AWS credentials available in this development environment).

## Deliverables Checklist

- [x] `FestgridBackendStack` provisions `postMediaBucket` (private, `BLOCK_ALL`, no explicit `bucketName`) and `postMediaDistribution` (OAC origin, `Cache-Control` response headers policy).
- [x] `postMediaBucket.grantPut(aiProcessorLambda)` added, and confirmed (via the synthesized template's IAM policies) no other Lambda receives a grant on this bucket.
- [x] `aiProcessorLambda`'s environment gains `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN`.
- [x] Extended `festgrid-backend-stack.test.ts` assertions passing.
- [x] `SETUP_WALKTHROUGH.md` updated with the brief no-manual-setup/no-new-secret note.
- [x] `pnpm build`/`pnpm lint` pass at the repo root for `apps/infrastructure` (0 tasks — no scripts defined, matching Story 0.27's precedent).
- [x] `ai-processor.ts`/`build-gemini-request.ts`/`process-ai-job.ts`/`env.ts`/`schema.ts` confirmed byte-for-byte unchanged.

## Out of Scope

- Any change to `apps/backend/src/lambdas/ai-processor.ts`, `apps/backend/src/lib/ai-processor/*` (the actual "upload the already-fetched image bytes to this bucket" logic) — a later story in this same wave sequence, per AD-12 Rule 1.
- `posts.durableImageUrl`/`posts.imageUrlExpiresAt` DB columns and any Drizzle migration — a later story (AD-12 Rules 1/3).
- The Event GraphQL resolver's original-vs-durable `imageUrl` serving logic — a later story (AD-12 Rule 3).
- Granting `s3:PutObject` to `apiLambda` for the manual `extractEventDataFromUrl` preview mutation — explicitly out of AD-12's current scope (see Dev Notes); would require a fresh AD-12 amendment if ever needed.
- A generic, reusable "CDN-fronted S3 bucket" CDK construct/helper — considered under Gate 3 and declined as premature abstraction with no second consumer.
- A real `cdk deploy` against a live AWS account, and any live `PutObject`/CloudFront-response verification, as part of this story's own automated verification — no AWS credentials available in this development environment; deferred to CI's first real deploy and the later upload-logic story.
- Any sharded `docs/infrastructure/*.md` documentation update describing this new resource — left for a documentation pass, not blocking this story's IaC scope.

## Definition of Done

- [x] AC 1-10 satisfied.
- [x] `cdk synth` succeeds for all three stage instances with the new bucket/distribution/grants included (Task 7).
- [x] `apps/infrastructure` assertion tests passing, including the new bucket/distribution/OAC/IAM/env-var assertions (Task 5/7).
- [x] `pnpm lint` and `pnpm build` passing for `apps/infrastructure`.
- [x] `SETUP_WALKTHROUGH.md` updated (Task 6).
- [x] `ai-processor.ts`/`build-gemini-request.ts`/`process-ai-job.ts`/`env.ts`/`schema.ts` confirmed unmodified.
- [x] Pre-Coding Approval Gate explicitly recorded above, including the write-grant-scope decision and the pre-authorization basis.

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via Claude Code, implementing directly. (Two delegated dispatches to `gemini-cli` were attempted first per this project's usual coding-delegation convention — `gemini-2.5-pro`/the account's default model were unavailable under this Vertex AI project/region, `gemini-2.5-flash` initially hung for ~23 minutes with zero file changes tracing to a missing `ripgrep` binary forcing gemini-cli's slow JS-based grep fallback over this worktree's full `node_modules`, and a second attempt after installing `ripgrep` made real progress — adding the three CDK imports — before hanging again for 13+ minutes mid-verification with no further file changes. Given the cumulative delegation time already spent and the story's own fully-specified design, the remaining implementation was completed directly rather than continuing to retry the delegation.)

### Debug Log References

- `pnpm exec tsx --test lib/**/*.test.ts` (apps/infrastructure): 1 pass, 0 fail — confirmed the new S3/CloudFront/IAM/env-var assertions (and the updated 8-Lambda count) all pass.
- `pnpm exec cdk synth` (apps/infrastructure, with `.env` sourced + `SES_FROM_EMAIL_ADDRESS`/`WEB_APP_BASE_URL` placeholders set for this pre-existing local-verification gap — see Dev Notes): succeeded, producing `FestgridBackendStack-dev.template.json`, `FestgridBackendStack-staging.template.json`, `FestgridBackendStack-prod.template.json` in `cdk.out/` — all three contain exactly 1 `AWS::S3::Bucket` (public access fully blocked), 1 `AWS::CloudFront::Distribution`, 1 `AWS::CloudFront::OriginAccessControl`; dev/staging show 8 Lambdas, prod shows 7 (no `autoDeleteObjects` custom-resource Lambda in prod, matching `removalPolicy: RETAIN`).
- Inspected the synthesized `FestgridBackendStack-dev.template.json` directly: confirmed the bucket policy grants `s3:GetObject` only to the CloudFront service principal, condition-scoped to this specific distribution's `SourceArn`; confirmed only `AIProcessorLambdadevServiceRoleDefaultPolicy` references `s3:PutObject` (no other Lambda's policy does); confirmed the `ResponseHeadersPolicy`'s `CustomHeadersConfig` carries exactly `Cache-Control: public, max-age=31536000, immutable` with `Override: true`.
- `pnpm build --filter=infrastructure` and `pnpm lint --filter=infrastructure` (repo root): both "0 tasks" (package defines no build/lint scripts) — clean, no failures, matching Story 0.27's identical precedent.
- `git diff --stat -- apps/backend/src/lambdas/ai-processor.ts apps/backend/src/lib/ai-processor/ apps/backend/src/env.ts packages/database/schema.ts`: empty — confirmed byte-for-byte unchanged.

### Completion Notes List

- Reused the 3 import lines (`aws-s3`, `aws-cloudfront`, `aws-cloudfront-origins`) already added by the first, partially-productive `gemini-cli` dispatch before it hung; reverted that dispatch's out-of-scope side effects (a root-level `pnpm build` it ran as part of "confirming baseline" modified generated files outside this story's scope — `apps/backend/src/generated/resolvers-types.ts`, `apps/web/public/maplibre-gl-{shared,worker}.mjs`, `apps/web/src/generated/graphql.ts` — all reverted via `git checkout --` before continuing).
- Implemented `postMediaBucket`/`postMediaCacheHeadersPolicy`/`postMediaDistribution` (Tasks 2/3), the `grantPut` IAM grant + two Lambda env vars (Task 4), and the CDK assertion tests (Task 5) directly.
- Discovered mid-verification (not anticipated when AC8 was drafted) that `autoDeleteObjects: true` on the new bucket provisions a shared CDK-internal `Custom::S3AutoDeleteObjects` Lambda in non-prod stages, bumping the pre-existing Lambda-count assertion from 7 to 8 (`prod` stays at 7) — documented in Dev Notes, test updated accordingly with an explanatory comment.
- Discovered mid-verification that `cdk synth` fails on missing prod-required env vars (`SES_FROM_EMAIL_ADDRESS`/`WEB_APP_BASE_URL` absent from this worktree's copied `.env`) even for a synth-only, no-deploy check — confirmed via a stash-and-reproduce test that this is pre-existing `master` behavior, unrelated to this story's own diff. Verified `cdk synth` with those two vars set to synth-time-only placeholders; no code change made to the guard itself (out of this story's scope).
- Deferred (not a failure, mirrors Stories 0.14/0.25/0.27's own precedent): an actual `cdk deploy` plus a real `PutObject` call against a live bucket and a real CloudFront-served response-header check — no AWS credentials available in this development environment.

### File List

- Modified: `apps/infrastructure/lib/festgrid-backend-stack.ts`
- Modified: `apps/infrastructure/lib/festgrid-backend-stack.test.ts`
- Modified: `SETUP_WALKTHROUGH.md`
- Modified: `_bmad-output/implementation-artifacts/0-33-provision-s3-cloudfront-infrastructure-for-post-media.md` (this story file — Tasks/Subtasks, Dev Notes, Testing Requirements, Deliverables Checklist, Definition of Done, Completion Status, Dev Agent Record, Status)
