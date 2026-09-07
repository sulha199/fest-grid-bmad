---
baseline_commit: 0e7d61e4b1d61a65a37a67edf5eb3da9291e159a
---

# Story 3.7e: Instagram oEmbed backend integration — adapter and resolver field

## Story Details

- Epic: 3
- Story ID: 3.7e
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a backend adapter and GraphQL resolver field that proxies Instagram's tokenless oEmbed endpoint and applies the existing image-storage opt-in fallback rule server-side,
so that Story 3.7d's event-detail page can render a real platform embed with a reliable, typed "unavailable" vs. "available" signal — something the frontend cannot determine on its own, since Instagram's oEmbed response is only reachable server-side (its `Cross-Origin-Resource-Policy: same-origin` header blocks direct browser calls) and the opt-in-aware fallback rule already lives in the backend (`isImageStorageOptedIn`, Story 3.6h).

## Acceptance Criteria

1. **AC1 — Adapter calls the tokenless oEmbed endpoint and returns a typed result (epics.md AC1):** Given a post URL (`Post.originalPostUrl`, or `Post.postUrl`/`sourcePostUrl` when `originalPostUrl` is absent), when `resolveInstagramOEmbed(postUrl)` (`apps/backend/src/lib/instagram-oembed/adapter.ts`) is called, then it issues `GET https://graph.facebook.com/v25.0/instagram_oembed?url=<encoded postUrl>` (no access token — Meta's 2026-06-15 tokenless reversal) and returns `{ status: 'AVAILABLE', html: string }` when the response is a 2xx JSON body with a non-empty `html` field, or `{ status: 'UNAVAILABLE' }` for any non-2xx response, malformed JSON, missing/empty `html`, network error, or thrown exception — mirroring `rehostPostImage`'s (`apps/backend/src/lib/ai-processor/rehost-post-image.ts`) best-effort, non-throwing failure handling (log via `console.error`, never throw out of the adapter).
2. **AC2 — Results are cached with a bounded TTL (epics.md AC2):** Given a `postUrl` already resolved within the cache TTL window, when `resolveInstagramOEmbed(postUrl)` is called again, then it returns the cached result from the new `instagram_oembed_cache` table (`apps/backend/src/lib/instagram-oembed/cache-store.ts`) without calling Instagram's endpoint. A cache miss (no row, or an expired row) calls the endpoint and writes-through the fresh result with a new `expiresAt` (TTL = 24 hours — chosen because oEmbed content for a given Instagram post is effectively static day-to-day and even a single request per event-detail view stays trivially under Meta's ~1,000 req/hour tokenless budget; not mandated by any AC, safe to tune later via a named constant). Both `AVAILABLE` and `UNAVAILABLE` results are cached (an `UNAVAILABLE` result — e.g. a deleted post — is just as reusable within the TTL window as an `AVAILABLE` one, and caching it avoids hammering the endpoint for a post that stays deleted).
3. **AC3 — `Event.instagramEmbed` resolver field applies the opt-in-aware fallback rule (epics.md AC3):** Given an `Event` whose linked `Post` has a resolvable post URL, when the GraphQL query requests `instagramEmbed { status html durableImageUrl }`, then the resolver (`apps/backend/src/schema/resolvers.ts`, `Event.instagramEmbed`) returns:
   - `{ status: AVAILABLE, html: <adapter's html>, durableImageUrl: null }` when the adapter returns `AVAILABLE`;
   - `{ status: UNAVAILABLE, html: null, durableImageUrl: null }` when the adapter returns `UNAVAILABLE` and the account is **not** opted into image storage (`isImageStorageOptedIn === false`, joined the same way Story 3.6h's `Event.imageUrl` resolver already joins it via `socialMediaAccountProfiles`) — the frontend (Story 3.7d AC3) renders "content no longer available" for this shape;
   - `{ status: UNAVAILABLE, html: null, durableImageUrl: <Post.durableImageUrl> }` when the adapter returns `UNAVAILABLE` and the account **is** opted in AND `Post.durableImageUrl` is non-null — the frontend (Story 3.7d AC5) renders that as a fallback image;
   - `null` when the `Event` has no linked `Post` or the post has no resolvable URL (`originalPostUrl`/`sourcePostUrl` both absent) — there is nothing to embed.
   This branching logic is a pure function, `resolveInstagramEmbedResult` (`packages/domain/src/events/resolveInstagramEmbedResult.ts`), reusing the exact `isImageStorageOptedIn` flag/join Story 3.6h established for `Event.imageUrl` — not a second parallel opt-in check.
4. **AC4 — Field is resolved only when requested, not eagerly fetched (epics.md AC4):** Given a GraphQL query for `Event`/`Event[]` that does **not** include `instagramEmbed` in its selection set, when that query executes, then `resolveInstagramOEmbed` is never called (verified by a resolver test asserting a mocked adapter records zero calls for such a query) — this holds automatically because `instagramEmbed` is implemented as a normal GraphQL field resolver (Yoga/graphql-js only invokes field resolvers for fields present in the selection set) and is **not** added to any of the 5 existing `db.select({...requestedFields, ...})` blocks that eagerly join `posts`/`socialMediaAccountProfiles` columns for every `Event` query today.
5. **AC5 — Schema changes ship as a generated migration (AD-3):** The new `instagram_oembed_status` Postgres enum and `instagram_oembed_cache` table are defined in `packages/database/schema.ts` using `drizzle-orm/pg-core` types (`pgEnum`, `pgTable`, `uuid`, `text`, `timestamp`), and the corresponding SQL migration is produced by `pnpm --filter @festgrid/database generate` (drizzle-kit) and checked into `packages/database/migrations/` — never a hand-written migration file.
6. **AC6 — `resolveInstagramEmbedResult` has 100% unit test coverage (project-context.md Testing Rules):** As a pure function exported from `packages/domain`, `resolveInstagramEmbedResult` has unit tests covering all branches: adapter `AVAILABLE`; adapter `UNAVAILABLE` + opted-in + `durableImageUrl` present; adapter `UNAVAILABLE` + opted-in + `durableImageUrl` absent; adapter `UNAVAILABLE` + not opted-in; and `adapterResult` itself `null` (no post URL to resolve).

**i18n note:** This story has no user-facing strings — `status`/`html`/`durableImageUrl` are structured data consumed by Story 3.7d, whose own `InstagramEmbedLabels`/`next-intl` wiring owns all copy (see Story 3.7d Task 7). No i18n AC applies here.

## Tasks / Subtasks

- [x] 1. **(AC5)** Add `instagramOembedStatusEnum = pgEnum('instagram_oembed_status', ['AVAILABLE', 'UNAVAILABLE'])` and `instagramOembedCache` (`id` uuid PK, `postUrl: text().unique().notNull()`, `status: instagramOembedStatusEnum().notNull()`, `html: text()` nullable, `expiresAt: timestamp({ withTimezone: true }).notNull()`, `...timestamps`, plus an index on `expiresAt`) to `packages/database/schema.ts`, placed near `geolocationCache` (same "adapter-backed cache table" family).
- [x] 2. **(AC5)** Run `pnpm --filter @festgrid/database generate` to produce the drizzle-kit migration SQL file; verify it applies cleanly against the local test DB (`pnpm --filter @festgrid/database` migrate step already run by CI/test setup — confirm no manual SQL edits needed, unlike AD-8's partial-index `WHERE` clause carve-out, since this table needs no soft-delete/partial index).
- [x] 3. **(AC1, AC2)** Create `apps/backend/src/lib/instagram-oembed/types.ts` exporting `InstagramOEmbedAdapterResult = { status: 'AVAILABLE'; html: string } | { status: 'UNAVAILABLE' }` (shared by adapter.ts and cache-store.ts to avoid a circular import).
- [x] 4. **(AC2)** Create `apps/backend/src/lib/instagram-oembed/cache-store.ts`: `getCachedEmbed(postUrl): Promise<InstagramOEmbedAdapterResult | null>` (select where `postUrl` matches AND `expiresAt > now`; return `null` on miss/expiry) and `setCachedEmbed(postUrl, result, ttlMs): Promise<void>` (insert `.onConflictDoUpdate({ target: instagramOembedCache.postUrl, set: {...} })`, mirroring `apps/backend/src/lib/geolocation/cache-store.ts`'s upsert shape).
- [x] 5. **(AC1, AC2)** Create `apps/backend/src/lib/instagram-oembed/adapter.ts`: `resolveInstagramOEmbed(postUrl: string): Promise<InstagramOEmbedAdapterResult>` — cache lookup first; on miss, `fetch` the tokenless endpoint, parse the JSON body, map to the typed result, `console.error` and return `UNAVAILABLE` on any thrown/network/non-2xx/malformed-response condition (never throw), then write-through the cache regardless of outcome.
- [x] 6. **(AC1, AC2, Testing)** Create `apps/backend/src/lib/instagram-oembed/adapter.test.ts` and `cache-store.test.ts` (`node:test` + `node:assert/strict`, `mock.method(globalThis, 'fetch', ...)` — the exact pattern in `apps/backend/src/lib/geolocation/adapter.test.ts`). Cover: happy-path `AVAILABLE`; non-2xx → `UNAVAILABLE`; malformed/empty-`html` JSON → `UNAVAILABLE`; thrown fetch error → `UNAVAILABLE`, not thrown; cache hit skips `fetch`; expired cache row triggers a fresh `fetch`; both `AVAILABLE` and `UNAVAILABLE` results get written to the cache table (assert via a real `db.select` against the test DB, clearing `instagramOembedCache` in `t.afterEach`, per the geolocation adapter test's setup/teardown pattern).
- [x] 7. **(AC3, AC6)** Create `packages/domain/src/events/resolveInstagramEmbedResult.ts`: pure function `resolveInstagramEmbedResult({ adapterResult, isImageStorageOptedIn, durableImageUrl }): { status: 'AVAILABLE' | 'UNAVAILABLE'; html: string | null; durableImageUrl: string | null } | null`, implementing the branching in AC3 above (styled after the existing `resolveServedImageUrl.ts` in the same folder — same "small pure resolver-support function" shape).
- [x] 8. **(AC6, Testing)** Create `packages/domain/src/events/resolveInstagramEmbedResult.test.ts` covering all 5 branches listed in AC6, achieving 100% branch coverage per project-context.md's domain-package testing rule.
- [x] 9. Export `resolveInstagramEmbedResult` (and its input/output types) from `packages/domain/src/events/index.ts`.
- [x] 10. **(AC3)** Update `apps/backend/src/schema/events.graphql`: add `enum InstagramEmbedStatus { AVAILABLE UNAVAILABLE }`, add `type InstagramEmbed { status: InstagramEmbedStatus! html: String durableImageUrl: String }`, and add `instagramEmbed: InstagramEmbed` (nullable) to `type Event { ... }`, placed near the existing `imageUrl`/`durableImageUrl`/`videoUrl` fields.
- [x] 11. **(AC3, AC4)** Update `apps/backend/src/schema/resolvers.ts`: import `resolveInstagramOEmbed` from `../lib/instagram-oembed/adapter.js` and `resolveInstagramEmbedResult` from `@festgrid/domain/events`; add an `instagramEmbed` async resolver to the `Event` resolver map (next to the existing `imageUrl`/`durableImageUrl`/`videoUrl` field resolvers, ~line 3497) that derives `postUrl = parent.originalPostUrl || parent.sourcePostUrl`, returns `null` immediately if absent, otherwise calls `resolveInstagramOEmbed(postUrl)` then `resolveInstagramEmbedResult({...})` using `parent.isImageStorageOptedIn` and `parent.durableImageUrl` (both already present on `parent` for every existing Event query — no changes needed to any of the 5 `db.select({...requestedFields, ...})` blocks, per AC4).
- [x] 12. Run `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` against the schema change — never hand-edit generated output.
- [x] 13. **(AC3, AC4, Testing)** Extend `apps/backend/src/schema/resolvers.test.ts` with `Event.instagramEmbed` resolver coverage: `AVAILABLE` shape; `UNAVAILABLE` + not-opted-in → `durableImageUrl: null`; `UNAVAILABLE` + opted-in + durable URL present → fallback shape; no linked post / no post URL → resolver returns `null`; and an AC4 regression test asserting a query that omits `instagramEmbed` never invokes the mocked adapter.
- [x] 14. **(Verification)** Run `pnpm --filter @festgrid/domain test`, `pnpm --filter backend test`, and `pnpm --filter backend build` (tsc) to confirm the new code compiles, all new/existing tests pass, and no regression to the 5 existing Event query resolvers' output shape.

## Dev Notes

### Architecture & UX Gate Findings

All three gates were run fresh for this story (via `runSubagent`, personas Winston/Freya) because `epic-3-readiness.md`'s `stories_covered` frontmatter list predates Story 3.7e (it lists up to 3.11 as of its 2026-08-09 sweep, but does not include 3.7c/3.7d/3.7e, which were added 2026-09-02/2026-09-04) — the epic-wide sweep never evaluated this story, so citing it without a fresh check would be a false "already covered" claim, per this workflow's own lightweight-guard instruction.

- **Gate 1 (Architecture/Infrastructure Completeness, Winston):** NO GAP. Every trigger heuristic resolves cleanly: this story is entirely `apps/backend`-internal (no DB/domain/external-service call from `apps/web` or a UI package — that boundary is precisely what this story exists to enforce, since it was split out of Story 3.7d for exactly that reason); the new `Event.instagramEmbed` field is additive to the *existing* GraphQL schema/resolver layer (same file/location as sibling `imageUrl`/`durableImageUrl` fields), not a new layer invented ad hoc; no auth/secrets/business-rule logic moves to the frontend; and no IaC/credential gap exists since Meta's 2026-06-15 tokenless reversal means the oEmbed endpoint needs zero AWS infra or secret — the only new artifact is a standard Drizzle-kit-generated migration (AC5), the established pattern for schema changes. The subagent also confirmed this is correctly a synchronous read-path resolver (triggered by event-detail page views against already-ingested `posts` rows), not a scraping/extraction pipeline job, so the mandatory three-queue architecture (ScrapingQueue/AIProcessingQueue/DataIngestionQueue) does not apply — same shape as the existing queue-free `resolveLocation`/`geolocationCache` adapter.
- **Gate 2 (UI Complexity & Reusability, Freya):** NO GAP. Zero UI surface in this story's scope (no components/hooks/React utils at all). The subagent grepped `design-artifacts/UX-festgrid-run-1/DESIGN.md`/`EXPERIENCE.md` for instagram/embed/oembed/cache/staleness/rate-limit content and found nothing relevant to encode here. The UI/copy boundary with sibling Story 3.7d holds: all user-facing labels (`contentNoLongerAvailableLabel`, `embedLoadingLabel`, `embedRegionLabel`) live in 3.7d's `InstagramEmbedLabels`/i18n wiring; this story's `{status, html, durableImageUrl}` resolver output carries no message strings.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston):** NO GAP. Confirms and extends the Gate 3 finding already made while drafting Story 3.7d (no shared `EmbedAdapter` interface needed yet — single consumer). Checked specifically against what 3.7e newly introduces: the adapter pattern itself is an established, already-multiply-used convention (`lib/geolocation/adapter.ts`, `lib/email/adapter.ts`, `lib/scraper/instagram-adapter.ts`), not a first introduction; the DB-backed cache table mirrors the existing `geolocationCache` precedent exactly, with no shared cache abstraction mandated anywhere; best-effort `console.error` logging (no dedicated observability provider) matches `rehostPostImage`'s established precedent, which this story's own AC1 explicitly cites; and the GraphQL/codegen pipeline is already established since Epic 0 — this story is one more incremental field/resolver consumer of it, not a new pipeline. No project-context.md/architecture-spine dependency was found with no home anywhere in `epics.md`.

**No prerequisite story, `epics.md` addition, or new `sprint-status.yaml` entry results from this story's gates.**

### Adapter file location (deviation from epics.md's illustrative path)

Epics.md's AC1 illustratively suggests `apps/backend/src/lib/adapters/instagram-oembed-adapter.ts`, but no such generic `lib/adapters/` folder exists in this codebase — the established, consistently-followed convention is a per-domain folder holding `adapter.ts` (`lib/geolocation/adapter.ts`, `lib/email/adapter.ts`; `lib/scraper/instagram-adapter.ts` is the one domain-prefixed-filename exception, itself living in a shared `lib/scraper/` folder because multiple platform adapters coexist there). This story follows the per-domain-folder convention instead: `apps/backend/src/lib/instagram-oembed/adapter.ts` (+ `cache-store.ts`, `types.ts` in the same folder) — a mechanical file-location choice aligning with existing precedent, flagged as a non-blocking note by Gate 1's own subagent run, not a re-litigated design decision.

### Reusable domain logic (packages/domain)

Per this project's Code Organization rule, the pure branching logic that decides the final `{status, html, durableImageUrl}` shape (AC3) belongs in `packages/domain/src/events/resolveInstagramEmbedResult.ts` — framework-agnostic, no DB/ORM/Node-only imports (it takes an already-fetched `InstagramOEmbedAdapterResult` plus two primitives as input, never touches Drizzle or `fetch` itself), so it stays frontend-safe/importable-anywhere in principle even though its only current caller is `apps/backend`. This mirrors the existing `resolveServedImageUrl.ts` in the same folder exactly. The DB/HTTP-coupled parts (`adapter.ts`, `cache-store.ts`) correctly stay in `apps/backend` per the same rule's DB/Node-coupling carve-out.

### Cloud/external service setup (SETUP_WALKTHROUGH.md)

No `SETUP_WALKTHROUGH.md` update is needed for this story. Meta reversed Instagram oEmbed's access-token requirement on 2026-06-15 (confirmed via live research during Story 3.7d's drafting, cited in its Amendment note): `GET https://graph.facebook.com/v25.0/instagram_oembed?url=<url>` now works tokenless, with no Meta App/App Review, for public posts, at a documented ~1,000 requests/hour. There is no credential, environment variable, or external account to provision — the only "setup" is the self-contained DB migration (AC5), which needs no walkthrough entry beyond the project's existing standard migration-deploy step.

### State management / loader categorization

Not applicable — this story is 100% `apps/backend` (GraphQL schema + resolver + DB adapter). It introduces no React code, so none of Server State (React Query) / URL State (nuqs) / Client Global State (zustand) apply, and none of the Blocking/Non-Blocking loader categories apply either. The corresponding frontend-facing loading/ready/unavailable state machine is Story 3.7d's `InstagramEmbed.tsx` component-local `useState`, already scoped and categorized in that story's own Dev Notes.

### Analytics (AD-5)

No new PostHog event is introduced by this story. Adapter failures are logged via `console.error` (matching `rehostPostImage`'s established best-effort precedent, confirmed as sufficient by Gate 3) rather than a new analytics/observability event — no AC in epics.md or the PRD calls for user-analytics tracking of oEmbed availability.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No pre-existing mismatch to fix. This story *introduces* new schema/types that must stay aligned across four layers: the Postgres enum, the GraphQL enum, the `packages/domain` TypeScript types, and Story 3.7d's already-drafted frontend contract. All four already agree on the same two-value set (`AVAILABLE` / `UNAVAILABLE`) — Story 3.7d's Task 2 (`InstagramEmbedProps.status: 'AVAILABLE' | 'UNAVAILABLE' | null | undefined`) was drafted anticipating exactly this story's shape, confirmed by reading `_bmad-output/implementation-artifacts/3-7d-event-detail-image-display-oembed-transition-with-fallback.md` Task 2 and its Deliverables Checklist.
- **Impacted fields/contracts:**
  - New DB: `instagram_oembed_status` enum, `instagram_oembed_cache` table (`post_url` unique, `status`, `html` nullable, `expires_at`).
  - New GraphQL: `InstagramEmbedStatus` enum, `InstagramEmbed` type, `Event.instagramEmbed` field (nullable, additive — no existing field changes).
  - New TypeScript: `packages/domain`'s `resolveInstagramEmbedResult` input/output types; `apps/backend/src/lib/instagram-oembed/types.ts`'s `InstagramOEmbedAdapterResult`; `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen, Task 12 — never hand-edited).
- **Required DB migration changes:** `pnpm --filter @festgrid/database generate` (drizzle-kit) after the `schema.ts` edit (Task 1/2) produces the migration SQL; checked into `packages/database/migrations/`, following AD-3.
- **Required TypeScript type changes:** covered by Tasks 3, 7, 9, 12 above — no manual type authoring needed beyond the new domain/adapter files; `resolvers-types.ts` stays fully generated.
- **Backward compatibility and rollout notes:** Purely additive and non-breaking. `Event.instagramEmbed` is nullable and every existing query that doesn't request it is unaffected (AC4). Story 3.7d already codes defensively for `instagramEmbed` being absent (renders its unchanged `EventImage` path) — no coordinated deploy ordering is required, though 3.7d's own `apps/web` wiring tasks (its Tasks 11-14) stay blocked until this story ships, per its own Dev Notes.
- **Verification checks:** Task 8's 100% domain unit coverage; Task 6's adapter/cache-store integration tests against a real local test DB; Task 13's resolver tests (including the AC4 lazy-resolution regression test); Task 14's cross-package build/test run.

### Project Structure Notes

- Aligns with the unified project structure: `apps/backend/src/lib/<domain>/` for backend-only external-service glue (adapter + cache-store), `packages/domain/src/events/` for the pure decision logic, `apps/backend/src/schema/` for the GraphQL schema/resolver layer. No `packages/ui` involvement (no UI in this story).
- No detected conflicts or variances beyond the file-location note above (adapter folder naming), which is a mechanical alignment with existing convention, not a structural deviation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7e: Instagram oEmbed backend integration — adapter and resolver field] — authoritative ACs and Note this story elaborates.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7d: Event-detail image display — oEmbed transition with fallback (Amendment, 2026-09-04)] — the Gate 1 finding that split this story out, and the live-research citation for Meta's tokenless oEmbed reversal.
- [Source: _bmad-output/implementation-artifacts/3-7d-event-detail-image-display-oembed-transition-with-fallback.md#Task 2, #Out of Scope] — the exact `{status, html, durableImageUrl}` contract this story's resolver must satisfy.
- [Source: _bmad-output/implementation-artifacts/3-6h-gate-image-re-hosting-and-serving-on-account-opt-in.md] — origin of the `isImageStorageOptedIn` flag/join pattern this story reuses.
- [Source: apps/backend/src/schema/resolvers.ts#L1698-1710, L3002-3013, L3123-3135, L3202-3220, L3456-3468] — the 5 existing Event query-builder blocks that already unconditionally select `originalPostUrl`/`sourcePostUrl`/`durableImageUrl`/`isImageStorageOptedIn` (no changes needed for AC4).
- [Source: apps/backend/src/schema/resolvers.ts#L3497-3506] — the `Event` resolver map's existing `imageUrl`/`durableImageUrl`/`videoUrl` field resolvers, the exact pattern `instagramEmbed` follows.
- [Source: apps/backend/src/lib/geolocation/adapter.ts, cache-store.ts, geoapify-client.ts] — the adapter + DB-backed cache + raw-`fetch` pattern this story mirrors most closely (on-demand external call, no queue, DB-cached).
- [Source: apps/backend/src/lib/ai-processor/rehost-post-image.ts] — the best-effort, non-throwing external-call failure-handling pattern AC1 explicitly cites.
- [Source: packages/domain/src/events/resolveServedImageUrl.ts] — the pure-function style `resolveInstagramEmbedResult` follows.
- [Source: packages/database/schema.ts#L190-196 (geolocationCache), #L215-246 (posts)] — table/enum conventions and the `originalPostUrl`/`postUrl` columns this story reads.
- [Source: _bmad-output/project-context.md#General Architecture, #Code Organization, #Database & Performance] — Adapter Pattern rule, `packages/domain` purity rule, Drizzle/AD-3 migration rule.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-3] — Database Schema Management invariant.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode rule applied above.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Adapter Pattern, `packages/domain` purity/Code Organization rules, AD-3-aligned migration rule, Testing Rules (100% domain coverage) all directly govern this story's design; consulted and cited above.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-3) — Database Schema Management invariant governs the migration requirement (AC5).
- [x] `docs/infrastructure/2-backend.md` (index-level; read for the three-queue architecture check during Gate 1) — confirmed this synchronous read-path resolver correctly stays outside the ScrapingQueue/AIProcessingQueue/DataIngestionQueue pipeline.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `packages/database/schema.ts` — add `instagramOembedStatusEnum`, `instagramOembedCache` table (Task 1).
  - NEW migration under `packages/database/migrations/` — generated, not hand-written (Task 2).
  - NEW `apps/backend/src/lib/instagram-oembed/types.ts` — shared `InstagramOEmbedAdapterResult` type (Task 3).
  - NEW `apps/backend/src/lib/instagram-oembed/cache-store.ts` + `cache-store.test.ts` (Task 4, 6).
  - NEW `apps/backend/src/lib/instagram-oembed/adapter.ts` + `adapter.test.ts` (Task 5, 6).
  - NEW `packages/domain/src/events/resolveInstagramEmbedResult.ts` + `.test.ts` (Task 7, 8).
  - UPDATE `packages/domain/src/events/index.ts` — new export (Task 9).
  - UPDATE `apps/backend/src/schema/events.graphql` — `InstagramEmbedStatus` enum, `InstagramEmbed` type, `Event.instagramEmbed` field (Task 10).
  - UPDATE `apps/backend/src/schema/resolvers.ts` — `Event.instagramEmbed` field resolver (Task 11).
  - UPDATE (generated) `apps/backend/src/generated/resolvers-types.ts` — via `pnpm --filter backend codegen` (Task 12).
  - UPDATE `apps/backend/src/schema/resolvers.test.ts` — new `instagramEmbed` resolver coverage (Task 13).
- **Rule Mapping:**
  - Adapter Pattern (project-context.md General Architecture) → `apps/backend/src/lib/instagram-oembed/adapter.ts`, mirroring `lib/geolocation/adapter.ts`.
  - `packages/domain` purity rule → `resolveInstagramEmbedResult.ts` stays DB/ORM/Node-free.
  - AD-3 (Database Schema Management) → drizzle-kit generated migration only (Task 2), never hand-written.
  - Testing Rules (100% `packages/domain` coverage; testing-trophy elsewhere) → Task 8 (domain, 100%), Tasks 6/13 (integration-style `apps/backend` tests via `node:test`).
  - Gate 1/2/3 (story-split-gate.md) → all NO GAP, documented above; no absorbed/deferred scope.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — 100% coverage on `resolveInstagramEmbedResult`.
  - `pnpm --filter backend test` — adapter, cache-store, and resolver test suites (including the AC4 lazy-resolution assertion).
  - `pnpm --filter backend build` (tsc) — type-check the schema/resolver changes and generated `resolvers-types.ts`.
  - Manual/automated GraphQL query against a local dev DB seeded with an Instagram post to confirm the live shape of `instagramEmbed { status html durableImageUrl }` end-to-end.

## Pre-Coding Approval Gate

- [x] Scope confirmation: backend-only (`apps/backend`, `packages/database`, `packages/domain`) — adapter, DB-backed cache, `Event.instagramEmbed` resolver field. No `apps/web`/`packages/ui` changes (those are Story 3.7d's, already drafted and blocked on this story).
- [x] Architecture and boundary confirmation: Gate 1/2/3 all report NO GAP (see Architecture & UX Gate Findings above) — no prerequisite story required, no scope deferred.
- [x] Testing plan confirmation: 100% `packages/domain` unit coverage (Task 8) + `apps/backend` adapter/cache-store/resolver test suites (Tasks 6, 13), per the Testing Requirements below.
- [x] Explicit human approval state: approved by user 2026-09-07 (bmad-dev-story session, story 3.7e).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: N/A — no gap found by any of the three gates; nothing to confirm-done or accept.

## Testing Requirements

- [x] Integration tests: `apps/backend/src/lib/instagram-oembed/adapter.test.ts` + `cache-store.test.ts` (`node:test`, `mock.method(globalThis, 'fetch', ...)`, real local test DB per the `geolocation/adapter.test.ts` pattern) — happy path, non-2xx, malformed response, thrown error, cache hit, cache expiry, write-through for both `AVAILABLE`/`UNAVAILABLE`.
- [x] Integration tests: `apps/backend/src/schema/resolvers.test.ts` extension — `Event.instagramEmbed` for all branches in AC3, plus the AC4 lazy-resolution regression test (mocked adapter records zero calls when `instagramEmbed` isn't in the query selection set).
- [x] Unit tests: `packages/domain/src/events/resolveInstagramEmbedResult.test.ts` — 100% branch coverage per AC6.
- [x] E2E tests: not required for this story (no user-facing surface; Story 3.7d owns the E2E-relevant frontend behavior once this field ships).

## Deliverables Checklist

- [x] `instagram_oembed_status` enum + `instagram_oembed_cache` table added to `packages/database/schema.ts`, with a generated (not hand-written) drizzle-kit migration checked in.
- [x] `InstagramOEmbedAdapterResult`-typed `resolveInstagramOEmbed(postUrl)` adapter in `apps/backend/src/lib/instagram-oembed/adapter.ts`, cache-backed via `cache-store.ts`, best-effort/non-throwing per AC1.
- [x] Pure `resolveInstagramEmbedResult` function in `packages/domain/src/events/`, exported from the package's `./events` entry point, 100% unit-tested.
- [x] `InstagramEmbedStatus` enum + `InstagramEmbed` type + `Event.instagramEmbed` field added to `apps/backend/src/schema/events.graphql`.
- [x] `Event.instagramEmbed` resolver wired in `apps/backend/src/schema/resolvers.ts`, resolved lazily (AC4), reusing Story 3.6h's `isImageStorageOptedIn` join with no new DB joins added to the 5 existing Event query blocks.
- [x] `apps/backend/src/generated/resolvers-types.ts` regenerated via `pnpm --filter backend codegen` (no hand-edits).
- [x] All new/updated test suites passing (`@festgrid/domain`, `backend`).

## Out of Scope

- **`apps/web`/`packages/ui` rendering of the embed** — Story 3.7d's exclusive scope (the `InstagramEmbed.tsx` component, its 4-state machine, i18n labels, and the `getEventBySlug` query/mapper wiring that consumes this story's field). This story only ships the backend contract 3.7d already drafted against.
- **A generalized, multi-platform `EmbedAdapter` interface** — explicitly deferred by Gate 3 (both during 3.7d's drafting and confirmed fresh here) until a second embed-needing platform story actually exists; only Instagram is supported today (`SUPPORTED_PLATFORMS = ['instagram']`).
- **Platform-gating logic for non-Instagram posts** — not built, since this codebase currently only scrapes Instagram (`packages/domain/src/subscriptions/platforms.ts`). If a future story adds a second scraped platform, `Event.instagramEmbed`'s resolver would need a `platform === 'instagram'` guard before calling the adapter; flagged here as a forward-looking note for that future story, not built now.
- **The 7-30 day event-lifecycle display window mechanism** (referenced by Story 3.7d's Note) — not yet designed anywhere; out of scope for both 3.7d and this story.
- **A dedicated rate-limiting/token-bucket mechanism** for Meta's ~1,000 req/hour budget — not needed; the bounded-TTL cache (AC2) alone keeps usage well under budget at any realistic traffic level, per Gate 3's confirmation.

## Definition of Done

- [x] AC1-AC6 satisfied and verified by their respective tests.
- [x] Required tests passing: `pnpm --filter @festgrid/domain test`, `pnpm --filter backend test`.
- [x] Lint and type checks passing for touched packages (`@festgrid/database`, `@festgrid/domain`, `backend`).
- [x] Migration generated (not hand-written) and applies cleanly.
- [x] `resolvers-types.ts` regenerated via codegen, not hand-edited.

## Completion Status

- [x] Complete — implemented, tested, and ready for review.

## Dev Agent Record

### Agent Model Used

Claude (bmad-dev-story session, 2026-09-07)

### Debug Log References

- `pnpm --filter @festgrid/database generate` → produced `packages/database/migrations/0049_lyrical_ultimatum.sql` cleanly (no manual SQL edits needed).
- `pnpm --filter @festgrid/database migrate` → applied cleanly against the local test DB.
- `pnpm --filter backend codegen` → regenerated `apps/backend/src/generated/resolvers-types.ts` with `InstagramEmbed`/`InstagramEmbedStatus` types, no hand-edits.
- `pnpm --filter @festgrid/domain test` → 259/259 passed (100% domain test suite, including the new 5-branch `resolveInstagramEmbedResult` coverage).
- `pnpm --filter backend test` (`src/lib/instagram-oembed/*.test.ts`) → 14/14 passed (adapter + cache-store).
- `pnpm --filter backend test` (`src/schema/resolvers.test.ts`, `--test-name-pattern="instagramEmbed|events resolver integration"`) → 52/52 passed, including the new `Event.instagramEmbed` resolver suite (5/5) and no regression to the 5 existing Event query resolvers.
- Full `pnpm --filter backend test` run: 658/660 passed. The 2 failures (`process-apify-async-result tests`, `setImageStorageOptIn and queryModeratorAccountProfiles integration tests` → `queryModeratorAccountProfiles - Happy Path & Search filter`) are pre-existing and out of this story's scope — confirmed via `git diff --stat` that neither `process-apify-async-result.test.ts` (never touched by this story) nor the failing `queryModeratorAccountProfiles` assertion (unchanged code, just shifted ~181 lines later by this story's added test block) were modified by this story's diff, and the failures reproduce identically in isolation (single-file re-run) independent of this story's changes.
- `pnpm --filter backend build` (tsc) → clean after adding explicit return-type annotations to the `fetch` mocks in `adapter.test.ts`/`resolvers.test.ts` (TS otherwise narrowed the mock's inferred type from the first `mock.method` call and rejected later `mockImplementation` calls with a differently-shaped `json()` return).
- Root `pnpm lint` → 0 errors (1080 pre-existing warnings across the monorepo, none introduced by this story's files).
- Root `pnpm build` → 7/7 tasks successful (includes `apps/web`, confirming no cross-package breakage from the schema/domain/backend changes).

### Completion Notes List

- (bmad-create-story, 2026-09-07) Ultimate context engine analysis completed - comprehensive developer guide created.
- (bmad-dev-story, 2026-09-07) All 14 tasks implemented per the story's Implementation Plan, exactly as scoped: `instagram_oembed_status` enum + `instagram_oembed_cache` table (Task 1) with a generated migration (Task 2); `apps/backend/src/lib/instagram-oembed/{types,cache-store,adapter}.ts` (Tasks 3-5) mirroring the `geolocation` adapter/cache-store pattern, best-effort/non-throwing per `rehostPostImage`'s precedent; `packages/domain/src/events/resolveInstagramEmbedResult.ts` pure function (Task 7) styled after `resolveServedImageUrl.ts`, exported from the package's `./events` entry point (Task 9); `events.graphql`/`resolvers.ts` additive `Event.instagramEmbed` field wired lazily next to the existing `imageUrl`/`durableImageUrl`/`videoUrl` resolvers, reusing the same `parent.isImageStorageOptedIn`/`parent.durableImageUrl` values already selected by all 5 existing Event query blocks — no new DB joins added (Tasks 10-11, AC4); codegen regenerated (Task 12).
- ✅ AC1: `resolveInstagramOEmbed` calls the tokenless `GET https://graph.facebook.com/v25.0/instagram_oembed?url=...` endpoint (no access token), returns `{status:'AVAILABLE',html}` on a 2xx JSON body with non-empty `html`, else `{status:'UNAVAILABLE'}` for any non-2xx/malformed/missing-html/network-error/thrown-exception condition, logging via `console.error` and never throwing — verified by `adapter.test.ts`.
- ✅ AC2: Cache-first lookup via `getCachedEmbed`/`setCachedEmbed` against the new `instagram_oembed_cache` table, 24h TTL (`INSTAGRAM_OEMBED_CACHE_TTL_MS`), both `AVAILABLE` and `UNAVAILABLE` results written through — verified by `adapter.test.ts` (cache hit skips fetch, expired row triggers fresh fetch, both statuses persisted) and `cache-store.test.ts`.
- ✅ AC3: `resolveInstagramEmbedResult` (packages/domain) implements the exact 4-branch/null decision table from the AC, reusing Story 3.6h's `isImageStorageOptedIn` flag — verified by 5 unit tests (100% branch coverage) plus resolver-level integration tests.
- ✅ AC4: `instagramEmbed` is a normal GraphQL field resolver, not added to any of the 5 existing `db.select({...requestedFields, ...})` blocks — verified by a dedicated resolver test asserting the mocked `fetch` (the adapter's only external call) records zero invocations when a query omits `instagramEmbed` from its selection set.
- ✅ AC5: `instagramOembedStatusEnum`/`instagramOembedCache` defined with `drizzle-orm/pg-core` builders; migration `0049_lyrical_ultimatum.sql` produced by `drizzle-kit generate`, verified to apply cleanly against the local test DB, no manual SQL edits.
- ✅ AC6: `resolveInstagramEmbedResult.test.ts` covers all 5 branches listed in the AC (AVAILABLE; UNAVAILABLE+opted-in+durable present; UNAVAILABLE+opted-in+durable absent; UNAVAILABLE+not-opted-in; adapterResult null) — 100% branch coverage.
- Flagged as pre-existing/out-of-scope, not fixed by this story: 2 unrelated backend test failures (`process-apify-async-result tests` — a post-ordering assertion; `queryModeratorAccountProfiles - Happy Path & Search filter` — a moderator-profile query assertion). Both reproduce in isolation on unmodified code paths this story never touches; root-caused to unrelated changes merged into `master` after this story's `baseline_commit` (per the resumption note: FIND-022 co-author work, event-list pagination fixes) or pre-existing DB-state flakiness in those suites. Flagging per this workflow's persistent-facts rule rather than silently fixing out-of-scope code.
- Session-continuity note: this session was resumed after a machine restart; work in progress was intact on disk. Mid-session, a `git stash push` intended to isolate files for a baseline comparison inadvertently stashed this story's own uncommitted changes; it was immediately caught and reverted via `git stash pop`, restoring all files. Verified via `git diff` and a fresh full re-run of the story's own test scope (`@festgrid/domain test`, `instagram-oembed` adapter/cache-store tests, `instagramEmbed` resolver tests) that no work was lost.

### File List

- `packages/database/schema.ts` (modified) — added `instagramOembedStatusEnum`, `instagramOembedCache` table.
- `packages/database/migrations/0049_lyrical_ultimatum.sql` (new) — generated migration.
- `packages/database/migrations/meta/0049_snapshot.json` (new) — drizzle-kit snapshot.
- `packages/database/migrations/meta/_journal.json` (modified) — drizzle-kit journal entry for migration 0049.
- `apps/backend/src/lib/instagram-oembed/types.ts` (new) — `InstagramOEmbedAdapterResult` shared type.
- `apps/backend/src/lib/instagram-oembed/cache-store.ts` (new) — `getCachedEmbed`/`setCachedEmbed`.
- `apps/backend/src/lib/instagram-oembed/cache-store.test.ts` (new).
- `apps/backend/src/lib/instagram-oembed/adapter.ts` (new) — `resolveInstagramOEmbed`.
- `apps/backend/src/lib/instagram-oembed/adapter.test.ts` (new).
- `packages/domain/src/events/resolveInstagramEmbedResult.ts` (new) — pure branching-decision function.
- `packages/domain/src/events/resolveInstagramEmbedResult.test.ts` (new) — 5-branch unit coverage.
- `packages/domain/src/events/index.ts` (modified) — export `resolveInstagramEmbedResult`.
- `apps/backend/src/schema/events.graphql` (modified) — `InstagramEmbedStatus` enum, `InstagramEmbed` type, `Event.instagramEmbed` field.
- `apps/backend/src/schema/resolvers.ts` (modified) — `Event.instagramEmbed` field resolver + imports.
- `apps/backend/src/generated/resolvers-types.ts` (modified, generated) — regenerated via codegen.
- `apps/backend/src/schema/resolvers.test.ts` (modified) — new `Event.instagramEmbed` resolver test suite (5 tests) + `fetch` mock type-annotation fix for `tsc` compatibility.
- `_bmad-output/implementation-artifacts/3-7e-instagram-oembed-backend-integration-adapter-and-resolver-field.md` (modified) — story bookkeeping (this file).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — status tracking.

## Change Log

- 2026-09-07 (bmad-create-story): Story drafted, ready for dev.
- 2026-09-07 (bmad-dev-story): All 14 tasks implemented and verified (AC1-AC6 satisfied); domain unit tests, adapter/cache-store integration tests, and resolver integration tests all passing; root `pnpm lint`/`pnpm build` both clean; status moved to `review`. 2 pre-existing, out-of-scope backend test failures flagged (not fixed) — see Dev Agent Record → Completion Notes.
