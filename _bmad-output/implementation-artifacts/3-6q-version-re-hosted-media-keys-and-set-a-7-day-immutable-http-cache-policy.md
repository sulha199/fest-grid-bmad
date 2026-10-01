---
baseline_commit: aa5db9d0f72a99a4eafe608f2c4385ae659c124f
---

# Story 3.6q: Version re-hosted media keys and set a 7-day immutable HTTP cache policy

## Story Details

- Epic: 3
- Story ID: 3.6q
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want re-hosted event images to be cached efficiently by my browser but stop appearing once they are deleted or replaced,
so that pages load fast without a deleted or re-blurred image lingering on my device for a year.

## Acceptance Criteria

1. **Given** a post's image is re-hosted (`rehostPostImage`, Story 3.6e), **when** the upload runs, **then** the S3 key is content-versioned — `posts/{postId}/full-{hash8}.{ext}`, where `hash8` is the first 8 hex characters of the SHA-256 hash of the exact bytes being uploaded, and `ext` is derived from the upload's content type (`image/jpeg`→`jpg`, `image/png`→`png`, `image/webp`→`webp`, anything else/missing→`jpg`) — replacing today's fixed `posts/{postId}` key (no extension, no versioning). `posts.durableImageUrl` holds the resulting CloudFront URL (`https://${postMediaCdnDomain}/${key}`), exactly as it does today.
2. **Given** the key format in AC1, **when** the key-building logic is implemented, **then** a shared, pure key-building helper (`buildPostMediaKey`) is exported from `packages/domain` — parameterized by a `variant: 'full' | 'thumb'` so the exact same helper produces Story 3.6n's future `posts/{postId}/thumb-{hash8}.jpg` keys (thumbnails are always `.jpg` regardless of `variant`'s `ext` input) without that story needing to re-derive the format.
3. **Given** a post already has a `durableImageUrl` pointing at an S3 key (old flat-key format or a previously-versioned key), **when** `rehostPostImage` uploads a new object under a *different* key for the same post, **then** after the new upload and DB update succeed, the previous S3 object is deleted and its CloudFront path is invalidated — both best-effort: failures are caught and logged, never thrown, and never block or undo the already-committed new `durableImageUrl`. If the newly computed key is identical to the existing one (same content re-uploaded, e.g. an SQS redelivery retry), no delete/invalidate call is made at all (true no-op, not a same-key delete-then-recreate).
4. **Given** the media CloudFront distribution's response-headers policy (`PostMediaCacheHeadersPolicy`, `apps/infrastructure/lib/festgrid-backend-stack.ts`), **when** this story ships, **then** its `Cache-Control` header value changes from `public, max-age=31536000, immutable` (1 year) to `public, max-age=604800, immutable` (7 days), and the surrounding code comment is updated to describe content-versioned keys rather than "write-once" files.
5. **Given** existing `posts` rows whose `durableImageUrl` still points at the old flat `posts/{postId}` key format, **when** a one-time, idempotent backfill script is run, **then** for each such row it: re-fetches the object's current bytes from S3 (not from the original, long-expired source URL), computes its versioned key per AC1, uploads it under the new key, updates `posts.durableImageUrl` to the new CloudFront URL, and deletes the old S3 object + invalidates its CloudFront path (batched, best-effort). A row whose `durableImageUrl` already matches the versioned-key pattern is skipped with no S3/CloudFront calls at all (re-running the backfill after a successful run, or over a mix of migrated/unmigrated rows, is a no-op for already-migrated rows and idempotent for the rest).
6. **Given** this story's scope, **when** it ships, **then** no service worker or browser Cache API image-caching layer is introduced anywhere (AD-28 Rule 9 — HTTP cache only).
7. **Given** the new key-building helper and the updated `rehostPostImage` write path, **when** this story's test suite runs, **then** unit tests cover the helper (stable hash-based key for identical bytes, correct extension handling per content type, `full` vs `thumb` variant behavior) and integration tests cover `rehostPostImage`'s write path (first upload with no prior `durableImageUrl`; a second upload for the same post with different bytes deletes/invalidates the old key; a second upload with identical bytes is a no-op on delete/invalidate); an infrastructure assertion test (`aws-cdk-lib/assertions`, mirroring `festgrid-backend-stack.test.ts`'s existing pattern) asserts the new `Cache-Control` header value and the new `cloudfront:CreateInvalidation` IAM grant.

## Tasks / Subtasks

- [ ] **Task 1: `buildPostMediaKey` + extension-resolution pure helpers** (AC: 1, 2) — new `packages/domain/src/posts/`
  - [ ] Create `packages/domain/src/posts/build-post-media-key.ts` exporting:
    ```ts
    export type PostMediaVariant = 'full' | 'thumb';

    export function buildPostMediaKey(
      postId: string,
      variant: PostMediaVariant,
      hash8: string,
      ext: string
    ): string {
      if (!/^[0-9a-f]{8}$/.test(hash8)) {
        throw new Error(`buildPostMediaKey: hash8 must be exactly 8 lowercase hex characters, got "${hash8}"`);
      }
      const resolvedExt = variant === 'thumb' ? 'jpg' : ext; // thumbnails are always re-encoded JPEG (Story 3.6n, AD-28 Rule 5)
      return `posts/${postId}/${variant}-${hash8}.${resolvedExt}`;
    }

    const CONTENT_TYPE_TO_EXT: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    export function resolvePostMediaExtension(contentType: string | undefined | null): string {
      return (contentType && CONTENT_TYPE_TO_EXT[contentType.toLowerCase()]) || 'jpg';
    }

    const VERSIONED_KEY_PATTERN = /^posts\/[^/]+\/(full|thumb)-[0-9a-f]{8}\.\w+$/;

    export function isVersionedPostMediaKey(key: string): boolean {
      return VERSIONED_KEY_PATTERN.test(key);
    }

    export function extractPostMediaKeyFromUrl(cdnDomain: string, url: string | null | undefined): string | null {
      if (!url) return null;
      const prefix = `https://${cdnDomain}/`;
      return url.startsWith(prefix) ? url.slice(prefix.length) : null;
    }
    ```
    (`isVersionedPostMediaKey`/`extractPostMediaKeyFromUrl` are the two small pure pieces Task 3's `rehostPostImage` change and Task 6's backfill script both need to decide "is there an old key to clean up, and is it already in the new format" — kept here rather than duplicated in two apps/backend call sites.)
  - [ ] Zero DB/Node-runtime-only/React dependencies — pure string/regex logic only, matching `parseImageUrlExpiry`'s existing frontend-safety precedent (`packages/domain/src/scraper/parse-image-url-expiry.ts`) even though every current caller is backend-only.
  - [ ] Add `packages/domain/src/posts/build-post-media-key.test.ts`, 100% coverage: `buildPostMediaKey` — valid `full`/`thumb` inputs produce the exact expected string; `thumb` variant ignores its `ext` argument and always yields `.jpg`; an invalid (wrong-length or uppercase/non-hex) `hash8` throws. `resolvePostMediaExtension` — each of the 3 mapped content types, an unmapped type, and `undefined`/`null`, all 5 cases. `isVersionedPostMediaKey` — a versioned key (both variants) returns true; the old flat `posts/{postId}` key, and an unrelated string, return false. `extractPostMediaKeyFromUrl` — a URL matching the CDN domain prefix returns the stripped key; a non-matching URL and a `null`/`undefined` input both return `null`.
  - [ ] Export from `packages/domain/src/posts/index.ts` (currently only `export * from "./types.js";` — add `export * from "./build-post-media-key.js";` alongside it). Already exposed to consumers via the existing `./posts` subpath export in `packages/domain/package.json` (no `package.json`/`exports` change needed — verified by reading it: the subpath already exists).

- [ ] **Task 2: `@aws-sdk/client-cloudfront` dependency** (AC: 3) — `apps/backend/package.json`
  - [ ] Add `@aws-sdk/client-cloudfront` at a version consistent with this repo's existing `@aws-sdk/*` pinning (`^3.1100.0`, matching `@aws-sdk/client-s3`/`@aws-sdk/client-sqs`/`@aws-sdk/client-sesv2` — check the latest compatible `3.x` release at install time rather than blindly copying one exact version, same convention Story 3.6e's Task 5 followed).
  - [ ] `pnpm install` (repo root or `apps/backend`) to update the lockfile.

- [ ] **Task 3: Rewrite `rehostPostImage`'s write path — versioned key, old-object cleanup** (AC: 1, 2, 3) — `apps/backend/src/lib/ai-processor/rehost-post-image.ts`
  - [ ] Add a second client seam alongside the existing `s3ClientInstance`/`setS3ClientInstance`: `export let cloudFrontClientInstance = new CloudFrontClient({});` + `export function setCloudFrontClientInstance(client: CloudFrontClient) { ... }` (mirrors the existing S3 seam exactly, for the same test-mocking reason).
  - [ ] Inside `rehostPostImage(postId, imageBytes, imageContentType, env)`, after the existing `postMediaBucketName`/`postMediaCdnDomain` guard (keep that early-return exactly as is):
    1. Before touching S3, read the post's *current* `durableImageUrl` from the DB (`db.select({ durableImageUrl: posts.durableImageUrl }).from(posts).where(eq(posts.id, postId)).limit(1)`) and derive `previousKey = extractPostMediaKeyFromUrl(postMediaCdnDomain, currentRow?.durableImageUrl)`.
    2. Compute `const hash8 = createHash('sha256').update(imageBytes).digest('hex').slice(0, 8);` (`import { createHash } from 'node:crypto';`) and `const ext = resolvePostMediaExtension(imageContentType);`.
    3. `const key = buildPostMediaKey(postId, 'full', hash8, ext);` — replaces the old `` const key = `posts/${postId}` `` line.
    4. Upload exactly as today (`PutObjectCommand`, same `Bucket`/`Body`/`ContentType` shape), then the same `db.update(posts).set({ durableImageUrl }).where(eq(posts.id, postId))` as today.
    5. **After** the upload + DB update both succeed, if `previousKey` is truthy and `previousKey !== key`: in a nested `try/catch` (never allowed to affect the function's return value), `await s3ClientInstance.send(new DeleteObjectCommand({ Bucket: postMediaBucketName, Key: previousKey }))`, then `await cloudFrontClientInstance.send(new CreateInvalidationCommand({ DistributionId: env.postMediaDistributionId, InvalidationBatch: { CallerReference: `${postId}-${hash8}-${Date.now()}`, Paths: { Quantity: 1, Items: [`/${previousKey}`] } } }))`. Catch, `console.error` (naming both `postId` and `previousKey`), and return the *new* `durableImageUrl` regardless — AC3's "never block or undo the already-committed new value."
    6. If `previousKey === key` (identical content re-uploaded), skip step 5 entirely — no delete, no invalidation call (true no-op per AC3).
  - [ ] Keep the function's existing outer `try/catch`-returns-`null`-on-any-thrown-error shape for the upload/DB-update path itself (Story 3.6e's AC7 "never block extraction" guarantee, unchanged) — only the new cleanup step (5) gets its own inner catch so a cleanup failure can never turn a successful rehost into a `null` return.
  - [ ] `env.postMediaDistributionId` is a new field on `BackendEnv` — see Task 5.

- [ ] **Task 4: CDK — versioned-key cache policy, CloudFront invalidation grant, backfill-resolvable outputs** (AC: 1, 3, 4) — `apps/infrastructure/lib/festgrid-backend-stack.ts`
  - [ ] Change `postMediaCacheHeadersPolicy`'s `Cache-Control` header value from `'public, max-age=31536000, immutable'` to `'public, max-age=604800, immutable'`.
  - [ ] Update the comment immediately above it (currently: *"Cache-Control is enforced centrally at the CDN layer ... since each object is a unique, write-once file"*) to describe the new model: Cache-Control is still enforced centrally at the CDN layer (unchanged reasoning), but the guarantee is now "7-day immutable caching of a *content-versioned* key" — a changed or re-blurred image gets a brand-new key/URL rather than overwriting the old one in place, so `immutable` stays safe at a shorter TTL that bounds how long a deleted/replaced object can linger in a browser that never revisits the page (AD-28 Rule 9's exact reasoning — cite it in the comment).
  - [ ] Add `POST_MEDIA_DISTRIBUTION_ID: postMediaDistribution.distributionId` to `aiProcessorLambda`'s `environment` block, alongside the existing `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN`.
  - [ ] Add `postMediaBucket.grantDelete(aiProcessorLambda);` and `postMediaDistribution.grantCreateInvalidation(aiProcessorLambda);` immediately after the existing `postMediaBucket.grantPut(aiProcessorLambda);` line (same comment block — update it to note the bucket grant is now "write + delete" and name the new CloudFront grant, since that comment currently says "write-only, scoped exclusively to the AI-extraction Lambda" and would otherwise go stale). `grantCreateInvalidation` is a real method on this CDK version's `Distribution` class (`aws-cdk-lib@2.263.0`, confirmed by reading `aws-cloudfront/lib/distribution.d.ts` directly) — no hand-rolled IAM policy statement needed.
  - [ ] Add three new `CfnOutput`s (mirroring the existing `opsBackfillBucketName` output's exact shape/pattern) so Task 6's backfill workflow can resolve them without hardcoding stage-specific values:
    ```ts
    new cdk.CfnOutput(this, `postMediaBucketNameOutput`, {
      value: postMediaBucket.bucketName,
      description: 'S3 bucket for durable post-media hosting (re-hosted images/thumbnails)',
      exportName: `festgrid-post-media-bucket-${stageName}`,
    });
    new cdk.CfnOutput(this, `postMediaCdnDomainOutput`, {
      value: postMediaDistribution.distributionDomainName,
      description: 'CloudFront domain serving durable post-media',
      exportName: `festgrid-post-media-cdn-domain-${stageName}`,
    });
    new cdk.CfnOutput(this, `postMediaDistributionIdOutput`, {
      value: postMediaDistribution.distributionId,
      description: 'CloudFront distribution ID for durable post-media (needed for invalidations)',
      exportName: `festgrid-post-media-distribution-id-${stageName}`,
    });
    ```
    (Named with an `...Output` suffix, not reusing `postMediaBucketName`/`postMediaCdnDomain` as construct IDs, since those identifiers are already taken by the env-var *keys* used elsewhere in this same file's `definedEnv`/environment blocks — avoids any identifier collision, construct IDs are a separate namespace from env-var strings but keeping them visually distinct avoids confusion on re-read.)
  - [ ] Update `apps/infrastructure/lib/festgrid-backend-stack.test.ts`'s existing test 14 (L_AI environment assertion) to also assert `POST_MEDIA_DISTRIBUTION_ID: Match.anyValue()` in the `Match.objectLike({...})` block.
  - [ ] Add a new test asserting the `Cache-Control` response-header value: `template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', { ResponseHeadersPolicyConfig: Match.objectLike({ CustomHeadersConfig: { Items: Match.arrayWith([Match.objectLike({ Header: 'Cache-Control', Override: true, Value: 'public, max-age=604800, immutable' })]) } }) });` — verify the exact synthesized property path by running `cdk synth`/inspecting `template.toJSON()` for `AWS::CloudFront::ResponseHeadersPolicy` first (the nesting shown here is CloudFront's documented CFN shape; confirm against this project's actual synthesized output before asserting, since a guessed-wrong nesting path fails loudly rather than silently).
  - [ ] Add a new test asserting the `cloudfront:CreateInvalidation` IAM grant exists: `template.hasResourceProperties('AWS::IAM::Policy', { PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: 'cloudfront:CreateInvalidation', Effect: 'Allow' })]) } });` (CDK's `grantCreateInvalidation` grants exactly this one action — confirm the exact `Action` shape, string vs. single-element array, against the real synthesized template rather than assuming).
  - [ ] This is the **first CDK infra assertion test added by a story since `festgrid-backend-stack.test.ts` was created** (confirmed: no other `*.test.ts` file under `apps/infrastructure` exists, and the file's own tests don't yet cover `ResponseHeadersPolicy` properties at all) — there is no narrower existing precedent for asserting a `ResponseHeadersPolicy`'s header value specifically; follow the same `Template`/`Match` API already used for every other assertion in that file (`aws-cdk-lib/assertions`), run via the existing `tsx --test "lib/**/*.test.ts"` script — no new test tooling/dependency needed.

- [ ] **Task 5: `postMediaDistributionId` env plumbing** (AC: 3) — `apps/backend/src/env.ts`
  - [ ] Add `postMediaDistributionId?: string;` to the `BackendEnv` interface, alongside the existing `postMediaBucketName?`/`postMediaCdnDomain?` fields.
  - [ ] In `loadBackendEnv()`, read it: `postMediaDistributionId: process.env.POST_MEDIA_DISTRIBUTION_ID,` with the same `// eslint-disable-next-line turbo/no-undeclared-env-vars` comment every other `process.env.*` read in this file already carries.

- [ ] **Task 6: One-time idempotent backfill script** (AC: 5) — new `apps/backend/src/backfill-post-media-keys.ts`
  - [ ] Follow `apps/backend/src/trigger-brightdata-onetime.ts`'s existing placement/invocation convention (a standalone `tsx`-run script directly under `apps/backend/src/`, `#!/usr/bin/env tsx` shebang, `process.argv`-based args) rather than `packages/database/backfill-scraper-actor-runs.ts`'s pattern — this backfill needs S3 + CloudFront + DB together, which only `apps/backend` already has wired (env vars, S3 client style); `packages/database` has no AWS SDK dependency and shouldn't gain one just for this.
  - [ ] Modes, mirroring `backfill-scraper-actor-runs.ts`'s sizing/backfill split and its `--apply`-gated dry-run-by-default safety convention:
    - `tsx src/backfill-post-media-keys.ts sizing` — read-only. Counts `posts` rows where `durableImageUrl IS NOT NULL AND NOT (durableImageUrl matching the versioned-key pattern)` (use `extractPostMediaKeyFromUrl` + `isVersionedPostMediaKey` from `@festgrid/domain/posts` against each row — a plain SQL regex on the full URL is a valid alternative if simpler, dev's call, but must apply the exact same `isVersionedPostMediaKey` semantics, not a hand-rolled duplicate check).
    - `tsx src/backfill-post-media-keys.ts backfill [--apply]` — without `--apply`, dry run: lists every row it *would* migrate (postId, current key, computed new key) and writes nothing. With `--apply`: for each row needing migration — `GetObjectCommand` the current key's bytes + `ContentType` from S3 (not the original, long-expired source URL), then call `rehostPostImage(postId, bytes, contentType, env)` directly (Task 3's rewritten version) rather than re-implementing the upload/DB-update/cleanup logic a second time — `rehostPostImage` already does exactly "upload at the versioned key, update `durableImageUrl`, delete+invalidate whatever the previous key was" unconditionally, which is precisely this backfill's job per-row. This reuse is why Task 3 designed `rehostPostImage`'s cleanup step generically (keyed off whatever `durableImageUrl` already says) instead of assuming "cleanup only ever happens during live extraction."
  - [ ] Collect every row's old key path from the dry-run listing (or from `rehostPostImage`'s own before/after, if simpler to thread through a return value) and log a final summary count (`migrated: N, skipped-already-versioned: M, failed: K`) — `rehostPostImage`'s own per-row `CreateInvalidationCommand` call (one path each, Task 3) already handles the actual invalidation; this script does not need a second, separately-batched invalidation call layered on top — avoid building that unless profiling in a real run shows CloudFront's per-distribution concurrent-invalidation cap (typically 15) being hit, which is unlikely at this project's current post volume. Record this reasoning in Dev Notes (below) so a future reviewer doesn't wonder why per-row invalidation was left as-is instead of batched.
  - [ ] Never mutate `posts.imageUrl` (the original scraped URL) — only `durableImageUrl` and the underlying S3 objects.
  - [ ] **Not run or tested against a live database in this story-creation session** — this sandbox has no Postgres instance and no AWS credentials (explicit operator instruction; see Dev Notes). The dev-story implementation pass must verify this script's dry-run output against a real (dev-stage) database and S3 bucket before any `--apply` run against staging/prod; this story's own automated tests (Task 7) cover it via mocked S3/CloudFront/DB clients only.
  - [ ] Add a companion manual-dispatch GitHub Actions workflow, `.github/workflows/backfill-post-media-keys.yml`, closely mirroring the existing `.github/workflows/backfill-scraper-audit-trail.yml` structure (checkout, pnpm/node setup, `aws-actions/configure-aws-credentials`, an `apply: boolean` input defaulting to `false`): resolve `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN`/`POST_MEDIA_DISTRIBUTION_ID` via `aws cloudformation describe-stacks --stack-name FestgridBackendStack-<stage> --query "Stacks[0].Outputs[?OutputKey=='...Output'].OutputValue"` against the three new `CfnOutput`s from Task 4, inject them as env vars, then run `cd apps/backend && npx tsx src/backfill-post-media-keys.ts backfill $( [ "${{ inputs.apply }}" = "true" ] && echo --apply )`. Unlike the scraper-audit-trail workflow (which needs an uploaded input file), this backfill needs no S3 input upload step — it reads directly from the `posts` table.

- [ ] **Task 7: Tests** (AC: all)
  - [ ] `packages/domain/src/posts/build-post-media-key.test.ts` — Task 1's cases, 100% coverage.
  - [ ] `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts` (existing file, extend per the established `node:test` + direct-DB-row pattern already used there) — add cases: (a) first-ever upload for a post with no prior `durableImageUrl` produces a versioned key and makes no `DeleteObjectCommand`/`CreateInvalidationCommand` call; (b) a second `rehostPostImage` call for the same post with *different* bytes (different hash) deletes the previous S3 key and issues exactly one `CreateInvalidationCommand` for it, while still returning the new URL even if the mocked delete/invalidation calls are made to reject (cleanup failure must not affect the return value — assert the mock was *called*, not that it must succeed, to exercise the catch path); (c) a second call with *identical* bytes (same hash, same key) makes zero `DeleteObjectCommand`/`CreateInvalidationCommand` calls. Mock both `s3ClientInstance` (existing `setS3ClientInstance` seam) and the new `cloudFrontClientInstance` (new `setCloudFrontClientInstance` seam) via their `send` functions, following this file's existing `vi.mock`-free direct-object-mock style (not `vi.mock`, since this project's `apps/backend` tests run on `node:test`/`tsx --test`, not Vitest — confirmed by this file's own existing imports).
  - [ ] New `apps/backend/src/backfill-post-media-keys.test.ts` (or split into a tested pure-logic module + a thin CLI entrypoint if that proves cleaner for mocking — dev's call) — covers: a row needing migration is correctly identified and (in `--apply` mode) triggers the expected `GetObjectCommand`→`rehostPostImage` call sequence; a row already on a versioned key is skipped with zero S3 calls; dry-run mode (`backfill` with no `--apply`) makes no mutating calls at all.
  - [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` — Task 4's two new assertions (`Cache-Control` value, `cloudfront:CreateInvalidation` grant) plus the updated test-14 environment assertion.
  - [ ] Full verification: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` (100% coverage maintained); `pnpm --filter backend test`; `pnpm --filter infrastructure test`; `pnpm build`, `pnpm lint`, `pnpm test` (root, full suite, no regressions). **This story's creation session did not run any of these** (no Postgres/DB available in this sandbox, per explicit operator instruction) — the dev-story implementation pass owns running and confirming all of the above.

## Dev Notes

**Operator constraint acknowledged during story creation:** this session was explicitly instructed not to run any Postgres or `sudo` commands (no DB available in this sandbox). Accordingly, story creation involved only reading source files (`rehost-post-image.ts`, `festgrid-backend-stack.ts`, `process-ai-job.ts`, `env.ts`, schema, existing tests) and `git`/`grep`/`ls` — no migration was generated or applied, no test suite was run, and no backfill dry run was executed against a real database. All of the above are the dev-story implementation pass's responsibility (Task 7's final bullet).

**No DB schema change in this story.** Unlike Story 3.6e (which added `durableImageUrl`/`imageUrlExpiresAt` columns), this story changes *how* `durableImageUrl` values are constructed and *what S3 key* they point at — it does not add, remove, or retype any column. The backfill (Task 6/AC5) is a **data** migration (rewriting existing S3 objects and `durableImageUrl` string values), not a DDL migration — no `drizzle-kit generate` run, no new file under `packages/database/migrations/`.

**Current state, verified by direct read (do not re-derive from memory):**
- `apps/backend/src/lib/ai-processor/rehost-post-image.ts` (pre-story): uploads to a fixed `` `posts/${postId}` `` key with no extension, writes `durableImageUrl`, has zero delete/cleanup logic, and has only one S3 client seam (`s3ClientInstance`/`setS3ClientInstance`).
- `apps/infrastructure/lib/festgrid-backend-stack.ts` (pre-story, lines ~149-177): `postMediaBucket` (private S3), `postMediaCacheHeadersPolicy` (currently 1-year immutable `Cache-Control`), `postMediaDistribution` (CloudFront + OAC). `aiProcessorLambda`'s environment (~lines 334-350) carries `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN` only — no distribution ID. IAM grants (~line 506): `postMediaBucket.grantPut(aiProcessorLambda)` only — no delete grant, no CloudFront invalidation grant anywhere in the stack.
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` (current, post-3.6h): re-hosting is already gated behind `isOptedIntoImageStorage` (`const skipImageRehost = !isOptedIntoImageStorage;`) and wrapped in a defensive `try/catch` at the call site (step 7.5) — **this story does not touch `process-ai-job.ts` at all**; all of this story's behavior lives inside `rehostPostImage` itself, which `process-ai-job.ts` already calls via the existing `rehostPostImageSeam` indirection.
- `apps/infrastructure/lib/festgrid-backend-stack.test.ts` already exists (`festgrid-backend-stack.test.ts`, 472 lines) using `aws-cdk-lib/assertions`'s `Template`/`Match`, run via `tsx --test "lib/**/*.test.ts"` — this is the **only** existing CDK test file in the repo and the pattern Task 4's new assertions must follow; it does not yet assert anything about `ResponseHeadersPolicy`, so Task 4 is extending test coverage into genuinely new territory for this file, not just adding one more line to an established header-assertion block.
- `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts` uses `node:test`/`node:assert` directly against a real (test-env) DB connection (`db` from `../../db/client.js`) with manual row setup/teardown via `t.after` — **not** Vitest, despite `project-context.md`'s general "testing trophy... Vitest and msw" framing for `apps/*`; this specific file (and `process-ai-job.test.ts`, and every `apps/backend` test file) is established, actual-codebase `tsx --test`/`node:test` precedent and must be followed over the stale doc description — consistent with how Story 3.6e's own test additions already did this without comment.

### Design Decision: Reusing `rehostPostImage` for the Backfill, Not Duplicating It

Task 6's backfill script calls the same `rehostPostImage` function the live AI Processor Lambda calls, rather than re-implementing "upload at a versioned key, update the DB, clean up the old key" a second time in the backfill script. This is possible specifically because Task 3 designed `rehostPostImage`'s cleanup step to key off whatever `durableImageUrl` the DB row *already* holds, not off any assumption that it's only ever called once per post during live extraction — the function doesn't know or care whether it's being called by `process-ai-job.ts` on a brand-new post or by the backfill script on an already-rehosted one; "is there a previous key, and does it differ from the new one" is the only branch. This keeps the delete+invalidate logic in exactly one place.

### Design Decision: Per-Row Invalidation, Not a Second Batched Invalidation Layer in the Backfill

`rehostPostImage` (Task 3) issues one `CreateInvalidationCommand` per replaced key, as part of its own per-post cleanup step. The backfill script (Task 6) calls `rehostPostImage` once per row needing migration, so it inherits one invalidation call per row rather than batching every row's old-key path into a smaller number of larger `CreateInvalidationCommand` calls (CloudFront supports up to 3000 paths per call). This is a deliberate choice to avoid a second, parallel cleanup mechanism: batching would require either bypassing `rehostPostImage`'s own cleanup (duplicating logic, rejected above) or threading a "defer invalidation, return the path instead" mode through it (meaningfully more complexity for a one-time operational script). CloudFront's per-distribution concurrent-invalidation-request cap (typically 15) is the only real risk this creates, and is unlikely to bind at this project's current post volume; if a real backfill run hits it, retrying failed rows (the backfill is idempotent per AC5) is the mitigation, not a code change made preemptively here.

### Design Decision: Where the Key-Building Helper Lives

`buildPostMediaKey`/`resolvePostMediaExtension`/`isVersionedPostMediaKey`/`extractPostMediaKeyFromUrl` are placed in `packages/domain/src/posts/` (an entity-scoped folder, not a generic cross-entity one like `packages/domain/src/query/`) because the key format itself hardcodes `posts/{postId}/...` — it is not a generic "versioned storage key" mechanism usable for some other entity, it *is* posts-specific by construction. This matches `project-context.md`'s rule precisely: the generic-subfolder treatment is for mechanisms that are genuinely cross-entity (a query DSL, a pagination shape); this one isn't. All four functions are pure string/regex logic with zero DB/Node/React dependencies, satisfying the 100%-coverage and frontend-safety rules the same way `parseImageUrlExpiry` already does in the sibling `scraper/` folder — deliberately **not** reusing `scraper/` itself, since this isn't scraper-adapter logic.

The SHA-256 hashing itself (`node:crypto`'s `createHash`) stays inline inside `apps/backend/src/lib/ai-processor/rehost-post-image.ts` — **not** in `packages/domain` — because `node:crypto` is a Node-runtime-only dependency (unlike `parseImageUrlExpiry`'s use of the globally-available `URL`/`URLSearchParams`), and `rehostPostImage` is already an I/O/AWS-SDK-coupled function with no pretense of frontend-safety. Per `project-context.md`'s DB/Node-dependency-leakage rule, only the *portable* key-formatting logic belongs in `packages/domain`; the Node-coupled hash computation belongs where the Node-coupled upload already lives.

### Architecture & UX Gate Findings

- Epic 3's swept readiness report (`_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-09-11) lists `stories_covered` ending at `3-6l` (then jumping to `3-7a`) — Stories 3.6m through 3.6q (all added 2026-10-01, after the sweep) are **not** covered. Per `story-split-gate.md`'s epic-level-sweep-mode lightweight guard, and the exact precedent Story 3.6e's own story file already followed for the same reason, Gates 1/2/3 were reasoned fresh below rather than cited from the sweep.
- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found, but note the inverse framing from 3.6e's own Gate 1 finding.** 3.6e's "no gap" meant *no* infra changes were needed (everything was already provisioned by Story 0.33). This story's "no gap" means the opposite on the surface — it *does* require new infra (a cache-policy header-value edit, a `grantDelete`/`grantCreateInvalidation` IAM grant, a new env var, three new `CfnOutput`s) — but that infra work is explicitly named by this story's own ACs (AD-28 Rule 9) and epics.md text, not something bypassed, hidden, or pushed onto an ungoverned direct-from-frontend call. A Gate 1 violation is infra that's *missing* and silently worked around; here the infra is *present in the story's own task list*, which is the correct place for it.
- **Gate 2 (UI Complexity & Reusability) — No gap found, trivially.** Zero UI/frontend scope — no files under `apps/web` or `packages/ui` are touched by this story (confirmed: `durableImageUrl`'s GraphQL/frontend consumption, already shipped by Story 3.6f, is completely unaffected — the *value* of the URL string changes, its type/shape/consumption path does not). Not dispatched as a full persona subagent given the unambiguous absence of any UI surface.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** The one new shared mechanism this story introduces (`buildPostMediaKey` and its siblings) is placed in `packages/domain/src/posts/` specifically so Story 3.6n (already named in epics.md as this story's `Feeds:` dependency) can consume it directly instead of re-deriving the key format — the opposite of a foundational gap, this *closes* one proactively for a story that hasn't been drafted yet. `@aws-sdk/client-cloudfront` is standard AWS SDK boilerplate consistent with this project's existing `@aws-sdk/client-s3`/`@aws-sdk/client-sqs`/`@aws-sdk/client-sesv2` usage, not a foundational-tooling gap requiring its own Epic 0 story. `CfnOutput`s for the bucket/CDN-domain/distribution-ID follow the single existing `opsBackfillBucketName` precedent exactly, not a new pattern needing its own story.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no DB schema change. One new `packages/domain` export path, one new `apps/backend` dependency, one new `BackendEnv` field, one CDK-level infra change (cache-policy value + new IAM grants + new env var + new outputs). No GraphQL schema change, no `packages/shared-types` change.**
- **Impacted fields/contracts:**
  - `packages/domain/src/posts/index.ts`: new `buildPostMediaKey`/`resolvePostMediaExtension`/`isVersionedPostMediaKey`/`extractPostMediaKeyFromUrl` exports — additive.
  - `apps/backend/src/lib/ai-processor/rehost-post-image.ts`: **behavioral change, not a type/signature change** — `rehostPostImage`'s exported function signature (`postId, imageBytes, imageContentType, env) => Promise<string | null>`) is unchanged; only its internal S3-key-construction and its new post-success cleanup step change. Its one existing caller (`process-ai-job.ts`, via `rehostPostImageSeam`) and its one new caller (Task 6's backfill script) both call it exactly the same way.
  - `apps/backend/src/env.ts`: `BackendEnv` gains one new optional field (`postMediaDistributionId`) — additive.
  - `apps/infrastructure/lib/festgrid-backend-stack.ts`: `aiProcessorLambda`'s environment gains `POST_MEDIA_DISTRIBUTION_ID` — additive; its IAM role gains two new grants (`grantDelete`, `grantCreateInvalidation`) — additive, strictly widening what was previously write-only access.
  - **`posts.durableImageUrl`'s *string values* change shape** (from `https://cdn/posts/{postId}` to `https://cdn/posts/{postId}/full-{hash8}.{ext}`) for every post re-hosted after this story ships, and for every already-rehosted post once the backfill (Task 6) runs — but the **column's type** (`text`, nullable) is completely unchanged, and every existing consumer (GraphQL `Event.durableImageUrl`/`Post.durableImageUrl` resolvers, `resolveServedImageUrl`, `EventCard`/`EventListView`/`InstagramEmbed` on the frontend) treats it as an opaque URL string already — none of them parse or assume anything about its path structure, so this is a safe, non-breaking value change, not a contract change. Confirmed by the earlier grep across `apps/backend`/`apps/web`/`packages`: every non-test reference either passes the URL straight through or does a bare `!= null` truthiness check.
  - **Deliberately not touched:** `apps/backend/src/schema/events.graphql`/`resolvers.ts` (no field shape change); `packages/shared-types`; `packages/database/schema.ts` (no column change); any `packages/ui`/`apps/web` file (URL values are opaque to every consumer, per above).
- **Required DB migration:** none (no DDL change — see "No DB schema change" above).
- **Required TypeScript type changes:** none beyond the two purely-additive interface fields noted above (`BackendEnv.postMediaDistributionId`); no `InferSelectModel`-derived type changes since no column changed.
- **Backward compatibility and rollout notes:** Existing (pre-backfill) `durableImageUrl` values pointing at the old flat key keep serving correctly from CloudFront/S3 until the backfill (Task 6) runs — **this story does not break old URLs by shipping the code change alone**; the cache-policy header-value change (AC4) applies to *future* responses for whatever key is actually requested, old or new, and does not itself invalidate or break anything already cached. The backfill is what actually migrates existing rows off the old key format; until it runs (and until any already-browser-cached copies of the old 1-year-`immutable` responses age out — up to a year, an accepted, unavoidable tail per AD-28 Rule 9's own text), old-format URLs keep working exactly as before. No coordinated "flag day" deploy ordering is required between the code change and the backfill run.
- **Verification checks:** Task 1's 100%-covered unit tests; Task 7's `rehost-post-image.test.ts` extension (cleanup-on-replace, no-op-on-identical-content); the new backfill script's own tests (mocked clients); the two new/updated `festgrid-backend-stack.test.ts` assertions; full root `pnpm build && pnpm lint && pnpm test`.

### Project Structure Notes

- **New:** `packages/domain/src/posts/{build-post-media-key.ts, build-post-media-key.test.ts}`; `apps/backend/src/{backfill-post-media-keys.ts, backfill-post-media-keys.test.ts}`; `.github/workflows/backfill-post-media-keys.yml`.
- **Modified:** `packages/domain/src/posts/index.ts` (new export); `apps/backend/src/lib/ai-processor/rehost-post-image.ts` (versioned key + cleanup step + new CloudFront client seam) + its test; `apps/backend/src/env.ts` (`postMediaDistributionId`); `apps/backend/package.json` (`@aws-sdk/client-cloudfront`) + lockfile; `apps/infrastructure/lib/festgrid-backend-stack.ts` (cache-policy value + comment, new env var, new IAM grants, three new `CfnOutput`s) + its test.
- **Not modified:** `apps/backend/src/lib/ai-processor/process-ai-job.ts` (calls `rehostPostImageSeam` exactly as it already does — no change needed, the behavior change is entirely inside the seam's target function); `packages/database/schema.ts`/`migrations/` (no schema change); `apps/backend/src/schema/events.graphql`/`resolvers.ts` (no field shape change — `durableImageUrl` stays a plain nullable string); `apps/web/**`, `packages/ui/**` (URL values are opaque to every frontend consumer, confirmed by grep); `SETUP_WALKTHROUGH.md` (no new external vendor — `@aws-sdk/client-cloudfront` talks to the same AWS account/CloudFront distribution already provisioned by Story 0.33, nothing new to document there; the new GitHub Actions workflow reuses the same `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` repo secrets `backfill-scraper-audit-trail.yml` already documents).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6q] — this story's authoritative ACs and `Depends on`/`Feeds` lines.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-28, Rule 9] — binding design: content-versioned keys, 7-day immutable `Cache-Control`, deletion semantics, explicit no-service-worker/no-Cache-API decision and its rationale.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-30.md] — the Sprint Change Proposal that added AD-28 Rule 9 and Story 3.6q itself (2026-10-01, same session); `backlog.yaml`'s `IDEA-053` (`parent: CC-023`) is this change's backlog row.
- [Source: apps/backend/src/lib/ai-processor/rehost-post-image.ts, rehost-post-image.test.ts] — read in full; exact current (pre-story) upload/write/test shape this story's Task 3/Task 7 extend.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts] — read in full (640 lines); confirmed `postMediaBucket`/`postMediaCacheHeadersPolicy`/`postMediaDistribution` (~lines 149-177), `aiProcessorLambda`'s environment (~334-350), and the existing `postMediaBucket.grantPut` IAM grant (~line 506) this story's Task 4 extends, plus the single existing `opsBackfillBucketName` `CfnOutput` precedent (~line 625) Task 4's three new outputs mirror.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.test.ts] — read in full (472 lines); the only existing CDK test file/pattern in this repo, confirmed to not yet assert anything about `ResponseHeadersPolicy`; Task 4/Task 7's new assertions follow its exact `Template`/`Match` style.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — read in full; confirmed re-hosting is already gated behind `isOptedIntoImageStorage` (post-3.6h) and this story requires zero changes to this file.
- [Source: apps/backend/src/env.ts] — read in full; confirmed `postMediaBucketName`/`postMediaCdnDomain` are the existing fields this story's Task 5 adds a sibling to.
- [Source: apps/backend/src/trigger-brightdata-onetime.ts] — read in full; the exact standalone-`apps/backend`-script placement/invocation convention Task 6's backfill script follows.
- [Source: packages/database/backfill-scraper-actor-runs.ts] — read in full; the sizing/backfill-mode and `--apply`-gated-dry-run-by-default convention Task 6 mirrors (while deliberately placing the new script in `apps/backend`, not `packages/database`, per the Design Decision above).
- [Source: .github/workflows/backfill-scraper-audit-trail.yml] — read in full; the manual-dispatch/dry-run-default/`aws cloudformation describe-stacks`-output-resolution pattern Task 6's new workflow mirrors.
- [Source: packages/domain/src/scraper/parse-image-url-expiry.ts, posts/index.ts, package.json#exports] — read in full; confirmed the `./posts` subpath export already exists (no `package.json` change needed) and the exact pure-function/doc-comment style Task 1 mirrors.
- [Source: node_modules/.pnpm/aws-cdk-lib@2.263.0.../aws-cdk-lib/aws-cloudfront/lib/distribution.d.ts] — confirmed `grantCreateInvalidation(identity: iam.IGrantable): iam.Grant` exists on this project's installed CDK version — no hand-rolled IAM policy statement needed for Task 4.
- [Source: apps/backend/src/schema/resolvers.ts, apps/web/src/features/events/mapper.ts, packages/domain/src/events/resolveServedImageUrl.ts, packages/ui/src/features/events/*] — grepped across `apps/backend`/`apps/web`/`packages`; confirmed every non-test `durableImageUrl` consumer treats it as an opaque string (no path parsing, no structural assumption), grounding the Data Type Compatibility section's "safe value change, not a contract change" conclusion.
- [Source: _bmad-output/project-context.md#Code-Quality-Style-Rules] — the `packages/domain` pure-logic/no-DB-Node-leakage placement rule and its generic-subfolder-vs-entity-folder distinction, directly grounding where `buildPostMediaKey` and the SHA-256 hash computation each landed.
- [Source: _bmad-output/implementation-artifacts/3-6e-re-host-extracted-event-images-to-durable-storage.md] — format/depth precedent this story's own Dev Notes/Tasks/References follow; the specific prior story this one extends.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Critical Implementation Rules (Drizzle-only DB access for the backfill's row reads/updates, best-effort/non-blocking error handling for the cleanup step), Code Quality & Style Rules (`packages/domain` pure-logic/no-Node-leakage placement — directly shaping Task 1/the Design Decision splitting hash computation from key formatting), Testing Rules (100% `packages/domain` coverage; testing-trophy/actual-`tsx --test` convention elsewhere).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-28 Rule 9 (this story's entire binding design); AD-12 Rule 2 (the bucket/CDN this story's cache-policy and IAM-grant changes extend, unchanged in its own right).
- [ ] `docs/infrastructure/index.md` — consulted (no S3/CloudFront-specific shard content found; this story's infra footprint is scoped entirely within `festgrid-backend-stack.ts`, already covered by the Architecture Spine references above).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/posts/{build-post-media-key.ts, build-post-media-key.test.ts}`; `apps/backend/src/{backfill-post-media-keys.ts, backfill-post-media-keys.test.ts}`; `.github/workflows/backfill-post-media-keys.yml`.
  - Modified: `packages/domain/src/posts/index.ts`; `apps/backend/src/lib/ai-processor/rehost-post-image.ts` (+ its test); `apps/backend/src/env.ts`; `apps/backend/package.json` + lockfile; `apps/infrastructure/lib/festgrid-backend-stack.ts` (+ its test).
- **Rule Mapping:**
  - AD-28 Rule 9 (content-versioned keys, shared helper for 3.6n, 7-day immutable cache, best-effort delete+invalidate, deletion semantics, no service worker) → Tasks 1, 3, 4 end-to-end.
  - `packages/domain` pure-logic/no-Node-leakage placement rule → Task 1 (key-formatting helpers) vs. Task 3 (Node-`crypto` hash computation, kept in `apps/backend`) — see Design Decision.
  - Database Access (Drizzle ORM only) → Task 3's `db.select`/`db.update` inside `rehostPostImage`; Task 6's backfill row reads.
  - AD-12 Rule 1 (reuse already-fetched bytes, no second fetch) — **not re-derived for live extraction** (unchanged from Story 3.6e); the backfill (Task 6) is the one path that legitimately re-fetches bytes, but from S3 (the already-rehosted durable copy), never from the original expired source URL — consistent with AD-12 Rule 1's intent (don't re-hit the source), not a violation of it.
  - Best-effort/non-blocking error handling (project-context.md) → Task 3's inner try/catch around the cleanup step; Task 6's per-row failure isolation (one row's failure doesn't abort the whole backfill run).
  - Reuse over reinvention (`rehostPostImage` reused by both the live pipeline and the backfill script, rather than duplicated; `s3ClientInstance`/`setS3ClientInstance` seam pattern extended rather than replaced; `festgrid-backend-stack.test.ts`'s existing `Template`/`Match` pattern extended rather than a new test tool introduced) → Tasks 3, 4, 6.
  - Story-split-gate discipline (fresh Gate 1/2/3 run, epic-level-sweep-mode lightweight guard) → Dev Notes "Architecture & UX Gate Findings".
- **Verification Plan:**
  - `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained on `build-post-media-key.ts`.
  - `apps/backend`: `pnpm --filter backend test` — `rehost-post-image.test.ts` (extended), `backfill-post-media-keys.test.ts` (new) both pass, including the "cleanup failure doesn't affect return value" and "identical-content no-op" cases.
  - `apps/infrastructure`: `pnpm --filter infrastructure test` — `festgrid-backend-stack.test.ts`'s two new assertions and the updated test-14 environment assertion all pass against the real synthesized template.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
  - **Deferred to the dev-story implementation pass (not run during story creation — no DB/AWS access in this sandbox):** the backfill script's dry-run output against a real dev-stage database; a real (dev-stage) `--apply` run and manual spot-check that old S3 objects are actually gone and CloudFront invalidations actually completed; `cdk synth`/`cdk diff` against a real AWS account to confirm the new `CfnOutput`s and IAM grants synthesize as expected before any real deploy.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — a key-format/cache-policy/cleanup change to the already-shipped `rehostPostImage` write path, a new shared `packages/domain` key-helper (also feeding the not-yet-built Story 3.6n), a CDK cache-policy + IAM-grant + env-var + outputs change, and a new one-time idempotent backfill script + its ops workflow. No new DB schema. Confirmed unblocked: Story 3.6e (re-hosting mechanism, `done`) and Story 0.33 (media bucket, `done`) are both already merged.
- [ ] Architecture and boundary confirmation — key-formatting logic in `packages/domain/src/posts/` (pure, frontend-safe); SHA-256 hash computation kept in `apps/backend` (Node-`crypto`-coupled, per the Design Decision); all cleanup/delete/invalidate logic lives inside `rehostPostImage` itself and is reused (not duplicated) by the backfill script.
- [ ] Testing plan confirmation — `packages/domain` 100%-coverage unit tests for the key helper; `apps/backend` integration tests covering first-upload, replace-with-different-content (cleanup fires, failure-tolerant), replace-with-identical-content (no-op), and the backfill script's skip/migrate/dry-run branches; new `apps/infrastructure` CDK assertion tests for the cache-header value and the CloudFront invalidation IAM grant.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (all infra work named is this story's own explicit scope, not a bypass). Gate 2: no gap (zero UI scope). Gate 3: no gap (key helper placed reusably ahead of Story 3.6n's need for it; `@aws-sdk/client-cloudfront` and the new `CfnOutput`s are standard, precedented additions).
- [ ] **Design decision accepted:** the backfill script calls `rehostPostImage` directly rather than re-implementing its upload/cleanup logic (Dev Notes "Design Decision: Reusing `rehostPostImage` for the Backfill").
- [ ] **Design decision accepted:** per-row CloudFront invalidation (inherited from `rehostPostImage`) rather than a second, separately-batched invalidation layer in the backfill script, accepting the CloudFront concurrent-invalidation-cap risk as unlikely at current volume (Dev Notes "Design Decision: Per-Row Invalidation, Not a Second Batched Invalidation Layer").
- [ ] **Design decision accepted:** the key-building helper lives in `packages/domain/src/posts/` (entity-scoped, not a generic cross-entity `query/`-style subfolder), and the SHA-256 hash computation stays in `apps/backend`, not `packages/domain` (Dev Notes "Design Decision: Where the Key-Building Helper Lives").
- [ ] **Sandbox constraint acknowledged:** this story was drafted without DB/AWS access (explicit operator instruction); no migration, backfill dry run, or test suite was executed during story creation — the dev-story pass must run and confirm all of Task 7's verification steps itself before marking this story `review`.

## Testing Requirements

- [ ] Unit tests: `packages/domain/src/posts/build-post-media-key.test.ts` (100% coverage — `buildPostMediaKey` full/thumb/invalid-hash8 cases; `resolvePostMediaExtension`'s mapped/unmapped/missing cases; `isVersionedPostMediaKey`'s versioned/flat/unrelated cases; `extractPostMediaKeyFromUrl`'s matching/non-matching/null cases).
- [ ] Integration tests: `rehost-post-image.test.ts` (extended — first-upload-no-prior-url, replace-with-different-content-triggers-cleanup-and-tolerates-its-own-failure, replace-with-identical-content-is-a-true-no-op); new `backfill-post-media-keys.test.ts` (mocked S3/CloudFront/DB — migrate/skip/dry-run branches); `festgrid-backend-stack.test.ts` (extended — new `Cache-Control` value assertion, new `cloudfront:CreateInvalidation` grant assertion, updated L_AI environment assertion for `POST_MEDIA_DISTRIBUTION_ID`).
- [ ] E2E tests: **not added** — this is a backend/infra data-durability and cache-policy change with no directly observable UI change (the served URL's *value* changes, but every frontend consumer already treats it as an opaque string); matches this project's testing-trophy philosophy and the identical precedent set by Story 3.6e (also backend-plumbing-only, no dedicated E2E spec).

## Deliverables Checklist

- [ ] `buildPostMediaKey`/`resolvePostMediaExtension`/`isVersionedPostMediaKey`/`extractPostMediaKeyFromUrl` implemented in `packages/domain/src/posts/`, 100%-covered, exported from the package barrel (already reachable via the existing `./posts` subpath export).
- [ ] `rehostPostImage` uploads under the content-versioned key (`posts/{postId}/full-{hash8}.{ext}`) and, on replacing an existing different key, best-effort deletes the old S3 object and invalidates its CloudFront path without ever affecting its own return value.
- [ ] `PostMediaCacheHeadersPolicy`'s `Cache-Control` value is `public, max-age=604800, immutable`; its surrounding comment describes versioned keys, not "write-once" files.
- [ ] `aiProcessorLambda` holds `grantDelete` + `grantCreateInvalidation` on the post-media bucket/distribution, and carries `POST_MEDIA_DISTRIBUTION_ID` in its environment.
- [ ] Three new `CfnOutput`s (`postMediaBucketNameOutput`/`postMediaCdnDomainOutput`/`postMediaDistributionIdOutput`) exist, mirroring the existing `opsBackfillBucketName` output.
- [ ] A one-time, idempotent backfill script (`apps/backend/src/backfill-post-media-keys.ts`) migrates already-rehosted posts off the old flat key format, re-running cleanly as a no-op on already-migrated rows.
- [ ] A companion manual-dispatch GitHub Actions workflow (`.github/workflows/backfill-post-media-keys.yml`) can run the backfill against a real stage.
- [ ] `@aws-sdk/client-cloudfront` added as an `apps/backend` dependency.
- [ ] `apps/infrastructure/lib/festgrid-backend-stack.test.ts` asserts the new `Cache-Control` value and the new CloudFront invalidation IAM grant.

## Out of Scope

- Story 3.6n's own detection/blur/thumbnail-generation pipeline and its `thumb-{hash8}.jpg` key usage — this story only makes `buildPostMediaKey`'s `variant: 'thumb'` path available for 3.6n to call; it does not call it anywhere itself (no `durableThumbnailUrl` column exists yet).
- Any periodic/automatic re-invalidation or cache-busting beyond what the versioned key + 7-day TTL already provide.
- A service worker or browser Cache API image-caching layer — explicitly rejected by AD-28 Rule 9 itself, not merely unbuilt.
- Changing `posts.imageUrl` (the original, ephemeral scraped URL) in any way — out of scope for both the live write path and the backfill.
- Any GraphQL schema change, or any frontend (`apps/web`/`packages/ui`) change — `durableImageUrl`'s type/shape/consumption is completely unaffected, only the URL's string value changes.
- Running the backfill against staging/prod data — this story ships the script and its manual-dispatch workflow; the dev-story/ops follow-through of actually triggering a real `--apply` run is an operational action taken after this story's code lands, not part of "done" for the story itself (mirrors how Story 3.6e's migration-apply step was a local-dev verification, not a declaration that production data was ever specifically re-migrated).

## Definition of Done

- [ ] AC1-7 satisfied.
- [ ] All required tests passing (domain unit — 100% coverage; backend integration — `rehost-post-image`, `backfill-post-media-keys`; infrastructure — `festgrid-backend-stack.test.ts`'s new/updated assertions).
- [ ] Lint and type checks passing for `packages/domain`, `apps/backend`, `apps/infrastructure`.
- [ ] No DB migration needed (confirmed no schema change) — N/A, not a gap.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root) pass with no regressions to any existing suite.
- [ ] Backfill script's dry-run output manually verified against a real dev-stage database before any `--apply` run (deferred to dev-story pass per the Pre-Coding Approval Gate's sandbox-constraint acknowledgment).

## Completion Status

- [ ] Not started — story file created via `bmad-create-story`, status `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

_To be filled in by the dev-story implementation pass._

### Debug Log References

_To be filled in by the dev-story implementation pass._

### Completion Notes List

_To be filled in by the dev-story implementation pass._

### File List

_To be filled in by the dev-story implementation pass._
