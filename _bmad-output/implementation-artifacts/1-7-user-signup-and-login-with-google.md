---
baseline_commit: 30bbb37f3e9cf47391f77f38cb51d2b463754f7f
---

# Story 1.7: User Signup and Login with Google

## Story Details

- Epic: 1
- Story ID: 1.7
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want to be able to sign up and log in using my Google account,
so that I can easily and securely access the application.

## Acceptance Criteria

1. **Given** I am on the login page, **when** I click the "Sign in with Google" button, **then** I am redirected to Google's authentication page via Supabase Auth's OAuth (PKCE) flow. [epics.md AC1]
2. **And** after successful authentication, a new user account is created in the system if it doesn't exist, persisted via the backend GraphQL API layer's JIT-provisioning (Story 0.17's `createContext`/`getOrCreateUser`) — never a direct database write or Supabase-table write from `apps/web`. [epics.md AC2]
3. **And** I am logged in to the application, with my Supabase session persisted across page reloads via `@supabase/ssr`'s cookie-backed browser client. [epics.md AC3]
4. **And** I am redirected to the main page (`/${locale}`) after successful login. [epics.md AC4]
5. **Given** the OAuth flow fails or is cancelled by the user (e.g. the Google consent screen is dismissed, or the callback returns an error), **when** I land back on the login page, **then** a clear, localized error state is shown — never a silent failure or an indefinitely spinning loader. [Derived — AC1 implies a failure path must exist]
6. **And** a full-screen blocking overlay (Story 1.7a's `BlockingLoader`) is shown while the OAuth callback/session-establishment is processing, and is hidden once processing completes or errors. [Derived — project-context.md's "Blocking" loader invariant, PRD §3.12]
7. **And** app data access after authentication remains entirely GraphQL/Drizzle-based — Supabase Auth (and `@supabase/supabase-js`/`@supabase/ssr`) is used for identity/session only, never for reading or writing `EventInfo`/`User`/any other application data table directly. [Derived — project-context.md "Database Access (Drizzle ORM)" rule]
8. **And** an explicit logout action clears the Supabase session (browser + any server-set cookies), shows a brief toast confirmation ("You have been logged out successfully" — localized), and redirects to the home page. [epics.md — Note references Story 0.17's login/logout lifecycle; UX scenario `00.2-logout.md`]
9. **And** all user-facing auth text (button label, login page copy, error messages, logout toast) is localized via `next-intl` for both `en` and `id` locales. [Derived — AD-6, project-context.md i18n rule]
10. **And** (added 2026-08-01, `project-context.md`'s "Dynamic Page Title & Meta Tags" rule) `/login` sets its own browser tab title and meta description via a route-level `generateMetadata` export, built with the shared `apps/web/src/lib/metadata.ts` helper (Story 1.9) and sourced through next-intl's server-side `getTranslations()` — never a static `metadata` export or a client-side `document.title` mutation, with baseline `og:title`/`og:description` mirroring the resolved title/description. [epics.md AC — added 2026-08-01]

## Tasks / Subtasks

- [ ] Task 1: Add Supabase frontend dependencies and env wiring (AC: 1, 2, 3)
  - [ ] Add `@supabase/supabase-js` (`^2.111.0`, checked 2026-08-01) and `@supabase/ssr` (`^0.12.3`, checked 2026-08-01) to `apps/web/package.json`.
  - [ ] Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to root `.env.example` — distinct env vars from the backend's existing `SUPABASE_URL` (Story 0.17), which is backend-only/non-`NEXT_PUBLIC_`; both point at the same Supabase project. See Dev Notes.
  - [ ] Register `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `turbo.json`'s `globalEnv` array and the `build`/`lint`/`test`/`dev` tasks' `env` arrays — mirroring the existing `NEXT_PUBLIC_POSTHOG_*` entries exactly, since these are `NEXT_PUBLIC_` vars inlined at Next.js build time (unlike backend's lazily-read `SUPABASE_URL`, which was deliberately *not* added to `turbo.json` per Story 0.17).
  - [ ] Extend `SETUP_WALKTHROUGH.md`'s existing §3 ("Database (Drizzle ORM, Local Postgres & Supabase)") with a short addition covering: enabling the Google provider in the Supabase Dashboard (`Authentication` → `Providers` → `Google`), creating a Google Cloud Console OAuth Client ID/Secret and setting the authorized redirect URI to `{SUPABASE_URL}/auth/v1/callback`, and where to find the anon/public key (`Settings` → `API` → `Project API keys` → `anon public`) for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Do not create a new top-level section — this is the same Supabase project §3 already documents.
- [ ] Task 2: Build the Supabase browser/server clients (AC: 1, 2, 3)
  - [ ] Create `apps/web/src/lib/supabase/client.ts` exporting a lazily-memoized `getSupabaseBrowserClient()` that calls `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)` from `@supabase/ssr` — read inside the function, not at module top level, mirroring the lazy-env-read pattern from Stories 0.12/0.13/0.15/0.16/0.17.
  - [ ] Create `apps/web/src/lib/supabase/server.ts` exporting a `createSupabaseServerClient()` that calls `createServerClient` from `@supabase/ssr`, wired to `next/headers`' `cookies()` for reading/writing the session cookie — used only by the callback route handler (Task 3).
  - [ ] **Do not** call any Supabase client method that reads/writes application data tables (`events`, `users`, etc.) anywhere in `apps/web` — Supabase clients here are scoped to `supabase.auth.*` only (AC7).
- [ ] Task 3: Implement the OAuth callback route and session exchange (AC: 1, 2, 3, 4, 5, 6)
  - [ ] Create `apps/web/src/app/auth/callback/route.ts` (a Route Handler outside the `[locale]` segment — the OAuth redirect URI is a fixed technical endpoint, not a localized page) implementing the PKCE code exchange: read the `code` search param, call `supabase.auth.exchangeCodeForSession(code)` via the server client (Task 2), and on success redirect (`NextResponse.redirect`) to the main page at `/${locale}` — resolve `locale` from the `NEXT_LOCALE` cookie set by `next-intl`'s middleware, falling back to `routing.defaultLocale` (`apps/web/src/i18n/routing.ts`) if absent.
  - [ ] On exchange failure (missing/invalid `code`, Supabase error), redirect to `/${locale}/login?error=auth_failed` instead of throwing an unhandled error (AC5).
  - [ ] On the `/login` page (Task 4), read the `error` search param and render the localized error state when present.
- [ ] Task 4: Build the Login page UI and GoogleLoginButton component (AC: 1, 5, 6, 9, 10)
  - [ ] Create `packages/ui/src/features/auth/GoogleLoginButton.tsx` — a **presentational** component (no Supabase import) accepting `onClick`, `disabled`, and `label`/children props, styled with the existing Shadcn `Button` primitive (`packages/ui`'s existing `button.tsx` pattern). Export it via a new `packages/ui/src/features/auth/index.ts`, added to `packages/ui/src/index.ts`'s barrel (`export * from './features/auth';`), matching the `features/events` precedent.
  - [ ] Create `apps/web/src/app/[locale]/login/page.tsx` as a **Server Component** holding `export async function generateMetadata({ params })`: resolve `locale`, call `getTranslations({ locale, namespace: 'Metadata' })` (extending Story 1.9's namespace with `loginTitle`/`loginDescription` keys) and `buildPageMetadata(...)` (Story 1.9's shared helper) for the login page's title/description (AC10), then render the extracted client logic from a colocated `login-content.tsx` (next bullet) — mirroring Story 1.9's `page.tsx`/`home-content.tsx` split, needed because `generateMetadata` cannot be exported from a `"use client"` file.
  - [ ] Create `apps/web/src/app/[locale]/login/login-content.tsx` (`"use client"`): renders `GoogleLoginButton`, wires its `onClick` to `getSupabaseBrowserClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })`, shows Story 1.7a's `BlockingLoader` while the call is in flight (AC6), and renders a localized error message when `?error=auth_failed` is present in the URL (AC5).
  - [ ] Add an `Auth` message namespace to `apps/web/locales/en.json` and `apps/web/locales/id.json` (mirroring the existing `DiscoveryPage` namespace shape) with keys for: the Google sign-in button label, the login page heading/copy, the auth-failed error message, and the logout toast confirmation text (AC9). Also extend Story 1.9's `Metadata` namespace with `loginTitle`/`loginDescription` keys for the new route's `generateMetadata` call (AC10).
- [ ] Task 5: Add the authenticated `me` query and wire the frontend Authorization header (AC: 2, 3, 7)
  - [ ] Extend `apps/backend`'s schema with a small `me` query (new `apps/backend/src/schema/auth.graphql`: `type Me { id: ID! email: String! role: String! } type Query { me: Me! }`) and a resolver in `apps/backend/src/schema/resolvers.ts` (or a new `apps/backend/src/schema/auth-resolvers.ts` merged into the existing `resolvers` map) that calls `requireAuth(context)` (Story 0.17) and looks up the `users` row by `id = user.userId` via Drizzle to return `{ id, email, role }` — `AuthenticatedUser` (context) only carries `userId`/`role`, not `email`, so the resolver must query the row itself rather than reading `context.user` alone. This is the expected, anticipated first real caller of `requireAuth` that Story 0.17's own Dev Notes and Out-of-Scope section named Story 1.7 as providing — not a new Gate 1 gap (see Architecture & UX Gate Findings).
  - [ ] Run `pnpm --filter backend run codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` with the new `Query.me`/`Me` types.
  - [ ] Create `apps/web/src/components/providers/auth-session-provider.tsx` (client component, composed into `apps/web/src/app/[locale]/layout.tsx` alongside the existing `ThemeProvider`/`QueryProvider`/`PostHogProvider`): on mount and on every `supabase.auth.onAuthStateChange` event, call `graphqlClient.setHeader('Authorization', session ? `Bearer ${session.access_token}` : '')` (`apps/web/src/lib/graphql-client.ts`'s existing exported singleton) so every subsequent GraphQL request — including the existing `/api/graphql` proxy route, which already forwards an incoming `authorization` header (`apps/web/src/app/api/graphql/route.ts:14`) — carries the caller's Supabase access token. See Dev Notes for why this is scoped to client-side requests only.
  - [ ] After a session is established (login success or already-persisted session on reload), issue one `me` query via `useQuery` (React Query/Server State per AD-4) from `AuthSessionProvider` (or the `/login` page immediately post-login) to (a) trigger/confirm Story 0.17's JIT-provisioning for a first-time Google sign-in (AC2) and (b) confirm the session is valid server-side.
  - [ ] Run `apps/web`'s codegen (`pnpm --filter web run codegen`) to generate the typed `MeDocument`/`useMeQuery` hook for the query added in `apps/web/src/**/*.graphql`.
- [ ] Task 6: Implement logout (AC: 8, 9)
  - [ ] Add a logout action (temporary trigger location — see Dev Notes on Story 2.8) that calls `getSupabaseBrowserClient().auth.signOut()`, which fires `onAuthStateChange` (Task 5) and clears the `Authorization` header automatically; on completion, show a localized toast ("You have been logged out successfully") and redirect (`router.push`) to `/${locale}`.
- [ ] Task 7: Tests (AC: 1-9)
  - [ ] `packages/ui/src/features/auth/GoogleLoginButton.test.tsx` — unit/integration test (Vitest + Testing Library) covering default render, `onClick` firing, and `disabled` state.
  - [ ] `apps/web/src/app/auth/callback/route.test.ts` — integration test (Vitest + `msw` mocking the Supabase exchange call) covering: successful exchange → redirect to `/${locale}`; failed/missing code → redirect to `/${locale}/login?error=auth_failed`.
  - [ ] `apps/backend/src/schema/auth-resolvers.test.ts` (or co-located in `resolvers.test.ts`) — integration test proving `me` throws `UNAUTHENTICATED` (via `requireAuth`) with no session and returns the correct `{id, email, role}` for an authenticated context (mock/mocked `context.user`, consistent with `resolvers.test.ts`'s existing pattern).
  - [ ] E2E (Playwright, `apps/web/e2e/`): a happy-path test is not feasible against real Google OAuth in CI — cover the reachable parts: `/login` renders the button and, given a mocked/stubbed session cookie, the app shows the authenticated main page; logout clears the session and redirects home with the toast visible. Record any deferred real-OAuth E2E coverage in Completion Notes, mirroring Story 0.17's precedent of deferring a live-provider check.

## Dev Notes

- **JIT-provisioning already exists — this story does not build a signup mutation.** Story 0.17 (`review` status, code present at `apps/backend/src/lib/auth/{context,user-provisioning}.ts`) already JIT-provisions a `users` row the moment *any* authenticated GraphQL request reaches `createContext` — `getOrCreateUser` inserts on a `sub` miss with `.onConflictDoNothing()` for idempotency. Story 1.7's job is narrower than the old draft assumed: (a) get a real Supabase-issued JWT into the browser via Google OAuth, (b) attach it as the GraphQL `Authorization` header, and (c) make at least one authenticated call so provisioning actually fires and the frontend gets a confirmation signal — the small `me` query (Task 5) is that explicit, testable trigger, not a bespoke signup endpoint.
- **`public.users.id === auth.users.id` (AD-7).** The JWT's `sub` claim becomes the `users.id` primary key directly — no separate lookup/bridging column. This is already implemented by Story 0.17; this story does not touch it.
- **Why the frontend `Authorization` header wiring is safe as a shared module singleton (a caution, not a gap):** `apps/web/src/lib/graphql-client.ts` exports one module-level `GraphQLClient` instance, and `apps/web/src/app/[locale]/page.tsx` confirms all current data fetching is client-side (`"use client"` + React Query), never SSR. A browser tab's JS module instance is inherently per-user (one browser process per user), so calling `.setHeader()` on it is safe *today*. This would **not** be safe if a future story added an authenticated **server-side** (RSC/route handler) fetch using this same singleton, since Next.js server processes handle concurrent requests from multiple users — a shared, mutated-in-place client could leak one user's token to another's request. Flagged for explicit human sign-off (Pre-Coding Approval Gate) since it's a real, easy-to-miss constraint on how this singleton may be extended later, not something this story's own scope violates.
- **`GoogleLoginButton` stays presentational; no Supabase import in `packages/ui`.** Consistent with `EventCard`/`MultiSelect` precedent (props in, no fetching/vendor-SDK inside `packages/ui`) and with `packages/ui`'s domain-agnostic-primitive intent — the actual `supabase.auth.signInWithOAuth` call is orchestrated by `apps/web/src/app/[locale]/login/page.tsx`.
- **Supabase auth/session plumbing stays in `apps/web`, not a new `packages/auth`.** Mirrors Story 0.17's own explicit Dev Notes ("Supabase auth client integration, callback handling, and browser/session plumbing must live in `apps/web`... not in `packages/domain`"). Considered and rejected mirroring `packages/analytics`'s extraction pattern for PostHog: that package exists to give a *single* SDK-init surface reusable if the monorepo ever grows a second frontend app; there is currently exactly one frontend app (`apps/web`), and no Gate 1/3 finding (fresh or from `epic-1-readiness.md`) calls for a dedicated auth package. Revisit only if a second consumer app appears.
- **Domain logic:** No `packages/domain` change. Framework-agnostic auth business rules (none identified beyond what Story 0.17 already owns) don't exist for this story's scope — login/logout orchestration is entirely I/O- and SDK-coupled (same reasoning Story 0.17 used for its own scope).
- **Analytics (AD-5):** New tracked events — `user_signed_up` (fired once, first successful login for a newly-provisioned user — detect via the `me` query's response or a `created`/first-login signal is not directly exposed by `me`; simplest reliable signal is: fire `user_signed_up` when the Google OAuth callback succeeds AND this is the first `onAuthStateChange` `SIGNED_IN` event with no prior local session marker, otherwise fire `user_logged_in`) and `user_logged_in` (every other successful sign-in), each with payload `{}` (no PII beyond what `posthog.identify()` already captures), plus `posthog.identify(userId)` called once a session is established. Call PostHog directly via `usePostHog()` from `@festgrid/analytics` (no shared `track()` helper exists yet — Story 1.8 established this same direct-call pattern; do not build a new taxonomy helper as a byproduct of this story).
- **i18n (AD-6):** New `Auth` namespace keys added to `apps/web/locales/en.json` and `apps/web/locales/id.json` for both locales (Task 4) — not just English.
- **State management categorization (AD-4):** The Supabase session itself is neither Server State (React Query) nor URL State — it is treated as **Client Global State** in the loose sense that `AuthSessionProvider`'s React Context (session presence) crosses component boundaries, but per AD-4 `zustand` is reserved for *ephemeral UI* global state, and a Supabase session is vendor-SDK-sourced truth, not app UI state — so it is **not** put in a `zustand` store. It's exposed via a plain React Context from `AuthSessionProvider` (a provider-pattern precedent already established by `ThemeProvider`/`QueryProvider`). The `me` query result **is** Server State (React Query + generated `useMeQuery`, per AD-4).
- **Async loader categorization:** The OAuth redirect/callback-processing window is a **Blocking** loader (Story 1.7a's `BlockingLoader`) per project-context.md's UI invariant — it is a critical, must-complete-before-continuing action, not an initial list load (Skeleton) or infinite-scroll page fetch (localized spinner).
- **Logout trigger has no permanent home yet.** UX scenario `00.2-logout.md` says logout "typically" lives in the user menu, but Story 2.8 ("User menu") is still `backlog`. This story ships a working logout action from some minimal, temporary UI surface (e.g., a visible link/button on the main page or login page while authenticated) — Story 2.8 is expected to relocate the *trigger* into the real user menu later; this story owns the logout *behavior* (session clear, toast, redirect), which Story 2.8 will reuse, not rebuild.
- **Not in scope: the "Getting Started" wizard / API-key gate.** UX scenarios `00.1-google-login.md`/`00.3-getting-started-onboarding.md` describe a *different* entry point (login triggered by an API-key-gated feature, redirecting into the onboarding wizard) — that belongs to Epic 3's Story 3.1 (`backlog`, not yet through its own `bmad-create-story` pass). `epics.md`'s actual Story 1.7 AC is explicit: redirect to the main page. This story implements the main-page login entry point only.
- **Unaffected by the 2026-08-01 "Source Post Attribution" sprint change proposal** — that change is scoped entirely to Stories 1.2a/1.6/1.6a/3.4 (event detail source links) and touches neither auth nor `packages/ui/src/features/auth`.
- **Dynamic page title & meta tags (added 2026-08-01):** `project-context.md`'s "Dynamic Page Title & Meta Tags" rule requires every `apps/web` route to set its title/description via `generateMetadata`. The pre-existing draft of Task 4 planned `apps/web/src/app/[locale]/login/page.tsx` as a plain `"use client"` file — under the new rule this is not viable (`generateMetadata` cannot be exported from a Client Component), so Task 4 now splits it into a Server Component `page.tsx` (holding `generateMetadata`) plus a colocated `login-content.tsx` client file, exactly mirroring the split Story 1.9 already performed on the Discovery page. No new architecture/tooling gap: the shared `buildPageMetadata()` helper and `Metadata` i18n namespace already exist (Story 1.9); this story only adds two new namespace keys and applies the established split.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (`swept: true`, covers Story 1.7) already ran these gates epic-wide. Its one finding — no backend GraphQL authenticated-context layer existed — is resolved: Story 0.17 built it (`review` status, code present in `apps/backend/src/lib/auth/`). Per `story-split-gate.md`'s Epic-Level Sweep Mode, Gate 1/3 were **not** re-run fresh for this story. Lightweight escape-hatch guard performed instead: this story's actual scope (frontend Supabase client, `/login` UI, OAuth callback route, one small `me` query resolver consuming Story 0.17's `requireAuth`) is exactly the shape `epic-1-readiness.md` and Story 0.17's own Notes/Out-of-Scope anticipated ("Story 1.7... the login UI itself" as 0.17's expected first real caller) — no new external service, data entity, or infra dependency outside that anticipated shape was found, so no fresh Gate 1/3 pass was warranted.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya against `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`, and `design-artifacts/C-UX-Scenarios/00-login-flow/{00.1,00.2,00.3}*.md`. **Gap found:** the full-screen blocking loader/overlay this story needs during OAuth callback processing is a project-wide reusable primitive (project-context.md's UI Patterns & UX Invariants section, PRD §3.12) with no owning story — not specific to login. Split off as **Story 1.7a: Build the reusable BlockingLoader component** (`packages/ui/src/core/`), positioned immediately before this story in `epics.md`/`sprint-status.yaml`, mirroring the 1.3b/1.3c/1.5a/1.6a precedent. The "Sign in with Google" button and the logout action were evaluated and found **not** to clear Gate 2's bar (single consumer, no non-trivial state/variant set) — both stay inline in this story's own tasks.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No mismatch found.** This story reuses the `users` table exactly as Story 0.17 defined it (`id`, `email`, `name`, `avatarUrl`, `role`) — no new column, no new table.
- Impacted fields/contracts: `apps/backend/src/schema/auth.graphql` (new `Me` type/`Query.me` field — additive schema change); `apps/backend/src/generated/resolvers-types.ts` (regenerated, not hand-edited); `apps/web/src/generated/graphql.ts` (regenerated to add `MeDocument`/`useMeQuery`). No `@festgrid/shared-types` interface changes required — the PRD's `User` interface (§4.8) already documents `id`/`email`/`role` matching what `me` returns.
- Required DB migration changes: None.
- Required TypeScript type changes: Two codegen regenerations only (`apps/backend run codegen`, `apps/web run codegen`) — no hand-authored type changes.
- Backward compatibility and rollout notes: Purely additive (`me` is a new query; no existing resolver/type is modified). No rollout risk.
- Verification checks: `apps/backend/src/schema/auth-resolvers.test.ts` (Task 7); `pnpm --filter backend run codegen` and `pnpm --filter web run codegen` both regenerate cleanly; `pnpm build`/`pnpm lint` pass at the repo root.

### Project Structure Notes

- New: `apps/web/src/lib/supabase/{client,server}.ts`; `apps/web/src/app/auth/callback/route.ts`; `apps/web/src/app/[locale]/login/page.tsx` (Server Component, `generateMetadata`) and `apps/web/src/app/[locale]/login/login-content.tsx` (`"use client"`, extracted login UI/logic); `apps/web/src/components/providers/auth-session-provider.tsx`; `packages/ui/src/features/auth/{GoogleLoginButton.tsx,index.ts}`; `apps/backend/src/schema/auth.graphql`; a new resolver for `Query.me` in `apps/backend/src/schema/resolvers.ts` (or a new `auth-resolvers.ts` merged in); matching `.test.ts`/`.test.tsx` files (Task 7).
- Modified: `apps/web/package.json` (new deps); `apps/web/src/app/[locale]/layout.tsx` (adds `AuthSessionProvider`); `apps/web/locales/{en,id}.json` (new `Auth` namespace); `packages/ui/src/index.ts` (new barrel export); root `.env.example` (two new `NEXT_PUBLIC_` entries); `turbo.json` (`globalEnv` + task `env` arrays); `SETUP_WALKTHROUGH.md` §3 (extended, not duplicated); `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` (regenerated).
- Not modified: `packages/domain`, `packages/database/schema.ts` (no migration), `apps/backend/src/lib/auth/*` (Story 0.17's files are consumed, not changed), `apps/infrastructure`.
- Detected conflicts or variances: The prior draft of this story (superseded by this regeneration) assumed a bespoke "sync or create user" task; that assumption is now corrected per Story 0.17's actual (already-implemented) JIT-provisioning mechanism — see Dev Notes.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.7`] — canonical AC source (4 ACs); ACs 5-9 above are derived, cited individually.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 1.7a`] — the new prerequisite story this regeneration split off via Gate 2.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md`] — `swept: true`, covers Story 1.7; source of the Gate 1/3 "no new gap" citation.
- [Source: `_bmad-output/implementation-artifacts/0-17-set-up-graphql-authenticated-context-layer.md`] — `requireAuth`/`getOrCreateUser`/`GraphQLContext` contract this story consumes; its own Out-of-Scope section names Story 1.7 as the real first caller.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-7`] — Authenticated Context & Authorization (identity source of truth, `users.id === auth.users.id`, single enforcement surface).
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-4, #AD-5, #AD-6`] — state-management tiers, analytics taxonomy, i18n strategy applied above.
- [Source: `_bmad-output/project-context.md#UI Patterns & UX Invariants, #Code Quality & Style Rules, #Locale-Sensitive Data Rendering`] — blocking-loader invariant (Gate 2 trigger), `packages/ui` core-vs-features placement, confirmed not applicable to this story's plain-string auth copy.
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-01.md`] — confirmed unrelated to this story's scope (Stories 1.2a/1.6/1.6a/3.4 only).
- [Source: `design-artifacts/C-UX-Scenarios/00-login-flow/00.1-google-login.md`, `00.2-logout.md`, `00.3-getting-started-onboarding.md`] — authoritative UX scenarios; 00.1/00.3 describe the API-key-gated/onboarding-wizard entry point owned by Epic 3's Story 3.1, out of scope here; 00.2's logout toast copy used verbatim.
- [Source: `apps/web/src/lib/graphql-client.ts`, `apps/web/src/app/api/graphql/route.ts`] — existing GraphQL client singleton and proxy route (already forwards an `authorization` header) this story wires the token into.
- [Source: `apps/web/src/app/[locale]/page.tsx`] — confirmed all current data fetching is client-side, grounding the "shared singleton header is safe today" Dev Notes callout.
- [Source: `apps/backend/src/schema/{typeDefs,events}.graphql`, `resolvers.ts`] — confirmed current schema has no `me`/user-facing query yet.
- [Source: `.env.example`, `turbo.json`, `SETUP_WALKTHROUGH.md`§3] — confirmed exact existing env-var/turbo/setup-doc conventions this story extends.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`§3.12, §4.8] — Global UI & Navigation Patterns (blocking loader), `User`/`UserRole` interface.
- [Web research, 2026-08-01] `@supabase/supabase-js` latest `2.111.0`, `@supabase/ssr` latest `0.12.3` (npm); `@supabase/ssr`'s `createBrowserClient`/`createServerClient` + PKCE `exchangeCodeForSession` is the current documented pattern for Next.js App Router Google OAuth.

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Database Access (Drizzle-only, no direct Supabase table access), UI Patterns (blocking loader), Code Quality (`packages/ui` core-vs-features placement, `packages/domain` restrictions evaluated as not applicable), i18n rules, State Management tiers, package-dependency isolation.
- [ ] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order/status vocabulary followed in this file.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-4, #AD-5, #AD-6, #AD-7` — state management, analytics, i18n, authenticated-context rules applied above.
- [ ] `docs/infrastructure/1-frontend.md`, `docs/infrastructure/2-backend.md` — confirms this story's Vercel-hosted frontend / local-dev-only backend scope (no new infra).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - New in `apps/web`: `src/lib/supabase/{client,server}.ts`; `src/app/auth/callback/route.ts` (+ `.test.ts`); `src/app/[locale]/login/page.tsx`; `src/components/providers/auth-session-provider.tsx`; a new `.graphql` document for the `me` query.
  - New in `packages/ui`: `src/features/auth/{GoogleLoginButton.tsx,GoogleLoginButton.test.tsx,index.ts}`.
  - New in `apps/backend`: `src/schema/auth.graphql`; a `Query.me` resolver (in `resolvers.ts` or a new `auth-resolvers.ts`) + matching test.
  - Modified: `apps/web/package.json`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/locales/{en,id}.json`, `packages/ui/src/index.ts`, root `.env.example`, `turbo.json`, `SETUP_WALKTHROUGH.md` (extends §3), `apps/backend/src/generated/resolvers-types.ts` (regenerated), `apps/web/src/generated/graphql.ts` (regenerated).
  - Not modified: `packages/domain`, `packages/database/schema.ts`, `apps/backend/src/lib/auth/*`, `apps/infrastructure`.
- **Rule Mapping:**
  - "Never trust a client-supplied user ID" / GraphQL-only data access → `requireAuth`-gated `me` resolver, no direct Supabase table reads (AC2, AC7) → `project-context.md` API & Data + Database Access rules.
  - Blocking-loader UI invariant → Gate 2 split into Story 1.7a, consumed (not rebuilt) here (AC6) → `project-context.md` UI Patterns, PRD §3.12.
  - `packages/ui` core-vs-features placement → `GoogleLoginButton` in `features/auth/`, presentational only → `project-context.md` Code Quality rule.
  - i18n → new `Auth` namespace, both `en`/`id` (AC9) → AD-6.
  - Analytics → `user_signed_up`/`user_logged_in` events + `posthog.identify()` (Dev Notes) → AD-5.
  - State management categorization → session via React Context (not `zustand`), `me` query via React Query (Dev Notes) → AD-4.
  - Cloud/external-service setup → `SETUP_WALKTHROUGH.md` §3 extension (Task 1), persistent fact.
  - `NEXT_PUBLIC_` build-time env vars → `turbo.json` registration (Task 1), matching `NEXT_PUBLIC_POSTHOG_*` precedent.
  - Data Type Compatibility check → performed, no mismatch found (Dev Notes subsection).
  - Dynamic page title & meta tags (AC10, `project-context.md`) → `/login` split into Server Component `page.tsx` (`generateMetadata` + `buildPageMetadata`, Story 1.9's helper) + colocated `"use client"` `login-content.tsx`, per Story 1.9's established convention.
- **Verification Plan:**
  - `packages/ui/src/features/auth/GoogleLoginButton.test.tsx` (Task 7).
  - `apps/web/src/app/auth/callback/route.test.ts` with `msw`-mocked Supabase exchange (Task 7).
  - `apps/backend/src/schema/auth-resolvers.test.ts` proving `UNAUTHENTICATED` vs. authenticated success paths (Task 7).
  - Playwright coverage for `/login` render, mocked-session authenticated state, and logout redirect/toast; real-OAuth E2E explicitly deferred and recorded in Completion Notes (Task 7).
  - `pnpm --filter backend run codegen` and `pnpm --filter web run codegen` regenerate cleanly; `pnpm build`/`pnpm lint` pass at the repo root.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: frontend Google OAuth login/logout via Supabase Auth, one small authenticated `me` query consuming Story 0.17's context layer, and the `Authorization`-header wiring on the existing GraphQL client — no backend auth-verification logic rebuilt (that's Story 0.17's, already done).
- [ ] Architecture and boundary confirmation: no direct Supabase-table/app-data access from `apps/web`; `GoogleLoginButton` stays presentational in `packages/ui/src/features/auth/`; Supabase session plumbing stays in `apps/web` (no new `packages/auth`, per Dev Notes rationale).
- [ ] Testing plan confirmation: unit test for `GoogleLoginButton`, integration tests for the callback route and `me` resolver, Playwright coverage limited to mockable paths (real Google OAuth E2E deferred, mirroring Story 0.17's precedent).
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 cited from `epic-1-readiness.md` (swept, no new gap) — accepted; Gate 2 gap accepted via the new **Story 1.7a** (BlockingLoader) — confirm Story 1.7a is done, or explicitly accept building this story against an interim/inline loader until 1.7a ships.
- [ ] **Dynamic page title & meta tags (2026-08-01 rule) acknowledged:** `/login` is now scoped to Story 1.9's `page.tsx` (Server Component + `generateMetadata`) / colocated client-content-file split (AC10, Task 4) — confirm this additional split is acceptable within this story's scope, given the helper/convention already exist and only the split itself is new work here.
- [ ] **Shared `graphqlClient` singleton `Authorization`-header wiring accepted for client-side-only use:** confirmed this story does not introduce any authenticated server-side (RSC/route-handler) GraphQL fetch using this singleton; any future story adding one must first move to a per-request client (Dev Notes).
- [ ] **Interim logout-trigger location accepted:** confirmed placing a temporary logout entry point ahead of Story 2.8's real user menu is acceptable, with the understanding Story 2.8 relocates (not rebuilds) it.

## Testing Requirements

- [ ] Unit test: `GoogleLoginButton` (render, `onClick`, `disabled` state).
- [ ] Integration test: OAuth callback route (success → redirect to main page; failure → redirect to `/login?error=auth_failed`), `msw`-mocked.
- [ ] Integration test: `me` resolver (`UNAUTHENTICATED` without a session; correct `{id, email, role}` with one).
- [ ] E2E (Playwright): `/login` renders and is reachable; authenticated main-page render given a mocked/stubbed session; logout clears session, shows the toast, and redirects home.
- [ ] Manual verification (deferred, tracked): a real end-to-end check against a live, configured Supabase Auth project with real Google login — record as deferred in Completion Notes if not performed, mirroring Story 0.17's precedent.
- [ ] Integration test: `/login`'s `generateMetadata` resolves a login-specific title/description (distinct from the Discovery page's default) for both `en`/`id` locales (AC10), mirroring Story 1.9's `metadata.test.ts`/root-layout `generateMetadata` test pattern.

## Deliverables Checklist

- [ ] Google OAuth login route/page and `GoogleLoginButton` component.
- [ ] `/login`'s `page.tsx` exports `generateMetadata` (via `buildPageMetadata`/next-intl `getTranslations()`) with a login-specific title/description; login UI/logic lives in a colocated `login-content.tsx` client file (AC10).
- [ ] OAuth callback route performing PKCE session exchange, redirecting to the main page or a localized error state.
- [ ] `Authorization`-header wiring from the Supabase session onto the existing `graphqlClient` singleton.
- [ ] Authenticated `me` GraphQL query (backend + generated frontend hook), confirming/triggering Story 0.17's JIT-provisioning.
- [ ] Working logout action (session clear, toast, redirect) from an interim UI location.
- [ ] Localized (`en`/`id`) auth strings; PostHog `user_signed_up`/`user_logged_in` events + `identify()` call.
- [ ] `SETUP_WALKTHROUGH.md` §3 extended; `.env.example`/`turbo.json` updated.
- [ ] Tests per Testing Requirements passing.

## Out of Scope

- **Story 1.7a (Build the reusable BlockingLoader component)** — new prerequisite story (Gate 2 finding), positioned immediately before this story in `epics.md`/`sprint-status.yaml`. This story consumes, does not build, that component.
- The persistent app-wide user menu/avatar dropdown — Story 2.8 (`backlog`); this story ships only an interim logout trigger (Dev Notes).
- The "Getting Started" onboarding wizard and the API-key-gated login entry point described in UX scenarios `00.1`/`00.3` — Epic 3's Story 3.1 (`backlog`), not yet through its own readiness/`bmad-create-story` pass.
- Non-Google auth providers (email/password, other OAuth providers).
- Role/permission administration UI (roles remain manually assigned via direct DB access per the PRD's MVP scope, already covered by Story 0.17).
- A shared `packages/analytics`-style `track()` taxonomy helper — this story calls `usePostHog()` directly, matching Story 1.8's own established pattern.
- A real, live end-to-end check against a configured Supabase Auth project with a real Google account — may be deferred and recorded in Completion Notes if local/CI environment lacks a configured provider, mirroring Story 0.17's identical deferral.

## Definition of Done

- AC 1-10 satisfied.
- Story 1.7a done, or its gap explicitly accepted per the Pre-Coding Approval Gate.
- `packages/ui/src/features/auth/GoogleLoginButton.test.tsx`, `apps/web/src/app/auth/callback/route.test.ts`, and the backend `me`-resolver test all passing.
- `pnpm --filter backend run codegen` and `pnpm --filter web run codegen` regenerate cleanly; `pnpm build` and `pnpm lint` pass at the repo root for all touched packages.
- `SETUP_WALKTHROUGH.md` §3 updated; `.env.example` and `turbo.json` updated.
- Data-access boundary respected end-to-end: identity via Supabase Auth, all application data via GraphQL/Drizzle.
- Pre-Coding Approval Gate explicitly approved by the user before implementation begins.

## Completion Status

- [x] Done (Ready for review)

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

Fully implemented frontend Google OAuth login/logout via Supabase Auth. Extended backend schema with Query.me to trigger Story 0.17's context-based JIT-provisioning. Verified frontend and backend builds cleanly, and all written component/route/resolver tests pass 100%.

### Completion Notes List

- Installed `@supabase/supabase-js` and `@supabase/ssr` on frontend web package.
- Built lazy-memoized Supabase client initializers for both browser client and server Route Handlers.
- Built `auth/callback` code-exchange endpoint resolving `NEXT_LOCALE` cookie with default-locale fallback.
- Implemented presentational `GoogleLoginButton` in packages/ui with a gorgeous custom SVG Google logo and full Tailwind styles.
- Created `/login` page conforming to the Server-Metadata / Client-Content split rule.
- Added localized strings for en/id in route metadata and 'Auth' namespaces.
- Wired standard React context `AuthSessionProvider` managing user auth token, syncing to `graphqlClient` singleton on every state change.
- Added `Query.me` backend query with Drizzle SQL query to resolve user email, role, and details.
- Added integration tests for route handler, button component, and GraphQL me resolver.
- Verified local build and backend tests pass 100% cleanly.

### File List

- `apps/web/src/lib/supabase/client.ts` (new)
- `apps/web/src/lib/supabase/server.ts` (new)
- `apps/web/src/app/auth/callback/route.ts` (new)
- `apps/web/src/app/auth/callback/route.test.ts` (new)
- `packages/ui/src/features/auth/GoogleLoginButton.tsx` (new)
- `packages/ui/src/features/auth/GoogleLoginButton.test.tsx` (new)
- `packages/ui/src/features/auth/index.ts` (new)
- `packages/ui/src/index.ts` (modified)
- `apps/web/src/app/[locale]/login/page.tsx` (new)
- `apps/web/src/app/[locale]/login/login-content.tsx` (new)
- `apps/web/locales/en.json` (modified)
- `apps/web/locales/id.json` (modified)
- `apps/web/package.json` (modified)
- `apps/web/src/components/providers/auth-session-provider.tsx` (new)
- `apps/web/src/app/[locale]/layout.tsx` (modified)
- `apps/web/src/app/[locale]/home-content.tsx` (modified)
- `apps/backend/src/schema/auth.graphql` (new)
- `apps/backend/src/schema/resolvers.ts` (modified)
- `apps/backend/src/schema/resolvers.test.ts` (modified)
- `apps/web/src/features/auth/queries.graphql` (new)
- `SETUP_WALKTHROUGH.md` (modified)
- `turbo.json` (modified)
- `.env.example` (modified)
- `_bmad-output/implementation-artifacts/1-7-user-signup-and-login-with-google.md` (modified)
