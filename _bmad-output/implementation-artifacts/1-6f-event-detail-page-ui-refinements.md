# Story 1.6f: Event detail page UI refinements — responsive layout, published date, clickable badges, favorite/title, relocate top add-to-calendar icon into overflow menu

## Story Details

- Epic: 1
- Story ID: 1.6f
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the event-detail page to reorder its content on mobile, show when the source post was published, let me tap a category/type badge to see more events like it, see the favorite control next to a slightly smaller title, and have the top-of-page add-to-calendar action tucked into the overflow menu instead of sitting as its own icon,
so that the page reads better on small screens and gives me a faster path into related events, while still keeping a working way to add the event to my calendar until Story 1.6e gives me a faster, per-schedule way to do it.

## Acceptance Criteria

1. **Given** `EventDetailView.tsx`'s two-column root grid (media column, `lg:col-span-3`; details/"event-main-content" column, `lg:col-span-2` — title, badges, description, schedules, attribution), **when** the viewport is below the `lg` breakpoint, **then** the details column renders above the media column (via Tailwind `order-*`/`lg:order-*` on the two existing grid children — no DOM reorder, no new components). **And** at `lg` and above, the layout is pixel-for-pixel unchanged from today (media left, details right).
2. **Given** the event has a linked post (`hasSourceAttribution`: `originalPostUrl` or `sourcePostUrl` present) and the post's `publishedAt` timestamp (new `Event.publishedAt` field, additive to the already-joined `posts` table in the `event`/`eventBySlug` resolvers — same pattern as `sourcePostUrl`/`originalPostUrl`), **when** the Attributions row renders, **then** it is prefixed with `publishedAt` formatted via the existing `formatShortEventDateTime` helper (`packages/ui/src/features/events/format-event-date.ts`, already used elsewhere for the identical "Sep 7"-style short format) followed by a `·` separator, then the existing link — e.g. `Sep 7 · [icon] View Original ↗`. **And** the link's icon switches from today's hardcoded `<Instagram>` icon to the shared `PlatformIcon` component (`packages/ui/src/core/platform-icon.tsx`, built by Story 0.i6f), driven by `accountPlatform` (already an `EventDetailViewProps` field, sourced from `sourceSocialMediaAccountProfile?.platform`), falling back to `detectPlatformFromUrl(originalPostUrl || sourcePostUrl)` when no linked account is present. **And** the date string is not shown when `hasSourceAttribution` is false (no post to attribute) or `publishedAt` is absent.
3. **Given** the event's category/type badges (`EventDetailView.tsx`'s `hasTags` block, today plain, non-interactive `<li>` pills), **when** a user clicks one, **then** the page navigates to Discovery (`/`) with exactly `?categories=<rawEnumValue>` or `?types=<rawEnumValue>` — a clean single-facet reset (no other query params carried over), using the already-built `nuqs` `types`/`categories` array filter Discovery's `home-content.tsx` already reads. **And** this requires the component's `types`/`categories` props to change shape from translated-label-only `string[]` to `{ value: string; label: string }[]` (raw enum value alongside the already-translated display label) — a prop-shape change scoped to this one component and its one caller (`apps/web/src/features/events/mapper.ts`).
4. **Given** the existing favorite-toggle button (`isFavorited`/`favoriteCount`/`onFavoriteToggle`, unchanged), **when** the page renders, **then** it moves from the separate "header controls" row into the `<header>` block, inline beside the `<h1>` event title (to its right, per the source capture note) — no behavior or prop change, JSX relocation only.
5. **Given** the `<h1>` event title, **when** it renders, **then** its Tailwind class changes from `text-3xl font-bold` to `text-2xl font-bold` — no other styling change.
6. **Given** the top-of-page Add-to-Calendar icon/button (`EventDetailView.tsx`'s standalone `CalendarPlus` button, ~lines 305-315) and the bulk multi-select `AddToCalendarDialog` UI it opens, **when** this story ships, **then** the standalone top-level button is removed, but the bulk dialog itself, its `isDialogOpen`/`triggerRef` state, and its `handleTriggerClick` handler (including its existing unauthenticated shortcut, `onAddToCalendar([])`) are all **retained, unchanged** — the trigger is relocated into the existing overflow "more actions" menu (the `menuActions` array, ~lines 73-88) as a new "Add to Calendar" entry, gated on `onAddToCalendar` being provided (same convention already used for `onCorrectData`/`onReport`), whose `onClick` is `handleTriggerClick`. This keeps a working calendar-add entry point on the page until Story 1.6e's per-schedule icon ships. The underlying `onAddToCalendar(selectedScheduleIds: string[])` prop and `EventDetailWrapper.tsx`'s `handleAddToCalendar` mutation-orchestration function are unaffected either way.
7. **And** all new/changed user-facing text (the published-date row's screen-reader prefix, and the "Event categories and types" `aria-label` on the badge list — today hardcoded English, not sourced from `labels`) is resolved through `next-intl` via the existing `EventDetailViewLabels` prop contract, matching every other string in this component.

## Tasks / Subtasks

- [ ] Task 1 — Responsive layout reorder (AC: #1)
  - [ ] In `packages/ui/src/features/events/EventDetailView.tsx`'s root grid (~line 223), add `order-2 lg:order-1` to the media column div (~line 225) and `order-1 lg:order-2` to the details column div (~line 257).
  - [ ] Add/adjust `EventDetailView.test.tsx` assertions for the two grid children's className (jsdom doesn't evaluate `@media`, so assert on the className string containing the expected `order-*`/`lg:order-*` tokens rather than a layout measurement).

- [ ] Task 2 — Backend: additive `Event.publishedAt` field (AC: #2)
  - [ ] `apps/backend/src/schema/events.graphql`: add `publishedAt: String` to `type Event` (~line 113, alongside `sourcePostUrl`/`originalPostUrl`).
  - [ ] `apps/backend/src/schema/resolvers.ts`: add `publishedAt: posts.publishedAt` to the flat `db.select({...})` object in both the `event(id)` resolver (~line 3245-3259) and the `eventBySlug(slug)` resolver (~line 3325-3340) — same existing `posts` join, one more column, no new join/query.
  - [ ] `apps/backend/src/schema/resolvers.ts`: add a passthrough field resolver under `Event: {...}` (~line 3653, right after `originalPostUrl`): `publishedAt: (parent: any) => parent.publishedAt instanceof Date ? parent.publishedAt.toISOString() : (parent.publishedAt || null),` — matches the exact `createdAt`/`sourcePostUrl` conventions already in this file.
  - [ ] Add a backend resolver test asserting `eventBySlug`/`event` return `publishedAt` for an event with a linked post, and `null` for an event with none.

- [ ] Task 3 — Frontend: thread `publishedAt` through to the component (AC: #2, #7)
  - [ ] `apps/web/src/features/events/queries.graphql`: add `publishedAt` to the `getEventBySlug` query document (~line 62, alongside `sourcePostUrl`/`originalPostUrl`).
  - [ ] Regenerate codegen: `pnpm --filter web codegen` (real regen diff against `apps/web/src/generated/graphql.ts`, per this project's established convention — never hand-edit generated types).
  - [ ] `packages/ui/src/features/events/EventDetailView.types.ts`: add `publishedAt?: string | null;` to `EventDetailViewProps` (near `originalPostUrl`/`sourcePostUrl`).
  - [ ] `apps/web/src/features/events/mapper.ts`: map `publishedAt: event.publishedAt` through in `mapGraphQLEventToDetailViewProps`.
  - [ ] `packages/ui/src/features/events/EventDetailView.tsx`'s Attributions section (~lines 540-556): compute the formatted date via `formatShortEventDateTime(locale, undefined, new Date(publishedAt), false, { today: labels.today, tomorrow: labels.tomorrow, yesterday: labels.yesterday })` (no per-event timezone is available for a post-published timestamp, unlike schedule times — pass `undefined` for timezone, matching this helper's own optional-timezone contract), guarded on `hasSourceAttribution && publishedAt`; render `<span className="sr-only">{labels.publishedLabel} </span>{formattedDate}` then a `<span aria-hidden="true"> · </span>` before the existing link row. Swap the hardcoded `<Instagram className="w-3 h-3 ..."/>` (~line 545) for `<PlatformIcon platform={accountPlatform || detectPlatformFromUrl(originalPostUrl || sourcePostUrl || '') || 'instagram'} className="w-3 h-3 text-pink-600 dark:text-pink-400" />` (import `PlatformIcon` from `'../../core/platform-icon'`, matching `SubscriptionPicker.tsx`'s import path convention) — `'instagram'` stays the final fallback so an unresolvable platform doesn't render `PlatformIcon`'s generic `<Link>` glyph where an Instagram-flavored link was always shown before.
  - [ ] `packages/ui/src/features/events/EventDetailView.types.ts`: add `publishedLabel: string;` (and confirm `today`/`tomorrow`/`yesterday` labels — check whether these already exist on `EventDetailViewLabels`; if not, add them, matching `formatShortEventDateTime`'s optional-labels contract) to `EventDetailViewLabels`.
  - [ ] `apps/web/src/features/events/mapper.ts`'s `useEventDetailViewLabels()`: wire `publishedLabel: t('publishedLabel')` (and `today`/`tomorrow`/`yesterday` if newly added).
  - [ ] `apps/web/locales/en.json` and `apps/web/locales/id.json`, `EventDetailsPage` namespace: add `"publishedLabel": "Published"` / `"Diterbitkan"` (and any newly-added `today`/`tomorrow`/`yesterday` keys).

- [ ] Task 4 — Clickable category/type badges → Discovery (AC: #3, #7)
  - [ ] `packages/ui/src/features/events/EventDetailView.types.ts`: change `types?: string[]; categories?: string[];` to `types?: { value: string; label: string }[]; categories?: { value: string; label: string }[];`. Add `onTypeClick?: (value: string) => void; onCategoryClick?: (value: string) => void;` to `EventDetailViewProps`. Add `categoriesAndTypesAriaLabel: string;` to `EventDetailViewLabels`.
  - [ ] `packages/ui/src/features/events/EventDetailView.tsx` (~lines 358-371): rebuild the `hasTags` `<ul>` to read `{value,label}` pairs; each `<li>` wraps a `<button type="button" onClick={() => onCategoryClick?.(category.value)}>{category.label}</button>` (types symmetrically with `onTypeClick`) — button, not the `<li>` itself, for correct interactive semantics and keyboard/focus support; only render as clickable when the corresponding `onCategoryClick`/`onTypeClick` handler is actually provided (mirrors this component's existing "only render an affordance when its handler prop is present" convention, e.g. `onFavoriteToggle`/`onAddToCalendar`), else render the current plain `<li>` text (keeps the component usable read-only). Replace the hardcoded `aria-label="Event categories and types"` with `aria-label={labels.categoriesAndTypesAriaLabel}`.
  - [ ] `apps/web/src/features/events/mapper.ts`: change `mappedTypes`/`mappedCategories` to build `{ value: t, label: tType(t) }` / `{ value: c, label: tCategory(c) }` pairs instead of translated-string-only arrays.
  - [ ] `apps/web/src/features/events/EventDetailWrapper.tsx`: add `onCategoryClick`/`onTypeClick` to `mappedProps`, each calling `router.push(\`/?categories=${encodeURIComponent(value)}\`)` / `router.push(\`/?types=${encodeURIComponent(value)}\`)` via the existing `useRouter` from `@/i18n/navigation` (already imported, already used for every other navigation in this file — locale-prefixing is handled by that router, not by this literal string). Deliberately does **not** merge `searchParams` (resolved default: clean single-facet reset).
  - [ ] `apps/web/locales/en.json` / `id.json`: add `"categoriesAndTypesAriaLabel": "Event categories and types"` / Indonesian equivalent to `EventDetailsPage`.

- [ ] Task 5 — Favorite icon inline with title + title font size (AC: #4, #5)
  - [ ] `packages/ui/src/features/events/EventDetailView.tsx`: move the favorite `<button>` (~lines 288-304) out of the "header controls" `<div className="flex items-center gap-3 shrink-0">` row and into the `<header>` block (~line 355), placed to the right of the `<h1>` (e.g. wrap `<h1>` and the favorite button in a `flex items-start justify-between gap-3` row inside `<header>`).
  - [ ] Same `<h1>` (~line 356): change `text-3xl` to `text-2xl`.
  - [ ] Update the "header controls" row's outer gating condition (~line 286, currently `(onFavoriteToggle || onAddToCalendar || menuActions.length > 0)`) to `menuActions.length > 0` only, since the favorite slot moved out (this task) and the add-to-calendar slot becomes a `menuActions` entry itself, not a sibling, once Task 6 relocates it — this row's remaining content is exactly the overflow "more actions" menu, and `menuActions.length > 0` already covers the add-to-calendar case correctly once Task 6's new entry is added to that same array.

- [ ] Task 6 — Relocate Add-to-Calendar trigger into the overflow "more actions" menu (AC: #6)
  - [ ] `packages/ui/src/features/events/EventDetailView.tsx`: delete only the standalone `CalendarPlus` trigger `<button>` (~lines 305-315, including its `ref={triggerRef}`). Keep `isDialogOpen`/`triggerRef` state (~lines 64-65), `handleTriggerClick` (~lines 138-144, unchanged — still handles the unauthenticated `onAddToCalendar([])` shortcut internally), the `<AddToCalendarDialog ... />` render (~lines 560-571), and the `AddToCalendarDialog` component definition itself (~lines 576-758) all fully unchanged — per the resolved design default (see Dev Notes), this is a relocation, not a removal.
  - [ ] In the `menuActions` `useMemo` (~lines 73-88), add a new entry when `onAddToCalendar` is provided: `{ label: labels.addToCalendarButtonLabel, onClick: handleTriggerClick }`, alongside the existing `onCorrectData`/`onReport` entries (include `onAddToCalendar` and `handleTriggerClick` in the memo's dependency array). Confirm during implementation whether `triggerRef` should be reassigned to the new menu-item button (for the dialog's focus-return-on-close behavior) or left pointing at `menuTriggerRef`/the menu's own trigger — inspect `AddToCalendarDialog`'s use of `triggerRef` (~lines 576-758) before deciding.
  - [ ] Leave `EventDetailViewProps.onAddToCalendar`/`isAddedToCalendar` and `EventDetailViewLabels`'s `addToCalendarButtonLabel`/`addToCalendarDialogTitle`/`addToCalendarConfirmLabel`/`addToCalendarCancelLabel`/`scheduleCheckboxLabel` fields and their `en.json`/`id.json` entries untouched — `addToCalendarButtonLabel` is now reused as the new menu item's label text; the others remain consumed by the retained `AddToCalendarDialog`.
  - [ ] Leave `apps/web/src/features/events/EventDetailWrapper.tsx`'s `handleAddToCalendar` function and its `mappedProps.onAddToCalendar` wiring completely unchanged.

- [ ] Task 7 — Test harness: preserve `handleAddToCalendar` regression coverage without its removed UI trigger (AC: #6, testing)
  - [ ] `apps/web/src/features/events/EventDetailWrapper.test.tsx` currently exercises `handleAddToCalendar` (success, partial-failure/rollback, `.ics` download, unauthenticated-redirect paths — at minimum the 5 test blocks around today's ~lines 570-800 that `findByRole("button", { name: "EventDetailsPage.addToCalendarButtonLabel" })` then drive the dialog's confirm button) exclusively through the button/dialog UI Task 6 removes. Since `EventDetailWrapper`'s `handleAddToCalendar` itself is functionally unchanged, rewrite these tests to capture and invoke the `onAddToCalendar` prop directly instead of clicking through now-removed UI: partially mock `@festgrid/ui` in this test file (`vi.mock('@festgrid/ui', async (importOriginal) => { const actual = await importOriginal<typeof import('@festgrid/ui')>(); return { ...actual, EventDetailView: (props: any) => { capturedProps = props; return null } } })`, with `capturedProps` reset in `beforeEach`), then call `await capturedProps.onAddToCalendar([...scheduleIds])` in place of the removed button/dialog interaction, keeping every existing assertion (mutation calls, cache updates, toast, `.ics` download URL, error/rollback behavior) intact. This is a test-harness change only — no coverage is dropped, and no behavior of `handleAddToCalendar` changes.

- [ ] Task 8 — Tests for the new/changed behavior (AC: #1, #2, #3, #4, #5, #7)
  - [ ] `EventDetailView.test.tsx`: order-class assertions (Task 1); published-date-prefix rendering (present/absent per `hasSourceAttribution`/`publishedAt`), `PlatformIcon` platform selection (linked-account case and URL-fallback case); badge click firing `onCategoryClick`/`onTypeClick` with the raw `value`, and badges rendering as plain (non-interactive) text when no handler is passed; update the existing `aria-label`-based query (~line 119) to use the new i18n'd `categoriesAndTypesAriaLabel` value from the test's `labels` fixture instead of the old hardcoded string; favorite button rendering beside the title; `text-2xl` on the `<h1>`; absence of any standalone top-level `CalendarPlus` button; presence of an "Add to Calendar" entry inside the overflow "more actions" menu when `onAddToCalendar` is passed, which opens the (retained) `AddToCalendarDialog` on click.
  - [ ] `EventDetailWrapper.test.tsx`: badge click calls `mockRouterPush` with exactly `/?categories=<value>` or `/?types=<value>` (already-mocked `useRouter` from `@/i18n/navigation`, per this file's existing mocking convention) and does not carry over any existing `mockSearchParams`.
  - [ ] `mapper.test.ts`: `publishedAt` passthrough; `types`/`categories` map to `{ value, label }` pairs (raw enum value + translated label), including the existing `null`-input cases (~lines 53-54) still resolving to `null`/`undefined`, not `[]`.
  - [ ] Backend resolver test (Task 2) confirming `publishedAt` on both `event`/`eventBySlug`.

## Dev Notes

- **`EventDetailView.tsx` is a presentation-only, framework-agnostic component in `packages/ui`** (per its own file-header comment) with exactly one real consumer, `apps/web/src/features/events/EventDetailWrapper.tsx` (used by both the full-page route `apps/web/src/app/[locale]/events/[slug]/page.tsx` and the intercepted modal route `@modal/(.)events/[slug]/page.tsx`, both via `EventDetailWrapper`). All six in-scope items are amendments to this one component and its one wrapper — no new component, hook, or route is introduced.
- **Current state read in full before drafting this story** (mandatory read-files-being-modified step): `EventDetailView.tsx` (759 lines), `EventDetailView.types.ts`, `EventDetailWrapper.tsx` (711 lines), `mapper.ts`. Key facts already folded into the Tasks above: the root grid is `grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8` with a `lg:col-span-3` media child and `lg:col-span-2` details child (details = the capture note's "event-main-content"); the favorite button, the `CalendarPlus` add-to-calendar trigger, and the overflow "more actions" menu currently share one "header controls" row (~lines 258-353), gated as a group on `(onFavoriteToggle || onAddToCalendar || menuActions.length > 0)`; the Attributions block (~lines 540-556) already independently gates `originalPostUrl` vs. `sourcePostUrl` display and already imports `detectPlatformFromUrl` from `@festgrid/domain` (used today only to suppress a redundant `sourcePostUrl` link when it's the same Instagram post as `originalPostUrl`) — this story is the first to use it for icon selection too.
- **`posts.publishedAt` is a real, `NOT NULL` DB column** (`packages/database/schema.ts:285`) already reachable from `event`/`eventBySlug` via the `posts` left-join those resolvers already perform. It is `NOT NULL` on the `posts` row itself, but an `EventInfo` with no linked post (`postId` null) still yields `null` after the left join — the frontend must treat `publishedAt` as nullable, matching `sourcePostUrl`/`originalPostUrl`'s existing nullability.
- **`PlatformIcon` (`packages/ui/src/core/platform-icon.tsx`) and `detectPlatformFromUrl` (`packages/domain`) are both pre-built, already-reused primitives** — this story consumes them, it does not build or extend either. `PlatformIcon` currently only distinguishes `'instagram'` from everything else (falls back to a generic `<Link>` glyph); that is pre-existing scope, not something this story needs to extend, since the Attributions row's *existing* behavior already assumed Instagram whenever an icon was shown.
- **`formatShortEventDateTime`** (`packages/ui/src/features/events/format-event-date.ts:217`) is the same helper already responsible for the "Sep 7"-style short date elsewhere in this codebase (e.g. `EventCard.tsx`'s date box) — chosen because it already produces exactly the format the capture note asked for (`Sep 7`) once the day-diff falls outside the -1/0/1 today/yesterday/tomorrow window, which a `publishedAt` timestamp (always in the past, typically well in the past) almost always will.

### Architecture & UX Gate Findings

Gates 1/2/3 (`story-split-gate.md`) ran **fresh via subagent dispatch**, not cited against `epic-1-readiness.md` — that report is `swept: true` but its `stories_covered` frontmatter list (`1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, 1.7, 1.8`) predates Stories 1.6b/1.6c/1.6d/1.6e and this one, so it does not cover this story's surface (same reasoning already applied on Story 0.36 against `epic-0-readiness.md`'s equally stale scope).

- **Gate 1 (Winston) — No gap.** All six items are frontend-only JSX/CSS/prop-shape changes, or the one additive backend change: `Event.publishedAt` piggybacks on the *already-existing* `posts` join in the *already-existing* `event`/`eventBySlug` resolvers (one more selected column, one new passthrough resolver matching the `sourcePostUrl`/`createdAt` pattern verbatim) — the same class of change as Story 0.37's `Event.links` field, which Gate 1 already found "no gap" for. No new join, no new query/mutation/resolver *shape*, no frontend→DB bypass, no external service called directly from the frontend, no secrets/business rules added to frontend code.
- **Gate 2 (Freya/Sally) — No gap; one non-blocking item logged.** No item clears Gate 2's reuse-extraction bar (a component/hook/util reused in ≥2 places with non-trivial state, or a complex hook): the new clickable-badges interaction (item 4) is the closest candidate but has exactly one consumer (`EventDetailView.tsx`) today — flagged as "watch, not split": if a future story gives `EventCard`/`CalendarCard`'s own badge row the same click-through, extraction becomes worth revisiting then, not now. Confirmed (informational, non-blocking, matching the Story 0.37/1.i1e precedent for a genuine zero-coverage finding) that **neither `design-artifacts/UX-festgrid-run-1/DESIGN.md` nor `EXPERIENCE.md` covers any of**: event-detail-page layout order, title font size, favorite-icon placement relative to the title, badge click-through/interactivity, or the top-of-page add-to-calendar affordance. `DESIGN.md`'s ~500 lines of tokens are entirely scoped to the `EventCard`/`CalendarCard` *list-card* families; `EXPERIENCE.md`'s only relevant line ("Clicking on an event card... opens a modal with the full event details, including a clear display of its types and categories as tags") confirms tags are shown, says nothing about interactivity. This story's Acceptance Criteria are the source of truth for these specifics in the absence of spec coverage.
- **Gate 3 (Winston) — No gap.** Every mechanism this story consumes is already built by a prior story, and none of it is something *other* future stories would need to independently discover: i18n (`next-intl`, project-wide), `PlatformIcon` (Story 0.i6f), the `nuqs` `types`/`categories` URL-filter convention (Story 0.i5a/AD-18, already consumed by Discovery's own `home-content.tsx`), and the flat-select/`buildOptimizedDrizzleSelect` resolver pattern (Story 1.3a). This story is a pure consumer of all four, not a hidden builder of any of them.

**Two genuine design tradeoffs with no spec answer and no mechanical resolution** were raised to the user via `AskUserQuestion` per this project's standing persistent-facts rule. This story-creation session's own direct `AskUserQuestion` call reported "no answer" in-conversation, matching the intermittent non-response already documented on Stories 0.34/0.37 — but per the Story 0.34 precedent, that in-conversation report was **not trusted at face value**: it was independently verified against the primary mailbox record (this batch's ritual-orchestrator session relays the same question through its own mailbox in parallel, and answers land in `_bmad-output/specs/ritual-session-orchestrator/mailbox/resolved/c84b55e3-3d75-4905-8989-44dac47bdf69.{pending,answer}.json`). That record contains this session's exact two questions with genuine, independently-given answers, confirmed before this story was committed:

1. **Add-to-calendar gap.** Options were (a) remove the top button and the bulk `AddToCalendarDialog` entirely — accepting a real, temporary regression (zero calendar-add entry point on this page) until Story 1.6e's per-schedule icon ships — or (b) keep the dialog reachable by moving its trigger into the "more actions" overflow menu as an interim measure. **Confirmed answer: (b), relocate into the overflow menu.** The dialog stays reachable (a new "Add to Calendar" item alongside Correct Data/Report) until Story 1.6e's per-schedule icons supersede it — see AC6 and Task 6. (Story 1.6e's own `epics.md` AC phrase "before IDEA-030 item 7 removes it" refers only to the *standalone top-level button* going away, which still holds true under this answer — the button is gone, its trigger just moves into the menu rather than disappearing outright.)
2. **Badge-click filter semantics.** Options were (a) a clean single-facet reset (`/?categories=X`, dropping any other params) or (b) merging into whatever `searchParams` the event-detail page happened to carry from its referring list (preserving `q` and other filters, only setting/replacing the types/categories dimension). **Confirmed answer: (a), clean single-facet reset** — reads as "show me more events like this one" without an implicit, easy-to-get-wrong dependency on whatever params happen to be present (a direct deep-link has none at all), and needs no merge logic. (This also happens to match what would have been the recommended default.)

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one additive mismatch, resolved by this story.** `posts.publishedAt` (DB, `timestamp with time zone`, `NOT NULL`) has no corresponding field anywhere in the `Event` GraphQL type, the frontend's generated types, or `EventDetailViewProps` — it exists in the database and in other resolvers' internal row shapes (e.g. the feed pagination cursor at `resolvers.ts:2511-2527`) but was never exposed on `Event`.
- **Impacted fields/contracts:** `apps/backend/src/schema/events.graphql` (`Event` type — add `publishedAt: String`, nullable, matching `sourcePostUrl`/`originalPostUrl`'s nullability since the underlying `posts` join is a `leftJoin`), `apps/backend/src/schema/resolvers.ts` (two flat-select `db.select({...})` objects in `event`/`eventBySlug`, plus one new `Event.publishedAt` passthrough resolver), `apps/web/src/features/events/queries.graphql` (`getEventBySlug` document), `apps/web/src/generated/graphql.ts` (codegen-regenerated, never hand-edited), `packages/ui/src/features/events/EventDetailView.types.ts` (`EventDetailViewProps.publishedAt?: string | null`), `apps/web/src/features/events/mapper.ts`. Separately, `EventDetailViewProps.types`/`.categories` change shape from `string[]` to `{ value: string; label: string }[]` — a frontend-internal prop-contract change (not a DB/API mismatch; the raw `EventType`/`EventCategory` enum values were already being fetched by the GraphQL query, just discarded by the mapper before reaching the component).
- **Required DB migration changes:** None. `posts.publishedAt` already exists, is already indexed (`published_at_idx`, `packages/database/schema.ts:302`), and already `NOT NULL` — this is a read-path exposure only, no schema change.
- **Required TypeScript type changes:** `EventDetailViewProps.publishedAt?: string | null` (new); `EventDetailViewProps.types`/`.categories` type change from `string[]` to `{ value: string; label: string }[]` (breaking change to this component's own prop contract, but it has exactly one caller, updated in the same story — see Task 4); `EventDetailViewProps.onTypeClick?`/`.onCategoryClick?` (new, optional); `EventDetailViewLabels.publishedLabel`/`.categoriesAndTypesAriaLabel` (new, required — see below); codegen-regenerated `GetEventBySlugQuery` type gains `publishedAt`.
- **Backward compatibility and rollout notes:** `EventDetailView`'s `types`/`categories` prop-shape change is a breaking change to that component's public contract, but since `packages/ui` is consumed only within this monorepo (not published externally) and has exactly one real call site (`EventDetailWrapper.tsx`, updated in the same story/commit), there is no cross-version compatibility window to manage — both sides land together. `onTypeClick`/`onCategoryClick`/`publishedAt` are additive/optional, so any other hypothetical caller (none exists today; `EventDetailView.test.tsx` is the only other consumer and is updated in this story) degrades gracefully rather than breaking.
- **Verification checks:** the backend resolver test and `mapper.test.ts` cases listed in Task 2/Task 8 prove `publishedAt` flows end-to-end (DB → resolver → GraphQL type → codegen → mapper → component prop); `EventDetailView.test.tsx`'s updated badge tests prove the new `{value,label}` shape renders and click-navigates correctly, including the read-only fallback (no handler passed) still rendering plain text — the existing null/undefined `types`/`categories` cases in `mapper.test.ts` (~lines 53-54) continue to resolve to `null`/`undefined`, not an empty array, preserving `EventDetailView.tsx`'s existing `hasTags` falsy-check.

### Project Structure Notes

- No new files, no new directories. All changes land in already-established locations: `packages/ui/src/features/events/` (component + types + tests), `packages/ui/src/core/platform-icon.tsx` (import only, unmodified), `apps/web/src/features/events/` (wrapper, mapper, queries, tests), `apps/backend/src/schema/` (schema + resolvers), `apps/web/locales/` (en/id).
- No package-boundary concerns: nothing touches `packages/domain` (no new business logic — `detectPlatformFromUrl` and `formatShortEventDateTime` are both pre-existing, reused as-is), no state-management library changes (no new React Query/`nuqs`/`zustand` usage — badge-click navigation is a plain `router.push`, matching this file's existing navigation pattern for "Back to Home"/login redirects/etc.).

### References

- [Source: packages/ui/src/features/events/EventDetailView.tsx] — full file read; exact line numbers cited above reflect its current state at story-creation time (dev-story should re-confirm line numbers before editing, since intervening stories may shift them).
- [Source: packages/ui/src/features/events/EventDetailView.types.ts]
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx]
- [Source: apps/web/src/features/events/mapper.ts]
- [Source: apps/web/src/features/events/queries.graphql#getEventBySlug]
- [Source: apps/backend/src/schema/events.graphql#Event]
- [Source: apps/backend/src/schema/resolvers.ts#event,eventBySlug,Event]
- [Source: packages/database/schema.ts:285,302] — `posts.publishedAt` column + index
- [Source: packages/ui/src/features/events/format-event-date.ts#formatShortEventDateTime]
- [Source: packages/ui/src/core/platform-icon.tsx]
- [Source: packages/domain/src/scraper/platform-registry.ts#detectPlatformFromUrl]
- [Source: apps/web/src/app/[locale]/home-content.tsx] — `types`/`categories` `nuqs` filter convention
- [Source: _bmad-output/implementation-artifacts/backlog/IDEA-030-event-detail-ui.md]
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-030,IDEA-037,BUG-032]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6f, Story 1.6e]
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — cited only to establish why it is *not* being relied on (stale scope)
- [Source: _bmad-output/planning-artifacts/event-pages-followthrough-plan.md] — confirms IDEA-030 is standalone, direct-to-`bmad-create-story`, no `bmad-correct-course` pass required

## Global Rules References

- [x] `_bmad-output/project-context.md` — Locale-Sensitive Data Rendering (dates must go through a locale-aware formatter, never a raw string — satisfied via `formatShortEventDateTime`); UI Patterns & UX Invariants "Page Containers"/"Page Headers" rules were checked and do not apply to this component (not a page-level container/header); no new state-management, GraphQL, or package-boundary rule is implicated (see Project Structure Notes).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story follows its canonical section order and status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no new architecture-spine invariant introduced or amended by this story (confirmed via Gate 1/3 findings above); AD-16/AD-17 (event-detail-page performance work) are unaffected — this story does not touch `instagramEmbed`, `schedules` batching, or the hydration-boundary work those ADs own.
- [x] `docs/infrastructure/index.md` — frontend-only + one additive read-path GraphQL field; no infra-layer (SQS/EventBridge/API Gateway/DB provisioning) touched, so only the index summary applies (no infrastructure shard file read required, per the sharded-doc rule).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/ui/src/features/events/EventDetailView.tsx` (modified — layout order, Attributions row, badges, header/title/favorite restructuring, Add-to-Calendar trigger relocated into overflow menu)
  - `packages/ui/src/features/events/EventDetailView.types.ts` (modified — new/changed props and labels)
  - `packages/ui/src/features/events/EventDetailView.test.tsx` (modified)
  - `apps/web/src/features/events/EventDetailWrapper.tsx` (modified — `onCategoryClick`/`onTypeClick` wiring)
  - `apps/web/src/features/events/EventDetailWrapper.test.tsx` (modified — Task 7's `onAddToCalendar` test-harness rework + new badge-click-navigation tests)
  - `apps/web/src/features/events/mapper.ts` (modified)
  - `apps/web/src/features/events/mapper.test.ts` (modified)
  - `apps/web/src/features/events/queries.graphql` (modified)
  - `apps/web/src/generated/graphql.ts` (codegen-regenerated, not hand-edited)
  - `apps/backend/src/schema/events.graphql` (modified)
  - `apps/backend/src/schema/resolvers.ts` (modified)
  - `apps/web/locales/en.json`, `apps/web/locales/id.json` (modified)
  - No changes to `packages/domain`, `packages/database`, `packages/graphql-select`, or any state-management package.

- **Rule Mapping:**
  - Locale-Sensitive Data Rendering (project-context.md) → `formatShortEventDateTime` for the published date; new `next-intl` keys for `publishedLabel`/`categoriesAndTypesAriaLabel` (AC7).
  - GraphQL-only data access (project-context.md "API Style") → `publishedAt` reaches the frontend exclusively via the existing GraphQL `Event` type, no direct DB access from `apps/web` (AC2, Gate 1 finding).
  - Optimized DB Queries (project-context.md) → `publishedAt` reuses the existing `posts` join and flat select rather than adding a new per-row field resolver or a new query (AC2, Gate 1 finding).
  - `packages/ui` reusable-component convention → all UI changes stay inside the already-correctly-homed `EventDetailView.tsx`; `PlatformIcon` is reused, not re-implemented (AC2, Code Organization rule).
  - Context-Aware Detail Views / existing navigation pattern → badge-click uses the same `useRouter` from `@/i18n/navigation` already used for every other navigation in `EventDetailWrapper.tsx` (AC3).

- **Verification Plan:**
  - `pnpm --filter ui test` — `EventDetailView.test.tsx` covers order classes, published-date rendering (present/absent), `PlatformIcon` selection, clickable/non-clickable badge rendering, favorite-button placement, `text-2xl`, and confirms no add-to-calendar trigger/dialog renders even when `onAddToCalendar` is passed.
  - `pnpm --filter web test` — `EventDetailWrapper.test.tsx` (badge-click → `router.push` assertions; Task 7's reworked `onAddToCalendar` direct-invocation tests preserving existing mutation/ics/error coverage), `mapper.test.ts` (`publishedAt` passthrough; `{value,label}` badge shape; existing null-case regression).
  - Backend: a `resolvers.test.ts`-style test (or the project's established backend test location) confirming `event`/`eventBySlug` return `publishedAt` correctly, including the no-linked-post `null` case.
  - `pnpm --filter web codegen` run and the resulting `apps/web/src/generated/graphql.ts` diff inspected to confirm it is a real regenerated diff (adds `publishedAt`) and nothing else drifted.
  - `pnpm lint` and `pnpm build` clean across all touched packages (`ui`, `web`, `backend`).
  - Manual/visual check (or a Playwright smoke, if the project's E2E suite already covers this route — `apps/web/e2e/event-details.spec.ts` exists) at a sub-`lg` viewport confirming the details column visually renders above the media column, and at `lg`+ confirming no visual change from today.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — confirm IDEA-030 items 1, 2, 4, 5, 6, 7 only; item 3 (hashtags) correctly excluded and tracked as `IDEA-037`.
- [ ] Architecture and boundary confirmation — Gate 1/2/3 all returned "no gap" (see Architecture & UX Gate Findings); no prerequisite story required.
- [ ] Testing plan confirmation — Task 7's `onAddToCalendar` test-harness rework (partial-mocking `@festgrid/ui` in `EventDetailWrapper.test.tsx`) is understood and accepted as the mechanism for preserving existing mutation-orchestration test coverage once its UI trigger is removed.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — no prerequisites exist; N/A.
- [ ] **Design-tradeoff confirmation checkpoint 1**: the add-to-calendar gap was resolved as **relocate into the "more actions" overflow menu** (standalone top button removed, bulk dialog retained and reachable via a new menu item) — confirmed via the verified mailbox answer cited in Dev Notes → Architecture & UX Gate Findings. Re-confirm before/during `dev-story` that this is still the intended behavior.
- [ ] **Design-tradeoff confirmation checkpoint 2**: badge-click navigation was resolved as **clean single-facet reset** (`/?categories=X`, drops other params) — confirmed via the same verified mailbox answer. Re-confirm before/during `dev-story`.

## Testing Requirements

- [ ] Integration tests — `EventDetailView.test.tsx` (packages/ui), `EventDetailWrapper.test.tsx` + `mapper.test.ts` (apps/web), a backend resolver test for `publishedAt`. See Task 7/Task 8 and the Verification Plan above for exact coverage.
- [ ] E2E tests — not required net-new; if `apps/web/e2e/event-details.spec.ts` already exercises the top-of-page action row or category/type badges, update it to match the new layout/behavior rather than leaving it asserting removed UI. No new E2E scenario is mandated by this story's ACs (Definition of Done's "happy path E2E" bar is already met by the existing event-detail E2E suite; this story amends existing UI within that same page, not a new user flow).

## Deliverables Checklist

- [ ] Responsive layout reorder shipped and verified at both breakpoints (AC1)
- [ ] `Event.publishedAt` field shipped end-to-end (schema, resolver, codegen, mapper, component) and rendered per AC2
- [ ] Category/type badges clickable, navigating to Discovery with a clean single-facet filter param (AC3)
- [ ] Favorite icon relocated beside the title (AC4)
- [ ] Title font size reduced to `text-2xl` (AC5)
- [ ] Standalone top-of-page Add-to-Calendar icon removed; trigger relocated into the overflow "more actions" menu; bulk dialog and `onAddToCalendar` plumbing retained unchanged (AC6)
- [ ] All new/changed text i18n'd in `en.json` and `id.json` (AC7)
- [ ] `EventDetailWrapper.test.tsx`'s `handleAddToCalendar` coverage preserved via the Task 7 test-harness rework
- [ ] `backlog.yaml`/`sprint-status.yaml`/`epics.md` already updated as part of story creation (see this story's own promotion trail — no further action needed here)

## Out of Scope

- **IDEA-030 item 3 (hashtags at the bottom of `event-main-content`, clicking to Discovery with the hashtag as an additional `search-text` param)** — explicitly excluded per the user's own scoping instruction for this story. Depends on hashtag-persistence data that does not exist yet (`BUG-032`, unresolved, in a separate, not-yet-started backlog cluster). Carved to a new child backlog row, **`IDEA-037`** (`parent: IDEA-030`, `status: backlog`; `BUG-032` updated with `blocks: [IDEA-037]`) — re-eligible for `bmad-create-story` once `BUG-032` lands.
- **Story 1.6e** (`epics.md`, already scoped) — the per-schedule add-to-calendar icon that will eventually give users back an in-page way to add a schedule to their calendar, reusing this story's retained `onAddToCalendar` plumbing. Not part of this story.
- **`EventDetailViewLabels`'s now-unconsumed add-to-calendar-dialog label keys** (`addToCalendarButtonLabel`, `addToCalendarDialogTitle`, `addToCalendarConfirmLabel`, `addToCalendarCancelLabel`, `scheduleCheckboxLabel`) are deliberately left in place (interface, `mapper.ts`, `en.json`/`id.json`) rather than deleted — see Task 6. A future cleanup pass may remove them if Story 1.6e ends up not reusing any of them; not this story's concern.
- Any broader reusable-badge-click extraction (e.g. giving `EventCard`/`CalendarCard` the same category/type click-through) — Gate 2 explicitly flagged this as "watch, not split" (no second consumer exists today).

## Definition of Done

- [ ] AC1-AC7 satisfied
- [ ] Required tests passing: `pnpm --filter ui test`, `pnpm --filter web test`, backend resolver test
- [ ] Lint and type checks passing for touched packages (`ui`, `web`, `backend`): `pnpm lint`, `pnpm build`
- [ ] `pnpm --filter web codegen` run and its diff reviewed as part of the change
- [ ] No decrease in overall project test coverage percentage

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
