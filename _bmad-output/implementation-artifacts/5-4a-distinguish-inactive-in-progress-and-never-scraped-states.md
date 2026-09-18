# Story 5.4a: Distinguish inactive, in-progress, and never-scraped account states

## Story Details

- Epic: 5
- Story ID: 5.4a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the Manual Post Selection screen to tell a genuinely-inactive account apart from one that has never been scraped yet or is being scraped right now,
so that I'm never told to remove a subscription that simply hasn't had its first scrape completed, or that is actively being refreshed.

## Acceptance Criteria

1. **Given** `Subscription.isInactive`'s resolver (`apps/backend/src/schema/resolvers.ts`, currently line ~162) queries only the `posts` table and returns `true` whenever zero rows exist for the account, **when** an account's `SocialMediaAccountProfile.lastScrapedAt` is `null` (no scrape has ever completed for it), **then** `isInactive` returns `false` — a never-scraped account is not reported as inactive, regardless of its post count.
2. **And**, **when** an account's `SocialMediaAccountProfile.isScrapeInProgress` (Story 5.6) is currently `true` (a scrape is in flight, using the exact same in-progress computation `isScrapeInProgress`'s own resolver already uses, including its timeout-boundary orphan handling), **then** `isInactive` returns `false` for that account too, even if it currently has zero posts or its most recent post is 30+ days old — a scrape in progress is never reported as inactive.
3. **And**, **when** neither of the above applies (the account has completed at least one scrape and is not currently mid-scrape), **then** `isInactive` preserves its existing behavior exactly: `true` if the account has zero posts despite a completed scrape, or if its most recent post's `publishedAt` is more than 30 days old; `false` otherwise. No existing genuinely-inactive account starts reporting `false` because of this change.
4. **And**, on the `/posts/select` screen's tab bar (`apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`), a subscription whose account is never-scraped (per AC1) shows a distinct tab badge — an icon and tooltip both visually and textually distinct from the existing `AlertCircle`/"Inactive Account", `Clock`/"Pending Review", and `Ban`/gated-type icons already on this same tab bar (WCAG 1.4.1: icon + text tooltip, never color alone) — conveying that no scrape has run yet. Neither the "Inactive Account" banner nor its "Remove Subscription" CTA renders for this state.
5. **And**, a subscription whose account is scrape-in-progress (per AC2) shows its own distinct tab badge — again a new icon/tooltip pair, distinct from every badge above including the never-scraped one from AC4 — conveying a scrape is under way. When an account is simultaneously never-scraped and scrape-in-progress (e.g. immediately after a first scrape is triggered), the in-progress badge takes priority and the never-scraped badge does not also render. Neither the "Inactive Account" banner nor its CTA renders for this state either.
6. **And**, the existing "Inactive Account" tab badge, banner, and "Remove Subscription" CTA continue to render exactly as today (Story 5.4), but now only for accounts where `isInactive` is `true` under the corrected AC1-AC3 logic — this is a regression check on Story 5.4's existing behavior, not new behavior.
7. **And** all new UI copy is sourced through `next-intl`'s existing `ManualPostSelectionPage` namespace in both `apps/web/locales/en.json` and `id.json` (i18n Core Principle, `project-context.md`): the in-progress badge's tooltip reuses the existing `scrapeInProgressLabel` string (Story 5.6, "Scraping for new posts…") rather than adding a duplicate key with identical meaning; the never-scraped badge's tooltip uses a new `neverScrapedBadgeTooltip` key.
8. **And** the in-progress-computation logic (`scrapeTriggeredAt`/`lastScrapedAt`/timeout-boundary comparison, currently inlined only in `SocialMediaAccountProfile.isScrapeInProgress`'s resolver) is extracted into a single shared, pure, unit-tested function in `packages/domain/src/scraper/`, and both `SocialMediaAccountProfile.isScrapeInProgress` and the corrected `Subscription.isInactive` resolver call this one function — the timeout/orphan-job logic is not duplicated between the two resolvers.

## Tasks / Subtasks

- [ ] Task 1 (AC8) — Extract the shared `computeIsScrapeInProgress` domain function
  - [ ] Create `packages/domain/src/scraper/compute-is-scrape-in-progress.ts` exporting `computeIsScrapeInProgress(profile: { scrapeTriggeredAt: Date | null; lastScrapedAt: Date | null }, timeoutHours: number): boolean`, containing **exactly** the logic currently inlined in `SocialMediaAccountProfile.isScrapeInProgress` (`apps/backend/src/schema/resolvers.ts` lines ~198-220): return `false` if `scrapeTriggeredAt` is `null`; compute `scrapeTimeoutBoundary = now - timeoutHours` and return `false` if `scrapeTriggeredAt` is older than it (orphaned job); otherwise return `true` if `lastScrapedAt === null || lastScrapedAt < scrapeTriggeredAt`, else `false`. Pure function, no DB/Node-only dependency — belongs in `packages/domain` per `project-context.md`'s Code Organization rule.
  - [ ] Add `packages/domain/src/scraper/compute-is-scrape-in-progress.test.ts` with 100% coverage (project-context.md Testing Rules — the only place unit tests are mandatory): `scrapeTriggeredAt: null` → false; triggered-and-recent with `lastScrapedAt: null` → true; triggered-and-recent with `lastScrapedAt` before `scrapeTriggeredAt` → true; triggered-and-recent with `lastScrapedAt` after `scrapeTriggeredAt` → false; `scrapeTriggeredAt` older than `timeoutHours` (orphaned) → false regardless of `lastScrapedAt`.
  - [ ] Export it from `packages/domain/src/scraper/index.ts` (`export * from "./compute-is-scrape-in-progress.js";`), following the existing barrel pattern (`platform-registry.ts`, `account-enrichment.ts`, etc.) — consumed as `@festgrid/domain/scraper`.

- [ ] Task 2 (AC8) — Refactor `SocialMediaAccountProfile.isScrapeInProgress` to use the shared function
  - [ ] In `apps/backend/src/schema/resolvers.ts`, replace the inlined timeout/orphan logic (lines ~198-220) with a call to `computeIsScrapeInProgress({ scrapeTriggeredAt: profile.scrapeTriggeredAt, lastScrapedAt: profile.lastScrapedAt }, scrapeInProgressTimeoutHours)`, keeping the existing DB query and `loadBackendEnv()`/`parseInt(env.scrapeInProgressTimeoutHours || '3', 10)` lookup as-is. Add the import: `import { computeIsScrapeInProgress } from '@festgrid/domain/scraper';` (alongside the existing `@festgrid/domain/scraper` import on line 10 — extend that import, do not add a second import statement for the same module).
  - [ ] Pure refactor — `apps/backend/src/schema/subscriptions.test.ts`'s existing `isScrapeInProgress` coverage (the `triggerAccountScrape mutation tests` block) must continue passing unmodified in behavior.

- [ ] Task 3 (AC1, AC2, AC3) — Fix `Subscription.isInactive`
  - [ ] In `apps/backend/src/schema/resolvers.ts`, before the existing `posts` table query (line ~163), add a lookup of the account's `scrapeTriggeredAt`/`lastScrapedAt` from `social_media_account_profiles` by `parent.accountId` (same shape as `isScrapeInProgress`'s own query, but scoped to `Subscription`'s resolver — a standalone small query, matching this file's established per-field-resolver pattern, not a shared batched load).
  - [ ] If no profile row is found, or `profile.lastScrapedAt === null`, return `false` immediately (AC1) — do not run the `posts` query at all in this case.
  - [ ] Otherwise, call `computeIsScrapeInProgress(profile, scrapeInProgressTimeoutHours)` (same `env`/`timeoutHours` lookup as Task 2) and return `false` immediately if it's `true` (AC2).
  - [ ] Otherwise, fall through to the existing `posts` query and 30-day comparison unchanged (AC3).

- [ ] Task 4 (AC1, AC2, AC3) — Backend integration tests
  - [ ] Extend `apps/backend/src/schema/subscriptions.test.ts` (real local Postgres, `node:test`, matching the file's existing `mySubscriptions`/`triggerAccountScrape` test conventions — direct `db.insert`/`db.update` seeding, GraphQL request via `yoga.fetch`) with cases inside (or adjacent to) the existing `triggerAccountScrape mutation tests` block, reusing its `testProfile`/`testSubscription` setup where convenient: a subscription whose account has `lastScrapedAt: null` and zero posts returns `isInactive: false` on `mySubscriptions`; a subscription whose account has `scrapeTriggeredAt` set to "now" (in-progress) and zero posts also returns `isInactive: false`; a subscription whose account has a non-null `lastScrapedAt`, no in-progress scrape, and its most recent post older than 30 days still returns `isInactive: true` (regression case, AC3/AC6); a subscription whose account has a non-null `lastScrapedAt`, no in-progress scrape, and zero posts (a scrape completed but the account has genuinely never posted anything) also returns `isInactive: true`.

- [ ] Task 5 (AC4, AC5) — Frontend: derive the 3-way account status and render distinct badges
  - [ ] In `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`, add a small local helper (e.g. `getAccountScrapeStatus(sub): 'inactive' | 'scrapeInProgress' | 'neverScraped' | 'active'`) that branches, in this priority order: `sub.account.isScrapeInProgress` → `'scrapeInProgress'`; else `!sub.account.lastScrapedAt` → `'neverScraped'`; else `sub.isInactive` → `'inactive'`; else `'active'` — matching AC5's stated priority (in-progress beats never-scraped when both would otherwise apply). Use a falsy check (`!sub.account.lastScrapedAt`), not a strict `=== null` check, since GraphQL nullable string fields may come back as `undefined` in some call sites (e.g. existing test mocks).
  - [ ] Import two additional `lucide-react` icons distinct from the four already imported (`AlertCircle, TriangleAlert, Ban, Clock`) — one for in-progress, one for never-scraped (the exact icon choice is a minor implementation detail; pick icons that read as neutral/informational, not alarming, consistent with this file's existing "distinct icon + tooltip per state" convention and Voice and Tone's "informative, not alarming" guidance for non-error states, `EXPERIENCE.md` § State Patterns).
  - [ ] In the tab-badge render block (currently lines ~437-461, the four sibling `{sub.isInactive && (...)}` / `{sub.account.accountTypeStatus === ... && (...)}` conditionals), replace the standalone `sub.isInactive` badge conditional with a branch on `getAccountScrapeStatus(sub)`: render the existing `AlertCircle` badge for `'inactive'`; render the new in-progress icon (tooltip: `t('scrapeInProgressLabel')`, reused per AC7) for `'scrapeInProgress'`; render the new never-scraped icon (tooltip: `t('neverScrapedBadgeTooltip')`) for `'neverScraped'`; render nothing for `'active'`. The three gated-account-type badges (`Clock`/`Ban`) are unaffected and continue to render independently alongside this branch, exactly as today.
  - [ ] Do **not** change the existing "Inactive Account" banner condition (`activeSub?.isInactive`, line ~392) or its "Remove Subscription" CTA — AC4/AC5/AC6 are satisfied automatically once the backend fix (Task 3) correctly scopes `isInactive`, no frontend banner logic change is needed.

- [ ] Task 6 (AC7) — i18n locale keys
  - [ ] Add `neverScrapedBadgeTooltip` to the existing `ManualPostSelectionPage` namespace in both `apps/web/locales/en.json` (e.g. "Not scraped yet") and `id.json` (matching translation), adjacent to the existing `scrapePostsEmptyStateCta`/`scrapeInProgressLabel` keys (Story 5.6). No new key is added for the in-progress badge — it reuses `scrapeInProgressLabel`.

- [ ] Task 7 (AC4, AC5, AC6) — Frontend integration tests
  - [ ] Extend `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` (Vitest + Testing Library, existing `mockSubscriptions` GraphQL-mock convention) with cases: a subscription with `account.lastScrapedAt: null`, `account.isScrapeInProgress: false`, `isInactive: false` renders the never-scraped tab badge and no inactive banner; a subscription with `account.isScrapeInProgress: true` renders the in-progress tab badge (not the never-scraped badge, even when `account.lastScrapedAt` is also `null`) and no inactive banner; the existing `isInactive: true` case (already covered by the file's "displays inactive account warning banner" test, line ~402) continues to pass unmodified, confirming the regression check (AC6).

## Dev Notes

- **Architecture constraints:** All reads stay in the two existing GraphQL resolvers this story modifies (`Subscription.isInactive`, `SocialMediaAccountProfile.isScrapeInProgress`) — no new query, mutation, or database column. `apps/web` never queries the DB directly.
- **No new GraphQL field.** The three-way UI state is fully derivable client-side from fields already exposed and already selected by `apps/web/src/features/subscriptions/queries.graphql` (`isInactive`, `account.isScrapeInProgress`, `account.lastScrapedAt` — confirmed already present in that query, added by Story 5.6). This story only changes what `isInactive` computes and how the frontend branches on the combination.
- **Resolved UX design decision (via `AskUserQuestion` during this story's creation):** no `EXPERIENCE.md`/`DESIGN.md` precedent exists for a 3-state account-status indicator (confirmed: `EXPERIENCE.md`'s "State Patterns" section covers only "Soft Delete with Undo" and "Default Location Pending Review"). The user chose **"distinct badge per state"** over two lighter alternatives (reusing the existing `Clock` icon for in-progress + no badge at all for never-scraped; or suppressing both non-genuinely-inactive states entirely with no new iconography) — i.e. AC4/AC5's two new, mutually-distinct badges are a deliberate, user-confirmed design choice, not a default picked unilaterally. Icon glyph selection itself (Task 5) is left as a minor implementation detail within that resolved direction.
- **Why `Clock` is not reused for either new state:** `Clock` already means "Pending Review" (`accountTypeStatus === 'AWAITING_APPROVAL'`) on this exact tab bar. Reusing it for a different meaning (scrape-in-progress or never-scraped) in the same component would violate the "each badge's meaning is unambiguous" intent behind this file's existing WCAG 1.4.1 icon+tooltip convention, even though a tooltip is present.
- **State management categorization (AD invariant):** No new state category. `getAccountScrapeStatus` is a pure derivation from already-fetched Server State (React Query) data — not a new Zustand/URL state, not itself fetched.
- **No new async loader category:** This story adds no new loading/spinner pattern. The in-progress badge is a static icon (optionally `animate-spin` if the chosen icon suits it) reflecting already-polled data (Story 5.6's existing `refetchInterval` polling already keeps `isScrapeInProgress` fresh while true) — it does not introduce its own polling or a `<BlockingLoader />` usage.
- **No new PostHog/analytics event (AD-5):** matches this page's existing precedent (Stories 5.2/5.4/5.6) of no instrumentation on this screen.
- **Package boundaries:** `computeIsScrapeInProgress` (Task 1) is pure, DB/Node-dependency-free logic reused by exactly the kind of cross-cutting business rule `packages/domain` exists for — placed in `packages/domain/src/scraper/` (not nested under a single entity folder, since it's specific to the scraper/account-profile domain area, consistent with the existing `platform-registry.ts`/`account-enrichment.ts` siblings in that same folder). No `packages/ui` component is added (Gate 2, below) — both new badges are inline JSX in the existing tab-badge block, exactly like the four badges already there.

### Architecture & UX Gate Findings

This story targets Epic 5. `epic-readiness/epic-5-readiness.md` exists and is `swept: true`, but its `stories_covered` list is `[5.1, 5.2, 5.3, 5.4, 5.5]` — it predates Story 5.6, and this story depends directly on Story 5.6's `isScrapeInProgress`/`scrapeTriggeredAt` mechanism. Per the lightweight escape-hatch guard, Gate 1 and Gate 3 were reasoned fresh (not cited from the sweep) via a Winston-persona subagent pass; Gate 2 was run fresh via a Freya-persona subagent pass, as it always is per-story.

- **Gate 1 — Architecture/Infrastructure Completeness: No gap.** Every field this story reads (`isScrapeInProgress`, `lastScrapedAt`, the `posts`-table lookup underlying `isInactive`) is already computed and resolver-backed today. The fix is confined to two layers that already own this concern: the `isInactive` resolver (logic change, Task 3) and the frontend consumer (presentation change, Task 5). No new external-service call, no new Lambda, no new table, no direct DB access from the frontend, and no unbacked UI surface.
- **Gate 3 — Foundational/Cross-Cutting Dependency Completeness: No gap.** i18n: `posts-select-content.tsx` already consumes the `ManualPostSelectionPage` next-intl namespace; Task 6 adds one key to an already-wired namespace. GraphQL types: `isScrapeInProgress`/`lastScrapedAt` already flow through the existing codegen pipeline; `computeIsScrapeInProgress`'s extraction consumes already-generated/already-typed values. No new analytics requirement. No new queue, table, Lambda, external service, global shell/layout piece, or reusable utility is implied beyond the one pure function this story itself extracts (Task 1).
- **Gate 2 — UI Complexity & Reusability: No gap, build inline.** Single consumer (`posts-select-content.tsx`), using data already fetched. The work is picking which of 3 icon+tooltip pairs to render in the tab badge, branching on state derived from existing fields — the same shape as the `isInactive`/`AWAITING_APPROVAL`/gated-type branches already living inline in this file, just widening one branch into three. No new `packages/ui` component is warranted with exactly one call site (mirrors Story 5.6's own Gate 2 finding on this identical file). The 3-state branching logic itself is worth the small named helper in Task 5 for testability, not a separate story.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None — no new column, no new GraphQL field, no new TypeScript interface. `Subscription.isInactive` and `SocialMediaAccountProfile.isScrapeInProgress` keep their existing `Boolean!` shape; only their resolver bodies change (one gains an early lookup + shared-function call, the other calls the extracted function instead of inlining it).
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required in `apps/backend`/`apps/web` generated types. New pure function `computeIsScrapeInProgress` is added to `packages/domain`'s public surface (`@festgrid/domain/scraper`), typed via its own signature — not a data-shape change to any existing entity.
- Backward compatibility and rollout notes: Purely a resolver-logic correction plus a frontend presentation change — no schema migration, no client cache-shape change (the frontend already selects every field this story reads). A never-scraped or in-progress account that was previously (incorrectly) reporting `isInactive: true` will now report `false`; this is the intended bug fix, not a regression, and Task 4's tests pin the corrected behavior alongside the preserved genuinely-inactive case.
- Verification checks: Task 4 (backend, real seeded DB rows across all four states) and Task 7 (frontend, mocked GraphQL responses across the three UI states) both directly assert the corrected/preserved behavior end-to-end.

### Project Structure Notes

- **New:** `packages/domain/src/scraper/compute-is-scrape-in-progress.ts` (+ its `.test.ts`).
- **Modified:** `packages/domain/src/scraper/index.ts` (barrel export); `apps/backend/src/schema/resolvers.ts` (`Subscription.isInactive`, `SocialMediaAccountProfile.isScrapeInProgress`, one import line extended); `apps/backend/src/schema/subscriptions.test.ts`; `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (+ its `.test.tsx`); `apps/web/locales/en.json`, `id.json`.
- **Not modified:** Any `*.graphql` schema file (no new field), `packages/database/schema.ts` (no new column), any GraphQL codegen output (no query/field selection changes — `queries.graphql` already selects everything this story reads), `apps/infrastructure/*` (no new infra), `packages/ui` (Gate 2: no new primitive).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.4a] — this story's authoritative AC/Note; explains the `5.4a` lettering and its origin from backlog `IDEA-010`.
- [Source: _bmad-output/planning-artifacts/epic-formation/formation-2026-09-11.md §2, §5] — `IDEA-010`'s disposition (`promote`, standalone, checked against `IDEA-009` and found not to share a capability).
- [Source: _bmad-output/implementation-artifacts/backlog.yaml, `IDEA-010`] — original backlog framing ("distinguish genuinely-inactive account from scrape-run-in-progress or never-run"), sourced from `ux-rework2-tracking.md` item #2.
- [Source: apps/backend/src/schema/resolvers.ts:162-174 (`Subscription.isInactive`), :189-221 (`SocialMediaAccountProfile.isScrapeInProgress`)] — the two resolvers this story reads/modifies verbatim; also the standalone-small-query computed-field pattern both follow and this story preserves.
- [Source: _bmad-output/implementation-artifacts/5-6-on-demand-scraping-trigger-for-manual-post-selection.md] — `isScrapeInProgress`/`scrapeTriggeredAt`/`lastScrapedAt` origin, the timeout-boundary/orphan-job design this story's extracted function must preserve exactly, and the precedent this story follows for running Gate 1/2/3 fresh against a sweep that predates a dependency.
- [Source: _bmad-output/implementation-artifacts/5-4-inactive-account-warning.md] — the original `isInactive` tab badge/banner/CTA implementation this story corrects the scoping of, without changing its own UI code.
- [Source: apps/web/src/app/[locale]/posts/select/posts-select-content.tsx:437-461 (tab badge block), :391-408 (inactive banner)] — the exact block this story's frontend change touches (Task 5) and the block it deliberately leaves untouched (banner).
- [Source: apps/web/src/features/subscriptions/queries.graphql] — confirms `isInactive`, `account.isScrapeInProgress`, `account.lastScrapedAt` are already selected; no query change needed.
- [Source: apps/web/locales/en.json:257-288, id.json:257-288 (`ManualPostSelectionPage`)] — existing key set and naming convention this story's one new key follows.
- [Source: packages/domain/src/scraper/index.ts, platform-registry.ts, account-enrichment.ts] — the existing pure-function-plus-barrel-export pattern this story's `compute-is-scrape-in-progress.ts` follows.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md § State Patterns (lines 372-405), § Account Settings & Moderator Tools Shells (lines 155-171)] — confirms no existing spec for a 3-state account-status indicator (the gap this story's `AskUserQuestion` resolved) and the project's established "informative, not alarming" tone for non-error states.
- [Source: _bmad-output/project-context.md] — Code Organization (Domain vs UI, `packages/domain` purity rule), Locale-Sensitive Data Rendering / i18n Core Principle, Testing Rules (100% coverage for `packages/domain`).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity rule, Task 1); Locale-Sensitive Data Rendering / i18n Core Principle (Task 6); Testing Rules (100% `packages/domain` coverage, testing-trophy integration tests, Tasks 4/7).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD item added or modified by this story (confirmed: not a soft-delete table (AD-8 n/a), not an `events`-collection query (AD-1/AD-2 n/a), no new state-management category, no filter (AD-18 n/a)).
- [ ] `docs/infrastructure/2-backend.md` — confirms no new SQS/Lambda/webhook shape is introduced; this story is entirely within the existing GraphQL resolver layer.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `packages/domain/src/scraper/compute-is-scrape-in-progress.ts` (+ `.test.ts`).
  - Modified: `packages/domain/src/scraper/index.ts`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/subscriptions.test.ts`; `apps/web/src/app/[locale]/posts/select/posts-select-content.tsx` (+ `.test.tsx`); `apps/web/locales/en.json`, `id.json`.
  - Not modified: any `*.graphql` file, `packages/database/schema.ts`, `apps/web/src/generated/graphql.ts`, `apps/infrastructure/*`, `packages/ui`.
- **Rule Mapping:**
  - Reuse-first / DRY (Gate 1) → Task 1's extraction of the shared timeout/orphan-job logic, consumed by both resolvers (Task 2, Task 3) instead of duplicated.
  - Code Organization (`project-context.md`) → Task 1 places the pure function in `packages/domain/src/scraper/`, not `apps/backend`.
  - Testing Rules (`project-context.md`) → Task 1's 100% `packages/domain` unit coverage; Task 4/Task 7's testing-trophy integration coverage including the AC6 regression case.
  - i18n Core Principle → Task 6, both `en`/`id`, one new key, one reused key.
  - Gate 1/2/3 → Architecture & UX Gate Findings above.
  - Resolved UX decision (`AskUserQuestion`) → AC4/AC5's distinct-badge-per-state design, Task 5.
- **Verification Plan:**
  - `packages/domain`: Task 1's unit tests, 100% coverage on the new function.
  - Backend: Task 4's real-DB integration tests cover all four `isInactive` states (never-scraped, in-progress, genuinely-inactive-zero-posts, genuinely-inactive-stale-post) plus the existing `isScrapeInProgress` coverage continuing to pass post-refactor (Task 2).
  - Frontend: Task 7's tests cover both new badge states, their mutual priority (AC5), and the existing inactive-banner test continuing to pass unmodified (AC6 regression check).
  - `pnpm --filter domain test`, `pnpm --filter backend test`, `pnpm --filter web test`, `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions.

## Pre-Coding Approval Gate

- [x] Scope confirmation: fix `Subscription.isInactive`'s resolver to exclude never-scraped and scrape-in-progress accounts; extract the shared in-progress-computation logic into `packages/domain`; add two new distinct tab badges (never-scraped, scrape-in-progress) to `/posts/select`; no change to the existing inactive banner/CTA logic itself. No new GraphQL field, no schema migration.
- [ ] Architecture and boundary confirmation
- [ ] Testing plan confirmation
- [ ] Explicit human approval state (Default: pending approval)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: all three gates reasoned/run fresh this story (Story 5.6 postdates the epic-5 sweep) — no gap on any gate, see Architecture & UX Gate Findings above.
- [x] UX design tradeoff resolved via `AskUserQuestion` during this story's creation: "distinct badge per state" chosen over two lighter alternatives — see Dev Notes.

## Testing Requirements

- [ ] Integration tests (required): `apps/backend/src/schema/subscriptions.test.ts` new cases (real local Postgres, `node:test`) per Task 4; `apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx` new cases (Vitest + Testing Library) per Task 7, including the AC6 regression assertion.
- [ ] Unit tests (required, 100% coverage): `packages/domain/src/scraper/compute-is-scrape-in-progress.test.ts` per Task 1.
- [ ] E2E tests: Not required — matches `/posts/select`'s existing precedent (Stories 5.1-5.6 have no dedicated Playwright spec for this route).
- [ ] Manual verification: Recommended (not blocking) — visually confirm the two new badge icons read as clearly distinct from each other and from the existing three badges on a real tab bar with several accounts in different states.

## Deliverables Checklist

- [ ] `computeIsScrapeInProgress` extracted to `packages/domain/src/scraper/`, 100%-unit-tested, and consumed by both `isScrapeInProgress` and `isInactive` (Task 1, 2, 3).
- [ ] `Subscription.isInactive` returns `false` for never-scraped and scrape-in-progress accounts, unchanged behavior otherwise (Task 3, verified by Task 4).
- [ ] Never-scraped and scrape-in-progress tab badges live on `/posts/select`, correctly prioritized, no banner/CTA on either (Task 5, verified by Task 7).
- [ ] `neverScrapedBadgeTooltip` present in both `en.json`/`id.json`; in-progress badge reuses `scrapeInProgressLabel` (Task 6).
- [ ] `pnpm --filter domain test`, `pnpm --filter backend test`, `pnpm --filter web test`, `pnpm build`, `pnpm lint` clean at the repo root.

## Out of Scope

- Any change to the 30-day inactivity threshold itself (unchanged, Story 5.4's original scope).
- Any change to the "Remove Subscription" banner's own copy, layout, or the `removeSubscription` mutation (Story 3.2/5.4, untouched).
- Any change to the "Scrape Posts" button/control itself (Story 5.6, untouched) — this story only adds a passive tab badge reflecting the same `isScrapeInProgress` signal that button already consumes.
- A generic, reusable `packages/ui` "account status badge" primitive — Gate 2 confirmed this stays inline (single consumer, no reuse case yet, mirrors Story 5.6's identical finding on this same file).
- Backfilling or auditing existing production data for accounts currently mis-flagged as inactive — this is a forward-looking resolver-logic fix; no data migration or moderator-facing cleanup tool is in scope.

## Definition of Done

- [ ] AC 1-8 satisfied.
- [ ] Required tests passing (`packages/domain` unit tests at 100% coverage on the new function; backend and frontend integration tests per Tasks 4/7).
- [ ] Lint and type checks passing for touched packages (`domain`, `backend`, `web`).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
