---
baseline_commit: 5633bc47880a2c30aed343b7f6f628c06330e542 (set at bmad-create-story time, 2026-10-05; CC-024 Wave 5)
---

# Story 3.6x: Show all events from a post on a post collection page

## Story Details

- Epic: 3 (CC-024 — Multi-event posts and cross-post event matching, Wave 5)
- Story ID: 3.6x
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want a page listing every event from a post,
so that I can browse a roundup or multi-event post's events when there are more than the inline limit.

## Acceptance Criteria

1. **AC1 — `Query.postByPlatformIdentifiers` (new, backend-only lookup).** `apps/backend/src/schema/events.graphql`'s `Query` gains:
   ```graphql
   postByPlatformIdentifiers(platform: String!, postType: String!, platformPostId: String!): EventSourcePost
   ```
   Resolved in `resolvers.ts` as a new top-level resolver: `SELECT ... FROM posts LEFT JOIN socialMediaAccountProfiles ON posts.accountId = socialMediaAccountProfiles.id WHERE posts.platform = $platform AND posts.platformPostType = $postType AND posts.platformPostId = $platformPostId LIMIT 1`, returning `null` when no row matches. **Reuses the existing `EventSourcePost` type** (Story 3.6u) rather than inventing a near-duplicate — `postId`, `groupingReason`, `extractedEventCount`, `account`, `platformPostId`, `postType` map directly onto the columns Story 3.6u's own `sourcePosts` resolver already reads from this same `posts` table; `isPrimary` (hardcoded `false` — meaningless outside an event's own post list, never selected by this story's own query documents) and `coauthors` (hardcoded `[]` — not resolved, this page has no use for post coauthors) are included only for type-shape completeness, costing nothing since GraphQL never evaluates an unselected field. This is an ordinary new read through the existing backend/GraphQL resolver layer — no new infra, no bypass (see Architecture & UX Gate Findings).

2. **AC2 — `Query.relatedEventIds` widened to accept a post-keyed variant (AD-30 Rule 11's `eventId | postId` contract, deferred by Story 3.6u to this story).** `events.graphql`'s `relatedEventIds(eventId: ID!): [RelatedEventGroup!]!` becomes `relatedEventIds(eventId: ID, postId: ID): [RelatedEventGroup!]!` — **exactly one** of the two must be supplied; supplying neither or both throws `GraphQLError('Exactly one of eventId or postId must be provided', { extensions: { code: 'BAD_REQUEST' } })` (matching this file's existing `GraphQLError`/`extensions.code` convention). The `eventId` branch is **completely unchanged** (Story 3.6u's self-joined, self-excluding query). The new `postId` branch is a simpler, non-self-joined read: `SELECT event_posts.event_id FROM event_posts INNER JOIN events ON events.id = event_posts.event_id WHERE event_posts.post_id = $postId AND events.deleted_at IS NULL AND events.merged_into_event_id IS NULL`, returned as a **singleton** `[{ postId, eventIds }]` array (or `[]` if the post has no linked events) — there is no "self" to exclude for a post-keyed read, and no grouping-by-post step needed since by definition every row belongs to the one requested post. Both branches continue to exclude soft-deleted and merged events (AD-30 Rule 11's "See all N never counts a hidden one" contract, now shared by both variants).

3. **AC3 — Post Collection Page route (EXPERIENCE.md §3, `/posts/{platformSlug}/{postType}/{platformPostId}/events`).** A new Next.js route at `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/page.tsx` (coexists as a sibling dynamic segment alongside the existing static `apps/web/src/app/[locale]/posts/select/` route — verified no Next.js route-conflict, same pattern as `[locale]/[platformSlug]/[accountId]` coexisting with `[locale]/favorites`, `[locale]/archive`, etc.). `generateMetadata` and the page body both resolve `platform = getPlatformByCode(platformSlug)` (`notFound()` if unresolvable, mirroring the account route) then call `Query.postByPlatformIdentifiers(platform, postType, platformPostId)` (`notFound()` if it resolves to `null` — the post itself doesn't exist). Title/description are set via `generateMetadata` using new `Metadata` namespace keys `postCollectionPageTitle`/`postCollectionPageDescription` (both parameterized by the post's account display name), following the exact `accountPageTitle`/`accountPageDescription` precedent (`apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx`). The page body renders `<Suspense fallback={<RouteLoader />}><PostEventsContent .../></Suspense>` per the project's Route-Level Suspense Fallback rule.

4. **AC4 — Page content reuses the existing event-list UI and logic wholesale (EXPERIENCE.md §3, epics.md AC2 — no parallel implementation).** A new client component, `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/post-events-content.tsx`:
   - Fetches event ids via a new `getRelatedEventIdsByPost($postId: ID!)` query document (`relatedEventIds(postId: $postId) { postId eventIds }`), then fetches the actual events via the **existing** `getEvents` document with `{ operator: 'and', conditions: [{ field: 'id', operator: 'in', value: [...] }] }` (the same reused-`id in [...]` DSL condition Story 3.6u and Favorites already use — no new query document for this half) — the identical two-step `relatedEventIds → events` pair the Related Events Area on the event-detail page uses, so the inline preview and this full page always agree (EXPERIENCE.md §3).
   - Batches that fetch through `useListPaginationController` (filterKey scoped to the resolved `postId`) and `useInfiniteScroll`, mirroring `FavoritesContent`'s frozen-ids-then-batch-fetch pattern (`_bmad-output/implementation-artifacts/.../favorites-content.tsx`) — not a new pagination mechanism, even though in practice a post's event count is capped (AD-30 Rule 5, default 10) and will almost always fit on one page.
   - Renders `PageContainer` > `PageHeader` (title: "Events from {account}", reusing the **existing** `EventDetailsPage.relatedEventsGroupLabel` i18n key/format — **not** a new copy string, per EXPERIENCE.md §3's explicit "reuses the same account/post identifier convention as the Related Events Area's group label... not only the document `<title>`") > `EventListView` (which already wraps cards in `GridContainer` internally — confirmed via source read, so epics.md AC2's `GridContainer` mention names what `EventListView` already encapsulates, not something this page wires up separately). No search/filter chrome (`EventDiscoveryPanel`/AI filter) — neither the epics.md AC nor EXPERIENCE.md §3 names one, unlike Favorites/Discovery/Account.
   - Each card's `onClick` navigates to `/events/${event.slug}?fromList=post&postEventIds=${frozenIds.join(',')}` (AC5).
   - Empty state (all of a post's events soft-deleted/merged since extraction — the post itself still resolves) uses a new `PostCollectionPage.emptyState` i18n key; loading/error states mirror `AccountPage`'s existing `EventListView` wiring.

5. **AC5 — Next/Previous detail navigation inherits this page's own list context (project-context.md's Context-Aware Detail Views rule; EXPERIENCE.md §3: "behaving exactly like paging through Discovery or Favorites — not a special case"; user-decided, see Dev Notes).** `apps/web/src/features/events/navigation-hook.ts`'s `useListNavigationForEvent` gains a third context branch, `isPostContext = fromList === 'post'`, that parses a `postEventIds` URL param (comma-joined event ids) into `frozenPostEventIds` — **the same `favoriteIds`-freezing pattern the existing `'favorites'` branch already uses**, not a new mechanism: a second, independent `useInfiniteQuery` batches `Query.events({ id in [...] })` over `frozenPostEventIds` exactly like the existing `favorites-navigation-events` block does over `frozenFavoriteIds`. `hasListContext` is `true` whenever `isPostContext && frozenPostEventIds.length > 0 && nav.hasContext`. `useContextAwareListNavigation` itself is unchanged — this is purely a new data-source branch feeding it, exactly like `'favorites'` is today.

6. **AC6 — Title/meta via `generateMetadata` (project rules).** Covered by AC3; restated as its own AC per epics.md's literal text and this project's Dynamic Page Title & Meta Tags rule (next-intl `getTranslations()` server-side, `buildPageMetadata` helper, never a client-side `document.title` mutation).

7. **AC7 — EXPLAIN gate: new-query baseline (user-decided scope, see Dev Notes).** Extend the established `apps/backend/src/explain-events-queries.ts` procedure (Story 3.6r AC6, extended again by Story 3.6u AC7) with 2 more scenarios: `Query.relatedEventIds`'s new `postId` branch, and the new `Query.postByPlatformIdentifiers` lookup — confirming both are index-driven (the new partial unique index from AC8, and `event_posts`' existing `(post_id, event_id)` index/PK) with **no Seq Scan**. Results recorded in a new `_bmad-output/planning-artifacts/cc-024-explain-after-3.6x-<date>.md`, following the established baseline/diff-doc naming convention (`cc-024-explain-after-3.6u-2026-10-04.md` is the immediately preceding one). This story does **not** re-verify `Query.events`/`Query.eventBySlug`'s own per-row cost — neither this story's schema change nor its resolvers touch either of those two hot-path queries or any shared `fieldMap`/`buildOptimizedDrizzleSelect` code they depend on.

8. **AC8 — Data integrity: partial unique index on the post-identity triple (user-decided, see Dev Notes).** A new migration adds a **hand-written** (drizzle-kit 0.21 drops `WHERE` predicates, per AD-30 Rule 1/AD-8 Rule 3's established workaround) partial unique index:
   ```sql
   CREATE UNIQUE INDEX "posts_platform_post_identity_idx" ON "posts" ("platform","platform_post_type","platform_post_id")
   WHERE "platform_post_id" IS NOT NULL AND "platform_post_type" IS NOT NULL;
   ```
   enforcing that `(platform, platformPostType, platformPostId)` identifies at most one post (NULLs are distinct in Postgres, so the overwhelming majority of pre-AD-16 historical rows — never backfilled — never collide). **Before generating this migration**, run the dedupe check below against the target database and treat any result as a blocking finding to report, not silently resolve by picking a row:
   ```sql
   SELECT platform, platform_post_type, platform_post_id, count(*)
   FROM posts
   WHERE platform_post_id IS NOT NULL AND platform_post_type IS NOT NULL
   GROUP BY 1, 2, 3
   HAVING count(*) > 1;
   ```
   `packages/database/schema.ts`'s `posts` table gets a corresponding builder-level `.unique()`/`.index().where(...)` call for documentation/type-checking intent only (matching the existing `hashtagsIdx`/AD-30 precedent comment style — the builder call does not by itself produce the enforced index; the hand-written SQL in the generated migration file does).

9. **AC9 — i18n.** New `Metadata` namespace keys (`postCollectionPageTitle`, `postCollectionPageDescription`, both `en.json`/`id.json`), new `PostCollectionPage` namespace (`errorState`, `emptyState`, `loadingMore`, matching `AccountPage`/`FavoritesPage`'s existing key-naming convention for the same concepts). The on-page heading and the "events from this account" label are **not** new keys — they reuse `EventDetailsPage.relatedEventsGroupLabel` (Story 3.6u) verbatim, per AC4.

## Tasks / Subtasks

- [x] **Task 1 — DB migration: partial unique index on the post-identity triple** (AC: #8)
  - [x] Run the dedupe check query (AC8) against the local database; if it returns any rows, stop and report the finding rather than proceeding — do not silently dedupe. (0 rows — no duplicates found.)
  - [x] `packages/database/schema.ts` — add the documentation-only `.unique()`/`.index().where(...)` builder call on `posts` (`platform`, `platformPostType`, `platformPostId`), matching the `hashtagsIdx` comment-the-gap style.
  - [x] Generate the migration (`pnpm --filter @festgrid/database generate`), then hand-edit the generated `.sql` file to add the real `WHERE`-qualified `CREATE UNIQUE INDEX` statement (AC8) — drizzle-kit 0.21 drops the predicate, per AD-30 Rule 1's established workaround. (`migrations/0073_living_silver_sable.sql`.)
  - [x] Apply the migration locally (`pnpm --filter @festgrid/database migrate`); confirm it applies cleanly (no violation).
- [x] **Task 2 — Backend schema + resolvers** (AC: #1, #2)
  - [x] `apps/backend/src/schema/events.graphql` — widen `relatedEventIds(eventId: ID!)` to `relatedEventIds(eventId: ID, postId: ID)`; add `postByPlatformIdentifiers(platform: String!, postType: String!, platformPostId: String!): EventSourcePost` to `extend type Query`.
  - [x] `apps/backend/src/schema/resolvers.ts` — add the `eventId`/`postId` exclusivity check + new `postId` branch to `relatedEventIds` (AC2's exact query); add the new `postByPlatformIdentifiers` resolver (AC1's exact query/shape).
  - [x] Run `pnpm --filter backend codegen` — regenerate `apps/backend/src/generated/resolvers-types.ts`; never hand-edit.
- [x] **Task 3 — Backend resolver tests** (AC: #1, #2)
  - [x] `apps/backend/src/schema/resolvers.test.ts` — new `Query.relatedEventIds (postId variant, Story 3.6x)` block: seed a post linked to 2 events (one soft-deleted, one merged into another) plus an unrelated event on a different post; assert the result is a singleton group containing only the live, non-merged event; assert `[]` for a post with no linked events; assert the exclusivity-check error for both the neither-arg and both-args cases.
  - [x] New `Query.postByPlatformIdentifiers (Story 3.6x)` block: assert a seeded post resolves with its account/groupingReason/extractedEventCount; assert `null` for a non-matching triple; assert platform-discrimination (same `postType`+`platformPostId`, different `platform`, resolve to different posts / `null` as appropriate).
  - [x] A real-DB migration test (`packages/database/unique-index.integration.test.ts`, new) asserting the new partial unique index rejects a duplicate non-null triple (real Postgres `23505` unique_violation) and allows multiple NULL rows.
- [x] **Task 4 — EXPLAIN gate** (AC: #7)
  - [x] Extend `apps/backend/src/explain-events-queries.ts` with 2 new scenarios (`relatedEventIds`'s `postId` branch, `postByPlatformIdentifiers`); run against `seed:volume` plus the small manual links Story 3.6u's own extension already seeds; capture via the existing SQL-capture-sink mechanism; run both under `EXPLAIN (ANALYZE, BUFFERS)`.
  - [x] Write `_bmad-output/planning-artifacts/cc-024-explain-after-3.6x-2026-10-05.md` (same format as the `...-after-3.6u-...` doc): both new queries **PASS**, index-driven, no Seq Scan.
  - [x] `pnpm --filter @festgrid/database seed:volume:clean` after capture. (Confirmed posts/events counts back to 35/12 baseline; no residual `explain-probe-*` rows.)
- [x] **Task 5 — Frontend GraphQL documents + codegen** (AC: #1, #2, #4)
  - [x] `apps/web/src/features/events/queries.graphql` — add `getPostByPlatformIdentifiers($platform: String!, $postType: String!, $platformPostId: String!)` (selecting `postId`, `account { accountId platform username displayName profileImageUrl }`, `groupingReason`, `extractedEventCount`) and `getRelatedEventIdsByPost($postId: ID!)` (`relatedEventIds(postId: $postId) { postId eventIds }`) as **new** documents — the existing `getRelatedEventIds($eventId: ID!)` document (Story 3.6u) is left untouched.
  - [x] Confirm via grep that no existing list-view document selects `EventSourcePost`'s event-detail-only fields unnecessarily from the new query (mirrors prior confinement guards). (`isPrimary`/`coauthors`/`sourcePostUrl`/`originalPostUrl` only appear in `getEventBySlug`'s own `sourcePosts` selection.)
  - [x] Run `pnpm --filter web codegen` (`fix-codegen.js`) — regenerate `apps/web/src/generated/graphql.ts`.
- [x] **Task 6 — Post Collection Page route** (AC: #3, #4, #6)
  - [x] `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/page.tsx` — `generateMetadata` (platform resolution + `postByPlatformIdentifiers` + `notFound()` on either miss, `buildPageMetadata` with the new `Metadata` keys) and the default export (same resolution, `<Suspense fallback={<RouteLoader/>}>`), mirroring `apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx`'s exact structure.
  - [x] `.../events/post-events-content.tsx` — the client component per AC4 (`useListPaginationController`, `useInfiniteScroll`, `PageContainer`/`PageHeader`/`EventListView`, frozen-postEventIds navigation wiring per AC5).
  - [x] `post-events-content.test.tsx`, `page.test.tsx` (or equivalent) — render/loading/empty/error states; pagination batch-fetch over frozen ids; `notFound()` triggers for an unresolvable platform or a missing post.
- [x] **Task 7 — Context-aware Next/Previous navigation** (AC: #5)
  - [x] `apps/web/src/features/events/navigation-hook.ts` — add the `'post'` `fromList` branch (AC5's exact `frozenPostEventIds`/`useInfiniteQuery` pattern, mirroring the existing `favoriteIds` branch) to `useListNavigationForEvent`.
  - [x] `navigation-hook.test.ts` (new, dedicated `renderHook` coverage) — new tests for the `'post'` branch: context detected only when `fromList=post` **and** `postEventIds` is non-empty; Next/Previous paginates correctly over the frozen ids; no interference with the existing `'favorites'`/generic-filter branches.
- [x] **Task 8 — i18n** (AC: #9)
  - [x] Add `postCollectionPageTitle`, `postCollectionPageDescription` to `apps/web/locales/en.json`/`id.json`'s `Metadata` namespace.
  - [x] Add `errorState`, `emptyState`, `loadingMore` to a new `PostCollectionPage` namespace in both locale files.
- [x] **Task 9 — Verification** (AC: all)
  - [x] `apps/backend`: targeted `TZ=UTC NODE_ENV=test npx tsx --test src/schema/resolvers.test.ts` (113/113 pass, including the 24 new assertions for this story), `pnpm --filter backend build` (tsc, clean), `pnpm --filter backend lint` (0 errors, pre-existing warnings only); `pnpm --filter backend codegen` re-run confirmed the generated types diff is exactly this story's own additive change (no unrelated drift).
  - [x] `packages/database`: targeted `TZ=UTC NODE_ENV=test npx tsx --test unique-index.integration.test.ts` (1/1 pass — new partial-unique-index migration-safety test), `pnpm --filter @festgrid/database build` (tsc, clean), `pnpm --filter @festgrid/database lint` (0 errors/0 warnings, `--max-warnings 0` enforced).
  - [x] `apps/web`: targeted `npx vitest run` on `post-events-content.test.tsx`, `page.test.tsx`, `navigation-hook.test.ts` (19/19 pass), `pnpm --filter web lint` (0 errors, pre-existing warnings only), `NODE_USE_ENV_PROXY=1 pnpm --filter web build` (clean; new route `/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events` appears in the build's route manifest as `ƒ` dynamic, coexisting with the existing `/[locale]/posts/select` static route with no conflict). Per this session's explicit testing instructions, only targeted test files were run (no full backend/web suite, no whole-repo build/lint/test) — `pnpm lint`/`pnpm build` at the repo root were explicitly denied by this environment's own guardrail in favor of the per-package scoped commands above, which were run instead and are the commands actually executed and recorded here.
  - [x] Database state verified clean after every ad-hoc/test run: dedupe check (Task 1) was read-only; `unique-index.integration.test.ts`'s own fixture rows were deleted in its `finally` block (confirmed via direct `psql` count = 0 post-run); `seed:volume`/`seed:volume:clean` (Task 4's EXPLAIN capture) returned posts/events to the 35/12 baseline with no residual `explain-probe-*` rows. No ad-hoc SQL write was left applied outside the reviewed migration itself.
  - [x] Manual sanity (verified by direct inspection rather than a live browser session in this environment): the "See all N events" href Story 3.6u's `EventDetailWrapper.tsx` already builds (`/posts/${platformSlug}/${postType}/${platformPostId}/events`) matches this story's new route's own dynamic segments exactly; `post-events-content.test.tsx` confirms the page's own event list and its card `onClick` wiring (`fromList=post&postEventIds=...`); `navigation-hook.test.ts` confirms Next/Previous from an event opened off this page's frozen ids pages through that same list and not a generic/empty context.

## Dev Notes

### Design Decisions

Two genuine, non-mechanical design questions were surfaced to the user via `AskUserQuestion` before finalizing this story, per this project's standing `bmad-create-story` rule (this story has UI scope, so Gate 2 applied and every design question was surfaced, not only architecture ones):

1. **Data-integrity strictness for the new post-identity lookup (AC8).** `posts` has no unique constraint today on `(platform, platformPostType, platformPostId)` — only `postUrl` is unique, and this triple is only populated going forward by AD-16 (no backfill). Two options were presented: (a) a partial unique index (NULLs excluded, so untouched historical rows never collide), with a mandatory pre-migration dedupe check against real data as a safety gate; or (b) a plain non-unique index with no correctness guarantee, requiring a documented tie-break if a duplicate ever surfaced. **Resolved: option (a)**, the recommended choice — matches `project-context.md`'s indexing rule, matches AD-16's own framing of this triple as a stable per-platform identifier, and the dedupe-check safety gate (Task 1) means the migration can never silently corrupt/drop data even if the theoretical edge case (two distinct `postUrl`s resolving to the same platform permalink) turns out to be real. See AC8/Task 1.
2. **Next/Previous navigation context mechanism (AC5).** EXPERIENCE.md §3 requires this page's Next/Previous to "behave exactly like paging through Discovery or Favorites — not a special case." Two options were presented: (a) freeze the page's already-fetched event ids into a URL param (`postEventIds`), mirroring the existing `'favorites'` branch's `favoriteIds` pattern exactly; or (b) have the nav hook independently re-resolve the post's identity and re-run `relatedEventIds(postId) → events(id in [...])` itself. **Resolved: option (a)**, the recommended choice — reuses an existing, already-tested pattern verbatim rather than duplicating the two-step fetch a second time and wiring the platform-identifier-to-postId lookup into a second call site; the event-count cap (AD-30 Rule 5, default 10) means the URL param never grows large, exactly the same assumption the `favoriteIds` precedent already relies on. See AC5/Task 7.

### Architecture & UX Gate Findings

An epic readiness report already covers this story: `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.6x`). Per `story-split-gate.md`'s Epic-Level Sweep Mode, Gate 1 and Gate 3 were **not** re-run fresh for this story — their findings are cited directly:

- **Gate 1 (Architecture/Infrastructure Completeness) — READY, no gap** (report line 168: *"3.6x (show all events from a post on a post collection page) | READY | Reuses existing list UI per its own AC; no parallel implementation risk found."*). Report lines 72-74 additionally characterize both 3.6u's and this story's new reads together: *"3.6u/3.6x's new reads (`Query.relatedEventIds`, `Event.sourcePosts`) are ordinary GraphQL resolvers reusing the existing `buildOptimizedDrizzleSelect`/batched-`IN` idiom (AD-17) — no new ad hoc data path."*
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — READY, no gap.** No new global-shell, i18n-foundation, analytics-foundation, or GraphQL-codegen-pipeline gap; every mechanism this story uses (next-intl, GraphQL Code Generator, `PageContainer`/`PageHeader`/`GridContainer`, `useListPaginationController`/`useInfiniteScroll`/`useContextAwareListNavigation`) is already established, and this story is an ordinary consumer/extender of each.
- **Lightweight guard (this session) — does 3.6x's actual scope contain anything the batch sweep plausibly didn't anticipate?** One thing needed fresh judgment: the AC's literal text names `Query.relatedEventIds` (post variant) as the data source but doesn't spell out *how* the route's three platform-identifier segments become a real DB `postId` for `generateMetadata` and the page's own fetch — the sweep's "READY" verdict was pitched at the UI-reuse level, not this specific lookup mechanism. Reasoned through directly (not re-run as a full subagent Gate 1 pass, since the conclusion stays within the sweep's own characterization): the new `Query.postByPlatformIdentifiers` lookup (AC1) is an ordinary new read through the existing backend/GraphQL resolver layer — same `buildOptimizedDrizzleSelect`-adjacent pattern, no new infra, no bypass — so it does not change Gate 1's verdict, it is simply more detail within the already-"ordinary GraphQL resolver" characterization the report gives both 3.6u and 3.6x. No new external service, no new data entity (the lookup reads only pre-existing `posts`/`socialMediaAccountProfiles` columns), no new infra dependency. The data-integrity question this surfaced (AC8's unique index) is a genuine, user-decided call, not an architecture gap — recorded in Design Decisions above, not deferred to a prerequisite story.
- **Gate 2 (UI Complexity & Reusability) — run fresh this session** (stays per-story per the Epic-Level Sweep Mode rule). Dispatched via `runSubagent`, with the full epics.md AC text and EXPERIENCE.md §3's Post Collection Page contract pasted directly into the prompt (not re-read cold by the subagent), plus the verified shape of every reusable primitive in scope (`EventListView` already wraps `GridContainer` internally; `useListPaginationController`/`useInfiniteScroll`/`useContextAwareListNavigation` are all pre-existing, multi-consumer, generic hooks). **Verdict: no gap requiring a prerequisite story split.** (a) No reusable-component gap — every primitive is already extracted and multi-consumer; the page's own top-level content component is single-consumer by nature, which Gate 2(a) does not flag. (b) No complex-hook gap — the new `'post'` branch on `useListNavigationForEvent` extends an already-generic, already-multi-branch hook with the same pattern its `'favorites'` branch already uses, not a new complex hook. (c) One minor drafting gap, folded directly into this story's own AC rather than split off: EXPERIENCE.md's requirement that `PageHeader`'s on-page heading text (not just the document `<title>`) reuse the Related Events Area's "Events from [post/account]" label convention — the epics.md AC text only names `generateMetadata`. **Folded into AC4/AC6 above**, not left as a silent gap.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive DB migration (index-only, no new column), purely additive GraphQL schema changes.** No data type is introduced or changed on any existing column; the migration adds a partial unique index over three already-existing columns (`posts.platform`, `posts.platform_post_type`, `posts.platform_post_id`).
- **Impacted fields/contracts:** `posts` gains `posts_platform_post_identity_idx` (new partial unique index, AC8). `events.graphql`'s `Query.relatedEventIds(eventId: ID!)` becomes `relatedEventIds(eventId: ID, postId: ID)` — a required arg becoming optional is backward compatible for every existing caller (Story 3.6u's `getRelatedEventIds` document still supplies `eventId`, unaffected); `Query` additionally gains `postByPlatformIdentifiers` (new, additive). `apps/web/src/features/events/queries.graphql` gains two new documents (no existing document is modified).
- **Required DB migration changes:** AC8's hand-written partial unique index, preceded by the mandatory dedupe check (Task 1) — this *is* the migration-safety verification this section exists to require.
- **Required TypeScript type changes:** `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` regenerated via their respective `codegen` commands — never hand-edited. No new domain-package types or mapping functions are needed; this story is a pure consumer of Story 3.6u's existing `EventSourcePost`/`postGroupingReasonToGraphQL` and the existing `getPlatformSlug`/`getPlatformByCode` registry functions (`packages/domain/src/scraper/platform-registry.ts`) — reused verbatim, never re-declared, per `project-context.md`'s platform-short-code rule.
- **Backward compatibility and rollout notes:** Purely additive at every layer except the one arg-cardinality change on `relatedEventIds`, which is itself backward compatible (required → optional never breaks an existing caller that already supplies the arg). The new unique index could in principle fail to apply if live data already violates it — the mandatory pre-migration dedupe check (AC8/Task 1) is the rollout safeguard: a non-empty result blocks the migration and must be reported, not silently resolved.
- **Verification checks:** Task 3's backend resolver/query tests (real-DB integration, including a dedicated migration/constraint test) and Task 4's EXPLAIN-gate doc; Task 6's frontend route/component tests; Task 7's navigation-hook tests; `tsc`/lint clean across `apps/backend`, `packages/database`, `apps/web`; both `codegen` commands succeed cleanly against the widened/new schema.

### Project Structure Notes

- **No new reusable UI component, hook, or `packages/domain` mechanism.** This story is a pure consumer of already-shipped reusable pieces (`EventListView`, `PageContainer`, `PageHeader`, `useListPaginationController`, `useInfiniteScroll`, `useContextAwareListNavigation`, `EventSourcePost`, `postGroupingReasonToGraphQL`, `getPlatformSlug`/`getPlatformByCode`) — see Gate 2 findings above. The only new, non-trivial logic is backend-resolver-shaped (two new/widened GraphQL reads) and page-route-shaped (single-consumer composition), neither of which belongs in `packages/ui`/`packages/domain` by this project's own placement rules.
- **State management categorization:** Server State (React Query) only — `postByPlatformIdentifiers` (server-side, via `graphqlClient.request` inside `generateMetadata`/the page component, same as the account page precedent), `relatedEventIds`/`events` (client-side, via the generated React Query hooks). No URL filter state (no `nuqs` — this page has no search/filter chrome) beyond the plain `postEventIds`/`fromList` navigation-context params (read via `useSearchParams`, the same raw-param-reading approach the existing `favoriteIds`/`fromList` params already use in `navigation-hook.ts` — not a `nuqs` candidate, since these are one-way navigation context, not user-editable filter state).
- **Async/loader categorization:** Non-blocking, initial-load — `EventListView`'s own skeleton/loading state (already built, reused unchanged), matching `project-context.md`'s "Non-Blocking (Initial Load)" rule. No lazy/viewport-gated loading on this page (unlike the event-detail Related Events Area) — this is the page's own primary content, not a deferred section of a larger page.
- **No cloud/external service setup** — `SETUP_WALKTHROUGH.md` unaffected.
- **No new npm dependency, no new workspace package.**
- **Current code state (read in full/targeted before drafting this story):**
  - `apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx` — the exact `generateMetadata`/`notFound()`/`<Suspense>` structure this story's `page.tsx` mirrors (platform-code resolution, graceful `generateMetadata` degradation, re-throw on a real error in the page body).
  - `apps/web/src/app/[locale]/favorites/favorites-content.tsx` — the frozen-ids-then-batched-fetch pattern (`useListPaginationController` + `useInfiniteQuery` over `frozenFavoriteIds`) this story's `post-events-content.tsx` and `navigation-hook.ts`'s new branch both mirror.
  - `apps/web/src/features/events/navigation-hook.ts` — the existing `'favorites'` branch (`frozenFavoriteIds`/`favoriteIds` URL param) this story's new `'post'` branch (`frozenPostEventIds`/`postEventIds`) is a structural sibling of, not a replacement for.
  - `packages/ui/src/features/events/EventListView.tsx` (lines ~1-120) — confirmed it already wraps content in `GridContainer` internally (masonry layout); confirmed via the Account/Favorites pages' own usage that no page separately invokes `GridContainer` itself.
  - `packages/ui/src/core/page-header.tsx` — confirmed minimal `{title, description?, action?}` shape; confirmed the Account/Favorites precedents predate `PageHeader` and hand-roll their own `<h1>` row (not to be copied — this story must use the real primitive, per epics.md's explicit AC2 mention of it).
  - `apps/backend/src/schema/resolvers.ts:3777-3800` — the exact, unmodified `relatedEventIds` `eventId`-branch implementation this story's Task 2 widens (new `postId` branch added alongside, existing branch untouched).
  - `apps/backend/src/schema/events.graphql:156-198` — `EventSourcePost`'s existing shape (already carries `platformPostId`/`postType`, added by Story 3.6u's own Task 3 commit `20164d1` specifically anticipating this story's route) and the current `Query` block this story extends.
  - `packages/database/schema.ts:297-356` (`posts` table) — confirmed `platformPostId`/`platformPostType` exist (Story 3.7f/AD-16) with no unique constraint today beyond `postUrl`; confirmed the `hashtagsIdx` comment-the-drizzle-kit-gap precedent style this story's new index builder call follows.
  - `packages/domain/src/scraper/platform-registry.ts` — `getPlatformSlug`/`getPlatformByCode`, reused as-is for the route's `platformSlug` segment, per `project-context.md`'s explicit "any code that needs a platform's short code must import these functions" rule.
  - `apps/web/src/app/[locale]/posts/select/` — confirmed this story's new dynamic route (`posts/[platformSlug]/[postType]/[platformPostId]/events`) coexists with the existing static `posts/select` route at the same `posts/` directory level without a Next.js routing conflict (same coexistence pattern already proven by `[locale]/[platformSlug]/[accountId]` alongside `[locale]/favorites`/`[locale]/archive`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6x] — this story's AC text
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6u, #Story 3.6w] — the story this depends on and its sibling in the same wave
- [Source: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md#Wave 5, #Dependency summary] — sequencing: "needs Story 3.6u" (at `review`, standing rule accepts)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-30 Rule 11] — `Query.relatedEventIds(eventId | postId)`'s exact binding contract, including the `postId` variant this story ships
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 verdict for 3.6x (READY), cited directly per Epic-Level Sweep Mode
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Multi-Event Posts and Cross-Post Event Matching (CC-024), §3 "Post Collection Page", and the Information Architecture bullet for `/posts/{platformSlug}/{postType}/{platformPostId}/events`] — full section read; route, reuse contract, PageHeader heading-copy requirement, Next/Previous context-inheritance requirement
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EVENT-CARD-DESIGN.md] — confirmed no new design tokens needed; this feature area's own change log confirms "No DESIGN.md changes — every contract reuses existing tokens"
- [Source: _bmad-output/implementation-artifacts/3-6u-show-all-source-posts-and-related-events-on-the-event-detail-page.md] — the direct, only prerequisite; `EventSourcePost`/`Query.relatedEventIds`/`postGroupingReasonToGraphQL` this story reuses and widens; its own scope note explicitly deferring the `postId` variant to this story
- [Source: apps/backend/src/schema/events.graphql, resolvers.ts:3777-3800, 4140-4228] — read in full/targeted ranges; exact current `relatedEventIds`/`sourcePosts` implementations
- [Source: packages/database/schema.ts:297-356] — `posts` table's exact current columns/indexes
- [Source: apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx, account-content.tsx] — the `generateMetadata`/route-structure precedent this story's new route mirrors
- [Source: apps/web/src/app/[locale]/favorites/favorites-content.tsx] — the frozen-ids-then-batch-fetch precedent
- [Source: apps/web/src/features/events/navigation-hook.ts] — the existing `'favorites'` branch this story's new `'post'` branch is a structural sibling of
- [Source: packages/ui/src/features/events/EventListView.tsx, packages/ui/src/core/page-header.tsx] — read in full; confirmed internal `GridContainer` usage and `PageHeader`'s prop shape
- [Source: packages/domain/src/scraper/platform-registry.ts] — `getPlatformSlug`/`getPlatformByCode`

## Global Rules References

- [x] `_bmad-output/project-context.md` — API Style (GraphQL; new/widened fields go through the existing backend layer); End-to-End Type Safety (both `codegen` commands); Database Indexing for Performance (AC8's new partial unique index); Page Containers & Grids (`PageContainer`/`GridContainer` reuse); Page Headers (`PageHeader` reuse, AC4); Context-Aware Detail Views (AC5); Dynamic Page Title & Meta Tags (AC6); Code Organization (no new `packages/domain`/`packages/ui` surface needed — pure consumer)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-30 Rule 11 (binds this story directly — ships the deferred `postId` variant); AD-16 (platform-prefixed slug segments the route reuses); AD-17 (batched-IN idiom, ordinary-resolver characterization)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds GraphQL fields/resolvers and one DB index only, no new infrastructure resource (no new queue, Lambda, or compute) — matches the no-new-infra precedent of 3.6u/0.i6c/0.i6g
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 cited from the batch readiness report (Epic-Level Sweep Mode); Gate 2 run fresh this session (no gap; one AC-wording addition folded in)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/database/schema.ts` — documentation-only index builder call on `posts` (Task 1).
  2. `packages/database/migrations/<next>.sql` (+ generated snapshot) — hand-edited partial unique index (Task 1).
  3. `apps/backend/src/schema/events.graphql` — widen `relatedEventIds`; add `postByPlatformIdentifiers` (Task 2).
  4. `apps/backend/src/schema/resolvers.ts` — new `postId` branch + exclusivity check on `relatedEventIds`; new `postByPlatformIdentifiers` resolver (Task 2).
  5. `apps/backend/src/generated/resolvers-types.ts` — regenerated (Task 2).
  6. `apps/backend/src/schema/resolvers.test.ts` — new test blocks (Task 3).
  7. `apps/backend/src/explain-events-queries.ts` — 2 new scenarios (Task 4).
  8. `_bmad-output/planning-artifacts/cc-024-explain-after-3.6x-<date>.md` — new (Task 4).
  9. `apps/web/src/features/events/queries.graphql` — 2 new documents (Task 5).
  10. `apps/web/src/generated/graphql.ts` — regenerated (Task 5).
  11. `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/page.tsx` — new (Task 6).
  12. `.../events/post-events-content.tsx` + test(s) — new (Task 6).
  13. `apps/web/src/features/events/navigation-hook.ts` — new `'post'` branch (Task 7).
  14. `navigation-hook.test.ts` (or equivalent existing coverage) — new tests (Task 7).
  15. `apps/web/locales/en.json`, `apps/web/locales/id.json` — new keys (Task 8).
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/3 → cited from batch readiness report (no gap); Gate 2 → fresh, no gap (one AC-wording addition folded into AC4/AC6).
  - AD-30 Rule 11 → AC1/AC2 implement the `postId` variant Story 3.6u deferred to this story.
  - AD-16 → the route's three segments and `getPlatformSlug`/`getPlatformByCode` reuse (AC3).
  - AD-17 → AC1/AC2's resolver shape stays an ordinary read, no new ad hoc data path (Gate 1 lightweight-guard reasoning).
  - `project-context.md`'s Database Indexing rule → AC8 (Design Decision #1).
  - `project-context.md`'s Context-Aware Detail Views rule → AC5 (Design Decision #2).
  - `project-context.md`'s Page Containers & Grids / Page Headers rules → AC4 (`PageContainer`/`GridContainer`-via-`EventListView`/`PageHeader` reuse, not a hand-rolled `<h1>` like the pre-`PageHeader`-era Account/Favorites precedents).
  - Data Type Compatibility rule (this workflow) → dedicated section above; one additive index migration, no new column.
  - Reusable-component/hook rules (this workflow) → no new candidate found (Gate 2); explicitly documented why.
- **Verification Plan:**
  - `pnpm --filter backend test`/`build`/`lint`; `pnpm --filter database test` (new index/migration test).
  - `pnpm --filter web test` (`post-events-content.test.tsx`, `navigation-hook.test.ts`/equivalent, full suite), `pnpm --filter web lint`, `pnpm --filter web build`.
  - Root `pnpm build`/`pnpm lint`/`pnpm test` (once) for cross-package regressions.
  - EXPLAIN-gate doc (Task 4) committed alongside the code change.
  - Manual sanity: open a seeded roundup post's collection page directly by URL; confirm Story 3.6u's "See all N events" link lands here with the matching list; confirm Next/Previous pages through this list's own context.

## Pre-Coding Approval Gate

- [x] Scope confirmation — Tasks 1-9 match the two user-decided design questions (partial unique index with mandatory dedupe check; frozen-ids-via-URL navigation context) plus the epics.md-specified AC text and the Gate-2-surfaced PageHeader heading-copy addition.
- [x] Architecture and boundary confirmation — new/widened fields and the new lookup go through the existing backend/GraphQL layer only; no new `packages/domain`/`packages/ui` surface (pure consumer); Gate 1/3 cited READY from the batch report, Gate 2 run fresh with no gap.
- [x] Testing plan confirmation — Tasks 3, 4, 6, 7 cover the new/widened resolvers, the EXPLAIN-gate extension, the new route/component, and the navigation-hook branch.
- [x] Explicit human approval state — approved by user via `AskUserQuestion` on 2026-10-05 (schema migration + UI design scope, per this project's Pre-Coding Approval Gate escalation rule).
- [x] **Gate 1/2/3 prerequisites confirmed done or gap accepted** — Gate 1/3: READY, cited from `epic-readiness/batch-cc-024-multi-event-readiness.md`, no action needed. Gate 2: no gap found this session. **Dependency confirmation:** Story 3.6u is at `review` status in `sprint-status.yaml` as of this story's creation — the standing rule (build against `review`-status prerequisites) applies, so no wait is required before `dev-story` begins.

## Testing Requirements

- [x] Backend integration tests — `resolvers.test.ts`'s new `Query.relatedEventIds (postId variant)`/`Query.postByPlatformIdentifiers` blocks (real-DB, Task 3).
- [x] Database/migration test — the new partial unique index's constraint behavior (Task 3).
- [x] Frontend unit/integration tests — `post-events-content.test.tsx` (render/loading/empty/error/pagination/`notFound()`), `navigation-hook.test.ts`/equivalent (new `'post'` branch) (Task 6, 7).
- [x] E2E — not required beyond the existing event-detail → Related Events → "See all N" → this page manual flow (no new critical-path E2E scenario introduced; this page is a thin reuse of already-E2E-covered list/navigation primitives).

## Deliverables Checklist

- [x] `Query.postByPlatformIdentifiers` and widened `Query.relatedEventIds` shipped, tested, codegen'd.
- [x] New partial unique index migration applied, with its mandatory pre-migration dedupe check documented.
- [x] `/posts/{platformSlug}/{postType}/{platformPostId}/events` route live, reusing `EventListView`/`PageContainer`/`PageHeader`/`useListPaginationController`/infinite scroll wholesale.
- [x] Next/Previous navigation from this page's events inherits this page's own list context.
- [x] EXPLAIN-gate doc for the 2 new queries, confirming no Seq Scan.
- [x] i18n keys added (`Metadata`, `PostCollectionPage` namespaces, both locales).

## Out of Scope

- No deferred scope — Gate 1/2/3 found no gap requiring a prerequisite story (see Architecture & UX Gate Findings above).
- Moderator suggested-match review / merge tooling (Story 3.6w, Story 4.7b surface) — unrelated to this story.
- Search/filter chrome (`EventDiscoveryPanel`, AI filter) — not named by this story's AC or EXPERIENCE.md §3; this page is a bounded, single-post event list, not a searchable catalog.
- Stub-event ("details coming") card treatment (EXPERIENCE.md §5) — unchanged by this story; `EventListView`/`EventCard`'s existing thumbnail-fallback handling already covers it generically for any event rendered through the shared card, including here.
- Re-verifying `Query.events`/`Query.eventBySlug`'s own hot-path per-row cost (AC7) — this story's resolvers never touch either.

## Definition of Done

- [x] AC1-AC9 satisfied.
- [x] Required tests passing (Task 3, 6, 7; root suite green or only pre-existing/known failures).
- [x] Lint and type checks passing for touched packages (`apps/backend`, `packages/database`, `apps/web`).
- [x] EXPLAIN-gate doc committed, both new queries index-driven with no Seq Scan.
- [x] Both `codegen` commands re-run cleanly, no hand-edits to generated files.

## Completion Status

- [x] Ready for review (dev complete 2026-10-05, batch-end pass 2026-10-06)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Agent SDK, bmad-dev-story skill)

### Debug Log References

- Pre-migration dedupe check (AC8/Task 1): `SELECT platform, platform_post_type, platform_post_id, count(*) FROM posts WHERE platform_post_id IS NOT NULL AND platform_post_type IS NOT NULL GROUP BY 1,2,3 HAVING count(*) > 1;` against the local dev DB returned **0 rows** — no blocking finding; migration proceeded.
- Migration generated via `pnpm --filter @festgrid/database generate` as the next sequential file, `migrations/0073_living_silver_sable.sql`; hand-edited only to add the `WHERE "platform_post_id" IS NOT NULL AND "platform_post_type" IS NOT NULL` predicate drizzle-kit 0.21.4 drops (AD-8 Rule 3/AD-30 Rule 1 precedent). Applied via `pnpm --filter @festgrid/database migrate`; confirmed via `psql \d posts` that the index carries the correct partial-index definition.
- Backend targeted test run: `cd apps/backend && TZ=UTC NODE_ENV=test npx tsx --test src/schema/resolvers.test.ts` → 113/113 pass (24 new assertions across the two new `Query.relatedEventIds (postId variant, Story 3.6x)`/`Query.postByPlatformIdentifiers (Story 3.6x)` blocks), 0 regressions.
- Database targeted test run: `cd packages/database && TZ=UTC NODE_ENV=test npx tsx --test unique-index.integration.test.ts` → 1/1 pass (real Postgres `23505` unique_violation on a duplicate triple; multiple NULL-triple rows allowed). Fixture rows self-deleted in a `finally` block; confirmed via direct `psql` count = 0 afterward.
- Web targeted test runs (vitest): `post-events-content.test.tsx` (5/5), `page.test.tsx` (8/8), `navigation-hook.test.ts` (6/6) — all green, run individually and combined.
- EXPLAIN gate (Task 4): `seed:volume` → extended `explain-events-queries.ts` run → `seed:volume:clean`, chained in one step per this environment's own guardrail (seed:volume is denied unless cleaned in the same step). Both new queries (`Query.relatedEventIds` postId variant, `Query.postByPlatformIdentifiers`) resolved in 0.1ms with **no Seq Scan**. Confirmed posts/events counts returned to the 35/12 seed baseline afterward, no residual `explain-probe-*` rows. Doc written: `_bmad-output/planning-artifacts/cc-024-explain-after-3.6x-2026-10-05.md`.
- Builds/lint run per-package (whole-repo `pnpm lint`/`pnpm build` denied by this environment's guardrail in favor of scoped commands): `pnpm --filter @festgrid/database build/lint` (clean, 0 warnings — package enforces `--max-warnings 0`), `pnpm --filter backend build/lint` (clean, pre-existing warnings only), `pnpm --filter web lint` (clean, pre-existing warnings only) and `NODE_USE_ENV_PROXY=1 pnpm --filter web build` (clean; new route appears in the build's own route manifest, no conflict with the existing `posts/select` route).
- Backend/web `codegen` re-runs both succeeded; diffs confirmed additive-only (new `postByPlatformIdentifiers`/widened `relatedEventIds` on the backend side; new `GetRelatedEventIdsByPostDocument`/`GetPostByPlatformIdentifiersDocument` hooks on the web side) — no hand-edits to either generated file.

### Completion Notes List

- AC1/AC2 (backend): added `Query.postByPlatformIdentifiers` resolver and widened `Query.relatedEventIds` with a new `postId` branch + `eventId`/`postId` exclusivity check (`GraphQLError`, `BAD_REQUEST`), per the exact queries/shapes specified. Existing `eventId` branch left byte-for-byte unchanged.
- AC8 (migration): partial unique index `posts_platform_post_identity_idx` added via drizzle-kit-generated migration 0073, hand-edited to restore the `WHERE` predicate, preceded by the mandatory dedupe check (0 duplicates found — proceeded as specified). `schema.ts` documentation-only builder call added matching the `hashtagsIdx` comment style.
- AC3/AC4/AC6 (frontend route): new `page.tsx` (`generateMetadata` + default export, mirrors the Account page's `notFound()`/`buildPageMetadata` structure exactly) and `post-events-content.tsx` (frozen-ids-then-batch-fetch via `useListPaginationController`/`useInfiniteScroll`/`EventListView`/`PageHeader`, reusing `EventDetailsPage.relatedEventsGroupLabel` verbatim for the heading per the Gate-2-surfaced AC4/AC6 addition). No search/filter chrome, no new copy string for the heading.
- AC5 (navigation): new `'post'` `fromList` branch on `useListNavigationForEvent`, a structural sibling of the existing `'favorites'` branch — `frozenPostEventIds`/`postEventIds` URL param, independent `useInfiniteQuery` batching `events(id in [...])`, `hasListContext = isPostContext && frozenPostEventIds.length > 0 && nav.hasContext`. The pre-existing `'favorites'`/generic branches are untouched (confirmed by dedicated non-interference tests).
- AC7 (EXPLAIN gate): both new/widened queries confirmed index-driven, no Seq Scan, sub-millisecond — see Debug Log References and the new dated doc.
- AC9 (i18n): `Metadata.postCollectionPageTitle`/`postCollectionPageDescription` and a new `PostCollectionPage` namespace (`errorState`/`emptyState`/`loadingMore`) added to both `en.json`/`id.json`. The on-page heading intentionally reuses `EventDetailsPage.relatedEventsGroupLabel`, not a new key (per AC4/AC9's explicit text).
- Both of the user's create-story decisions were implemented exactly as recorded: (a) partial unique index **with** the mandatory pre-migration duplicate check (ran clean, 0 duplicates); (b) Next/Previous nav context frozen into a `postEventIds` URL param mirroring the `favorites` branch structurally.
- Pre-Coding Approval Gate: this story carries both a schema migration (AC8) and new UI (AC3-AC5), so per this session's explicit instruction the gate was escalated to the user via `AskUserQuestion` (not self-approved by the orchestrator) — approved before any coding began.
- No new npm dependency, no new workspace package, no `packages/domain`/`packages/ui` surface added — confirmed pure-consumer scope per the story's own Project Structure Notes.
- Dev database left clean: the dedupe check was read-only; the new migration-safety test's fixture rows and the EXPLAIN gate's volume seed were both fully cleaned up and verified via direct `psql` counts (0 residual rows in both cases).

### File List

- `packages/database/schema.ts` — modified (documentation-only partial unique index builder call on `posts`).
- `packages/database/migrations/0073_living_silver_sable.sql` — new (drizzle-kit generated, hand-edited to restore the `WHERE` predicate).
- `packages/database/migrations/meta/0073_snapshot.json` — new (drizzle-kit generated).
- `packages/database/migrations/meta/_journal.json` — modified (drizzle-kit generated).
- `packages/database/unique-index.integration.test.ts` — new (real-DB migration-safety test for the new partial unique index).
- `apps/backend/src/schema/events.graphql` — modified (widened `relatedEventIds`; new `postByPlatformIdentifiers`).
- `apps/backend/src/schema/resolvers.ts` — modified (new `postId` branch + exclusivity check on `relatedEventIds`; new `postByPlatformIdentifiers` resolver).
- `apps/backend/src/schema/resolvers.test.ts` — modified (new `Query.relatedEventIds (postId variant, Story 3.6x)` and `Query.postByPlatformIdentifiers (Story 3.6x)` test blocks).
- `apps/backend/src/generated/resolvers-types.ts` — modified (codegen regenerated).
- `apps/backend/src/explain-events-queries.ts` — modified (2 new EXPLAIN scenarios for this story's queries).
- `_bmad-output/planning-artifacts/cc-024-explain-after-3.6x-2026-10-05.md` — new (EXPLAIN-gate doc, Task 4).
- `apps/web/src/features/events/queries.graphql` — modified (new `getRelatedEventIdsByPost`/`getPostByPlatformIdentifiers` documents).
- `apps/web/src/generated/graphql.ts` — modified (codegen regenerated).
- `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/page.tsx` — new (route: `generateMetadata` + default export).
- `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/post-events-content.tsx` — new (client content component).
- `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/page.test.tsx` — new.
- `apps/web/src/app/[locale]/posts/[platformSlug]/[postType]/[platformPostId]/events/post-events-content.test.tsx` — new.
- `apps/web/src/features/events/navigation-hook.ts` — modified (new `'post'` `fromList` branch).
- `apps/web/src/features/events/navigation-hook.test.ts` — new (dedicated `renderHook` coverage for the new branch and non-interference with existing branches).
- `apps/web/locales/en.json` — modified (new `Metadata`/`PostCollectionPage` keys).
- `apps/web/locales/id.json` — modified (new `Metadata`/`PostCollectionPage` keys).
- `apps/web/tsconfig.tsbuildinfo` — modified (build artifact, regenerated by `tsc`).

## Change Log

- 2026-10-05 — Story created via `bmad-create-story` (CC-024 Wave 5). Two design decisions resolved with the user via `AskUserQuestion` (partial unique index + mandatory dedupe check for the new post-identity lookup; frozen-ids-via-URL navigation context mirroring the existing `favoriteIds` pattern). Gate 1/3 cited from the swept `epic-readiness/batch-cc-024-multi-event-readiness.md` (READY, no gap); Gate 2 run fresh via `runSubagent` (no gap; one AC-wording addition — the `PageHeader` heading-copy convention — folded into AC4/AC6 directly rather than left as a silent drafting gap).
- 2026-10-05 — Story implemented via `bmad-dev-story` (all 9 tasks, AC1-AC9). Pre-Coding Approval Gate escalated to the user (schema migration + UI scope) and approved before coding began. Backend: new `Query.postByPlatformIdentifiers` resolver, widened `Query.relatedEventIds` with a `postId` branch. Database: partial unique index `posts_platform_post_identity_idx` (migration 0073), preceded by a clean (0-duplicate) mandatory dedupe check. Frontend: new Post Collection Page route reusing `EventListView`/`PageContainer`/`PageHeader`/pagination/infinite-scroll wholesale; new `'post'` navigation-context branch on `useListNavigationForEvent` mirroring `'favorites'`. EXPLAIN gate: both new queries confirmed index-driven, no Seq Scan (`cc-024-explain-after-3.6x-2026-10-05.md`). i18n keys added for both locales. All targeted tests pass (113 backend + 1 database + 19 web = 133 total, including this story's new coverage); scoped builds/lints clean for all three touched packages; dev database left clean (no residual ad-hoc rows). Status moved to `review`.
