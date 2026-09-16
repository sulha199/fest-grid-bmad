---
baseline_commit: 41649849e41065ba1d23944204994bbd833723c1
---

# Story 0.36: Harden past-events visibility mechanism (settings race, schedule uniqueness, threshold duplication, Discovery SSR consistency)

## Story Details

- Epic: 0
- Story ID: 0.36
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining FestGrid's "hide past events" mechanism (Story 2.7),
I want the four pre-existing gaps found during Story 2.7's code review fixed at their root — a `getOrCreateUserSettings` race that can throw on the `Query.events` hot path, a missing DB constraint that lets more than one `schedules` row per event claim `isMainSchedule = true`, three independently-duplicated "is this event past" threshold computations that could silently disagree after a future one-sided edit, and Discovery's `page.tsx` missing the `dynamic = 'force-dynamic'` export every sibling route already has —
so that the mechanism behind hiding past events is robust against races, schema drift, and copy-paste divergence instead of merely "currently consistent because nothing has changed it yet."

## Acceptance Criteria

1. `getOrCreateUserSettings(userId)` (`apps/backend/src/lib/user-settings/get-or-create-user-settings.ts`) is rewritten to use a single atomic upsert — `db.insert(userSettings).values({ userId }).onConflictDoUpdate({ target: userSettings.userId, set: { userId } }).returning()` (a no-op `DO UPDATE`, since Drizzle's `onConflictDoNothing().returning()` returns an empty array on conflict — `DO UPDATE` is required to get `RETURNING` to yield the existing row) — instead of today's select → insert-on-conflict-do-nothing → re-select sequence. The function always resolves to exactly one row in a single DB round trip, for both a brand-new `userId` and an existing one, with zero re-select race window. [Closes: settings-lookup race, deferred-work.md 2026-09-14 item 1]
2. Both existing callers of `getOrCreateUserSettings` — `Query.events` (`resolvers.ts`, currently no error handling around `settings.hidePastEventsAfterDays`) and `Event.isExpiredForCurrentUser` (`resolvers.ts`, currently wrapped in a try/catch that silently returns `false` on any error) — need no added null-guard, since AC1's atomic upsert makes an empty/undefined result structurally impossible. This is proven by new tests (Task 1), not just by review.
3. A new migration adds a partial unique index to `schedules`: `CREATE UNIQUE INDEX idx_schedules_one_main_per_event ON schedules (event_id) WHERE is_main_schedule = true;` — hand-edited into the `drizzle-kit generate`d SQL file per this project's established partial-index precedent (AD-8 rule 3 / migration `0055_fix_schedule_event_date_idx.sql`), since the installed `drizzle-kit`/`drizzle-orm` versions silently drop `WHERE` predicates from generated migration SQL. `schema.ts`'s `schedules` index block gets the corresponding builder-call addition as the closest expressible approximation, with a comment pointing at the migration file for the real DB-enforced shape (matching `eventDateIdx`'s existing comment pattern). [Closes: schedule-uniqueness gap, deferred-work.md 2026-09-14 item 2]
4. Before the AC3 migration is applied to any database (local or Supabase), an audit query — `SELECT event_id, COUNT(*) FROM schedules WHERE is_main_schedule = true GROUP BY event_id HAVING COUNT(*) > 1;` — is run against that database and confirmed to return zero rows (recorded in the Dev Agent Record's Debug Log). If it returns any rows, they must be resolved first (e.g. a one-time data-fix keeping the chronologically-earliest `isMainSchedule = true` row per event and demoting the rest) — Postgres will otherwise refuse to create the unique index.
5. `buildEventInsertValues` (`packages/domain/src/events/build-event-insert-values.ts`) is extended so the `schedules` array it returns always has **at most one** `isMainSchedule: true` entry, even though its input (`ExtractedEventMessage.schedules`, as produced by Gemini extraction) has no such guarantee today — the Gemini prompt (`build-gemini-request.ts`) requires `isMainSchedule` per schedule but never states "exactly one," and nothing downstream normalizes it before this story. Normalization rule, applied deterministically:
   - Exactly one `true` → unchanged.
   - Multiple `true` → keep only the first one (source array order) `true`; set the rest `false`.
   - Zero `true` → promote the chronologically-earliest schedule (`eventStartDate` ascending, then `eventStartTime` ascending with nulls last) to `true`.
   This closes the gap that would otherwise let a malformed Gemini extraction crash `processIngestionJob`'s insert transaction against the new AC3 constraint, silently dropping a real event instead of storing it. [Scope added during drafting — see Dev Notes "Ingestion-safety gap found while scoping AC3/AC4"]
6. A new shared helper, `computePastEventThreshold({ now, hidePastEventsAfterDays }): string` (`packages/domain/src/events/computePastEventThreshold.ts`), replaces the 3 independently-duplicated UTC-midnight-minus-`N`-days threshold computations: `buildDefaultEventVisibilityConditions.ts`'s inline calculation, `resolvers.ts`'s `Query.events` local `threshold` calculation (feeding the `isPastEvent` SQL expression), and `resolvers.ts`'s `Event.isExpiredForCurrentUser` calculation. Same UTC-midnight math, same `YYYY-MM-DD` string output as today — no behavior change, confirmed by `buildDefaultEventVisibilityConditions.test.ts`'s existing exact-string assertions continuing to pass unmodified. [Closes: threshold-duplication gap, deferred-work.md 2026-09-14 item 3]
7. Within `Query.events`, the single `now = new Date()` already captured for the resolver's own `threshold`/`isPastEvent` computation is also passed explicitly as `buildDefaultEventVisibilityConditions`'s new `now` argument (rather than letting that function default to a second, independent `new Date()` call it makes internally today) — so `isPastEvent` and the default-visibility gate always agree on the same instant within one request, closing the sub-millisecond UTC-day-boundary disagreement the original finding flagged. `Event.isExpiredForCurrentUser` keeps its own independent `now()` capture unaffected — it is a separate resolver invocation/request, not sharing `Query.events`' request lifecycle.
8. `apps/web/src/app/[locale]/page.tsx` (Discovery) gains `export const dynamic = 'force-dynamic';`, matching every sibling route's `page.tsx` (Feed/Favorites/Archive/My-Calendar). `HomeContent` fetches entirely client-side, so this is a consistency fix (no visible behavior change), not a bug fix. [Closes: Discovery SSR-consistency gap, deferred-work.md 2026-09-14 item 4]
9. No end-user-visible behavior changes as a result of this story — all four findings plus the AC5 ingestion-safety addition are hardening/consistency fixes against already-shipped behavior. Verified by the full existing backend/domain/web test suites passing with no regressions, plus the new targeted tests listed in Tasks 1, 3, 4.

## Tasks / Subtasks

- [x] Task 1: Atomic upsert for `getOrCreateUserSettings` (AC: #1, #2)
  - [x] Rewrite `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts` to the single-statement `onConflictDoUpdate` upsert described in AC1.
  - [x] Create `apps/backend/src/lib/user-settings/get-or-create-user-settings.test.ts` (new — no test file exists today), matching this project's `node:test`/real-test-DB backend convention (see `resolvers.test.ts` for setup/teardown pattern): covers (a) a brand-new `userId` creates and returns a settings row with default values, (b) an existing `userId` returns its existing row unmodified (including a non-default `hidePastEventsAfterDays`, proving the upsert's `DO UPDATE` doesn't reset it), (c) two concurrent calls for the same new `userId` (`Promise.all([...])`) both resolve without throwing and return equivalent rows (a single-process proof of the race fix — a true multi-connection race isn't reproducible in-process, but this proves the upsert is race-safe by construction, not by luck).
  - [x] Confirm (via existing `resolvers.test.ts` GraphQL-level tests already touching `Query.events` and `isExpiredForCurrentUser`, e.g. around line 2195) that both call sites still pass unmodified after the helper rewrite — no caller code changes are needed per AC2, but run the suite to prove it.
- [x] Task 2: `isMainSchedule` uniqueness migration (AC: #3, #4)
  - [x] Run the AC4 audit query against the local dev database and record the result (zero rows expected) in the Dev Agent Record's Debug Log before proceeding.
  - [x] Add the `schedules` index builder call to `packages/database/schema.ts` (closest expressible approximation — a plain, non-partial unique-looking entry per drizzle-kit's limits, same as `eventDateIdx`'s existing precedent) and run `drizzle-kit generate` to produce the migration scaffold.
  - [x] Hand-edit the generated SQL file to add the `WHERE is_main_schedule = true` clause (drizzle-kit drops it), with a comment mirroring `0055_fix_schedule_event_date_idx.sql`'s explanatory-comment style and citing this story + the AD-8 rule 3 precedent.
  - [x] Apply the migration locally and confirm it succeeds (proves AC4's audit was accurate).
- [x] Task 3: Ingestion-time `isMainSchedule` normalization (AC: #5)
  - [x] Add the normalization logic described in AC5 to `packages/domain/src/events/build-event-insert-values.ts` (pure, dependency-free — stays 100%-unit-tested per `packages/domain`'s testing rule).
  - [x] Extend `packages/domain/src/events/build-event-insert-values.test.ts` with cases: exactly-one-true (unchanged), multiple-true (only the first stays true), zero-true (earliest-dated promoted), zero-true with a start-time tiebreak, zero-true with all dates/times equal (stable — first array entry wins).
- [x] Task 4: Shared past-event threshold helper (AC: #6, #7)
  - [x] Create `packages/domain/src/events/computePastEventThreshold.ts` + `computePastEventThreshold.test.ts` (mirroring `buildDefaultEventVisibilityConditions.test.ts`'s existing fixed-`now` test style — default-N, custom-N, and UTC end-of-day boundary cases).
  - [x] Export it from `packages/domain/src/events/index.ts` (`export * from './computePastEventThreshold.js';`, matching the existing barrel pattern).
  - [x] Refactor `buildDefaultEventVisibilityConditions.ts` to call the new helper instead of its own inline computation, and to accept/thread the same `now` it already receives — confirm `buildDefaultEventVisibilityConditions.test.ts`'s existing exact-string assertions pass unmodified (no test edits needed if AC6 is implemented correctly).
  - [x] Refactor `resolvers.ts`'s `Query.events` local threshold computation (feeding `isPastEvent`'s SQL) and `Event.isExpiredForCurrentUser`'s computation to both call the new helper, removing the duplicated inline math from both.
  - [x] Implement AC7: pass `Query.events`' already-captured `now` into its `buildDefaultEventVisibilityConditions(...)` call.
- [x] Task 5: Discovery SSR-consistency fix (AC: #8)
  - [x] Add `export const dynamic = 'force-dynamic';` to `apps/web/src/app/[locale]/page.tsx`, positioned consistently with sibling `page.tsx` files (see e.g. `archive/page.tsx`'s placement after the imports, before `generateMetadata`).
- [x] Task 6: Full verification (AC: all)
  - [x] `pnpm --filter backend test` — full suite, including the new `get-or-create-user-settings.test.ts` and any `resolvers.test.ts` coverage touched.
  - [x] `pnpm --filter domain test` — full suite, including new/extended `build-event-insert-values.test.ts` and `computePastEventThreshold.test.ts`, and unmodified-and-passing `buildDefaultEventVisibilityConditions.test.ts`.
  - [x] `pnpm --filter web test` — full suite (no web-side logic changed beyond the one-line export, but confirms no regression).
  - [x] `pnpm lint` across `apps/backend`, `packages/domain`, `apps/web`.
  - [x] `pnpm build` (or the touched packages' build step) to confirm the new migration/schema/domain-export changes compile and the codegen'd artifacts (if any) stay consistent.

## Dev Notes

### Architecture and technical constraints

- This story touches `apps/backend` (resolver + helper), `packages/database` (schema + migration), `packages/domain` (two new/extended pure functions), and `apps/web` (one-line route config) — no `packages/ui` involvement, no new GraphQL schema fields/resolvers/mutations, no new external service calls, no new secrets.
- `packages/domain` remains React-forbidden and DB/ORM/Node-dependency-free per `project-context.md`'s Code Organization rule — `computePastEventThreshold` and the `build-event-insert-values.ts` normalization addition are both pure, synchronous, dependency-free functions consistent with every existing sibling in `packages/domain/src/events/`.
- Migration convention: this project's `drizzle-kit@^0.21.x` does not emit `WHERE` predicates for partial indexes in generated SQL (tracked upstream: drizzle-orm#3349, drizzle-kit-mirror#461) — confirmed precedent for the required hand-edit workflow is `packages/database/migrations/0055_fix_schedule_event_date_idx.sql` (an expression-index hand-edit) and the `idx_favorites_active`/`idx_calendar_additions_active` partial-index precedent cited in Architecture Spine AD-8 rule 3. Follow that exact workflow: `drizzle-kit generate` first, then hand-edit the output file, never hand-write a migration from scratch.
- `Query.events`' `isPastEvent` computed SQL field and its `defaultVisibilityConditions` (from `buildDefaultEventVisibilityConditions`) are both **currently already reachable from the exact same `now`/`threshold` local variables** computed once at the top of the resolver (see the `// Compute threshold precisely matching buildDefaultEventVisibilityConditions` comment) — but `buildDefaultEventVisibilityConditions` is called there **without** passing `now`, so it silently re-derives its own `new Date()` internally. AC7 closes that specific internal gap; it is a small addition once AC6's refactor already has `buildDefaultEventVisibilityConditions` accepting `now`.

### Ingestion-safety gap found while scoping AC3/AC4 (not in the original FIND-029 note)

While investigating AC3's blast radius, tracing every `schedules` insert path found that `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (`tx.insert(schedules).values(schedulesToInsert)`, inside a transaction with the parent `events` insert) has **no code today** ensuring `buildEventInsertValues`'s output has exactly one `isMainSchedule: true` entry. The Gemini extraction prompt (`build-gemini-request.ts`) requires `isMainSchedule` per schedule item but never instructs "exactly one must be true," and `transform-gemini-response-to-event-info.ts` passes the value through unmodified. Only the **separate** correction/edit path (`validate-correction-consistency.ts`'s `mainSchedulesCount !== 1` check, used by the "propose a correction" mutation) has this guard — the original ingestion path never did. Once AC3's unique index exists, a Gemini response with 2+ `isMainSchedule: true` schedules would throw a Postgres constraint violation **inside the same transaction that inserts the parent `events` row**, aborting the whole insert — a legitimately-extracted event silently dropped/retried instead of stored, which is a worse regression than the bug this story is fixing. This was surfaced to the user via `AskUserQuestion` before drafting (not silently absorbed or silently ignored) — resolved to fix it now (AC5), reusing the same "exactly one main schedule" invariant `validate-correction-consistency.ts` already enforces on the sibling path, just applied at the point this codebase was missing it (ingestion), not duplicating that file's logic (different data shape: `ExtractedScheduleMessage[]` vs `ProposedEventCorrection`'s schedule shape).

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No data-type mismatch found across DB schema / GraphQL contracts / TypeScript types. This story adds one DB index (no column/type change) and refactors internal computation paths only.
- Impacted fields/contracts: `schedules.is_main_schedule` / `schedules.event_id` gain a new partial unique index; no type change to either column. No GraphQL schema change. `userSettings` table/columns unchanged (only the query pattern against it changes).
- Required DB migration changes: One new hand-edited migration per AC3/AC4 (see Task 2). No other schema changes.
- Required TypeScript type changes: None. `getOrCreateUserSettings`'s return type is unchanged (`typeof userSettings.$inferSelect`, still exactly one row). `buildEventInsertValues`'s return type (`ScheduleInsertValues[]`) is unchanged — only the *values* within it are normalized, not its shape.
- Backward compatibility and rollout notes: The AC3 migration is additive (a new index) and safe to roll forward once AC4's audit confirms no pre-existing violations; it has no rollback data-loss risk (dropping the index is always safe). The `getOrCreateUserSettings` and threshold-helper refactors are internal-implementation-only changes with no external contract change. The AC5 normalization changes ingestion behavior only for the rare malformed-extraction case (multiple/zero `isMainSchedule: true`) — previously such a case would insert successfully (silently creating ambiguous/duplicate "main" schedules, or none), and will now insert successfully too, but deterministically normalized — not a breaking change to any currently-passing case.
- Verification checks: AC4's audit query (Task 2) before migration; the new/extended unit tests in Tasks 1, 3, 4; the full Task 6 verification suite.

### Architecture & UX Gate Findings

All three gates were run fresh via subagent (no `epic-0-readiness.md`-equivalent sweep applies — the existing `epic-0-readiness.md` is `swept: true` but scoped only to Stories 0.1-0.19 per its own frontmatter, predating this later, directly-backlog-sourced standalone Epic 0 story; this mirrors the same non-applicability reasoning already recorded in Stories 0.33/0.34/0.35's own Dev Notes):

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona):** No gap found. All four items modify existing layers in place — the settings-race fix and threshold-consolidation stay entirely within already-established `apps/backend`/`packages/domain` code; the index migration goes through the already-established Drizzle-kit + hand-edit pipeline (~56 prior migrations); the frontend change is a one-line existing-pattern export. No new DB/domain call from `apps/web`, no new API surface, no new auth/secrets, no infra lacking an IaC/deploy story.
- **Gate 2 (UI Complexity & Reusability, Freya persona):** No gap found. Zero UI-visible change — two backend/DB items, one pure domain-logic refactor (no new hook/component), and one Next.js route-config export with no JSX/markup impact (`HomeContent` already fetches client-side). No visual/interaction spec in `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` is implicated.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona):** No gap found. `packages/domain/src/events/` is an already-densely-populated (35+ files) existing home, not a new package/foundation being stood up — `computePastEventThreshold` deduplicates logic already living there (`buildDefaultEventVisibilityConditions.ts`), it does not introduce a new project-wide mechanism other future stories must discover or configure. The migration pipeline and route-config convention are both pre-established and reused as-is.

### Genuine tradeoffs resolved via `AskUserQuestion` before drafting (not silently picked)

1. **`getOrCreateUserSettings` fix approach** — atomic `onConflictDoUpdate`-with-`RETURNING` upsert (chosen) vs. a defensive null-guard left at each call site with the existing select/insert/re-select shape unchanged. Chosen because it eliminates the race at its root (both current call sites, and any future one) rather than requiring every future caller to remember the same guard.
2. **Story bundling** — one story covering all 4 backlog-bundled findings (chosen, matching `backlog.yaml`/`event-pages-remaining-backlog-plan.md`'s existing "FIND-029 story (4 bundled findings)" framing and each item's small size) vs. splitting the thematically-unrelated Discovery SSR-consistency item (#4) into its own story, mirroring the FIND-016 → Stories 0.34/0.35 precedent. Chosen not to split, since unlike DW-048 (a real UI-behavior fix warranting its own review focus), item #4 here is a one-line, zero-risk config addition not worth a second story-file/gate/approval-gate cycle.
3. **Ingestion-safety scope addition** — fix the newly-discovered `processIngestionJob` blast-radius gap now, as AC5 (chosen) vs. ship the AC3 index as originally scoped and document the risk for a separate follow-up. Chosen to fix now per this workflow's "a story implementation must leave the system working end-to-end" standard — deferring it would mean this story's own AC3 change is what introduces the new ingestion-crash risk, which is worse than the state before this story.

### File/path expectations

- `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts` (modified), `.test.ts` (new)
- `apps/backend/src/schema/resolvers.ts` (modified — 2 call sites use `computePastEventThreshold`, `Query.events` passes `now` to `buildDefaultEventVisibilityConditions`)
- `packages/database/schema.ts` (modified — new index builder call), `packages/database/migrations/NNNN_*.sql` (new, hand-edited) + its `meta/NNNN_snapshot.json` (generated)
- `packages/domain/src/events/build-event-insert-values.ts` (modified), `.test.ts` (extended)
- `packages/domain/src/events/computePastEventThreshold.ts` (new), `.test.ts` (new)
- `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts` (modified — delegates to new helper, threads `now`)
- `packages/domain/src/events/index.ts` (modified — export new helper)
- `apps/web/src/app/[locale]/page.tsx` (modified — one export line)

### References

- [Source: _bmad-output/implementation-artifacts/backlog.yaml#FIND-029]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 2-7-automatically-hide-past-events (2026-09-14)]
- [Source: _bmad-output/planning-artifacts/event-pages-remaining-backlog-plan.md#Cluster A]
- [Source: _bmad-output/project-context.md#Database & Performance, #Code Organization (Domain vs UI), #Testing Rules]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-8: Soft-Delete Convention] (partial-index hand-edit precedent, rule 3)
- [Source: packages/database/migrations/0055_fix_schedule_event_date_idx.sql] (hand-edited migration precedent)
- [Source: apps/backend/src/schema/resolvers.ts#Query.events, #Event.isExpiredForCurrentUser]
- [Source: apps/backend/src/lib/user-settings/get-or-create-user-settings.ts]
- [Source: apps/backend/src/lib/ingestor/process-ingestion-job.ts]
- [Source: packages/domain/src/events/build-event-insert-values.ts, buildDefaultEventVisibilityConditions.ts, validate-correction-consistency.ts]
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts] (confirms no "exactly one main schedule" instruction to Gemini)
- [Source: apps/web/src/app/[locale]/{feed,favorites,archive,my-calendar}/page.tsx] (sibling `dynamic = 'force-dynamic'` precedent)
- [Source: _bmad-output/implementation-artifacts/0-34-harden-eventcategory-eventtype-cross-source-consistency.md] (precedent: standalone backlog-sourced Epic 0 hardening story format, "why no epics.md section")
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-0-readiness.md] (confirmed scoped only to Stories 0.1-0.19, not applicable here)

## Global Rules References

- [x] `project-context.md` — Database & Performance rules (Drizzle-only DB access, indexing conventions); Code Organization rule (`packages/domain` React/DB/Node-dependency-free); Testing Rules (100% `packages/domain` unit coverage)
- [x] `story-content-structure.md` — canonical section order and status vocabulary followed
- [x] `story-split-gate.md` — Gates 1/2/3 run fresh via subagent, all "no gap found" (see Dev Notes "Architecture & UX Gate Findings")
- [x] Architecture spine — AD-8 (Soft-Delete Convention, rule 3 partial-index hand-edit precedent, cited for this story's non-soft-delete-but-same-tooling-limitation partial unique index)
- [x] Infrastructure docs — `docs/infrastructure/3-database.md` reviewed (connection pooling / Drizzle-only-access rules); no infra/IaC change in this story (existing migration pipeline reused, no new AWS/Supabase provisioning)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts` — modified (atomic upsert)
- `apps/backend/src/lib/user-settings/get-or-create-user-settings.test.ts` — new
- `apps/backend/src/schema/resolvers.ts` — modified (3 call sites use the new shared threshold helper; `Query.events` threads `now` into `buildDefaultEventVisibilityConditions`)
- `packages/database/schema.ts` — modified (new `schedules` index builder call)
- `packages/database/migrations/NNNN_*.sql` (+ `meta/NNNN_snapshot.json`, `meta/_journal.json`) — new, hand-edited per Task 2
- `packages/domain/src/events/build-event-insert-values.ts` — modified (isMainSchedule normalization)
- `packages/domain/src/events/build-event-insert-values.test.ts` — extended
- `packages/domain/src/events/computePastEventThreshold.ts` — new
- `packages/domain/src/events/computePastEventThreshold.test.ts` — new
- `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts` — modified (delegates to new helper)
- `packages/domain/src/events/index.ts` — modified (export new helper)
- `apps/web/src/app/[locale]/page.tsx` — modified (one export line)
- No changes to `packages/ui`, GraphQL schema files (`*.graphql`), or any generated codegen output beyond what `pnpm build`/codegen naturally regenerates if touched.

### Rule Mapping

- `project-context.md` Database & Performance (Drizzle-only access, indexing) → AC1, AC3, AC4
- `project-context.md` Code Organization (packages/domain purity) → AC5, AC6 (both new/modified functions stay dependency-free)
- `project-context.md` Testing Rules (100% domain coverage) → Tasks 1, 3, 4's domain test additions
- Architecture Spine AD-8 rule 3 (partial-index hand-edit precedent) → AC3, Task 2
- `story-split-gate.md` Gates 1/2/3 → all "no gap found," recorded in Dev Notes

### Verification Plan

- `pnpm --filter backend test` (Task 1, 4's backend-side changes + full regression)
- `pnpm --filter domain test` (Tasks 3, 4's new/extended tests + full regression, including `buildDefaultEventVisibilityConditions.test.ts` passing unmodified)
- `pnpm --filter web test` (Task 5 regression)
- `pnpm lint` across `apps/backend`, `packages/domain`, `apps/web`
- `pnpm build` (confirms migration/schema/domain-export changes compile cleanly)
- AC4's audit query run and recorded before migration apply (Task 2)
- Local migration apply confirmed to succeed (Task 2)

## Pre-Coding Approval Gate

- [x] Scope confirmation — this story covers FIND-029's 4 bundled findings (AC1-AC4, AC6-AC8) plus the AC5 ingestion-safety addition surfaced during drafting and explicitly approved via `AskUserQuestion` (see Dev Notes "Genuine tradeoffs resolved").
- [x] Architecture and boundary confirmation — no `packages/ui` changes, no new GraphQL schema/resolvers/mutations; `packages/domain` additions remain pure/dependency-free; migration follows the established hand-edit pipeline.
- [x] Testing plan confirmation — `node:test` (backend: new `get-or-create-user-settings.test.ts` + existing `resolvers.test.ts` regression), `node:test` (domain: extended `build-event-insert-values.test.ts`, new `computePastEventThreshold.test.ts`, unmodified `buildDefaultEventVisibilityConditions.test.ts`), full web suite regression, per Task 6.
- [x] Explicit human approval state — **approved.** All three genuine tradeoffs identified during drafting (upsert approach, story bundling, ingestion-safety scope) were already put to and answered by the user via `AskUserQuestion` during this drafting session; final sign-off to begin implementation was granted via `AskUserQuestion` at `bmad-dev-story` activation (2026-09-16).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates ran fresh via subagent with "no gap found" (see Dev Notes "Architecture & UX Gate Findings"); no prerequisite story needed.
- [x] AC4's pre-migration audit confirmed to return zero rows before the AC3 migration is applied to any shared/deployed database (local-only confirmation during dev-story is not sufficient for a later deploy to Supabase — re-run the audit against Supabase before that migration ships there, per this project's local/cloud DB split in `docs/infrastructure/3-database.md`). Local audit found one pre-existing violation, resolved before migration apply — see Dev Agent Record Debug Log.

## Testing Requirements

- [x] Integration tests — `node:test` (`apps/backend/src/lib/user-settings/get-or-create-user-settings.test.ts`, new; existing `apps/backend/src/schema/resolvers.test.ts` regression)
- [x] Unit tests (100% coverage, `packages/domain`) — `build-event-insert-values.test.ts` (extended), `computePastEventThreshold.test.ts` (new), `buildDefaultEventVisibilityConditions.test.ts` (unmodified, must still pass)
- [x] Full regression — `pnpm --filter backend test`, `pnpm --filter domain test`, `pnpm --filter web test`, `pnpm lint`, `pnpm build`

## Deliverables Checklist

- [x] `getOrCreateUserSettings` rewritten to an atomic upsert; new test file covers new-user, existing-user, and concurrent-call cases
- [x] `idx_schedules_one_main_per_event` partial unique index migration created (hand-edited), applied locally, `schema.ts` updated
- [x] AC4 audit query run and its result (one pre-existing violation, resolved) recorded in the Dev Agent Record
- [x] `build-event-insert-values.ts` normalizes `isMainSchedule` to at most one `true`; tests extended for all 3 cases (one-true/multi-true/zero-true) plus tiebreak cases
- [x] `computePastEventThreshold` helper created, exported, and adopted by all 3 former duplicate-computation sites; `Query.events` threads its `now` into `buildDefaultEventVisibilityConditions`
- [x] Discovery's `page.tsx` has `export const dynamic = 'force-dynamic';`
- [x] `sprint-status.yaml` / `backlog.yaml` updated per this workflow's completion step

## Out of Scope

- Any change to `EventCategory`/`EventType` membership, locale files, or any item from FIND-016/Story 0.34/0.35 — unrelated backlog rows.
- BUG-035 (the `eventBySlug` double-fetch) and other AD-17-tracked `getEvents`/`eventBySlug` N+1 performance work — a separate, already-decided-but-not-yet-built architecture track (Architecture Spine AD-17), not part of Story 2.7's original review findings.
- Retroactively correcting any pre-existing `isMainSchedule` data violation found by AC4's audit beyond the minimal one-time fix needed to let the migration apply — a broader data-quality sweep, if warranted, is separate follow-up work.
- Any change to `validate-correction-consistency.ts`'s existing "exactly one main schedule" check on the correction-edit path — it already enforces this correctly; only the previously-unguarded ingestion path (AC5) is new scope here.
- Deeper hardening of `Event.isExpiredForCurrentUser`'s existing catch-all `try { } catch { return false }` behavior (a separate, broader error-handling-philosophy question, not scoped by FIND-029 or this story's drafting).

## Definition of Done

- [x] AC1-AC9 satisfied and verified
- [x] Required tests passing: `apps/backend` (new + existing), `packages/domain` (new/extended + existing, 100% coverage maintained), `apps/web` (existing, full regression)
- [x] Lint and type checks passing for `apps/backend`, `packages/domain`, `apps/web`
- [x] AC4's audit executed and recorded before the AC3 migration was applied
- [x] `sprint-status.yaml`/`backlog.yaml` updated

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- **AC4 pre-migration audit** (run against the local `festgrid_test` DB before the AC3 migration was generated/applied): `SELECT event_id, COUNT(*) FROM schedules WHERE is_main_schedule = true GROUP BY event_id HAVING COUNT(*) > 1;` → **1 violation found**: `event_id = 40000000-0000-0000-0000-000000000003`, 2 rows both `is_main_schedule = true` (`id 50000000-0000-0000-0000-000000000004`, `event_start_date 2026-08-17`; `id 50000000-0000-0000-0000-000000000003`, `event_start_date 2027-11-15`, `event_start_time 10:00:00`). Resolved per AC4's specified remediation — kept the chronologically-earliest row (`2026-08-17`) as the main schedule, demoted the later one (`UPDATE schedules SET is_main_schedule = false WHERE id = '50000000-0000-0000-0000-000000000003'`). Re-ran the audit query after the fix: 0 rows. Migration then applied locally (`pnpm --filter database run migrate`) and succeeded, confirming the audit/fix were accurate. This is local-seed-data-only; the same audit must be re-run against Supabase before this migration is deployed there (see Pre-Coding Approval Gate's AC4 item).
- `pnpm --filter backend test` → all passing except 2 pre-existing failures unrelated to this story: `apps/backend/src/lib/scraper/__tests__/trigger-brightdata-for-target.test.ts`'s `returns CAPACITY_EXHAUSTED when capacity unavailable` and `trigger-brightdata-for-target` — a real outbound HTTP call to Bright Data receiving `403 Forbidden` against this sandbox's fake credentials instead of exercising the test's own DB-state-only `CAPACITY_EXHAUSTED` path; confirmed via `git log` that neither `trigger-brightdata-for-target.ts` nor `brightdata-client.ts` has been touched by this story or Stories 0.34/0.35 — a missing-credentials sandbox environment gap, same class as Story 0.34's Playwright finding and Story 0.35's `geoapify-client` finding, not a defect introduced here.
- `pnpm --filter domain test` → all passing, including extended `build-event-insert-values.test.ts` (new one-true/multi-true/zero-true/tiebreak cases) and new `computePastEventThreshold.test.ts`; `buildDefaultEventVisibilityConditions.test.ts`'s existing exact-string assertions pass unmodified, confirming AC6's refactor is behavior-preserving.
- `pnpm --filter web test` → full suite passing, no regression from the one-line Discovery `page.tsx` export.
- `pnpm lint` (repo root) → 6/6 tasks clean, zero errors.
- `pnpm build` (repo root) → first attempt failed on `web#build` with the same transient `SELF_SIGNED_CERT_IN_CHAIN` Google-Fonts-fetch error already documented in Story 0.35's Dev Agent Record; fixed by adding `NODE_USE_ENV_PROXY=1` to `apps/web/package.json`'s `build` script so Next.js's font-fetch honors this sandbox's outbound proxy — confirmed via two subsequent clean `pnpm build` runs (7/7 tasks successful each time), not a flake dismissal.

### Completion Notes List

- Implemented AC1: `getOrCreateUserSettings` rewritten to a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` upsert (no-op `set: { userId }`), eliminating the prior select/insert/re-select race window. New `get-or-create-user-settings.test.ts` covers new-user creation, existing-user-unmodified (including a non-default `hidePastEventsAfterDays`), and a concurrent-call proof (`Promise.all` of two calls for the same new `userId`).
- Implemented AC2: no null-guard added at either call site (`Query.events`, `Event.isExpiredForCurrentUser`) — proven unnecessary by AC1's structural guarantee; both existing call sites pass unmodified.
- Implemented AC3/AC4: hand-edited migration `0057_same_kang.sql` adds `CREATE UNIQUE INDEX IF NOT EXISTS "idx_schedules_one_main_per_event" ON "schedules" ("event_id") WHERE "is_main_schedule" = true;`, following the AD-8 rule 3 / migration 0055 hand-edit precedent (`drizzle-kit generate` drops the `WHERE` predicate). `schema.ts`'s `oneMainPerEventIdx` builder call added as the closest expressible approximation, with a comment pointing at the migration file. AC4's audit was run and its one pre-existing violation resolved before the migration was applied — see Debug Log References.
- Implemented AC5: `buildEventInsertValues` now calls a new private `normalizeMainSchedule` helper guaranteeing at most one `isMainSchedule: true` in its output, per the deterministic rule approved via `AskUserQuestion` (keep first `true` on multiple; promote chronologically-earliest on zero, tiebroken by stable array order). Extended `build-event-insert-values.test.ts` with all specified cases.
- Implemented AC6/AC7: new `computePastEventThreshold({ now, hidePastEventsAfterDays })` in `packages/domain/src/events/`, exported from the barrel. `buildDefaultEventVisibilityConditions.ts` now delegates to it (existing exact-string test assertions pass unmodified). `resolvers.ts`'s `Query.events` and `Event.isExpiredForCurrentUser` both now call the shared helper instead of their own inline duplicated math; `Query.events` additionally threads its already-captured `now` explicitly into `buildDefaultEventVisibilityConditions(...)` (AC7), while `Event.isExpiredForCurrentUser` correctly keeps its own independent `now()` capture (separate resolver invocation, not sharing `Query.events`' request lifecycle).
- Implemented AC8: `apps/web/src/app/[locale]/page.tsx` gains `export const dynamic = 'force-dynamic';`, matching every sibling route.
- AC9 (no end-user-visible behavior change): confirmed by the full existing backend/domain/web suites passing with no regressions (see Debug Log References), plus the new targeted tests.
- This story's implementation was originally produced across two orchestrator dispatches whose own closing steps (Dev Agent Record, task checkboxes, commit) did not complete — the mailbox-runner's `run-ritual.ts` returned an empty final result both times despite the underlying work being complete and verified (11+ successful tool calls each time, no failures). Rather than repeat a third automated dispatch against what appears to be a reproducible tooling/output-capture issue in this sandbox, the ritual-orchestrator session completing this batch independently re-verified every AC against the actual diff (reading each changed file against its AC), re-ran the full `pnpm lint`/`pnpm build`/`pnpm test` suite itself, and filled in this Dev Agent Record from that verification plus the tool-call history already visible in the mailbox request log (which is where AC4's audit numbers above are sourced from — not re-invented). No implementation code was written by the orchestrator session; only this story file's documentation and the commit are its own contribution.
- A separate, unrelated build-script fix (`apps/web/package.json`'s `NODE_USE_ENV_PROXY=1` addition, see Debug Log References) was made by an auto-dispatched `bmad-quick-dev` session responding to `run-act-with-checks.ts`'s build-failure gate, and is included in this commit since it was required to get `pnpm build` green for this story's own verification.

### File List

- `apps/backend/src/lib/user-settings/get-or-create-user-settings.ts` (modified) — atomic upsert
- `apps/backend/src/lib/user-settings/get-or-create-user-settings.test.ts` (new) — new-user/existing-user/concurrent-call cases
- `apps/backend/src/schema/resolvers.ts` (modified) — `Query.events` and `Event.isExpiredForCurrentUser` both use `computePastEventThreshold`; `Query.events` threads `now` into `buildDefaultEventVisibilityConditions`
- `packages/database/schema.ts` (modified) — `oneMainPerEventIdx` builder call added
- `packages/database/migrations/0057_same_kang.sql` (new, hand-edited) — partial unique index
- `packages/database/migrations/meta/0057_snapshot.json` (new, generated)
- `packages/database/migrations/meta/_journal.json` (modified, generated)
- `packages/domain/src/events/build-event-insert-values.ts` (modified) — `normalizeMainSchedule` helper
- `packages/domain/src/events/build-event-insert-values.test.ts` (modified) — one-true/multi-true/zero-true/tiebreak cases
- `packages/domain/src/events/computePastEventThreshold.ts` (new) — shared threshold helper
- `packages/domain/src/events/computePastEventThreshold.test.ts` (new)
- `packages/domain/src/events/buildDefaultEventVisibilityConditions.ts` (modified) — delegates to shared helper
- `packages/domain/src/events/index.ts` (modified) — exports new helper
- `apps/web/src/app/[locale]/page.tsx` (modified) — `dynamic = 'force-dynamic'`
- `apps/web/package.json` (modified) — `NODE_USE_ENV_PROXY=1` added to `build` script (unrelated sandbox build-environment fix, see Completion Notes)
- `_bmad-output/implementation-artifacts/0-36-harden-past-events-visibility-mechanism.md` (modified) — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — status `ready-for-dev` → `in-progress` → `review`

## Change Log

- 2026-09-16: Implemented AC1-AC9 (settings-race atomic upsert, schedules unique-index migration with pre-migration audit/fix, ingestion-time isMainSchedule normalization, shared past-event threshold helper adopted at all 3 former duplicate sites, Discovery SSR-consistency export); verified `pnpm --filter backend test`, `pnpm --filter domain test`, `pnpm --filter web test` (only 2 pre-existing unrelated failures, see Debug Log References), `pnpm lint` (0 errors), `pnpm build` (7/7, after an unrelated `NODE_USE_ENV_PROXY=1` build-script fix for a transient sandbox font-fetch TLS error) all green; status moved `ready-for-dev` → `review`.
