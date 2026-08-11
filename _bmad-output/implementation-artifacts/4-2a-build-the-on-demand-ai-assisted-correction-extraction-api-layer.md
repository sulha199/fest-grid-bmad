---
baseline_commit: 7db3d573346407723746b3d7e40b2e215266ae85
---

# Story 4.2a: Build the on-demand AI-assisted correction extraction API layer

## Story Details

- **Epic:** 4
- **Story ID:** 4.2a
- **Status:** review

## Story

**As a** developer,
**I want** a synchronous `extractEventDataFromUrl` mutation that reuses the existing scraper/AI Gateway pipeline instead of the async, queue-driven one,
**So that** Story 4.2 can pre-fill a correction form from a pasted post URL in direct response to the user's own click.

## Acceptance Criteria

1. **Given** an authenticated user (`requireAuth`, Story 0.17) calls `extractEventDataFromUrl(url: String!): ExtractEventDataFromUrlResult!`, **when** the resolver runs, **then** it first looks up `posts` via the same dual-lookup `persistScrapedPost` (Story 3.3a) already uses for dedup — `where(or(eq(posts.postUrl, url), eq(posts.originalPostUrl, url)))` — to decide between the "existing post" and "new post" paths below.
2. **Given** a matching `posts` row is found (**existing post**), **when** selecting which Gemini API key to use, **then** the resolver first attempts `callGemini` (Story 0.13's AI Gateway adapter) with `subscriberUserIds: [context.user.userId]` (`TIER_1_USER_SPECIFIC` — the caller's own key); **and** if that throws `AiGatewayExhaustedError` (caller has no valid key), it retries with `subscriberUserIds` set to every active subscriber of the post's `accountId` (via `getActiveSubscriberUserIds`, Story 3.5's existing helper — `TIER_2_SHARED_ROUND_ROBIN`, fair fallback across the account's subscriber pool); **and** if that also throws `AiGatewayExhaustedError`, the mutation returns `errorCode: QUOTA_EXHAUSTED`.
3. **And**, for the existing-post path, the request sent to Gemini reuses `buildGeminiExtractionRequest` (Story 3.6, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`) built from the stored `posts.content`/`posts.imageUrl` — no new prompt/response-schema is authored; the response is parsed and AJV-validated with the same `extractedEventSchema` (Story 3.6) already used by the async pipeline.
4. **Given** no matching `posts` row is found (**new post**), **when** the resolver determines which platform to scrape, **then** it detects the platform from the URL's domain (new `detectPlatformFromUrl` utility, `packages/domain/src/scraper/platform-registry.ts` — e.g. `instagram.com`/`instagr.am` → `instagram`, `twitter.com`/`x.com` → `twitter`); **and** if the domain matches no known platform, the mutation returns `errorCode: UNSUPPORTED_PLATFORM` without attempting extraction.
5. **And**, for the new-post path, **when** the caller has no valid Gemini API key of their own, **then** the mutation returns `errorCode: NO_API_KEY` (message instructing the user to contribute their own key) **without** falling back to any other subscriber's key — unlike the existing-post path, a brand-new, never-scraped post has no associated account/subscriber pool to fall back to.
6. **And**, for the new-post path, **when** the caller does have a valid key, **then** the resolver calls a new `ScraperAdapter.getPostByUrl(url: string): Promise<ScrapedPost | null>` method (extending Story 3.3c's interface; implemented for `instagramScraperAdapter` by reusing the existing `callApifyActor` pattern with `directUrls: [url]`, mirroring `lookupAccountProfile`'s exact structure; `twitterScraperAdapter` throws `'Twitter/X scraping is not yet implemented'`, matching its existing stub for `getNewestPosts`/`lookupAccountProfile`) under a hard timeout (20s, leaving headroom under API Gateway's 29s limit alongside the Gemini call itself); **and** if the scrape returns `null`/times out/throws, the mutation returns `errorCode: SCRAPE_FAILED`; **and** if the scrape succeeds, its `content`/`imageUrl` feed the same `buildGeminiExtractionRequest`/`extractedEventSchema` pipeline as AC3, called via `callGemini` with `subscriberUserIds: [context.user.userId]` only (`TIER_1_USER_SPECIFIC`, no round-robin fallback per AC5's reasoning).
7. **And**, once a validated `GeminiExtractionPayload` is obtained (either path), **when** `payload.isEvent === false`, **then** the mutation returns `errorCode: EXTRACTION_FAILED` (message indicating the linked post doesn't appear to describe an event); **and** when `payload.isEvent === true`, the payload is mapped 1:1 by a new pure `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` function (`eventName`, `types`, `categories`, `location`, `organizerName`, `contactInfo`, `description`, `schedules` — each schedule carrying no `id`, since this is freshly extracted data with no existing DB row) into `ProposedEventCorrectionData` (a new GraphQL output type mirroring Story 4.1a's `ProposedEventCorrectionInput` shape field-for-field — GraphQL forbids reusing an `input` type as an output type) and returned as `data`.
8. **And** the newly-scraped "new post" content is **not** persisted into `posts` (no `accountId`/account-profile resolution is attempted here) — a one-off extraction only; see Out of Scope.
9. **And** no package outside `apps/backend` calls the scraper adapter or the AI Gateway adapter directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced fresh during Story 4.2's own creation — the swept `epic-readiness/epic-4-readiness.md` confirmed the AI Gateway adapter (Story 0.13) exists but predates the implementation-detail-level discovery (made while drafting Story 4.2 itself) that no synchronous, single-arbitrary-URL, correction-shaped extraction capability exists anywhere: the AI Gateway adapter and `ScraperAdapter` (Story 3.3c) are real, reusable building blocks, but always invoked today only from the async, queue-driven Story 3.6 pipeline (account-centric batch scraping, `accountId`-scoped location/timezone resolution) — a fundamentally different shape than "extract from one pasted URL, synchronously, in response to a click." Confirmed via a Gate 1 subagent review (Winston persona) and four rounds of `AskUserQuestion` with the user during Story 4.2's creation: (1) split into this prerequisite story rather than build inline in 4.2, since the new capability spans a new `ScraperAdapter` method + platform detection + a new resolver + a new domain mapping — not the small, mechanical, single-consumer shape Story 4.1's Task 1 precedent covers; (2) detect platform from the URL's domain rather than require explicit user platform selection; (3) run synchronously with a hard timeout rather than build async job+polling infrastructure for a single bounded action; (4) reuse-first design — check `posts` (dual `postUrl`/`originalPostUrl` lookup, mirroring `persistScrapedPost`'s exact existing dedup logic) before ever attempting a live scrape, and only build the new live-scrape capability (AC6) for the not-found path, with the user's own key prioritized first and a round-robin fallback across the post's account subscribers only when a stored post's account is actually known (AC2) — a brand-new post has no such pool (AC5).

**Depends on:** Story 0.13, Story 0.17, Story 3.3a, Story 3.3c, Story 3.5, Story 3.6.

## Tasks / Subtasks

- [ ] **Task 1 (AC4, AC6) — Platform detection + `ScraperAdapter.getPostByUrl`:**
  - [ ] In `packages/domain/src/scraper/platform-registry.ts`, add `detectPlatformFromUrl(url: string): SupportedPlatform | null`, parsing the URL's hostname and matching against a domain→platform map (`instagram.com`/`instagr.am` → `instagram`; `twitter.com`/`x.com` → `twitter`); an unparseable URL (`new URL(url)` throws) or unrecognized hostname returns `null`. Export unchanged via the existing `packages/domain/src/scraper/index.ts` → `packages/domain/src/index.ts` → `@festgrid/domain` re-export chain.
  - [ ] In `packages/domain/src/scraper/types.ts`, add `getPostByUrl(url: string): Promise<ScrapedPost | null>` to the `ScraperAdapter` interface.
  - [ ] In `apps/backend/src/lib/scraper/instagram-adapter.ts`, implement `getPostByUrl` on `instagramScraperAdapter`: check `isProviderCapacityAvailable('apify')` first (same circuit breaker every existing method on this adapter already respects — see Dev Notes "Capacity-Check Reuse"), returning `null` if unavailable; otherwise call `callApifyActor({ directUrls: [url], resultsType: 'posts', resultsLimit: 1 })` (mirrors `lookupAccountProfile`'s single-URL `directUrls` shape, not `getNewestPosts`'s username-derived URL), map the first returned item to `ScrapedPost` using the same field-mapping logic `getNewestPosts` already uses (`content`/`imageUrl`/`postUrl`/`originalPostUrl`/`publishedAt`), call `recordProviderUsage('apify', 1)` on success, and return `null` if Apify returns zero items. Wrap the whole call in a 20-second hard timeout (new small `withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null>` helper — `Promise.race` against a timer that resolves `null`; does not need to actually abort the in-flight `fetch`, since the resolver's own contract (AC6) only requires it to stop *waiting* within 20s, not to cancel the underlying Apify job — see Dev Notes "Timeout Implementation Choice"); a thrown error from the underlying call propagates as a rejection, caught by the resolver (AC6) and mapped to `SCRAPE_FAILED`.
  - [ ] In `apps/backend/src/lib/scraper/twitter-adapter.ts`, add `getPostByUrl` to `twitterScraperAdapter`, throwing `'Twitter/X scraping is not yet implemented'` (matching its existing two stub methods).
- [ ] **Task 2 (AC7) — Domain mapping function:** Create `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` exporting `mapExtractionPayloadToProposedCorrection(payload: GeminiExtractionPayload): ProposedEventCorrection`, reusing the **existing** `ProposedEventCorrection`/`ProposedScheduleCorrection` interfaces (Story 4.1a, `packages/domain/src/events/types.ts`) as the return shape rather than inventing new ones — see Dev Notes "Domain Type Reuse". Maps `eventName`, `types` (cast `string[]` → `EventType[]`), `categories` (cast → `EventCategory[]`), `location`, `organizerName`, `contactInfo`, `description` 1:1; maps each `payload.schedules[]` entry to a `ProposedScheduleCorrection` with `id: undefined` (never set — freshly extracted data has no DB row) and all other fields copied 1:1 (`isMainSchedule`, `eventStartDate`, `eventEndDate`, `eventStartTime`, `eventEndTime`, `title`, `performers`, `location`, `ticketPrice`). Add `map-extraction-payload-to-proposed-correction.test.ts` (`node:test`, no DB, 100% coverage): full payload with multiple schedules maps every field correctly; a schedule field absent from the payload stays `undefined` (not coerced to `null`/`''`) in the output; `types`/`categories` arrays map element-for-element. Export from `packages/domain/src/events/index.ts`.
- [ ] **Task 3 (AC1, AC2, AC4–AC7) — GraphQL schema:** Create `apps/backend/src/schema/extraction.graphql`:
  ```graphql
  enum ExtractionErrorCode {
    NOT_FOUND
    UNSUPPORTED_PLATFORM
    NO_API_KEY
    SCRAPE_FAILED
    EXTRACTION_FAILED
    QUOTA_EXHAUSTED
  }

  type ProposedScheduleCorrectionData {
    id: ID
    isMainSchedule: Boolean!
    eventStartDate: String!
    eventEndDate: String
    eventStartTime: String
    eventEndTime: String
    title: String
    performers: [String!]
    location: String
    ticketPrice: String
  }

  type ProposedEventCorrectionData {
    eventName: String!
    types: [EventType!]!
    categories: [EventCategory!]!
    location: String!
    organizerName: String
    contactInfo: String
    description: String
    schedules: [ProposedScheduleCorrectionData!]!
  }

  type ExtractEventDataFromUrlResult {
    data: ProposedEventCorrectionData
    errorCode: ExtractionErrorCode
    errorMessage: String
  }

  extend type Mutation {
    extractEventDataFromUrl(url: String!): ExtractEventDataFromUrlResult!
  }
  ```
  `ExtractEventDataFromUrlResult` is a flat object with nullable `data`/`errorCode`/`errorMessage` fields (not a GraphQL union) — this exact shape, field names, and the `errorMessage` field are already fixed by Story 4.2's own `ready-for-dev` story file (Task 1's `corrections.graphql` extension query literally requests `data { ... } errorCode errorMessage`), so this is not an independent choice for this story to make — see Dev Notes "Result Shape Is Pre-Committed by Story 4.2". `NOT_FOUND` is declared in the enum for schema-completeness (per Story 4.2's own Dev Notes "i18n Keys") even though no code path in this story's AC1–AC9 returns it.
- [ ] **Task 4 (AC1–AC9) — Resolver:** In `apps/backend/src/schema/resolvers.ts`:
  - [ ] Import `posts` (already imported), `or` (add to the existing `drizzle-orm` import alongside `eq, count, sql, asc, and, exists, desc, inArray`), `getScraperAdapter`, `detectPlatformFromUrl`, `ScraperAdapter`... types as needed from `@festgrid/domain`; `callGemini`, `AiGatewayExhaustedError` from `../lib/ai-gateway/adapter.js`; `buildGeminiExtractionRequest` from `../lib/ai-processor/build-gemini-request.js`; `extractedEventSchema` from `../validation/extracted-event.schema.js`; `getActiveSubscriberUserIds` from `../lib/subscriptions/get-active-subscriber-user-ids.js`; `mapExtractionPayloadToProposedCorrection` from `@festgrid/domain/events`.
  - [ ] `const validateExtractedEvent = compileValidator<GeminiExtractionPayload>(extractedEventSchema);` at module scope (matches `process-ai-job.ts`'s existing instantiation, kept as its own instance here since it's a different runtime context — see Dev Notes "AJV Validator Instance").
  - [ ] Add `extractEventDataFromUrl: async (_: any, { url }: any, context: any) => { ... }` to the `Mutation` resolver map:
    1. `const authUser = requireAuth(context);` (AC1).
    2. Look up `posts` via `db.select().from(posts).where(or(eq(posts.postUrl, url), eq(posts.originalPostUrl, url))).limit(1)` (AC1).
    3. **Existing-post path (AC2, AC3):** if a row is found — build a `ProcessingJobMessage`-shaped object directly from it (`{ postId: post.id, accountId: post.accountId, content: post.content, imageUrl: post.imageUrl ?? undefined, postUrl: post.postUrl, publishedAt: post.publishedAt.toISOString() }` — see Dev Notes "Ad Hoc ProcessingJobMessage Construction"); call `buildGeminiExtractionRequest(message)`; try `callGemini({ ...request, provider: 'gemini', subscriberUserIds: [authUser.userId] })`; on `AiGatewayExhaustedError`, retry with `subscriberUserIds: await getActiveSubscriberUserIds(post.accountId)`; on a second `AiGatewayExhaustedError`, return `{ errorCode: 'QUOTA_EXHAUSTED', errorMessage: 'No available Gemini API key to perform this extraction.' }` (AC2).
    4. **New-post path (AC4–AC6):** if no row is found — `const platform = detectPlatformFromUrl(url);` if `null`, return `{ errorCode: 'UNSUPPORTED_PLATFORM', errorMessage: 'This URL is not from a supported platform.' }` (AC4); check the caller has at least one valid key (reuse the existing candidate-key lookup already used elsewhere for BYOK checks — see Dev Notes "NO_API_KEY Pre-Check"), if none return `{ errorCode: 'NO_API_KEY', errorMessage: 'Contribute your own Gemini API key to use this feature.' }` (AC5); else `const adapter = getScraperAdapter(platform);` and call `adapter.getPostByUrl(url)`; wrap in `try/catch` — a thrown error, `null` result, or timeout (Task 1's `withTimeout`) all map to `return { errorCode: 'SCRAPE_FAILED', errorMessage: 'Could not retrieve content from the provided URL.' }` (AC6); on success, build an ad hoc `ProcessingJobMessage` from the `ScrapedPost` (`postId`/`accountId` are placeholder values, e.g. `crypto.randomUUID()`/`''` — unused by `buildGeminiExtractionRequest`, which only reads `.content`/`.imageUrl`, and `.postId` only for a `console.error` log line), call `buildGeminiExtractionRequest`, then `callGemini({ ...request, provider: 'gemini', subscriberUserIds: [authUser.userId] })` only — no fallback (AC6's cross-reference to AC5's reasoning).
    5. **Shared response handling (AC7, both paths):** `JSON.parse(result.text)`, validate with `validateExtractedEvent`; a parse/AJV failure returns `{ errorCode: 'EXTRACTION_FAILED', errorMessage: 'The extracted content could not be validated.' }`; `payload.isEvent === false` returns `{ errorCode: 'EXTRACTION_FAILED', errorMessage: 'The linked post does not appear to describe an event.' }`; `payload.isEvent === true` returns `{ data: mapExtractionPayloadToProposedCorrection(payload) }`.
- [ ] **Task 5 (AC1–AC9) — Tests:** Create `apps/backend/src/schema/extraction.test.ts` (real local DB, `graphql-yoga` `createSchema`/`createYoga`, mirroring `corrections.test.ts`'s harness and seed/cleanup pattern; mock `callGemini`/`callApifyActor` via their existing seam-injection patterns, e.g. `setCallApifyActor`, and a new exported seam for `callGemini` in this resolver module if one doesn't already exist at the call site — mirroring `process-ai-job.ts`'s `callGeminiSeam`/`setCallGeminiSeam` pattern): unauthenticated call rejected `UNAUTHENTICATED`; existing-post path calls Gemini with the caller's key first and falls back to subscriber pool on `AiGatewayExhaustedError`, returning `QUOTA_EXHAUSTED` when both are exhausted; new-post path with an unrecognized-domain URL returns `UNSUPPORTED_PLATFORM` without calling the scraper; new-post path with no caller key returns `NO_API_KEY` without calling the scraper; new-post path with a valid key and a successful scrape calls Gemini with only the caller's key (no fallback) and returns `data`; new-post path where the scrape adapter throws/returns `null`/times out returns `SCRAPE_FAILED`; `isEvent: false` returns `EXTRACTION_FAILED` for both paths; `isEvent: true` returns `data` matching `mapExtractionPayloadToProposedCorrection`'s output, with every schedule's `id` absent/`null`; verify no `posts` row is inserted for the new-post path (AC8).
- [ ] **Task 6 — Codegen + Verification (AC1–AC9):**
  - [ ] `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` against the new `extraction.graphql` schema.
  - [ ] `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained, including `detectPlatformFromUrl` and `map-extraction-payload-to-proposed-correction.ts`.
  - [ ] `pnpm --filter backend test` — new `extraction.test.ts` passes; all existing `apps/backend` suites (including `corrections.test.ts`, scraper/AI-gateway suites) remain unmodified and passing.
  - [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) — already run fresh during Story 4.2's own creation, cited here rather than re-derived** (`swept: true` `epic-readiness/epic-4-readiness.md` predates this implementation-detail-level gap, per this story's own Note above). No further Gate 1 review needed for this story's own creation: this story *is* the prerequisite that Gate 1 finding produced, and its exact scope (new `ScraperAdapter.getPostByUrl`, `detectPlatformFromUrl`, `extractEventDataFromUrl` resolver, domain mapping function) was already fully specified by the four `AskUserQuestion` rounds during Story 4.2's creation (see epics.md Story 4.2a's `Note:`).
- **Lightweight guard (this story's own creation):** re-checked whether this story's own field-level implementation choices (exact `ScraperAdapter` timeout mechanism, GraphQL result-type shape, domain-type reuse, ad hoc `ProcessingJobMessage` construction) introduce anything the prior Gate 1 finding didn't anticipate. They don't — every one is a mechanical, non-discretionary consequence of already-established project conventions (existing Apify capacity-check pattern, existing `ProcessingJobMessage`/`ProposedEventCorrection` shapes, Story 4.2's own frozen GraphQL contract) rather than a new architectural layer, external service, or cross-epic dependency. No new Gate 1/3 gap found; no new prerequisite story needed.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review:** **No gap found.** This story has zero UI surface — no `apps/web`/`packages/ui` files, no component, no hook. The one adjacent UI surface (the "AI-Assisted Correction" trigger button, URL input, Extract button, loading/error states) is already fully owned and specified by the separate, already-`ready-for-dev` Story 4.2, rendered into Story 4.1b's `headerActions` slot. AC9 explicitly locks the `apps/backend`-only boundary down (no package outside `apps/backend` calls the scraper or AI Gateway adapters directly).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, `stories_covered` includes `4.2`, the story whose own creation surfaced this prerequisite): no foundational/cross-cutting dependency gap. `extractEventDataFromUrl` has exactly one consumer (Story 4.2) and introduces no new shared table, no new AWS infrastructure, and no cross-epic tooling dependency — `ScraperAdapter`/AI Gateway adapter are extended, not newly built.

### Domain Type Reuse

`GeminiExtractionPayload` → `ProposedEventCorrectionData` mapping (AC7) reuses the **existing** `ProposedEventCorrection`/`ProposedScheduleCorrection` domain interfaces from Story 4.1a (`packages/domain/src/events/types.ts`) as `mapExtractionPayloadToProposedCorrection`'s return type, rather than inventing a new, near-identical pair of interfaces. These interfaces already have an optional `id?: string` on `ProposedScheduleCorrection` — exactly matching AC7's "each schedule carrying no `id`" requirement (simply never set) — and already match the target shape field-for-field, since `ProposedEventCorrectionInput`/`ProposedScheduleCorrectionInput` (the GraphQL input types Story 4.1a's `submitCorrection` accepts) were themselves generated from these same domain interfaces. Only the **GraphQL output side** is new (`ProposedEventCorrectionData`/`ProposedScheduleCorrectionData`, Task 3) — GraphQL forbids reusing an `input` type as an output field type, but nothing prevents the resolver from returning a plain object shaped like the existing domain interface, which the new output type's field resolution serializes structurally. This did not require its own `AskUserQuestion` — it is the direct, reuse-first consequence of interfaces that already exist and already match, not an independent design tradeoff.

### Result Shape Is Pre-Committed by Story 4.2

`ExtractEventDataFromUrlResult`'s exact shape (`data`/`errorCode`/`errorMessage`, all nullable, on one flat object type rather than a GraphQL union) is not an independent decision for this story — Story 4.2's own story file (already `ready-for-dev`, created before this story) hard-codes this exact query shape in its Task 1 (`apps/web/src/features/events/corrections.graphql` extension: `extractEventDataFromUrl($url: String!) { extractEventDataFromUrl(url: $url) { data { ... } errorCode errorMessage } }`) and its Dev Notes reference `ExtractionErrorCode` and per-`errorCode` i18n keys by name. This story's schema (Task 3) must match that contract exactly rather than re-derive it. `errorMessage` is populated by this story's resolver for debugging/logging purposes even though Story 4.2's frontend renders its own static, per-`errorCode` i18n copy instead of this field's raw text (Story 4.2's own Dev Notes "i18n Keys") — the field stays on the schema because Story 4.2's frozen query already selects it.

### Timeout Implementation Choice

AC6's "hard timeout (20s)" requirement is that the **resolver** stops waiting and responds within budget — it does not require true request cancellation of the underlying Apify call. `callApifyActor` is a plain `fetch()` call with no `AbortSignal` plumbed through today (Story 3.3c), and adding real cancellation would mean changing that function's signature — a larger, non-mandated change with no consumer-visible benefit (the resolver's own contract is satisfied either way: `SCRAPE_FAILED` at ~20s). This story's `withTimeout` helper (Task 1) uses a simple `Promise.race` against a timer, leaving the underlying Apify request to complete or fail in the background uncancelled — matching AC6's literal wording ("if the scrape returns `null`/times out/throws") without introducing scope beyond it. This did not require its own `AskUserQuestion` — it is the simpler, sufficient choice for what AC6 actually asks for, not an independent tradeoff with meaningfully different user-facing outcomes.

### Capacity-Check Reuse

`instagramScraperAdapter.getPostByUrl` (Task 1) calls `isProviderCapacityAvailable('apify')`/`recordProviderUsage('apify', 1)` — the same circuit breaker `getNewestPosts`/`lookupAccountProfile` already respect. `scraperProviderUsage` is a single, provider-keyed shared budget tracker (not scoped per call-site or per-story); skipping this check for the new on-demand path would let repeated user-initiated extractions silently bypass the project's only cost-control mechanism for Apify spend. This is a "leave the system working end-to-end" requirement (this workflow's mandate) — a direct, non-discretionary consequence of the existing shared-budget design, not an independent tradeoff needing `AskUserQuestion`.

### Ad Hoc ProcessingJobMessage Construction

`buildGeminiExtractionRequest` (Story 3.6) takes a `ProcessingJobMessage` (`{ postId, accountId, content, imageUrl?, postUrl, publishedAt }`), of which it only actually reads `.content`, `.imageUrl`, and `.postId` (the last only for a `console.error` log line on an image-fetch failure — Dev Notes source excerpt). For the existing-post path, a real `posts` row supplies every field directly. For the new-post path (AC6), the freshly-scraped `ScrapedPost` has no `postId`/`accountId` (nothing is persisted — AC8), so the resolver constructs a placeholder `postId` (`crypto.randomUUID()`) and `accountId` (`''`, unused) purely to satisfy the type shape. This is mechanical — `ProcessingJobMessage` was designed for the async pipeline's real, persisted posts, and this story is its first caller with no underlying row; broadening the type or overloading `buildGeminiExtractionRequest`'s signature would be a larger, unrequested change for no behavioral benefit.

### NO_API_KEY Pre-Check

AC5 requires returning `NO_API_KEY` for the new-post path *before* attempting a scrape (to avoid burning a scrape budget on a request that can never succeed). This requires a lightweight "does this user have at least one valid Gemini key" check ahead of `getScraperAdapter(...).getPostByUrl(...)`. Reuse the AI Gateway adapter's own `fetchCandidateKeys('gemini', [authUser.userId])` (Story 0.13, `apps/backend/src/lib/ai-gateway/usage-store.ts`) rather than inventing a second key-lookup path — `candidates.length === 0` (or none pass `selectApiKey`'s own validity filter) is the `NO_API_KEY` condition. This keeps a single source of truth for "does this user have a usable key" rather than duplicating `callGemini`'s internal candidate logic.

### AJV Validator Instance

This resolver compiles its own `compileValidator<GeminiExtractionPayload>(extractedEventSchema)` instance at module scope in `resolvers.ts`, rather than importing `process-ai-job.ts`'s module-level instance — `process-ai-job.ts` is the async pipeline's own module and is not otherwise imported by the GraphQL server; duplicating a cheap, stateless AJV-compiled-validator instantiation (already the project's existing pattern for every other `compileValidator` call site in `resolvers.ts`, e.g. `validateReportSystemError`, `validateProposedEventCorrection`) is simpler and more consistent than reaching across module boundaries for it.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** one new GraphQL mutation + three new GraphQL output types (`ExtractEventDataFromUrlResult`, `ProposedEventCorrectionData`, `ProposedScheduleCorrectionData`) + one new GraphQL enum (`ExtractionErrorCode`); one new `packages/domain` function (`detectPlatformFromUrl`) and one new pure mapping function (`mapExtractionPayloadToProposedCorrection`, reusing existing domain interfaces — see "Domain Type Reuse"); one new `ScraperAdapter` interface method (`getPostByUrl`) implemented on both existing adapters. No DB migration, no `packages/database/schema.ts` change, no `packages/shared-types` change.
- **Impacted fields/contracts:** `apps/backend/src/generated/resolvers-types.ts` regenerated via codegen (Task 6) to add the new mutation/types; `apps/web/src/generated/graphql.ts` regenerated once Story 4.2 runs its own frontend codegen against this schema (that story's own Task 1, not this story's scope).
- **Required DB migration changes:** None — `posts` is read-only in this story (existing-post lookup); the new-post path deliberately does not write to `posts` (AC8).
- **Required TypeScript type changes:** `packages/domain/src/scraper/types.ts` (`ScraperAdapter.getPostByUrl` interface addition, Task 1); `packages/domain/src/events/index.ts` (new mapping-function export, Task 2); `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen — no manual edits to generated output).
- **Backward compatibility and rollout notes:** Purely additive. `ScraperAdapter.getPostByUrl` is a new interface method — both existing implementations (`instagramScraperAdapter`, `twitterScraperAdapter`) are updated in the same change so the interface stays fully implemented (a TypeScript compile error would otherwise result from the interface addition alone); no existing `ScraperAdapter` call site or resolver is modified.
- **Verification checks:** Task 2's 100%-covered domain unit tests (mapping function, platform detection); Task 5's real-local-DB integration tests covering every AC1–AC9 branch; Task 6's full build/lint/test.

### Project Structure Notes

- **New:** `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` + `.test.ts`; `apps/backend/src/schema/extraction.graphql`; `apps/backend/src/schema/extraction.test.ts`; a small `withTimeout` helper (co-located in `apps/backend/src/lib/scraper/instagram-adapter.ts` or a new `apps/backend/src/lib/scraper/with-timeout.ts` if reused by a future call site — default to co-located, single-consumer, per Code Organization's "no premature abstraction" spirit).
- **Modified:** `packages/domain/src/scraper/platform-registry.ts` (`detectPlatformFromUrl`); `packages/domain/src/scraper/types.ts` (`ScraperAdapter.getPostByUrl`); `packages/domain/src/events/index.ts` (new export); `apps/backend/src/lib/scraper/instagram-adapter.ts` (`getPostByUrl` implementation); `apps/backend/src/lib/scraper/twitter-adapter.ts` (`getPostByUrl` stub); `apps/backend/src/schema/resolvers.ts` (new `extractEventDataFromUrl` resolver, new imports); `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen, not hand-edited).
- **Not modified:** `packages/database/schema.ts`; `packages/shared-types`; `apps/web`; `packages/ui`; `apps/infrastructure` (no new AWS resource — synchronous request/response GraphQL only); `SETUP_WALKTHROUGH.md` (no new external vendor — reuses existing Apify/Gemini credentials); `.env`/`env.ts` (no new env var).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.2a`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.2`] — the consumer story whose Task 1 pre-commits `ExtractEventDataFromUrlResult`'s exact GraphQL shape (Dev Notes "Result Shape Is Pre-Committed by Story 4.2").
- [Source: `_bmad-output/implementation-artifacts/4-2-ai-assisted-event-data-correction.md`] — the frozen frontend-side GraphQL operation and `ExtractionErrorCode`/i18n-key references this story's schema must satisfy exactly.
- [Source: `_bmad-output/implementation-artifacts/4-1a-build-the-corrections-backend-graphql-api-layer.md`] — `ProposedEventCorrection`/`ProposedScheduleCorrection` domain interfaces reused by this story's mapping function (Dev Notes "Domain Type Reuse"); `compileValidator`-at-module-scope pattern.
- [Source: `packages/domain/src/scraper/types.ts`] — current `ScraperAdapter` interface, `ScrapedPost`/`AccountProfileLookupResult` shapes, extended by Task 1.
- [Source: `packages/domain/src/scraper/platform-registry.ts`] — existing `getPlatformSlug`/`getPlatformByCode`/`getPlatformDisplayName` style `detectPlatformFromUrl` follows.
- [Source: `packages/domain/src/scraper/adapter-registry.ts`] — `getScraperAdapter(platform)` lookup used by Task 4's resolver.
- [Source: `packages/domain/src/subscriptions/platforms.ts`] — `SupportedPlatform`/`SUPPORTED_PLATFORMS`, the canonical platform type `detectPlatformFromUrl` returns.
- [Source: `apps/backend/src/lib/scraper/instagram-adapter.ts`] — `callApifyActor`/`setCallApifyActor` seam, `isProviderCapacityAvailable`/`recordProviderUsage` circuit-breaker pattern, `lookupAccountProfile`'s single-URL `directUrls` call shape Task 1's `getPostByUrl` mirrors.
- [Source: `apps/backend/src/lib/scraper/twitter-adapter.ts`] — existing not-implemented stub pattern Task 1's `getPostByUrl` addition matches.
- [Source: `apps/backend/src/lib/posts/persist-scraped-post.ts`] — the dual-lookup dedup query (`or(eq(posts.postUrl, ...), eq(posts.originalPostUrl, ...))`) AC1/Task 4 reuses read-only (this story never writes to `posts` — AC8).
- [Source: `apps/backend/src/lib/ai-gateway/adapter.ts`] — `callGemini`/`AiGatewayExhaustedError`, the `subscriberUserIds.length`-based `TIER_1_USER_SPECIFIC`/`TIER_2_SHARED_ROUND_ROBIN` selection Task 4's key-fallback logic relies on.
- [Source: `apps/backend/src/lib/ai-gateway/usage-store.ts`] — `fetchCandidateKeys` reused by Task 4's `NO_API_KEY` pre-check (Dev Notes "NO_API_KEY Pre-Check").
- [Source: `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `process-ai-job.ts`] — `buildGeminiExtractionRequest`'s `ProcessingJobMessage` signature and the existing `isEvent === false` handling pattern Task 4's resolver mirrors (Dev Notes "Ad Hoc ProcessingJobMessage Construction").
- [Source: `apps/backend/src/validation/extracted-event.schema.ts`] — `extractedEventSchema`/`GeminiExtractionPayload` reused unmodified by AC3/AC7.
- [Source: `apps/backend/src/lib/subscriptions/get-active-subscriber-user-ids.ts`] — `getActiveSubscriberUserIds`, Task 4's TIER_2 fallback source.
- [Source: `apps/backend/src/lib/auth/context.ts`] — `requireAuth`, `AuthenticatedUser.userId` (not `.id` — confirmed by direct read).
- [Source: `apps/backend/src/schema/resolvers.ts:735-864` (`submitCorrection`)] — the `db.select().where(...)`/AJV/error-shape resolver pattern this story's `extractEventDataFromUrl` follows; import list this story extends.
- [Source: `apps/backend/src/schema/corrections.graphql`, `corrections.test.ts`] — one-`.graphql`-file-per-feature convention (Task 3's new `extraction.graphql`) and the `graphql-yoga` `createSchema`/`createYoga` real-DB test harness (Task 5's `extraction.test.ts`).
- [Source: `apps/backend/src/server.ts`] — schema-file auto-concatenation (`readdirSync(schemaDir)...join('\n')`), confirming a new `.graphql` file needs no separate registration.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions and the numbering rule (source of this story's lettered-suffix placement).
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report (`4.2` in `stories_covered`), cited for Gate 3.
- [Source: `_bmad-output/project-context.md#Critical-Implementation-Rules`, `#Security`] — GraphQL-only API style; Adapter Pattern for external AI services (Story 0.13/3.3c, extended not bypassed); Resilient Processing Pipeline note (this story's synchronous design is a deliberate, user-confirmed exception for a single bounded on-demand action, not a new pipeline — see this story's own `Note:`).
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-7`] — `requireAuth` as the single enforcement surface, used unmodified by AC1.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API & Data (GraphQL-only, GraphQL Code Generator end-to-end type safety); Security (Adapter Pattern for external AI services — extended, not bypassed); Code Organization (`packages/domain` pure/DB-leakage-free/100%-coverage rules for the new mapping/platform-detection functions vs. `apps/backend` DB/HTTP-coupled resolver and adapter-implementation code).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-7 (`requireAuth`, enforced by this story's mutation).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL only (no Lambda/SQS/EventBridge change), reusing existing Apify/Gemini credentials already wired for the async pipeline.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts` + `.test.ts`; `apps/backend/src/schema/extraction.graphql`; `apps/backend/src/schema/extraction.test.ts`.
- **Modified:** `packages/domain/src/scraper/platform-registry.ts`; `packages/domain/src/scraper/types.ts`; `packages/domain/src/events/index.ts`; `apps/backend/src/lib/scraper/instagram-adapter.ts`; `apps/backend/src/lib/scraper/twitter-adapter.ts`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/generated/resolvers-types.ts` (regenerated, not hand-edited).
- **Not modified:** `packages/database/schema.ts`; `packages/shared-types`; `apps/web`; `packages/ui`; `apps/infrastructure`; `apps/backend/src/env.ts`; `.env.example`.

### Rule Mapping

- Story-split-gate discipline (Gate 1 cited from Story 4.2's own creation; Gate 2 run fresh via subagent, no gap; Gate 3 cited from swept `epic-4-readiness.md`) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".
- Security (Adapter Pattern for external AI services extended, not bypassed) → Task 1's `ScraperAdapter.getPostByUrl` extension, Task 4's `callGemini`/`getScraperAdapter` usage (never a raw SDK/HTTP call from the resolver) → AC9.
- API & Data (GraphQL Code Generator end-to-end type safety) → Task 3's strict `ProposedEventCorrectionData`/`ExtractionErrorCode` types (not a raw `JSON` scalar), Task 6's codegen step.
- Code Organization (`packages/domain` pure/no-DB-leakage/100%-coverage) → Task 1's `detectPlatformFromUrl`, Task 2's `mapExtractionPayloadToProposedCorrection` (both pure, fully unit-tested) vs. Task 1's `getPostByUrl`/Task 4's DB-and-HTTP-coupled resolver logic staying in `apps/backend`.
- "Leave the system working end-to-end, not just satisfy stated ACs" (the shared Apify-budget circuit breaker, the `NO_API_KEY` pre-check avoiding a wasted scrape, the interface-completeness requirement on `twitterScraperAdapter`) → Dev Notes "Capacity-Check Reuse", "NO_API_KEY Pre-Check"; Task 1's `twitterScraperAdapter` stub addition.
- Reuse over reinvention (`persistScrapedPost`'s dedup query reused read-only; `lookupAccountProfile`'s single-URL Apify call shape; `ProposedEventCorrection`/`ProposedScheduleCorrection` domain interfaces reused rather than duplicated; `fetchCandidateKeys` reused for the pre-check rather than a second key-lookup path) → Task 1, Task 2, Task 4, Dev Notes "Domain Type Reuse", "NO_API_KEY Pre-Check".
- Testing Rules (100% `packages/domain` coverage; testing-trophy integration tests for `apps/backend`) → Task 2's domain unit tests; Task 5's real-DB integration tests.

### Verification Plan

- `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained, including `detectPlatformFromUrl` and `map-extraction-payload-to-proposed-correction.ts`.
- `apps/backend`: `pnpm --filter backend codegen` regenerates cleanly against the new `extraction.graphql`; `pnpm --filter backend test` — new `extraction.test.ts` passes every AC1–AC9 branch; all existing suites (`corrections.test.ts`, scraper/AI-gateway suites) remain unmodified and passing.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only the `extractEventDataFromUrl` mutation and its full backend surface (`ScraperAdapter.getPostByUrl` + both platform implementations, `detectPlatformFromUrl`, the domain mapping function) in `apps/backend`/`packages/domain`. It does **not** implement Story 4.2's trigger UI/correction-form wiring — that story calls this mutation once both exist.
- [ ] Architecture and boundary confirmation: pure `detectPlatformFromUrl`/`mapExtractionPayloadToProposedCorrection` confined to `packages/domain`, no `drizzle-orm`/Node-only imports; the DB/HTTP-coupled resolver and scraper-adapter implementations confined to `apps/backend`; no package outside `apps/backend` calls the scraper adapter or AI Gateway adapter directly (AC9).
- [ ] Testing plan confirmation: `packages/domain`'s two new functions stay 100%-covered; `apps/backend`'s new `extraction.test.ts` gets real-local-DB integration tests covering every AC1–AC9 branch (existing-post key-fallback/`QUOTA_EXHAUSTED`, new-post `UNSUPPORTED_PLATFORM`/`NO_API_KEY`/`SCRAPE_FAILED`, `EXTRACTION_FAILED` for both paths, successful `data` mapping, `posts` left unwritten for the new-post path).
- [ ] **Result-shape contract accepted:** confirm `ExtractEventDataFromUrlResult { data, errorCode, errorMessage }` (flat object, not a union) as pre-committed by Story 4.2's own frozen GraphQL query — see Dev Notes "Result Shape Is Pre-Committed by Story 4.2".
- [ ] **Domain-type reuse accepted:** confirm reusing Story 4.1a's existing `ProposedEventCorrection`/`ProposedScheduleCorrection` domain interfaces as the mapping function's return type rather than introducing new, duplicate interfaces — see Dev Notes "Domain Type Reuse".
- [ ] **Timeout implementation accepted:** confirm a `Promise.race`-based 20s wait-timeout (no true Apify request cancellation) as sufficient for AC6 — see Dev Notes "Timeout Implementation Choice".
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 cited from Story 4.2's own creation (real gap already found and resolved via four `AskUserQuestion` rounds, producing this story). Gate 2 run fresh via subagent — no gap. Gate 3 cited from swept `epic-4-readiness.md` (`4.2` in `stories_covered`; no gap).
- [ ] **Dependency statuses confirmed:** Story 0.13 (`review`), Story 0.17 (`review`), Story 3.3a (`review`), Story 3.3c (`review`), Story 3.5 (`review`), Story 3.6 (`review`) — all real code, no `backlog` dependency blocking this story. Story 4.2 (this story's only consumer) is `ready-for-dev` and itself blocked on this story being implemented first (see Story 4.2's own Pre-Coding Approval Gate sequencing note) — recommended build order: this story before Story 4.2.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/domain/src/scraper/platform-registry.test.ts` (extend or create, `node:test`, no DB, 100% coverage): `detectPlatformFromUrl` recognizes every documented Instagram/Twitter domain variant; returns `null` for an unrecognized domain and for an unparseable URL string.
- [ ] `packages/domain/src/events/map-extraction-payload-to-proposed-correction.test.ts` (new, `node:test`, no DB, 100% coverage): full multi-schedule payload maps every field; absent optional fields stay `undefined`; every mapped schedule has `id: undefined`; `types`/`categories` map element-for-element.
- [ ] `apps/backend/src/schema/extraction.test.ts` (new, real local DB, `graphql-yoga` harness mirroring `corrections.test.ts`): unauthenticated call rejected `UNAUTHENTICATED`; existing-post path — caller's-key success; caller's-key exhausted then subscriber-pool success; both exhausted returns `QUOTA_EXHAUSTED`; new-post path — unsupported domain returns `UNSUPPORTED_PLATFORM` with no scrape attempted; no caller key returns `NO_API_KEY` with no scrape attempted; scrape throws/returns `null`/times out returns `SCRAPE_FAILED`; scrape succeeds and Gemini succeeds returns `data` with schedules carrying no `id`; `isEvent: false` returns `EXTRACTION_FAILED` for both paths; `posts` table row count unchanged after a new-post extraction (AC8).
- [ ] E2E: not required — no user-facing page/flow yet (Story 4.2 owns that); matches Story 1.3a/3.3a/4.1a's own "backend-API-layer-only" precedent of integration-test-only coverage.

## Deliverables Checklist

- [ ] `packages/domain/src/scraper/platform-registry.ts`: `detectPlatformFromUrl` implemented, unit-tested.
- [ ] `packages/domain/src/scraper/types.ts`: `ScraperAdapter.getPostByUrl` added.
- [ ] `apps/backend/src/lib/scraper/instagram-adapter.ts`: `getPostByUrl` implemented (capacity-check + timeout + Apify call + mapping).
- [ ] `apps/backend/src/lib/scraper/twitter-adapter.ts`: `getPostByUrl` stub added.
- [ ] `packages/domain/src/events/map-extraction-payload-to-proposed-correction.ts`: implemented, 100%-covered.
- [ ] `apps/backend/src/schema/extraction.graphql`: implemented (`ExtractionErrorCode`, `ProposedScheduleCorrectionData`, `ProposedEventCorrectionData`, `ExtractEventDataFromUrlResult`, `extractEventDataFromUrl`).
- [ ] `apps/backend/src/schema/resolvers.ts`: `extractEventDataFromUrl` resolver implemented, integration-tested.
- [ ] `apps/backend/src/generated/resolvers-types.ts`: regenerated via codegen.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- **Story 4.2's entire frontend surface** (the "AI-Assisted Correction" trigger button, URL input, Extract button, loading/error UI, extraction-merge/source-attribution logic) — this story only builds the backend mutation Story 4.2 will call. See `epics.md` Story 4.2.
- **Persisting a newly-scraped "new post" into the `posts` table** — AC8 explicitly scopes the live-scrape path as a one-off extraction only (no `accountId`/account-profile resolution attempted). Forward note: if a future story wants to persist these for reuse/dedup (mirroring `persistScrapedPost`), it would need to resolve or create a `social_media_account_profiles` row for the post's author first — a real additional scope, not attempted here.
- **Twitter/X live-post extraction** — `twitterScraperAdapter.getPostByUrl` (Task 1) is a stub matching its existing `getNewestPosts`/`lookupAccountProfile` "not yet implemented" precedent; Twitter/X URLs on the new-post path surface as `SCRAPE_FAILED`. Only Instagram URLs support the live-scrape path until a future story implements the Twitter/X adapter.
- **Round-robin key fallback for brand-new (never-scraped) posts** — per AC5/AC6, only the requesting user's own key is used for the new-post path; no fallback pool exists since a brand-new post has no known subscriber account.
- **True request cancellation on timeout** — the 20s hard timeout (AC6) stops the resolver from waiting, but does not abort the underlying in-flight Apify HTTP request (Dev Notes "Timeout Implementation Choice"). A future story could add `AbortSignal` plumbing through `callApifyActor` if this becomes a real cost/resource concern.
- **A `NOT_FOUND` error path** — declared in the `ExtractionErrorCode` enum for schema-completeness (Story 4.2's own Dev Notes reference it), but no code path in this story's AC1–AC9 returns it; reserved for a possible future non-URL-shaped error.

## Definition of Done

- [ ] All 9 Acceptance Criteria satisfied.
- [ ] `platform-registry.test.ts` (extended/new), `map-extraction-payload-to-proposed-correction.test.ts` (new) passing with 100% coverage.
- [ ] `extraction.test.ts` (new) passing, covering every AC1–AC9 branch.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] `apps/backend` codegen regenerated and committed.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
