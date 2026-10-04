---
title: 'Prod outage: stop API/Scraper Lambdas from reaching sharp/face-api/tfjs'
type: 'bugfix'
created: '2026-10-04'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: cd5756bce0f78e0a588f215323b56b0e9188e055
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Prod ApiLambda/ScraperLambda crash at init (`Could not load the "sharp" module using the linux-x64 runtime`) since CI run b41916bc deployed Story 3.20's `build-gemini-request.ts -> detect-and-blur-faces.ts` static import chain, reached from `resolvers.ts`/`process-scrape-job.ts` via `enqueue-post-for-processing.ts -> process-ai-job.ts`. Only `aiProcessorLambda` ships sharp's native binary; API/scraper bundle the JS wrapper with no binary, so `require('sharp')` throws the instant either Lambda's module graph is loaded — breaking every GraphQL call.

**Approach:** Cut the three static edges that pull sharp/face-api/tfjs into API/scraper's module-load path by replacing them with `await import(...)` at the exact call sites that are gated off in prod (local-dev inline-fallback in `enqueue-post-for-processing.ts`; the `blurFacesBeforeAi` branch in `build-gemini-request.ts`; the face-blur-thumbnail branch in `process-ai-job.ts`). Additionally mark `sharp`/`@vladmandic/face-api`/`@tensorflow/tfjs*` as `externalModules` on apiLambda/scraperLambda's esbuild bundling in the CDK stack — **required**, not optional: esbuild still inlines a dynamically-imported module's full transitive graph into the bundle (confirmed by direct experiment) unless the package is marked external, so skipping this step would leave sharp/face-api/tfjs physically bundled into API/scraper (inert but present) and fail the required regression test. `aiProcessorLambda`'s bundling config is untouched.

## Boundaries & Constraints

**Always:**
- Every existing seam (`setDetectAndBlurFacesSeam`, `setUploadFaceBlurThumbnailSeam`, `setCallGeminiSeam`, `setMarkPostExtractedSeam`, `setRehostPostImageSeam`, `setBackfillAccountProfileAndInferDefaultLocationSeam`) keeps working unchanged — tests set them via the leaf module's own static import before calling the production code; `await import(...)` of an already-loaded specifier resolves to the same cached module object, so overridden seams are honored.
- `aiProcessorLambda` behavior and bundling are unchanged: it still statically imports `process-ai-job.ts` from `ai-processor.ts`, still bundles face-api/tfjs normally, still gets `sharp` via `nodeModules: ['sharp']`.
- `resolvers.ts`'s two `buildGeminiExtractionRequest(message)` call sites (`extractEventDataFromUrl`) and `scripts/poc-ingestion-preview.ts` continue to pass no `options` argument and must never trigger the new dynamic import (verified: `shouldBlur` stays `false` whenever `options.blurFacesBeforeAi` is absent, independent of `env.blurFacesBeforeAi`).
- TZ=UTC, use native Windows Postgres via `.env` `DATABASE_URL` for any DB-touching test.

**Ask First:** None — user pre-approved this exact approach and the infra-file touch it requires.

**Never:**
- Do not touch `apps/ux-rework2.md` or any other in-flight dirty file.
- Do not add `nodeModules`/Docker bundling for sharp/face-api/tfjs to apiLambda or scraperLambda — the fix is exclusion (`externalModules`), not inclusion.
- Do not change `aiProcessorLambda`'s bundling block.
- Do not run two test processes concurrently (memory pressure).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prod API call (today's crash) | `AI_PROCESSING_QUEUE_URL` set, `extractEventDataFromUrl` called | Module loads cleanly; no `require('sharp')` ever executes | N/A |
| Local dev, inline fallback on, no queue | `env.aiProcessingInlineFallbackEnabled=true`, `env.aiProcessingQueueUrl` unset | `enqueuePostForProcessing` dynamically imports and fire-and-forgets `processAiJob` exactly as before | import/process rejection still caught and logged via the existing `.catch` |
| `processAiJob` with face-blur-before-AI on, publisher not opted in | `env.blurFacesBeforeAi=true`, `isPublisherOptedIn=false` | `build-gemini-request.ts` dynamically imports `detectAndBlurFacesSeam` and blurs as before | seam override still honored |
| `processAiJob`, post has a reported face image | `payload.hasFaceImage === true`, still relevant | `process-ai-job.ts` dynamically imports `detectAndBlurFacesSeam`/`uploadFaceBlurThumbnailSeam` and runs the existing thumbnail flow unchanged | existing try/catch per step unchanged |
| aiProcessor Lambda bundle | esbuild build of `lambdas/ai-processor.ts`, no externalModules override | metafile inputs DO include `@vladmandic/face-api`/`@tensorflow/tfjs` source paths | N/A |
| API/scraper Lambda bundle | esbuild build of `lambdas/api.ts` / `lambdas/scraper.ts` with the same `externalModules` CDK uses | metafile inputs contain NO path under `sharp`, `@vladmandic/face-api`, or `@tensorflow/tfjs*` | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` -- drop static `processAiJob` import, dynamic-import it only inside the inline-fallback branch
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` -- drop static `detectAndBlurFacesSeam` import, dynamic-import it only inside `blurImageForRequest`
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- drop static `detectAndBlurFacesSeam`/`uploadFaceBlurThumbnailSeam` imports, dynamic-import each at its one call site inside the face-blur-thumbnail branch
- `apps/infrastructure/lib/festgrid-backend-stack.ts` -- export a shared `externalModules` constant; apply to `sharedLambdaProps.bundling` and `apiLambda`'s own bundling override; leave `aiProcessorLambda` untouched
- `apps/infrastructure/lib/lambda-sharp-isolation.test.ts` (new) -- esbuild-metafile regression test + a source-text guard on the three edited files

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` -- remove the top-level `processAiJob` import; replace the inline-fallback call with `import("../ai-processor/process-ai-job.js").then(({ processAiJob }) => processAiJob(message)).catch(...)`, preserving the existing error log text -- cuts the static edge from `enqueue-post-for-processing.ts` (reached by both `resolvers.ts` and `process-scrape-job.ts`) into `process-ai-job.ts`
- [x] `apps/backend/src/lib/ai-processor/build-gemini-request.ts` -- remove the top-level `detectAndBlurFacesSeam` import and its explanatory comment; inside `blurImageForRequest`, do `const { detectAndBlurFacesSeam } = await import('./detect-and-blur-faces.js');` before calling it -- `blurImageForRequest` only runs when `shouldBlur` is true, so this edge stays uncut for real callers and never loads for the two `resolvers.ts` call sites
- [x] `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- remove the top-level `detectAndBlurFacesSeam`/`uploadFaceBlurThumbnailSeam` imports; at each call site inside the `hasFaceImage === true` / `isStillRelevant` block, add the matching one-line `await import(...)` destructure immediately before use
- [x] `apps/infrastructure/lib/festgrid-backend-stack.ts` -- add `export const LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES = ['sharp', '@vladmandic/face-api', '@tensorflow/tfjs', '@tensorflow/tfjs-backend-wasm'];` near the top; add `externalModules: LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES` to `sharedLambdaProps.bundling` AND to `apiLambda`'s own `bundling` override (which otherwise fully replaces the shared one); add a short comment citing this incident; do not touch `aiProcessorLambda`'s bundling
- [x] `apps/infrastructure/lib/lambda-sharp-isolation.test.ts` (new) -- esbuild-bundle `apps/backend/src/lambdas/api.ts` and `lambdas/scraper.ts` with `external: LAMBDA_IMAGE_PROCESSING_EXTERNAL_MODULES` (imported from the stack file) + `metafile: true`; assert no `Object.keys(metafile.inputs)` entry contains `node_modules/sharp`, `node_modules/@vladmandic/face-api`, or `node_modules/@tensorflow/tfjs`; separately bundle `lambdas/ai-processor.ts` with no external override and assert its metafile inputs DO contain `@vladmandic/face-api` and `@tensorflow/tfjs` paths; add a second, cheap test case that greps the three edited source files for a static `import ... from './(detect-and-blur-faces|process-ai-job|upload-face-blur-thumbnail)\.js'` and fails if found, and for the matching `await import(` call

**Acceptance Criteria:**
- Given `AI_PROCESSING_QUEUE_URL` set and `AI_PROCESSING_INLINE_FALLBACK_ENABLED` unset/false (prod API/scraper config), when `apiLambda`/`scraperLambda` cold-start, then neither Lambda's module graph ever calls `require`/`import` on `sharp`, `@vladmandic/face-api`, or `@tensorflow/tfjs*`
- Given a test overrides `setDetectAndBlurFacesSeam`/`setUploadFaceBlurThumbnailSeam` before calling `processAiJob` or `buildGeminiExtractionRequest`, when the gated branch runs, then the overridden seam (not the real implementation) is invoked
- Given `lambdas/ai-processor.ts` is bundled with esbuild using no external overrides, when inspecting the metafile, then `@vladmandic/face-api` and `@tensorflow/tfjs` source paths ARE present, proving the regression test correctly distinguishes "lazy/excluded" from "still wired in"

## Design Notes

**Why `externalModules` is required, not a nice-to-have:** esbuild resolves a dynamic `import()` target's full module graph into the bundle the same as a static import — the only difference is *when* the resulting `require()` executes, not *whether* the code is bundled. Verified directly: a throwaway `mid.js` with `if (flag) { await import('./leaf.js') }` (flag always false) still pulled `leaf.js` and its `sharp` dependency into `metafile.inputs` under esbuild's default CJS bundling. Marking `sharp`/`@vladmandic/face-api`/`@tensorflow/tfjs*` external removes them from `metafile.inputs` regardless of static/dynamic import style — which is also why the regression test's own external list must come from the same constant the stack uses, not a hand-duplicated copy, and why this spec adds the source-text guard test as a second, independent check: it catches someone reverting a dynamic import back to static even though the metafile check alone cannot (external marking makes both styles look identical in the metafile).

**Example — `enqueue-post-for-processing.ts`'s inline-fallback branch, before/after:**
```ts
// before (static import at top of file, executes at module load):
import { processAiJob } from "../ai-processor/process-ai-job.js";
...
processAiJob(message).catch((err) => { console.error(...); });

// after (no top-level import; require deferred to this branch, never taken in prod):
import("../ai-processor/process-ai-job.js")
  .then(({ processAiJob }) => processAiJob(message))
  .catch((err) => { console.error(...); });
```

## Verification

**Commands:**
- `cd apps/infrastructure && pnpm exec tsx --test lib/lambda-sharp-isolation.test.ts` -- expected: all cases pass (API/scraper exclude the three packages, ai-processor still reaches them, no reverted static imports)
- `cd apps/infrastructure && pnpm exec tsx --test lib/festgrid-backend-stack.test.ts` -- expected: existing resource-count/bundling assertions still pass unchanged
- `cd apps/backend && pnpm exec tsc --noEmit` -- expected: no new type errors in the three edited files
- `cd apps/backend && TZ=UTC pnpm exec tsx --test src/lib/ai-processor/process-ai-job.test.ts src/lib/ai-processor/process-ai-job.face-blur.test.ts src/lib/ai-processor/process-ai-job.face-blur-before-ai.test.ts` -- run once, alone (no concurrent test process) -- expected: all pass unchanged
- `cd apps/backend && TZ=UTC pnpm exec tsx --test src/lib/ai-processor/build-gemini-request.test.ts` -- run alone -- expected: pass unchanged (live/CC-024/CC-028 `*.live-*.test.ts` files excluded, matching their own opt-in convention)
- `cd apps/backend && TZ=UTC pnpm exec tsx --test src/lib/posts/enqueue-post-for-processing.test.ts` -- run alone -- expected: pass unchanged

## Suggested Review Order

**The two edges that actually needed cutting**

- Entry point: only this one edge needed cutting to keep `process-ai-job.ts`'s whole subtree off apiLambda/scraperLambda's cold-start path.
  [`enqueue-post-for-processing.ts:94`](../../apps/backend/src/lib/posts/enqueue-post-for-processing.ts#L94)

- The second, independent edge: `resolvers.ts` reaches this file directly, so its own static import of the seam had to be cut too.
  [`build-gemini-request.ts:276`](../../apps/backend/src/lib/ai-processor/build-gemini-request.ts#L276)

**Why `process-ai-job.ts` deliberately stays static**

- Reverted mid-review after Edge Case Hunter/Blind Hunter flagged it: making these dynamic bought nothing for API/scraper (already unreachable behind the edge above) but would have regressed aiProcessorLambda's module-load timing and crash visibility.
  [`process-ai-job.ts:27`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L27)

**The bundling-side half of the fix (required, not optional)**

- Explains why `externalModules` is load-bearing: esbuild still inlines a dynamic import's full dependency graph unless the package is marked external (verified by direct experiment).
  [`festgrid-backend-stack.ts:27`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L27)

- Applied to apiLambda (which otherwise fully overrides the shared bundling block).
  [`festgrid-backend-stack.ts:243`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L243)

- Applied to the shared bundling props, covering scraperLambda (which has no bundling override of its own).
  [`festgrid-backend-stack.ts:267`](../../apps/infrastructure/lib/festgrid-backend-stack.ts#L267)

**Regression test**

- Core assertions: API/scraper never reach the three packages; aiProcessor still does (proves the check isn't a false pass).
  [`lambda-sharp-isolation.test.ts:55`](../../apps/infrastructure/lib/lambda-sharp-isolation.test.ts#L55)

- The complementary static-vs-dynamic source guard the metafile check alone can't provide.
  [`lambda-sharp-isolation.test.ts:108`](../../apps/infrastructure/lib/lambda-sharp-isolation.test.ts#L108)

- Its mirror image: asserts `process-ai-job.ts` keeps these two imports static, by design.
  [`lambda-sharp-isolation.test.ts:125`](../../apps/infrastructure/lib/lambda-sharp-isolation.test.ts#L125)
