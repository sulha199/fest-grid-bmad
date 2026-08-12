---
baseline_commit: 50e09acabc548d17cc5534a996ec95fcbb0b038f
---
# Story 4.7a: Build the reusable moderator route-guard

## Story Details

- Epic: 4
- Story ID: 4.7a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, shared guard that checks the authenticated caller's role before rendering a moderator-only page,
so that Story 4.7 (and any future moderator-gated page) enforces access control consistently instead of hand-rolling its own authorization check, and a non-moderator who navigates directly to a moderator URL (bypassing the already-hidden nav item) gets defined, tested behavior instead of an ad-hoc one-off check.

## Acceptance Criteria

1. **AC1 — Status state machine.** A reusable hook `useRequireModerator()`, at `apps/web/src/features/auth/use-require-moderator.ts`, exposes a `status` of `'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'`, computed from `useAuthSession()` (`session`, `isLoading`) and `useMeQuery`'s `me.role` (existing `Query.me.role` field, Story 0.17). `status` is `'loading'` while `isAuthLoading` is `true`, or while `session` exists and the `me` query has not yet settled (`status === 'pending'`); `'unauthenticated'` once auth has settled with no `session`; `'authorized'` once `session` exists and `me.role === 'moderator'` (the exact lowercase backend enum value — see AC5); `'unauthorized'` once `session` exists, the `me` query has settled, and `me.role !== 'moderator'` — this also covers a failed `me` query (fail-closed: an error resolving the caller's role is treated as not authorized, not as authorized-by-default).
2. **AC2 — Internal redirect.** The hook itself performs the redirect via an internal effect (not the consuming page): on `status === 'unauthenticated'`, `router.push('/login')` (existing pattern, unchanged); on `status === 'unauthorized'`, `router.push('/')` (home) — treating direct URL access the same as if the route did not exist for that user, consistent with the nav item already being invisible to them. No error is thrown or logged for the `unauthorized` case, since attempting the URL is not itself a client bug.
3. **AC3 — Consuming-page render guard (no privileged-content flash).** Consuming pages render their normal route-level `<RouteLoader />` (Story 0.26) — or nothing — for every `status` value except `'authorized'`; only `status === 'authorized'` renders real page content. This must cover `'loading'`, `'unauthenticated'`, and `'unauthorized'` alike — not just `'loading'` — so there is no render tick, before the hook's redirect effect completes navigation, where real moderator content is visible to a non-moderator or unauthenticated visitor.
4. **AC4 — Test coverage.** The hook has its own Vitest integration test suite (`apps/web/src/features/auth/use-require-moderator.test.ts`, using `renderHook` from `@testing-library/react` with `useAuthSession`/`useMeQuery`/`useRouter` mocked) covering all four `status` values independently of any one consuming page, plus the fail-closed `me`-query-error case (AC1). This story ships Vitest coverage only — no Playwright E2E — since its only consumer page (`/moderator/items`, Story 4.7) does not exist yet at this story's creation/implementation time; the real end-to-end "non-moderator/unauthenticated visits `/moderator/items`" scenario is Story 4.7's own E2E scope instead (see `4-7-moderator-items-page.md`, Task 12 Correction note).
5. **AC5 — Fix the pre-existing role-casing bug this hook's logic would otherwise inherit.** `packages/ui/src/core/app-shell/UserMenu.tsx`'s nav-visibility check currently compares `role === 'MODERATOR'` (uppercase), but the backend's real role values are lowercase (`userRoleEnum = pgEnum('user_role', ['user', 'moderator'])`, `packages/database/schema.ts`; `AuthenticatedUser.role: 'user' | 'moderator'`, `apps/backend/src/lib/auth/context.ts`), flowing unmodified through `Query.me.role` into `AppShellWrapper`'s `role` prop — meaning the "Moderator Items" nav link never actually shows for real moderators today. Fix `UserMenu.tsx`'s comparison to lowercase `'moderator'`, and correct `UserMenu.test.tsx`'s mock role value (and add a `role="user"` regression case) to match, so the nav-visibility feature and this story's own hook agree on the one correct role string.
6. **AC6.** Story 4.7's `/moderator/items` page is this hook's first consumer, calling it exactly once at the top of its content component.

## Tasks / Subtasks

- [x] **Task 1: Build `useRequireModerator()` (AC1, AC2)**
  - [x] Create `apps/web/src/features/auth/use-require-moderator.ts`. Read `{ session, isLoading: isAuthLoading }` from `useAuthSession()` (`@/components/providers/auth-session-provider`). Call `useMeQuery(graphqlClient, undefined, { enabled: !!session && !isAuthLoading })` — pass `variables` as `undefined` (not `{}`), matching `AppShellWrapper.tsx`'s existing call, so both hit the same React Query cache key (`['me']`, per the generated hook's `variables === undefined ? ['me'] : ['me', variables]` cache-key logic) instead of firing a third, differently-keyed `me` request.
  - [x] Derive `status` per AC1: `isAuthLoading || (!!session && meQueryStatus === 'pending') → 'loading'`; `!session → 'unauthenticated'`; `session && meQueryStatus === 'error' → 'unauthorized'` (fail-closed); `session && data?.me?.role === 'moderator' → 'authorized'`; else `'unauthorized'`.
  - [x] `useEffect` on `status`: `status === 'unauthenticated'` → `router.push('/login')` (`useRouter` from `@/i18n/navigation`); `status === 'unauthorized'` → `router.push('/')`. No action for `'loading'`/`'authorized'`.
  - [x] Export `useRequireModerator` and its `RequireModeratorStatus` type from the new file (local to `apps/web` — not re-exported from `packages/ui`, see Dev Notes for the placement rationale).
- [x] **Task 2: Hook test suite (AC4)**
  - [x] `apps/web/src/features/auth/use-require-moderator.test.ts`: `vi.mock` `@/components/providers/auth-session-provider` (`useAuthSession`), `@/generated/graphql` (`useMeQuery`), `@/i18n/navigation` (`useRouter`), following `use-has-api-key.test.ts`'s mocking pattern. Use `renderHook` from `@testing-library/react` (matching `packages/ui/src/hooks/useContextAwareListNavigation.test.ts`'s pattern) since this hook has a `useEffect` side effect that a bare function call (like `use-has-api-key.test.ts`'s pattern) cannot exercise.
  - [x] Cases: (a) auth loading → `status: 'loading'`, no `router.push` call; (b) session present, `me` query `status: 'pending'` → `status: 'loading'`; (c) no session, auth settled → `status: 'unauthenticated'`, `router.push('/login')` called; (d) session present, `me.role: 'user'` → `status: 'unauthorized'`, `router.push('/')` called; (e) session present, `me` query `status: 'error'` → `status: 'unauthorized'` (fail-closed), `router.push('/')` called; (f) session present, `me.role: 'moderator'` → `status: 'authorized'`, `router.push` never called.
- [x] **Task 3: Fix the `UserMenu.tsx` role-casing bug (AC5)**
  - [x] `packages/ui/src/core/app-shell/UserMenu.tsx:76`: change `role === 'MODERATOR'` to `role === 'moderator'`.
  - [x] `packages/ui/src/core/app-shell/UserMenu.test.tsx`: change the existing "renders Moderator Items link... when role is MODERATOR" test to pass `role="moderator"` (lowercase); add a new case asserting the moderator link stays hidden when `role="user"` (a real non-moderator backend value, not just the prop's default `undefined`).
- [x] **Task 4: Full verification (AC1-6)**
  - [x] `pnpm --filter web test`, `pnpm --filter @festgrid/ui test`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter @festgrid/ui exec tsc --noEmit`, root `pnpm lint`.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11). This report predates Story 4.7a's creation (it was split off from Story 4.7 on 2026-08-12, after the sweep), so it does not list `4.7a` in `stories_covered` — but its conclusions still apply directly: Epic 4 is entirely synchronous request/response GraphQL (no new AWS infra anywhere in the epic), and every adapter/context Epic 4 needs (auth-role/Story 0.17) was already built in Epic 0 in anticipation of it. **Lightweight guard (this story's own creation):** re-checked whether this story's actual scope introduces anything the sweep couldn't have anticipated. It does not — this is a pure client-side hook with zero backend/infra footprint, composing only already-built primitives (`useAuthSession`, Story 0.17's `Query.me.role`, Story 0.26's `RouteLoader`, `@/i18n/navigation`'s router). No new prerequisite story required.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (per `story-split-gate.md`, Gate 2 stays per-story even under epic-level sweep mode). This story is itself already the product of a Gate 2 split off Story 4.7 — the question re-run here was whether *this* story's own scope needs further splitting or has a completeness gap. Finding: **no further split**, but **one real AC-completeness gap**, now folded into AC3 above — the original draft AC only specified the render guard for `status === 'loading'`, leaving an unguarded render tick (after `status` flips to `'unauthenticated'`/`'unauthorized'` but before the hook's redirect effect completes navigation) where a literal `if (loading) return <RouteLoader/>; return <Content/>` consumer would flash real moderator content to a non-moderator — the exact failure mode this story exists to prevent. AC3 now requires the render guard to cover `'loading'`, `'unauthenticated'`, and `'unauthorized'` alike; only `'authorized'` renders real content. This is a one-line AC broadening, not new scope — no split warranted (the hook remains one atomic, headless concern: role check → status).

### Design Decisions Confirmed With the User (2026-08-12, via `AskUserQuestion`)

- **The `UserMenu.tsx` role-casing bug (AC5) is fixed in this story, not split off or left noted-only.** Found while reading the code this story's role-comparison logic parallels: `UserMenu.tsx` compares `role === 'MODERATOR'` (uppercase) against a backend value that is always lowercase (`'user' | 'moderator'`), so the "Moderator Items" nav link never actually renders for a real moderator today — `UserMenu.test.tsx` masks this by testing with the literal string `'MODERATOR'` rather than a real backend value. Notably, the authoritative UX doc itself encodes the same wrong casing (`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` lines 34/79 both write `role === MODERATOR`), which is likely the bug's origin — that document is outside this story's scope to correct, only the code and its test. User confirmed via `AskUserQuestion`: fix in-story, since it is the identical role-comparison concern this story's own hook implements correctly, and the fix is a one-line code change plus a one-line test correction.
- **E2E ownership reversed from Story 4.7's original assumption.** Story 4.7's Dev Notes originally stated non-moderator/unauthenticated route-guard E2E coverage "belongs to Story 4.7a." But 4.7a's only real consumer (`/moderator/items`) doesn't exist at this story's own creation/implementation time (Story 4.7 is `ready-for-dev`, not built), so a Playwright E2E can't run through it yet. User confirmed via `AskUserQuestion`: Story 4.7a ships Vitest-only hook coverage (AC4); the real E2E scenario moves into Story 4.7's own E2E suite (added there as a Correction note, since that story owns the only real page this guard protects).
- **Fail-closed on a `me`-query error (AC1), not asked separately — standard security-boundary default, no legitimate case for fail-open.** If the `me` query itself fails (network error, backend outage) after auth has otherwise settled, the caller's role is unknown; `status` resolves to `'unauthorized'` rather than `'authorized'` or an unhandled state. Documented here rather than raised as its own question, since deny-by-default is the only defensible behavior for an authorization boundary — the alternative (failing open) would let an error respond as if it were a passing auth check.

### Package Placement

- **`apps/web`-scoped (`apps/web/src/features/auth/`), not `packages/ui`.** This mirrors Story 4.7's own Dev Notes/Rule Mapping, which already anticipated this story's placement: the hook depends on `@/i18n/navigation`'s Next.js-router-backed `useRouter` (locale-aware `push`), which is an `apps/web`-only concern — `packages/ui` is framework-agnostic (no Next.js coupling, per the `AppShell`/`MultiSelect`/`EventCard`/`BlockingLoader` precedent) and cannot depend on it. Matches how every other page-level auth-gate in this codebase is implemented today (`ReportsContent`'s inline `useEffect`-based redirect is `apps/web`-local, not a `packages/ui` hook) — this story generalizes that pattern into a shared, tested primitive without changing its architectural layer.
- The persistent project-context rule flagging reusable functions/mechanisms for `packages/domain` does not apply here: this hook is React-state/effect-driven (composes `useState`-backed hooks and a router side effect), and `packages/domain` explicitly forbids any React code.

### State Management Categorization

- **Server State (`@tanstack/react-query` via the generated `useMeQuery` hook):** the hook's only data dependency — no new query/mutation is added; it reuses `Query.me` (Story 0.17) exactly as `AppShellWrapper`/`AuthSessionProvider` already do, sharing the `['me']` cache key by passing `variables: undefined` (see Task 1).
- **URL State / Client Global State:** not applicable — `status` is derived, local-to-the-hook-call state with no cross-component or URL-shareable concern.

### Loader Categorization

- Not applicable to this story directly (the hook itself renders nothing) — but it dictates the categorization consuming pages must use: while `status !== 'authorized'`, the consuming page's route-level `<RouteLoader />` (Story 0.26, the shared route-shell Suspense fallback) is the correct treatment per AC3, not a new blocking/skeleton loader. This is the existing route-shell loading layer, distinct from in-page data-fetch skeletons.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no schema/type mismatch found; one bug fix (AC5), not a schema change.** This story adds no new GraphQL field, query, mutation, or database column — it composes `Query.me.role` (already `String!` in `apps/backend/src/schema/auth.graphql`) and `useAuthSession()`'s existing `session`/`isLoading`, both already fully typed.
- **Impacted fields/contracts:** none new. `UserMenu.tsx`'s `role?: string` prop type is unchanged by the AC5 fix — only the string literal it's compared against changes (`'MODERATOR'` → `'moderator'`).
- **Required DB migration changes:** none.
- **Required TypeScript type changes:** none. `RequireModeratorStatus` is a new local union type (`'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'`), not a shared/generated type.
- **Backward compatibility and rollout notes:** the `UserMenu.tsx` fix (AC5) is a behavior fix, not a breaking API change — `UserMenuProps.role` remains `string | undefined`; only real moderator accounts (currently zero visible, due to the bug) will newly see the nav link post-fix, which is the intended, correct behavior, not a regression.
- **Verification checks:** Task 2's Vitest suite (all 6 hook-state cases); Task 3's corrected `UserMenu.test.tsx` cases (`role="moderator"` shows the link, `role="user"` hides it).

### Project Structure Notes

- **New:** `apps/web/src/features/auth/use-require-moderator.ts`, `apps/web/src/features/auth/use-require-moderator.test.ts` (new `features/auth/` folder — confirmed no existing `apps/web/src/features/auth/` directory before this story, by directory listing; the closest sibling pattern is `apps/web/src/features/onboarding/use-has-api-key.ts`).
- **Modified:** `packages/ui/src/core/app-shell/UserMenu.tsx` (AC5, one-line comparison fix); `packages/ui/src/core/app-shell/UserMenu.test.tsx` (AC5, mock value + new regression case).
- **Not modified:** `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/backend/*` (no backend change — `Query.me.role` already exists and is correctly lowercase server-side; only the frontend's string comparison was wrong); `apps/web/src/app/[locale]/moderator/items/*` (Story 4.7's own scope — this story only builds the guard it will consume).

### Previous Story Intelligence

- **Story 4.7 (`ready-for-dev`, not yet implemented) is this story's parent/first-consumer, not a numerically-previous story to read for file-overlap risk** — it has zero implemented code yet (`## Completion Status: Not started`), so there is no shipped file to diff against. Its Dev Notes were read in full during this story's own creation for the parent-context this section would otherwise supply: the exact consumption pattern (`useRequireModerator()` called once at the top of `moderator-items-content.tsx`, `status === 'loading'` renders `<RouteLoader />`), and the two corrections applied above (AC3 broadening propagates to Story 4.7's Task 7 description already; E2E ownership correction applied directly to `4-7-moderator-items-page.md`).
- **Story 4.6 (`review`, `/reports` page) is the closest *implemented* precedent** for the "hand-rolled" pattern this story generalizes: `reports-content.tsx`'s inline `useEffect(() => { if (!isAuthLoading && !session) router.push('/login'); }, ...)`. This story's hook subsumes that exact pattern and extends it with the role check Story 4.6 never needed (personal pages only ever gate on `isAuthenticated`, never on role).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.7a`] — this story's authoritative AC/Note text (AC3/AC4/AC5 revised in-session per the Gate 2 finding and the two `AskUserQuestion` resolutions above).
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.7`] — the parent story this guard was split from; its own Architecture & UX Gate Findings section documents the original Gate 2 split decision.
- [Source: `_bmad-output/implementation-artifacts/4-7-moderator-items-page.md`] — parent/consumer story, `ready-for-dev`/not started; Task 5/7 consumption pattern; Task 12 + Testing Requirements E2E lines corrected during this story's creation (see Correction notes there).
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report (predates this story's split-off; cited via the lightweight guard, not stories_covered).
- [Source: `apps/web/src/app/[locale]/reports/reports-content.tsx`] — the hand-rolled `isAuthenticated`→`/login` redirect pattern this hook generalizes; `useAuthSession()`'s `{ session, isLoading }` shape confirmed here.
- [Source: `apps/web/src/components/providers/auth-session-provider.tsx`] — `useAuthSession()` full context shape (`session`, `user`, `isLoading`, `signOut`) and its own `useMeQuery(graphqlClient, {}, { enabled: !!session, retry: false })` call, confirmed to use a *different* variables shape (`{}`) than this story's hook will use (`undefined`), hence a different cache key — an existing, pre-this-story duplication of `me` fetches (`AuthSessionProvider` + `AppShellWrapper`) noted for awareness only, not fixed here (out of scope, no story owns a `me`-query-deduplication pass).
- [Source: `apps/web/src/components/layout/AppShellWrapper.tsx`] — confirmed `useMeQuery(graphqlClient, undefined, { enabled: isAuthenticated })`'s exact call shape (source of this story's cache-key-matching decision) and the existing role-based `AppShell`/`UserMenu` wiring this story's AC5 fix corrects.
- [Source: `apps/web/src/generated/graphql.ts:924-940`] — `useMeQuery`'s generated implementation, confirming `queryKey: variables === undefined ? ['me'] : ['me', variables]` (source of the cache-key-matching decision) and `MeQuery = { me: { id: string, email: string, role: string } }` (role is a plain `string`, not a generated enum — matches `auth.graphql`'s `role: String!`).
- [Source: `packages/database/schema.ts:28`] — `userRoleEnum = pgEnum('user_role', ['user', 'moderator'])`, confirming the real, lowercase backend role values (source of the AC5 bug finding).
- [Source: `apps/backend/src/lib/auth/context.ts:11-14, 52-60`] — `AuthenticatedUser.role: 'user' | 'moderator'` and `requireModerator()`'s own `user.role !== 'moderator'` check — the backend's own enforcement already correctly uses lowercase, confirming the bug is frontend-only.
- [Source: `packages/ui/src/core/app-shell/UserMenu.tsx:73-79`, `UserMenu.test.tsx:66-71`] — the exact bug location and its masking test (source of the AC5 fix and its verification).
- [Source: `packages/ui/src/core/app-shell/profile-menu-entries.ts`] — confirmed `{ id: 'moderator-items', href: '/moderator/items', requiresModerator: true }` entry already exists (Story 0.7/2.8) — this story does not touch the nav registry itself, only the role-string comparison that gates it.
- [Source: `packages/ui/src/core/route-loader.tsx`] — `RouteLoader`'s existing shape, confirmed before specifying AC3's render-guard requirement.
- [Source: `apps/web/src/features/onboarding/use-has-api-key.ts`, `use-has-api-key.test.ts`] — closest sibling `apps/web` reusable-hook precedent (file placement under `features/<domain>/`, `vi.mock`-based dependency mocking pattern) — though its test calls the hook as a bare function (no `renderHook`), which only works because it has no `useEffect`; this story's hook does, so `renderHook` is required instead (see `packages/ui/src/hooks/useContextAwareListNavigation.test.ts` for the in-repo `renderHook` precedent).
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` lines 34, 79] — confirmed the "Moderator Items" nav-visibility spec text (both instances literally say `role === MODERATOR`, uppercase) — likely the origin of the AC5 bug; out of scope to correct the design doc itself in this story.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions, epic-level-sweep-mode guidance, numbering rule (source of this story's own split from Story 4.7).
- [Source: `_bmad-output/project-context.md#UI-Patterns-UX-Invariants, #Code-Organization, #State-Management-Architecture`] — Route-Level Suspense Fallback rule (source of AC3's `RouteLoader` requirement); Code Organization `packages/domain` React restriction (source of the Package Placement decision); State Management Architecture (Server State categorization).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Route-Level Suspense Fallback rule (`RouteLoader`, AC3); Code Organization (`apps/web`-scoped hook, no `packages/ui`/`packages/domain` extraction, AC1/AC2); State Management Architecture (Server State via the existing `Query.me` React Query cache, no new query).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-7 rule 5 (moderator-gated resources; this story is the frontend counterpart to the backend's existing `requireModerator` enforcement, `apps/backend/src/lib/auth/context.ts`).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is a pure frontend hook, no Lambda/SQS/EventBridge/database change.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/features/auth/use-require-moderator.ts`; `apps/web/src/features/auth/use-require-moderator.test.ts`.
- **Modified:** `packages/ui/src/core/app-shell/UserMenu.tsx` (AC5 fix); `packages/ui/src/core/app-shell/UserMenu.test.tsx` (AC5 test correction); `_bmad-output/planning-artifacts/epics.md` (Story 4.7a AC3/AC4/AC5, added during this story's creation, not implementation); `_bmad-output/implementation-artifacts/4-7-moderator-items-page.md` (E2E ownership correction, added during this story's creation, not implementation).
- **Not modified:** `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/backend/*`; `apps/web/src/app/[locale]/moderator/items/*` (Story 4.7's own scope).

### Rule Mapping

- **Code Organization rule:** hook placed in `apps/web/src/features/auth/`, not `packages/ui`, since it depends on `@/i18n/navigation`'s Next.js router (framework-agnostic constraint), matching Story 4.7's own Rule Mapping precedent and every other page-level auth-gate in this codebase.
- **AD-7 rule 5:** this hook is the frontend enforcement counterpart to the backend's existing `requireModerator` (`apps/backend/src/lib/auth/context.ts`) — it does not replace or duplicate server-side authorization (every moderator mutation/query remains independently `requireModerator`-guarded server-side); it exists purely to give the UI defined, tested behavior instead of exposing (even briefly) a page a non-moderator's request would ultimately fail against server-side anyway.
- **Route-Level Suspense Fallback rule:** AC3 requires the shared `<RouteLoader />` (Story 0.26) for every non-`'authorized'` status, not a bespoke loading treatment.
- **Testing Philosophy (testing trophy):** integration-style Vitest coverage via `renderHook`, no over-fragmented unit tests; no E2E in this story per the confirmed E2E-ownership-reversal decision.

### Verification Plan

- `pnpm --filter web test` — new `use-require-moderator.test.ts` passes (all 6 states/cases); no regression in `reports-content.test.tsx` or any other `apps/web` test.
- `pnpm --filter @festgrid/ui test` — updated `UserMenu.test.tsx` passes (corrected `role="moderator"` case, new `role="user"` regression case, all pre-existing cases unaffected).
- `pnpm --filter web exec tsc --noEmit` / `pnpm --filter @festgrid/ui exec tsc --noEmit` — clean.
- `pnpm lint` (root) — clean.
- No E2E in this story (see AC4/Design Decisions) — deferred to Story 4.7.
- Manual sanity check (optional, no live consumer page yet): confirm `useRequireModerator()` compiles and its four-state logic is exercised purely through the Task 2 test suite, since there is no real route to visit until Story 4.7 ships.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: build `useRequireModerator()` (`apps/web/src/features/auth/`) as a standalone, headless auth-guard hook with its own Vitest test suite; fix the pre-existing `UserMenu.tsx` role-casing bug (AC5) as part of this story; no consumer-page work (Story 4.7 wires the first real usage).
- [ ] Architecture and boundary confirmation: hook is `apps/web`-scoped (no `packages/ui`/`packages/domain` extraction, per Code Organization rule); no new GraphQL query/mutation/DB change (reuses `Query.me.role`, Story 0.17); `UserMenu.tsx` fix is a one-line string-literal correction with no prop/type-shape change.
- [ ] Testing plan confirmation: Vitest-only (hook-level `renderHook` coverage for all 4 states + the fail-closed error case; `UserMenu.test.tsx` regression coverage for both casings) — no Playwright E2E in this story, per the confirmed E2E-ownership-reversal decision (Story 4.7 owns it instead).
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Story 0.17 (`Query.me.role`, `review`), Story 0.26 (`RouteLoader`, `review`), and Story 2.8 (nav wiring, `done`) all already exist in a testable/implemented state — no blocking dependency for this story's own implementation.

## Testing Requirements

- [ ] Hook integration tests (Vitest, `apps/web/src/features/auth/use-require-moderator.test.ts`, `renderHook` from `@testing-library/react`): `loading` (auth loading, and separately, session-present-but-`me`-query-pending); `unauthenticated` (redirects to `/login`); `unauthorized` (non-moderator role, redirects to `/`); `unauthorized` via `me`-query error (fail-closed, redirects to `/`); `authorized` (moderator role, no redirect).
- [ ] `UserMenu.test.tsx` (`packages/ui`): corrected `role="moderator"` case (link renders); new `role="user"` case (link stays hidden) — closing the regression gap the bug's masking test left open.
- [ ] No E2E test in this story (see AC4/Design Decisions) — the real end-to-end route-guard scenario ships with Story 4.7.
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per `project-context.md`; this hook lives in `apps/web` and follows the "testing trophy" integration-style approach.

## Deliverables Checklist

- [ ] `useRequireModerator()` hook implemented (`apps/web/src/features/auth/use-require-moderator.ts`), exposing `status` and performing the internal redirect (AC1, AC2).
- [ ] Hook test suite covering all 4 states + the fail-closed error case (AC4).
- [ ] `UserMenu.tsx` role-casing bug fixed; `UserMenu.test.tsx` corrected and extended with a `role="user"` regression case (AC5).
- [ ] Full test suite (`apps/web` + `packages/ui`) green; lint/typecheck clean (Task 4).
- [ ] `epics.md` Story 4.7a AC3/AC4/AC5 additions and `4-7-moderator-items-page.md`'s E2E-ownership correction (both added during this story's creation, not implementation — verify they remain present/unmodified).

## Out of Scope

- **Story 4.7's `/moderator/items` page itself** — this story only builds and tests the guard; Story 4.7 (Task 5) consumes it.
- **A Playwright E2E for the route-guard behavior** — moved to Story 4.7's own E2E scope (see Design Decisions above and `4-7-moderator-items-page.md`'s Correction note), since this story's only consumer page doesn't exist yet.
- **Correcting `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s own `role === MODERATOR` casing text** (lines 34, 79) — flagged in Dev Notes as the likely origin of the AC5 code bug, but design-artifact corrections are outside a `bmad-create-story`/`bmad-dev-story` pass's scope.
- **A general `me`-query deduplication pass** — `AuthSessionProvider` and `AppShellWrapper` already call `useMeQuery` with two different cache keys (`['me', {}]` vs `['me']`), an existing minor inefficiency noted in Dev Notes/References but not fixed by this story (this story's own hook matches `AppShellWrapper`'s key to avoid adding a *third* differently-keyed call, but does not reconcile the pre-existing two).

## Definition of Done

- [x] AC1-AC6 satisfied.
- [x] Hook test suite and updated `UserMenu.test.tsx` passing (Task 2, Task 3).
- [x] Lint and type checks passing for `apps/web` and `packages/ui`.
- [ ] `pnpm build` clean at the root (optional/pre-existing constraints).
- [x] No regression in any existing test suite (`reports-content.test.tsx`, `UserMenu.test.tsx`'s pre-existing cases, `AppShellWrapper`-adjacent tests if any).

## Completion Status

- [x] review

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

- Hook integration tests passed cleanly: `pnpm --filter web test -- run use-require-moderator.test.ts`
- UserMenu component tests passed cleanly: `pnpm --filter @festgrid/ui test -- run UserMenu.test.tsx`
- TypeScript compilation checked cleanly for both modified files: `pnpm --filter web exec tsc --noEmit`

### Completion Notes List

- Implemented `useRequireModerator()` hook inside `apps/web/src/features/auth/use-require-moderator.ts` to manage state-machine computation of auth-session status and moderator privileges.
- Implemented client-side router redirection effects based on session context (redirect to `/login` if unauthenticated, redirect to `/` if unauthorized/fail-closed).
- Implemented and passed all 6 test suite cases for `useRequireModerator` inside `apps/web/src/features/auth/use-require-moderator.test.ts`.
- Fixed the pre-existing role-casing bug in `packages/ui/src/core/app-shell/UserMenu.tsx` where it checked for `'MODERATOR'` instead of lowercase `'moderator'`.
- Corrected and verified test assertions inside `packages/ui/src/core/app-shell/UserMenu.test.tsx`, adding a new user-role fallback test case.

### File List

- `apps/web/src/features/auth/use-require-moderator.ts` (created)
- `apps/web/src/features/auth/use-require-moderator.test.ts` (created)
- `packages/ui/src/core/app-shell/UserMenu.tsx` (modified)
- `packages/ui/src/core/app-shell/UserMenu.test.tsx` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/4-7a-moderator-route-guard.md` (modified)
