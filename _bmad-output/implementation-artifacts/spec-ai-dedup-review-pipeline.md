---
title: 'Extract the shared suggested-match resolve function (Piece A of the AI dedup review)'
type: 'refactor'
created: '2026-10-30'
status: 'draft'
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
- `apps/backend/src/lib/events/merge-events.ts:248` (accept flip) and `:344` (undo) -- the only other writers of suggestion status; unchanged.
- `apps/backend/src/lib/events/set-event-primary-post.ts:23` -- `DbExecutor` (no `transaction`, hence caller-owned).
- `apps/backend/src/schema/event-merges.test.ts:126-236` -- existing accept/reject/undo tests via GraphQL; covers no error path.
- `apps/backend/src/schema/events-postid-write-ratchet.test.ts` -- source-scan ratchet precedent.
- `apps/backend/src/db/client.ts` -- `max: 1` client with an SQL-capture sink; a real two-connection race test is not possible through it.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/backend/src/schema/event-merges.test.ts` -- add characterization tests through GraphQL: unknown id, already-resolved, non-mergeable pair (suggestion stays pending, nothing written), REJECT writes no merge -- run green on the current code first, so the refactor has a net.
- [ ] `apps/backend/src/lib/events/resolve-suggested-match.ts` -- new `resolveSuggestedMatch(tx, { id, action, moderatorId })`: `SELECT ... FOR UPDATE` the suggestion, throw typed errors, ACCEPT calls `mergeEvents(tx, candidateEventId, eventId, moderatorId, id)`, REJECT updates status; returns `{ mergeId | null }`.
- [ ] `apps/backend/src/schema/resolvers.ts` -- resolver wraps the call in `db.transaction`, maps the typed errors to the existing codes, keeps response shaping; drop now-unused imports (`mergeEvents`, `EventMergeInvalidStateError` if unused).
- [ ] `apps/backend/src/lib/events/resolve-suggested-match.test.ts` -- cover each I/O row; assert via the SQL-capture sink that the suggestion select carries `for update`.
- [ ] `apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts` -- only `merge-events.ts` and `resolve-suggested-match.ts` may `.update(eventMatchCandidates)` or run raw `UPDATE event_match_candidates`; `resolvers.ts` must contain a call `resolveSuggestedMatch(` (an import alone does not count).
- [ ] `docs/infrastructure/7-event-dedup.md`, `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html` (+ status section), `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-30 Rule 9 amendment), `_bmad-output/project-context.md` (dedup entry) -- name `resolveSuggestedMatch` as the one accept/reject entry point and record the row lock.

**Acceptance Criteria:**
- Given the characterization tests, when run before and after the extraction, then they pass both times with no assertion changed.
- Given a suggestion resolved between a caller's read and its write, when the second call runs, then it throws `SuggestedMatchNotPendingError` and writes nothing.
- Given a second file that updates `eventMatchCandidates`, when the ratchet runs, then it fails and names the file.

## Spec Change Log

## Design Notes

- **Why caller-owned transaction:** `DbExecutor` has no `transaction`, and Piece B's dry run needs an outer rolled-back transaction with a savepoint per decision; a function that opened its own would defeat that.
- **Why the lock is asserted by SQL, not by a race test:** the shared `db` has `max: 1`, so two concurrent transactions cannot run through it.
- **Scope:** Pieces B (bridge) and C (skill) are deferred as `FIND-103` and `FIND-104`; their requirements are in `DESIGN.md`. Nothing here depends on them.

## Verification

**Commands:**
- `pnpm --filter backend test` -- expected: all pass, including `event-merges.test.ts`, the new ratchet and the row-count ratchet.
- `pnpm --filter backend lint && pnpm --filter backend exec tsc --noEmit` -- expected: clean.
