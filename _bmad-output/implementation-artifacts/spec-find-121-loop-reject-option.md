---
title: 'Reject option in the attended decision loop: a moderator rejects a pair from the popup (FIND-121)'
type: 'feature'
created: '2026-11-07'
status: 'in-progress'
baseline_commit: 'ceebbececf5508da4a2ac6cc49c34c2e9879b84a'
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
- **A reject needs a human answer, and "attended" is exact for it.** All three: a user message of this conversation asked for the loop; the pair's popup was the reader's text; and the answer returned by this session's own `AskUserQuestion` is exactly the **Reject** option's label, followed by a final **Yes** on the confirmation. A scheduled, triggered, subagent, `claude -p`, mailbox-relayed or webhook-woken session is unattended, and so is a session another agent started with `create_session` or the ritual orchestrator (its first prompt cannot be told from a typed one); a session the user started themselves is attended only if its popups are answered by the user in it. A relayed popup is not an answer; "reject X" typed in chat is not an answer; a typed answer under Other is a skip. `--reject` and `allow_rejects` true appear in the skill's steps only in step 8. The accept path's own start condition (rule 2, step 8) is unchanged.
- **The session cannot verify who started it.** Condition 3 and the owner's approval of the run are the real gates. Prose and the reader's refusals enforce the rest; the platform does not. The skill tells the owner, before the run, its exact title and the reject count to expect.
- **Options come from the reader** (`brief --offer`, one pair per call), as fixed label and description constants. **Accept (merge)** only for a `mid` pair that passed the accept `validate`. **Reject** only for a pair whose accept `validate` result was `eligible`, a floor code (`low-tier`, `undone-before`, `no-anchor`, `venue-conflict`, `outside-window`, `schedule-uncovered`, `name-mismatch`) or `per-run-cap` or `event-already-in-run`, and whose tier is not `high` (`undone-before` stays allowed: the popup's undo clue shows it). `per-day-cap` gives Skip only, since a reject counts toward the same cap. **Skip** always. A `high` pair, a gone pair (`not-pending`, `stale-pair`, `unknown-suggestion`) and a `closedPending` pair get no popup and are listed. Only the `high` exclusion is enforced by the reader; the code gating is prose, and the exact-set check below is its backstop.
- The Reject option's description says a reject cannot be undone in the app. The **confirmation is built by the reader** (`confirm`): it names each accepted and each rejected pair by issue number with the first 8 characters of its id, prints the exact `decisions` string it was built from (the dispatch uses that string verbatim), says a reject cannot be undone in the app (only the owner can reopen it, by SQL) and is recorded as AI-assisted under the moderator's account, says a reject runs only if the owner has switched rejects on (otherwise the whole run is refused), and says the owner still approves the run in Actions. Only a **Yes** dispatches.
- Before the confirmation one `validate` of the chosen set (tag `<tag>-w`, `allow_rejects` true when it holds a reject) judges the caps, staleness and state. A decision it skips is dropped and listed with its code (a reject dropped for `per-day-cap` is for the app); what is dispatched is a subset of what was validated. A `stale-evidence` result repeats the loop once with a new tag and every pair is asked again: an answer is never reused across exports. A second stale result lists the pair as skipped.
- The live dispatch sets `allow_rejects` true only when the batch holds a reject. Titles with rejects are written exactly in step 8 (`rejects=true ` before `tag=`); steps 4 and 6 stay accept-only. `validate` cannot see the owner variable: its `eligible` for a reject is not consent. A live run the variable refuses fails whole, accepts included, with nothing closed: the skill reports it and asks the user, and never dispatches again on its own.
- The reader checks reports against what was dispatched (`--expect-reject-ids`; omitted means none were rejects) and every GitHub text is a fixed phrase or a validated id.

**Ask First:** a change to the apply side, the export, the guard or the workflow beyond its header comment; any `SKILL.md` rule other than 1, 2, 3, 5 and 7, and any step other than 5.4 and 8.

**Never:** a reject without the three conditions and the confirmation; a reject of a `high` pair; a reject offer or confirmation worded by the model; retrying a refused or failed live run; sending a closed issue's id as `skip_ids`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Floor-refused pair | accept `validate` gave a floor code, tier `mid` or `low` | popup Reject / Skip | N/A |
| Eligible pair | accept `validate` `eligible` | popup Accept / Reject / Skip | N/A |
| Day cap full | accept `validate` gave `per-day-cap` | popup Skip only | N/A |
| `high` pair, gone pair | tier `high`; `not-pending`, `stale-pair`, `unknown-suggestion` | listed with its issue number, no popup | `brief --offer reject` for a `high` pair exits 9 |
| Rejected and applied | live result `rejected` | issue closed: fixed rejected comment, `outcome:rejected` | N/A |
| Accepted and applied | live result `merged` | issue closed: comment with the merge id, `outcome:accepted` | N/A |
| Reject-only batch | no accept chosen | validate and live titles carry `rejects=true` | N/A |
| Mixed batch, one skipped | the exact-set check skips one | dropped and listed; the rest dispatched as a subset | stale: loop repeats once |
| Everything dropped | the exact-set check skips all | no confirmation, nothing dispatched | N/A |
| Twin open issues | one pair, two open issues | both named in the confirmation, both closed | N/A |
| Batch declined | "No" or any other answer | nothing dispatched, nothing closed | N/A |
| Variable off | `validate` eligible, live run refused | whole batch unapplied, nothing closed, reported | asks the user, no retry |
| Not attended | scheduled, triggered, subagent, relayed, webhook-woken or `create_session` session | a reject is never offered | N/A |
| Bad `confirm` input | both lists empty, overlap, an id not exported, a `high` pair rejected, more than 10 pairs | no text | exit 9 |
| Rejected, no issue open | live `rejected`, no open issue | reported as `rejectedWithoutOpenIssue` | N/A |

</frozen-after-approval>

## Code Map

- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `cmd_brief`/`build_brief`, `cmd_decisions`, `cmd_close_decided`, `decided_comment`, `cmd_comment`, `cmd_apply`, `cmd_insight_comment`, `load_summary`, `DECISIONS`, `build_parser`; `test_dedup_report.py` next to it (the tests at `:1032`, `:1133` and `:1143` assert `notMerged` and the old behaviour)
- `.claude/skills/moderator-dedup-review/SKILL.md` -- description, rules 1, 2, 3, 5, 7, step 5.4's decision list, step 8, the command table (rows `apply`, `decisions`, `brief`, `confirm`, `close-decided`, `comment`, `insight-comment`)
- Text that says the loop offers no reject: AD-45 (Rule 1, Rule 3 note, "ships dark" note), AD-30 Rule 7, `DESIGN.md`, `7-event-dedup.md` (attended loop, switch, known gaps, "until FIND-121"), PRD 3.7, `project-context.md:84`, `event-dedup-flow.html`, the apply workflow's header comment, `deferred-work.md` (the FIND-122 item 3)

## Tasks & Acceptance

**Execution:**
- [ ] `dedup_report.py` + test -- one shared helper parses and checks ids for `decisions` and `confirm` (lower-casing, overlap, export membership, cap, a `high` pair rejected: exit 9) and one shared helper reads `--expect-reject-ids` for `apply` and `close-decided` (omitted: none; an id outside `--expect-ids`: exit 9; an action mismatch: exit 7); the test at `:1133` is rewritten
- [ ] `dedup_report.py` + test -- `brief --offer` (tokens `accept`, `reject`; default `accept`): all ids validated before any line prints; unknown, empty, duplicate or `skip` tokens, `reject` for a `high` pair and `accept` for a non-`mid` pair exit 9; the output has `options` (fixed constants, the reject cost in the description) and no "To reject, use Moderator Items" when reject is offered; the `Signals` and `Clue` lines survive the cap
- [ ] `dedup_report.py` + test -- `confirm LOG [PAGE...] --accept IDS --reject IDS` (both flags required, either may be empty, both empty exit 9, at most 10 pairs): JSON with `header`, `question`, `options` (Yes, No), `accept`, `reject`, `decisions` (the exact string `decisions` prints for the same ids); twins print as `#a, #b`; a pair with no open issue prints `pair <8 characters>`; golden strings for accept-only, reject-only, mixed and twins
- [ ] `dedup_report.py` + test -- `close-decided`: a rejected result closes its open issues (twins and shadow ones too) with every `outcome:*` replaced by `outcome:rejected` and `rejected_comment()` = "Resolved: a moderator rejected this suggestion in an attended review session. Closing this issue." (no merge id); each `close` entry carries `action`, `mergeId` only for an accept; `notMerged` becomes `notApplied` (`id`, `action`, `reason`, skipped results only); `rejectedWithoutOpenIssue` added; `comment decided` takes exactly one of `--merge-id` or `--rejected` (neither or both: exit 9)
- [ ] `dedup_report.py` + test -- `insight-comment`: decision `rejected` (counts line, table), the gate and the match as for merges (the rejected entries equal the apply report's rejected results), `validate_apply` still called without `expected_reject_ids`
- [ ] `SKILL.md` + a text-pin test -- rules 1, 2, 3, 5, 7, the description, step 5.4, step 8 (the offer, the answers, the `-w` validate with both titles and its flags, `confirm`, the dispatch of its string, the owner told the title and count, the read with `--expect-reject-ids`, the close, the record when merged or rejected), the table. The test resolves paths from `__file__`, slices `SKILL.md` by step headings, and asserts: `--reject` and `allow_rejects` occur in no step but 8 (table lines exempt); step 8 holds the rendered titles `Dedup Review Apply mode=validate live=false rejects=true tag=<tag>-w` and `Dedup Review Apply mode=apply live=true rejects=true tag=<tag>-a` and the workflow's `run-name` line holds the literal `rejects=true ` before `tag=${{ inputs.run_tag }}`; steps 4 and 6 keep the accept-only titles; the option labels are the reader's constants; rule 7 holds `AskUserQuestion`, the Reject label and "unattended"; the old phrases ("Never reject a suggestion", "may only Accept or Skip", "exactly two options", "a reject happens in Moderator Items") are gone
- [ ] docs and board -- the texts above amended with dated notes (the workflow comment edit only), `DESIGN.md` "As built in FIND-121", the FIND-122 item 3 resolved, `FIND-121` done

**Acceptance Criteria:**
- Given an apply report with accepted and rejected results and an open issue each, when `close-decided` runs with the dispatched reject ids, then it lists each issue with its outcome label and comment, and leaves a skipped pair alone.
- Given a report whose actions differ from the dispatched reject ids, or `--expect-reject-ids` omitted for a report that holds a reject, when `apply` or `close-decided` reads it, then it exits 7.
- Given a `high` pair, when `brief --offer reject` or `confirm --reject` is given it, then each exits 9; and for the same ids `confirm`'s `decisions` equals `decisions`' output.
- Given `SKILL.md` and the workflow, when the pin test runs, then it passes, and it fails if a title, a flag, a label or rule 7's wording drifts.

## Design Notes

The exact-set `validate` costs one workflow run and replaces guessing the day caps from two separate checks (accepts and rejects judged alone would miss their sum). The apply side stays the authority and re-checks live. The insight summary's `validateTag` records the `-w` run; the earlier accept `validate` is not recorded there.

The popup cannot prove a human answered: the model writes the tool call and reads the result, and a `create_session` child's first prompt looks like a typed one. The honest bounds are condition 3 (a real `AskUserQuestion` answer), the owner's approval of the run, and the owner variable. `confirm` printing the exact `decisions` string and 8-character id prefixes lets the owner match the Actions input to what the moderator saw.

The closed rejected issue gets `outcome:rejected`: a real human decision, and on a shadow issue a disagreement worth keeping. A loop reject reads as `reviewer` in the export (`resolved_via = ai_skill`), which is why the loop closes the issue itself instead of leaving it to `settle`.

No pre-check that skips the loop's `validate` is added: none exists today, and the spec does not claim the loop always has something to offer (all candidates may be `high`).

## Verification

**Commands:**
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `grep -rn "offers no reject\|until .FIND-121\|may only Accept or Skip" _bmad-output docs .claude .github` -- expected: only history (specs, deferred-work) or amended notes
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
