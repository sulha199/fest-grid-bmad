# Epic 9 code review — hand-off to the nightly-eval session

From the Epic 9 code review (`epic-9-code-review-2026-10-23.md`). Everything on the code side (domain, backend, web) is fixed on branch `ccr-7467d77d-u04a85`. The items below are in files the nightly-eval work is already changing, so they were left alone to avoid conflicting edits.

## 1. Live extraction quality is poor (D1) — the main item

The only nightly run that reached real model output so far is run 39864337168 (22 Oct, `gemini-3.5-flash`): **5 of 9 fixtures and 4 of 6 variants drifted**. What the model actually returned:

| Prompt | Model output | What is wrong |
|---|---|---|
| "jazz or blues in a cafe this weekend, not workshops" | `{"op":"AND","types":["WORKSHOP"]}`, no caveat | the NOT is dropped and the excluded type is **included**; jazz/blues/weekend lost |
| "tech meetups this month, not seminars" | `{"op":"AND","types":["GATHERING"]}`, no caveat | date, category and NOT dropped |
| "concerts or exhibitions in Bantul this month" (variant) | `{"op":"AND","types":[]}` | nothing extracted |
| a 13-artist OR | `{"op":"OR","types":[]}` and the artist names returned as caveats | names put in the wrong field |

Notes:
- Gemini **accepts** the unrolled response schema (no 400), so "schema too large" is not the problem.
- Production default is `gemini-3.5-flash-lite` (`apps/backend/src/env.ts`), weaker than the eval's `gemini-3.5-flash`; the workflow does not set `GEMINI_MODEL`/`GEMINI_FILTER_MODEL`, so the eval and production may be measuring different models.
- The model repeatedly returns `{"op":"AND", <leaf fields>}` with no `children`: leaf fields on a group node. The backend now handles that shape, but it suggests the schema invites it (every level declares both group keys and all leaf fields).
- Prompt gaps (`apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`): the old out-of-vocabulary caveat guidance (price thresholds, room/floor, absolute dates, time of day, holiday names) was dropped; "rest of this month" (= `TODAY` + `spanAmount 1` `spanUnit MONTH`) and `temporalFilter` are never demonstrated; few-shot examples have no span, weekday or temporal case.

Options (the user was asked and referred it here): iterate prompt/schema against the eval (recommended), raise `GEMINI_FILTER_MODEL`, or accept and track.

## 2. Small, mechanical pieces in the same files

- **Prompt says the opposite of the SQL** (`build-filter-extraction-request.ts`, the NEGATION line): it says NOT "ALSO excludes events that have NO VALUE ... (NULL is never treated as a match)". SPEC, `filter-vocabulary.md` and the SQL (`ne`/`notIn`, and now `NOT COALESCE(..., false)`) all say **NOT keeps events with no value**. Fix the sentence.
- **`radiusMeters` in the response schema** is a bare `INTEGER`; add `minimum: 1`. The backend already drops a non-positive radius with a caveat, so this only stops the model producing it.
- **Drift signature is blind to the feature's core risk** (`packages/domain/src/ai-event-filters/golden-prompts/compute-golden-prompt-drift.ts`): it compares only the sorted set of leaf field names and whether any caveat exists, so a lost NOT, an OR flipped to AND, or a NOT turned positive all report "no drift". Compare a canonical operator/polarity shape as well (e.g. a normalized string such as `AND(type,NOT(type))`), keeping free-text values out of it.
- **Workflow/script hardening**: `run-golden-prompt-live-eval.ts` header still says `pnpm --filter @festgrid/backend` (the package is named `backend`); the job has no `timeout-minutes` and no `permissions:` block (add `contents: read`); it is bound to `environment: production` (an approval rule there would block the nightly forever).

## What already changed on the branch that you may notice

- `transformGeminiResponseToFilterExpression` now degrades instead of throwing or looping, keeps a multi-field leaf under an `OR` together as an `AND`, and reports every fragment it drops as a caveat. Two golden fixtures changed (`or-en-02`, `or-id-02`): their old `expected` encoded the bug (`OR(MARKET, FOOD, HOBBIES)`); they are now `OR(AND(MARKET, FOOD), AND(MARKET, HOBBIES))` and `OR(AND(PERFORMANCE, free), AND(EXHIBITION, free))`.
- `validateFilterNode` is stricter (no unknown `op`, meaningful keyword, bounded text, lat/lng range) and returns a clean node.
