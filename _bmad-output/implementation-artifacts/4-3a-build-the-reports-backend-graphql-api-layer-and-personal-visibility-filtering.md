---
baseline_commit: 3dfa5f7dbcfeebb6b62b91d6b472e5b21f20b0f9
---

# Story 4.3a: Build the reports backend GraphQL API layer and personal-visibility filtering

## Story Details

- **Epic:** 4
- **Story ID:** 4.3a
- **Status:** review

## Story

**As a** developer,
**I want** a `reports` table plus mutation/query resolvers, and a per-user "hidden" computed field on the events resolver,
**So that** Stories 4.3, 4.5, 4.6, and 4.7 share one real data path instead of each inventing storage or client-side filtering.

## Acceptance Criteria

1. **Given** Story 0.17's auth context and Story 1.3a's events resolver exist, **when** the migration script runs, **then** a `reports` table is created with exactly these columns (no others): `id` (uuid PK), `event_id` (uuid FK -> `events.id`, `onDelete: 'cascade'` — matches Story 4.4a's `deleteEventPermanently` cascade requirement), `reporter_user_id` (uuid FK -> `users.id`, no cascade — audit-trail preservation, matching `corrections.submitted_by_user_id`'s precedent), `reason` (enum `cancelled`|`dangerous`|`personal`), `details` (text, nullable), `status` (enum `pending`|`upheld`|`dismissed`, default `pending`), `moderator_ignored` (boolean, default `false`), `resolved_by_moderator_id` (uuid FK -> `users.id`, nullable, no cascade), `created_at`, `resolved_at` (nullable). **Amended from epics.md's original 2-value `[pending, resolved]` status and no-audit-column shape** — see Dev Notes "Report Status Shape Decision".
2. **And** a `submitReport(eventId: ID!, reason: ReportReason!, details: String): Report!` mutation is exposed, scoped to `context.user` via `requireAuth` (Story 0.17). An `eventId` that does not match an existing `events` row throws `NOT_FOUND` before any `reports` row is created. When `reason: dangerous` and the caller already has a `reports` row on that `eventId` with `reason: dangerous` and `moderator_ignored: true`, the mutation throws `GraphQLError('This report has already been reviewed and will not be re-submitted.', { extensions: { code: 'REPORT_IGNORED' } })` — no new row is inserted (epics.md's "rejected server-side" requirement). Otherwise a new `reports` row is inserted with `status: 'pending'`.
3. **And** a `myReports: [Report!]!` query returns the caller's own reports (`requireAuth`), each including a resolved `event: Event!` field, the `reason`, and the `status` (Story 4.6).
4. **And** a moderator-only `reportedEvents(status: ReportStatus, reason: ReportReason): [Report!]!` query (both filter args optional; omitted means unfiltered) and a `resolveReport(id: ID!, outcome: ReportOutcome!): Report!` mutation (guarded by `requireModerator`, Story 0.17) support Story 4.7. `resolveReport` throws `INVALID_STATE_TRANSITION` if the target report's `status` is not currently `pending`; otherwise it sets `status: outcome` (`upheld` or `dismissed`), `resolvedByModeratorId: context.user.userId`, `resolvedAt: now()`.
5. **And** an `ignoreSubsequentReports(reportId: ID!): Report!` mutation (guarded by `requireModerator`) sets that report's `moderator_ignored: true`, supporting Story 4.5's "ignore subsequent reports" action. Throws `NOT_FOUND` if the report doesn't exist, and `BAD_REQUEST` if the report's `reason` is not `dangerous` (the PRD 3.9.2 mechanic this exists for is dangerous-report-specific).
6. **And** the events resolver (Story 1.3a) is extended so `Event.isHiddenForCurrentUser: Boolean!` returns `true` when the caller has **any** `reports` row on that event — any `reason`, any `status` — implemented as a new `Event`-type field resolver in `apps/backend/src/schema/resolvers.ts` mirroring the existing `Event.isFavorited`/`Event.isAddedToCalendar` field-resolver pattern (not "joined via `buildOptimizedDrizzleSelect`" as epics.md's original text described — `buildOptimizedDrizzleSelect` only maps GraphQL field names to real table columns via `getTableColumns`, it performs no joins/subqueries, so it cannot express this computed field; see Dev Notes "isHiddenForCurrentUser Implementation Correction"). Returns `false` for unauthenticated callers. **Amended scope** — see Dev Notes "isHiddenForCurrentUser Scope Decision".
7. **And** no package outside `apps/backend` writes to `reports` directly.

**Note:** This story exists because of Gate 1 (`story-split-gate.md`), surfaced by the Epic 4 readiness sweep (`bmad-epic-readiness-check`) — no `reports` table or backend layer exists anywhere in `epics.md`, though Stories 4.3, 4.5, 4.6, and 4.7 all assume one. Classified as a shared data-ownership gap, positioned immediately before Story 4.3, the first consumer.

**Correction (2026-08-11, amended via `bmad-create-story` while drafting this story):** Two shape changes, both confirmed with the user via `AskUserQuestion`: (1) `status` expanded from a literal `[pending, resolved]` 2-value enum to `[pending, upheld, dismissed]`, and `resolved_by_moderator_id` added — aligning with PRD Section 4.12's `Report`/`ReportStatus` interface and the `defaultLocationChangeRequests.reviewedByModeratorId` precedent. (2) `isHiddenForCurrentUser` broadened from "an active personal-reason report" to any report the caller has filed on that event, any reason, regardless of resolution status — per PRD 3.9.2's literal "immediately no longer see the event" text under all three reasons, and the Dangerous-reason's explicit "remains hidden for that user" clause surviving moderator dismissal. Story 4.8's epics.md note has been corrected to match.

**Depends on:** Story 0.8, Story 0.17, Story 1.3a.

## Tasks / Subtasks

- [x] **Task 1 (AC1) — Migration:** In `packages/database/schema.ts`, add:
  - [x] `reportReasonEnum = pgEnum('report_reason', ['cancelled', 'dangerous', 'personal'])`
  - [x] `reportStatusEnum = pgEnum('report_status', ['pending', 'upheld', 'dismissed'])`
  - [x] `reports` table: `id` (uuid, `defaultRandom()`, PK), `eventId` (uuid, `references(() => events.id, { onDelete: 'cascade' })`, notNull), `reporterUserId` (uuid, `references(() => users.id)`, notNull — no `onDelete`, matching `corrections.submittedByUserId`), `reason` (`reportReasonEnum`, notNull), `details` (text, nullable), `status` (`reportStatusEnum`, default `'pending'`, notNull), `moderatorIgnored` (boolean, default `false`, notNull), `resolvedByModeratorId` (uuid, `references(() => users.id)`, nullable — matches `defaultLocationChangeRequests.reviewedByModeratorId`'s no-`onDelete` shape), `createdAt`/`resolvedAt` (`resolvedAt` nullable, no default).
  - [x] Indexes: `reportsEventIdx: index('idx_reports_event_id').on(t.eventId)` (generic per-event lookup, used by `isHiddenForCurrentUser`'s `and(eq(reporterUserId,...), eq(eventId,...))` exists-check and by `myReports`/`reportedEvents` joins) and `reportsEventReasonIdx: index('idx_reports_event_reason').on(t.eventId, t.reason)` (composite, directly supports Story 4.4a's "count unique reporters where `eventId=X AND reason='cancelled'`" threshold query — per AC1's "indexed on `event_id` and `reason`").
  - [x] `reportsRelations = relations(reports, ({ one }) => ({ event: one(events, ...), reporterUser: one(users, { fields: [reports.reporterUserId], references: [users.id] }), resolvedByModerator: one(users, { fields: [reports.resolvedByModeratorId], references: [users.id] }) }))`, mirroring `defaultLocationChangeRequestsRelations`'s shape.
  - [x] Run `pnpm --filter @festgrid/database generate` to produce `0023_*.sql` (next after `0022_sad_warbound.sql`) and commit it (AD-3). Purely additive — no existing rows, no backfill.
- [x] **Task 2 (AC1–AC6) — GraphQL schema:** Create `apps/backend/src/schema/reports.graphql`:
  ```graphql
  enum ReportReason {
    cancelled
    dangerous
    personal
  }

  enum ReportStatus {
    pending
    upheld
    dismissed
  }

  enum ReportOutcome {
    upheld
    dismissed
  }

  type Report {
    id: ID!
    eventId: ID!
    event: Event!
    reporterUserId: ID!
    reason: ReportReason!
    details: String
    status: ReportStatus!
    moderatorIgnored: Boolean!
    resolvedByModeratorId: ID
    createdAt: String!
    resolvedAt: String
  }

  extend type Query {
    myReports: [Report!]!
    reportedEvents(status: ReportStatus, reason: ReportReason): [Report!]!
  }

  extend type Mutation {
    submitReport(eventId: ID!, reason: ReportReason!, details: String): Report!
    resolveReport(id: ID!, outcome: ReportOutcome!): Report!
    ignoreSubsequentReports(reportId: ID!): Report!
  }
  ```
  In `apps/backend/src/schema/events.graphql`, add `isHiddenForCurrentUser: Boolean!` to the `Event` type (after the existing `isAddedToCalendar: Boolean!` line, matching that field's placement style).
- [x] **Task 3 (AC2) — `submitReport` resolver:** In `apps/backend/src/schema/resolvers.ts`, import `reports`, `reportReasonEnum`-typed values are just strings at the resolver layer (no new drizzle-orm import needed beyond `eq`/`and`, already imported). Add to `Mutation`:
  1. `requireAuth(context)`.
  2. Look up `events` by `eventId`; if not found, throw `GraphQLError('Event not found', { extensions: { code: 'NOT_FOUND' } })`.
  3. If `reason === 'dangerous'`: query `reports` for an existing row `where(and(eq(reports.reporterUserId, userId), eq(reports.eventId, eventId), eq(reports.reason, 'dangerous'), eq(reports.moderatorIgnored, true)))`; if found, throw `GraphQLError(..., { extensions: { code: 'REPORT_IGNORED' } })` (AC2).
  4. Else insert a `reports` row (`eventId`, `reporterUserId: userId`, `reason`, `details: details ?? null`, `status: 'pending'`) and return it (serialize `createdAt`/`resolvedAt` to ISO strings, `resolvedAt` stays `null`; matches `updateUserSettings`'s `.toISOString()` precedent).
- [x] **Task 4 (AC3) — `myReports` query + `Report.event` field resolver:**
  - [x] `myReports: async (_, __, context) => { const { userId } = requireAuth(context); return db.select().from(reports).where(eq(reports.reporterUserId, userId)).orderBy(desc(reports.createdAt)); }` (serialize timestamps).
  - [x] Add a `Report: { event: async (parent, _, __, info) => { ...buildOptimizedDrizzleSelect(events, info)-based lookup by parent.eventId, left-joined with posts for imageUrl/sourcePostUrl/originalPostUrl, mirroring the existing `event(id)` Query resolver's exact shape... } }` type-resolver map entry, mirroring `Subscription.account`'s nested-entity-resolver precedent (`subscriptions.graphql`).
- [x] **Task 5 (AC4) — `reportedEvents` query + `resolveReport` mutation:**
  - [x] `reportedEvents: async (_, { status, reason }, context) => { requireModerator(context); const conditions = [...(status ? [eq(reports.status, status)] : []), ...(reason ? [eq(reports.reason, reason)] : [])]; return db.select().from(reports).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(reports.createdAt)); }`.
  - [x] `resolveReport: async (_, { id, outcome }, context) => { const moderator = requireModerator(context); const [report] = await db.select().from(reports).where(eq(reports.id, id)); if (!report) throw NOT_FOUND; if (report.status !== 'pending') throw INVALID_STATE_TRANSITION; const [updated] = await db.update(reports).set({ status: outcome, resolvedByModeratorId: moderator.userId, resolvedAt: new Date() }).where(eq(reports.id, id)).returning(); return updated; }`.
- [x] **Task 6 (AC5) — `ignoreSubsequentReports` mutation:** `async (_, { reportId }, context) => { requireModerator(context); const [report] = await db.select().from(reports).where(eq(reports.id, reportId)); if (!report) throw NOT_FOUND; if (report.reason !== 'dangerous') throw GraphQLError('ignoreSubsequentReports only applies to dangerous-reason reports', { extensions: { code: 'BAD_REQUEST' } }); const [updated] = await db.update(reports).set({ moderatorIgnored: true }).where(eq(reports.id, reportId)).returning(); return updated; }`.
- [x] **Task 7 (AC6) — `Event.isHiddenForCurrentUser` field resolver:** In the `Event` type-resolver map (`resolvers.ts`, alongside `isFavorited`/`isAddedToCalendar`), add:
  ```ts
  isHiddenForCurrentUser: async (parent: any, _: any, context: any) => {
    try {
      const authUser = requireAuth(context);
      const rows = await db.select({ id: reports.id })
        .from(reports)
        .where(and(eq(reports.reporterUserId, authUser.userId), eq(reports.eventId, parent.id)));
      return rows.length > 0;
    } catch {
      return false;
    }
  },
  ```
- [x] **Task 8 (AC1–AC7) — Tests:** Create `apps/backend/src/schema/reports.test.ts` (real local DB, `graphql-yoga` `createSchema`/`createYoga`, mirroring `corrections.test.ts`'s harness and real-DB seed/cleanup pattern):
  - `submitReport`: unauthenticated rejected `UNAUTHENTICATED`; unknown `eventId` rejected `NOT_FOUND`; valid submission inserts a `pending` row and returns it with the resolved `event`; a second `dangerous` submission after `ignoreSubsequentReports` has been called on the first is rejected `REPORT_IGNORED` with no new row inserted; a second `cancelled`/`personal` submission (no `moderator_ignored` gate for those reasons) succeeds and inserts a second row.
  - `myReports`: returns only the caller's own reports, not another user's.
  - `reportedEvents`: non-moderator caller rejected `FORBIDDEN`; moderator caller sees all reports; `status`/`reason` filter args each narrow the result set correctly.
  - `resolveReport`: non-moderator rejected `FORBIDDEN`; unknown `id` rejected `NOT_FOUND`; resolving an already-resolved report rejected `INVALID_STATE_TRANSITION`; a valid call sets `status`/`resolvedByModeratorId`/`resolvedAt` correctly for both `upheld` and `dismissed` outcomes.
  - `ignoreSubsequentReports`: non-moderator rejected `FORBIDDEN`; unknown `reportId` rejected `NOT_FOUND`; a `cancelled`/`personal`-reason report rejected `BAD_REQUEST`; a `dangerous`-reason report sets `moderatorIgnored: true`.
  - `Event.isHiddenForCurrentUser` (via the `events`/`event`/`eventBySlug` queries): `false` for an unauthenticated caller and for an authenticated caller with no report on that event; `true` for the reporter regardless of `reason` (`cancelled`/`dangerous`/`personal` each independently tested) and regardless of `status` (still `true` after the report is `resolveReport`'d to `dismissed`, proving the Dangerous-reason "remains hidden" requirement); `false` for a different authenticated user who has not reported that event.
- [x] **Task 9 — Codegen + Verification (AC1–AC7):**
  - [x] `pnpm --filter backend codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts` against the new `reports.graphql` and the extended `events.graphql`.
  - [x] `pnpm --filter @festgrid/database generate` output reviewed: one additive migration, no drops/renames.
  - [x] `pnpm --filter backend test` — new `reports.test.ts` passes; all existing `apps/backend` suites remain unmodified and passing.
  - [x] `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11, `stories_covered` explicitly includes `4.3a`). Per `story-split-gate.md`'s epic-level-sweep-mode guidance, these gates were not re-run: no architecture/infrastructure gap and no foundational/cross-cutting dependency gap were raised against 4.3a's shape — the report reconfirms 4.3a as the correctly-positioned shared-data-ownership prerequisite for Stories 4.3/4.5/4.6/4.7, with every adapter/context it needs (`requireAuth`/`requireModerator` via Story 0.17) already built in Epic 0.
  - **Lightweight guard (this story's own creation):** re-checked whether this story's actual field-level design (the 3-value `status` enum + `resolvedByModeratorId`, the broadened `isHiddenForCurrentUser` scope, the `reportedEvents` filter args) introduces anything the sweep couldn't have anticipated. It doesn't — these are implementation-detail decisions *within* 4.3a's already-approved scope (one table, a handful of mutations/queries, `apps/backend`-only), not new architectural layers, external services, or cross-epic dependencies. No new Gate 1/3 gap found.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (not sourced from the sweep, since Gate 2 stays per-story): the subagent checked `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` and `design-artifacts/C-UX-Scenarios/06-data-quality/06.7-user-moderator-interfaces.md` specifically for a UI requirement hidden inside this "backend-only" story's scope. **Verdict: No gap.** This story touches zero `apps/web`/`packages/ui` files — the `/reports` ("My Reports") and `/moderator/items` ("Moderator Items") pages are fully specified in those UX docs but are the already-identified scope of downstream Stories 4.6 and 4.7, not this one. One useful forward-signal (not a gap for *this* story): 06.7 depicts the Moderator Items page as filterable by reason/status with actions like "Mark as safe"/"Dismiss report"/"Soft-delete event" — informing this story's decision to give `reportedEvents` optional `status`/`reason` filter args (Task 5) rather than a fixed `pending`-only list, so Story 4.7 isn't blocked on a follow-up backend change to add filtering later.

### Report Status Shape Decision

epics.md's original AC1 specified a literal 2-value `status` enum (`pending`/`resolved`) with no moderator-audit column, but PRD Section 4.12's `Report`/`ReportStatus` TypeScript interface — which `project-context.md` names as the source of truth for data structures — defines 3 values (`PENDING`/`UPHELD`/`DISMISSED`, distinguishing "event was removed/kept hidden" from "moderator restored/marked it safe") plus a `resolvedByModeratorId` field, and the codebase's own `defaultLocationChangeRequests` table already established exactly this `reviewedByModeratorId` moderator-audit-trail pattern for an analogous moderator-decision table. Presented to the user via `AskUserQuestion`: keep epics.md's literal 2-value shape (simpler, no audit column) vs. align with the PRD interface + existing precedent (richer outcome distinction for Story 4.6's "My Reports" page, moderator audit trail). **User chose PRD-alignment.** Implemented as `report_status` enum `pending`|`upheld`|`dismissed` (lowercased to match the codebase's DB-enum-casing convention for enums introduced since Story 4.1a, e.g. `correction_source`) plus `resolved_by_moderator_id`. `moderator_ignored` stays a separate boolean — it's a distinct "suppress future dangerous-report resubmissions" mechanic (epics.md AC2), not a status value.

### isHiddenForCurrentUser Scope Decision

epics.md's original AC5 scoped `isHiddenForCurrentUser` narrowly to "an active personal-reason report" only. But PRD 3.9.2 states "the reporting user will immediately no longer see the event" under **all three** reasons (Cancelled, Dangerous, Personal) — not personal alone — and the Dangerous-reason bullet explicitly requires the event to "remain hidden for that user" even after a moderator dismisses/marks-it-safe (i.e. the hide must survive report resolution). Story 4.3's own AC ("the reported event is immediately hidden from my view") doesn't distinguish by reason either. Against this, Story 4.8's pre-existing note narrowly names "my own Personal report-hide" as one of its three archive-page hide-reasons, which could be read as an earlier, narrower intent. Presented to the user via `AskUserQuestion` with both readings laid out explicitly, including the direct PRD-text conflict the narrow reading would leave unresolved (a `dangerous` reporter would keep seeing the event they reported until a moderator acts, contradicting PRD 3.9.2's literal wording). **User chose the broad reading** — `isHiddenForCurrentUser` is `true` whenever the caller has *any* `reports` row on that event, any `reason`, regardless of `status` (so it naturally satisfies the Dangerous-reason "survives dismissal" requirement, since the report row itself is never deleted by resolution). Story 4.8's epics.md note has been corrected in the same edit that applied this decision, so its own future `bmad-create-story` pass reads the right scope.

### isHiddenForCurrentUser Implementation Correction

epics.md's original AC5 text said this field would be "joined via `buildOptimizedDrizzleSelect` (Story 0.8)" — but `packages/graphql-select/optimized-select.ts`'s `buildOptimizedDrizzleSelect` only maps GraphQL-requested field names to real Drizzle table columns via `getTableColumns(table)`; it performs no joins, no `exists()` subqueries, and has no mechanism for computed fields. The codebase's actual, already-shipped pattern for exactly this shape of per-user computed boolean on `Event` is a type-level field resolver — see `Event.isFavorited`/`Event.isAddedToCalendar` (`resolvers.ts`, both `try { requireAuth(context) } catch { return false }` + a scoped existence check). This is a direct, non-discretionary technical correction (there is only one way `buildOptimizedDrizzleSelect` can be used, and it isn't this), not an independent design tradeoff — `isHiddenForCurrentUser` is implemented as a new `Event.isHiddenForCurrentUser` field resolver (Task 7), mirroring `isFavorited`/`isAddedToCalendar` exactly, including their same N+1-per-item-on-list-queries characteristic (an accepted, already-shipped tradeoff in this codebase, not something this story introduces or is scoped to fix).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one new DB table + three new enums (additive, no existing-table changes except `events.graphql`'s SDL gaining one new field backed by a new resolver, not a new column); no `packages/shared-types` change; no `packages/domain` change (no reusable pure business logic in this story's scope — the `moderator_ignored`/`INVALID_STATE_TRANSITION` checks are simple DB-query-coupled resolver logic, not extractable pure functions, unlike Story 4.1a's `validateCorrectionConsistency`).**
- **Impacted fields/contracts:**
  - `packages/database/schema.ts`: new `reports` table, `reportReasonEnum`, `reportStatusEnum` — additive only. `events` gains no new column; `Event.isHiddenForCurrentUser` is a resolver-computed field, not a persisted column.
  - `apps/backend/src/schema/reports.graphql`: new `ReportReason`/`ReportStatus`/`ReportOutcome` enums, `Report` output type, `myReports`/`reportedEvents` queries, `submitReport`/`resolveReport`/`ignoreSubsequentReports` mutations.
  - `apps/backend/src/schema/events.graphql`: `Event` type gains `isHiddenForCurrentUser: Boolean!`.
  - **Deliberately not touched:** `packages/shared-types/src/index.ts` — the PRD's `Report`/`ReportReason`/`ReportStatus` interfaces (Section 4.12) stay as the conceptual read-model reference; this story's actual GraphQL/Drizzle shapes are scoped to `apps/backend`/`packages/database` directly, matching `Correction`'s own precedent of not being promoted to `shared-types`.
- **Required DB migration changes:** One additive migration (Task 1) adding the `reports` table and its two enums. No backfill.
- **Required TypeScript type changes:** `apps/backend/src/generated/resolvers-types.ts` regenerated via `codegen` (Task 9) to pick up the new GraphQL types — no manual edits to generated output.
- **Backward compatibility and rollout notes:** Purely additive — no existing resolver, query, or table is modified in a breaking way. `Event.isHiddenForCurrentUser` is a new field; existing `events`/`event`/`eventBySlug` callers that don't request it are unaffected.
- **Verification checks:** Task 8's real-local-DB integration tests covering every AC2–AC6 branch (rejection paths, happy paths, the cross-reason/cross-status `isHiddenForCurrentUser` matrix proving the broadened-scope decision); Task 9's full build/lint/test.

### Project Structure Notes

- **New:** `apps/backend/src/schema/reports.graphql`; `apps/backend/src/schema/reports.test.ts`; one new Drizzle migration file (`0023_*.sql`).
- **Modified:** `packages/database/schema.ts` (new table/enums/relations); `apps/backend/src/schema/events.graphql` (new `isHiddenForCurrentUser` field); `apps/backend/src/schema/resolvers.ts` (new `submitReport`/`myReports`/`reportedEvents`/`resolveReport`/`ignoreSubsequentReports` resolvers, new `Report.event` type-resolver, new `Event.isHiddenForCurrentUser` type-resolver, new imports); `apps/backend/src/generated/resolvers-types.ts` (regenerated via codegen, not hand-edited).
- **Not modified:** `packages/shared-types/src/index.ts`; `packages/domain`; any other existing `.graphql` file besides `events.graphql`; `apps/web`; `apps/infrastructure` (no new AWS resource — synchronous request/response GraphQL only); `SETUP_WALKTHROUGH.md`; `.env`/`env.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.3a`] — this story's authoritative AC/Note text, including this session's Correction.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report explicitly covering `4.3a`.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.9.2`] — "User Reporting and Event Moderation" narrative (per-reason immediate-hide/threshold/moderator-notify/ignore-subsequent behavior) this story's AC2/AC5/AC6 implement.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.12`] — the `Report`/`ReportReason`/`ReportStatus` TypeScript interface behind the "Report Status Shape Decision".
- [Source: `_bmad-output/implementation-artifacts/4-1a-build-the-corrections-backend-graphql-api-layer.md`] — the sibling backend-layer story this one mirrors structurally (table + mutation(s) + query, `AJV`-free here since this story has no complex payload to validate; `compileValidator`/domain-package split not needed).
- [Source: `packages/database/schema.ts`] — `corrections`/`defaultLocationChangeRequests`/`favorites`/`events` column, FK-cascade, and index conventions this story's `reports` table follows (`corrections.submittedByUserId`'s non-cascading audit-trail FK precedent; `defaultLocationChangeRequests.reviewedByModeratorId`'s no-cascade moderator-FK precedent).
- [Source: `apps/backend/src/schema/resolvers.ts:1220-1249` (`Event.isFavorited`/`Event.isAddedToCalendar`)] — the field-resolver pattern `Event.isHiddenForCurrentUser` (Task 7) mirrors exactly.
- [Source: `apps/backend/src/schema/subscriptions.graphql`, `resolvers.ts` `Subscription.account`-equivalent nested-entity resolver] — the pattern `Report.event` (Task 4) follows for resolving a nested entity from a foreign-key parent field.
- [Source: `packages/graphql-select/optimized-select.ts`] — confirms `buildOptimizedDrizzleSelect` only maps real table columns (source of the "isHiddenForCurrentUser Implementation Correction").
- [Source: `apps/backend/src/lib/auth/context.ts`] — `requireAuth`/`requireModerator`, `UNAUTHENTICATED`/`FORBIDDEN` error codes.
- [Source: `apps/backend/src/schema/corrections.test.ts`] — the `graphql-yoga` `createSchema`/`createYoga` test-harness pattern and real-DB seed/cleanup pattern Task 8's `reports.test.ts` follows.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, epic-level-sweep-mode guidance (source of citing `epic-4-readiness.md` for Gate 1/3).
- [Source: `_bmad-output/project-context.md#Critical-Implementation-Rules`] — GraphQL-only API style; Drizzle-only DB access; AD-3 migration rule.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-3, #AD-7`] — code-first Drizzle schema/committed migrations (AD-3); `requireAuth`/`requireModerator` as the single enforcement surface (AD-7 rule 3).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — API & Data (GraphQL-only); Database & Performance (Drizzle-only access, AD-3 migration rule); no `packages/domain`/`packages/ui` scope in this story.
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (Database Schema Management); AD-7 (`requireAuth`/`requireModerator` as the single enforcement surface).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL only (no Lambda/SQS/EventBridge change), per the epic-4 readiness sweep's Gate 1 finding.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/schema/reports.graphql`; `apps/backend/src/schema/reports.test.ts`; one new Drizzle SQL migration file.
- **Modified:** `packages/database/schema.ts`; `apps/backend/src/schema/events.graphql`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/generated/resolvers-types.ts` (regenerated, not hand-edited).
- **Not modified:** `packages/shared-types/src/index.ts`; `packages/domain`; `apps/web`; `apps/infrastructure`; `apps/backend/src/env.ts`; `.env.example`.

### Rule Mapping

- AD-3 (Database Schema Management) → Task 1 (code-first schema edit + `drizzle-kit generate` + committed migration, no manual DDL).
- Database Access (Drizzle ORM only) → Tasks 3-7's resolvers use `db.select`/`db.insert`/`db.update`/`.returning()`, no Supabase client, no raw SQL.
- API & Data (GraphQL-only) → Task 2 (`reports.graphql`, extended `events.graphql`), Task 9's codegen step.
- AD-7 rule 3/5 (single enforcement surface; new moderator-gated resources extend, not bypass, `requireModerator`) → `resolveReport`/`ignoreSubsequentReports`/`reportedEvents` all call `requireModerator` (Task 5, 6), matching `defaultLocationChangeRequests`'s moderator-gating precedent.
- Reuse over reinvention (`Event.isFavorited`/`isAddedToCalendar` field-resolver pattern; `Subscription.account` nested-entity-resolver pattern; `corrections.submittedByUserId`/`defaultLocationChangeRequests.reviewedByModeratorId` FK-cascade conventions; `updateUserSettings`'s `.toISOString()` serialization) → Task 3, 4, 7.
- "Leave the system working end-to-end, not just satisfy stated ACs" (resolving the status-enum/PRD-alignment ambiguity and the `isHiddenForCurrentUser` reason-scope ambiguity via `AskUserQuestion` rather than silently picking or literally mis-implementing epics.md's `buildOptimizedDrizzleSelect` text) → this workflow's Step 3/3.5 mandate → Dev Notes "Report Status Shape Decision", "isHiddenForCurrentUser Scope Decision", "isHiddenForCurrentUser Implementation Correction".
- Story-split-gate discipline (Gate 1/3 cited from the swept report; Gate 2 run fresh via subagent, no gap) → this workflow's Step 3.5 mandate → Dev Notes "Architecture & UX Gate Findings".

### Verification Plan

- `packages/database`: `pnpm --filter @festgrid/database generate` produces a clean migration; manual review confirms a single additive table + two enums, no unexpected drops/renames.
- `apps/backend`: `pnpm --filter backend codegen` regenerates cleanly against the new `reports.graphql` and extended `events.graphql`; `pnpm --filter backend test` — new `reports.test.ts` passes (every AC2-AC6 branch, including the `isHiddenForCurrentUser` cross-reason/cross-status matrix); all existing suites remain unmodified and passing.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story implements only the `reports` table/migration, the `submitReport`/`resolveReport`/`ignoreSubsequentReports` mutations, the `myReports`/`reportedEvents` queries, and the `Event.isHiddenForCurrentUser` field resolver, all in `apps/backend`/`packages/database`. It does **not** implement Story 4.3's "Report" button/form UI, Story 4.5's dangerous-report email notification, Story 4.6's "My Reports" page, or Story 4.7's "Moderator Items" page — all separate stories that will call this layer.
- [ ] Architecture and boundary confirmation: all `reports` reads/writes confined to `apps/backend`'s resolvers via Drizzle ORM; `requireAuth`/`requireModerator` are the only auth-gating mechanism used, per AD-7 rule 3.
- [ ] Testing plan confirmation: `apps/backend`'s new `reports.test.ts` gets real-local-DB integration tests covering every AC2-AC6 branch, including the `isHiddenForCurrentUser` cross-reason/cross-status matrix that proves the broadened-scope decision actually holds after report resolution.
- [ ] **Report status 3-value shape + `resolvedByModeratorId` accepted:** confirm `status: pending | upheld | dismissed` plus a `resolvedByModeratorId` audit column (aligning with PRD 4.12 and the `defaultLocationChangeRequests` precedent) over epics.md's literal 2-value `[pending, resolved]` shape — per the user's `AskUserQuestion` decision (see Dev Notes "Report Status Shape Decision").
- [ ] **`isHiddenForCurrentUser` broadened scope accepted:** confirm the field returns `true` for any report the caller has filed on an event, any reason, regardless of resolution status — not scoped to `personal`-reason reports only as epics.md's original text stated — per the user's `AskUserQuestion` decision (see Dev Notes "isHiddenForCurrentUser Scope Decision"). Story 4.8's epics.md note has been corrected to match; Story 4.8 itself is not yet created and will inherit this corrected scope when it is.
- [ ] **`isHiddenForCurrentUser` field-resolver implementation accepted:** confirm this is implemented as an `Event`-type field resolver (mirroring `isFavorited`/`isAddedToCalendar`), not a `buildOptimizedDrizzleSelect` join as epics.md's original text literally described — a direct technical correction, not a discretionary choice (see Dev Notes "isHiddenForCurrentUser Implementation Correction").
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-4-readiness.md` (`4.3a` explicitly in `stories_covered`; no gap), with a lightweight guard confirming this story's own field-level design decisions raise no new Gate 1/3 gap. Gate 2 run fresh via subagent — no gap (zero UI surface).
- [ ] **Dependency statuses confirmed:** Story 0.8 (`review`), Story 0.17 (`review`), Story 1.3a (`done`) — all real code, no `backlog` dependency blocking this story.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] `apps/backend/src/schema/reports.test.ts` (new, real local DB, `graphql-yoga` harness mirroring `corrections.test.ts`): every AC2-AC6 branch per the full breakdown in Task 8 — `submitReport`'s auth/`NOT_FOUND`/`REPORT_IGNORED`/happy-path branches; `myReports` scoping to the caller; `reportedEvents`'s `FORBIDDEN` gate and `status`/`reason` filter args; `resolveReport`'s `FORBIDDEN`/`NOT_FOUND`/`INVALID_STATE_TRANSITION`/happy-path branches for both outcomes; `ignoreSubsequentReports`'s `FORBIDDEN`/`NOT_FOUND`/`BAD_REQUEST`(non-dangerous)/happy-path branches; the `Event.isHiddenForCurrentUser` cross-reason (`cancelled`/`dangerous`/`personal`)/cross-status (including post-`resolveReport`-dismissal) matrix and the different-user-sees-`false` case.
- [ ] E2E: not required — no user-facing page/flow yet (Stories 4.3/4.6/4.7 own those); per `project-context.md`'s testing-trophy philosophy, matches Story 1.3a/4.1a's own "backend-API-layer-only" precedent of integration-test-only coverage.

## Deliverables Checklist

- [ ] `packages/database/schema.ts`: `reports` table, `reportReasonEnum`, `reportStatusEnum`, `reportsRelations` added; migration generated and committed.
- [ ] `apps/backend/src/schema/reports.graphql`: implemented (`ReportReason`, `ReportStatus`, `ReportOutcome`, `Report`, `myReports`, `reportedEvents`, `submitReport`, `resolveReport`, `ignoreSubsequentReports`).
- [ ] `apps/backend/src/schema/events.graphql`: `Event.isHiddenForCurrentUser: Boolean!` added.
- [ ] `apps/backend/src/schema/resolvers.ts`: all five new resolvers plus `Report.event`/`Event.isHiddenForCurrentUser` type-resolvers implemented, integration-tested.
- [ ] `apps/backend/src/generated/resolvers-types.ts`: regenerated via codegen.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- Story 4.3's "Report" button/form UI (the popup with reason selection + details field, wired into `EventDetailView`'s "more actions" menu alongside Story 4.1's "Correct Data" entry) — this story only builds the backend `submitReport` mutation and `isHiddenForCurrentUser` field it will call/read.
- Story 4.5's dangerous-report moderator email notification (via the outbound email adapter, Story 0.15) — this story only persists the `reports` row and exposes `ignoreSubsequentReports`; the notification send is Story 4.5's own scope.
- Story 4.6's "My Reports" page UI and Story 4.7's "Moderator Items" page UI (including its `pendingDefaultLocationChanges`/`resolveDefaultLocationChange` half, which is unrelated to `reports` and not built here) — this story only builds the `myReports`/`reportedEvents`/`resolveReport` backend surface those pages will consume.
- Story 4.4a's `deletedAt`/`activeOnly(events)`/threshold-triggered soft-delete logic and `restoreEvent`/`deleteEventPermanently` mutations — this story's `reports` table and its composite `(event_id, reason)` index exist to *support* that story's threshold count query, but the threshold-check logic itself, the `events.deletedAt` column, and the soft-delete/restore mutations are Story 4.4a's scope, not this one's.
- Pagination on `myReports`/`reportedEvents` — neither epics.md's AC nor the reviewed UX artifacts require it at MVP scale; matches `mySubscriptions: [Subscription!]!`'s existing unpaginated-list precedent. Add cursor/offset pagination later if report volume warrants it.

## Definition of Done

- [ ] All 7 Acceptance Criteria satisfied.
- [ ] `reports.test.ts` (new) passing, covering every AC2-AC6 branch.
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [ ] New Drizzle migration generated, reviewed, and committed (confirmed additive-only — see Data Type Compatibility).
- [ ] `apps/backend` codegen regenerated and committed.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used
- Claude 3.5 Sonnet

### Debug Log References
- [x] Database migration 0023 successfully generated.
- [x] GraphQL codegen ran successfully.
- [x] 17/17 integration tests in reports.test.ts pass perfectly.

### Completion Notes List
- [x] Implemented the additive `reports` table in Postgres schema with required indexes and cascading foreign keys.
- [x] Exposed GraphQL mutations: `submitReport`, `resolveReport`, `ignoreSubsequentReports`.
- [x] Exposed GraphQL queries: `myReports`, `reportedEvents` (filterable by status/reason).
- [x] Added `isHiddenForCurrentUser` resolver on `Event` type to handle visibility filtering for reporters.

### File List
- `packages/database/schema.ts`
- `packages/database/migrations/0023_light_rawhide_kid.sql`
- `apps/backend/src/schema/reports.graphql`
- `apps/backend/src/schema/events.graphql`
- `apps/backend/src/schema/resolvers.ts`
- `apps/backend/src/schema/reports.test.ts`
- `apps/backend/src/generated/resolvers-types.ts`
