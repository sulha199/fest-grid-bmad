---
title: 'Extraction prompt: one schedule per listed date, never a collapsed range'
type: 'bugfix'
created: '2026-11-09'
status: 'done'
baseline_commit: 'd7b1be45eb3e9cfd3a0001f3b04b1a875da01fcf'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A poster row that lists several dates for one place ("Senin, 2, 9, 16, 23, 30 Nov : Pasar Porosjayan", "Rabu, 4 & 18 Nov") is dropped, or collapsed into a start-to-end range, because the extraction prompt has no rule for explicit date lists. A range with no `applicableDaysOfWeek` means "every day in the span" (PRD §4, schedules), so prod shows "Pasar Porosjayan 2 to 30 Nov" as daily. Five replays of post `DfWWCCIzNw1` gave the Bus Samsat event 9, 10 (four of them ranges), 17, 1 and 10 schedules.

**Approach:** Add one lean schedule rule next to 4a/4b: a row listing several explicit dates becomes one schedule per date; a range is used only when the text states a continuous period; weekly recurrence stays with rule 4a.

## Boundaries & Constraints

**Always:** Same style and length discipline as rules 4a/4b; the Gemini response schema is unchanged; rule 4a keeps its meaning (weekday narrowing only when the text states recurrence).

**Ask First:** Adding any response-schema field (once caused whole-request 400 INVALID_ARGUMENT, see the comment in `build-gemini-request.ts`); expanding stated weekly recurrence ("every Monday in November") into individual dates.

**Never:** Touch any other prompt section, add `locationContext` (a later story that waits for the geocoding PR), add env vars, touch the face-blur/budget code or the poll-and-drain loop, or write to prod.

## I/O & Edge-Case Matrix

| Scenario | Input text | Expected extraction | Error Handling |
|----------|-----------|--------------------|----------------|
| Comma list | "Senin, 2, 9, 16, 23, 30 Nov: Pasar X" | 5 schedules, same title and location, each its own `eventStartDate`, no `eventEndDate` | N/A |
| Ampersand list | "Rabu, 4 & 18 Nov: Pasar Y" | 2 schedules | N/A |
| Stated period | "2-30 Nov" or "setiap hari 2-30 Nov" | one schedule with a range | N/A |
| Stated weekly recurrence | "every Monday in November" | rule 4a: one range plus `applicableDaysOfWeek` | N/A |
| Single date | "Sabtu, 7 Nov: Kalurahan Z" | one schedule, unchanged | N/A |
| Date with time | "Sabtu 7 Nov 09.00-11.00" | one schedule with times, unchanged | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` -- system instruction, schedule rules 4, 4a, 4b (~L248-250); the new rule goes after 4b.
- `apps/backend/src/lib/ai-processor/build-gemini-request.test.ts` -- prompt-text assertions (~L355-365 pattern).
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` -- `applicableDaysOfWeek` semantics (~L88, L640-656): absent means every day in the span.
- `apps/backend/scripts/tmp-prompt-eval.ts` -- untracked evaluation script (deleted after use); results in the Design Notes.

## Tasks & Acceptance

**Execution:**
- [ ] `build-gemini-request.ts` -- add rule 4c after 4b: several explicit dates in one row or line (comma lists, "&", weekday-prefixed lists) become one schedule per date with the same title and location, each with its own `eventStartDate` and no `eventEndDate` unless the text gives one; use a range only for a stated continuous period ("2-30 Nov", "daily"); keep 4a for stated weekly recurrence -- the rule the model lacks today.
- [ ] `build-gemini-request.test.ts` -- assert the rule's key phrases are in the system instruction and that 4a/4b are still present -- guards the wording against accidental edits.
- [ ] Live verification -- rerun `tmp-prompt-eval.ts` (Samsat x5, 21-post corpus) and record before/after in the Design Notes; delete the script -- the prompt change must be proven on the real model.

**Acceptance Criteria:**
- Given the Samsat poster replayed 5 times, when the new prompt is used, then the Bus Samsat event has at least 14 schedules in at least 4 of 5 runs, and none of its schedules spans more than 1 day.
- Given the 21-post regression corpus, when it is run before and after, then grouping labels and event counts do not regress (differences are reported with the noise level) and the number of range-style schedules does not rise.
- Given the existing prompt tests, when the suite runs, then it passes with the new assertions.

## Spec Change Log

## Design Notes

Baseline on the unchanged prompt (master `d7b1be45`, `gemini-3.5-flash-lite`, 5 runs): Bus Samsat schedules 9, 10, 17, 1, 10; run 2 shows the collapse (ranges 2-30, 3-24, 4-18, 5-19 Nov); run 3 expanded to 17 dates, the behavior the rule asks for; run 4 returned a single schedule. Only 1 of 5 runs reaches 14. 21-post corpus: 65 events, 113 schedules, 11 range-style schedules. The model varies strongly run to run, so one run proves nothing: judge by the 5-run distribution. If the first wording misses the acceptance bar, iterate the wording at most twice (each iteration logged above) and report the result to the human rather than loosening the bar.

After rule 4c (first wording, no iteration needed): Bus Samsat schedules 20, 18, 18, 10, 20; four of five runs reach 14, none of those four has a schedule longer than 1 day; run 4 still collapsed to four ranges (2-30, 3-24, 4-18, 5-19 Nov), so the rule reduces the collapse (from 4 of 5 runs affected or sparse to 1 of 5) but does not remove it. 21-post corpus: 64 events, 112 schedules, 10 range-style schedules (before: 65, 113, 11). Per-post differences are single-run noise: DfWqTPwmTGj label single-event to program-lineup, Dfee4AWgVDC 0 to 1 events, DfbGnjPgY-H 1 to 0 events, DfWvab9H9tV 2 to 4 schedules; DfUZRaCmbh7 failed once with an unterminated-JSON response and reproduced the baseline (program-lineup, 1 event, 3 schedules) in 3 of 3 reruns.

One schedule per listed date (not a range plus weekdays) because the poster's dates are explicit and sometimes irregular, and a range without `applicableDaysOfWeek` is read as daily (PRD). The count stays small (a 20-row poster is at most about 20 schedules).

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test src/lib/ai-processor/build-gemini-request.test.ts` -- expected: all pass
- `pnpm --filter backend exec tsc --noEmit` and `pnpm --filter backend lint` -- expected: clean
- `npx tsx scripts/tmp-prompt-eval.ts samsat after 5` and `corpus after` (from `apps/backend`, with `SAMSAT_IMAGE_URL`, `OUT_DIR`, `SAMPLE_FILE` set) -- expected: the acceptance numbers above

## Suggested Review Order

- New prompt rule 4c: one schedule per listed date, range only for a stated period.
  [`build-gemini-request.ts:251`](../../apps/backend/src/lib/ai-processor/build-gemini-request.ts#L251)

- Assertions guard 4a/4b/4c wording against accidental edits.
  [`build-gemini-request.test.ts:368`](../../apps/backend/src/lib/ai-processor/build-gemini-request.test.ts#L368)
