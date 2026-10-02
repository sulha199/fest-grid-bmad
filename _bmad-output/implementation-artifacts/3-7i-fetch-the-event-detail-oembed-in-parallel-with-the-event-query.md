---
baseline_commit: a363ffa2
---

# Story 3.7i: Fetch the event-detail oEmbed in parallel with the event query

## Story Details

- Epic: 3
- Story ID: 3.7i
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber,
I want the event details to render without waiting on Instagram,
so that the page is fast even when the embed is slow.

## Acceptance Criteria

1. **Given** Architecture Spine AD-16 Rule 7, **when** `EventDetailWrapper.tsx` mounts, **then**: (a) `instagramEmbed { status html durableImageUrl }` is removed from the `getEventBySlug` query in `apps/web/src/features/events/queries.graphql`; (b) a second, independent React Query hook — `useGetInstagramEmbedBySlugQuery`, generated from a new `GetInstagramEmbedBySlug($slug: String!)` document calling Story 3.7h's `Query.instagramEmbedBySlug(slug)` — fires unconditionally alongside the existing `useGetEventBySlugQuery`, both starting on mount in parallel with no explicit `Promise.all`/sequencing (React Query dispatches independent hooks' requests in parallel automatically); (c) primary event-detail content (title, schedules, description, tags, attributions, etc.) renders off `useGetEventBySlugQuery`'s own `isPending`/`data`/`error` state alone, exactly as today — never gated on either embed hook's resolution.
2. **And** `InstagramEmbed.tsx` (`packages/ui`) keeps its own loading state machine (Story 3.7d's script-load/`MutationObserver`-driven `useState`/`useEffect` logic) **completely unchanged** — it is still driven purely by its `status`/`html`/`durableImageUrl` props, which now originate from the hooks below instead of the old embedded `getEventBySlug` field. Both the full-page route (`apps/web/src/app/[locale]/events/[slug]/page.tsx`) and the intercepted modal route (`apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx`) render the same `EventDetailWrapper.tsx`, so both pick up the new hooks automatically with zero route-file change. The modal route gains no `loading.tsx` — none exists today (confirmed) and this story does not add one, consistent with `project-context.md`'s "No `loading.tsx` on a route only ever reached via in-app navigation" rule (the modal route is only ever reached via an in-app transition, never a cold/direct-URL open).
3. **And** legacy-hex-slug events — every event in production today, since Stories 3.7f/3.7g only affect newly-ingested events and no backfill was done (Story 3.7h's own Dev Notes) — fall back to the existing embed behavior: when `useGetInstagramEmbedBySlugQuery`'s resolved data has `status: 'NOT_RESOLVABLE_FROM_SLUG'`, a third, conditionally-`enabled` hook — `useGetInstagramEmbedForEventQuery`, a new `GetInstagramEmbedForEvent($eventId: ID!)` document reusing the already-shipped `Query.event(id).instagramEmbed` field (Story 3.7e's resolver; **zero backend change** — `Query.event` already exists and already resolves `instagramEmbed` identically to `Query.eventBySlug`, both via `buildOptimizedDrizzleSelect(events, info)`) — fires once `eventId` is known, reproducing today's real Instagram-embed result for that event without ever gating primary content on it or on the first embed hook's own resolution.
4. **And** (regression guard, derived from Story 3.7d AC2's "byte-for-byte unchanged" framing one layer down the stack) an event whose merged embed result is unresolved (both embed hooks still pending, or the first hook errored, or the first hook resolved `AVAILABLE`/`UNAVAILABLE`-less `null`) renders the existing `EventImage` hotlink/video/fallback path exactly as it does today — `mapGraphQLEventToDetailViewProps`'s new embed parameter must never crash or synthesize a guessed status when its inputs are absent.

## Tasks / Subtasks

- [ ] Task 1 — GraphQL query documents, `apps/web` (AC: 1, 3)
  - [ ] In `apps/web/src/features/events/queries.graphql`, remove the `instagramEmbed { status html durableImageUrl }` block (lines 58-62) from the `getEventBySlug` query.
  - [ ] Add a new query document, placed near `getEventBySlug` for discoverability:
    ```graphql
    query getInstagramEmbedBySlug($slug: String!) {
      instagramEmbedBySlug(slug: $slug) {
        status
        html
        durableImageUrl
      }
    }
    ```
  - [ ] Add a second new query document — the legacy-slug fallback, reusing the already-existing `Query.event(id)` field (the same field `getEventForIcsExport` already queries) and its already-shipped `instagramEmbed` resolver (Story 3.7e) — **no `apps/backend` change of any kind**:
    ```graphql
    query getInstagramEmbedForEvent($eventId: ID!) {
      event(id: $eventId) {
        instagramEmbed {
          status
          html
          durableImageUrl
        }
      }
    }
    ```
  - [ ] Run `pnpm --filter web codegen` to regenerate `apps/web/src/generated/graphql.ts`: confirms (a) `GetEventBySlugQuery['eventBySlug']`'s generated type loses the `instagramEmbed` field, (b) two new hooks are generated — `useGetInstagramEmbedBySlugQuery` (query key `['getInstagramEmbedBySlug', variables]`) and `useGetInstagramEmbedForEventQuery` (query key `['getInstagramEmbedForEvent', variables]`) — following the exact same `graphql-request`/React Query codegen shape as every other hook in that file (e.g. `useGetEventBySlugQuery`, `useGetEventForIcsExportQuery`).

- [ ] Task 2 — Wire the two new hooks + merge logic into `EventDetailWrapper.tsx` (AC: 1, 2, 3, 4)
  - [ ] Immediately after the existing `useGetEventBySlugQuery` call (current lines 45-48), add the unconditional second hook:
    ```ts
    const { data: embedBySlugData } = useGetInstagramEmbedBySlugQuery(
      graphqlClient,
      { slug }
    )
    ```
    No `enabled` gate — it fires on mount in parallel with the primary query, exactly as AD-16 Rule 7 specifies. This is safe/cheap even for the overwhelmingly-common legacy-slug case: Story 3.7h's `NOT_RESOLVABLE_FROM_SLUG` branch does no DB lookup and no Meta call (pure string parsing), so firing it unconditionally does not reintroduce the cost this story chain exists to remove.
  - [ ] Add the third, conditionally-enabled fallback hook, gated off the second hook's own resolved status and the eventId now known from the primary query's data — the exact same `enabled`-on-already-fetched-data idiom this same file already uses for `useGetMySubscriptionsQuery` (current lines 58-67):
    ```ts
    const { data: embedForEventData } = useGetInstagramEmbedForEventQuery(
      graphqlClient,
      { eventId: data?.eventBySlug?.id || "" },
      {
        // Story 3.7i (AC3) -- legacy-hex-slug fallback. Fires only once we know both the
        // event's id (from the primary query) and that the slug-based lookup (Story 3.7h)
        // could not resolve it -- never fired for a platform-prefixed slug, where the
        // AVAILABLE/UNAVAILABLE result from embedBySlugData is already authoritative.
        enabled: !!data?.eventBySlug?.id && embedBySlugData?.instagramEmbedBySlug?.status === 'NOT_RESOLVABLE_FROM_SLUG',
      }
    )
    ```
  - [ ] Add a small merge computation (inline in `EventDetailWrapper.tsx`, per this story's Gate 2 finding below — no dedicated hook file, single call site, modest logic) producing the one resolved embed result `mapGraphQLEventToDetailViewProps` needs:
    ```ts
    const embedBySlugStatus = embedBySlugData?.instagramEmbedBySlug?.status
    const resolvedInstagramEmbed: ResolvedInstagramEmbed | null =
      embedBySlugStatus === 'AVAILABLE' || embedBySlugStatus === 'UNAVAILABLE'
        ? {
            status: embedBySlugStatus,
            html: embedBySlugData!.instagramEmbedBySlug.html,
            durableImageUrl: embedBySlugData!.instagramEmbedBySlug.durableImageUrl,
          }
        : embedBySlugStatus === 'NOT_RESOLVABLE_FROM_SLUG' && embedForEventData?.event?.instagramEmbed
          ? {
              status: embedForEventData.event.instagramEmbed.status,
              html: embedForEventData.event.instagramEmbed.html,
              durableImageUrl: embedForEventData.event.instagramEmbed.durableImageUrl,
            }
          : null
    ```
    (`ResolvedInstagramEmbed` is the new exported type from Task 3 below.) A network error on either embed hook, or both hooks still pending, leaves `resolvedInstagramEmbed` as `null` — AC4's safe default, never a crash or a guessed value.
  - [ ] Pass `resolvedInstagramEmbed` into the existing `mapGraphQLEventToDetailViewProps(...)` call (current line 534) as its new trailing argument.

- [ ] Task 3 — Update `mapper.ts`'s signature (AC: 1, 2, 3, 4)
  - [ ] Export a new type from `apps/web/src/features/events/mapper.ts`:
    ```ts
    export interface ResolvedInstagramEmbed {
      status: 'AVAILABLE' | 'UNAVAILABLE'
      html: string | null
      durableImageUrl: string | null
    }
    ```
  - [ ] Change `mapGraphQLEventToDetailViewProps`'s signature by **appending** a new optional 6th parameter — deliberately appended at the end, not inserted among the existing 5 positional parameters, so every existing call site in `mapper.test.ts` that does not pass it keeps compiling unchanged and keeps its current "no embed" expectation:
    ```ts
    export function mapGraphQLEventToDetailViewProps(
      event: NonNullable<GetEventBySlugQuery['eventBySlug']>,
      labels: EventDetailViewLabels,
      locale: string,
      tType: (key: string) => string,
      tCategory: (key: string) => string,
      instagramEmbed?: ResolvedInstagramEmbed | null
    ): Omit<EventDetailViewProps, 'labels'> & { labels: EventDetailViewLabels }
    ```
  - [ ] Change the three existing mapped lines (current lines 108-110) from reading `event.instagramEmbed?.status/html/durableImageUrl` (a field that no longer exists on `event`'s type once Task 1 ships) to reading the new `instagramEmbed` parameter instead:
    ```ts
    instagramEmbedStatus: instagramEmbed?.status ?? null,
    instagramEmbedHtml: instagramEmbed?.html ?? null,
    instagramEmbedDurableImageUrl: instagramEmbed?.durableImageUrl ?? null,
    ```

- [ ] Task 4 — Test updates, `apps/web` (AC: 1, 2, 3, 4)
  - [ ] `mapper.test.ts`: remove the now-nonexistent `instagramEmbed: null` line from `buildEvent()`'s fixture (line 69) — it would otherwise be an excess/unknown property once `GetEventBySlugQuery['eventBySlug']` loses that field (Task 1). Add a new `describe('mapGraphQLEventToDetailViewProps instagramEmbed parameter (Story 3.7i)', ...)` block: (a) omitting the new 6th argument (every pre-existing call site) maps all three `instagramEmbed*` output fields to `null` — explicit regression proof for AC4; (b) passing `{ status: 'AVAILABLE', html: '<blockquote>...</blockquote>', durableImageUrl: null }` maps through to the three output fields unchanged; (c) passing `{ status: 'UNAVAILABLE', html: null, durableImageUrl: 'https://...' }` maps through unchanged.
  - [ ] `EventDetailWrapper.test.tsx`: remove `instagramEmbed` from `currentMockEvent`'s type annotation (line 114) and both literal object assignments (lines 136-ish seed, 326). Add two new MSW handlers alongside the existing `getEventBySlug` handler (around line 133), backed by new controllable mock state (`currentMockEmbedBySlugResult`, `currentMockEmbedForEventResult`, reset in `beforeEach` to safe "pending/not resolvable" defaults):
    ```ts
    api.query("getInstagramEmbedBySlug", () => HttpResponse.json({ data: { instagramEmbedBySlug: currentMockEmbedBySlugResult } })),
    api.query("getInstagramEmbedForEvent", () => HttpResponse.json({ data: { event: { instagramEmbed: currentMockEmbedForEventResult } } })),
    ```
  - [ ] Rewrite the two existing instagramEmbed-specific tests (current lines 421-449) to drive the new two/three-hook flow instead of the retired embedded field:
    - "renders the InstagramEmbed path when the slug-based query resolves AVAILABLE" — set `currentMockEmbedBySlugResult = { status: 'AVAILABLE', html: "<blockquote class='instagram-media'>post</blockquote>", durableImageUrl: null }`; render; assert the embed region appears; **and** assert the `getInstagramEmbedForEvent` handler is never hit (e.g. a `vi.fn()` spy wired into that handler, asserted with zero calls) — proving the legacy-fallback hook stays disabled on the happy path, mirroring Story 3.7h's own "AVAILABLE never joins" proof one layer up the stack.
    - "renders the unchanged EventImage path when the slug-based query resolves UNAVAILABLE with no fallback" — set `currentMockEmbedBySlugResult = { status: 'UNAVAILABLE', html: null, durableImageUrl: null }`, `imageUrl` on `currentMockEvent` to a real URL; render; assert no embed region, the plain `<img>` renders.
  - [ ] Add a new third test, the direct proof of this story's AC3/AC1 combination — the legacy-slug fallback path, and that primary content never waits on it: set `currentMockEmbedBySlugResult = { status: 'NOT_RESOLVABLE_FROM_SLUG', html: null, durableImageUrl: null }` and `currentMockEmbedForEventResult = { status: 'AVAILABLE', html: "<blockquote>fallback embed</blockquote>", durableImageUrl: null }`, with the `getInstagramEmbedForEvent` MSW handler given an artificial delay (e.g. `await delay(50)` before responding, `msw`'s own `delay` helper). Assert the `Test Event` heading (primary content) is visible **before** the delayed fallback response resolves (proves AC1 — primary content never gates on the fallback round trip), then assert the embed region eventually appears once it does resolve (proves AC3).
  - [ ] Run `pnpm --filter web test`, `pnpm --filter web lint`.

- [ ] Task 5 — Confirm scope boundary (no `apps/backend`, no `packages/ui`, no `packages/domain` change)
  - [ ] Confirm zero files under `apps/backend/`, `packages/ui/`, or `packages/domain/` are touched by this story — `Query.instagramEmbedBySlug` (3.7h) and `Query.event(id).instagramEmbed` (3.7e) are both already-shipped, unchanged backend fields; `InstagramEmbed.tsx`/`EventDetailView.tsx` (`packages/ui`) need no prop-shape change, since `instagramEmbedStatus`/`Html`/`DurableImageUrl` keep their exact existing shape — only their `apps/web`-side data source changes.
  - [ ] Run `pnpm --filter web build` to confirm the codegen + mapper-signature changes type-check end-to-end; root `pnpm lint`/`pnpm test` for no cross-package regression (consistent with this story touching only `apps/web`).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infra Completeness) & Gate 3 (Foundational/Cross-Cutting Dependency):** Not re-run per-story. Cited from `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (batch-scoped sweep over this epic's CC-024 stories, `swept: true`, 2026-10-01), whose per-story verdict table lists **3.7i: READY — "Depends on 1.6c (`review`) — standing rule allows."** Its Gate 1 section explicitly confirms "3.7h/3.7i's DB-free oEmbed resolution stays backend-owned per AD-16 Rule 6 — `apps/web` never calls Meta directly." Lightweight escape-hatch check performed during this story's drafting: this story's actual implementation (two new GraphQL query *documents* against two already-shipped resolver fields, two new generated React Query hooks, a merge computation, and an additive mapper-signature change) introduces no new external service, no new data entity, and no new infra dependency the batch sweep didn't anticipate — it is pure frontend wiring against backend surface Stories 3.7e/3.7h already shipped. No fresh Gate 1/3 run was triggered.
- **Gate 2 (UI Complexity & Reusability):** Run fresh for this story (required per-story even when Gate 1/3 are sourced from the batch report — this is the first story in the Wave 2A chain with real UI-layer scope: `EventDetailWrapper.tsx` and, indirectly, `InstagramEmbed.tsx`'s data source). A one-shot Freya/Sally-lens analytical pass was run against this story's exact proposed implementation (the two-hook-plus-fallback-hook design in Tasks 1-3 above), with `DESIGN.md` (loaded in full — confirmed zero Instagram-embed-specific tokens exist anywhere in it, the same gap Story 3.7d already found and resolved as an escape-hatch, not a defect) and the `EXPERIENCE.md` "Multi-Event Posts and Cross-Post Event Matching (CC-024)" section (lines 373-392) inlined into the prompt. **Verdict: No gap — squarely in-scope for this one story, no split.**
  - **(a) No new UI.** This story touches zero files under `packages/ui/`. `EventDetailView.tsx`'s existing `instagramEmbedStatus ? <InstagramEmbed/> : <EventImage/>` branch already renders the plain image for "no embed data yet," and will do so identically whether "yet" means "query still in flight" or "resolved to `null`/`NOT_RESOLVABLE_FROM_SLUG` with the fallback still pending" — no new visual state, no new component, no new variant.
  - **(b) No UX-spec gap.** `EXPERIENCE.md`'s CC-024 section explicitly pre-endorses this exact mechanism for a sibling feature: "the two-step [...] read never gates primary detail content, mirroring AD-16 Rule 7's oEmbed-never-gates-content precedent" (line 379) — the spec already names this story's own mechanism as the reference pattern elsewhere in the same document. Nothing is undecided or unspecified; AD-16 Rule 7 is binding and this story implements it.
  - **(c) Hook-extraction judgment call — resolved as: implement inline, not extracted.** The two hooks + merge logic have exactly one call site (`EventDetailWrapper.tsx`; both routes share the same component, not independent consumers), and the logic is modest (two hooks, one gated off the other's resolved status, a small status-precedence merge) — no more complex than the `useGetMySubscriptionsQuery` block already living inline a few lines above it in the same file, and following that exact same `enabled`-on-already-fetched-data idiom. `EventDetailWrapper.tsx`'s overall size (735 lines) is a real but separate file-level health concern, not a reason to extract this one slice in isolation — doing so piecemeal would leave an inconsistent mix of inline-vs-extracted hook logic with no clear boundary rule. Task 2 implements inline.
  - **(d) No split trigger.** Gate 2's actual split trigger is complex/reusable UI logic needing isolation; this story has no new rendered UI and no multi-consumer reuse case.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. This story adds two new GraphQL query *documents* (`getInstagramEmbedBySlug`, `getInstagramEmbedForEvent`) against two already-shipped, already-correctly-typed backend fields (`Query.instagramEmbedBySlug`, Story 3.7h; `Query.event(id).instagramEmbed`, Story 3.7e) — zero `apps/backend`/`packages/database` changes. It removes one field (`instagramEmbed`) from one existing query document (`getEventBySlug`) — a frontend-only, additive-in-reverse change with no server-side contract impact (the `Event.instagramEmbed` GraphQL field itself is untouched and still resolvable via either `event(id)` or `eventBySlug(slug)`; only this one query document stops selecting it).
- **Impacted fields/contracts:** `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` document (field removed); two new query documents added. `apps/web/src/generated/graphql.ts` regenerated (Task 1) — `GetEventBySlugQuery['eventBySlug']`'s TypeScript type loses `instagramEmbed`; two new hook/type exports added. `mapper.ts`'s `mapGraphQLEventToDetailViewProps` gains one new optional parameter (Task 3) — additive, not a breaking signature change for any existing caller that omits it.
- **Required DB migration changes:** None. No `schema.ts` edit of any kind.
- **Required TypeScript type changes:** `apps/web/src/features/events/mapper.ts` — new exported `ResolvedInstagramEmbed` interface and the new optional parameter on `mapGraphQLEventToDetailViewProps` (Task 3). `apps/web/src/generated/graphql.ts` — regenerated via `pnpm --filter web codegen` (Task 1), not hand-edited.
- **Backward compatibility and rollout notes:** The removal of `instagramEmbed` from `getEventBySlug.graphql` is a same-deploy, client-and-server-together change (the GraphQL query document lives in the same `apps/web` bundle as the code that reads its result) — there is no intermediate state where an old client queries a field a new backend has removed, or vice versa, since the `Event.instagramEmbed` field resolver itself is untouched and still exists on the schema; only this one document's selection set shrinks. `mapGraphQLEventToDetailViewProps`'s new parameter being optional means no existing call site breaks before Task 2's own call site is updated in the same commit. The net runtime behavior change (the actual point of this story): primary event-detail content now renders without waiting for either Instagram round trip, for every event — a strict latency improvement with no regression risk for any event shape (platform-prefixed slug, legacy hex slug, or no linked post at all, which already maps to `instagramEmbed: null` today and continues to under the new `NOT_RESOLVABLE_FROM_SLUG`-is-irrelevant-because-no-postUrl path in the fallback resolver).
- **Verification checks:** Task 4's new/updated `EventDetailWrapper.test.tsx` cases (AVAILABLE-no-fallback-call, UNAVAILABLE-no-fallback-data, NOT_RESOLVABLE_FROM_SLUG-with-delayed-fallback proving primary content renders first) and `mapper.test.ts` cases (omitted-parameter regression, AVAILABLE/UNAVAILABLE pass-through) prove end-to-end alignment.

### State Management Categorization

Server State (React Query), per `project-context.md`'s three-way categorization — `useGetInstagramEmbedBySlugQuery` and `useGetInstagramEmbedForEventQuery` are both generated the same way as every other query hook in this codebase (`graphql-request` + `@tanstack/react-query`, end-to-end typed via GraphQL Code Generator), consistent with AD-4. Not a new category; no `nuqs`/`zustand` involvement. The merge computation (Task 2) is a plain derived value computed on every render from the two hooks' own `data`, not independent component state.

### Loader Classification

**Non-Blocking (Initial Load).** Unchanged from Story 3.7d's own classification — the embed's loading/ready/placeholder treatment inside `InstagramEmbed.tsx` is untouched, and `EventDetailView.tsx`'s existing skeleton (shown while `instagramEmbedStatus` is `null`, i.e. while either embed hook is still resolving or neither is applicable) already matches the real component's dimensions (`project-context.md`'s "Keep Skeletons in Sync With Their Real Component" rule) — this story changes only the data source feeding that already-correct skeleton/transition logic, not the logic itself.

### Analytics

No new PostHog event. Unchanged from Story 3.7d's own finding: embed load/failure (now split across two hooks) is passive display state, not a tracked user interaction.

### Project Structure Notes

- `apps/web/src/features/events/queries.graphql` — one field removed from an existing query, two new query documents added (both reuse already-shipped backend fields; zero `apps/backend` change).
- `apps/web/src/features/events/EventDetailWrapper.tsx` — two new hooks + a small merge computation, added inline per Gate 2's finding above (no new file).
- `apps/web/src/features/events/mapper.ts` — one new exported type, one new optional parameter on an existing exported function.
- `apps/web/src/generated/graphql.ts` — regenerated via `pnpm --filter web codegen` (Task 1), not hand-edited.
- **No files under `apps/backend/`, `packages/ui/`, `packages/domain/`, or `packages/database/` are touched** (Task 5, Gate 2 finding (a)).
- **Reusable UI component (packages/ui) / cloud or external service setup (SETUP_WALKTHROUGH.md) / analytics (AD-5) / i18n (AD-6) / AD-1/AD-2 Unified Query DSL / DB schema changes (AD-3):** None apply. No new UI component (Gate 2 finding (a)); no new cloud/external service (both consumed GraphQL fields already exist, backed by the already-shipped tokenless Meta oEmbed adapter); no tracked interaction; no new user-facing string; `event(id)`/`eventBySlug(slug)`/`instagramEmbedBySlug(slug)` are all single-item lookups, not collection queries, so AD-1/AD-2's Unified Query DSL does not govern them (same reasoning Story 3.7h's own Dev Notes already established for `instagramEmbedBySlug`); no schema change.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7i: Fetch the event-detail oEmbed in parallel with the event query] (lines 3594-3606)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.7h: Resolve Instagram oEmbed from the event slug without a database lookup] (lines 3579-3592) — prerequisite, `review`, commit `f3e1bcac`
- [Source: _bmad-output/implementation-artifacts/3-7h-resolve-instagram-oembed-from-the-event-slug-without-a-database-lookup.md] — exact `Query.instagramEmbedBySlug` schema (`InstagramEmbedBySlugStatus` enum: `AVAILABLE`/`UNAVAILABLE`/`NOT_RESOLVABLE_FROM_SLUG`; `InstagramEmbedBySlug` type: `status!`, `html`, `durableImageUrl`), its "Lazy join" design decision, and its explicit "Out of Scope: ... Story 3.7i" hand-off
- [Source: _bmad-output/implementation-artifacts/3-7d-event-detail-image-display-oembed-transition-with-fallback.md] — `InstagramEmbed.tsx`'s loading state machine (Tasks 1-5, unchanged by this story) and `EventDetailView.tsx`'s `instagramEmbedStatus ? <InstagramEmbed/> : <EventImage/>` integration point (Task 6) this story's new data source feeds into unchanged
- [Source: _bmad-output/implementation-artifacts/1-6c-batch-isaddedtocalendar-dedupe-eventbyslug-fetch-and-gate-subscriptions-query.md] — dependency (`eventBySlug` dedupe via `getEventBySlugCached`/SSR hydration), `review`; and the `enabled`-on-already-fetched-data idiom (`useGetMySubscriptionsQuery`) this story's Task 2 directly extends for its own third hook
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-16: Platform-Prefixed Event Slugs & Parallel oEmbed Resolution] (lines 496-625), specifically Rule 7 (primary content never gated on oEmbed; the exact mechanism this story implements) and the "Considered and rejected" alternatives (`Promise.all`/`Promise.race`/React 19 `use()` streaming/direct-from-browser Meta calls — all rejected, confirming independent React Query hooks is the decided approach)
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 batch sweep; 3.7i verdict: READY
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md#Multi-Event Posts and Cross-Post Event Matching (CC-024)] (lines 373-392) — §1 "the embed and the primary image/video stay on the primary post only" (unaffected by this story — primary-post selection is unchanged); §2's explicit citation of "AD-16 Rule 7's oEmbed-never-gates-content precedent" as the reference pattern for a sibling feature
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] (loaded in full) — confirmed zero Instagram-embed-specific visual tokens exist (same gap 3.7d already found/resolved; not a defect for this story to address)
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx] lines 44-67 (`useGetEventBySlugQuery`/`useGetMySubscriptionsQuery` — the exact "second independent hook" and "`enabled`-gated third hook" precedent this story's Task 2 follows), line 312 (`eventId` derivation), line 534 (`mapGraphQLEventToDetailViewProps` call site)
- [Source: apps/web/src/features/events/mapper.ts] lines 51-149 (`mapGraphQLEventToDetailViewProps`, full current signature/body), lines 108-110 (the three lines this story's Task 3 changes)
- [Source: apps/web/src/features/events/queries.graphql] lines 46-125 (`getEventBySlug`, lines 58-62 the `instagramEmbed` block being removed), lines 127-146 (`getEventForIcsExport` — the existing `event(id)` precedent this story's fallback query reuses)
- [Source: packages/ui/src/features/events/EventDetailView.tsx] lines 239-266 (the unchanged media-column branch this story's new data feeds)
- [Source: packages/ui/src/features/events/InstagramEmbed.tsx] (unchanged in full — the loading state machine AC2 confirms stays untouched)
- [Source: apps/backend/src/schema/events.graphql] lines 1-24 (`InstagramEmbed`/`InstagramEmbedStatus`, `InstagramEmbedBySlug`/`InstagramEmbedBySlugStatus`), lines 158-163 (`extend type Query` — `event`, `eventBySlug`, `instagramEmbedBySlug`, all pre-existing/unchanged)
- [Source: apps/backend/src/schema/resolvers.ts] lines 3554 (`Query.event`), lines 3675 (`Query.eventBySlug`) — both confirmed to call the identical `buildOptimizedDrizzleSelect(events, info)` mechanism, proving `instagramEmbed`'s underlying column dependencies resolve identically via either entry point; line 4143 (`Event.instagramEmbed` field resolver, unchanged, reused by this story's fallback query)
- [Source: apps/web/src/features/events/EventDetailWrapper.test.tsx] lines 103-139, 300-449 (current `currentMockEvent` fixture and the two instagramEmbed-specific tests Task 4 rewrites)
- [Source: apps/web/src/features/events/mapper.test.ts] lines 46-98 (`buildEvent()` fixture Task 4 updates)
- [Source: _bmad-output/project-context.md#UI Patterns & UX Invariants] — "No `loading.tsx` on a route only ever reached via in-app navigation" (AC2) and "Keep Skeletons in Sync With Their Real Component" (Loader Classification)
- [Source: _bmad-output/project-context.md#Database & Performance] — "`Query.eventBySlug` ... is the second-highest-traffic endpoint ... AD-16 restructures `EventDetailWrapper.tsx` so primary content is never gated on the Instagram oEmbed round trip"

## Global Rules References

- [x] project-context.md — Database & Performance (`Query.eventBySlug`/AD-16 pointer); UI Patterns & UX Invariants (loader/skeleton rules); State Management Architecture
- [x] story-content-structure.md — canonical section order followed
- [x] architecture spine — AD-16 Rule 7 (this story's exact implementation target)
- [x] infrastructure docs — no infra/topology change (reuses already-shipped GraphQL fields/resolvers, no new queue/lambda/IaC)

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/web/src/features/events/queries.graphql` — remove `instagramEmbed` from `getEventBySlug`; add `getInstagramEmbedBySlug`, `getInstagramEmbedForEvent`.
  - `apps/web/src/generated/graphql.ts` — regenerated via `pnpm --filter web codegen` (not hand-edited).
  - `apps/web/src/features/events/EventDetailWrapper.tsx` — add two new hooks + merge computation; update the `mapGraphQLEventToDetailViewProps` call site.
  - `apps/web/src/features/events/mapper.ts` — new `ResolvedInstagramEmbed` export; new optional parameter; three mapped-field sources changed.
  - `apps/web/src/features/events/mapper.test.ts` — remove stale fixture field; add new parameter-mapping test block.
  - `apps/web/src/features/events/EventDetailWrapper.test.tsx` — remove stale fixture field; add two new MSW handlers; rewrite two existing tests; add one new test.
- **Rule Mapping:**
  - AD-16 Rule 7 (primary content never gated on oEmbed; independent parallel React Query hooks, no `Promise.all`/race) → Task 1 (query documents) + Task 2 (the two/three-hook wiring, unconditional second hook).
  - Story 3.7h AC2 ("legacy slug returns `NOT_RESOLVABLE_FROM_SLUG` so the caller can fall back to the existing `Event.instagramEmbed` path") → Task 1's `getInstagramEmbedForEvent` document + Task 2's third, conditionally-`enabled` hook.
  - Story 3.7d's loading state machine / `EventDetailView.tsx` integration (unchanged) → Task 5's scope-boundary confirmation.
  - project-context.md's "Keep Skeletons in Sync With Their Real Component" / Non-Blocking loader rule → Loader Classification Dev Note (no change needed, already correct).
  - project-context.md's "No `loading.tsx` on an in-app-only route" rule → AC2's explicit confirmation that the modal route gains none.
  - Testing Rules (testing-trophy for `apps/*`) → Task 4.
- **Verification Plan:**
  - `pnpm --filter web codegen` — confirms clean regeneration, no manual edits needed.
  - `pnpm --filter web test` — `mapper.test.ts`'s new/updated cases and `EventDetailWrapper.test.tsx`'s new/updated cases (AVAILABLE-no-fallback-call, UNAVAILABLE-no-data, NOT_RESOLVABLE_FROM_SLUG-with-delayed-fallback-proving-primary-content-renders-first) all pass; full existing suite in both files passes unmodified otherwise.
  - `pnpm --filter web lint` / `pnpm --filter web build` — touched files type-check and lint clean (the mapper-signature change and the generated-type field removal are exactly what `build` is positioned to catch if any call site was missed).
  - Root `pnpm lint`/`pnpm test` — confirm no cross-package regression (none expected; only `apps/web` is touched).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — builds only the `apps/web`-side wiring (two new query documents, two new hooks, a merge computation, an additive mapper-signature change) against two already-shipped backend fields; no `apps/backend`/`packages/ui`/`packages/domain`/`packages/database` change.
- [ ] Architecture and boundary confirmation — AD-16 Rule 7's "independent parallel hooks, primary content never gated" mechanism implemented exactly as specified; the legacy-slug fallback (AC3) reuses the already-shipped `Query.event(id).instagramEmbed` field with zero backend change.
- [ ] Testing plan confirmation — Task 4 covers the three embed-result branches (AVAILABLE-no-fallback-call, UNAVAILABLE-no-fallback, NOT_RESOLVABLE_FROM_SLUG-with-fallback) plus the mapper's own omitted/present-parameter cases.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the CC-024 batch readiness report (no gap); Gate 2 run fresh this story (no gap — see Dev Notes); no prerequisite story needed. Prerequisites 3.7h (`review`, commit `f3e1bcac`), 3.7d (`review`), and 1.6c (`review`) are all complete per the standing project rule that a `review`-status prerequisite with tests/lint/build green is safe to build against.

## Testing Requirements

- [ ] Unit tests (`mapper.test.ts`, Vitest) — the new `instagramEmbed` parameter's omitted/`AVAILABLE`/`UNAVAILABLE` mapping cases.
- [ ] Integration tests (`EventDetailWrapper.test.tsx`, Vitest + MSW) — the three embed-result branches, including the delayed-fallback test proving primary content renders before the legacy fallback resolves.
- [ ] E2E tests — N/A. No new user-facing flow; the existing embed-vs-image rendering behavior for a real event is unchanged from the user's perspective (only its network timing improves), already covered by this story's own integration tests.

## Deliverables Checklist

- [ ] `instagramEmbed` removed from `getEventBySlug.graphql`; `getInstagramEmbedBySlug` and `getInstagramEmbedForEvent` query documents added; codegen regenerated cleanly.
- [ ] `EventDetailWrapper.tsx` fires `useGetInstagramEmbedBySlugQuery` unconditionally in parallel with `useGetEventBySlugQuery`, and `useGetInstagramEmbedForEventQuery` only when the first resolves `NOT_RESOLVABLE_FROM_SLUG` and `eventId` is known.
- [ ] `mapper.ts`'s `mapGraphQLEventToDetailViewProps` gains the new optional `instagramEmbed` parameter (additive, all existing callers unaffected) and maps it onto the three existing `EventDetailViewProps` embed fields.
- [ ] Primary event-detail content renders off `useGetEventBySlugQuery` alone in every case — proven by the delayed-fallback integration test.
- [ ] `packages/ui`, `apps/backend`, `packages/domain`, `packages/database` are untouched.
- [ ] All new/updated tests pass; lint and type checks pass for `apps/web`.

## Out of Scope

- Any change to `InstagramEmbed.tsx`'s or `EventDetailView.tsx`'s rendering logic, props shape, or loading state machine — unchanged (Story 3.7d).
- Any change to `Query.instagramEmbedBySlug`'s or `Event.instagramEmbed`'s backend resolver implementation — both already shipped (Stories 3.7h, 3.7e), reused as-is.
- Generating the `~{ordinal}` slug suffix, re-slugging on a primary-post change, or the alias-redirect table/resolution order — Stories 3.6t/3.6v (AD-16 Rules 8-11, AD-30).
- Any multi-event/multi-post schema (`event_posts`, `extraction_ordinal`) — Story 3.6r.
- The two Next.js route files (`events/[slug]/page.tsx`, the modal `page.tsx`) — no change needed; both already render `EventDetailWrapper.tsx` with no awareness of its internal hooks.

## Definition of Done

- [ ] AC1-AC4 satisfied.
- [ ] Required tests passing (Task 4; Testing Requirements above).
- [ ] Lint and type checks passing for `apps/web`.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
