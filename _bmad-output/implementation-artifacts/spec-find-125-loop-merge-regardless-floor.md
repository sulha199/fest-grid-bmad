---
title: 'Attended loop: the "Merge regardless of the floor" option, the reader and SKILL.md side of the floor override (FIND-125)'
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

**Problem:** The apply side can merge a pair the floor refuses (`accept-override`, `FIND-124`), but the attended loop cannot ask for it: a moderator in front of a floor-refused pair (#146, `name-mismatch`) is offered only Reject and Skip, and the reader refuses a report that holds an override.

**Approach:** The loop's popup offers **Merge** (today's accept, still judged by the floor), **Merge regardless of the floor** (an override) and Reject, plus Skip. The override is offered only where the floor refuses the pair, so Merge and the override never appear together. The reader builds the options, the refusal line, the confirmation and the `decisions` string, reads an override report, and `close-decided` and `insight-comment` handle overrides. `SKILL.md` extends rule 7: an override needs the same three attended conditions as a reject.

## Boundaries & Constraints

**Always:**
- **Labels** are constants the reader owns: `Merge` (was `Accept (merge)`), `Merge regardless of the floor`, `Reject`, `Skip`; only a selected option's exact label counts, anything else is a skip. Option descriptions say what each does (the override: it skips the floor's checks for this pair; a merge can be undone in the app).
- **Who is offered what** (one pair per `brief`; `--offer` tokens `accept`, `override`, `reject`, exact, lower-case): an eligible pair `accept,reject`; a pair the floor refuses with a floor code (`low-tier`, `undone-before`, `no-anchor`, `venue-conflict`, `outside-window`, `schedule-uncovered`, `name-mismatch`) `override,reject`; a pair at tier `high` (`already-high`) `override` only (the drain's pair is never rejected); `per-run-cap` and `event-already-in-run` `reject` only (an override would hit the same limit); `per-day-cap`, gone and stale pairs no popup. The reader refuses `accept` with `override` in one call, an `accept` for a pair that is not `mid`, a `reject` for a `high` pair.
- `override` needs `--refusal CODE` on `brief` (one of the floor codes, `already-high` iff the pair is tier `high`, `low-tier` iff it is tier `low`, none of those two for tier `mid`; else exit 9); `--refusal` without `override` is refused. The popup says, in fixed words, which check refuses the pair and that merging anyway skips it.
- `decisions LOG [IDS...] [--reject IDS] [--override IDS]` and `confirm LOG PAGE... --accept IDS --reject IDS --override IDS` (all three flags required, empty means none): ids distinct across the lists, exported, 1 to 10 for `confirm` and 50 for `decisions`, no reject of a `high` pair, an accept only for tier `mid`, and for `confirm` an open issue for every id. The output carries `"action":"accept-override"` for overrides, in file order rejects, accepts, overrides.
- **Reading reports.** `validate_apply` accepts the action `accept-override` only when its caller passes the dispatched override ids, and then exactly for those ids (`apply` and `close-decided` take `--expect-override-ids`, omitted means none, an id not among `--expect-ids` is exit 9); a `merged` result needs `accept` or `accept-override`; without the ids an override result is refused as today. `insight-comment` may read overrides (it checks entries against the report) and marks an overridden merge in its table.
- **Closing.** `close-decided` closes the open issues of an overridden merge with `outcome:accepted` and a fixed comment naming the merge id and that the floor was overridden, in the same `close` list; its `action` reads `accept-override`.
- **Confirmation** lists merges, overrides and rejects apart; for overrides it says the floor's checks do not apply, that it can merge a pair the reviewer would have refused, that it is undone in the app, that it is recorded as AI-assisted under the moderator's account, and that the run is refused whole (accepts and rejects included) if the owner has not switched the override on; for rejects as today.
- **Attended.** Rule 7 extends to the override: a user message asked for the loop, the pair's popup was the reader's, the answer of this session's own `AskUserQuestion` was exactly the override label, followed by a Yes on `confirm`; default-deny as for a reject; an unattended session never sets it; in accepts-only mode the loop uses `--offer accept` only. The daily review, steps 0 to 7, never use the override: no step but 8 contains `allow_floor_override` or `override=true` (pinned).
- **Dispatch.** The exact-set `validate` run (tag `<tag>-w`) and the live run carry `allow_rejects` true only with a reject and `allow_floor_override` true only with an override; titles `Dedup Review Apply mode=validate live=false [rejects=true ][override=true ]tag=<tag>-w` and `mode=apply live=true [...]tag=<tag>-a`, in that order of tokens. A batch with an override also needs the owner's `DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED`, or the whole run is refused.
- Apply side, export, workflow, guard, caps and floor unchanged. Event text keeps going through the reader's cleaning.

**Ask First:** a change to the floor, caps or the apply side; any popup text that is not the reader's.

**Never:** an override offered for a pair `validate` called eligible or for `per-run-cap`, `event-already-in-run`, `per-day-cap`; an override without the three attended conditions; a label or option worded by the model; `allow_floor_override` or `override=true` outside step 8; a change to the daily review's behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Eligible pair | `validate` eligible, tier mid | options Merge, Reject, Skip | N/A |
| Floor-refused pair | code `name-mismatch`, tier mid | options Merge regardless of the floor, Reject, Skip; popup names the check | N/A |
| High pair | tier high, `already-high` | options Merge regardless of the floor, Skip | no Reject |
| Low pair | tier low, `low-tier` | override, Reject, Skip | N/A |
| Cap or shared event | `per-run-cap`, `event-already-in-run` | Reject, Skip only | N/A |
| Day cap, gone, stale | `per-day-cap`, `not-pending`, `stale-pair` | listed, no popup | N/A |
| Bad offer | `accept,override`; `override` for no `--refusal`; refusal that does not fit the tier; unknown token | exit 9, nothing printed | fixed message |
| Free text | "Merge" typed under Other for an override pair | a skip | N/A |
| Confirm | accepts, overrides, rejects | one question listing each apart with its costs; `decisions` string exact | refuses an id twice, unshown, no open issue, 0 or over 10 |
| Report with overrides | live report, override ids dispatched | read; merges carry their merge ids | refuses an override for an id not dispatched as one, or without the flag |
| Old call | `apply` without `--expect-override-ids` on a report with an override | exit 7 | fail closed |
| Close | an overridden merge, an open issue and its twin | closed with `outcome:accepted` and the override comment; twin too | skipped override listed in `notApplied` |
| Attended off | unattended or relayed session | `--offer accept` only; refused pairs listed | prose, pinned |

</frozen-after-approval>

## Code Map

- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `LABEL_*`, `OPTION_DESCRIPTIONS`, `parse_offer`, `options_for`, `cmd_brief` (`--refusal`), `build_brief`, `check_batch`, `decisions_text`, `cmd_decisions`, `cmd_confirm`, `validate_apply`, `read_expected_*`, `cmd_apply`, `cmd_close_decided`, `decided_comment`, `cmd_insight_comment`, parser
- `.claude/skills/moderator-dedup-review/test_dedup_report.py` -- `FloorOverrideReportTests` (now: reads overrides; fails closed without the ids), `LoopRejectTests`, `SkillTextTests` (labels, run-title render with `override=true`, the FIND-124 pin changes)
- `.claude/skills/moderator-dedup-review/SKILL.md` -- rules 2 and 7, description, step 5.4, command-table rows, step 8 items 3 to 9
- Text to amend: AD-45 Rule 3 note, `DESIGN.md` ("As built in FIND-125"), `7-event-dedup.md` (loop paragraph, runbook), PRD 3.7, `project-context.md`; board `FIND-125` done

## Tasks & Acceptance

**Execution:**
- [ ] `dedup_report.py` + test -- labels (`Merge`, override label), `parse_offer` with `override`, `options_for`, `brief --refusal` with the tier-consistency check and the fixed words per code, descriptions
- [ ] `dedup_report.py` + test -- `check_batch`, `decisions --override`, `confirm --override` (all three required), `decisions_text` order and action, the confirmation text
- [ ] `dedup_report.py` + test -- `validate_apply` and `read_expected_*` for overrides, `apply` and `close-decided --expect-override-ids`, the close comment, `insight-comment` marking; the FIND-124 refusal tests change to "fails closed without the ids"
- [ ] `SKILL.md` + text-pin tests -- rule 2 and 7, description, 5.4, table rows, step 8 (the offer matrix, `--refusal`, answers, `-w` run with its title tokens, dispatch inputs, confirm, close), the pins
- [ ] docs and board -- amendments with dated notes; `FIND-125` done

**Acceptance Criteria:**
- Given a floor-refused pair, when the loop builds its popup, then the options are Merge regardless of the floor, Reject and Skip, and the popup names the refusing check; a `high` pair gets the override and Skip only.
- Given an answer that is not exactly an offered label, when it is read, then the pair is skipped.
- Given a chosen set with an override, when `confirm` runs, then the question lists overrides apart with what they skip and what happens if the owner's switch is off, and its `decisions` string carries `accept-override`.
- Given a live report with overrides, when `apply` or `close-decided` reads it with `--expect-override-ids`, then it accepts exactly those ids as overrides and closes their issues with `outcome:accepted` and the override comment; without the flag it refuses the report.
- Given steps 0 to 7 of `SKILL.md`, when scanned, then none contains `allow_floor_override` or `override=true`.

## Design Notes

Merge and the override never appear together: the floor decides. An eligible pair needs no bypass, and an override on a pair the cap or a claimed event refuses would be refused by the same limit. Offering the override only where the floor refuses keeps the popup to three options, within `AskUserQuestion`'s four. The refusal code comes from `validate` (the skill's), and the reader refuses a code that does not fit the pair's tier, so a wrong or invented code cannot dress an override up as something the floor refused for a lesser reason; the real bounds stay the switch, the approval and the apply side's own checks (AD-45 Rule 6). The popup cannot prove a human answered, as for a reject.

`FIND-123`'s reader loose ends stay open (a later pair's Accept lost when an earlier one is skipped, weak option tests): they do not block this goal.

## Verification

**Commands:**
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master
- no TypeScript, workflow or apply code changes: lint and build are not needed
