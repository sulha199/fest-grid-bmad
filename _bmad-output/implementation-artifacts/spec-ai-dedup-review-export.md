---
title: 'AI dedup review, piece B1: read-only export of pending suggestions as evidence JSON'
type: 'feature'
created: '2026-10-31'
status: 'in-progress'
baseline_commit: 'bb7a4fc509e4c13d4854c31e8931af41c8fcf7b3'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
  - '{project-root}/docs/infrastructure/3-database.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The daily AI review (`DESIGN.md`) runs in a cloud session with no database credentials, so it cannot read the pending `event_match_candidates` queue or the evidence the deterministic rules computed for each pair, and nothing produces that evidence in a form safe for a public repo's Actions logs.

**Approach:** A manually dispatched `dedup-review-export` workflow runs a read-only script that prints one JSON line: for up to a limit of pending pairs, the evidence `evaluateBacklogRow` already computes plus event, schedule and source-post facts, a content hash per pair, and a `recentlyResolved` list. Pure parts (contract, canonical form, input validation) live in `packages/domain`; hashing and database reads live in `apps/backend`.

## Boundaries & Constraints

**Always:**
- The export never writes: the script runs inside a transaction set `READ ONLY`, whatever credential it was given.
- The repo is public: output has no usernames, account ids, captions or emails. It carries an account-type enum and a same-account boolean instead; the optional reviewer email only resolves an id and is never printed.
- Reuse `evaluateBacklogRow` and `decideMatchTier`; never re-derive a tier.
- Stale rows (an event deleted or merged) are dropped before the limit is applied and counted; ids in `skip_ids` are excluded and counted; oldest pending pairs come first.
- Every pair has `evidenceHash`: SHA-256 (in the backend) of a canonical string built in `packages/domain` from every evidence field plus the suggestion status and `undoneMergeCount`.
- Output is one `JSON.stringify` line between `DEDUP_REVIEW_EXPORT_BEGIN` and `DEDUP_REVIEW_EXPORT_END`; the job summary holds counts only; workflow inputs reach the script through env only and are validated first.
- The workflow runs in the `dedup-review` environment with `permissions: contents: read`, reads the secret `DEDUP_REVIEW_READONLY_DATABASE_URL`, and takes a `run_tag` input echoed in `run-name` and in the output line.

**Ask First:** adding or removing an evidence field (the apply side hashes it); raising the limit above 50.

**Never:** any write path; a migration; creating the environment, secret or repo variable (the owner does); captions, usernames or emails in output; the apply workflow (B2, `FIND-108`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | 3 pending pairs, default limit | 3 pairs with evidence and hash, totals set | N/A |
| Stale pair | An event is deleted or merged away | Dropped before the limit, counted in `staleCount` | N/A |
| Skipped ids | `skip_ids` names 2 pending pairs | Excluded, counted in `skippedCount`, the next pairs fill the limit | N/A |
| Queue over limit | 60 pending, limit 30 | Oldest 30 evaluable pairs, `totalPending` 60 | N/A |
| Undone merge | An accepted merge was undone, so the pair is pending again | `undoneMergeCount` is 1 or more and is in the hash | N/A |
| Already high | Pair already scores `high` | Exported with `tier: "high"` so the reviewer leaves it to the drain | N/A |
| Recently resolved | Resolved in the last 14 days | In `recentlyResolved` with status and `resolvedBy` (`reviewer`, `human`, `system`, `unknown`) | N/A |
| Empty queue | No pending rows | Valid line, empty `pairs`, zero totals | N/A |
| Bad input | Bad uuid in `skip_ids`, limit outside 1-50, bad `run_tag` | Rejected before any database connection | Exit 1, message names the field |
| Write attempt | Any INSERT or UPDATE in the export transaction | Fails: read-only transaction | Exit 1 |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/events/drain-match-backlog.ts` -- `evaluateBacklogRow` (signals, tier, stale detection); reuse.
- `packages/domain/src/events/match-scoring.ts` -- `MatchDecision`; `packages/domain/.c8rc.json` -- the 100% coverage gate.
- `packages/database/schema.ts` -- `events`, `schedules`, `eventPosts`, `posts`, `socialMediaAccountProfiles.accountType`, `eventMatchCandidates`, `eventMerges.undoneAt` and `suggestionId`.
- `apps/backend/src/drain-event-match-backlog.ts` -- CLI precedent (args, transaction); `.github/workflows/merge-twin-profiles.yml` -- workflow precedent.
- `_bmad-output/specs/ai-dedup-review/DESIGN.md` -- section 3 (trust model) and section 5 (requirements).

## Tasks & Acceptance

**Execution:**
- [ ] `packages/domain/src/events/dedup-review-evidence.ts` (+ test, `index.ts` export) -- evidence types, constants (limit 30, max 50, 14 days, markers), `canonicalizeDedupEvidence`, `parseDedupReviewOptions`, `formatDedupReviewExportLine`; 100% coverage.
- [ ] `apps/backend/src/lib/events/dedup-review-export.ts` (+ DB test) -- `buildDedupReviewExport(executor, options)`: scan oldest-first in batches (bounded), `evaluateBacklogRow`, extra reads, hash, `recentlyResolved`; tests clean up their rows.
- [ ] `apps/backend/src/dedup-review-export.ts` -- CLI: validate, open the `READ ONLY` transaction, print the marker line.
- [ ] `.github/workflows/dedup-review-export.yml` -- `workflow_dispatch` with `skip_ids`, `limit`, `run_tag`; concurrency lock; counts-only summary.
- [ ] `docs/infrastructure/7-event-dedup.md`, `docs/infrastructure/3-database.md`, `docs/infrastructure/architecture-diagram.md`, `docs/infrastructure/high-level-overview.md`, `_bmad-output/project-context.md`, `_bmad-output/specs/ai-dedup-review/DESIGN.md` -- the export, the read-only secret, owner setup steps; B1 recorded as built.

**Acceptance Criteria:**
- Given a seeded queue, when the builder runs, then pairs carry evidence and a hash, stale pairs are dropped, `skip_ids` is honoured, the limit holds and the totals are right.
- Given an account with a distinctive username and a post with a caption, when the export runs, then neither appears anywhere in the output line.
- Given an evidence field changes, when the hash is recomputed, then it differs; given none changes, then it is identical.
- Given the export transaction, when a write is attempted in it, then the database refuses it.
- Given invalid options, when the CLI runs, then it exits 1 before opening a connection.

## Spec Change Log

## Design Notes

- **Why `READ ONLY` as well as a read-only role:** if the secret is ever set to the write URL by mistake, the export still cannot change a row.
- **Why the hash is computed in the backend:** `packages/domain` has no `node:crypto` use; the domain builds the canonical string, the backend hashes it.
- **Why `skip_ids` and a bounded scan:** escalated and stale pairs stay pending, so a fixed "oldest 30" would resend the same dead rows daily; the reviewer passes its open escalation ids, and the scan stops at a fixed cap (reported as `scanLimited`).
- **First manual run proves:** that the chosen role can run the evidence path, `similarity()` included. Every table the export reads has row level security, so the role must bypass it: `backup_ro` is expected to work and `readonly_2` is expected to return nothing since migration 0084 (an empty result looks like an empty queue, so compare `totalPending` with the moderator page). Neither is verified.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass at 100% lines, statements, functions and branches.
- `pnpm --filter backend test` -- expected: pass, including the row-count ratchet.
- `pnpm lint && pnpm build` -- expected: clean.

**Manual checks (if no CLI):**
- After merge, the owner creates the `dedup-review` environment (deployment branches limited to `master`) and the secret (a read-only role that bypasses RLS), dispatches the workflow once, and checks the line parses, holds no usernames or captions, returns pairs, and that `similarity()` worked under the chosen role.
