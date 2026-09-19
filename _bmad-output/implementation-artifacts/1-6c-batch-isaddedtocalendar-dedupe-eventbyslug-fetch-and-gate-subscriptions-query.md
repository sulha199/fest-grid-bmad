# Story 1.6c: Batch Schedule.isAddedToCalendar, dedupe the eventBySlug double-fetch, and gate the event-detail subscriptions query

## Story Details

- **Epic:** 1 — Core App and Event Discovery
- **Story ID:** 1.6c
- **Status:** ready-for-dev

## Story

**As a** developer,
**I want** the event-detail page's `eventBySlug`/`event` resolver to reuse Story 1.3j's batched-schedules mechanism for `Schedule.isAddedToCalendar`, its server/client double-fetch eliminated via authenticated cache hydration, and its subscriptions query gated on actually needing it,
**So that** opening an event's detail page costs one resolver fan-out instead of two — for every visitor, logged in or not — and does not issue a schedule-count-sized number of extra queries or an unconditional subscriptions call.

## Acceptance Criteria

1. **(AD-17 Rule 3, BUG-033)** Given `event`/`eventBySlug` resolves `schedules`, when it does so, then it reuses Story 1.3j's Rule 2 batched `IN (...)` schedules query — the same code path, not a separate implementation (extracted into a shared, callable function if Story 1.3j's own implementation left it inline inside the `events` resolver only) — whose `virtualFields` map additionally includes an `isAddedToCalendar` entry (`userId ? exists(db.select({id: calendarAdditions.id}).from(calendarAdditions).where(and(eq(calendarAdditions.userId, userId), eq(calendarAdditions.scheduleId, schedules.id), activeOnly(calendarAdditions)))) : sql\`false\``, mirroring `fieldMap.isAddedToCalendar`'s existing Event-level shape one level down). `Schedule.isAddedToCalendar` becomes a passthrough reading `parent.isAddedToCalendar` (already shipped by Story 1.3j's Task 4, resolver-arity-agnostic — no additional field-resolver change needed here), falling back to today's per-schedule query only when absent. This applies identically whether `event`/`eventBySlug` returns one row — an `IN (...)` query over a one-element id array is the same query shape as Story 1.3j's page case, no resolver-arity special-casing needed.
2. **(BUG-035, resolved via AskUserQuestion during story drafting — see Dev Notes → Design Decision)** Given `apps/web/src/app/[locale]/events/[slug]/page.tsx` and the intercepted `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` run their server-side event fetch, when they do so, then: (a) the fetch is de-duplicated across `generateMetadata` and the page body within one request via React's `cache()` (first use in `apps/web/src` — confirmed via direct grep of `apps/web/src` before drafting), so the backend resolver fan-out runs once per pageview, not twice; (b) the fetch is **authenticated** — it reads the visitor's session server-side via the existing `createSupabaseServerClient()` helper (`apps/web/src/lib/supabase/server.ts`, today used only by the OAuth callback route) and forwards the access token as a **per-call** `Authorization: Bearer <token>` header on `graphqlClient.request(doc, vars, headers)` — never via `graphqlClient.setHeader()`, which mutates the shared module-level singleton and is unsafe across concurrent requests from different users in the same Node process; anonymous visitors get no header, exactly as `generateMetadata`'s fetch behaves today; (c) that fetch's result is seeded into a per-request `QueryClient` via `queryClient.setQueryData(['getEventBySlug', { slug }], data)` (the exact key `useGetEventBySlugQuery` — verified in `apps/web/src/generated/graphql.ts` line 2637 — already uses) and dehydrated (`dehydrate(queryClient)`) into a `HydrationBoundary` wrapping the existing `<Suspense fallback={<RouteLoader/>}><EventDetailWrapper/></Suspense>` tree, so `EventDetailWrapper.tsx`'s client-side `useGetEventBySlugQuery` hydrates from that cache on initial render instead of issuing its own network request; (d) on a failed server-side fetch, hydration is skipped entirely (no `setQueryData` call) so the client falls back to its own fetch and its already-built not-found/error UI branches — preserving today's graceful-degrade behavior, which is not spelled out in the originating epics.md/proposal text but is required for the story to leave the system working end-to-end. `generateMetadata` itself is unchanged in scope (still reads only `eventName`/`description` from the result).
3. **And** `EventDetailWrapper.tsx`'s `router.prefetch()` for the adjacent next/prev event (current lines ~354-363 — the epics.md source text's own citation of "317-326" is stale/drifted, verified via direct read of the current 716-line file) is unaffected by this change — out of scope, a separate speculative prefetch, not part of BUG-035's doubled-fetch defect.
4. **And** a regression test confirms that after a first page load of `/events/[slug]` (and the intercepted modal route) settles, the browser issues **zero** additional client-initiated `/api/graphql` requests for the `getEventBySlug` operation — the observable, client-side half of "not two fetches" that a Playwright test can actually assert (the server-side dedup in AC2(a) happens inside the Next.js server process and is not independently observable via browser-level network interception; verified separately per Task 6's manual check).
5. **(FIND-030)** Given `EventDetailWrapper.tsx:58-64` calls `useGetMySubscriptionsQuery`, when it does so, then its `enabled` condition is narrowed from `!!session` alone to `!!session && !!data?.eventBySlug?.sourceSocialMediaAccountProfile` — matching FIND-030's own stated fix direction (gate on the event actually having a linked source account) over lifting it to shell level, since — unlike `useMeQuery` — no other route needs this query warmed at shell level, and gating removes the call entirely for the common case of an event with no linked account.
6. **And** existing resolver behavior for `event`/`eventBySlug` is otherwise unchanged and regression-verified: `sourceSocialMediaAccountProfile`, `isFavorited`, `favoriteCount`, `isHiddenForCurrentUser`, `publishedAt` continue to resolve exactly as before.
7. **And** a logged-in visitor's server-side-hydrated `isFavorited`/`isAddedToCalendar` values (event-level and per-schedule) reflect their **real** state, not a forced `false` — the concrete proof that AC2(b)'s authenticated-fetch requirement actually holds end-to-end, not just that the mechanism is wired.

## Tasks / Subtasks

- [ ] **Task 1 — Confirm Story 1.3j has shipped and locate/extract its batched-schedules code path** (AC1)
  - [ ] Before starting any other task, check `sprint-status.yaml`'s `1-3j-batch-computed-event-fields-and-gate-totalcount-staletime` entry. If it is not `done`, **halt** — this story's Task 2 cannot be written against a mechanism that doesn't exist in code yet. (Status at story-drafting time: `ready-for-dev`, not yet implemented — see Dev Notes → Previous/Sibling Story Intelligence.)
  - [ ] Read Story 1.3j's actual shipped `events` resolver code (not just its story file's plan) to see whether its batched-schedules query (`db.select({...buildOptimizedDrizzleSelect(schedules, info, {path, virtualFields})}).from(schedules).where(inArray(schedules.eventId, ids))`, grouped by `eventId` in JS) was written inline inside the `events` resolver function body, or already extracted into a shared, exported helper.
  - [ ] If inline only: extract it into a shared function (e.g. `batchScheduleRowsForEvents({ eventIds, info, path, virtualFields })` in `apps/backend/src/schema/resolvers.ts`, or a new export in `packages/graphql-select` if that fits the existing module boundary better) that both the `events` resolver and this story's `event`/`eventBySlug` resolvers call — this is a regression-neutral refactor (the `events` resolver's own behavior/output must be provably unchanged after extraction; add/run the existing `events`-resolver query-count test from Story 1.3j to confirm).
- [ ] **Task 2 — Wire `event`/`eventBySlug` to the shared batched-schedules path with an `isAddedToCalendar` virtual field** (AC1, AC6)
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `event` resolver (~line 3202) and `eventBySlug` resolver (~line 3283), after fetching the single event row, call the shared function from Task 1 with `eventIds: [row.id]`, `path: 'schedules'` (single-level — confirmed correct for these two resolvers by Story 1.3j's own "Design Decision" Dev Note: their `info` already represents `Event` directly, unlike the `events` list resolver's two-level `EventConnection → items → schedules` case), and `virtualFields: { isAddedToCalendar: <expression from AC1> }` gated on `userId` (derive `userId` the same way `fieldMap.isAddedToCalendar` already does at line ~3024, via the resolver's own auth context — do not `requireAuth()`, since these resolvers must keep working for anonymous visitors).
  - [ ] Attach the batched result as `row.schedules` before returning from both resolvers.
  - [ ] Do NOT modify `Event.schedules`/`Schedule.isAddedToCalendar` field resolvers — Story 1.3j's Task 4 passthrough (`return parent.field !== undefined ? parent.field : <old per-row query>`) already ships resolver-arity-agnostic and applies to `event`/`eventBySlug` automatically once `parent.schedules[].isAddedToCalendar` is pre-populated by Task 2 above.
- [ ] **Task 3 — Build the shared, request-scoped authenticated fetch helper** (AC2(a), AC2(b))
  - [ ] Create one shared module (e.g. `apps/web/src/features/events/get-event-by-slug-cached.ts`) exporting `getEventBySlugCached = cache(async (slug: string) => {...})` (import `cache` from `"react"` — first use anywhere in `apps/web/src`, confirmed via grep before drafting). Inside: call `createSupabaseServerClient()` (`apps/web/src/lib/supabase/server.ts`), then `.auth.getSession()`; if a session with `access_token` exists, build `{ Authorization: \`Bearer ${session.access_token}\` }`, else `undefined`. Wrap the whole body in try/catch (mirroring `generateMetadata`'s existing graceful-degrade posture) — on any error (including a Supabase/cookie read failure), fall back to an unauthenticated call rather than failing the request.
  - [ ] Call `graphqlClient.request<GetEventBySlugQuery>(GetEventBySlugDocument, { slug }, headers)` — the per-call `headers` argument, NOT `graphqlClient.setHeader()` (which would mutate the shared singleton across concurrent requests — a real cross-user leak/race risk in a shared Node process, distinct from the browser, where `auth-session-provider.tsx`'s existing `setHeader()` usage is safe only because each browser tab has exactly one client-side singleton for one user).
  - [ ] Return `null` on any fetch failure (slug not found, network error) rather than throwing, so callers can distinguish "no data to hydrate" from "data present."
  - [ ] One shared module for both `page.tsx` files, per the story-split-gate dispatch's own flagged risk of copy-paste drift between the two otherwise-identical 47-line files.
- [ ] **Task 4 — Wire `generateMetadata` to the shared fetcher** (AC2(a))
  - [ ] In both `apps/web/src/app/[locale]/events/[slug]/page.tsx` and `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx`, replace `generateMetadata`'s direct `graphqlClient.request(GetEventBySlugDocument, { slug })` call with `getEventBySlugCached(slug)`. No other change to `generateMetadata` — same fields read (`eventName`/`description`), same try/catch-and-degrade shape (the shared helper's own try/catch already covers the fetch itself; `generateMetadata`'s existing outer try/catch still guards the `getTranslations` call and title/description assembly).
- [ ] **Task 5 — Dehydrate + HydrationBoundary wiring in both page bodies** (AC2(c), AC2(d))
  - [ ] In both page bodies (the default-exported page component), call `const data = await getEventBySlugCached(slug)` (same request as Task 4's call — `cache()` returns the memoized result, no second network call).
  - [ ] `const queryClient = new QueryClient()`; if `data` is non-null, `queryClient.setQueryData(['getEventBySlug', { slug }], data)`.
  - [ ] `const dehydratedState = dehydrate(queryClient)`; render `<HydrationBoundary state={dehydratedState}><Suspense fallback={<RouteLoader />}><EventDetailWrapper slug={slug} isModal={...} /></Suspense></HydrationBoundary>` — `HydrationBoundary`/`dehydrate`/`QueryClient` all imported from `@tanstack/react-query` (already a dependency, `^5.101.4` — confirmed via `apps/web/package.json`).
  - [ ] When `data` is `null` (Task 3's failure path), still render the `HydrationBoundary` wrapper but with an empty dehydrated state (i.e. skip the `setQueryData` call) — the client's own `useGetEventBySlugQuery` then fetches fresh and hits its existing not-found/error UI branches, exactly as it does today.
- [ ] **Task 6 — Gate `useGetMySubscriptionsQuery`'s `enabled` condition** (AC5)
  - [ ] `apps/web/src/features/events/EventDetailWrapper.tsx` lines ~58-64: change `enabled: !!session` to `enabled: !!session && !!data?.eventBySlug?.sourceSocialMediaAccountProfile` (`data` is already in scope from the earlier `useGetEventBySlugQuery` destructure at line ~45).
- [ ] **Task 7 — Backend regression + new query-count test** (AC1, AC6)
  - [ ] Run `apps/backend/src/schema/resolvers.test.ts`'s full existing suite unmodified — confirm zero behavior change to `event`/`eventBySlug`'s existing `sourceSocialMediaAccountProfile`/`isFavorited`/`favoriteCount`/`isHiddenForCurrentUser`/`publishedAt`/`schedules` assertions (e.g. the existing `t.test('eventBySlug - fetch single event by slug with schedules', ...)` at line ~547).
  - [ ] Add a new query-count integration test (same DB-instrumentation mechanism as Story 1.3j's Task 9 — the `postgres` client's `debug` callback or drizzle's `logger` option, `apps/backend/src/db/client.ts`) seeding one event with ≥3 schedules and an authenticated `userId` that has added ≥1 of those schedules to their calendar; assert `eventBySlug` (and `event`) resolve `schedules { id isAddedToCalendar }` at a small constant query count, not one scaled to schedule count. Add a companion assertion that an anonymous call (no `userId`) still returns `isAddedToCalendar: false` for every schedule without needing `calendarAdditions` in scope at all (mirrors `fieldMap.isAddedToCalendar`'s existing `userId ? ... : sql\`false\`` shape).
- [ ] **Task 8 — Frontend regression + new hydration/gating tests** (AC4, AC5, AC7)
  - [ ] Run `apps/web/src/features/events/EventDetailWrapper.test.tsx`'s full existing suite unmodified.
  - [ ] Add assertions (using this file's existing MSW `server.use(...)` override pattern) that the `mySubscriptions` handler is NOT invoked when the mocked event's `sourceSocialMediaAccountProfile` is `null`, and IS invoked when it is present with a session — covering AC5's new gate.
  - [ ] New Playwright E2E test (`apps/web/e2e/event-details.spec.ts` or a new spec file — this suite has no prior network-interception pattern, confirmed via grep before drafting): `page.route('**/api/graphql', ...)` intercepting and counting requests whose POST body matches the `getEventBySlug` operation; `page.goto('/en/events/<seeded-slug>')`, wait for the page to be interactive (e.g. the `<h1>` visible) plus a short settle window, then assert the intercepted count is `0` — proving AC4 (no client-initiated re-fetch after SSR hydration). Run this for both the full-page route and the intercepted modal route (navigate to it via clicking a card, per the existing modal-open test in this file, rather than a cold `page.goto` to the modal path, which the app doesn't support directly).
  - [ ] New test (integration-level, seeding a real logged-in session against the local dev DB — matching this project's existing real-DB "testing trophy" convention, no mocking of the DB/auth layer) proving AC7: a logged-in user who has favorited the event and added one of its schedules to their calendar sees `isFavorited: true`/that schedule's `isAddedToCalendar: true` in the SSR-hydrated initial render (not a forced `false` later corrected by a background refetch).
- [ ] **Task 9 — Manual verification of the `cache()` dedup claim** (AC2(a))
  - [ ] Per this project's standing rule to verify framework-internals behavior empirically rather than trust documentation alone: with the dev server running, add a temporary counter/log line inside the shared fetcher (Task 3) or observe `apps/backend`'s own request logs, load `/events/[slug]` cold, and confirm exactly one backend `eventBySlug` call fires per pageload (not two — one from `generateMetadata`, one from the page body) before removing the temporary instrumentation. Record the result in Dev Agent Record → Debug Log References.
- [ ] **Task 10 — Architecture spine documentation** (housekeeping, matches Story 1.3j Task 10 / 1.3h precedent)
  - [ ] Add a short note under AD-17 in `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` recording that "Story sequence item B" (this story) has shipped, and that BUG-035's fix used the authenticated-`cache()`+`HydrationBoundary` variant (not the anonymous-only alternative), so future stories introducing a similar SSR+client-fetch page have a landed, auth-aware precedent to follow rather than the earlier anonymous-only draft.

## Dev Notes

### Architecture & UX Gate Findings

`_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is `swept: true` for Epic 1, but its `stories_covered` list (1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, 1.7, 1.8) predates this story's entire subject matter (sweep date 2026-07-31; AD-17 decided 2026-09-15; Story 1.6c doesn't appear in that list at all). Per this project's own established precedent (Stories 1.3j, 1.6e, 0.36, 1.3k all did this identically for the same reason), Gates 1/2/3 were run **fresh** via a one-shot multi-persona subagent dispatch (all evidence — AD-17's full text, the current `resolvers.ts`/`EventDetailWrapper.tsx`/both `page.tsx` files/`graphql-client.ts`/`query-provider.tsx` code, DESIGN.md's full content, EXPERIENCE.md's section list, project-context.md excerpts — inlined into the prompt, not re-read from cold context). All three gates returned **no gap**:

- **Gate 1 (Architecture/Infra Completeness, Winston lens): No gap.** Zero new resolvers/queries/mutations. All DB/Drizzle access stays inside `apps/backend`; `apps/web` only gains SSR-caching mechanics (`React.cache()`/`dehydrate()`/`HydrationBoundary`) operating on data already fetched via `graphqlClient` through the backend — not a new direct DB/external-service call from frontend. The `enabled` narrowing on `useGetMySubscriptionsQuery` is a boolean gate on already-fetched state, not new auth logic.
- **Gate 2 (UI Complexity & Reusability, Freya/Sally lens): No gap.** Zero new components, visual states, or UI variants. `EventDetailWrapper.tsx` is structurally unchanged (one hook's `enabled` boolean edited). The `cache()`/`HydrationBoundary` wiring lives in the two `page.tsx` Server Components as page-level data-plumbing, not a reusable widget with loading/empty/error/a11y states. `DESIGN.md` (652 lines, read in full) is entirely card-visual tokens (masonry/calendar-row/calendar-grid-item cards, badges, nav, modals, notifications) — no token or comment anywhere covers event-detail-page data-fetching, SSR/hydration, or query-count/subscription-gating concerns. `EXPERIENCE.md`'s section list (Foundation, IA, Interaction Primitives, User Flows, Component Patterns, State Patterns, Responsive, Accessibility) has no matching entry either.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston lens): No gap.** `React.cache()`/`HydrationBoundary` are new to the codebase, but AD-17 Rule 5 already assigns this exact mechanism to this exact story (BUG-035) — it isn't an undocumented dependency with "no corresponding story." The pattern is scoped narrowly to one route pair (this story's own AC2), and nothing in the evidence indicates other routes currently need it — this is a deliberate, narrow application of an already-decided pattern, not quietly standing up shared infra for other future epics. GraphQL/codegen pipeline, i18n, analytics, and app-shell are all pre-existing and untouched.

No prerequisite story was split off; no `sprint-status.yaml`/`epics.md` addition beyond this story's own registration was required.

The same gate dispatch also flagged four risks outside Gates 1-3's own categories, all folded into this story's Tasks above rather than left as follow-ups: (1) 1.3j-not-yet-shipped / no shared helper extracted yet → Task 1; (2) duplicate hydration wiring across two near-identical page files → Task 3's single shared module; (3) error-path inconsistency between `generateMetadata` and the page body → Task 5's explicit empty-dehydration fallback; (4) the SSR-auth-context gap on `isFavorited`/`isAddedToCalendar` → Design Decision below, and AC2(b)/AC7/Task 3/Task 8's authenticated-fetch requirement and proof test.

### Design Decision: authenticate the SSR dehydration fetch (escalated via AskUserQuestion, user-confirmed)

Direct reading of `apps/web/src/lib/graphql-client.ts` and `apps/web/src/components/providers/auth-session-provider.tsx` found that `graphqlClient`'s `Authorization` header is set **only client-side** (`auth-session-provider.tsx`, a `"use client"` component reacting to Supabase's `onAuthStateChange`) — the module-level singleton has no auth context on the server at all. Neither AD-17 nor the `bmad-correct-course` proposal that produced this story's ACs anticipated this: they describe the fix as unconditionally eliminating "the eventBySlug resolver's entire fan-out running twice per pageview," with no carve-out for logged-in vs. anonymous visitors. Naively dehydrating an unauthenticated SSR fetch's result would seed the client cache with `isFavorited`/`isAddedToCalendar` (event- and schedule-level) forced to `false` for every visitor, including logged-in ones who have actually favorited the event or added a schedule to their calendar — and the app-wide 30s `staleTime` default (`query-provider.tsx`, predates AD-17) would mask the correction for up to 30 seconds after page load. This is a real, user-visible correctness regression that the epics.md AC text does not address, with two genuinely viable resolutions (not a mechanical choice) — escalated via `AskUserQuestion` before drafting Tasks, per this workflow's standing rule for design decisions with a real correctness-vs-complexity tradeoff:

- **Authenticate the SSR fetch too (chosen).** Reads the visitor's session server-side via the existing `createSupabaseServerClient()` helper and forwards the token per-request. Fully satisfies the story's own stated goal for every visitor, at the cost of introducing a new (but low-risk, since it reuses already-shipped infra) combination: a Supabase server-side session read wired into a GraphQL request's per-call auth header.
- **Hydrate anonymous visitors only (rejected).** Lower implementation risk, but leaves the double-fetch/N+1 elimination unrealized for logged-in visitors — the more engaged, returning-visitor segment — a partial fix against the story's own AC.

The user selected the first option. This is why Task 3 explicitly forbids `graphqlClient.setHeader()` in the server path (a shared-singleton mutation would race across concurrent requests from different users in the same Node process — a distinct hazard from the browser, where each tab's client-side singleton serves exactly one user) in favor of `graphql-request`'s per-call `headers` argument on `.request()`, and why AC7/Task 8 add an explicit proof test that the SSR-hydrated data is correct for an authenticated visitor, not just that the mechanism runs.

### Data Type Compatibility & Migration Requirements

- **No column/type mismatch, no schema change.** Every field this story touches (`Event.schedules`, `Schedule.isAddedToCalendar`, `Event.isFavorited`/`favoriteCount`) already exists with correct types in `schema.ts`, `events.graphql`, and generated TypeScript — this story is a resolver-internals/SSR-caching-mechanics change, not a schema change. No `.graphql` file changes, no GraphQL Code Generator re-run, no `packages/shared-types` change.
- **No DB migration** — unlike Story 1.3j (which shipped the prerequisite `favorites(event_id)` partial index), this story's `calendarAdditions` batched-query reuse needs no new index: the existing `isAddedToCalendar` per-schedule lookup already filters on `scheduleId`/`userId`, and batching it into one `IN (schedules.id)`-scoped query changes the query's *shape*, not its predicate columns — confirm at implementation time whether `calendarAdditions` already has a usable `(scheduleId)`-leading index (if not, this is a Task 7 finding to raise, not a silent gap — the same "batching without an index makes it worse, not better" caution AD-17/BUG-034 already established for `favorites`).
- **Backward compatibility:** Purely additive/internal on the resolver side (a query that doesn't request `schedules` is unaffected); purely additive on the frontend side (a route that fails its SSR fetch falls back to today's exact client-fetch behavior, Task 5). No caller-visible response-shape change for either.
- **Verification:** Task 7's new query-count test (schedules/isAddedToCalendar batching); Task 8's new hydration-correctness test (AC7); Task 9's manual `cache()`-dedup verification; full existing regression suites (Task 7/8) passing unmodified.

### State Management Categorization

Not a new state-management surface. `useGetEventBySlugQuery`/`useGetMySubscriptionsQuery` are already-existing **Server State (React Query)** per `project-context.md`'s three-way categorization. `HydrationBoundary`/`dehydrate`/the per-request server-side `QueryClient` this story introduces are SSR-seeding mechanics for that *same* already-categorized layer — not a new category, and not shared/global state (each request gets its own throwaway server-side `QueryClient` instance, distinct from the browser's own persistent `QueryClientProvider` instance in `query-provider.tsx`). No `nuqs`/`zustand` involvement.

### Loader Classification

Not applicable — no new asynchronous UI surface. The existing `<Suspense fallback={<RouteLoader />}>` boundary is retained unchanged; `HydrationBoundary` wraps it as a data-plumbing layer, not a visual one. `EventDetailWrapper.tsx`'s own `isPending`/`error` branches (loading/error `EventDetailView` states) are unaffected — they now simply resolve immediately (cache hit) instead of after a network round trip, for the common case.

### Package boundaries

- Resolver/query-batching logic (Tasks 1-2) stays inside `apps/backend` (and `packages/graphql-select` if Task 1's extraction lands there) — both already backend/Node-only by design. No `packages/domain` change (no new DSL operator).
- The `cache()`/`HydrationBoundary`/Supabase-session-read logic (Tasks 3-5) stays inside `apps/web` — consistent with `project-context.md`'s package dependency rule that state management (react-query) is isolated strictly within `apps/web`. No `packages/ui` change (no UI ships from this story — `RouteLoader` is reused as-is, unchanged).
- The `enabled`-gate change (Task 6) stays inside `apps/web`'s existing `EventDetailWrapper.tsx`.

### Architecture / technical constraints

- **AD-17 (binding, full text reproduced in the sibling Story 1.3j's own Dev Notes and this project's architecture spine):** this story IS AD-17's "Story sequence item B" — Rule 3 (schedule-level `isAddedToCalendar` batching, reusing Rule 2's mechanism verbatim) governs Tasks 1-2; BUG-035's fix shape (left undecided by AD-17 itself) is resolved by this story's own Design Decision above.
- **project-context.md's `Query.eventBySlug` rule** ("the second-highest-traffic endpoint... New fields should default to the same optimized flat select as `Query.events`, not a new per-field resolver... See Architecture Spine AD-16/AD-17"): this story is exactly that AD-17 work landing for this endpoint.
- **project-context.md's Force-Logout-on-Auth-Failure rule** (`graphqlClient`'s `responseMiddleware`, `apps/web/src/lib/graphql-client.ts`): guarded to client-only (`isServer` check) already — confirm the new server-side authenticated fetch (Task 3) does not trip this client-only logout path if the forwarded token is expired/invalid; a failed authenticated SSR fetch should fall back gracefully (Task 3's try/catch → unauthenticated retry, or Task 5's empty-dehydration fallback), never attempt a server-side `signOut()`.
- **AD-1/AD-2 (Unified Query DSL):** unaffected — `event(id)`/`eventBySlug(slug)` remain non-DSL single-item lookups (Story 1.6's own AC, unchanged by this story).
- **AD-8 (Soft-Delete Convention):** unaffected — no new soft-deletable table or query condition.
- **AD-5 (Analytics)/AD-6 (i18n):** not applicable — no new user-facing text or tracked interaction ships from this story.

### Previous/Sibling Story Intelligence (Stories 1.3j, 1.6, 1.6a, 1.6b, 1.3a)

- **Story 1.3j (`ready-for-dev` at drafting time, NOT yet implemented)** — this story's direct prerequisite (AD-17 Rule 5 sequences 1.6c after it). Its own Dev Notes/Tasks fully specify the batched-schedules-query mechanism (`virtualFields`, `getRequestedFieldNames`, the `IN (...)` query, the `Event.schedules`/`isFavorited`/`favoriteCount`/`isAddedToCalendar` passthrough shape) that this story reuses — read in full before drafting this story. Its own Task 3 plan writes the batched query **inline** inside the `events` resolver, not as an exported helper — this story's Task 1 must check whether the actual implementation changed that, and extract a shared helper itself if not. Its own "Design Decision" Dev Note confirms `buildOptimizedDrizzleSelect`'s `path` option is `string | string[]`, and that a bare string (`path: 'schedules'`) is the correct, unmodified shape for `event`/`eventBySlug` (unlike `events`' own two-level `['items', 'schedules']` need) — directly reused in this story's Task 2.
- **Story 1.6 (`review`)** — the event-detail page and `event`/`eventBySlug` resolvers this story amends. Confirmed via direct read of the current 47-line `page.tsx`/modal `page.tsx` and the 716-line `EventDetailWrapper.tsx` that both are exactly as this story's Dev Notes describe (no drift beyond the stale `EventDetailWrapper.tsx` line-number citation in the originating epics.md text, corrected in AC3 above).
- **Story 1.6a (`done`)** — built `EventDetailView`, the presentational component `EventDetailWrapper.tsx` maps into. Not touched by this story (zero UI/prop-shape change here).
- **Story 1.6b (`done`)** — built the list-navigation hook (`useListNavigationForEvent`) `EventDetailWrapper.tsx` also uses. Not touched by this story (its own prefetch effect, AC3, is explicitly unaffected).
- **Story 1.3a (`done`)** — the original `event`/`eventBySlug` resolver implementation this story and Story 1.3j both amend. Confirmed via direct read that today's resolvers do NOT yet batch `schedules`/`isAddedToCalendar` at all (they call `buildOptimizedDrizzleSelect(events, info)` with no options, splicing a few known scalar columns manually) — this story's Task 2 is the first time these two resolvers gain any computed-field batching.

### Git Intelligence Summary

Most recent commits (per `git log --oneline -5` at drafting time) are unrelated moderator-tools/board-hygiene work — no commit touches `apps/backend/src/schema/resolvers.ts`'s `event`/`eventBySlug` resolvers, `apps/web/src/app/[locale]/events/[slug]/page.tsx`, the intercepted modal `page.tsx`, or `EventDetailWrapper.tsx`'s subscriptions-query gating, confirming this story's scope has not started implementation. `apps/web/src/components/providers/query-provider.tsx`'s global `staleTime: 30_000` default was added 2026-08-26 (commit `4577890`), predating AD-17 (2026-09-15) by ~3 weeks — confirmed via `git log -p` — meaning `useGetEventBySlugQuery` already inherits this default with zero per-hook change needed for the hydration mechanism to actually avoid a background refetch on mount, which is why this story adds no `staleTime` change of its own (unlike Story 1.3j's Task 7, which is a different, unrelated set of hooks).

**Registration note:** Story 1.6c and its `epics.md` section were added 2026-09-15 via `bmad-correct-course` (CC-020, `sprint-change-proposal-2026-09-15-getevents-eventbyslug-perf-hardening.md`), which explicitly deferred `sprint-status.yaml` registration to "Phase 3, a separate later session" (this one). Story 1.3j (this same proposal's first half) was already registered/promoted on 2026-09-19; this session completes the proposal's second half.

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → API & Data, Database & Performance [`Query.eventBySlug` second-highest-traffic-endpoint rule, AD-16/AD-17 pointer], Security → Force Logout on Auth Failure; Code Quality & Style Rules → Code Organization; State Management Architecture)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-17 — binding mechanism, Rule 3 + Rule 5 "Story sequence item B"; AD-1/AD-2 — confirmed unaffected)
- `_bmad-output/planning-artifacts/epics.md` (Story 1.6c, Story 1.3j, Story 1.6, Story 1.6a, Story 1.6b, Story 1.3a)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` (stale for this story's subject matter — see Dev Notes → Architecture & UX Gate Findings)
- `docs/infrastructure/2-backend.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/backend/src/schema/resolvers.ts` (`event`/`eventBySlug` resolvers gain the batched-schedules call + `isAddedToCalendar` virtual field, Tasks 1-2; possibly `packages/graphql-select` if the shared batching helper lands there instead).
- **Modified:** `apps/backend/src/schema/resolvers.test.ts` (new query-count integration test, Task 7).
- **New:** `apps/web/src/features/events/get-event-by-slug-cached.ts` (shared `cache()`-wrapped authenticated fetcher, Task 3).
- **Modified:** `apps/web/src/app/[locale]/events/[slug]/page.tsx` and `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` (both switch `generateMetadata` to the shared fetcher, Task 4; both page bodies gain `dehydrate`/`HydrationBoundary` wiring, Task 5).
- **Modified:** `apps/web/src/features/events/EventDetailWrapper.tsx` (`useGetMySubscriptionsQuery`'s `enabled` condition narrowed, Task 6 — lines ~58-64 only; no other change to this 716-line file).
- **Modified:** `apps/web/src/features/events/EventDetailWrapper.test.tsx` (new subscriptions-gating assertions, Task 8).
- **New:** a Playwright E2E test (new spec file, or appended to `apps/web/e2e/event-details.spec.ts`) asserting zero post-hydration client `getEventBySlug` requests (Task 8).
- **New:** an integration test proving SSR-hydrated data correctness for an authenticated visitor (Task 8, AC7).
- **Modified:** `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-17 "Story sequence item B shipped" note, Task 10).
- **Not modified:** `apps/backend/src/schema/events.graphql` (no schema change); any generated codegen output (no `.graphql` change, no re-run needed); `packages/domain` (no DSL operator added); `packages/ui` (no UI in this story); `packages/database` (no migration — see Dev Notes → Data Type Compatibility).

### Rule Mapping

- *AD-17 Rule 3/Rule 5* → Tasks 1-2 implement the batching reuse exactly as decided; Task 3-5 implement BUG-035's fix shape per this story's own resolved Design Decision.
- *This story's own Design Decision (authenticate the SSR fetch)* → Task 3's `createSupabaseServerClient()` + per-call-header wiring; AC7/Task 8's proof test that this actually holds.
- *project-context.md's Force-Logout-on-Auth-Failure rule* → Task 3's failure-fallback (unauthenticated retry) explicitly does NOT trigger the client-only `signOut()` path, per Dev Notes → Architecture/technical constraints.
- *State Management Architecture* → Tasks 3-5's server-side `QueryClient`/`dehydrate` stays within the already-correct Server State (React Query) categorization; no re-categorization needed (Dev Notes → State Management Categorization).
- *Testing Rules (testing-trophy)* → Task 7 follows `apps/backend`'s existing real-local-DB integration-test convention; Task 8 follows `apps/web`'s existing MSW-integration convention plus a new Playwright E2E addition, both against this project's established patterns.
- *Story-split-gate Gate 1/2/3* → all three run fresh (lightweight-guard triggered by the stale sweep date), all returned no gap — see Dev Notes → Architecture & UX Gate Findings.

### Verification Plan

- `apps/backend`: `tsx --test` on `resolvers.test.ts` — full existing suite passes unmodified (AC6); new query-count integration test (Task 7) proves AC1's batching claim for both authenticated and anonymous callers.
- `apps/web`: `vitest` on `EventDetailWrapper.test.tsx` — full existing suite passes unmodified; new MSW-based assertions prove AC5's gating (Task 8).
- `apps/web` E2E: new Playwright test proves AC4 (zero post-hydration client re-fetch) for both the full-page and modal routes; a new integration test proves AC7 (authenticated SSR-hydrated data is correct, not forced-false).
- Manual: Task 9's temporary-instrumentation check empirically verifies the `React.cache()` dedup claim (AC2(a)) against the running dev server, per this project's standing rule to verify framework-internals behavior rather than trust documentation alone; confirm `pnpm build`/`pnpm lint` clean at the repo root for every touched package, with no codegen re-run needed (confirmed, not assumed — no `.graphql` file changes).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: `apps/backend` (resolver batching reuse), `apps/web` (SSR-hydration wiring, subscriptions-gate), no `packages/domain`/`packages/ui`/`packages/database` changes, no new API surface.
- [ ] **Blocking dependency — NOT YET MET:** Story 1.3j is `ready-for-dev`, not `done`, as of this story's drafting. `bmad-dev-story` MUST re-check `sprint-status.yaml`'s `1-3j-...` entry before starting Task 2, and MUST perform Task 1's shared-helper-extraction check/refactor if 1.3j's shipped implementation left the batched-schedules query inline. Do not begin implementation until this is confirmed done or explicitly accepted as a known, already-decided sequencing risk (AD-17 Rule 5 itself sequences this story after 1.3j — this is not a newly-discovered gap, matching this project's existing precedent for documented-but-unescalated blocked-task sequencing, e.g. Story 1.5's Tasks 7-9 blocked on Story 0.28).
- [ ] **Gate 1/2/3 accepted:** all three gates run fresh (epic-1-readiness.md predates this story's subject matter) via one-shot multi-persona subagent dispatch — all returned "no gap." Accepted, not escalated (see Dev Notes → Architecture & UX Gate Findings).
- [ ] **Design decision accepted (real tradeoff, escalated and user-confirmed):** the SSR dehydration fetch is authenticated (reads the visitor's session server-side, forwards the token per-request) rather than anonymous-only — see Dev Notes → Design Decision. User confirmed this option via `AskUserQuestion` during drafting.
- [ ] **Data-type-compatibility finding accepted:** no schema/column/type change; confirm at implementation time whether `calendarAdditions` needs a `(scheduleId)`-leading index for the new batched query to avoid a sequential scan (per Dev Notes → Data Type Compatibility) — if missing, raise as a Task 7 finding rather than silently shipping a regression.
- [ ] Architecture and data/API boundaries confirmed: batching logic in `apps/backend`/(`packages/graphql-select` if extracted there); SSR-caching mechanics in `apps/web` only; no `.graphql` schema change, no codegen re-run.
- [ ] Testing plan confirmed: backend query-count test (real local Postgres, no DB mocking); frontend MSW-integration + new Playwright E2E + authenticated-hydration-correctness test.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `apps/backend`: `tsx --test` integration tests (Task 7) — full regression of every existing `event`/`eventBySlug` test unmodified, plus a new query-count-instrumented test proving constant-not-schedule-count-sized query cost for the batched `schedules`/`isAddedToCalendar` fetch, for both authenticated and anonymous callers.
- `apps/web`: `vitest` + MSW integration tests (Task 8) on `EventDetailWrapper.test.tsx` — full existing regression unmodified, plus new assertions for the `useGetMySubscriptionsQuery` `enabled` gate.
- `apps/web` E2E (Playwright, Task 8): a new test asserting zero client-initiated `/api/graphql` `getEventBySlug` requests after initial page load + hydration settles, for both the full-page and intercepted modal routes; a new integration test proving an authenticated visitor's SSR-hydrated `isFavorited`/`isAddedToCalendar` values are correct (AC7), not forced-false.
- Manual (Task 9): empirical verification of the `React.cache()` cross-function dedup claim against the running dev server (temporary instrumentation, removed before merge).

## Deliverables Checklist

- [ ] Story 1.3j confirmed `done`; shared batched-schedules helper exists (extracted in this story if 1.3j left it inline).
- [ ] `event`/`eventBySlug` resolvers batch `schedules` (with `isAddedToCalendar` virtual field) via the shared code path, gated on `userId`.
- [ ] Shared `getEventBySlugCached` module built: `React.cache()`-deduped, session-authenticated via `createSupabaseServerClient()`, per-call `Authorization` header (never `.setHeader()`), graceful anonymous/error fallback.
- [ ] Both `page.tsx` files' `generateMetadata` switched to the shared fetcher; both page bodies wrap `EventDetailWrapper` in `HydrationBoundary`/`dehydrate`, with a graceful empty-dehydration fallback on fetch failure.
- [ ] `useGetMySubscriptionsQuery`'s `enabled` condition narrowed to require `sourceSocialMediaAccountProfile`.
- [ ] Full existing backend + frontend regression suites pass unmodified.
- [ ] New backend query-count test passes (batching proof, both auth states).
- [ ] New Playwright test passes (zero post-hydration client re-fetch, both routes).
- [ ] New authenticated-hydration-correctness test passes (AC7).
- [ ] `React.cache()` dedup empirically verified against the running dev server (Task 9), temporary instrumentation removed.
- [ ] AD-17 documentation note added recording this story as shipped, including which BUG-035 fix variant was used.
- [ ] `pnpm build`/`pnpm lint` clean for every touched package.

## Out of Scope

- Story 1.3j's own scope (`Query.events` computed-field batching, `totalCount` gating, `favorites(event_id)` index, list-hook `staleTime`) — a separate, prerequisite story, not re-implemented here.
- Splitting the GraphQL document into a "public" vs. "private" sub-query so only public fields get SSR-dehydrated — considered as a theoretical alternative to this story's authenticated-fetch design decision, but rejected as a much larger schema/codegen/resolver-structure change than this lettered perf-hardening story warrants; not requested by AD-17 or the originating proposal.
- Extending the `React.cache()`+`HydrationBoundary` SSR-hydration pattern to any other route beyond `/events/[slug]` and its intercepted modal variant — Gate 3 explicitly confirmed this story's scope is narrow-by-design; a future route needing the identical pattern gets its own story citing this one as precedent (Task 10's documentation note is exactly for that handoff).
- Fixing the pre-existing `apps/backend` `tsx --test` process-doesn't-exit-cleanly issue (Story 1.3h/1.3j Dev Notes) — pre-existing, unrelated, out of scope.

## Definition of Done

- [ ] AC1-AC7 satisfied.
- [ ] Required tests passing: backend query-count test, frontend MSW-integration + Playwright E2E + authenticated-hydration-correctness tests, all existing regression suites unmodified.
- [ ] Lint and type checks passing for `apps/backend`, `apps/web`, `packages/graphql-select` (touched files only).
- [ ] `React.cache()` dedup manually verified against the running dev server; AD-17 documentation updated.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`, invoked directly with epic/story number `1.6c` (no `sprint-status.yaml` entry existed yet at invocation time, confirmed via `sprint-status-tool.py get 1-6c`, "key not found" — CC-020's own backlog note explicitly deferred this story's registration to "a separate later session," which this run completes; Story 1.3j, the same proposal's first half, was already registered/promoted on 2026-09-19).
- `epic-1-readiness.md` is `swept: true` but its `stories_covered` list predates this story's AD-17 subject matter entirely (sweep date 2026-07-31; AD-17 decided 2026-09-15) — the lightweight-guard instruction was applied and all three gates (1/2/3) were run fresh via a one-shot multi-persona subagent dispatch (evidence inlined, not re-read from cold context), matching the precedent already set by Stories 1.3j/1.6e/0.36/1.3k for the identical "sweep predates this story" situation. All three returned "no gap" — see Dev Notes → Architecture & UX Gate Findings; the same dispatch also surfaced four non-Gate risks (1.3j-not-shipped, duplicate-wiring-across-two-files, error-path inconsistency, SSR-auth-context gap), all folded into this story's Tasks.
- One genuine design tradeoff (not mechanical) was found while reading the current code, beyond what the originating epics.md/`bmad-correct-course` proposal text anticipated: the server-side fetch this story adds for `HydrationBoundary`/`dehydrate` has no user-session context today (the `graphqlClient` singleton's `Authorization` header is set client-side only, confirmed via direct read of `graphql-client.ts`/`auth-session-provider.tsx`), so a naive implementation would seed the client cache with `isFavorited`/`isAddedToCalendar` forced `false` for logged-in visitors too, masked for up to 30s by the existing global `staleTime` default. Escalated via `AskUserQuestion` before drafting Tasks (the first attempt returned "did not answer" — re-asked once, per this project's standing precedent of not silently proceeding on an apparently-failed relay; the re-ask was answered). User chose to authenticate the SSR fetch (reads the session server-side via the existing `createSupabaseServerClient()` helper, forwards the token per-request — never via the shared singleton's `.setHeader()`, which would race across concurrent requests) over the lower-risk anonymous-only-hydration alternative. See Dev Notes → Design Decision for the full reasoning and rejected alternative.
- Verified via direct `git log -p` that `apps/web/src/components/providers/query-provider.tsx`'s global `staleTime: 30_000` default (commit `4577890`, 2026-08-26) predates AD-17 by ~3 weeks and already covers `useGetEventBySlugQuery` — no per-hook `staleTime` change is needed in this story (unlike Story 1.3j's own, unrelated Task 7).
- Verified via direct code read (not trusted from the stale epics.md citation) that `EventDetailWrapper.tsx`'s next/prev prefetch effect (epics.md cites "lines 317-326") is now at current lines ~354-363 — file has grown since AD-17 was written; corrected in AC3.

### Completion Notes List

_To be filled by `bmad-dev-story` upon implementation._

### File List

_To be filled by `bmad-dev-story` upon implementation._
