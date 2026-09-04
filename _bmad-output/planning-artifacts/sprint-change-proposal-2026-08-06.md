---
backlog_id: CC-005
title: "Sprint Change Proposal: Soft-Delete-with-Undo Reliability Fix (AD-8 rollout)"
status: "approved"
created: "2026-08-06T00:00:00Z"
---

# Sprint Change Proposal: Soft-Delete-with-Undo Reliability Fix (AD-8 rollout)

## 1. Issue Summary

The "Soft Delete with Undo" UX pattern (`EXPERIENCE.md`) and its `packages/ui` primitive (Story 0.18, `useSoftDeleteWithUndo`) originally deferred the backend delete/commit call until the user navigated away from the page (component unmount) — specifically so "Undo" could just cancel a not-yet-fired call, with no backend restore mechanism needed.

This design has a silent data-loss bug: if the user closes the browser tab/window instead of navigating within the app, the component's unmount effect never fires, so the delete is never committed — even though the item was shown greyed-out with a "delete succeeded, undo if you want" toast. The user believes the item is deleted; it never was.

Root-caused and fixed this session, in three layers, each already reviewed and approved before this proposal:
1. **UX layer** (`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`): the "Soft Delete with Undo" pattern was revised to commit immediately at Trigger, with Undo reversing an already-committed delete within a 6-second window, timer-elapse removing the item locally with no further network call. Accessibility-reviewed (`review-accessibility-soft-delete-undo.md`), all findings resolved.
2. **Architecture layer** (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`, AD-8): extended to (a) bind `UserLocation` (closing the specific gap causing this bug) plus `Schedule`/`Post`/`GeolocationCache`/`users` explicitly excluded or deferred with stated reasons, and (b) a new rule 4 defining a shared `SoftDeleteAction { DELETE, RESTORE }` mutation contract. Reviewer-gated (3 parallel lenses: rubric walker, reality-check, adversarial-divergence — 3 critical/6 high/8 medium findings total, all resolved into the spine).
3. **This proposal**: the resulting story-level and planning-artifact impact of layers 1-2.

**Discovered by:** the user, reporting the browser-tab-close data-loss bug directly.

## 2. Impact Analysis

**Epic Impact:**
- **Epic 0** (`in-progress`): Story 0.18 (`useSoftDeleteWithUndo`/`SoftDeleteToaster`, status `review`) has its own AC4 inverted — commit-on-unmount removed entirely, replaced with commit-already-happened/undo-reverses/`onExpire`-on-timeout. New Story 0.22 added (shared `activeOnly()` query-filter helper — a gap the AD-8 reviewer gate found independently: rule 2's "enforced once, never per-resolver" claim was false against shipped code).
- **Epic 2** (`in-progress`): Story 2-3a (Saved Locations backend, `review`) has `deleteUserLocation` migrated from a hard delete to AD-8's soft-delete + `action`-param contract — a breaking API change to a shipped, tested mutation. Story 2-3 (Saved Locations frontend, `in-progress`) has its delete-interaction ACs (9-11) rewritten to match both 0.18's and 2-3a's new contracts, plus a new failure-path AC (11a) that didn't exist before (the old deferred-commit design had no optimistic-before-confirmation window to fail in).
- Favorites (`favorites-content.tsx`) confirmed **not impacted** — it already implements an immediate-commit/re-toggle-to-undo pattern informally, which is the named precedent the revised `EXPERIENCE.md` generalizes, not a divergent case needing migration.
- No epic added/removed/resequenced; no epic becomes obsolete.

**Artifact Conflicts:**
- **EXPERIENCE.md / DESIGN.md**: revised this session (State Patterns § Soft Delete with Undo; new Accessibility Floor subsection; new `notification.undo_duration_ms`/`error_duration_ms`/`action_hit_area` tokens).
- **Architecture spine (AD-8)**: extended this session, reviewer-gated.
- **PRD** (`prd.md` §4.6): `UserLocationPreference` interface gained `deletedAt?: string`, reconciling it with AD-8's new `UserLocation` binding (a source-input document diverging from the spine is treated as a defect, not left alone).
- **project-context.md**: was stale (pre-session AD-8 text — no `UserLocation`, no mutation contract, a since-disproven "enforced once in `buildOptimizedDrizzleSelect`" claim) — corrected as part of this proposal, since every dev-story agent reads this file first.
- **Story files** 0.18, 2-3a, 2-3: amended in place (below) — all three were still `review`/`in-progress`, not `done`, so amending rather than superseding was viable.

**Technical Impact:** Real, since two of the three amended stories (0.18, 2-3a) and the frontend consumer (2-3) already have shipped, tested code that is now stale against their own story files' ACs — `packages/ui/src/hooks/useSoftDeleteWithUndo.ts`, `apps/backend/src/schema/resolvers.ts`'s `deleteUserLocation`/`myLocations`, and `apps/web/src/app/[locale]/settings/locations/locations-content.tsx` all need to be re-implemented against the revised ACs. No code was changed as part of this proposal — that's the follow-up `bmad-dev-story` pass(es) this proposal hands off to.

## 3. Recommended Approach

**Selected: Option 1 — Direct Adjustment.** Effort: Medium (three stories touched, one new). Risk: Low-Medium (real behavior change to shipped code, but narrowly scoped and already reviewer-gated at the design/architecture layer before reaching story text). Rollback (Option 2) does not apply — the prior design is the bug, not a simplification to preserve. MVP/scope review (Option 3) does not apply — no feature scope changed, this is a reliability fix to an existing feature's mechanism.

All three existing stories (0.18, 2-3a, 2-3) were still `review`/`in-progress`, never `done` — amending them in place was viable and preferred over superseding with new story numbers, since their surrounding ACs/Dev Notes/tests mostly still hold and only the delete/undo-specific sections needed rewriting.

The one genuinely new piece of work (the shared `activeOnly()` helper + retrofit of 6 existing hand-written filter call sites) was **not** folded into 2-3a, since it's cross-cutting infrastructure the AD-8 reviewer gate identified independently of any Saved-Locations-specific need (it also covers `favorites`/`calendarAdditions`) — it became new Story 0.22, sequenced as non-blocking relative to 2-3a (either can ship first; see Story 0.22's Dev Notes for the sequencing trade-off).

## 4. Detailed Change Proposals

All edits below were presented incrementally and approved individually during this session.

### 4.1 Story 0.18 (`0-18-build-the-reusable-soft-delete-with-undo-ui-primitive.md`)
- AC2-4 rewritten: `markPending(id, undo, labels?)` (was `commit`) — caller has already committed before calling this; toast auto-dismisses after `{components.notification.undo_duration_ms}` (6000ms); Undo calls the caller-supplied `undo()`; an elapsed window with no Undo calls a new caller-supplied `onExpire(id)` instead of the removed unmount-commit mechanism.
- AC6 (test suite) reworded to match: `onExpire`-fires-once-on-elapsed-window (fake timers) replacing unmount-commits-all-still-pending.
- Story summary paragraph and a new inline rationale block explain the "why revised" (the browser-tab-close bug) directly in the story file, not only in this proposal.
- **Not rewritten in this pass** (left for the dev-story implementer): Task 2's internal hook-implementation prose, Dev Notes' stale-closure explanation — the AC-level contract change plus rationale is sufficient signal; re-deriving implementation-level prose is dev-story's job when it re-implements.

### 4.2 Story 2-3a (`2-3a-build-the-saved-locations-backend-graphql-api-layer.md`)
- AC5 rewritten: `deleteUserLocation(id: ID!, action: SoftDeleteAction!): UserLocation!` (was `deleteUserLocation(id: ID!): Boolean!` hard delete). New shared `SoftDeleteAction { DELETE, RESTORE }` enum, declared once in `typeDefs.graphql`. Idempotency behavior changed: a mismatched state transition now throws `GraphQLError(INVALID_STATE_TRANSITION)` instead of silently no-op'ing.
- AC6 amended: `myLocations` now filters `deleted_at IS NULL`.
- New Task 1b: add `deletedAt` column + partial index (with the documented drizzle-kit hand-edit workaround), drop the superseded plain index.
- Task 4/5 (SDL/resolvers) rewritten to match AC5/AC6.
- Dev Notes' "AD-8 does not bind `user_locations`" reasoning (finding 3, and the Architecture/technical-constraints paragraph) struck through and marked superseded, with a pointer to why it was correct *at the time* and what changed.
- New task: sync `project-context.md`'s Soft-Delete Convention paragraph (done directly in this session, not deferred — see 4.4).

### 4.3 Story 2-3 (`2-3-manage-saved-locations.md`)
- AC9-11 rewritten: delete click now calls `deleteUserLocation(DELETE)` immediately, then `markPending`; Undo now calls `deleteUserLocation(RESTORE)` (a real mutation — was "no mutation is ever sent"); elapsed-window behavior replaces unmount-commit entirely (local cache splice, no further mutation call).
- New AC11a: delete-call failure path (revert optimistic grey-out, error toast) — did not exist in the original story, since the old design had no optimistic-before-confirmation window.
- AC14 (test list) and the Playwright E2E flow updated to match; Task 3/Task 6 (delete-wiring, analytics timing) updated; Dev Notes' AD-8/Loader-classification paragraphs corrected (soft-delete is now real, not a UI-layer fiction).

### 4.4 project-context.md
- Soft-Delete Convention paragraph (Database & Performance) corrected: `UserLocation` added to the table list, exclusions named, the "enforced once" claim reworded to "target, not current state" with a pointer to Story 0.22, the SQL example corrected (plural table names, matching `schema.ts`), and a new sentence naming the `action`-param mutation contract.
- Applied directly in this session (not deferred to a story task), since this file is read by every dev-story agent before it writes code.

### 4.5 epics.md — new Story 0.22
- Full new section added (Epic 0): shared `activeOnly(table)` helper + retrofit of 6 existing hand-written `isNull()` call sites in `resolvers.ts`. Written into `epics.md` following the same pattern as prior Epic-0 "reserved slot" infrastructure stories (0.17, 0.19, 0.21).

### 4.6 sprint-status.yaml
- `0-18-...`: `review` → `in-progress`, with an inline comment pointing at this proposal.
- `2-3a-...`: `review` → `in-progress`, same.
- `2-3-manage-saved-locations`: comment added (status already `in-progress`, unchanged).
- `0-22-build-the-shared-active-rows-query-filter-helper-for-ad-8`: new entry, `backlog`.
- No epic-level status changes — Epic 0 and Epic 2 both remain `in-progress`.

### 4.7 (Already applied in prior sessions, referenced for completeness)
- `EXPERIENCE.md`/`DESIGN.md` (UX pattern revision + accessibility floor), `festgrid-architecture-spine.md` AD-8 (extension + Reviewer Gate fixes), `prd.md` §4.6 (`deletedAt` field) — all completed and reviewer-gated before this proposal began; not re-litigated here.

## 5. Implementation Handoff

**Scope classification: Moderate.** More than one story affected, one new story created, real (if narrowly-scoped) behavior changes to shipped/tested code — but no epic restructuring and no PRD/MVP scope change, so it stops short of Major.

- **Route to:** Product Owner / Developer agents (`bmad-dev-story`) for each amended/new story.
- **Sequencing:** Story 0.18 has no blocking dependency and can be re-implemented first. Story 2-3a can proceed in parallel or after 0.18 (its scope is independent — schema/resolver/mutation contract). Story 2-3 (frontend) depends on both 0.18's new hook contract and 2-3a's new mutation contract landing first — it is the last of the three to re-verify against real (not mocked) dependencies, mirroring the dependency-chain pattern already established in its own Definition of Done. Story 0.22 is unblocked and can run any time; 2-3a's `myLocations` filter can either wait for it or ship its own inline filter now and be retrofitted later (Story 0.22's own Dev Notes flag this as a live sequencing choice, not decided here).
- **Developer agent:** each story's Pre-Coding Approval Gate has been updated with the specific behavior-change checkboxes needing (re-)confirmation before implementation begins; normal `bmad-dev-story` flow applies otherwise.
- **Success criteria:** `useSoftDeleteWithUndo.test.ts` covers `onExpire` (fake timers) instead of unmount-commit; `deleteUserLocation` integration tests cover `DELETE`/`RESTORE`/`INVALID_STATE_TRANSITION`; `locations-content.test.tsx` covers the immediate-commit/restore/expire/failure paths; `myLocations` never returns a soft-deleted row; `pnpm build`/`pnpm lint`/full test suite clean at the repo root for each story as it lands.
