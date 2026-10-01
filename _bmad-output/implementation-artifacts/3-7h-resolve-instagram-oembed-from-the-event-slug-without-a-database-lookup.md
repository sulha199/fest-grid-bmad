---
baseline_commit: 5a9463483283f4f5e97e3db9bd3970f29e99df30
---

# Story 3.7h: Resolve Instagram oEmbed from the event slug without a database lookup

## Story Details

- Epic: 3
- Story ID: 3.7h
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want the event-detail embed to start loading from the URL alone,
so that the detail page does not wait for the event query before the embed round trip begins.

## Acceptance Criteria

1. **Given** Architecture Spine AD-16 Rule 6, **when** a new backend `Query.instagramEmbedBySlug(slug: String!)` receives an event slug of the form `{platformSlug}_{postType}_{platformPostId}` (optionally suffixed `~{ordinal}` per Rule 9 — the ordinal is parsed out and ignored, never used), **then** it reconstructs the Instagram permalink from the slug's `platformSlug`/`postType`/`platformPostId` segments alone — **no lookup of any kind is needed for this step**, since the permalink is pure string reconstruction — and calls the existing `resolveInstagramOEmbed()` adapter (which itself consults/writes `instagramOembedCache`) unchanged; `apps/backend` remains the sole owner of the Meta call, cache and credentials.
2. **And** a legacy hex slug (`^[0-9a-f]{12}$`, no underscores), a slug whose platform segment doesn't resolve via `getPlatformSlug()`/`getPlatformByCode()`, or a slug whose platform segment resolves to a non-Instagram platform (e.g. `x_...`), all return a typed `NOT_RESOLVABLE_FROM_SLUG` result — never a guess — so the caller can fall back to the existing `Event.instagramEmbed` path (Story 3.7e).
3. **And** the existing opt-in-aware fallback rule (Stories 3.6h/3.7e, `resolveInstagramEmbedResult()`) still applies to the result: on an `AVAILABLE` adapter result, the embed `html` is returned directly with no further lookup; only on an `UNAVAILABLE` adapter result does the resolver perform one indexed lookup (`events.slug`'s existing unique index → `events.postId` → `posts`/`socialMediaAccountProfiles`) to fetch `isImageStorageOptedIn`/`durableImageUrl` and apply the same fallback decision `Event.instagramEmbed` already makes — so the common `AVAILABLE` path stays genuinely lookup-free (per the user's explicit decision below, "Lazy join"), while the rarer failure path still returns the correct, opt-in-aware fallback shape.
4. **And** the query stays correct after a primary-post change because the slug always names the primary post (AD-30/AD-16 Rule 8 amendment) — no explicit handling of ordinals/aliases is needed here; Rule 6 "reads only the id/type segments and ignores the ordinal" by construction (AC1), and Rule 11's redirect-before-render means this query is only ever invoked with a canonical slug.

## Tasks / Subtasks

- [ ] Task 1 — Pure slug-parsing helper, `packages/domain` (AC: 1, 2, 4)
  - [ ] Add `packages/domain/src/events/parse-platform-prefixed-event-slug.ts` exporting `parsePlatformPrefixedEventSlug(slug: string): ParsedPlatformPrefixedEventSlug | null`, where `ParsedPlatformPrefixedEventSlug = { platform: ScrapablePlatform; platformPostType: string; platformPostId: string }` (defined and exported from this same file, mirroring `resolveInstagramEmbedResult.ts`'s own pattern of locally-defined input/output interfaces — no change to `types.ts` needed).
  - [ ] Implementation, per AD-16 Rule 1 ("parsing splits on the first two `_` occurrences only") and Rule 9 ("split the remainder at the **last** `~`; no `~` means ordinal 0"): find the first two `_` indices. If fewer than two exist, return `null` (covers the legacy 12-char hex slug, which has no `_`, and any other malformed input). `platformSlugSegment` = text before the first `_`; `postTypeSegment` = text between the first and second `_`; `remainder` = text after the second `_`. Split `remainder` at its **last** `~` (if any) — the part before it is `platformPostId`; the ordinal suffix (if present) is parsed-and-discarded, never returned or used (AC1/AC4 — Rule 6 "ignores the ordinal" by construction, not by special-casing it later).
  - [ ] Resolve `platformSlugSegment` via `getPlatformByCode()` (`../scraper/platform-registry.js` — never a new mapping, per the project's single-source-of-truth rule). Return `null` if it doesn't resolve to a known platform.
  - [ ] Return `{ platform, platformPostType: postTypeSegment, platformPostId }` — **do not** validate `postTypeSegment` against the known `'p'|'reel'|'reels'` set here: the slug-construction side (Story 3.7g) only ever writes a value 3.7f's own regex already captured, so any value reaching this parser was either produced validly or is attacker/garbage input that `resolveInstagramOEmbed()`'s own non-2xx handling will safely turn into `UNAVAILABLE` (Meta rejects an invalid permalink path) — no separate rejection path is needed, and adding one would be unverified, defensive code against a case that can't occur from this app's own data.
  - [ ] Export from `packages/domain/src/events/index.ts` (`export * from './parse-platform-prefixed-event-slug.js';`).
  - [ ] Unit tests, `parse-platform-prefixed-event-slug.test.ts`, 100% coverage: (a) `ig_p_Cx9uWttkSN` → `{ platform: 'instagram', platformPostType: 'p', platformPostId: 'Cx9uWttkSN' }`; (b) `ig_reel_Cx9uWttkSN` → `platformPostType: 'reel'` (verbatim, not normalized); (c) a synthetic ordinal-suffixed slug `ig_p_Ddi9wU6RCRQ~2` (forward-compatible with AD-16 Rule 8/9 even though no story yet produces one) → `platformPostId: 'Ddi9wU6RCRQ'` (ordinal stripped and discarded, not part of the returned shape); (d) a `platformPostId` that itself legitimately contains `_`/`-` (e.g. `ig_p_abc_123-x`) → parses correctly since only the *first two* `_` are split points; (e) a 12-char legacy hex slug (`'a1b2c3d4e5f6'`) → `null`; (f) an unrecognized platform segment (e.g. `'tiktok_p_abc123'`) → `null`; (g) a non-Instagram recognized platform (e.g. `'x_status_123'`, since `getPlatformByCode('x')` resolves to `'twitter'`) → returns `{ platform: 'twitter', ... }` (the function itself is platform-agnostic; Task 3's resolver is what rejects non-Instagram — see that task's own test for the end-to-end `NOT_RESOLVABLE_FROM_SLUG` behavior); (h) a slug with only one `_` (malformed) → `null`.

- [ ] Task 2 — Pure permalink-reconstruction helper, `packages/domain` (AC: 1)
  - [ ] Add `packages/domain/src/scraper/build-instagram-permalink.ts` exporting `buildInstagramPermalink(platformPostType: string, platformPostId: string): string`, returning `` `https://www.instagram.com/${platformPostType}/${platformPostId}/` `` — the same canonical `www.instagram.com` + trailing-slash form already used by `resolveInstagramOEmbed`'s own test fixtures and `build-gemini-request.live-carousel.test.ts`'s real captured permalink (`https://www.instagram.com/p/DcntzF0mB7z/`). Deliberately the mirror-image of the existing `parse-platform-post-identity.ts` (which goes URL → id/type; this goes id/type → URL) — colocated in the same `packages/domain/src/scraper/` folder for discoverability, per that file's own precedent.
  - [ ] Export from `packages/domain/src/scraper/index.ts` (`export * from './build-instagram-permalink.js';`).
  - [ ] Unit tests, `build-instagram-permalink.test.ts`, 100% coverage: `('p', 'Cx9uWttkSN')` → `'https://www.instagram.com/p/Cx9uWttkSN/'`; `('reel', 'Cx9uWttkSN')` → `'https://www.instagram.com/reel/Cx9uWttkSN/'`.

- [ ] Task 3 — `Query.instagramEmbedBySlug` resolver, `apps/backend` (AC: 1, 2, 3, 4)
  - [ ] In `apps/backend/src/schema/events.graphql`, add (near the existing `InstagramEmbedStatus`/`InstagramEmbed` types, lines 1-12):
    ```graphql
    enum InstagramEmbedBySlugStatus {
      AVAILABLE
      UNAVAILABLE
      NOT_RESOLVABLE_FROM_SLUG
    }

    type InstagramEmbedBySlug {
      status: InstagramEmbedBySlugStatus!
      html: String
      durableImageUrl: String
    }
    ```
    and add `instagramEmbedBySlug(slug: String!): InstagramEmbedBySlug!` to the existing `extend type Query { ... }` block (alongside `events`/`event`/`eventBySlug`). A **new, distinct** enum/type rather than reusing `InstagramEmbedStatus`/`InstagramEmbed` — `Event.instagramEmbed` (3.7e) can never actually produce `NOT_RESOLVABLE_FROM_SLUG` (it always has a `posts` row by construction), so sharing one enum would let a theoretically-unreachable value leak into that field's type.
  - [ ] In `apps/backend/src/schema/resolvers.ts`, add `parsePlatformPrefixedEventSlug` to the existing `@festgrid/domain/events` import (same import statement as `resolveInstagramEmbedResult`, line 26) and `buildInstagramPermalink` to the existing `@festgrid/domain/scraper` import (same import statement as `detectPlatformFromUrl`, line 10).
  - [ ] Add an `instagramEmbedBySlug` resolver to the `Query: { ... }` resolver map, placed near the existing `eventBySlug` resolver (~line 3675) for discoverability:
    ```ts
    instagramEmbedBySlug: async (_: any, { slug }: { slug: string }) => {
      const parsed = parsePlatformPrefixedEventSlug(slug);
      if (!parsed || parsed.platform !== 'instagram') {
        return { status: 'NOT_RESOLVABLE_FROM_SLUG', html: null, durableImageUrl: null };
      }

      const permalink = buildInstagramPermalink(parsed.platformPostType, parsed.platformPostId);
      const adapterResult = await resolveInstagramOEmbed(permalink);

      if (adapterResult.status === 'AVAILABLE') {
        // Happy path stays lookup-free beyond the adapter's own cache check (user-confirmed
        // "Lazy join" design, Dev Notes below) -- AVAILABLE never needs the opt-in/durable
        // fallback data, so no posts/account join runs here.
        return { status: 'AVAILABLE', html: adapterResult.html, durableImageUrl: null };
      }

      // UNAVAILABLE only: now fetch the opt-in-aware fallback data via the one join this
      // story's design intentionally defers to this branch -- events.slug's existing unique
      // index keeps this a single indexed lookup, not a scan.
      const [row] = await db.select({
        durableImageUrl: posts.durableImageUrl,
        isImageStorageOptedIn: socialMediaAccountProfiles.isImageStorageOptedIn,
      }).from(events)
        .innerJoin(posts, eq(events.postId, posts.id))
        .leftJoin(socialMediaAccountProfiles, eq(posts.accountId, socialMediaAccountProfiles.id))
        .where(eq(events.slug, slug))
        .limit(1);

      const resolved = resolveInstagramEmbedResult({
        adapterResult,
        isImageStorageOptedIn: row?.isImageStorageOptedIn === true,
        durableImageUrl: row?.durableImageUrl ?? null,
      });

      return resolved ?? { status: 'UNAVAILABLE', html: null, durableImageUrl: null };
    },
    ```
    `resolveInstagramEmbedResult()` only returns `null` when its `adapterResult` input is `null` (never the case on this branch, since `adapterResult` always comes from a completed `resolveInstagramOEmbed()` call) — the `resolved ?? { ... }` fallback exists purely to satisfy the non-null `InstagramEmbedBySlug!` GraphQL return type, not because that branch is expected to be reached.
  - [ ] Run `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` so the `Resolvers` type recognizes the new `Query.instagramEmbedBySlug` field and its arguments/return shape.

- [ ] Task 4 — Integration tests, `apps/backend` (AC: 1, 2, 3, 4)
  - [ ] In `resolvers.test.ts`, add a new `t.test('Query.instagramEmbedBySlug resolver (Story 3.7h)', ...)` block, modeled directly on the existing `'Event.instagramEmbed resolver (Story 3.7e)'` block (~line 2183): same `fetchMock` mock of `globalThis.fetch`, same `seedEventWithPost({ isImageStorageOptedIn, durableImageUrl })` helper (reuse as-is — it already seeds a profile/post/event with a platform-prefixed-capable shape), same `yoga.fetch('http://yoga/graphql', ...)` harness. Seed events whose slug is the new platform-prefixed form (e.g. construct via `buildPlatformPrefixedSlug`-equivalent literal `` `ig_p_${uId}` `` directly in the test, not by relying on ingestion) so the resolver has a real `platformPostId` to round-trip through `resolveInstagramOEmbed`'s mocked `fetch`.
  - [ ] Query shape to test:
    ```graphql
    query GetInstagramEmbedBySlug($slug: String!) {
      instagramEmbedBySlug(slug: $slug) {
        status
        html
        durableImageUrl
      }
    }
    ```
  - [ ] Cases: (a) AVAILABLE → `{ status: 'AVAILABLE', html: '<blockquote>embed</blockquote>', durableImageUrl: null }`, **and assert the posts/account join was never executed** for this case (e.g. spy on `db.select` or assert via a seeded account whose `isImageStorageOptedIn`/`durableImageUrl` would produce a *different* result if the join ran — proves AC3's "lookup-free on AVAILABLE" claim, not just the output shape); (b) UNAVAILABLE + not opted-in → `{ status: 'UNAVAILABLE', html: null, durableImageUrl: null }`; (c) UNAVAILABLE + opted-in + durable URL present → `{ status: 'UNAVAILABLE', html: null, durableImageUrl: '<the durable url>' }`; (d) a legacy hex slug (seed a plain hex-slugged event, no `platformPostId`/`Type` needed) → `{ status: 'NOT_RESOLVABLE_FROM_SLUG', html: null, durableImageUrl: null }`, and assert `resolveInstagramOEmbed`'s underlying `fetch` mock was never called (mirrors the existing `'AC4 regression: query omitting instagramEmbed never invokes the adapter'` test's assertion style, ~line 2337); (e) a slug for an event whose `postId` is `null` (no linked post, e.g. after post deletion sets the FK null) but whose `slug` still happens to be well-formed (edge case exercising the UNAVAILABLE branch's `row` being absent) → `{ status: 'UNAVAILABLE', html: null, durableImageUrl: null }`, no throw.
  - [ ] Run with `TZ=UTC` after `pnpm --filter @festgrid/database seed:volume:clean`, per `cc-024-multi-event-wave-plan.md`'s "Test-gate facts learned while orchestrating Wave 2A" — the pre-existing `.env`/`system-key-adapter` and timezone-fixture failures are expected and unrelated to this story; do not chase them.

- [ ] Task 5 — No migration, no frontend change (confirm scope boundary)
  - [ ] Confirm no Drizzle schema change and no new migration are needed — this story reads existing columns (`posts.platformPostId`/`platformPostType` from 3.7f are not even read here, since the permalink comes from the slug, not from a `posts` lookup) only in its lazy UNAVAILABLE-branch fallback query, which uses only already-existing columns.
  - [ ] Confirm zero files under `apps/web/` or `packages/ui/` are touched — the new GraphQL field is unused by any frontend code until Story 3.7i wires up a consuming React Query hook. This is intentional (Gate 2 finding below) and matches 3.7g's identical precedent.

## Dev Notes

### Design decision (resolved with the user before this story was drafted)

AD-16 Rule 6's text ("reconstructs the Instagram permalink directly from the slug's `platformPostId`/`platformPostType` ... no join to posts required") only describes the **permalink-reconstruction step** — it says nothing about how the story's own additional AC3 ("the existing opt-in-aware fallback rule still applies to the result") gets its data, and that data (`posts.durableImageUrl`, `socialMediaAccountProfiles.isImageStorageOptedIn`) cannot be derived from the slug string; it only exists via an `events`→`posts`→`socialMediaAccountProfiles` join. Two designs were possible: (A) **Lazy join** — attempt the oEmbed call fully slug-derived/lookup-free first, and run the join only on the rarer `UNAVAILABLE` branch, where the fallback data is actually needed; or (B) **Eager join** — always run the join up front (mirroring `Event.instagramEmbed`'s existing shape exactly), regardless of whether the embed turns out to be `AVAILABLE` (in which case the fetched fallback data is simply discarded).

**The user chose (A), Lazy join.** Rationale: it keeps the common-case (`AVAILABLE`) path genuinely lookup-free beyond `resolveInstagramOEmbed`'s own cache check — which is the entire stated purpose of this story (its title, AD-16 Rule 6's "DB-free" framing, and the Related Events Area's own precedent at `EXPERIENCE.md` line 379 of "never gates primary content on a secondary lookup") — while still producing the fully-correct, opt-in-aware fallback shape on the `UNAVAILABLE` path, where the extra lookup's latency is immaterial (the embed has already failed). Option (B) was rejected as strictly worse along every dimension that matters here: it pays a join on every single call including the majority `AVAILABLE` case where the fetched data is thrown away, for no correctness benefit over (A). Do not revisit this without re-reading this note; Task 3 implements (A) only.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency):** Not re-run per-story. Cited from `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (batch-scoped sweep over this epic's CC-024 stories, `swept: true`, 2026-10-01), whose per-story verdict table lists **3.7h: READY — "AD-16 Rule 6 fully specifies it; legacy-slug fallback AC present."** No prerequisite story was raised against 3.7h, and the report's Gate 1 section explicitly confirms "3.7h/3.7i's DB-free oEmbed resolution stays backend-owned per AD-16 Rule 6 — `apps/web` never calls Meta directly." Lightweight escape-hatch check performed during this story's drafting: this story's actual implementation needs (a new pure slug-parse helper, a new pure permalink-builder, a new top-level GraphQL query resolver with a conditional/lazy join) are implementation-level choices within the scope the sweep already covered (the existing `posts`/`events`/Instagram-oEmbed machinery) — not a new external service, new data entity, or new infra dependency the sweep didn't anticipate. No fresh Gate 1/3 run was triggered.
- **Gate 2 (UI Complexity & Reusability):** Run fresh for this story (one-shot analytical pass, Freya/Sally lens, since Gate 2 stays per-story even when Gate 1/3 are sourced from the batch report). Verdict: **No gap found** — this story touches zero files under `apps/web/` or `packages/ui/`, introduces no new component, hook, or client-visible state; the new GraphQL field is inert until Story 3.7i (explicitly out of scope here — see Out of Scope) wires up a consuming React Query hook and `InstagramEmbed.tsx`'s already-built (3.7d) state machine. Cross-checked against `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s own "Multi-Event Posts and Cross-Post Event Matching (CC-024)" section, which names only Stories 3.6u/3.6w/3.6x as carrying this initiative's UI surface — 3.7h is not among them. Mirrors Story 3.7g's identical precedent exactly (a backend-only identifier/resolution change feeding an existing, unmodified UI surface carries no reusability or complexity risk for this story to absorb).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. This story adds one new GraphQL `Query` field, one new GraphQL enum, and one new GraphQL type — all newly introduced, so there is no existing contract to drift out of alignment with. It reads only already-existing, already-correctly-typed DB columns (`events.slug`, `events.postId`, `posts.durableImageUrl`, `socialMediaAccountProfiles.isImageStorageOptedIn`) in its lazy fallback-only query path.
- **Impacted fields/contracts:** New GraphQL: `InstagramEmbedBySlugStatus` enum (`AVAILABLE`/`UNAVAILABLE`/`NOT_RESOLVABLE_FROM_SLUG`), `InstagramEmbedBySlug` type (`status!`, `html`, `durableImageUrl`), `Query.instagramEmbedBySlug(slug: String!): InstagramEmbedBySlug!`. No existing GraphQL field's shape changes.
- **Required DB migration changes:** None. No `schema.ts` edit of any kind — this story only reads existing columns.
- **Required TypeScript type changes:** `packages/domain/src/events/parse-platform-prefixed-event-slug.ts` (new, exports `ParsedPlatformPrefixedEventSlug` + `parsePlatformPrefixedEventSlug()`); `packages/domain/src/scraper/build-instagram-permalink.ts` (new, exports `buildInstagramPermalink()`); `apps/backend/src/generated/resolvers-types.ts` regenerated via `pnpm --filter backend codegen` (Task 3) to add the new `Query.instagramEmbedBySlug` resolver signature — not hand-edited.
- **Backward compatibility and rollout notes:** Additive only — a new, independent GraphQL field with no caller yet (Story 3.7i adds the first consumer). No deploy-ordering hazard: this story can ship and sit unused with zero behavior change to any existing query, event, or page. The one real-world input this resolver must handle correctly from day one is the **entire current population of legacy hex-slugged events** (every event in the database today, since Stories 3.7f/3.7g only affect *newly-ingested* events going forward, no backfill) — AC2/Task 4 case (d) explicitly covers this as the overwhelmingly common case in production until new platform-prefixed-slug events accumulate.
- **Verification checks:** Task 1/Task 2's unit tests (100% coverage of the parse/build helpers, including the legacy-hex, malformed, non-Instagram-platform, and ordinal-suffixed edge cases) and Task 4's integration tests (real DB round trip through the actual GraphQL resolver, proving both the AVAILABLE lookup-free path and the UNAVAILABLE fallback-join path produce the correct typed shape) prove end-to-end alignment.

### Project Structure Notes

- `packages/domain/src/events/parse-platform-prefixed-event-slug.ts` (new) and `packages/domain/src/scraper/build-instagram-permalink.ts` (new) — both pure, DB/ORM/Node-dependency-free functions (take/return plain strings and plain objects; no `@festgrid/database` import, no Node-only module), correctly placed in `packages/domain` per project-context.md's Code Organization rule (also imported by `apps/web` today, though neither new function has an `apps/web` consumer yet — Story 3.7i will be the first).
  - **Why `parse-platform-prefixed-event-slug.ts` lives in `events/`, not `scraper/`:** it parses an **event slug** (an `events`-table concept, the reverse of `events/build-event-insert-values.ts`'s slug-construction logic) — not a scraped post URL. `build-instagram-permalink.ts` lives in `scraper/` instead because it is the mirror-image of `scraper/parse-platform-post-identity.ts` (URL ↔ id/type), a scraper/platform concern, not an event-entity concern. Neither is a generic cross-entity mechanism (both are specific to the Instagram-permalink/event-slug domain), so neither warrants a `packages/domain/src/query/`-style generic subfolder.
- `apps/backend/src/schema/resolvers.ts` and `events.graphql` — both already exist; only additive changes (new imports, new resolver map entry, new schema types), no restructuring.
- No new files are created under `apps/web/` or `packages/ui/` by this story (Gate 2 finding above).
- **Reusable UI component (packages/ui) / cloud or external service setup (SETUP_WALKTHROUGH.md) / analytics (AD-5) / i18n (AD-6) / AD-1/AD-2 Unified Query DSL / state management or loader categorization:** None apply — no UI surface, no new cloud/external service (the existing tokenless Meta oEmbed endpoint and its existing adapter/cache are reused unchanged), no tracked user interaction, no user-facing string, and this story does not retrieve an *event collection* by a new condition (it's a single-slug lookup, not a list query — AD-1/AD-2's Unified Query DSL governs `Query.events`-style collection filtering, which this is not).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7h: Resolve Instagram oEmbed from the event slug without a database lookup] (lines 3579-3592)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7g: Build platform-prefixed event slugs at ingestion] (lines 3563-3577) — prerequisite, done (commit `04c94a42`)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7e: Instagram oEmbed backend integration — adapter and resolver field] (lines 3529-3544) — the existing `Event.instagramEmbed`/`resolveInstagramEmbedResult`/opt-in-fallback machinery this story reuses unchanged
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-16: Platform-Prefixed Event Slugs & Parallel oEmbed Resolution] (lines 496-627), specifically Rule 6 (DB-free oEmbed resolution) and the 2026-10-01 amendment's Rules 8-9 (ordinal suffix shape/parse) and Rule 11 (redirect-before-render guarantees a canonical slug reaches this query)
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 batch sweep, 3.7h verdict: READY
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Multi-Event Posts and Cross-Post Event Matching (CC-024)] (lines 373-390) — confirms this initiative's UI surface is delivered by 3.6u/3.6w/3.6x, not 3.7h
- [Source: apps/backend/src/lib/instagram-oembed/adapter.ts], [Source: apps/backend/src/lib/instagram-oembed/cache-store.ts], [Source: apps/backend/src/lib/instagram-oembed/types.ts] — the unchanged `resolveInstagramOEmbed()`/`instagramOembedCache` this story calls
- [Source: packages/domain/src/events/resolveInstagramEmbedResult.ts] — the unchanged opt-in-aware fallback function this story reuses
- [Source: packages/domain/src/scraper/parse-platform-post-identity.ts], [Source: packages/domain/src/scraper/platform-registry.ts] — precedent/reused `getPlatformByCode()`, and the mirror-image URL→id/type parser this story's `build-instagram-permalink.ts` reverses
- [Source: packages/domain/src/events/build-event-insert-values.ts] lines 77-88 (`buildPlatformPrefixedSlug` — the slug *construction* logic this story's parser reverses)
- [Source: apps/backend/src/schema/events.graphql] lines 1-12 (`InstagramEmbedStatus`/`InstagramEmbed`), lines 146-150 (`extend type Query`)
- [Source: apps/backend/src/schema/resolvers.ts] lines 1-40 (import conventions), lines 3675-3680 (`eventBySlug` resolver, placement precedent), lines 4107-4118 (`Event.instagramEmbed` field resolver — the pattern this story's lazy-join branch mirrors), lines 340-378 of `packages/database/schema.ts` (`events` table — confirms no denormalized `durableImageUrl`/`isImageStorageOptedIn` exists there, which is why the fallback branch must join through `posts`/`socialMediaAccountProfiles`)
- [Source: apps/backend/src/schema/resolvers.test.ts] lines 2183-2337 (`'Event.instagramEmbed resolver (Story 3.7e)'` test block — the harness/fixture pattern Task 4 models its new test block on)
- [Source: _bmad-output/project-context.md#Code Organization (Domain vs UI)]

## Global Rules References

- [x] project-context.md — Code Organization (Domain vs UI, incl. the DB/ORM/Node-dependency restriction)
- [x] story-content-structure.md — canonical section order followed
- [x] architecture spine — AD-16 (Rule 6; Rules 8-9/11 for ordinal/redirect correctness)
- [x] infrastructure docs — no infra/topology change (reuses the existing Instagram-oEmbed adapter/cache, no new queue/lambda/IaC)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/domain/src/events/parse-platform-prefixed-event-slug.ts` — new; `ParsedPlatformPrefixedEventSlug` + `parsePlatformPrefixedEventSlug()`.
  - `packages/domain/src/events/parse-platform-prefixed-event-slug.test.ts` — new; 8 cases (Task 1).
  - `packages/domain/src/events/index.ts` — add one export line.
  - `packages/domain/src/scraper/build-instagram-permalink.ts` — new; `buildInstagramPermalink()`.
  - `packages/domain/src/scraper/build-instagram-permalink.test.ts` — new; 2 cases (Task 2).
  - `packages/domain/src/scraper/index.ts` — add one export line.
  - `apps/backend/src/schema/events.graphql` — add `InstagramEmbedBySlugStatus` enum, `InstagramEmbedBySlug` type, `Query.instagramEmbedBySlug` field.
  - `apps/backend/src/schema/resolvers.ts` — add 2 imports; add `instagramEmbedBySlug` to the `Query` resolver map.
  - `apps/backend/src/generated/resolvers-types.ts` — regenerated via `pnpm --filter backend codegen` (not hand-edited).
  - `apps/backend/src/schema/resolvers.test.ts` — add a new test block, 5 cases (Task 4).
- **Rule Mapping:**
  - AD-16 Rule 6 → Task 1 (parse) + Task 2 (permalink) + Task 3's `AVAILABLE` branch (lookup-free).
  - AD-16 Rule 9 (ordinal parse) → Task 1's last-`~`-split logic and its synthetic ordinal-suffixed test case.
  - AD-16 Rule 2 (legacy hex fallback, "never a guessed value") → Task 1's `null`-on-unparseable/unrecognized-platform behavior; Task 3's `NOT_RESOLVABLE_FROM_SLUG` branch.
  - Stories 3.6h/3.7e's opt-in-aware fallback rule → Task 3's `UNAVAILABLE` branch, reusing `resolveInstagramEmbedResult()` unchanged (Dev Notes "Design decision," Lazy join).
  - project-context.md Code Organization (no DB/ORM/Node deps in `packages/domain`) → Tasks 1/2's pure-function design.
  - project-context.md's platform-registry single-source-of-truth rule → Task 1 calls `getPlatformByCode()`, never a new mapping.
  - Testing Rules (100% domain coverage; testing-trophy for `apps/*`) → Tasks 1/2/4.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — all existing + new cases in `parse-platform-prefixed-event-slug.test.ts`/`build-instagram-permalink.test.ts` pass, 100% coverage of new code.
  - `pnpm --filter backend codegen` — confirm it regenerates `resolvers-types.ts` with no manual edits needed, and `tsc` is clean against the updated `Resolvers` type.
  - `pnpm --filter backend test` (or the repo's run-check equivalent) with `TZ=UTC` and the volume seed cleaned first — `resolvers.test.ts`'s new `instagramEmbedBySlug` block passes; the pre-existing, unrelated `TZ`/`.env` failures noted in `cc-024-multi-event-wave-plan.md` are expected and not this story's regression.
  - `pnpm --filter backend lint` / `pnpm --filter @festgrid/domain lint` / relevant `tsc` build — touched packages type-check and lint clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — builds only the backend `Query.instagramEmbedBySlug` resolver and its two pure domain helpers; no frontend consumer (Story 3.7i), no ordinal-suffix generation (Story 3.6t), no alias/redirect logic (Story 3.6v).
- [ ] Architecture and boundary confirmation — `packages/domain` stays DB/ORM/Node-dependency-free; the lazy-join design (Dev Notes) keeps the `AVAILABLE` path lookup-free, with the opt-in-aware join confined to the `UNAVAILABLE` branch only.
- [ ] Testing plan confirmation — Tasks 1/2/4 cover unit (100% domain, incl. legacy-hex/malformed/non-Instagram/ordinal-suffixed edge cases) and integration (real-DB, both resolver branches) coverage.
- [ ] Explicit human approval state — **pending approval.** The one real design choice this story required (Lazy join vs. Eager join for the opt-in-aware fallback data) was surfaced to the user via `AskUserQuestion` during drafting; the user selected **Lazy join** (recommended option). No other open question remains.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the CC-024 batch readiness report (no gap); Gate 2 run fresh this story (no gap); no prerequisite story needed. Prerequisites 3.7f (done, commit `90dae6d9`) and 3.7g (done, commit `04c94a42`) and 3.7e (done — `Event.instagramEmbed`/`resolveInstagramEmbedResult` already shipped) are all complete.

## Testing Requirements

- [ ] Unit tests (`packages/domain`, `tsx --test`, 100% coverage) — Tasks 1/2.
- [ ] Integration tests (`apps/backend`, `tsx --test` against the real local Postgres) — Task 4.
- [ ] E2E tests — N/A. No UI/user-facing flow changes; the new GraphQL field has no consumer until Story 3.7i, which is where any E2E coverage of the actual embed-loading behavior belongs.

## Deliverables Checklist

- [ ] `parsePlatformPrefixedEventSlug()` correctly parses the platform-prefixed slug shape (incl. ordinal-suffix stripping) and returns `null` for legacy-hex/malformed/unrecognized-platform input.
- [ ] `buildInstagramPermalink()` reconstructs the canonical Instagram permalink from `platformPostType`/`platformPostId`.
- [ ] `Query.instagramEmbedBySlug` resolver: `AVAILABLE` path is lookup-free beyond the adapter's own cache; `UNAVAILABLE` path performs the lazy fallback join and applies `resolveInstagramEmbedResult()` unchanged; non-Instagram-resolvable slugs return `NOT_RESOLVABLE_FROM_SLUG` with the adapter never invoked.
- [ ] `events.graphql` schema additions (`InstagramEmbedBySlugStatus`, `InstagramEmbedBySlug`, `Query.instagramEmbedBySlug`) and regenerated `resolvers-types.ts`.
- [ ] All new domain unit tests (100% coverage) and backend integration tests pass.
- [ ] Lint and type checks passing for `packages/domain` and `apps/backend`.

## Out of Scope

- Any frontend consumer of `Query.instagramEmbedBySlug` — the React Query hook, stripping `instagramEmbed` out of `getEventBySlug.graphql`, and `InstagramEmbed.tsx`'s wiring to the new hook (AD-16 Rule 7) — Story 3.7i.
- Generating the `~{ordinal}` slug suffix itself — Story 3.6t.
- Re-slugging on a primary-post change and the `event_slug_aliases` redirect table/resolution order (AD-16 Rules 10-11, AD-30) — Story 3.6v.
- Any multi-event/multi-post schema (`event_posts`, `extraction_ordinal`) — Story 3.6r.
- Validating or restricting `platformPostType` to a known enum of values inside the parser (Task 1) — deliberately deferred to Meta's own oEmbed response (see Task 1's rationale).

## Definition of Done

- [ ] AC1-AC4 satisfied.
- [ ] Required tests passing (Tasks 1/2/4; Testing Requirements above).
- [ ] Lint and type checks passing for `packages/domain` and `apps/backend`.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
