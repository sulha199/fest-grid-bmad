# Audience, language and taxonomy POC: the plan (2026-10-21)

Gate for AD-42 (`festgrid-architecture-spine.md`, Rule 10). Nothing in AD-42 Rules 2 to 8 ships before this has run, been reviewed and passed. Written by the cloud session. **The thresholds in section 5 were adopted by the owner on 2026-10-21 as proposed** (audience country at least 95% exact, at least 90% on the foreign and shared-language strata, no critical error); the other bars are start values until the first run.

## 1. What it has to decide

| # | Question | Decides |
|---|---|---|
| A | Can the model plus the guards name the **audience country** (a code or `international`) and the `geoScope` of an event reliably enough to rank and filter by it? | AD-42 Rules 2 to 4; AD-39 Rule 8 |
| B | Does the **post's language plus the posting account's country** separate countries that share a language (Indonesian and Malay, English)? Does it fix the Indonesian post about a Denmark event? | The "who the post addresses" step of AD-39 Rule 8 |
| C | Are **tracks** (age, gender, stage) and `eligibility` right on real posts, not only the author's? | AD-42 Rule 2 and 3; the "for age N" filter |
| D | Are the model's six free **interest tags** stable and few enough to govern as a taxonomy (run to run, across similar events, against the 18 categories)? | AD-42 Rule 7 |
| E | Does the **sensitive screen** (a deterministic list plus a flag) catch religion, health and political tags without drowning ordinary ones? | AD-42 Rule 8 |
| F | What does the insight cost per post (tokens, seconds, 429s), and does the platform-key backfill fit the vendor's rate? | AD-42 Rules 5 and 11 |

## 2. What exists, and why it is not enough

* `audience-areas.ts` (prompt v2): 57/60 fully correct on its core set, 18/18 on a six-post held-out set, after guards. The posts were written or chosen by the author with the traps known; there is **no country field**.
* `tracks.ts`: the right number of tracks 24/24, no invented number 0/24; fully correct 18/24 raw, 12/15 out of sample with the range repair (15/15 afterwards is contaminated).
* The whole insight evidence is 33 labelled posts, one labeller, text only (the real pipeline also sends the face-blurred image), Jogja-heavy, Indonesian and English only.
* `country-signals.ts` reads pin countries; nothing yet reads language, currency, phone codes or time-zone abbreviations from a caption.

## 3. The labelled set

* **150 to 200 real events** from production posts, with the caption as it was at extraction. Strata (approximate counts, to adjust after the sampling query): local Indonesian (50); national contests held at a local venue (25); **foreign-located events posted in Indonesian** by curators, such as the BWF, Allianz Malaysia and Denmark Open posts (20); **Malay-language accounts** from Malaysia, Singapore or Brunei for the Indonesian/Malay pair (about 8 accounts, 8 posts each); **English-language accounts in Indonesia** aimed at people in Indonesia (expat, tourist and English-speaking local accounts; about 6 accounts, 5 posts each) and, as the contrast that lets the test fail, **English-language accounts aimed at other countries** (Singapore, Malaysia, Australia; about 4 accounts, 5 posts each), because English alone does not tell the country; online events (20); multi-country or "international" (10); mixed Indonesian-English captions and short captions (20); sensitive-topic events for Question E (20, overlapping the others).
* **Where the captions come from (decided by the owner 2026-10-21): the owner's machine, through `fetch-poc-posts.ts`.** Curator captions are cleared from the database after extraction (PRD 3.16), but the vendors still hold them. The script reads the production database **read only** to find an account's successful scraper runs, uses the run's stored `raw_output` where it exists, downloads the run again from Bright Data (snapshot id) or Apify (run id) where it does not, and starts a **new Bright Data scrape only for what is still short, after the owner types the number of accounts to confirm**. Accounts the database does not know (Malay-language, non-Indonesian, expat) are asked for and kept in a local file; they always need a new scrape. Everything lands in `apps/backend/scripts/poc-event-insight/local/` (git-ignored): the selected accounts, the reduced posts (url, username, date, caption, hashtags, content type, tagged place, photo count) and a run log of counts and snapshot ids with no caption. The caption never goes to the terminal, the repository or this conversation; only labels, model outputs and metrics come back. The folder is deleted when the POC ends.
* **Two labellers**, independent, labels frozen (committed with a hash) before any model run. `[PROPOSED 2026-10-21]` The owner labels everything; the second labeller (the owner's wife, if she agrees: fluent in Indonesian, comfortable with English) labels the **held-out half** (about 80 to 100 events, the half the thresholds are scored on, including every foreign-located, shared-language and sensitive event), without seeing the owner's labels or any model output, and they do not discuss labels until both have finished. Report agreement (Cohen's kappa) per field and adjudicate disagreements once. The second labeller is `[OPEN]`: a person the owner names; a model is not a second labeller (it is the thing under test).
* **Fields labelled:** audience country (code or `international`), `geoScope`, the post's language(s), the target area level (country, province, regency, city, none), `eligibility`, the number of tracks with their age bounds where written, cost tier, and for Question E whether the event touches a sensitive topic. Interests are not labelled by hand; they are measured for stability and coverage.
* **Held-out half** chosen by a fixed hash of the post id, before looking at any output. Prompts and guard rules may be tuned on the other half only.

## 4. Procedure

1. Cloud session: extend the POC code with the country field, `postLanguage`, the cue extractors (currency, phone code, time-zone abbreviation, hashtag) and the ladder, with unit tests on fixtures; write the scoring script that reads labels and model outputs only (no captions).
2. Cloud session: `fetch-poc-posts.ts` (written and tested on a scratch database; brief `prod-readonly/local-session-brief-2026-10-21-poc-posts.md`). The owner runs it on their machine and chooses the accounts, so no sampling query is needed.
3. Owner and the second labeller label the set locally (a workbook per labeller, captions shown locally only).
4. Local session runs three extraction runs per event with the owner's key through the real request builder, the face-blurred image included for posts that have one; outputs saved without captions.
5. Cloud session scores the held-out half, writes the report, and measures Questions B, D and E (language/cue separation; tag stability and coverage; sensitive-screen precision and recall).
6. Reviewer Gate: rubric walker, adversarial two-units and data-integrity reviews of AD-42 plus the report; code review of the POC code.
7. Decision: AD-42 rules move from PROPOSED to ADOPTED, change or drop; then the second PRD pass and the stories.

## 5. Thresholds (the first three rows adopted by the owner 2026-10-21; the rest start values to confirm before the run)

| Measure (held-out half) | Proposed bar |
|---|---|
| Audience country exact match, all events | at least 95% |
| Audience country on the foreign-located and shared-language strata | at least 90% |
| Critical errors: an invented age; a wrongly `national` event; a wrong country on an event that states its audience; a non-verbatim quote | 0 |
| `geoScope` exact | at least 90% |
| Run-to-run agreement on audience country (3 runs) | at least 95% |
| Abstention (a claim a guard dropped) | at most 15%, reported apart from wrong claims |
| Language detection on Indonesian vs Malay with one extra cue | at least 90% on the Malay sample |
| Interests: mean Jaccard of the six tags between runs; share of tags that map to an existing canonical key; distinct tags per 100 events | reported; the taxonomy rule (AD-42 Rule 7) is set from them, no bar |
| Sensitive screen: recall on the labelled sensitive events | at least 95%; precision reported |
| Cost per post | reported (tokens, seconds, 429s) |

## 6. Limits to state in the report

A set of 150 to 200 events from one catalogue, mostly Jogja, one owner as the main labeller, one model (`gemini-3.5-flash-lite`; the larger model hit 503s before), text and image but no video, Indonesian and English only. A pass is evidence for launch, not a proof for other countries; the report says which strata have too few events to claim anything.

## 7. What it unblocks

AD-42 Rules 2 to 8 move out of PROPOSED; the second PRD pass (ranking, tracks, interests, taxonomy, the Settings switch) gets its facts; the stories can be cut.

## 8. Needs from the owner

1. ~~The thresholds~~ adopted 2026-10-21.
2. A second labeller: the owner's wife, proposed; needs her agreement and the labelling guide (to be written).
3. ~~Curator captions~~ solved: the script on your machine (read-only database, vendor re-download, a confirmed new scrape for what is missing).
