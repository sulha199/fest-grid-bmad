---
title: 'Apply-side reject path: a decision kind that records a moderator''s reject (FIND-120)'
type: 'feature'
created: '2026-11-06'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The apply bridge can only merge. A moderator who finds an escalated pair is not the same event can only reject it one by one in the app, and a real loop run found all ten escalated pairs refused by the floor, so a session could offer nothing.

**Approach:** The apply side accepts a reject decision. Each decision gains an optional `action` (`accept` by default, or `reject`). A reject is judged on the pair's state, the evidence hash, the invoker and the caps, with no floor, and is recorded by `resolveSuggestedMatch(..., 'REJECT', via: 'ai_skill')` under the invoker. Report, guard script, workflow text, the reader's report check, AD-45 and the runbook follow. The skill's loop and its rule 7 are unchanged (`FIND-121`).

## Boundaries & Constraints

**Always:**
- A decision without `action` is an accept: inputs and results of an accept-only run keep their meaning. `schemaVersion` stays 1 because writer, guard and reader ship together.
- A reject runs the same state checks (`unknown-suggestion`, `not-pending`, `stale-pair`), the `evidenceHash` comparison, the invoker check, the suggestion row lock (again after the lock) and the run-wide advisory lock. It applies no floor and claims no event.
- Caps: a reject counts in the 25-per-day cap shared with merges (`countAiActionsLast24h` already counts AI rejections) and has its own per-run cap of 10, apart from the 10 merges.
- `validate` marks a reject `eligible`; a dry run rolls it back; only a live run reports `rejected`. Every result carries its `action`, and `counts` gains `rejected`.
- Reject is written only through `resolveSuggestedMatch`. Nothing private enters the report or the summary: ids, outcomes and fixed reason codes only.
- Recovery equals a moderator's reject today: the pair is listed by `status = 'rejected' and resolved_via = 'ai_skill'` and only the owner reopens one by SQL, both written in the runbook.

**Ask First:** a change to the floor, the cap values, the invoker check or `schemaVersion`.

**Never:** a skill, popup or `SKILL.md` change; a reject without the hash, state and invoker checks; any write outside the shared function; a change to the export.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Accept as before | decision without `action` | judged and merged as today; result `action: accept` | N/A |
| Reject eligible | pending, hash matches, caps free | `validate` and dry run `eligible`; live `rejected`, status `rejected`, `resolved_via = ai_skill`, resolver the invoker | N/A |
| Floor-refused pair | `low`, `venue-conflict` and the like | still eligible to reject | N/A |
| Stale or gone | hash differs; not pending; deleted event | `skipped`: `stale-evidence`, `not-pending`, `stale-pair`, `unknown-suggestion` | N/A |
| Caps | an 11th reject; day total 25 | `skipped`: `per-run-cap`, `per-day-cap` | N/A |
| Mixed run | accepts and rejects | a reject claims no event, an accept still does | N/A |
| Race | row changes before the lock | `skipped: concurrent-change` | no retry |
| Bad `action` | `delete`, a number, `null` | input error, nothing runs | message names the field |
| Dry run | `live` false | nothing persists | N/A |
| Guard | `rejected` in a run that is not live, or counts that differ | run fails with a fixed message | no report is trusted |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` -- `parseDedupReviewDecisions`, `judgeDedupReviewDecision`, state, caps, result and report types; test file next to it (100% coverage)
- `apps/backend/src/lib/events/dedup-review-apply.ts` -- `processDecisions`, `mergeUnderLocks`; `dedup-review-apply.test.ts` runs against a real database
- `scripts/dedup-review-apply-guard.sh`, `.github/workflows/dedup-review-apply.yml` (decisions text, header), `apps/backend/src/dedup-review-workflow.test.ts`
- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `validate_apply`, `cmd_decisions`; test file next to it
- AD-45 Rules 3, 4, 9 in `festgrid-architecture-spine.md`, `7-event-dedup.md`, `DESIGN.md`

## Tasks & Acceptance

**Execution:**
- [ ] domain `dedup-review-apply.ts` + test -- optional `action` in the parser, reject verdict and its own cap, `rejectsInRun`, result `action`, `outcome: 'rejected'`, `counts.rejected`, `caps.perRunRejects`
- [ ] backend `dedup-review-apply.ts` + DB tests -- reject under locks through `resolveSuggestedMatch`; validate, dry run, live, floor-refused, stale, caps, mixed, race; a source-scan test still holds
- [ ] guard script, workflow text + workflow test -- counts and outcomes with `rejected`, only live, the summary line
- [ ] `dedup_report.py` + test -- `validate_apply` accepts the new report (action per result, `rejected` only live, counts), `apply --expect-rejects`, `decisions --reject IDS`
- [ ] docs and board -- AD-45 Rules 3, 4, 9, runbook (recovery query and SQL), `DESIGN.md`, `FIND-120` done

**Acceptance Criteria:**
- Given a pending pair the floor refuses, when a live apply runs its reject with the right hash, then it ends `rejected` with `resolved_via = ai_skill`, and a wrong hash is `skipped: stale-evidence` and leaves it pending.
- Given a run of mixed accepts and rejects, when it runs live, then merges and rejects are capped apart and the day cap counts both.
- Given a dry run, when it ends, then no suggestion changed.
- Given a decision with a bad `action`, when the file is parsed, then it is refused without echoing the value.
- Given a report with a `rejected` result in a run that is not live, when the guard or the reader sees it, then each refuses it.

## Design Notes

The floor limits what may be merged; a reject merges nothing, so the hash and state checks are what keep a reject on the evidence the moderator saw. The skill's own rule stays "the daily review never rejects": the capability lands first, and `FIND-121` decides who may use it.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, thresholds met
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-apply.test.ts src/dedup-review-workflow.test.ts` -- expected: all pass
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
