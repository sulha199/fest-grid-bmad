# Story 3.9a: Display in-app queue status and API key health

## Story Details

- **Epic:** 3
- **Story ID:** 3.9a
- **Status:** ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** user who has subscribed to social media accounts,
**I want** a dedicated "Queue Status" section in my user menu showing how many of my subscribed posts are still pending extraction and whether my own API keys are healthy,
**so that** I understand extraction progress and can react if one of my keys needs attention.

## Acceptance Criteria

1. **Given** I have one or more active subscriptions, **when** I open "Queue Status" from my user menu, **then** I see, for each active subscription, the social media account's display name and the count of that account's posts still pending extraction (`posts.isExtracted = false`, scoped to that `accountId`). [epics.md AC1]
2. **And** I see the status of each of my own API keys (`api_keys.isValid`) as "Active" or "Invalid" — a live "Rate-limited" state is explicitly out of scope for this story, since Story 0.13's adapter treats rate-limiting as a transient, in-request-only condition and persists nothing to `api_keys` for it (only `isValid`/`invalidAttempts` are durable); a future story may add a persisted rate-limit signal if needed. [epics.md AC2]
3. **And** if any of my keys is `Invalid`, a warning is shown with a link to `/settings/api-keys` (Story 3.1b) to resolve it. [epics.md AC3]
4. **And** this page requires authentication and shows only the signed-in user's own subscriptions/keys. [epics.md AC4]
5. **And** a subscription with a pending count of `0` still renders its row (never hidden) with the count displayed as `0` — no special "all caught up" copy is introduced, matching the plain-count precedent already used for every other numeric field on `/settings/subscriptions`/`/settings/api-keys`. (Clarifies a gap surfaced by this story's Gate 2 review — not present in epics.md's AC text.)
6. **And** "Queue Status" appears as a new entry in the User Menu (between "API Keys" and "Notifications"), routes to `/settings/queue-status`, and `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s authoritative User Menu registry is amended to include it as a canonical 9th item — resolving the doc/AC conflict surfaced during this story's creation (see Dev Notes "Architecture & UX Gate Findings").
7. **And** all user-facing strings (menu label, page title/headings, status labels, warning copy) are sourced through `next-intl` from dedicated locale keys present in both `en` and `id`, per the i18n Core Principle (`project-context.md`).

**Note (2026-08-11, added via `bmad-create-story` while drafting Story 3.9):** Surfaced by Gate 2 (`story-split-gate.md`), run fresh via the Freya persona since Story 3.9's own scope (backend verification tests only, per its Gate-1-corrected AC) has no UI. FR23 ("A dedicated section within the user menu will display the real-time queue status of posts pending extraction") is mapped to Epic 3 in the PRD's FR-to-epic table, and Story 0.13's own `Out of Scope` section explicitly anticipated "Story 3.9 (UI-facing aspects)" would own it — but Story 3.9's AC was later narrowed by the Epic 3 readiness sweep's Gate 1 correction to drop all UI, leaving FR23 mapped to Epic 3 with no story anywhere implementing it. Draft (non-authoritative) UX content already exists at `design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.8-in-app-queue-status.md`, describing this exact screen, but was never promoted into the authoritative `DESIGN.md`/`EXPERIENCE.md`. User confirmed via `AskUserQuestion` during Story 3.9's creation to split this off as its own prerequisite story rather than silently re-absorb it into 3.9 or leave FR23 permanently orphaned. Positioned as a lettered suffix directly off Story 3.9 per `story-split-gate.md`'s "single-story split" numbering rule. (A related but distinct draft page, `04.6-quota-management-display.md` — a quota progress bar on the *manual post selection* screen — belongs to Epic 5's manual-extraction flow, not this story; not in scope here.)

**Depends on:** Story 0.13, Story 3.1a, Story 3.1b, Story 3.3a.

## Tasks / Subtasks

- [ ] **Task 1 (AC1) — Backend: add `pendingExtractionCount` to the `Subscription` GraphQL type:**
  - [ ] In `apps/backend/src/schema/subscriptions.graphql`, add `pendingExtractionCount: Int!` to `type Subscription` (alongside existing `id`, `accountId`, `isNewlyAdded`, `createdAt`, `account`).
  - [ ] In `apps/backend/src/schema/resolvers.ts`, add a new field resolver to the existing `Subscription: { account: async (...) => {...} }` object (line ~63) — a sibling `pendingExtractionCount` resolver following the exact same per-parent lazy-resolution pattern as `account`, computing `count(*) FROM posts WHERE posts.account_id = parent.accountId AND posts.is_extracted = false` via Drizzle (`db.select({ count: count() }).from(posts).where(and(eq(posts.accountId, parent.accountId), eq(posts.isExtracted, false)))`). No `activeOnly()` filter — `posts` has no `deletedAt` column (confirmed in `packages/database/schema.ts`).
  - [ ] Do **not** route this through the AD-1/AD-2 Unified Query DSL (`events` query, `buildDrizzleWhere`) — the spine's own binding language scopes AD-1/AD-2 strictly to `events`/"event collections"; `posts`/`apiKeys` access follows the established purpose-specific-query precedent (`myApiKeys`, `mySubscriptions`), not the DSL.
  - [ ] Extend `apps/backend/src/schema/subscriptions.test.ts` with a case seeding a subscription + ≥2 real `posts` rows for its `accountId` (mixed `isExtracted: true/false`) and asserting `pendingExtractionCount` on the `mySubscriptions` query response matches the real unextracted count; include a `0`-count case (AC5).

- [ ] **Task 2 (AC1, AC2, AC4) — Frontend: new `/settings/queue-status` route, modeled on `/settings/subscriptions`:**
  - [ ] `apps/web/src/app/[locale]/settings/queue-status/page.tsx` — Server Component: `export const dynamic = "force-dynamic"`, `generateMetadata` via `buildPageMetadata({ title: t("queueStatusTitle"), description: t("queueStatusDescription") })` reading the `Metadata` namespace server-side (`getTranslations`), wraps `<Suspense fallback={<RouteLoader />}><QueueStatusContent /></Suspense>` — exact structure of `settings/subscriptions/page.tsx`.
  - [ ] `apps/web/src/app/[locale]/settings/queue-status/queue-status-content.tsx` — Client Component (`"use client"`): `useAuthSession()` + redirect-to-`/login` if unauthenticated (mirrors `subscriptions-content.tsx` lines 30-35); extend `apps/web/src/features/subscriptions/queries.graphql`'s `getMySubscriptions` operation to also select `pendingExtractionCount` (regenerate via `pnpm --filter web codegen`, which runs `graphql-codegen --config codegen.ts && node fix-codegen.js`), and call the existing `useGetMyApiKeysQuery(graphqlClient, {}, { enabled: !!session })` (same hook `api-keys-content.tsx` already uses) for the key-health half; loading state = inline `animate-pulse` skeleton blocks (same Tailwind classes as `subscriptions-content.tsx`/`api-keys-content.tsx`), error state = inline destructive text + Retry button calling `refetch()` — no new shared loading/error component.
  - [ ] Render each active subscription as a row: account `displayName` + `pendingExtractionCount` (always shown, including `0` — AC5).
  - [ ] Render each API key's status via the new `StatusBadge` component (Task 3) driven by `key.isValid` (`true` → "Active", `false` → "Invalid").

- [ ] **Task 3 (AC2) — New reusable `StatusBadge` primitive in `packages/ui`:**
  - [ ] Per `project-context.md`'s Code Organization rule (reusable, domain-agnostic UI belongs in `packages/ui`, not inline in `apps/web`), add `packages/ui/src/core/status-badge.tsx` exporting a small `StatusBadge` component (props: `variant: 'active' | 'invalid'` + `label: string`; renders a colored pill/text, text-carrying not color-only per WCAG, matching the existing inline-badge visual convention already used for "Pending Review" at `subscriptions-content.tsx:229`). Gate 2 (below) confirmed this does **not** need its own story — it is built as a subtask of this story, but placed in `packages/ui/src/core/` (not inline JSX) so it is immediately reusable if `/settings/api-keys` adds the same indicator later, satisfying both the "no premature story split" and the package-boundary persistent-fact rule together.
  - [ ] Export `StatusBadge` from `packages/ui`'s public entry point (follow the existing export pattern for other `core/` components).

- [ ] **Task 4 (AC3) — Invalid-key warning banner:**
  - [ ] In `queue-status-content.tsx`, when `apiKeys.some(k => !k.isValid)`, render the exact warning-banner pattern already established at `subscriptions-content.tsx:155-162` (yellow/warning box, `Link href="/settings/api-keys"`, underlined), adapted with this page's own copy keys (Task 6) — do not invent a new banner treatment.

- [ ] **Task 5 (AC6) — User Menu wiring:**
  - [ ] `packages/ui/src/core/app-shell/profile-menu-entries.ts`: add a new entry `{ id: 'queue-status', labelKey: 'queueStatus', href: '/settings/queue-status', icon: ListChecks }` (import `ListChecks` from `lucide-react`), positioned between the existing `api-keys` and `notifications` entries (matches AC6's menu ordering and the EXPERIENCE.md amendment in Task 7). Use the camelCase `labelKey: 'queueStatus'` convention (matching `apiKeys`/`moderatorItems`) — do not repeat the pre-existing `'api-keys'` kebab-case/camelCase label-key mismatch already present on that entry (a known, unrelated landmine; not in scope to fix here).
  - [ ] `apps/web/src/components/layout/AppShellWrapper.tsx`: add `queueStatus: tUserMenu('queueStatus')` to the `userMenuLabels` object (line ~48-58).

- [ ] **Task 6 (AC7) — i18n locale keys (both `en` and `id`):**
  - [ ] `apps/web/locales/en.json` / `id.json` `UserMenu` namespace: add `"queueStatus": "Queue Status"` (en) / an appropriate `id` translation.
  - [ ] `apps/web/locales/en.json` / `id.json` `Metadata` namespace: add `queueStatusTitle`/`queueStatusDescription` keys, following the exact `subscriptionsTitle`/`subscriptionsDescription` pattern (e.g. `"Queue Status | FestDaily"`).
  - [ ] Add a new `QueueStatusPage` namespace to both locale files with keys for: `title`, `pendingCountLabel` (or equivalent per-row label), `activeStatusLabel`, `invalidStatusLabel`, `invalidKeyWarningPrompt`, `invalidKeyWarningLinkLabel`, `emptyState` (no active subscriptions), `errorState`, `retryButtonLabel` — mirroring the existing `SubscriptionsPage`/`ApiKeysSettingsPage` namespace shapes.

- [ ] **Task 7 (AC6) — Amend authoritative UX doc `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`:**
  - [ ] In the "Menu contents, top to bottom" list (lines 70-79), insert a new numbered item **"Queue Status" → `/settings/queue-status`** between "API Keys" (item 5) and "Notifications" (item 6), renumbering subsequent items.
  - [ ] Update the closing paragraph (line 81) to append "Queue Status is registered by Story 3.9a" to the story-attribution sentence, keeping the doc's registry description accurate and in sync with the amendment. User explicitly confirmed via `AskUserQuestion` during this story's creation that amending EXPERIENCE.md (rather than leaving it stale or halting for a full `bmad-ux` re-pass) is the correct resolution.

- [ ] **Task 8 (AC1-AC7) — Testing:**
  - [ ] Backend integration test: Task 1's extension to `apps/backend/src/schema/subscriptions.test.ts` (real local Postgres, `node:test`, matching every other resolver test file's pattern — no Vitest/MSW in `apps/backend`).
  - [ ] Frontend integration test: new `apps/web/src/app/[locale]/settings/queue-status/queue-status-content.test.tsx`, modeled directly on `api-keys-content.test.tsx`/`subscriptions-content.test.tsx` (Vitest + Testing Library + MSW-mocked GraphQL responses via `graphqlClient`, `NextIntlClientProvider` wrapping with `enMessages`) covering: happy path (subscriptions + counts + Active keys render, no warning), unhappy path (an `Invalid` key renders the warning banner with a working `/settings/api-keys` link — testing trophy's required "unhappy path" case per `project-context.md`), loading skeleton, error+retry, unauthenticated redirect, zero-count row rendering (AC5).
  - [ ] `pnpm --filter backend test`, `pnpm --filter web test`, `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions.

## Dev Notes

- **This story's only backend change is additive** (`pendingExtractionCount` field + resolver) — `myApiKeys` already exists in full (`apps/backend/src/schema/api-keys.graphql`, resolver `resolvers.ts:715-721`) and needs zero changes; it already returns `isValid`, scoped to `context.user`, active-only (`activeOnly(apiKeys)`).
- **State management categorization (AD invariant):** Server State (React Query) — `useGetMySubscriptionsQuery`/`useGetMyApiKeysQuery` via `graphql-request` + generated hooks, exactly like `subscriptions-content.tsx`/`api-keys-content.tsx`. No URL state, no new Client Global (Zustand) state — this page has no filters/params and no cross-component ephemeral UI state.
- **Async loader categorization (AD invariant):** Non-Blocking (Initial Load) — inline skeleton blocks matching `subscriptions-content.tsx`'s loading branch, consistent with every other `/settings/*` page. The route-level `<Suspense fallback={<RouteLoader />}>` (project-context.md's Route-Level Suspense Fallback invariant) covers the outer route-shell boundary; the inline skeleton covers in-page data fetching once mounted — same two-layer split as every other settings route.
- **No PostHog/analytics events (AD-5)** required by any AC — this is a read-only status view, no user action to track. (If a future story wants a "queue_status_viewed" page-view event, that is separate scope, not required here.)
- **Package boundaries:** `StatusBadge` (Task 3) goes in `packages/ui/src/core/` (domain-agnostic primitive, per `project-context.md`'s Core Primitives rule). No `packages/domain` logic is needed — the pending-count computation is a plain SQL aggregate inside a resolver, not portable business logic.
- **No Data Type Compatibility gap** — see dedicated section below.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** `epic-3-readiness.md` is `swept: true`, but its `stories_covered` list (`3.1a` … `3.11`) does **not** include `3.9a`, because 3.9a did not exist at the time of the 2026-08-09 sweep (it was split off during Story 3.9's own creation on 2026-08-11). Per the lightweight escape-hatch guard, Gate 1/3 were reasoned fresh for this story rather than blindly trusting the sweep: the only backend change this story makes is a single additive GraphQL field + resolver on an already-existing, already-swept `Subscription` type, reusing the exact per-parent field-resolver pattern the codebase already establishes for `Subscription.account` — no new external service, no new database table, no new infra/IaC dependency, and no bypass of the backend/GraphQL layer from the frontend. **Verdict: No gap.**
- **Gate 2 (UI Complexity & Reusability):** Run fresh via a one-shot Freya-persona pass (mandatory per-story). Evaluated whether the net-new Active/Invalid status indicator (no existing precedent anywhere in the codebase — confirmed `api-keys-content.tsx` fetches `isValid` but never renders it) needs its own dedicated component-refinement story. **Verdict: No gap — build inline as part of this story** (not split into its own story), because reuse must be actual/in-scope, not hypothetical: no second concrete consumer exists in this story's delivered scope, the complexity profile is trivial (no images, one derived boolean, two enum states, text-carrying a11y), and there's direct codebase precedent for inline enum-status badges (`subscriptions-content.tsx:229`'s "Pending Review" badge has no dedicated component either). The subagent additionally flagged a minor, non-blocking gap — the draft AC didn't specify `pendingExtractionCount === 0` zero-state copy — resolved directly as AC5 above rather than escalated, since it has no real tradeoff (plain "0" matches every other numeric-field precedent in the codebase).
- **Design-doc gap (not a Gate 1/2/3 category, but resolved the same way — escalated to the user before drafting):** `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s User Menu section (lines 70-81) defines a closed, explicitly "superseding" registry of exactly 8 items with no "Queue Status" entry, while epics.md's AC (already user-confirmed when this story was split off from 3.9) explicitly requires "a dedicated 'Queue Status' section in my user menu." Presented to the user via `AskUserQuestion` with three options (amend EXPERIENCE.md / build without amending docs / halt and re-run `bmad-ux`); **user selected "Amend EXPERIENCE.md"** — see Task 7 for the concrete amendment and AC6.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.**
- Impacted fields/contracts: One new GraphQL field, `Subscription.pendingExtractionCount: Int!`, computed at resolve-time (not persisted) from the already-existing `posts.is_extracted` (boolean, Story 3.1a/earlier) and `posts.account_id` (uuid FK, indexed, Story 3.1a) columns — no schema change, no new column, no new table.
- Required DB migration changes: None — `posts.is_extracted`/`posts.account_id` and `api_keys.is_valid` already exist and are already migrated.
- Required TypeScript type changes: The GraphQL Code Generator run (Task 2) regenerates `apps/web/src/generated/graphql.ts` to add `pendingExtractionCount: number` to the generated `Subscription`/`GetMySubscriptionsQuery` types — this is a generated-artifact update, not a hand-written type change, and is the existing, expected codegen flow (`project-context.md`'s "End-to-End Type Safety" rule).
- Backward compatibility and rollout notes: Purely additive GraphQL field — no breaking change to any existing query/consumer of `mySubscriptions` (`subscriptions-content.tsx` continues to work unmodified since it doesn't request the new field).
- Verification checks: Task 1's extended `subscriptions.test.ts` case reads `pendingExtractionCount` back from a real GraphQL query against real seeded `posts` rows (mixed `isExtracted` values) to confirm the resolver's aggregate is correct end-to-end, including the `0`-count case.

### Project Structure Notes

- **New:** `apps/web/src/app/[locale]/settings/queue-status/page.tsx`, `queue-status-content.tsx`, `queue-status-content.test.tsx`; `packages/ui/src/core/status-badge.tsx` (+ its export wiring).
- **Modified:** `apps/backend/src/schema/subscriptions.graphql`, `apps/backend/src/schema/resolvers.ts` (`Subscription` field-resolver object), `apps/backend/src/schema/subscriptions.test.ts`; `apps/web/src/features/subscriptions/queries.graphql`, `apps/web/src/generated/graphql.ts` (regenerated); `packages/ui/src/core/app-shell/profile-menu-entries.ts`; `apps/web/src/components/layout/AppShellWrapper.tsx`; `apps/web/locales/en.json`, `apps/web/locales/id.json`; `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`.
- **Not modified:** `apps/backend/src/schema/api-keys.graphql`/its resolver (`myApiKeys` already complete and reused as-is); `apps/web/src/app/[locale]/settings/api-keys/*` and `apps/web/src/app/[locale]/settings/subscriptions/*` (referenced as patterns only, not touched); `packages/database/schema.ts` (no migration).
- Detected conflicts or variances: The `profile-menu-entries.ts`/`AppShellWrapper.tsx` label-key convention has a pre-existing mismatch on the `api-keys` entry (kebab-case `labelKey: 'api-keys'` vs. the camelCase `apiKeys` lookup key in `userMenuLabels`) — noted so the new `queue-status` entry deliberately uses the consistent camelCase `queueStatus` convention instead of copying the buggy pattern. Not this story's scope to fix the pre-existing `api-keys` entry.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.9a] — this story's authoritative AC/Note.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — swept Gate 1/3 report; does not cover `3.9a` (created after the sweep), addressed via the lightweight escape-hatch guard above.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, execution protocol, escape-hatch clause.
- [Source: _bmad-output/implementation-artifacts/3-9-implement-api-key-quota-management.md] — the sibling story this one was split from; its `Out of Scope`/Dev Notes document the FR23 gap this story resolves.
- [Source: _bmad-output/implementation-artifacts/3-1a-create-social-media-account-profiles-table.md] — `posts.accountId` FK reshape (Task 3 of 3.1a) this story's resolver joins on; confirms `mySubscriptions` was deliberately deferred out of 3.1a's own scope.
- [Source: _bmad-output/implementation-artifacts/3-1b-manage-and-revoke-api-keys.md] — `myApiKeys`/`ApiKey.isValid` origin; its own `Out of Scope` explicitly named "API key quota/usage display... Story 3.9" (a distinct, separate concern from this story) and "Nav/menu wiring... no menu link exists yet" (added later, by the menu-registry work this story extends).
- [Source: apps/backend/src/schema/api-keys.graphql, resolvers.ts:715-721] — existing `myApiKeys` query, reused unmodified.
- [Source: apps/backend/src/schema/subscriptions.graphql, resolvers.ts:47-55,63-75,722-728] — `Subscription` type/`formatSubscription`/existing `account` field-resolver pattern this story's `pendingExtractionCount` resolver mirrors.
- [Source: packages/database/schema.ts] — `posts` table (`accountId`, `isExtracted`, indexed on `accountId`, no `deletedAt`) and `apiKeys` table (`isValid`, partial active index) column definitions.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-1, #AD-2] — confirms the Unified Query DSL's binding is scoped strictly to `events`/"event collections", not `posts`/`apiKeys`.
- [Source: apps/web/src/app/[locale]/settings/subscriptions/{page.tsx,subscriptions-content.tsx,subscriptions-content.test.tsx}] — primary structural/pattern precedent (route shell, loading/error states, warning-banner-with-link pattern at lines 155-162, "Pending Review" inline badge precedent at line 229).
- [Source: apps/web/src/app/[locale]/settings/api-keys/{api-keys-content.tsx,api-keys-content.test.tsx}] — `useGetMyApiKeysQuery` usage precedent; confirms `isValid` is fetched but currently unrendered.
- [Source: packages/ui/src/core/app-shell/profile-menu-entries.ts, apps/web/src/components/layout/AppShellWrapper.tsx] — user-menu registry/label-wiring this story extends; documents the pre-existing `api-keys` label-key mismatch to avoid repeating.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md lines 55-81] — authoritative User Menu interaction spec/registry this story amends (Task 7).
- [Source: design-artifacts/C-UX-Scenarios/04-alex-extracts-events/04.8-in-app-queue-status.md] — non-authoritative draft UX this story's AC is grounded in (note: its "Rate-limited" third state and "estimated time" field are deliberately excluded from this story's AC — see AC2 and epics.md's own scoping).
- [Source: apps/web/locales/en.json, id.json — Metadata, UserMenu, SubscriptionsPage, ApiKeysSettingsPage namespaces] — i18n key-naming precedent this story's new `QueueStatusPage` namespace follows.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Organization (`StatusBadge` → `packages/ui/src/core/`), State Management Architecture (Server State via React Query), UI Patterns & UX Invariants (Non-Blocking/Initial-Load loader, Route-Level Suspense Fallback via `RouteLoader`), i18n Core Principle + Locale Management, Testing Rules (testing trophy — integration tests over unit tests for `apps/*`).
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1/AD-2 (confirmed out of scope for `posts`/`apiKeys`, see Dev Notes/References).
- [ ] `docs/infrastructure/2-backend.md` — confirms the GraphQL/Lambda resolver layer this story's `pendingExtractionCount` field is added to; unchanged infra shape.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New: `apps/web/src/app/[locale]/settings/queue-status/page.tsx`, `queue-status-content.tsx`, `queue-status-content.test.tsx`; `packages/ui/src/core/status-badge.tsx`.
  - Modified: `apps/backend/src/schema/subscriptions.graphql`, `resolvers.ts`, `subscriptions.test.ts`; `apps/web/src/features/subscriptions/queries.graphql`; `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited); `packages/ui/src/core/app-shell/profile-menu-entries.ts`; `apps/web/src/components/layout/AppShellWrapper.tsx`; `apps/web/locales/en.json`, `id.json`; `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`.
  - Not modified: `apps/backend/src/schema/api-keys.graphql`/resolver, `packages/database/schema.ts`, `apps/web/src/app/[locale]/settings/{api-keys,subscriptions}/*` (pattern sources only).
- **Rule Mapping:**
  - Code Organization (`project-context.md`) → `StatusBadge` placed in `packages/ui/src/core/` (Task 3), not inline in `apps/web`.
  - State Management (`project-context.md`) → Server State only, via existing `useGetMySubscriptionsQuery`/`useGetMyApiKeysQuery` React Query hooks (Task 2); no URL/Zustand state introduced.
  - Route-Level Suspense Fallback invariant (`project-context.md`) → `page.tsx`'s `<Suspense fallback={<RouteLoader />}>` (Task 2).
  - i18n Core Principle (`project-context.md`) → all copy sourced via `next-intl`, keys added to both `en.json`/`id.json` (Task 6).
  - AD-1/AD-2 scope boundary (architecture spine) → `pendingExtractionCount` deliberately built as a purpose-specific resolver field, not routed through the `events` DSL (Task 1).
  - Gate 1/2/3 + design-doc gap → Architecture & UX Gate Findings above; EXPERIENCE.md amendment (Task 7) per user's `AskUserQuestion` decision.
- **Verification Plan:**
  - Backend: `subscriptions.test.ts`'s new case asserts `pendingExtractionCount` against real seeded `posts` rows, including a `0`-count case (Task 1/8).
  - Frontend: `queue-status-content.test.tsx` covers happy path, Invalid-key warning (unhappy path per testing-trophy DoD), loading, error+retry, unauthenticated redirect, zero-count row (Task 8).
  - `pnpm --filter backend test`, `pnpm --filter web test`, `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: add a new `/settings/queue-status` page (per-subscription pending-extraction counts + per-key Active/Invalid status + Invalid-key warning), a new `pendingExtractionCount` GraphQL field/resolver, a new `StatusBadge` primitive, User Menu wiring, and an amendment to `EXPERIENCE.md`'s User Menu registry.
- [ ] Architecture and boundary confirmation: `pendingExtractionCount` stays a purpose-specific resolver field (not routed through the AD-1/AD-2 `events` DSL); `StatusBadge` lives in `packages/ui/src/core/`; no new external service/infra.
- [ ] Testing plan confirmation: backend real-DB integration test (Task 1/8) + frontend Vitest/MSW integration tests covering happy + unhappy paths (Task 8), per the plan above.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 reasoned fresh (no gap, see Architecture & UX Gate Findings); Gate 2 run fresh via Freya persona (no gap — build inline, no story split); design-doc gap (EXPERIENCE.md's closed User Menu registry) explicitly resolved by the user via `AskUserQuestion` — "Amend EXPERIENCE.md" selected.
- [ ] **EXPERIENCE.md amendment accepted:** confirm amending the authoritative UX doc's "superseding"/closed User Menu list (Task 7) — rather than leaving it stale or re-running `bmad-ux` — is the correct, sufficient resolution for this story.
- [ ] **Zero-state AC accepted:** confirm AC5 (plain "0", no special empty/all-caught-up copy) as the resolution to Gate 2's minor zero-state gap.

## Testing Requirements

- [ ] Integration tests (required): `apps/backend/src/schema/subscriptions.test.ts` new `pendingExtractionCount` case(s) (real local Postgres, `node:test`); `apps/web/src/app/[locale]/settings/queue-status/queue-status-content.test.tsx` (Vitest + Testing Library + MSW-mocked GraphQL) covering happy path and the Invalid-key-warning unhappy path.
- [ ] Unit tests: None required — no new `packages/domain` code (the pending-count computation is a resolver-level SQL aggregate, not portable business logic).
- [ ] E2E tests: Not required for this story (settings-page read view, matching the E2E scope precedent of `/settings/subscriptions`/`/settings/api-keys`, neither of which has a dedicated Playwright spec).
- [ ] Manual verification: Not applicable — no external credentials needed; all data comes from the local Postgres DB via existing/extended GraphQL queries.

## Deliverables Checklist

- [ ] `Subscription.pendingExtractionCount: Int!` field + resolver added and tested (Task 1).
- [ ] `/settings/queue-status` route live: page shell, content component, loading/error/empty states (Task 2).
- [ ] `StatusBadge` component added to `packages/ui/src/core/` and used for Active/Invalid rendering (Task 3).
- [ ] Invalid-key warning banner with working link to `/settings/api-keys` (Task 4).
- [ ] "Queue Status" entry added to the User Menu registry and rendered correctly (Task 5).
- [ ] All new copy present in both `en.json` and `id.json` (Task 6).
- [ ] `EXPERIENCE.md`'s User Menu registry amended with the new canonical "Queue Status" entry (Task 7).
- [ ] Backend + frontend integration tests passing; `pnpm build`/`pnpm lint`/`pnpm test` clean at the repo root (Task 8).

## Out of Scope

- A live "Rate-limited" API key status (third state beyond Active/Invalid) — Story 0.13's adapter doesn't persist rate-limit state; a future story would need to add a persisted signal first (AC2).
- An "estimated time to process" field for pending posts — present in the non-authoritative draft (`04.8-in-app-queue-status.md`) but not in epics.md's AC, and no backend source for such an estimate exists today.
- Story 3.9's own scope (verifying the Tier 1/Tier 2 quota-selection algorithm's observable multi-subscriber behavior) — entirely separate, already covered by Story 3.9 itself.
- The manual-post-selection quota progress bar (`04.6-quota-management-display.md`) — Epic 5 territory, unrelated to this story's user-menu queue-status page.
- Fixing the pre-existing `api-keys` menu-entry label-key casing mismatch in `profile-menu-entries.ts`/`AppShellWrapper.tsx` — noted as a landmine, not this story's scope to fix.

## Definition of Done

- [ ] AC 1-7 satisfied.
- [ ] All new/extended tests (`subscriptions.test.ts`, `queue-status-content.test.tsx`) passing.
- [ ] No regressions in any existing `apps/backend` or `apps/web` test suite.
- [ ] `pnpm lint` and `pnpm build` passing for `apps/backend`, `apps/web`, and `packages/ui`.
- [ ] `EXPERIENCE.md` amendment present and accurate.
- [ ] Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
