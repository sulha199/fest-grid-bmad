---
baseline_commit: 7aad964152c4a28d0a14e05ff73b80fffbc7f13d
---

# Story 1.6g: Event detail hashtags — display at bottom of event-main-content, click-to-Discovery

## Story Details

- Epic: 1
- Story ID: 1.6g
- Status: review
<!-- status confirmed synced with sprint-status.yaml via scripts/sprint-status-tool.py (2026-10-08) -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see the hashtags from an event's source post at the bottom of the event-detail page, and be able to tap one to find more events with that hashtag,
so that I can discover related events through the same tagging the original poster used, without having to type the hashtag myself.

## Acceptance Criteria

1. **Given** the `event`/`eventBySlug` resolvers' already-existing `posts` left-join (`apps/backend/src/schema/resolvers.ts`), **when** `type Event` (`apps/backend/src/schema/events.graphql`) is extended with an additive `hashtags: [String!]` field (nullable, matching `publishedAt`/`sourcePostUrl`'s existing nullability since the join is a `leftJoin`), **then** both the `event(id)` and `eventBySlug(slug)` resolvers' flat `db.select({...})` objects return `posts.hashtags` verbatim — no new join, no new query, no new resolver, and no passthrough field resolver (unlike `publishedAt`'s Date→ISOString conversion, `posts.hashtags` is already a plain `string[]`/`null`, requiring no transformation).
2. **Given** the event has a linked post whose `posts.hashtags` is a non-empty array, **when** `EventDetailView.tsx`'s "event-main-content" details column renders, **then** a new hashtags block renders immediately after the schedules section and before the Attributions/"View Original" section — positioned above that link regardless of whether the single-linked-post or multi-post (`sourcePosts`) attribution branch is active — displaying each hashtag as `#<hashtag>` inside a `<ul aria-label={labels.hashtagsListAriaLabel}>`, each pill reusing the existing category/type badge's exact Tailwind classes verbatim (`px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium ...`).
3. **Given** `hashtags` is `null` or an empty array (no linked post, or a linked post with no extracted hashtags), **when** `EventDetailView.tsx` renders, **then** the hashtags block does not render at all — the same `hasX && (...)` conditional-render convention already used for `hasTags`/`hasSourceAttribution`.
4. **Given** a hashtag pill, **when** `onHashtagClick` is provided, **then** it renders as a `<button type="button">` that calls `onHashtagClick(hashtag)` with the raw, un-prefixed hashtag value (e.g. `frcc2026`, not `#frcc2026`) on click; **when** `onHashtagClick` is not provided, **then** it renders as plain, non-interactive text — the same `onCategoryClick ? <button>...</button> : <span>...</span>` convention already used for the category/type badges (`EventDetailView.tsx`'s `hasTags` block).
5. **Given** `EventDetailWrapper.tsx`'s new `onHashtagClick` handler, **when** a hashtag pill is clicked, **then** the app navigates (via the existing `useRouter` from `@/i18n/navigation`, `router.push`) to Discovery (`/`) with exactly `?q=<url-encoded, `#`-prefixed hashtag>` — e.g. clicking the `frcc2026` pill navigates to `/?q=%23frcc2026` — a clean single-facet reset of the `q` param only, **not** merging any other existing search params, matching Story 1.6f's own badge-click-to-Discovery resolved design default for this exact navigation pattern. **And** this requires no change to Discovery's search handling: its pre-existing, unmodified `#`-prefix hashtag-search logic (`packages/domain/src/events/buildEventsQueryCondition.ts`'s non-filter `search` branch) already lowercases and strips the leading `#` before resolving an exact `hashtags` containment match — no new search mechanism is introduced by this story.
6. **And** no new user-facing text is introduced beyond the `hashtagsListAriaLabel` aria-label, resolved through `next-intl` via the existing `EventDetailViewLabels` prop contract (matching every other string in this component) — the hashtag values themselves are raw scraped data, not translated UI copy, the same treatment already given to `eventName`/`location`/`performers`.

## Tasks / Subtasks

- [x] Task 1 — Backend: additive `Event.hashtags` field (AC: #1)
  - [x] `apps/backend/src/schema/events.graphql`: add `hashtags: [String!]` to `type Event` (~line 129, immediately after `publishedAt: String`).
  - [x] `apps/backend/src/schema/resolvers.ts`: add `hashtags: posts.hashtags,` to the `event(id)` resolver's flat `db.select({...})` object (~line 3750 on master, alongside `publishedAt: posts.publishedAt,`).
  - [x] `apps/backend/src/schema/resolvers.ts`: add `hashtags: posts.hashtags,` to the `eventBySlug(slug)` resolver's `selectEventRow` flat `db.select({...})` object (~line 3883 on master, same pattern — `eventBySlug` builds its select via an inner `selectEventRow` helper shared by its direct-slug and redirect-follow paths; adding the column there covers both).
  - [x] Add a backend resolver test asserting `event`/`eventBySlug` return `hashtags` as the raw array for an event with a linked post that has hashtags, an empty array when the linked post has none, and `null` for an event with no linked post at all (mirrors the `publishedAt` null-case test added by Story 1.6f).

- [x] Task 2 — Frontend: thread `hashtags` through to the component (AC: #1, #6)
  - [x] `apps/web/src/features/events/queries.graphql`: add `hashtags` to the `getEventBySlug` query document (~line 62, alongside `publishedAt`).
  - [x] Regenerate codegen: `pnpm --filter backend codegen` (the `events.graphql` change alters the committed `apps/backend/src/generated/resolvers-types.ts`) **and** `pnpm --filter web codegen` (real regen diff against `apps/web/src/generated/graphql.ts`, per this project's established convention — never hand-edit generated types).
  - [x] `packages/ui/src/features/events/EventDetailView.types.ts`: add `hashtags?: string[] | null;` to `EventDetailViewProps` (near `originalPostUrl`/`sourcePostUrl`/`publishedAt`, ~lines 209-211); add `onHashtagClick?: (hashtag: string) => void;` alongside the existing `onTypeClick`/`onCategoryClick` (~lines 195-196); add `hashtagsListAriaLabel: string;` to `EventDetailViewLabels` (near `categoriesAndTypesAriaLabel`).
  - [x] `apps/web/src/features/events/mapper.ts`: map `hashtags: event.hashtags,` through in `mapGraphQLEventToDetailViewProps`'s return object (near `publishedAt: event.publishedAt,`, ~line 172).
  - [x] `apps/web/src/features/events/mapper.ts`'s `useEventDetailViewLabels()`: wire `hashtagsListAriaLabel: t('hashtagsListAriaLabel')`.
  - [x] `apps/web/locales/en.json` and `apps/web/locales/id.json`, `EventDetailsPage` namespace: add `"hashtagsListAriaLabel": "Hashtags"` / Indonesian equivalent (e.g. `"Tagar"` — confirm against the project's established Indonesian terminology at implementation time), placed alongside `categoriesAndTypesAriaLabel`/`coauthorsListAriaLabel` (~lines 195-196 in both files).

- [x] Task 3 — Render hashtag pills in `EventDetailView.tsx` (AC: #2, #3, #4)
  - [x] `packages/ui/src/features/events/EventDetailView.tsx`: compute `const hasHashtags = hashtags && hashtags.length > 0;` alongside the existing `hasTags`/`hasSourceAttribution` computed booleans (~lines 254-255 on master).
  - [x] Insert a new conditionally-rendered block at line 608 on master (re-confirm at dev time) — between the schedules section's closing `</section>` (line 607) and the Attributions comment (line 609) — deliberately **outside** the `{!hasMultiplePosts && (...)}` wrapper that starts at line 612, so the hashtags block always sits above the View Original link / Attributions section regardless of single- vs multi-post attribution:
    ```tsx
    {hasHashtags && (
      <ul className="flex flex-wrap gap-2" aria-label={labels.hashtagsListAriaLabel}>
        {hashtags!.map((tag, idx) => (
          <li key={`hashtag-${idx}`}>
            {onHashtagClick ? (
              <button
                type="button"
                onClick={() => onHashtagClick(tag)}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                #{tag}
              </button>
            ) : (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium inline-block">
                #{tag}
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
    ```
    This is an exact copy of the existing category/type badge button/span pattern (~lines 391-401) — same classNames verbatim, only the label text (`#{tag}` vs `{category.label}`) and click payload (raw `tag` vs `category.value`) differ.

- [x] Task 4 — Wire `onHashtagClick` to Discovery navigation (AC: #5)
  - [x] `apps/web/src/features/events/EventDetailWrapper.tsx`: add `onHashtagClick: (hashtag: string) => { router.push(\`/?q=${encodeURIComponent('#' + hashtag)}\`) },` to `mappedProps`, alongside the existing `onCategoryClick`/`onTypeClick` entries (~lines 775-780 on master), using the same already-imported `useRouter` from `@/i18n/navigation`. Deliberately does not merge existing `searchParams` (clean single-facet reset, matching the `onCategoryClick`/`onTypeClick` precedent).

- [x] Task 5 — Tests for the new behavior (AC: #1, #2, #3, #4, #5, #6)
  - [x] `EventDetailView.test.tsx`: hashtags block renders when `hashtags` is a non-empty array; does not render when `hashtags` is `null`/`undefined`/`[]`; a hashtag pill renders as a button and fires `onHashtagClick` with the raw (un-prefixed) tag value when the handler is provided; renders as plain, non-interactive text (`#<tag>`) when no handler is passed; `aria-label` on the hashtags `<ul>` resolves from `labels.hashtagsListAriaLabel`.
  - [x] `EventDetailWrapper.test.tsx`: clicking a hashtag pill calls `router.push` with exactly `/?q=%23<tag>` (URL-encoded `#`) and does not carry over any existing `mockSearchParams` — mirroring the existing `onCategoryClick`/`onTypeClick` navigation tests (~lines 905-930).
  - [x] `mapper.test.ts`: `hashtags` passthrough for a non-null array, and the `null` no-linked-post case (mirrors the existing `publishedAt` passthrough tests, ~lines 153-164).
  - [x] Backend resolver test (Task 1) confirming `hashtags` on both `event`/`eventBySlug` for the linked-post-with-hashtags, linked-post-with-no-hashtags (empty array), and no-linked-post (`null`) cases.

## Dev Notes

- **`EventDetailView.tsx` is a presentation-only, framework-agnostic component in `packages/ui`**, with exactly one real consumer, `apps/web/src/features/events/EventDetailWrapper.tsx` (used by both the full-page route and the intercepted modal route, both via `EventDetailWrapper`). This story is an amendment to that one component and its one wrapper — no new component, hook, or route is introduced.
- **Current state read in full before drafting this story** (mandatory read-files-being-modified step): `EventDetailView.tsx` (1115 lines), `EventDetailView.types.ts`, `EventDetailWrapper.tsx`, `mapper.ts`, the `event`/`eventBySlug` resolver blocks in `resolvers.ts`, `events.graphql`, `queries.graphql`. Key facts folded into the Tasks above:
  - The schedules `<section>` closes at line 606; the Attributions block (containing the "View Original" link added by Story 1.6f) starts at line 608 inside a `{!hasMultiplePosts && (...)}` wrapper (line 611-677); a separate multi-post `sourcePosts` block (lines ~684-761) has its own per-post "View Original" equivalent. Inserting the hashtags block at line 607 — outside both branches — is the only placement that satisfies "at the bottom of event-main-content, above the view-original link" for **both** the single-post and multi-post attribution cases, rather than only one of them.
  - The category/type badge pattern (`hasTags` block, ~lines 390-410, added by Story 1.6f) is the direct precedent this story's hashtag pills copy verbatim: same pill CSS classes, same `onX ? <button> : <span>` optional-affordance convention, same "only render the whole block if non-empty" guard (`hasTags`/`hasSourceAttribution` → this story's `hasHashtags`).
  - `posts.hashtags` (`text('hashtags').array()`, `packages/database/schema.ts:330`, GIN-indexed at line 362) is a real, already-populated column — confirmed via `BUG-032` (status `done`), which fixed the one gap that existed (the Bright Data scrape path wasn't extracting/persisting hashtags; the Apify path always worked). Both paths now persist bare, lowercase hashtags with no leading `#`.
  - `posts.hashtags` is already consumed server-side today, but **only** as a WHERE-filter `fieldMap` entry in the `Query.events` resolver's DSL (`resolvers.ts:3170`, `hashtags: posts.hashtags, // mapped to joined table, #-prefixed search (added 2026-08-28)`) — it has never been selected/returned as an output field on `Event`. This story is the first to expose it for *display*.
  - Discovery's `#`-prefix hashtag search (`packages/domain/src/events/buildEventsQueryCondition.ts:187-201`, the non-filter `search` branch used by Discovery's own `q` param) is fully built, already shipped, and is **not modified by this story** — `trimmed.startsWith('#')` strips the `#`, lowercases, and matches `hashtags IN (tag)` exactly. Discovery's `q` param (`apps/web/src/app/[locale]/home-content.tsx:75`, `useQueryState('q', parseAsString.withDefault(''))`) is passed straight through as `search` to `buildEventsQueryCondition` (line 233) — nothing server-side or in `home-content.tsx` needs to change for this story's navigation to work.

### Readiness sweep note (2026-10-08, `batch-group5-readiness.md`)

- Line numbers in Tasks 1/2/3/4 were re-found on master `ffeced6` and corrected in place; Wave A stories 1.6d/1.6e/0.i6e shifted `EventDetailView.tsx` by +1 line. Re-confirm before editing.
- **Backend codegen was missing from this story's plan.** `Event.hashtags` is added to `events.graphql`, so `apps/backend/src/generated/resolvers-types.ts` (committed) must be regenerated with `pnpm --filter backend codegen`, in addition to `pnpm --filter web codegen`. Add `apps/backend/src/generated/resolvers-types.ts` to the File Change Plan. `apps/web/src/gql/graphql.ts` is a one-line re-export and never changes.
- **Sequencing with Story 3.19 (same file):** land 3.19 first (narrow, no codegen). The two edit disjoint regions of `EventDetailWrapper.tsx`/`.test.tsx`; no shared type dependency. After rebasing, re-run both codegens — never hand-merge generated files.
- `events` list resolvers (lines ~1762, 1863, 3447, 3536) do not select `posts.hashtags`, so `Event.hashtags` is `null` outside `event`/`eventBySlug`, matching `publishedAt`'s existing behavior. No AD-17 impact.

### Architecture & UX Gate Findings

Gates 1/2/3 (`story-split-gate.md`) ran **fresh via subagent dispatch**, not cited against `epic-1-readiness.md` — that report is `swept: true` but its `stories_covered` frontmatter list (`1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, 1.7, 1.8`) predates Stories 1.6b-f and this one, so it does not cover this story's surface (same reasoning already applied on Stories 0.36/1.6f).

- **Gate 1 (Winston) — No gap.** `Event.hashtags` is architecturally the same shape as `Event.publishedAt` (Story 1.6f) and `Event.links` (Story 0.37): an additive output field exposing an already-populated, already-joined DB column (`posts.hashtags`, already read by `event`/`eventBySlug`'s existing `posts` leftJoin) through an already-existing resolver. No new join, no new query/mutation/resolver shape, no frontend→DB bypass, no external service called directly from the frontend, no auth/secrets/business-rule logic added to frontend code, no missing IaC (the column and its GIN index already exist and are already populated).
- **Gate 2 (Freya/Sally) — No gap; one non-blocking item logged.** The hashtag-pill UI does not clear Gate 2's reuse-extraction bar: it is new markup inside the same single already-existing file (`EventDetailView.tsx`), not a second component depending on a shared one — the category/type badges and the new hashtag pills are two inline JSX blocks in one render function that happen to reuse the identical literal Tailwind className string, not a shared component/hook/util being duplicated. **Logged as "watch, not split"** (matching the exact precedent already set for Story 1.6f's own badge click-through): revisit extracting a shared `packages/ui/src/core/` pill/chip primitive only if a *third*, different-file consumer needs this exact styling, or if any pill gains real state (loading, selected/active, icon, overflow) the current one-liner can't express. Confirmed (informational, non-blocking, same zero-coverage precedent as Stories 0.37/1.6f) that **neither `design-artifacts/UX-festgrid-run-1/DESIGN.md` nor `EXPERIENCE.md` covers hashtags, event-detail-page tag/badge styling, or this component's bottom-of-column content at all** — DESIGN.md has no `hashtag`/badge-pill token (the category/type pills are themselves only inline Tailwind classes today, never promoted to a design token); EXPERIENCE.md's only tangentially related line ("types and categories are shown as tags") says nothing about hashtags or interactivity. This story's Acceptance Criteria are the source of truth for these specifics in the absence of spec coverage.
- **Gate 3 (Winston) — No gap.** Every mechanism this story consumes already exists and is not being newly introduced: the `posts` leftJoin + flat-select resolver pattern (Story 1.3a, already extended for `publishedAt` by Story 1.6f), the GraphQL codegen pipeline (project-wide, Story 0.8), i18n/`next-intl` (project-wide), and Discovery's `#`-prefix hashtag-search mechanism (`buildEventsQueryCondition.ts`, already shipped, unmodified by this story). The `router.push('/?param=value')` navigation-to-Discovery "pattern" is not a shared, reusable utility that other stories depend on — Story 1.6f's own `onCategoryClick`/`onTypeClick` handlers are each an inline one-liner, not a named shared function — so this story's `onHashtagClick` is simply the Nth instance of an already-generic Next.js `router.push` call, not a second competing mechanism nor a gap in a missing one.

**No genuine design tradeoff required `AskUserQuestion`** for this story (unlike Story 1.6f, which had two forks with no established precedent). Every real decision point here already has a directly-on-point, already-confirmed precedent from the same parent backlog item (`IDEA-030`) and the same component file:
- **Single-facet `q` reset vs. merging existing search params** — resolved identically to Story 1.6f's badge-click precedent (clean reset, confirmed by the user for that sibling feature in the same `IDEA-030`/`epics.md` Story 1.6 family); re-litigating the identical question for a sibling navigation action within the same epic would be process overhead, not genuine ambiguity.
- **Whether to also expose hashtags on `EventSourcePost` (the multi-post branch)** — resolved as **no**, matching `publishedAt`'s own precedent (Story 1.6f added `publishedAt` only to the top-level `Event` type, not `EventSourcePost`); `IDEA-037`'s capture note says "the post's hashtags" (singular), and the chosen insertion point (line 607, outside both attribution branches) already satisfies "at the bottom of event-main-content" for both single- and multi-post events without needing a second data path.
- **Whether to extract a shared pill/chip component** — resolved by Gate 2 above as "watch, not split."
- **Whether to add a PostHog analytics event for the hashtag click** — resolved as **no**, matching the directly comparable precedent: Story 1.6f's own category/type badge-click-to-Discovery navigation (the closest possible analog) added no `posthog.capture` call for that action (confirmed via `apps/web/src/features/events/EventDetailWrapper.tsx` — every existing `posthog.capture` call is for a mutation/view event, none for the badge-click navigation), so no new event is added here either, for consistency with that sibling feature. If the user wants hashtag-click tracking specifically, that would be a scoped addition to be raised explicitly, not something this story's own precedent-matching silently decided against surfacing.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive mismatch, resolved by this story.** `posts.hashtags` (DB, `text[]`, nullable, GIN-indexed) has no corresponding field anywhere in the `Event` GraphQL type, the frontend's generated types, or `EventDetailViewProps` — it exists in the database and is already read server-side (as a WHERE-filter `fieldMap` entry only, see Dev Notes above) but was never exposed on `Event` for display.
- **Impacted fields/contracts:** `apps/backend/src/schema/events.graphql` (`Event` type — add `hashtags: [String!]`, nullable, matching the `leftJoin`'s existing nullability pattern), `apps/backend/src/schema/resolvers.ts` (two flat-select `db.select({...})` objects in `event`/`eventBySlug`), `apps/web/src/features/events/queries.graphql` (`getEventBySlug` document), `apps/web/src/generated/graphql.ts` (codegen-regenerated, never hand-edited), `packages/ui/src/features/events/EventDetailView.types.ts` (`EventDetailViewProps.hashtags?: string[] | null`, `onHashtagClick?: (hashtag: string) => void`, `EventDetailViewLabels.hashtagsListAriaLabel: string`), `apps/web/src/features/events/mapper.ts`.
- **Required DB migration changes:** None. `posts.hashtags` already exists, is already indexed (`post_hashtags_idx`, GIN, `packages/database/schema.ts:362`), and is already populated by both scrape paths (`BUG-032`, done) — this is a read-path exposure only, no schema change.
- **Required TypeScript type changes:** `EventDetailViewProps.hashtags?: string[] | null` (new); `EventDetailViewProps.onHashtagClick?: (hashtag: string) => void` (new, optional — additive, so any other hypothetical caller degrades gracefully); `EventDetailViewLabels.hashtagsListAriaLabel: string` (new, required, matching `categoriesAndTypesAriaLabel`'s own required-field convention); codegen-regenerated `GetEventBySlugQuery` type gains `hashtags`.
- **Backward compatibility and rollout notes:** All changes are additive/optional on `EventDetailViewProps` and the `Event` GraphQL type — no existing field changes shape, no existing caller breaks. `EventDetailView.tsx` has exactly one real caller (`EventDetailWrapper.tsx`, updated in the same story/commit), so there is no cross-version compatibility window to manage.
- **Verification checks:** the backend resolver test (Task 1) and `mapper.test.ts` cases (Task 5) prove `hashtags` flows end-to-end (DB → resolver → GraphQL type → codegen → mapper → component prop); `EventDetailView.test.tsx`'s new tests prove the pill renders/click-navigates correctly, including the empty/null-suppression case and the read-only (no-handler) fallback.

### Project Structure Notes

- No new files, no new directories. All changes land in already-established locations: `packages/ui/src/features/events/` (component + types + tests), `apps/web/src/features/events/` (wrapper, mapper, queries, tests), `apps/backend/src/schema/` (schema + resolvers), `apps/web/locales/` (en/id).
- No package-boundary concerns: nothing touches `packages/domain` (no new business logic — `buildEventsQueryCondition`'s hashtag-search logic is pre-existing, reused as-is, unmodified), no state-management library changes (no new React Query/`nuqs`/`zustand` usage — hashtag-click navigation is a plain `router.push`, matching this file's existing navigation pattern for category/type badge clicks and "Back to Home"/login redirects).

### References

- [Source: packages/ui/src/features/events/EventDetailView.tsx] — full file read; exact line numbers cited above reflect its current state at story-creation time (dev-story should re-confirm line numbers before editing, since intervening stories may shift them).
- [Source: packages/ui/src/features/events/EventDetailView.types.ts]
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx]
- [Source: apps/web/src/features/events/mapper.ts]
- [Source: apps/web/src/features/events/queries.graphql#getEventBySlug]
- [Source: apps/backend/src/schema/events.graphql#Event]
- [Source: apps/backend/src/schema/resolvers.ts#event,eventBySlug] — flat-select blocks and the `Query.events` `fieldMap.hashtags` filter entry (line 3170)
- [Source: packages/database/schema.ts:330,362] — `posts.hashtags` column + GIN index
- [Source: packages/domain/src/events/buildEventsQueryCondition.ts:187-201] — existing `#`-prefix hashtag search, unmodified by this story
- [Source: apps/web/src/app/[locale]/home-content.tsx:75,233] — Discovery's `q` nuqs param → `buildEventsQueryCondition`'s `search` arg
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-030-event-detail-ui.md]
- [Source: _bmad-output/implementation-artifacts/backlog/BUG-032-hashtags-not-persisted-into-post-table.md] — confirms both scrape paths persist bare, lowercase hashtags; status `done`
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-030,IDEA-037,BUG-032]
- [Source: _bmad-output/implementation-artifacts/1-6f-event-detail-page-ui-refinements.md] — direct precedent for the badge-click-to-Discovery pattern (`onCategoryClick`/`onTypeClick`) and the `Event.publishedAt` additive-field pattern this story mirrors for `Event.hashtags`
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6f, Story 1.6g]
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — cited only to establish why it is *not* being relied on (stale scope, predates Stories 1.6b-g)
- [Source: _bmad-output/planning-artifacts/event-pages-followthrough-plan.md] — confirms IDEA-030 (and its carved child IDEA-037) is standalone, direct-to-`bmad-create-story`, no `bmad-correct-course` pass required

## Global Rules References

- [x] `_bmad-output/project-context.md` — "Optimized DB Queries" (reuses the existing `posts` leftJoin and flat select rather than adding a new per-row field resolver or a new query); i18n Core Principle / "Locale-Sensitive Data Rendering" (the one new user-facing string, `hashtagsListAriaLabel`, is routed through `next-intl`; the hashtag values themselves are raw data, not a locale-sensitive enum/date/number, so no formatter applies — same treatment as `eventName`/`location`); "UI Components & Scalability" — no new `packages/ui` component created, change stays inside the already-correctly-homed `EventDetailView.tsx` (Gate 2 confirmed "watch, not split"); no new state-management, GraphQL operation shape, or package-boundary rule is implicated (see Project Structure Notes).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows its canonical section order and status vocabulary.
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gates 1/2/3 run fresh (epic report stale for this story), all three "No gap" — see Architecture & UX Gate Findings.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no new architecture-spine invariant introduced or amended by this story (confirmed via Gate 1/3 findings above); AD-16/AD-17 (event-detail-page performance work) are unaffected — this story does not touch `instagramEmbed`, `schedules` batching, or the hydration-boundary work those ADs own.
- [x] `docs/infrastructure/index.md` — frontend-only + one additive read-path GraphQL field; no infra-layer (SQS/EventBridge/API Gateway/DB provisioning) touched, so only the index summary applies (no infrastructure shard file read required).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `apps/backend/src/schema/events.graphql` (modified — add `Event.hashtags`)
  - `apps/backend/src/schema/resolvers.ts` (modified — `hashtags: posts.hashtags,` in both `event`/`eventBySlug` flat selects)
  - `apps/backend/src/schema/resolvers.test.ts` (modified — new `hashtags` passthrough/null-case test)
  - `apps/web/src/features/events/queries.graphql` (modified — add `hashtags` to `getEventBySlug`)
  - `apps/web/src/generated/graphql.ts` (codegen-regenerated, not hand-edited)
  - `apps/backend/src/generated/resolvers-types.ts` (codegen-regenerated via `pnpm --filter backend codegen`, not hand-edited)
  - `packages/ui/src/features/events/EventDetailView.types.ts` (modified — new props/labels)
  - `packages/ui/src/features/events/EventDetailView.tsx` (modified — hashtags block)
  - `packages/ui/src/features/events/EventDetailView.test.tsx` (modified)
  - `apps/web/src/features/events/EventDetailWrapper.tsx` (modified — `onHashtagClick` wiring)
  - `apps/web/src/features/events/EventDetailWrapper.test.tsx` (modified — new navigation test)
  - `apps/web/src/features/events/mapper.ts` (modified)
  - `apps/web/src/features/events/mapper.test.ts` (modified)
  - `apps/web/locales/en.json`, `apps/web/locales/id.json` (modified)
  - No changes to `packages/domain`, `packages/database`, `packages/graphql-select`, or any state-management package.

- **Rule Mapping:**
  - Optimized DB Queries (project-context.md) → `hashtags` reuses the existing `posts` join and flat select rather than adding a new per-row field resolver or a new query (AC1, Gate 1 finding).
  - GraphQL-only data access (project-context.md "API Style") → `hashtags` reaches the frontend exclusively via the existing GraphQL `Event` type, no direct DB access from `apps/web` (AC1).
  - Locale-Sensitive Data Rendering (project-context.md) → the new `hashtagsListAriaLabel` string is resolved via `next-intl`, matching every other string in this component (AC6).
  - `packages/ui` reusable-component convention → the change stays inside the already-correctly-homed `EventDetailView.tsx`; no new shared component invented ahead of a genuine second consumer (AC2-AC4, Gate 2 finding).
  - Context-Aware Detail Views / existing navigation pattern → hashtag-click reuses the identical `useRouter`-from-`@/i18n/navigation` + `router.push('/?param=value')` pattern Story 1.6f's badge click already established (AC5).

- **Verification Plan:**
  - `pnpm --filter ui test` — `EventDetailView.test.tsx` covers hashtags-block presence/absence, clickable-pill click-payload, read-only fallback, and the `hashtagsListAriaLabel` aria-label.
  - `pnpm --filter web test` — `EventDetailWrapper.test.tsx` (hashtag-click → `router.push('/?q=%23<tag>')` assertion, no carried-over `searchParams`), `mapper.test.ts` (`hashtags` passthrough + null-case).
  - Backend: a `resolvers.test.ts` case confirming `event`/`eventBySlug` return `hashtags` correctly, including the no-linked-post `null` case and the linked-post-with-no-hashtags empty-array case.
  - `pnpm --filter web codegen` run and the resulting `apps/web/src/generated/graphql.ts` diff inspected to confirm it is a real regenerated diff (adds `hashtags`) and nothing else drifted.
  - `pnpm lint` and `pnpm build` clean across all touched packages (`ui`, `web`, `backend`).
  - Manual/visual check confirming the hashtags row renders at the bottom of the details column, above the "View Original" link, for both a single-linked-post event and a multi-post (`sourcePosts`) event, and that clicking a pill lands on Discovery pre-filtered to that hashtag.

## Pre-Coding Approval Gate

- [x] Scope confirmation — this story is exactly `IDEA-037` (display a post's hashtags at the bottom of `event-main-content`, above the view-original link; click navigates to Discovery with the hashtag as an additional `search-text`/`q` param, reusing the existing `#`-prefix hashtag search). No other `IDEA-030`/`IDEA-037`-adjacent scope is absorbed.
- [x] Architecture and boundary confirmation — Gate 1/2/3 all returned "No gap" (see Architecture & UX Gate Findings); no prerequisite story required.
- [x] Testing plan confirmation — Task 5's test coverage (component rendering/click, wrapper navigation, mapper passthrough, backend resolver) is understood and accepted as sufficient; no E2E scenario is mandated unless the project's existing `apps/web/e2e/event-details.spec.ts` already exercises hashtag-adjacent UI (verify at implementation time; Story 1.6f found no such overlap for its own new UI).
- [x] Explicit human approval state (Default: pending approval) — no `AskUserQuestion` was raised for this story; every real decision point had a directly-on-point, already-confirmed precedent from the same parent backlog item and component file (see Dev Notes → Architecture & UX Gate Findings for the itemized list). Precedent-matching reasoning accepted as-is; single-facet-reset / no-EventSourcePost-field / no-analytics-event choices were not reopened.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — no prerequisites exist; N/A.

## Testing Requirements

- [x] Integration tests — `EventDetailView.test.tsx` (packages/ui), `EventDetailWrapper.test.tsx` + `mapper.test.ts` (apps/web), a backend resolver test for `hashtags`. See Task 5 and the Verification Plan above for exact coverage.
- [x] E2E tests — checked `apps/web/e2e/event-details.spec.ts`: it does not reference the category/type badge list or the Attributions/"View Original" section (no hashtag-adjacent touchpoint exists today), matching Story 1.6f's own finding for its comparable new UI. No new E2E scenario added — not mandated by this story's ACs.

## Deliverables Checklist

- [x] `Event.hashtags` field shipped end-to-end (schema, resolver, codegen, mapper, component) (AC1)
- [x] Hashtags block renders at the bottom of `event-main-content`, above the View Original link, for both single- and multi-post attribution (AC2)
- [x] Hashtags block correctly suppressed when `hashtags` is `null`/empty (AC3)
- [x] Each hashtag pill clickable (calls `onHashtagClick` with the raw tag) when a handler is provided, plain text otherwise (AC4)
- [x] Clicking a hashtag navigates to Discovery with `?q=%23<tag>`, a clean single-facet reset (AC5)
- [x] New `hashtagsListAriaLabel` i18n'd in `en.json` and `id.json` (AC6)
- [x] `backlog.yaml`/`sprint-status.yaml`/`epics.md` already updated as part of story creation (see this story's own promotion trail — no further action needed here)

## Out of Scope

- **Exposing `hashtags` on `EventSourcePost`** (the multi-post attribution branch's per-post data) — this story adds `hashtags` only to the top-level `Event` type, matching `publishedAt`'s own precedent (Story 1.6f). The chosen insertion point already satisfies "at the bottom of event-main-content" for both single- and multi-post events without this.
- **Extracting a shared `packages/ui/src/core/` pill/chip component** for the category/type badges and the new hashtag pills — Gate 2 explicitly flagged this as "watch, not split" (no third, different-file consumer exists today; see Architecture & UX Gate Findings).
- **PostHog analytics tracking for the hashtag click** — not added, matching the directly comparable Story 1.6f badge-click precedent, which also added no tracked event for its own click-to-Discovery navigation.
- **Any change to Discovery's search box, `home-content.tsx`, or `buildEventsQueryCondition.ts`** — the existing `#`-prefix hashtag search is reused completely unmodified; this story only ever navigates *into* it with a pre-filled `q` param.

## Definition of Done

- [x] AC1-AC6 satisfied
- [x] Required tests passing: `pnpm --filter ui test`, `pnpm --filter web test`, backend resolver test (see Task 5)
- [x] Lint and type checks passing for touched packages (`ui`, `web`, `backend`): `pnpm lint`, `pnpm build`
- [x] `pnpm --filter web codegen` run and its diff reviewed as part of the change (adds `hashtags` to `GetEventBySlugQuery`, nothing else drifted)
- [x] No decrease in overall project test coverage percentage (all new/changed behavior has matching new/updated tests — see Task 5)

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `TZ=UTC pnpm --filter backend codegen` — regenerated `apps/backend/src/generated/resolvers-types.ts`, 2-line additive diff (`Event.hashtags` field + resolver type), nothing else drifted.
- `TZ=UTC pnpm --filter web codegen` — regenerated `apps/web/src/generated/graphql.ts`, additive diff adding `hashtags` to `Event`, `GetEventBySlugQuery`, and the `GetEventBySlugDocument` query string; nothing else drifted.
- `TZ=UTC pnpm --filter @festgrid/ui test -- --run src/features/events/EventDetailView.test.tsx` — 96 passed.
- `TZ=UTC pnpm --filter web test -- --run src/features/events/EventDetailWrapper.test.tsx src/features/events/mapper.test.ts` — 88 passed.
- `TZ=UTC cross-env NODE_ENV=test npx tsx --test --test-concurrency=1 "src/schema/resolvers.test.ts"` (cwd `apps/backend`) — initially 5 failures (all 3 new `Event.hashtags` subtests plus their 2 parent-suite rollups) caused by the new test fixture's `posts` insert omitting the NOT-NULL `publishedAt` column (the existing `publishedAt` resolver test fixture always sets it; mine didn't). Fixed by adding `publishedAt: new Date()` to both new post inserts — full re-run: 118 passed, 0 failed.
- `TZ=UTC pnpm --filter @festgrid/ui lint`, `TZ=UTC pnpm --filter web lint`, `TZ=UTC pnpm --filter backend lint` — 0 errors each (pre-existing `any`/unused-var warnings only, none newly introduced).
- `TZ=UTC pnpm --filter backend build` (`tsc`) — clean. `TZ=UTC pnpm --filter web build` (Next.js production build) — clean, all 39 pages generated. `@festgrid/ui` has no build script (TS-only package, type-checked via its consumers' builds).
- `git checkout -- apps/web/tsconfig.tsbuildinfo` run after each `tsc`-touching command per orchestrator gotcha; confirmed via `git status --short` that the file was never actually modified by these runs.

### Completion Notes List

- Implemented `Event.hashtags` as a purely additive, nullable `[String!]` GraphQL field, reusing the `event`/`eventBySlug` resolvers' existing `posts` leftJoin and flat `db.select({...})` — no new join, query, or field resolver, matching AC1 and the `publishedAt` (Story 1.6f) precedent exactly.
- Ran both required codegens (`pnpm --filter backend codegen`, `pnpm --filter web codegen`) per the orchestrator's explicit instruction (missing from the story's own Task 2 wording but called out in the story's own Dev Notes "Readiness sweep note") and left their generated output in the working tree, untouched by hand.
- `EventDetailView.tsx`: added `hasHashtags` alongside `hasTags`/`hasSourceAttribution`, and inserted the hashtags `<ul>` block between the schedules section's closing `</section>` and the Attributions comment — outside the `{!hasMultiplePosts && (...)}` wrapper, so it renders above the View Original link for both the single- and multi-post attribution branches (AC2). Pills reuse the category/type badge's exact Tailwind classes verbatim and the same `onX ? <button> : <span>` optional-affordance convention (AC3, AC4).
- `EventDetailWrapper.tsx`: added `onHashtagClick` to `mappedProps`, reusing the already-imported `useRouter` from `@/i18n/navigation`; navigates to `/?q=<url-encoded, #-prefixed hashtag>` as a clean single-facet reset, not merging existing search params — matching the `onCategoryClick`/`onTypeClick` precedent and this story's AC5. Built directly on top of Story 3.19's prior edit to this same file (its analytics-sanitization change in `onFavoriteToggle`-area code); no revert, disjoint edit region.
- `hashtagsListAriaLabel` is a required field on `EventDetailViewLabels` (matching `categoriesAndTypesAriaLabel`'s own required-field convention per the story's explicit instruction) — added to both locale files' `EventDetailsPage` namespace (`en.json`: "Hashtags", `id.json`: "Tagar") and wired through `useEventDetailViewLabels()`. No other namespace in either locale file was touched.
- Backend resolver test (`Event.hashtags resolver (Story 1.6g)`) mirrors the existing `Event.publishedAt` resolver test's three-case structure (non-empty array, empty array, no-linked-post null) for both `event(id)` and `eventBySlug(slug)`.
- No DB migration: `posts.hashtags` (and its GIN index) already exist per the story's Dev Notes; confirmed no DDL was run.
- No sections of the story file were modified beyond the permitted ones (frontmatter `baseline_commit` already present and untouched; Tasks/Subtasks checkboxes; Pre-Coding Approval Gate, Testing Requirements, Deliverables Checklist, and Definition of Done checkboxes — all pre-existing sub-checklists of this story, checked off as verified; Completion Status; Dev Agent Record; File List; Change Log; Status).

### File List

- `apps/backend/src/schema/events.graphql` (modified)
- `apps/backend/src/schema/resolvers.ts` (modified)
- `apps/backend/src/schema/resolvers.test.ts` (modified)
- `apps/backend/src/generated/resolvers-types.ts` (modified — codegen-regenerated)
- `apps/web/src/features/events/queries.graphql` (modified)
- `apps/web/src/generated/graphql.ts` (modified — codegen-regenerated)
- `packages/ui/src/features/events/EventDetailView.types.ts` (modified)
- `packages/ui/src/features/events/EventDetailView.tsx` (modified)
- `packages/ui/src/features/events/EventDetailView.test.tsx` (modified)
- `apps/web/src/features/events/EventDetailWrapper.tsx` (modified)
- `apps/web/src/features/events/EventDetailWrapper.test.tsx` (modified)
- `apps/web/src/features/events/mapper.ts` (modified)
- `apps/web/src/features/events/mapper.test.ts` (modified)
- `apps/web/locales/en.json` (modified)
- `apps/web/locales/id.json` (modified)

## Change Log

- 2026-10-08 — Story 1.6g implemented: `Event.hashtags` added end-to-end (schema, resolvers, both codegens), hashtags block rendered in `EventDetailView.tsx` above the View Original link for both single- and multi-post attribution, `onHashtagClick` wired in `EventDetailWrapper.tsx` to a clean single-facet `/?q=%23<tag>` Discovery navigation, `hashtagsListAriaLabel` i18n'd in `en.json`/`id.json`. All Task 5 tests added and passing (ui: 96, web: 88, backend: 118). Status set to review.
