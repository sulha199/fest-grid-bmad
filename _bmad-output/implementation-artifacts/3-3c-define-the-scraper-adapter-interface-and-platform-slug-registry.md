# Story 3.3c: Define the scraper adapter interface and platform-slug registry

---
baseline_commit: 18e220926cb1c193ce98ec76f03210186f218c1e
---

# Story 3.3c: Define the scraper adapter interface and platform-slug registry

## Story Details

- Epic: 3
- Story ID: 3.3c
- Status: review (AC9-12 amendment — video/DB/GraphQL plumbing per Sprint Change Proposal 2026-08-25, Track B, Wave 1; AC1-8 already delivered)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a generic `ScraperAdapter` interface (given a subscribed account, returns its newest posts with platform-specific `post_url`/`original_post_url` derivation) and a single platform-enum-to-URL-slug registry,
so that Story 3.4's per-platform scraping implementations and Story 3.11's public account-page routing both consume one shared abstraction instead of each independently inventing platform identification and slug logic.

## Acceptance Criteria

1. **Given** the PRD's requirement (§3.7) that scraping go through "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation," **when** a new platform's scraper is added, **then** it implements one shared `ScraperAdapter` interface: `getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]>`, where `ScrapedPost` sets `postUrl` to whatever URL was actually scraped (which may be a proxy/mirror, or, for a managed scraping-API adapter, the canonical URL the vendor itself resolves) and `originalPostUrl` when that platform's own derivation rule can determine the canonical original-platform URL. `ScrapedPost`'s shape (`content`, `imageUrl?`, `postUrl`, `originalPostUrl?`, `publishedAt`) matches `apps/backend/src/lib/posts/persist-scraped-post.ts`'s `PersistScrapedPostParams` exactly (minus `accountId`, which the caller supplies), so Story 3.4 can pipe an adapter's output directly into `persistScrapedPost` with no shape translation. The optional `options.newerThan` (ISO date string) lets the caller ask an adapter to only return posts published after a given cutoff, when the underlying platform/vendor API supports such a filter — an adapter that has no such native support is free to ignore it and return its normal result set (the caller is still responsible for not re-persisting duplicates, which `persistScrapedPost`'s dedup already handles regardless).
2. **And** a platform-enum-to-URL-slug registry (`PLATFORM_SLUGS`, e.g. `instagram -> 'ig'`, `twitter -> 'x'`) is defined exactly once, in the same shared location as the `ScraperAdapter` interface (`packages/domain/src/scraper/`), keyed by the existing `SupportedPlatform` enum (`packages/domain/src/subscriptions/platforms.ts`) — not a new, competing platform enum. It is the single source Story 3.11's `/{platformSlug}/{accountId}` routing resolves against (via a reverse `getPlatformByCode(slug)` lookup this story also provides) — not hardcoded per-component.
3. **And** a registration mechanism (`registerScraperAdapter(platform, adapter)` / `getScraperAdapter(platform)`) is provided so Story 3.4 can register concrete per-platform adapter instances against this shared registry, instead of each platform's implementation inventing its own lookup/dispatch mechanism. Calling `getScraperAdapter` for a platform with no registered adapter throws a clear error (`No scraper adapter registered for platform "<platform>"`) rather than returning `undefined` silently — expected/normal until Story 3.4 registers concrete adapters.
4. **And** this story builds the interface/registry scaffold only — the first concrete per-platform scraper implementation(s) remain Story 3.4's scope. No network calls, HTML parsing, or platform-specific scraping logic is implemented here.
5. **And** the registry also exposes a dispatching `lookupAccountProfile(platform: SupportedPlatform, handleOrUrl: string): Promise<AccountProfileLookupResult | null>` function (`AccountProfileLookupResult = { accountId: string; displayName: string; username: string; profileImageUrl?: string }`), which resolves the adapter for `platform` via the registry and delegates to that adapter's own `lookupAccountProfile(handleOrUrl)` interface method — a lightweight, on-demand existence-check + public-profile-metadata fetch, distinct from `getNewestPosts` (no posts are scraped, no AI extraction runs). Returns `null` when the platform reports no such account. This story defines the interface method's signature, the registry's dispatcher, and the "no adapter registered" error path only — the first concrete per-platform implementation(s) remain Story 3.4's scope, consistent with `getNewestPosts`.
6. **And** the registry also exposes `getPlatformDisplayName(platform: SupportedPlatform): string` (`instagram -> 'Instagram'`, `twitter -> 'Twitter/X'`), consolidating the platform-display-name formatting logic currently duplicated inline (with divergent conventions) across three call sites — `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`, `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`, and `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` — each of which is updated to call `getPlatformDisplayName` instead of its own inline `plat === 'twitter' ? 'Twitter/X' : plat.charAt(0).toUpperCase() + plat.slice(1)` ternary. Output text is unchanged (`'Instagram'`, `'Twitter/X'`) — this is a pure de-duplication, not a copy change.
7. **And** all new logic is added under the `./scraper` subpath export of `@festgrid/domain` (`packages/domain/package.json`, `packages/domain/src/index.ts`), matching the existing `./subscriptions`, `./geolocation`, `./ai-gateway` subpath-export pattern — not folded into the existing `./subscriptions` subpath, since scraping-mechanism concerns (this story) are a distinct domain area from the user's subscribe relationship (`packages/domain/src/subscriptions/`).
8. **And** `PLATFORM_SLUGS`, `PLATFORM_DISPLAY_NAMES`, `getPlatformSlug`, `getPlatformByCode`, and `getPlatformDisplayName` have exactly one entry per `SUPPORTED_PLATFORMS` member — a unit test asserts this coverage so that adding a new platform to `SUPPORTED_PLATFORMS` without updating the registry fails CI instead of silently producing an `undefined` slug/display name at runtime.
9. **And** (2026-08-26 amendment) `ScrapedPost` (`packages/domain/src/scraper/types.ts`) gains an optional `videoUrl?: string`, populated when the source post is a video (e.g. an Instagram Reel/clip — Apify's raw item carries a top-level `videoUrl` string alongside `"productType": "clips"`, confirmed directly against `_bmad-output/implementation-artifacts/apify-runs/run-fKvCBvXjZ7w9R9nFN.wanitatamajogja.md:146,154`). `apps/backend/src/lib/scraper/instagram-adapter.ts`'s `ApifyPostItem` interface gains `videoUrl?: string`, and `mapApifyItemToScrapedPost` conditionally spreads `...(item.videoUrl && { videoUrl: item.videoUrl })` into the candidate `ScrapedPost` — the exact same conditional-spread pattern the function already uses for `locationName`/`ownerFullName`/`ownerUsername`, so the field is only present when Apify actually returns it (never `undefined` explicitly, which would fail the AJV nullable check). Not scraped/mapped for `twitter-adapter.ts` — no confirmed raw video field for that platform's payload, out of scope.
10. **And** (2026-08-26 amendment) the AJV validation schema (`apps/backend/src/validation/scraped-post.schema.ts`, `scrapedPostSchema: JSONSchemaType<ScrapedPost>`) declares `videoUrl: { type: 'string', nullable: true }`, matching `imageUrl`'s existing declaration exactly — not added to `required` (it stays optional), and `additionalProperties: false` is left unchanged. Per `project-context.md`'s Runtime Schema Validation rule, this is the one AJV schema every Apify item passes through (`instagram-adapter.ts`'s module-scope `validateScrapedPost`) before persistence; without this change a scraped item's `videoUrl` would fail validation entirely (since `additionalProperties: false` rejects any key the schema doesn't declare) rather than merely being dropped.
11. **And** (2026-08-26 amendment) `packages/database/schema.ts`'s `posts` table gains a new nullable `videoUrl: text('video_url')` column, mirroring `imageUrl: text('image_url')`'s shape exactly (no `.notNull()`, no unique constraint, no index — same as `imageUrl` today). A Drizzle-kit-generated migration is produced (`pnpm --filter @festgrid/database generate`) and committed under `packages/database/migrations/`, per Architecture Spine AD-3 — following Story 3.4m's precedent migration (`0035_petite_black_tarantula.sql`'s plain `ALTER TABLE "posts" ADD COLUMN ... text;` shape) exactly. `apps/backend/src/lib/posts/persist-scraped-post.ts`'s `PersistScrapedPostParams` gains `videoUrl?: string | null`, threaded through the function's destructured parameters and into the `db.insert(posts).values({...})` call — the same three-spot pattern already used there for `locationName`/`ownerDisplayName`/`ownerUsername`; no other logic in the function (the dual-lookup, dedup, `onConflictDoNothing` behavior) changes.
12. **And** (2026-08-26 amendment) `apps/backend/src/schema/events.graphql`'s `Event` type gains `videoUrl: String`, positioned alongside the existing `imageUrl: String` field. Every resolver call site in `apps/backend/src/schema/resolvers.ts` that left-joins `posts` and selects `imageUrl: posts.imageUrl` to flatten it onto the `Event` row — the `events` list query, `event(id)`, `eventBySlug(slug)`, the soft-delete mutation's re-select, and `Report.event` (five sites total) — also selects `videoUrl: posts.videoUrl`. The `Event.videoUrl` field resolver is added next to the existing `imageUrl: (parent: any) => parent.imageUrl || null` resolver, in the identical `(parent: any) => parent.videoUrl || null` shape. `pnpm --filter backend codegen` is re-run afterward to regenerate `apps/backend/src/generated/resolvers-types.ts`. Per Architecture Spine AD-12 (2026-08-25), `videoUrl` is explicitly *not* re-hosted and carries no `videoUrlExpiresAt`/durable-copy logic — that AD binds only `imageUrl`'s durability; video is accepted as ephemeral by design, and durable-image re-hosting (Track A) is separate, unrelated story scope.

**Note:** Classified as a Gate 3 gap by the Epic 3 readiness re-sweep (`bmad-epic-readiness-check`, re-run 2026-08-07) — Story 3.4 requires a "platform-specific scraper adapter" and Story 3.11 requires a "platform-to-slug mapping...defined once in a shared location alongside the platform-specific scraper adapters," but no story built either the adapter interface or the registry; left alone, Story 3.4 would build both ad hoc as a byproduct of its own scraping work — the exact failure mode `story-split-gate.md` exists to catch. Kept inside Epic 3 (not promoted to Epic 0) since no other epic currently calls a social-media scraper or consumes the slug registry. Positioned after Story 3.3b and before Story 3.4, the first consumer. See `_bmad-output/planning-artifacts/epics.md#Story-3.3c` for the full original note and the amendment below.

**Amendment (Epic 6 readiness sweep, `bmad-epic-readiness-check`, 2026-08-08):** Added `lookupAccountProfile` to the shared interface/registry (AC5). Story 3.4's 2026-08-07 Forward note flagged that Story 3.1/3.2's subscribe forms need a lightweight account-validation capability distinct from the scheduled bulk-scrape, but left open whether it belongs on the interface (this story) or the bulk-scrape story (3.4) itself. The Epic 6 sweep found a second, independent consumer — Story 6.1's vote-for-a-new-account path (PRD §3.13, FR70) needs the identical capability at the same layer before Story 6.1 can ship as specified. Two independent consumers across two epics clears Gate 3's cross-epic reuse bar. Placed on the registry (this story) rather than Story 3.4, since it is a synchronous, on-demand, single-account lookup with a different call shape than 3.4's scheduled, bulk, multi-account scrape job. Story 3.1/3.2's own subscribe-form retrofit remains out of scope/deferred as before — this amendment only unblocks Story 6.1, which does depend on this interface method plus at least one concrete per-platform implementation from Story 3.4.

**Amendment (2026-08-08, added via `bmad-create-story` while drafting Story 3.4):** AC1's `getNewestPosts` signature is revised to `getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]>` (previously no second parameter). This story is already `review`/implemented (`packages/domain/src/scraper/types.ts` currently has the un-amended, no-`options` signature) — the interface amendment itself does not touch the shipped code as a side effect of drafting Story 3.4; instead, Story 3.4 carries its own task to make this small, additive, backward-compatible edit (a new optional parameter cannot break any existing caller) as part of its own implementation, rather than reopening this story. Motivation: Story 3.4's chosen Instagram scraping vendor (Apify) natively supports an `onlyPostsNewerThan` request parameter that avoids paying for/re-fetching posts already known to be stored, and the interface needs a generic (not Apify-specific) way for a caller to express that cutoff to whichever adapter is registered.

**Amendment (2026-08-26, Sprint Change Proposal 2026-08-25 — Track B, "video/DB/GraphQL plumbing"):** Adds AC9-12: `ScrapedPost`/`instagram-adapter.ts` gain a `videoUrl?: string` field sourced from Apify's raw `videoUrl` (present on Reel/clip posts, `"productType": "clips"`), the AJV schema is updated to allow it, `posts.video_url` (nullable, mirrors `image_url`) is added with a migration and threaded through `persistScrapedPost`, and `events.graphql`'s `Event` type + resolvers gain a flattened `videoUrl` field. This absorbs the previously-unticketed "new DB/GraphQL story" from the proposal's Section 2/4.5 directly into this story rather than splitting it out — per the proposal's own framing ("scraper parsing, DB column, and GraphQL exposure are one end-to-end plumbing change... too tightly coupled to split") and its explicit "PO's call at story-creation time" note, resolved here as: fold in. This amendment is Wave 1 of the proposal's Section 7 implementation-wave plan and has no dependency on Track A (image durability, Stories 0-33/3-6e/3-6f) or on the sibling Story 1.6a (video-capable `EventDetailView`) — both run concurrently against the same repo, unaffected by this story's scope.

**Also corrects a pre-existing documentation gap found while re-verifying this story's current state:** Story 3.4m (`bmad-correct-course`, 2026-08-24) already added `locationName`/`ownerDisplayName`/`ownerUsername` to `ScrapedPost`/`instagram-adapter.ts`/`persist-scraped-post.ts` in the *actual codebase* (confirmed via direct `Read` of all three files, 2026-08-26) — but this story file's own AC1/Task 1 text above was never updated to reflect that amendment; only `sprint-status.yaml`'s comment trail mentions it. Not fixed retroactively here (out of this amendment's scope), but noted so a future reader isn't confused when Tasks 8/9/11 below reference those three fields as the existing pattern being mirrored, despite AC1/Task 1's stale text not listing them.

## Tasks / Subtasks

- [x] Task 1: Create `packages/domain/src/scraper/types.ts` (AC: #1, #5)
  - [x] Define `ScraperAccountRef { accountId: string; username: string }` — the minimal per-account identifying info a scraper needs (platform-native ID + handle), independent of the internal DB uuid.
  - [x] Define `ScrapedPost { content: string; imageUrl?: string; postUrl: string; originalPostUrl?: string; publishedAt: string }` — matches `persist-scraped-post.ts`'s `PersistScrapedPostParams` minus `accountId`.
  - [x] Define `AccountProfileLookupResult { accountId: string; displayName: string; username: string; profileImageUrl?: string }`.
  - [x] Define `ScraperAdapter` interface: `getNewestPosts(account: ScraperAccountRef): Promise<ScrapedPost[]>` and `lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null>`.
- [x] Task 2: Create `packages/domain/src/scraper/platform-registry.ts` (AC: #2, #6, #8)
  - [x] Import `SUPPORTED_PLATFORMS`/`SupportedPlatform` from `../subscriptions/platforms.js` (do not redefine the platform enum).
  - [x] Define `PLATFORM_SLUGS: Record<SupportedPlatform, string>` (`instagram: 'ig'`, `twitter: 'x'`) and `PLATFORM_DISPLAY_NAMES: Record<SupportedPlatform, string>` (`instagram: 'Instagram'`, `twitter: 'Twitter/X'`).
  - [x] Implement `getPlatformSlug(platform: SupportedPlatform): string`, `getPlatformByCode(slug: string): SupportedPlatform | undefined` (reverse lookup, case-sensitive on the stored slug), `getPlatformDisplayName(platform: SupportedPlatform): string`.
- [x] Task 3: Create `packages/domain/src/scraper/adapter-registry.ts` (AC: #3, #5)
  - [x] Implement `registerScraperAdapter(platform: SupportedPlatform, adapter: ScraperAdapter): void` backed by a module-level `Map<SupportedPlatform, ScraperAdapter>`.
  - [x] Implement `getScraperAdapter(platform: SupportedPlatform): ScraperAdapter`, throwing `Error('No scraper adapter registered for platform "<platform>"')` when unregistered.
  - [x] Implement `lookupAccountProfile(platform: SupportedPlatform, handleOrUrl: string): Promise<AccountProfileLookupResult | null>` — resolves the adapter via `getScraperAdapter` and delegates to `adapter.lookupAccountProfile(handleOrUrl)`.
- [x] Task 4: Wire up `packages/domain/src/scraper/index.ts`, `packages/domain/src/index.ts`, `packages/domain/package.json` (AC: #7)
  - [x] `scraper/index.ts` re-exports `types.ts`, `platform-registry.ts`, `adapter-registry.ts`.
  - [x] Add `export * from "./scraper/index.js";` to `packages/domain/src/index.ts`.
  - [x] Add a `"./scraper"` entry to `packages/domain/package.json`'s `exports` map, matching the existing `./subscriptions`/`./geolocation` entries exactly (`types`/`default` pointing at `./dist/scraper/index.d.ts` / `./dist/scraper/index.js`).
- [x] Task 5: Unit tests for `packages/domain/src/scraper/` — 100% coverage per `project-context.md`'s Testing Rules (AC: #1, #2, #3, #5, #6, #8)
  - [x] `platform-registry.test.ts`: every `SUPPORTED_PLATFORMS` member has a `PLATFORM_SLUGS`/`PLATFORM_DISPLAY_NAMES` entry (AC8's coverage guard); `getPlatformSlug`/`getPlatformDisplayName` round-trip for each platform; `getPlatformByCode` resolves known slugs and returns `undefined` for an unknown slug.
  - [x] `adapter-registry.test.ts`: `getScraperAdapter` throws for an unregistered platform; `registerScraperAdapter` + `getScraperAdapter` round-trip with a fake in-test `ScraperAdapter`; `lookupAccountProfile` delegates to the registered adapter's own method and propagates `null`/a resolved value correctly; `lookupAccountProfile` throws the same "not registered" error as `getScraperAdapter` when nothing is registered for the platform.
  - [x] Use `node:test`/`node:assert` matching this package's existing convention (`platforms.test.ts`), not `vitest` (`packages/domain`'s `test` script is `tsx --test src/**/*.test.ts`).
- [x] Task 6: Consolidate the three duplicated inline platform-display-name call sites (AC: #6)
  - [x] `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`: replace `{plat === 'twitter' ? 'Twitter/X' : plat.charAt(0).toUpperCase() + plat.slice(1)}` with `{getPlatformDisplayName(plat)}`, importing `getPlatformDisplayName` from `@festgrid/domain/scraper` alongside the existing `SUPPORTED_PLATFORMS`/`parseSocialMediaAccountHandle` import from `@festgrid/domain/subscriptions`.
  - [x] `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`: same replacement.
  - [x] `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx`: same replacement for its platform-tag `<span>` badge (`{sub.account.platform === "twitter" ? "Twitter/X" : ...}`).
  - [x] Confirm no existing test asserts on the old inline-ternary output text (`onboarding-subscribe-step.test.tsx`, `subscriptions-content.test.tsx` — both checked during story creation; neither currently does) — no test changes expected, but re-run both suites to confirm.
- [x] Task 7: `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions.

- [ ] **Task 8 (Amendment): Scraper — map `videoUrl` from Apify** (AC: #9)
  - [ ] Add `videoUrl?: string` to `ApifyPostItem` (`apps/backend/src/lib/scraper/instagram-adapter.ts`, alongside `locationName`/`ownerFullName`/`ownerUsername`, ~lines 38-57).
  - [ ] Add `videoUrl?: string` to the domain `ScrapedPost` interface (`packages/domain/src/scraper/types.ts`).
  - [ ] In `mapApifyItemToScrapedPost`, add `...(item.videoUrl && { videoUrl: item.videoUrl })` to the `candidate` object (~lines 218-228), mirroring the `locationName`/`ownerFullName`/`ownerUsername` spreads exactly.
  - [ ] Update `instagram-adapter.test.ts`'s `mapApifyItemToScrapedPost maps Apify item correctly` test (and the `getNewestPosts` mapping test) to include a `videoUrl`/`productType: 'clips'` field on the mock Apify item and assert `result.videoUrl` maps through; add a companion case confirming a non-video item (no `videoUrl` in the raw payload) maps to `result.videoUrl === undefined`.
- [ ] **Task 9 (Amendment): AJV validation schema** (AC: #10)
  - [ ] `apps/backend/src/validation/scraped-post.schema.ts`: add `videoUrl: { type: 'string', nullable: true }` to `scrapedPostSchema.properties`, not added to `required`.
  - [ ] Add a targeted test case (in `instagram-adapter.test.ts` or `validate.test.ts`, whichever already covers `scrapedPostSchema` validation) confirming a `ScrapedPost` including `videoUrl` passes validation, and one with an unexpected extra key still fails under `additionalProperties: false` (regression guard that the schema edit didn't loosen validation further than intended).
- [ ] **Task 10 (Amendment): Database — `posts.video_url` column + migration** (AC: #11)
  - [ ] `packages/database/schema.ts`: add `videoUrl: text('video_url'),` to the `posts` table definition, directly below `imageUrl: text('image_url'),`.
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the Drizzle-kit migration SQL file; commit it under `packages/database/migrations/`.
  - [ ] Apply the migration against the local Postgres dev DB (`pnpm --filter @festgrid/database migrate`) and confirm it applies cleanly with no manual SQL edits needed.
- [ ] **Task 11 (Amendment): Persist scraped video URL** (AC: #11)
  - [ ] `apps/backend/src/lib/posts/persist-scraped-post.ts`: add `videoUrl?: string | null` to `PersistScrapedPostParams`, the function's destructured parameters, and the `db.insert(posts).values({...})` call — same three-spot pattern as `locationName`/`ownerDisplayName`/`ownerUsername`.
  - [ ] Extend `persist-scraped-post.test.ts` with a case asserting a persisted post's `videoUrl` round-trips through the DB read-back, alongside a case confirming an omitted `videoUrl` persists as `null`.
- [ ] **Task 12 (Amendment): GraphQL — expose and flatten `videoUrl` on `Event`** (AC: #12)
  - [ ] `apps/backend/src/schema/events.graphql`: add `videoUrl: String` to the `Event` type, directly below `imageUrl: String`.
  - [ ] `apps/backend/src/schema/resolvers.ts`: add `videoUrl: posts.videoUrl` to each of the five `Event`-flattening select blocks that currently include `imageUrl: posts.imageUrl` (the `events` list query ~L2556, `event(id)` ~L2672, `eventBySlug(slug)` ~L2748, the soft-delete mutation's re-select ~L1420, and `Report.event` ~L2929).
  - [ ] Add `videoUrl: (parent: any) => parent.videoUrl || null,` to the `Event` resolver map, directly below the existing `imageUrl: (parent: any) => parent.imageUrl || null,` (~L2962).
  - [ ] Run `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts`.
  - [ ] Extend `resolvers.test.ts`'s `eventBySlug` query test to request `videoUrl` in the GraphQL query string and assert the response includes the field (expected `null` for existing seed data — this only confirms the field resolves without error).
  - [ ] Confirm `pnpm --filter web codegen` still runs cleanly with no changes required to any existing `.graphql` document (apps/web has no query selecting `videoUrl` yet — Story 1.6's separate scope) — a no-op verification, not new generated output.
- [ ] **Task 13 (Amendment): Full verification** (AC: #9, #10, #11, #12)
  - [ ] `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions across `packages/domain`, `packages/database`, `apps/backend`, `apps/web`.
  - [ ] Confirm the new migration is the only new file under `packages/database/migrations/` and that `packages/database/migrations/meta/_journal.json` was updated by `drizzle-kit generate` (not hand-edited).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, explicitly lists `3.3c` in `stories_covered`). This story **is** one of that sweep's two Gate 3 findings ("Gap found: no story owns the scraper adapter interface or the platform-slug registry both Story 3.4 and Story 3.11 assume exist" → "Classification: Shared-abstraction gap, needed by two stories within this epic → new Story 3.3c"). No Gate 1 concern applies — this story adds zero API surface, zero DB access, zero external-service calls; it is pure `packages/domain` types/data/registry code, consumed by future stories (3.4/3.11/6.1) that will themselves go through the mandated layers when they land.
  - **Amendment cross-check:** the Epic 6 readiness sweep (2026-08-08) later amended this story's scope to add `lookupAccountProfile` (AC5) after confirming a second, independent consumer (Story 6.1's `castVote` new-account path) — already folded into the AC list above, not a fresh gap found during this story's own creation.
  - **Lightweight guard (fresh, story-specific) — found three items the epic-wide sweep and epics.md's own AC text did not fully anticipate, all resolved with the user via `AskUserQuestion` before this story was drafted:**
    1. **Where the new code should live.** Neither `epics.md` nor the readiness report specifies a folder — only "the same shared location as the ScraperAdapter interface." **User confirmed:** a new `packages/domain/src/scraper/` domain folder (not an extension of `packages/domain/src/subscriptions/`), since scraping-mechanism concerns are a distinct domain area from the user's subscribe relationship; it re-exports/reuses `SUPPORTED_PLATFORMS` from `subscriptions/platforms.ts` rather than duplicating the platform enum (AC7).
    2. **Twitter's URL slug value.** `epics.md` only gives one worked example (`Instagram -> 'ig'`); no source names Twitter's slug. **User confirmed:** `'x'`, matching the platform's real-world rebrand (the app's existing UI code already displays it as "Twitter/X").
    3. **Whether to also own a display-name map.** While reading the three real consumers of `SUPPORTED_PLATFORMS` in `apps/web` (not just the epics.md-named ones), found the *exact same* inline `plat === 'twitter' ? 'Twitter/X' : plat.charAt(0).toUpperCase() + plat.slice(1)` ternary duplicated across `onboarding-subscribe-step.tsx`, `subscribe-account-dialog.tsx`, and `subscriptions-content.tsx`'s platform-tag badge — three independent copies of the same formatting rule, not specified by this story's AC. **Correction to an earlier framing during story creation:** an initial `Grep`-tool read of these files rendered the string as `"Twitter\X"`, which looked like a real escape-sequence bug; a direct file `Read` afterward confirmed the source actually reads `"Twitter/X"` correctly in all three files — there is no bug, only duplication. **User confirmed (after this correction):** still worth consolidating into this story's registry (AC6/Task 6), since this story is already the natural, single home for platform-derived display strings and the duplication itself (independent of the non-existent bug) is exactly the kind of "each independently inventing platform identification... logic" this story's own `So that` clause exists to prevent.
  - **A fourth item, mechanical, no question needed:** the registry's "no adapter registered" error path (AC3/AC5) has no concrete adapter to actually return until Story 3.4 lands — this is expected, not a gap; Story 3.4's own `Depends on: Story 3.3c` line and Forward note already anticipate this story shipping the scaffold first.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona review (this story postdates the swept sweep). **Verdict: No gap.** This story renders no UI, no page, no component, no hook — it is a pure TypeScript interface and data registry in `packages/domain`. Confirmed via a `design-artifacts/` grep that no UX spec even mentions "scraper"/"ScraperAdapter". Task 6's three call-site edits are minimal, single-line swaps of already-existing inline logic for a shared function call — not new UI, not a new reusable component, and each call site already renders inside an established page (Story 3.1/3.1/3.2's onboarding wizard step and subscriptions page), so none of Gate 2's three triggers (reusable component with non-trivial states, complex shared hook/util, missing UX-spec detail) apply.

**Amendment (2026-08-26) Gate Findings — AC9-12:**

- **Gate 1 (Architecture/Infra Completeness):** No gap. Every new element (a domain-object field, an AJV schema property, a nullable DB column via the existing Drizzle-kit migration pipeline, a GraphQL field flattened via the existing `posts` left-join + field-resolver pattern) reuses an already-established layer 1:1 — none of it invents new architecture, bypasses `apps/backend`'s GraphQL layer, or calls an external service directly from the frontend. Evaluated via the lightweight guard rather than a fresh Winston-persona subagent dispatch: the absorb-vs-split decision this amendment implements was already made and approved in the Sprint Change Proposal itself (`sprint-change-proposal-2026-08-25-video-priority-display.md` Section 4.5), and the shape of every change here is a direct mechanical mirror of `imageUrl`'s already-shipped, already-reviewed pattern — the same reasoning that justified not re-running Gate 1 for the `locationName`/`ownerFullName`/`ownerUsername` precedent (Story 3.4m) this amendment mirrors.
- **Gate 2 (UI Complexity & Reusability):** No gap — zero UI surface. This amendment is entirely `packages/domain`/`packages/database`/`apps/backend`. The video-capable `EventDetailView`/`EventImage` UI component is Story 1.6a's separate, already-reopened amendment (a concurrent sibling, not this story's scope), and wiring the GraphQL field through to the frontend query is Story 1.6's separate, already-reopened amendment.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** No gap. This amendment depends only on already-established foundational infrastructure: the Drizzle-kit migration pipeline (Story 0.4), the GraphQL Code Generator pipeline (Story 0.8), and AJV runtime validation (Story 0.11) — no new foundational/cross-cutting dependency is introduced.
- **AD-12 cross-check (Architecture Spine, 2026-08-25):** AD-12 ("Durable Media Re-hosting for Scraped Post Images") explicitly excludes `posts.videoUrl` from its scope ("Does not bind `posts.videoUrl` — video is explicitly accepted as ephemeral"). Confirmed this amendment adds no `videoUrlExpiresAt`/durable-video-copy logic, consistent with that AD.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** This story introduces no database schema, no new DB columns, and no new GraphQL types/fields — `social_media_account_profiles.platform` and `posts.{content,image_url,post_url,original_post_url,published_at}` (both already `text`/nullable-correct per `packages/database/schema.ts`) are read-only reference points for this story's TypeScript shapes; nothing here writes to or migrates them.
- **Impacted fields/contracts:** New TypeScript-only additions to `@festgrid/domain`'s public surface (`./scraper` subpath: `ScraperAdapter`, `ScrapedPost`, `ScraperAccountRef`, `AccountProfileLookupResult`, `PLATFORM_SLUGS`, `PLATFORM_DISPLAY_NAMES`, `getPlatformSlug`, `getPlatformByCode`, `getPlatformDisplayName`, `registerScraperAdapter`, `getScraperAdapter`, `lookupAccountProfile`). No changes to `packages/shared-types`, `packages/database/schema.ts`, or any `.graphql` schema file — this story adds a compile-time contract only, not a runtime data contract.
- **Required DB migration changes:** No changes required — no schema touched.
- **Required TypeScript type changes:** New exports only (additive), listed above; `ScrapedPost`'s field names/optionality were deliberately matched 1:1 against `apps/backend/src/lib/posts/persist-scraped-post.ts`'s existing `PersistScrapedPostParams` (minus `accountId`) so Story 3.4 needs zero adapter-to-persistence shape translation when it lands.
- **Backward compatibility and rollout notes:** Purely additive — a new `packages/domain` subpath, no existing export removed or changed in shape. The three `apps/web` call-site edits (Task 6) are behavior-preserving (identical rendered text, `'Instagram'`/`'Twitter/X'`), verified against both components' existing tests (neither asserts the old inline-ternary text) before this story's creation.
- **Verification checks:** Task 5's new `packages/domain/src/scraper/*.test.ts` (100% coverage per Testing Rules); Task 6's re-run of `onboarding-subscribe-step.test.tsx` and `subscriptions-content.test.tsx` to confirm no regression from the call-site swap; `pnpm build` across `packages/domain` and `apps/web` to confirm the new `./scraper` subpath resolves correctly from both consumers (Task 7).

**Amendment (2026-08-26) — AC9-12:**

- **Mismatch found:** `videoUrl` does not yet exist on `ScrapedPost` (`packages/domain/src/scraper/types.ts`), the AJV `scrapedPostSchema`, `packages/database/schema.ts`'s `posts` table, `apps/backend/src/schema/events.graphql`'s `Event` type, or the generated `resolvers-types.ts` — confirmed via direct `Read` of all five (2026-08-26), matching the proposal's own Section 1.1 evidence table.
- **Impacted fields/contracts:** `ScrapedPost.videoUrl?: string` (new); `scrapedPostSchema.properties.videoUrl` (new, `{ type: 'string', nullable: true }`); `posts.videoUrl` / DB column `video_url` (new, nullable `text`); `PersistScrapedPostParams.videoUrl?: string | null` (new); GraphQL `Event.videoUrl: String` (new); `Event.videoUrl` field resolver (new).
- **Required DB migration changes:** One additive Drizzle-kit-generated migration, `ALTER TABLE "posts" ADD COLUMN "video_url" text;` — no backfill needed (nullable, defaults `NULL` for every existing row), no index, no `NOT NULL` constraint — mirrors `image_url` exactly.
- **Required TypeScript/GraphQL type changes:** `ScrapedPost` (packages/domain), `PersistScrapedPostParams` (apps/backend), `scrapedPostSchema` (AJV, apps/backend), `events.graphql`'s `Event` type + `apps/backend/src/generated/resolvers-types.ts` (regenerated via `pnpm --filter backend codegen`, not hand-edited).
- **Backward compatibility and rollout notes:** Purely additive and nullable at every layer — no existing row, query, or consumer breaks. Every existing post/event without a video continues to resolve `videoUrl: null` (via the same `parent.videoUrl || null` fallback `imageUrl` already uses), matching how `locationName`/`ownerDisplayName`/`ownerUsername` rolled out under Story 3.4m. No `apps/web` query currently selects `videoUrl` (Story 1.6's separate scope), so `apps/web`'s own `pnpm --filter web codegen` run is expected to be a no-op confirmation, not a source of new generated types.
- **Verification checks:** Task 8's adapter-mapping test; Task 9's AJV pass/fail cases; Task 10's migration-applies-cleanly check against local Postgres; Task 11's persist round-trip test; Task 12's GraphQL integration-test case plus both apps' `codegen` runs; Task 13's full-repo `pnpm build`/`lint`/`test`.

### Project Structure Notes

- New: `packages/domain/src/scraper/{types.ts, platform-registry.ts, adapter-registry.ts, index.ts, platform-registry.test.ts, adapter-registry.test.ts}`.
- Modified: `packages/domain/src/index.ts` (new `export *`); `packages/domain/package.json` (new `./scraper` exports entry); `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`; `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`; `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx`.
- Not modified: `packages/domain/src/subscriptions/*` (reused as-is — `SUPPORTED_PLATFORMS`/`SupportedPlatform` imported, not redefined); `packages/database/schema.ts`; any `.graphql` schema file; `apps/backend` (this story has no backend resolver/adapter surface — that begins with Story 3.4).
- Matches the project's established multi-subpath `packages/domain` package pattern (`./subscriptions`, `./geolocation`, `./ai-gateway`, `./email`, `./user-locations`, `./user-settings`, `./events`, `./query`, `./calendar`) — `./scraper` is the next entry in that same list, not a special case.
- **No conflicts detected.** This story only adds new files and touches three `apps/web` call sites with a behavior-preserving swap; it does not modify any in-flight story's files (Story 3.4/3.11/6.1, this story's consumers, are all still `backlog`).

**Amendment (2026-08-26) Project Structure Notes — AC9-12:**

- New: one Drizzle migration file under `packages/database/migrations/` (name assigned by `drizzle-kit generate` at implementation time, e.g. `0036_*.sql`).
- Modified: `packages/domain/src/scraper/types.ts` (`ScrapedPost.videoUrl?`); `apps/backend/src/lib/scraper/instagram-adapter.ts` (`ApifyPostItem.videoUrl?`, `mapApifyItemToScrapedPost`); `apps/backend/src/lib/scraper/instagram-adapter.test.ts`; `apps/backend/src/validation/scraped-post.schema.ts`; `packages/database/schema.ts` (`posts.videoUrl`); `apps/backend/src/lib/posts/persist-scraped-post.ts` (`PersistScrapedPostParams.videoUrl?`); `apps/backend/src/lib/posts/persist-scraped-post.test.ts`; `apps/backend/src/schema/events.graphql` (`Event.videoUrl`); `apps/backend/src/schema/resolvers.ts` (5 select sites + 1 field resolver); `apps/backend/src/schema/resolvers.test.ts`; `apps/backend/src/generated/resolvers-types.ts` (regenerated, not hand-edited).
- Not modified: `apps/backend/src/lib/scraper/twitter-adapter.ts` (no confirmed video field for that platform's raw payload); anything under Track A (`posts.durableImageUrl`, `posts.imageUrlExpiresAt`, any S3/CloudFront infra); `packages/ui`/`apps/web` UI or query files (Stories 1.6a/1.6's separate scope, not this story).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3c] — this story's authoritative AC and both notes (original Gate 3 finding + Epic 6 `lookupAccountProfile` amendment).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4] — first consumer of `ScraperAdapter`/`getNewestPosts`; its `Depends on: Story 3.3c` line and Forward note (account-validation-on-subscribe, deferred) this story's `lookupAccountProfile` addition partially unblocks for a future story.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.11] — second consumer, of the platform-slug registry (`/{platformSlug}/{accountId}` routing) via `getPlatformByCode`.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.1a] — third consumer (`castVote`'s new-account path), explicitly citing "the registry's `lookupAccountProfile` method (Story 3.3c amendment...)" — confirms `lookupAccountProfile` is a registry-level dispatcher, not a bare per-adapter-instance method with no platform argument.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep that created this story (`stories_covered` includes `3.3c`; full Gate 3 finding text and numbering rationale quoted above).
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.7] — "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation," this story's core requirement.
- [Source: packages/domain/src/subscriptions/platforms.ts, packages/domain/src/subscriptions/parse-account-handle.ts] — the existing `SUPPORTED_PLATFORMS`/`SupportedPlatform` enum this story imports rather than redefines; confirms today's supported platforms are `['instagram', 'twitter']`.
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts] — `PersistScrapedPostParams`'s exact shape (`accountId`, `content`, `imageUrl?`, `postUrl`, `originalPostUrl?`, `publishedAt`), which `ScrapedPost` (minus `accountId`) is deliberately matched against for zero-translation piping in Story 3.4.
- [Source: apps/web/src/features/onboarding/onboarding-subscribe-step.tsx, apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx, apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx] — the three duplicated inline platform-display-name call sites this story consolidates (Task 6); confirmed via direct `Read` (not just `Grep`) that all three already correctly render `"Twitter/X"` — no pre-existing bug, only duplication.
- [Source: packages/domain/package.json, packages/domain/src/index.ts] — the existing multi-subpath export pattern (`./subscriptions`, `./geolocation`, `./ai-gateway`, etc.) this story's new `./scraper` subpath follows exactly.
- [Source: _bmad-output/project-context.md#Code-Organization] — `packages/domain` must stay pure/dependency-free of DB/ORM/Node-runtime-only modules and free of React; this story's interface/registry code is plain TypeScript with no such dependency, so it stays in `packages/domain` without any of the split/documentation carve-outs that rule requires for DB/Node-coupled logic.
- [Source: _bmad-output/project-context.md#Testing-Rules] — "All logic exported from `packages/domain` must have 100% unit test coverage. This is the only place where unit tests should be written." — governs Task 5.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-video-priority-display.md#Section-1.1,#Section-2,#Section-4.5] — this amendment's authoritative scope and evidence (Apify payload confirmation, story-impact rows, exact file change list).
- [Source: _bmad-output/implementation-artifacts/apify-runs/run-fKvCBvXjZ7w9R9nFN.wanitatamajogja.md:146,154] — confirms the raw Apify item's `videoUrl` field shape (a top-level string URL, paired with `"productType": "clips"`), verified directly for this amendment.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12] — confirms `posts.videoUrl` is explicitly out of AD-12's binding scope (video accepted as ephemeral, no durable re-hosting).
- [Source: apps/backend/src/schema/resolvers.ts:1415-1428,2552-2564,2668-2680,2743-2756,2921-2937,2962] — the five `Event`-flattening select sites plus the `Event.imageUrl` field resolver this amendment mirrors for `videoUrl`.
- [Source: packages/database/migrations/0035_petite_black_tarantula.sql] — Story 3.4m's precedent migration (`ALTER TABLE "posts" ADD COLUMN ...`), the exact DDL shape this amendment's new migration follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain vs UI: pure, dependency-free logic in `packages/domain`, organized by domain sub-folder — this story adds a new `scraper/` sub-folder); Testing Rules (100% unit coverage requirement for `packages/domain` exports); General Architecture (Adapter Pattern for external services — this story defines the adapter *contract* Story 3.4's concrete Gemini-style adapters will implement).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD-1 through AD-8 rule is directly engaged (no DB, no GraphQL, no soft-delete, no auth) — this story is pure `packages/domain` scaffold; confirmed no architecture-spine rule applies rather than silently skipping the reference.
- [x] `docs/infrastructure/index.md` — no infra/deployment change in this story (no Lambda, no queue, no new AWS resource; this is a monorepo-internal package addition only).
- [x] **(Amendment, 2026-08-26)** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (Drizzle-kit-generated migrations, committed — governs Task 10's `posts.video_url` migration); AD-12 (confirmed out of scope for `videoUrl` — video accepted as ephemeral, no durable re-hosting logic added here). `docs/infrastructure/index.md` still N/A — no new Lambda/queue/AWS resource, only an additive DB column and a GraphQL field on already-provisioned infrastructure.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/domain/src/scraper/types.ts`; `packages/domain/src/scraper/platform-registry.ts`; `packages/domain/src/scraper/platform-registry.test.ts`; `packages/domain/src/scraper/adapter-registry.ts`; `packages/domain/src/scraper/adapter-registry.test.ts`; `packages/domain/src/scraper/index.ts`.
- **Modified:** `packages/domain/src/index.ts` (new `export * from "./scraper/index.js"`); `packages/domain/package.json` (new `./scraper` exports entry); `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`; `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`; `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` (all three: swap inline ternary for `getPlatformDisplayName`, add the `@festgrid/domain/scraper` import).
- **Not modified:** `packages/domain/src/subscriptions/*`; `packages/database/schema.ts`; any `.graphql` schema/resolver file; `apps/backend`; `packages/shared-types`.

### Rule Mapping

- Pure, dependency-free domain logic organized by sub-folder → `project-context.md` Code Organization → Tasks 1-3 (`packages/domain/src/scraper/`).
- New domain sub-folder gets its own `package.json` subpath export, matching the existing multi-subpath pattern → `project-context.md` UI/package conventions (adapter-pattern precedent: `./ai-gateway`, `./geolocation`, `./email`) → Task 4.
- 100% unit test coverage for all `packages/domain` exports → `project-context.md` Testing Rules → Task 5.
- Adapter Pattern for external services → `project-context.md` General Architecture → `ScraperAdapter` interface (Task 1) is the contract Story 3.4's concrete per-platform adapters implement, mirroring Story 0.13's AI Gateway Adapter precedent.
- Reuse over reinvention (`SUPPORTED_PLATFORMS`, `PersistScrapedPostParams`'s shape) → this story's Gate Findings + `AskUserQuestion` decisions → Tasks 1, 2.
- Story-split-gate Gate 3 shared-abstraction requirement (one registry, not per-story reinvention) → `story-split-gate.md` → Tasks 2, 3 (`PLATFORM_SLUGS`, `registerScraperAdapter`/`getScraperAdapter`).
- Duplicated UI logic consolidated into the shared domain layer instead of left triplicated → this story's own `So that` clause + user-confirmed scope (AskUserQuestion) → AC6, Task 6.

### Verification Plan

- `packages/domain/src/scraper/platform-registry.test.ts`, `adapter-registry.test.ts` (new, `node:test`): 100% coverage of every exported function/constant, including the AC8 coverage-guard test and the "no adapter registered" error path (Task 5).
- `apps/web/src/features/onboarding/onboarding-subscribe-step.test.tsx` and `apps/web/.../subscriptions-content.test.tsx` (existing, re-run unmodified): confirm no regression from the Task 6 call-site swap.
- `pnpm build` (root): confirms the new `./scraper` subpath compiles and resolves correctly from `apps/web`'s three updated import sites.
- `pnpm lint` (root): confirms new files pass `@festgrid/eslint-config`.
- `pnpm test` (root): full suite, no regressions.

### Amendment (2026-08-26) — AC9-12

- **File Change Plan:** New: one Drizzle migration under `packages/database/migrations/`. Modified: `packages/domain/src/scraper/types.ts`; `apps/backend/src/lib/scraper/instagram-adapter.ts` (+ its test); `apps/backend/src/validation/scraped-post.schema.ts`; `packages/database/schema.ts`; `apps/backend/src/lib/posts/persist-scraped-post.ts` (+ its test); `apps/backend/src/schema/events.graphql`; `apps/backend/src/schema/resolvers.ts` (+ its test); `apps/backend/src/generated/resolvers-types.ts` (regenerated).
- **Rule Mapping:** Runtime Schema Validation (AJV at entry) → `project-context.md` → Task 9. Drizzle-kit-generated, committed migrations → AD-3 → Task 10. GraphQL Code Generator end-to-end type safety → `project-context.md` → Task 12's codegen re-run. Reuse over reinvention (`imageUrl`'s already-shipped DB/GraphQL/resolver pattern, `locationName`/`ownerFullName`/`ownerUsername`'s adapter-mapping pattern) → this amendment's Gate 1 finding → Tasks 8-12.
- **Verification Plan:** Task 8's adapter-mapping test extension; Task 9's AJV pass/fail cases; Task 10's `pnpm --filter @festgrid/database migrate` clean-apply check; Task 11's persist round-trip test; Task 12's `resolvers.test.ts` extension plus both apps' `codegen` runs; Task 13's full `pnpm build`/`lint`/`test`.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the `ScraperAdapter`/`ScrapedPost`/`ScraperAccountRef`/`AccountProfileLookupResult` TypeScript contracts, the platform-slug/display-name registry, and the adapter registration/dispatch mechanism (including `lookupAccountProfile`'s dispatcher) in a new `packages/domain/src/scraper/` folder — plus a pure de-duplication of three existing `apps/web` inline platform-display-name call sites onto the new `getPlatformDisplayName`. It does **not** implement any concrete per-platform scraper (Story 3.4), does not change any DB schema or GraphQL surface, and does not retrofit Story 3.1/3.2's subscribe forms with live account validation (still deferred, per Story 3.4's existing Forward note).
- [ ] Architecture and boundary confirmation: all new code is pure, dependency-free TypeScript confined to `packages/domain` (no React, no DB/ORM, no Node-runtime-only modules) per the Code Organization rule; the new `./scraper` subpath follows the existing multi-subpath export pattern exactly; no `apps/backend` or `apps/web` code writes to the DB or calls an external service as part of this story.
- [ ] Testing plan confirmation: 100% unit coverage on all new `packages/domain/src/scraper/` exports (Task 5); existing `apps/web` tests re-run, unmodified, to confirm the Task 6 call-site swap is behavior-preserving.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` — this story **is** that sweep's own Gate 3 finding, so there is no further prerequisite to wait on; Gate 2 run fresh, no gap (zero UI surface). Lightweight guard surfaced three items (folder location, Twitter's slug value, display-name-map scope + the corrected "no actual bug" finding), all resolved with the user via `AskUserQuestion` before drafting — see Dev Notes → Architecture & UX Gate Findings.

### Amendment (2026-08-26) Pre-Coding Approval Gate — AC9-12

- [x] Scope confirmation: this amendment adds `videoUrl?: string` to `ScrapedPost`/`instagram-adapter.ts` (Apify mapping only, Instagram platform), updates the AJV schema, adds a nullable `posts.video_url` column + migration, threads it through `persistScrapedPost`, and exposes/flattens it as `Event.videoUrl` in the GraphQL schema/resolvers with codegen re-run. It does **not** implement video playback UI (Story 1.6a), does not wire the field into any `apps/web` query (Story 1.6), does not touch `twitter-adapter.ts`, and does not implement any Track A image-durability scope (`durableImageUrl`, `imageUrlExpiresAt`, S3/CloudFront).
- [x] Architecture and boundary confirmation: every change mirrors an already-shipped pattern 1:1 (`imageUrl` for DB/GraphQL, `locationName`/`ownerFullName`/`ownerUsername` for the adapter mapping) — no new architecture, no new external service call, no bypass of the GraphQL layer.
- [x] Testing plan confirmation: Tasks 8-13's unit/integration test extensions plus a full `pnpm build`/`lint`/`test` pass, per Testing Requirements below.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: no gap found on any gate (lightweight guard — see Dev Notes → Architecture & UX Gate Findings → Amendment); no prerequisite story blocks this amendment.
- [x] Explicit human approval state: **approved 2026-08-25** via the Sprint Change Proposal itself (`sprint-change-proposal-2026-08-25-video-priority-display.md`, marked "already-approved" and explicitly routed to `bmad-create-story` for each Section 4.5 story, including this one) — no separate fresh approval round required before dispatching implementation.

## Testing Requirements

- [x] `packages/domain/src/scraper/platform-registry.test.ts` (new): full-coverage assertions per Task 5.
- [x] `packages/domain/src/scraper/adapter-registry.test.ts` (new): full-coverage assertions per Task 5, including the unregistered-platform error path and the `lookupAccountProfile` delegation.
- [x] `apps/web/src/features/onboarding/onboarding-subscribe-step.test.tsx` (existing, re-run unmodified) and `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.test.tsx` (existing, re-run unmodified): confirm Task 6's call-site swap introduces no regression.
- [x] E2E: not required — this story has no user-facing behavior change (Task 6 is a byte-for-byte-equivalent-output refactor) and no new page/flow; per `project-context.md`'s testing-trophy philosophy, unit coverage on the new domain code plus the existing integration suites re-run is sufficient.

### Amendment (2026-08-26) — AC9-12

- [ ] `apps/backend/src/lib/scraper/instagram-adapter.test.ts` (extended): `mapApifyItemToScrapedPost`/`getNewestPosts` video-mapping + omission cases (Task 8).
- [ ] `apps/backend/src/validation/scraped-post.schema.ts` coverage (Task 9): pass/fail AJV cases including `videoUrl`, plus an `additionalProperties: false` regression case.
- [ ] `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (extended): `videoUrl` round-trip + omitted-defaults-to-null cases (Task 11).
- [ ] `apps/backend/src/schema/resolvers.test.ts` (extended): `eventBySlug` query including `videoUrl` in the selection set (Task 12).
- [ ] Migration apply check: `pnpm --filter @festgrid/database migrate` against local Postgres, clean apply (Task 10).
- [ ] E2E: not required — no user-facing behavior change in this amendment (backend/data-layer plumbing only); Stories 1.6/1.6a own any E2E coverage for the eventual video-playback UX.

## Deliverables Checklist

- [x] `packages/domain/src/scraper/{types.ts, platform-registry.ts, adapter-registry.ts, index.ts}` implemented and exported via `@festgrid/domain/scraper`.
- [x] `PLATFORM_SLUGS`/`PLATFORM_DISPLAY_NAMES`/`getPlatformSlug`/`getPlatformByCode`/`getPlatformDisplayName` fully covering `SUPPORTED_PLATFORMS` (`instagram`, `twitter`), with the AC8 coverage-guard test in place.
- [x] `registerScraperAdapter`/`getScraperAdapter`/`lookupAccountProfile` registry functions implemented, tested, and ready for Story 3.4 to register concrete adapters against.
- [x] 100% unit test coverage on all new `packages/domain/src/scraper/` code.
- [x] Three `apps/web` call sites (`onboarding-subscribe-step.tsx`, `subscribe-account-dialog.tsx`, `subscriptions-content.tsx`) consolidated onto `getPlatformDisplayName`, with their existing tests re-run green.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

### Amendment (2026-08-26) — AC9-12

- [ ] `ScrapedPost.videoUrl?`/`instagram-adapter.ts` Apify mapping, implemented and tested.
- [ ] AJV `scrapedPostSchema` updated to allow `videoUrl`.
- [ ] `posts.video_url` column + committed migration.
- [ ] `persistScrapedPost` threads `videoUrl` through.
- [ ] `events.graphql`'s `Event.videoUrl` + all 5 resolver select sites + field resolver, codegen regenerated.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root including the amendment's new/extended tests.

## Out of Scope

- Any concrete per-platform `ScraperAdapter` implementation (Instagram, Twitter/X, or otherwise) — Story 3.4.
- The public per-account page and its `/{platformSlug}/{accountId}` routing itself — Story 3.11 (this story only supplies `getPlatformByCode` for it to call).
- Story 6.1/6.1a's `castVote` new-account flow that will call this story's `lookupAccountProfile` dispatcher — Epic 6, Story 6.1a/6.1.
- Retrofitting Story 3.1/3.2's subscribe forms with live, scrape-based account validation at submit time — remains an accepted, explicitly deferred gap per Story 3.4's existing Forward note; unaffected by this story.
- Any change to `packages/database/schema.ts`, GraphQL schema/resolvers, or `apps/backend` — this story is entirely scoped to `packages/domain` plus three presentational `apps/web` call-site edits. *(Superseded for `videoUrl` by the 2026-08-26 amendment below — this now IS in scope for that one field.)*

**(Amendment, 2026-08-26):**

- Track A — image durability/re-hosting (`posts.durableImageUrl`, `posts.imageUrlExpiresAt`, S3/CloudFront infra, AD-12) — Stories 0-33/3-6e/3-6f, unrelated to this amendment.
- Video playback UI (`EventDetailView`/`EventImage` video-capable variant) — Story 1.6a, a concurrent sibling.
- Wiring the new `videoUrl` GraphQL field into any `apps/web` query/component — Story 1.6, a separate reopened story.
- `twitter-adapter.ts` — no confirmed raw video field for that platform; not touched.

## Definition of Done

- [x] All 8 Acceptance Criteria satisfied.
- [x] `packages/domain/src/scraper/` at 100% unit test coverage (`platform-registry.test.ts`, `adapter-registry.test.ts`).
- [x] Existing `apps/web` tests for the three edited call sites pass unmodified.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [x] No new `packages/database` migration, GraphQL schema change, or `apps/backend` file — confirmed via File List against the File Change Plan above. *(Superseded for `videoUrl` by the 2026-08-26 amendment below.)*

### Amendment (2026-08-26) — AC9-12

- [ ] AC9-12 satisfied and demonstrated via the amendment's Testing Requirements.
- [ ] New migration committed per AD-3; applies cleanly against local Postgres.
- [ ] `pnpm --filter backend codegen` and `pnpm --filter web codegen` both re-run cleanly (backend regenerates `resolvers-types.ts`; web confirms no-op).
- [ ] No regression in any existing suite (`instagram-adapter.test.ts`, `persist-scraped-post.test.ts`, `resolvers.test.ts`, and the original AC1-8 `packages/domain/src/scraper/*.test.ts` suites).

## Completion Status

- [x] AC1-8: Complete (delivered, unaffected by this amendment).
- [ ] AC9-12 (2026-08-26 video/DB/GraphQL amendment): Not yet implemented — pending dev-story execution.

## Dev Agent Record

### Agent Model Used

- Cline (Claude 3.5 Sonnet)

### Debug Log References

- Completed unit testing with 0 failures: `pnpm --filter @festgrid/domain test`
- Completed Next.js web application compilation: `pnpm --filter web build`

### Completion Notes List

- Defined the `ScraperAdapter` and metadata shapes perfectly conforming to user's requirements and backend persistence compatibility.
- Implemented and unit-tested platform enum-to-slug mapping with reverse lookup capability (`getPlatformByCode`) and display name resolutions.
- Implemented and unit-tested adapter registration mechanism.
- Refactored 3 frontend call sites in `apps/web` to cleanly consume the centralized display-name resolver.
- Fixed an ambient type compilation error from Story 3-3b in `set-default-location-dialog.tsx`.

### File List

- New: `packages/domain/src/scraper/types.ts`
- New: `packages/domain/src/scraper/platform-registry.ts`
- New: `packages/domain/src/scraper/platform-registry.test.ts`
- New: `packages/domain/src/scraper/adapter-registry.ts`
- New: `packages/domain/src/scraper/adapter-registry.test.ts`
- New: `packages/domain/src/scraper/index.ts`
- Modified: `packages/domain/src/index.ts`
- Modified: `packages/domain/package.json`
- Modified: `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`
- Modified: `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`
- Modified: `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx`
- Modified: `apps/web/src/app/[locale]/settings/subscriptions/set-default-location-dialog.tsx`

**(Amendment, 2026-08-26, AC9-12 — not yet started):** The File List above reflects only AC1-8's original delivery. Implementation of AC9-12 (video/DB/GraphQL plumbing) is pending — see Tasks 8-13 above for the exact file list once dispatched.
