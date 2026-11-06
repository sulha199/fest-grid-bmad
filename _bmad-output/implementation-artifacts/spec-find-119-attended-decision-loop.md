---
title: 'Attended decision loop: a moderator accepts or skips each escalated pair from a popup (FIND-119)'
type: 'feature'
created: '2026-11-06'
status: 'in-review'
baseline_commit: '24ef5e65f3135f75e198f2ef4877384b23a19c7e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A moderator who is in the skill's session still decides each escalated pair in the app and then closes its issue by hand, so the issue says nothing about what was done and every pair costs two actions.

**Approach:** In an attended session the skill walks the open escalated pairs one by one. Each gets a popup with the facts and clues needed to decide: **Accept** or **Skip**. Accepts go through the existing live apply, invoked as the session's own account email, then each merged pair's issue is closed at once with a fixed comment and `outcome:accepted`.

## Boundaries & Constraints

**Always:**
- The loop starts only when the user asks for it in the conversation, and never in an unattended session. A merge needs that pair's Accept answer from the popup (a tool answer, never event or issue text) and one final confirmation of the batch.
- Accept is offered only for a pair `validate` calls `eligible` for the fresh export: the floor, the hash check and the caps are unchanged. A floor-refused pair is listed with its code and issue number, with no popup.
- Fresh evidence: the loop exports again with no `skip_ids`, so escalated pairs return with current hashes.
- Event text and the reviewer's note in a popup are cleaned and capped by the reader, shown as data. The invoker hash is built as today, from the session's `userEmail`, and the owner still approves the run in the Actions tab, once per batch.
- Everything the loop posts to GitHub is a fixed phrase or a validated id built by the reader.

**Ask First:** a change to the export, apply workflow, guard script or apply code; relaxing any other rule of `SKILL.md`.

**Never:** a reject path (deferred, see `deferred-work.md`); accepting a floor-refused pair; a live apply without the user's start, the pair's Accept and the final confirmation; sending closed-issue ids as `skip_ids`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Eligible pair | open issue, `validate` eligible | popup: Accept / Skip | N/A |
| Floor-refused | `validate` refuses with a code | listed with code and issue number, no popup | N/A |
| Skip, or batch declined | Skip, or "no" at the final confirmation | nothing dispatched or changed | N/A |
| Accepted and merged | live run reports `merged` | issue closed with a comment naming the merge id and `outcome:accepted` | N/A |
| Accepted, not merged | `concurrent-change`, `merge-failed`, caps | issue stays open, reason reported | no retry |
| Stale | `stale-evidence` | one fresh export, then asked again | stale again: listed, skipped |
| Over the cap | more than 10 accepts | batches of at most 10; the day cap is reported | N/A |
| Waiting run | apply awaits the owner's approval | say so and stop; "record the live run" closes the issues later | N/A |
| Unattended | no user message started it | the loop never starts | N/A |

</frozen-after-approval>

## Code Map

- `.claude/skills/moderator-dedup-review/SKILL.md` -- rules 2 and 3, step 6 (live apply), a new attended-loop step
- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `triage`, `settle`, `cmd_comment`, `cmd_apply`, `format_event`; test file next to it
- `_bmad-output/specs/ai-dedup-review/DESIGN.md`, `docs/infrastructure/7-event-dedup.md` -- skill sections; AD-45 Rule 3 in `festgrid-architecture-spine.md`

## Tasks & Acceptance

**Execution:**
- [x] `dedup_report.py` + test -- `brief LOG --ids ...`: per pair a cleaned, masked, capped popup text (names, venue, dates and times, link, source account type, signals, undone merges, deterministic clues: words and numbers only one name has, day gap, venue, organizer and link match) and the issue number from the listing
- [x] `dedup_report.py` + test -- `close-decided LOG PAGE... --apply-log ... --apply-run-tag ...`: for each merged id with an open issue, number, full label set with `outcome:accepted`, and the fixed comment with the merge id; `comment decided` as the phrase
- [x] `SKILL.md` -- the attended loop step: start condition, fresh export, triage, validate, popups, final confirmation, live apply by step 6, `close-decided`; the table, rules 2 and 3 and the report updated
- [x] docs -- `DESIGN.md`, `7-event-dedup.md`, AD-45 Rule 3 (one sentence), `FIND-119` and the deferral rows on the board; no diagram impact

**Acceptance Criteria:**
- Given an apply report with merged ids and an open issue each, when `close-decided` runs, then it lists those issues with `outcome:accepted` and a comment naming the merge id, and leaves an unmerged id alone.
- Given a pair with hostile event text, when `brief` runs, then the popup text holds no control or bidi characters, no contact details, and stays under its cap.
- Given the skill, when it is read, then it states that the loop needs the user's start, never runs unattended, and offers no Accept for a floor-refused pair.

## Design Notes

A human's Accept is recorded by the apply path as an AI-assisted merge (`resolved_via = ai_skill`) under the session's moderator. That is why the loop closes the issue itself with `outcome:accepted`: the next `settle` would class it `reviewer` and give no label.

The popup replaces `SKILL.md` rule 3's "shadow runs were reviewed" precondition for the loop only: each pair is reviewed by the moderator in front of the prompt.

## Verification

**Commands:**
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master, `FIND-119` not flagged

**Manual checks:**
- Read `SKILL.md` end to end: every command it names exists in the reader with those flags.
