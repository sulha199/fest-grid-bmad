---
baseline_commit: 5298ff6728f35b6cf8145f0a5621710ed4903ab4
---

# Story 4.1b: Build the reusable event correction form component

## Story Details

- **Epic:** 4
- **Story ID:** 4.1b
- **Status:** ready-for-dev

## Story

**As a** developer,
**I want** a presentation-only, reusable `CorrectionForm` component in `packages/ui`,
**So that** Stories 4.1 (manual entry) and 4.2 (AI-assisted pre-fill) both render and submit corrections through the same typed-input form instead of duplicating it.

## Acceptance Criteria

1. **Given** Story 4.1a's `ProposedEventCorrection`/`ProposedScheduleCorrection` shapes (event-level fields plus a `schedules` array, though this component edits only one schedule at a time — see Dev Notes "Main-Schedule-Only Scope"), **when** the component is rendered with an `initialValues` prop, **then** it displays typed inputs mirroring `EventInfo`'s correctable fields (`eventName`, `types`, `categories`, `location`, `organizerName`, `contactInfo`, `description`) pre-filled from `initialValues`, reusing the existing `MultiSelect` component (Story 1.5a, `done`) for `types`/`categories` — the caller supplies i18n-resolved `typeOptions`/`categoryOptions` (`{ value, label }[]`) since this component has no `next-intl` access (see Dev Notes "MultiSelect Options Source").
2. **And** it displays typed inputs for exactly one editable `Schedule` (`eventStartDate`, `eventEndDate`, `eventStartTime`, `eventEndTime`, `title`, `performers`, `location`, `ticketPrice`), pre-filled from `initialValues.schedules`' `isMainSchedule: true` entry (falling back to `schedules[0]` if none is flagged main — a defensive default, since PRD 3.9.1/AC4(c) of Story 4.1a treat "exactly one main schedule" as an invariant of valid data, not something this presentational component enforces) — full multi-schedule add/remove editing is explicitly out of scope for this story (no UX artifact depicts it; see Story 4.1's own MVP-scope note and Dev Notes "Main-Schedule-Only Scope").
3. **And** it accepts a `validationErrors?: { field: string; message: string }[]` prop (Story 4.1a's amended shape) and renders each error inline next to its matching field, per UX scenario 06.5 — not a generic banner — **except** an entry whose `field` does not correspond to any rendered input (e.g. Story 4.1a's `schedules[0].id` ownership-check error, which has no visible "id" field), which renders in a generic fallback banner using `labels.unmatchedErrorFallbackLabel` instead of being silently dropped (see Dev Notes "Validation Error Field Mapping").
4. **And** it exposes an `onSubmit(data: ProposedEventCorrection)` callback (no GraphQL/network code inside the component — the caller owns the mutation, matching `EventDetailView`'s own presentation-only precedent) and an `onCancel` callback, plus an `isSubmitting` prop that disables the form's inputs/submit button (the caller owns any `BlockingLoader`, matching `SetDefaultLocationDialog`'s precedent of the loader living in the page-level wrapper, not the presentational form). Per Story 4.1's own "Main-Schedule-Only Scope Decision", `data.schedules` submitted by `onSubmit` contains exactly the one edited schedule entry (carrying its original `id` when present) — not the full `initialValues.schedules` array — since Story 4.1a's reconciliation contract (AC6) leaves omitted rows untouched rather than deleting them, this is a safe, spec-faithful MVP submission shape.
5. **And** it exposes an extension point (`headerActions?: React.ReactNode`, rendered above the form fields) that Story 4.2 will use to inject its "AI-Assisted Correction" URL-extraction trigger (per UX scenario 06.6) without forking this component — Story 4.1b itself implements no AI-assisted logic, only the slot.
6. **And** all microcopy (field labels, button labels, error fallback text) is supplied via a `labels` prop object (no embedded strings), matching `EventDetailViewLabels`/`LocationPickerField`'s i18n-decoupling precedent — the consuming `apps/web` code resolves `labels` via `next-intl` (Story 4.1's `EventCorrectionForm` namespace).

**Note:** This story exists because of Gate 2 (`story-split-gate.md`), surfaced while drafting Story 4.1 — the correction form is confirmed-reused by two stories (Story 4.1's manual entry, Story 4.2's AI-assisted pre-fill extending the same form instance per UX scenario 06.6), with non-trivial states (pre-fill, per-field validation-error display, submit/loading, an extension slot for 4.2). Classified as a single-story-shape reusable-component split per `story-split-gate.md`'s numbering rule (needed by exactly Story 4.1/4.2, both within Epic 4), positioned as a lettered suffix immediately after Story 4.1a (which it depends on for the `ProposedEventCorrection` shape) and before Story 4.1, its first consumer. Confirmed via `AskUserQuestion` during Story 4.1's creation.

**Depends on:** Story 4.1a, Story 1.5a.

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2, AC4) — Types:** Create `packages/ui/src/features/events/CorrectionForm.types.ts`:
  - [ ] `import type { ProposedEventCorrection, ProposedScheduleCorrection } from '@festgrid/domain/events';` (type-only import — per the user's confirmed decision, see Dev Notes "Domain Type Reuse Decision").
  - [ ] `export interface ValidationErrorItem { field: string; message: string }`.
  - [ ] `export interface CorrectionFormLabels { eventNameLabel: string; typesLabel: string; categoriesLabel: string; locationLabel: string; organizerNameLabel: string; contactInfoLabel: string; descriptionLabel: string; scheduleStartDateLabel: string; scheduleEndDateLabel: string; scheduleStartTimeLabel: string; scheduleEndTimeLabel: string; scheduleTitleLabel: string; schedulePerformersLabel: string; scheduleLocationLabel: string; scheduleTicketPriceLabel: string; submitButtonLabel: string; cancelButtonLabel: string; unmatchedErrorFallbackLabel: string }` — a subset of Story 4.1's `EventCorrectionForm` i18n namespace (excludes `dialogTitle`/toast/Zod-message keys, which stay owned by Story 4.1's dialog wrapper — see Dev Notes "Labels Prop Scope").
  - [ ] `export interface CorrectionFormProps { initialValues: ProposedEventCorrection; typeOptions: { value: string; label: string }[]; categoryOptions: { value: string; label: string }[]; validationErrors?: ValidationErrorItem[]; onSubmit: (data: ProposedEventCorrection) => void; onCancel: () => void; isSubmitting?: boolean; headerActions?: React.ReactNode; labels: CorrectionFormLabels }`.
- [ ] **Task 2 (AC1) — Dependency:** Add `"@festgrid/domain": "workspace:*"` to `packages/ui/package.json`'s `dependencies` (type-only usage — no runtime import, verified by Task 6's build; establishes the first `packages/ui` → `packages/domain` dependency edge, per the user's confirmed decision).
- [ ] **Task 3 (AC1–AC6) — Component:** Create `packages/ui/src/features/events/CorrectionForm.tsx` (`"use client"`, mirrors `LocationRadiusFilter.tsx`'s plain-native-input styling convention — no dedicated `Input`/date-picker primitive exists in `packages/ui/src/core/`, and none is warranted here per Gate 2's fresh review, see Dev Notes "Architecture & UX Gate Findings"):
  - [ ] Seed local `useState` for each editable field from `initialValues` once on mount (lazy initializer) — the dialog wrapper (Story 4.1/4.2) mounts a fresh `CorrectionForm` instance per open, matching `AddToCalendarDialog`/`SetDefaultLocationDialog`'s existing mount-per-open pattern, so no `useEffect` re-sync on prop change is needed.
  - [ ] Resolve the editable schedule via `initialValues.schedules.find(s => s.isMainSchedule) ?? initialValues.schedules[0]` (AC2's fallback).
  - [ ] Render `eventName`/`location`/`organizerName`/`contactInfo` as `<input type="text">`, `description` as `<textarea>`, each pre-filled and wired to local state.
  - [ ] Render two `MultiSelect` instances (`facetLabel={labels.typesLabel}`/`facetLabel={labels.categoriesLabel}`, `options={typeOptions}`/`options={categoryOptions}`, `selectedValues`/`onChange` bridging `EventType[]`/`EventCategory[]` local state to `MultiSelect`'s `string[]` contract — cast on read/write, matching `FilterHub.tsx`'s `MultiSelect` wiring pattern) — `hideClearAction` not set (unlike `FilterHub`, this form has no separate "Clear" affordance).
  - [ ] Render the editable schedule's `eventStartDate`/`eventEndDate` as `<input type="date">`, `eventStartTime`/`eventEndTime` as `<input type="time">`, `title`/`location`/`ticketPrice` as `<input type="text">`, and `performers` (`string[]`) as a single comma-separated `<input type="text">` — split on `,`, trim, filter empty on submit; join with `', '` for the initial display value — mirroring `apps/web/src/features/events/mapper.ts`'s existing `performers.join(', ')` display convention (see Dev Notes "Performers Field Convention"). No date-picker/tag-input library is introduced — plain native inputs, consistent with the "no dedicated form primitive" codebase convention confirmed during Gate 2 review.
  - [ ] Build a per-field error lookup from `validationErrors` (`Record<string, string>` keyed by exact `field` string) and render each matched entry inline (`role="alert"`, mirroring `LocationRadiusFilter.tsx`'s `<span className="text-xs text-destructive" role="alert">` pattern) directly under its matching input; collect any `validationErrors` entries whose `field` matches no rendered input into a single fallback banner above the fields, prefixed by `labels.unmatchedErrorFallbackLabel` (AC3).
  - [ ] Render `headerActions` (if provided) in a container above the field list (AC5).
  - [ ] `<form>` `onSubmit` (`preventDefault`) assembles `ProposedEventCorrection` from local state — `schedules: [{ ...editedSchedule, isMainSchedule: true }]` (AC4) — and calls the `onSubmit` prop; no fetch/mutation code.
  - [ ] Cancel button (`type="button"`) calls `onCancel`.
  - [ ] `isSubmitting`: every input, both `MultiSelect`s (via a wrapping `<fieldset disabled={isSubmitting}>`, since `MultiSelect` has no own `disabled` prop — confirmed via Story 1.5a's `MultiSelectProps`), and the submit button are disabled (AC4).
- [ ] **Task 4 (AC1–AC6) — Tests:** Create `packages/ui/src/features/events/CorrectionForm.test.tsx` (Vitest + Testing Library, mirrors `EventDetailView.test.tsx`'s harness style):
  - [ ] Pre-fill: all event-level fields and the main-schedule fields render with `initialValues`' values; when no schedule has `isMainSchedule: true`, the first schedule is used (AC2 fallback).
  - [ ] `MultiSelect` wiring: selecting/deselecting a type or category option updates the value later submitted (as `EventType`/`EventCategory` enum members, not raw strings).
  - [ ] `validationErrors`: a matched-field entry renders inline next to its input; an unmatched-field entry (e.g. `schedules[0].id`) renders in the fallback banner with `labels.unmatchedErrorFallbackLabel`, not silently dropped.
  - [ ] `isSubmitting`: all inputs, both `MultiSelect`s, and the submit button are disabled when `true`.
  - [ ] Cancel button click calls `onCancel`; submit calls `onSubmit` with exactly one `schedules` entry (the edited main schedule, carrying its original `id`) even when `initialValues.schedules` had more than one entry.
  - [ ] `performers`: initial comma-joined display from a `string[]`; edited comma-separated input round-trips to a trimmed, non-empty `string[]` in the submitted payload.
  - [ ] `headerActions`: renders the passed node above the fields when provided; renders nothing extra when omitted.
- [ ] **Task 5 (AC1–AC6) — Export:** Add `export * from './CorrectionForm';` and `export * from './CorrectionForm.types';` to `packages/ui/src/features/events/index.ts` (already re-exported from `packages/ui/src/index.ts` via `export * from './features/events';`).
- [ ] **Task 6 — Verification (AC1–AC6):**
  - [ ] `pnpm --filter @festgrid/ui build` — confirms the new `@festgrid/domain` type-only dependency resolves correctly through turbo's `^build` ordering (domain builds first).
  - [ ] `pnpm --filter @festgrid/ui test` — new `CorrectionForm.test.tsx` passes; all existing `packages/ui` suites remain unmodified and passing.
  - [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions — including confirming `apps/web`/`apps/backend` bundles are unaffected by the new type-only cross-package import (zero runtime footprint).

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — no gap, confirmed via lightweight guard (not a fresh subagent call):** `epic-4-readiness.md` (`swept: true`, 2026-08-11) explicitly lists `4.1a` in `stories_covered` with no gap; `4.1b` itself post-dates that sweep (it was carved out of Story 4.1's own creation the same day) but introduces zero new architecture/infra/cross-cutting surface beyond what `4.1a` already covers — it is a pure `packages/ui` presentational component with no database, GraphQL, external-service, or shared-tooling footprint of its own. No new AWS infra, no new API surface, no new foundational dependency (i18n/analytics/app-shell/codegen) is touched — confirmed no gap.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (Gate 2 stays per-story even when Gate 1/3 are sourced from the sweep): evaluated whether this story's own scope (multiple field types — text, `MultiSelect` reuse, date/time, comma-separated performers, per-field error rendering, an extension slot) hides a further reusable sub-component/primitive that should itself split into a separate story (e.g. a generic date/time input, or a per-field-error-rendering primitive). **Verdict: no gap found.** Reasoning: no dedicated `Input`/date-picker primitive exists anywhere in `packages/ui/src/core/` today — the one comparable precedent (`LocationRadiusFilter.tsx`) handles a select, a range slider, and multiple state variants entirely inline with plain native elements, and `EventDetailView.tsx` inline-defines a full modal (`AddToCalendarDialog`, with focus-trap/keyboard handling) as a second function in the same file rather than splitting it into its own story. Per-field error rendering is a one-line lookup, not a component with its own states/variants. `CorrectionForm`'s multiple field types handled inline in one component is consistent with this codebase's established shape, not an under-scoped story hiding a second component.

### Domain Type Reuse Decision

Story 4.1b's ACs name `ProposedEventCorrection`/`ProposedScheduleCorrection` directly as the types for `initialValues` and `onSubmit`'s payload (AC1, AC4), but those interfaces live in `packages/domain` (Story 4.1a) — and `packages/ui` has never depended on `packages/domain` before (it currently only depends on `@festgrid/shared-types`, e.g. `map.types.ts`). Two options existed: (a) import the real domain types via `import type` (zero runtime cost, single source of truth, matches the AC's literal naming, but establishes the first `packages/ui` → `packages/domain` dependency edge that future stories — e.g. Story 4.2 — would then also follow), or (b) define locally-mirrored types in `packages/ui`, matching how `EventDetailView.types.ts`'s `ScheduleDetail` already independently duplicates a schedule shape rather than importing one (avoids any new dependency edge, but risks silent drift from `packages/domain`'s shape over time). **The user confirmed option (a) via `AskUserQuestion`** — `CorrectionForm.types.ts` imports `ProposedEventCorrection`/`ProposedScheduleCorrection` type-only from `@festgrid/domain/events` (Task 1, Task 2). Because the import is `import type` (erased at compile time), this adds zero runtime bundle weight to `apps/web` or any `packages/ui` consumer, and the types themselves (`packages/domain/src/events/types.ts`) already import only from `@festgrid/shared-types` — no `drizzle-orm`/Node-only leakage risk (confirmed by reading that file).

### Main-Schedule-Only Scope

Mirrors Story 4.1's own "Main-Schedule-Only Scope Decision": Story 4.1a's `submitCorrection` accepts a full `schedules` array with per-entry `id`-based reconciliation, but UX scenario 06.5 (the only artifact depicting the form) shows exactly one schedule, and PRD 3.9.1 itself only ever describes checks in singular "Schedule" terms. `CorrectionForm` therefore edits and submits only the `isMainSchedule: true` entry — full multi-schedule add/remove editing UI is a real, separate future design question (see Out of Scope), not a corner silently cut here.

### Validation Error Field Mapping

Story 4.1a's resolver can return a `schedules[0].id` ownership-check error (Task 5.5 of Story 4.1a) that has no corresponding visible input in this component (there is no editable "id" field). AC3's "field fallback text" phrasing anticipates exactly this: any `validationErrors` entry whose `field` doesn't match a known rendered input renders in a generic fallback banner (`labels.unmatchedErrorFallbackLabel`) rather than being silently dropped — the only case expected to hit this path today is the schedule-ownership error, but the mapping is written generically (unmatched field → banner) so it degrades safely for any future field Story 4.1a might add.

### MultiSelect Options Source

`packages/ui` has no `next-intl` access, so it cannot resolve `EventType`/`EventCategory` enum members to display labels itself. Mirrors `FilterHub.tsx`'s existing pattern exactly: the caller (`apps/web`) resolves i18n-translated `{ value, label }[]` option lists and passes them in as `typeOptions`/`categoryOptions` props (not explicitly named in `epics.md`'s AC1, but required for the component to actually render — a mechanical, precedent-following addition, not a design tradeoff).

### Performers Field Convention

`ProposedScheduleCorrection.performers` is `string[]`, but no tag-input/multi-value text component exists anywhere in the codebase, and no UX artifact depicts one for this field. `apps/web/src/features/events/mapper.ts` already establishes a `performers.join(', ')` display convention for the read side (`EventDetailView`'s `ScheduleDetail.performers: string`); `CorrectionForm` mirrors this on the write side with a single comma-separated text input, split/trimmed/filtered back to `string[]` on submit.

### Labels Prop Scope

Story 4.1's own "i18n Keys" Dev Note enumerates the full `EventCorrectionForm` next-intl namespace, including `dialogTitle`, `submittingAnnouncement`, `successToast`, `errorToast`, and Zod-fallback message keys (`requiredFieldError`, `endDateBeforeStartDateError`, `endTimeBeforeStartTimeError`). `CorrectionForm.labels` (Task 1) intentionally excludes these: `dialogTitle` is dialog chrome owned by Story 4.1's wrapper; toast text is fired by the wrapper, not rendered inside this presentational form; the Zod-fallback message keys are resolved by the *caller's* Zod schema into final message strings, which arrive at this component already as `validationErrors[].message` — `CorrectionForm` renders whatever message string it's given, it does not own producing that text. `CorrectionForm.labels` therefore covers only field labels, button labels, and the one fallback-banner label this component itself decides when to show.

### State Management Categorization

- **Client Global State:** None. All in-progress field edits are local `useState` inside `CorrectionForm` (matching Story 4.1's own "State Management Categorization" Dev Note for the surrounding dialog) — `zustand` is not warranted; this state never needs to cross a component boundary without prop drilling.
- **Server State / URL State:** Not applicable — this component performs no data fetching and is not deep-linkable; both are explicitly out of scope (no GraphQL/network code inside, per AC4).

### Loader Categorization

`CorrectionForm` performs no async work itself and owns no loader — it only forwards the caller-owned `isSubmitting` boolean to disable its inputs/submit button while the caller's mutation (Story 4.1's `useSubmitCorrectionMutation`) is in flight. The full-screen `BlockingLoader` itself remains the caller's responsibility (Story 4.1's Dev Notes "Loader Categorization" already classifies the surrounding submit as a **Blocking** critical-mutation loader) — this story does not introduce a second, independent loader decision.

### i18n

No new `next-intl` locale keys are added by this story. `CorrectionForm` is i18n-agnostic by design (AC6) — it consumes already-resolved strings via the `labels`/`typeOptions`/`categoryOptions` props. The `EventCorrectionForm` namespace keys this component's `labels` prop maps to are already fully enumerated in Story 4.1's Dev Notes "i18n Keys" and will be added to `apps/web/locales/en.json`/`id.json` by Story 4.1's own Task 7 — not duplicated here.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** One new cross-package, type-only dependency (`packages/ui` → `packages/domain`, `import type` only — see "Domain Type Reuse Decision"). No DB migration, no GraphQL schema change, no `packages/shared-types` change, no runtime bundle impact.
- **Impacted fields/contracts:**
  - `packages/ui/package.json`: new `@festgrid/domain: workspace:*` dependency (Task 2).
  - `packages/ui/src/features/events/CorrectionForm.types.ts` (new): imports `ProposedEventCorrection`/`ProposedScheduleCorrection` type-only from `@festgrid/domain/events`.
  - **Deliberately not touched:** `packages/domain/src/events/types.ts` (no shape change needed — this story only consumes the existing, already-defined types); `packages/shared-types`; any GraphQL schema/resolver; any database table.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** New `CorrectionForm.types.ts` only; no changes to any existing interface.
- **Backward compatibility and rollout notes:** Purely additive — a new component and its types, no existing `packages/ui` export changed. Since `import type` is erased at compile time, this story ships zero additional runtime code to any bundle that doesn't explicitly render `CorrectionForm`.
- **Verification checks:** Task 6's `pnpm --filter @festgrid/ui build` proves the cross-package type resolves correctly under turbo's `^build` ordering (confirms `@festgrid/domain` builds before `@festgrid/ui` type-checks); root `pnpm build`/`lint`/`test` confirm no regression to `apps/web`/`apps/backend` bundle size or behavior from the new type-only edge.

### Project Structure Notes

- **New:** `packages/ui/src/features/events/CorrectionForm.tsx`; `CorrectionForm.types.ts`; `CorrectionForm.test.tsx`.
- **Modified:** `packages/ui/src/features/events/index.ts` (new exports); `packages/ui/package.json` (new `@festgrid/domain` dependency).
- **Not modified:** `packages/domain` (consumed, not changed); `packages/shared-types`; `apps/backend`; `apps/web` (this story ships the component only — Story 4.1 wires it into `correction-dialog.tsx`); `apps/infrastructure`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.1b`] — this story's authoritative AC/Note text.
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.1`] — the consumer story's "Main-Schedule-Only Scope Decision", "Action Menu Decision", "i18n Keys", and "Package Boundaries" Dev Notes, which this story's scope and `labels` shape must stay consistent with.
- [Source: `_bmad-output/implementation-artifacts/4-1a-build-the-corrections-backend-graphql-api-layer.md`] — `ProposedEventCorrection`/`ProposedScheduleCorrection` shapes (Task 2), the amended structured `validationErrors: [ValidationError!]` shape (AC7, "validationErrors Structured-Shape Amendment"), and the `schedules[<index>].id` ownership-error field format (Task 5.5) this story's fallback-banner handling accounts for.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report; `4.1a` explicitly in `stories_covered`, no gap.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions, epic-level-sweep-mode guidance, numbering rule (source of this story's lettered-suffix placement).
- [Source: `design-artifacts/C-UX-Scenarios/06-data-quality/06.5-data-inconsistency-checks.md`] — inline-next-to-field error requirement (AC3).
- [Source: `design-artifacts/C-UX-Scenarios/06-data-quality/06.6-ai-assisted-correction.md`] — confirms Story 4.2 extends the same form instance via the `headerActions` slot (AC5).
- [Source: `packages/domain/src/events/types.ts`] — `ProposedEventCorrection`/`ProposedScheduleCorrection` interface definitions this story's types import; confirmed no `drizzle-orm`/Node-only dependency leakage.
- [Source: `packages/ui/src/core/multi-select.tsx`, `multi-select.types.ts`] — `MultiSelect`'s `facetLabel`/`options`/`selectedValues`/`onChange`/`labels` contract this story reuses as-is.
- [Source: `packages/ui/src/features/events/FilterHub.tsx`] — the `{ value, label }[]` options-supplied-by-caller pattern (Dev Notes "MultiSelect Options Source") and `MultiSelect` wiring this story's `MultiSelect` usage mirrors.
- [Source: `packages/ui/src/features/events/LocationRadiusFilter.tsx`] — the plain-native-input + Tailwind styling convention, and the `role="alert"` inline-error rendering pattern this story's field/error rendering follows.
- [Source: `packages/ui/src/features/events/EventDetailView.tsx`, `EventDetailView.types.ts`] — the presentation-only precedent (no GraphQL/network inside), the `labels` prop i18n-decoupling pattern (`EventDetailViewLabels`), and the inline `AddToCalendarDialog` precedent (Gate 2 finding: a fully complex modal built inline in one story, supporting this story's own "no further split" verdict).
- [Source: `packages/ui/src/features/locations/LocationPickerField.types.ts`] — a second `labels?: XyzLabels` precedent confirming this is the established `packages/ui` i18n-decoupling convention, not a one-off.
- [Source: `apps/web/src/features/events/mapper.ts`] — the `performers.join(', ')` display convention this story's comma-separated `performers` input mirrors on the write side.
- [Source: `packages/ui/package.json`, `packages/domain/package.json`] — confirmed `packages/ui` has zero existing `@festgrid/domain` dependency (new edge, Task 2); confirmed `packages/domain`'s `./events` subpath export and build-to-`dist` structure support a type-only cross-package import.
- [Source: `turbo.json`] — confirmed `build`'s `dependsOn: ["^build", "codegen"]` orders `packages/domain`'s build before `packages/ui`'s, so the new type dependency resolves automatically in CI/local builds without extra pipeline changes.
- [Source: `_bmad-output/project-context.md#Code-Quality-Style-Rules`, `#UI-Components-Scalability`] — `packages/ui/src/features/<domain>/` placement rule (this story's location); reusable-component-in-`packages/ui` rule (source of this story's own existence per Gate 2).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Code Organization/UI Components & Scalability (`packages/ui/src/features/events/` placement for a domain-specific reusable component); i18n decoupling (`labels` prop pattern, no direct `next-intl` inside `packages/ui`); State Management Architecture (no unwarranted `zustand` — confirmed local `useState` only).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD applies directly to this story's scope (pure presentational `packages/ui` component: no query/DSL (AD-1/AD-2), no DB migration (AD-3), no analytics (AD-5) — analytics stays owned by Story 4.1's wrapper, no i18n framework wiring (AD-6) — this component is i18n-agnostic by design, no auth (AD-7), no soft-delete (AD-8)). Confirmed explicitly rather than left silent.
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story touches no backend compute, queue, EventBridge/cron, API Gateway, or database provisioning; it is a frontend-only `packages/ui` component.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/ui/src/features/events/CorrectionForm.tsx`; `CorrectionForm.types.ts`; `CorrectionForm.test.tsx`.
- **Modified:** `packages/ui/src/features/events/index.ts`; `packages/ui/package.json`.
- **Not modified:** `packages/domain`; `packages/shared-types`; `apps/backend`; `apps/web`; `apps/infrastructure`; `packages/database`.

### Rule Mapping

- Story-split-gate discipline (Gate 1/3 sourced from swept `epic-4-readiness.md` plus a lightweight no-gap confirmation for this story's own zero-infra scope; Gate 2 run fresh via subagent, no gap) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".
- "Leave the system working end-to-end, not just satisfy stated ACs" (the domain-type-reuse question, the `typeOptions`/`categoryOptions` mechanical gap, the unmatched-validation-error routing, and the performers-field convention all surfaced and resolved rather than silently absorbed) → this workflow's Step 3/3.5 mandate → Dev Notes "Domain Type Reuse Decision", "MultiSelect Options Source", "Validation Error Field Mapping", "Performers Field Convention".
- Code Organization (`packages/ui` reusable components, Domain Features placement) → Task 3 (`packages/ui/src/features/events/CorrectionForm.tsx`).
- i18n decoupling (`labels` prop, no `next-intl` inside `packages/ui`) → Task 1, Dev Notes "Labels Prop Scope", "i18n".
- State Management Architecture (no unwarranted Client Global State) → Dev Notes "State Management Categorization".
- UI Patterns & UX Invariants (Blocking loader owned by the caller, not duplicated here) → Dev Notes "Loader Categorization".
- Reuse over reinvention (`MultiSelect`'s existing contract; `FilterHub`'s options-supplied-by-caller pattern; `LocationRadiusFilter`'s plain-native-input + inline-error convention; `EventDetailView`'s presentation-only/`labels`-prop precedent; `mapper.ts`'s `performers.join(', ')` convention) → Task 3.
- Data Type Compatibility (new type-only cross-package dependency, explicitly analyzed rather than silently introduced) → Task 1, Task 2, Dev Notes "Data Type Compatibility & Migration Requirements".

### Verification Plan

- `packages/ui`: `pnpm --filter @festgrid/ui build` (proves the new `@festgrid/domain` type-only dependency resolves under turbo's `^build` ordering); `pnpm --filter @festgrid/ui test` — `CorrectionForm.test.tsx` covers pre-fill, `MultiSelect` wiring, validation-error routing (matched + fallback banner), `isSubmitting` disable, cancel/submit callbacks (including the single-schedule-entry submission shape), `performers` round-trip, `headerActions` slot.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions — confirms no unintended runtime bundle impact on `apps/web`/`apps/backend` from the new type-only import.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only the reusable `CorrectionForm` presentational component (`packages/ui`) — no dialog chrome, no GraphQL/network wiring, no `next-intl` integration, no AI-assisted extraction logic. Stories 4.1 and 4.2 consume it.
- [ ] Architecture and boundary confirmation: `packages/ui` gains one new component plus a new type-only `@festgrid/domain` dependency (Task 1/2) — no other package is touched.
- [ ] **Domain type reuse accepted:** confirm `CorrectionForm.types.ts` imports `ProposedEventCorrection`/`ProposedScheduleCorrection` type-only from `@festgrid/domain/events`, establishing the first `packages/ui` → `packages/domain` dependency edge, per the user's `AskUserQuestion` decision (see Dev Notes "Domain Type Reuse Decision").
- [ ] Testing plan confirmation: `packages/ui` Vitest + Testing Library integration tests cover pre-fill, `MultiSelect` wiring, per-field and fallback-banner validation-error rendering, `isSubmitting` disable state, cancel/submit callbacks, `performers` round-trip, and the `headerActions` extension slot.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 no gap (sourced from swept `epic-4-readiness.md` for `4.1a` plus a lightweight zero-infra confirmation for this story's own scope). Gate 2 run fresh via subagent — no gap found (see Dev Notes "Architecture & UX Gate Findings").
- [ ] **Dependency sequencing:** Story 4.1a is `in-progress` (not yet `done`) — its `ProposedEventCorrection`/`ProposedScheduleCorrection` contracts are defined but not yet fully implemented/merged. This story has no *runtime* coupling to 4.1a (only a compile-time type import), so it can proceed in parallel; confirm proceeding against the current contract now vs. waiting for Story 4.1a to reach `done` first.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/ui/src/features/events/CorrectionForm.test.tsx` (new, Vitest + Testing Library): pre-fill of all event-level and main-schedule fields (including the no-main-schedule-flagged fallback); `MultiSelect` selection reflected in the submitted `EventType[]`/`EventCategory[]`; `validationErrors` matched-field inline rendering; unmatched-field entries rendered in the fallback banner; `isSubmitting` disables all inputs/both `MultiSelect`s/submit button; `onCancel` invoked on cancel click; `onSubmit` invoked with exactly one `schedules` entry (carrying the original `id`) even when `initialValues.schedules` has multiple entries; `performers` comma-separated round-trip; `headerActions` renders when provided, absent when omitted.

## Deliverables Checklist

- [ ] `packages/ui/src/features/events/CorrectionForm.types.ts`: implemented (`ValidationErrorItem`, `CorrectionFormLabels`, `CorrectionFormProps`).
- [ ] `packages/ui/src/features/events/CorrectionForm.tsx`: implemented per AC1–AC6.
- [ ] `packages/ui/src/features/events/CorrectionForm.test.tsx`: implemented, all cases in Testing Requirements passing.
- [ ] `packages/ui/src/features/events/index.ts`: exports added.
- [ ] `packages/ui/package.json`: `@festgrid/domain` dependency added.

## Out of Scope

- Full multi-schedule add/remove editing UI (this story edits only the `isMainSchedule: true` schedule — see Dev Notes "Main-Schedule-Only Scope"). Forward note: if ever needed, it's a `CorrectionForm` scope-extension story, not a rework of Story 4.1/4.2's dialog/mutation wiring.
- Story 4.2's AI-assisted extraction flow ("AI-Assisted Correction" button/URL input/Gemini call) — the `headerActions` slot exists for it (AC5), but no logic is implemented here.
- Any GraphQL/network/mutation code — the caller (Story 4.1/4.2) owns calling `submitCorrection` (Story 4.1a).
- Dialog chrome, toast notifications, and the `BlockingLoader` itself — all owned by Story 4.1's `correction-dialog.tsx` wrapper (this component only exposes `isSubmitting` to disable its own inputs).
- `next-intl` integration and locale-file edits — `labels` are supplied as props; Story 4.1's own Task 7 adds the `EventCorrectionForm` namespace keys to `en.json`/`id.json`.

## Definition of Done

- [ ] AC1–AC6 satisfied.
- [ ] All tests in Testing Requirements passing.
- [ ] `pnpm --filter @festgrid/ui build`, `pnpm --filter @festgrid/ui test`, and root `pnpm build`/`pnpm lint`/`pnpm test` all pass with no regressions.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
