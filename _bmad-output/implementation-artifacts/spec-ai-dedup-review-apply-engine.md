---
title: 'AI dedup review piece B2b-1: decision validator, floor, caps and the apply script'
type: 'feature'
created: '2026-10-31'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The export lets a reviewer see pending dedup suggestions, but nothing can act on its decisions safely: no check that the pair is unchanged since it was reviewed, no floor that stops a manipulated or mistaken decision, no caps, and no way to attribute the merge to the invoking moderator.

**Approach:** A pure validator in `packages/domain` turns decisions plus freshly recomputed evidence into an eligible or skipped verdict per suggestion. An apply script in `apps/backend` runs it in one transaction and merges each eligible pair through `resolveSuggestedMatch(..., via: 'ai_skill')`. Dark: no workflow yet (B2b-2).

## Boundaries & Constraints

**Always:** ACCEPT only; escalations never reach apply. Decisions are `{suggestionId, evidenceHash, reasons[]}`, hand-validated (no extra keys, uuid ids, no duplicates, hash is 64 lowercase hex, at most 50 decisions, at most 5 reasons of at most 200 characters). The pair is recomputed with the export's own builder and hashed with `hashDedupReviewEvidence`; a missing, no longer pending or changed pair is skipped. The floor reads its thresholds from domain constants and is evaluated in this order: not already `high` tier (the drain owns it), `undoneMergeCount` is 0, an anchor (same account, shared link or venue match), `minDayDiff` within the window, and name similarity at or above a minimum unless a link is shared. Two decisions touching one event: the first wins. Caps: per run 10; per 24 hours counted from `event_merges.performed_via = 'ai_skill'` rows including undone ones plus `ai_skill` rejections on `event_match_candidates`. Kill switch (environment variable) makes the script exit without opening the database. Invoker: SHA-256 hex of the lowercased, trimmed Claude account email, matched in SQL to `lower(btrim(users.email))`, exactly one active moderator or refuse; the hash and address are never printed. Modes: `validate` runs every check in a `READ ONLY` transaction and merges nothing; `apply` is a dry run (rolled back) unless `--live` is passed. Output is one JSON line between `DEDUP_REVIEW_APPLY_BEGIN` and `DEDUP_REVIEW_APPLY_END` holding ids, outcomes and fixed reason codes, never event text. A live run uses `REPEATABLE READ`; a concurrent change makes that decision skip.

**Ask First:** The floor's values: window 90 days (the shared-link window), minimum name similarity 0.3, per-day cap 25. Counting `organizerMatch` as an anchor.

**Never:** A workflow, secret, repository variable, AD or PRD edit (B2b-2); the skill (piece C); rejecting; calling `mergeEvents` or updating `event_match_candidates` from the apply code; printing the invoker hash, an email or a database error's text.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path, live | fresh hash, floor passes, caps free | merged, `mergeId`, rows say `ai_skill` and the invoker's id | N/A |
| Dry run or validate | same | outcome `eligible`, nothing persists, no `mergeId` | N/A |
| Changed pair | hash differs, or not pending | skipped `stale-evidence` / `not-pending` | N/A |
| Floor miss | no anchor, outside window, high tier, undone before, low name similarity | skipped with that reason | N/A |
| Caps | 11th decision; per-day total reached | skipped `per-run-cap` / `per-day-cap` | N/A |
| Same event twice | two decisions share an event | second skipped `event-already-in-run` | N/A |
| Kill switch on | variable set | `killSwitch: true`, nothing read or written | exit 0 |
| Invoker | zero or two matching moderators, or a non-moderator | refused | exit 1, fixed message |
| Bad decisions | extra key, duplicate id, over limits | refused before any connection | exit 1, fixed message |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` (+ test, `index.ts` export) -- decisions parser, options parser, floor, planner, output format; 100% coverage
- `apps/backend/src/lib/events/dedup-review-apply.ts` (+ test) -- invoker match, 24 h count, fresh pairs, run orchestration
- `apps/backend/src/dedup-review-apply.ts` (+ test) -- CLI: `--mode`, `--live`, `--invoker-hash`, `--run-tag`, `--decisions-file`; kill switch; safe failures
- `apps/backend/src/lib/events/dedup-review-export.ts` -- `onlySuggestionIds` stops being test-only
- `apps/backend/src/lib/events/match-event-to-existing.ts` -- export `SHARED_LINK_DATE_WINDOW_DAYS`
- `suggested-match-resolve-ratchet.test.ts` -- the apply code calls `resolveSuggestedMatch(`, never `mergeEvents` or a raw update
- docs: `7-event-dedup.md`, `project-context.md`, `DESIGN.md`, `FIND-108`

## Tasks & Acceptance

**Execution:**
- [ ] Domain module and tests -- pure validator, floor, planner, formats -- thresholds injected, so the backend passes the real constants
- [ ] Backend lib and CLI -- the run, in the transaction modes above -- same save path as the moderator UI
- [ ] Export builder and window constant -- small exports the apply reuses
- [ ] Ratchet extension and tests for every Matrix row (live, rolled back, validate, caps, invoker, stale) -- clean up rows
- [ ] Docs and backlog -- dark status, `FIND-108` done

**Acceptance Criteria:**
- Given a decision with a stale hash, when apply runs live, then nothing merges.
- Given `validate`, when it runs, then no row changes and the transaction is read only.
- Given the live path, when a pair merges, then `resolved_via` and `performed_via` are `ai_skill`.
- Given the apply code, when the ratchet runs, then it fails on a direct write or a `mergeEvents` call.

## Spec Change Log

## Design Notes

The planner takes the fresh pairs and the day count as arguments, so it stays pure and the caps and floor are testable without a database. Outside the 90-day window the pair is skipped even for a shared link.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% coverage
- `pnpm --filter backend test` -- expected: new tests pass; sandbox-only failures as before
- `pnpm lint && pnpm build` -- expected: no errors
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exits as on `master` (72)
