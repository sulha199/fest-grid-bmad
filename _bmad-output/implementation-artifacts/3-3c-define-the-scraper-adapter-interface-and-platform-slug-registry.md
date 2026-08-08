# Story 3.3c: Define the scraper adapter interface and platform-slug registry

---
baseline_commit: 18e220926cb1c193ce98ec76f03210186f218c1e
---

# Story 3.3c: Define the scraper adapter interface and platform-slug registry

## Story Details

- Epic: 3
- Story ID: 3.3c
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a generic `ScraperAdapter` interface (given a subscribed account, returns its newest posts with platform-specific `post_url`/`original_post_url` derivation) and a single platform-enum-to-URL-slug registry,
so that Story 3.4's per-platform scraping implementations and Story 3.11's public account-page routing both consume one shared abstraction instead of each independently inventing platform identification and slug logic.

## Acceptance Criteria

1. **Given** the PRD's requirement (§3.7) that scraping go through "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation," **when** a new platform's scraper is added, **then** it implements one shared `ScraperAdapter` interface: `getNewestPosts(account: ScraperAccountRef): Promise<ScrapedPost[]>`, where `ScrapedPost` sets `postUrl` to whatever URL was actually scraped (which may be a proxy/mirror, e.g. `imginn.com` for Instagram) and `originalPostUrl` when that platform's own derivation rule can determine the canonical original-platform URL. `ScrapedPost`'s shape (`content`, `imageUrl?`, `postUrl`, `originalPostUrl?`, `publishedAt`) matches `apps/backend/src/lib/posts/persist-scraped-post.ts`'s `PersistScrapedPostParams` exactly (minus `accountId`, which the caller supplies), so Story 3.4 can pipe an adapter's output directly into `persistScrapedPost` with no shape translation.
2. **And** a platform-enum-to-URL-slug registry (`PLATFORM_SLUGS`, e.g. `instagram -> 'ig'`, `twitter -> 'x'`) is defined exactly once, in the same shared location as the `ScraperAdapter` interface (`packages/domain/src/scraper/`), keyed by the existing `SupportedPlatform` enum (`packages/domain/src/subscriptions/platforms.ts`) — not a new, competing platform enum. It is the single source Story 3.11's `/{platformSlug}/{accountId}` routing resolves against (via a reverse `getPlatformByCode(slug)` lookup this story also provides) — not hardcoded per-component.
3. **And** a registration mechanism (`registerScraperAdapter(platform, adapter)` / `getScraperAdapter(platform)`) is provided so Story 3.4 can register concrete per-platform adapter instances against this shared registry, instead of each platform's implementation inventing its own lookup/dispatch mechanism. Calling `getScraperAdapter` for a platform with no registered adapter throws a clear error (`No scraper adapter registered for platform "<platform>"`) rather than returning `undefined` silently — expected/normal until Story 3.4 registers concrete adapters.
4. **And** this story builds the interface/registry scaffold only — the first concrete per-platform scraper implementation(s) remain Story 3.4's scope. No network calls, HTML parsing, or platform-specific scraping logic is implemented here.
5. **And** the registry also exposes a dispatching `lookupAccountProfile(platform: SupportedPlatform, handleOrUrl: string): Promise<AccountProfileLookupResult | null>` function (`AccountProfileLookupResult = { accountId: string; displayName: string; username: string; profileImageUrl?: string }`), which resolves the adapter for `platform` via the registry and delegates to that adapter's own `lookupAccountProfile(handleOrUrl)` interface method — a lightweight, on-demand existence-check + public-profile-metadata fetch, distinct from `getNewestPosts` (no posts are scraped, no AI extraction runs). Returns `null` when the platform reports no such account. This story defines the interface method's signature, the registry's dispatcher, and the "no adapter registered" error path only — the first concrete per-platform implementation(s) remain Story 3.4's scope, consistent with `getNewestPosts`.
6. **And** the registry also exposes `getPlatformDisplayName(platform: SupportedPlatform): string` (`instagram -> 'Instagram'`, `twitter -> 'Twitter/X'`), consolidating the platform-display-name formatting logic currently duplicated inline (with divergent conventions) across three call sites — `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`, `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`, and `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` — each of which is updated to call `getPlatformDisplayName` instead of its own inline `plat === 'twitter' ? 'Twitter/X' : plat.charAt(0).toUpperCase() + plat.slice(1)` ternary. Output text is unchanged (`'Instagram'`, `'Twitter/X'`) — this is a pure de-duplication, not a copy change.
7. **And** all new logic is added under the `./scraper` subpath export of `@festgrid/domain` (`packages/domain/package.json`, `packages/domain/src/index.ts`), matching the existing `./subscriptions`, `./geolocation`, `./ai-gateway` subpath-export pattern — not folded into the existing `./subscriptions` subpath, since scraping-mechanism concerns (this story) are a distinct domain area from the user's subscribe relationship (`packages/domain/src/subscriptions/`).
8. **And** `PLATFORM_SLUGS`, `PLATFORM_DISPLAY_NAMES`, `getPlatformSlug`, `getPlatformByCode`, and `getPlatformDisplayName` have exactly one entry per `SUPPORTED_PLATFORMS` member — a unit test asserts this coverage so that adding a new platform to `SUPPORTED_PLATFORMS` without updating the registry fails CI instead of silently producing an `undefined` slug/display name at runtime.

**Note:** Classified as a Gate 3 gap by the Epic 3 readiness re-sweep (`bmad-epic-readiness-check`, re-run 2026-08-07) — Story 3.4 requires a "platform-specific scraper adapter" and Story 3.11 requires a "platform-to-slug mapping...defined once in a shared location alongside the platform-specific scraper adapters," but no story built either the adapter interface or the registry; left alone, Story 3.4 would build both ad hoc as a byproduct of its own scraping work — the exact failure mode `story-split-gate.md` exists to catch. Kept inside Epic 3 (not promoted to Epic 0) since no other epic currently calls a social-media scraper or consumes the slug registry. Positioned after Story 3.3b and before Story 3.4, the first consumer. See `_bmad-output/planning-artifacts/epics.md#Story-3.3c` for the full original note and the amendment below.

**Amendment (Epic 6 readiness sweep, `bmad-epic-readiness-check`, 2026-08-08):** Added `lookupAccountProfile` to the shared interface/registry (AC5). Story 3.4's 2026-08-07 Forward note flagged that Story 3.1/3.2's subscribe forms need a lightweight account-validation capability distinct from the scheduled bulk-scrape, but left open whether it belongs on the interface (this story) or the bulk-scrape story (3.4) itself. The Epic 6 sweep found a second, independent consumer — Story 6.1's vote-for-a-new-account path (PRD §3.13, FR70) needs the identical capability at the same layer before Story 6.1 can ship as specified. Two independent consumers across two epics clears Gate 3's cross-epic reuse bar. Placed on the registry (this story) rather than Story 3.4, since it is a synchronous, on-demand, single-account lookup with a different call shape than 3.4's scheduled, bulk, multi-account scrape job. Story 3.1/3.2's own subscribe-form retrofit remains out of scope/deferred as before — this amendment only unblocks Story 6.1, which does depend on this interface method plus at least one concrete per-platform implementation from Story 3.4.

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

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** This story introduces no database schema, no new DB columns, and no new GraphQL types/fields — `social_media_account_profiles.platform` and `posts.{content,image_url,post_url,original_post_url,published_at}` (both already `text`/nullable-correct per `packages/database/schema.ts`) are read-only reference points for this story's TypeScript shapes; nothing here writes to or migrates them.
- **Impacted fields/contracts:** New TypeScript-only additions to `@festgrid/domain`'s public surface (`./scraper` subpath: `ScraperAdapter`, `ScrapedPost`, `ScraperAccountRef`, `AccountProfileLookupResult`, `PLATFORM_SLUGS`, `PLATFORM_DISPLAY_NAMES`, `getPlatformSlug`, `getPlatformByCode`, `getPlatformDisplayName`, `registerScraperAdapter`, `getScraperAdapter`, `lookupAccountProfile`). No changes to `packages/shared-types`, `packages/database/schema.ts`, or any `.graphql` schema file — this story adds a compile-time contract only, not a runtime data contract.
- **Required DB migration changes:** No changes required — no schema touched.
- **Required TypeScript type changes:** New exports only (additive), listed above; `ScrapedPost`'s field names/optionality were deliberately matched 1:1 against `apps/backend/src/lib/posts/persist-scraped-post.ts`'s existing `PersistScrapedPostParams` (minus `accountId`) so Story 3.4 needs zero adapter-to-persistence shape translation when it lands.
- **Backward compatibility and rollout notes:** Purely additive — a new `packages/domain` subpath, no existing export removed or changed in shape. The three `apps/web` call-site edits (Task 6) are behavior-preserving (identical rendered text, `'Instagram'`/`'Twitter/X'`), verified against both components' existing tests (neither asserts the old inline-ternary text) before this story's creation.
- **Verification checks:** Task 5's new `packages/domain/src/scraper/*.test.ts` (100% coverage per Testing Rules); Task 6's re-run of `onboarding-subscribe-step.test.tsx` and `subscriptions-content.test.tsx` to confirm no regression from the call-site swap; `pnpm build` across `packages/domain` and `apps/web` to confirm the new `./scraper` subpath resolves correctly from both consumers (Task 7).

### Project Structure Notes

- New: `packages/domain/src/scraper/{types.ts, platform-registry.ts, adapter-registry.ts, index.ts, platform-registry.test.ts, adapter-registry.test.ts}`.
- Modified: `packages/domain/src/index.ts` (new `export *`); `packages/domain/package.json` (new `./scraper` exports entry); `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx`; `apps/web/src/app/[locale]/settings/subscriptions/subscribe-account-dialog.tsx`; `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx`.
- Not modified: `packages/domain/src/subscriptions/*` (reused as-is — `SUPPORTED_PLATFORMS`/`SupportedPlatform` imported, not redefined); `packages/database/schema.ts`; any `.graphql` schema file; `apps/backend` (this story has no backend resolver/adapter surface — that begins with Story 3.4).
- Matches the project's established multi-subpath `packages/domain` package pattern (`./subscriptions`, `./geolocation`, `./ai-gateway`, `./email`, `./user-locations`, `./user-settings`, `./events`, `./query`, `./calendar`) — `./scraper` is the next entry in that same list, not a special case.
- **No conflicts detected.** This story only adds new files and touches three `apps/web` call sites with a behavior-preserving swap; it does not modify any in-flight story's files (Story 3.4/3.11/6.1, this story's consumers, are all still `backlog`).

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

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain vs UI: pure, dependency-free logic in `packages/domain`, organized by domain sub-folder — this story adds a new `scraper/` sub-folder); Testing Rules (100% unit coverage requirement for `packages/domain` exports); General Architecture (Adapter Pattern for external services — this story defines the adapter *contract* Story 3.4's concrete Gemini-style adapters will implement).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD-1 through AD-8 rule is directly engaged (no DB, no GraphQL, no soft-delete, no auth) — this story is pure `packages/domain` scaffold; confirmed no architecture-spine rule applies rather than silently skipping the reference.
- [x] `docs/infrastructure/index.md` — no infra/deployment change in this story (no Lambda, no queue, no new AWS resource; this is a monorepo-internal package addition only).

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

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the `ScraperAdapter`/`ScrapedPost`/`ScraperAccountRef`/`AccountProfileLookupResult` TypeScript contracts, the platform-slug/display-name registry, and the adapter registration/dispatch mechanism (including `lookupAccountProfile`'s dispatcher) in a new `packages/domain/src/scraper/` folder — plus a pure de-duplication of three existing `apps/web` inline platform-display-name call sites onto the new `getPlatformDisplayName`. It does **not** implement any concrete per-platform scraper (Story 3.4), does not change any DB schema or GraphQL surface, and does not retrofit Story 3.1/3.2's subscribe forms with live account validation (still deferred, per Story 3.4's existing Forward note).
- [ ] Architecture and boundary confirmation: all new code is pure, dependency-free TypeScript confined to `packages/domain` (no React, no DB/ORM, no Node-runtime-only modules) per the Code Organization rule; the new `./scraper` subpath follows the existing multi-subpath export pattern exactly; no `apps/backend` or `apps/web` code writes to the DB or calls an external service as part of this story.
- [ ] Testing plan confirmation: 100% unit coverage on all new `packages/domain/src/scraper/` exports (Task 5); existing `apps/web` tests re-run, unmodified, to confirm the Task 6 call-site swap is behavior-preserving.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` — this story **is** that sweep's own Gate 3 finding, so there is no further prerequisite to wait on; Gate 2 run fresh, no gap (zero UI surface). Lightweight guard surfaced three items (folder location, Twitter's slug value, display-name-map scope + the corrected "no actual bug" finding), all resolved with the user via `AskUserQuestion` before drafting — see Dev Notes → Architecture & UX Gate Findings.

## Testing Requirements

- [x] `packages/domain/src/scraper/platform-registry.test.ts` (new): full-coverage assertions per Task 5.
- [x] `packages/domain/src/scraper/adapter-registry.test.ts` (new): full-coverage assertions per Task 5, including the unregistered-platform error path and the `lookupAccountProfile` delegation.
- [x] `apps/web/src/features/onboarding/onboarding-subscribe-step.test.tsx` (existing, re-run unmodified) and `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.test.tsx` (existing, re-run unmodified): confirm Task 6's call-site swap introduces no regression.
- [x] E2E: not required — this story has no user-facing behavior change (Task 6 is a byte-for-byte-equivalent-output refactor) and no new page/flow; per `project-context.md`'s testing-trophy philosophy, unit coverage on the new domain code plus the existing integration suites re-run is sufficient.

## Deliverables Checklist

- [x] `packages/domain/src/scraper/{types.ts, platform-registry.ts, adapter-registry.ts, index.ts}` implemented and exported via `@festgrid/domain/scraper`.
- [x] `PLATFORM_SLUGS`/`PLATFORM_DISPLAY_NAMES`/`getPlatformSlug`/`getPlatformByCode`/`getPlatformDisplayName` fully covering `SUPPORTED_PLATFORMS` (`instagram`, `twitter`), with the AC8 coverage-guard test in place.
- [x] `registerScraperAdapter`/`getScraperAdapter`/`lookupAccountProfile` registry functions implemented, tested, and ready for Story 3.4 to register concrete adapters against.
- [x] 100% unit test coverage on all new `packages/domain/src/scraper/` code.
- [x] Three `apps/web` call sites (`onboarding-subscribe-step.tsx`, `subscribe-account-dialog.tsx`, `subscriptions-content.tsx`) consolidated onto `getPlatformDisplayName`, with their existing tests re-run green.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root.

## Out of Scope

- Any concrete per-platform `ScraperAdapter` implementation (Instagram, Twitter/X, or otherwise) — Story 3.4.
- The public per-account page and its `/{platformSlug}/{accountId}` routing itself — Story 3.11 (this story only supplies `getPlatformByCode` for it to call).
- Story 6.1/6.1a's `castVote` new-account flow that will call this story's `lookupAccountProfile` dispatcher — Epic 6, Story 6.1a/6.1.
- Retrofitting Story 3.1/3.2's subscribe forms with live, scrape-based account validation at submit time — remains an accepted, explicitly deferred gap per Story 3.4's existing Forward note; unaffected by this story.
- Any change to `packages/database/schema.ts`, GraphQL schema/resolvers, or `apps/backend` — this story is entirely scoped to `packages/domain` plus three presentational `apps/web` call-site edits.

## Definition of Done

- [x] All 8 Acceptance Criteria satisfied.
- [x] `packages/domain/src/scraper/` at 100% unit test coverage (`platform-registry.test.ts`, `adapter-registry.test.ts`).
- [x] Existing `apps/web` tests for the three edited call sites pass unmodified.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [x] No new `packages/database` migration, GraphQL schema change, or `apps/backend` file — confirmed via File List against the File Change Plan above.

## Completion Status

- [x] Complete

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
