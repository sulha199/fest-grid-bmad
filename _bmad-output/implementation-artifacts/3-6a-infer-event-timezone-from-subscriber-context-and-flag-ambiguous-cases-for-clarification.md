---
baseline_commit: 3e4039f4dcea8c521a30de21abbb82485f5ebd4c
---

# Story 3.6a: Infer event timezone from subscriber context and flag ambiguous cases for clarification

## Story Details

- **Epic:** 3
- **Story ID:** 3.6a
- **Status:** review

## Story

**As a** system,
**I want** to complete PRD FR33's timezone-inference strategy beyond location-based inference — falling back to the subscribing user's own timezone when a resolved location has no timezone, and flagging an event for manual clarification when neither is available with high confidence,
**So that** an extracted event's schedule always has the best available timezone information, and ambiguous cases are surfaced rather than silently defaulted.

## Acceptance Criteria

1. **Given** a schedule did **not** receive a Tier-1 (location-based) timezone via Story 3.6's AC6 (i.e. `resolvedScheduleLocations.get(i)?.timezone` is absent — either no location resolved at all, or a resolved `LocationDetails` with no `timezone`), **when** the schedule's source social-media account has **exactly one** active subscriber (via the already-built `getActiveSubscriberUserIds(accountId): Promise<string[]>`, Story 3.6 Task 4) **and** that subscriber's `users.timezone` column is set, **then** that subscriber's `timezone` is used as the schedule's effective timezone (`ExtractedScheduleMessage.timezone`), and `ExtractedScheduleMessage.timezoneStatus` is set to `'RESOLVED'`. [PRD §3.7 Tier 2]
2. **And**, **given** the schedule did not receive a Tier-1 timezone, **when** the account has **zero or two-or-more** active subscribers (Tier-2/shared-subscription ambiguity — "the subscribing user" has no single answer), **then** Tier 2 is not attempted for that schedule at all, and the schedule is flagged: `timezone` is left `undefined` and `timezoneStatus` is set to `'NEEDS_CLARIFICATION'`. [PRD §3.7 Tier 3]
3. **And**, **given** the schedule did not receive a Tier-1 timezone **and** the account has exactly one active subscriber, **when** that subscriber's `users.timezone` is `NULL`/unset (no signal captured yet — see Dev Notes "Timezone Capture Is a Separate Story"), **then** the schedule is flagged the same way as AC2 (`timezoneStatus: 'NEEDS_CLARIFICATION'`). [PRD §3.7 Tier 3]
4. **And**, **given** a schedule **did** receive a Tier-1 timezone via Story 3.6's AC6, **when** this story's resolution logic runs, **then** Tier 2/3 are not attempted for that schedule at all — its `timezone` is the Tier-1 value and `timezoneStatus` is `'RESOLVED'` — and no `users` table lookup is performed for it.
5. **And** the Tier-2 subscriber-timezone DB lookup is performed **at most once per post** (memoized across that post's schedules), not once per schedule needing it, to avoid redundant queries for a multi-schedule event.
6. **And** the `users` table gains a nullable `timezone: text` column, matching PRD §4.8's already-documented `User.timezone` field ("Fallback timezone used for event timezone inference when location-based lookup is unavailable or ambiguous") — this story only **reads** it; **populating** it is Story 3.6c's responsibility (see Dev Notes), so the column is expected to be `NULL` for all users until 3.6c ships.
7. **And** the `schedules` table gains two nullable columns: `timezone: text` (the final effective IANA timezone chosen by AC1/AC4) and `timezone_status` (a new `schedule_timezone_status` pgEnum: `'RESOLVED' | 'NEEDS_CLARIFICATION'`). Both are additive-only, generated via `drizzle-kit generate` and committed as a SQL migration (AD-3) — this story does not write these columns to the DB directly (no DB write in this Lambda, matching Story 3.6's own decoupled design); they exist so Story 3.6b (Ingestor Lambda, still `backlog`) has somewhere to persist the values this story computes.
8. **And** `ExtractedEventMessage`'s per-schedule message type (`ExtractedScheduleMessage`, Story 3.6's `DataIngestionQueue` contract) gains optional `timezone?: string` and `timezoneStatus?: 'RESOLVED' | 'NEEDS_CLARIFICATION'` fields, populated per AC1-5 and carried through to whichever Lambda eventually writes `schedules` rows (Story 3.6b).

**Note (2026-08-10, added via `bmad-create-story` while drafting Story 3.6):** Story 3.6's own creation found that PRD FR33's full three-tier timezone-inference strategy had no owning story anywhere in Epic 3 — Story 0.16 (Geolocation adapter) explicitly named "timezone inference for extracted events" as an anticipated consumer, but no story ever built the consumption side, and `epic-3-readiness.md`'s Gate 1/3 sweep did not flag the gap either (it evaluated architecture/foundation completeness, not FR-level requirements coverage). User confirmed via `AskUserQuestion`: Story 3.6 absorbs Tier 1 (location-based inference, low incremental cost via the already-built Geolocation adapter) directly into its own AC6; this story absorbs the two genuinely ambiguous, product-decision-requiring tiers (2 and 3) that Story 3.6's own scope should not silently decide. Positioned as a lettered suffix directly off Story 3.6 (the story whose own creation surfaced the gap), per `story-split-gate.md`'s "single-story split" numbering rule.

**Amendment (2026-08-10, added via `bmad-create-story` during this story's own creation):** ACs 4-8 above are new/expanded beyond epics.md's original 2-bullet draft — decomposing the Tier-1-already-resolved short-circuit (AC4), the per-post memoization requirement (AC5), and the concrete schema/message-contract shape (AC6-8) that epics.md's own text explicitly left as open questions ("a concept not yet captured anywhere in the data model," "this story must define what that flagged state looks like"). Two real, non-mechanical tradeoffs were resolved with the user via `AskUserQuestion` before this file was drafted:
1. **`users.timezone` capture mechanism** — Gate 3 (run fresh for this story, see Dev Notes) found that without something populating `users.timezone`, Tier 2 (AC1) can structurally never fire — every schedule without a Tier-1 timezone would hit Tier 3 (AC2/AC3) indefinitely. **Decided:** this story adds the column and the read-side Tier 2/3 logic only; population is split into a new prerequisite story, **Story 3.6c: Capture and store the subscribing user's timezone** (`backlog`, see epics.md/sprint-status.yaml) — not silently dropped, but explicitly not built here, keeping this story's `apps/web`/GraphQL surface at zero (matching Story 3.5/3.6's own precedent).
2. **`NEEDS_CLARIFICATION` surfacing** — Gate 3 also found that nothing in epics.md today displays or resolves a flagged schedule, so flagged rows would otherwise accumulate with no path out once Story 3.6b starts writing them. **Decided:** this story writes the flag into the message contract and schema only; surfacing it to a user/moderator is split into a new prerequisite story, **Story 3.6d: Surface schedules flagged as needing timezone clarification** (`backlog`), deferred because its natural home (an event detail view) doesn't exist yet — Story 3.6b (DB write) and Story 3.7 (event display) are both still `backlog` themselves.

**Depends on:** Story 3.6 (now `review` — the AI Processor Lambda pipeline this story extends is fully implemented; see Dev Notes "Previous Story Intelligence").

## Tasks / Subtasks

- [x] **Task 1 (AC6, AC7) — Schema changes:** In `packages/database/schema.ts`:
  - Add `export const scheduleTimezoneStatusEnum = pgEnum('schedule_timezone_status', ['RESOLVED', 'NEEDS_CLARIFICATION']);` near the other `pgEnum` declarations (alongside `defaultLocationChangeStatusEnum`, following the same naming/positioning convention).
  - Add `timezone: text('timezone'),` (nullable, no default) to the `users` table definition.
  - Add `timezone: text('timezone'),` and `timezoneStatus: scheduleTimezoneStatusEnum('timezone_status'),` (both nullable, no default) to the `schedules` table definition, alongside the existing `locationDetails`/`latitude`/`longitude` columns.
  - Run `pnpm --filter @festgrid/database generate` to produce the next SQL migration file (`0019_*.sql` — drizzle-kit auto-names it) and commit it to the repository (AD-3 — code-first, committed migrations, no manual DDL).
- [x] **Task 2 (AC8) — Domain types:** In `packages/domain/src/events/types.ts` (existing file from Story 3.6):
  - Add `export type ScheduleTimezoneStatus = 'RESOLVED' | 'NEEDS_CLARIFICATION';`.
  - Add `export interface ScheduleTimezoneResolution { timezone?: string; timezoneStatus: ScheduleTimezoneStatus; }`.
  - Extend `ExtractedScheduleMessage` with `timezone?: string;` and `timezoneStatus?: ScheduleTimezoneStatus;` (both optional — purely additive, so Story 3.6's existing exact-field assertions in `transform-gemini-response-to-event-info.test.ts` keep passing unmodified; they assert specific fields via `assert.strictEqual`, not whole-object `deepStrictEqual`, so new optional fields don't break them — confirmed by reading the existing test file during this story's creation).
- [x] **Task 3 (AC1-AC5) — Tiered resolution function:** Create `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.ts` exporting `resolveScheduleTimezones(schedules: GeminiSchedulePayload[], resolvedScheduleLocations: Map<number, LocationDetails>, subscriberUserIds: string[]): Promise<Map<number, ScheduleTimezoneResolution>>`:
  - For each schedule index `i`: if `resolvedScheduleLocations.get(i)?.timezone` is set, set `RESOLVED` with that timezone (AC4) — no DB lookup.
  - Otherwise, if `subscriberUserIds.length === 1`: lazily look up that single subscriber's `users.timezone` **once** (memoized in a local variable across the loop, not per-schedule — AC5) via `db.select({ timezone: users.timezone }).from(users).where(eq(users.id, subscriberUserIds[0])).limit(1)`; if a non-null value is found, set `RESOLVED` with it (AC1); if `NULL`, fall through to the flagged branch (AC3).
  - Otherwise (`subscriberUserIds.length !== 1`, i.e. 0 or 2+), or the single subscriber's timezone was `NULL`: set `{ timezone: undefined, timezoneStatus: 'NEEDS_CLARIFICATION' }` (AC2/AC3).
  - No I/O errors should abort the whole job — wrap the `users` lookup in a `try`/`catch` mirroring `resolveAccountAndLocations`'s existing best-effort pattern; a lookup failure degrades to `NEEDS_CLARIFICATION` for the affected schedules rather than throwing.
  - Add `resolve-schedule-timezones.test.ts` (real local DB, mirroring `get-active-subscriber-user-ids.test.ts`'s seeded-user/cleanup pattern — no seam needed, this is a direct DB read like `resolveAccountAndLocations`) covering: Tier-1-present short-circuit (no DB row required to exist), Tier-2 resolved (single subscriber, `users.timezone` set), Tier-3 via zero subscribers, Tier-3 via two-or-more subscribers, Tier-3 via single subscriber with `NULL` timezone, and multiple schedules needing Tier-2 in one call resolving consistently (correctness-focused; do not assert internal DB-call counts — matches this project's testing-trophy philosophy of avoiding brittle implementation-detail assertions).
- [x] **Task 4 (AC1-AC4, AC8) — Wire into the transform:** In `packages/domain/src/events/transform-gemini-response-to-event-info.ts` (existing file from Story 3.6):
  - Add optional `scheduleTimezoneResolutions?: Map<number, ScheduleTimezoneResolution>` to the `context` parameter.
  - Inside the `payload.schedules.map(...)` loop, read `context.scheduleTimezoneResolutions?.get(i)` and spread its `timezone`/`timezoneStatus` onto the returned `ExtractedScheduleMessage` (both `undefined` when the map or that entry is absent — preserves Story 3.6's own existing behavior/tests when this story's caller-side wiring, Task 5, is not yet exercised).
  - Extend `transform-gemini-response-to-event-info.test.ts` with new cases: `timezone`/`timezoneStatus` attached from `scheduleTimezoneResolutions` when present; both `undefined` when the map is omitted entirely (backward-compatibility with every existing test in this file, which passes no such map).
- [x] **Task 5 (AC1-AC5) — Orchestration wiring:** In `apps/backend/src/lib/ai-processor/process-ai-job.ts` (existing file from Story 3.6):
  - After the existing `resolveAccountAndLocations` call (step 6), add `const scheduleTimezoneResolutions = await resolveScheduleTimezones(payload.schedules, resolvedScheduleLocations, subscriberUserIds);` — reusing `subscriberUserIds`, already computed in step 1, not re-fetched.
  - Pass `scheduleTimezoneResolutions` into the existing `transformGeminiResponseToEventInfo(...)` context object (step 7).
  - Update `process-ai-job.test.ts`: the existing "Case A: happy path" seeds exactly one subscriber and its `afterEach` resets `resolveLocationSeam` to `async () => ({}) as any` (no `timezone`), so with this story's wiring active, Case A will now exercise Tier 3 by default (`users.timezone` unset for the seeded test user) — extend Case A's assertions to confirm `sqsBody.schedules[0].timezoneStatus === 'NEEDS_CLARIFICATION'` rather than leaving it unchecked. Add new cases: (a) seed the test user's `users.timezone` and confirm Tier 2 resolves (`timezoneStatus: 'RESOLVED'`, `timezone` equal to the seeded value); (b) a second social-media-account profile with **zero** subscribers, confirming Tier 3 fires without any `users` lookup being attempted (no subscriber to look up).
- [x] **Task 6 — Verification (AC1-AC8):**
  - [x] `pnpm --filter @festgrid/database generate` was run and the migration file is committed (Task 1).
  - [x] `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained on `transform-gemini-response-to-event-info.ts` including the new branches.
  - [x] `pnpm --filter backend test` — `resolve-schedule-timezones.test.ts` (new) and `process-ai-job.test.ts` (updated) pass; all of Story 3.6's other existing suites (`build-gemini-request.test.ts`, `resolve-account-and-locations.test.ts`, `get-active-subscriber-user-ids.test.ts`, `validate.test.ts`) remain unmodified and passing.
  - [x] `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
  - [x] Record in Completion Notes: no live Gemini/Geoapify/AWS call in any automated test, matching Story 3.6/0.13/0.16's own established deferral pattern — this story proves the tiering logic and its DB-backed read paths, not a live external-service round trip.

## Dev Notes

### Architecture & UX Gate Findings

- **This story is not covered by the swept `epic-3-readiness.md`** (`swept: true`, re-run 2026-08-09) — its `stories_covered` list ends at `3.11` and was generated the day *before* Story 3.6a existed (created 2026-08-10, during Story 3.6's own creation). Per `story-split-gate.md`'s epic-level-sweep-mode guidance, citing the sweep without re-checking would be inappropriate here, since the sweep could not have evaluated a story it didn't know existed. Gate 1 and Gate 3 were therefore run **fresh** for this story (via `runSubagent`, Winston persona), not sourced from the sweep.
- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found**, with one traceability note: this story is entirely backend (extends the in-progress-turned-`review` Story 3.6 Lambda pipeline; zero `apps/web`; zero new API surface; reuses Story 3.6's existing Lambda/queues/env as-is, no new infra). Adding schema columns ahead of Story 3.6b (the actual DB writer, still `backlog`) is backend-to-backend sequencing, not a frontend/backend boundary violation — acceptable under Gate 1. The one actionable note: Story 3.6b's own AC text didn't previously mention writing these new columns, so this story's creation added an **Amendment to Story 3.6b in epics.md** explicitly naming `schedules.timezone`/`schedules.timezoneStatus` as fields it must persist, so the dependency isn't left implicit (see epics.md Story 3.6b).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — Gap found, both resolved by splitting new stories, not by absorbing scope into this one:**
  1. `users.timezone` has no capture mechanism anywhere in the codebase — without one, Tier 2 (AC1) can structurally never fire. Split into new **Story 3.6c: Capture and store the subscribing user's timezone** (`backlog`, added to epics.md/sprint-status.yaml by this story's own creation). User confirmed via `AskUserQuestion`.
  2. The new `NEEDS_CLARIFICATION` flag has no consumer — nothing in epics.md today displays or resolves it, so flagged schedules would accumulate with no path out once Story 3.6b starts writing them. Split into new **Story 3.6d: Surface schedules flagged as needing timezone clarification** (`backlog`, added to epics.md/sprint-status.yaml by this story's own creation; depends on 3.6b and 3.7 both existing first). User confirmed via `AskUserQuestion`.
  - Both new stories are positioned as lettered suffixes directly off Story 3.6 (matching the existing `3.6a`/`3.6b` sibling family — next available letters, `3.6c`/`3.6d`), per `story-split-gate.md`'s numbering rule.
- **Gate 2 (UI Complexity & Reusability) — No gap found.** Run fresh via a one-shot Freya-persona review: this story adds zero GraphQL schema/resolvers, zero `apps/web` code, zero React components/hooks. It is a strict superset of Story 3.6's own already-cleared "zero UI surface, pure Lambda-to-Lambda pipeline stage" shape. The `NEEDS_CLARIFICATION` flag being written-but-not-yet-displayed is real, but is a Gate 1/3 sequencing question (is there a future story that will consume it — yes, 3.6d), not a Gate 2 UI-scope-mismatch question (this story isn't building UI to begin with, so there's no UI scope to audit for completeness). See UX Source-of-Truth Correction note below for why `design-artifacts/` wasn't separately re-grepped: Story 3.6's own Gate 2 pass already confirmed zero matches for "AI Processor"/"extraction"/"queue status"/"Data Ingestion" across both `DESIGN.md`/`EXPERIENCE.md` pairs, and this story adds no new terms to that surface.

### Timezone Capture Is a Separate Story (Story 3.6c)

This story deliberately does **not** build any mechanism to populate `users.timezone` — it only reads the column (AC1, AC3, AC6). Until Story 3.6c ships, `users.timezone` is `NULL` for every user, so AC1 (Tier 2) will not fire in practice and every schedule lacking a Tier-1 timezone will hit AC2/AC3 (`NEEDS_CLARIFICATION`) instead. This is an accepted, explicitly-tracked gap (user-confirmed via `AskUserQuestion`), not a silent omission — see epics.md's new Story 3.6c section for the planned capture approach (client-side `Intl.DateTimeFormat().resolvedOptions().timeZone`, persisted via a new mutation).

### Clarification-Flag Surfacing Is a Separate Story (Story 3.6d)

Likewise, this story writes `timezoneStatus: 'NEEDS_CLARIFICATION'` into the message contract and (eventually, via Story 3.6b) the `schedules` table, but builds no UI or moderator surface to view or resolve it. A heavier precedent already exists in this codebase for a similar "flag + review" concept — `defaultLocationChangeStatusEnum`/`defaultLocationChangeRequests` (Story 3.3b: a dedicated status enum, a separate request/audit table, and moderator email notification wiring). The user explicitly chose the lighter two-column approach for this story (`schedules.timezone`/`schedules.timezoneStatus` directly on the existing table, no separate request table, no notification) over mirroring 3.3b's heavier pattern, since there is no moderator surface to notify yet — see the "Amendment" section above for the `AskUserQuestion` record. Story 3.6d, once scoped, should reuse this story's `'RESOLVED' | 'NEEDS_CLARIFICATION'` vocabulary rather than inventing a third naming convention.

### FR33 Timezone Inference — Full Picture

PRD §3.7 defines three tiers: (1) location-based, (2) subscribing user's own timezone, (3) flag for manual clarification. Story 3.6's AC6 already implemented Tier 1 via the existing Geolocation adapter (Story 0.16, Geoapify-backed, cached) — this story implements Tiers 2-3 exclusively, reading Story 3.6's `resolvedScheduleLocations: Map<number, LocationDetails>` output as its own input signal for "did Tier 1 already resolve this schedule." This story does not re-derive or duplicate any of Story 3.6's location-resolution logic.

### Previous Story Intelligence (Story 3.6, now `review`)

Story 3.6 moved from `in-progress` to `review` **during this story's own creation** (its dev-story pass completed concurrently) — all of its planned files now exist and were read directly (not assumed from its story file's task descriptions) to confirm exact integration points:
- `apps/backend/src/lib/ai-processor/process-ai-job.ts`: the orchestrator this story's Task 5 extends. Step 1 already computes `subscriberUserIds` via `getActiveSubscriberUserIds(message.accountId)`, before step 6's `resolveAccountAndLocations` call — this story's `resolveScheduleTimezones` call reuses that same variable, not a re-fetch.
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts`: returns `{ sourceSocialMediaAccountId, defaultLocation, resolvedScheduleLocations: Map<number, LocationDetails> }`. This story's Task 3 takes `resolvedScheduleLocations` as an input (read-only) — it does not modify `resolveAccountAndLocations` itself.
- `packages/domain/src/events/transform-gemini-response-to-event-info.ts`: attaches `locationDetails: context.resolvedScheduleLocations.get(i)` per schedule today. This story's Task 4 adds a sibling `timezone`/`timezoneStatus` attachment from a new, separate map — additive, not a restructure.
- `apps/backend/src/validation/extracted-event.schema.ts`/`validate.test.ts`, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `apps/infrastructure/lib/festgrid-backend-stack.ts`, `apps/backend/src/env.ts`: all confirmed unrelated to this story's scope — Gemini's raw response shape, the multimodal request builder, and CDK/env wiring are untouched, since this story adds no new external I/O (only a `users` table read, via the already-provisioned `DATABASE_URL` Story 3.6's Task 9 wired onto `aiProcessorLambda`).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: additive DB schema changes; additive cross-boundary TypeScript shapes; no breaking changes.**
- **Impacted fields/contracts:**
  - `packages/database/schema.ts`: new `scheduleTimezoneStatusEnum` pgEnum; new nullable `users.timezone` column; new nullable `schedules.timezone`/`schedules.timezoneStatus` columns.
  - `packages/domain/src/events/types.ts`: new `ScheduleTimezoneStatus`/`ScheduleTimezoneResolution` exports; `ExtractedScheduleMessage` gains two new optional fields.
  - `packages/shared-types/src/index.ts`: `User` interface gains `timezone?: string`, matching PRD §4.8's already-documented field verbatim (doc comment included) — this is the only `shared-types` change; `Schedule`'s own `timezone`/`timezoneStatus` GraphQL-facing fields are deliberately **not** added here (see below).
  - **Deliberately not touched:** `packages/shared-types`'s `Schedule` interface (no `timezone`/`timezoneStatus` fields added) and any `.graphql` schema file — mirroring Story 3.6's own precedent of keeping `ExtractedEventMessage`/`ExtractedScheduleMessage` decoupled from the GraphQL-facing `EventInfo`/`Schedule` shapes until a story that actually needs to expose them (Story 3.6d/3.7) exists. Also not touched: `packages/shared-types`'s other `User` fields (`tier`/`role`/`locale` from PRD §4.8 remain absent from `shared-types.User`) — a pre-existing gap unrelated to this story, not fixed here.
- **Required DB migration changes:** One additive migration (Task 1, `pnpm --filter @festgrid/database generate`) adding the enum + three nullable columns described above. No backfill — all three columns start `NULL`/unset for every existing row.
- **Required TypeScript type changes:** `packages/domain/src/events/types.ts` (new), `packages/shared-types/src/index.ts` (`User.timezone` addition).
- **Backward compatibility and rollout notes:** Purely additive on every axis — new nullable columns, new optional message fields, new optional transform-context field. No existing caller of `transformGeminiResponseToEventInfo` or `processAiJob` breaks; Story 3.6's existing test suites keep passing unmodified except where Task 5 explicitly extends `process-ai-job.test.ts`'s own assertions (not its fixtures/seams).
- **Verification checks:** Task 3's real-local-DB unit tests for `resolveScheduleTimezones`; Task 4's extended 100%-covered transform tests; Task 5's extended `process-ai-job.test.ts` integration coverage; Task 6's full build/lint/test.

### Project Structure Notes

- **New:** `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.ts` + `.test.ts`; one new Drizzle migration file under `packages/database/migrations/`.
- **Modified:** `packages/database/schema.ts` (new enum + 3 columns); `packages/domain/src/events/types.ts` (new types, extended `ExtractedScheduleMessage`); `packages/domain/src/events/transform-gemini-response-to-event-info.ts` + `.test.ts`; `apps/backend/src/lib/ai-processor/process-ai-job.ts` + `.test.ts`; `packages/shared-types/src/index.ts` (`User.timezone`); `_bmad-output/planning-artifacts/epics.md` (new Story 3.6c/3.6d sections, Story 3.6b amendment — already applied during this story's creation); `_bmad-output/implementation-artifacts/sprint-status.yaml` (new `3-6c`/`3-6d` backlog entries — already applied during this story's creation).
- **Not modified:** `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `resolve-account-and-locations.ts`; `apps/backend/src/lambdas/ai-processor.ts`; `apps/infrastructure/lib/festgrid-backend-stack.ts`; `apps/backend/src/env.ts`; `.env.example`; any `.graphql` schema file; `apps/web`; `packages/shared-types`'s `Schedule` interface; `apps/backend/src/lambdas/ingestor.ts` (Story 3.6b's placeholder, still untouched).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6a, #Story-3.6b, #Story-3.6c, #Story-3.6d] — this story's authoritative AC/Note/Amendment text, and the sibling stories added during this story's own creation.
- [Source: _bmad-output/implementation-artifacts/3-6-process-posts-from-the-queue-and-extract-event-information.md] — Story 3.6's full Dev Notes, task list, and FR33 Tier-1-only scope decision that this story completes.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts, resolve-account-and-locations.ts; packages/domain/src/events/{types.ts,transform-gemini-response-to-event-info.ts,transform-gemini-response-to-event-info.test.ts}; apps/backend/src/lib/subscriptions/get-active-subscriber-user-ids.ts, .test.ts] — read in full during this story's creation (Story 3.6 completed to `review` concurrently); exact function signatures, existing test patterns/seams, and the confirmed-safe additive-field assumption these tasks depend on.
- [Source: packages/database/schema.ts] — `users`/`schedules` current column sets; the `defaultLocationChangeStatusEnum` naming precedent this story's `scheduleTimezoneStatusEnum` follows.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md §3.7, §4.3, §4.8] — FR33's three-tier definition; `LocationDetails.timezone` (Tier 1 source); `User.timezone` (already-documented Tier 2 source, doc comment reused verbatim in this story's schema/type changes).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions, epic-level-sweep-mode guidance (source of this story's decision to run Gate 1/3 fresh rather than cite `epic-3-readiness.md`), numbering rule (source of 3.6c/3.6d's lettered-suffix placement).
- [Source: _bmad-output/project-context.md#Technology-Stack, #Database-Performance, #Code-Quality-Style-Rules, #Testing-Rules] — AD-3-aligned migration rule; Drizzle-only DB access; `packages/domain` pure-logic/100%-coverage rule; package-dependency-isolation rules (this story adds no new cross-package dependency).
- [Source: _bmad-output/implementation-artifacts/3-3b-edit-an-accounts-default-location.md] — `defaultLocationChangeStatusEnum`/`defaultLocationChangeRequests` precedent evaluated and deliberately not reused (see "Clarification-Flag Surfacing Is a Separate Story" above).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — Database & Performance (Drizzle-only access, AD-3 migration rule); Code Organization (`packages/domain` pure logic vs. `apps/backend` DB-coupled code); Testing Rules (`packages/domain` 100% coverage; `apps/backend` real-local-DB integration-test convention).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-3 (Database Schema Management: code-first Drizzle schema, `drizzle-kit`-generated committed migrations) is the primary applicable AD for this story.
- [ ] `docs/infrastructure/index.md` / `2-backend.md` — no infra/topology change; this story adds a DB read, reusing `aiProcessorLambda`'s already-provisioned `DATABASE_URL` (Story 3.6 Task 9) — read to confirm no new edge is implied.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.ts` + `.test.ts`; one new Drizzle SQL migration file.
- **Modified:** `packages/database/schema.ts`; `packages/domain/src/events/types.ts`; `packages/domain/src/events/transform-gemini-response-to-event-info.ts` + `.test.ts`; `apps/backend/src/lib/ai-processor/process-ai-job.ts` + `.test.ts`; `packages/shared-types/src/index.ts`.
- **Not modified:** `packages/database/migrations/` (only additions, no edits to existing files); any `.graphql` schema file; `apps/web`; `apps/infrastructure/lib/festgrid-backend-stack.ts`; `apps/backend/src/env.ts`.

### Rule Mapping

- AD-3 (Database Schema Management) → Task 1 (code-first schema edit + `drizzle-kit generate` + committed migration, no manual DDL).
- Database Access (Drizzle ORM only) → Task 3's `resolveScheduleTimezones` uses `db.select(...)` exactly like the existing `resolveAccountAndLocations`/`getActiveSubscriberUserIds` precedents, no Supabase client, no raw SQL.
- Code Organization (Domain vs. I/O-coupled) → Task 2 (pure types in `packages/domain`) vs. Task 3 (DB-coupled logic in `apps/backend`).
- `packages/domain` 100%-coverage rule → Task 4's extended `transform-gemini-response-to-event-info.test.ts`.
- Reuse over reinvention (`getActiveSubscriberUserIds`'s already-computed `subscriberUserIds`, `resolveAccountAndLocations`'s existing best-effort try/catch pattern, `defaultLocationChangeStatusEnum`'s naming convention) → Tasks 1, 3, 5.
- Story-split-gate discipline (Gate 3 gap → new stories, not absorbed scope) → new Story 3.6c/3.6d sections in epics.md + sprint-status.yaml entries (already applied during this story's creation).
- "Leave the system working end-to-end, not just satisfy stated ACs" (Story 3.6b's AC amendment naming the new columns explicitly) → this workflow's Step 3 mandate → epics.md Story 3.6b amendment (already applied).

### Verification Plan

- `packages/database`: `pnpm --filter @festgrid/database generate` produces a clean migration; manual review of the generated SQL confirms three nullable, additive columns and one new enum type, no unexpected drops/renames.
- `packages/domain`: `pnpm --filter @festgrid/domain build && pnpm --filter @festgrid/domain test` — 100% coverage maintained.
- `apps/backend`: `pnpm --filter backend test` — new `resolve-schedule-timezones.test.ts` passes; updated `process-ai-job.test.ts` passes; all of Story 3.6's other suites remain green, unmodified.
- `pnpm build`, `pnpm lint`, `pnpm test` (root): full suite, no regressions.
- Manual/deferred: no live Gemini/Geoapify/AWS call in any automated test (matches Story 3.6's own established deferral pattern) — this story adds no new external I/O anyway (only a local DB read).

## Pre-Coding Approval Gate

- [x] Scope confirmation: this story implements PRD FR33 Tiers 2-3 (subscriber-timezone fallback + manual-clarification flagging) by extending Story 3.6's AI Processor Lambda pipeline (`resolveScheduleTimezones`, wired into `process-ai-job.ts`/`transformGeminiResponseToEventInfo`), plus the additive `users`/`schedules` schema columns those tiers need. It does **not** build a `users.timezone` capture mechanism (split to Story 3.6c), does **not** build any UI/moderator surface for the `NEEDS_CLARIFICATION` flag (split to Story 3.6d), and does **not** touch Story 3.6b's Ingestor Lambda or GraphQL/`apps/web`.
- [x] Architecture and boundary confirmation: pure logic (`ScheduleTimezoneStatus`/`ScheduleTimezoneResolution` types, the transform-context extension) confined to `packages/domain/src/events`; the DB-reading tiering function confined to `apps/backend/src/lib/ai-processor`; Drizzle ORM is the only DB access path (no Supabase client, no raw SQL).
- [x] Testing plan confirmation: `packages/domain`'s transform function stays 100%-covered including the new branches; `apps/backend`'s new `resolveScheduleTimezones` gets real-local-DB integration tests covering every tier/branch (Tier 1 short-circuit, Tier 2 resolved, Tier 3 via 0 subscribers, Tier 3 via 2+ subscribers, Tier 3 via null user timezone); `process-ai-job.test.ts` is extended (not just left passing by accident) to assert the new `timezone`/`timezoneStatus` fields in at least the happy-path and a Tier-2-resolved case.
- [x] **`users.timezone` capture deferral accepted:** confirm this story adds the column and read-only Tier 2/3 logic without building any way to populate it — Tier 2 will not fire in practice until Story 3.6c ships, and that is an accepted, tracked gap (not a silent one), per the user's `AskUserQuestion` decision during this story's creation.
- [x] **`NEEDS_CLARIFICATION` surfacing deferral accepted:** confirm this story writes the flag into the message contract/schema without building any UI/moderator surface to view it — deferred to Story 3.6d, per the user's `AskUserQuestion` decision during this story's creation.
- [x] **Story 3.6b amendment accepted:** confirm the epics.md amendment to Story 3.6b (naming `schedules.timezone`/schedules.timezoneStatus as fields it must persist) is an acceptable, low-risk documentation addition made during this story's own creation (Gate 1 traceability recommendation), not a scope change requiring separate sign-off.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1 — no gap (run fresh, since `epic-3-readiness.md`'s sweep predates this story). Gate 2 — no gap (run fresh; zero UI surface, strict superset of Story 3.6's own cleared shape). Gate 3 — gap found and resolved by splitting Story 3.6c and Story 3.6d (both added to epics.md/sprint-status.yaml during this story's creation) rather than absorbing their scope here — user-confirmed via `AskUserQuestion`.
- [x] **Dependency status confirmed:** Story 3.6 is `review` (not yet `done`, but fully implemented — every planned file exists and was read directly during this story's creation to confirm exact integration signatures; the same "review, not done, but real code exists" pattern Story 3.6 itself proceeded under for its own dependencies).
- [x] Explicit human approval state (Default: **approved**).

## Testing Requirements

- [ ] `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.test.ts` (new, real local DB, mirrors `get-active-subscriber-user-ids.test.ts`'s seed/cleanup pattern): Tier-1-present short-circuit, Tier-2 resolved (single subscriber with `users.timezone` set), Tier-3 via zero subscribers, Tier-3 via two-or-more subscribers, Tier-3 via single subscriber with `NULL` timezone, multiple schedules in one call resolving consistently.
- [ ] `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` (existing, extended, 100% coverage maintained): `timezone`/`timezoneStatus` attached when `scheduleTimezoneResolutions` map entry present; both `undefined` when the map is omitted (backward compatibility with every pre-existing test case in this file).
- [ ] `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (existing, extended): Case A's happy-path assertions extended to confirm the default (`NEEDS_CLARIFICATION`, since the seeded test user has no `timezone` set) rather than left unchecked; new case seeding `users.timezone` to prove Tier 2 resolves end-to-end; new case with a zero-subscriber account proving Tier 3 fires via that path too.
- [ ] E2E: not required — no user-facing page/flow; per `project-context.md`'s testing-trophy philosophy, matches Story 3.5/3.6's own "zero UI surface" precedent.
- [ ] **Explicitly not automatable, tracked as a follow-up, not silently skipped:** an end-to-end proof that a `NEEDS_CLARIFICATION`-flagged schedule is actually visible/resolvable to a real user — that requires Story 3.6b (DB write) and Story 3.6d (surfacing) to exist first; not this story's job to prove.

## Deliverables Checklist

- [ ] `packages/database/schema.ts`: `scheduleTimezoneStatusEnum`, `users.timezone`, `schedules.timezone`, `schedules.timezoneStatus` added; migration generated and committed.
- [ ] `packages/domain/src/events/types.ts`: `ScheduleTimezoneStatus`, `ScheduleTimezoneResolution` exported; `ExtractedScheduleMessage` extended.
- [ ] `packages/domain/src/events/transform-gemini-response-to-event-info.ts`: wires `scheduleTimezoneResolutions` into each `ExtractedScheduleMessage`; 100%-covered.
- [ ] `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.ts`: implemented, integration-tested.
- [ ] `apps/backend/src/lib/ai-processor/process-ai-job.ts`: wires `resolveScheduleTimezones` into the existing orchestration; tests extended.
- [ ] `packages/shared-types/src/index.ts`: `User.timezone` added.
- [ ] New Story 3.6c/3.6d sections added to `epics.md`, and corresponding `3-6c-...`/`3-6d-...: backlog` entries added to `sprint-status.yaml` (already applied during this story's own creation).
- [ ] Story 3.6b's epics.md entry amended to name the new `schedules` columns explicitly (already applied during this story's own creation).
- [ ] `pnpm build`, `pnpm lint`, `pnpm test` green at the repo root (excluding pre-existing, unrelated warnings/noise).

## Out of Scope

- **Story 3.6c: Capture and store the subscribing user's timezone** — new backlog story (see epics.md/sprint-status.yaml). Without it, `users.timezone` stays `NULL` and Tier 2 never fires in practice; an accepted, tracked gap, not a silent one. Depends on Story 3.6a.
- **Story 3.6d: Surface schedules flagged as needing timezone clarification** — new backlog story (see epics.md/sprint-status.yaml). Depends on Story 3.6a, Story 3.6b, Story 3.7.
- Story 3.6b's Ingestor Lambda itself (consuming `DataIngestionQueue`, writing `events`/`schedules` — including this story's new `timezone`/`timezoneStatus` columns — via Drizzle) — `backlog`, not yet created; this story only prepares the schema and message contract it will consume.
- Any GraphQL/`apps/web` surface for the new `schedules.timezone`/`timezoneStatus` columns or `users.timezone` — zero UI surface in this story (Gate 2 confirmed no gap), matching Story 3.5/3.6's own precedent.
- Reconciling `packages/shared-types`'s `User` interface with the rest of PRD §4.8 (`tier`, `role`, `locale` remain absent) — a pre-existing gap, unrelated to this story beyond the single `timezone` field it needs.
- Reconciling `packages/shared-types`'s `Schedule` interface with the new `timezone`/`timezoneStatus` concept — deferred to whichever story first exposes it via GraphQL (Story 3.6d/3.7).
- Automated integration/E2E tests exercising a real Gemini/Geoapify/AWS SQS round trip — deferred, matching Story 0.13/0.16/3.6's own established pattern (this story adds no new external I/O regardless).

## Definition of Done

- [x] All 8 Acceptance Criteria satisfied.
- [x] `resolve-schedule-timezones.test.ts` (new) passing, covering every tier/branch.
- [x] `transform-gemini-response-to-event-info.test.ts` (extended) passing with 100% coverage maintained.
- [x] `process-ai-job.test.ts` (extended) passing.
- [x] Story 3.6's other existing test suites (`build-gemini-request.test.ts`, `resolve-account-and-locations.test.ts`, `get-active-subscriber-user-ids.test.ts`, `validate.test.ts`) remain unmodified and passing.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` pass at the repo root with no regressions.
- [x] New Drizzle migration generated, reviewed, and committed (confirmed additive-only — see Data Type Compatibility).
- [x] Story 3.6c and Story 3.6d exist in `epics.md`/`sprint-status.yaml`, tracking FR33's remaining gaps (capture, surfacing) as real, non-lost backlog items.

## Completion Status

- [x] Completed / Review Ready

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (BMad Developer Persona)

### Debug Log References

All integration and unit tests passing successfully. Drizzle migrations successfully generated and executed on the local database schema.

### Completion Notes List

- Implemented PRD FR33's Timezone Fallback Tier 2 and Tier 3 strategy.
- Created `resolveScheduleTimezones` utility with per-post memoization across schedules.
- Added `timezone` to `users` and `timezone`/`timezone_status` to `schedules` table in drizzle schema, successfully generated the additive migration file.
- Extended domain events types and mapping logic to pass timezone and timezoneStatus.
- Fully wired timezone resolutions into the main orchestration (`processAiJob.ts`).
- Created robust unit/integration tests for the new timezone lookup and mapped all paths on the orchestrator end-to-end.

### File List

- `packages/database/schema.ts` (modified)
- `packages/database/migrations/0019_wet_leper_queen.sql` (created)
- `packages/domain/src/events/types.ts` (modified)
- `packages/domain/src/events/transform-gemini-response-to-event-info.ts` (modified)
- `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` (modified)
- `packages/shared-types/src/index.ts` (modified)
- `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.ts` (created)
- `apps/backend/src/lib/ai-processor/resolve-schedule-timezones.test.ts` (created)
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modified)
- `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (modified)
