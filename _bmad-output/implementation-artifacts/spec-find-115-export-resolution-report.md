---
title: 'Export tells the reviewer what happened to the pairs it escalated (FIND-115)'
type: 'feature'
created: '2026-11-05'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/docs/infrastructure/7-event-dedup.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The export's `recentlyResolved` is the newest 200 resolutions of 14 days and was all expiries, so the reviewer cannot see which pairs it escalated a moderator accepted or rejected, cannot close their issues, and every export carries about 28k characters of noise. The report also has no queue age.

**Approach:** Answer the question the reviewer asks. `skipResolved` gives, for each `skip_ids` id that is no longer pending, its status, who resolved it and when (`missing` if no such row). `recentlyResolved` leaves expiries out and `recentlyExpiredCount` counts them. `oldestPendingAt` is the queue's oldest suggestion. The skill uses all three.

## Boundaries & Constraints

**Always:**
- The export stays read-only in its `REPEATABLE READ, READ ONLY` snapshot.
- Nothing private: ids, statuses, timestamps and the `human`, `reviewer`, `system`, `unknown` class only.
- Pair evidence and `evidenceHash` are unchanged; `schemaVersion` stays 1 (the skill is the only consumer and changes in the same PR).
- Pure mapping in `packages/domain` with 100% tests; queries in `apps/backend`.
- Every sent id is accounted for: `skippedCount + skipResolved.length` equals the distinct ids sent.
- The reader refuses an export that lacks the new fields.

**Ask First:** anything in the export workflow beyond its summary line; a change to pair evidence; a `schemaVersion` bump.

**Never:** write to the database; change the apply side or the skill's decision rules; print ids in the job summary.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Decided by a person | sent id accepted or rejected | `skipResolved` row with status, `human`, time | N/A |
| Expired, or merged by the reviewer | sent id expired, or `ai_skill` | `system`, or `reviewer` | N/A |
| Old resolution | resolved 30 days ago | still listed (no 14-day window, no cap) | N/A |
| Undone | sent id back to pending | counted in `skippedCount` only | N/A |
| No such row | sent id not in the table | `{status: 'missing'}`, null time and class | N/A |
| Busy day | 300 expiries, 3 decisions | `recentlyResolved` holds the 3, `recentlyExpiredCount` 300 | truncated only past 200 decisions |
| Empty queue | nothing pending | `oldestPendingAt` null | N/A |
| Old export | report lacks the new fields | reader exits 7 | refuse, never guess |

</frozen-after-approval>

## Code Map

- `packages/domain/src/events/dedup-review-evidence.ts` -- report types, `classifyDedupReviewResolvedBy`
- `apps/backend/src/lib/events/dedup-review-export.ts` -- `buildDedupReviewExport` (queries the report)
- `apps/backend/src/lib/events/dedup-review-export.test.ts` -- DB tests (18 pass in the sandbox)
- `.github/workflows/dedup-review-export.yml:130` -- the summary `jq` line
- `.claude/skills/moderator-dedup-review/` -- reader `validate_export`, `settle`, `export-header`, `insight-body`; `SKILL.md` steps 2, 3, 5, 7

## Tasks & Acceptance

**Execution:**
- [ ] `dedup-review-evidence.ts` and its test -- add the three fields and a pure `classifyDedupReviewSkipResolution`; 100% coverage
- [ ] `dedup-review-export.ts` and its test -- three queries (the sent ids' resolutions, recent decisions without expiries plus the expired count, the oldest pending), one DB test per matrix row
- [ ] `dedup-review-export.yml` -- the summary line reports decisions, expiries and queue age; run its `jq` on a sample
- [ ] reader and `SKILL.md` -- `settle` closes from `skipResolved` (recent decisions as fallback); `unknownCount` is replaced by the accounting check; the insight body shows the exact oldest pending age; tests updated
- [ ] `7-event-dedup.md`, `DESIGN.md`, `backlog.yaml` -- describe the fields, drop the known-gap text, close `FIND-115`

**Acceptance Criteria:**
- Given sent ids that are accepted by a person, expired, pending and unknown, when the export runs, then `skipResolved` holds the first, second and a `missing` row, and the counts add up to the ids sent.
- Given 300 expiries and 3 decisions in the window, when it runs, then `recentlyResolved` has the 3 and `recentlyExpiredCount` is 300.
- Given pending suggestions, when it runs, then `oldestPendingAt` is the earliest `createdAt`, and null when none.
- Given an expired suggestion with an open issue, when `settle` runs, then it closes that issue, and labels an outcome only for a human decision.
- Given a report without the new fields, when the reader loads it, then it exits 7.

## Design Notes

Filtering expiries alone leaves a pair escalated 20 days ago, or one that expired, invisible. Asking about the ids sent is exact, bounded by the 200-id cap, and independent of the window.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, coverage thresholds met
- `cd apps/backend && NODE_ENV=test npx tsx --test src/lib/events/dedup-review-export.test.ts` -- expected: all pass
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: the same failures as clean master
