---
baseline_commit: ef6e5e029c5592c70912d1cde7e4d9e5d10c29ba
---

# Story 3.6e: Re-host extracted-event images to durable storage

## Story Details

- Epic: 3
- Story ID: 3.6e
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want an extracted event's image to keep working long after Instagram's own signed CDN URL expires,
so that I don't see a broken image on an event I favorited or added to my calendar days after it was scraped.

## Acceptance Criteria

1. **Given** the `posts` table, **when** this story's migration runs, **then** it gains two new nullable columns: `durable_image_url` (`text`) and `image_url_expires_at` (`timestamp with time zone`) — both additive, no existing column changed, `posts.image_url` never modified/overwritten anywhere by this story.
2. **Given** a raw scraped `imageUrl` (e.g. an Instagram CDN URL carrying an `oe=<hex Unix timestamp>` query parameter), **when** `parseImageUrlExpiry(url)` (new `packages/domain` pure function) is called on it, **then** it returns the decoded expiry as a `Date`.
3. **Given** a URL with no `oe=` parameter, or one whose value isn't valid hex, **when** `parseImageUrlExpiry` is called, **then** it returns `null` — never a value implying "valid indefinitely" (AD-12 explicit requirement; how a `null` is treated downstream is Story 3.6f's concern, not built here).
4. **Given** `persistScrapedPost` (`apps/backend/src/lib/posts/persist-scraped-post.ts`) is called with an `imageUrl`, **when** the post is inserted, **then** `posts.imageUrlExpiresAt` is set to `parseImageUrlExpiry(imageUrl)`'s result (parsed once, at write time, per AD-12 Rule 3) — `null` when unparseable, without blocking or altering the insert of `posts.imageUrl` itself.
5. **Given** a post reaches the AI-extraction pipeline (`apps/backend/src/lib/ai-processor/process-ai-job.ts`) and Gemini's response is validated as `isEvent: true` (i.e. an `EventInfo` is about to be created via the DataIngestionQueue hand-off), **when** the pipeline already holds the image bytes it fetched for Gemini's vision call, **then** those same bytes (no second `fetch` of `message.imageUrl`) are uploaded via `PutObjectCommand` to the bucket named by `POST_MEDIA_BUCKET_NAME`, at a deterministic key derived from `message.postId`.
6. **Given** a successful upload, **when** the durable URL is constructed as `https://${POST_MEDIA_CDN_DOMAIN}/${key}`, **then** it is written to that post's `posts.durableImageUrl` column.
7. **Given** the S3 upload throws (network error, credentials, bucket misconfiguration, etc.), **when** that error is caught, **then** it is logged and swallowed — `durableImageUrl` stays `null`, and `markPostExtractedSeam`/the DataIngestionQueue enqueue proceed exactly as they would have without this story (re-hosting is best-effort, never a hard requirement for extraction to succeed — project-context.md's error-handling convention).
8. **Given** a post whose Gemini response is `isEvent: false`, **or** whose response fails AJV validation, **or** whose JSON fails to parse, **when** `process-ai-job.ts` takes any of those existing early-return paths, **then** no S3 upload is attempted and `durableImageUrl` is never touched (AD-12 Rule 4 scope boundary).
9. **Given** `message.imageUrl` is absent (post has no image), **when** the extraction succeeds, **then** no upload is attempted (nothing to upload) and `durableImageUrl` stays `null`.
10. **Given** the AI-extraction image fetch itself fails (the existing `try/catch` in `buildGeminiExtractionRequest` that falls back to text-only extraction), **when** that fallback path is taken, **then** no image bytes exist to re-host, no upload is attempted, and text-only extraction proceeds exactly as it does today (no regression to the existing fallback behavior).
11. **Given** Manual Post Selection and moderator triage screens (out of this story's scope per AD-12 Rule 4), **when** this story ships, **then** neither screen's code path is touched and neither gains any re-hosting behavior.
12. **Given** already-persisted posts/events with a pre-existing `imageUrl` (scraped before this story shipped), **when** this story ships, **then** no backfill job is run against them (AD-12 Rule 5 — fix-going-forward only).

## Tasks / Subtasks

- [ ] **Task 1: DB migration — `durableImageUrl`/`imageUrlExpiresAt`** (AC: 1) — `packages/database/schema.ts`, `packages/database/migrations/`
  - [ ] In `schema.ts`'s `posts` table (alongside the existing `imageUrl`/`videoUrl` columns, line ~178-179), add:
    ```ts
    durableImageUrl: text('durable_image_url'),
    imageUrlExpiresAt: timestamp('image_url_expires_at', { withTimezone: true }),
    ```
  - [ ] Generate the migration via `drizzle-kit` (`pnpm --filter @festgrid/database db:generate` or the project's equivalent script — check `packages/database/package.json` for the exact command name), producing the next-numbered file after `0036_mute_turbo.sql` (i.e. `0037_*.sql`). Expected SQL: two `ALTER TABLE "posts" ADD COLUMN ...` statements, both nullable, matching `0036_mute_turbo.sql`'s single-column-add shape exactly (that migration added `video_url` the same way).
  - [ ] Do **not** hand-edit for a partial-index `WHERE` clause (AD-8 rule 3's known drizzle-kit limitation) — these two columns are plain nullable additions with no index, that limitation doesn't apply here.
  - [ ] Apply the migration locally and confirm it runs cleanly against the local Postgres instance.

- [ ] **Task 2: `parseImageUrlExpiry` pure function** (AC: 2, 3) — `packages/domain/src/scraper/`
  - [ ] Create `packages/domain/src/scraper/parse-image-url-expiry.ts` exporting `parseImageUrlExpiry(url: string | null | undefined, paramName = 'oe'): Date | null`:
    - Return `null` immediately if `url` is falsy or fails to parse as a URL (wrap `new URL(url)` in try/catch — scraped data is untrusted).
    - Read `paramName`'s value from the URL's query string (`URLSearchParams`/`URL.searchParams`). Return `null` if absent.
    - Parse the value as hexadecimal (`parseInt(value, 16)`). Return `null` if the result is `NaN` or the raw string contains any non-hex-digit character (guard against `parseInt`'s lenient prefix-parsing, e.g. `"12xyz"` silently parsing as `18`) — validate with a hex-digit regex (`/^[0-9a-fA-F]+$/`) before calling `parseInt`.
    - Otherwise return `new Date(parsedSeconds * 1000)` (the `oe=` convention is seconds since epoch, confirmed by the sprint-change-proposal's decoded sample data, Section 1.2).
  - [ ] Zero DB/Node-runtime-only/React dependencies — only the global `URL`/`URLSearchParams` (available in both Node and browser runtimes), satisfying `packages/domain`'s frontend-safety constraint even though the only current caller is backend-only.
  - [ ] Add `packages/domain/src/scraper/parse-image-url-expiry.test.ts` with 100% coverage: (a) a URL with a valid `oe=` hex value returns the correct `Date`; (b) a URL with no `oe=` param returns `null`; (c) a URL with a malformed/non-hex `oe=` value (e.g. `oe=zzz`, `oe=`) returns `null`; (d) an unparseable URL string returns `null`; (e) `url` is `null`/`undefined` returns `null`.
  - [ ] Export it from `packages/domain/src/scraper/index.ts` (existing barrel file — add `export * from './parse-image-url-expiry.js';` alongside the existing exports).

- [ ] **Task 3: Wire expiry parsing into `persistScrapedPost`** (AC: 4) — `apps/backend/src/lib/posts/persist-scraped-post.ts`
  - [ ] Import `parseImageUrlExpiry` from `@festgrid/domain` (or `@festgrid/domain/scraper` if that's the package's existing subpath-export convention — check `packages/domain/package.json`'s `exports` map for how `./scraper` is currently exposed, matching whatever pattern the existing `ScraperAdapter`/`ScrapedPost` imports from `@festgrid/domain` already use).
  - [ ] Inside `persistScrapedPost`, before the `db.insert(posts).values({...})` call, compute `const imageUrlExpiresAt = parseImageUrlExpiry(imageUrl ?? null);` and add `imageUrlExpiresAt` to the inserted `.values({...})` object, alongside the existing `imageUrl` field.
  - [ ] Do **not** change any of `persistScrapedPost`'s ~5 existing callers (`process-apify-async-result.ts`, `process-brightdata-result.ts`, `process-scrape-job.ts`, `replay-actor-run.ts` x2) — they already pass `imageUrl` through; this is a single internal call site, no signature change to `persistScrapedPost`'s own parameters.
  - [ ] Note: the existing "already exists" early-return path (when `persistScrapedPost` finds a matching row by `postUrl`/`originalPostUrl` and returns early without inserting) does **not** re-parse or update `imageUrlExpiresAt` on the existing row — this story only sets it at first-insert time, matching how `imageUrl` itself is also only ever set once on insert, never updated on a re-scrape of an already-known post.

- [ ] **Task 4: Expose fetched image bytes from `buildGeminiExtractionRequest`** (AC: 5, 10) — `apps/backend/src/lib/ai-processor/build-gemini-request.ts`
  - [ ] Change the return type from bare `Promise<GeminiCallRequest>` to `Promise<{ request: GeminiCallRequest; imageBytes?: Buffer; imageContentType?: string }>`.
  - [ ] Inside the existing `if (message.imageUrl)` block: after `const arrayBuffer = await response.arrayBuffer();`, set `imageBytes = Buffer.from(arrayBuffer)` and `imageContentType = contentType` (both declared in the outer function scope, `undefined` by default) — reuse the same `Buffer` for both the `base64Data` encoding (unchanged) and the returned `imageBytes` (no duplicate work).
  - [ ] In the existing `catch` block (image-fetch failure → text-only fallback), leave `imageBytes`/`imageContentType` as `undefined` — this is AC10's "no bytes to re-host" case, already naturally satisfied by not setting them before the throw.
  - [ ] Change the final `return { contents, systemInstruction, ... }` to `return { request: { contents, systemInstruction, responseSchema: geminiExtractionResponseSchema, responseMimeType: 'application/json' }, imageBytes, imageContentType };`.
  - [ ] Update `build-gemini-request.test.ts` for the new return shape (destructure `.request` for existing assertions against the Gemini call shape; add new assertions that `imageBytes`/`imageContentType` are populated on the happy path and `undefined` on the fetch-failure fallback path).

- [ ] **Task 5: Add `@aws-sdk/client-s3` dependency** (AC: 5) — `apps/backend/package.json`
  - [ ] Add `@aws-sdk/client-s3` at a version consistent with the other already-installed `@aws-sdk/*` packages (`^3.1058.0`–`^3.1100.0` range — check the latest compatible `3.x` release at install time, matching this monorepo's existing per-package pinning style rather than blindly copying one exact version).
  - [ ] `pnpm install` inside `apps/backend` (or from repo root) to update the lockfile.

- [ ] **Task 6: `postMediaBucketName`/`postMediaCdnDomain` env plumbing** (AC: 5, 6) — `apps/backend/src/env.ts`
  - [ ] Add `postMediaBucketName?: string;` and `postMediaCdnDomain?: string;` to the `BackendEnv` interface.
  - [ ] In `loadBackendEnv()`, read them: `postMediaBucketName: process.env.POST_MEDIA_BUCKET_NAME,` and `postMediaCdnDomain: process.env.POST_MEDIA_CDN_DOMAIN,` (with the same `// eslint-disable-next-line turbo/no-undeclared-env-vars` comment pattern every other `process.env.*` read in this file already uses). These env vars are **already** set on `aiProcessorLambda`'s environment by Story 0.33's CDK stack (`apps/infrastructure/lib/festgrid-backend-stack.ts:321-322`) — this task only closes the gap where `env.ts` itself never read them.

- [ ] **Task 7: S3 upload helper** (AC: 5, 6, 7) — new `apps/backend/src/lib/ai-processor/rehost-post-image.ts`
  - [ ] Export `async function rehostPostImage(postId: string, imageBytes: Buffer, contentType: string | undefined, env: BackendEnv): Promise<string | null>`:
    - If `env.postMediaBucketName`/`env.postMediaCdnDomain` are both set, build a deterministic key (e.g. `` `posts/${postId}` `` — a stable, extension-free key is sufficient since CloudFront serves purely by key and the object's `Content-Type` metadata, not by URL extension; set `ContentType: contentType || 'image/jpeg'` on the `PutObjectCommand` so the CDN/browser render it correctly).
    - `new S3Client({})` (matching `send-sqs-message.ts`'s `new SQSClient({})` construction-with-no-explicit-config style — Lambda's execution role supplies credentials/region implicitly).
    - `await client.send(new PutObjectCommand({ Bucket: env.postMediaBucketName, Key: key, Body: imageBytes, ContentType: ... }))`.
    - On success, return `` `https://${env.postMediaCdnDomain}/${key}` ``.
    - Wrap the whole body in try/catch: on any thrown error (including missing env vars — log a distinct warning and return `null` rather than throwing, since a misconfigured env is also a "can't re-host, don't block extraction" case, not a crash), `console.error`/`console.warn` with the `postId` and the error, then return `null`. Never rethrow.
  - [ ] Add a small `markPostDurableImageUrl(postId: string, durableImageUrl: string)` helper in `apps/backend/src/lib/posts/` (mirroring `mark-post-extracted.ts`'s exact shape: `db.update(posts).set({ durableImageUrl }).where(eq(posts.id, postId)).returning()`), or fold the `db.update` directly into Task 8's call site — PO/dev discretion, whichever keeps `process-ai-job.ts` least cluttered; if folded inline, still keep it as a one-line, easily-testable statement guarded by `if (durableImageUrl) { ... }`.

- [ ] **Task 8: Wire re-hosting into `process-ai-job.ts`** (AC: 5, 6, 7, 8, 9) — `apps/backend/src/lib/ai-processor/process-ai-job.ts`
  - [ ] Update the step-2 call site: `const { request, imageBytes, imageContentType } = await buildGeminiExtractionRequest(message);` and pass `request` (not the old bare object) into `callGeminiSeam({ ...request, provider: 'gemini', subscriberUserIds })`.
  - [ ] After step 7 (`transformGeminiResponseToEventInfo`, i.e. once `payload.isEvent === true` and AJV validation has already passed — the two early-return paths for `isEvent === false` and AJV failure sit *before* this point in the existing function and are therefore automatically excluded, satisfying AC8 with no extra guard needed) and before step 8's enqueue, add: `if (imageBytes) { const durableImageUrl = await rehostPostImage(message.postId, imageBytes, imageContentType, env); if (durableImageUrl) { await markPostDurableImageUrl(message.postId, durableImageUrl); } }` — wrapped so a thrown error from either call (shouldn't happen given Task 7's internal try/catch, but defensive) is also caught/logged here and does not propagate, preserving AC7's "never blocks extraction" guarantee at this call site too.
  - [ ] Export a `rehostPostImageSeam`-style override hook (mirroring this file's existing `callGeminiSeam`/`markPostExtractedSeam` seam pattern) if the chosen test strategy (Task 9) needs to mock `rehostPostImage` at this level rather than mocking the S3 client directly — dev's call based on which is cleaner given `rehostPostImage`'s own internal S3-client construction.

- [ ] **Task 9: Tests** (AC: all)
  - [ ] `packages/domain/src/scraper/parse-image-url-expiry.test.ts` — Task 2's 5 cases, 100% coverage.
  - [ ] `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (existing file, extend) — add a case asserting `imageUrlExpiresAt` is populated from a URL with a valid `oe=` param, and stays `null` for a URL without one / when `imageUrl` is absent.
  - [ ] `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` (existing file, update per Task 4) — assert `imageBytes`/`imageContentType` are returned on the happy path and `undefined` on the fetch-failure fallback path, alongside the existing request-shape assertions (now under `.request`).
  - [ ] New `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts` — mock `@aws-sdk/client-s3`'s `S3Client`/`PutObjectCommand` (`vi.mock`, following this project's testing-trophy Vitest convention): successful `send()` returns the expected CloudFront URL; a rejected `send()` is caught and returns `null` without throwing; missing `postMediaBucketName`/`postMediaCdnDomain` env returns `null` without attempting a call.
  - [ ] `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (existing file — grep for its current test structure/seams before extending, following this project's `callGeminiSeam`/`markPostExtractedSeam` mocking pattern already established there) — add cases: (a) successful extraction with image bytes present calls the re-hosting step and results in `durableImageUrl` being set; (b) the re-hosting step throwing/rejecting does not prevent `markPostExtractedSeam` or the DataIngestionQueue enqueue from completing; (c) `isEvent: false` path never attempts re-hosting; (d) AJV-validation-failure path never attempts re-hosting; (e) no `imageUrl`/no `imageBytes` case never attempts re-hosting.
  - [ ] Full verification: `pnpm --filter @festgrid/database db:generate`/migration apply; `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` (100% coverage maintained); `pnpm --filter backend test`; `pnpm build`, `pnpm lint`, `pnpm test` (root, full suite, no regressions).

## Dev Notes

This story is Track A / Wave 2 of `sprint-change-proposal-2026-08-25-video-priority-display.md`. It depends only on Story 0.33 (S3 bucket + CloudFront distribution — already merged to `master`, commit `5b049f7`) and extends Story 3.6's already-`review` AI-extraction pipeline. It does **not** touch `apps/web` or `packages/ui` — a sibling story (1.6's amendment, videoUrl GraphQL wiring) is running concurrently against those trees in this same repo; this story's entire footprint is `packages/database`, `packages/domain`, and `apps/backend`.

**Already-shipped infrastructure this story reuses, verified by direct read (do not rebuild):**
- `apps/infrastructure/lib/festgrid-backend-stack.ts`: `postMediaBucket` (private, `BLOCK_ALL`, `S3_MANAGED` encryption) + `postMediaDistribution` (CloudFront, OAC origin, `CACHING_OPTIMIZED` + an immutable `Cache-Control` response-headers policy) — lines ~149-177. `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN` already set on `aiProcessorLambda`'s `environment` block (lines 321-322). `postMediaBucket.grantPut(aiProcessorLambda)` already granted (line 403) — **no other Lambda** (in particular, not the Ingestor Lambda that actually creates `EventInfo` rows) holds this grant or these env vars, which is why the re-hosting call must happen inside `process-ai-job.ts` (the AI Processor Lambda), not `process-ingestion-job.ts`.
- `packages/database/schema.ts:173-194`: `posts` table already has `imageUrl`/`videoUrl` (Story 3.3c). This story only adds `durableImageUrl`/`imageUrlExpiresAt` alongside them.

### Architecture & UX Gate Findings

- Epic 3's swept readiness report (`_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-08-09) does not cover this story (`stories_covered` ends before any `3.6*` letter suffix, all created after the sweep) — per `story-split-gate.md`'s epic-level-sweep-mode lightweight guard, the same precedent Stories 3.6a/3.6c/3.6d each followed, gates were reasoned fresh rather than cited from the sweep.
- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** This story deliberately does *not* provision any new infrastructure — the S3 bucket, CloudFront distribution, IAM grant, and env-var wiring into `aiProcessorLambda` were all already built and merged by Story 0.33 (AD-12 Rule 2's binding). This story only adds application code (a DB migration, a pure parsing function, and a `PutObjectCommand` call) that *uses* infrastructure that already exists — the inverse of a Gate 1 violation, not an instance of one.
- **Gate 2 (UI Complexity & Reusability) — No gap found, trivially.** This story has zero UI/frontend scope — no files under `apps/web` or `packages/ui` are touched. Not dispatched as a full persona subagent given the unambiguous absence of any UI surface to evaluate.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** The one shared, reusable piece this story introduces (`parseImageUrlExpiry`) is deliberately placed in `packages/domain/src/scraper/` — the same generic, already-established location as this story's own sibling `ScraperAdapter`/`ScrapedPost` types — rather than being built ad hoc inside `apps/backend`, so it is trivially reusable by a future adapter without requiring its own foundational story. `@aws-sdk/client-s3` is a new dependency but is standard AWS SDK boilerplate consistent with the project's existing `@aws-sdk/client-sqs`/`@aws-sdk/client-sesv2` usage, not a foundational-tooling gap requiring its own Epic 0 story.

### Design Decision: Where Expiry Parsing Happens

`parseImageUrlExpiry` is called exactly once, inside `persistScrapedPost` itself, rather than in each of its ~5 callers (`process-apify-async-result.ts`, `process-brightdata-result.ts`, `process-scrape-job.ts`, `replay-actor-run.ts` x2 — all verified by direct grep). This was a mechanical simplification, not a tradeoff requiring `AskUserQuestion`: `persistScrapedPost` already receives `imageUrl` as a parameter and is the single point where the row is actually inserted (AD-12 Rule 3's "parsed at write time, not read time"), so adding the parse call there is strictly less code and lower drift-risk than threading a new parameter through 5 call sites that would otherwise each need to remember to call it themselves.

### Design Decision: Re-hosting Lives in the AI Processor Lambda, Not the Ingestor

AD-12 Rule 1 names `build-gemini-request.ts`'s fetch as the byte source, but doesn't by itself say which Lambda performs the `PutObject`. This was resolved by direct infrastructure verification, not assumption: `postMediaBucket.grantPut(...)` and the `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN` env vars are wired **only** onto `aiProcessorLambda` (`festgrid-backend-stack.ts`, confirmed by reading the full stack file) — the Ingestor Lambda (`ingestorLambda`, which is what actually writes the `events` row) has neither. Re-hosting therefore happens in `process-ai-job.ts` (L_AI), timed to "the response is validated as a real event, right before hand-off to the DataIngestionQueue" rather than "after the `EventInfo` row physically exists" — these are equivalent in outcome (Rule 4's "only posts that reach successful extraction") since a validated `isEvent: true` payload that's about to be enqueued is, from this Lambda's perspective, already a committed decision to create the event; the actual `events` row is created downstream and is unaffected by whether `durableImageUrl` finished writing first.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: additive DB migration + one new `packages/domain` export path. No GraphQL schema change (deliberately out of scope — Story 3.6f's job), no `packages/shared-types` change.**
- **Impacted fields/contracts:**
  - `packages/database/schema.ts`: `posts.durableImageUrl`/`posts.imageUrlExpiresAt` — new nullable columns, additive, no existing column's type/nullability changes.
  - `packages/domain/src/scraper/index.ts`: new `parseImageUrlExpiry` export — additive.
  - `apps/backend/src/lib/ai-processor/build-gemini-request.ts`: **breaking internal signature change** — return type changes from bare `GeminiCallRequest` to `{ request, imageBytes?, imageContentType? }`. This is a backend-internal function with exactly one caller (`process-ai-job.ts`) and one test file, both updated by this story (Tasks 4/8/9) — not part of any public/GraphQL contract, so no external consumer is affected.
  - `apps/backend/src/env.ts`: `BackendEnv` gains two new optional fields — additive.
  - **Deliberately not touched:** `apps/backend/src/schema/events.graphql` (no `durableImageUrl` field exposed yet — Story 3.6f); `packages/shared-types` (no `Post`/`EventInfo` interface change needed for two backend-internal-only columns not yet surfaced anywhere).
- **Required DB migration:** Task 1's new `003X_*.sql`, two `ALTER TABLE "posts" ADD COLUMN` statements (nullable `text`, nullable `timestamptz`).
- **Required TypeScript type changes:** `packages/database/schema.ts` (Drizzle table definition, from which `InferSelectModel`-derived types flow automatically to all callers — no separate hand-authored interface to update); `apps/backend/src/env.ts`'s `BackendEnv` interface; `build-gemini-request.ts`'s return type (and its one caller's destructuring).
- **Backward compatibility and rollout notes:** Every change is additive or backend-internal. No existing GraphQL contract, frontend type, or `packages/shared-types` interface changes. The one internal breaking change (`buildGeminiExtractionRequest`'s return shape) is fully contained within `apps/backend` and fixed in the same story that introduces it.
- **Verification checks:** Task 2's 100%-covered unit tests; Task 9's `persist-scraped-post`/`build-gemini-request`/`rehost-post-image`/`process-ai-job` integration tests; Task 9's full build/lint/test.

### Project Structure Notes

- **New:** `packages/domain/src/scraper/{parse-image-url-expiry.ts, parse-image-url-expiry.test.ts}`; `packages/database/migrations/003X_*.sql`; `apps/backend/src/lib/ai-processor/{rehost-post-image.ts, rehost-post-image.test.ts}`; possibly `apps/backend/src/lib/posts/mark-post-durable-image-url.ts` (Task 7, if not folded inline).
- **Modified:** `packages/database/schema.ts` (two new `posts` columns); `packages/domain/src/scraper/index.ts` (new export); `apps/backend/src/lib/posts/persist-scraped-post.ts` (parse-and-store call); `apps/backend/src/lib/posts/persist-scraped-post.test.ts`; `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (return-shape change); `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts`; `apps/backend/src/lib/ai-processor/process-ai-job.ts` (re-hosting step wiring); `apps/backend/src/lib/ai-processor/process-ai-job.test.ts`; `apps/backend/src/env.ts` (two new env fields); `apps/backend/package.json` (`@aws-sdk/client-s3` dependency) + lockfile.
- **Not modified:** `apps/infrastructure/lib/festgrid-backend-stack.ts` (all needed infra/env/IAM already shipped by Story 0.33 — confirmed by reading the full file); `apps/backend/src/schema/events.graphql`/`resolvers.ts` (no GraphQL field yet — Story 3.6f); `apps/web/**`, `packages/ui/**` (out of scope, sibling story's territory); `apps/backend/src/lib/scraper/instagram-adapter.ts` and its ~5 `persistScrapedPost` callers (no signature change needed per the Task 3 design decision); `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (re-hosting deliberately lives in the AI Processor Lambda, not here — see Design Decision above); `SETUP_WALKTHROUGH.md` (no new external vendor — AWS S3/CloudFront access is already provisioned via Story 0.33's existing AWS account/CDK setup, nothing new to document there).

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-video-priority-display.md] — Section 1.2 (image-expiry discovery, decoded `oe=` sample data), Section 1.4 (cost analysis grounding AD-12 Rule 2's CloudFront-fronted design), Section 4.4 (AD-12 full text), Section 4.5 (this story's originally-scoped shape), Section 7 (wave plan — this story is Wave 2/Track A, depends only on 0.33).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12] — binding rules 1 (byte reuse, no second fetch), 3 (expiry parsed at write time, null-not-unlimited), 4 (scope boundary — only successful extractions), 5 (no backfill). Rule 2 (bucket/CDN provisioning) is Story 0.33's, already done.
- [Source: apps/infrastructure/lib/festgrid-backend-stack.ts] — read in full during this story's creation; confirmed `postMediaBucket`/`postMediaDistribution`/env-var wiring/IAM grant all already exist and are scoped only to `aiProcessorLambda`.
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts] — read in full; exact current fetch/base64/fallback logic this story's Task 4 extends without changing its Gemini-facing behavior.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — read in full; exact 9-step orchestration (validation → early-returns → `transformGeminiResponseToEventInfo` → enqueue → `markPostExtractedSeam`) this story's Task 8 hooks into, and the existing `callGeminiSeam`/`markPostExtractedSeam` seam-override pattern Task 8/9 follow for testability.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, mark-post-extracted.ts] — read in full; exact insert shape Task 3 extends, and the small-DB-helper pattern Task 7's `markPostDurableImageUrl` mirrors.
- [Source: apps/backend/src/lib/scraper/instagram-adapter.ts, process-apify-async-result.ts] — grepped/read; confirmed `persistScrapedPost`'s ~5 call sites and that none require a signature change under this story's design.
- [Source: apps/backend/src/env.ts] — read in full; confirmed `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN` are not yet read here despite already being set on the Lambda's environment by CDK — the gap Task 6 closes.
- [Source: apps/backend/src/lib/aws/send-sqs-message.ts, lib/email/ses-client.ts] — existing AWS SDK client-construction style (`new XClient({})`, no explicit config) Task 7's `rehostPostImage` matches.
- [Source: packages/database/schema.ts:173-194, migrations/0036_mute_turbo.sql] — `posts` table's current shape and the single-column-`ALTER TABLE`-add migration precedent (`video_url`, Story 3.3c) Task 1 mirrors exactly.
- [Source: packages/domain/src/scraper/{index.ts, types.ts}] — existing barrel/subfolder shape Task 2's `parseImageUrlExpiry` is added into.
- [Source: apps/backend/src/validation/scraped-post.schema.ts] — confirmed `imageUrlExpiresAt` is deliberately **not** added to the AJV `ScrapedPost` schema — it's derived server-side from `imageUrl` inside `persistScrapedPost`, not part of the scraper adapter's own output contract.
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules, #Code-Quality-Style-Rules, #Testing-Rules] — `packages/domain` pure-logic/100%-coverage/no-DB-Node-leakage rules; Drizzle-only DB access; Runtime Schema Validation posture; testing-trophy philosophy; best-effort/non-blocking error-handling convention for a secondary, non-critical side effect.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode lightweight-guard basis for running Gates 1/2/3 fresh.
- [Source: _bmad-output/implementation-artifacts/3-6d-surface-schedules-flagged-as-needing-timezone-clarification.md] — format/depth precedent this story's own Dev Notes/Tasks/References follow.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Critical Implementation Rules (Drizzle-only DB access, Runtime Schema Validation posture, best-effort error handling for non-critical side effects), Code Quality & Style Rules (`packages/domain` pure-logic/no-DB-leakage placement), Testing Rules (100% `packages/domain` coverage, testing-trophy elsewhere).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (Database Schema Management: Drizzle-kit-generated SQL migrations, committed to the repo — Task 1); AD-12 (this story's binding design, Rules 1/3/4/5).
- [ ] `docs/infrastructure/index.md` / `docs/infrastructure/2-backend.md` — consulted; confirms the three-queue architecture (ScrapingQueue/AIProcessingQueue/DataIngestionQueue) this story's `process-ai-job.ts` change stays inside, without altering queue topology.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/scraper/{parse-image-url-expiry.ts, parse-image-url-expiry.test.ts}`; `packages/database/migrations/003X_*.sql`; `apps/backend/src/lib/ai-processor/{rehost-post-image.ts, rehost-post-image.test.ts}`; optionally `apps/backend/src/lib/posts/mark-post-durable-image-url.ts`.
  - Modified: `packages/database/schema.ts`; `packages/domain/src/scraper/index.ts`; `apps/backend/src/lib/posts/persist-scraped-post.ts` (+ its test); `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (+ its test); `apps/backend/src/lib/ai-processor/process-ai-job.ts` (+ its test); `apps/backend/src/env.ts`; `apps/backend/package.json` + lockfile.
- **Rule Mapping:**
  - AD-3 (Drizzle-kit-generated, committed SQL migrations) → Task 1.
  - `packages/domain` pure-logic/100%-coverage/no-DB-leakage rule → Task 2.
  - Database Access (Drizzle ORM only) → Task 3's `.values({..., imageUrlExpiresAt})`, Task 7's `db.update(posts)`.
  - AD-12 Rule 1 (no second fetch, reuse bytes) → Task 4.
  - AD-12 Rule 3 (parsed once at write time, null-not-unlimited) → Tasks 2, 3.
  - AD-12 Rule 4 (scope boundary — only successful extractions, no Manual Post Selection/moderator screens) → Task 8's placement after the `isEvent`/AJV early-returns.
  - AD-12 Rule 5 (no backfill) → explicitly noted in Dev Notes/Out of Scope, no task performs one.
  - Best-effort/non-blocking error handling (project-context.md) → Task 7's internal try/catch + Task 8's defensive wrapper.
  - Reuse over reinvention (`send-sqs-message.ts`'s client-construction style, `mark-post-extracted.ts`'s update-helper shape, `process-ai-job.ts`'s existing seam-override testing pattern) → Tasks 7, 8, 9.
  - Story-split-gate discipline (fresh Gate 1/2/3 run, epic-level-sweep-mode lightweight guard) → Dev Notes "Architecture & UX Gate Findings".
- **Verification Plan:**
  - `packages/database`: migration generates cleanly, applies to local Postgres without error.
  - `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained on `parse-image-url-expiry.ts`.
  - `apps/backend`: `pnpm --filter backend test` — `persist-scraped-post.test.ts`, `build-gemini-request.test.ts`, `rehost-post-image.test.ts`, `process-ai-job.test.ts` all pass, including the "S3 failure doesn't block extraction" and "isEvent:false skips re-hosting" cases.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — DB migration (2 columns), `parseImageUrlExpiry` pure function + wiring, re-hosting step in the AI Processor Lambda's pipeline. Confirmed unblocked: Story 0.33 (S3/CloudFront infra) already merged to `master`.
- [ ] Architecture and boundary confirmation — re-hosting placed in `process-ai-job.ts` (L_AI), not the Ingestor, per the IAM-grant/env-var verification in Dev Notes "Design Decision: Re-hosting Lives in the AI Processor Lambda, Not the Ingestor"; `parseImageUrlExpiry` placed in `packages/domain/src/scraper/`, DB/Node-dependency-free.
- [ ] Testing plan confirmation — `packages/domain` 100%-coverage unit tests (5 cases); `apps/backend` integration tests covering the happy path, S3-failure-doesn't-block-extraction, and the `isEvent:false`/AJV-failure/no-image skip cases, all scoped above.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (infra already provisioned by Story 0.33). Gate 2: no gap (zero UI scope). Gate 3: no gap (`parseImageUrlExpiry` placed reusably in `packages/domain`; `@aws-sdk/client-s3` is standard boilerplate, not a foundational gap).
- [ ] **Design decision accepted:** expiry parsing lives inside `persistScrapedPost` (single call site), not threaded through its ~5 callers (Dev Notes "Design Decision: Where Expiry Parsing Happens").
- [ ] **Design decision accepted:** re-hosting happens in the AI Processor Lambda (`process-ai-job.ts`), not the Ingestor Lambda (Dev Notes "Design Decision: Re-hosting Lives in the AI Processor Lambda, Not the Ingestor").

## Testing Requirements

- [ ] Unit tests: `packages/domain/src/scraper/parse-image-url-expiry.test.ts` (100% coverage — valid `oe=`, missing param, malformed/non-hex value, unparseable URL, null/undefined input).
- [ ] Integration tests: `persist-scraped-post.test.ts` (expiry populated/null cases); `build-gemini-request.test.ts` (bytes returned on success, `undefined` on fetch-failure fallback); `rehost-post-image.test.ts` (mocked S3 — success, rejection, missing-env-config, all non-throwing); `process-ai-job.test.ts` (re-hosting invoked only on successful extraction; a re-hosting failure never blocks `markPostExtractedSeam`/enqueue).
- [ ] E2E tests: **not added** — this is a backend data-durability side effect with no directly observable UI change in this story (the durable URL isn't served anywhere yet — that's Story 3.6f); matches this project's testing-trophy philosophy and the precedent of prior backend-plumbing-only stories (e.g. 3.6b/3.6c) shipping without a dedicated E2E spec.

## Deliverables Checklist

- [ ] `posts.durable_image_url`/`posts.image_url_expires_at` columns added via a committed Drizzle-kit migration.
- [ ] `parseImageUrlExpiry` implemented in `packages/domain/src/scraper/`, 100%-covered, exported from the package barrel.
- [ ] `persistScrapedPost` populates `imageUrlExpiresAt` on insert; `imageUrl` itself never modified.
- [ ] `buildGeminiExtractionRequest` returns the already-fetched image bytes/content-type alongside the Gemini request, with zero second fetch anywhere.
- [ ] `process-ai-job.ts` uploads those bytes to the durable bucket and writes `durableImageUrl` on successful extraction only; S3 failures are caught, logged, and never block extraction.
- [ ] `@aws-sdk/client-s3` added as an `apps/backend` dependency.
- [ ] `POST_MEDIA_BUCKET_NAME`/`POST_MEDIA_CDN_DOMAIN` read into `BackendEnv`.

## Out of Scope

- The Event GraphQL resolver's original-vs-durable serving logic (AD-12 Rule 3's "serve `imageUrl` while valid, else `durableImageUrl`") — Story 3.6f, blocked on this story.
- Exposing `durableImageUrl` as a GraphQL field, and the frontend `onError` retry wiring that would consume it — Story 3.6f.
- Manual Post Selection / moderator triage screens gaining any re-hosting behavior — explicitly excluded by AD-12 Rule 4; their posts keep the raw, time-limited `imageUrl` only.
- Backfilling `durableImageUrl`/`imageUrlExpiresAt` for posts/events persisted before this story ships — explicitly excluded by AD-12 Rule 5 (fix-going-forward only).
- Any expiry-triggered deletion of re-hosted images — explicitly excluded by AD-12 Rule 6 (not this story's concern either way, since this story never deletes anything).
- `posts.videoUrl` re-hosting — AD-12 explicitly does not bind `videoUrl`; video stays ephemeral, accepted risk per the sprint-change-proposal.
- Any change under `apps/web` or `packages/ui` — Story 1.6's concurrent sibling amendment owns that surface for the unrelated video-display feature; this story is backend-only.

## Definition of Done

- [ ] AC1-12 satisfied.
- [ ] All required tests passing (domain unit — 100% coverage; backend integration — persist-scraped-post, build-gemini-request, rehost-post-image, process-ai-job).
- [ ] Lint and type checks passing for `packages/database`, `packages/domain`, `apps/backend`.
- [ ] Migration generated, committed, and confirmed to apply cleanly against a local Postgres instance.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root) pass with no regressions to any existing suite.

## Completion Status

- [ ] Not started.

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

TBD

### Completion Notes List

TBD

### File List

TBD
