---
title: 'Extract the shared suggested-match resolve function (Piece A of the AI dedup review)'
type: 'refactor'
created: '2026-10-30'
status: 'done'
baseline_commit: '640aeed8f7b7aeb382e742103eb24291f06c90cb'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A moderator's accept/reject of a suggested event match is inline in the GraphQL resolver; only `mergeEvents` is shared. A second caller (the planned AI-review apply script, Pieces B and C in `DESIGN.md`) would have to copy it. The inline code also has a race: the pending check runs outside the transaction and neither the accept flip nor REJECT guards on `pending`, so a REJECT made between the check and the merge is overwritten to `accepted`.

**Approach:** Extract `resolveSuggestedMatch` into one backend module that runs inside a caller-owned transaction, locks the suggestion row and rechecks `pending`. The resolver becomes a thin wrapper that maps typed errors to its existing GraphQL codes. Characterization tests land first; a source-scan ratchet stops a second writer of suggestion status.

## Boundaries & Constraints

**Always:**
- GraphQL-visible behaviour is unchanged: error codes, messages, and check order (not found, then not pending, then invalid action).
- The single intended behaviour change: REJECT now runs in the same transaction as ACCEPT, with the row locked, which closes the race.
- The caller owns the transaction (as `drainMatchBacklog` does); the function never opens one. It accepts `DbExecutor` and throws typed domain errors; `resolvers.ts` maps them.
- Characterization tests pass against the unrefactored code before the extraction is committed.
- Any new DB test removes the rows it creates (backend row-count ratchet).

**Ask First:** changing `mergeEvents`, `undoEventMerge` or the GraphQL schema.

**Never:** a migration; a new caller of `resolveSuggestedMatch` beyond the resolver (Piece B adds the apply script); touching ingestion's `insert(eventMatchCandidates)`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Accept | Pending suggestion, mergeable pair | Merge journaled, status `accepted`, returns `mergeId` | N/A |
| Reject | Pending suggestion | Status `rejected`, `resolvedAt` and moderator set, `mergeId` null, no merge | N/A |
| Unknown id | No such suggestion | Nothing written | `SuggestedMatchNotFoundError` -> `NOT_FOUND` |
| Already resolved | Status not `pending` (read under the row lock) | Nothing written | `SuggestedMatchNotPendingError` -> `INVALID_STATE_TRANSITION` |
| Pair not mergeable | Winner or loser already merged or deleted | Transaction rolls back, suggestion stays `pending` | `EventMergeInvalidStateError` -> `INVALID_STATE_TRANSITION` |
| Bad action | Action neither ACCEPT nor REJECT | Nothing written | `BAD_REQUEST`, only after the pending check |

</frozen-after-approval>

## Code Map

- `apps/backend/src/schema/resolvers.ts:1890-1944` -- `resolveSuggestedEventMatch`; its body moves out, response shaping (events re-select, `batchEventRowsForIds`) stays. Import at `:58`.
- `apps/backend/src/lib/events/merge-events.ts:248` (accept flip) and `:344` (undo) -- the other writers of suggestion status when this spec was written; unchanged. Master's IDEA-107 later added `lib/events/expire-match-suggestions.ts` (sets `expired`, guarded by `status = 'pending'`), which the ratchet allows.
- `apps/backend/src/lib/events/set-event-primary-post.ts:23` -- `DbExecutor` (no `transaction`, hence caller-owned).
- `apps/backend/src/schema/event-merges.test.ts:126-236` -- existing accept/reject/undo tests via GraphQL; covers no error path.
- `apps/backend/src/schema/events-postid-write-ratchet.test.ts` -- source-scan ratchet precedent.
- `apps/backend/src/db/client.ts` -- `max: 1` client with an SQL-capture sink; a race test needs a second, separate connection to hold the lock.

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/schema/event-merges.test.ts` -- add characterization tests through GraphQL: unknown id, already-resolved, non-mergeable pair (suggestion stays pending, nothing written), REJECT writes no merge -- run green on the current code first, so the refactor has a net.
- [x] `apps/backend/src/lib/events/resolve-suggested-match.ts` -- new `resolveSuggestedMatch(tx, { id, action, moderatorId })`: `SELECT ... FOR UPDATE` the suggestion, throw typed errors, ACCEPT calls `mergeEvents(tx, candidateEventId, eventId, moderatorId, id)`, REJECT updates status; returns `{ mergeId | null }`.
- [x] `apps/backend/src/schema/resolvers.ts` -- resolver wraps the call in `db.transaction`, maps the typed errors to the existing codes, keeps response shaping; drop now-unused imports (`mergeEvents`, `EventMergeInvalidStateError` if unused).
- [x] `apps/backend/src/lib/events/resolve-suggested-match.test.ts` -- cover each I/O row; assert via the SQL-capture sink that the suggestion select carries `for update`, and prove the lock with a real race (a second connection holds the row while a resolve waits, then sees it no longer pending).
- [x] `apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts` -- only `merge-events.ts`, `resolve-suggested-match.ts` and (after the IDEA-107 merge) the expiry writer `expire-match-suggestions.ts` may update `event_match_candidates` (drizzle, aliases, raw SQL); the expiry writer's UPDATE must keep its `status = 'pending'` guard; `resolvers.ts` must call `resolveSuggestedMatch(` inside `resolveSuggestedEventMatch` and never reference `mergeEvents`.
- [x] `docs/infrastructure/7-event-dedup.md`, `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html` (+ status section), `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-30 Rule 9 amendment), `_bmad-output/project-context.md` (dedup entry) -- name `resolveSuggestedMatch` as the one accept/reject entry point and record the row lock.

**Acceptance Criteria:**
- Given the characterization tests, when run before and after the extraction, then they pass both times with no assertion changed.
- Given a suggestion resolved between a caller's read and its write, when the second call runs, then it throws `SuggestedMatchNotPendingError` and writes nothing.
- Given a second file that updates `eventMatchCandidates`, when the ratchet runs, then it fails and names the file.

### Review Findings

Code review of PR #119 (Blind Hunter, Edge Case Hunter, Acceptance Auditor), triaged 2026-10-30: 0 decision-needed, 7 patch, 1 defer, 13 dismissed.

- [x] [Review][Patch] Ratchet missed `UPDATE ONLY`, raw upserts, `MERGE INTO`, assignment aliases and bracket access [suggested-match-resolve-ratchet.test.ts]
- [x] [Review][Patch] Ratchet's resolver check passed on any `resolveSuggestedMatch(` text and ignored an aliased `mergeEvents` import; it now requires the call inside `resolveSuggestedEventMatch` and no reference to `mergeEvents` [suggested-match-resolve-ratchet.test.ts]
- [x] [Review][Patch] Ratchet gave no signal if an allowed writer was renamed, and its limits were undocumented [suggested-match-resolve-ratchet.test.ts]
- [x] [Review][Patch] Docs said "the one entry point", "nothing else" and "any file", stronger than the code and ratchet support [project-context.md, 7-event-dedup.md, event-dedup-flow.html, festgrid-architecture-spine.md]
- [x] [Review][Patch] Spec Code Map and Tasks, and `DESIGN.md` section 7, still said two writers and cited a deleted `resolvers.ts:1916` [spec, DESIGN.md]
- [x] [Review][Patch] Docs called the expiry writer "the expiry tool" without naming the file that writes versus the CLI that runs it [7-event-dedup.md, project-context.md]
- [x] [Review][Patch] Suggested Review Order anchors drifted after later edits [this spec]
- [x] [Review][Defer] The drain calls `mergeEvents(..., suggestionId)` without the lock or a pending guard, and the lock covers the suggestion row, not the two events [drain-match-backlog.ts, merge-events.ts] -- deferred, pre-existing (BUG-094, already on the board)

Dismissed as noise or handled elsewhere (13): row-lock wait has no timeout (the old code also waited on the same row lock); post-commit response re-select (pre-existing pattern); `expired` reported as "already resolved" (GraphQL-visible behaviour is meant to be unchanged); REJECT ignores the affected-row count (unreachable under the lock, which two tests pin); BAD_REQUEST mapping untested through GraphQL (the enum blocks bad values); expiry-pin regex brittleness (fails loudly, the other direction is far-fetched); race-test second connection and timing (the outcome assertion still fails without the lock); FIND-105 and FIND-106 attributed to this spec (the defer procedure attributes to the current spec); `DESIGN.md` names credentials and roles (all already in committed docs on master); the "one hour off" scraper cutoff as a production time bug (the test is documented as depending on shared dev DB state, and CI passes it); scope creep of design and backlog files (they are separate commits and the requested artifacts); diagram text overflow (checked by screenshot); Tasks list widened with two extra characterization tests (harmless).

## Spec Change Log

## Design Notes

- **Why caller-owned transaction:** `DbExecutor` has no `transaction`, and Piece B's dry run needs an outer rolled-back transaction with a savepoint per decision; a function that opened its own would defeat that.
- **How the lock is tested:** the shared `db` has `max: 1`, so two concurrent transactions cannot both run through it. The race test therefore opens a second `postgres` connection that holds the row `FOR UPDATE` while `resolveSuggestedMatch` runs on `db`; a SQL-shape assertion backs it. Both fail if the lock is removed (checked by hand).
- **Scope:** Pieces B (bridge) and C (skill) are deferred as `FIND-107` and `FIND-104`; their requirements are in `DESIGN.md`. Nothing here depends on them.

## Verification

**Commands:**
- `pnpm --filter backend test` -- expected: all pass, including `event-merges.test.ts`, the new ratchet and the row-count ratchet.
- `pnpm --filter backend lint && pnpm --filter backend exec tsc --noEmit` -- expected: clean.

## Suggested Review Order

**The shared function (start here)**

- One entry point: lock the suggestion row, recheck pending, then merge or reject.
  [`resolve-suggested-match.ts:47`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L47)

- The `FOR UPDATE` read is what serialises two resolves of one row.
  [`resolve-suggested-match.ts:50`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L50)

- REJECT joins the transaction and refuses a row that is no longer pending.
  [`resolve-suggested-match.ts:67`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L67)

- Typed errors let each caller map failures to its own surface.
  [`resolve-suggested-match.ts:39`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L39)

**The resolver becomes a wrapper**

- Opens the transaction, calls the function, response shaping unchanged.
  [`resolvers.ts:1903`](../../apps/backend/src/schema/resolvers.ts#L1903)

- Typed errors map to the same GraphQL codes as before.
  [`resolvers.ts:1905`](../../apps/backend/src/schema/resolvers.ts#L1905)

**Drift guard**

- Only `merge-events.ts`, the function and the IDEA-107 expiry writer may update the table.
  [`suggested-match-resolve-ratchet.test.ts:112`](../../apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts#L112)

- String-aware comment stripping, so a quoted glob cannot hide a write.
  [`suggested-match-resolve-ratchet.test.ts:55`](../../apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts#L55)

- Negative controls prove each way of writing the table is caught.
  [`suggested-match-resolve-ratchet.test.ts:147`](../../apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts#L147)

**Proof the lock works and behaviour is unchanged**

- Real two-connection race: a held row makes a resolve wait, then fail as not pending.
  [`resolve-suggested-match.test.ts:163`](../../apps/backend/src/lib/events/resolve-suggested-match.test.ts#L163)

- Caller-owned transaction: a rolled-back ACCEPT leaves nothing behind (Piece B's dry run).
  [`resolve-suggested-match.test.ts:196`](../../apps/backend/src/lib/events/resolve-suggested-match.test.ts#L196)

- Characterization tests written against the old inline code before extraction.
  [`event-merges.test.ts:178`](../../apps/backend/src/schema/event-merges.test.ts#L178)

**Decisions and known gaps**

- AD-30 Rule 9 amendment, including the two deferred gaps.
  [`festgrid-architecture-spine.md:1901`](../planning-artifacts/festgrid-architecture-spine.md#L1901)

- Operator runbook note: do not run the drain while a moderator works the queue.
  [`7-event-dedup.md:85`](../../docs/infrastructure/7-event-dedup.md#L85)

- Flow diagram status entry for the single entry point.
  [`event-dedup-flow.html:367`](../planning-artifacts/diagrams/event-dedup-flow.html#L367)

- Pre-existing gaps and the sandbox test failure, deferred and on the board.
  [`deferred-work.md:801`](deferred-work.md#L801) · [`backlog.yaml:2626`](backlog.yaml#L2626)
