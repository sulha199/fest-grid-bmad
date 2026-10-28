# Audience, language and taxonomy POC: status and hand-off (single source of truth)

Last updated 2026-10-28. **Update this file at the end of every work session**, so any session (any account) can continue from it. The plan is `audience-and-taxonomy-poc-plan-2026-10-21.md`; this file is where things stand. Branch: `claude/ecstatic-shannon-e8eh9h` (no PR, no merge into `master`; see `open-core-split-plan-2026-10-21.md`, "Interim rules"). Backlog: IDEA-092 (this POC), IDEA-093 (taxonomy), IDEA-074/075/081/087 (the work it unblocks). Gate for AD-42 Rules 2 to 8 (`festgrid-architecture-spine.md`).

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
| 4. Extraction runs (3 per post) | Runner **built, not yet run** (needs the owner's Gemini key): `run-audience-poc.ts` (prompt `audience-v2`) |
| 5. Score and report | Scorer **built, not yet run**: `score-audience-poc.ts` |
| 6. Reviewer Gate (rubric walker, adversarial two-units, data-integrity, POC code review) | Not started |
| 7. Decision: AD-42 PROPOSED to ADOPTED / change / drop; then second PRD pass and stories | Not started |

## Blind-sample result and the rules decided (2026-10-26)

Owner's 36-post sample vs Claude's first draft: audience_country 100% (35/35), age_written 100%, sensitive 94%, post_language 91%; cost_tier 67%, geo_scope 31%, eligibility 25%, target_area_level 3%, track_count 3%. The low ones were different readings of the guide, not noise. The owner settled them:

- **eligibility:** `open_to_public` unless a membership restriction exists; `unspecified` only for a non-event.
- **target_area_level:** ~~from the venue, then hashtags, then the posting account's coverage~~ **SUPERSEDED 2026-10-27** by the target-area spec (`target-area-spec-2026-10-27.md`): the labeller writes only the area the post STATES (`target_area_name`, `target_area_source`, `target_area_level` = the level of that name, the wider one when a name could be a city or its province); the venue, hashtag and account areas are derived by code. Reposts: use what the post shows; looking up the original account is out of scope (backlog IDEA-103).
- **track_count:** an event listing no categories is one tier open to everybody = 1. Not an event = `unclear`.
- **geo_scope:** a named venue = `venue_local`; only a city or area = `city`.
- **New column `is_event`:** ~~`no` = no schedule (recap, repost of a personal vlog, news, shop promo, greeting)~~ **AMENDED 2026-10-28** by the event-report decision below: `yes` = the post is about a specific event (it announces it or reports on it); `no` = it is not (a personal vlog, a shop promo, a greeting, general news). Event fields are not scored on `no` posts or on `report` posts. A schedule-less post that concerns a known event could link to it (backlog IDEA-102).
- **cost_tier:** may be read from the image; new column `cost_source` (caption / image / none). The model sees the caption only, so cost is scored on caption and none rows.

Done in code: sheet schema (`is_event`, `cost_source`), both guides, `sheet_xlsx.py`, model prompt `audience-v2` (isEvent, venue/hashtag/place context), scorer (event-only fields, track count normalised to at least 1, cost split). **Pending:** (a) owner fills `is_event` and `cost_source` in the v2 sheet and re-checks the changed columns; (b) Claude re-reads the tuning draft for geo_scope and target_area_level (draft v2 has them as `unclear` for now, so they are not scored) and re-checks its `is_event` guesses, which came from a keyword pass over its own notes and are rough; (c) re-run the comparison.

## Target-area change (2026-10-27) — applied on this branch

Spec: `target-area-spec-2026-10-27.md` (decisions, edge cases, evidence). Draft edits and where each landed: `target-area-edits-draft-2026-10-27.md`.

- **Split of work:** the model (prompt `audience-v3`, `--prompt v3`, the default) reports only the areas the post STATES, with a verbatim quote; code derives everything implicit (`target-areas.ts`, `hashtag-places.ts`, `implicit-level-policy.ts`, `venue-resolution.ts`). Prompt `audience-v2` stays so earlier results can be reproduced.
- **Label sheet:** two new columns, `target_area_name` and `target_area_source` (`stated | stated_poster | none`); `target_area_level` is now the level of that name. Both guides and `sheet_xlsx.py` are updated. An older sheet without the columns is flagged "blank" until they are filled.
- **Scorer:** for v3 runs only, it adds the area source and the area name, compared through the gazetteer ("Jogja" = "DIY").
- **Policy changes:** a never-classified account is treated as a curator (reverses 2026-10-18); a large venue in DIY or DKI Jakarta resolves to the province; the gazetteer resolves a name inside its province (Depok in DIY is a kecamatan of Sleman).
- **Seed table:** 12 informal aggregates in `area-resolver.ts` whose member lists the owner must verify.
- **PRD:** Section 3.20 amended (target area as a mixed-level set, order, venue without an address, unclassified = curator, bio-stated audience area).
- **Owner to do:** re-label the 36 tuning posts for the three target-area columns (the 3% agreement on 2026-10-26 was a different reading of the old rule); add the 14 probe cases (spec section 7) as a separate sheet; fill the aggregates table check.
- **Not done:** the real gazetteer (Kemendagri/BPS), the geocoder wiring of `decideVenue`, account venue memory storage, profile enrichment (IDEA-075). Backlog: BUG-087, IDEA-105.

## Event report vs announcement (2026-10-28) — applied on this branch

Backlog IDEA-106 (detail in `implementation-artifacts/backlog/IDEA-106-event-report-post-kind.md`); PRD Section 3.18, bullet "Event Reports and News". Evidence: 78 of the 140 events in the 2026-10-28 prod stub-repeat clusters come from one results account.

- **Decision (owner):** a three-way value `announcement | report | mixed`; a report is attached to its event when one exists and promoted to an event when there is none. `isEvent` stays the outer gate.
- **Model:** prompt `audience-v3` (no model run exists yet, so it was extended in place) widens `isEvent` to reports and asks for `postKind` (`none` exactly when `isEvent` is false). Prompt v2 is untouched. Guard: `postKind` is kept consistent with `isEvent`; a `report` or `mixed` answer without results or recap wording is flagged log-only.
- **Label sheet:** new column `post_kind` after `is_event` (`announcement | report | mixed | none | unclear`); it must be `none` exactly when `is_event` is `no` (checked by `label-sheets.ts check`). Both guides and `sheet_xlsx.py` updated. A `report` row is labelled like a `no` row: only country, language, sensitive and unsure; `unclear` elsewhere. For a `mixed` post, label the event columns for the upcoming part.
- **Scorer (v3 runs):** `post_kind` accuracy; **announcements or mixed posts read as a report** (proposed bar 0: the upcoming event would be attached elsewhere or lost); reports or mixed read as announcements (reported); `report` rows leave the event-field denominators.
- **Owner to do:** fill `post_kind` on every sheet (an older sheet is flagged "blank" until it is filled), including your 36 tuning posts. Consider adding about 40 posts from a results account (for example `badminton.ina`) as a separate stratum, labelled blind: the current POC set may hold few reports.
- **Not done:** the production prompt, schema and ingestion path (report attach, report promote), the report-to-event matcher ("Day 2" must find the tournament), the one-off clean-up of the 119 existing stubs, and the production date cross-check. See IDEA-106 "Still open".

## Events described by several posts (2026-10-29) — prototype on this branch, rules proposed

Personalization plan Revision 11; backlog IDEA-111 (the Erafone Run 2026 Yogyakarta family, every event and post id recorded for a re-check after the race on 2026-10-31).

- **Prototype:** `merge-event-insight.ts` (+ test, 9 cases): the insight of one event from the insights of its posts. Organizer posts count, curator reposts only when there is no organizer post (sensitive topic excepted), a `report` post adds nothing; tracks are a union by label, cost is the cheapest tier, interests and stated areas are unions, and a clash keeps the primary post's value and is reported. The rules are a PROPOSAL until the owner answers the four questions at the end of Revision 11.
- **Not done:** the production version in `packages/domain`, storing each post's insight (Revision 11 #34), and a POC measurement of how often the posts of one event disagree (needs the owner's labels and the Erafone organizer posts as a labelled stratum).

## What the owner does next

1. Open `local/label-sheet-owner-tuning-sample-v2.xlsx` (your 36 labels carried over; two new empty columns `is_event` and `cost_source`). Fill those two, and revisit `geo_scope`, `target_area_level`, `track_count` where the rules above change your answer. Convert back: `python scripts/poc-event-insight/sheet_xlsx.py to-csv local/<name>.xlsx local/<name>.csv` (needs `pip install openpyxl`; the CSV is what the tools read). Do not look at `label-sheet-claude-tuning*.csv` until done.
2. Then `local/label-sheet-owner-heldout-subset.xlsx` (122 posts, scored set, blank, new schema). No pre-fill, no look at model output.
3. Second labeller (the owner's wife, if she agrees) labels the same 122 blind; `compare`, settle disagreements once, `labels-final.csv`, `label-sheets.ts freeze`, **commit the printed hash**.
4. Run the extraction with the owner's key (commands below). Bright Data ticket #751032 is open (IDEA-101).

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
npx tsx scripts/poc-event-insight/score-audience-poc.ts --labels scripts/poc-event-insight/local/label-sheet-claude-tuning-v2.csv
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

Local only, git-ignored, contain third-party captions (`apps/backend/scripts/poc-event-insight/local/`): `poc-posts.local.json`, `poc-accounts.local.json`, `label-sheet-owner.csv` (all 437), `label-sheet-owner-heldout-subset.csv` (122), `label-sheet-owner-tuning-sample.csv` (36), `label-sheet-claude-tuning.csv` and `claude-tuning-labels.tsv` (Claude's first draft, 209, old rules), `label-sheet-claude-tuning-v2.csv` (draft under the new rules, partly pending), `label-sheet-owner-tuning-sample (1).xlsx` (owner's first 36 labels), `tuning-half-to-draft.csv`, later `extraction-runs.local.json`, `labels-frozen.sha256`. These do not travel with git: a different machine starts without them. Never commit them.

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
