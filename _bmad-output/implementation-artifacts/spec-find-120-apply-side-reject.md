---
title: 'Apply-side reject path: a decision kind that records a moderator''s reject, off until the owner switches it on (FIND-120)'
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

**Approach:** The apply side accepts a reject decision: each decision gains an optional `action` (`accept` by default, or `reject`). A reject is judged on state, evidence hash, invoker and caps, with no floor, and recorded by `resolveSuggestedMatch(..., 'REJECT', via: 'ai_skill')`. It ships dark: it needs the workflow input `allow_rejects` (visible in the run name) and an owner variable, and the skill's loop and rule 7 stay unchanged until `FIND-121`.

## Boundaries & Constraints

**Always:**
- A decision without `action` is an accept: inputs and results of an accept-only run keep their meaning, and an accept-only run's title stays exactly as it is. `schemaVersion` stays 1: writer, guard, reader and workflow ship together.
- **Rejects are off by default.** Any reject needs `allow_rejects=true` (workflow input; the script refuses a reject without `--allow-rejects`, and the `inputs` job refuses one without the input). A live reject also needs the `dedup-review-live` variable `DEDUP_REVIEW_REJECT_ENABLED` to be exactly `true` or `1`: unset, empty or anything else refuses the whole run before it reads. Only the owner sets it.
- A reject runs the state checks (`unknown-suggestion`, `not-pending`, `stale-pair`), the `evidenceHash` comparison, the invoker check, the suggestion row lock with a second judgement under it, and the run-wide advisory lock. It locks no event row and claims none, but it is skipped as `event-already-in-run` when an earlier accept in the file claimed one of its events, so `validate` predicts live.
- No floor, except `already-high`: a pair the drain would merge is never rejected (skipped `already-high`).
- Caps: a reject counts in the 25-per-day cap shared with merges, and in its own cap of 10 per 24 hours (`status = 'rejected' and resolved_via = 'ai_skill'`), both reported as `per-day-cap`. Merges keep their per-run cap of 10. This spec is the owner's approval of the new cap and switch.
- `validate` marks a reject `eligible`; a dry run rolls it back; only a live run reports `rejected`. Every result carries its `action`; `counts` gains `rejected` and `caps` gains `perDayRejects`.
- A reject is written only through `resolveSuggestedMatch`. Nothing private enters a report or summary.
- Recovery equals a moderator's reject today: only the owner reopens a pair, by the SQL written in the runbook (resetting `status`, `resolved_at`, `resolved_by_moderator_id`, `resolved_via`, guarded by `status = 'rejected' and resolved_via = 'ai_skill'`). A lost report is checked by listing those suggestions, as `event_merges` is for merges.

**Ask First:** a change to the floor, the existing cap values, the invoker check or `schemaVersion`.

**Never:** a change to `SKILL.md` rules, step 8 or any popup (`FIND-121`; the reader's report check, `apply` and `decisions` flags change only to read and build the new shapes); a reject without the hash, state and invoker checks; a write outside the shared function; a change to the export; the SQL in any `.ts` string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Accept as before | decision without `action`, or `accept` | judged and merged as today; result `action: accept` | N/A |
| Reject, switched on | pending, hash matches, `allow_rejects`, variable on | `validate` and dry run `eligible`; live `rejected`, `resolved_via = ai_skill`, resolver the invoker | N/A |
| Reject, switched off | no `allow_rejects`, or variable not `true`/`1` | the run stops, nothing is read | fixed message |
| Floor-refused pair | `low`, `venue-conflict` and the like | still eligible to reject | N/A |
| Already high | tier `high` | `skipped: already-high` | N/A |
| Stale or gone | hash differs; not pending; event deleted | `skipped`: `stale-evidence`, `not-pending`, `stale-pair`, `unknown-suggestion` | N/A |
| Shared event | accept earlier in the file claims an event of the pair | reject `skipped: event-already-in-run`; a reject then an accept on a shared event is allowed | N/A |
| Caps | an 11th reject in 24 h; shared total 25 | `skipped: per-day-cap` | N/A |
| Race or failure | row changes before the lock; the write fails | `skipped: concurrent-change`; `merge-failed` (the name is reused) | no retry |
| Bad `action` | `delete`, a number, `null` | input error, nothing runs | names the field |
| Dry run, validate | `live` false | nothing persists; no `rejected` outcome | N/A |
| Guard and reader | `rejected` outside a live run; counts or `action` that differ | run fails; no report is trusted | fixed message |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` -- parser, `judgeDedupReviewDecision`, `DedupReviewRunState`, `DedupReviewCaps`, result and report types; test file next to it (100% branches)
- `apps/backend/src/lib/events/dedup-review-apply.ts` -- `processDecisions`, `mergeUnderLocks` (generalised), a reject count query; `apps/backend/src/dedup-review-apply.ts` (CLI flag, kill-switch report literal, lost-report error and hint); `dedup-review-errors.ts`; tests next to each
- `scripts/dedup-review-apply-guard.sh`, `.github/workflows/dedup-review-apply.yml` (input, `run-name`, `inputs` job, variable step, descriptions), `apps/backend/src/dedup-review-workflow.test.ts`, `suggested-match-resolve-ratchet.test.ts`
- `.claude/skills/moderator-dedup-review/dedup_report.py` (`validate_apply`, `cmd_apply`, `cmd_decisions`), its test, and the command table of `SKILL.md`
- Text to amend: AD-45 (Prevents, Rules 1 to 6, 9; an amendment, not a new AD), AD-30 Rule 7, PRD 3.7, `project-context.md:84`, `DESIGN.md` 2, 3, 5.1, `7-event-dedup.md`, `event-dedup-flow.html`, `architecture-diagram.md`, header comments

## Tasks & Acceptance

**Execution:**
- [ ] domain `dedup-review-apply.ts` + test -- optional `action` (always normalised), reject verdict order (state, hash, `already-high`, claimed events read-only, caps), `rejectsInRun`, `usedRejectsLast24h`, `perDayRejects`, result `action`, `rejected`, counts; every parse branch
- [ ] backend apply + DB tests -- reject under a suggestion-row lock, re-judged through `lookupFreshPair`, via `resolveSuggestedMatch`; the 24-hour reject count; validate, dry run, live, floor-refused, `already-high`, stale, caps, shared event, race; CLI flag, switch, disabled report, lost-report hint for rejects
- [ ] guard, workflow + workflow test -- `allow_rejects`, `run-name` suffix only when true, `inputs` job check, variable step, counts and outcomes with `rejected`, summary line, hints
- [ ] `dedup_report.py` + test + `SKILL.md` table -- `validate_apply` (action per result, `rejected` only live, counts, caps), `apply --expect-rejects`, `decisions --reject IDS` (accepts omit `action`)
- [ ] docs and board -- the amendments above with dated notes, the runbook (list query, owner SQL, switch), known gaps, `FIND-120` done

**Acceptance Criteria:**
- Given rejects switched on and a pending floor-refused pair, when a live apply runs its reject with the right hash, then it is `rejected` with `resolved_via = ai_skill`; a wrong hash is `skipped: stale-evidence` and leaves it pending.
- Given rejects not switched on, when a decision carries `reject`, then the run stops before reading, in validate and apply alike.
- Given mixed accepts and rejects, when it runs, then merges and rejects are capped apart and the shared day cap counts both.
- Given a `high` pair, when its reject is judged, then it is `skipped: already-high`.
- Given a dry run or `validate`, when it ends, then nothing changed and no `rejected` outcome exists.
- Given a report with `rejected` outside a live run, or counts that differ from the results, when the guard or the reader sees it, then each refuses it.

## Design Notes

The hash and state checks keep a reject on current evidence; they do not stop a malicious decision, since anyone who can read the export can compute a hash. The real bounds are the pending state, the caps, the owner's variable and the owner's approval of each run (itself only as strong as Rule 6's limit). The worst case with the switch on is ten pairs a day hidden from the moderators and reopened only by the owner's SQL; with it off, none.

The capability lands first and dark so there is no window in which the skill's prose rule is the only thing between a session and a reject. The owner turns the variable on together with `FIND-121`.

Known gaps: a reject a person chooses in the loop reads as `reviewer` in the export and earns no outcome label (`FIND-121`); the resolver is the moderator the invoker hash names, which is attribution, not authentication; `reasons` are dropped and the run id is not stored (`FIND-114`).

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% thresholds met
- `pnpm --filter @festgrid/domain build` -- expected: pass (the backend imports the built `dist`)
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-apply.test.ts src/dedup-review-apply.test.ts src/dedup-review-workflow.test.ts src/lib/events/suggested-match-resolve-ratchet.test.ts` -- expected: all pass (needs a migrated database, `DATABASE_URL` and `BACKEND_PORT`)
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
