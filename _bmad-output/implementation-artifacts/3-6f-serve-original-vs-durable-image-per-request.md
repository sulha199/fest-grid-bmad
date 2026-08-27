---
baseline_commit: 2d7e80201bdbf6d78750624540285f5787310ba5
---

# Story 3.6f: Serve original vs. durable image per request

## Story Details

- Epic: 3
- Story ID: 3.6f
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want an event's image to keep loading correctly whether Instagram's original CDN link is still fresh or has already expired,
so that I never see a broken image on an event, while the product still gets the benefit of serving the (often faster, always free-to-us) original link during its valid window.

## Acceptance Criteria

1. **Given** an `Event` whose backing post has `imageUrl` set and `imageUrlExpiresAt` in the future relative to the request time, **when** any resolver that returns `Event.imageUrl` executes, **then** it serves `posts.imageUrl` (the original), regardless of whether `durableImageUrl` is populated.
2. **Given** an `Event` whose backing post has `imageUrlExpiresAt` in the past (or exactly equal to now) relative to the request time, **and** `durableImageUrl` is populated, **when** `Event.imageUrl` resolves, **then** it serves `posts.durableImageUrl`, not the (expired) original.
3. **Given** an `Event` whose backing post has `imageUrlExpiresAt` in the past, or `null` (unparseable/never parsed), **and** `durableImageUrl` is `null` (not yet re-hosted, or never extracted), **when** `Event.imageUrl` resolves, **then** it serves `posts.imageUrl` anyway (a maybe-stale link beats no link — AD-12 Rule 3's explicit fallback-of-last-resort).
4. **Given** an `Event` whose backing post has `imageUrlExpiresAt` set to `null`, **when** `Event.imageUrl` resolves, **then** `null` expiry is treated as "already expired" — the resolver goes straight to the durable-or-original-fallback branch (rules 2/3 above), never serving the original on the theory that a missing expiry means "valid indefinitely."
5. **Given** an `Event` whose backing post has no image at all (`imageUrl` is `null`), **when** `Event.imageUrl` resolves, **then** it returns `null` without throwing (no image, nothing to serve; `durableImageUrl` is also expected `null` in this case per AD-12 Rule 4, but the resolver must not assume that and must not crash if it somehow isn't).
6. **Given** this logic, **when** applied, **then** it is applied consistently at every resolver call site that currently selects `posts.imageUrl` for an `Event` (`restoreEvent` mutation, `events` list query, `event(id)` query, `eventBySlug` query, `Report.event` field resolver — the same 5 sites Story 3.3c's `videoUrl` plumbing touched) — each site's underlying `select` gains `durableImageUrl: posts.durableImageUrl` and `imageUrlExpiresAt: posts.imageUrlExpiresAt` alongside its existing `imageUrl: posts.imageUrl`, and the shared `Event.imageUrl` field resolver (not each call site individually) performs the computation.
7. **Given** the GraphQL schema, **when** this story ships, **then** `Event` gains a new nullable field `durableImageUrl: String`, resolved directly from `posts.durableImageUrl` (no computation — the raw column value), so the frontend can retry it independently of whatever `imageUrl` served.
8. **Given** `apps/web`'s `getEventBySlug` query and `mapper.ts`, **when** this story ships, **then** `durableImageUrl` is added to the query, codegen is regenerated, and `mapGraphQLEventToDetailViewProps` maps `event.durableImageUrl` into the `imageFallbackUrl` prop that `EventDetailView`/`EventImage` have accepted (and left wired to `undefined`) since Story 1.6a — proven by a test asserting that when the served `imageUrl` fails to load, the browser retries `durableImageUrl` via the existing `onError` handler.
9. **Given** `videoUrl` and its rendering path, **when** this story ships, **then** neither is touched — this story is scoped exclusively to the image original-vs-durable switch (AD-12 Rule 3), not video (AD-12 Rule 4 — video stays ephemeral, already fully wired by Waves 1-2).

## Tasks / Subtasks

- [x] **Task 1: `resolveServedImageUrl` pure function** (AC: 1, 2, 3, 4, 5) — `packages/domain/src/events/`
  - [x] Create `packages/domain/src/events/resolveServedImageUrl.ts`, matching the existing `now`-injectable object-param style already used by `getCancelledReportWindowCutoff.ts`/`shouldSoftDeleteFromCancelledReports.ts` in this same folder (not `parse-image-url-expiry.ts`'s positional-args style — that one takes 2 simple args, this one takes 3 nullable inputs + an optional clock, which is exactly the shape the `events/` folder's existing `now`-default convention was built for):
    ```ts
    export interface ResolveServedImageUrlInput {
      imageUrl: string | null | undefined;
      durableImageUrl: string | null | undefined;
      imageUrlExpiresAt: Date | null | undefined;
      now?: Date;
    }

    export function resolveServedImageUrl({
      imageUrl,
      durableImageUrl,
      imageUrlExpiresAt,
      now = new Date(),
    }: ResolveServedImageUrlInput): string | null {
      const isOriginalStillValid = imageUrlExpiresAt != null && now < imageUrlExpiresAt;
      if (isOriginalStillValid && imageUrl) {
        return imageUrl;
      }
      return durableImageUrl || imageUrl || null;
    }
    ```
  - [x] Zero DB/Node-runtime dependencies — plain `Date` comparisons only, matching `packages/domain`'s frontend-safety constraint (even though the only current caller is backend-only, same posture as `parseImageUrlExpiry`).
  - [x] Add `packages/domain/src/events/resolveServedImageUrl.test.ts` with 100% coverage, covering at minimum: (a) valid original + durable present → serves original (AC1); (b) expired original + durable present → serves durable (AC2); (c) expired original + durable `null` → serves original anyway (AC3); (d) `imageUrlExpiresAt` is `null` + durable present → serves durable, i.e. null-expiry is NOT treated as valid-indefinitely (AC4); (e) `imageUrlExpiresAt` is `null` + durable `null` → serves original anyway (AC3+AC4 combined); (f) `imageUrl` is `null` + durable `null` → returns `null` (AC5); (g) `imageUrl` is `null` + durable present (defensive/unexpected-shape case) → still returns durable, doesn't throw; (h) `now` exactly equal to `imageUrlExpiresAt` → treated as expired (`now < imageUrlExpiresAt` is strict, matching AC2's "in the past **or exactly equal to now**" wording).
  - [x] Export it from `packages/domain/src/events/index.ts` (existing barrel — add `export * from './resolveServedImageUrl.js';` alongside the existing exports).

- [x] **Task 2: GraphQL schema — `Event.durableImageUrl`** (AC: 7) — `apps/backend/src/schema/events.graphql`
  - [x] In the `Event` type, immediately after the existing `imageUrl: String` line (and before `videoUrl: String`, or after it — either ordering is fine, match whichever reads more naturally alongside the existing `imageUrl`/`videoUrl` pair), add:
    ```graphql
    durableImageUrl: String
    ```

- [x] **Task 3: Wire `durableImageUrl`/`imageUrlExpiresAt` into all 5 resolver select sites, compute `imageUrl` via the shared field resolver** (AC: 1-7) — `apps/backend/src/schema/resolvers.ts`
  - [x] At each of the 5 `select({ ...requestedFields, ..., imageUrl: posts.imageUrl, videoUrl: posts.videoUrl, ... })` call sites (grep `imageUrl: posts.imageUrl,` to find all 5 — currently at approximately lines 1420 (`restoreEvent` mutation), 2557 (`events` list query), 2674 (`event(id)` query), 2751 (`eventBySlug` query), 2933 (`Report.event` field resolver)), add two lines immediately after `imageUrl: posts.imageUrl,`:
    ```ts
    durableImageUrl: posts.durableImageUrl,
    imageUrlExpiresAt: posts.imageUrlExpiresAt,
    ```
  - [x] Import `resolveServedImageUrl` from `@festgrid/domain/events` (matching this file's existing `@festgrid/domain/events` import at the top, which already pulls in `mapExtractionPayloadToProposedCorrection`/`buildDefaultEventVisibilityConditions`/etc. — add `resolveServedImageUrl` to that same import line's named-import list rather than adding a second import from the same module).
  - [x] In the `Event: { ... }` resolver map, replace the existing `imageUrl: (parent: any) => parent.imageUrl || null,` with a computed version:
    ```ts
    imageUrl: (parent: any) => resolveServedImageUrl({
      imageUrl: parent.imageUrl,
      durableImageUrl: parent.durableImageUrl,
      imageUrlExpiresAt: parent.imageUrlExpiresAt,
    }),
    durableImageUrl: (parent: any) => parent.durableImageUrl || null,
    ```
    (letting `resolveServedImageUrl`'s own `now = new Date()` default supply the request-time clock — do not thread a `now` through the resolver call; the injectable-`now` param exists purely for the pure function's own unit tests.)
  - [x] Do **not** touch the `videoUrl: (parent: any) => parent.videoUrl || null,` line or any of the 5 `videoUrl: posts.videoUrl,` select entries already present — those are Story 3.3c's, out of scope here (AC9).
  - [x] `buildOptimizedDrizzleSelect(events, info)`'s spread (`...requestedFields`) is unaffected — it only inspects the `events` table/GraphQL selection set for optimization hints and has no `durableImageUrl`/`imageUrlExpiresAt` keys of its own to conflict with (those live only on `posts`); the explicit `durableImageUrl`/`imageUrlExpiresAt` keys added above simply extend the same explicit-override pattern `imageUrl`/`videoUrl`/`sourcePostUrl`/`originalPostUrl` already use at every one of these 5 sites.

- [x] **Task 4: Regenerate backend GraphQL codegen** (AC: 7) — `apps/backend`
  - [x] Run `pnpm --filter backend codegen` (or the equivalent script name confirmed in `apps/backend/package.json`) to regenerate `apps/backend/src/generated/resolvers-types.ts` with the new `durableImageUrl` field on `Event`/`EventResolvers`, matching how `videoUrl` appears there today (lines ~203, ~1417). Commit the regenerated file.

- [x] **Task 5: `apps/web` query + mapper wiring** (AC: 8) — `apps/web/src/features/events/queries.graphql`, `mapper.ts`
  - [x] In `getEventBySlug`'s selection set, add `durableImageUrl` immediately after the existing `imageUrl` line (before `videoUrl`, matching Task 2's schema ordering choice for consistency).
  - [x] Run `pnpm --filter web codegen` (per `apps/web/package.json`'s `codegen` script, which also runs `fix-codegen.js` afterward — do not skip that step) to regenerate `apps/web/src/generated/graphql.ts` with `durableImageUrl` added to `GetEventBySlugQuery`'s shape. Commit the regenerated file.
  - [x] In `mapper.ts`'s `mapGraphQLEventToDetailViewProps`, add one line immediately after the existing `imageUrl: event.imageUrl,`:
    ```ts
    imageFallbackUrl: event.durableImageUrl,
    ```
    (the prop name is `imageFallbackUrl`, not `durableImageUrl` — confirmed from `EventDetailViewProps`/`EventImageProps` in `packages/ui/src/features/events/EventDetailView.types.ts:74` and `EventImage.tsx:12`, both already accepting `imageFallbackUrl?: string | null` since Story 1.6a; do not rename either side to match).
  - [x] Do **not** touch the `videoUrl: event.videoUrl,`/`videoAlt: event.eventName,` lines already present in `mapper.ts` — Story 1.6's, out of scope here (AC9).

- [x] **Task 6: Tests** (AC: all)
  - [x] `packages/domain/src/events/resolveServedImageUrl.test.ts` — Task 1's 8 cases, 100% coverage.
  - [x] `apps/backend/src/schema/resolvers.test.ts` (existing file, extend near the existing `eventBySlug - fetch single event by slug with schedules` test, ~line 298) — add `durableImageUrl` to that test's query selection and assert it resolves (even if `null` for existing seed data, following the exact precedent the `videoUrl` assertion at line 341 already set: `assert.strictEqual(result.data.eventBySlug.videoUrl, null, ...)`). Because this project's resolver integration tests run against seeded Postgres data rather than fabricated rows (see the file's existing structure), the three-way branch itself (valid-original / expired-with-durable / expired-without-durable) is **not** re-proven at the integration level here — it is already 100%-unit-tested by Task 1's pure function, and the resolver wiring is proven end-to-end simply by confirming `durableImageUrl` resolves through GraphQL without error. If a seeded row happens to already carry non-null `durableImageUrl`/`imageUrlExpiresAt`/expired data, additionally assert `imageUrl` matches what `resolveServedImageUrl` would compute for that row's actual column values (call the same domain function in the test to compute the expected value — do not hardcode) so the wiring, not just presence, is checked when the data allows it.
  - [x] `apps/web/src/features/events/EventDetailWrapper.test.tsx` (existing file, extend `currentMockEvent`/both mock-event object literals with `durableImageUrl: null as string | null` alongside the existing `videoUrl: null as string | null`, matching Story 1.6's precedent for adding `videoUrl` at lines 85/231) — add a new test proving the wrapper→mapper→`EventDetailView`→`EventImage` chain actually threads `durableImageUrl` into `imageFallbackUrl`: set `currentMockEvent.imageUrl` and `currentMockEvent.durableImageUrl` to two different URLs, render, `fireEvent.error` on the rendered `<img>` (same technique `packages/ui/src/features/events/EventDetailView.test.tsx`'s existing `'image fallback URL retry on image load failure'` test already uses at the component level), and assert the `<img>`'s `src` swaps to the `durableImageUrl` value — this is what actually proves *this* story's wiring, distinct from Story 1.6a's already-existing lower-level `EventDetailView.test.tsx` coverage of the retry mechanism itself.
  - [x] Full verification: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` (100% coverage maintained); `pnpm --filter backend test`; `pnpm --filter web test`; `pnpm build`, `pnpm lint`, `pnpm test` (root, full suite, no regressions); confirm both regenerated codegen files (`apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts`) are committed.

## Dev Notes

This story is Track A / Wave 3 (final wave) of `sprint-change-proposal-2026-08-25-video-priority-display.md` — it closes out AD-12 entirely and closes out the whole sprint change proposal (both Track A and Track B are complete once this merges). It depends only on Story 3.6e (`posts.durableImageUrl`/`posts.imageUrlExpiresAt` columns, already merged to `master`, commit `610cd9b`) and follows the exact resolver-plumbing pattern Story 3.3c already established for `videoUrl` — read `git show 5ace981` (or `git diff 3952c79 5ace981 -- apps/backend/src/schema/events.graphql apps/backend/src/schema/resolvers.ts`) directly before starting; this story is structurally the same shape (new nullable `Event` field, flattened across the same 5 select sites, plus a field resolver), the only real difference being that `imageUrl`'s field resolver now computes a value instead of just passing one through.

**Already-shipped work this story reuses, verified by direct read (do not rebuild):**
- `packages/database/schema.ts`: `posts.durableImageUrl` (text, nullable) and `posts.imageUrlExpiresAt` (timestamptz, nullable) already exist (Story 3.6e). Never written to by this story — this story only reads them.
- `packages/domain/src/scraper/parse-image-url-expiry.ts`: the *parsing* half of AD-12 Rule 3 (raw URL → `Date | null`), already done and already wired into `persistScrapedPost` (Story 3.6e). This story does not call it directly — it consumes its *result* (`posts.imageUrlExpiresAt`, already parsed and stored) via the new `resolveServedImageUrl` *comparison* function. The two functions are complementary, not overlapping: one parses at write time, the other compares at read time, exactly per AD-12 Rule 3's "parsed at write time... The Event resolver then serves..." split.
- `apps/backend/src/schema/resolvers.ts`'s 5 `imageUrl: posts.imageUrl,` select sites and the `Event.imageUrl`/`Event.videoUrl` field resolvers (Story 3.3c) — the exact call sites and pattern this story extends.
- `packages/ui/src/features/events/EventImage.tsx`/`EventDetailView.types.ts`: `imageFallbackUrl` prop and its `onError`-retry state machine (Story 1.6a) — fully built, this story only supplies real data to it. Do not modify `EventImage.tsx`'s retry logic itself.
- `apps/web/src/features/events/mapper.ts`: `videoUrl`/`imageUrl` mapping (Story 1.6) — the file this story adds one more line to, following the identical one-line-per-field pattern.

### Architecture & UX Gate Findings

- Epic 3's swept readiness report (`_bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md`, `swept: true`, dated 2026-08-09) does not cover this story (`stories_covered` ends before any `3.6*` letter suffix) — per `story-split-gate.md`'s epic-level-sweep-mode lightweight guard, the same precedent Stories 3.6a/3.6c/3.6d/3.6e each followed, gates were reasoned fresh rather than cited from the sweep.
- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** No new infrastructure of any kind — no new bucket, queue, Lambda, or external service. This story is pure application-layer wiring (a GraphQL field, a resolver computation, a pure comparison function, two lines each in a query file and a mapper) reusing infrastructure and data columns Story 0.33/3.6e already provisioned.
- **Gate 2 (UI Complexity & Reusability) — No gap found.** Zero new UI components, zero new interaction patterns. `EventImage`'s `onError`-retry mechanism already exists in full (Story 1.6a) and was purpose-built for exactly this story to eventually supply real data to (its own dev notes said so explicitly). This story's entire frontend footprint is two one-line additions (a query field, a mapper field) — not dispatched as a full persona subagent given the unambiguous absence of any new UI surface.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** The one reusable piece this story introduces (`resolveServedImageUrl`) is placed in `packages/domain/src/events/`, the same folder as its closest siblings in shape (`getCancelledReportWindowCutoff`/`shouldSoftDeleteFromCancelledReports`, both pure, both take an injectable `now`), matching project-context.md's "complex business logic lives in `packages/domain`, 100% unit tested" rule directly rather than leaving the branch inline in `resolvers.ts` untested at the unit level.

### Design Decision: Where the Computation Lives (Domain Package, Not Inline in the Resolver)

AD-12 Rule 3's three-way branch (original-if-valid / durable-if-present / original-as-last-resort, with null-expiry-as-expired) is genuine conditional business logic, not a trivial pass-through — project-context.md's Unit Test Requirement ("All logic exported from `packages/domain` must have 100% unit test coverage... the *only* place where unit tests should be written") makes this the correct home rather than writing it inline in `resolvers.ts` (which the testing-trophy philosophy would only integration-test, and only against whatever expiry states happen to already exist in seeded test data — insufficient to prove the null-expiry-treated-as-expired edge case deterministically). This mirrors `parseImageUrlExpiry`'s own placement precedent from the immediately-preceding story.

### Design Decision: `now` Sourced Inside the Field Resolver, Not Threaded From the Query Layer

`resolveServedImageUrl` accepts an optional `now` purely so its own unit tests can pin the clock deterministically (matching `getCancelledReportWindowCutoff`'s existing convention in the same folder). The `Event.imageUrl` field resolver itself does not pass `now` — it lets the function's own `now = new Date()` default supply the real request-time clock. This is correct per AD-12 Rule 3's "computed per request": each GraphQL request re-invokes the field resolver fresh, so `new Date()` at resolution time is already "the current time this request is being served," with no need to plumb a request-scoped clock through `context` for a value this cheap to compute per-call.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no DB migration needed (Story 3.6e already added the columns this story only reads). One new GraphQL field (additive), one new `packages/domain` export (additive), no `packages/shared-types` change.**
- **Impacted fields/contracts:**
  - `apps/backend/src/schema/events.graphql`: `Event.durableImageUrl: String` — new, nullable, additive.
  - `apps/backend/src/generated/resolvers-types.ts`: regenerated to include `durableImageUrl` on `Event`/`EventResolvers` — additive, mechanical (codegen output, not hand-edited).
  - `apps/web/src/generated/graphql.ts`: regenerated to include `durableImageUrl` on `GetEventBySlugQuery` — additive, mechanical.
  - `packages/domain/src/events/index.ts`: new `resolveServedImageUrl` export — additive.
  - **`Event.imageUrl`'s existing GraphQL type/nullability is unchanged** (`String`, nullable) — only its *resolved value* changes (computed instead of passed through). No consumer of `Event.imageUrl` needs any type-level change; behaviorally, a consumer that previously might have received an already-expired Instagram URL will now more often receive a durable or still-valid one — a strict improvement, not a breaking change to the contract shape.
  - **Deliberately not touched:** `packages/database/schema.ts` (no new columns — Story 3.6e's job, done); `posts.imageUrl`/`posts.durableImageUrl`/`posts.imageUrlExpiresAt` themselves (read-only in this story); `Event.videoUrl` and its resolver (Story 3.3c/1.6's, out of scope per AC9); `packages/shared-types` (no interface there represents `Event` today, per the same pattern Story 3.6e's Dev Notes already confirmed).
- **Required DB migration:** none.
- **Required TypeScript type changes:** `events.graphql` schema addition (source of truth for codegen); both apps' generated GraphQL types (mechanical, via `codegen`); `EventDetailViewProps`/`EventImageProps` need **no** change — `imageFallbackUrl?: string | null` already exists (Story 1.6a) and already accepts exactly this shape.
- **Backward compatibility and rollout notes:** Fully additive at the schema level (`durableImageUrl` is a new field; `imageUrl`'s type/nullability is unchanged). No frontend consumer breaks if `durableImageUrl` is omitted from an older cached query — `mapper.ts`'s new line simply reads `undefined`/`null` in that case, which `imageFallbackUrl`'s existing optional-prop handling in `EventImage.tsx` already tolerates gracefully (no fallback attempted, matching today's pre-this-story behavior exactly).
- **Verification checks:** Task 1's 100%-covered unit tests (8 cases, including the boundary `now === imageUrlExpiresAt` case); Task 6's resolver integration test; Task 6's wrapper-level wiring-proof test; full build/lint/test.

### Project Structure Notes

- **New:** `packages/domain/src/events/{resolveServedImageUrl.ts, resolveServedImageUrl.test.ts}`.
- **Modified:** `packages/domain/src/events/index.ts` (new export); `apps/backend/src/schema/events.graphql` (`Event.durableImageUrl`); `apps/backend/src/schema/resolvers.ts` (5 select sites + `Event.imageUrl`/`Event.durableImageUrl` field resolvers); `apps/backend/src/schema/resolvers.test.ts` (extend `eventBySlug` test); `apps/backend/src/generated/resolvers-types.ts` (codegen, committed); `apps/web/src/features/events/queries.graphql` (`durableImageUrl` on `getEventBySlug`); `apps/web/src/features/events/mapper.ts` (`imageFallbackUrl: event.durableImageUrl`); `apps/web/src/generated/graphql.ts` (codegen, committed); `apps/web/src/features/events/EventDetailWrapper.test.tsx` (mock event shape + new wiring test).
- **Not modified:** `packages/database/schema.ts`/migrations (no new columns needed); `packages/domain/src/scraper/*` (the parsing half is done, untouched); `packages/ui/src/features/events/EventImage.tsx`/`EventDetailView.tsx`/`.types.ts` (the `imageFallbackUrl` prop and retry logic already exist, Story 1.6a — this story only supplies data to them, no component code changes); anything related to `Event.videoUrl` or video rendering, anywhere (AC9); `apps/infrastructure/**` (no infra change).

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-video-priority-display.md] — Section 4.4 (AD-12 full text, Rule 3 is this story's exact spec), Section 4.5 ("New resolver story" bullet, this story's originally-scoped shape), Section 7 (wave plan — this story is Wave 3/Track A, final wave, depends on 3-6e).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12] — binding Rule 3 in full (original-preferred serving computed per request, null-expiry-as-expired, `durableImageUrl` as secondary field); Rule 4 (video excluded).
- [Source: git show 5ace981 / git diff 3952c79 5ace981] — Story 3.3c's `videoUrl` plumbing: exact 5 select-site pattern and field-resolver-map pattern this story mirrors for `durableImageUrl`/computed `imageUrl`.
- [Source: git diff 9bb0671 f27ee0e -- apps/web/src/features/events/{mapper.ts,queries.graphql,EventDetailWrapper.test.tsx}] — Story 1.6's `videoUrl` frontend-wiring diff: exact one-line-per-file pattern this story's Task 5 mirrors for `durableImageUrl`/`imageFallbackUrl`.
- [Source: apps/backend/src/schema/resolvers.ts] — read in full around all 5 `imageUrl: posts.imageUrl,` sites (`restoreEvent` ~L1420, `events` list ~L2557, `event(id)` ~L2674, `eventBySlug` ~L2751, `Report.event` ~L2933) and the `Event: { imageUrl: (parent) => ..., videoUrl: (parent) => ... }` field-resolver map (~L2967-2968); confirmed exact insertion points.
- [Source: packages/domain/src/events/{getCancelledReportWindowCutoff.ts, shouldSoftDeleteFromCancelledReports.ts, index.ts}] — existing object-param + injectable-`now`-default convention `resolveServedImageUrl` follows exactly.
- [Source: packages/domain/src/scraper/parse-image-url-expiry.ts, .test.ts] — sibling pure-function-with-100%-test-coverage precedent (Story 3.6e), confirmed complementary (write-time parse) rather than overlapping with this story's read-time compare.
- [Source: packages/ui/src/features/events/{EventImage.tsx, EventDetailView.types.ts, EventDetailView.test.tsx}] — confirmed `imageFallbackUrl` is the exact existing prop name (not `durableImageUrl`) on both `EventDetailViewProps` and `EventImageProps`; confirmed the `onError`/`fireEvent.error` retry-swap test pattern this story's Task 6 wrapper-level test reuses at a higher level to prove the new wiring specifically.
- [Source: packages/database/schema.ts] — confirmed `posts.durableImageUrl`/`posts.imageUrlExpiresAt` already exist (Story 3.6e, this story only reads them).
- [Source: apps/backend/package.json, apps/web/package.json] — confirmed `codegen` script names/behavior (`apps/web`'s also runs `fix-codegen.js` afterward — do not skip).
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules, #Testing-Rules] — `packages/domain` 100%-coverage/pure-logic placement rule (binding for Task 1); testing-trophy philosophy for `apps/*` (binding for Task 6's integration-over-exhaustive-unit approach at the resolver/wrapper level).
- [Source: _bmad-output/implementation-artifacts/3-6e-re-host-extracted-event-images-to-durable-storage.md] — immediate predecessor story; format/depth precedent this story's own Dev Notes/Tasks/References follow; explicitly lists this story ("Story 3.6f") as the consumer of the columns it added, in its own "Out of Scope" section.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode lightweight-guard basis for running Gates 1/2/3 fresh.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Critical Implementation Rules (Drizzle-only DB access — no new access pattern introduced here, just two extra selected columns; best-effort posture N/A, this logic must never throw per AC5), Code Quality & Style Rules (`packages/domain` pure-logic/100%-coverage/no-DB-leakage placement — Task 1), Testing Rules (100% `packages/domain` coverage; testing-trophy integration approach elsewhere — Task 6).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-12 (this story's binding design, Rule 3 in full; Rule 4 confirms video stays out of scope).
- [ ] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — §4.7/§4.1 (`imageUrl`/`postId` doc comments, amended 2026-08-25 per the sprint change proposal) — consistent with this story's read of what `Event.imageUrl` is documented to mean post-AD-12.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/events/{resolveServedImageUrl.ts, resolveServedImageUrl.test.ts}`.
  - Modified: `packages/domain/src/events/index.ts`; `apps/backend/src/schema/events.graphql`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/resolvers.test.ts`; `apps/backend/src/generated/resolvers-types.ts` (codegen); `apps/web/src/features/events/queries.graphql`; `apps/web/src/features/events/mapper.ts`; `apps/web/src/generated/graphql.ts` (codegen); `apps/web/src/features/events/EventDetailWrapper.test.tsx`.
- **Rule Mapping:**
  - `packages/domain` pure-logic/100%-coverage/no-DB-leakage rule → Task 1.
  - AD-12 Rule 3 (original-preferred, computed per request, null-expiry-as-expired, `durableImageUrl` as secondary field) → Tasks 1, 2, 3, 5.
  - AD-12 Rule 4 (video excluded) → Task 3/5's explicit "do not touch `videoUrl`" notes; AC9.
  - Database Access (Drizzle ORM only, explicit-select-override pattern already established) → Task 3's 5 select-site additions.
  - Reuse over reinvention (Story 3.3c's exact 5-site pattern, Story 1.6's exact mapper-line pattern, Story 1.6a's already-built `imageFallbackUrl` retry mechanism) → Tasks 3, 5.
  - Story-split-gate discipline (fresh Gate 1/2/3 run, epic-level-sweep-mode lightweight guard) → Dev Notes "Architecture & UX Gate Findings".
- **Verification Plan:**
  - `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained on `resolveServedImageUrl.ts`.
  - `apps/backend`: `pnpm --filter backend test` — `resolvers.test.ts`'s extended `eventBySlug` case passes; `pnpm --filter backend build`/`lint` clean; codegen output committed and matches a fresh regeneration (no drift).
  - `apps/web`: `pnpm --filter web test` — `EventDetailWrapper.test.tsx`'s new wiring test passes; codegen output committed and matches a fresh regeneration.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — pure comparison function in `packages/domain`, one new nullable GraphQL field, resolver wiring at 5 already-known call sites, two one-line frontend edits. Confirmed unblocked: Story 3.6e (columns) already merged to `master`.
- [ ] Architecture and boundary confirmation — computation lives in `packages/domain/src/events/` (not inline in `resolvers.ts`), matching the sibling `now`-injectable pure-function precedent in the same folder; `now` sourced from the function's own default at resolution time, not threaded through GraphQL context.
- [ ] Testing plan confirmation — `packages/domain` 100%-coverage unit tests (8 cases, including the `now === imageUrlExpiresAt` boundary); `apps/backend` integration test extending the existing `eventBySlug` case; `apps/web` wrapper-level test proving the `imageFallbackUrl` wiring specifically (not re-testing `EventImage`'s already-covered retry mechanism itself).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (no new infra). Gate 2: no gap (zero new UI, reuses Story 1.6a's already-built retry mechanism verbatim). Gate 3: no gap (`resolveServedImageUrl` placed reusably in `packages/domain/src/events/`, matching existing sibling-function conventions).
- [ ] **Design decision accepted:** the three-way serving logic is a `packages/domain` pure function (`resolveServedImageUrl`), not inline branching in `resolvers.ts` (Dev Notes "Design Decision: Where the Computation Lives").
- [ ] **Design decision accepted:** `now` is sourced inside the field resolver via the function's own default, not threaded from the query/context layer (Dev Notes "Design Decision: `now` Sourced Inside the Field Resolver").

## Testing Requirements

- [x] Unit tests: `packages/domain/src/events/resolveServedImageUrl.test.ts` (100% coverage — the 8 cases listed under Task 1, including both null-expiry sub-cases and the strict-inequality boundary at `now === imageUrlExpiresAt`).
- [x] Integration tests: `apps/backend/src/schema/resolvers.test.ts`'s extended `eventBySlug` test (confirms `durableImageUrl` resolves via GraphQL, and that `imageUrl` matches `resolveServedImageUrl`'s own computation against whatever seed data exists); `apps/web/src/features/events/EventDetailWrapper.test.tsx`'s new test (confirms `durableImageUrl` → `imageFallbackUrl` → actual `<img src>` swap on load failure, proving the full chain).
- [x] E2E tests: **not added** — this is a data-serving-correctness change with no new user-visible interaction (the existing image-with-fallback UI was already E2E-relevant, if at all, as of Story 1.6a/1.6; this story only changes which URL is served, not how the UI behaves), matching this project's testing-trophy philosophy and the precedent of prior backend-plumbing-plus-thin-frontend-wiring stories (3.3c, 1.6) shipping without a dedicated E2E spec.

## Deliverables Checklist

- [x] `resolveServedImageUrl` implemented in `packages/domain/src/events/`, 100%-covered, exported from the package barrel.
- [x] `Event.durableImageUrl: String` added to the GraphQL schema.
- [x] All 5 resolver select sites select `durableImageUrl`/`imageUrlExpiresAt` alongside the existing `imageUrl`; `Event.imageUrl`'s field resolver computes via `resolveServedImageUrl`; `Event.durableImageUrl`'s field resolver passes the raw column through.
- [x] Backend and frontend GraphQL codegen regenerated and committed.
- [x] `apps/web`'s `getEventBySlug` query includes `durableImageUrl`; `mapper.ts` maps it into `imageFallbackUrl`.
- [x] `videoUrl` and its rendering path untouched anywhere in the diff.

## Out of Scope

- Anything related to `Event.videoUrl` or video rendering/fallback — fully done, Waves 1-2 (AC9).
- Any change to `posts.imageUrl`/`posts.durableImageUrl`/`posts.imageUrlExpiresAt` themselves, or to how/when they're written — Story 3.6e's territory, this story only reads them.
- Any change to `EventImage.tsx`'s retry state machine or `EventDetailView`'s props/types — Story 1.6a already built exactly what this story needs; only data is supplied here, not new behavior.
- Backfilling `durableImageUrl` for already-persisted posts, or any expiry-triggered deletion — explicitly out of scope per AD-12 Rules 5/6 (unrelated to this story either way, since this story never writes these columns).
- Any change to Manual Post Selection / moderator triage screens — AD-12 Rule 4 excludes their posts from re-hosting entirely; this story's serving logic still technically applies if such a post somehow has an `Event` (it would simply always take the "serve original" or "serve original as fallback" branch, since `durableImageUrl` would be `null`), but no screen-specific code is touched.

## Definition of Done

- [x] AC1-9 satisfied.
- [x] All required tests passing (domain unit — 100% coverage; backend integration; frontend wiring test).
- [x] Lint and type checks passing for `packages/domain`, `apps/backend`, `apps/web`.
- [x] Both apps' GraphQL codegen regenerated and committed, with no drift versus a fresh run.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` (root) pass with no regressions to any existing suite.

## Completion Status

- [x] Complete (2026-08-27, implemented via cline-cli in isolated worktree `.claude/worktrees/3-6f` on branch `3-6f-original-vs-durable`, independently reviewed and verified before merge to `master`).

## Dev Agent Record

### Agent Model Used

`cline-cli` (`cline --auto-approve true`, prompt piped via stdin/promptfile), dispatched into an isolated git worktree (`.claude/worktrees/3-6f`, branch `3-6f-original-vs-durable`). The orchestrating session was interrupted mid-dispatch (device/process exit, same class of issue that hit the Story 3.6e dispatch); on resumption the worktree's actual git state was checked directly (`git log`/`git status`) rather than assuming nothing survived — `cline-cli`'s implementation commit (`654242a`) was already present and complete. Independently reviewed, tested, and verified by the orchestrating agent before merge; no further code changes were needed beyond what `cline-cli` produced.

### Debug Log References

`cline-3-6f-run.log` (scratchpad-directory dispatch transcript, gitignored/not committed) — full tool-call transcript of the `cline-cli` implementation run.

### Completion Notes List

- All 6 Tasks implemented exactly as specified in this story; diff footprint independently confirmed scoped to `packages/domain/src/events`, `apps/backend/src/schema`, `apps/web/src/features/events`, both apps' generated codegen output, and `pnpm-lock.yaml` — no touches to `packages/ui`, `apps/infrastructure`, or anything `videoUrl`-related.
- `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts` picked up two incidental `as any` type-cast additions (on two mocked `S3Client`-shaped objects passed to `setS3ClientInstance`) as a side effect of `pnpm --filter backend build` surfacing a pre-existing type-strictness gap while `cline-cli` was verifying its own work; harmless, test-only, and outside this story's own file-change plan, but left in since it doesn't touch any of this story's actual logic and fixes a real (if minor) type error.
- Two stray edits leaked from `cline-cli`'s editor tool into the **main repository's working tree** (outside the isolated worktree) during the dispatch: `packages/domain/src/events/index.ts` (the same barrel-export line correctly added inside the worktree) and `apps/web/tsconfig.tsbuildinfo` (a build-cache artifact). Neither was ever committed; both were discovered and discarded (`git checkout --`) by the orchestrating agent during independent verification, before any commit or merge touched the main repo. Root cause not fully diagnosed (worktrees should keep working directories fully isolated); noted here in case the same leakage recurs on a future dispatch.
- `apps/web/public/maplibre-gl-shared.mjs`/`maplibre-gl-worker.mjs` showed as modified after every `pnpm --filter web build`/`pnpm build` run (both in the worktree and later independently reproduced) but `git diff --numstat` confirmed zero actual content change — pure CRLF/LF line-ending touch noise from the build step. Discarded each time via `git checkout --`; never part of the merged commit.
- One transient test failure during independent verification: a full `pnpm --filter backend test` run reported 2/263 failing, including `src/validation/validate.test.ts` crashing with a Windows `STATUS_DLL_NOT_FOUND`-class exit code (3221226091) — a classic native-module-loading flake under load, not a real assertion failure. Confirmed non-reproducible two ways: (a) `validate.test.ts` run in isolation passed 3/3 cleanly (and is unrelated to this story's scope — AJV schema validation, no image/post logic); (b) a full clean rerun of `pnpm --filter backend test` passed 267/267 with exit code 0.
- Independent verification performed by the orchestrating agent (not just trusting the dispatch's own self-report): `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 162/162 pass (100% coverage on the new `resolveServedImageUrl.ts`); `pnpm --filter backend build` — 0 type errors; `pnpm --filter backend lint` — 0 errors, only pre-existing warnings; `pnpm --filter backend test` — 267/267 pass (after ruling out the transient flake above); `pnpm --filter web test` — 276/276 pass; `pnpm --filter web build` — clean; `pnpm --filter web lint` — 0 errors, only pre-existing warnings; root `pnpm build` — 7/7 turbo tasks successful; root `pnpm lint` — 6/6 turbo tasks successful, 0 errors.
- Merge to `master` was a clean, conflict-free `--no-ff` merge, on top of this story's own draft commit (`c900b3f`) with no other work landing on `master` concurrently.

### File List

**New:**
- `packages/domain/src/events/resolveServedImageUrl.ts`
- `packages/domain/src/events/resolveServedImageUrl.test.ts`

**Modified:**
- `packages/domain/src/events/index.ts` (new export)
- `apps/backend/src/schema/events.graphql` (`Event.durableImageUrl: String`)
- `apps/backend/src/schema/resolvers.ts` (5 select sites + `Event.imageUrl`/`Event.durableImageUrl` field resolvers)
- `apps/backend/src/schema/resolvers.test.ts` (extended `eventBySlug` test)
- `apps/backend/src/generated/resolvers-types.ts` (codegen)
- `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts` (2 incidental `as any` type-cast fixes, unrelated to this story's own scope — see Completion Notes)
- `apps/web/src/features/events/queries.graphql` (`durableImageUrl` on `getEventBySlug`)
- `apps/web/src/features/events/mapper.ts` (`imageFallbackUrl: event.durableImageUrl`)
- `apps/web/src/generated/graphql.ts` (codegen)
- `apps/web/src/features/events/EventDetailWrapper.test.tsx` (mock event shape + new wiring test)
- `pnpm-lock.yaml` (routine transitive patch-version churn plus a pre-existing `@aws-sdk/client-s3` lockfile/`package.json` specifier drift corrected by a fresh install)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (`3-6f` entry: `backlog` → `ready-for-dev` → `review`)
