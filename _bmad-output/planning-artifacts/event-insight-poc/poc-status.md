# Audience, language and taxonomy POC: status and hand-off (single source of truth)

Last updated 2026-10-23. **Update this file at the end of every work session**, so any session (any account) can continue from it. The plan is `audience-and-taxonomy-poc-plan-2026-10-21.md`; this file is where things stand. Branch: `claude/ecstatic-shannon-e8eh9h` (no PR, no merge into `master`; see `open-core-split-plan-2026-10-21.md`, "Interim rules"). Backlog: IDEA-092 (this POC), IDEA-093 (taxonomy), IDEA-074/075/081/087 (the work it unblocks). Gate for AD-42 Rules 2 to 8 (`festgrid-architecture-spine.md`).

## Start here (new session)

1. Read this file, then the plan, then AD-42 in the spine (search "AD-42").
2. Follow the hard rules below. Do not open or print `.env`.
3. `git fetch`, merge `origin/master` and `origin/claude/ecstatic-shannon-e8eh9h` into the local branch if behind. Backlog IDs collide between master and this branch; renumber master's rows and note it in the row (see the 2026-10-23 merge commits).

## Status

| Step (plan §4) | State |
|---|---|
| 1. POC code: country ladder, language resolver, guards, schema | **Done** (committed `ae78bbf5`): `audience-country.ts`, `audience-insight.ts` + tests |
| 2. Gather posts (`fetch-poc-posts.ts`) | **Done**: 437 posts, 38 accounts, in `local/poc-posts.local.json` |
| 3. Label | **In progress, owner**: owner sheet 0 of 437 labelled; Claude drafted the tuning half (209) |
| 4. Extraction runs (3 per post) | Runner **built, not yet run** (needs the owner's Gemini key): `run-audience-poc.ts` |
| 5. Score and report | Scorer **built, not yet run**: `score-audience-poc.ts` |
| 6. Reviewer Gate (rubric walker, adversarial two-units, data-integrity, POC code review) | Not started |
| 7. Decision: AD-42 PROPOSED to ADOPTED / change / drop; then second PRD pass and stories | Not started |

## What the owner does next

1. Label `local/label-sheet-owner-tuning-sample.csv` (36 posts) **without looking at** `local/label-sheet-claude-tuning.csv`. Then `label-sheets.ts check`, and `compare --a local/label-sheet-owner-tuning-sample.csv --b local/label-sheet-claude-tuning.csv` to measure how far Claude's draft can be trusted (country agreement 95% or better = keep using it for tuning).
2. Label `local/label-sheet-owner-heldout-subset.csv` (122 posts; the scored set). No pre-fill, no look at any model output.
3. Second labeller (the owner's wife, if she agrees) labels the same 122 blind. Then `compare`, settle disagreements once, write `local/labels-final.csv`, run `label-sheets.ts freeze --sheet local/labels-final.csv`, **commit the printed hash** (`local/labels-frozen.sha256` holds it).
4. Run the extraction with the owner's key (commands below).
5. Bright Data: support ticket #751032 is open (outage since 2026-10-21); owner side of IDEA-101.

## What Claude does next

- After step 1 above: read the comparison; run `run-audience-poc.ts` on the tuning half; tune prompt and guards on the **tuning half only**; re-run until stable.
- After the freeze: run the held-out half (the gate allows it only against the frozen labels), score it, write the report (`results/` or beside this file, counts only), including the limits section.
- Run the Reviewer Gate on AD-42 plus the report, then code review of the POC code.
- Then the AD-42 decisions with the owner, the second `bmad-prd` pass, and stories (do **not** use `bmad-create-epics-and-stories` on existing epics).

## Commands (from `apps/backend`)

```
export DATABASE_URL=postgres://u:p@localhost:5432/x      # placeholder; the code never connects
# model runs: the key from the environment or --gemini-key, never from .env
GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/run-audience-poc.ts --half tuning --ids-from scripts/poc-event-insight/local/label-sheet-owner-tuning-sample.csv
npx tsx scripts/poc-event-insight/score-audience-poc.ts --labels scripts/poc-event-insight/local/label-sheet-claude-tuning.csv
# held-out (gated on the frozen hash):
GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/run-audience-poc.ts --half heldout --frozen-sheet scripts/poc-event-insight/local/labels-final.csv
npx tsx scripts/poc-event-insight/score-audience-poc.ts --labels scripts/poc-event-insight/local/labels-final.csv --half heldout
# no-model baseline of the deterministic steps:
npx tsx scripts/poc-event-insight/ladder-baseline.ts --labels scripts/poc-event-insight/local/label-sheet-claude-tuning.csv
# tests:
NODE_ENV=test npx tsx --test scripts/poc-event-insight/*.test.ts
```

`--dry-run` on the runner shows counts and time without sending. A full tuning half is 627 calls (about 48 minutes at the free-tier pace).

## Files

Committed (`apps/backend/scripts/poc-event-insight/`): `fetch-poc-posts.ts`, `label-sheets.ts` (+ `-lib`), `audience-country.ts`, `audience-insight.ts`, `audience-poc-lib.ts`, `run-audience-poc.ts`, `audience-poc-score-lib.ts`, `score-audience-poc.ts`, `ladder-baseline.ts`, and the older experiments (`audience-areas.ts`, `tracks.ts`, `country-signals.ts`, `guards.ts`, ...). Labelling guide: `labelling-guide-2026-10-21.md` (+ `.id.md`).

Local only, git-ignored, contain third-party captions (`apps/backend/scripts/poc-event-insight/local/`): `poc-posts.local.json`, `poc-accounts.local.json`, `label-sheet-owner.csv` (all 437), `label-sheet-owner-heldout-subset.csv` (122), `label-sheet-owner-tuning-sample.csv` (36), `label-sheet-claude-tuning.csv` and `claude-tuning-labels.tsv` (Claude's draft, 209), `tuning-half-to-draft.csv`, later `extraction-runs.local.json`, `labels-frozen.sha256`. These do not travel with git: a different machine starts without them. Never commit them.

## How the sets were built

- Halves: fixed hash of the post URL (`halfOf` in `label-sheets-lib.ts`): 228 held-out, 209 tuning. Prompts and guards may be tuned on the tuning half only.
- Owner held-out subset (122): all of contest, expat-id, foreign-id, malay-my, sensitive-church; a hash-ordered draw of malaysia 16, online 8, curator 30, venue 12. Not a pure random sample: per-stratum results are what the report cites.
- Claude's tuning draft: 105 of 209 rows flagged `unsure=yes`; the country column is the most reliable, `geo_scope` and `sensitive` the least. It was written with the same cues the ladder uses, so the ladder baseline (89.4% exact on it, 74.1% on the hard strata) is optimistic until the owner's blind sample is compared.

## Hard rules

- Never print or open `.env`. The key comes from `--gemini-key`, `GEMINI_API_KEY` or `SYSTEM_GEMINI_API_KEY`. Production database only through `PROD_RO2_DATABASE_URL` (read only) where a brief says so.
- No caption, hashtag, quote or tagged place goes into a commit, an issue, a report or a chat message the owner has not approved. Run records and reports hold enums, counts and post ids only.
- The labels are frozen (hash committed) before any run on the held-out half. A model is never a second labeller. Claude's draft is for tuning only.
- A new scrape costs money and is the owner's decision (`fetch-poc-posts.ts`).
- Planning isolation: this work changes POC scripts and documents only; no production code.

## Decisions and open items

- Adopted 2026-10-21: thresholds for audience country (95% exact; 90% on foreign and shared-language strata; no critical error). Start values to confirm before the run: geoScope 90%, run-to-run 95%, abstention 15%, Malay language 90%, sensitive recall 95%.
- **Open:** one set of cost-tier cut-offs for AD-42. `insight-schema.ts` v2 uses Rp 100,000 / 500,000; the labelling guide and `audience-insight.ts` use Rp 50,000 / 250,000.
- **Open:** the second labeller's agreement (the owner's wife).
- **Open:** FIND-093, the repository is public while it holds the premium plans (see the open-core plan).
- Known limits for the report: text only (no face-blurred image), one standalone call per post rather than the production combined call, every post scored as an event, one model, one main labeller.
