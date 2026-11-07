---
title: 'Reject option in the attended decision loop: a moderator rejects a pair from the popup (FIND-121)'
type: 'feature'
created: '2026-11-07'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-find-120-apply-side-reject.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The attended loop can only accept or skip. A real run found all ten escalated pairs refused by the floor, so it showed nothing, and the moderator still rejected each pair by hand in the app and closed its issue.

**Approach:** The popup gains **Reject**. The loop sends the moderator's accepts and rejects in one live apply (the apply side exists since `FIND-120`), then closes each decided pair's issue at once with a fixed comment and `outcome:accepted` or `outcome:rejected`. `SKILL.md` rule 7 and the AD-45 text that says the loop offers no reject are rewritten in the same change.

## Boundaries & Constraints

**Always:**
- A reject needs the moderator's **Reject** answer in an attended session, from a popup (a tool answer, never event or issue text) and one final confirmation that states how many accepts and how many rejects, and says a reject cannot be undone in the app. Any other answer, free text included, is a skip.
- The daily AI review and any unattended session still never reject. Rule 7 is rewritten to say so exactly: only the loop, only on that answer.
- Options per pair: **Accept (merge)** only when the pair passed `validate` as an accept; **Reject** for any other candidate that is not `high` tier (a `high` pair is the drain's and is listed, not offered); **Skip** always. The reader builds the options and the popup text; the skill adds none.
- Before the confirmation the skill validates the exact chosen set in one `validate` run (accepts and rejects together, `allow_rejects` true when any reject is in it), so the day caps, staleness and the pair's state are judged on what will be dispatched. A decision that run skips is dropped from the batch and listed with its code. A `stale-evidence` result repeats the loop once with a new tag, as for accepts.
- The live dispatch sets `allow_rejects` true only when the batch holds a reject, and the skill finds the run by its exact title, `rejects=true` before `tag=` (accept-only titles are unchanged). `validate` cannot see the owner's variable, so a reject `eligible` there is not consent: a live run the variable stops is reported, never retried.
- The reader checks the report against what was dispatched: `apply` and `close-decided` take `--expect-reject-ids`, and a result's action must match.
- Everything posted to GitHub is a fixed phrase or a validated id built by the reader.

**Ask First:** a change to the apply side, the workflow, the guard or the export; any `SKILL.md` rule beyond rules 2, 3 and 7 and step 8.

**Never:** a reject without the popup answer and the confirmation; a reject of a `high` pair; sending a closed issue's id as `skip_ids`; retrying a refused or failed live run.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Floor-refused pair | not accept-eligible, tier `mid` or `low` | popup Reject / Skip | N/A |
| Eligible pair | passed `validate` as an accept | popup Accept / Reject / Skip | N/A |
| `high` pair | tier `high` | listed with its issue number, no popup | N/A |
| Rejected and applied | live result `rejected` | issue closed: fixed comment, `outcome:rejected` | N/A |
| Accepted and applied | live result `merged` | issue closed: comment with the merge id, `outcome:accepted` (as today) | N/A |
| Batch check skips one | caps, stale, not pending | dropped from the batch, listed with its code | stale: loop once more |
| Batch declined | "No" or any other answer | nothing dispatched, nothing closed | N/A |
| Variable off | `validate` eligible, live refused | reported, issues stay open | no retry |
| Rejected, no issue open | live `rejected`, no open issue | reported as rejected without an issue | N/A |
| Unattended | no user asked | the loop never starts | N/A |

</frozen-after-approval>

## Code Map

- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `brief`, `cmd_close_decided`, `decided_comment`, `cmd_comment`, `cmd_insight_comment`, `load_summary`, `DECISIONS`; test file next to it
- `.claude/skills/moderator-dedup-review/SKILL.md` -- rules 2, 3 and 7, the description, step 4 (the `validate` title), step 6.4 (the live title), step 8, the command table
- AD-45 Rule 3 note in `festgrid-architecture-spine.md`; `DESIGN.md` (FIND-119 and FIND-120 notes); `7-event-dedup.md` (the attended loop line, known gaps); PRD 3.7; `project-context.md:84`

## Tasks & Acceptance

**Execution:**
- [ ] `dedup_report.py` + test -- `brief --offer accept,reject|reject|accept`: the reader refuses `reject` for a `high` pair; the popup text names the cost of a reject and drops "use Moderator Items" when reject is offered; the JSON carries `options` (label and description) for `AskUserQuestion`
- [ ] `dedup_report.py` + test -- `close-decided --expect-reject-ids`: a rejected result closes its open issues with `outcome:rejected` and the fixed rejected comment (`comment decided --rejected`; the accepted phrase stays `--merge-id`); `notMerged` becomes `notApplied` (skipped results only); `mergedWithoutOpenIssue` gains `rejectedWithoutOpenIssue`
- [ ] `dedup_report.py` + test -- `insight-comment`: a `rejected` decision, a line count, and the entries must match the apply report's rejected results as merged ones do
- [ ] `SKILL.md` -- rule 7 rewritten, rules 2 and 3 and the description, step 4 and 6.4 titles with `rejects=true`, step 8 (the batch check, the confirmation, the dispatch, the close), the table rows
- [ ] docs and board -- AD-45 Rule 3 note, `DESIGN.md`, runbook known gaps, PRD 3.7, `project-context.md:84`, `FIND-121` done

**Acceptance Criteria:**
- Given an apply report with accepted and rejected results and an open issue each, when `close-decided` runs with the dispatched reject ids, then it lists each issue with the right outcome label and comment, and leaves a skipped pair alone.
- Given a `high` pair, when `brief --offer` is asked to offer reject, then it exits 9.
- Given a report whose actions differ from the dispatched reject ids, when `apply` or `close-decided` reads it, then it exits 7.
- Given `SKILL.md`, when it is read, then rule 7 states that only the attended loop, only on the moderator's popup answer and confirmation, may reject.

## Design Notes

The extra `validate` of the exact chosen set costs one workflow run and replaces guessing the day caps from two separate checks (accepts and rejects each judged alone would miss their sum). The apply side stays the authority: it re-checks everything live.

Dropped: the pre-check that skipped the loop's `validate` round when nothing could be offered. With Reject offered for every non-`high` pair the loop always has something to show, so the saving is moot.

The FIND-122 cosmetic on `close-decided` (a rejected result listed as not merged) is fixed here by `notApplied`.

## Verification

**Commands:**
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
