# Story 0.46: Provision the AI Processor Lambda's image-processing runtime (memory, native-binary bundling, model assets)

## Story Details

- Epic: 0
- Story ID: 0.46
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the AI Processor Lambda (`AIProcessorLambda` in `apps/infrastructure/lib/festgrid-backend-stack.ts`) to be able to run `sharp` image processing and a TensorFlow.js face-detection model from inside its deployed bundle, with the memory, native-binary packaging and model-weight files they need,
so that Story 3.6n's detect/blur/resize stage is built against a runtime that actually exists, instead of discovering at deploy time that the Lambda has the 128 MB default memory, no native-module bundling and no way to ship model weights.

## Acceptance Criteria

1. **Given** `AIProcessorLambda` today sets no `memorySize` (CDK default 128 MB) and no `architecture` (x86_64 default) — verified against `apps/infrastructure/lib/festgrid-backend-stack.ts` 2026-10-03; only `timeout: cdk.Duration.seconds(300)` is set via `sharedLambdaProps` override, nothing else — **when** this story ships, **then** it declares explicit `memorySize` and `architecture` values chosen from a measurement recorded in Dev Notes: peak memory of a face-detection pass (model load, inference via the WASM backend chosen in AC4, Gaussian blur, resize) on at least one typical ~1080px source image and one large worst-case image, with the headroom stated. No other Lambda's configuration changes.
2. **Given** `sharp` is not a dependency of `apps/backend` today (verified — only `packages/visual-audit` imports it; `apps/backend/package.json` has no `sharp` entry) and `AIProcessorLambda`'s `NodejsFunction` bundles with `sharedLambdaProps`' esbuild defaults (`bundling: { format: CJS }` only — no `nodeModules`, no `commandHooks`, no native-module handling), **when** this story ships, **then** `sharp` is added to `apps/backend` and bundled with the native binary matching the declared Lambda architecture, proven by (a) an infra test asserting the built asset contains that binary and (b) a one-off check in the real Lambda runtime (non-prod stage or the Lambda container image) that `sharp` loads and resizes a fixture, with the result recorded in Dev Notes.
3. **Given** esbuild copies no non-JavaScript files by default (the existing, working precedent is `ApiLambda`'s `bundling.commandHooks.afterBundling` hook, which shells out to `apps/infrastructure/scripts/copy-graphql-schema.cjs` to copy `.graphql` schema files into the bundle), **when** this story ships, **then** the SSD MobileNetV1 weights from `@vladmandic/face-api` (`ssd_mobilenetv1_model.bin` ~5.6 MB plus its manifest) ship inside the bundle (via the same `bundling.commandHooks` mechanism, or an equivalent) and are loadable at runtime from a documented path (e.g. under `LAMBDA_TASK_ROOT`); an infra test asserts they are present in the asset.
4. **RESOLVED (user decision, `bmad-create-story`, 2026-10-03): WASM backend.** `@vladmandic/face-api`'s default Node entry (`dist/face-api.node.js`, v1.7.15) `require`s the native `@tensorflow/tfjs-node`, which contradicts Architecture Spine AD-28 Rule 3's "pure npm, no native binaries" as literally written. The user was presented three options with measured real costs (pure-JS CPU: zero binaries, but 8-19x slower than WASM per TensorFlow's own published WASM-backend benchmarks; WASM: `tfjs-backend-wasm`, 8-19x faster than plain JS, no native `.node` addon, ships `.wasm` binary files needing the same asset-copy mechanism as AC3's model weights; native `tfjs-node`: fastest, but its native addon is documented by the community as commonly exceeding Lambda's 50 MB zipped limit on its own, needs Docker-matched native bundling per architecture, and squarely contradicts AD-28 Rule 3) and chose **WASM** (`@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm`, loaded via `@vladmandic/face-api`'s browser/ESM entry rather than its default Node entry). **When** this story ships, **then** the WASM backend is wired up explicitly (no accidental fallthrough to the default `dist/face-api.node.js` Node entry, which would pull in native `tfjs-node`), cold-start and per-image detection latency are measured on the same fixtures as AC1, and the AD-28 Rule 3 compliance judgment is recorded in Dev Notes: a `.wasm` file is not an architecture-specific compiled Node addon (it runs identically regardless of the Lambda's CPU architecture), so this is judged consistent with Rule 3's intent — documented as an explicit interpretation, not a Rule change, and flagged for architect confirmation via `bmad-correct-course`/`bmad-architecture` if that reading is ever contested.
5. **Given** `AIProcessorLambda`'s 300 s timeout equals `AIProcessingQueue`'s 300 s visibility timeout (verified: both set via `cdk.Duration.seconds(300)`, `maxReceiveCount: 3` then the DLQ), **when** this story ships, **then** the measured worst-case duration of the face-detection stage (AC1/AC4's measurements) is compared against both and the headroom recorded. If the stage can approach either limit, the story states the guard Story 3.6n must adopt (e.g. a remaining-time check via `context.getRemainingTimeInMillis()`, or running the stage after the post is marked extracted) without implementing 3.6n's stage itself.
6. **Given** Lambda's deployment-package limits (50 MB zipped, 250 MB unzipped), **when** this story ships, **then** the bundle's zipped and unzipped size with the new dependencies (`sharp`'s native binary, `@vladmandic/face-api`, `@tensorflow/tfjs` + `@tensorflow/tfjs-backend-wasm` and their `.wasm` files, the model weights) is recorded and within limits, or the story records the alternative taken (Lambda layer or container image) and why.
7. **Given** this story provisions the runtime only, **when** it ships, **then** no face-detection stage is wired into `process-ai-job.ts` (that is Story 3.6n), existing `lambdas/ai-processor.ts` behavior is unchanged, and `festgrid-backend-stack.test.ts` gains assertions for the memory, architecture and asset checks above.

## Tasks / Subtasks

- [ ] **Task 1 — Measure peak memory, set `memorySize`/`architecture` (AC1)**
  - [ ] Build a one-off measurement harness (local script under `apps/backend`, or a direct non-prod Lambda invocation bypassing the SQS trigger) that loads `@vladmandic/face-api`'s WASM-backed detector + the SSD MobileNetV1 weights, runs detection + `sharp` Gaussian blur + resize on (a) a typical ~1080px fixture image and (b) a large worst-case fixture image, and records peak memory.
  - [ ] Choose `memorySize` and `architecture` with explicit headroom above the measured peak; record the exact numbers and the headroom multiplier in Dev Notes.
  - [ ] Set `memorySize`/`architecture` explicitly on `aiProcessorLambda` only in `apps/infrastructure/lib/festgrid-backend-stack.ts` (~line 350) — verify no other `NodejsFunction` in the stack changes.
- [ ] **Task 2 — Add and bundle `sharp` (AC2)**
  - [ ] Add `sharp` to `apps/backend/package.json` dependencies; update `pnpm-lock.yaml`.
  - [ ] Configure `aiProcessorLambda`'s `bundling` (CDK `NodejsFunctionProps.bundling.nodeModules: ['sharp', ...]`, with Docker-matched/platform-matched install so the native binary matches the Lambda's chosen `architecture` from Task 1 — esbuild's default host-platform install does not guarantee this).
  - [ ] Add an infra test (`festgrid-backend-stack.test.ts`) asserting the synthesized asset contains the architecture-matched `sharp` native binary.
  - [ ] Perform the one-off real-Lambda-runtime check (non-prod stage or Lambda container image) that `sharp` loads and resizes a fixture; record the result in Dev Notes.
- [ ] **Task 3 — Ship `@vladmandic/face-api`, the WASM backend, and model weights (AC3, AC4)**
  - [ ] Add `@vladmandic/face-api`, `@tensorflow/tfjs`, `@tensorflow/tfjs-backend-wasm` to `apps/backend/package.json`; update `pnpm-lock.yaml`.
  - [ ] Wire the WASM backend explicitly (import `@vladmandic/face-api`'s browser/ESM entry + `@tensorflow/tfjs-backend-wasm`, call `tf.setBackend('wasm')` before any detection call) — do not let the default Node resolution pull in `dist/face-api.node.js` (which `require`s native `tfjs-node`).
  - [ ] Add a `bundling.commandHooks.afterBundling` step on `aiProcessorLambda` (same pattern as `ApiLambda`'s `copy-graphql-schema.cjs` hook) that copies `ssd_mobilenetv1_model.bin` + its manifest, and `tfjs-backend-wasm`'s `.wasm` files, into the bundle at a documented path (e.g. under `LAMBDA_TASK_ROOT`).
  - [ ] Add infra tests asserting both the model-weight files and the `.wasm` files are present in the synthesized asset.
  - [ ] Measure cold-start and per-image detection latency for the WASM backend on the same fixtures as Task 1; record the numbers and the AD-28 Rule 3 compliance judgment (see AC4) in Dev Notes.
- [ ] **Task 4 — Compare against timeout/visibility-timeout budget, document the guard (AC5)**
  - [ ] Compare Task 1/3's measured worst-case stage duration against the 300 s Lambda timeout and the 300 s `AIProcessingQueue` visibility timeout (`maxReceiveCount: 3`); record headroom.
  - [ ] If headroom is thin, document the specific guard recommendation for Story 3.6n to implement (e.g. `context.getRemainingTimeInMillis()` check, or running the stage after the post is marked extracted) — do not implement it here.
- [ ] **Task 5 — Record deployment-package size against Lambda limits (AC6)**
  - [ ] After Tasks 2-3 land, measure the `aiProcessorLambda` asset's zipped and unzipped size (`cdk synth` + inspect the built asset, or the deploy-time CloudFormation package size).
  - [ ] Record the numbers against the 50 MB zipped / 250 MB unzipped limits. If exceeded, record and justify the alternative taken (Lambda layer vs. container image) instead of silently shipping an unverified build.
- [ ] **Task 6 — Confirm scope boundary, extend infra tests (AC7)**
  - [ ] Confirm no change to `process-ai-job.ts`'s control flow and no new face-detection stage wired into it (Story 3.6n's scope).
  - [ ] Confirm `apps/backend/src/lambdas/ai-processor.ts`'s existing handler behavior/control flow is unchanged — the new dependencies are reachable via CDK's `bundling.nodeModules`/`commandHooks` (Tasks 2-3), not via a new import in the handler's hot path.
  - [ ] Extend `festgrid-backend-stack.test.ts` with the memory/architecture assertions from Task 1, using the existing `findLambdaByPrefix('AIProcessorLambda')` helper pattern (already established at ~line 449 for env-var disambiguation) rather than a bare `hasResourceProperties` match, since `aiProcessorLambda` shares its 300 s `Timeout` with other batch Lambdas (Scraper/Ingestor) and a bare match risks the same false-positive class already called out in that file's Story 0.40 code-review comment.
- [ ] **Task 7 — Testing and verification (all ACs)**
  - [ ] Run `apps/infrastructure`'s test suite (`tsx --test "lib/**/*.test.ts"`, i.e. `pnpm --filter infrastructure test`) — green, including the new assertions.
  - [ ] Run lint and build for `apps/infrastructure` and `apps/backend` (both touched packages).
  - [ ] Confirm `pnpm-lock.yaml` reflects the new `apps/backend` dependencies and is committed alongside `package.json`.

## Dev Notes

- This is a **backend/infrastructure-only story**: AWS CDK stack configuration (`apps/infrastructure/lib/festgrid-backend-stack.ts`), Lambda bundling, native-binary/WASM-binary/model-weight asset packaging, and CDK infra assertion tests. It touches zero files under `apps/web`, zero React components/hooks, and writes no new business logic into `process-ai-job.ts` (that remains Story 3.6n's scope).
- **Source of this story.** This story did not originate from a fresh Gate 1 run — it *is* the Gate 1 finding. Per the CC-023 batch readiness sweep (`_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md`, `swept: true`, gates `[1, 3]`), Finding 1 under "Gate 1 — Architecture / Infrastructure Completeness" identified that `AIProcessorLambda` has no image-processing runtime for Story 3.6n's pipeline, and split this out as the new prerequisite Story 0.46 rather than letting 3.6n absorb it. Per this workflow's "Epic-Level Sweep Mode" rule (`story-split-gate.md`), Gates 1 and 3 are therefore **cited from that report, not re-run** for this story. The report's per-fact verification (bundling defaults, dependency absence, queue/timeout values, package metadata) was independently re-checked against the live source files during this story's creation (see Acceptance Criteria above, each tagged "verified") and matched the report exactly — no drift found.
- **Lightweight escape-hatch guard (per `story-split-gate.md`'s "Epic-Level Sweep Mode"):** reasoned whether this story's scope contains anything the batch sweep plausibly didn't anticipate (a new external service, a new data entity, a new infra dependency not covered). It does not — the scope is exactly the runtime-provisioning gap the sweep already fully characterized (memory, bundling, model assets, backend choice, timeout budget, package size). No fresh Gate 1/3 run was needed.

### Architecture & UX Gate Findings

- **Gate 1 (cited from the batch readiness report, not re-run):** Gap found — this story's own existence is the remediation. See "Source of this story" above.
- **Gate 2 (run fresh for this story, since Gate 2 is always per-story):** No gap found. Dispatched to a UX-persona one-shot evaluation against the full AC/task scope above: the story is entirely infrastructure provisioning (CDK Lambda config, native/WASM-binary bundling, model-weight asset packaging, infra assertion tests) and explicitly excludes any face-detection logic wiring or UI-visible consequence (deferred to Story 3.6n). There is no component, hook, or React util in scope — Gate 2's triggers (reusable component with states, complex hook/util consumed by multiple components, or a UX-artifact visual detail missing from scope) don't apply to a backend-only runtime-provisioning story.
- **Gate 3 (cited from the batch readiness report, not re-run):** No gap found for this story specifically. The report's Gate 3 "Reuse and ownership checks" section confirmed no other epic or story needs a server-side image-processing capability outside Epic 3's face-blur work, so this Lambda-runtime provisioning stays scoped to `AIProcessorLambda` and does not need to be generalized into a shared package.

### TensorFlow.js backend decision (AC4) — full record

Presented to the user at story-creation time via `AskUserQuestion`, since this is a real architectural trade-off (latency vs. bundle/bundling complexity vs. AD-28 Rule 3 compliance), not a mechanical choice:

| Option | Latency | Bundling | AD-28 Rule 3 |
|---|---|---|---|
| Pure-JS CPU (`tfjs-backend-cpu`) | Slowest — TensorFlow's own WASM-backend blog post measures plain-JS face-detector inference at ~249.5ms (Linux) / ~270.9ms (Windows) vs. WASM's ~12.6ms / ~16.2ms on comparable hardware (8-19x gap); SSD MobileNetV1 is heavier than that benchmark's model, so Lambda CPU-only inference could run into low seconds worst-case. | Simplest — zero binary assets beyond the model weights this story already ships. | Fully compliant as written, no ambiguity. |
| **WASM (`tfjs-backend-wasm`) — CHOSEN** | 8-19x faster than plain JS per the same TensorFlow benchmark; still far cheaper than CPU on SSD MobileNetV1. | Ships `.wasm` binary files (package ~13.2 MB unpacked per npm registry metadata, 2026-10-03) that esbuild won't bundle automatically — reuses the exact `commandHooks` asset-copy mechanism this story already needs for the model weights (Task 3), no new mechanism. | Judged consistent with Rule 3's *intent* (no architecture-specific compiled Node addon; the `.wasm` bytecode runs identically regardless of the Lambda's CPU architecture) even though it is technically a non-JS binary blob. Recorded as an explicit interpretation, not a formal Rule change — flagged for `bmad-correct-course`/`bmad-architecture` confirmation if ever contested. |
| Native `tfjs-node` | Fastest — compiled TensorFlow C++ core. | `@tensorflow/tfjs-node`'s native addon is documented (community packages `tfjs-node-lambda`, `tensorflow-lambda` exist specifically for this) as commonly exceeding Lambda's 50 MB zipped limit on its own; needs Docker-matched native bundling per the Lambda's exact `architecture` (x86_64 vs. arm64), not a simple asset-copy hook. | Directly contradicts Rule 3 as written — would need a formal amendment via `bmad-correct-course`/`bmad-architecture` before shipping, not a silent exception. |

Source data: `@vladmandic/face-api@1.7.15` registry metadata (23.6 MB unpacked, 254 files, `main: dist/face-api.node.js` which `require`s native `@tensorflow/tfjs-node`, all `@tensorflow/*` deps pinned to 4.22.0 including `tfjs-node`, `tfjs-backend-wasm`, `tfjs-backend-cpu`); `@tensorflow/tfjs-backend-wasm@4.22.0` (~13.2 MB unpacked, 376 files); `@tensorflow/tfjs-backend-cpu@4.22.0` (~10.5 MB unpacked, 444 files); `@tensorflow/tfjs-node@4.22.0` (small registry-listed unpacked size of ~2 MB is misleading — its `install.js`/`node-pre-gyp` postinstall downloads a much larger platform-specific native addon, independently documented at >140 MB installed, which is why community Lambda-specific repackaging projects exist); TensorFlow's own "Introducing the WebAssembly backend for TensorFlow.js" blog post (blog.tensorflow.org, 2020) for the WASM-vs-plain-JS latency numbers above. A **production latency/cold-start measurement for this specific model (SSD MobileNetV1) on this specific runtime (AWS Lambda, Node 22.x) is still required by AC4/Task 3** — the numbers above are grounding for the decision, not a substitute for the story's own measurement.

**Why WASM over the others, in one line:** it gets most of native `tfjs-node`'s speed advantage over plain JS, without native `tfjs-node`'s Lambda-package-size crisis or its direct AD-28 Rule 3 conflict — at the cost of one additional (but mechanically identical to Task 3's model-weight copy) asset-bundling step.

### `bundling.nodeModules` vs. a new `ai-processor.ts` import — the mechanism for AC7's scope boundary

AC7 requires that no face-detection stage is wired into `process-ai-job.ts` and that `lambdas/ai-processor.ts`'s existing behavior is unchanged, while AC2/AC3 require the deployed *asset* to actually contain `sharp`'s native binary, `@vladmandic/face-api`, the WASM backend, and the model weights (provable by an infra test on the synthesized bundle). These are not in tension if implemented correctly: CDK's `NodejsFunctionProps.bundling.nodeModules` (a string array) tells esbuild to treat the listed packages as **external** and has CDK separately `npm`/`pnpm install` them into the output `node_modules` as real files (preserving `sharp`'s native binary and the WASM `.wasm` files) — this does **not** require the packages to be statically imported by the entry file (`ai-processor.ts`). Pair this with Docker-based bundling (CDK's `bundling.forceDockerBundling: true`, or ensure the build runs on a host matching the Lambda's target architecture) so `sharp`'s platform-specific postinstall binary matches the Lambda's actual runtime (Amazon Linux on the architecture chosen in Task 1), not the developer's local OS/arch. The model-weight and `.wasm`-file copy (AC3) still goes through `bundling.commandHooks.afterBundling`, mirroring `ApiLambda`'s existing `copy-graphql-schema.cjs` precedent (`festgrid-backend-stack.ts` ~lines 241-259).

For AC2(b)/AC4's "one-off check in the real Lambda runtime" proof (which does require actually *invoking* the loaded libraries, not just confirming they're present as files), the dev agent should use a verification path that does not alter the handler's production control flow for its normal SQS-triggered path — e.g. a temporary direct Lambda invoke (non-prod stage) with a distinguishable test payload routed to a small diagnostic branch, or an equivalent non-invasive mechanism — and record exactly which mechanism was used and its result in Dev Notes, per AC2/AC4's own wording. This story does not prescribe the exact diagnostic-invocation shape; it is an implementation detail bmad-dev-story should choose and document, not a design decision requiring another user checkpoint.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None. This story adds no database columns, no GraphQL fields, and no TypeScript interface changes — it is pure Lambda runtime/bundling configuration plus new npm dependencies in `apps/backend`.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required.
- Backward compatibility and rollout notes: Purely additive infra change (new Lambda config, new bundled dependencies). No existing Lambda behavior changes except `aiProcessorLambda`'s own `memorySize`/`architecture`/bundling config. A CDK deploy of this story alone should be a no-behavior-change deploy for the live system — verified by AC7's requirement that `lambdas/ai-processor.ts`'s existing handler logic is unchanged.
- Verification checks: `festgrid-backend-stack.test.ts`'s new assertions (memory, architecture, asset presence for the native binary/model weights/`.wasm` files); the one-off real-Lambda-runtime checks for `sharp` (AC2) and the face-api WASM detector (AC4).

### Package boundary / cross-cutting checks (persistent-fact auto-checks, all N/A for this story)

- **packages/domain / packages/ui:** No reusable function/mechanism or UI component is created by this story — it is CDK infra config plus new `apps/backend` npm dependencies, not application/business logic. Nothing to place in `packages/domain` or `packages/ui`.
- **SETUP_WALKTHROUGH.md:** No new cloud/external service is being set up (no new AWS service, no new third-party account) — `sharp`/`face-api`/TensorFlow.js are npm dependencies bundled into an already-provisioned Lambda. No `SETUP_WALKTHROUGH.md` update needed.
- **PostHog analytics / next-intl i18n:** N/A — no user interaction, no user-facing strings. This is a backend-only runtime change invisible to end users until Story 3.6n wires it in.
- **State management (React Query/nuqs/zustand) / loader categorization (blocking/non-blocking):** N/A — no frontend code, no asynchronous UI state.
- **Drizzle/AJV schema validation, zod:** N/A — no new data entering the system through this story; no schema change.

### Project Structure Notes

- Primary file: `apps/infrastructure/lib/festgrid-backend-stack.ts` — `aiProcessorLambda`'s `NodejsFunction` definition (~line 350) gains `memorySize`, `architecture`, and a `bundling` override (`nodeModules`, `commandHooks.afterBundling`, Docker-matched install) analogous to `apiLambda`'s existing `bundling` override (~lines 236-259) but for native-binary/WASM/model-weight assets instead of `.graphql` schema files.
- Test file: `apps/infrastructure/lib/festgrid-backend-stack.test.ts` (518 lines today) — extend using the existing `Template`/`Match` (`aws-cdk-lib/assertions`) pattern and the `findLambdaByPrefix` helper already established (~line 449) for disambiguating `aiProcessorLambda` from other same-timeout batch Lambdas.
- Dependency file: `apps/backend/package.json` — add `sharp`, `@vladmandic/face-api`, `@tensorflow/tfjs`, `@tensorflow/tfjs-backend-wasm`; `pnpm-lock.yaml` updates accordingly. No other `apps/backend` source file needs to change for this story (AC7).
- No new files under `apps/web`, `packages/domain`, or `packages/ui`.
- This matches the established Epic 0 "single-consumer Lambda/infra provisioning" pattern already used by Story 0.27 (notifier Lambda infrastructure) and Story 0.33 (post-media S3/CloudFront infrastructure) — both are single-feature infra prerequisites scoped to Epic 0 rather than their consuming epic.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` §"Story 0.46"] — authoritative ACs this story file is drafted from.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md`] — Gate 1 Finding 1 (this story's origin), Gate 3 reuse/ownership checks, verified facts on bundling defaults, dependency absence, and queue/timeout config.
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.ts`, lines 215-223 (`sharedLambdaProps`), 236-259 (`apiLambda`'s `commandHooks` precedent), 350-367 (`aiProcessorLambda`), 69-107 (`AIProcessingQueue`/DLQ config)] — verified 2026-10-03.
- [Source: `apps/infrastructure/lib/festgrid-backend-stack.test.ts`, lines 1-15 (`Template`/`Match` pattern), 442-469 (`findLambdaByPrefix` helper + its Story 0.40 code-review disambiguation rationale)] — verified 2026-10-03.
- [Source: `apps/backend/package.json`] — verified no `sharp`/`@vladmandic/face-api`/`@tensorflow/*` dependency exists today.
- [Source: Architecture Spine AD-28 ("Face-Blurred Thumbnails — Consent-Independent, Expiry-Gated"), Rule 3] — `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, lines 1355-1451, the "pure npm, no native binaries" wording this story's AC4 decision is judged against.
- [Source: npm registry metadata, fetched 2026-10-03 — `@vladmandic/face-api@1.7.15`, `@tensorflow/tfjs-backend-wasm@4.22.0`, `@tensorflow/tfjs-backend-cpu@4.22.0`, `@tensorflow/tfjs-node@4.22.0`] — package sizes, entry points, and dependency pins cited in the backend-decision table above.
- [Source: TensorFlow Blog, "Introducing the WebAssembly backend for TensorFlow.js" (blog.tensorflow.org, 2020)] — WASM-vs-plain-JS latency benchmark cited in AC4/the backend-decision table.
- [Source: community packages `tfjs-node-lambda`, `tensorflow-lambda` and related write-ups] — evidence that `@tensorflow/tfjs-node`'s native addon commonly exceeds Lambda's 50 MB zipped limit without dedicated repackaging tooling, cited in AC4's native-backend rejection.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack (Backend: Serverless on AWS, Lambda), Security ("Resilient Processing Pipeline" — SQS queue decoupling, unaffected by this story), General Architecture (Adapter Pattern for external AI services — not applicable here, no external AI service call; face-api/TensorFlow.js run in-process). No Critical Implementation Rule in this file is touched or violated by a pure Lambda-runtime provisioning story.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows the canonical section order and status vocabulary defined there.
- [x] Architecture spine — `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, AD-28 Rule 3 (TensorFlow.js backend compliance judgment, AC4) and the general "Prevents: AWS Rekognition... zero marginal AWS cost" framing that motivates avoiding a paid per-image detection service.
- [x] Infrastructure docs — `docs/infrastructure/2-backend.md` (Lambda/SQS pipeline architecture); this story's scope is infra-only and was cross-checked against the live CDK stack rather than requiring a docs edit, since no new queue/pipeline stage is introduced (that remains Story 3.6n).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/infrastructure/lib/festgrid-backend-stack.ts` — `aiProcessorLambda`: add `memorySize`, `architecture`, and a `bundling` override (`nodeModules` for `sharp`/`@vladmandic/face-api`/`@tensorflow/tfjs`/`@tensorflow/tfjs-backend-wasm`, `commandHooks.afterBundling` for model weights + `.wasm` files, Docker-matched native install).
  - `apps/infrastructure/lib/festgrid-backend-stack.test.ts` — new/extended assertions for `aiProcessorLambda`'s `MemorySize`, `Architectures`, and the presence of the bundled native binary, model weights, and `.wasm` files in the synthesized asset (via `findLambdaByPrefix`/asset-inspection helpers, not a bare `hasResourceProperties` match).
  - `apps/backend/package.json` / `pnpm-lock.yaml` — add `sharp`, `@vladmandic/face-api`, `@tensorflow/tfjs`, `@tensorflow/tfjs-backend-wasm`.
  - A one-off measurement/diagnostic artifact (local script or a temporary non-prod-invocable code path) used to produce the memory/latency numbers for AC1/AC4/AC5 — its exact shape is a `bmad-dev-story` implementation choice (see Dev Notes), but it must not alter `lambdas/ai-processor.ts`'s production SQS-triggered control flow (AC7).
  - **Explicitly unchanged:** `apps/backend/src/lambdas/ai-processor.ts`'s existing handler logic; `apps/backend/src/*/process-ai-job.ts` and every other Lambda's CDK definition in `festgrid-backend-stack.ts`.
- **Rule Mapping:**
  - AC1/AC5/AC6 (measurement-driven config) → `project-context.md`'s "Database & Performance" philosophy of sizing from measurement, not guesswork, applied here to Lambda memory/timeout/package-size instead of DB indexing — same discipline, different resource.
  - AC2/AC3 (native-binary/asset bundling) → precedent already established in this exact file by `apiLambda`'s `commandHooks.afterBundling` (schema-file copying); this story extends the same CDK mechanism to a different asset class (native binaries via `nodeModules`, model weights/`.wasm` via `commandHooks`).
  - AC4 (backend choice) → Architecture Spine AD-28 Rule 3 compliance judgment, resolved via user decision at create-story (see Dev Notes' full record) rather than silently diverged from, per `story-split-gate.md`'s escape-hatch principle (a deliberate, recorded decision — not a missed one).
  - AC7 (scope boundary) → `story-split-gate.md`'s Gate 1 remediation principle: provision the missing layer as its own prerequisite story rather than letting the consuming story (3.6n) absorb it; this story must not reach into 3.6n's territory any more than strictly needed to prove the runtime works.
- **Verification Plan:**
  - `pnpm --filter infrastructure test` (`tsx --test "lib/**/*.test.ts"`) — green, including new `aiProcessorLambda` memory/architecture/asset assertions.
  - `pnpm --filter infrastructure lint` / `pnpm --filter backend lint` — green.
  - `pnpm --filter backend build` / `pnpm --filter infrastructure build` (`cdk synth` succeeds with the new bundling config) — green; inspect the synthesized asset directly to confirm the native binary, model weights, and `.wasm` files are physically present (not just referenced).
  - The one-off real-Lambda-runtime checks for `sharp` (AC2b) and the WASM face-api detector (AC4) — results recorded in Dev Notes, re-runnable if the bundling config changes later.
  - `festgrid-backend-stack.test.ts`'s pre-existing assertions (8 Lambda count, env vars, queue config, etc.) must still pass unchanged — this story must not perturb any other Lambda's resource properties.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — provisions the AI Processor Lambda's image-processing runtime only; no face-detection stage wired into `process-ai-job.ts` (Story 3.6n's scope, hard-depends on this story).
- [ ] Architecture and boundary confirmation — all changes confined to `apps/infrastructure/lib/festgrid-backend-stack.ts` (+ its test file) and `apps/backend/package.json`/`pnpm-lock.yaml`; no `packages/domain`/`packages/ui`/`apps/web` changes.
- [ ] Testing plan confirmation — infra assertion tests (`tsx --test`, `aws-cdk-lib/assertions`) extended per the existing pattern; one-off real-runtime checks for `sharp` and the WASM face-api detector performed and recorded.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1 and Gate 3 cited from the swept `batch-cc-023-face-blur-audit-readiness.md` report (this story IS that report's Gate 1 remediation); Gate 2 run fresh, no gap found (see Dev Notes).
- [ ] AD-28 Rule 3 compliance judgment (WASM backend, AC4) explicitly acknowledged — recorded as an interpretation, not a formal amendment; flag for `bmad-correct-course`/`bmad-architecture` only if later contested.

## Testing Requirements

- [ ] Infra assertion tests (`apps/infrastructure/lib/festgrid-backend-stack.test.ts`, `tsx --test` + `aws-cdk-lib/assertions` `Template`/`Match`) — the established pattern for this package (NOT Vitest; `apps/infrastructure` and `apps/backend` both use `tsx --test`, only `apps/web` uses Vitest):
  - `aiProcessorLambda`'s `MemorySize` and `Architectures` match the values chosen in AC1.
  - The synthesized asset contains `sharp`'s architecture-matched native binary (AC2).
  - The synthesized asset contains the SSD MobileNetV1 weights + manifest and the `tfjs-backend-wasm` `.wasm` files (AC3).
  - No other Lambda's `MemorySize`/`Architectures`/environment/resource properties change (regression guard, reusing the existing full-stack assertion test's structure).
- [ ] One-off real-runtime checks (not automated CI tests, but required evidence recorded in Dev Notes per AC2/AC4): `sharp` loads and resizes a fixture in the real Lambda runtime; the WASM-backed face-api detector loads the model and runs detection in the real Lambda runtime.
- [ ] No integration or E2E tests apply — this story has no API/GraphQL surface and no user-facing flow (Testing Philosophy's "testing trophy" integration/E2E tiers target `apps/*` user-facing or API behavior, neither of which this story adds).

## Deliverables Checklist

- [ ] `aiProcessorLambda` has explicit, measurement-backed `memorySize` and `architecture`.
- [ ] `sharp` bundled with its architecture-matched native binary; proven via infra test + real-runtime check.
- [ ] `@vladmandic/face-api` (WASM entry) + model weights bundled and loadable at a documented runtime path; proven via infra test + real-runtime check.
- [ ] TensorFlow.js backend decision (WASM) and its AD-28 Rule 3 compliance judgment recorded in Dev Notes.
- [ ] Timeout/visibility-timeout headroom recorded; Story 3.6n's guard recommendation documented if headroom is thin.
- [ ] Deployment package zipped/unzipped size recorded against Lambda limits; alternative (layer/container) recorded if exceeded.
- [ ] `festgrid-backend-stack.test.ts` extended with memory/architecture/asset assertions; full existing test suite still green.
- [ ] `lambdas/ai-processor.ts` and `process-ai-job.ts` unchanged.

## Out of Scope

- Wiring the face-detection/blur/resize/upload pipeline into `process-ai-job.ts` — Story 3.6n (hard-depends on this story).
- The `durableThumbnailUrl` GraphQL field, mapper, and codegen read path — Story 3.6n.
- The relevance gate (skip detection for events whose window ends before the image expires) — Story 3.6o.
- The `extraction_audit_logs` table and `actualFaceDetectionCount`/`faceDetectionSkippedReason` write/back-fill — Story 3.6p.
- Any change to `AIProcessorLambda`'s business logic, message shape, or queue wiring — unaffected by this story.
- A formal `bmad-correct-course`/`bmad-architecture` amendment to AD-28 Rule 3's wording — not triggered by the WASM decision per this story's compliance judgment (see Dev Notes); would only become in-scope for a future story if that judgment is contested.

## Definition of Done

- [ ] AC1-AC7 satisfied, each with the measurement/record Dev Notes requires.
- [ ] `pnpm --filter infrastructure test` and `pnpm --filter backend test` passing.
- [ ] Lint and type checks passing for `apps/infrastructure` and `apps/backend`.
- [ ] `cdk synth` succeeds with the new bundling config; synthesized asset manually verified to contain the native binary, model weights, and `.wasm` files.
- [ ] No regression in any other Lambda's CDK resource properties (existing `festgrid-backend-stack.test.ts` assertions still pass unchanged).
- [ ] Dev Notes record every measured number (peak memory, cold-start/per-image latency, package size) — this story is explicitly measurement-driven, not configuration-by-guess.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
