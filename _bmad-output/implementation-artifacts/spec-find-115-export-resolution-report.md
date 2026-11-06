---
title: 'Export tells the reviewer what happened to the pairs it escalated (FIND-115)'
type: 'feature'
created: '2026-11-05'
status: 'done'
baseline_commit: '62077e90669bf5d18e27cfe2075b1530013f9ebb'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The export's `recentlyResolved` is the newest 200 resolutions of 14 days and was all expiries, so the reviewer cannot see which pairs it escalated a moderator accepted or rejected, cannot close their issues, and every export carries about 28k characters of noise. The report has no queue age either.

**Approach:** Answer the question the reviewer asks. For the `skip_ids` it sent, `skipResolved` gives each one's status, who resolved it and when (`missing` if no such row). `recentlyResolved` keeps decisions only and `recentlyExpiredCount` counts expiries. Two oldest-pending times give the queue's age. The skill uses all of it.

## Boundaries & Constraints

**Always:**
- The export stays read-only in its `REPEATABLE READ, READ ONLY` snapshot. Nothing private: ids, statuses, timestamps and the `human`, `reviewer`, `system`, `unknown` class only.
- Pair evidence and `evidenceHash` are unchanged. `schemaVersion` stays 1 because writer and reader ship together (lockstep).
- One query reads every row of the sent ids; a pure function in `packages/domain` (100% tests) splits them into pending count, resolutions and `missing`, and `skippedCount` comes from it. The test-only `onlySuggestionIds` never narrows it.
- New fields: `skipIdCount`, `skipResolved`, `recentlyExpiredCount`, `oldestPendingAt` (queue-wide), `oldestUnskippedPendingAt`. `recentlyResolved` holds `accepted` and `rejected` only.
- The reader requires every new key and checks `skippedCount + skipResolved.length = skipIdCount`; exit 7 names the cause. It reports `missing` and never closes it.
- The workflow summary prints counts and raw timestamps only: no date arithmetic, no ids.

**Ask First:** anything in the export workflow beyond its summary line; a change to pair evidence; a `schemaVersion` bump or renaming `recentlyResolved`.

**Never:** write to the database; change the apply side or the skill's decision rules; send closed-issue ids in `skip_ids`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Decided by a person | sent id accepted or rejected | `skipResolved` row: status, `human`, time | N/A |
| Expired, or by the reviewer | sent id expired, or `ai_skill` | `system`, or `reviewer` | N/A |
| Old resolution | resolved 30 days ago | still listed (no window, no cap) | N/A |
| Undone | back to pending | counted in `skippedCount` only | N/A |
| Null time | non-pending, `resolvedAt` null | listed with null time, not `missing` | N/A |
| No such row | sent id not in the table | `missing`, null time and class | reader reports, closes nothing |
| No ids sent | empty `skip_ids` | `skipResolved` empty, no query | N/A |
| Busy day | many expiries, few decisions | `recentlyResolved` = decisions; `recentlyExpiredCount` = expiries in 14 days, uncapped | truncated only past 200 decisions |
| Ages | none pending / all sent | `oldestPendingAt` null iff `totalPending` 0; `oldestUnskippedPendingAt` null iff `totalPending` = `skippedCount` | N/A |
| Old export, or counts off | key missing; sum is not `skipIdCount` | reader exits 7 | names the key or the sum |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-evidence.ts` -- report types, `classifyDedupReviewResolvedBy`; test file next to it
- `apps/backend/src/lib/events/dedup-review-export.ts` -- `buildDedupReviewExport`; `dedup-review-export.test.ts` (18 pass in the sandbox)
- `.github/workflows/dedup-review-export.yml:130` -- summary `jq`; `apps/backend/src/dedup-review-workflow.test.ts` runs workflow steps
- `.claude/skills/moderator-dedup-review/dedup_report.py` -- `validate_export`, `cmd_settle`, `cmd_export_header`, `cmd_export_resolved`, `cmd_insight_*`; `SKILL.md` steps 2, 5.4, 7

## Tasks & Acceptance

**Execution:**
- [ ] `dedup-review-evidence.ts` + test -- report types; `partitionDedupReviewSkipIds` (dedupe, lower-case, sort, synthesise `missing`) and `toDedupReviewTimestamp`; fix the report literal in the test
- [ ] `dedup-review-export.ts` + test -- one query for the sent ids; decisions list (`inArray`, `asc(id)` tie-break); expired count; two minimums; DB tests relative to the shared DB (before and after, `recentLimit` knob, independent count and `min()`), plus a privacy test
- [ ] `dedup-review-export.yml` + workflow test -- new summary lines; the test runs the extracted `jq` on a full sample (ms timestamps) and an empty one
- [ ] reader, tests and `SKILL.md` -- validate the keys and the sum; `settle` closes from `skipResolved`, `recentlyResolved` as fallback; drop `unknownCount`, `--sent/--closed` for `--sent-file`, and `insight-body --issues`; ages from the two new fields
- [ ] docs and board -- `7-event-dedup.md`, `DESIGN.md`, `project-context.md`, AD-45 Rule 10, `FIND-115` done; no diagram impact

**Acceptance Criteria:**
- Given sent ids accepted by a person, expired, pending and unknown, when the export runs, then `skipResolved` holds the first two and a `missing` row, sorted, and the counts add up to `skipIdCount`.
- Given many expiries and a few decisions, when it runs, then `recentlyResolved` holds only the decisions and `recentlyExpiredCount` equals an independent count.
- Given pending rows, when it runs, then both oldest times equal an independent minimum, and are null as the matrix says.
- Given an expired suggestion with an open issue, when `settle` runs, then it closes that issue, labels an outcome only for a human decision, and leaves a `missing` one open and reported.
- Given an export without a new key, or counts that do not add up, when the reader loads it, then it exits 7 naming the cause.
- Given a full and an empty sample report, when the summary `jq` runs, then it prints without error and without ids.

## Design Notes

Filtering expiries alone leaves a pair escalated 20 days ago, or one that expired, invisible. Asking about the ids sent is exact, bounded by the 200-id cap and independent of the window. The queue-wide minimum is dominated by escalated pairs, so the "daily session stopped" signal is the oldest pending not in `skip_ids`.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, thresholds met
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-export.test.ts src/dedup-review-workflow.test.ts` -- expected: all pass
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exit 78 with the same failures as clean master, `FIND-115` not flagged

## Suggested Review Order

**The contract and its pure split (start here)**

- The report type: the five new fields, and `recentlyResolved` as decisions only.
  [`dedup-review-evidence.ts:148`](../../packages/domain/src/events/dedup-review-evidence.ts#L148)

- `toDedupReviewTimestamp`: one place turns a date into the report's time text or null.
  [`dedup-review-evidence.ts:187`](../../packages/domain/src/events/dedup-review-evidence.ts#L187)

- `partitionDedupReviewSkipIds`: dedupe, lower-case, sort; pending counted, the rest listed, no row is `missing`.
  [`dedup-review-evidence.ts:210`](../../packages/domain/src/events/dedup-review-evidence.ts#L210)

**The export reads the sent ids once**

- One query for every row of the sent ids, queue-wide, so `onlySuggestionIds` never narrows it.
  [`dedup-review-export.ts:249`](../../apps/backend/src/lib/events/dedup-review-export.ts#L249)

- The oldest pending that nobody escalated, next to the queue-wide oldest.
  [`dedup-review-export.ts:262`](../../apps/backend/src/lib/events/dedup-review-export.ts#L262)

- Decisions only, newest first, the id breaks ties; expiries are a count over the same window.
  [`dedup-review-export.ts:327`](../../apps/backend/src/lib/events/dedup-review-export.ts#L327)

- The wire shape: the two ages and the expiry count.
  [`dedup-review-export.ts:346`](../../apps/backend/src/lib/events/dedup-review-export.ts#L346)

**The job summary**

- Counts and two raw timestamps, no ids, no date arithmetic.
  [`dedup-review-export.yml:130`](../../.github/workflows/dedup-review-export.yml#L130)

**The reader holds the export to the new shape**

- A top-level key that is missing means an old export; a row-level one means a malformed row.
  [`dedup_report.py:388`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L388)

- A time must be a real moment, not only the shape of one.
  [`dedup_report.py:397`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L397)

- `skipResolved` rows: status, null time and class only for `missing`, sorted, never also a pair.
  [`dedup_report.py:406`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L406)

- The sum, the null rules for both ages and the counts that cannot be true.
  [`dedup_report.py:424`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L424)

- `--sent-file`: what it checks (count, and every resolved id was sent), no more.
  [`dedup_report.py:570`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L570)

**What the skill does with it**

- `export-resolved --ids` names the asked ids that have no row.
  [`dedup_report.py:635`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L635)

- `settle` closes from `skipResolved`, reports `missing` and never closes it.
  [`dedup_report.py:839`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L839)

- The insight body shows both queue ages in days with the raw time.
  [`dedup_report.py:1097`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L1097)

- Step 2 of the skill: check what was answered, then settle.
  [`SKILL.md:85`](../../.claude/skills/moderator-dedup-review/SKILL.md#L85)

**Docs and board**

- Rule 10 of AD-45: the report of what became of the escalated pairs is private-safe.
  [`festgrid-architecture-spine.md:2984`](../planning-artifacts/festgrid-architecture-spine.md#L2984)

- The deferral register: `FIND-118` (missing issues, `--sent-file` limit, null `resolved_at`).
  [`deferred-work.md`](deferred-work.md)
