---
title: 'AI dedup review piece B2a: record whether a dedup was resolved manually or by the skill'
type: 'feature'
created: '2026-10-31'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '20ad4fab81f7afb3cba331819084fde5bf312dbc'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing records whether a suggested event match was resolved by a moderator in the UI or by the AI reviewer (skill), so the daily cap, the export's `recentlyResolved` and any audit cannot tell them apart. The export also needs an email repository variable only to guess this.

**Approach:** Add a `resolved_via` column on `event_match_candidates` and a `performed_via` column on `event_merges` (`moderator` | `ai_skill`). The shared `resolveSuggestedMatch`/`mergeEvents` take an optional `via` (default `moderator`); only a future apply script passes `ai_skill`. The export reads the flag and drops the email variable.

## Boundaries & Constraints

**Always:** Additive migration, backfilling every already accepted or rejected suggestion as `moderator`. `event_merges.performed_via` is NOT NULL default `moderator`; `event_match_candidates.resolved_via` is NULL while pending or expired. Undoing a merge returns `resolved_via` to NULL with the status. The export's output contract (`schemaVersion` 1, `resolvedBy` values) does not change.

**Ask First:** A third enum value (for example `system` for `drain`/`scan-stub-repeats`); exposing the flag in GraphQL or the moderator UI.

**Never:** Let a GraphQL client set `via`; touch the apply side (B2b, `FIND-108`); change who may write `event_match_candidates` (the source-scan ratchet stays as is); add a service or table.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| UI accept or reject | `resolveSuggestedMatch` without `via` | row and journal say `moderator` | N/A |
| Skill accept | `via: 'ai_skill'` | suggestion `resolved_via` and `event_merges.performed_via` are `ai_skill` | N/A |
| Skill reject | `via: 'ai_skill'`, REJECT | suggestion `resolved_via` is `ai_skill` | N/A |
| Undo | undo a merge made with `ai_skill` | suggestion back to `pending`, `resolved_via` NULL | N/A |
| Export, legacy or expired | accepted with NULL flag; expired | `unknown`; `system` | N/A |
| Export, flagged | `moderator` / `ai_skill` | `human` / `reviewer` | N/A |

</frozen-after-approval>

## Code Map

- `packages/database/schema.ts` -- enum, two columns
- `packages/database/migrations/` + `meta/_journal.json` -- 0087; journal `when` must exceed 0086's
- `apps/backend/src/lib/events/merge-events.ts` -- writes both columns; undo clears
- `apps/backend/src/lib/events/resolve-suggested-match.ts` -- passes `via`; REJECT writes it
- `apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts` -- add check that `resolvers.ts` never passes `via`
- `packages/domain/src/events/dedup-review-evidence.ts` (+ test) -- `classifyDedupReviewResolvedBy` reads the flag
- `apps/backend/src/lib/events/dedup-review-export.ts`, `src/dedup-review-export.ts`, `dedup-review-errors.ts` (+ tests) -- drop reviewer email lookup
- `.github/workflows/dedup-review-export.yml` -- drop the variable and its setup text
- docs: `docs/infrastructure/7-event-dedup.md`, `_bmad-output/specs/ai-dedup-review/DESIGN.md`, `_bmad-output/project-context.md`, `backlog.yaml`, `deferred-work.md`

## Tasks & Acceptance

**Execution:**
- [x] `packages/database/schema.ts` and migration 0087 -- enum `resolution_source`, columns, backfill UPDATE -- generate with drizzle-kit, then add the backfill by hand
- [x] `merge-events.ts`, `resolve-suggested-match.ts` -- optional `via` (default `moderator`), written to both rows; undo clears -- one shared path stays the only writer
- [x] Ratchet test -- the resolver wrapper source has no `via` -- keeps the flag server-only
- [x] Domain classifier, export builder, CLI, workflow, errors file -- read the flag, delete the email lookup, `DedupReviewReviewerError` and `DEDUP_REVIEW_MODERATOR_EMAIL` -- tests updated, 100% domain coverage
- [x] Tests (resolve, merges, undo, export) -- every Matrix row, clean up created rows (row-count ratchet)
- [x] Docs and backlog -- identity decision (hashed Claude account email, B2b), flag, `FIND-108` note, `FIND-104` renamed `moderator-dedup-review`, repo variable can be deleted

**Acceptance Criteria:**
- Given the moderator UI mutation, when a suggestion is accepted or rejected, then both rows say `moderator`.
- Given an existing database, when 0087 runs, then every accepted or rejected suggestion says `moderator` and pending and expired ones are NULL.
- Given `DEDUP_REVIEW_MODERATOR_EMAIL` is unset or absent from the workflow, when the export runs, then it still labels `recentlyResolved` correctly.

## Spec Change Log

## Design Notes

Two values only: `drain` and `scan-stub-repeats` are operator-run scripts, so they count as `moderator`. The flag is written by the shared function, never taken from a client.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% coverage
- `pnpm --filter backend test` -- expected: pass (row-count ratchet clean)
- `pnpm --filter backend build && pnpm lint` -- expected: no errors
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exits clean
