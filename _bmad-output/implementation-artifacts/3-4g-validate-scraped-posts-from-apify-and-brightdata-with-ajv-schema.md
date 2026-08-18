# Story 3.4g: Validate scraped posts from Apify and Bright Data with an AJV schema

## Story Details

- Epic: 3
- Story ID: 3.4g
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want every `ScrapedPost`-shaped object produced by **both** vendor paths (Apify's `mapApifyItemToScrapedPost`, and Bright Data's `processBrightDataResult` field-mapping) to be validated against a shared AJV schema before it reaches `persistScrapedPost`,
so that malformed or incomplete scraper output from either vendor is caught and dropped at the boundary instead of silently flowing into persistence and downstream AI extraction — closing the gap against `project-context.md`'s "Runtime Schema Validation" rule, which today is honored for Gemini responses but not for either scraper vendor's responses.

**Revision (2026-08-18, user request during story creation):** Originally scoped to the Apify/Instagram path only. Investigating the Apify path surfaced that Bright Data's `processBrightDataResult` (Story 3.4a) has the identical gap — no schema validation, only ad-hoc field extraction — plus two pre-existing, confirmed-via-`tsc` bugs on the same code path (see AC6/AC7). Scope expanded to cover both vendor paths with one shared schema, since both converge on the same `ScrapedPost` shape immediately before calling `persistScrapedPost`.

## Acceptance Criteria

1. **Given** `apps/backend/src/validation/` (which already holds `extracted-event.schema.ts`, `proposed-event-correction.schema.ts`, `report-system-error.schema.ts`, each paired with `compileValidator` from `validate.ts`), **when** this story ships, **then** a new `apps/backend/src/validation/scraped-post.schema.ts` exists, exporting an AJV `JSONSchemaType<ScrapedPost>` (`ScrapedPost` from `@festgrid/domain`, `packages/domain/src/scraper/types.ts`) with `content: string`, `postUrl: string`, `publishedAt: string` required, and `imageUrl?: string`/`originalPostUrl?: string` as `nullable: true` optional properties (mirroring `geminiScheduleSchema`'s optional-field convention in `extracted-event.schema.ts`), and `additionalProperties: false`.
2. **And** `mapApifyItemToScrapedPost` in `apps/backend/src/lib/scraper/instagram-adapter.ts` (currently `instagram-adapter.ts:84-95`) validates the object it builds against this schema via `compileValidator<ScrapedPost>` before returning it, and its return type changes from `ScrapedPost` to `ScrapedPost | null`. On failure it logs the AJV `.errors` detail (matching `process-ai-job.ts:52-56`'s `console.error(... validate.errors)` pattern for the Gemini path) and returns `null` — it does not throw, so one malformed item can't fail a whole batch.
3. **And** all three existing call sites of `mapApifyItemToScrapedPost` are updated to handle the new `null` outcome without otherwise changing their control flow:
   - `getPostByUrl` (`instagram-adapter.ts:127-156`) already declares `Promise<ScrapedPost | null>` at the `ScraperAdapter` interface level — it passes the mapper's `null` straight through.
   - `getNewestPosts` (`instagram-adapter.ts:158-186`) currently does `items.map(mapApifyItemToScrapedPost)` with no filtering — it must filter `null` entries out before returning `ScrapedPost[]`. `recordProviderUsage('apify', items.length)` continues counting all Apify-billed items (validation failures included) — Apify bills per item regardless of downstream validation outcome, matching today's usage-recording semantics.
   - `processApifyAsyncResult` (`apps/backend/src/lib/scraper/process-apify-async-result.ts:16-24`, Story 3.4f's async job-result path) currently calls `mapApifyItemToScrapedPost(item)` and immediately reads `post.postUrl`/`post.imageUrl`/`post.content`/`post.publishedAt` with no null check — today a validation-failing item would throw a `TypeError` reading a property of `null`, which happens to be swallowed by the surrounding per-item `try/catch` (`process-apify-async-result.ts:15-28`) but with a misleading error log (`Failed to persist post from Apify item`, not a validation-failure message). This story adds an explicit `if (!post) { continue; }`-style guard so the skip is intentional and clearly logged, not an incidental catch of a `TypeError`.
4. **And** a new `apps/backend/src/validation/scraped-post.schema.ts`-validated check is added to Bright Data's `processBrightDataResult` (`apps/backend/src/lib/scraper/process-brightdata-result.ts:12-39`, Story 3.4a): the function's existing ad-hoc field mapping (`postUrl`/`imageUrl`/`caption`/`datePosted` extraction, `process-brightdata-result.ts:17-25`) is followed by validating the constructed `ScrapedPost`-shaped candidate against the **same** `scrapedPostSchema` used for Apify, using the same `compileValidator<ScrapedPost>` pattern. On failure, it logs and `continue`s to the next record (mirroring the existing `if (!postUrl) { console.warn(...); continue; }` early-exit already in the function), instead of relying only on the current single manual `postUrl` presence check.
5. **And** `instagram-adapter.test.ts` gains test cases (alongside the existing `mapApifyItemToScrapedPost maps Apify item correctly` case) covering: a valid Apify item still maps successfully post-validation (regression guard on AC1-2), and an invalid item (e.g. missing `caption`/`timestamp`/`url` such that required fields can't be derived, or a wrong-typed field) causes `mapApifyItemToScrapedPost` to return `null` rather than throwing or producing a malformed object; plus a `getNewestPosts` case asserting a batch with one invalid item still returns the valid items. `process-apify-async-result.test.ts` gains a case asserting a batch containing one AJV-invalid item still persists the valid items without a misleading error log for the invalid one. `process-brightdata-result.ts` gains a new `process-brightdata-result.test.ts` (none exists today) covering: a valid record persists correctly, and an AJV-invalid record (e.g. wrong-typed `datePosted`) is skipped without throwing, matching `process-apify-async-result.test.ts`'s existing db-integration test style.
6. **And**, as a **pre-existing bug fix required for this story's code to even compile/run** (confirmed via direct `npx tsc --noEmit` read during story creation): both `process-apify-async-result.ts:4` and `process-brightdata-result.ts:4` import `persistScrapedPost` from `./persist-scraped-post.js` (same directory, i.e. `apps/backend/src/lib/scraper/persist-scraped-post.js`), but the actual module lives at `apps/backend/src/lib/posts/persist-scraped-post.ts` (one directory up, in `posts/`, confirmed the file does not exist at the `scraper/`-relative path) — `tsc` reports `TS2307: Cannot find module './persist-scraped-post.js'` for both files today. This story fixes both imports to `../posts/persist-scraped-post.js`, matching `process-scrape-job.ts:4`'s already-correct import of the same module.
7. **And**, as a second pre-existing bug this story's validation work directly surfaces (confirmed via direct read of `process-brightdata-result.ts:33` and `persist-scraped-post.ts:11`): `processBrightDataResult` calls `persistScrapedPost({ ..., publishedAt: datePosted ? new Date(datePosted) : new Date(), ... })`, passing a `Date` object, but `persistScrapedPost`'s `PersistScrapedPostParams.publishedAt` is typed `string` (and is passed straight into `new Date(publishedAt)` at `persist-scraped-post.ts:50`, i.e. it expects an ISO string, not an already-constructed `Date`). This story fixes `processBrightDataResult` to pass `publishedAt` as a string (e.g. `(datePosted ? new Date(datePosted) : new Date()).toISOString()`), so the AJV schema's `publishedAt: string` check and the actual runtime value agree.

## Tasks / Subtasks

- [ ] Task 1: Define the shared `ScrapedPost` AJV schema (AC: #1)
  - [ ] Subtask 1.1: Create `apps/backend/src/validation/scraped-post.schema.ts`, modeled directly on `extracted-event.schema.ts`'s `JSONSchemaType<T>` + `required`/`nullable`/`additionalProperties: false` pattern.
- [ ] Task 2: Wire validation into the Apify path (`instagram-adapter.ts`) and all three of its call sites (AC: #2, #3, #5)
  - [ ] Subtask 2.1: Compile the validator once at module scope in `instagram-adapter.ts` via `compileValidator<ScrapedPost>(scrapedPostSchema)` (not per-call inside the mapper — see Dev Notes rationale) and call it on the constructed candidate object before returning.
  - [ ] Subtask 2.2: Change `mapApifyItemToScrapedPost`'s signature to `(item: any): ScrapedPost | null`, log `validate.errors` on failure, return `null`.
  - [ ] Subtask 2.3: Build the candidate object so that an absent `imageUrl`/`originalPostUrl` is an **omitted key**, not a key present with value `undefined` — see the "Data Type Compatibility" gotcha below; a literal `undefined` value on a present key fails AJV's `nullable: true` check (which only accepts `string | null`, not `undefined`).
  - [ ] Subtask 2.4: Update `getPostByUrl` to pass through the mapper's `null` result unchanged (it already declares `ScrapedPost | null`).
  - [ ] Subtask 2.5: Update `getNewestPosts` to filter `null` entries out of the mapped array (e.g. a type-guarded `.filter((post): post is ScrapedPost => post !== null)`) before returning, while leaving the existing `recordProviderUsage('apify', items.length)` call counting raw Apify item count unchanged.
  - [ ] Subtask 2.6: Update `processApifyAsyncResult` (`process-apify-async-result.ts`) to explicitly check for and skip a `null` mapper result before calling `persistScrapedPost`, logging a clear "skipped invalid item" message distinct from the existing generic per-item catch-block error.
  - [ ] Subtask 2.7: Add new test cases to `instagram-adapter.test.ts` and `process-apify-async-result.test.ts` per AC5.
- [ ] Task 3: Wire the same validation into the Bright Data path (`process-brightdata-result.ts`) (AC: #4, #5)
  - [ ] Subtask 3.1: In `processBrightDataResult`, after building the candidate object from `brightDataRecord` fields, validate it against the same `scrapedPostSchema`/`compileValidator<ScrapedPost>` before calling `persistScrapedPost`; on failure, log and `continue` (matching the existing `if (!postUrl)` skip pattern already in the function).
  - [ ] Subtask 3.2: Create `process-brightdata-result.test.ts` (new file — none exists today) covering a valid record and an AJV-invalid record, following `process-apify-async-result.test.ts`'s db-integration test style (`t.beforeEach`/`t.afterEach` profile setup/teardown, real `db` assertions).
- [ ] Task 4: Fix the two pre-existing bugs this story's work directly touches (AC: #6, #7)
  - [ ] Subtask 4.1: Fix the broken `persistScrapedPost` import path in both `process-apify-async-result.ts` and `process-brightdata-result.ts` (`./persist-scraped-post.js` → `../posts/persist-scraped-post.js`).
  - [ ] Subtask 4.2: Fix `processBrightDataResult`'s `publishedAt` to be passed as an ISO string (`.toISOString()`), not a `Date` object, to `persistScrapedPost` — required for the AJV schema's `publishedAt: string` check to reflect the actual runtime value being validated.
  - [ ] Subtask 4.3: Run `npx tsc --noEmit -p apps/backend` scoped to the touched files to confirm both import-path errors are gone (the wider backend build has unrelated pre-existing errors from in-flight, uncommitted schema/resolver work visible in `git status` — out of scope for this story; do not attempt to fix those).

## Dev Notes

- This story closes a documented compliance gap, not a bug report, for its core scope: `project-context.md`'s "Runtime Schema Validation" rule ("All data entering the system from external sources (APIs, scrapers) must be validated at the point of entry with Zod (frontend) or AJV (backend)") is already honored for the Gemini AI-extraction path (`process-ai-job.ts:40-56`, using `extracted-event.schema.ts`) but was never implemented for **either** scraper vendor path — Apify's `mapApifyItemToScrapedPost` and Bright Data's `processBrightDataResult` both only do defensive `||`-fallback field extraction, no schema check.
- **Reference pattern to follow exactly (log + return null / continue on failure):** `process-ai-job.ts:50-56`:
  ```ts
  const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
  const isValid = validate(payload);
  if (!isValid) {
    console.error(`Gemini response failed AJV validation for post ${message.postId}:`, validate.errors);
    return;
  }
  ```
  Apply this shape to both vendor paths: `mapApifyItemToScrapedPost` returns `null` on failure (a value-returning function); `processBrightDataResult`'s per-record loop logs and `continue`s (a void per-item loop, same shape as its existing `if (!postUrl) { console.warn(...); continue; }` check).
- **One schema, two vendors:** both paths converge on the same `ScrapedPost` shape immediately before `persistScrapedPost` — Apify via `mapApifyItemToScrapedPost`'s return value, Bright Data via the inline candidate object `processBrightDataResult` builds from `brightDataRecord` fields (`postUrl`/`imageUrl`/`caption`→`content`/`datePosted`→`publishedAt`). Reuse the single `scrapedPostSchema` from Task 1 for both — do not create a second, near-duplicate schema.
- **Deliberate deviation from the literal Gemini call-site pattern, with rationale:** `process-ai-job.ts` calls `compileValidator(...)` fresh inside the per-message handler (called once per SQS message). Both scraper mappers, by contrast, run inside a loop over multiple items/records per invocation (`getNewestPosts`'s `items.map(...)`, `processBrightDataResult`'s `for (const record of records)`). Recompiling the validator per item would recompile the same schema once per item for no benefit. Compile once at module scope in each file instead (same `compileValidator` from `validate.ts`, same effect, called once per module load rather than once per item).
- **Data Type Compatibility gotcha (why Subtask 2.3 matters):** the existing Apify mapper builds `imageUrl`/`originalPostUrl` as `item.displayUrl || item.imageUrl || undefined` — in a plain object literal, assigning a field to `undefined` still leaves that key **present** on the object (`'imageUrl' in obj` is `true`), it does not omit it. AJV's `JSONSchemaType` `nullable: true` on an optional field only accepts `string | null` for a present key — `undefined` fails that check even though the field is not `required`. If the candidate object is built the same way as today (literal `undefined` assignment) and then validated, every scraped item lacking an image would fail validation and be dropped — a functional regression, not just a lint nit. The fix is to omit the key entirely when the value is falsy (e.g. conditional spread), not to assign `undefined`. Apply the same care to the Bright Data candidate object in Task 3.
- **Scope boundary:** this story touches `instagram-adapter.ts`, `process-apify-async-result.ts`, and `process-brightdata-result.ts` (plus the new schema file) — it does not touch `process-ai-job.ts`/Gemini validation (already compliant), and does not touch the Twitter/X stub adapter (`packages/domain/src/scraper` registry; not implemented yet, out of scope per Story 3.3c's existing precedent for scoping scraper work to shipped adapters — see Story 3.4e AC5 for the same boundary).
- Existing validation infra this story reuses as-is, with no changes needed: `apps/backend/src/validation/validate.ts`'s `compileValidator<T>(schema: Schema)` (wraps a shared `Ajv({ allErrors: true })` instance with `ajv-formats`), established by Story 0.11 (`0-11-set-up-runtime-schema-validation`, status `review`) and already proven by the Gemini path — no new AJV setup, dependency, or config is required.
- The two bugs fixed under AC6/AC7 were discovered as a direct consequence of investigating the Bright Data path for this story's validation work — they are not scope creep, they are blockers: `processBrightDataResult` and `processApifyAsyncResult` cannot even import `persistScrapedPost` today (`TS2307`), and the `Date`-vs-`string` mismatch would cause every Bright Data record to fail this story's own new AJV validation once wired in (since the real runtime value passed would be a `Date`, not the `string` the schema and the interface both declare). Fixing them is required to make this story's own acceptance criteria achievable, not an unrelated cleanup.
- The wider `apps/backend` codebase currently has many unrelated pre-existing `tsc` errors (confirmed via a full `npx tsc --noEmit -p apps/backend` run during story creation) — these stem from in-flight, uncommitted schema/resolver/generated-types work visible in `git status` (e.g. `apps/backend/src/schema/events.graphql`, `apps/backend/src/generated/resolvers-types.ts`, `packages/domain/src/users/*`), unrelated to this story. Do not attempt to fix those as part of this story; Subtask 4.3's `tsc` check should be scoped to confirming only the two import-path errors this story introduces a fix for are resolved.

### Architecture & UX Gate Findings

- No gap found. This story wires an already-established, epic-readiness-confirmed pattern (AJV validation via `compileValidator`/`validate.ts`, Story 0.11) into two existing adapter/result-processing files (`instagram-adapter.ts`, `process-apify-async-result.ts`, `process-brightdata-result.ts`), using an existing schema file convention (`apps/backend/src/validation/*.schema.ts`). No new backend infrastructure, no bypass of the API/backend layer, and no cross-cutting foundational dependency is introduced.
  - Gate 1 (Architecture/Infra Completeness): No gap. The AJV validation mechanism, the `compileValidator` helper, and the `apps/backend/src/validation/` schema-file convention are all pre-existing and already exercised by the Gemini path (`process-ai-job.ts`) and confirmed complete in Epic 3's swept readiness report (`_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md`, `swept: true`, 2026-08-09). This story is pure application of that existing pattern to two additional entry points, not new infrastructure. The two pre-existing bugs fixed under AC6/AC7 are local, single-file import/type fixes, not architectural gaps.
  - Gate 2 (UI Complexity & Reusability): N/A. This is a backend-only change (`apps/backend/src/lib/scraper/`, `apps/backend/src/validation/`) with no UI/component surface.
  - Gate 3 (Foundational/Cross-Cutting Dependency Completeness): No gap. Runtime schema validation (AJV) is an established foundational capability, delivered by Story 0.11 and already in production use for the Gemini path — this story does not introduce a new foundational dependency, it closes a gap in that dependency's rollout across both scraper vendors.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No DB/schema mismatch. This story validates in-memory `ScrapedPost`-shaped objects at each scraper-vendor boundary, before they reach persistence (`persist-scraped-post.ts`) — it does not change the `posts` table schema, any Drizzle column type, or any GraphQL type. Two real, pre-existing type-compatibility bugs are fixed as part of this story (see AC6/AC7 and Dev Notes): a broken relative import path (`TS2307`) in both `process-apify-async-result.ts` and `process-brightdata-result.ts`, and a `Date`-vs-`string` mismatch on `publishedAt` in `process-brightdata-result.ts` → `persistScrapedPost`. Both are required fixes for this story's own AJV validation to work correctly, not incidental cleanup.
- Impacted fields/contracts: `ScrapedPost` (`packages/domain/src/scraper/types.ts`) as consumed by `mapApifyItemToScrapedPost`'s return value and by the Bright Data candidate object built in `processBrightDataResult`; no change to the `ScrapedPost` interface's shape itself, only to `mapApifyItemToScrapedPost`'s return type (`ScrapedPost` → `ScrapedPost | null`) and to how its three callers, plus `processBrightDataResult`, handle validation outcomes.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: `mapApifyItemToScrapedPost`'s exported return type in `instagram-adapter.ts` changes from `ScrapedPost` to `ScrapedPost | null`; no `ScrapedPost` interface change in `packages/domain`. `processBrightDataResult`'s `publishedAt` construction changes from a `Date` expression to a `.toISOString()` string expression to match `PersistScrapedPostParams.publishedAt: string`.
- Backward compatibility and rollout notes: `getPostByUrl` already declares `Promise<ScrapedPost | null>` at the `ScraperAdapter` interface level (`packages/domain/src/scraper/types.ts:38`), so its `null` handling is a non-breaking pass-through change. `getNewestPosts` already declares `Promise<ScrapedPost[]>` — filtering `null`s out before returning keeps that contract intact; no caller of `getNewestPosts` needs to change. `processApifyAsyncResult` and `processBrightDataResult` are both internal, void-returning, per-item/record loops (webhook/async-job result handlers) — their skip-on-invalid behavior is a strictly narrower version of what they already do for missing-field cases (`processBrightDataResult`'s existing `if (!postUrl)` check), so no external caller is affected. No feature flag or phased rollout needed — this is a pure validation-tightening change with a safe (drop-and-log) failure mode, consistent with the Gemini path's existing behavior.
- Verification checks: The new unit/integration tests (Tasks 2 and 3) prove both mappers drop invalid items/records and pass valid ones; `npx tsc --noEmit` scoped to the touched files (Subtask 4.3) proves both the `ScrapedPost | null` return-type change and the import-path fix are handled correctly with no new type errors.

### Project Structure Notes

- New file `apps/backend/src/validation/scraped-post.schema.ts` follows the existing `apps/backend/src/validation/*.schema.ts` naming and co-location convention (sibling to `extracted-event.schema.ts`, `proposed-event-correction.schema.ts`, `report-system-error.schema.ts`).
- New file `apps/backend/src/lib/scraper/process-brightdata-result.test.ts`, following the existing sibling `process-apify-async-result.test.ts`'s naming and test-style convention.
- No new packages, no new top-level directories. All changes are confined to `apps/backend/src/validation/` (new file), `apps/backend/src/lib/scraper/instagram-adapter.ts` + `instagram-adapter.test.ts`, `apps/backend/src/lib/scraper/process-apify-async-result.ts` + `process-apify-async-result.test.ts`, and `apps/backend/src/lib/scraper/process-brightdata-result.ts` + new `process-brightdata-result.test.ts` (edits/new tests).
- No detected conflicts or variances from the unified project structure.

### References

- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts#L40-L56] — reference AJV validation pattern (compile, validate, log-and-skip-on-failure) for the Gemini path.
- [Source: apps/backend/src/validation/extracted-event.schema.ts] — reference `JSONSchemaType<T>` schema-authoring convention, including the optional-field `nullable: true` pattern used for `ScrapedPost`'s `imageUrl`/`originalPostUrl`.
- [Source: apps/backend/src/validation/validate.ts] — shared `compileValidator<T>` helper (Ajv + ajv-formats), reused as-is.
- [Source: apps/backend/src/lib/scraper/instagram-adapter.ts#L84-L95] — `mapApifyItemToScrapedPost`, the function this story modifies.
- [Source: apps/backend/src/lib/scraper/instagram-adapter.ts#L127-L186] — `getPostByUrl`/`getNewestPosts`, two of the three call sites updated to handle the new `null` outcome.
- [Source: apps/backend/src/lib/scraper/process-apify-async-result.ts] — `processApifyAsyncResult`, the third call site of `mapApifyItemToScrapedPost` (Story 3.4f's async job-result path); also has the broken `persistScrapedPost` import fixed under AC6.
- [Source: apps/backend/src/lib/scraper/process-brightdata-result.ts] — `processBrightDataResult` (Story 3.4a), the Bright Data path this story adds validation to; also has the broken import (AC6) and the `Date`-vs-`string` `publishedAt` mismatch (AC7).
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts] — `persistScrapedPost`/`PersistScrapedPostParams`, the shared persistence function both vendor paths call, and the correct relative import target for AC6's fix (confirmed already correctly imported this way by `apps/backend/src/lib/scraper/process-scrape-job.ts:4`).
- [Source: packages/domain/src/scraper/types.ts] — `ScrapedPost`/`ScraperAdapter` interfaces.
- [Source: apps/backend/src/lib/scraper/instagram-adapter.test.ts] — existing test file and fixture style (`node:test`, plain `assert`, real-shape Apify item fixtures) to extend.
- [Source: apps/backend/src/lib/scraper/process-apify-async-result.test.ts] — existing db-integration test style (`t.beforeEach`/`t.afterEach`, real `db` assertions) to extend and to mirror for the new `process-brightdata-result.test.ts`.
- [Source: _bmad-output/project-context.md#Critical Implementation Rules > API & Data] — "Runtime Schema Validation" rule this story brings both scraper vendor paths into compliance with.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — confirms Epic 3's architecture/foundational gates are swept clean (`swept: true`, 2026-08-09); no re-run needed for this story per the Story Split Gate's swept-epic fast path.

## Global Rules References

- [x] project-context.md
- [x] story-content-structure.md
- [x] architecture spine
- [x] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - NEW: `apps/backend/src/validation/scraped-post.schema.ts` — `scrapedPostSchema: JSONSchemaType<ScrapedPost>`.
  - EDIT: `apps/backend/src/lib/scraper/instagram-adapter.ts` — module-scope `compileValidator<ScrapedPost>` call; `mapApifyItemToScrapedPost` signature/behavior change; `getPostByUrl`/`getNewestPosts` null-handling updates.
  - EDIT: `apps/backend/src/lib/scraper/instagram-adapter.test.ts` — new invalid-item and mixed-batch test cases.
  - EDIT: `apps/backend/src/lib/scraper/process-apify-async-result.ts` — explicit null-check on `mapApifyItemToScrapedPost`'s result; fix broken `persistScrapedPost` import path.
  - EDIT: `apps/backend/src/lib/scraper/process-apify-async-result.test.ts` — new invalid-item test case.
  - EDIT: `apps/backend/src/lib/scraper/process-brightdata-result.ts` — add AJV validation of the constructed candidate before `persistScrapedPost`; fix broken import path; fix `publishedAt` `Date`-vs-`string` mismatch.
  - NEW: `apps/backend/src/lib/scraper/process-brightdata-result.test.ts` — valid-record and invalid-record test cases.
- Rule Mapping:
  - `project-context.md`'s "Runtime Schema Validation" rule → Task 1 (schema) + Tasks 2-3 (wiring into both vendor paths) close the gap the rule already required.
  - `project-context.md`'s "Adapter Pattern" rule (external services behind adapters) → unaffected; validation is added inside the existing adapter/result-processing files, not a new abstraction layer.
  - `project-context.md`'s Testing Rules ("unhappy path" coverage for new logic) → Task 2/3's invalid-item/record test cases satisfy the unhappy-path requirement for this story's new validation logic on both vendor paths.
- Verification Plan:
  - Run `apps/backend`'s test suite covering `instagram-adapter.test.ts`, `process-apify-async-result.test.ts`, and the new `process-brightdata-result.test.ts`, including all new and existing cases.
  - `npx tsc --noEmit` scoped to the touched files (Subtask 4.3) to confirm the `ScrapedPost | null` return-type change and the import-path fixes are fully and correctly handled, with no new type errors introduced.

## Pre-Coding Approval Gate

- [ ] Scope confirmation
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — No gap found (see Architecture & UX Gate Findings); Epic 3 readiness report already swept 2026-08-09.

## Testing Requirements

- [ ] Integration tests — `instagram-adapter.test.ts`: valid-item regression case, invalid-item → `null` case, `getNewestPosts` mixed-batch filtering case. `process-apify-async-result.test.ts`: invalid-item skip case. `process-brightdata-result.test.ts` (new): valid-record and invalid-record cases.
- [ ] E2E tests — Not required; this is an internal data-validation boundary with no user-facing flow change (per Testing Rules' "testing trophy" approach, integration coverage is sufficient for this non-UI, non-critical-path logic).

## Deliverables Checklist

- [ ] `apps/backend/src/validation/scraped-post.schema.ts` created with `scrapedPostSchema: JSONSchemaType<ScrapedPost>`.
- [ ] `mapApifyItemToScrapedPost` validates and returns `ScrapedPost | null`, logging AJV errors on failure.
- [ ] `getPostByUrl`, `getNewestPosts`, and `processApifyAsyncResult` all correctly handle the mapper's new `null` outcome.
- [ ] `processBrightDataResult` validates its constructed candidate against the same schema before persisting, and logs/skips on failure.
- [ ] Both `persistScrapedPost` import-path bugs fixed (`process-apify-async-result.ts`, `process-brightdata-result.ts`).
- [ ] `processBrightDataResult`'s `publishedAt` passed as an ISO string, not a `Date` object.
- [ ] `instagram-adapter.test.ts`, `process-apify-async-result.test.ts` extended; new `process-brightdata-result.test.ts` created; all covering valid and invalid cases.

## Out of Scope

- Twitter/X stub adapter validation (not yet implemented; out of scope per Story 3.3c's existing scoping precedent).
- Any change to `process-ai-job.ts`/Gemini validation (already compliant, untouched by this story).
- Any change to the `posts` table schema, persistence layer internals, or GraphQL contracts (this story validates in-memory data before it reaches those layers, and fixes only the two specific bugs called out in AC6/AC7).
- The wider `apps/backend` pre-existing `tsc` errors from in-flight, uncommitted schema/resolver work (unrelated to this story's scope — see Dev Notes).

## Definition of Done

- [ ] AC satisfaction (AC1-7)
- [ ] Required tests passing (Task 2/3 cases plus existing `instagram-adapter.test.ts`/`process-apify-async-result.test.ts` suites green)
- [ ] Lint and type checks passing for `apps/backend` on the files touched by this story

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
