---
baseline_commit: 162af179d0baa285d8680991f04ed9bcff4b14ee
---
# Story 1.6a: Build the reusable event detail view component

## Story Details

- Epic: 1
- Story ID: 1.6a
- Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, presentation-only event detail display component in `packages/ui`,
so that the event name, description, all schedules (date/time/performers/price/location), category/type tags, and image can be presented consistently whether the caller renders it inside a modal or a full page.

## Acceptance Criteria

1. **AC1 — Core fields:** Given a fully-loaded event's details, when `EventDetailView` renders, then it displays the event name and description, with the description section omitted entirely (not an empty block) when `description` is absent.
2. **AC2 — All schedules rendered, not just one:** Given an event with one or more `schedules` (each with `eventStartDate`, optional `eventEndDate`/`eventStartTime`/`eventEndTime`, and an optional `title`), when `EventDetailView` renders, then it renders **every** schedule as a distinct, labeled entry (using each schedule's `title` when present, else a positional fallback label) — not only a single primary schedule — formatted via native `Intl.DateTimeFormat` (accepting an optional `locale` prop), not `next-intl`, since `packages/ui` stays framework-agnostic (see Dev Notes, mirrors `EventCard`'s AC1 in Story 1.3b).
3. **AC3 — Per-schedule performers, location, and price with event-level fallback:** For each rendered schedule, when that schedule provides its own `performers`, `location`, and/or `ticketPrice`, then those per-schedule values are displayed under that schedule's entry; when a schedule omits `location`, the component falls back to the event-level `location` value instead of rendering nothing.
4. **AC4 — Optional map link:** When a schedule (or the event-level fallback) provides an already-constructed `mapUrl` string, then `EventDetailView` renders the location as a tappable/clickable link to that URL; when `mapUrl` is absent, the location renders as plain text with no broken/dead link. `packages/ui` does not construct map URLs itself (no maps SDK dependency) — the caller resolves `mapUrl` and passes it in, mirroring how `EventCard` (Story 1.3b) receives an already-resolved `imageUrl` rather than constructing one.
5. **AC5 — Category and type tags:** When `types` and/or `categories` (arrays of display-ready label strings) are provided, then `EventDetailView` renders them as tags/badges; when either array is empty or absent, that tag group is omitted, not rendered empty.
6. **AC6 — Image (happy path):** When an `imageUrl` prop is provided and loads successfully, `EventDetailView` renders it in a plain `<img>` (not `next/image` — see Dev Notes) with a non-empty `alt` text, auto-derived from `eventName` unless an explicit `imageAlt` override is supplied.
7. **AC7 — Image fallback:** When `imageUrl` is absent, or the image fails to load (`onError`), `EventDetailView` renders a graceful placeholder visual instead of a broken-image icon or blank space.
8. **AC8 — Loading state:** `EventDetailView` exposes a `loading` boolean prop; when `true`, it renders a skeleton placeholder matching the component's real layout dimensions, with `aria-busy="true"`, and does not attempt to render partial/undefined event data underneath the skeleton.
9. **AC9 — Error state, invocation-agnostic:** `EventDetailView` exposes an `error` prop (an object with at least a `message: string`, or `null`); when set, it renders an error state (not the event content, not the loading skeleton) with the message. The component itself never fetches data or knows whether it is rendered inside a modal or a full page — the `loading`/`error`/event-data props fully determine what renders, so both the modal route and the full-page route (Story 1.6) can drive the identical component with an identical prop contract.
10. **AC10 — Minimal-data resilience:** `EventDetailView` renders correctly using only the fields guaranteed by the current API contract (`eventName`, at least one schedule with `eventStartDate`, `location`) — every other prop (`description`, `imageUrl`, `types`, `categories`, per-schedule `performers`/`ticketPrice`/`mapUrl`, favorite/calendar state) is optional, and the component must not throw or produce broken layout when any subset of them is omitted.
11. **AC11 — Reserved favorite and add-to-calendar slots (not wired):** `EventDetailView` accepts optional `isFavorited`/`onFavoriteToggle` and `isAddedToCalendar`/`onAddToCalendar` props, reserving the affordances the event-detail UX scenario (`01.2-event-detail.md`) places on this page. When a given `on*` handler is not provided, its corresponding control does not render. The actual favorite/unfavorite and add-to-calendar mutation behavior is out of scope for this story (Story 1.6 / Story 2.1 / Story 2.1a — see Out of Scope), matching the precedent set by `EventCard`'s reserved-but-unwired favorite slot (Story 1.3b AC7).
12. **AC12 — Semantic, accessible structure:** The component's root and section structure use semantic HTML (headings, `<address>`/appropriate landmarks as suited, lists for multi-schedule and tag content) rather than an undifferentiated stack of `<div>`s, and interactive elements (map link, reserved favorite/calendar controls when wired) are keyboard-focusable per WCAG 2.1 AA (UX-DR18, consistent with `EventCard`'s AC8).
13. **AC13 — i18n-ready microcopy:** Any internal microcopy the component renders itself (fallback `alt` text default, loading-state label, error-state label, empty-schedule-list fallback, section headings like "Performers"/"Location") is exposed via an optional `labels` override prop with sensible English defaults, so the consuming app can localize it via `next-intl` at the call site (AD-6) without coupling `packages/ui` to `next-intl` directly — same pattern as `EventCard` AC9.
14. **AC14 — Documented & exported for reuse:** `EventDetailView` (and its prop types) is exported from `packages/ui`'s public entry point with prop-level documentation (TSDoc), and has component tests proving the loading / error / image-success / image-fallback / multi-schedule / minimal-data states, so it is discoverable and reusable across both the modal and full-page consumers in Story 1.6.
15. **AC15 — Source-post attribution links (added 2026-08-01 via `bmad-correct-course`):** `EventDetailView` accepts two independent, optional caller-supplied URL props — `originalPostUrl` (the canonical original-platform post, e.g. Instagram, when the caller was able to derive it) and `sourcePostUrl` (the post as actually scraped, which may be a proxy/mirror site, e.g. `imginn.com`) — and renders an attribution link for whichever is present; when both are absent, no attribution section renders (not an empty block); when only one is present, only that one renders. `packages/ui` does not construct or validate these URLs itself (same decoupling as `mapUrl`, AC4) — the caller resolves and passes them in.
16. **AC16 — Account attribution link (added 2026-08-02 via `bmad-correct-course`):** `EventDetailView` accepts optional caller-supplied `accountName`, `accountPlatformIconUrl` (or equivalent platform-icon identifier), and `accountHref` props (a pre-built `/{platformSlug}/{accountId}` URL, Story 3.11 — the caller resolves this, mirroring the `mapUrl`/AC4 and attribution-link/AC15 decoupling pattern); when all three are present, it renders the account's platform icon and display name as a link to `accountHref`; when any are absent, the account-attribution section is omitted entirely (not a broken/partial render). This is independent of, and renders alongside, the AC15 source-post attribution links — the two point to different destinations (account page vs. original post) and either may be present without the other.
17. **AC17 — Video priority display (added 2026-08-26 via `bmad-correct-course`, `sprint-change-proposal-2026-08-25-video-priority-display.md` §1.3/§4.5):** `EventDetailViewProps` gains optional `videoUrl`/`videoAlt` props. When `videoUrl` is present, `EventDetailView` renders a `<video autoPlay muted loop playsInline>` in place of the static image, with no manual playback controls (v1 decision, no player library). The poster image (`imageUrl`) remains the visible content (a) before the video has started playing — reusing whichever skeleton/loading convention `EventImage` already establishes for its own container — and (b) as the fallback if the video fails to load or play, via the same graceful-degradation `onError` pattern `EventImage` already uses for a broken `imageUrl` (AC7). When `videoUrl` is absent, rendering is byte-for-byte unchanged from the existing image-only path (AC6/AC7) — no regression for non-video posts.
18. **AC18 — Video failure attribution (added 2026-08-26 via `bmad-correct-course`):** When video playback fails specifically (the `onError`/failure path only — not the initial pre-ready loading state covered by AC17), and at least one of `originalPostUrl`/`sourcePostUrl` (AC15) is present, `EventDetailView` surfaces those existing attribution links with copy explaining that the video can be viewed on the original post, in addition to falling back to the poster image per AC17. No new URL-resolution props are introduced — this reuses the AC15 props as-is.
19. **AC19 — Forward-compatible image fallback URL (added 2026-08-26 via `bmad-correct-course`):** `EventDetailViewProps` gains an optional `imageFallbackUrl` prop, wired into the image's existing `onError` handler as a secondary retry attempted before giving up to the placeholder icon. This story only adds and wires the prop for a later, separate story (Track A's original-vs-durable image switch, `sprint-change-proposal-2026-08-25-video-priority-display.md` AD-12) to populate — no URL-selection/expiry logic is implemented here, and no existing behavior changes when `imageFallbackUrl` is absent.

## Tasks / Subtasks

- [x] 1. Create `packages/ui/src/features/events/EventDetailView.tsx` implementing the base structure, name, and description rendering (AC1, AC10).
- [x] 2. Define a strictly-typed `EventDetailViewProps` interface (all fields beyond `eventName`/one schedule/`location` explicitly optional), co-located as `packages/ui/src/features/events/EventDetailView.types.ts`, including a `ScheduleDetail` sub-type mirroring `Schedule`'s relevant fields (AC10, AC2, AC3).
- [x] 3. Implement multi-schedule rendering: iterate `schedules`, render each with locale-aware `Intl.DateTimeFormat` formatting (optional `locale` prop) and a `title`-or-positional-fallback label (AC2).
- [x] 4. Implement per-schedule `performers`/`location`/`ticketPrice` rendering with event-level `location` fallback when a schedule omits its own (AC3).
- [x] 5. Implement the optional `mapUrl` link rendering for location, falling back to plain text when absent (AC4).
- [x] 6. Implement `types`/`categories` tag rendering, omitted when empty/absent (AC5).
- [x] 7. Implement image rendering with state-based `onError` fallback swap using a plain `<img>` (no `next/image`) (AC6, AC7).
- [x] 8. Implement the `loading` skeleton state with `aria-busy="true"` and layout-matching placeholder blocks (AC8).
- [x] 9. Implement the `error` state rendering, mutually exclusive with `loading` and the normal event-data render path (AC9).
- [x] 10. Implement the reserved favorite and add-to-calendar slots: render each accessible toggle/button control only when its respective `on*` handler prop is provided (AC11).
- [x] 11. Structure markup with semantic HTML and keyboard-focusable interactive elements (AC12).
- [x] 12. Add the `labels` override prop (with English defaults) for all internally-rendered microcopy (AC13).
- [x] 13. Export `EventDetailView`, `EventDetailViewProps`, `ScheduleDetail`, and any sub-types from `packages/ui/src/features/events/index.ts` (create the file if Story 1.3b/1.3c/1.4/1.5a haven't already; otherwise extend it — check for naming conflicts before adding), and re-export via `packages/ui/src/index.ts` (AC14).
- [x] 14. Add TSDoc comments to the component and its props documenting purpose, defaults, and reuse guidance (AC14).
- [x] 15. Write component tests (Vitest + `@testing-library/react`) covering: full-data render with multiple schedules, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy`, error state, map link present/absent, tag rendering present/absent, and favorite/calendar controls hidden when their handlers are absent (AC1–AC14; use `@festgrid/testing-config/vitest-react` per Testing Requirements).
- [x] 16. **(Added 2026-08-01, source-attribution amendment, AC15):** Implement the `originalPostUrl`/`sourcePostUrl` optional props on `EventDetailViewProps`; render an attribution link for each one present, omit the section entirely when both are absent. Add component tests: both links present, only `originalPostUrl` present, only `sourcePostUrl` present, neither present (no broken/empty section rendered).
- [x] 17. **(Added 2026-08-02, account-attribution amendment, AC16):** Implement the `accountName`/`accountPlatformIconUrl`/`accountHref` optional props on `EventDetailViewProps`; render the account's platform icon + name as a link to `accountHref` when all three are present, omit the section entirely otherwise. Add component tests: all three present (renders link), any one missing (section omitted), and confirm this section renders independently alongside AC15's source-post attribution links (both present simultaneously).
- [x] 18. **(Added 2026-08-26, video amendment, AC17/AC18/AC19):** Add `videoUrl?: string | null`, `videoAlt?: string | null`, and `imageFallbackUrl?: string | null` to `EventDetailViewProps` (`EventDetailView.types.ts`). Add an optional `videoUnavailableLabel?: string` to `EventDetailViewLabels` with a sensible English default (mirroring the `reportMenuItemLabel` optional-with-default precedent), used for AC18's explanatory copy.
- [x] 19. **(Added 2026-08-26, video amendment, AC17):** Give `EventImage.tsx` (the single existing owner of the media slot — extend it rather than build a parallel sibling component, to avoid duplicating the skeleton/placeholder container) a video-capable rendering path: when `videoUrl` is passed, mount a `<video autoPlay muted loop playsInline>` sized/positioned identically to the existing `<img>` (`w-full h-full object-cover` inside the existing `aspect-video` container). Track a `videoReady` state (set via the video element's `onCanPlay`/`onLoadedData`) so the poster `<img>` stays the visible content until the video is actually ready to play, and a `videoError` state (set via the video element's `onError`) so a failed video falls back to the poster-image render path (AC7's existing fallback chain) rather than showing a broken player.
- [x] 20. **(Added 2026-08-26, video amendment, AC19):** Wire `imageFallbackUrl` into `EventImage`'s existing image `onError` handler as a secondary retry: on the image's first `onError`, if `imageFallbackUrl` is present and hasn't been tried yet, swap the rendered `src` to it instead of immediately showing the placeholder icon; only show the placeholder icon if the fallback also errors (or no `imageFallbackUrl` was provided).
- [x] 21. **(Added 2026-08-26, video amendment, AC18):** When `videoError` becomes true and at least one of `originalPostUrl`/`sourcePostUrl` is present, render the `videoUnavailableLabel` copy plus the existing AC15 attribution link(s) inline near the media element (not only in the page-level attribution footer at lines ~396-405, which already renders unconditionally when those props are present) — this is the failure-specific surfacing the AC requires, reusing the AC15 props with no new URL plumbing. **Note (see Dev Agent Record):** the inline link's own visible text also reuses `labels.viewOriginalPostLabel`/`labels.viewSourceLabel` (matching which of `originalPostUrl`/`sourcePostUrl` is present) rather than a hardcoded string — fixed during independent verification, see below.
- [x] 22. **(Added 2026-08-26, video amendment, AC17):** Wire `EventDetailView.tsx`'s render call (currently `<EventImage imageUrl={imageUrl} imageAlt={imageAlt} eventName={eventName} />` at line ~254) to also pass `videoUrl`, `videoAlt`, `imageFallbackUrl`, `originalPostUrl`, `sourcePostUrl`, and the resolved `videoUnavailableLabel` through to `EventImage` — `EventImage` needs all of these to implement AC17/AC18 itself, since the media rendering (including the failure-attribution note) lives there, not in `EventDetailView.tsx` directly.
- [x] 23. **(Added 2026-08-26, video amendment, AC17/AC18/AC19):** Add component tests (following the existing `EventDetailView.test.tsx` image-success/image-fallback pattern at lines 117-135): video renders (`<video>` present with `autoPlay`/`muted`/`loop`/`playsInline`, `src`/matching `videoUrl`) when `videoUrl` is provided; on video error, falls back to the poster image and shows the AC18 attribution note+link when `originalPostUrl`/`sourcePostUrl` is present; image-only path (no `videoUrl`) is unchanged from the existing AC6/AC7 tests; `imageFallbackUrl` retry — image `onError` swaps to the fallback URL, and only shows the placeholder icon if the fallback also errors.

## Dev Notes

- This is a net-new, presentation-only component story — no existing files needed to be read as "files being modified" beyond `packages/ui`'s barrel exports (`packages/ui/src/index.ts`, and `packages/ui/src/features/events/index.ts` if Story 1.3b/1.3c/1.4/1.5a already created it — confirmed by directory listing that today only `packages/ui/src/core/app-shell/` exists; no `packages/ui/src/features/` folder exists yet, so this story may be the one that creates it, or may extend it if a sibling events-feature story lands first).
- Previous story in sequence (by story-number ordering within Epic 1, `1-5-filter-events-by-type-and-category.md`) is `apps/web`-side (Filter Hub wiring, `nuqs` URL state, DSL query-building) with zero file overlap with this `packages/ui`-only story — no dev-notes/learnings carry over, matching the same "no overlap" conclusion Story 1.3b reached against its own predecessor.
- The stale, pre-split `1-6-view-event-details.md` story file (written before this Gate-2 split existed) still describes building an `EventDetails` component directly at `apps/web/components/events/EventDetails.tsx`. That plan is now superseded by this story: the reusable display component belongs in `packages/ui/src/features/events/EventDetailView.tsx` per `project-context.md`'s "Domain Features" rule, and Story 1.6 (not this story) is responsible for wiring `EventDetailView` into the modal/full-page routes, GraphQL data fetching, and `ContextAwareNavigation`. This story does not update `1-6-view-event-details.md` — that reconciliation happens if/when Story 1.6 is next touched.
- Recent commit history (`0.16`, `0.17`, `0.9`, `1.2a` implementation artifacts) shows a consistent pattern of small, tightly-scoped packages/adapters — the only frontend-component precedent to reuse is `packages/ui/src/core/app-shell/AppShell.tsx` and, by convention, the (not-yet-implemented) `EventCard` plan from Story 1.3b.

### Amendment 2026-08-26 — Video Priority Display (Track B, Wave 1 of `sprint-change-proposal-2026-08-25-video-priority-display.md`)

- **Trigger:** Reopened via `bmad-correct-course` — Instagram Reels/clips carry a video that should be the primary media in the event detail view when present, per the SCP's Section 1.3 decisions (already resolved, not open questions for this story): autoplay/muted/looped, no controls for v1, fallback to the poster image plus a link to the original post on failure.
- **Scope boundary — presentation-only, no real backend data yet:** This amendment builds against a `videoUrl` prop contract only. The real GraphQL `videoUrl` field does **not** exist yet — that's the SCP's independent, parallel-running sibling amendment (Story 3.3c + a new DB/GraphQL story, same Wave 1). This story does not wait on it, does not touch any GraphQL query/resolver, and does not touch `EventDetailView`'s data-fetching wrapper (that wiring is Story 1.6's own amendment, Wave 2, blocked on both this story and the GraphQL field). Also independent of Story 0.33's S3/CloudFront infra work (Track A) — this story does not touch `imageFallbackUrl`'s eventual real value, only adds and wires the prop.
- **Component ownership decision:** Extend `EventImage.tsx` in place with conditional video rendering rather than build a new adjacent component. `EventImage` already owns the single media slot (the `aspect-video` container, the poster `<img>`, and the existing `onError`→placeholder-icon fallback) — duplicating that container/skeleton logic in a new sibling component would create two divergent poster-image implementations to keep in sync. `EventDetailView.tsx` continues to render one `<EventImage>` call site (line ~254); `EventImage` internally decides whether to show the poster only, poster-then-video, or poster-plus-failure-note based on the new props.
- **State machine inside `EventImage`:** three independent failure/readiness signals, not one — (1) `imageError` (existing, from AC7) for the poster image itself; (2) `videoReady` (new) for whether the video has become playable (`onCanPlay`/`onLoadedData`), gating when the video visually replaces the poster; (3) `videoError` (new) for whether the video failed, which reverts to the poster-image path and (per AC18) surfaces the attribution note. `videoReady`/`videoError` only matter when `videoUrl` is present; when it's absent, the component's behavior is identical to before this amendment (AC17's explicit no-regression requirement).
- **Labels:** `videoUnavailableLabel` is added as an *optional* field on `EventDetailViewLabels` (not required) with a hardcoded English default inside the component, following the exact precedent already set by `reportMenuItemLabel` (optional, `labels.reportMenuItemLabel || 'Report'`) — this avoids forcing every existing call site/test (including Story 1.6's real consumer, not yet updated) to supply a new required field just to keep compiling.
- **No fresh Gate 1/2/3 run required:** the SCP (`sprint-change-proposal-2026-08-25-video-priority-display.md` Section 1.3) already resolved the only genuinely open UX/architecture questions for this scope (playback behavior, failure fallback) via `AskUserQuestion` during its own drafting — there is no undecided UI-complexity or architecture-completeness question left for Gate 1/2 to surface. Gate 3 (cross-cutting foundational dependency): none introduced — no new external service, shared infra, or tooling gap; this reuses `EventImage`'s existing container/fallback pattern and the AC15 attribution props verbatim.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `epic-readiness/epic-1-readiness.md` is marked `swept: true` and explicitly lists story `1.6a` in `stories_covered`. Its Gate 1 finding states: *"No other Gate 1 violations found: 1.1–1.6/1.3b/1.6a/1.8 all route data access through 1.3a's GraphQL API with no frontend→DB bypass, reusable components correctly scoped to `packages/ui`..."* — no gap applies to this story specifically. The report's one Gate 1/3 gap (missing GraphQL auth-context layer, resolved by Story 0.17) does not affect this presentation-only component, which has zero data-fetching responsibility.
- **Gate 2 (run fresh, per-story as required):** Ran via subagent adopting the Freya (`wds-agent-freya-ux`) persona against the draft AC (verbatim from `epics.md`'s terser "### Story 1.6a" entry) and the authoritative UX sources (`design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md`, `design-artifacts/UX-festgrid-run-1/DESIGN.md`, `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`, PRD §4.1/§4.4). Findings, all folded into this story's expanded AC list rather than split further:
  - The epics.md draft AC's field list ("name, description, date and time, location, performers, image") omitted **ticket price** and **category/type tags**, both explicitly mandated by the scenario (line 37: "Ticket Price"; line 38: "Category and Type tags") and `EXPERIENCE.md` ("...opens a modal with the full event details, including a clear display of its types and categories as tags"). **Resolution:** AC3 (ticket price) and AC5 (type/category tags).
  - "Date and time" was singular in the draft AC, but the scenario shows one event with **two distinct schedules** ("Saturday Session," "Sunday Session") both requiring display, and the PRD's `EventInfo.schedules: Schedule[]` is inherently an array. **Resolution:** AC2 explicitly requires rendering every schedule, not just a primary one — a materially different requirement from `EventCard` (Story 1.3b AC1), which correctly only needs a single primary schedule's start date for a compact list card.
  - PRD §4.4 places `performers`, `ticketPrice`, and `location` on `Schedule`, not on top-level `EventInfo` (`EventInfo.location` is the general/fallback location only). **Resolution:** AC3 renders these per-schedule with an event-level `location` fallback, rather than assuming one flat set of fields for the whole event.
  - The scenario mandates "Location (with a tappable map link)," but `packages/ui` has no maps SDK/config dependency (same decoupling principle as `EventCard`'s `imageUrl`). **Resolution:** AC4 accepts an already-constructed `mapUrl` string from the caller; the component only renders the link when present.
  - The scenario places the Favorite toggle and Add-to-Calendar action on this exact page, but wiring the actual mutations here would violate Gate 1 (Story 1.6's data-fetching/mutation wiring, Story 2.1/2.1a's favorite mutation, and calendar-add logic don't exist yet). **Resolution:** AC11 reserves `isFavorited`/`onFavoriteToggle` and `isAddedToCalendar`/`onAddToCalendar` prop slots now (unwired), mirroring `EventCard`'s AC7 precedent, so Story 1.6/2.1/2.1a can wire real behavior later without a breaking prop-shape change.
  - Consistency requirements carried over from `EventCard` (Story 1.3b) apply equally here since both live in the same framework-agnostic `packages/ui` package: native `Intl.DateTimeFormat` instead of `next-intl` (AC2), a `labels` override prop for internal microcopy (AC13), a plain `<img>` instead of `next/image` (AC6/AC7), and a semantic/keyboard-accessible root structure (AC12).
  - **No further splitting warranted:** every addition above is still purely presentational/read-only content (or a reserved-but-unwired prop slot, per the established `EventCard` pattern) — none introduces new interactive/mutation behavior or a new backend dependency, so Gate 2 concluded this stays one story rather than splitting further.
- **Lightweight guard — gaps the epic-wide sweep did not anticipate:** None found. This story introduces no new external service, no new data entity, and no cross-cutting tooling gap beyond what Gate 1/3's swept report already covers; it consumes the same `EventInfo`/`Schedule` shape already fully modeled in `packages/shared-types` and the PRD.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. `packages/shared-types/src/index.ts`'s `EventInfo` and `Schedule` interfaces already carry every field this component needs to render (`eventName`, `description`, `schedules[]` with `eventStartDate`/`eventEndDate`/`eventStartTime`/`eventEndTime`/`title`/`performers`/`location`/`ticketPrice`/`locationDetails`, top-level `location`, and — via Story 1.2a/1.3a's already-planned `postId` → `posts` join — a runtime-computed `imageUrl`). No DB schema or shared-type changes are required for this story.
- **Impacted fields/contracts:** None new. This component only consumes props; it has no direct dependency on the database, GraphQL schema, or resolvers. `imageUrl` and `mapUrl` are both accepted as already-resolved strings from the caller (same decoupling as `EventCard`'s `imageUrl`, established in Story 1.3b's Data Type Compatibility section) — this story does not depend on Story 1.2a/1.3a landing first.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required to `packages/shared-types`. This story defines its own local, decoupled `EventDetailViewProps`/`ScheduleDetail` prop types in `packages/ui` (not a re-export of `EventInfo`/`Schedule`), so `packages/ui` never takes a compile-time dependency on `@festgrid/shared-types`' backend-oriented shape — consistent with `EventCard`'s approach.
- **Backward compatibility and rollout notes:** Not applicable — net-new component, no existing consumers to break. Story 1.6 will be the first real caller and is responsible for mapping fetched `EventInfo`/`Schedule` GraphQL data onto this component's prop shape (including resolving `mapUrl` from `Schedule.locationDetails.coordinates` if/when that mapping is implemented — out of scope here, see Out of Scope).
- **Verification checks:** This story's own component tests cover both the full data shape (multiple schedules, all optional fields present) and the minimal guaranteed shape (AC10). End-to-end verification against real event/schedule data is not possible until Story 1.6 wires live GraphQL data into this component; track that separately when Story 1.6 is picked up.
- **(Amendment 2026-08-26) Compatibility finding:** No mismatch. `videoUrl`/`videoAlt`/`imageFallbackUrl` are added as optional, decoupled prop fields on `EventDetailViewProps` — same pattern as `imageUrl`/`mapUrl`/the AC15/AC16 attribution props — not a re-export of any `packages/shared-types` interface. This story does not depend on and does not wait on the real `Post.videoUrl` GraphQL field (a parallel, independent Story 3.3c + new-DB/GraphQL-story amendment in the same SCP Wave 1) — it builds and tests entirely against the prop contract. No DB schema or shared-type changes are made by this story.

### Project Structure Notes

- New files live under `packages/ui/src/features/events/`, per `project-context.md`'s "Domain Features" convention (`packages/ui/src/features/<domain>/...`), alongside the (not-yet-implemented) `EventCard.tsx` from Story 1.3b.
- Only existing files potentially touched: `packages/ui/src/index.ts` (barrel re-export) and, if it already exists from a sibling events-feature story, `packages/ui/src/features/events/index.ts` — otherwise this story creates it. No conflicts with `apps/backend` or `apps/web` work (different package entirely).
- `packages/ui`'s existing component (`AppShell.tsx`) establishes the pattern this story must follow: plain Tailwind classes, native HTML elements, `lucide-react` for icons, no Next.js-specific APIs (`next/link`, `next/image`), no `next-intl` — labels/URLs are passed in as already-resolved props by the consuming `apps/web` app. `EventCard` (Story 1.3b, not yet implemented but already specced) establishes the same pattern for event-domain components specifically and should be treated as the closest sibling precedent when Story 1.3b lands.
- **(Amendment 2026-08-26)** `EventImage.tsx` (`packages/ui/src/features/events/EventImage.tsx`, already implemented) is a file being MODIFIED by this amendment — read it in full before touching it. Current state: a `"use client"` component with a single `imageError` boolean state, rendering either the poster `<img>` with `onError={() => setImageError(true)}`, or a centered `ImageIcon` placeholder, inside a `w-full relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center` container. Current props: `imageUrl?`, `imageAlt?`, `eventName` (required). What this amendment changes: adds `videoUrl?`, `videoAlt?`, `imageFallbackUrl?`, `originalPostUrl?`, `sourcePostUrl?`, `videoUnavailableLabel?`, `viewOriginalPostLabel?`, `viewSourceLabel?` props and the `videoReady`/`videoError` state machine (see the Amendment Dev Notes above). What must be preserved: the existing `imageError` behavior and placeholder-icon fallback exactly as-is when `videoUrl` is absent (AC17's no-regression requirement).

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Domain vs UI), UI Patterns & UX Invariants (loaders), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-6] — i18n/locale strategy (labels-prop pattern).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6a] and neighboring Stories 1.3b, 1.5a, 1.6.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report covering this story.
- [Source: _bmad-output/implementation-artifacts/1-3b-build-the-reusable-eventcard-component.md] — sibling reusable-component precedent (framework-agnostic patterns, reserved-favorite-slot pattern, decoupled `imageUrl`).
- [Source: packages/testing-config/] — shared Vitest/MSW config (Story 0.10), consumed via `@festgrid/testing-config/vitest-react`.
- [Source: design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md] — authoritative event-detail-page scenario (field list, Favorite/Add-to-Calendar placement).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md], [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — design tokens (`modal` component) and interaction patterns (type/category tag display).
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.1] (`EventInfo`), [#4.4] (`Schedule`), [#4.3] (`LocationDetails`), [#3.12] (Context-Aware Detail Views, loaders).
- [Source: packages/shared-types/src/index.ts] — confirmed current `EventInfo`/`Schedule` field shapes, no mismatch.
- [Source: packages/ui/src/core/app-shell/AppShell.tsx] — established `packages/ui` component conventions (plain Tailwind, no Next.js coupling).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1a] and [#Story-3.11] — `SocialMediaAccountProfile.accountId`/`platform` fields and the public account page (`/{platformSlug}/{accountId}`) this story's AC16 links to, added via `bmad-correct-course` (2026-08-02).
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-25-video-priority-display.md] — Section 1.3 (decisions: autoplay/muted/looped, fallback-to-image-plus-link-on-failure), Section 4.5 (this story's exact scope), Section 4.4/AD-12 (the parallel, independent image-durability track this story does not build against, only forward-compatibly wires the `imageFallbackUrl` prop for).
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.4] — bullet 3.3.5 (Video Prioritization requirement, added by the SCP above).
- [Source: packages/ui/src/features/events/EventImage.tsx] — the file this amendment modifies; current implementation read in full during story creation (see Project Structure Notes above).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Domain Features), UI Patterns & UX Invariants (skeleton/loading, Context-Aware Detail Views), i18n rules.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n/locale strategy).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/features/events/EventDetailView.tsx` — component implementation.
  - NEW `packages/ui/src/features/events/EventDetailView.types.ts` — `EventDetailViewProps`, `ScheduleDetail`, and related types.
  - NEW `packages/ui/src/features/events/EventDetailView.test.tsx` — component tests.
  - **(Amendment, AC15)** `EventDetailView.tsx`/`.types.ts`/`.test.tsx` above also cover the new `originalPostUrl`/`sourcePostUrl` optional props — no additional new files.
  - **(Amendment, AC16)** `EventDetailView.tsx`/`.types.ts`/`.test.tsx` above also cover the new `accountName`/`accountPlatformIconUrl`/`accountHref` optional props — no additional new files. `accountHref` is a fully-resolved `/{platformSlug}/{accountId}` URL string (Story 3.11) built by the caller; this component does not construct it.
  - NEW-OR-UPDATE `packages/ui/src/features/events/index.ts` — barrel export for the `events` feature folder; create it if no sibling events-feature story has landed yet, otherwise extend it (check for naming conflicts with `EventCard`/`FilterHub` exports first).
  - UPDATE `packages/ui/src/index.ts` — add `export * from './features/events';` if not already present.
  - NEW-OR-VERIFY `packages/ui/vitest.config.ts` — `mergeConfig(reactConfig, defineConfig({}))` importing `@festgrid/testing-config/vitest-react`, matching the pattern already used by `packages/analytics/vitest.config.ts` and `apps/web/vitest.config.ts` (Story 0.10's `@festgrid/testing-config` package exists with `vitest-react.ts`/`msw-handlers.ts`); create only if Story 1.3b/1.3c/1.4/1.5a hasn't already added it.
  - NEW-OR-VERIFY `packages/ui/package.json` — `"test": "vitest run"` script and devDependencies `@festgrid/testing-config` (workspace), `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`; add only if not already present from a sibling `packages/ui` story.
  - **(Amendment 2026-08-26)** UPDATE `packages/ui/src/features/events/EventImage.tsx` — add `videoUrl`/`videoAlt`/`imageFallbackUrl`/`originalPostUrl`/`sourcePostUrl`/`videoUnavailableLabel`/`viewOriginalPostLabel`/`viewSourceLabel` props and the video-capable rendering path (AC17-AC19). No new file — extends the existing single media-slot owner (see Dev Notes decision above).
  - **(Amendment 2026-08-26)** UPDATE `packages/ui/src/features/events/EventDetailView.types.ts` — add `videoUrl?`, `videoAlt?`, `imageFallbackUrl?` to `EventDetailViewProps`; add `videoUnavailableLabel?` to `EventDetailViewLabels`.
  - **(Amendment 2026-08-26)** UPDATE `packages/ui/src/features/events/EventDetailView.tsx` — pass the new props through to `EventImage` at the existing render call site (~line 254).
  - **(Amendment 2026-08-26)** UPDATE `packages/ui/src/features/events/EventDetailView.test.tsx` — new tests per Task 23.
- **Rule Mapping:**
  - *UI Components & Scalability (Domain Features)* → component placed in `packages/ui/src/features/events/`.
  - *i18n foundational principle (AD-6)* → `labels` override prop pattern, no direct `next-intl` dependency inside `packages/ui`.
  - *UI Patterns & UX Invariants (Context-Aware Detail Views / loaders)* → `loading` skeleton and `error` state props give Story 1.6's modal and full-page routes an identical, invocation-agnostic contract.
  - *Data Type Compatibility* → `imageUrl`/`mapUrl` kept generic/decoupled from `EventInfo`/`LocationDetails`, per the section above.
  - *Testing Philosophy (testing trophy)* → integration-style component tests via Vitest + Testing Library, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: full-data render with multiple schedules, minimal-guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton `aria-busy` attribute, error-state render, map link present/absent, type/category tag rendering present/absent, and favorite/calendar controls absent when their handler props are not passed.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing renders `EventDetailView` on a real page or in a real modal yet — that lands with Story 1.6).

## Pre-Coding Approval Gate

- [x] Scope confirmed: build `EventDetailView` as a standalone, presentation-only UI component in `packages/ui`; no backend work, no live-data wiring into any page/modal route, no Favorite/Add-to-Calendar mutation logic, no Next/Previous navigation (all handled by Story 1.6 and Epic 2 stories).
- [x] Architecture confirmed: component built with plain Tailwind + native HTML elements only (no `next/image`, no `next-intl`, no maps SDK), placed under `packages/ui/src/features/events/`.
- [x] Testing plan confirmed: Vitest + `@testing-library/react` component tests via `packages/ui/vitest.config.ts` importing `@festgrid/testing-config/vitest-react`.
- [x] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story); Gate 2 findings (missing ticket-price/type-category-tag fields, per-schedule vs top-level field ownership, multi-schedule rendering, map-link decoupling, reserved favorite/calendar slots) are folded into this story's expanded AC1–AC14 rather than split further — no new prerequisite story required.
- [x] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [x] Component tests (Vitest + `@testing-library/react`) for: full-data render with multiple schedules, minimal/guaranteed-fields-only render, image success, image error fallback, no-`imageUrl` fallback, loading skeleton (`aria-busy`), error state, map link present/absent, type/category tag rendering present/absent, and favorite/calendar controls hidden when their handler props are absent.
- [x] No E2E test required for this story (no live page or modal consumes `EventDetailView` yet; E2E coverage arrives with Story 1.6's modal-open and deep-link fallback flows).
- [x] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per project-context.md; `packages/ui` follows the "testing trophy" integration-style approach.
- [x] Note: Use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup.
- [x] **(Amendment 2026-08-26)** Component tests for: video renders when `videoUrl` present (correct `<video>` attributes); video falls back to poster image on `onError`; video-failure attribution note+link appears when `originalPostUrl`/`sourcePostUrl` present; image-only path unchanged when `videoUrl` absent (existing tests still pass); `imageFallbackUrl` `onError`-retry chain (fallback tried before placeholder icon).

## Deliverables Checklist

- [x] `EventDetailView` component implemented in `packages/ui/src/features/events/EventDetailView.tsx`.
- [x] Strictly-typed `EventDetailViewProps`/`ScheduleDetail` covering all guaranteed and optional fields (`EventDetailView.types.ts`).
- [x] Multi-schedule rendering (date/time/performers/location/price per schedule, event-level location fallback).
- [x] Optional map link rendering, decoupled from any maps SDK.
- [x] Type/category tag rendering, omitted when absent.
- [x] Loading skeleton state with `aria-busy`.
- [x] Error state rendering.
- [x] Image success + fallback/placeholder handling (no-`imageUrl` and `onError` cases).
- [x] Reserved (unwired) favorite and add-to-calendar slots.
- [x] Semantic, keyboard-navigable structure.
- [x] `labels` override prop for i18n-readiness.
- [x] Exported from `packages/ui`'s public entry point with TSDoc prop documentation.
- [x] Component tests written and passing.
- [x] **(Amendment, AC15)** Optional `originalPostUrl`/`sourcePostUrl` attribution links, each independently omittable, with component tests for all four presence/absence combinations.
- [x] **(Amendment, AC16)** Optional `accountName`/`accountPlatformIconUrl`/`accountHref` account-attribution link (all-or-nothing), rendering independently alongside the AC15 source-post links, with component tests covering both present-together and each-missing cases.
- [x] **(Amendment 2026-08-26, AC17)** Optional `videoUrl`/`videoAlt` props; video-capable rendering (`<video autoPlay muted loop playsInline>`) in `EventImage`, poster image as pre-ready loading state and as failure fallback, no regression to the image-only path.
- [x] **(Amendment 2026-08-26, AC18)** Video-failure-specific attribution note + AC15 link(s) surfaced near the media element, link text sourced from `labels.viewOriginalPostLabel`/`labels.viewSourceLabel` (i18n-ready, fixed during independent verification).
- [x] **(Amendment 2026-08-26, AC19)** Optional `imageFallbackUrl` prop wired into the image's existing `onError` as a secondary retry before the placeholder icon.
- [x] **(Amendment 2026-08-26)** Component tests for all three items above, plus confirmation the existing image-only tests still pass unmodified (all 303 `packages/ui` tests pass, no regressions).

## Out of Scope

- Wiring `EventDetailView` into the actual modal route (`@modal/(.)events/[slug]`) or full-page route (`/events/[slug]`) — handled by Story 1.6.
- Live GraphQL data fetching / real event data, and mapping fetched `EventInfo`/`Schedule` data onto this component's props — handled by Story 1.6.
- Interactive favorite/unfavorite mutation logic — handled by Story 2.1 and Story 2.1a; this story only reserves the prop slot (AC11).
- Interactive add-to-calendar mutation/dialog logic — handled by a future Epic 2 story; this story only reserves the prop slot (AC11).
- Constructing `mapUrl` from `LocationDetails.coordinates` (e.g. building a Google Maps deep link) — the caller's responsibility (Story 1.6); this component only renders an already-constructed URL if provided.
- Next/Previous context-aware navigation (`ContextAwareNavigation`) — handled by Story 1.6 per its own Dev Notes.
- Reconciling or rewriting the stale `1-6-view-event-details.md` story file's outdated component-location plan — not this story's responsibility; noted for awareness only.
- Storybook, visual-regression, or design-token tooling — not set up anywhere in this project yet.
- **(Amendment 2026-08-26)** The real GraphQL `videoUrl`/`durableImageUrl` fields, and any resolver logic that computes/populates them — Story 3.3c's amendment and the SCP's new DB/GraphQL story (Wave 1, running in parallel) own that; this story only builds against the prop contract.
- **(Amendment 2026-08-26)** Wiring `videoUrl`/`imageFallbackUrl` from real fetched data into `EventDetailView`'s consumer — Story 1.6's own amendment (Wave 2, blocked on this story landing plus the GraphQL field existing).
- **(Amendment 2026-08-26)** Any AWS/S3/CloudFront infrastructure, image re-hosting pipeline logic, or expiry-computation logic (Track A / Story 0.33 / AD-12) — fully independent of and not built by this story.
- **(Amendment 2026-08-26)** Manual video playback controls (play/pause/scrub/volume) — explicitly deferred past v1 per the SCP's decision; no player library is introduced.

## Definition of Done

- [x] All Acceptance Criteria (AC1–AC16) are met.
- [x] Required component tests (see Testing Requirements) are written and passing.
- [x] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [x] `EventDetailView` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [x] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.
- [x] **(Amendment 2026-08-26)** All Acceptance Criteria (AC17–AC19) are met.
- [x] **(Amendment 2026-08-26)** New component tests (Task 23) are written and passing, and the existing full test suite (`pnpm --filter @festgrid/ui test`) still passes with no regressions.
- [x] **(Amendment 2026-08-26)** Lint and TypeScript strict-mode checks pass for `packages/ui` after the amendment.

## Completion Status

- [x] Completed. **Reopened 2026-08-26** via `bmad-correct-course` (`sprint-change-proposal-2026-08-25-video-priority-display.md`) for the AC17-AC19 video-priority-display amendment, implemented and independently verified same day. AC1-AC16 (everything above this amendment) were already implemented and unaffected.

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) — original AC1-16 build.
**(Amendment 2026-08-26)** Cline CLI (dispatched implementation in an isolated git worktree, `.claude/worktrees/1-6a`, branch `1-6a-video-component`) for AC17-19, with independent verification and two fixes applied directly afterward by the orchestrating session (Claude Sonnet 5).

### Debug Log References

- Tests run successfully using `pnpm --filter @festgrid/ui test`.
- TS typechecks passed.
- **(Amendment 2026-08-26)** Full `packages/ui` suite independently re-run after the amendment: 41 test files, 303 tests, all passing (includes the 3 new video/fallback test cases). `eslint` on the 4 changed files: 0 errors, 2 pre-existing warnings (both predate this amendment, in unrelated lines of `EventDetailView.tsx`). `apps/web` full-project `tsc --noEmit` run as an additional consumer-side check: pre-existing errors only, confined to unrelated test/mock files (auth-session-provider tests, MSW resolver signature mismatches, posts-select tests) — zero errors in any file this amendment touched.

### Completion Notes List

- Developed `EventDetailView` per all AC requirements.
- Implemented multi-schedule rendering and optional attribution links (AC15, AC16).
- Tests verified full functionality and component state handling.
- Used Tailwind classes, `lucide-react`, standard HTML elements.
- **(Amendment 2026-08-26)** Extended `EventImage.tsx` in place (not a new sibling component) with a `videoReady`/`videoError` state machine, a `<video autoPlay muted loop playsInline>` render path, the `imageFallbackUrl` two-strike `onError` retry, and an inline video-failure attribution note.
- **(Amendment 2026-08-26)** Independent verification found one real issue in the first-pass implementation: the video-failure note's link text was hardcoded (`"Original Post"`) instead of reusing the existing `labels.viewOriginalPostLabel`/`labels.viewSourceLabel` i18n props — a violation of this project's labels-prop i18n pattern (AC13/AD-6), same category as a prior fix on Story 3.3b's `AccountLocationField`. Fixed by threading `viewOriginalPostLabel`/`viewSourceLabel` through to `EventImage` and selecting the correct one based on which of `originalPostUrl`/`sourcePostUrl` is present. Also replaced two `as any` casts in the new video-attributes test with a proper `HTMLVideoElement` cast, clearing the only two new lint warnings the amendment had introduced. Both fixes verified not to break any existing or new test (303/303 still pass).
- **(Amendment 2026-08-26)** Process note for future amendments: the amended story file and `sprint-status.yaml` edits were initially made in the main repo's working tree before the dedicated worktree existed, so the isolated worktree's initial checkout did not carry them — the dispatched implementer worked from the dispatch prompt's inlined spec (self-contained) plus the SCP directly instead. The story file itself was not affected in substance (the dispatch prompt mirrored it closely), but going forward: create the worktree first, or copy any in-flight doc edits into it explicitly before dispatch, rather than relying on `git worktree add` to pick up uncommitted main-repo changes (it only checks out committed refs).

### File List

- `packages/ui/src/features/events/EventDetailView.tsx`
- `packages/ui/src/features/events/EventDetailView.types.ts`
- `packages/ui/src/features/events/EventDetailView.test.tsx`
- `packages/ui/src/features/events/index.ts`
- **(Amendment 2026-08-26)** `packages/ui/src/features/events/EventImage.tsx` (extended, not new)
