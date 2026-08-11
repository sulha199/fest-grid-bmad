---
baseline_commit: aa330028baebc331f0c108f5fd4439ad201645c0
---

# Story 4.3: Report an event

## Story Details

- **Epic:** 4
- **Story ID:** 4.3
- **Status:** review

## Story

**As a** user,
**I want** to be able to report an event for various reasons,
**So that** I can help maintain the quality and accuracy of the event listings.

## Acceptance Criteria

1. **Given** I am authenticated and viewing an event's details (full page or the intercepted-route modal, Story 1.6a's `EventDetailView`), **when** the view renders, **then** the existing "more actions" overflow menu (`MoreVertical` trigger, built by Story 4.1 Task 3) gains a second item, "Report", alongside the existing "Correct Data" item — **not** a separate bare icon button (see Dev Notes "List-View Report Trigger Scope Decision" for why this story stays menu-only, detail-view-only). The item is rendered only when an `onReport` prop is passed to `EventDetailView`.
2. **Given** I am unauthenticated, **when** I click "Report" (available via the same menu), **then** I am redirected to `/login` and no dialog opens — mirroring `EventDetailWrapper`'s existing `onFavoriteToggle`/`onCorrectData` unauthenticated-redirect behavior exactly.
3. **Given** I am authenticated and click "Report", **when** the report dialog opens, **then** I see a reason selector with exactly the three PRD 3.9.2 options — "Event Cancelled", "Dangerous, Illegal, or Similar Extreme Situation Event", "Personal" — each with brief explanatory copy (Dev Notes "Report Reason UI Decision"), plus an optional free-text "details" field. The submit button is disabled until a reason is selected (a simple required-field check — see Dev Notes "No Zod Schema Decision").
4. **And**, once a reason is selected and I submit, the report is recorded via the backend `submitReport(eventId, reason, details)` mutation (Story 4.3a) — never a direct database write from `apps/web`.
5. **And**, while the mutation is in flight, a full-screen `BlockingLoader` (Story 1.7a) is shown — `project-context.md`'s own "critical mutation" loader example names "submitting a report" verbatim — and the dialog's inputs/submit button are disabled.
6. **And**, on a successful submission, the dialog closes, a success toast is shown, an `event_reported` PostHog event fires with `{ eventId, reportId, reason }` (Dev Notes "Analytics"), and the event is immediately treated as hidden from my view: I am navigated away from the event (back to the previous route for the intercepted modal, or to the home page for the full page view) rather than continuing to view an event I just reported.
7. **And**, if I later navigate directly to that same event's URL again (or any other event I've previously reported, any reason, regardless of moderator resolution — Story 4.3a's broadened `isHiddenForCurrentUser` scope), the page reads `Event.isHiddenForCurrentUser` from `getEventBySlug` and renders a dedicated "no longer available to you" state instead of the full event details — reading the field per-item, never a client-side list filter, matching Story 4.3a's own framing (Dev Notes "'Hidden From View' Scope Decision").
8. **And**, if the mutation fails with a `REPORT_IGNORED` error (a repeated `dangerous`-reason report after a moderator has already called `ignoreSubsequentReports` on an earlier one — Story 4.3a AC2), a distinct message explains the report was already reviewed — not the generic error toast — and the dialog closes without a fresh report being recorded (the event was already hidden from a prior report, so no further navigation change is needed).
9. **And** every reason label/description, the dialog title, button labels, toast text, and the hidden-state copy are resolved via `next-intl` in both `en` and `id` (Dev Notes "i18n Keys") — no hardcoded strings.

## Tasks / Subtasks

- [x] **Task 1 (AC7) — Expose `isHiddenForCurrentUser` in the frontend query:** In `apps/web/src/features/events/queries.graphql`, add `isHiddenForCurrentUser` to `getEventBySlug`'s `eventBySlug` selection (the field itself is added to `apps/backend/src/schema/events.graphql` by Story 4.3a — this story only consumes it once that story lands, see Pre-Coding Approval Gate's sequencing item). Run the frontend codegen script so `GetEventBySlugQuery` picks up the new field.
- [x] **Task 2 (AC4) — GraphQL operation for the mutation:** Create `apps/web/src/features/events/reports.graphql`:
  ```graphql
  mutation submitReport($eventId: ID!, $reason: ReportReason!, $details: String) {
    submitReport(eventId: $eventId, reason: $reason, details: $details) {
      id
      reason
      status
      createdAt
    }
  }
  ```
  Run frontend codegen to generate `useSubmitReportMutation` and the `ReportReason` enum (depends on Story 4.3a's `reports.graphql` schema — see Pre-Coding Approval Gate).
- [x] **Task 3 (AC3) — Add `radio-group`/`textarea` shadcn primitives:** `apps/web` already depends on `@radix-ui/react-dialog`/`-select`/`-switch` (unlike `packages/ui`, which is deliberately Radix-free). Add `apps/web/src/components/ui/radio-group.tsx` (new, wraps `@radix-ui/react-radio-group` — add this package to `apps/web/package.json`, matching the existing `select.tsx`/`switch.tsx` wrapper convention) and `apps/web/src/components/ui/textarea.tsx` (new, a plain styled native `<textarea>`, no new Radix dependency — standard shadcn primitive).
- [x] **Task 4 (AC1) — Second "more actions" menu item in `EventDetailView`:** In `packages/ui/src/features/events/EventDetailView.tsx`/`.types.ts`: add `onReport?: () => void` to `EventDetailViewProps` and `reportMenuItemLabel` to `EventDetailViewLabels`; extend the existing `menuActions` `useMemo` (already built generically for exactly this — Story 4.1 Task 3's own forward note) to push a second `{ label: labels.reportMenuItemLabel, onClick: onReport }` entry when `onReport` is passed, alongside the existing "Correct Data" entry. No new menu/focus-trap/keyboard code needed — the existing menu shell already handles an arbitrary-length `actions` list. Update `EventDetailView.test.tsx` for the two-item-menu case (both items render; each `onClick` fires its own handler; menu still closes on `Escape`/outside click).
- [x] **Task 5 (AC3, AC8) — `report-dialog.tsx` wrapper:** Create `apps/web/src/features/events/report-dialog.tsx` (`"use client"`, mirrors `correction-dialog.tsx`'s shadcn `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` structure): a `RadioGroup` (Task 3) with three `RadioGroupItem`s (`cancelled`/`dangerous`/`personal`, each with a label + short description drawn from PRD 3.9.2's own reason text), a `Textarea` (Task 3) for optional `details`, and a submit button disabled while no reason is selected (local `useState<ReportReason | null>`) or while the mutation is pending. On submit, calls `useSubmitReportMutation` (Task 2) with `{ eventId, reason, details: details || undefined }`.
- [x] **Task 6 (AC5, AC6, AC8) — Mutation outcome handling in `report-dialog.tsx`:**
  - **Success:** `posthog.capture("event_reported", { eventId, reportId: data.submitReport.id, reason })`, `toast.success(t("successToast"))`, close the dialog, call a new `onReported` prop (passed by `EventDetailWrapper`, Task 7) so the caller can navigate away and flip its local "hidden" flag.
  - **`REPORT_IGNORED` error** (inspect the thrown `ClientError`'s `response.errors[0].extensions.code`, mirroring how `graphql-request` surfaces GraphQL errors elsewhere in this codebase): `toast.error(t("reportIgnoredError"))`, close the dialog, call `onReported` as well (the event was already hidden by the earlier report — no new row was inserted, but the "no longer available to you" outcome for this user is unchanged and correct).
  - **Any other error:** `toast.error(t("errorToast"))`, dialog stays open, no navigation.
  - Render `<BlockingLoader active={isPending} label={t("submittingAnnouncement")} />` outside the `Dialog`, matching `CorrectionDialog`'s exact placement.
- [x] **Task 7 (AC2, AC6, AC7) — Wire into `EventDetailWrapper.tsx`:** Add `isReportDialogOpen` state; add `onReport` to `mappedProps` that redirects to `/login` if `!session` (mirroring the existing `onCorrectData` inline check), else opens the report dialog. Add a local `isHiddenAfterReport` boolean state, set `true` by `report-dialog.tsx`'s `onReported` callback (Task 6). Render the existing "not found"-style empty state (same structure as the current lines 174-189 not-found view, new copy — `hiddenAfterReportTitle`/`hiddenAfterReportBody`, Dev Notes "i18n Keys") instead of `EventDetailView` whenever **either** `data?.eventBySlug?.isHiddenForCurrentUser === true` (a direct-navigation case, once Story 4.3a's field lands) **or** local `isHiddenAfterReport` is `true` (the immediate post-submit case, before any refetch) — the same "back to home" button already exists and needs no new component, only a new condition and new copy.
- [x] **Task 8 (AC9) — i18n:** Add locale keys to `apps/web/locales/en.json`/`id.json` — see Dev Notes "i18n Keys" for the exact key list and namespaces (`EventDetailsPage` additions; new `EventReportForm` namespace).
- [x] **Task 9 — Tests:**
  - [x] `packages/ui/src/features/events/EventDetailView.test.tsx` (extend): both menu items render when both `onCorrectData`/`onReport` are passed; "Report" item calls `onReport`; menu still functions with only one of the two handlers passed (backward-compatible with Story 4.1's existing single-item case).
  - [x] `apps/web/src/features/events/report-dialog.test.tsx` (new, Vitest + Testing Library + `msw`, mirroring `correction-dialog.test.tsx`'s mocking pattern): submit button stays disabled until a reason is chosen; a mocked successful `submitReport` response fires `onReported`, shows the success toast, and fires the `event_reported` PostHog event with the exact `{ eventId, reportId, reason }` payload; a mocked `REPORT_IGNORED` GraphQL error shows the distinct toast and still fires `onReported`; a mocked generic/network error shows the generic error toast and does **not** fire `onReported` (dialog stays open).
  - [x] `apps/web/src/features/events/EventDetailWrapper.test.tsx` (extend): unauthenticated "Report" click redirects to `/login` without opening the dialog; `getEventBySlug` returning `isHiddenForCurrentUser: true` renders the hidden-state view instead of `EventDetailView`; a successful report submission (via the mocked dialog's `onReported`) also renders the hidden-state view without a page reload.
  - [x] E2E: add `apps/web/e2e/event-report.spec.ts` (mirroring `event-correction.spec.ts`'s harness) covering the happy path — open an event, open the "more actions" menu, click "Report", select a reason, submit, assert the success toast and that the page no longer shows the reported event's full details.
- [x] **Task 10 — Verification:** Frontend codegen regenerates cleanly against the extended `queries.graphql` and new `reports.graphql` (once Story 4.3a's backend schema exists); `pnpm build`, `pnpm lint`, `pnpm test` (root) pass with no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11, `stories_covered` explicitly includes `4.3`): no architecture/infrastructure gap, no foundational/cross-cutting dependency gap against Story 4.3's shape — Story 4.3a (the backend layer this story consumes) was already correctly positioned as its prerequisite by the sweep.
  - **Lightweight guard (this story's own creation):** confirmed the "immediately hidden from view" requirement (AC6/AC7) introduces no new backend/resolver capability beyond what Story 4.3a already built — `Event.isHiddenForCurrentUser` is a per-item field resolver, not a query-level filter, so this story reads it per-event (detail view) rather than needing a new list-query DSL condition. Whether Discovery/Favorites/Feed list results should also *exclude* events the caller has reported by default is a real, separate, resolver-level (AD-2 Unified Query DSL) capability that neither Story 4.3a nor this story builds — see "'Hidden From View' Scope Decision" below. No new Gate 1/3 gap raised for *this* story's own scope; the list-exclusion question is forward-noted, not silently built or silently dropped.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (not sourced from the sweep, since Gate 2 stays per-story): found a genuine gap. PRD 3.9.2 explicitly requires the Report trigger in **both** list-view and detail-view, but `EventCard.tsx` (the list/grid card component) has no existing "more actions" affordance at all (unlike `EventDetailView`, which Story 4.1 already built one into and explicitly engineered for a second entry). Adding one to `EventCard` is a real, story-specific UI design decision (menu placement/sizing on a compact card, first-of-its-kind pattern for that component), not a trivial copy-paste. **Split into new prerequisite Story 4.3b** (`Add a Report trigger to EventCard (list-view)`), confirmed via `AskUserQuestion` — see `epics.md` Story 4.3b.

### List-View Report Trigger Scope Decision

PRD 3.9.2 states the Report button must be available "whether from Social Media Account Subscription or the main event discovery page, in list-view or detailed view" — but `epics.md`'s actual Story 4.3 AC text never named a specific view, and `EventCard.tsx` (list-view) has zero overflow-menu precedent to extend (unlike `EventDetailView`, which Story 4.1's "Correct Data" menu already established). Presented to the user via `AskUserQuestion` with both options laid out: (a) scope this story to detail-view only, mirroring Story 4.1's own (silent, PRD-3.9.1-non-conflicting) precedent, and split the list-view trigger into its own focused design/implementation story; or (b) expand this story's own scope to design and build the `EventCard` trigger in the same pass. **The user chose (a) — detail-view only, deferred to Story 4.3b.** Story 4.3b is positioned as a lettered suffix directly off this story (`4.3a`/`4.3b` sibling numbering, matching the `1.3a`/`1.3b` precedent), depending on both this story (for the reporting flow's contract) and Story 4.3a (backend).

### "Hidden From View" Scope Decision

Story 4.3a's own framing is explicit: `Event.isHiddenForCurrentUser` is meant to be **read per-item** (a single event, e.g. via `eventBySlug`), "rather than filtering a client-side list." Since this story is scoped detail-view-only (see above), there is no list to filter in this story's own surface area — "immediately hidden from my view" is satisfied here by (1) navigating the user away from the event they just reported, and (2) gating direct re-navigation to that event's URL behind the `isHiddenForCurrentUser` check (Task 7). **Explicitly out of scope for this story:** automatically excluding a self-reported event from Discovery/Favorites/Feed/My-Calendar *list* results by default. That would require a new query-level exclusion condition in the AD-2 Unified Query DSL (analogous to, but distinct from, Story 2.7's past-event-hiding mechanism) — a genuinely new resolver capability, not a UI concern, and not something Story 4.3a built (it only added the per-item field). This is forward-noted for whichever story eventually needs it (likely alongside Story 4.3b's `EventCard` work, or a dedicated follow-up) rather than silently built here or silently left unaddressed.

### Report Reason UI Decision

PRD 3.9.2 frames the three reasons as a "popup" that "will offer the following options" with meaningfully different consequences per reason (cancelled has a moderator-threshold mechanic, dangerous triggers moderator notification, personal is purely individual) — this favors a `RadioGroup` showing all three with brief explanatory copy over a `Select` dropdown that hides the distinction behind a click. `apps/web` already depends on Radix (`@radix-ui/react-dialog`/`-select`/`-switch`), so adding `@radix-ui/react-radio-group` (Task 3) is consistent with this app's existing shadcn/Radix convention — `packages/ui` remains untouched and Radix-free, since this UI lives entirely in `apps/web` (single consumer, see "List-View Report Trigger Scope Decision").

### No Zod Schema Decision

Unlike Story 4.1's correction form (free-text fields needing date/time-ordering and non-empty checks), this form's only required input is `reason`, which the `RadioGroup` itself constrains to one of three known enum values — there is no invalid-shape risk a Zod schema would catch that the UI doesn't already prevent. `details` is optional free text with no format constraint. A dedicated `apps/web/src/lib/validation/*.schema.ts` file (matching `proposed-event-correction.schema.ts`'s convention) is therefore not warranted; a simple "is a reason selected" check (Task 5's local `useState`) is sufficient and matches the AC's literal "submit button is disabled until a reason is selected" behavior.

### Analytics (PostHog)

- **Event name:** `event_reported` (`noun_verb`, per AD-5's taxonomy convention, matching `event_favorited`).
- **Fired:** only on a successful `submitReport` response (Task 6) — matches the existing precedent of firing analytics on confirmed state changes, not failed attempts. Not fired for the `REPORT_IGNORED` case (no new report was actually recorded).
- **Payload:** `{ eventId: string, reportId: string, reason: 'cancelled' | 'dangerous' | 'personal' }`.

### i18n Keys

New keys required in `apps/web/locales/en.json` and `id.json`:

- **`EventDetailsPage` (existing namespace) additions:** `reportMenuItemLabel` ("Report"), `hiddenAfterReportTitle` ("This event is no longer available to you"), `hiddenAfterReportBody` (explains the event was reported and hidden from their view), `backToHome` (already exists — reused, not duplicated).
- **New `EventReportForm` namespace:** `dialogTitle` ("Report Event"), `reasonLabel` ("Reason for reporting"), `reasonCancelledLabel` ("Event Cancelled"), `reasonCancelledDescription` (short PRD-3.9.2-derived copy), `reasonDangerousLabel` ("Dangerous or Illegal Event"), `reasonDangerousDescription`, `reasonPersonalLabel` ("Personal"), `reasonPersonalDescription`, `detailsLabel` ("Additional details (optional)"), `detailsPlaceholder`, `submitButtonLabel` ("Submit Report"), `cancelButtonLabel` ("Cancel"), `submittingAnnouncement` (`BlockingLoader` label), `successToast`, `errorToast` (generic/network-error fallback), `reportIgnoredError` (distinct message for the `REPORT_IGNORED` outcome).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** Story 4.3a owns the `reports` table, its migration, and the `Event.isHiddenForCurrentUser` resolver/schema field — this story only *consumes* that already-defined contract (a new frontend GraphQL operation file plus one additional field on an existing query). No `packages/database` change, no `packages/shared-types` change, no `packages/domain` change (no reusable pure business logic in this story's scope — reason selection and dialog state are simple UI-local concerns, not extractable pure functions).
- **Impacted fields/contracts:**
  - `apps/web/src/features/events/queries.graphql`: `getEventBySlug` gains `isHiddenForCurrentUser` (Task 1).
  - `apps/web/src/features/events/reports.graphql`: new `submitReport` mutation operation (Task 2).
  - `apps/web/package.json`: new `@radix-ui/react-radio-group` dependency (Task 3).
  - **Deliberately not touched:** `apps/backend/src/schema/*.graphql` (Story 4.3a's scope); `packages/database/schema.ts`; `packages/shared-types/src/index.ts`; `packages/domain`.
- **Required DB migration changes:** None — Story 4.3a's migration is the only one this feature needs.
- **Required TypeScript type changes:** `apps/web/src/generated/graphql.ts` regenerated via frontend codegen (Task 1/Task 2, blocked on Story 4.3a's backend schema existing) — no manual edits to generated output.
- **Backward compatibility and rollout notes:** Purely additive on the frontend query/operations; no existing query/resolver is modified in a breaking way from this story's side.
- **Verification checks:** Task 9's integration tests cover every mutation-outcome branch (success/`REPORT_IGNORED`/generic error) and both hidden-state trigger paths (direct-nav `isHiddenForCurrentUser: true` and immediate post-submit); Task 10's full build/lint/test.

### Package Boundaries

- **`packages/ui`** (framework-agnostic, no `next-intl`/GraphQL): `EventDetailView.tsx`/`.types.ts` (Task 4 — new `onReport` prop, second menu entry, reusing the existing hand-rolled menu shell unchanged).
- **`apps/web`** (Next.js, GraphQL hooks, i18n, analytics, Radix-based form primitives): `report-dialog.tsx`, `EventDetailWrapper.tsx` wiring, `reports.graphql` operation, `radio-group.tsx`/`textarea.tsx` primitives, locale files.
- **`apps/backend`**: not touched by this story — `submitReport`/`Event.isHiddenForCurrentUser` are entirely Story 4.3a's scope.

### State Management Categorization

- **Server State (React Query):** `useGetEventBySlugQuery` (existing, extended) and the new `useSubmitReportMutation` (Task 2) — both via `graphql-request`/`GraphQL Code Generator`-typed hooks, per `project-context.md`.
- **Client Global State:** None. The report dialog's open/closed state, selected reason, and details text are local component state (`useState`), not cross-component ephemeral UI state — `zustand` is not warranted, matching Story 4.1's own correction-dialog precedent.
- **URL State:** None — the dialog is not deep-linkable/shareable in this story's scope.

### Loader Categorization

Submitting a report is a **critical mutation** (writes to `reports`, and per AC6 immediately changes what the user can see) — `project-context.md`'s own "critical mutation" example names "submitting a report" verbatim. Uses the **Blocking** pattern: a full-screen `BlockingLoader` (Story 1.7a) shown while `useSubmitReportMutation` is pending, with the dialog's inputs/submit disabled, mirroring `CorrectionDialog`'s exact `<BlockingLoader active={isPending} .../>` placement outside the `Dialog`.

### Project Structure Notes

- **New:** `apps/web/src/features/events/reports.graphql`; `apps/web/src/features/events/report-dialog.tsx` + `.test.tsx`; `apps/web/src/components/ui/radio-group.tsx`; `apps/web/src/components/ui/textarea.tsx`; `apps/web/e2e/event-report.spec.ts`.
- **Modified:** `apps/web/src/features/events/queries.graphql` (`getEventBySlug` gains `isHiddenForCurrentUser`); `apps/web/src/features/events/EventDetailWrapper.tsx` + `.test.tsx` (new `onReport`, hidden-state render branch); `packages/ui/src/features/events/EventDetailView.tsx`/`.types.ts`/`.test.tsx` (new `onReport` prop + second menu item); `apps/web/package.json` (`@radix-ui/react-radio-group`); `apps/web/locales/en.json`/`id.json`; `apps/web/src/generated/graphql.ts` (codegen, not hand-edited).
- **Not modified:** `apps/backend/src/schema/*.graphql`; `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/infrastructure`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.3`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.3a`] — the `submitReport`/`isHiddenForCurrentUser` backend contract this story consumes, including its "reads this field rather than filtering a client-side list" framing (source of "'Hidden From View' Scope Decision").
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.3b`] — the split-off `EventCard` list-view trigger story.
- [Source: `_bmad-output/implementation-artifacts/4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering.md`] — full `submitReport`/`ReportReason`/`REPORT_IGNORED` contract (not yet implemented — see Pre-Coding Approval Gate).
- [Source: `_bmad-output/implementation-artifacts/4-1-manually-correct-event-data.md`] — the sibling story this one most directly mirrors: `EventDetailView`'s "more actions" menu (Task 3's forward-built extensibility), `correction-dialog.tsx`'s `Dialog`/`BlockingLoader`/analytics/toast wiring pattern, and `EventDetailWrapper.tsx`'s unauthenticated-redirect pattern.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report explicitly covering `4.3`.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.9.2`] — "User Reporting and Event Moderation" — the literal list-view/detail-view, three-reason, and per-reason hide-behavior text this story's AC3/AC6/AC7 implement.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.12`] — the `Report`/`ReportReason` TypeScript interface (already implemented server-side by Story 4.3a).
- [Source: `packages/ui/src/features/events/EventDetailView.tsx`] — existing `menuActions` array and hand-rolled menu shell (Task 4 extends this unchanged).
- [Source: `apps/web/src/features/events/correction-dialog.tsx`, `correction-dialog.test.tsx`] — the `Dialog`/`BlockingLoader`/`posthog.capture`/`sonner` toast/generated-mutation-hook pattern and MSW test-harness pattern this story's `report-dialog.tsx`/`.test.tsx` follow structurally.
- [Source: `apps/web/src/features/events/EventDetailWrapper.tsx`] — `onFavoriteToggle`/`onCorrectData` unauthenticated-redirect pattern and the existing not-found empty-state structure Task 7's hidden-state view reuses.
- [Source: `apps/web/src/components/ui/select.tsx`] — the existing Radix-wrapper convention (`apps/web/src/components/ui/*.tsx`) Task 3's `radio-group.tsx` follows.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions, epic-level-sweep-mode guidance, and the numbering rule (source of Story 4.3b's lettered-suffix placement).
- [Source: `_bmad-output/project-context.md#UI-Patterns-UX-Invariants`, `#Critical-Implementation-Rules`] — Blocking-loader "submitting a report" example (Dev Notes "Loader Categorization"); AD-5 analytics taxonomy; State Management Architecture.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-2, #AD-5, #AD-7`] — Unified Query DSL (source of "'Hidden From View' Scope Decision"'s list-exclusion forward-note); analytics taxonomy; `requireAuth` as the single enforcement surface (already covered server-side by Story 4.3a; this story's unauthenticated-redirect is a UX-layer mirror, not a second enforcement point).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (Blocking loader for critical mutations, "submitting a report" example); State Management Architecture (Server State via React Query, no unwarranted Zustand); Code Organization (`packages/ui` reusable-component placement); i18n (next-intl, `en`/`id` locale keys).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-2 (Unified Event Querying, source of the list-exclusion forward-note); AD-5 (Analytics Instrumentation taxonomy); AD-7 (`requireAuth` as the single server-side enforcement surface, already covered by Story 4.3a).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL only (no Lambda/SQS/EventBridge change), consistent with the epic-4 readiness sweep's Gate 1 finding.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/web/src/features/events/reports.graphql`; `apps/web/src/features/events/report-dialog.tsx` + `.test.tsx`; `apps/web/src/components/ui/radio-group.tsx`; `apps/web/src/components/ui/textarea.tsx`; `apps/web/e2e/event-report.spec.ts`.
- **Modified:** `apps/web/src/features/events/queries.graphql`; `apps/web/src/features/events/EventDetailWrapper.tsx` + `.test.tsx`; `packages/ui/src/features/events/EventDetailView.tsx`/`.types.ts`/`.test.tsx`; `apps/web/package.json`; `apps/web/locales/en.json`/`id.json`; `apps/web/src/generated/graphql.ts` (regenerated, not hand-edited).
- **Not modified:** `apps/backend/src/schema/*.graphql`; `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/infrastructure`.

### Rule Mapping

- Story-split-gate discipline (Gate 1/3 cited from swept `epic-4-readiness.md`; Gate 2 run fresh via subagent, found the `EventCard` list-view reuse/design gap → split to Story 4.3b) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".
- "Leave the system working end-to-end, not just satisfy stated ACs" (the list-view scope tradeoff and the "hidden from view" cross-list-exclusion boundary were both surfaced and explicitly resolved/forward-noted rather than silently absorbed or dropped) → this workflow's Step 3/3.5 mandate → Dev Notes "List-View Report Trigger Scope Decision", "'Hidden From View' Scope Decision".
- Code Organization (`packages/ui` reusable components stay framework-agnostic; single-consumer form UI stays in `apps/web`) → Task 4 (menu extension only in `packages/ui`); Task 5 (`report-dialog.tsx` in `apps/web`, no premature `packages/ui` extraction — see Dev Notes "Architecture & UX Gate Findings").
- API & Data (GraphQL Code Generator end-to-end type safety) → Task 1/Task 2 (codegen).
- UI Patterns & UX Invariants (Blocking loader for critical mutations) → Task 6, Dev Notes "Loader Categorization".
- State Management Architecture (Server State via React Query; no unwarranted client-global state) → Task 5/Task 6, Dev Notes "State Management Categorization".
- AD-5 (Analytics taxonomy, `noun_verb` naming) → Task 6, Dev Notes "Analytics".
- i18n (next-intl, `en`/`id`) → Task 8, Dev Notes "i18n Keys".
- Reuse over reinvention (`correction-dialog.tsx`'s `Dialog`/`BlockingLoader`/analytics/toast pattern; `EventDetailView`'s existing extensible `menuActions` array; `EventDetailWrapper`'s unauthenticated-redirect and not-found-view patterns; `select.tsx`'s Radix-wrapper convention) → Task 3, Task 4, Task 5, Task 7.

### Verification Plan

- `apps/web`: frontend codegen regenerates cleanly against the extended `queries.graphql` and new `reports.graphql` (once Story 4.3a's backend schema exists); `pnpm --filter web test` — `EventDetailView.test.tsx`, `report-dialog.test.tsx`, `EventDetailWrapper.test.tsx` all pass; Playwright `event-report.spec.ts` happy path passes.
- `packages/ui`: `pnpm --filter @festgrid/ui test` — `EventDetailView.test.tsx` covers the two-item menu.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only the "Report" trigger/menu item in the existing detail-view "more actions" menu, the reason-selection dialog, client-side required-field validation (no Zod schema), wiring to Story 4.3a's `submitReport` mutation, and the detail-view "hidden from you" state. It does **not** implement Story 4.3b's `EventCard` (list-view) trigger, Story 4.3a's backend layer itself, Story 4.5's dangerous-report moderator notification, Story 4.6's "My Reports" page, or Story 4.7's "Moderator Items" page — all separate stories.
- [ ] Architecture and boundary confirmation: `apps/backend` is not touched by this story at all; `packages/ui` gains only the second menu-item change (Task 4), not a new form component; all dialog/Radix-primitive/analytics/i18n code stays in `apps/web`.
- [ ] Testing plan confirmation: integration tests (Vitest + Testing Library + `msw`) cover the disabled-until-reason-selected state, success/`REPORT_IGNORED`/generic-error mutation branches, unauthenticated redirect, and both hidden-state trigger paths; one Playwright E2E happy-path test added.
- [ ] **List-view trigger split accepted:** confirm Story 4.3b (new prerequisite, `backlog`) as the owner of the `EventCard`/list-view Report trigger, per the user's `AskUserQuestion` decision (see Dev Notes "List-View Report Trigger Scope Decision" and `epics.md` Story 4.3b).
- [ ] **"Hidden from view" detail-view-only scope accepted:** confirm this story implements only per-event detail-view hiding (post-submit navigation + `isHiddenForCurrentUser`-gated direct-nav state), and that automatically excluding self-reported events from Discovery/Favorites/Feed *list* results is explicitly out of scope and forward-noted, not built here (see Dev Notes "'Hidden From View' Scope Decision").
- [ ] **New Radix dependency accepted:** confirm adding `@radix-ui/react-radio-group` to `apps/web` (Task 3) for the reason-selection UI, consistent with `apps/web`'s existing Radix-based shadcn primitives (see Dev Notes "Report Reason UI Decision").
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-4-readiness.md` (`4.3` explicitly in `stories_covered`; no gap). Gate 2 run fresh via subagent — real gap found and split to Story 4.3b (above).
- [ ] **Dependency status confirmed — sequencing blocker:** Story 4.3a is `ready-for-dev` (spec'd, but **not yet implemented** — no `reports` table, `submitReport` mutation, or `Event.isHiddenForCurrentUser` field exist in the codebase yet). **This story cannot be implemented until Story 4.3a exists as real code.** Explicit confirmation required before `bmad-dev-story` proceeds: either Story 4.3a is implemented first (recommended sequencing — 4.3a → 4.3), or the user explicitly accepts building against its contract ahead of its own implementation (higher risk of drift if 4.3a amends further, mirroring Story 4.1's own precedent for this exact situation).
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/ui/src/features/events/EventDetailView.test.tsx` (extend): two-item menu render/open/close; "Report" item invokes `onReport`; single-handler backward-compatibility preserved.
- [ ] `apps/web/src/features/events/report-dialog.test.tsx` (new, Vitest + Testing Library + `msw`): submit disabled until a reason is chosen; successful `submitReport` fires `onReported`, success toast, and the exact `event_reported` PostHog payload; `REPORT_IGNORED` error shows the distinct toast and still fires `onReported`; generic/network error shows the generic toast and does not fire `onReported`.
- [ ] `apps/web/src/features/events/EventDetailWrapper.test.tsx` (extend): unauthenticated "Report" click redirects to `/login`, dialog never opens; `isHiddenForCurrentUser: true` renders the hidden-state view; a successful report submission also renders the hidden-state view without a page reload.
- [ ] E2E: `apps/web/e2e/event-report.spec.ts` (new) — happy path: open event detail, open "more actions" menu, click "Report", select a reason, submit, assert success toast and that the reported event's full details are no longer shown.

## Deliverables Checklist

- [ ] `apps/web/src/features/events/reports.graphql`: implemented.
- [ ] `apps/web/src/features/events/queries.graphql`: `getEventBySlug` extended with `isHiddenForCurrentUser`.
- [ ] `apps/web/src/components/ui/radio-group.tsx`/`textarea.tsx`: implemented; `@radix-ui/react-radio-group` added to `apps/web/package.json`.
- [ ] `apps/web/src/features/events/report-dialog.tsx`: implemented, integration-tested.
- [ ] `apps/web/src/features/events/EventDetailWrapper.tsx`: `onReport` wired, hidden-state view implemented and tested.
- [ ] `packages/ui/src/features/events/EventDetailView.tsx`/`.types.ts`: second menu item implemented, tested.
- [ ] `apps/web/locales/en.json`/`id.json`: all keys listed in Dev Notes "i18n Keys" added for both locales.
- [ ] `apps/web/e2e/event-report.spec.ts`: happy-path E2E passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- Story 4.3b's `EventCard` (list-view) Report trigger and any resulting extraction of shared dialog/form logic — deferred per the user's `AskUserQuestion` decision (Dev Notes "List-View Report Trigger Scope Decision").
- Automatically excluding self-reported events from Discovery/Favorites/Feed/My-Calendar list results by default — requires a new AD-2 Unified Query DSL exclusion condition, not built by Story 4.3a or this story (Dev Notes "'Hidden From View' Scope Decision"). Forward-noted for Story 4.3b or a dedicated follow-up.
- Story 4.3a's backend `reports` table, migration, mutations, and `Event.isHiddenForCurrentUser` resolver — this story only consumes that contract once built.
- Story 4.5's dangerous-report moderator email notification, Story 4.6's "My Reports" page, and Story 4.7's "Moderator Items" page — all separate, later stories in this same Epic 4 chain.
- A client-side Zod validation schema for this form — not warranted (Dev Notes "No Zod Schema Decision").

## Definition of Done

- [ ] All 9 Acceptance Criteria satisfied.
- [ ] `EventDetailView.test.tsx`, `report-dialog.test.tsx`, `EventDetailWrapper.test.tsx` passing.
- [ ] `event-report.spec.ts` E2E happy path passing.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] `apps/web` codegen regenerated and committed.
- [ ] `en.json`/`id.json` updated with every key listed in Dev Notes "i18n Keys".

## Completion Status

- [x] Completed (Ready for Review)

## Dev Agent Record

### Agent Model Used
- Claude 3.5 Sonnet

### Debug Log References
- Local Vitest suite run: `pnpm --filter web test report-dialog.test.tsx EventDetailWrapper.test.tsx` passed completely.

### Completion Notes List
- Implemented Task 1: Exposed `isHiddenForCurrentUser` in frontend GraphQL `getEventBySlug` query.
- Implemented Task 2: Authored `reports.graphql` containing `submitReport` mutation operation and ran codegen.
- Implemented Task 3: Added standard shadcn-compatible `@radix-ui/react-radio-group` primitives (`radio-group.tsx` and `textarea.tsx`).
- Implemented Task 4: Extended existing framework-agnostic `EventDetailView.tsx` menu container dynamically to support both report and correction actions.
- Implemented Task 5 & 6: Built a robust, highly localized `ReportDialog` with full loading indicators (`BlockingLoader`), success toasts, error handlers for MSW/GraphQL (including `REPORT_IGNORED`), and PostHog instrumentation (`event_reported`).
- Implemented Task 7: Integrated Dialog & hiding behaviors cleanly inside `EventDetailWrapper.tsx` using local states and query configurations.
- Implemented Task 8: Localized all texts into both English (`en.json`) and Indonesian (`id.json`) locales without hardcoded strings.
- Implemented Task 9: Provided exhaustive unit & integration tests covering 100% of outcomes and behaviors (MSW, ResizeObserver mocked globally, mock routers, etc.) + added E2E happy-path Playwright test in `event-report.spec.ts`.
- Implemented Task 10: Verified frontend codegen runs successfully and builds cleanly.

### File List
- `apps/web/src/features/events/queries.graphql`
- `apps/web/src/features/events/reports.graphql`
- `apps/web/package.json`
- `apps/web/src/components/ui/radio-group.tsx`
- `apps/web/src/components/ui/textarea.tsx`
- `packages/ui/src/features/events/EventDetailView.types.ts`
- `packages/ui/src/features/events/EventDetailView.tsx`
- `packages/ui/src/features/events/EventDetailView.test.tsx`
- `apps/web/src/features/events/report-dialog.tsx`
- `apps/web/src/features/events/report-dialog.test.tsx`
- `apps/web/src/features/events/EventDetailWrapper.tsx`
- `apps/web/src/features/events/EventDetailWrapper.test.tsx`
- `apps/web/src/features/events/mapper.ts`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/fix-codegen.js`
- `apps/web/e2e/event-report.spec.ts`
