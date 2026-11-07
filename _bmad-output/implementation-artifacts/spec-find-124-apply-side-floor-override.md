---
title: 'Apply-side floor override and owner-tunable caps: a decision kind that merges a pair the floor refuses, off until the owner switches it on (FIND-124)'
type: 'feature'
created: '2026-11-07'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A moderator in the attended loop cannot merge a pair the floor refuses (pair #146 was `name-mismatch`): the apply bridge judges every accept by the floor, which was designed for the AI reviewer, while the moderator's own accept in the app has no floor. The caps (10 merges a run, 25 decisions a day) are code constants, so the owner cannot raise them as the queue grows.

**Approach:** Each decision's `action` gains a third value, `accept-override`: it merges through `resolveSuggestedMatch(..., 'ACCEPT', via: 'ai_skill')`, judged on state, evidence hash, invoker, shared event and caps, with **no floor** (tier included, the owner's choice). It ships dark behind the workflow input `allow_floor_override` (shown in the run name) and the owner variable `DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED`. Separately the three caps become owner variables within code-owned ceilings, defaults unchanged. The loop option and the skill's own batch sizes are `FIND-125`.

## Boundaries & Constraints

**Always:**
- A decision without `action` is an accept. An accept-only or reject-only run keeps its inputs, results and title byte for byte. `schemaVersion` stays 1.
- **Override switch.** `accept-override` needs `allow_floor_override=true`. The input and the script flag `--allow-floor-override` exist in the `validate` and the `apply` jobs (so `validate` can judge it); only the variable step is apply-only, and `validate` holds no `vars.`. An `apply` run (dry or live) with the input also needs `DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED` exactly `true` or `1` (same function as the reject switch), checked in a workflow step before Checkout. The domain function `runDedupReviewApply` asserts the switches itself (`allowFloorOverride`, `floorOverrideEnabled`, default false), so no caller can skip them. Order of refusals: kill switch, then input flag, then variable, then caps; each a fixed message of a class `describeFailure` knows, none echoing a value. Independent of the reject switch.
- **The judge** skips the floor only when `action === 'accept-override'` exactly; any other value gets the floor. Verdict order: state, hash, claimed event, per-run cap, day cap; no `already-high` or `low-tier` skip. The parser returns the validated action unchanged. An override counts as a merge in every cap, and has a **fixed per-run sub-cap of 10** (not tunable): an 11th override in a run is `skipped: per-run-cap`.
- Locking: every action but `reject` locks both event rows in id order, then re-judges under the locks. An override claims its events like an accept.
- **Owner-tunable caps.** In `apply` mode the variables `DEDUP_REVIEW_PER_RUN_CAP`, `DEDUP_REVIEW_PER_DAY_CAP` and `DEDUP_REVIEW_PER_DAY_REJECT_CAP` of `dedup-review-live` set the caps. Unset (or the empty string) is the default 10, 25, 10. Otherwise the value must match `^[1-9][0-9]*$` (ASCII, no leading zero, no whitespace) and be at most its ceiling, inclusive: per run `DEDUP_REVIEW_MAX_DECISIONS` (50), per day 200, rejects 25; else the run refuses before any read. No cross-check between the three (the smaller limit wins). A pure `resolveDedupReviewCaps(env)` does it, an exported `capsForRun(mode, env)` applies it (`validate` ignores the variables and judges with the defaults, so it may be looser or stricter than `apply`), and the library asserts the ceilings on any `caps` it receives. The `disabled` report keeps the defaults. A workflow step before Checkout checks the same values, so a bad value is refused early (the approval click is spent either way); the approver cannot see caps in the run name.
- A merge by override is undoable with `undoEventMerge`; the journal reads `performed_via = 'ai_skill'`, nothing marks an override (known gap). `validate` marks an override `eligible`; a dry run rolls back; only a live run reports `merged`; `counts` and `caps` keep their shape.
- **Guard.** `scripts/dedup-review-apply-guard.sh` takes a fifth argument `allow_floor_override` (`validate` passes `false` where it does not hold the input; the workflow passes the input). A result with `action == "accept-override"` while it is not `true` fails the run. Allowed actions: `accept`, `reject`, `accept-override`; `merged` needs `accept` or `accept-override`; `rejected` needs `reject`. The job summary gains `of which overrides: N`, computed from the results.
- **The `inputs` job** allows: `accept` always; `reject` only with `allow_rejects`; `accept-override` only with `allow_floor_override`; an unknown action keeps today's behaviour (needs `allow_rejects`, then the script refuses it). Both jq checks fail closed on an error.
- Written only through `resolveSuggestedMatch`; nothing private enters a report or summary.
- `SKILL.md` gains one sentence: the skill never sets `allow_floor_override` (no step uses it yet), pinned by a test; the reader keeps refusing a report with `accept-override`.

**Ask First:** a change to the floor, to a default, ceiling or the override sub-cap, to the invoker check or `schemaVersion`; a database migration (a journal marker needs a new `resolution_source` value).

**Never:** any other change to `SKILL.md`, the popup or `dedup_report.py` (`FIND-125`); a floor-less path reached by any other action or flag; a write outside the shared function; a change to the export; SQL in a `.ts` string; `override=true` in `SKILL.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Override, switched on | pending, hash matches, input and variable on, floor refuses | `validate`, dry run `eligible`; live `merged`, `action: accept-override`, resolver the invoker | N/A |
| Any tier | `high` or `low` pair | no tier skip | N/A |
| Accept as before | no `action` or `accept` | floor applies as today | N/A |
| Input off | `accept-override`, no `allow_floor_override` | `inputs` job, script and library refuse | fixed message |
| Variable off | `apply` with the input, variable not `true`/`1` | stops before any read | fixed message; `validate` still says `eligible` |
| Override alone, rejects off | override file, only `allow_floor_override` | passes the `inputs` job | N/A |
| Reject alone, override off | reject file, only `allow_rejects` | passes; an override in it is refused | N/A |
| Stale or gone | hash differs; not pending; events merged or deleted | `skipped`: `stale-evidence`, `not-pending`, `stale-pair`, `unknown-suggestion` | N/A |
| Shared event | an earlier eligible merge claims an event | `skipped: event-already-in-run` | N/A |
| Sub-cap | an 11th override in a run | `skipped: per-run-cap` | N/A |
| Caps tuned | `apply` with per run 20, day 100 | 20 merges allowed; report `caps` shows 20 and 100; `validate` judges with 10 and 25 | N/A |
| Bad cap value | `0`, `010`, `+5`, `1e3`, ` 12`, `5\n`, a fullwidth digit, above ceiling, 25 digits | `apply` refuses before any read; unset and empty are defaults; the ceiling itself is accepted | names the variable, not the value |
| Mixed file | accepts, rejects, overrides | each judged by its rule; merges share caps | N/A |
| Race or failure | row changes before the lock; the merge fails | `skipped: concurrent-change`; `merge-failed` | no retry |
| Bad `action` | `Accept-Override`, `override`, `accept-override ` | input error, nothing runs | names the field |
| Dry run, validate | `live` false | nothing persists | N/A |
| Guard: no input | a result with the override action, input not `true` | run fails | fixed message |
| Guard: bad outcome | `merged` with another action, `rejected` without `reject` | run fails | fixed message |
| Reader | a report holding `accept-override`, `merged` and `skipped` | exit 7 | fixed message |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` (+ test, 100% branches) -- `DedupReviewAction`, parser, judge, options, `resolveDedupReviewCaps`, ceilings, override sub-cap, comments saying "accepts" now say "merges"
- `apps/backend/src/lib/events/dedup-review-apply.ts` (+ DB test) -- `decideUnderLocks` (`!== 'reject'` locks), `processDecisions`, `DedupReviewApplyInput` fields, the library's own asserts; `apps/backend/src/dedup-review-apply.ts` (+ test: `capsForRun`, flags, `describeFailure`), `dedup-review-errors.ts`
- `scripts/dedup-review-apply-guard.sh`, `.github/workflows/dedup-review-apply.yml`, `apps/backend/src/dedup-review-workflow.test.ts` (input count 7, run-name equality, jq strings, setup-step regex naming the new variables, guard tail with its fifth argument and the `run()` helper)
- `.claude/skills/moderator-dedup-review/SKILL.md` (one sentence), `test_dedup_report.py` (`SkillTextTests.render` and the adjacency test for the new run-name expression, a pin that `override=true` and `allow_floor_override` never appear in any step, the reader refuses a `merged` and a `skipped` override result)
- Text to amend: AD-45 (Prevents, Rules 3, 4, 6, 7, 9, worst cases), AD-30 Rule 7, PRD 3.7, `project-context.md:84`, `DESIGN.md`, `7-event-dedup.md` (switches, caps, setup step 5 naming all four variables, runbook: turn the variables on only for an attended session, read an override run's log by hand until `FIND-125`), `event-dedup-flow.html`, workflow header; `architecture-diagram.md` needs no change (no service added, CLAUDE.md section 4)

## Tasks & Acceptance

**Execution:**
- [ ] domain + test -- the action, parser (returns the validated value; a test asserts `accept-override`), judge (floor skipped on exact equality, sub-cap, caps from `DedupReviewCaps`), `allowFloorOverride` option and asserts, the shared enabled-function for both switches, `resolveDedupReviewCaps` and its ceilings; every branch and the cap cases of the matrix
- [ ] backend lib + DB tests -- locks for every action but `reject` (a recording-executor unit test counts the row locks per action), override as a merge, the library's switch and ceiling asserts, `DedupReviewApplyInput` fields (existing DB tests pass both flags where they use overrides); tests: each floor code, `high` and `low`, stale, shared event, sub-cap, shared caps, dry run, race, mixed file, caps below the defaults
- [ ] backend CLI + errors + tests -- `--allow-floor-override`, `capsForRun`, refusal order, new fixed-message classes in `describeFailure` (tests like the existing one), `validate` with a bad cap variable does not refuse
- [ ] guard, workflow + workflow test -- input in both jobs, run-name fragment `${{ inputs.allow_floor_override && 'override=true ' || '' }}` after the rejects one and before `tag=`, the `inputs` rule above (tests retained for `reject`, `Reject`, `delete`; new rows for the matrix), variable and caps step before Checkout, cap and variable env in the apply script step only, guard fifth argument and summary line, setup steps and descriptions, every existing assertion listed in the Code Map updated
- [ ] `SKILL.md` sentence + `test_dedup_report.py` -- as in the Code Map
- [ ] docs and board -- the amendments, dated, with the worst cases restated; `FIND-124` done

**Acceptance Criteria:**
- Given the override switched on and a pending pair the floor refuses, when a live apply runs its override with the right hash, then it is `merged` with `resolved_via = ai_skill` and an undoable journal row; a wrong hash is `skipped: stale-evidence`.
- Given the input off, the variable off, or the guard's argument off, when an override is dispatched, then the `inputs` job, the script, the library or the guard each refuse it.
- Given override alone, or reject alone, when the `inputs` job runs, then each passes without the other's input.
- Given cap variables within their ceilings, when a live apply runs, then it uses and reports them; given an invalid value, then `apply` refuses before any read, the workflow before Checkout; given none, the caps are 10, 25 and 10.
- Given more than 10 overrides in a run, when it runs, then the 11th is `skipped: per-run-cap`.
- Given `validate`, a dry run, or an old reader, when each sees an override, then nothing persists, nothing persists, and the reader refuses the report.

## Design Notes

The moderator's own accept in the app has no floor, so this path is no more than a moderator can do by hand; it is the same merge through the AI-assisted entry, recorded under the invoker. The floor existed to bound a mistaken or manipulated AI reviewer, and it also carried `undone-before`, the veto of a moderator who undid that pair: an override drops it, which the owner accepted ("everything"). The skill's "attended" rule is prose, so the real bounds are the pending state, the hash, the caps, the owner's variable and the owner's approval of each run (the approver sees ids and flags, not caps), the last two as strong as AD-45 Rule 6's limit. Worst case with the override on: 10 floor-less merges a run and at most the day cap, each undoable; with it off, none. The runbook says to turn the override and any raised caps on only while an attended session runs: with the variable on, a prompt-injected unattended session that dispatched `allow_floor_override` would be stopped only by the owner's click, so the skill gets its default-deny sentence now.

Tunable caps let the owner raise merges and rejects within ceilings the code owns (a typo like 250 for 25 is refused). They help owner-run and hand-dispatched applies today; the skill's own batch sizes (`CONFIRM_MAX`, the loop's 10 pairs, the export `limit`) and `validate`'s defaults stay until `FIND-125`, so the daily review does not scale by this change alone. The reject ceiling is 25, above today's 10, so AD-45's worst case ("ten pairs a day") is restated.

Lands dark: until `FIND-125` the skill cannot dispatch an override run through its steps, and the reader refuses its report; a live override run commits its merges and the reader exits 7, so the owner reads the log by hand (runbook).

Known gaps: the database cannot tell an override from another AI merge (an enum migration, deferred with `FIND-114`'s run id); the resolver is the moderator the invoker hash names (attribution, not authentication).

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% thresholds met
- `pnpm --filter @festgrid/domain build` -- expected: pass (the backend imports the built `dist`)
- `cd apps/backend && NODE_ENV=test npx tsx --test src/dedup-review-apply.test.ts src/dedup-review-workflow.test.ts` -- expected: pass (bash and jq, no database)
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-apply.test.ts src/lib/events/suggested-match-resolve-ratchet.test.ts` -- expected: pass (needs a migrated Postgres, `DATABASE_URL` and `BACKEND_PORT`; not runnable in the cloud sandbox, so CI is its gate)
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
