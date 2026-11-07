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

**Approach:** The apply side accepts a reject decision: each decision gains an optional `action` (exactly `accept`, the default, or `reject`). A reject is judged on state, evidence hash, invoker and caps, with no floor, and recorded by `resolveSuggestedMatch(..., 'REJECT', via: 'ai_skill')`. It ships dark: it needs the workflow input `allow_rejects` (visible in the run name) and, to run in `apply`, an owner variable. The skill's loop and rule 7 stay unchanged until `FIND-121`.

## Boundaries & Constraints

**Always:**
- A decision without `action` is an accept: inputs and results of an accept-only run keep their meaning, and an accept-only run's title stays exactly as it is. `schemaVersion` stays 1: writer, guard, reader and workflow ship together.
- **Rejects are off by default.** Any run holding a reject needs `allow_rejects=true`: the `inputs` job refuses a decision whose `action` is anything but exactly `accept` without it, and the script refuses a reject without `--allow-rejects`. An `apply` run, dry or live, that carries `allow_rejects=true` also needs the `dedup-review-live` variable `DEDUP_REVIEW_REJECT_ENABLED` to be exactly `true` or `1`: unset, empty or anything else refuses the whole run before any read, with a fixed message and exit that is not the `disabled` report. `validate` runs in another environment, cannot see the variable and checks only `allow_rejects`: its `eligible` is not consent, and apply may still refuse. Only the owner sets the variable, and no repository or organization variable of that name may exist.
- A reject runs the state checks (`unknown-suggestion`, `not-pending`, `stale-pair`), the `evidenceHash` comparison, the invoker check, the suggestion row lock with a second judgement under it, and the run-wide advisory lock. It locks no event row and claims none, but `validate` skips it as `event-already-in-run` when an earlier accept in the file claimed one of its events (a live run judges it `stale-pair` or `stale-evidence` after that merge).
- No floor, except `already-high`: a pair the drain would merge is never rejected (skipped `already-high`).
- Caps: the per-run cap of 10 counts merges only and never applies to a reject. The shared day cap of 25 counts `used + merges in run + rejects in run`. A reject also has its own cap of 10 per 24 hours (`status = 'rejected' and resolved_via = 'ai_skill'`). Both day checks report `per-day-cap`. This spec is the owner's approval of the new cap and the switch.
- `validate` marks a reject `eligible`; a dry run rolls it back; only a live run reports `rejected`. Every result carries its `action`; `counts` gains `rejected` and `caps` gains `perDayRejects`.
- A reject is written only through `resolveSuggestedMatch`. Nothing private enters a report or summary.
- Recovery equals a moderator's reject today: only the owner reopens a pair, by the SQL written in the runbook (resetting `status`, `resolved_at`, `resolved_by_moderator_id`, `resolved_via`, guarded by `status = 'rejected' and resolved_via = 'ai_skill'`). A lost report is checked by listing those suggestions, as `event_merges` is for merges.

**Ask First:** a change to the floor, the existing cap values, the invoker check or `schemaVersion`; any `SKILL.md` change beyond the command-table rows for `apply` and `decisions`.

**Never:** a change to `SKILL.md` rules, step 8 or any popup (`FIND-121`; the reader's report check, `apply` and `decisions` flags change only to read and build the new shapes); a reject without the hash, state and invoker checks; a write outside the shared function; a change to the export; the SQL in any `.ts` string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Accept as before | decision without `action`, or `accept` | judged and merged as today; result `action: accept` | N/A |
| Reject, switched on | pending, hash matches, `allow_rejects`, variable on | `validate` and dry run `eligible`; live `rejected`, `resolved_via = ai_skill`, resolver the invoker | N/A |
| Reject, input off | no `allow_rejects` | `inputs` job and script refuse; nothing runs | fixed message |
| Reject, variable off | `apply` (dry or live) with `allow_rejects`, variable not `true`/`1` | the run stops before any read, no report | fixed message; `validate` still says `eligible`, which is not consent |
| Floor-refused pair | `low`, `venue-conflict` and the like | still eligible to reject | N/A |
| Already high | tier `high` | `skipped: already-high` | N/A |
| Stale or gone | hash differs; not pending; event deleted | `skipped`: `stale-evidence`, `not-pending`, `stale-pair`, `unknown-suggestion` | N/A |
| Shared event | accept earlier in the file claims an event of the pair | `validate`: reject `skipped: event-already-in-run`; live: `stale-pair` or `stale-evidence`; a reject then an accept on a shared event is allowed | N/A |
| Caps | an 11th reject in 24 h; shared total 25; both at once | `skipped: per-day-cap`, each cap binding alone and together | N/A |
| Race or failure | row changes before the lock; the write fails | `skipped: concurrent-change`; `merge-failed` (the name is reused) | no retry |
| Bad `action` | `delete`, `""`, `Reject`, `reject `, a number, `null` | input error, nothing runs (no case folding or trimming) | names the field |
| Dry run, validate | `live` false | nothing persists; no `rejected` outcome | N/A |
| Guard and reader | `rejected` outside a live run; `counts.rejected` not the number of `rejected` results; `merged` without `accept` or `rejected` without `reject` | run fails; no report is trusted; the old `disabled` report still passes | fixed message |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-apply.ts` -- parser, `judgeDedupReviewDecision`, `DedupReviewRunState`, `DedupReviewCaps`, result and report types; test file next to it (100% branches)
- `apps/backend/src/lib/events/dedup-review-apply.ts` -- `processDecisions`, `mergeUnderLocks` (generalised), a reject count query; `apps/backend/src/dedup-review-apply.ts` (CLI flag, kill-switch report literal, lost-report error and hint); `dedup-review-errors.ts`; tests next to each
- `scripts/dedup-review-apply-guard.sh`, `.github/workflows/dedup-review-apply.yml` (input, `run-name`, `inputs` job, variable step, setup steps 3 and 5, descriptions), `apps/backend/src/dedup-review-workflow.test.ts`; `suggested-match-resolve-ratchet.test.ts` needs no change and must still pass
- `.claude/skills/moderator-dedup-review/dedup_report.py` (`validate_apply`, `cmd_apply`, `cmd_decisions`), its test, and the command table of `SKILL.md`
- Text to amend: AD-45 (Prevents, Rules 1 to 7, 9; an amendment, not a new AD), AD-30 Rule 7, PRD 3.7, `project-context.md:84`, `DESIGN.md` 2, 3, 5.1, `7-event-dedup.md`, `event-dedup-flow.html`, `architecture-diagram.md`, header comments

## Tasks & Acceptance

**Execution:**
- [ ] domain `dedup-review-apply.ts` + test -- parser: required keys plus an optional `action` of exactly `accept` or `reject`, output always normalised, `DedupReviewDecision.action` required; `DedupReviewRunState` gains `rejectsInRun`, `usedRejectsLast24h`; `DedupReviewCaps.perDayRejects` (constant `DEDUP_REVIEW_PER_DAY_REJECT_CAP` = 10); `DedupReviewApplyOptions.allowRejects`; result `action` and `outcome: 'rejected'`; `counts.rejected`. Reject verdict order: state, hash, `already-high`, claimed events (read-only), reject cap (`usedRejects + rejectsInRun >= perDayRejects`), shared day cap (`used + eligibleInRun + rejectsInRun >= perDay`); `eligibleInRun` counts merges only. Update every fixture; every branch covered
- [ ] backend apply + DB tests -- `mergeUnderLocks` generalised: a reject locks the suggestion row only, re-judges through `lookupFreshPair`, then `resolveSuggestedMatch(..., 'REJECT')`; `countAiRejectsLast24h` added beside `countAiActionsLast24h` (unchanged); validate, dry run (nothing persists), live, floor-refused, `already-high`, stale, shared event (validate and live differ), each cap alone and together, race
- [ ] backend CLI + errors + tests -- `--allow-rejects` and the variable read in `apply` mode only; fixed refusal that is not the `disabled` report; kill-switch literal gains `counts.rejected: 0` and `caps.perDayRejects`; `DedupReviewReportLostError(merged, rejected = 0)` thrown when either is above 0, its message also naming the rejected-suggestions listing (no SQL in a `.ts` string)
- [ ] guard, workflow + workflow test -- input `allow_rejects` and `run-name` with ` rejects=true` placed before `tag=` only when true (accept-only titles byte-identical); `inputs` job env `ALLOW_REJECTS` and a jq check tolerant of non-object entries; the variable step before Checkout and the script flag in the apply job only; setup steps 3 and 5 name the variable; guard checks `counts.rejected`, `rejected` only live, `caps.perDayRejects`, hints; the test harness exports `ALLOW_REJECTS` and pins that `validate` holds no `vars.`
- [ ] `dedup_report.py` + test + `SKILL.md` command table -- `validate_apply`: `action` required on every result, `merged` needs `accept`, `rejected` needs `reject` and mode live, counts and caps; `apply --expect-reject-ids IDS` (a result's `action` must be `reject` exactly for those ids); `decisions LOG [IDS...] --reject IDS` (positional ids are accepts, rejects are additional, no overlap, at least one id, 50 in all, accepts omit `action`)
- [ ] docs and board -- the amendments with dated notes (AD-45 Prevents, Rules 1 to 7 and 9, AD-30 Rule 7, PRD 3.7, `project-context.md:84`, `DESIGN.md`, `7-event-dedup.md` with the list query, owner SQL, switch and known gaps, `event-dedup-flow.html`, `architecture-diagram.md`, header comments), `FIND-120` done

**Acceptance Criteria:**
- Given rejects switched on and a pending floor-refused pair, when a live apply runs its reject with the right hash, then it is `rejected` with `resolved_via = ai_skill`; a wrong hash is `skipped: stale-evidence` and leaves it pending.
- Given `allow_rejects` off, when a decision carries `reject`, then the `inputs` job and the script refuse it; given the variable not `true` or `1`, when `apply` runs a reject (dry or live), then it stops before any read; `validate` still judges it.
- Given mixed accepts and rejects, when it runs, then merges and rejects are capped apart and the shared day cap counts both.
- Given a `high` pair, when its reject is judged, then it is `skipped: already-high`.
- Given a dry run or `validate`, when it ends, then nothing changed and no `rejected` outcome exists.
- Given a report with `rejected` outside a live run, or counts that differ from the results, when the guard or the reader sees it, then each refuses it.

## Design Notes

The hash and state checks keep a reject on current evidence; they do not stop a malicious decision, since anyone who can read the export can compute a hash. The real bounds are the pending state, the caps, the owner's variable and the owner's approval of each run; the last two are as strong as Rule 6's limit (a token that can dispatch, or an admin token that can edit the variable, defeats them) and the approval click is spent when the variable check refuses. The worst case with the switch on is ten pairs a day hidden from the moderators and reopened only by the owner's SQL; with it off, none.

The capability lands first and dark so there is no window in which the skill's prose rule is the only thing between a session and a reject. The owner turns the variable on together with `FIND-121`. Until then the skill cannot dispatch a reject run (its title differs), and an old reader refuses a `rejected` outcome: both fail closed.

Known gaps: a reject a person chooses in the loop reads as `reviewer` in the export and earns no outcome label (`FIND-121`); the resolver is the moderator the invoker hash names, which is attribution, not authentication; `reasons` are dropped and the run id is not stored (`FIND-114`).

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% thresholds met
- `pnpm --filter @festgrid/domain build` -- expected: pass (the backend imports the built `dist`)
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-apply.test.ts src/dedup-review-apply.test.ts src/dedup-review-workflow.test.ts src/lib/events/suggested-match-resolve-ratchet.test.ts` -- expected: all pass (needs a migrated database, `DATABASE_URL` and `BACKEND_PORT`)
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
