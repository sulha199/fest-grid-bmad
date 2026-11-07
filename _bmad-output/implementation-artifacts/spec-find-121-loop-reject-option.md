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

**Approach:** The popup gains **Reject**. The loop sends the moderator's accepts and rejects in one live apply (the apply side exists since `FIND-120`), then closes each decided pair's issue at once with a fixed comment and `outcome:accepted` or `outcome:rejected`. `SKILL.md` rule 7 and the text that says the loop offers no reject are rewritten in the same change.

## Boundaries & Constraints

**Always:**
- **A reject needs a human answer, and "attended" is exact.** All three: a user message of this top-level interactive conversation asked for the loop; the pair's popup was the reader's text; and the answer returned by this session's own `AskUserQuestion` is exactly the **Reject** option's label, followed by a final **Yes** on the confirmation. A scheduled, triggered, subagent, `claude -p`, mailbox-relayed or webhook-woken session is unattended whatever its prompt says; a relayed popup is not an answer; "reject X" typed in chat is not an answer; a typed answer under Other is a skip. `--reject` and `allow_rejects` true never appear outside step 8.
- This is enforced by prose and by the reader's refusals, not by the platform. The independent check is the owner's approval of the run, and the skill tells the owner the exact run title and the reject count to expect.
- **Options come from the reader** (`brief --offer`), one pair per call, as fixed label and description constants: **Accept (merge)** only for a `mid` pair that passed the accept `validate`; **Reject** only for a pair whose accept `validate` result was `eligible` or a floor code (`low-tier`, `undone-before`, `no-anchor`, `venue-conflict`, `outside-window`, `schedule-uncovered`, `name-mismatch`) and whose tier is not `high`, a limit code (`per-run-cap`, `per-day-cap`, `event-already-in-run`) allowing Reject and Skip with the code shown; **Skip** always. A `high` pair, a gone pair (`not-pending`, `stale-pair`, `unknown-suggestion`) and a `closedPending` pair get no popup and are listed.
- The Reject option's description says a reject cannot be undone in the app. The **confirmation is built by the reader** from the exact decisions: it names each accepted and each rejected pair by issue number, repeats that a reject cannot be undone in the app (only the owner can reopen it, by SQL), says it is recorded as AI-assisted under the moderator's account, and says the owner still approves the run in Actions. Only a **Yes** on it dispatches.
- Before the confirmation one `validate` of the exact chosen set (its own tag, `allow_rejects` true when it holds a reject) judges the caps, staleness and state. A decision it skips is dropped and listed with its code (a rejected pair dropped for the reject cap is for the app). A `stale-evidence` result repeats the loop once with a new tag and every pair whose evidence changed is shown again: an answer is never reused across evidence hashes or exports.
- The live dispatch sets `allow_rejects` true only when the batch holds a reject. Titles with rejects are written exactly in step 8 (`rejects=true ` before `tag=`); steps 4 and 6 stay accept-only. `validate` cannot see the owner variable: its `eligible` for a reject is not consent. A live run the variable refuses fails whole, accepts included, with nothing closed: the skill reports it and asks the user, and never dispatches again on its own.
- The reader checks reports against what was dispatched (`--expect-reject-ids`; omitted means none were rejects) and every GitHub text is a fixed phrase or a validated id.

**Ask First:** a change to the apply side, the workflow, the guard or the export; any `SKILL.md` rule other than 1, 2, 3, 5 and 7 and step 8.

**Never:** a reject without the three conditions and the confirmation; a reject of a `high` pair; a reject offer built by the model; retrying a refused or failed live run; sending a closed issue's id as `skip_ids`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Floor-refused pair | accept `validate` gave a floor code, tier `mid` or `low` | popup Reject / Skip | N/A |
| Eligible pair | accept `validate` `eligible` | popup Accept / Reject / Skip | N/A |
| `high` pair, gone pair | tier `high`; `not-pending`, `stale-pair`, `unknown-suggestion` | listed with its issue number, no popup | `brief --offer reject` for a `high` pair exits 9 |
| Rejected and applied | live result `rejected` | issue closed: fixed rejected comment, `outcome:rejected` | N/A |
| Accepted and applied | live result `merged` | issue closed: comment with the merge id, `outcome:accepted` | N/A |
| Batch check skips one | caps, stale, not pending | dropped and listed with its code; stale repeats the loop once | no reuse of answers |
| Batch declined | "No" or any other answer | nothing dispatched, nothing closed | N/A |
| Variable off | `validate` eligible, live run refused | whole batch unapplied, nothing closed, reported | asks the user, no retry |
| Not attended | scheduled, triggered, subagent, relayed or webhook-woken session, whatever its prompt | the loop never starts | N/A |
| Rejected, no issue open | live `rejected`, no open issue | reported as `rejectedWithoutOpenIssue` | N/A |

</frozen-after-approval>

## Code Map

- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `cmd_brief`/`build_brief`, `cmd_close_decided`, `decided_comment`, `cmd_comment`, `cmd_apply`, `cmd_insight_comment`, `load_summary`, `DECISIONS`, `build_parser`; `test_dedup_report.py` next to it
- `.claude/skills/moderator-dedup-review/SKILL.md` -- frontmatter description, rules 1, 2, 3, 5 and 7, step 5.4's decision list, step 8, the command table (rows for `apply`, `decisions`, `brief`, `close-decided`, `comment`, `insight-comment`)
- Text that says the loop offers no reject: AD-45 (Rule 1, Rule 3 note, "ships dark" note), AD-30 Rule 7, `DESIGN.md`, `7-event-dedup.md` (attended loop, switch, known gaps), PRD 3.7, `project-context.md:84`, `event-dedup-flow.html`

## Tasks & Acceptance

**Execution:**
- [ ] `dedup_report.py` + test -- a shared helper reads `--expect-reject-ids` for `apply` and `close-decided` (omitted: none; an id outside `--expect-ids`: exit 9; the action must match: exit 7)
- [ ] `dedup_report.py` + test -- `brief --offer` (tokens `accept`, `reject`; default `accept`, which keeps today's text): refuses unknown, empty, duplicate or `skip` tokens, `reject` for a `high` pair and `accept` for a non-`mid` pair (exit 9); prints `options` (fixed labels and descriptions, the reject cost in the description) and drops "To reject, use Moderator Items" when reject is offered; the `Signals` and `Clue` lines survive the cap as before
- [ ] `dedup_report.py` + test -- `confirm LOG [PAGE...] --accept IDS --reject IDS`: the fixed confirmation text and its two options, from the exact ids
- [ ] `dedup_report.py` + test -- `close-decided`: rejected results close with `outcome:rejected` (every `outcome:*` replaced) and `rejected_comment()`; each entry carries `action`; `notMerged` becomes `notApplied` (skipped results, each with `action`); `rejectedWithoutOpenIssue` added; `comment decided` takes exactly one of `--merge-id` or `--rejected` (neither or both: exit 9)
- [ ] `dedup_report.py` + test -- `insight-comment`: decision `rejected` (counts line, table), matched to the apply report's rejected results as merged ones are, and `validate_apply` still called without `expected_reject_ids`
- [ ] `SKILL.md` + a text-pin test -- rules 1, 2, 3, 5, 7, the description, step 5.4, step 8 (the offer, the answers, the exact-set `validate` tagged `<tag>-w` with its flags, the reader's confirmation, the dispatch, the owner told the title and count, the read with `--expect-reject-ids`, the close, the record), the table; the test reads `SKILL.md` and the workflow's `run-name` and fails if the titles, the flags or rule 7's wording drift
- [ ] docs and board -- the texts above amended with dated notes, `DESIGN.md` "As built in FIND-121", the closing of FIND-122's `close-decided` item, `FIND-121` done

**Acceptance Criteria:**
- Given an apply report with accepted and rejected results and an open issue each, when `close-decided` runs with the dispatched reject ids, then it lists each issue with its outcome label and comment, and leaves a skipped pair alone.
- Given a report whose actions differ from the dispatched reject ids, or `--expect-reject-ids` omitted for a report that holds a reject, when `apply` or `close-decided` reads it, then it exits 7.
- Given a `high` pair, when `brief --offer reject` runs, then it exits 9.
- Given `SKILL.md`, when its pin test runs, then rule 7 names the three conditions, the titles match the workflow's `run-name`, and every `--reject` appears only in step 8.

## Design Notes

The extra `validate` of the exact chosen set costs one workflow run and replaces guessing the day caps from two separate checks (accepts and rejects judged alone would miss their sum). The apply side stays the authority and re-checks everything live. Its tag is `<tag>-w`; the insight summary's `validateTag` records that final one.

The popup cannot prove a human answered: the model writes the tool call and reads the result. The honest bound is the owner's approval of the run; the spec makes the title and the count the owner expects explicit, and keeps the variable and `allow_rejects` as the other gates.

The closed rejected issue gets `outcome:rejected`: a real human decision, and on a shadow issue a disagreement worth keeping. A loop reject reads as `reviewer` in the export (`resolved_via = ai_skill`), which is why the loop closes the issue itself instead of leaving it to `settle`.

No pre-check that skips the loop's `validate` is added: none exists today, and the spec does not claim the loop always has something to offer (all candidates may be `high`).

## Verification

**Commands:**
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
