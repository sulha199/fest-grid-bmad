# Story 3.4e: Fix not-found detection in the Instagram scraper adapter

## Story Details

- Epic: 3
- Story ID: 3.4e
- Status: ready-for-dev

## Story

As a system,
I want `getPostByUrl` and `lookupAccountProfile` to correctly detect a nonexistent post/account instead of treating Apify's `{"error": "not_found", ...}` response as valid data,
so that `castVote`-by-handle (Story 6.1a) stops silently creating fake `SocialMediaAccountProfile` rows for garbage handles, and manual post-extraction stops passing empty-content posts into the Gemini extraction pipeline.

**Split off Story 3.4d** (Sprint Change Proposal, `sprint-change-proposal-2026-08-15-not-found-detection-bug.md`, 2026-08-15) — see that story's Amendment 4. Carries forward 3.4d's AC6/Task 6 verbatim as this story's own scope, plus Story 3.3c's companion contract-note amendment (same date) as supporting context, not additional scope here.

## Acceptance Criteria

1. **Given** `getPostByUrl` calls the Instagram actor and receives a response, **when** the returned item is shaped `{"error": "...", "errorDescription": "..."}` (confirmed real shape: `{"url": ..., "username": ..., "error": "not_found", "errorDescription": "Post does not exist"}`, [`3-4d-task1b-runs/run-02`](3-4d-task1b-runs/run-02-apify-instagram-api-scraper-getpostbyurl-invalid.md), [`run-04`](3-4d-task1b-runs/run-04-apify-instagram-post-scraper-getpostbyurl-invalid.md)), **then** the adapter treats this as not-found and returns `null` — in addition to, not instead of, the existing `items.length === 0` check — so [resolvers.ts:994](../../apps/backend/src/schema/resolvers.ts#L994)'s `if (!scrapedPost) return SCRAPE_FAILED` fires correctly instead of receiving a hollow `ScrapedPost` with empty content.
2. **And** `lookupAccountProfile` applies the identical `item.error` check, returning `null` — confirmed real shape identical across both methods ([`run-06`](3-4d-task1b-runs/run-06-apify-instagram-api-scraper-lookupaccountprofile-invalid.md), [`run-08`](3-4d-task1b-runs/run-08-apify-instagram-post-scraper-lookupaccountprofile-invalid.md)) — so [resolvers.ts:1434](../../apps/backend/src/schema/resolvers.ts#L1434)'s `if (!lookupResult) throw 'not found'` fires correctly instead of `castVote` silently inserting a fabricated `SocialMediaAccountProfile` row (`displayName`/`username`/`accountId` all resolving to the invalid handle itself, per the traced fallback-chain bug).
3. **And**, as a fallback for the case where a future actor signals failure without an explicit `error` field, an item is also treated as not-found when it lacks the fields a real result must have: absence of both `item.caption` and `item.timestamp` for a post; absence of both `item.fullName` and `item.biography` for a profile. Verified safe against real evidence, not just plausible: [`run-01`](3-4d-task1b-runs/run-01-apify-instagram-api-scraper-getpostbyurl-valid.md)'s genuine valid-post response has both `caption` and `timestamp` present, and [`run-05`](3-4d-task1b-runs/run-05-apify-instagram-api-scraper-lookupaccountprofile-valid.md)'s genuine valid-profile response has both `fullName` and `biography` present — so this fallback cannot false-positive on the actor currently in production use.
4. **And** `instagram-adapter.test.ts` gains fixture-based test cases using the exact real error shape captured in `run-02`/`-04`/`-06`/`-08`, asserting both `getPostByUrl` and `lookupAccountProfile` return `null` for this shape — not a truthy garbage result.
5. **And** this story does not touch the Twitter/X stub adapter (still throws not-implemented) — Story 3.3c's companion amendment documents the expectation for whenever a real Twitter/X adapter is eventually built; this story only fixes the shipped Instagram adapter.

**Priority note (carried from epics.md):** elevated above normal backlog ordering — this is a confirmed, already-live data-integrity defect (Story 6.1a, `review` status), not a future risk.

**Depends on:** Story 3.4 (concrete `instagram-adapter.ts` this story fixes), Story 3.3c (contract-note amendment, informational only — no interface signature change).

## Tasks / Subtasks

- [ ] Task 1: Add a shared, adapter-local not-found detector to `instagram-adapter.ts` (AC: #1, #2, #3)
  - [ ] Add a private (non-exported) helper, e.g. `isNotFoundItem(item: any, kind: 'post' | 'profile'): boolean`, that returns `true` when (a) `item` has a truthy `error` field (the confirmed real Apify shape), or (b) for `kind: 'post'`, both `item.caption` and `item.timestamp` are absent, or (c) for `kind: 'profile'`, both `item.fullName` and `item.biography` are absent.
  - [ ] Keep this helper local to `instagram-adapter.ts` — it is Apify/Instagram-response-shape-specific field-mapping logic, the same category as the file's existing `normalizeApifyError`/fallback-chain mapping, not a generic cross-entity mechanism. Per `project-context.md`'s Adapter Pattern rule, this stays with the adapter it belongs to; it does **not** qualify for extraction into `packages/domain` (no reuse target exists — `getNewestPosts` and the not-yet-implemented Twitter/X adapter both have different response shapes/consumption patterns, see AC5 and Dev Notes).
- [ ] Task 2: Wire the check into `getPostByUrl` (AC: #1, #3)
  - [ ] After the existing `if (!items || items.length === 0) return null;` guard ([instagram-adapter.ts:74](../../apps/backend/src/lib/scraper/instagram-adapter.ts#L74)) and after `const item = items[0];`, add `if (isNotFoundItem(item, 'post')) return null;` before the existing field-mapping block.
  - [ ] Do not call `recordProviderUsage` on this new early-return path — matches this method's own existing convention (the sibling `items.length === 0` branch two lines above also skips usage recording), not a new inconsistency this story introduces.
- [ ] Task 3: Wire the check into `lookupAccountProfile` (AC: #2, #3)
  - [ ] Same pattern as Task 2, after [instagram-adapter.ts:152](../../apps/backend/src/lib/scraper/instagram-adapter.ts#L152)'s existing guard: `if (isNotFoundItem(item, 'profile')) return null;` before the existing field-mapping block. Same no-`recordProviderUsage`-on-early-return convention as Task 2.
- [ ] Task 4: Add fixture-based tests to `instagram-adapter.test.ts` (AC: #4)
  - [ ] New test case: `getPostByUrl` returns `null` when `callApifyActor` resolves the real captured error-item shape (`run-02`/`run-04`): `[{ url: '...', username: '...', error: 'not_found', errorDescription: 'Post does not exist' }]`.
  - [ ] New test case: `lookupAccountProfile` returns `null` for the same real captured shape (`run-06`/`run-08`).
  - [ ] Optional but recommended: one field-absence-fallback case per method (AC3), e.g. an item with no `error` field but also no `caption`/`timestamp` (post) or no `fullName`/`biography` (profile), asserting `null` — proves the fallback path independently of the `error`-field path.
  - [ ] Add these as new `t.test(...)` blocks using the file's existing `node:test`/`node:assert` + `setCallApifyActor` mocking pattern (see Dev Notes — this file does **not** use Vitest despite `project-context.md`'s general testing-philosophy section).
- [ ] Task 5: Verify no unintended scope creep (AC: #5)
  - [ ] Confirm `twitter-adapter.ts` is unmodified by this story's diff — its stub methods still throw `'Twitter/X scraping is not yet implemented'` unchanged.
  - [ ] Confirm `getNewestPosts` is unmodified — this story's not-found detection is scoped to the two single-item lookup methods only, per AC1/AC2.

## Dev Notes

### Architecture & UX Gate Findings

- **Epic 3 readiness sweep** (`_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md`, `swept: true`, 2026-08-09) already covers Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) for Epic 3's architecture — Gate 1/3 subagents were **not** re-run for this story per `story-split-gate.md`'s Epic-Level Sweep Mode; findings are cited from that report instead.
- **Lightweight escape-hatch guard** (required even when citing a swept report): this story's scope — a field-shape check added to two existing methods of an already-swept adapter, no new external service, no new data entity, no new infra dependency, no schema change — is fully within what the 2026-08-09 sweep already evaluated for the `ScraperAdapter`/Instagram-adapter architecture. Nothing here plausibly falls outside that sweep's scope. No fresh Gate 1/3 run needed.
- **Gate 2 (UI Complexity & Reusability)** — run fresh via subagent (Freya persona), since Gate 2 is per-story even under Epic-Level Sweep Mode. **No gap found.** This story is 100% backend (two functions in `instagram-adapter.ts` plus their test file) — no new GraphQL schema field, no new resolver behavior beyond an existing `if (!x) return/throw` branch now firing correctly, no new UI component/hook/util. The two consuming mutations' frontend error handling is already implemented and unchanged: `castVote`'s `BAD_REQUEST` path (`CastVoteForm.tsx`) and manual-extraction's `SCRAPE_FAILED` path (`ai-assisted-correction-trigger.tsx`) both already exist as generic error handlers for these existing error codes — this story makes an already-mapped branch reachable, it adds no new error code, state, or component. No authoritative UX artifact under `design-artifacts/` specifies vote-flow error-state detail this draft omits (none exists for the vote flow). Also corroborated independently by the Sprint Change Proposal's own Impact Analysis ("UI/UX: none").

### Package Boundaries

- The new not-found-detection helper stays local (non-exported) to `apps/backend/src/lib/scraper/instagram-adapter.ts`. It is Apify/Instagram-response-shape-specific field interpretation, not portable cross-entity business logic — it does not belong in `packages/domain` (no second consumer with the same response shape exists; `getNewestPosts` in the same file has a different, bulk consumption pattern that doesn't need single-item not-found detection, and the Twitter/X stub adapter has no real implementation yet to share this with). No new `packages/ui` component and no new `packages/domain` mechanism are introduced by this story.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None. `ScrapedPost | null` and `AccountProfileLookupResult | null` return types (`packages/domain/src/scraper/types.ts`) are unchanged — this story only changes *when* `null` is correctly returned, not the shape of either type.
- Required DB migration changes: No changes required — no schema/table touched.
- Required TypeScript type changes: No changes required — no interface/type signature changed (Story 3.3c's companion amendment is a contract *note*, not a signature change; see that story).
- Backward compatibility and rollout notes: Purely additive/corrective — every caller of `getPostByUrl`/`lookupAccountProfile` already has an `if (!result)` branch (resolvers.ts:994, resolvers.ts:1434) that today never fires for this input class; this story only makes those existing branches reachable for a new (previously-mismapped) input case. No caller-side change needed or made.
- Verification checks: New fixture tests (Task 4) assert `null` for the real captured error shape end-to-end through the adapter's public methods (not just the internal helper in isolation).

### Multi-Username Batch Call — Not Currently Used, Landmine If Ever Adopted (2026-08-17, added via `bmad-correct-course` follow-up testing)

Two real, position-reversed tests against `apify/instagram-post-scraper`:
- Run `hlJ6ieseVAtL9jvGI` (2026-08-17 09:59, `$0.0034`): input `username: [invalidHandle, validHandle]` → output `[errorItem, validItem]` (error at index 0).
- Run `Ap4UdYdV8HgZYM4ud` (2026-08-17 10:04, `$0.0034`): input `username: [validHandle, invalidHandle]` → output `[validItem, errorItem]` (error at index 1).

Three things now confirmed:
- **The not-found item's shape is identical to the single-item case** (`run-02`/`-04`/`-06`/`-08`) — `isNotFoundItem`'s `item.error` check (Task 1/AC1/AC2) is per-item and works correctly here too, no design change needed.
- **The two item shapes use *different* correlation fields** — the not-found item has `username` (echoing the input handle), the valid item has `ownerUsername` (and no top-level `username` field at all). Matching a result back to its input by field content is unsafe across mixed valid/invalid batches.
- **Output array order tracks input array order exactly** — confirmed by two independent runs with reversed positions, not a single data point. `items[0]` (e.g. [`instagram-adapter.ts:96`](../../apps/backend/src/lib/scraper/instagram-adapter.ts#L96)) is only safe when exactly one input is sent; it is **not** safe to assume "the not-found item is always at index 0" if a future call ever sends more than one input — the not-found item lands at whichever index its input handle occupied.
- **Why this doesn't change this story's scope:** every current call site (Story 3.4/3.4a) invokes the Instagram adapter with exactly one account per Apify call — `getPostByUrl`/`lookupAccountProfile` always send a single-element array (so `items[0]` is always correct today), and `getNewestPosts` is dispatched one account per SQS job/Apify call, never a batched multi-username array. This scenario is untestable-in-production today.
- **Why it's worth recording anyway:** if a future cost optimization ever batches multiple accounts into one Apify call (no current story proposes this), correlate each result to its input by array index (confirmed reliable, order-preserving), never by matching field names across item shapes, and never by assuming a fixed index like `0`.

### Project Structure Notes

- Files touched: `apps/backend/src/lib/scraper/instagram-adapter.ts` (UPDATE), `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (UPDATE). No new files. Matches this feature area's existing structure — no variance.
- **Pre-existing, unrelated test-file state worth flagging so it isn't mistaken for a regression this story caused:** `instagram-adapter.test.ts`'s test `'uses the faster app-funded sync actor and surfaces a timeout explicitly'` (added in commit `71aec22`, alongside Story 3.4d's research) already asserts behavior that is **not yet implemented in `instagram-adapter.ts`** — it expects `callApifyActor` to be invoked with a second `actorName` argument resolving to `'sones/instagram-posts-scraper-lowcost'` for `getPostByUrl`, and expects `lookupAccountProfile` to reject with a named `ApifyRequestTimeoutError` on a hung call. The current source only ever calls `callApifyActor(input)` with a single argument (always against the hardcoded `apify/instagram-api-scraper` actor), and `lookupAccountProfile` has no timeout wrapper at all (only `getPostByUrl` does, via `withTimeout`, which resolves `null` on timeout rather than rejecting with a named error). That test therefore already fails independently of this story — it belongs to Story 3.4d's still-pending Tasks 2-4 (actor-selection constants, `lookupAccountProfile` timeout), not to this story. **Do not** attempt to fix it as part of 3.4e, and do not model this story's new fixture tests on its `actorName`-based mock signature — use the current single-argument `callApifyActor(input)` signature, matching this file's other (currently-passing) tests.
- **Test runtime note:** despite `project-context.md`'s general "Testing Philosophy" section naming Vitest for `apps/*`, `instagram-adapter.test.ts` (and its sibling files in `apps/backend/src/lib/scraper/`) actually use Node's built-in `node:test`/`node:assert` runner (`import test from 'node:test'`), run via `tsx --test src/**/*.test.ts` (`apps/backend/package.json`'s `test` script). Follow this file's own established pattern, not the general project-wide statement.

### References

- [Source: `apps/backend/src/lib/scraper/instagram-adapter.ts`] — the adapter this story modifies (`getPostByUrl`, `lookupAccountProfile`; `getNewestPosts` untouched).
- [Source: `apps/backend/src/lib/scraper/instagram-adapter.test.ts`] — existing test file, read in full; see Project Structure Notes for the pre-existing unrelated red test.
- [Source: `apps/backend/src/lib/scraper/twitter-adapter.ts`] — confirmed untouched stub, read to verify AC5.
- [Source: `packages/domain/src/scraper/types.ts`] — `ScraperAdapter`/`ScrapedPost`/`AccountProfileLookupResult` shapes, confirmed unchanged by this story.
- [Source: `apps/backend/src/schema/resolvers.ts:993-994,1413-1436`] — the two call sites (`selectPostsForExtraction`'s manual URL path, `castVote`) whose existing `if (!x)` branches this story makes reachable.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-15-not-found-detection-bug.md`] — the proposal that split this story off Story 3.4d; full root-cause/impact analysis.
- [Source: `_bmad-output/implementation-artifacts/3-4d-per-use-case-actor-selection-and-sync-path-timeout.md`] — Amendment 3/4, Dev Notes "Task 1b Conclusions" — origin of this story's evidence.
- [Source: `_bmad-output/implementation-artifacts/3-4d-task1b-runs/run-01,02,04,05,06,08-*.md`] — real captured Apify responses (valid and invalid) this story's fixtures and AC3's field-absence safety check are drawn from directly, not inferred.
- [Source: `_bmad-output/planning-artifacts/epics.md`, Story 3.3c 2026-08-15 amendment] — the companion contract-note amendment (informational; no code change required by it).
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.13`] — *"performs a lightweight profile lookup ... so the new record never depends on a placeholder or the entered handle text"* — the requirement this story's fix brings the shipped implementation into actual compliance with.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md`] — `swept: true`, cited per Epic-Level Sweep Mode instead of re-running Gate 1/3.

## Global Rules References

- [X] `_bmad-output/project-context.md` — Adapter Pattern (General Architecture rule): fix stays inside the existing `ScraperAdapter` implementation, no new abstraction; Testing Rules (testing-trophy philosophy, unhappy-path coverage requirement this story's fixture tests satisfy).
- [X] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows the canonical section order/status vocabulary defined there.
- [X] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no architecture-decision (AD) record is implicated (no schema/soft-delete/query-DSL/queue change); confirmed by the Epic 3 readiness sweep's Gate 1/3 coverage above.
- [X] `docs/infrastructure/index.md` — no infra/deployment change; this story is application-code-only (no new queue, Lambda, or IaC touched).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/backend/src/lib/scraper/instagram-adapter.ts` — add private `isNotFoundItem(item, kind)` helper; call it from `getPostByUrl` (after the existing `items.length === 0` guard) and from `lookupAccountProfile` (same pattern), each returning `null` before the existing field-mapping block.
  - `apps/backend/src/lib/scraper/instagram-adapter.test.ts` — add ≥2 new `t.test(...)` cases (real `error`-shape fixtures for both methods per AC4), optionally ≥2 more for the AC3 field-absence fallback.
- **Rule Mapping:**
  - Adapter Pattern (`project-context.md`) → not-found detection logic stays inside `instagram-adapter.ts`, no new shared abstraction (see Dev Notes "Package Boundaries").
  - Testing Rules, unhappy-path coverage (`project-context.md`) → AC4's fixture tests are exactly this: an "unhappy path" (not-found) integration test for new adapter logic.
  - Story Content Structure (`story-content-structure.md`) → this file's own section order/status vocabulary.
- **Verification Plan:**
  - Run `apps/backend`'s test script (`pnpm --filter backend test`, or `tsx --test src/lib/scraper/instagram-adapter.test.ts` directly) — the file's 4 currently-passing tests must remain passing, plus the new AC4 fixture tests must pass. The pre-existing, unrelated failing test described in Dev Notes is expected to remain failing (Story 3.4d's scope, not this story's) — do not treat its failure as a regression caused by this change.
  - Manual/integration verification (per the Sprint Change Proposal's own success criteria): a `castVote` mutation with a garbled/nonexistent handle returns a `BAD_REQUEST` GraphQL error instead of inserting a `SocialMediaAccountProfile` row; a manual-extraction call with a genuinely invalid post URL returns `SCRAPE_FAILED` instead of a hollow extracted post.
  - Type check + lint for `apps/backend` (touched package only), per Definition of Done.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — AC1-5 above, verbatim from `epics.md` Story 3.4e, no scope expansion.
- [ ] Architecture and boundary confirmation — Gate 1/3 cited from swept `epic-3-readiness.md`; Gate 2 run fresh, no gap found (see Dev Notes).
- [ ] Testing plan confirmation — fixture-based unit tests in `instagram-adapter.test.ts` (AC4) plus the manual/integration verification steps in the Implementation Plan.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — no gap found on any gate; nothing to accept.

## Testing Requirements

- [ ] Unit/integration tests (Task 4, AC4): `getPostByUrl` and `lookupAccountProfile` each return `null` for the real captured `{"error": "not_found", ...}` shape.
- [ ] Unit/integration tests (AC3 fallback, recommended): each method also returns `null` for an item lacking its required fields but with no `error` field present.
- [ ] Regression check: the file's 4 currently-passing tests (`getNewestPosts maps output correctly...`, `lookupAccountProfile maps details correctly...`, `wraps Apify client errors...`, `throws explicit capacity error...`) still pass unmodified — this story's helper must not change behavior for any already-correct valid-input or error-path case.
- [ ] No E2E test required — this is a backend-adapter-internal correctness fix with existing, unchanged GraphQL-level error contracts (`SCRAPE_FAILED`, `BAD_REQUEST`); the "testing trophy" approach calls for integration-level coverage here, not a new Playwright flow.

## Deliverables Checklist

- [ ] `isNotFoundItem` helper added to `instagram-adapter.ts`, wired into both `getPostByUrl` and `lookupAccountProfile`.
- [ ] New fixture-based tests added to `instagram-adapter.test.ts` (AC4, plus recommended AC3 fallback cases).
- [ ] Confirmed `twitter-adapter.ts` and `getNewestPosts` unmodified (AC5).
- [ ] `pnpm --filter backend test` run and passing (excluding the pre-existing, unrelated Story-3.4d-scoped failure documented in Dev Notes).
- [ ] Lint/type check passing for `apps/backend`.

## Out of Scope

- Story 3.4d's remaining actor-selection/timeout work (AC1-5/Tasks 1-5 there) — including the already-present-but-failing test described in Dev Notes "Project Structure Notes." Not this story's responsibility to fix.
- Any change to the Twitter/X stub adapter (`twitter-adapter.ts`) — stays a not-yet-implemented stub (AC5).
- Any change to `getNewestPosts` — its bulk/batch consumption pattern doesn't need single-item not-found detection the way `getPostByUrl`/`lookupAccountProfile` do; not touched by this story's ACs.
- Recording provider usage for a confirmed-billed-but-not-found Apify call — out of scope per epics.md's AC list; this story's early-return path deliberately matches the existing sibling `items.length === 0` branch's behavior (no `recordProviderUsage` call), not a new inconsistency. A dedicated usage-accounting fix, if ever pursued, is a separate concern from the correctness bug this story fixes.
- AJV/schema validation of raw Apify response items — the adapter continues its existing pattern of manual `any`-typed field access with fallback chains; introducing formal schema validation here would be scope creep beyond the specified, evidence-backed fix.

## Definition of Done

- [ ] AC1-5 all satisfied.
- [ ] New fixture tests (AC4) passing; existing 4 tests in `instagram-adapter.test.ts` still passing.
- [ ] Lint and type checks passing for `apps/backend`.
- [ ] Manual verification: `castVote` with a garbled handle returns `BAD_REQUEST`, not a created `SocialMediaAccountProfile` row; manual extraction with an invalid post URL returns `SCRAPE_FAILED`, not a hollow extracted post.

## Completion Status

- [ ] Not started — story created via `bmad-create-story`, ready for `bmad-dev-story` (or `bmad-quick-dev`, per this story's own elevated-priority/small-size note in `epics.md`, at the implementer's discretion).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
