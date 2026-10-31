---
title: 'AI dedup review, piece B1: read-only export of pending suggestions as evidence JSON'
type: 'feature'
created: '2026-10-31'
status: 'in-review'
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
### Review Findings

Code review of Piece B1 (Blind Hunter, Edge Case Hunter, Acceptance Auditor), triaged 2026-10-31: 0 decision-needed, 18 patch, 1 defer, 9 dismissed.

- [x] [Review][Patch] The export paged with `OFFSET` under READ COMMITTED, so a row resolving mid-scan could be skipped or crash it; it now runs `REPEATABLE READ, READ ONLY` [dedup-review-export.ts]
- [x] [Review][Patch] Skipped ids used up the scan cap and `skippedCount` only covered rows reached; ids are now filtered in the query and counted queue-wide [dedup-review-export.ts]
- [x] [Review][Patch] `scanLimited` was true when the queue ended exactly at the cap [dedup-review-export.ts]
- [x] [Review][Patch] `recentlyResolved` was cut at 100 with no sign; it holds 200 and `recentlyResolvedTruncated` says when more existed [dedup-review-evidence.ts, dedup-review-export.ts]
- [x] [Review][Patch] The reviewer lookup was case-sensitive and ignored soft-deleted moderators [dedup-review-export.ts]
- [x] [Review][Patch] A link entry with no usable `url` aborted the whole export [dedup-review-export.ts]
- [x] [Review][Patch] A flag with no value was silently ignored [dedup-review-export.ts CLI]
- [x] [Review][Patch] Exiting right after a large write to a pipe could cut the JSON line short; the CLI now waits for the write [dedup-review-export.ts CLI]
- [x] [Review][Patch] An unexpected error printed its full object into a public log; it now prints only the class and code [dedup-review-export.ts CLI]
- [x] [Review][Patch] A role that cannot bypass row level security made the export read as an empty queue; it is now refused [dedup-review-export.ts]
- [x] [Review][Patch] An AI-proposed account type awaiting approval was exported as a fact [dedup-review-evidence.ts]
- [x] [Review][Patch] The workflow summary read the JSON from a fixed output line [dedup-review-export.yml]
- [x] [Review][Patch] One fixed concurrency group could cancel a caller's tagged run; it is now per `run_tag` [dedup-review-export.yml]
- [x] [Review][Patch] `npx tsx` could download an unpinned package next to the secret; it is `pnpm exec tsx`, and the job only runs from `master` (a convenience, not the security control) [dedup-review-export.yml]
- [x] [Review][Patch] The hash step lived only inside the builder; `hashDedupReviewEvidence` is now exported for the apply side [dedup-review-export.ts]
- [x] [Review][Patch] Tests claimed more than they proved: independent `totalPending`, merged-away stale rows, queue over limit, a wider hash-field test, loose regexes, no-echo of the run tag, the isolation level and the RLS refusal [the three test files]
- [x] [Review][Patch] Docs overclaimed ("no usernames or emails") when event text passes through, listed the signals incompletely, scoped the stale count wrongly, left a sentence in `project-context.md` after the wrong text, called `backup_ro` firm in one place, and omitted the diagram edges, the log retention and the variable-versus-secret caveat [docs, project-context, DESIGN.md, diagrams]
- [x] [Review][Patch] The older read-only commands in doc 7 said a plain read-only role works; they now carry the RLS caveat [7-event-dedup.md]
- [x] [Review][Defer] The workflows run `pnpm install` (lifecycle scripts) and third-party actions pinned by tag before a step that holds a database secret [all workflows under .github/workflows] -- deferred, pre-existing and shared by every workflow here

Dismissed as noise or handled elsewhere (9): the hash sorting arrays and ignoring `undefined` (the arrays are sets and the types forbid `undefined`); an event with no `event_posts` row (AD-30 Rule 2 guards that invariant); `run-name` echoing the raw tag (only someone with write access can set it); the claim that a write-capable URL "changes nothing" being shown by one UPDATE (a read-only transaction refuses every write); a test that the evidence tier equals `decideMatchTier` (it is computed by it); `DEDUP_REVIEW_MODERATOR_EMAIL` as a variable (the owner chose a repo variable; the caveat is documented and a secret is a one-word change); pinning actions by SHA (part of the deferred item); `hashing` split across two files (by design: the domain has no `node:crypto`); the `scanLimited` flag being the only warning (it is now accurate and documented as an alarm with zero pairs).

## Spec Change Log

## Design Notes

- **Why `READ ONLY` as well as a read-only role:** if the secret is ever set to the write URL by mistake, the export still cannot change a row. As built it is `REPEATABLE READ, READ ONLY`, so the paging and every pair come from one snapshot.
- **Added during review, beyond the frozen contract (none removes anything it promises):** the export refuses a role that cannot bypass row level security, so an empty queue is never faked; the report has `recentlyResolvedTruncated`; `skip_ids` is filtered in the query, so `skippedCount` is queue-wide and skipped ids never use up the scan cap; an AI-proposed account type still awaiting approval is `UNCLASSIFIED`; the backend exports `hashDedupReviewEvidence`, which the apply side imports instead of copying; unexpected errors print only a class and code.
- **What the output does pass through:** event text (names, locations, schedule titles, link paths, slugs) and post publish times, as stored. They are public on the event pages. The frozen rule "no usernames, account ids, captions or emails" is about the account rows and captions, which the export never reads.
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

## Suggested Review Order

**The builder (start here)**

- One snapshot, oldest first: skipped ids filtered in the query, stale rows dropped, the limit and cap applied.
  [`dedup-review-export.ts:202`](../../apps/backend/src/lib/events/dedup-review-export.ts#L202)

- `REPEATABLE READ, READ ONLY`: one consistent state, and nothing here can write.
  [`dedup-review-export.ts:61`](../../apps/backend/src/lib/events/dedup-review-export.ts#L61)

- Refuses a role that cannot bypass RLS, so an empty queue is never faked.
  [`dedup-review-export.ts:72`](../../apps/backend/src/lib/events/dedup-review-export.ts#L72)

- Skipped ids leave the query, so they never use up the scan cap and are counted queue-wide.
  [`dedup-review-export.ts:221`](../../apps/backend/src/lib/events/dedup-review-export.ts#L221)

- What is read about each event; no account username, id or caption is selected.
  [`dedup-review-export.ts:103`](../../apps/backend/src/lib/events/dedup-review-export.ts#L103)

- The one hash function the apply side will import.
  [`dedup-review-export.ts:99`](../../apps/backend/src/lib/events/dedup-review-export.ts#L99)

**The contract (pure, in `packages/domain`)**

- Everything a reviewer sees about a pair; the hash is taken over all of it.
  [`dedup-review-evidence.ts:90`](../../packages/domain/src/events/dedup-review-evidence.ts#L90)

- Canonical form: sorted keys and arrays, so assembly order cannot change the hash.
  [`dedup-review-evidence.ts:178`](../../packages/domain/src/events/dedup-review-evidence.ts#L178)

- Input validation that names the field and never echoes the untrusted value.
  [`dedup-review-evidence.ts:197`](../../packages/domain/src/events/dedup-review-evidence.ts#L197)

- Markers around one JSON line, so a name cannot start a log line with `::`.
  [`dedup-review-evidence.ts:235`](../../packages/domain/src/events/dedup-review-evidence.ts#L235)

**The CLI**

- Flags validated, and a flag without a value rejected, before the database client is imported.
  [`dedup-review-export.ts:25`](../../apps/backend/src/dedup-review-export.ts#L25)

- Public log: an unexpected error prints only its class and code.
  [`dedup-review-export.ts:44`](../../apps/backend/src/dedup-review-export.ts#L44)

- One write, awaited, so a large line is not cut short by exiting.
  [`dedup-review-export.ts:66`](../../apps/backend/src/dedup-review-export.ts#L66)

**The workflow**

- What the log shows, and what the owner must set up once.
  [`dedup-review-export.yml:14`](../../.github/workflows/dedup-review-export.yml#L14)

- Master only (a convenience), and one concurrency group per run tag.
  [`dedup-review-export.yml:65`](../../.github/workflows/dedup-review-export.yml#L65)

- Inputs reach the script through env; secret and variable come from the `dedup-review` environment.
  [`dedup-review-export.yml:105`](../../.github/workflows/dedup-review-export.yml#L105)

- Counts only, read from between the markers.
  [`dedup-review-export.yml:123`](../../.github/workflows/dedup-review-export.yml#L123)

**Proof**

- Evidence, hash, stale, skip and limit against a real database.
  [`dedup-review-export.test.ts:142`](../../apps/backend/src/lib/events/dedup-review-export.test.ts#L142)

- No account username, id, caption, link token or email in the output.
  [`dedup-review-export.test.ts:321`](../../apps/backend/src/lib/events/dedup-review-export.test.ts#L321)

- A write inside the export transaction is refused, and the isolation is repeatable read.
  [`dedup-review-export.test.ts:330`](../../apps/backend/src/lib/events/dedup-review-export.test.ts#L330)

- The RLS refusal, with a stub for the role that cannot see rows.
  [`dedup-review-export.test.ts:349`](../../apps/backend/src/lib/events/dedup-review-export.test.ts#L349)

- Every evidence field changes the hash.
  [`dedup-review-evidence.test.ts:128`](../../packages/domain/src/events/dedup-review-evidence.test.ts#L128)

- Failure output never carries the error message.
  [`dedup-review-export.test.ts:32`](../../apps/backend/src/dedup-review-export.test.ts#L32)

**Decisions and docs**

- Runbook, setup steps and how to read the counts.
  [`7-event-dedup.md:147`](../../docs/infrastructure/7-event-dedup.md#L147)

- Which role the secret holds and why it must bypass RLS.
  [`3-database.md:25`](../../docs/infrastructure/3-database.md#L25)

- Credential decisions for B1 and B2, including reusing the migration user for apply.
  [`DESIGN.md:97`](../../_bmad-output/specs/ai-dedup-review/DESIGN.md#L97)

- The one deferred finding, and its backlog row.
  [`deferred-work.md:825`](deferred-work.md#L825) · [`backlog.yaml:2658`](backlog.yaml#L2658)
