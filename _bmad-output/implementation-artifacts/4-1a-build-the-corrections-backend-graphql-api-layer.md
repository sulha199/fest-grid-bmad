---
baseline_commit: 83ff4c13fdf07987a8341922c4c2c184c3fa4f24
---

# Story 4.1a: Build the corrections backend GraphQL API layer

## Story Details

- **Epic:** 4
- **Story ID:** 4.1a
- **Status:** ready-for-dev

## Story

**As a** developer,
**I want** a `corrections` table plus a `submitCorrection` mutation,
**So that** Stories 4.1 and 4.2 write event corrections through a real backend path instead of ad hoc storage.

## Acceptance Criteria

1. **Given** Story 0.17's auth context and Story 1.1's `events`/`schedules` tables exist, **when** the migration script runs, **then** a `corrections` table is created with exactly these columns (no others): `id` (uuid PK), `event_id` (uuid FK -> `events.id`, `onDelete: 'cascade'`), `submitted_by_user_id` (uuid FK -> `users.id`), `proposed_data` (jsonb, matching the `ProposedEventCorrection` shape — event-level fields + a `schedules` array, per Dev Notes "proposedData Shape Decision"), `source` (enum `manual`|`ai_assisted`), `status` (enum `pending`|`applied`|`rejected`, default `pending`), `created_at`, `resolved_at` (nullable). There is deliberately no `validation_errors` column — see AC7.
2. **And** a `submitCorrection(eventId: ID!, proposedData: ProposedEventCorrectionInput!, source: CorrectionSource!): Correction!` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17). `proposedData` is a strict GraphQL input type (not a raw `JSON` scalar) reusing the existing `EventType`/`EventCategory` enums, per the user's `AskUserQuestion` decision — see Dev Notes "proposedData Arg Type Decision". An `eventId` that does not match an existing `events` row throws `NOT_FOUND` before any `corrections` row is created (nothing to attach the correction to).
3. **And**, once GraphQL's own type system has validated `proposedData`'s shape (required-ness, enum membership), the mutation runs an additional AJV (Story 0.11) structural pass against a `JSONSchemaType<ProposedEventCorrection>` schema (`apps/backend/src/validation/proposed-event-correction.schema.ts`) enforcing the constraints GraphQL's SDL cannot express itself: `eventName`/`location` non-empty (`minLength: 1`), and `schedules` non-empty (`minItems: 1`). This AJV pass is the authoritative structural gate (Story 0.11) — any future client-side Zod validation (Story 4.1) is a UX convenience only, never the sole check.
4. **And**, when the AJV pass (AC3) succeeds, the mutation runs a pure, 100%-unit-tested `packages/domain/src/events/validate-correction-consistency.ts` function implementing PRD 3.9.1's "Data Inconsistency Checks" against `proposedData`: (a) for every schedule, `eventEndDate` must not be earlier than `eventStartDate`; (b) `eventEndTime` must be later than `eventStartTime` when both schedules' dates are the same (or `eventEndDate` is absent); (c) exactly one schedule must have `isMainSchedule: true`; (d) each schedule's `location`, when present, must be consistent with `proposedData.location` via a case-insensitive substring-containment check (`proposedData.location` found within the schedule's `location`) — per the user's `AskUserQuestion` decision, not an exact-string match (see Dev Notes "Location Consistency Check Decision").
5. **And**, when one or more entries in `proposedData.schedules` carry an `id`, the mutation verifies each `id` belongs to an existing `schedules` row for `eventId` — an `id` that does not belong to this event is added to the validation-error list (AC7), not thrown as a separate exception.
6. **And** corrections that pass every check (AC3–AC5) are applied inside a single database transaction: `events` is updated with `proposedData`'s event-level fields; each `proposedData.schedules` entry carrying a matching `id` updates that `schedules` row, and each entry without an `id` is inserted as a new `schedules` row — existing `schedules` rows omitted from the array are left untouched, never auto-deleted — per the user's `AskUserQuestion` decision on the full-schedules-array reconciliation shape (see Dev Notes "proposedData Shape Decision"). A `corrections` row is inserted directly with `status: 'applied'` and `resolvedAt: now()` (the row is written once, already in its terminal state — see Dev Notes "`pending` Status Reachability").
7. **And** corrections that fail any check (AC3–AC5) are **not** applied to `events`/`schedules`; a `corrections` row is still inserted with `status: 'rejected'` and `resolvedAt: now()`, and the mutation's GraphQL response includes a `validationErrors: [ValidationError!]` field (`{ field: String!, message: String! }`) listing every AJV/consistency/ownership error from AC3–AC5, each attached to the specific field it concerns (**Amended 2026-08-11** — see Dev Notes "validationErrors Structured-Shape Amendment"). This field is computed by the resolver at request time from the AJV/domain-check results — it is **not** a persisted `corrections` table column (AC1's column list is exhaustive).
8. **And** no package outside `apps/backend` writes to `corrections` or `events` directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 4 readiness sweep (`bmad-epic-readiness-check`) — Stories 4.1 and 4.2 both submit event corrections but no table or backend mutation exists for them anywhere in `epics.md`. Classified as a shared data-ownership gap (consumed by both 4.1 and 4.2), positioned immediately before Story 4.1, the first consumer.

**Depends on:** Story 0.8, Story 0.11, Story 0.17, Story 1.1.

## Tasks / Subtasks

- [ ] **Task 1 (AC1) — Migration:** In `packages/database/schema.ts`, add `correctionSourceEnum = pgEnum('correction_source', ['manual', 'ai_assisted'])`, `correctionStatusEnum = pgEnum('correction_status', ['pending', 'applied', 'rejected'])`, and the `corrections` table (`id`, `eventId` FK `onDelete: 'cascade'`, `submittedByUserId` FK to `users.id` — no cascade, matching `apiKeys`'/`defaultLocationChangeRequests`' "preserve audit trail" precedent — `proposedData: jsonb('proposed_data').$type<ProposedEventCorrection>().notNull()`, `source: correctionSourceEnum('source').notNull()`, `status: correctionStatusEnum('status').default('pending').notNull()`, `createdAt`, `resolvedAt: timestamp(..., { withTimezone: true })` nullable), with an index on `eventId` (`idx_corrections_event_id`, matching `posts.accountIdIdx`'s plain-FK-index convention — `corrections` is not AD-8-bound, no partial-index/`deletedAt` handling needed). Run `pnpm --filter @festgrid/database generate` to produce `0022_*.sql` (next after `0021_new_sunset_bain.sql`) and commit it (AD-3). Purely additive — no existing rows, no backfill.
- [ ] **Task 2 (AC2, AC3) — Domain types + AJV schema:**
  - [ ] Add `ProposedScheduleCorrection` and `ProposedEventCorrection` interfaces to `packages/domain/src/events/types.ts` (plain shapes, no `drizzle-orm` import — mirrors `ExtractedEventMessage`'s decoupling precedent): `ProposedScheduleCorrection { id?: string; isMainSchedule: boolean; eventStartDate: string; eventEndDate?: string; eventStartTime?: string; eventEndTime?: string; title?: string; performers?: string[]; location?: string; ticketPrice?: string }`; `ProposedEventCorrection { eventName: string; types: EventType[]; categories: EventCategory[]; location: string; organizerName?: string; contactInfo?: string; description?: string; schedules: ProposedScheduleCorrection[] }`. Export both from `packages/domain/src/events/index.ts`.
  - [ ] Create `apps/backend/src/validation/proposed-event-correction.schema.ts` exporting `proposedEventCorrectionSchema: JSONSchemaType<ProposedEventCorrection>`, mirroring `extracted-event.schema.ts`'s style, with `eventName`/`location` `minLength: 1` and `schedules` `minItems: 1` (the residual constraints GraphQL's SDL can't express — see Dev Notes "AJV + Domain Split Rationale").
- [ ] **Task 3 (AC4) — Pure consistency-check function:** Create `packages/domain/src/events/validate-correction-consistency.ts` exporting `CorrectionConsistencyError { field: string; message: string }`, `isScheduleLocationConsistent(eventLocation: string, scheduleLocation: string): boolean` (case-insensitive substring containment), and `validateCorrectionConsistency(data: ProposedEventCorrection): CorrectionConsistencyError[]` implementing AC4(a)-(d). Add `validate-correction-consistency.test.ts` (`node:test`, no DB, 100% coverage): end-date-before-start-date flagged/not-flagged; end-time-before-start-time flagged only when dates match (or end date absent) and not flagged across different dates; zero/two-or-more main schedules flagged, exactly one passes; consistent/inconsistent schedule locations (substring match, case-insensitivity, absent `schedule.location` skips the check); multiple simultaneous errors across multiple schedules all collected (not short-circuited). Export both from `packages/domain/src/events/index.ts`.
- [ ] **Task 4 (AC1, AC2) — GraphQL schema:** Create `apps/backend/src/schema/corrections.graphql`:
  ```graphql
  enum CorrectionSource {
    manual
    ai_assisted
  }

  enum CorrectionStatus {
    pending
    applied
    rejected
  }

  input ProposedScheduleCorrectionInput {
    id: ID
    isMainSchedule: Boolean!
    eventStartDate: String!
    eventEndDate: String
    eventStartTime: String
    eventEndTime: String
    title: String
    performers: [String!]
    location: String
    ticketPrice: String
  }

  input ProposedEventCorrectionInput {
    eventName: String!
    types: [EventType!]!
    categories: [EventCategory!]!
    location: String!
    organizerName: String
    contactInfo: String
    description: String
    schedules: [ProposedScheduleCorrectionInput!]!
  }

  type ValidationError {
    field: String!
    message: String!
  }

  type Correction {
    id: ID!
    eventId: ID!
    submittedByUserId: ID!
    proposedData: JSON!
    source: CorrectionSource!
    status: CorrectionStatus!
    validationErrors: [ValidationError!]
    createdAt: String!
    resolvedAt: String
  }

  extend type Mutation {
    submitCorrection(eventId: ID!, proposedData: ProposedEventCorrectionInput!, source: CorrectionSource!): Correction!
  }
  ```
  `Correction.proposedData` stays a `JSON!` output field (echoing back what was stored) rather than a duplicated output type mirroring the input — GraphQL forbids reusing `input` types as output field types, and this field's only purpose is confirmation/debugging, not a typed form re-render.
- [ ] **Task 5 (AC2, AC5, AC6, AC7) — Resolver:** In `apps/backend/src/schema/resolvers.ts`:
  - [ ] Import `corrections` from `@festgrid/database`, `inArray` from `drizzle-orm` (add to the existing `eq, count, sql, asc, and, exists, desc` import), `compileValidator` (already imported), `proposedEventCorrectionSchema`, and `validateCorrectionConsistency`/`ProposedEventCorrection`/`ProposedScheduleCorrection` from `@festgrid/domain/events`.
  - [ ] `const validateProposedEventCorrection = compileValidator<ProposedEventCorrection>(proposedEventCorrectionSchema);` at module scope (matches `validateReportSystemError`'s precedent).
  - [ ] Add `submitCorrection: async (_: any, { eventId, proposedData, source }: any, context: any) => { ... }` to the `Mutation` resolver map:
    1. `requireAuth(context)`.
    2. Look up `events` by `eventId`; if not found, throw `GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } })` (AC2).
    3. Run `validateProposedEventCorrection(proposedData)`; collect any AJV errors (`validateProposedEventCorrection.errors`) into a `validationErrors: { field: string; message: string }[]` array (AC3), mapping each AJV error's `instancePath` (e.g. `/eventName`, `/schedules/0/eventStartDate`) to a `field` value by stripping the leading `/` and converting remaining `/` to `.`/`[]` array-index notation (e.g. `schedules[0].eventStartDate`); an empty `instancePath` (a top-level `required` error) falls back to `error.params.missingProperty` as the field.
    4. If AJV passed, run `validateCorrectionConsistency(proposedData)` and append its `{ field, message }` entries as-is (AC4) — `CorrectionConsistencyError` (Task 3) already carries a `field`.
    5. If AJV passed, check every `proposedData.schedules[].id` (where present) belongs to a `schedules` row with `eventId` matching the argument (via `inArray` + `and(eq(...))`); append `{ field: 'schedules[<index>].id', message: '...' }` for any that don't (AC5), where `<index>` is that entry's position in `proposedData.schedules`.
    6. If `validationErrors.length > 0`: insert a `corrections` row with `status: 'rejected'`, `resolvedAt: new Date()`, and return it with the computed `validationErrors` (AC7) — do not touch `events`/`schedules`.
    7. Else, inside `db.transaction(async (tx) => { ... })`: update `events` (`eventName`, `types`, `categories`, `location`, `organizerName`, `contactInfo`, `description`); for each `proposedData.schedules` entry, `tx.update(schedules)...where(and(eq(schedules.id, id), eq(schedules.eventId, eventId)))` if it has an `id`, else `tx.insert(schedules).values({ ...fields, eventId })`; insert a `corrections` row with `status: 'applied'`, `resolvedAt: new Date()`; return it with `validationErrors: []` (AC6).
  - [ ] Serialize `createdAt`/`resolvedAt` to ISO strings on the returned object, matching `updateUserSettings`'s existing `.toISOString()` precedent.
- [ ] **Task 6 (AC1–AC8) — Tests:** Create `apps/backend/src/schema/corrections.test.ts` (real local DB, `graphql-yoga` `createSchema`/`createYoga`, mirroring `system-errors.test.ts`'s harness and `favorites-and-calendar.test.ts`'s real-DB seed/cleanup pattern): unauthenticated call rejected `UNAUTHENTICATED`; unknown `eventId` rejected `NOT_FOUND`, no `corrections` row inserted; a structurally-invalid `proposedData` (e.g. empty `eventName`) returns `status: 'rejected'` with a `validationErrors` entry whose `field` is `'eventName'`, `events` unchanged; a structurally-valid but inconsistent `proposedData` (end date before start date; two main schedules; mismatched schedule location) each independently return `status: 'rejected'` with the specific expected `{ field, message }`, `events`/`schedules` unchanged; a schedule `id` from a different event is rejected with a `field: 'schedules[0].id'` ownership error; a fully valid `proposedData` returns `status: 'applied'`, `validationErrors: []`, and `events`/`schedules` rows are verified actually updated (including a new schedule inserted for an entry with no `id`, and an existing schedule preserved when omitted from the array).
- [ ] **Task 7 — Codegen + Verification (AC1–AC8):**
  - [ ] `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` against the new `corrections.graphql` schema.
  - [ ] `pnpm --filter @festgrid/database generate` output reviewed: one additive migration, no drops/renames.
  - [ ] `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained, including `validate-correction-consistency.ts`.
  - [ ] `pnpm --filter backend test` — new `corrections.test.ts` passes; all existing `apps/backend` suites remain unmodified and passing.
  - [ ] `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11, `stories_covered` explicitly includes `4.1a`). Per `story-split-gate.md`'s epic-level-sweep-mode guidance, these gates were not re-run: no architecture/infrastructure gap and no foundational/cross-cutting dependency gap were raised against 4.1a's shape — the report reconfirms 4.1a as the correctly-positioned shared-data-ownership prerequisite for Stories 4.1/4.2, with every adapter/context it needs (auth-role via Story 0.17) already built in Epic 0.
  - **Lightweight guard (this story's own creation):** re-checked whether this story's actual field-level design (the full-schedules-array reconciliation, the strict `ProposedEventCorrectionInput` GraphQL type, the AJV+domain validation split) introduces anything the sweep couldn't have anticipated. It doesn't — these are all implementation-detail decisions *within* 4.1a's already-approved scope (one table, one mutation, `apps/backend`-only), not new architectural layers, external services, or cross-epic dependencies. No new Gate 1/3 gap found.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (not sourced from the sweep, since Gate 2 stays per-story): grepped `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` for "correct"/"Correction" and found no dedicated correction-form UI spec there; `design-artifacts/C-UX-Scenarios/06-data-quality/` contains only 06.5–06.7 (inconsistency-check error messaging, AI-assisted correction, user/moderator interfaces) — no 06.1–06.4 scenario file describing the correction form's own entry point exists yet. **Verdict: No gap.** This story has zero UI surface — no `apps/web` files, no component, no hook; epics.md confirms Story 4.1 (not 4.1a) owns the pre-filled correction form UI. The subagent flagged one forward-pointer (not a gap): when Story 4.1 itself is drafted, its own Gate 2 pass should check whether the form's pre-filled/validation-error UI needs its own 06.x scenario file — that's 4.1's concern, not this story's.

### proposedData Shape Decision

epics.md's AC only says `proposed_data` JSONB must "match the `EventInfo`/`Schedule` shape," which is ambiguous on whether an event's *entire* `schedules` array should be correctable or just its single main schedule (the PRD's own 3.9.1 text uses singular "Schedule" and only ever describes date/location checks against one schedule, and the 06.5 UX scenario only shows a single start/end date pair). Presented to the user via `AskUserQuestion` with two options — a flat single-main-schedule shape (simpler, PRD-literal) vs. a full `schedules: Schedule[]` array with per-entry `id`-based update/insert reconciliation (fuller `EventInfo` fidelity, supports correcting multi-day/multi-schedule events). **User chose the full-schedules-array option.** Reconciliation semantics (also confirmed as part of that choice): a `schedules` entry with a matching `id` updates that row; an entry with no `id` inserts a new row; existing `schedules` rows *omitted* from the array are left untouched, never auto-deleted (avoiding silent data loss from an incomplete client payload). Implemented in AC1 (table), AC4(c) (exactly-one-main-schedule check), AC6 (apply logic), Task 1–3/5.

### Location Consistency Check Decision

PRD 3.9.1's "Schedule Consistency" check reads: "If a `Schedule` has a specific `location`, it should be verified against the main `location` of the event if provided" — soft, non-exact wording. Since `events.location` is typically city-level (e.g. "Chicago, IL") while a schedule's `location` is often more specific (e.g. "United Center, Chicago, IL"), an exact-string-match interpretation would flag nearly every real correction that fills in a schedule location. Presented to the user via `AskUserQuestion`: case-insensitive substring containment (event location found within schedule location) vs. exact match. **User chose case-insensitive substring containment** — implemented as `isScheduleLocationConsistent` (Task 3), AC4(d).

### proposedData Arg Type Decision

epics.md's literal signature (`submitCorrection(eventId, proposedData, source)`) and the `proposed_data` JSONB column both read as a raw JSON blob — but `project-context.md`'s "API & Data" rule mandates GraphQL Code Generator for end-to-end type safety on **all** client-server data, and `EventType`/`EventCategory` are already real GraphQL enums (`events.graphql`) this schema can reuse. A raw `proposedData: JSON!` scalar arg would bypass codegen entirely for the single most important payload in this mutation, leaving Story 4.1's frontend form with zero compile-time shape-checking. Presented to the user via `AskUserQuestion`: a strict `ProposedEventCorrectionInput`/`ProposedScheduleCorrectionInput` GraphQL input type (full codegen safety, AJV narrows to a secondary business-rule-focused gate) vs. a raw `JSON!` scalar (simplest, matches the AC's literal wording most directly, but no codegen safety for Story 4.1). **User chose the strict GraphQL input type** — implemented in Task 4 (`corrections.graphql`), reusing `EventType`/`EventCategory`.

### AJV + Domain Split Rationale

Because `proposedData` is now a strict GraphQL input type (not a raw `JSON` scalar — see above), GraphQL's own type system already enforces required-ness and enum membership before the resolver runs. This narrows AJV's remaining job to constraints GraphQL's SDL genuinely cannot express (non-empty strings via `minLength`, non-empty arrays via `minItems` — Task 2), while the PRD's actual "Data Inconsistency Checks" (cross-field date ordering, exactly-one-main-schedule, schedule/event location consistency) are implemented as a pure, independently-testable `packages/domain` function (Task 3) rather than contorted into AJV custom keywords. This still satisfies AC3/AC4/epics.md's "AJV (Story 0.11) as the authoritative gate" framing — AJV remains the authoritative *structural* gate (Story 0.11's established role everywhere else in this codebase: `reportSystemErrorSchema`, `extractedEventSchema`), while the domain-package split is separately mandated by `project-context.md`'s Code Organization rule for reusable, 100%-covered business logic. This did not require its own `AskUserQuestion` — it's a direct, non-discretionary consequence of the `project-context.md` domain-package rule plus the proposedData-arg-type decision above, not an independent tradeoff.

### `pending` Status Reachability

AC1's `status` enum includes `pending` (matching the `reports`/`defaultLocationChangeRequests` sibling shape for schema consistency), but this story's `submitCorrection` resolves every correction synchronously within a single request (AC6/AC7) — there is no async moderator-review step for corrections (unlike `reports`/`DefaultLocationChangeRequest`). A `corrections` row is therefore always inserted already in its terminal state (`applied` or `rejected`); no code path in this story ever leaves a row `pending`. The value is kept in the enum for schema completeness and to leave room for a possible future async review flow, not because this story's flow produces it.

### validationErrors Structured-Shape Amendment

**Added 2026-08-11 while drafting Story 4.1.** `Correction.validationErrors` changes from `[String!]` to a new `[ValidationError!]` type (`{ field: String!, message: String! }`), and Task 5's AC3–AC5 error-collection steps now attach a `field` to every entry: AJV errors (AC3) derive it from `error.instancePath` (stripped/converted to dot/bracket field-path notation, falling back to `error.params.missingProperty` for top-level `required` errors); `validateCorrectionConsistency` errors (AC4) already carry a `field` (Task 3's `CorrectionConsistencyError`, unchanged); the schedule-ownership check (AC5) attaches `schedules[<index>].id`. **Reason:** UX scenario 06.5 (`design-artifacts/C-UX-Scenarios/06-data-quality/06.5-data-inconsistency-checks.md`) requires an inline error rendered next to the specific invalid field — an unstructured string array gives Story 4.1's frontend no reliable way to do that without fragile substring-matching on message text. Presented to the user via `AskUserQuestion` during Story 4.1's creation, alongside two alternatives (a generic error banner deviating from the UX spec; fragile substring-matching): **the user chose this structured-shape amendment.** Safe to amend in place since this story was still `ready-for-dev` (no implementation existed yet) at the time of the change. See Story 4.1's Dev Notes for the frontend-side field-routing consumption.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one new DB table + two new enums (additive, no existing-table changes); two new `packages/domain` interfaces; two new GraphQL input types + two new GraphQL output types (`Correction`, `ValidationError`); no `packages/shared-types` change.**
- **Impacted fields/contracts:**
  - `packages/database/schema.ts`: new `corrections` table, `correctionSourceEnum`, `correctionStatusEnum` — additive only. `events`/`schedules` gain no new columns; only their existing columns get new `UPDATE`/`INSERT` write paths from this story's resolver (Story 1.1's original migration already covers every column this story writes).
  - `packages/domain/src/events/types.ts`: new `ProposedScheduleCorrection`/`ProposedEventCorrection` interfaces — no `drizzle-orm` import, not GraphQL-exposed directly (the GraphQL layer uses its own `ProposedEventCorrectionInput`/`ProposedScheduleCorrectionInput` shapes — see "proposedData Arg Type Decision"). These two shapes are deliberately kept in sync by hand (same field set); a future story could consider generating one from the other if drift becomes a problem, but that's out of scope here.
  - `apps/backend/src/schema/corrections.graphql`: new `CorrectionSource`/`CorrectionStatus` enums, `ProposedScheduleCorrectionInput`/`ProposedEventCorrectionInput` input types, `Correction` output type, `submitCorrection` mutation.
  - **Deliberately not touched:** `packages/shared-types/src/index.ts` (the `EventInfo`/`Schedule` interfaces stay as the read-model shape; `ProposedEventCorrection` is a write-model shape scoped to `packages/domain`, matching `GeminiExtractionPayload`'s own precedent of staying domain-scoped rather than promoted to `shared-types`).
- **Required DB migration changes:** One additive migration (Task 1) adding the `corrections` table and its two enums. No backfill.
- **Required TypeScript type changes:** `packages/domain/src/events/types.ts` (new interfaces, Task 2); `apps/backend/src/generated/resolvers-types.ts` regenerated via `codegen` (Task 7) to pick up the new GraphQL types — no manual edits to generated output.
- **Backward compatibility and rollout notes:** Purely additive — no existing resolver, query, or table is modified in a breaking way. `events`/`schedules` gain a second writer (this mutation) alongside Story 3.6b's ingestion pipeline; both write through Drizzle with no risk of schema drift since neither adds columns the other doesn't already expect.
- **Verification checks:** Task 3's 100%-covered pure-function unit tests (all four consistency-check branches); Task 6's real-local-DB integration tests covering every AC3–AC7 branch (AJV rejection, domain-consistency rejection, ownership rejection, and the applied happy path verifying actual `events`/`schedules` row mutations); Task 7's full build/lint/test.

### Project Structure Notes

- **New:** `packages/domain/src/events/validate-correction-consistency.ts` + `.test.ts`; `apps/backend/src/validation/proposed-event-correction.schema.ts`; `apps/backend/src/schema/corrections.graphql`; `apps/backend/src/schema/corrections.test.ts`; one new Drizzle migration file (`0022_*.sql`).
- **Modified:** `packages/database/schema.ts` (new table/enums); `packages/domain/src/events/types.ts` (new interfaces); `packages/domain/src/events/index.ts` (new exports); `apps/backend/src/schema/resolvers.ts` (new `submitCorrection` resolver, new imports); `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen, not hand-edited).
- **Not modified:** `packages/shared-types/src/index.ts`; any existing `.graphql` file (this story adds a new one, `corrections.graphql`, rather than editing `events.graphql`); `apps/web`; `apps/infrastructure` (no new AWS resource — synchronous request/response GraphQL only, per the epic-4 sweep's Gate 1 finding); `SETUP_WALKTHROUGH.md` (no new external vendor); `.env`/`env.ts` (no new env var).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.1a] — this story's authoritative AC/Note text.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md] — swept Gate 1/3 report explicitly covering `4.1a`.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.9.1] — the literal "Data Inconsistency Checks" text (date/time logic, schedule-location consistency) this story's AC4/Task 3 implement.
- [Source: design-artifacts/C-UX-Scenarios/06-data-quality/06.5-data-inconsistency-checks.md] — confirms the single start/end-date-pair UX framing behind the schedule-shape `AskUserQuestion`.
- [Source: packages/database/schema.ts] — `events`/`schedules`/`posts`/`defaultLocationChangeRequests` column sets and FK/index conventions this story's `corrections` table follows (`apiKeys`'/`defaultLocationChangeRequests`' non-cascading `submittedByUserId` FK precedent for audit-trail preservation).
- [Source: packages/shared-types/src/index.ts] — `EventInfo`/`Schedule` interface shapes `ProposedEventCorrection`/`ProposedScheduleCorrection` mirror (minus `id`/`slug`/computed fields not user-correctable).
- [Source: apps/backend/src/validation/extracted-event.schema.ts, validate.ts] — the `JSONSchemaType<T>`/`compileValidator<T>` AJV pattern Task 2 follows exactly.
- [Source: apps/backend/src/schema/resolvers.ts:697-722 (`reportSystemError`)] — the `compileValidator`-at-module-scope + `.errors`-collection pattern Task 5's resolver mirrors.
- [Source: apps/backend/src/schema/resolvers.ts:630-671 (`toggleCalendarAddition`)] — the `schedules`-row-ownership-check-against-`eventId` pattern (`Event ID mismatch`, `BAD_REQUEST`) Task 5's AC5 ownership check is modeled on (adapted to collect into `validationErrors` rather than throw, per AC7).
- [Source: apps/backend/src/lib/auth/context.ts] — `requireAuth`/`requireModerator` (not needed here — `requireAuth` only, no moderator gate on `submitCorrection`).
- [Source: apps/backend/src/schema/user-locations.graphql] — the `extend type Query`/`extend type Mutation`, `input`-for-mutation-args, `String!` (not a custom `DateTime` scalar) for timestamps convention `corrections.graphql` follows.
- [Source: apps/backend/src/schema/events.graphql] — confirms `EventType`/`EventCategory` are already real GraphQL enums, and the `scalar JSON` declaration this story reuses (not redeclared) for `Correction.proposedData`.
- [Source: apps/backend/src/schema/system-errors.test.ts, favorites-and-calendar.test.ts] — the `graphql-yoga` `createSchema`/`createYoga` test-harness pattern (mocked `context.user`) and real-DB seed/cleanup pattern Task 6's `corrections.test.ts` follows.
- [Source: packages/domain/src/events/types.ts, build-event-insert-values.ts] — the domain-package pure-shape/pure-function precedent (`ExtractedEventMessage`, `EventInsertValues`) Task 2/3's new types/function follow, including the "no `drizzle-orm` import" restriction.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, epic-level-sweep-mode guidance (source of citing `epic-4-readiness.md` for Gate 1/3).
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules, #Code-Quality-Style-Rules, #Testing-Rules] — GraphQL-only API style + GraphQL Code Generator end-to-end type safety rule (source of the "proposedData Arg Type Decision"); AJV-for-backend-validation rule; `packages/domain` pure/DB-leakage-free/100%-coverage rules; AD-3 migration rule.
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-3, #AD-7] — code-first Drizzle schema/committed migrations (AD-3); `requireAuth` as the single enforcement surface (AD-7 rule 3).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API & Data (GraphQL-only, GraphQL Code Generator end-to-end type safety, AJV backend validation); Database & Performance (Drizzle-only access, AD-3 migration rule); Code Organization (`packages/domain` pure/DB-leakage-free/100%-coverage rules vs. `apps/backend` DB-coupled resolver code).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (Database Schema Management, primary AD for this story's migration); AD-7 (`requireAuth` as the single enforcement surface for `submitCorrection`).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL only (no Lambda/SQS/EventBridge change), per the epic-4 readiness sweep's Gate 1 finding.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `packages/domain/src/events/validate-correction-consistency.ts` + `.test.ts`; `apps/backend/src/validation/proposed-event-correction.schema.ts`; `apps/backend/src/schema/corrections.graphql`; `apps/backend/src/schema/corrections.test.ts`; one new Drizzle SQL migration file.
- **Modified:** `packages/database/schema.ts`; `packages/domain/src/events/types.ts`; `packages/domain/src/events/index.ts`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/generated/resolvers-types.ts` (regenerated, not hand-edited).
- **Not modified:** `packages/shared-types/src/index.ts`; any existing `.graphql` file; `apps/web`; `apps/infrastructure`; `apps/backend/src/env.ts`; `.env.example`.

### Rule Mapping

- AD-3 (Database Schema Management) → Task 1 (code-first schema edit + `drizzle-kit generate` + committed migration, no manual DDL).
- Database Access (Drizzle ORM only) → Task 5's resolver uses `db.transaction`/`db.select`/`db.insert`/`db.update`/`inArray`, no Supabase client, no raw SQL.
- API & Data (GraphQL-only, GraphQL Code Generator end-to-end type safety) → the "proposedData Arg Type Decision" (strict `ProposedEventCorrectionInput` over a raw `JSON` scalar) → Task 4, Task 7's codegen step.
- API & Data (AJV as the authoritative backend validation gate, Story 0.11) → Task 2's `proposed-event-correction.schema.ts` + Task 5's `compileValidator` usage, narrowed per the "AJV + Domain Split Rationale" to the constraints GraphQL's SDL can't express.
- Code Organization (`packages/domain` pure/no-DB-leakage/100%-coverage) → Task 3's `validateCorrectionConsistency` (pure, fully tested) vs. Task 5's DB-transaction-coupled resolver logic staying in `apps/backend`.
- Reuse over reinvention (`compileValidator`/`reportSystemError`'s AJV-usage pattern; `toggleCalendarAddition`'s schedule-ownership-check pattern; `updateUserSettings`'s `.toISOString()` serialization; `user-locations.graphql`'s `extend type`/`input`-arg/`String!`-timestamp conventions) → Task 2, Task 4, Task 5.
- "Leave the system working end-to-end, not just satisfy stated ACs" (resolving the `proposedData` schedule-shape ambiguity and the AJV/domain-split question via `AskUserQuestion` rather than silently picking) → this workflow's Step 3/3.5 mandate → Dev Notes "proposedData Shape Decision", "Location Consistency Check Decision", "proposedData Arg Type Decision".
- Story-split-gate discipline (Gate 1/3 cited from the swept report; Gate 2 run fresh, no gap) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".

### Verification Plan

- `packages/database`: `pnpm --filter @festgrid/database generate` produces a clean migration; manual review confirms a single additive table + two enums, no unexpected drops/renames.
- `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained, including the new `validate-correction-consistency.ts`.
- `apps/backend`: `pnpm --filter backend codegen` regenerates cleanly against the new `corrections.graphql`; `pnpm --filter backend test` — new `corrections.test.ts` passes (every AC3–AC7 branch); all existing suites remain unmodified and passing.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only the `corrections` table/migration and the `submitCorrection` mutation (validation + apply-or-reject logic) in `apps/backend`/`packages/database`/`packages/domain`. It does **not** implement Story 4.1's correction form UI or Story 4.2's AI-assisted extraction flow — both are separate stories that will call this mutation.
- [ ] Architecture and boundary confirmation: pure consistency-check logic (`validateCorrectionConsistency`, `isScheduleLocationConsistent`) confined to `packages/domain/src/events`, with no `drizzle-orm` import; the DB-transaction-coupled resolver confined to `apps/backend/src/schema/resolvers.ts`; Drizzle ORM is the only DB access path.
- [ ] Testing plan confirmation: `packages/domain`'s new consistency-check function stays 100%-covered; `apps/backend`'s new `corrections.test.ts` gets real-local-DB integration tests covering every AC3–AC7 branch (AJV rejection, domain-consistency rejection, ownership rejection, applied happy path with verified row mutations).
- [ ] **proposedData full-schedules-array shape accepted:** confirm modeling `proposedData.schedules` as a reconcilable array (update-by-`id`/insert-if-no-`id`/never-auto-delete-omitted) rather than a flat single-main-schedule shape — per the user's `AskUserQuestion` decision (see Dev Notes "proposedData Shape Decision").
- [ ] **Location consistency check accepted:** confirm case-insensitive substring containment (not exact match) as the schedule/event location consistency check — per the user's `AskUserQuestion` decision (see Dev Notes "Location Consistency Check Decision").
- [ ] **Strict GraphQL input type accepted:** confirm `ProposedEventCorrectionInput`/`ProposedScheduleCorrectionInput` (not a raw `JSON` scalar) as `submitCorrection`'s `proposedData` argument type, and the resulting AJV+domain validation split — per the user's `AskUserQuestion` decision (see Dev Notes "proposedData Arg Type Decision" and "AJV + Domain Split Rationale").
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-4-readiness.md` (`4.1a` explicitly in `stories_covered`; no gap), with a lightweight guard confirming this story's own field-level design decisions raise no new Gate 1/3 gap. Gate 2 run fresh via subagent — no gap (zero UI surface).
- [ ] **Dependency statuses confirmed:** Story 0.8 (`review`), Story 0.11 (`review`), Story 0.17 (`review`), Story 1.1 (`done`) — all real code, no `backlog` dependency blocking this story.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `packages/domain/src/events/validate-correction-consistency.test.ts` (new, `node:test`, no DB, 100% coverage): end-date/start-date ordering (flagged/not-flagged); end-time/start-time ordering (flagged only on matching dates or absent end date; not flagged across different dates); main-schedule-count (zero/two-plus flagged, exactly-one passes); schedule-location consistency (substring match, case-insensitivity, absent `schedule.location` skips the check); multiple simultaneous errors across multiple schedules all collected, not short-circuited.
- [ ] `apps/backend/src/schema/corrections.test.ts` (new, real local DB, `graphql-yoga` harness mirroring `system-errors.test.ts`): unauthenticated call rejected `UNAUTHENTICATED`; unknown `eventId` rejected `NOT_FOUND` with no `corrections` row inserted; AJV-structural failure (empty `eventName`) returns `status: 'rejected'` with a `validationErrors` entry whose `field` is `'eventName'`; each domain-consistency failure (date ordering, main-schedule count, location mismatch) independently returns `status: 'rejected'` with its specific `{ field, message }`; a schedule `id` belonging to a different event is rejected with a `field: 'schedules[0].id'` ownership error; a fully valid submission returns `status: 'applied'`, `validationErrors: []`, and actually updates `events`/inserts-or-updates `schedules` rows (including preserving a `schedules` row omitted from the array).
- [ ] E2E: not required — no user-facing page/flow yet (Story 4.1 owns that); per `project-context.md`'s testing-trophy philosophy, matches Story 1.3a/3.3a's own "backend-API-layer-only" precedent of integration-test-only coverage.

## Deliverables Checklist

- [ ] `packages/database/schema.ts`: `corrections` table, `correctionSourceEnum`, `correctionStatusEnum` added; migration generated and committed.
- [ ] `packages/domain/src/events/types.ts`: `ProposedScheduleCorrection`, `ProposedEventCorrection` exported.
- [ ] `packages/domain/src/events/validate-correction-consistency.ts`: implemented, 100%-covered.
- [ ] `apps/backend/src/validation/proposed-event-correction.schema.ts`: implemented.
- [ ] `apps/backend/src/schema/corrections.graphql`: implemented (`CorrectionSource`, `CorrectionStatus`, `ProposedScheduleCorrectionInput`, `ProposedEventCorrectionInput`, `Correction`, `submitCorrection`).
- [ ] `apps/backend/src/schema/resolvers.ts`: `submitCorrection` resolver implemented, integration-tested.
- [ ] `apps/backend/src/generated/resolvers-types.ts`: regenerated via codegen.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- Story 4.1's correction form UI (the "Correct Data" button, the pre-filled form, client-side Zod convenience validation) — this story only builds the backend `submitCorrection` mutation it will call.
- Story 4.2's AI-assisted extraction flow (Gemini URL extraction pre-filling the form) — this story only builds the `submitCorrection` mutation Story 4.2 will reuse with `source: 'ai_assisted'`.
- Editing a schedule's `locationDetails`/coordinates (map pin) as part of a correction — deliberately excluded from `ProposedScheduleCorrection`/AJV/GraphQL input scope. The PRD's own "Schedule Consistency" check is text-based (location strings, not coordinates), and no UX artifact describes a map-based correction flow; including it would additionally pull in Story 2.4a's map component or Story 3.3d's `LocationPickerField` as a dependency of Story 4.1's future UI, which nothing in epics.md currently requires. Forward-note: if geocoded-location correction is ever needed, it is a `proposedData` schema extension, not a rework of this story's table/mutation shape.
- A `myCorrections`-style read query (listing a user's past submitted corrections) — epics.md's AC for this story only requires the `submitCorrection` mutation; no read path was requested, unlike `reports`' `myReports` (Story 4.3a). Add one later if a future story needs it.
- Moderator review/override of `applied`/`rejected` corrections — corrections resolve synchronously and are not part of the Moderator Items page's scope (Story 4.7 covers `reports`/`DefaultLocationChangeRequest`, not `corrections`).

## Definition of Done

- [ ] All 8 Acceptance Criteria satisfied.
- [ ] `validate-correction-consistency.test.ts` (new) passing with 100% coverage.
- [ ] `corrections.test.ts` (new) passing, covering every AC3–AC7 branch.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] New Drizzle migration generated, reviewed, and committed (confirmed additive-only — see Data Type Compatibility).
- [ ] `apps/backend` codegen regenerated and committed.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
