# Story 1.6: View event details

## Story Details

- Epic: 1 - Core App and Event Discovery
- Story ID: 1.6
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to click on an event to see its full details,
so that I can get all the information I need about the event.

## Acceptance Criteria

1. **AC1 — Modal-on-click, URL updates (UX-DR14):** Given I am on the main discovery page, when I click on an `EventCard`, then the event's full details open in a modal overlay (via a Next.js parallel + intercepting route) without a full page reload, and the browser URL updates to `/events/[slug]`.
2. **AC2 — Full-page route for direct/deep-link access:** Given a direct navigation to `/events/[slug]` (typed URL, page refresh, or a shared/bookmarked link), when the route resolves, then the event's full details render as a standalone full page (no modal chrome, no dependency on the discovery page being mounted).
3. **AC3 — Shared rendering, invocation-agnostic parity:** Both the modal route and the full-page route render the identical `EventDetailView` component (Story 1.6a) with an identical mapped prop shape and identical `loading`/`error`/populated-data states — neither route reimplements its own detail markup.
4. **AC4 — Single-item GraphQL fetch, not the collection DSL:** The event's details are fetched via a new `eventBySlug` query on the backend GraphQL API (Story 1.3a's layer) — `apps/web` never imports the database/domain layer directly. Because this is a single-item lookup (not an event *collection*), it is **not** expressed via the Unified Query DSL (AD-1/AD-2 scope collection retrieval only) — it mirrors the existing, already-implemented non-DSL `event(id)` query's pattern.
5. **AC5 — Next/Previous navigation, context-aware:** The detail view (modal and full page) offers "Next"/"Previous" controls, powered by Story 1.6b's context-aware list navigation hook, that respect the search/filter/sort context of the list I navigated from; when no list context exists (a direct deep link), the controls are hidden/disabled rather than shown broken (per `project-context.md`'s explicit deep-link bypass carve-out).
6. **AC6 — Background pagination at the list boundary:** If I use "Next" while at the last currently-loaded item of the originating list, the system automatically fetches the next page of list results in the background (via Story 1.6b's hook) and resolves to the newly-available next item once loaded, without blocking the UI.
7. **AC7 — Click wiring preserves interception:** Clicking an `EventCard`'s primary clickable area on the discovery grid triggers a client-side router navigation (not a plain `<a href>` hard navigation) to `/events/[slug]`, since intercepting routes only activate on client-side transitions — a hard navigation would silently skip the modal and always land on the full page.
8. **AC8 — i18n:** All page/route-level static labels this story introduces itself (e.g. Next/Previous button labels, modal close label, "event not found" copy) — distinct from `EventDetailView`'s own internal microcopy, which Story 1.6a's `labels` prop already covers and which this story populates with translated strings at the call site — are localized via `next-intl`, with message keys present in both `en` and `id` locale files (AD-6, NFR23).
9. **AC9 — Analytics:** An `event_details_viewed` PostHog event fires, containing the event's `id` and `eventName`, exactly once each time the details view (modal or full page) successfully opens with populated event data (AD-5).
10. **AC10 — Test coverage:** Integration tests validate the `eventBySlug` resolver's behavior and its field-selection compatibility with `buildOptimizedDrizzleSelect`; E2E tests validate (a) opening the detail modal from the discovery list via a card click, and (b) a direct-deep-link navigation to `/events/[slug]` rendering the full page correctly without requiring list context.
11. **AC11 — Source-post attribution (added 2026-08-01 via `bmad-correct-course`):** The event details view displays attribution link(s) back to the source social media post, when the event has a linked post: the original-platform post (`Post.originalPostUrl`, when the scraper adapter was able to derive it) and/or the post as actually scraped (`Post.postUrl`, which may be a proxy/mirror site such as `imginn.com`). Whichever of the two is unavailable for a given post is simply omitted (per Story 1.6a's AC15 contract) — this is not the fabricated "proxy-platform URL" concept from the pre-split-gate-era draft (see Dev Notes), it is grounded in PRD §3.3.3/§3.7.
12. **AC12 — Dynamic page title & meta tags (added 2026-08-01, `project-context.md`'s "Dynamic Page Title & Meta Tags" rule):** Both the full-page route (`/events/[slug]/page.tsx`) and the intercepted modal route (`@modal/(.)events/[slug]/page.tsx`) set the browser tab title and meta description to the event's own `eventName`/description via a route-level `generateMetadata` export, built with the shared `apps/web/src/lib/metadata.ts` helper (Story 1.9) and sourced through next-intl's server-side `getTranslations()` — never a static `metadata` export, and never a client-side `document.title` mutation. Baseline `og:title`/`og:description` are included, mirroring the resolved event title/description. Because both routes fetch event data client-side (`useEventBySlugQuery`, AC4), each route's `page.tsx` follows Story 1.9's established split: a Server Component `page.tsx` (holding `generateMetadata`) that renders the client-fetching logic from a colocated file, rather than exporting metadata from a `"use client"` file (not supported by Next.js).

## Tasks / Subtasks

- [ ] 1. Wire `apps/backend/src/schema/events.graphql` into the actual runtime schema and codegen input (AC4) — **pre-existing gap, not introduced by this story:** confirmed by direct read that `apps/backend/src/server.ts` (`readFileSync(.../src/schema/typeDefs.graphql')`) and `apps/backend/codegen.ts` (`schema: 'src/schema/typeDefs.graphql'`) both reference *only* `typeDefs.graphql` (`type Query { health: Boolean! }`), while `events.graphql`'s `Event`/`Schedule`/`events`/`event` definitions are never merged in. Point both at a glob/merge of `src/schema/*.graphql` (mirroring `apps/web/codegen.ts`'s own `schema: '../backend/src/schema/**/*.graphql'`, which already assumes multiple files) so this story's new fields are actually reachable at runtime.
- [ ] 2. Add `slug: String!` to the `Event` type in `apps/backend/src/schema/events.graphql` (AC4) — the DB column (`events.slug`, unique/notNull since Story 1.1) and `packages/shared-types`' `EventInfo.slug` already exist; only the GraphQL exposure is missing. No resolver code needed — `buildOptimizedDrizzleSelect` auto-selects it once it's a requested GraphQL field matching a real column.
- [ ] 3. Add `eventBySlug(slug: String!): Event` to the `Query` type in `events.graphql`, and implement `Query.eventBySlug` in `apps/backend/src/schema/resolvers.ts`, mirroring the existing `Query.event` resolver's pattern (`buildOptimizedDrizzleSelect(events, info)` + `eq(events.slug, slug)`) (AC4).
- [ ] 4. Regenerate backend types (`pnpm --filter backend codegen`) and add/extend integration tests in `apps/backend/src/schema/resolvers.test.ts` for `eventBySlug`: found-by-slug, not-found returns `null`, field-selection only returns requested columns (AC10).
- [ ] 5. Add an `eventBySlug` GraphQL operation document under `apps/web` and regenerate the web client (`pnpm --filter web codegen`) to produce a typed `useEventBySlugQuery` hook (AC4).
- [ ] 6. Update `apps/web/src/app/[locale]/layout.tsx` to accept and render a `modal` parallel-route slot alongside `children` (inside `<AppShell>`), and add the required `apps/web/src/app/[locale]/@modal/default.tsx` (renders `null`) (AC1, AC2).
- [ ] 7. Create the full-page route as a Server Component `apps/web/src/app/[locale]/events/[slug]/page.tsx` holding `export async function generateMetadata({ params })` — resolve `slug`/`locale`, fetch the event server-side (or accept a `null`/not-found title fallback if only client-fetching is wired), call `getTranslations({ locale, namespace: 'Metadata' })` (or a new event-scoped namespace) and `buildPageMetadata(...)` (Story 1.9's shared helper) to build a title/description from the event's `eventName`/description, with baseline `og:title`/`og:description` (AC12) — then render the extracted client logic from a colocated `event-detail-content.tsx` (Task 7a).
- [ ] 7a. Create `apps/web/src/app/[locale]/events/[slug]/event-detail-content.tsx` (`"use client"`): fetch via `useEventBySlugQuery`, map the GraphQL `Event` shape onto `EventDetailView`'s prop contract (a shared mapper, not duplicated per route), render `EventDetailView` directly (no modal chrome), and render a localized "not found" state when the query resolves `null` (AC2, AC3, AC8) — mirrors Story 1.9's `page.tsx`/`home-content.tsx` split, needed here because `generateMetadata` cannot be exported from a `"use client"` file.
- [ ] 8. Create the intercepted modal route as a Server Component `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` holding its own `generateMetadata` (same pattern as Task 7, AC12) — then render the extracted client logic from a colocated `event-detail-modal-content.tsx` (Task 8a).
- [ ] 8a. Create `apps/web/src/app/[locale]/@modal/(.)events/[slug]/event-detail-modal-content.tsx` (`"use client"`): same fetch + mapping as Task 7a (reuse the shared mapper), wrap `EventDetailView` in the existing Shadcn `Dialog` (`apps/web/src/components/ui/dialog.tsx`), with `onOpenChange(false)` calling `router.back()` to dismiss and restore the underlying URL (AC1, AC3).
- [ ] 9. Wire `EventCard` click behavior on the discovery grid (`apps/web/src/app/[locale]/page.tsx`, Story 1.3's page): use the `onClick` prop (not `href`, which renders a plain `<a>` and would bypass interception) with `router.push('/events/' + slug)` from next-intl's `useRouter` (`apps/web/src/i18n/navigation.ts`), preserving the current list's search-params on the outbound URL so Story 1.6b's hook has context to read back (AC1, AC7).
- [ ] 10. Consume Story 1.6b's context-aware list-navigation hook to power Next/Previous controls on both routes: pass it the discovery page's live list context (URL-encoded search/filter/sort plus, on the modal route, the still-mounted discovery page's React Query cache/`fetchNextPage`); on the full-page route, only supply context when the URL itself carries it (no live list cache available on a cold full-page load) so the hook's own no-context bypass correctly hides the controls otherwise (AC5, AC6).
- [ ] 11. Add message keys to `apps/web/locales/en.json` and `apps/web/locales/id.json` for this story's own page-level copy (e.g. `EventDetailsPage.next`, `.previous`, `.closeModal`, `.notFoundTitle`, `.notFoundBody`) and populate `EventDetailView`'s `labels` prop with translated strings at each route's call site (AC8). Also extend Story 1.9's `Metadata` namespace with an event-detail title/description template (e.g. `Metadata.eventDetailTitle`/`.eventDetailDescription`, interpolating the event's `eventName`) for the two new routes' `generateMetadata` calls (AC12).
- [ ] 12. Fire the `event_details_viewed` PostHog event (`{ eventId, eventName }` payload) via `usePostHog()` from `@festgrid/analytics` once per successful detail-view open, from a single shared location consumed by both routes (not duplicated) (AC9).
- [ ] 13. Write E2E tests (`apps/web/e2e/event-details.spec.ts`, Playwright): clicking a card on the discovery grid opens the modal and updates the URL; navigating directly to `/events/[slug]` renders the full page with no Next/Previous controls when there is no list context (AC1, AC2, AC5, AC10).
- [ ] 14. **(Added 2026-08-01, source-attribution amendment, AC11):** Add `sourcePostUrl: String` and `originalPostUrl: String` fields to the `Event` type in `events.graphql`, and implement their resolvers in `resolvers.ts` by joining `posts` via `events.postId` — the same join Story 1.3a's AC6 already established for `Event.imageUrl`. If Story 1.3a's `imageUrl` join is already implemented by the time this task is picked up, extend that same resolver/join to also return `sourcePostUrl`/`originalPostUrl` rather than issuing a duplicate `posts` join; otherwise implement all three fields together against one join. Map both onto `EventDetailView`'s `sourcePostUrl`/`originalPostUrl` props (Story 1.6a AC15) in the shared prop-mapper (Task 7/8). Requires Story 1.2a's AC7/Task 13 migration (`posts.original_post_url`) to be applied first for `originalPostUrl` to ever be non-null — see Pre-Coding Approval Gate.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is `swept: true` and explicitly lists `1.6` in `stories_covered`. Its one finding (no GraphQL authenticated-context layer, resolved by Story 0.17) does not apply here — this is a public/unauthenticated read, same as the discovery page and the existing `event(id)` query.
- **Gate 2 (run fresh via subagent, persona Freya, during this story's creation, 2026-08-01) — SPLIT:** The draft scope folded "Next/Previous navigation that reads list context, detects list-boundary, and triggers a background next-page fetch" directly into this story. The subagent found this combines the same independent state dimensions (fetch + derived state + side effects) that triggered the Story 1.3c (`useInfiniteScroll`) split, and clears the reuse bar independently: `project-context.md`'s "Context-Aware Detail Views" invariant explicitly generalizes this behavior across "any list" (Discovery, Favorites, Subscriptions), and Epic 2's Story 2.2 ("View favorited events") and Story 2.6 ("View and manage events on a calendar") are concrete near-term consumers of the same mechanism. **Resolution:** split into new Story **1.6b — "Build the context-aware list navigation hook"**, written as a full section into `epics.md` (positioned after 1.6a, before 1.6) and added as a `backlog` entry to `sprint-status.yaml` immediately before this story. This story (1.6) only *consumes* 1.6b's hook (Task 10); it does not implement the hook's internals.
- **Gate 2 finding corrected, then reinstated via `bmad-correct-course` (both 2026-08-01):** the previous (pre-split-gate-era) draft of this story required "a link to the original social media post" and "a link to a proxy-platform post URL," asserting "full source URLs are not stored in the database." At Gate 2 time, the subagent and independent verification against `epics.md`'s Story 1.6/1.6a ACs, the PRD, and the UX scenario found **zero grounding** for this requirement and dropped it — the premise was also factually wrong against the schema as it stood (`posts.postUrl` is already stored, and no `platformId`/generic "proxy" concept existed). The user then confirmed the underlying need is real: FestGrid's Instagram scraper is blocked from direct access and scrapes via a proxy/mirror site (`imginn.com`), which happens to preserve Instagram's own post ID, making the original URL derivable for this specific adapter. A `bmad-correct-course` pass (2026-08-01) properly grounded this in PRD §3.3.3/§3.7/§4.7 (`Post.originalPostUrl`, new nullable field/column — see Story 1.2a's amendment) and reinstated it as **AC11** above. The corrected version differs from the stale draft in two ways: (1) no generic `platformId` field is needed — the two URLs (`postUrl`, `originalPostUrl`) are both plain stored strings; (2) derivation of `originalPostUrl` is an adapter-specific concern owned by the scraper (Story 3.4, not yet detailed), not a per-request "read/render time" construction in this story's resolver — this story's `eventBySlug` resolver only needs to select and return both already-stored columns.
- **Lightweight guard — gap found, resolved inline (not split):** Confirmed by direct read of `apps/backend/src/server.ts` and `apps/backend/codegen.ts` that `events.graphql` (already written by Story 1.3a) is not actually merged into the runtime schema or codegen input (both reference only `typeDefs.graphql`, currently `type Query { health: Boolean! }`). This is a completeness gap in Story 1.3a's own already-approved scope, not a new architectural layer this story is bypassing or absorbing — per the "a story must leave the system working end-to-end" rule, Task 1 fixes the wiring so this story's own `eventBySlug` addition (and 1.3a's pre-existing `events`/`event` fields) are actually reachable. No new prerequisite story warranted; this is a one-line schema-loading fix co-located with the files this story already touches.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** One GraphQL-schema-level gap found (not a DB/shared-types mismatch): the `Event` GraphQL type has no `slug` field, even though `events.slug` (DB column, unique/notNull since Story 1.1) and `packages/shared-types`' `EventInfo.slug` both already exist. This is purely a GraphQL exposure gap.
- **Required DB migration changes:** No changes required — `events.slug` already exists with the correct constraints.
- **Required TypeScript/schema changes:** Add `slug: String!` to `events.graphql`'s `Event` type (Task 2); no `packages/shared-types` changes needed (`EventInfo.slug` already correct). Add `eventBySlug(slug: String!): Event` to the `Query` type (Task 3). Both are additive, non-breaking schema changes.
- **Backward compatibility and rollout notes:** Purely additive (new field, new query) — no existing consumer of `events.graphql` is broken. The wiring fix (Task 1) is also purely additive (it starts merging a file that was already written but inert; nothing currently depends on it staying disconnected).
- **Verification checks:** Integration tests (Task 4) confirm `eventBySlug` returns the correct row, returns `null` for an unknown slug, and only selects GraphQL-requested fields (via `buildOptimizedDrizzleSelect`, same mechanism `event(id)` already uses).

**Amendment (2026-08-01, source-attribution requirement):** `Event.sourcePostUrl`/`Event.originalPostUrl` (Task 14) depend on Story 1.2a's AC7/Task 13 (`posts.original_post_url` nullable column, not yet implemented as of this amendment — see Story 1.2a's Completion Status). `sourcePostUrl` (from the existing `posts.post_url`) has no such dependency and can be implemented immediately. `originalPostUrl` will simply resolve to `null` for every event until both Story 1.2a's migration lands and a scraper adapter (Story 3.4, not yet built) actually populates it for real scraped posts — `EventDetailView`'s AC15 contract already handles an absent value gracefully (link omitted, not broken).

### Dynamic Page Title & Meta Tags (added 2026-08-01)

- **Rule source:** `project-context.md`'s "Dynamic Page Title & Meta Tags" invariant (added 2026-08-01, referencing Story 1.9 as the reference implementation) mandates every `apps/web` route set its title/description via `generateMetadata` — never a static `metadata` export or client-side `document.title` mutation — sourced through next-intl's server-side `getTranslations()`, built via the shared `apps/web/src/lib/metadata.ts` helper. Story 1.9's own Dev Notes explicitly named this story ("Story 1.6's event detail page") as the next expected consumer of this convention; this amendment fulfills that expectation (AC12, Tasks 7/7a/8/8a).
- **No new architecture/tooling gap:** the shared `buildPageMetadata()` helper and `Metadata` i18n namespace already exist (built by Story 1.9); this story only extends the namespace with event-scoped keys and applies the established `page.tsx` (Server Component + `generateMetadata`) / colocated client-content-file split — the same split Story 1.9 already performed on the Discovery page. No Gate 1/3 escalation warranted.
- **Both routes need the split, not just one:** both the full-page route and the intercepted modal route independently resolve `generateMetadata` per Next.js App Router's per-segment metadata resolution, so both need their own Server Component `page.tsx` wrapping a colocated client-fetching file (Tasks 7/7a, 8/8a) — skipping the modal route would leave the browser tab title stale (still the Discovery page's title) while the modal is open.

### Previous Story Intelligence

- **Story 1.6a (`EventDetailView`, `ready-for-dev`, not yet implemented on disk — confirmed `packages/ui/src/features/events/` currently contains only `EventCard.*`):** already owns all detail-view rendering — name/description, all schedules (date/time/performers/location/price), tags, image with fallback, `loading`/`error` states, reserved (unwired) favorite/calendar slots, and an i18n-ready `labels` override prop. This story must not reimplement any of that; it only fetches data, maps it onto `EventDetailView`'s prop contract, and supplies `loading`/`error` from its own query state.
- **Story 1.3b (`EventCard`, `in-progress`):** already exposes both an `href` prop (renders a plain `<a>`) and an `onClick` prop. This story **must use `onClick` + `router.push`**, not `href` — a plain anchor's hard navigation bypasses Next.js's client-side router entirely, so an intercepting route would never activate and UX-DR14's "opens a modal" requirement would silently fail, always landing on the full page instead. This is a materially different (and more correct) plan than the pre-split-gate-era draft of this story, which only said "wrap with `<Link>`" without addressing why `href`-based wrapping specifically fails for the interception case.
- **Story 1.3a (`events`/`event` GraphQL layer, `review`):** its AC6 already resolves `Event.imageUrl` by joining `posts` via `events.postId` — a shared field resolver on the `Event` type, so it automatically applies to results from *any* query returning `Event`, including this story's new `eventBySlug`. No image-URL work is needed in this story.
- **Story 1.3 (discovery page, `ready-for-dev`, re-confirmed not yet implemented as of this regeneration):** its own Out of Scope explicitly defers "Event detail modal/navigation on card click" to Story 1.6/1.6a — meaning this story (not 1.3) is responsible for adding the click-to-navigate wiring on `apps/web/src/app/[locale]/page.tsx`, coordinating with (not duplicating) Story 1.3's grid-rendering scope on that same file.

### Architecture and technical constraints

- **API access:** Exclusively via the backend GraphQL `eventBySlug` query (`project-context.md`'s "Database Access" rule) — never a direct DB/domain import from `apps/web` (AC4).
- **Single-item vs. collection query (AD-1/AD-2):** AD-2's rule text scopes the Unified Query DSL mandate to "event **collections**." A by-slug lookup returns at most one `Event`, mirroring the already-implemented, non-DSL `event(id)` resolver — this story's `eventBySlug` follows that same precedent rather than constructing a DSL condition object for a single-item fetch.
- **State management categorization (AD-4):**
  - **Server State:** the event-by-slug fetch → `@tanstack/react-query`'s `useQuery` (single-item, not `useInfiniteQuery`) via the generated `eventBySlug` hook.
  - **URL State:** `nuqs`-managed list context (search/filter/sort) is read (not owned/written) by this story — carried forward onto the outbound `/events/[slug]` navigation (Task 9) so the destination route has something for Story 1.6b's hook to resolve.
  - **Client Global State:** none introduced by this story.
- **Loader categorization:** initial event-detail fetch is **Non-Blocking** — `EventDetailView`'s own `loading` skeleton prop (Story 1.6a AC8) — never the full-screen blocking overlay pattern (reserved for critical mutations, not reads).
- **Routing/interception mechanics (UX-DR14):** a Next.js parallel route (`@modal` slot in `apps/web/src/app/[locale]/`) combined with an intercepting route segment (`(.)events/[slug]`) is what makes "modal that updates the URL, but a hard navigation/direct link still renders the full page" possible. Interception only activates for client-side navigations (`<Link>` or `router.push`) originating from a sibling route already in the tree — a plain `<a href>` click, a typed URL, or a page refresh always resolves the actual matched route (`/events/[slug]/page.tsx`), which is exactly the deep-link-fallback behavior AC2/AC10 require, not a bug to work around.
- **Next/Previous context availability differs by route:** on the modal route, the discovery page underneath stays mounted (that's what interception means), so its live React Query cache/`fetchNextPage` is available to Story 1.6b's hook — full Next/Previous + background-pagination behavior. On the full-page route (a cold load), no list cache exists; Next/Previous is only available if the URL itself carries enough list context to reconstruct it, otherwise the hook's own no-context bypass correctly hides the controls (`project-context.md`'s explicit "may be bypassed if accessed via a direct deep-link without prior list context" carve-out) — this is not a gap, it is the specified behavior.
- **Analytics (AD-5):** one new tracked event, `event_details_viewed`, payload `{ eventId: string, eventName: string }`, fired via `usePostHog()` (`@festgrid/analytics`) — no dedicated `trackEvent` wrapper exists yet in `@festgrid/analytics` beyond the re-exported `usePostHog`/`PostHogProvider`, so this story calls `.capture('event_details_viewed', payload)` directly, following AD-5's `noun_verb` naming convention; migrate this call site if/when a shared wrapper is introduced.
- **i18n (AD-6):** new message keys required in both `en.json`/`id.json` for this story's own route-level copy (Next/Previous labels, modal close label, not-found state) — distinct from `EventDetailView`'s internally-defaulted `labels` prop, which this story must still populate with translated strings at each call site rather than leaving as English defaults.

### File Structure Requirements

- `apps/backend/src/schema/events.graphql` — UPDATE: add `slug: String!`, `sourcePostUrl: String`, `originalPostUrl: String` to `Event`; add `eventBySlug(slug: String!): Event` to `Query`.
- `apps/backend/src/schema/resolvers.ts` — UPDATE: add `Query.eventBySlug`; add `Event.sourcePostUrl`/`Event.originalPostUrl` field resolvers (join `posts` via `events.postId`, reusing Story 1.3a's `imageUrl` join if already implemented).
- `apps/backend/src/server.ts`, `apps/backend/codegen.ts` — UPDATE: merge/glob all `src/schema/*.graphql` files instead of only `typeDefs.graphql` (Task 1's wiring fix).
- `apps/backend/src/schema/resolvers.test.ts` — UPDATE: integration tests for `eventBySlug`.
- `apps/web/src/**/eventBySlug.graphql` (new operation document, exact path at dev's discretion, co-located with the routes that consume it) — NEW.
- `apps/web/src/generated/graphql.ts` — regenerated (not hand-edited).
- `apps/web/src/app/[locale]/layout.tsx` — UPDATE: accept/render `modal` slot.
- `apps/web/src/app/[locale]/@modal/default.tsx` — NEW.
- `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` — NEW (modal route, Server Component holding `generateMetadata`, AC12).
- `apps/web/src/app/[locale]/@modal/(.)events/[slug]/event-detail-modal-content.tsx` — NEW (`"use client"`, extracted fetch/render logic, AC12).
- `apps/web/src/app/[locale]/events/[slug]/page.tsx` — NEW (full-page route, Server Component holding `generateMetadata`, AC12).
- `apps/web/src/app/[locale]/events/[slug]/event-detail-content.tsx` — NEW (`"use client"`, extracted fetch/render logic, AC12).
- A shared `Event` (GraphQL) → `EventDetailViewProps` mapping util, imported by both routes — NEW, exact location at dev's discretion (e.g. co-located under `apps/web/src/features/events/`).
- `apps/web/src/app/[locale]/page.tsx` — UPDATE: wire `EventCard`'s `onClick` to `router.push`, coordinating with Story 1.3's grid-rendering scope on the same file.
- `apps/web/locales/en.json`, `apps/web/locales/id.json` — UPDATE: new `EventDetailsPage.*` keys.
- `apps/web/e2e/event-details.spec.ts` — NEW.
- **Consumed, not modified by this story:** `EventDetailView` (`packages/ui`, Story 1.6a), the context-aware list navigation hook (`packages/ui`, Story 1.6b), `EventCard` (`packages/ui`, Story 1.3b — only its existing `onClick` prop is used).

### Project Context Reference

- **API Style (GraphQL):** All client-server data fetching must use GraphQL — no direct DB/domain import from `apps/web`.
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **Database Access:** Handled exclusively through Drizzle ORM (`eq(events.slug, slug)`, mirroring `event(id)`'s `eq(events.id, id)`).
- **Code Organization:** Reusable UI (`EventDetailView`) and reusable mechanism (1.6b's hook) live in `packages/ui`; this story's own routing/fetch/mapping glue is page-local `apps/web` code, not a candidate for `packages/domain` or `packages/ui`.

## Global Rules References

- [x] `_bmad-output/project-context.md` — API/Data (GraphQL-only), State Management, UI Patterns & UX Invariants (loaders, Context-Aware Detail Views), i18n rules, Analytics.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-1, AD-2 (single-item vs. collection scoping), AD-4, AD-5, AD-6.
- [x] `docs/infrastructure/1-frontend.md` — reviewed; no infra/deployment changes in this story beyond application code.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- UPDATE `apps/backend/src/schema/events.graphql`: add `slug: String!`, `sourcePostUrl: String`, `originalPostUrl: String` to `Event`; add `eventBySlug(slug: String!): Event` to `Query`.
- UPDATE `apps/backend/src/schema/resolvers.ts`: add `Query.eventBySlug`; add `Event.sourcePostUrl`/`Event.originalPostUrl` field resolvers.
- UPDATE `apps/backend/src/server.ts`, `apps/backend/codegen.ts`: merge/glob all schema files under `src/schema/` (fixes the pre-existing orphaned-`events.graphql` gap found during this story's creation).
- UPDATE `apps/backend/src/schema/resolvers.test.ts`: `eventBySlug` integration tests.
- NEW `apps/web/**/eventBySlug.graphql`: operation document for codegen.
- NEW `apps/web/src/app/[locale]/@modal/default.tsx`, `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx`, `apps/web/src/app/[locale]/events/[slug]/page.tsx`.
- NEW shared `Event` → `EventDetailViewProps` mapper, consumed by both routes.
- UPDATE `apps/web/src/app/[locale]/layout.tsx`: accept/render `modal` slot.
- UPDATE `apps/web/src/app/[locale]/page.tsx`: `EventCard` `onClick` → `router.push('/events/' + slug)`.
- UPDATE `apps/web/locales/en.json`, `apps/web/locales/id.json`: `EventDetailsPage.*` keys.
- NEW `apps/web/e2e/event-details.spec.ts`.
- **Consumed, not modified:** `EventDetailView` (1.6a), context-aware list navigation hook (1.6b), `EventCard` (1.3b).

### Rule Mapping

- GraphQL-only data access, single-item vs. collection (AC4, AD-1/AD-2) → new non-DSL `eventBySlug` query, mirroring `event(id)`'s existing pattern.
- Loader semantics (AC3, `project-context.md` UI Patterns) → `EventDetailView`'s own `loading` skeleton, never a blocking overlay.
- i18n-first (AC8, AD-6) → route-level copy sourced via `useTranslations`; `EventDetailView`'s `labels` prop populated with translated strings at each call site.
- Analytics (AC9, AD-5) → `event_details_viewed` fired once per successful open, `noun_verb` naming.
- Reuse boundaries (AC3, AC5) → `EventDetailView` (1.6a) and the context-aware navigation hook (1.6b) are consumed, not reimplemented inline.
- Interception correctness (AC1, AC7) → `onClick`/`router.push` instead of `EventCard`'s `href`, and `@modal`/`(.)events/[slug]` parallel+intercepting route structure.
- Dynamic page title & meta tags (AC12, `project-context.md`) → both routes split into Server Component `page.tsx` (`generateMetadata` + `buildPageMetadata`, Story 1.9's helper) + colocated `"use client"` content file, per Story 1.9's established convention.

### Verification Plan

- Integration tests: `eventBySlug` returns the correct event by slug, returns `null` for an unknown slug, and only selects GraphQL-requested fields.
- E2E: clicking an `EventCard` on the discovery grid opens the modal and updates the URL to `/events/[slug]` (AC1, AC7).
- E2E: a direct navigation to `/events/[slug]` renders the full page with no Next/Previous controls shown (no list context) (AC2, AC5).
- Manual/automated check: refreshing the browser while the modal is open still resolves to the full-page route (proves interception is client-nav-only, not a workaround).
- `pnpm --filter backend test`, `pnpm --filter backend lint`, `pnpm --filter web lint`, `pnpm --filter web build` (type-check), `pnpm --filter web test`, `pnpm --filter web test:e2e` all clean.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: GraphQL by-slug query + resolver wiring fix (`apps/backend`), routing/fetch/mapping/click-wiring/analytics/i18n glue (`apps/web`); no changes to `EventDetailView`'s internals (Story 1.6a's scope) and no changes to the context-aware navigation hook's internals (Story 1.6b's scope) — this story only consumes both.
- [ ] **Prerequisite split accepted:** Story `1-6b-build-the-context-aware-list-navigation-hook` was newly created by this story's Gate 2 finding (`backlog` in `sprint-status.yaml`, full section in `epics.md`) and does not yet exist as an implemented hook. Confirm it will be implemented before/alongside this story's Task 10, or explicitly accept temporarily hand-rolling the Next/Previous logic inline pending 1.6b (not recommended — Epic 2's Story 2.2/2.6 would then re-diverge from a shared implementation, the same risk Story 1.3's Pre-Coding Gate flagged for `useInfiniteScroll`).
- [ ] **Hard dependency sequencing accepted:** Story `1-6a-build-the-reusable-event-detail-view-component` is `ready-for-dev` but not yet implemented (`packages/ui/src/features/events/` currently only has `EventCard.*`). Confirm it lands first, or explicitly accept starting this story's routing/fetch scaffolding against a stub/mock of `EventDetailView` now.
- [ ] **Backend schema-wiring fix accepted:** `events.graphql` is confirmed not currently merged into the runtime schema/codegen input (Task 1) — this is a pre-existing completeness gap in Story 1.3a's own scope, being fixed here because this story's `eventBySlug` query depends on it. Confirm this is acceptable to fix within this story rather than blocking on a separate 1.3a follow-up.
- [ ] **Dynamic page title & meta tags (2026-08-01 rule) acknowledged:** both routes are now scoped to Story 1.9's `page.tsx` (Server Component + `generateMetadata`) / colocated client-content-file split (AC12, Tasks 7/7a/8/8a) — confirm this additional split is acceptable within this story's scope rather than a follow-up story, given the helper/convention already exist and only the split itself is new work here.
- [ ] **Source-post-link requirement reinstated (2026-08-01 correction) acknowledged:** the previous draft's ungrounded "proxy-platform post URL"/missing-storage claims were corrected via `bmad-correct-course`, not simply dropped — AC11 now requires `originalPostUrl`/`postUrl` attribution links, grounded in PRD §3.3.3/§3.7/§4.7. Confirm Story 1.2a's AC7/Task 13 (`posts.original_post_url` migration) lands before/alongside this story, or explicitly accept temporarily shipping with `originalPostUrl` always `null` (the column would simply not exist yet).
- [ ] Architecture and API/data boundaries confirmed (GraphQL-only, non-DSL single-item query; AD-1/AD-2/AD-4/AD-5/AD-6).
- [ ] Testing plan reviewed (backend integration tests + Playwright E2E for modal-open and deep-link-fallback).
- [ ] Human approval to start coding granted (pending)

## Testing Requirements

- [ ] Backend integration tests (`apps/backend/src/schema/resolvers.test.ts`) for `eventBySlug`: found-by-slug, not-found (`null`), field-selection compatibility with `buildOptimizedDrizzleSelect`.
- [ ] **(Amendment)** Backend integration test: `Event.sourcePostUrl`/`Event.originalPostUrl` resolve correctly from the joined `posts` row (including the case where `originalPostUrl` is `null`).
- [ ] E2E (`apps/web/e2e/event-details.spec.ts`, Playwright): card-click opens modal + URL update (AC1/AC7); direct `/events/[slug]` navigation renders full page with no list-context Next/Previous (AC2/AC5).
- [ ] Integration test: both routes' `generateMetadata` resolves an event-specific title/description (distinct from the Discovery page's default) for both `en`/`id` locales (AC12), mirroring Story 1.9's `metadata.test.ts`/root-layout `generateMetadata` test pattern.
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only; this story introduces no `packages/domain` logic.
- [ ] Use `@festgrid/testing-config` conventions already established by sibling stories (Story 0.10) — no ad hoc test setup.

## Deliverables Checklist

- [ ] `slug` field and `eventBySlug` query added to the GraphQL schema and resolver, reachable at runtime (schema-wiring fix applied).
- [ ] Full-page route (`/events/[slug]`) and intercepted modal route (`@modal/(.)events/[slug]`) both rendering `EventDetailView` with identical mapped data/loading/error handling.
- [ ] `EventCard` click wiring on the discovery grid uses `onClick`/`router.push`, preserving list context on the outbound URL.
- [ ] Next/Previous navigation wired via Story 1.6b's hook, with correct route-dependent context availability (modal: live cache; full page: URL-only, else hidden).
- [ ] `event_details_viewed` PostHog event firing once per successful open.
- [ ] `en`/`id` message keys added for all new page-level copy; `EventDetailView`'s `labels` prop populated with translated strings.
- [ ] Backend integration tests and Playwright E2E tests written and passing.
- [ ] **(Amendment)** `Event.sourcePostUrl`/`Event.originalPostUrl` resolvers implemented and wired into `EventDetailView`'s attribution-link props.
- [ ] **(Amendment, 2026-08-01)** Both the full-page route and the intercepted modal route export `generateMetadata` (via `buildPageMetadata`/next-intl `getTranslations()`) with an event-specific title/description, per the `page.tsx` + colocated client-content-file split (AC12).

## Out of Scope

- `EventDetailView`'s own rendering/props/states — Story 1.6a.
- The context-aware list navigation hook's internal implementation — Story 1.6b.
- `EventCard`'s internals — Story 1.3b; this story only consumes its existing `onClick` prop.
- Editing/correcting event data — Epic 4.
- Favoriting and add-to-calendar mutation logic — Epic 2 (Story 2.1/2.1a and a future calendar story); `EventDetailView`'s reserved slots stay unwired here, consistent with 1.6a's own Out of Scope.
- Deriving/populating `Post.originalPostUrl` at scrape time (the actual imginn.com-to-Instagram URL derivation logic) — Story 3.4's scope (not yet detailed), not this story's. This story only reads and displays whatever is already stored.
- The `posts.original_post_url` migration itself — Story 1.2a's AC7/Task 13, not this story's.

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC12) are met.
- [ ] Required backend integration tests and E2E tests (see Testing Requirements) are written and passing.
- [ ] Lint and TypeScript strict-mode/build checks pass for `apps/backend` and `apps/web`.
- [ ] `en`/`id` locale files updated with all new message keys (AD-6).
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
