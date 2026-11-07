---
title: 'Apply-side floor override: a decision kind that merges a pair the floor refuses, off until the owner switches it on (FIND-124)'
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

**Problem:** A moderator in the attended loop cannot merge a pair the floor refuses (pair #146 was `name-mismatch`): the apply bridge judges every accept by the floor, which was designed for the AI reviewer, while the moderator's own accept in the app has no floor. The moderator must leave the loop for Moderator Items.

**Approach:** Each decision's `action` gains a third value, `accept-override`. It merges through `resolveSuggestedMatch(..., 'ACCEPT', via: 'ai_skill')` like an accept, judged on state, evidence hash, invoker and caps, with **no floor at all** (tier included, the owner's choice). It ships dark: it needs the workflow input `allow_floor_override` (visible in the run name) and, in `apply`, the owner's variable `DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED` of `dedup-review-live`. The loop option is `FIND-125`.

## Boundaries & Constraints

**Always:**
- A decision without `action` is an accept and an accept-only or reject-only run keeps its inputs, results and title byte for byte. `schemaVersion` stays 1.
- **Off by default, own switch.** A decision with `action: accept-override` needs `allow_floor_override=true`: the `inputs` job and the script refuse it without. An `apply` run (dry or live) that carries `allow_floor_override=true` also needs the variable to be exactly `true` or `1` (no trimming, no case folding, unset is off), checked before any code is fetched or any read, with a fixed message that is not the `disabled` report. `validate` cannot see the variable: `eligible` is not consent. Independent of the reject switch: either may be on alone.
- The verdict order for an override: state (`unknown-suggestion`, `not-pending`, `stale-pair`), `evidenceHash`, a claimed event (`event-already-in-run`), the per-run cap, the day cap. No floor check and no `already-high` or `low-tier` skip. Caps are the existing ones, shared with ordinary merges: an override uses the per-run 10 and the shared 25 in 24 hours like any merge; no new number.
- An override is decided like an accept: suggestion row and both event rows locked in id order, judged again under the locks, then merged. It claims its events like an accept.
- The merge is undoable through `undoEventMerge`, and the journal row reads `performed_via = 'ai_skill'` like every AI merge; nothing marks it as an override in the database (known gap).
- `validate` marks an override `eligible`; a dry run rolls back; only a live run reports `merged`. A result's `action` carries `accept-override`; `counts` and `caps` keep their shape (an override counts as `merged`).
- Written only through `resolveSuggestedMatch`; nothing private enters a report or summary.

**Ask First:** a change to the floor, to a cap value, to the invoker check or `schemaVersion`; a database migration (a marker in the journal needs a new `resolution_source` value).

**Never:** any change to `SKILL.md`, the popup or `dedup_report.py` (`FIND-125`; the reader must keep refusing a report with the new action, which is fail closed); a floor-less path reached by any other action or flag; a write outside the shared function; a change to the export; SQL in a `.ts` string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Override, switched on | pending, hash matches, `allow_floor_override`, variable on, floor refuses (any code) | `validate` and dry run `eligible`; live `merged`, `action: accept-override`, `resolved_via = ai_skill`, resolver the invoker | N/A |
| Any tier | `high` or `low` pair | judged like `mid`: no tier skip | N/A |
| Accept as before | no `action` or `accept` | floor applies as today | N/A |
| Input off | no `allow_floor_override` | `inputs` job and script refuse; nothing runs | fixed message |
| Variable off | `apply` with the input, variable not `true`/`1` | run stops before any read | fixed message; `validate` still says `eligible` |
| Stale or gone | hash differs; not pending; event deleted | `skipped`: `stale-evidence`, `not-pending`, `stale-pair`, `unknown-suggestion` | N/A |
| Shared event | an earlier eligible accept or override claims an event | `skipped: event-already-in-run`; a reject then an override on a shared event is allowed | N/A |
| Caps | an 11th merge in a run; shared total 25 | `skipped`: `per-run-cap`, `per-day-cap` | N/A |
| Mixed file | accepts, rejects and overrides | each judged by its own rule; caps shared as above | N/A |
| Race or failure | row changes before the lock; the merge fails | `skipped: concurrent-change`; `merge-failed` | no retry |
| Bad `action` | `Accept-Override`, `override`, `accept-override ` | input error, nothing runs | names the field |
| Dry run, validate | `live` false | nothing persists | N/A |
| Guard and reader | `merged` with an action other than `accept` or `accept-override`; override in a run without the input | run fails; the reader refuses a report holding `accept-override` | fixed message |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` -- `DedupReviewAction`, parser, `judgeDedupReviewDecision`, options, switch helper; test file next to it (100% branches)
- `apps/backend/src/lib/events/dedup-review-apply.ts` -- `decideUnderLocks` (locks for an override like an accept), `processDecisions`, input type; `apps/backend/src/dedup-review-apply.ts` (CLI flag and variable read); `dedup-review-errors.ts`; tests next to each
- `scripts/dedup-review-apply-guard.sh`, `.github/workflows/dedup-review-apply.yml` (input, `run-name`, `inputs` job, variable step, setup, descriptions), `apps/backend/src/dedup-review-workflow.test.ts`
- `.claude/skills/moderator-dedup-review/test_dedup_report.py` -- one test only: the reader refuses a report whose result has `action: accept-override`
- Text to amend: AD-45 (Prevents, Rules 3, 4, 6, 7, 9), AD-30 Rule 7, PRD 3.7, `project-context.md:84`, `DESIGN.md`, `7-event-dedup.md` (switch, setup step, runbook, known gaps), `event-dedup-flow.html`, workflow header comment

## Tasks & Acceptance

**Execution:**
- [ ] domain `dedup-review-apply.ts` + test -- `DedupReviewAction` gains `accept-override`; parser takes exactly `accept`, `reject` or `accept-override`; `allowFloorOverride` option and `assertDedupReviewFloorOverrideAllowed`; `isDedupReviewFloorOverrideEnabled` (exactly `true` or `1`); judge: an override skips `checkDedupReviewFloor` and follows the accept order otherwise. Every branch covered, fixtures updated
- [ ] backend apply + DB tests -- `decideUnderLocks` locks events for an `accept` and an `accept-override`; `processDecisions` treats an override as a merge (claims events, counts `eligibleInRun`, outcome `merged`); tests: floor-refused pair merged live, each floor code, `high` and `low`, hash, stale, shared event, caps shared with accepts, dry run and `validate` persist nothing, race, mixed file
- [ ] backend CLI + errors + tests -- `--allow-floor-override` and the variable read in `apply` mode only, refusing before the database client is imported with a fixed `FLOOR_OVERRIDE_DISABLED_MESSAGE`; the lost-report error needs no change (overrides are merges)
- [ ] guard, workflow + workflow test -- input `allow_floor_override`; `run-name` places ` override=true ` after any `rejects=true ` and before `tag=` only when true; the `inputs` job refuses an `accept-override` without the input (and still a `reject` without `allow_rejects`, any other action always); variable step before Checkout; script flag in the apply job only; guard accepts `accept-override` with outcome `merged` only; `validate` holds no `vars.`; setup steps and descriptions
- [ ] `test_dedup_report.py` -- the reader refuses a report with `accept-override` (exit 7)
- [ ] docs and board -- the amendments above with dated notes, runbook switch, setup step and known gaps (override indistinguishable from other AI merges, tier included); `FIND-124` done

**Acceptance Criteria:**
- Given the override switched on and a pending pair the floor refuses, when a live apply runs its override with the right hash, then it is `merged` with `resolved_via = ai_skill` and an undoable journal row; a wrong hash is `skipped: stale-evidence`.
- Given `allow_floor_override` off, when a decision carries `accept-override`, then the `inputs` job and the script refuse it; given the variable not `true` or `1`, when `apply` runs with the input (dry or live), then it stops before any read.
- Given a file of accepts, rejects and overrides, when it runs, then each uses its own rule and the per-run and day caps are shared by every merge.
- Given a `high` or `low` pair, when its override is judged, then it is not skipped for its tier.
- Given a dry run or `validate`, when it ends, then nothing changed.
- Given an override run's report, when the old reader checks it, then it refuses it.

## Design Notes

The moderator's own accept in the app has no floor, so this path is not more than a moderator can do by hand: it is the same merge through the AI-assisted entry, recorded under the invoker. The floor existed to bound a mistaken or manipulated AI reviewer. With an override, that bound is gone for the pairs a session chooses to override, and the "attended" rule of the skill is prose: the real bounds are the pending state, the evidence hash, the shared caps (10 a run, 25 a day), the owner's variable and the owner's approval of each run, the last two as strong as AD-45 Rule 6's limit. Worst case with the switch on: ten wrong merges in a run, 25 in a day, each undoable with `undoEventMerge`; with it off, none beyond today's.

Lands first and dark, so there is no window in which the skill's prose is the only thing between a session and a floor-less merge: until `FIND-125` the skill cannot dispatch an override run (its title differs) and the reader refuses its report.

Known gaps: a database row cannot tell an override from another AI merge (a marker needs an enum migration, deferred with `FIND-114`'s run id); the resolver is the moderator the invoker hash names, which is attribution, not authentication.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% thresholds met
- `pnpm --filter @festgrid/domain build` -- expected: pass (the backend imports the built `dist`)
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-apply.test.ts src/dedup-review-apply.test.ts src/dedup-review-workflow.test.ts src/lib/events/suggested-match-resolve-ratchet.test.ts` -- expected: all pass (needs a migrated database, `DATABASE_URL` and `BACKEND_PORT`)
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
