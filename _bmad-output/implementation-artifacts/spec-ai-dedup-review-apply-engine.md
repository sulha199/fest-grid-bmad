---
title: 'AI dedup review piece B2b-1: decision validator, floor, caps and the apply script'
type: 'feature'
created: '2026-10-31'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'd0517f4daeaa03791d9958b2b2d9e4c57e7d3059'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The export lets a reviewer see pending dedup suggestions, but nothing can act on its decisions safely: no check that the pair is unchanged since it was reviewed, no floor that bounds a mistaken or prompt-injected decision, no caps, and no attribution of the merge to the invoking moderator.

**Approach:** A pure judge in `packages/domain` gives each decision a verdict from freshly recomputed evidence. An apply script in `apps/backend` locks and re-checks each pair, then merges it through `resolveSuggestedMatch(..., via: 'ai_skill')`. Dark: no workflow, secret or variable exists yet (B2b-2), so nothing can run it in production.

## Boundaries & Constraints

**Always:**
- **Decisions file:** `{"schemaVersion":1,"decisions":[{suggestionId, evidenceHash, reasons[]}]}`, at most 65,535 bytes before parsing, hand-validated, no extra keys, lower-cased uuids, no duplicates, hash is 64 lowercase hex, at most 50 decisions (empty is a no-op), at most 5 reasons of at most 200 characters. `reasons` is validated and then discarded: never stored, printed or put in an error. Any parse or validation failure prints a fixed message.
- **Order:** file order; one verdict sequence per decision: unknown or no-longer-pending or stale pair → `evidenceHash` differs → floor → event already claimed → per-run cap → per-day cap. Only an eligible decision claims its two events and consumes a cap; a skipped one does neither. Per-day remaining is the cap minus the 24 h count minus merges already made in this run.
- **Floor** (all must hold, values from domain constants): tier is `mid`; `undoneMergeCount` is 0; anchor is `organizerMatch`, or `sharedLink` together with `venueMatch` (never `sameAccount`, which ignores the stub and curator discount); no venue conflict; the day gap (null counts as outside) is at most 90 when a link is shared, otherwise 0 (`MID_PROMOTION_MAX_DAY_DIFF`); every schedule of the new event has a candidate schedule inside that window; the names do not contradict (differing numbers or bracket qualifiers). Gaps of 1 to 2 days stay with a moderator.
- **Live run:** `READ COMMITTED` like the moderator path; one `pg_advisory_xact_lock` first, then the 24 h count; per decision a savepoint that locks the suggestion row, then both event rows in id order, rebuilds the pair, re-checks hash and floor under those locks, then calls `resolveSuggestedMatch`. Any error in a decision becomes a fixed code and later decisions continue. Output is printed only after commit. `validate`: one `REPEATABLE READ, READ ONLY` snapshot, `eligible` is a pre-merge verdict (no row lock is possible there). `apply` rolls back structurally unless `--live`; `--live` with `validate` is refused.
- **Caps:** per run 10, per 24 h 25 (injectable), counted with the database clock from `event_merges.performed_via = 'ai_skill'` (including undone) plus `event_match_candidates` rows rejected with `resolved_via = 'ai_skill'`.
- **Invoker:** the hash arrives in `DEDUP_REVIEW_INVOKER_HASH`, never as an argument. SQL counts all users where `encode(sha256(convert_to(lower(btrim(email)),'UTF8')),'hex')` equals it; exactly one, with `role = 'moderator'` and `deleted_at IS NULL`, or one identical refusal for zero, two or a non-moderator. The hash and address are never printed.
- **Kill switch:** `DEDUP_REVIEW_APPLY_DISABLED` equal to `1` or `true` is on; it is checked first, before the file is read or the database client is imported, and exits 0 with `killSwitch: true`.
- **Output:** one JSON line between `DEDUP_REVIEW_APPLY_BEGIN` and `DEDUP_REVIEW_APPLY_END`: ids, outcomes, fixed reason codes, `mergeId` only on a committed live merge, never event text.

**Ask First:** The floor's strictness (window 0 or 90 days, `organizerMatch` or link plus venue); the per-day cap; whether `validate` or a dry run is the skill's shadow mode (this spec: `validate`).

**Never:** A workflow, secret, repository variable, AD or PRD edit (B2b-2); the skill (piece C); rejecting; `mergeEvents` or a direct `event_match_candidates` update from apply code; printing the hash, an email, `reasons` or a database error's text; importing `db` inside the library (it takes an executor).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Live, passes | fresh hash, floor ok, caps free | `merged` with `mergeId`; rows say `ai_skill` and the invoker | N/A |
| Dry run, validate | same | `eligible`, nothing persists, no `mergeId` | N/A |
| Gone or changed | unknown id, not pending, stale event, hash differs | `unknown-suggestion`, `not-pending`, `stale-pair`, `stale-evidence` | N/A |
| Floor miss | `already-high`, `low-tier`, `undone-before`, `no-anchor`, `venue-conflict`, `outside-window`, `schedule-uncovered`, `name-mismatch` | skipped with that code | N/A |
| Shared event / caps | event claimed earlier; 11th eligible; day total reached | `event-already-in-run`, `per-run-cap`, `per-day-cap` | N/A |
| Concurrent change, merge error | lock then recheck differs; `mergeEvents` throws | `concurrent-change`, `merge-failed`; earlier merges stand | savepoint rolled back |
| Kill switch | variable on | `killSwitch: true`, nothing read or written | exit 0 |
| Invoker | zero, two or non-moderator match | refused, one message | exit 1 |
| Bad input | extra key, duplicate id, over size, `--live` with `validate` | refused before any connection | exit 1, fixed message |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` (+ test, `index.ts`) -- parsers, `judgeDedupReviewDecision`, formats; 100% coverage, no Node modules
- `packages/domain/src/events/match-scoring.ts` -- export `namesContradict` (the contradiction half of `areNamesAutoLinkable`); move `DATE_WINDOW_DAYS` and the 90-day window here, re-export from the backend
- `apps/backend/src/lib/events/dedup-review-apply.ts` (+ test) -- invoker match, 24 h count, run orchestration
- `apps/backend/src/lib/events/dedup-review-export.ts` -- extract `buildDedupReviewPair` (returns pair, both event ids, `venueConflict`); a write-capable transaction wrapper that also sets `search_path TO public, extensions`
- `apps/backend/src/dedup-review-apply.ts` (+ test) -- CLI, dynamic import after the kill switch, fixed hints
- `suggested-match-resolve-ratchet.test.ts` -- apply files call `resolveSuggestedMatch(`, never `mergeEvents` or a raw update
- docs: `7-event-dedup.md`, `project-context.md`, `DESIGN.md`, `planning-artifacts/diagrams/event-dedup-flow.html`

## Tasks & Acceptance

**Execution:**
- [x] Domain module, `namesContradict`, constants -- one table-driven test per rule and per precedence step
- [x] Export refactor (`buildDedupReviewPair`, wrapper, `assertRoleBypassesRls` first) -- existing export tests stay green
- [x] Backend lib and CLI -- the modes above; hints for 25006, 42501, 40001
- [x] Tests on a real database: live merge, rollback, validate read-only (`SHOW transaction_read_only`), stale after an edit, each floor code, caps with injected values, invoker (including two users differing only by case), one lock test on a second connection; clean up merges, aliases, copied schedules and users (row-count ratchet)
- [x] Ratchet, docs, backlog -- PRD and AD amendment explicitly deferred to B2b-2: nothing can run this in production until then

**Acceptance Criteria:**
- Given a stale hash or a pair changed after the snapshot, when apply runs live, then nothing merges and the code is reported.
- Given `validate` or a dry run, when it finishes, then no row changed and no `mergeId` is printed.
- Given a live merge, when it commits, then `resolved_via` and `performed_via` are `ai_skill` under the invoker's id.
- Given a pair with a shared link only, a curator account, a venue conflict or one unmatched new schedule, when judged, then it is skipped.
- Given the kill switch, two matching moderators, or an 11th decision, when apply runs, then the Matrix outcome occurs.
- Given the apply code, when the ratchet runs, then it fails on a direct write or a `mergeEvents` call.

## Spec Change Log

- 2026-10-31, architecture and code review before implementation: floor tightened (tier `mid`, organizer or link plus venue, window 0 or 90, schedule coverage, venue conflict, name contradiction) because the 0.3 name check equals the ingestion admission floor and `sameAccount` ignores the curator discount; live isolation changed from `REPEATABLE READ` to `READ COMMITTED` with row locks and a per-decision savepoint; invoker hash moved from argument to environment; precedence, reason codes and kill-switch semantics pinned. KEEP: ACCEPT-only, `validate` as shadow mode, no workflow in this piece.

## Design Notes

The judge is called once per decision with a small state (claimed events, run count, 24 h count), so caps and the floor stay pure. The backend calls it twice per decision: once on the snapshot to plan, once under the row locks to decide. Known gap, left for B2b-2 and a backlog row: `undoEventMerge` does not refuse when a later merge touched the winner.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% coverage
- `pnpm --filter backend test` -- expected: new tests pass; sandbox-only failures as before
- `pnpm lint && pnpm build` -- expected: no errors
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exits as on `master` (72)
