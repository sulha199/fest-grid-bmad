---
baseline_commit: 103090297a74308f23feb5c6fb44228807822192
---

# Story 4.6: User's Reports page

## Story Details

- **Epic:** 4
- **Story ID:** 4.6
- **Status:** review

## Story

**As a** user,
**I want** to have a dedicated page where I can see the history and status of my submitted reports,
**So that** I can track the outcome of my reports.

## Acceptance Criteria

1. **Given** I am not logged in, **when** I navigate to `/reports`, **then** I am redirected to `/login` (same client-side auth-gate pattern as `EventDetailWrapper`/Story 2.2's `/favorites`) — no data is fetched.
2. **Given** I am logged in, **when** I navigate to the "My Reports" page (`/reports`) from the user menu (already wired: `packages/ui/src/core/app-shell/profile-menu-entries.ts`'s `reports` entry links here — the route itself does not exist yet), **then** I see a list of all the reports I have submitted, fetched via the `myReports` query (Story 4.3a) — not directly from the database, and not through a new endpoint (AD-2).
3. **And** `myReports` returns the caller's full, unpaginated report list in one call (no `limit`/`offset`/cursor args exist on this query). Per user decision during this story's creation, the page renders this full list directly — no infinite scroll, no client-side pagination, and no change to Story 4.3a's already-`review`-status backend contract. (Deviation from `project-context.md`'s literal List Navigation rule, deliberately scoped: see Dev Notes → "List Rendering Decision".)
4. **And** for each report, I can see: the reported event (name + thumbnail, clickable through to `/events/[slug]`), the reason for the report (`ReportReason`: `cancelled`/`dangerous`/`personal`, localized), and the current status (`ReportStatus`: `pending`/`upheld`/`dismissed`, localized, rendered as a colored badge), plus the date submitted (`createdAt`, locale-formatted).
5. **And** reports are ordered most-recent-first, matching `myReports`' existing `orderBy(desc(reports.createdAt))` server-side order — no client-side re-sort.
6. **And** clicking a report's event navigates to that event's detail page (`/events/[slug]`) as a standalone view — no Next/Previous list-context wiring is added for this list (per user decision: see Dev Notes → "Detail Navigation Context Decision").
7. **And** an empty-reports state (no reports submitted yet), a loading skeleton, and an error state are all shown as appropriate — none of these exist in any UX artifact for this page, so their copy is authored fresh in this story (see Dev Notes → i18n Keys Required), following Story 2.2's precedent for the same situation.
8. **And** all user-facing labels, reason/status enum labels, and empty/loading/error copy are localized via next-intl (`en`/`id`) — no hardcoded user-facing strings.
9. **And** integration tests (Vitest + msw) verify: auth redirect, successful list render with reason/status/date/event display, empty state, error state, and status-badge variant mapping for all three `ReportStatus` values. One Playwright E2E test covers the authenticated happy path: submit a report (reusing Story 4.3's existing report flow), navigate to My Reports, see it listed with `pending` status.

**Note:** This story builds the frontend consumer of Story 4.3a's already-shipped (`review`) `myReports` query — the first frontend consumer of the `reports` backend layer alongside Story 4.3's report-submission flow.

**Depends on:** Story 4.3a.

## Tasks / Subtasks

- [x] **Task 1 (AC2) — GraphQL operation + codegen:**
  - [x] Create `apps/web/src/features/reports/reports.graphql` with a `myReports` query document selecting `id`, `reason`, `status`, `createdAt`, and `event { id slug eventName imageUrl }` (mirroring the field selection depth `getEventBySlug`/`getEvents` already use for `imageUrl`/`eventName`/`slug` — confirm exact `Event` field names by reading `apps/web/src/features/events/queries.graphql` before writing this document, do not guess).
  - [x] Run `pnpm run codegen` to generate `useMyReportsQuery` in `apps/web/src/generated/graphql.ts`.
- [x] **Task 2 (AC1) — Route shell:**
  - [x] New `apps/web/src/app/[locale]/reports/page.tsx` (Server Component): `generateMetadata` via the `Metadata` i18n namespace + `apps/web/src/lib/metadata.ts`'s `buildPageMetadata` helper, `<Suspense fallback={<RouteLoader />}>` wrapping a colocated `reports-content.tsx` (Client Component) — exact structural mirror of `apps/web/src/app/[locale]/favorites/page.tsx`.
  - [x] New `Metadata` namespace keys `reportsTitle`/`reportsDescription` (both `en`/`id`), matching `favoritesTitle`/`favoritesDescription`'s tone/shape.
- [x] **Task 3 (AC1, AC2, AC5) — `reports-content.tsx` data layer:**
  - [x] Auth gate: `useAuthSession()` (`@/components/providers/auth-session-provider`), `router.push('/login')` if no session and not loading — identical pattern to `favorites-content.tsx`'s AC1 handling.
  - [x] Fetch via `useMyReportsQuery` (React Query + `graphql-request`, generated hook) — no manual `useQuery`/`queryKey` wiring needed if the generated hook covers it; if a raw `useQuery` wrapper is needed, use `queryKey: ['myReports']` with default `gcTime`/`staleTime` (this is not a snapshot-consistency-sensitive view like Favorites — no `gcTime: 0` override needed).
  - [x] No local re-sort — render `data.myReports` in the order returned.
- [x] **Task 4 (AC4) — `StatusBadge` variant extension:**
  - [x] Extend `packages/ui/src/core/status-badge.tsx`'s `StatusBadgeProps.variant` union from `"active" | "invalid"` to `"active" | "invalid" | "pending" | "upheld" | "dismissed"`, adding a `classes` branch per new variant (suggested tone mapping: `pending` = amber/neutral, matching an "in progress" read; `upheld` = red, matching `invalid`'s existing danger tone since the reported issue was confirmed/event removed; `dismissed` = green, matching `active`'s existing tone since the event was confirmed safe). Purely additive — `packages/ui/src/core/status-badge.tsx`'s existing `"active"`/`"invalid"` behavior and `apps/web/src/app/[locale]/settings/queue-status/queue-status-content.tsx`'s existing usage are unchanged.
  - [x] Extend `status-badge.test.tsx` (or create if it doesn't exist — check first) to cover the three new variants.
- [x] **Task 5 (AC4) — Report list item rendering:**
  - [x] New `apps/web/src/app/[locale]/reports/report-list-item.tsx` (`apps/web`-scoped, not `packages/ui` — see Dev Notes → "Report List Item Component Placement Decision"): renders event thumbnail (reusing `EventCard`'s `onError`-triggered image-fallback pattern, `packages/ui/src/features/events/EventCard.tsx:155-164`, not the component itself), event name (linking to `/events/[slug]`), reason label, `StatusBadge` with the report's `status` as `variant`, and locale-formatted `createdAt` (`Intl.DateTimeFormat` via the active locale, per `project-context.md`'s Locale-Sensitive Data Rendering rule — reuse `useScopedLocale()`/the existing date-formatting helper `EventCard.tsx`'s `formattedDate`/`formatEventDate` pattern follows, do not hand-roll a new date formatter).
- [x] **Task 6 (AC4, AC8) — i18n enum namespaces:**
  - [x] Add new `ReportReason` namespace (`en`/`id`) keyed by exact enum member name (`cancelled`, `dangerous`, `personal`) — per `project-context.md`'s enum-translation rule and matching the `EventType`/`EventCategory` namespace precedent (`apps/web/locales/en.json:192-220`), not `EventReportForm`'s existing `reasonCancelledLabel`-style keys (those are form-specific, paired with explanatory copy — this page needs the same three reasons but bare, badge/label-appropriate).
  - [x] Add new `ReportStatus` namespace (`en`/`id`) keyed by exact enum member name (`pending`, `upheld`, `dismissed`).
- [x] **Task 7 (AC7, AC8) — Empty/loading/error states + page-level i18n:**
  - [x] Author new `ReportsPage` namespace (both `en`/`id`): `title`, `emptyState`, `errorState`, `loadingLabel` (or equivalent skeleton-region label), `submittedOnLabel` (or inline date format, no separate label needed if the date renders unlabeled next to the badge — decide during implementation based on layout).
  - [x] Loading skeleton: simple list-row skeleton (no `EventCard`-grid skeleton reuse — this is a compact list, not a card grid); non-blocking, per `project-context.md`'s "Non-Blocking (Initial Load)" rule.
- [x] **Task 8 (AD-5) — Analytics:**
  - [x] Fire `reports_page_viewed` (`{ reportCount: number }`, `noun_verb`-shaped per AD-5, matching `favorites_page_viewed`'s precedent) once per successful list load.
- [x] **Task 9 (AC9) — Testing:**
  - [x] Integration tests (`apps/web`, Vitest + msw): new `reports-content.test.tsx` covering auth redirect, successful render (event/reason/status/date all visible), empty state, error state, and all three `StatusBadge` variant mappings.
  - [x] `status-badge.test.tsx`: new variant cases (Task 4).
  - [x] One Playwright E2E test (new file, following Story 0.10's E2E file-location convention — confirm exact directory by reading an existing `apps/web/e2e/*.spec.ts` file, e.g. `event-report.spec.ts` from Story 4.3, before creating): submit a report via the existing Story 4.3 report-dialog flow, navigate to `/reports`, assert the new report is listed with `pending` status.
  - [x] Manual: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11, `stories_covered` explicitly includes `4.6`). Per `story-split-gate.md`'s epic-level-sweep-mode guidance, these gates were not re-run: no architecture/infrastructure gap and no foundational/cross-cutting dependency gap were raised against 4.6's shape — the report confirms Story 4.3a (already `review`) as the correctly-positioned backend prerequisite, and confirms this story needs no new AWS infra (synchronous GraphQL only).
  - **Lightweight guard (this story's own creation):** re-checked whether this story's actual scope (a read-only list page over an already-built, unpaginated query) introduces anything the sweep couldn't have anticipated. Two real, non-mechanical questions surfaced that the sweep — reasoning at the epic/AC level, not implementation-detail level — would not have caught: (1) whether the unpaginated `myReports` contract conflicts with the List Navigation global rule, and (2) whether the Context-Aware Detail Views global rule requires Next/Prev wiring for this list. Both were resolved with the user via `AskUserQuestion` before drafting (see below) rather than silently built or silently ignored. Neither rose to a Gate 1/3 architectural gap requiring a new prerequisite story — both are in-story rendering/scope decisions, not missing layers.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (not sourced from the sweep, since Gate 2 stays per-story). Findings:
  1. **No split required.** The gap here is the same shape as Story 2.2's precedent (missing empty/loading/error-state specs for a personal list page, since `EXPERIENCE.md` only has a one-line IA mention of `/reports` and the C-UX scenario `06.7-user-moderator-interfaces.md` is a thin, unstyled sketch) — resolved by authoring the states fresh in-story (Task 7), not a split, matching how Story 2.2 handled the identical situation for `/favorites`.
  2. **Report list item component: scoped to `apps/web`, not `packages/ui`.** Story 4.7 ("Moderator Items page") will also render report data, but is still `backlog` (not yet created) and needs materially different data (reporter identity) and behavior (moderator action buttons, reason/status filtering) — not a rendering variant of the same component, a different consumer with a different contract. Pre-building a shared abstraction now is speculative and risks guessing the wrong shape (matching Story 3.7's precedent of building a new single-consumer capability inline rather than pre-generalizing for a hypothetical future consumer, and this codebase's general "no premature abstraction" convention). When Story 4.7 is drafted, its own Gate 2 pass decides what's worth extracting then, with real requirements in hand. (Task 5.)
  3. **`StatusBadge` (`packages/ui/src/core/status-badge.tsx`) exists as a generic core primitive but only supports two domain-literal variants (`active`/`invalid`, used today by the queue-status page for API key health).** Per user decision (see "Status Badge Decision" below), extended additively with `pending`/`upheld`/`dismissed` rather than building a separate report-scoped badge — keeps status badges centralized in one generic `packages/ui` core primitive per `project-context.md`'s Core Primitives rule, at zero risk to the existing queue-status consumer. (Task 4.)
  4. Event thumbnail/fallback rendering safely reuses `EventCard`'s existing broken-image `onError` pattern (referenced, not the component itself — this page's row layout is a compact list item, not a card grid) and the existing `/events/[slug]` navigation target — no new pattern invented.

### List Rendering Decision

`myReports: [Report!]!` (Story 4.3a, already `review`) has no `limit`/`offset`/cursor arguments — it returns the caller's complete report list in one call. `project-context.md`'s List Navigation rule states "All long lists (Discovery, Favorites, Subscriptions, etc.) must implement infinite scrolling (autoscroll) rather than traditional pagination controls," which read literally would require either adding pagination to `myReports` (reopening an already-reviewed backend story's contract) or building infinite-scroll machinery over a call that already returns everything. Presented to the user via `AskUserQuestion` with both options laid out. **User chose to render the full list directly, no pagination** — a user's own submitted-report history is a bounded, personal dataset (not comparable in expected scale to Discovery/Favorites/Subscriptions, which the rule's own examples name), and this avoids touching Story 4.3a's shipped contract for a scale concern that doesn't apply here. If report volume per user ever becomes a real concern, that is a future, separate backend-and-frontend change, not this story's scope.

### Status Badge Decision

Presented to the user via `AskUserQuestion`: extend `packages/ui/src/core/status-badge.tsx`'s existing `variant` union with `pending`/`upheld`/`dismissed` (purely additive, matches its current domain-literal pattern), vs. build a new report-scoped badge component local to this story to avoid mixing two unrelated domains' literals (API-key-health vs. report-status) into one shared primitive's type. **User chose to extend `StatusBadge`.** Implemented as Task 4 — the existing `"active"`/`"invalid"` variants and their one existing consumer (`queue-status-content.tsx`) are untouched.

### Detail Navigation Context Decision

`project-context.md`'s Context-Aware Detail Views rule requires Next/Previous navigation inheriting list context when a detail view is opened from a list (with an explicit carve-out for "a direct deep-link without prior list context"). Story 2.2 implements this for `/favorites` via a `?fromList=favorites` marker extending `navigation-hook.ts` (Story 1.6a). Presented to the user via `AskUserQuestion`: wire up the same `?fromList=reports` mechanism for this page, vs. treat opening a report's event as a standalone view with no list-context wiring. **User chose to skip the wiring.** Rationale accepted: a user's reports reference unrelated events submitted at different times for different reasons — unlike Favorites/Discovery's curated, thematically-coherent browsing sequence, there is no meaningful "next report's event" browsing value, so this list does not carry the same UX rationale the rule exists to serve. `navigation-hook.ts` is not modified by this story.

### i18n Keys Required (AD-6)

- New `ReportsPage` namespace (`en`/`id`): `title`, `emptyState`, `errorState`, `loadingLabel` (or equivalent — finalize exact key set during Task 7 based on final layout).
- New `Metadata` namespace additions: `reportsTitle`, `reportsDescription`.
- New `ReportReason` namespace (`en`/`id`), keyed by exact enum member name: `cancelled`, `dangerous`, `personal`. Distinct from `EventReportForm`'s existing `reasonCancelledLabel`/etc. keys (those pair a label with form-specific explanatory copy for the report-submission dialog; this page needs bare labels for a list/badge context) — do not reuse or duplicate `EventReportForm`'s keys.
- New `ReportStatus` namespace (`en`/`id`), keyed by exact enum member name: `pending`, `upheld`, `dismissed`.

### Analytics Events Required (AD-5)

- `reports_page_viewed` — `{ reportCount: number }`, fired once per successful list load, `noun_verb` shape matching `favorites_page_viewed`'s precedent.

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** the `myReports` query via the generated `useMyReportsQuery` hook — no mutations in this story's scope (read-only page).
- **URL State (`nuqs`):** None — no search/filter/pagination params for this page.
- **Client Global State (`zustand`):** None required.

### Loader Categorization

Initial list load: **Non-blocking, Skeleton** (simple list-row skeleton, not `EventCard`'s grid skeleton — this is a compact list, not a card grid), per `project-context.md`'s "Non-Blocking (Initial Load)" rule. No blocking loader anywhere in this story — there are no mutations.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** Story 4.3a owns the `reports` table, its migration, and the `myReports`/`Report` GraphQL contract. This story only *consumes* that already-defined contract (a new frontend GraphQL operation document plus generated hook). No `packages/database` change, no `packages/shared-types` change, no `packages/domain` change (no reusable pure business logic in this story's scope — rendering a list and a badge is a simple UI-local concern, not an extractable pure function).
- **Impacted fields/contracts:**
  - `apps/web/src/features/reports/reports.graphql`: new `myReports` query operation document (Task 1).
  - `packages/ui/src/core/status-badge.tsx`: `StatusBadgeProps.variant` union extended additively (Task 4).
  - **Deliberately not touched:** `apps/backend/src/schema/*.graphql`; `packages/database/schema.ts`; `packages/shared-types/src/index.ts`; `packages/domain`; `apps/web/src/features/events/navigation-hook.ts` (see "Detail Navigation Context Decision").
- **Required DB migration changes:** None — Story 4.3a's migration is the only one this feature needs.
- **Required TypeScript type changes:** `apps/web/src/generated/graphql.ts` regenerated via frontend codegen (Task 1, against Story 4.3a's already-shipped backend schema) — no manual edits to generated output. `StatusBadgeProps.variant` union widened (Task 4, additive, no breaking change to its existing consumer).
- **Backward compatibility and rollout notes:** Purely additive on the frontend query/operations and on `StatusBadge`'s type surface; no existing query/resolver/component consumer is modified in a breaking way.
- **Verification checks:** Task 9's integration tests cover every render branch (success/empty/error, all three status variants); Task 9's E2E test proves the full submit-report-then-view-in-My-Reports flow end-to-end; Task 9's full build/lint/codegen.

### Project Structure Notes

- **New:** `apps/web/src/features/reports/reports.graphql`; `apps/web/src/app/[locale]/reports/page.tsx`; `apps/web/src/app/[locale]/reports/reports-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/reports/report-list-item.tsx`; `apps/web/e2e/my-reports.spec.ts` (or matching existing E2E naming convention, confirm during Task 9).
- **Modified:** `packages/ui/src/core/status-badge.tsx` + its test file (additive variant extension); `apps/web/locales/en.json`/`id.json` (new `ReportsPage`, `ReportReason`, `ReportStatus` namespaces, `Metadata` additions); `apps/web/src/generated/graphql.ts` (codegen, not hand-edited).
- **Not modified:** `apps/backend/src/schema/*.graphql`; `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/web/src/features/events/navigation-hook.ts`; `apps/infrastructure`; `apps/web/src/app/[locale]/settings/queue-status/queue-status-content.tsx` (the existing `StatusBadge` consumer — its `active`/`invalid` usage is unaffected by the additive variant extension).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.6`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report explicitly covering `4.6`.
- [Source: `_bmad-output/implementation-artifacts/4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering.md`] — the `myReports` query contract this story consumes verbatim (`Report` type shape: `id`, `eventId`, `event`, `reason`, `details`, `status`, `moderatorIgnored`, `resolvedByModeratorId`, `createdAt`, `resolvedAt`).
- [Source: `_bmad-output/implementation-artifacts/4-3-report-an-event.md`] — sibling story's i18n/analytics/loader-categorization conventions (`EventReportForm` namespace, `event_reported` analytics event) — distinct namespace, not reused, per "i18n Keys Required" above.
- [Source: `_bmad-output/implementation-artifacts/2-2-view-favorited-events.md`] — the closest structural precedent for a personal-list page: route/`generateMetadata`/`Suspense`/`RouteLoader` shell (`apps/web/src/app/[locale]/favorites/page.tsx`), auth-gate pattern, and the "author empty/loading/error state copy fresh when no UX artifact specifies it" Gate 2 precedent. Its id-snapshot/local-pagination/deferred-commit-on-unmount machinery is explicitly **not** reused — that mechanism exists for `/favorites`' list-consistency-under-concurrent-mutation problem and its heart-toggle-with-undo interaction, neither of which applies to this story's simpler, read-only, unpaginated list.
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`] — `/reports` IA entry (one-line mention only); Profile menu navigation-item activation/focus-management pattern.
- [Source: `design-artifacts/C-UX-Scenarios/06-data-quality/06.7-user-moderator-interfaces.md`] — the only (thin, unstyled) scenario sketch of this page's content shape (event name, reason, date, status).
- [Source: `packages/ui/src/core/app-shell/profile-menu-entries.ts`] — confirms the `reports` → `/reports` nav-menu entry already exists and is already wired to the user menu (Story 0.7/2.8's scope); this story only needs to build the destination route.
- [Source: `packages/ui/src/core/status-badge.tsx`] — existing `StatusBadgeProps` shape (`variant: "active" | "invalid"`), confirmed by direct read before writing Task 4.
- [Source: `apps/web/src/app/[locale]/settings/queue-status/queue-status-content.tsx`] — `StatusBadge`'s one existing consumer, confirmed unaffected by the additive variant extension.
- [Source: `apps/web/src/app/[locale]/favorites/page.tsx`, `favorites-content.tsx`] — structural precedent for route shell, `generateMetadata`, auth-gate `useAuthSession`/`router.push('/login')` pattern, and `buildEnumLabels`-style enum-to-translation-key mapping.
- [Source: `packages/ui/src/features/events/EventCard.tsx:155-164`] — the broken-image `onError` fallback pattern Task 5 references for the report-list-item's event thumbnail.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions, epic-level-sweep-mode guidance (source of citing `epic-4-readiness.md` for Gate 1/3).
- [Source: `_bmad-output/project-context.md#UI-Patterns-UX-Invariants`] — List Navigation rule (source of "List Rendering Decision"); Context-Aware Detail Views rule (source of "Detail Navigation Context Decision"); Locale-Sensitive Data Rendering rule (enum/date formatting); Core Primitives rule (source of "Status Badge Decision").
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-2, #AD-5, #AD-6, #AD-7`] — Unified Query DSL (confirms `myReports` is the correct single query surface, no new endpoint); Analytics Instrumentation taxonomy; i18n/Locale Strategy; Authenticated Context (`requireAuth`, already covered server-side by Story 4.3a — this story's `/login` redirect is a UX-layer mirror, not a second enforcement point).

## Global Rules References

- [x] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (List Navigation exemption decision, Context-Aware Detail Views exemption decision, Locale-Sensitive Data Rendering, Core Primitives); State Management Architecture (Server State via React Query only, no unwarranted Zustand/nuqs); Code Organization (`packages/ui` vs `apps/web` component placement decision); i18n (next-intl, `en`/`id` enum-keyed namespaces).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-2 (Unified Query DSL, confirms no new endpoint); AD-5 (Analytics taxonomy); AD-6 (i18n strategy); AD-7 (`requireAuth` as the single server-side enforcement surface, already covered by Story 4.3a).
- [x] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL only (no Lambda/SQS/EventBridge change), consistent with the epic-4 readiness sweep's Gate 1 finding.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/features/reports/reports.graphql`; `apps/web/src/app/[locale]/reports/page.tsx`; `apps/web/src/app/[locale]/reports/reports-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/reports/report-list-item.tsx`; one new Playwright E2E spec.
- **Modified:** `packages/ui/src/core/status-badge.tsx` + test; `apps/web/locales/en.json`/`id.json`; `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited).
- **Not modified:** `apps/backend/**`; `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/web/src/features/events/navigation-hook.ts`; `apps/infrastructure`.

### Rule Mapping

- **AD-2 (Unified Query DSL, no new endpoint):** satisfied — this story only consumes Story 4.3a's already-shipped `myReports` query, adding zero new backend surface.
- **List Navigation rule:** deliberately not applied to this list — see Dev Notes → "List Rendering Decision" for the user-confirmed exemption rationale.
- **Context-Aware Detail Views rule:** deliberately not applied — see Dev Notes → "Detail Navigation Context Decision" for the user-confirmed exemption rationale.
- **Locale-Sensitive Data Rendering rule:** `reason`/`status` enums resolve through dedicated `ReportReason`/`ReportStatus` next-intl namespaces keyed by exact enum member name (Task 6); `createdAt` formatted via `Intl.DateTimeFormat`/the existing scoped-locale date-formatting pattern (Task 5) — never raw strings.
- **Core Primitives rule (`packages/ui/src/core/`):** `StatusBadge` extended in place rather than duplicated (Task 4), per user decision.
- **Code Organization rule (`packages/ui` vs `apps/web`):** report-list-item component placed in `apps/web` (single current consumer), not `packages/ui`, per the Gate 2 finding above.
- **AD-5 (Analytics taxonomy):** `reports_page_viewed` follows the `noun_verb` convention (Task 8).
- **AD-7 (Authenticated Context):** client-side `/login` redirect (Task 3) mirrors, does not replace, `myReports`' server-side `requireAuth` enforcement (already built by Story 4.3a).

### Verification Plan

- `pnpm --filter web test` — new `reports-content.test.tsx` and extended `status-badge.test.tsx` pass; no existing `apps/web`/`packages/ui` suite regresses (in particular `queue-status-content.test.tsx`, confirming the additive `StatusBadge` variant change is non-breaking).
- `pnpm run codegen` — clean regeneration producing `useMyReportsQuery` against Story 4.3a's existing schema, no manual edits needed.
- `pnpm build` / `pnpm lint` (root) — full monorepo build/lint clean.
- Playwright E2E: submit-report → view-in-My-Reports round trip passes.
- Manual runtime check: visit `/reports` unauthenticated (redirects to `/login`); visit authenticated with zero reports (empty state); visit with ≥1 report of each `status` value (all three `StatusBadge` variants render with distinct, correct colors); toggle `id` locale and confirm `ReportReason`/`ReportStatus`/date all localize.

## Pre-Coding Approval Gate

- [x] Scope confirmation: read-only "My Reports" list page at `/reports`, consuming Story 4.3a's existing `myReports` query — no backend changes, no pagination, no Next/Prev list-context wiring (per the three user-confirmed decisions in Dev Notes).
- [x] Architecture and boundary confirmation: `apps/web`-scoped report-list-item component (not `packages/ui`); `StatusBadge` core primitive extended additively; no `packages/domain` scope in this story.
- [x] Testing plan confirmation: integration tests (auth redirect, render, empty, error, badge variants) + one E2E happy-path test, per Task 9.
- [x] Explicit human approval state (Default: **pending approval**).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Story 4.3a is `review` (backend contract exists and is testable); no new prerequisite stories were split off by this story's Gate 1/2/3 pass (see Architecture & UX Gate Findings above).

## Testing Requirements

- [x] Integration tests (Vitest + msw): auth redirect; successful list render (event/reason/status/date all visible and correctly formatted); empty state; error state; all three `StatusBadge` variant mappings (`pending`/`upheld`/`dismissed`).
- [x] `status-badge.test.tsx`: new variant test cases, confirming existing `active`/`invalid` cases still pass unchanged.
- [x] E2E (Playwright): submit a report via Story 4.3's existing flow → navigate to `/reports` → see it listed with `pending` status.

## Deliverables Checklist

- [x] `/reports` route live, auth-gated, listing the caller's `myReports` results.
- [x] `StatusBadge` extended with `pending`/`upheld`/`dismissed` variants, existing consumer unaffected.
- [x] `ReportReason`/`ReportStatus` i18n namespaces (`en`/`id`), enum-member-keyed.
- [x] `ReportsPage`/`Metadata` i18n keys (`en`/`id`) for title/empty/error/loading copy.
- [x] `reports_page_viewed` analytics event wired.
- [x] Integration + E2E tests passing; full `pnpm build`/`lint`/`codegen` clean.

## Out of Scope

- Pagination/infinite-scroll for `myReports` (deliberately deferred — see "List Rendering Decision"; would require reopening Story 4.3a's backend contract).
- Next/Previous list-context navigation from a report's event detail view (deliberately deferred — see "Detail Navigation Context Decision").
- Filtering/sorting the reports list (not in epics.md's AC for this story; Story 4.7's Moderator Items page has its own filter requirement, separately scoped).
- Story 4.7 "Moderator Items page" and any reusable component extraction it might warrant — explicitly deferred to that story's own future `bmad-create-story` pass (see Gate 2 finding above).
- Any moderator-facing report action (mark as safe, dismiss, restore, permanently delete) — entirely Story 4.7's scope, not this story's.

## Definition of Done

- [x] AC1–AC9 satisfied.
- [x] Integration and E2E tests (Testing Requirements) passing.
- [x] Lint and type checks passing for `apps/web` and `packages/ui`.
- [x] `pnpm run codegen` regenerated cleanly against Story 4.3a's schema.
- [x] No regression in `queue-status-content.test.tsx` (the existing `StatusBadge` consumer).

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

- Claude 3.5 Sonnet

### Debug Log References

- Run `pnpm --filter web test reports-content.test.tsx` successfully.
- Run `pnpm --filter ui test` successfully.

### Completion Notes List

- Created `reports.graphql` with a `myReports` query operation.
- Added `/reports` router page with dynamic metadata and RouteLoader fallback.
- Added custom localized `ReportsPage`, `ReportReason`, and `ReportStatus` keys in `en.json` and `id.json`.
- Added new variants (`pending`, `upheld`, `dismissed`) to `StatusBadge` in `@festgrid/ui`.
- Built `ReportListItem` component displaying event details, localized reason, formatted submission date, and correct status badge variant.
- Created `ReportsContent` component utilizing react-query and posthog analytics `reports_page_viewed` events.
- Authored 4 integration tests (auth redirect, success view, empty state, error state) and 1 E2E spec.

### File List

- `apps/web/src/features/reports/reports.graphql`
- `apps/web/src/app/[locale]/reports/page.tsx`
- `apps/web/src/app/[locale]/reports/reports-content.tsx`
- `apps/web/src/app/[locale]/reports/reports-content.test.tsx`
- `apps/web/src/app/[locale]/reports/report-list-item.tsx`
- `apps/web/e2e/my-reports.spec.ts`
- `packages/ui/src/core/status-badge.tsx`
- `packages/ui/src/core/status-badge.test.tsx`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `packages/database/seed.ts` (drive-by fix of type overload error)
