---
baseline_commit: 74e6d915f694338994915713d14f8bff16f1f284
---
# Story 2.6b: Wire the Add-to-Calendar trigger — schedule-selection dialog, internal bookmark, and native export

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.6b
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to tap "Add to Calendar" on an event's detail page, pick which of its schedules to add, and have those schedules bookmarked in the app and downloaded to my phone's calendar,
so that they show up on my "My Calendar" page (Story 2.6) and in my native calendar app, per `01.2-event-detail.md`'s "Adding to Calendar" scenario and FR11/FR12's one-way app-to-calendar integration.

## Acceptance Criteria

1. **Given** I am viewing an event's detail page with one or more schedules, **when** I tap the existing "Add to Calendar" control (`EventDetailView`'s `CalendarPlus` icon button), **then** a dialog opens listing each of the event's schedules as an independently checkable row (per `01.2-event-detail.md`), labeled with the schedule's title/date, pre-checked for any schedule already added (`Schedule.isAddedToCalendar === true`).
2. **And** when I check/uncheck schedules and tap "Confirm," the dialog reports the final selected schedule ids back to the caller via a single callback — `EventDetailView` itself performs no mutation or network call (framework-agnostic, matching its existing presentation-only contract). Tapping "Cancel" or dismissing the dialog (Escape/outside click) closes it with no callback firing.
3. **And** for each schedule whose checked-state changed from what it was when the dialog opened, the caller (`EventDetailWrapper`) calls `toggleCalendarAddition(eventId, scheduleId)` (Story 2.1a) exactly once — unchanged schedules (already-added-and-still-checked, or never-added-and-still-unchecked) are not re-toggled, since the mutation flips state rather than sets it.
4. **And** for each schedule newly checked in this confirm action (transitioning from not-added to added), the browser is directed to Story 2.1b's `GET /api/calendar/ics?eventId=...&scheduleId=...` endpoint (one request, with a repeated `scheduleId` param for every newly-added schedule in this confirm action) to trigger a native file download — schedules that were already added before this dialog opened are not re-downloaded, and a confirm action that only *unchecks* schedules triggers no download at all.
5. **And** on a successful confirm, a `sonner` toast announces a localized "Event has been added to your calendar" message (per `01.2-event-detail.md`'s literal "confirmation message appears" description) — Story 0.18 added `sonner` as this codebase's toast library after Story 2.1's `aria-live`-only decision was made, so this story uses the toast directly rather than repeating that now-superseded workaround.
6. **And** the "Add to Calendar" trigger icon reflects an "added" state (`aria-pressed`, filled `CalendarPlus` styling mirroring the Favorite heart's fill/outline pattern) whenever at least one of the event's schedules is currently added.
7. **And** if I am not logged in when I tap "Add to Calendar," I am redirected to `/login` (matching Story 2.1's unauthenticated-click pattern) — the dialog never opens and no mutation/download is attempted.
8. **And** all user-facing dialog copy (per-schedule checkbox labels, "Confirm"/"Cancel" button labels, the success announcement) is localized via next-intl (`en`/`id`) — no hardcoded strings.

**Note:** This story exists because of a Gate 2/escape-hatch finding surfaced while creating Story 2.6 (2026-08-06). Story 2.1's Out-of-Scope note ("Add to Calendar button wiring (`EventDetailView.onAddToCalendar`) — Story 2.6"), Story 2.1b's Out-of-Scope note (the same gap, flagged from the backend side, explicitly citing `epic-2-readiness.md`'s "Anticipated Gate 2 note"), and that readiness report itself all independently pointed at this exact gap — no story anywhere actually builds the UI trigger that populates `calendar_additions` data — but none created a story to own it. Without this wiring, Story 2.6's "My Calendar" page would have no way to ever have non-favorited data to display. Classified as a single-story UI/architecture split, lettered `2.6b` (directly off Story 2.6, since `2.6a` is already used by the user-settings story) and positioned immediately before Story 2.6, its primary beneficiary. The user confirmed via `AskUserQuestion` (2026-08-06) that this should be a separate prerequisite story, and that "Add to Calendar" should implement the full per-schedule dialog described in `01.2-event-detail.md` — firing both the internal bookmark mutation (Story 2.1a) and the native ICS export (Story 2.1b) — rather than reusing the simpler single-icon-instant-toggle model already used for Favorites.

**Depends on:** Story 1.6a (`EventDetailView`), Story 2.1a (`toggleCalendarAddition`), Story 2.1b (ICS route handler).

## Tasks / Subtasks

- [x] Task 1: Extend `EventDetailView`'s contract with the schedule-selection dialog (AC1, AC2, AC6) — `packages/ui`
  - [x] Add `id: string` and `isAddedToCalendar?: boolean` to `ScheduleDetail` (`EventDetailView.types.ts`) — additive; `id` is already selected by `getEventBySlug` today (Task 2 below), just unmapped.
  - [x] Change `EventDetailViewProps.onAddToCalendar` from `() => void` to `(selectedScheduleIds: string[]) => void`, called once when the dialog's "Confirm" is activated. Keep `isAddedToCalendar?: boolean` as the aggregate flag driving AC6's icon fill state.
  - [x] Add dialog labels to `EventDetailViewLabels`: `addToCalendarDialogTitle`, `addToCalendarConfirmLabel`, `addToCalendarCancelLabel`, `scheduleCheckboxLabel` (or equivalent) — pre-translated strings, no `next-intl` import in `packages/ui`.
  - [x] Implement the dialog as a new colocated sub-component inside `EventDetailView.tsx` (not extracted to `packages/ui/` or a generic Dialog primitive — see Dev Notes → Architecture & UX Gate Findings): open/close + per-schedule checkbox state owned internally by the dialog, reusing `blocking-loader.tsx`'s focus-trap pattern (Story 1.7a) exactly as `WeeklyCalendarView`'s "+N more" popover already does (Story 1.3g Task 5) — capture `document.activeElement` on open, trap `Tab`/`Shift+Tab`, close on `Escape`/outside click, restore focus to the trigger on close.
  - [x] Extend `EventDetailView.test.tsx`: dialog opens with correct per-schedule pre-checked state; Confirm reports exactly the selected ids (and only the selected ids); Cancel/Escape/outside-click close with no callback firing; focus trap and return-focus behavior; `aria-pressed` on the trigger reflects the aggregate `isAddedToCalendar` prop.

- [x] Task 2: Wire the dialog to the mutation and ICS download (AC3, AC4, AC5, AC7) — `apps/web`
  - [x] Add to `apps/web/src/features/events/mutations.graphql`: `mutation toggleCalendarAddition($eventId: ID!, $scheduleId: ID!) { toggleCalendarAddition(eventId: $eventId, scheduleId: $scheduleId) { eventId scheduleId isAddedToCalendar } }`, matching Story 2.1a's `ToggleCalendarAdditionResult` contract exactly. Run `pnpm run codegen` to generate `useToggleCalendarAdditionMutation`.
  - [x] Add `isAddedToCalendar` to `getEventBySlug`'s `schedules` selection set in `apps/web/src/features/events/queries.graphql` (currently missing — confirmed by reading the file); re-run codegen.
  - [x] In `mapper.ts`: map `schedules[].id` (already selected, currently unmapped) and the new `schedules[].isAddedToCalendar` into `ScheduleDetail`.
  - [x] In `EventDetailWrapper.tsx`, implement `onAddToCalendar={(selectedIds) => { ... }}`:
    - If `!session`, `router.push('/login')` and return, without attempting any mutation (AC7 — defensive, in addition to Task 1's dialog-open gate).
    - Diff `selectedIds` against the current `getEventBySlug` cache's per-schedule `isAddedToCalendar` values; call `useToggleCalendarAdditionMutation` once per changed schedule id, following Story 2.1's exact `onMutate`/`onError`/`onSuccess` optimistic-cache-update shape (cancel `getEventBySlug` queries, optimistically flip the matching schedule's `isAddedToCalendar`, roll back on error, reconcile to the server value on success).
    - Collect the subset of changed ids that transitioned false→true; if non-empty, trigger the file download by navigating to `/api/calendar/ics?eventId=${eventId}&scheduleId=${id1}&scheduleId=${id2}...` (e.g. via a transient `<a>` click or `window.location.assign`, not `router.push`, since this must be a native download, not an SPA route change).
    - Call `toast.success(t('addToCalendarSuccessAnnouncement'))` (`sonner`, already a dependency since Story 0.18) once all mutations for this confirm action have settled (AC5).
  - [x] Wire the "Add to Calendar" trigger's click handler (before the dialog opens) to redirect to `/login` if `!session`, mirroring `onFavoriteToggle`'s existing check exactly (AC7).

- [x] Task 3: i18n (AD-6, AC8)
  - [x] Add to `EventDetailsPage` namespace, both `en.json`/`id.json`: `addToCalendarDialogTitle`, `addToCalendarConfirmLabel`, `addToCalendarCancelLabel`, `addToCalendarSuccessAnnouncement`.
  - [x] Verify `apps/web/locales/locales.test.ts` (existing key-parity test) still passes.

- [x] Task 4: Analytics (AD-5)
  - [x] Fire `event_added_to_calendar` (`{ eventId: string, scheduleId: string }`) once per schedule transitioning to added, and `event_removed_from_calendar` (`{ eventId: string, scheduleId: string }`) once per schedule transitioning to not-added — mirroring Story 2.1's `event_favorited`/`event_unfavorited` shape, fired from each mutation's `onSuccess`.
  - [x] Fire `calendar_ics_downloaded` (`{ eventId: string, scheduleIds: string[] }`) once per confirm action that triggers a download (AC4).

- [x] Task 5: Testing (all ACs)
  - [x] Integration tests (`apps/web`, Vitest + msw): dialog-confirm calls `toggleCalendarAddition` only for changed schedules (not unchanged ones); ICS download triggered only for newly-added schedules, never for unchecked/unchanged ones; unauthenticated click redirects to `/login` without opening the dialog or attempting a mutation; `aria-live` announcement fires on success.
  - [x] One Playwright E2E happy-path test: open an event's detail page → tap "Add to Calendar" → check a schedule → tap "Confirm" → icon shows the added (`aria-pressed="true"`) state, a download is initiated.
  - [x] Manual: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** No new gap. This story only *consumes* Story 2.1a's already-shipped `toggleCalendarAddition` mutation and Story 2.1b's already-shipped `/api/calendar/ics` route handler, both unchanged by this story — no new resolver, schema field, table, queue, or adapter is introduced. `epic-2-readiness.md` (`swept: true`) covers Epic 2's ordinary architecture/infra surface; this story adds no surface beyond what that sweep already characterized.
- **This story is itself the escape-hatch/gap-fill split** for a gap the epic-wide sweep explicitly deferred: `epic-2-readiness.md`'s "Anticipated Gate 2 note" states "No Epic 2 story currently specifies the actual 'Add to Calendar' trigger/button UI... flagged for `bmad-create-story` when 2.6 is drafted." Story 2.1's Out-of-Scope note and Story 2.1b's Out-of-Scope note both independently name the same gap. This story is the resolution, surfaced and confirmed with the user while drafting Story 2.6 (see Note under Acceptance Criteria).
- **Gate 2 (UI Complexity & Reusability):** Run fresh (informed directly by `01.2-event-detail.md`, `EventDetailView.tsx`'s current code, and the user's confirmed decision to build the full per-schedule dialog rather than a simpler icon-only toggle). The schedule-selection dialog is new, non-trivial UI (multi-checkbox state, focus trap, confirm/cancel) — but it has exactly one confirmed consumer (`EventDetailView`, this story), with no second consumer named anywhere in `epics.md`. Per this codebase's established "don't pre-extract at N=1" precedent (Story 1.3g's identical "+N more" popover, which stayed inline for the same reason), it is built inline within `EventDetailView.tsx` (Task 1) rather than extracted to a new `packages/ui` Dialog primitive. Revisit extraction only once a second dialog-needing feature is concretely named in `epics.md`.

### Design Decisions Confirmed With User (2026-08-06)

1. **Split from Story 2.6:** confirmed — this wiring is a separate prerequisite story, not bundled into the My Calendar viewing page. Rationale: distinct UI surface (event detail page, not the calendar page), a real `EventDetailView` contract change, and it keeps Story 2.6 independently testable via seeded/GraphiQL data.
2. **Add-to-Calendar mechanism:** confirmed — the per-schedule checkbox dialog (matching `01.2-event-detail.md` literally), firing **both** `toggleCalendarAddition` (internal bookmark, Story 2.1a, populates Story 2.6's My Calendar page) **and** Story 2.1b's ICS download (native calendar export) on confirm, rather than the simpler single-icon-instant-toggle alternative that would have mirrored the Favorite heart exactly but ignored the UX scenario's dialog/native-export description.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** `ScheduleDetail` (`packages/ui/src/features/events/EventDetailView.types.ts`) is missing `id` and `isAddedToCalendar` — both already exist on the GraphQL `Schedule` type (Story 2.1a); `id` is already selected by `getEventBySlug` today (confirmed by reading `queries.graphql`) but never mapped into `ScheduleDetail` in `mapper.ts`; `isAddedToCalendar` needs to be newly added to that query's selection set. No DB/schema change of any kind.
- **Impacted fields/contracts:** `EventDetailView.types.ts` (`ScheduleDetail` gains `id`/`isAddedToCalendar`; `EventDetailViewProps.onAddToCalendar` signature changes from `() => void` to `(selectedScheduleIds: string[]) => void`; `EventDetailViewLabels` gains four new dialog keys); `apps/web/src/features/events/queries.graphql` (`isAddedToCalendar` added to `getEventBySlug`'s schedules selection); new `apps/web/src/features/events/mutations.graphql` entry (`toggleCalendarAddition`); `mapper.ts`.
- **Required DB migration changes:** None — this story adds no tables/columns.
- **Required TypeScript type changes:** New generated `useToggleCalendarAdditionMutation` hook and an `isAddedToCalendar` field on `GetEventBySlugQuery.eventBySlug.schedules[]`, after `pnpm run codegen`.
- **Backward compatibility and rollout notes:** `onAddToCalendar`'s signature change is a breaking change to `EventDetailViewProps`, but `EventDetailView` has exactly one consumer (`EventDetailWrapper`) and this story updates both together in the same change — no other caller exists to break.
- **Verification checks:** `EventDetailView.test.tsx` (updated per Task 1); `EventDetailWrapper`/integration tests (Task 5); `pnpm build` proving the signature change type-checks through its one call site with no `any`/assertions.

### Package boundaries

- `packages/ui`: `EventDetailView.tsx`/`EventDetailView.types.ts`/`EventDetailView.test.tsx` modified (dialog UI, contract change) — no `next-intl`/GraphQL-generated-type/React Query imports added; the dialog reports a plain `string[]` via callback, exactly like every other sibling component's controlled-component pattern.
- `apps/web`: `EventDetailWrapper.tsx`, `mapper.ts`, `queries.graphql` modified; new `mutations.graphql` entry; `locales/en.json`/`id.json` modified.
- **Not touched:** `apps/backend/**`, `packages/database/**`, `packages/domain/**` — this story is pure frontend wiring against Story 2.1a's/2.1b's already-shipped, unmodified backend contracts.

### Architecture / technical constraints

- **AD-2 (Unified Event Querying):** Not implicated — this story issues a mutation and reads an already-existing query field; it adds no new query condition or endpoint.
- **AD-7 (Authenticated Context):** `toggleCalendarAddition` already enforces `requireAuth` server-side (Story 2.1a); this story's client-side `/login` redirect (AC7) is a UX layer on top, not a substitute for server-side enforcement.
- **Loader Classification:** The dialog's Confirm action is **Non-Blocking** — the mutations are lightweight per-schedule toggles firing in the background (mirroring Story 2.1's non-blocking optimistic icon toggle, project-context.md's Loaders rule); the ICS download is a native browser action with its own OS-level progress UI, not something this app blocks on.
- **State Management Categorization:** **Server State** (`useToggleCalendarAdditionMutation` calls, react-query optimistic cache update against `getEventBySlug`) — no URL state, no `zustand` state introduced.

### Previous/Sibling Story Intelligence (Stories 2.1, 2.1a, 2.1b, 1.3g, 0.18)

- Story 2.1's optimistic-mutation pattern (`onMutate`/`onError`/`onSuccess` against the `getEventBySlug` query cache, unauthenticated-click-redirects-to-`/login`) is reused directly for `toggleCalendarAddition` (Task 2) — identical shape, different mutation/field. Story 2.1's *feedback* mechanism (a hand-rolled `aria-live` region) is **not** reused as-is, since it predates `sonner`'s addition — see below.
- Story 0.18 added `sonner` (`^2.0.7`) as this codebase's toast library (`packages/ui/src/core/soft-delete-toaster.tsx`, already a dependency of both `packages/ui` and `apps/web`) — this postdates Story 2.1's/Story 2.2's "no toast library exists" findings. This story uses `toast.success(...)` directly (AC5, Task 2) rather than repeating Story 2.1's now-superseded `aria-live`-only workaround, and matches `01.2-event-detail.md`'s literal "a confirmation message appears" description more directly than a screen-reader-only region would.
- Story 2.1a's `toggleCalendarAddition(eventId, scheduleId)` is a strict per-schedule upsert-toggle (never delete/re-insert) — safe to call once per changed schedule with no special idempotency handling needed; repeated toggling across dialog opens is safe server-side.
- Story 2.1b's `/api/calendar/ics` route is stateless, unauthenticated, and already fully built; this story is its first actual UI caller — its own Out-of-Scope note explicitly deferred this exact wiring here.
- Story 1.3g's "+N more" popover establishes this codebase's precedent for a self-contained, single-consumer, inline dialog/popover with a `blocking-loader.tsx`-modeled focus trap — reused directly as the implementation model for Task 1's dialog rather than re-litigating the extraction question.

### Project Structure Notes

- Modified: `packages/ui/src/features/events/EventDetailView.tsx`, `EventDetailView.types.ts`, `EventDetailView.test.tsx`.
- Modified: `apps/web/src/features/events/EventDetailWrapper.tsx`, `mapper.ts`, `queries.graphql`; new entry in `apps/web/src/features/events/mutations.graphql`; `apps/web/locales/en.json`, `id.json`.
- Not modified: `apps/backend/**`, `packages/database/**`, `packages/domain/**` — no backend/domain changes needed.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.6`, `#Story 2.1`, `#Story 2.1a`, `#Story 2.1b`]
- [Source: `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md` ("Adding to Calendar")]
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` ("Anticipated Gate 2 note")]
- [Source: `_bmad-output/implementation-artifacts/2-1-favorite-an-event.md` (Out of Scope, optimistic-mutation pattern)]
- [Source: `_bmad-output/implementation-artifacts/2-1b-build-the-ics-route-handler-and-generator-utility.md` (Out of Scope, route contract)]
- [Source: `packages/ui/src/features/events/EventDetailView.tsx`, `EventDetailView.types.ts`]
- [Source: `packages/ui/src/features/events/WeeklyCalendarView.tsx` (popover/focus-trap precedent)]
- [Source: `apps/web/src/features/events/EventDetailWrapper.tsx`, `mapper.ts`, `queries.graphql`]

## Global Rules References

- `_bmad-output/project-context.md` (Code Organization, UI Components & Scalability, i18n rules, State Management Architecture, UI Patterns & UX Invariants/Loaders)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-2, AD-5, AD-6, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.6, Story 2.6b, Story 2.1, Story 2.1a, Story 2.1b)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/index.md` (frontend-only story — no infra-shard changes owned by this story)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `packages/ui/src/features/events/EventDetailView.tsx`, `EventDetailView.types.ts`, `EventDetailView.test.tsx`.
- Modified: `apps/web/src/features/events/EventDetailWrapper.tsx`, `mapper.ts`, `queries.graphql`.
- New entry: `apps/web/src/features/events/mutations.graphql` (`toggleCalendarAddition`).
- Modified: `apps/web/src/generated/graphql.ts` (codegen output, not hand-edited).
- Modified: `apps/web/locales/en.json`, `id.json`.
- **Not modified by this story:** `apps/backend/**`, `packages/database/**`, `packages/domain/**`; Story 2.1a's/2.1b's own files (consumed unchanged).

### Rule Mapping

- *Code Organization (Domain vs UI)* → dialog stays in `packages/ui` (presentation-only, no framework dependencies); mutation/download-triggering logic lives in `apps/web` (inherently React/react-query-coupled).
- *AD-7 (Authenticated Context)* → server-side `requireAuth` (2.1a) is the enforcement boundary; this story's client redirect is a UX layer on top (Task 2).
- *i18n (AD-6)* → all new dialog/announcement strings added to both `en.json`/`id.json` (Task 3).
- *Analytics (AD-5)* → `event_added_to_calendar`/`event_removed_from_calendar`/`calendar_ics_downloaded` specified with exact payload shapes (Task 4).
- *Story-split-gate Gate 2* → dialog built inline in `EventDetailView`, single confirmed consumer, matching Story 1.3g's popover precedent (Architecture & UX Gate Findings above).
- *UI Patterns & UX Invariants (Loaders)* → Confirm action classified Non-Blocking (Loader Classification above).

### Verification Plan

- `packages/ui`: `EventDetailView.test.tsx` — dialog pre-check state, Confirm/Cancel reporting, focus trap, `aria-pressed` aggregate state (Task 1).
- `apps/web`: integration tests covering diff-based mutation calls, download-only-for-newly-added, unauthenticated redirect, `aria-live` announcement (Task 5).
- E2E: one Playwright happy-path test (Task 5).
- Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: `EventDetailView`'s Add-to-Calendar dialog + `EventDetailWrapper`'s wiring to `toggleCalendarAddition` and the ICS download only. Does **not** change Story 2.1a's/2.1b's backend contracts, and does **not** build Story 2.6's My Calendar viewing page.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 — no new gap, consumes existing 2.1a/2.1b contracts unchanged. Gate 2 — run fresh, inline-dialog decision documented above (single confirmed consumer).
- [ ] **Add-to-Calendar mechanism accepted:** per-schedule dialog firing both `toggleCalendarAddition` and the ICS download — per explicit user decision, 2026-08-06 (see Design Decisions Confirmed With User).
- [ ] **`EventDetailView` contract-change accepted:** `onAddToCalendar` signature change, `ScheduleDetail.id`/`isAddedToCalendar` additions — single call site, updated together in this story.
- [ ] Testing plan confirmed: `EventDetailView.test.tsx` update, new `apps/web` integration tests, one Playwright E2E happy path.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/ui`: `EventDetailView.test.tsx` extended — dialog behavior, focus trap, aggregate `aria-pressed` state (Task 1).
- `apps/web`: new/extended integration tests (Vitest + msw) covering diff-based mutation calls, download-only-for-newly-added-schedules, unauthenticated redirect, `aria-live` announcement (Task 5).
- E2E (Playwright): one happy-path test — open detail page, add a schedule to calendar, confirm the icon/aria-pressed state and that a download is triggered.
- Manual: `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Deliverables Checklist

- [ ] Dialog UI in `EventDetailView` with a checkbox per schedule, correct pre-checked state, Confirm/Cancel, and a full focus trap (AC1, AC2).
- [ ] `EventDetailWrapper` wired: `toggleCalendarAddition` fired once per changed schedule, ICS download triggered only for newly-added schedules, `aria-live` success announcement, `/login` redirect when unauthenticated (AC3-AC7).
- [ ] Analytics events (`event_added_to_calendar`, `event_removed_from_calendar`, `calendar_ics_downloaded`) firing with correct payloads.
- [ ] All new strings present in `en.json`/`id.json`; `locales.test.ts` passing (AC8).
- [ ] `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- **Story 2.6's My Calendar viewing page** — consumes this story's resulting `calendar_additions` data; not built here.
- **Any change to Story 2.1a's or Story 2.1b's backend contracts** — both consumed exactly as already shipped.
- **A generic, reusable `packages/ui` Dialog primitive** — evaluated by Gate 2 and explicitly not extracted, pending a second confirmed consumer (see Architecture & UX Gate Findings).

## Definition of Done

- All 8 Acceptance Criteria satisfied.
- Required tests passing (`packages/ui` unit tests, `apps/web` integration tests, one E2E happy path).
- Lint and type checks passing for `packages/ui` and `apps/web`.
- `pnpm run codegen` output committed and consistent with the new `.graphql` operations.
- No decrease in overall project test coverage.

## Completion Status

- [x] Completed (Date: 2026-08-06)

## Dev Agent Record

### Agent Model Used

claude-3-5-sonnet

### Debug Log References

- Story created via `bmad-create-story` at the user's explicit request (`/bmad-create-story 2-6`), split out as a prerequisite while drafting Story 2.6 itself.
- Two `AskUserQuestion` rounds confirmed before drafting: (1) whether to split this wiring into its own story vs. build it inside Story 2.6 — confirmed split; (2) what "Add to Calendar" should actually do, given the conflict between `EventDetailView`'s already-built single-icon-toggle UI and `01.2-event-detail.md`'s dialog+checkbox+native-export description — confirmed: per-schedule dialog firing both effects.

### Completion Notes List

- Extended presentation-only component `EventDetailView` with an inline schedule-selection dialog containing focus trap, ESC/outside click dismiss, pre-checked states, and Confirm/Cancel buttons.
- Extended the GraphQL queries/mutations to support the `toggleCalendarAddition` mutation and `isAddedToCalendar` schedules query field.
- Updated `mapper.ts` to map schedules `id` and `isAddedToCalendar`, and to resolve aggregate `isAddedToCalendar` (reflects "added" if at least one schedule has been added).
- Implemented handler logic in `EventDetailWrapper.tsx` to handle unauthenticated redirect to `/login`, calculate schedule delta differences, invoke backend optimistic mutations, trigger stateless native file downloads for newly-added schedules via `window.location.assign`, fire localized sonner toast, and capture PostHog analytics events.
- Added comprehensive unit tests in `EventDetailView.test.tsx` and integration tests in `EventDetailWrapper.test.tsx`.

### File List

- `packages/ui/src/features/events/EventDetailView.types.ts`
- `packages/ui/src/features/events/EventDetailView.tsx`
- `packages/ui/src/features/events/EventDetailView.test.tsx`
- `apps/web/src/features/events/queries.graphql`
- `apps/web/src/features/events/mutations.graphql`
- `apps/web/src/features/events/mapper.ts`
- `apps/web/src/features/events/EventDetailWrapper.tsx`
- `apps/web/src/features/events/EventDetailWrapper.test.tsx`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-6b-wire-the-add-to-calendar-trigger-dialog-and-ics-export.md`
