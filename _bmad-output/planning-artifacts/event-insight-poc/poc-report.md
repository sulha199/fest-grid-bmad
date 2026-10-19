---
status: complete (addenda 1-11, 2026-10-19, appended)
type: poc-report
date: 2026-10-18
model_under_test: gemini-3.5-flash-lite   # the production default (apps/backend/src/env.ts)
code: apps/backend/scripts/poc-event-insight/
raw_data: ./results/
design: ./proposal-personalized-discovery.md
---

# POC report — can Gemini extract audience insight reliably enough to rank on?

**Short answer:** yes for most fields, no for a few, and **not well enough to trust blindly**. Roughly **1 in 5 to 1 in 9 extracted insights contains at least one wrong field** (11–20% of runs; wide intervals), even though each field on its own scores 93–100%. That is acceptable only if the ranking built on it is bounded and low-leverage — which is how the proposal designs it — and only behind a golden-set gate.

> Read §7 (limits) and §8 (what I changed after seeing results) before quoting any number. Short version: ~33 posts, one labeller, text-only, and several prompts/guards/metrics were adjusted after looking at v1 output.

## 1. What was tested

| | |
|---|---|
| **Task** | Given a post's text, return an `EventInsight`: geo scope, target areas, eligibility, stated age bounds, gender restriction, cost tier, interest tags, audience segments, participation modes, languages, verbatim evidence quotes, confidence (schema: `insight-schema.ts`). |
| **Corpus (core, 27 posts)** | 17 **real** Instagram captions already in this repo (Jogja accounts: `infoeventjogja`, `plazaambarrukmo`, `slemancityhall` …; phone/bank/e-mail lines stripped) + 10 **synthetic** posts I wrote for cases the real set lacks (women-only, age floor, institution-only, online/national, venue-vs-artist-origin, expat/English, high price, vague vibe). |
| **Held-out (6 posts)** | Written *before* I analysed v1's failures, so a revised prompt could be checked on cases it wasn't tuned on. |
| **Ground truth** | My own reading of each caption (`labels.ts`), written **before** looking at outputs (except two smoke-test outputs), expressed as accept-sets where the text is ambiguous. |
| **Model / calls** | `gemini-3.5-flash-lite` (production default), default temperature, structured JSON output. Core: 3 runs per post = 81 calls per prompt version. |
| **Experiments** | **A** standalone insight call (accuracy, stability) · **A′** same posts on `gemini-3.5-flash` · **B** the *real* production extraction request (`buildGeminiExtractionRequest`) with `insight` injected into the per-event schema, vs the same request without it. |
| **Scoring** | Per field: *correct* / *abstained* (no claim where the label expects one) / *wrong*. "Critical" = would mislead or hide an event: invented age number, wrongly `restricted`, forbidden segment, invented area, invented gender restriction, or an evidence quote that isn't in the source. |

## 2. Results — standalone call (A), prompt v1, core set (81 calls)

| field | correct (raw) | wrong | after guards | stable across 3 runs¹ |
|---|--:|--:|--:|--:|
| geoScope | 94% | 5 | 94% | 25/27 posts |
| targetAreas | 94% | 5 | 94% (2 abstain) | 22/27 |
| eligibility | 95% | 4 | 95% (1 abstain) | 25/27 |
| segments | 98% | 2 | 98% (2 abstain) | **16/27** |
| age (min/max) | 95% | 4 | 99% (1 abstain) | 26/27 · 24/27 |
| genderFocus | 100% | 0 | 100% | 27/27 |
| interests (recall) | 99% | 1 | 99% | n/a (open vocabulary) |
| participationModes | 100% | 0 | 100% | **18/27** |
| costTier | 96% | 3 | 96% | 25/27 |
| evidence quotes verbatim | 100% (219/219) | 0 | 100% | — |

¹ share of posts where all three runs gave the identical value. Post-level intervals are wide: e.g. "all three runs correct" for geo/areas/eligibility is 25/27 posts, 95% Wilson CI ≈ 77–98%.

* **Strict "every field correct in the run":** 81% raw → **85% with guards**. **Critical errors: 4/81 runs raw → 0/81 with guards.**
* **Soft vs hard fields.** Segments and participation modes change between runs on 41% and 33% of posts (the model adds/drops `young_adults`, `community_members`, `families`…). Geo, eligibility, age, gender and cost are steady. → the design weights the unstable fields lightly.
* **Confidence is useless as a gate.** Mean self-reported confidence: **0.924 on fully-correct runs, 0.940 on runs with an error.** Never used.
* **Evidence quotes are a reliable groundedness tripwire** (100% verbatim, ≥1 quote on every call) but verbatim ≠ correct: a real quote can support a wrong claim.

### The wrong claims that did occur
| post | wrong output | note |
|---|---|---|
| `lomba-mewarnai` (kids' colouring contest, "PAUD/TK, 1–3 SD") | `ageMin 3, ageMax 9–10` (2/3 runs) | **inferred from school levels** — the text states no age |
| `syn-senam-lansia` ("usia 60 tahun ke atas") | `ageMax 120` | **invented upper bound** for a one-sided statement |
| `syn-webinar-nasional` | `restricted` (1/3 runs) | text says "terbuka untuk…" — would have flagged an open event as restricted |
| `fixture-drum-contest` | `geoScope national` (2/3), `areas []` | arguably defensible: audition is online, final in Yogyakarta (see §6) |
| `cald-conference` | `geoScope city`/`open_to_public` (3/3) | label says international/restricted; arguably a label call (see §6) |
| `futsal-mfc` | `costTier high` (3/3) | team fee Rp350–400k — per-team vs per-person ambiguity |

An adversarial case — Yogyakarta artists exhibiting in Jakarta — was handled correctly in all runs (`areas = [Jakarta]`, not Yogyakarta). One smoke-test run of the same post returned `geoScope national` ("terbuka untuk **umum**" read as geography), then passed 3/3 in the full run: **geoScope on "open to the public" wording is sampling-sensitive.**

## 3. Guards (deterministic checks against the source text)

`guards.ts`: verify evidence is verbatim; keep an age only if it appears next to an age word in a verified quote (n±1 next to an under/over cue); `restricted` needs restriction wording; gender restriction needs gender wording and forces `restricted`. All degrade toward *no claim*.

Effect, share of runs containing ≥1 **wrong** field (`results/wrong-claims.generated.txt`, Wilson 95% CI):

| prompt | set | raw | after guards | critical (raw → guarded) |
|---|---|--:|--:|--:|
| v1 | core (81 runs) | 16% (10–26) | **11%** (6–20) | 4 → 0 |
| v2 | core (81 runs) | 20% (13–30) | 20% (13–30) | 3 → 3 |
| v1 | held-out (18 runs) | 33% (16–56) | **17%** (6–39)² | 0 → 0 |
| v2 | held-out (18 runs) | 22% (9–45) | 22% (9–45) | 0 → 0 |

² includes one guard rule I added *after* seeing this held-out run (§8), so this row is not a clean test of the guards.

**Honest reading:** guards consistently help v1 and eliminate every critical error seen. They do nothing to v2 because v2's own prompt already blocks those errors — and one guard (`restricted` → `unspecified` without cue words) *hurt* v2 on held-out data (eligibility 100% → 83%) by demoting correctly-worded claims such as "Terbuka untuk pelajar SMA". The design therefore ships that one guard **log-only**.

## 4. Prompt v1 vs v2

v2 = v1 + clarifications written from v1's failure families (reach vs venue; "open to the public" ≠ geography; no invented ages; `restricted` needs limiting wording; ≤3 segments, prefer none to a guess).

| | v1 | v2 |
|---|--:|--:|
| core: wrong-claim runs | 16% | 20% |
| core: eligibility / segments / cost / geo (raw correct) | 95 / 98 / 96 / 94% | 90 / **83** / 93 / 98% |
| core: runs with an empty `segments` | 31/81 | **47/81** |
| held-out: strict fully-correct | 50% | **72%** |
| held-out: eligibility (raw correct) | 67% | **100%** |

**No prompt winner.** v2 reads better on the held-out set and worse on the core set; the intervals overlap. Its core regressions are almost all **abstentions** (segments left empty, as instructed), plus one definitional conflict: v2 says an age band is a restriction (as v1's rule already did), so the drum contest ("Dibuka untuk UMUM, Usia 7–16") comes back `restricted`, while my label says `open_to_public`. **That is a spec decision for the product, not a model error** (proposal §6.2). Conclusion: at ~30 posts prompt tuning is whack-a-mole; choose the prompt on the larger golden set in Story 10.1.

## 5. Piggy-back vs separate call (B), and the larger model (A′)

* **The enlarged schema is accepted.** 33/33 combined calls (27 core + 6 held-out) against the real production request returned a valid `events[].insight`; 0 schema rejections. (`build-gemini-request.ts` documents a past 400 from schema size — not triggered here.)
* **Marginal cost vs the same request without insight (paired):** v1 rules, n=27: **median +931 input / +242 output tokens, +0.4 s p50**. v2 rules, n=6: **+1.3k input / +208 output, +0.37 s**. **0 extra requests.** (A mean of +4 output tokens in the first run was an artifact: one baseline response ran away by ~7k tokens.)
* **Accuracy in the combined call** (text-only, 1 run, single-event posts): 84% strict (21/25), 1 critical (`ageMax 200` for "60 tahun ke atas" — the age guard catches it). Comparable to standalone; not a stronger test (n=1 run per post).
* **Standalone call:** ~1.2k input / ~0.24k output tokens, ~1.2 s p50 — this is the backfill cost per event.
* **`gemini-3.5-flash` (larger) — inconclusive.** 5/27 calls failed on **503 "high demand" and 429 quota**, not on quality. Where it answered it was ~5× slower (5.9 s p50) and used ~4× the output tokens (thinking), with *more* "restricted" over-claims (4 critical errors in its 22 usable calls, vs 4 in lite's 81). No evidence it is worth the cost.
* **Throughput:** the key was throttled at roughly 15 calls/min (429 with back-off); the whole study (~300 calls) took about an hour of wall-clock.

## 6. Where my labels are arguable (kept as written; not edited to fit)

| post | label | model said | why it is arguable |
|---|---|---|---|
| `cald-conference` | `international`, `restricted\|unspecified` | `city`, `open_to_public` | "free admission", registration; invites leaders "from across Asia". Both readings defensible; counted as 3 wrong runs on each of geo/areas/eligibility. |
| `fixture-drum-contest` | geo `city\|region\|venue_local`, `open_to_public` | geo `national` (2/3), `restricted` (v2) | **audition is online** → national is defensible; age band vs "UMUM" is the §4 definitional conflict. |
| `ho-layang-layang` | areas ⊇ {Bantul/Yogyakarta, Bali} | `[Jawa, Bali]` | I required the venue's area as well as the invited regions; the model listed only the invited ones (3/3 runs counted wrong). |
| `ho-esai-nasional` | `restricted\|open_to_public` | `restricted` | fine under the label; the guard turned it into an abstention. |

So the headline "wrong-claim" rates **overstate** error a little (several are label disputes) and **understate** it in another way (synthetic posts are clean and short; real posters are messier — §7).

## 7. Limits — what this does not show

1. **Text only.** The production pipeline sends the (face-blurred) poster image; much audience information lives on the poster. This POC never tested images (the committed image URLs have expired). Expect different, probably worse, numbers on poster-only posts. *First task of Story 10.1.*
2. **Tiny, self-labelled, regional.** 27 + 6 posts; one labeller (me); Jogja-heavy; Indonesian and English only; 16 of the 33 posts are synthetic and written by the same author as the prompt — likely easier than real data.
3. **Prompt/guard/metric adjustments after seeing results** (§8) → v2 and guarded numbers are optimistic on the core set; the held-out set is only partly clean.
4. **One model, one day, default temperature.** Gemini model updates can move every number; the proposal's nightly eval exists for that.
5. **Intervals are wide.** ±10–20 points on most rates. Differences smaller than that (v1 vs v2) are not evidence.
6. **Ranking quality was not measured** — only that the mechanism reorders sensibly on 4 hand-built personas. Whether personalisation improves engagement is the offline-replay and A/B question (proposal §5).
7. **Evidence of harm was not sought in the people dimension.** The model was instructed not to output attendee religion/ethnicity/etc.; the POC did not adversarially probe for it.

## 8. What I changed after seeing results (for transparency)

| change | trigger | effect on interpretation |
|---|---|---|
| Added guards (verbatim, age grounding, restricted cue, gender cue) | v1 invented ages/over-claimed `restricted` | guarded v1 numbers are post-hoc on the core set |
| Age guard accepts n±1 next to under/over cues; a verified age band keeps `restricted` | rescoring showed my own guard dropped a legitimate "di bawah 12 tahun → 11" and the seniors event | core guarded numbers tuned on core |
| Gender restriction ⇒ `restricted` | held-out v1: "khusus perempuan" returned `open_to_public` | held-out v1-guarded row not clean |
| Added the *abstained* category to the scorer | strict "fully correct" punished abstention as hard as error | metrics redefined after seeing v1/v2 |
| Prompt v2 | v1's failure families on core | v2 core optimistic; held-out is the fairer v2 test |
| Relevance prototype: geo reweighted (0.45 positive → 0.35, mostly negative; interest 0.35 → 0.45; window 14 → 21 days) | rank demo showed a runner and a parent in the same district got an identical top-6 | prototype weights are *demonstrative*, not tuned |
| `eligibility` guard shipped log-only | it cost accuracy on held-out v2 | design decision |

## 9. Ranking demo on the real extracted insights

Output: `results/rank-demo.generated.md` (v1 insights, guarded, four personas, 27 events with illustrative dates). Key table — rank of events each persona would plausibly care about (of 27):

| persona | event | chronological | personalised |
|---|---|--:|--:|
| runner (Sleman) | RSIH Mlayu-Mlayu run | 23 | 17 |
| runner | erafone Run | 24 | 20 |
| runner | Gowes Merdeka (cycling) | 9 | 7 |
| student (Yogyakarta, futsal/esports) | Vifation tournament | 27 | 16 |
| student | MPI Futsal Championship | 19 | 11 |
| student | PORSENI (basket/badminton) | 13 | 8 |
| parent (Sleman) | colouring contest | 21 | 10 |
| parent | Family Fun Day | 16 | 7 |
| parent | Tropical Playland | 5 | 2 |
| expat (Canggu) | beach-yoga dinner | 14 | **1** |

Observations: (a) anonymous/no-profile reproduces the chronological order exactly (unit-tested); (b) the lift is real but bounded — the runner's two running events stay below the top 15 because they are 4 weeks out and the discount is capped at 3 weeks (by design; tunable); (c) the **first** version failed (identical top-6 for runner and parent) because geo was over-weighted — see proposal §4.3; (d) a soft-signal error is visible: the parent's top result is a *seniors'* class, because the model tagged it `families`.

## 10. Reproduce

```bash
cd apps/backend
export DATABASE_URL=postgres://placeholder:placeholder@127.0.0.1:1/placeholder BACKEND_PORT=4001   # never connects
export SYSTEM_GEMINI_API_KEY=...        # live runs only; ~300 calls for the full study
npx tsx scripts/poc-event-insight/run.ts --set core --prompt v1 --runs 3        # also: --set holdout, --prompt v2
npx tsx scripts/poc-event-insight/rescore.ts --results <results.json>           # offline: raw vs guarded
npx tsx scripts/poc-event-insight/wrong-claims.ts "label=<results.json>" ...    # offline: wrong-claim rate + CI
npx tsx scripts/poc-event-insight/rank-demo.ts --results <results.json>         # offline: per-persona ranking
npx tsx scripts/poc-event-insight/run-tracks.ts --runs 2 [--holdout]             # live: age/eligibility as tracks (see addendum)
npx tsx scripts/poc-event-insight/rescore-tracks.ts <tracks-experiment.json>    # offline: with/without range repair
npx tsx --test scripts/poc-event-insight/*.test.ts                              # 82 tests, no network
```

Raw per-call outputs (insights, scores, tokens, latencies; raw response text omitted) are in `results/`. The corpus `corpus.real.json` contains public captions already present in this repo's `apify-runs`/`cc-024-reference-posts`, with contact-detail lines removed.

---

# Addendum (2026-10-18, after pulling master and the follow-up discussion)

Three things were added: **age/eligibility as tracks** (a live experiment), **area-first ordering** (prototype + demo on the real extracted insights), and **fixes to defects I found in my own guards**. Everything in §§1–10 above is unchanged and was re-verified (see A1).

## A1. Defects found in my own guards, and what they did to earlier numbers

While building the tracks experiment I found four bugs in the guard code reported in §3:

| bug | how it was found | fix |
|---|---|---|
| the role check ignored a number's role: `ageMax=45` passed for "usia 45 tahun ke atas" (a *minimum*) | a unit test I wrote for a stretched range failed | the number must fit its wording; a wrong-direction cue rejects it unless a right-direction cue is also present |
| cue words were substrings: `min` matched "**Min**ggu" (Sunday), `age` matched "package", `yo` matched "Toyota" | a music-class post failed after repair | whole-word boundaries |
| a literal backspace character corrupted three regexes | my own tooling (Python `re.sub` escapes) broke 7 tests | rewritten; checked for control characters |
| the role check's ±25-character window crossed clauses: in "KU II (16–18 tahun), **Senior (19+** tahun)" the neighbouring "+" rejected the 18 | out-of-sample run (A2) | judge the cue within the number's own clause (split on `, ; newline • |`) |

**Effect on the numbers in §§2–4:** none. After every one of these changes I re-ran `wrong-claims.ts` on all four result files and diffed it against the committed `results/wrong-claims.generated.txt`: **identical** — the fixes changed no outcome on the 81+81+18+18 recorded responses. (I have not worked out *why* beyond that; the diff is the evidence, not an explanation.) Tests went from 51 to 82; each bug has a regression test.

## A2. Age and eligibility as tracks (live, `gemini-3.5-flash-lite`)

Question (from the discussion): events qualify people in several ways at once — what should "age" be? Tested: tracks = separately-qualifying categories (alternatives across tracks; all criteria within a track; `lifeStages` for school levels instead of invented numbers; `allAges`). Schema and rules: `tracks.ts`; runner: `run-tracks.ts`; raw: `results/tracks-experiment.json`, `results/tracks-holdout.json`.

| set | posts × runs | usable | right track count | fabricated numbers | fully correct, raw | with deterministic range repair |
|---|--:|--:|--:|--:|--:|--:|
| tuning (8 existing + 4 new multi-category) | 12 × 2 | 24/24 | 24/24 | **0** | 18/24 | 24/24 ¹ |
| **held-out** (5 new, labelled first) | 5 × 3 | 15/15 | 15/15 | **0** | 6/15 | **12/15** → 15/15 ² |

¹ the repair was designed from this set's failures — optimistic.
² 12/15 is the clean out-of-sample figure (repair as designed, never tuned on these posts). The remaining 3/15 was the clause-scope bug in A1, found on this set and fixed; 15/15 after that fix is contaminated.

**What the model does well:** finds the right *structure* every time (39/39 runs: number of categories, which are gendered, school-level → life stage, "pelajar SMA atau mahasiswa" → alternatives, "tim mahasiswa maks. 25 tahun" → stage AND cap), and fabricates no numbers. A post with a time range and a price range plus "usia berapa saja" (the trap) returned `allAges` with nothing invented, 3/3.

**What it does badly, systematically:** for a **closed age range** ("usia 6–10 tahun", "5–8 tahun", "13–17 tahun", "10–19 tahun") it returns the minimum and **drops the maximum** — in 3 of the 4 posts with a closed range in the first set (the coding camp's "8–12" came back complete) and in all 3 closed-range posts of the held-out set. That is an abstention (safe), but it is the *main* signal for kids' events, so it needs a fix: numbers are cheap for code to read exactly, so `repairAgeRanges` fills the missing bound from a range literally written with an adjacent age word ("usia 6–10", "6–10 tahun"), and never overwrites a stated bound or acts on an ambiguous one. (A first version let "Rp100-250 ribu, usia berapa saja" fill `ageMax=250`; a unit test caught it, and the age word must now be adjacent.)

**Comparison with the flat design on the same kinds of posts (§2):** the flat schema produced `3..10` from "PAUD/TK + 1–3 SD" and `60..120` from "60 tahun ke atas", and cannot represent the fun run at all (`6..45` says an 11-year-old qualifies; with tracks `qualifies(event, {age: 11})` is correctly false).

**Not tested:** images (text only); `qualifies()` and the "for age N" filter are specified and unit-tested but not exercised on a real catalogue; the 17 labelled posts the tracks reuse are the same Jogja-heavy corpus.

## A3. Area first, then the sooner (prototype)

`relevance.ts` → `areaTier` / `rankAreaThenDate`; demo: `results/rank-demo.generated.md` (v1 insights, guarded, 27 events, 4 personas; dates are illustrative).

* Expat in Canggu: Bali yoga dinner **14 → 1**; 1 event in tier 0, 3 in tier 1, **23 in tier 2** (elsewhere).
* Yogyakarta users (runner / student / parent): **20 of 27 events are tier 0**, so the page is chronological with the 7 out-of-area/neutral events behind. The three personas get the same top six. Inherent to the rule: it separates regions, not people within a region.
* Unit-tested semantics: a **sibling district is "same region", not "own area"** (a Bantul event for a Sleman user) — found by re-reading my first implementation, which had classed it as own; country-level targets and national/online/unspecified are neutral, never "elsewhere"; no user ⇒ pure chronological; a strictly local event 60 days out outranks a national one tomorrow (the trade-off, pinned in a test).
* Depends on a fine enough **area ladder**, which production does not have today (proposal §9).

## A4. Updated limits and changes-after-seeing-results

* The tracks tuning set and A1's bug fixes were all informed by failures on the data they are then scored on; the only clean out-of-sample numbers in this addendum are the **held-out 12/15** and **0 fabricated numbers**.
* No new Gemini runs were made for the area-first demo or A1; both use the recorded responses.
* Not done: `setting` (indoor/outdoor) extraction (proposal §9.3), a live Geoapify probe for Indonesian admin levels (no key here), a reproduction of the `adminArea` AI-filter symptom against a real database (none here).

---

# Addendum 2 (2026-10-18, second discussion): venues, indoor/outdoor, online events, ordering v2

Questions answered here: *map venue type to indoor/outdoor? can an event have several venues? how should online events (Zoom) be ordered?* Code: `venues.ts` (+11 tests), `run-venues.ts`, `probe-online.ts`; ordering in `relevance.ts` (31 tests). Total offline tests: **98**. Raw: `results/venues-experiment.json`, `results/probe-online-extraction*.generated.txt`.

## B1. What production extraction emits today for online and multi-venue posts (live, 4 runs each)

Probe of the **unmodified** production prompt (`buildGeminiExtractionRequest`), reading `schedules[].location`:

| post | `location` emitted | runs |
|---|---|--:|
| Zoom-only class | `"Zoom"` | 4/4 |
| Google Meet-only discussion | `"Google Meet"` | 4/4 |
| hybrid seminar (Auditorium UGM + Zoom) | `"Auditorium Fakultas Ekonomi UGM & Zoom"` (once `… dan Zoom`) | 4/4 |
| 3-day festival, 3 venues | `null` on **every** schedule (place only in the title) | 4/4 |
| 2 venues on one day | `null` on **every** schedule (place only in the title) | 4/4 |

With an explicit location rule appended (probe only; product code untouched), 3 runs each: online → `location` absent **6/6**; hybrid → physical venue only **3/3**; festival → per-day venues correct **2/3**; two venues on one day **1/3** (the model collapses two venues on one date into one schedule).

**What I did not verify:** what the pipeline then does with these strings. From reading `resolveAccountAndLocations` (`schedule.location` → event location → *account default location*), a `"Zoom"` string is geocoded as an address and a `null` falls back to the account's default location; no database or Geoapify key was available to reproduce either. Recorded as **BUG-064** with that caveat.

## B2. Venues, attendance mode and indoor/outdoor (live, `gemini-3.5-flash-lite`, 35 posts × 2 runs)

Schema: `attendance ∈ {onsite, online, hybrid, unspecified}`, `venues[]` each `{name, kind (closed set), setting ∈ {indoor, outdoor, mixed, unknown}, scheduleLabel?}`, `onlinePlatform`. 29 existing-corpus posts + 6 new (hybrid, 3-venue festival, Zoom-only, route, Meet-only, two venues on one day).

| measure | result |
|---|--:|
| usable responses | 70/70 |
| attendance mode correct | 66/70 (94%) |
| venue count in the labelled range | 70/70 |
| **online platform listed as a venue** | **0/70** |
| **invented venue (name not in the post)** | **0/70** |
| every expected venue found with the right setting/kind | 60/70 (86%) |
| fully correct run | 56/70 (80%) |
| wrong indoor/outdoor call | **0** of 48 committed judgements; 10 abstentions (`unknown`) |

* **Denominators matter.** 29 of 32 expected venues had a restrictive setting label (the other 3 accept any). Zero errors in 48 committed judgements still allows an error rate of up to ~6% (95% bound). Setting labels are mine.
* **Misses:** all setting misses are abstentions — a hotel (`kind` right, setting unknown), an informal venue ("Omah Noto Plankton"), a co-working space, a museum with an outdoor event. The 4 attendance misses are a tournament post that names no place, where the model assumed `onsite` (label: unspecified).
* **Hybrid design works as intended:** the hotel case is exactly where a Geoapify category (`accommodation.hotel` → indoor) or an unambiguous-kind default would fill the model's `unknown`.
* **Not tested:** the Geoapify side. `categoryToVenue` is a draft table; only `commercial.shopping_mall` and `leisure.park` are confirmed (by IDEA-070's live probe). No Geoapify key was available, so no live category check was possible.

## B3. Ordering v2: merged local ladder → anywhere → other-local (prototype, unit-tested)

> **Superseded in part by Addendum 3 and 4:** B3 also offered an `onlinePlacement` option and put online events not aimed at the user in tier 1. Addendum 4 removed both: online is weighed by its audience.
> **Superseded in part by Addendum 3:** B3 unions the venues' areas into an event's areas. Revision 4 withdrew that — the order is by the *audience* area, with the venue only a fallback. The tiers, the online handling and the soonest-matching-stop date are unchanged.

Changes from §A3 after the discussion: **removed** the `most-local-first` split; **added** online/hybrid handling, a union over all schedules' venues, and "sooner" = the soonest *matching* schedule. Tiers: 0 local ladder (own/sub/containing/sibling merged, by date) · 1 anywhere (online/hybrid not targeted at the user's area, national/international, unspecified, no location) · 2 onsite-only targeted elsewhere; option `onlinePlacement` = `after-local` (default) | `with-local` | `last`.

* Demo (`results/rank-demo.generated.md`, attendance taken from the venues experiment): the Bali user's tier 0 has 1 event, tier 1 holds the webinar (online) and national events, tier 2 has 23 in-person events elsewhere; Yogyakarta users have 20/3/4.
* Tested semantics: a Zoom class *targeted at* Yogyakarta is tier 0; a Zoom class for Jakarta is tier 1, **not** other-local; a hybrid event in Jakarta is tier 1; a Jakarta-day + Sleman-day festival is local for a Sleman user and sorts on day 30, not day 2; the online option moves only remote events.
* The drum contest (online audition, hotel final in Yogyakarta) landed in tier 1 for Yogyakarta users in this demo only because the v1 run left its `targetAreas` empty; the venue's geocoded area would put it in tier 0 — an argument for the venue fallback.

## B4. Limits and changes after seeing results (this addendum)

* The venue labels were written before the run, but the 6 new posts and their labels are mine and are cleaner than real posters; text only; Jogja-heavy; one labeller.
* The probe's "explicit location rule" and the ordering rules for online events were designed from the probe/discussion, then unit-tested — there is no out-of-sample test of either.
* The earlier guarded numbers (§3) were re-verified unchanged after this round (`wrong-claims.ts` diff).
* Backlog: BUG-063, BUG-064, IDEA-073 added (`backlog.yaml` + two tier-1 notes); the checker's count of pre-existing failures is unchanged (69) and none are on the new rows.

---

# Addendum 3 (2026-10-18, third discussion): order by the audience's area; who may lend an event a location; the wrong-country report

Questions answered here: *how do we sort by the target audience's location instead of the event's? what should an event do for location when the post has none, for an organizer versus a curator? why does a curator lookup produce a wrong address or country?* Code: `audience-areas.ts` (+15 tests incl. the guards), `run-audience-areas.ts`, `rescore-audience-areas.ts`, `location-policy.ts` (+16), `relevance.ts` (audience-only `areaTier`, 32 tests), `area-demo.ts`, `probe-default-location.ts`, `probe-geocode-country.ts` (+4). Total offline tests: **134**. Raw: `results/audience-areas-*.json|.generated.md`, `results/audience-areas-guards-rescored.generated.md`, `results/area-demo.generated.md`, `results/probe-default-location.generated.txt`.

## C1. Where is the *audience*? (live, `gemini-3.5-flash-lite`, 3 runs per post)

A separate, smaller extraction: `geoScope` plus areas each with a `basis` (`stated`: the post says who it is for / open to / aimed at / invited from; `venue`: only when it states nothing and the event is plainly local). Scoring is strict about the cases this is for: a **venue-derived area on a nationwide/international event**, a **forbidden area** (the venue, a city in the account name, an artist's hometown) and a stated area that never appears in the post text.

| set (posts) | prompt | fully correct | geoScope | venue area on a nationwide event | forbidden leak | stated area not in text |
|---|---|--:|--:|--:|--:|--:|
| core, 20 — **tuned-on** (8 re-used + 12 written for this) | v1 | 50/60 | 56/60 | 0/60 | 0/60 | 0/60 |
| core, 20 — **tuned-on** | v2 | 57/60 | 60/60 | 0/60 | 0/60 | 0/60 |
| holdout, 6 — labelled before v2 was run | v1 | 12/18 | 15/18 | 0/18 | 0/18 | 0/18 |
| holdout, 6 | v2 | **18/18** | **18/18** | 0/18 | 0/18 | 0/18 |

* The posts cover the cases that motivated the change: a national writing contest held at UGM; a Jakarta concert with a Surabaya-only bus; a teacher training "se-Kabupaten Bantul" at a Yogyakarta hotel; a Zoom class for DIY and one open worldwide; a Jakarta–Bandung–Yogyakarta tour; a Melbourne community event; an account-name city leak; "Jabodetabek"; a post that names no place.
* **v1's 10 core failures** (50/60) were four things: a post naming neither place nor audience read as `national` (`ar-no-area-curator`, 2 of 3 runs; its holdout twin `hd-no-place-curator`, 3 of 3); a local exhibition read as `national` (`syn-pameran-origin`, 2 of 3); a continent not listed as an area (`cald-conference`, 3 of 3); and a bare neighbourhood name used as the locality (`ar-kotabaru`, 3 of 3; holdout twin `hd-prawirotaman`, 3 of 3). v2 adds three clarifications ("open to the public" is not geography; `national` needs nationwide wording and a post with no place is `unspecified`; a venue area names the city or regency); it was written after reading v1's misses on the core posts, so the core improvement is optimistic and **the holdout is the fair comparison** — and the holdout is six posts, so 18/18 is not an accuracy rate (95% upper bound on the per-post error rate: about 40–46%).
* **Remaining v2 misses (3/60): one post, `cald-conference`** — scope `international`, "Asia" not listed as an area. Harmless for ordering (international = "anywhere"), still a miss against my label.
* **Deterministic guard** (`guardAudienceAreas`; removes claims, never adds): `national` needs nationwide wording ("seluruh", "se-Indonesia", "nasional" — but not "Galeri Nasional"), a `stated` area must appear in the text, and `venue` areas are dropped next to a stated one or on a nationwide/online event. Re-scoring recorded runs: v1 core 50→52/60, v1 holdout 12→15/18, v2 unchanged on both (no guard action fired). **Written after seeing v1's national-for-no-place misses**, so its v1 effect is tuned, not held-out.
* Model confidence is not used anywhere. Text only; no images; Jogja-heavy; labels are mine.

## C2. What the audience-based order changes (`area-demo.ts`, v2 core, run 1, 22 events, illustrative days)

Per persona the tier under the new rule is shown next to the tier under the old (venue ∪ stated, account fallback for everyone): **3–4 of 22 events change tier per persona** — the national contest held at UGM, the international CALD conference posted by a curator, and an area-less curator post all become "anywhere"; for the Jakarta user the Surabaya bus trip drops from local to other-local. The rest is unchanged, which is expected on a pool made of the posts the prompt was tuned on. The old-rule venue areas for the four posts where the venue differs from the audience were entered by hand from the captions (`HELD_AT`); two rows are hand-made (the same area-less post from an organizer and from a curator with a stored Sleman location) to show the policy: the organizer's stays local, the curator's does not.

## C3. Curator versus venue: the default-location inference, measured (live, production prompt)

`probe-default-location.ts` runs the **production** inference prompt (`buildLocationInferenceRequest`) over 17 real posts, one post at a time, with the production gate (Gemini self-confidence ≥ 0.5):

| account | type | posts | places returned | applied |
|---|---|--:|---|--:|
| `@plazaambarrukmo` | venue | 4 | the same place (3 spellings) | 4/4 |
| `@slemancityhall` | venue | 1 | the same | 1/1 |
| `@infoeventjogja` | curator | 12 | **12 of 12 different** | 12/12, confidence 0.70–1.00 |

So for a curator the "account location" is the venue of whichever post ran first; the confidence gate cannot catch it. **One curator, Indonesian posts: a mechanism, not a rate.** Policy drafted and tested (`location-policy.ts`): organizers (confirmed) and unclassified legacy accounts may use/infer an account location, curators and accounts awaiting approval may not; organizers infer only on consensus across posts (`consensusPlace`).

## C4. The wrong-country report: not reproduced

I found six ways, by reading the code, for a geocode to land in the wrong place (no bias at all on the first-time geocode; bias is a preference, not a filter; best candidate by confidence alone with no floor; the stored default's country biases every later geocode; inference runs for curators; the gate is on Gemini's confidence not the geocoder's) and ruled one out (the cache key includes the bias). **I did not observe a wrong-country result.** There is no Geoapify key in this environment, and a keyless check against Nominatim returned HTTP 429 and was abandoned (its partial output was deleted and nothing from it is used). `probe-geocode-country.ts` and the SQL in BUG-066 are the first steps; the probe has been unit-tested for its URL building and selection logic only, never run against Geoapify.

## C5. Limits and changes after seeing results (this addendum)

* The prompt v2 clarifications and the guard were written after reading v1's failures on the core posts; the 6-post holdout (labels written before v2 was run, never edited) is the only out-of-sample number, and it is small.
* The account-type table, `ACCOUNTS` in `area-demo.ts`, and the persona areas are hand-made for the demo.
* Earlier numbers (guarded wrong-claims, tracks, venues, rank-demo) were re-verified identical after this round: `wrong-claims.ts` diff and `rank-demo.ts` regeneration both produce byte-identical output.
* Backlog: BUG-065, BUG-066, IDEA-074 added with tier-1 notes; the checker's count of pre-existing failures is unchanged (69) and none are on the new rows. No product code was changed.

---

# Addendum 4 (2026-10-18, fourth discussion): online by audience, never-classified accounts, country and reach from the profile scrape, a retry

Questions answered here: *should an online event get the same weight as its audience (local government vs national company)? what does a never-classified account mean? can the country be inferred from the initial profile scrape, and what if that scrape fails?* Code: `relevance.ts` (online special-casing and `onlinePlacement` removed; 31 tests), `location-policy.ts` (+`AccountReach`; 19 tests), `country-signals.ts` (10), `profile-insight.ts` (12), `run-profile-insight.ts`, `profile-retry.ts` (8), `profiles.real.json`. Total offline tests: **166**. Raw: `results/profile-insight-v1.json|.generated.md`, `results/area-demo.generated.md`.

## D1. Online events are weighed by their audience

`areaTier` no longer reads how an event is attended. Same audience ⇒ same tier whether onsite, online or hybrid, pinned by a test that the input type rejects an `attendance` field. Behaviour: a Zoom briefing for Sleman residents is tier 0 for a Sleman user and tier 2 for a Jakarta user; a webinar with no audience area is tier 1 for everyone. For an online event with **no stated audience**, `effectiveAudienceAreas` now takes the organizer's own area only when the organizer is a confirmed organizer whose reach is local or regional; a national company's head-office city is never an audience. Regenerating `rank-demo.ts` changed no tier count (27 events: 20/3/4 for Yogyakarta users, 1/3/23 for the Bali user) — the old online tier 1 and the new rule coincide when an online event has no audience area, as in that corpus.

## D2. What "never classified" means (code reading, not data)

> **Superseded by Addendum 6 on one point:** `mayUseAccountLocation(null, null)` is true again — never-classified accounts that already have a location are not changed.

`accountTypeStatus IS NULL` = no classification recorded: accounts that existed before Story 3.4n (grandfathered on purpose, AC5), discovered profiles, and any null profile nobody has subscribed to since. `isScrapableAccountType(null, null)` is true, so they are scraped. For location they are now treated as **unknown, not organizer** (`mayUseAccountLocation(null, null)` is false; the test that pinned the opposite was rewritten). Side finding FIND-086: `isCuratorGuide` in `process-ai-job.ts` reads `accountType` alone, so a never-classified curator keeps its captions. **Neither the count of null accounts nor the existence of such a curator is known**; the SQL is in the notes.

## D3. Country and reach from the initial profile scrape (live Gemini + offline signals, 16 profiles)

Corpus: 5 real (2 with a real profile payload from `apify-runs/`, 3 known only from post payloads so with no bio) and 11 synthetic that I wrote (handles end in `.demo`) to include a local government agency, a national company with a Jakarta head office, an Indonesian-language community in Melbourne, a Malay-language complex in Johor, an English-language studio in Bali, an English brand with no place, an empty profile. Labels were written before the run.

| | result |
|---|---|
| deterministic signals alone | resolved 13/16, **0 wrong country**; the other 3 are the placeless profiles, as labelled |
| model (`gemini-3.5-flash-lite`), 48 runs | **wrong country 0/48**; fully correct 47/48; reach right 47/48; a country no signal supports 0/48; national account given a place 0/48 |
| the miss | a placeless coffee shop whose reach was called `local` in 1 of 3 runs (label: unspecified) |

* **Limits that matter.** Signals and model agreed on every profile, so the test cannot say which to trust when they disagree; `resolveCountry` handles that and is unit-tested only. There is no real foreign account. Real bios are often decorative or empty; only two real bios exist in the corpus. The `place` table in `country-signals.ts` includes `kupang|flores|kartasura`, added after reading one real account (tuned). The model's real contribution is **reach**; for **country** the signals did all the work.
* **Order effect** (hand-made rows in `area-demo`, reach taken from the model's answer on the matching profile): a Sleman agency's area-less Zoom briefing is local for the Sleman user and other-local for Jakarta, Surabaya and Bali users; a national company's is "anywhere" for all four (the old rule put it in the Jakarta user's local group).

## D4. The retry

`profile-retry.ts`: transient failures retry after 15 min, 1 h, 6 h, 1 day, 3 days (a longer `Retry-After` wins), then go to a person; a permanent failure (not found / private) goes to a person immediately; a scrape that worked but showed no country is not re-scraped — it waits for the first scraped posts, three passes at most. Read from the code: today any failure of the profile call becomes `AWAITING_APPROVAL` and nothing retries it. The two other profile-scraper actors tried during Story 3.4n were rate-limited or returned nothing, so the primary actor's failures are not hypothetical. No new service is implied; I did not trace which scheduled job should host the sweep.

## D5. Limits and changes after seeing results (this addendum)

* `country-signals.ts` was tightened three times while I wrote it, before any run, by reasoning rather than from results: the Indonesian landline pattern would also match Indian area codes (dropped), "Singapore" counted as both a place and a country name (now country name only), and the `.id` domain rule was over-complicated (now `.id` at the end of the host).
* The synthetic corpus and its labels are mine; the real corpus is five accounts, all Indonesian.
* Earlier numbers re-verified identical after this round: the guarded wrong-claim table (`wrong-claims.ts` diff). The ranking demo changed only in labels, not in tier counts.
* Backlog: IDEA-075 and FIND-086 added with tier-1 notes; BUG-065, BUG-066 and IDEA-074 updated; the checker's pre-existing failure count is unchanged (69), none on the new rows. No product code was changed.

---

# Addendum 5 (2026-10-18, fifth discussion): legacy accounts by bulk update, the subscribers' country, a default time zone

Questions answered here: *the legacy accounts with no location are all Indonesian curators — do we need a backfill? should we record the subscribing user's country as a clue to the account's country? infer a default time zone too, since the country cannot supply it.* Code: `country-signals.ts` (+ subscribers' country; 15 tests), `timezone-signals.ts` (14), `profile-insight.ts` (prompt v2 with a time zone; 18), `run-profile-insight.ts` (`--prompt v2`, `--from`). Total offline tests: **191**. Raw: `results/profile-insight-v2.json|.generated.md` (the run as it happened), `results/profile-insight-v2-rescored.json|.generated.md` (the same recorded answers re-scored with the corrected guard).

## E1. Legacy accounts: no backfill

Taken as stated by the product owner (I cannot see the data): never-classified accounts with no location are all Indonesian curators. One transaction sets them to `CURATOR_GUIDE`/`CONFIRMED` (SQL with a before-state table, a guard against a concurrent subscribe and a rollback: IDEA-075; **not run**). From the code, what changes for them: scraping no; future captions cleared and images not re-hosted (3.4o); future events ingested as `stub` and no longer organizer-authored for primary-post choice and the first-organizer notification (`isOrganizerAuthoredPost`: "a NULL accountType is NOT curator-typed" — so until now they were treated as organizers). That second effect is a visible behaviour change; I did not check how the UI renders a stub event. Already-stored captions stay. Never-classified accounts *with* a location are outside the statement and stay null.

## E2. The subscribers' country

There is no country column on `users`; the country of a user's saved places is in `user_locations.location_details` and the device zone is `users.timezone`, so a subscriber's country is derivable on demand and nothing new needs recording (`countryOfUser`: saved places first, then the zone). As a signal it is deliberately weak — worth 1, needs 3 or more subscribers and an 80% majority, cannot resolve alone, cannot outvote a strong marker. *(Addendum 6: it is no longer a scoring signal at all but a last-option tie-break.)* The reason is the base rate: on a mostly-Indonesian platform nearly every account's subscribers are Indonesian, so the signal adds almost nothing and would mislead for a foreign community followed by Indonesians (unit-tested with eight Indonesian subscribers of a Melbourne account). **No production data was available; whether it ever matters is unmeasured** (query in IDEA-075).

## E3. A default time zone, inferred (live Gemini + offline signals, 18 profiles × 3 runs)

Corpus: the 16 profiles of Addendum 4 plus two written for this question — a curator listing events in **Java and Bali** (WIB and WITA) and a Papua community (WIT). Labels were written before the run. The label for a national organizer, the Java+Bali curator, the Flores/Kupang/Kartasura olympiad and the placeless accounts is *no zone*.

| | result |
|---|---|
| time-zone signals alone | zone resolved 11/18, **wrong 0**; the 7 unresolved are cases where the label allows no zone |
| country, signals alone | resolved 15/18, **wrong 0** |
| model, 54 runs, as recorded | wrong zone 0/54 — but 14 correct zones were discarded by my guard (see below), so "UNKNOWN where expected" read 14/54 |
| model, same answers re-scored with the corrected guard | **wrong zone 0/54**, UNKNOWN where expected 0/54; fully correct 51/54 (the 3 misses are reach calls on placeless or multi-region profiles); wrong country 0/54 |
| the traps | Java+Bali curator → `UNKNOWN` ×3 and signals "multi-zone"; national company → `UNKNOWN`; Flores/Kupang/Kartasura olympiad → `UNKNOWN`; an Indonesian shop with no place → `UNKNOWN` (language is not a zone); Papua → `Asia/Jayapura`; Bali studio → `Asia/Makassar`; the Indonesian-language Melbourne community → `Australia/Melbourne` |

**A defect of mine, found by the run.** `isVerbatimQuote` ignores quotes shorter than 4 characters, so the guard dropped every zone whose only evidence was the abbreviation itself ("WIB", "MYT", "SGT", "IST", "WIT"): 14 of 54 runs. Fixed with `isVerbatimEvidence` (a 2-3 letter quote counts only as a whole, case-sensitive token) and the recorded answers re-scored offline with `--from` — no new model calls. The fix was made after seeing the failure; the "wrong 0/54" does not depend on it (raw answers were already 0/54 wrong).

**Two further defects in `timezone-signals.ts`**, both fixed before the live run: the corpus showed that an ambiguous abbreviation ("IST" = India, Ireland or Israel) wrongly counted against the right zone because it also listed the other two (now a neutral vote for any zone it includes); and a unit test showed that 9 texts of 10 failed a 0.9 bar through floating point.

**Limits.** Same as Addendum 4: the signals and the model agreed wherever both spoke, so a disagreement is unit-tested, not measured; synthetic profiles are cleaner than real ones; there is no real foreign account; only two real bios. The place tables are mine and cover only the places in the corpus plus a handful: a production build needs a gazetteer (the geocoder already returns a zone for a place — the more reliable source when the account has one). `COUNTRY_SINGLE_ZONE` (Singapore, India, Malaysia) is a convenience that nothing in the corpus depends on.

## E4. Limits and changes after seeing results (this addendum)

* The bulk update and the history query are **unrun SQL**; column names were read from `packages/database/schema.ts`.
* Earlier numbers re-verified identical after this round: the guarded wrong-claims table. Addendum 4's v1 results file (16 profiles) is untouched; the corpus now has 18.
* Backlog: IDEA-075 widened (title and note) and its tier-1 note rewritten; BUG-065 and FIND-086 updated; checker failure count unchanged (69), none on the new rows. No product code was changed.

---

# Addendum 6 (2026-10-18, sixth discussion): the open questions answered — a tested bulk-update runbook, never-classified accounts left alone, an unresolved country geocodes with a preference and a floor, subscribers as the last-option tie-break

Decisions taken: **bulk update — yes; never-classified accounts that already have a location — not changed; unresolved country — preference + floor; subscribers' country — tie-break, last option.** Code: `location-policy.ts` (23 tests), `country-signals.ts` (18), `profile-insight.ts` (19). Total offline tests: **199**. SQL: `_bmad-output/implementation-artifacts/backlog/IDEA-075-legacy-bulk-update/`.

## F1. The legacy bulk update, tested

A real PostgreSQL 16 server (the sandbox has the binaries) was started on a scratch directory and the repository's **80 drizzle migrations were applied to it**, so the tables and columns are the real ones. Six made-up accounts were seeded (three never-classified without a location, one never-classified with a location, one confirmed organizer, one awaiting approval). `test-on-scratch-db.sh` re-runs all of this against any EMPTY scratch database and refuses to run if the schema is already present.

| scenario | result |
|---|---|
| `01-look` | lists exactly the three accounts without a location; not the one with a location |
| `02-apply`, happy path | the three become `CURATOR_GUIDE`/`CONFIRMED` with a NULL confidence score; the legacy account **with** a location, the confirmed organizer and the awaiting account are untouched |
| a second `02-apply` | refused (the backup table exists); nothing changes |
| `03-rollback` | restores the before-state |
| abort: set larger than `max_rows` | writes nothing, leaves no backup table |
| abort: an account started classification in between | writes nothing |
| abort: empty set | writes nothing |

Also run: **every SQL block in the four backlog notes** (BUG-065, BUG-066, FIND-086, IDEA-075 — 7 blocks, 12 statements) was executed, rolled back, against the same schema: each parses and every table and column resolves. That removes the "column names were only read from the schema file" caveat from the earlier addenda; it does **not** make any result known, because no production data was involved.

**What this does not show.** The seeded accounts are mine; "the set is all curators" is the product owner's statement and the first script exists precisely so it can be read before anything changes. The `\gset`/`\if` logic is psql 16 behaviour. The bulk update has **not** been run on production, and the sandbox cannot do that.

## F2. Never-classified accounts: three positions in one day

Addendum 3 kept them lending their location, Addendum 4 made them lend nothing, and now (decision) the ones **with** a location are not changed and the ones **without** become curators. `mayUseAccountLocation(null, null)` is true again and the unit test that pinned the opposite was rewritten back. The reach gate still applies to them. What stays exposed: a curator among the never-classified accounts that has a location — it keeps an arbitrary stored location and still escapes the curator minimization (FIND-086). `04-after.sql` lists such accounts whose events are scattered over five or more distinct cities, which is a lead to read, not a finding.

## F3. An unresolved country: preference + floor

`geocodePlan(accountCountry, homeCountry, floor)` returns a **filter** (`filter=countrycode:xx`, only that country's candidates eligible) for a known country and a **bias** (`bias=countrycode:home`, any country may win) for an unknown one; `decideGeocode` applies the floor in both cases and returns "unresolved" (text kept, no coordinates) below it. Nothing is hidden for lack of a country; a guess is never stored as a pin. Tested with synthetic candidate sets, including a foreign candidate that outranks a local one under the bias and an all-below-floor set. **The floor (0.5, the threshold `isLocationTrustworthy` already uses for the map link) is not calibrated**, and no Geoapify response was seen: that needs a key and `probe-geocode-country.ts`.

## F4. Subscribers' country: tie-break, last option

`collectSignals` no longer produces a subscribers signal. `applySubscriberTieBreak` is applied to a decision that is `weak` — exactly one country has any evidence, a single weak signal — and fires only if the subscribers' majority (3 or more, 80%) is that country; `resolveCountry` calls it last, after the markers and the model. Tested: a lone place name plus Indonesian subscribers resolves to ID; subscribers alone resolve nothing; subscribers of another country do nothing; a Melbourne community with an Indonesian-looking word and eight Indonesian subscribers stays unresolved; a decision that already resolved is never overridden. The recorded profile results did not move (the re-score of the v2 answers is byte-identical in its summary).

## F5. Limits and changes after seeing results (this addendum)

* Policy reversals are mine to own: `mayUseAccountLocation(null, null)` changed twice and two commits carry the intermediate version.
* The first version of the test script compared `psql`'s `t/f` output with the strings `true/false`; the run failed, and the script was fixed. The runbook SQL itself needed no change.
* Re-verified identical after this round: the guarded wrong-claims table; the v2 profile re-score summary.
* Backlog: IDEA-075, BUG-065, BUG-066 and FIND-086 updated to the decisions; checker failure count unchanged (69), none on the new rows. No product code was changed.

---

# Addendum 7 (2026-10-18, seventh discussion): can the AI filter keep partial matches, can freshness and "already seen" join the sort, and can the list endpoint carry it

Questions: (1) rather than eliminate an event that only partly matches an AI filter, keep it with a lower score; (2) combine the freshness of the post into the Discovery sort; (3) treat events already shown on screen as lower; (4) all of it without hurting `Query.events`, the most-used endpoint. Analysis: [`proposal-discovery-ranking-and-scale.md`](./proposal-discovery-ranking-and-scale.md). Code: `partial-match.ts` (11 tests), `discovery-sort.ts` (10), `perf-bench.ts`, `perf-variants.ts`, `perf-features.ts`, `perf-pagination.ts`. Total offline tests: **220**. No Gemini call was made in this round.

## G1. How the endpoint behaves today (scratch PostgreSQL 16.15, the repo's 80 migrations, `seed:volume`)

The harness runs the web client's own `getEvents` operation against the real schema and captures the SQL the resolver emits, so the baseline is today's query, not a copy. Tables: `results/perf-variants-*.generated.md`, `perf-pgbench-30k`, `perf-pagination-30k`, `perf-today-list-query*`.

| finding | measured |
|---|---|
| JIT compilation | 30k events, **anonymous plan**: **882 ms** with the server default (JIT on) vs **175 ms** off; the captured plan spends 717 of 909 ms compiling 79 functions. 8 clients: 4.4 vs 25 requests/s. *(Corrected in Addendum 8: a cliff set by plan cost vs 500k, ~50 ms below it and ~800 ms above; the signed-in plan paid 53 ms at 30k and 837 ms at 300k.)* |
| cost follows history | 120k events, 85% ended: 239 ms with JIT off; the plan reads every event, post and main schedule |
| no tie-break | 20 pages of 10: **48 events returned more than once, 98 of the true first 200 never returned** |
| a maintained key with an index of only still-open events | **0.4 ms** (30k and 120k mature); 2,084 requests/s at 8 clients. Without the pruning the same idea is **worse** than today on the mature catalogue (503 ms) |
| OFFSET vs keyset on the maintained key | offset 2,000: 18.7 vs 0.3 ms; offset 10,000: 130 vs 0.4 ms |

## G2. Partial matches in the AI filter

Semantics prototyped (hard / graded / binary leaves, weights 1–3, AND weighted mean, OR best, NOT strict, unknown data 0.5 and reported as unknown, close match = at most one unmet leaf and score ≥ 0.6) and unit-tested; worked example in the proposal §3.2. Cost on a four-leaf filter that matches nothing on the seed: scoring every visible event **140 ms (30k) / 458 ms (120k open)**; events matching ≥3 of 4 leaves 94 / 386 ms; **bounded to the 300 soonest events 6.1 / 5.2 ms (643 requests/s under load)**. Conclusion: yes, as a separate bounded lane, not inside `Query.events`.

## G3. Freshness and "already seen"

Bounded terms on top of the date (up to 7 days earlier for a fresh post, 14 later for a seen one, no push for events within 3 days). The window rule that lets an index serve them (window = 7 + 14 days) is checked against the full ranking on 300 random pools, and a test shows a smaller window is not exact. Cost at 30k: area tier 39.7 ms, + freshness 45.2, + seen 43.4; at 120k all open: 119.6 / 173.1 / 191.4. **Personalising only the next 60 days: 28.4 ms (30k), 66.9 ms (120k open); 14 days: 15.4 / 29.1 ms**; under load 76.5 requests/s against 34.7 when personalising everything.

## G4. Limits and changes after seeing results (this addendum)

* **Synthetic data, database only, one sandbox.** Ratios are the finding; the milliseconds are the machine's. The production `jit` setting and data shape are unknown.
* **A wrong measurement was caught and redone.** The first run of the feature benchmark located the visibility predicate with `indexOf(' where ')`, which matched the `WHERE` inside the select list's favourites sub-select; the queries still ran and returned 21 rows, so nothing failed — a syntax error in a later variant exposed it. The code now anchors on `' where (EXISTS'` and every figure above is from the re-run.
* The first pagination run used a page size of 20; the client uses 10, so the script gained `--size` and the quoted run uses 10.
* The windowed (P3b) variant did not pay at 30k (no gain, worse at offset 200) — which is why the horizon variant (P3h) was added *after* seeing that result. It is therefore a post-hoc comparison, not a pre-registered one.
* One of my own tests asserted an ordering that the weights do not produce (a date one day late and a missed `isFree` both cost 1/9). The test was rewritten to assert the equality as a tuning fact, and the proposal §3.2 says so.
* **Not measured:** the write side of a maintained key, freshness through the `posts` join, the relaxed-candidate query for close matches, users with a hide-past grace above 0, any effect on user behaviour. The bounded lane as measured covers only the 300 soonest events (about 2–3 days on the seed), so its latency is real and its coverage is not the final design's.
* Re-verified identical after this round: the guarded wrong-claims table. Backlog: **FIND-087, BUG-067, IDEA-076, IDEA-077, IDEA-078** added; checker failure count unchanged (69), none on the new rows. No product code was changed.

---

# Addendum 8 (2026-10-19, eighth discussion): the pre-subscription forecast turned into events and traffic; what one page request costs statement by statement; per-user scoring budget; ids-then-hydrate; PostHog utilization

Questions: how PostHog should be used; how many events the forecast implies and what limits `getEvents` under complex filters and per-user scores; whether returning ids + last-update and hydrating separately (with a frontend cache) is worth it; whether skipping `totalCount` matters; whether the current stack is enough; plus follow-ups on the four open questions (stub events and location, the retry sweep's scope, the geocode confidence floor, stored captions). Analysis: [`proposal-posthog-and-list-scale.md`](./proposal-posthog-and-list-scale.md). Code: `perf-request.ts`, `perf-scoring.ts`, the new ids-only I-series in `perf-features.ts`. Raw tables: `results/perf-request-*`, `perf-features-*`, `perf-scoring-*`, `perf-pgbench-scoring`, `perf-variants-300k-month12`. No Gemini call was made.

## H1. What the measurements added

| finding | measured |
|---|---|
| **history, not only visibility** | the same 22k open events: a page statement of 204 ms (anonymous) / 167 ms (signed in) at 30k total events becomes 545 / 581 ms at 300k (JIT off) |
| **`totalCount`** | the shared `GetEvents` document selects it; Discovery never reads it; removing it saves 31–348 ms, 14–42% of a page's DB time (JIT off) |
| **JIT is a cliff** (corrects FIND-087) | +700–840 ms when the plan's estimated cost exceeds 500k, ~50 ms below; anonymous and signed-in plans cross at different sizes |
| **a write on the read path** | every signed-in `events` request runs `INSERT … ON CONFLICT DO UPDATE` on `user_settings` (FIND-089) |
| **per-user scoring** | ≈ 1.3–4 µs per scored candidate for a synthetic 12-term score; K ≤ 3,000 costs 5–40 ms; candidate generation can flip to a parallel seq scan (54 requests/s under 8 clients at 91k open) |
| **ids then hydrate** | ids-only on today's query saves nothing (164–280 ms regardless of K); hydrating 10 ids 0.3–0.5 ms with code that exists (Favorites); 200 ranked ids 21–52 ms once; ranking without joins only 10–35% cheaper |
| **foundation at "month 12"** (300k events, 22k open) | today 1,115 ms (JIT on) / 503 ms (off); maintained key + open-events index 0.5 ms; unpruned maintained key 1,926 ms |
| **PostHog today** | 96 capture sites, ~67 names; no page views, no impressions, favorites carry only `eventId`, no AI-filter result events, no timing |

## H2. Limits and changes after seeing results (this addendum)

* **My own earlier headline was too general.** "JIT is ~80% of the request" came from the anonymous plan; the signed-in plan at the same size paid 53 ms. Found by running the signed-in request through the harness for the first time. FIND-087 and the first-round documents carry the correction.
* **An arithmetic slip caught on re-check**: I first wrote the pipeline load as "17–25 posts per minute"; 24,403–35,949 posts a month is 0.6–0.8 per minute. The burst (a daily scrape landing ~800–1,200 posts within an hour, 13–20 per minute) is what matters, against the ~15 calls/min on which the POC's key was throttled.
* **A bad YAML row**: bracketed paths (`[locale]`) inside a flow sequence broke the board parser; the checker failed with a parse error rather than a count. Quoted, re-run: 69 failures, none on the new rows.
* The rebuilt scratch databases use different random draws, so a re-run moved some variants by up to ~50% and the windowed variant (P3b) by 5× (8.9 vs 43.5 ms). Differences below ~30% are not findings.
* **Not measured**: the write cost of a maintained key and `content_version`; fixed per-call overhead (API Gateway, Lambda, JWT); scoring over JSON-stored features; production `jit`, pool size and storage limit. Events per post (1.0), lead time, daily-active share, session shape and the push-burst figure are my assumptions.
* Re-verified identical after this round: the guarded wrong-claims table. Backlog: **FIND-088, FIND-089, IDEA-079, IDEA-080** added and FIND-087 corrected; checker count unchanged (69). No product code was changed.

---

# Addendum 9 (2026-10-19, ninth discussion): the audience's target area and how to map it to a level; preventing slow scans; the total count again

Decisions taken: stub events matter through the **audience's target area**, not the curator's location; the N-minute retry schedule is accepted; stored captions are "cleared at next re-extraction"; PostHog is approved; slow table scans are to be prevented proactively; and the total count is to be re-analysed with a `hasNextPage`-style flag in place. Analysis: [`proposal-target-area-and-scan-safety.md`](./proposal-target-area-and-scan-safety.md). Code: `area-resolver.ts` (9 tests), `area-resolver-eval.ts`, `plan-guard.ts` (9 tests), `plan-guard-run.ts`, `perf-candidates.ts`, and a count series in `perf-features.ts`. Total offline tests: **238**. No Gemini or Geoapify call was made (this is a cloud session: no key, and the user's local `.env` is out of reach).

## I1. Defining the target area

On the recorded audience-area runs (73 area mentions, 21 distinct strings) the model's level label **agreed with a gazetteer 47 times, was wrong 8 times** (Jabodetabek and Java called provinces, Canggu called a city or a regency), was **ambiguous 9 times** ("Yogyakarta") and **definitional 6 times** (Jakarta); 3 mentions are outside the Indonesian sample. Design: the model reports the name and scope; a gazetteer resolves it to canonical keys with ancestor paths and takes the level; aggregates are sets; ambiguity is flagged and ruled; foreign names go to the geocoder. The sample gazetteer is hand-typed **after** reading those names, so its coverage is fitted, not held out.

## I2. Slow scans

Candidate generation by array overlap reads the whole candidate pool from K ≥ 1,000 on 91k open events (28–42 ms, 16,845 rows scanned; 178 requests/s at 8 clients); a junction table of audience-area keys with per-rung ordered range scans does 1.0 ms at K=1,000 and 2.3 ms at K=3,000 (4,108 and 1,708 requests/s). The plan guard fails all four of today's Discovery statements at 300k events (sequential scan of 300,012 events, cost 523k–765k, 33–105 JIT functions, 52k–405k rows scanned for 1–11 returned) and passes the junction query.

## I3. The total count

`hasMore` (from the extra row) already is the `hasNextPage` flag, and nothing reads `totalCount` from the shared `getEvents` document. The count is 20–33% of a page's database time today and would be about 98% of a request once the foundation brings the page to 0.4–0.6 ms; even a capped count is plan-fragile (2.0–53.7 ms).

## I4. Limits and changes after seeing results (this addendum)

* **Two earlier statements corrected**: stubs normally do have a date and a place (the extraction prompt skips roundup items without both), and the UI does treat roundups on the detail page.
* **The first summary line of the area evaluation was misleading** ("26 of 73 do not agree") because it counted ambiguity, a definitional difference and a foreign place as disagreements; it was replaced by five classes (47 / 8 / 9 / 6 / 3).
* **The plan guard's first rule set missed the 91k case**: that build's slow form was a bitmap scan of the whole pool, not a sequential scan, and 17× amplification is under the 2,000× ratio. An absolute per-query scanned-rows budget was added after seeing it.
* **A first run of the count series failed** (a missing FROM entry for the filter predicate) and was fixed before any figure was used.
* The plan flip seen on an earlier build (a parallel sequential scan) did not recur on the rebuilt databases; only the whole-pool scan did. The finding is the fragility, not one plan.
* **Not measured**: the write side of the junction table; the geocoder half of area resolution; a held-out gazetteer evaluation; statement-timeout and `SET LOCAL` behaviour behind Supabase's pooler.
* Re-verified identical after this round: the guarded wrong-claims table. Backlog: **IDEA-081, IDEA-082** added; IDEA-079 `triaged`; FIND-088 re-analysed; decisions recorded on IDEA-075 and FIND-086; checker count unchanged (69). No product code was changed.

---

# Addendum 10 (2026-10-19, tenth discussion): the area ladder, multi-area events, whether the AI can extract it, roundup headings as a stated area, and what this session has access to

Decisions taken: a place in a roundup's heading **counts as a stated area** for items that state none. Questions answered: which levels to define, whether "Jawa" means several provinces, whether the AI can extract this, and what access I have. Analysis: [`proposal-target-area-and-scan-safety.md`](./proposal-target-area-and-scan-safety.md) §1 and §2.6–§2.9. Code: `run-area-kinds.ts` (live Gemini probe). Raw: `results/area-kinds-probe.generated.md`. Offline tests unchanged at **238**.

## J1. The probe (live `gemini-3.5-flash-lite`, 26 hand-written cases × 2 runs, my gold labels)

| | result |
|---|---|
| kind of area (admin unit, metro area, island, region, country, continent) | 36/36 runs |
| qualifier ("dan sekitarnya", "bagian selatan") | 35/36 runs (one "dan" misread as a qualifier) |
| covered units where graded (4 cases) | recall 92% over 8 runs, no extras; Jabodetabek 6/9 in both runs |
| role of a place in a roundup heading (coverage / audience / brand / none) | 16/16 runs, 0 leaks from the items into the heading's areas |

## J2. Limits and changes after seeing results (this addendum)

* **A misunderstanding corrected**: the user believed this session could read their local `.env` and reach the production database. It cannot and did not: every database figure came from a synthetic scratch PostgreSQL inside the container. The container's environment does hold a Gemini key (used here), and an Apify token and AWS credentials that were **not** used; their origin and scope are unknown to me and flagged for review.
* **The probe is easy mode**: short, clean, synthetic posts I wrote, one labeller, two runs per case, membership graded for four cases, headings supplied as post text (so the "model-written title" circularity of §2.6 is argued, not tested). The Jabodetabek 6/9 could not be explained: a rerun was rate-limited, so the raw lists were not inspected.
* The first rerun was cut off by a shell timeout and a second hit the key's rate limit; the saved report is the first, complete run (no error cells). A `--only` filter and a `--raw` dump were added to the script afterwards.
* Not measured: real roundup posts; model-written versus post-stated headings; the geocoder half of area resolution; a held-out gazetteer evaluation.
* Backlog: IDEA-081 reference added; checker count unchanged (69). No product code was changed.

---

# Addendum 11 (2026-10-19, eleventh discussion): a read-only production check, run on the user's machine, result passed back

Decision taken: the production check will run in a **local** Claude Code session (or the user's terminal); the result comes back to this session through the chat or through git. Runbook: [`prod-readonly/README.md`](./prod-readonly/README.md). Code: `prod-readonly-check.ts`, `prod-ro-env.ts`, `readonly-policy.ts`, `scratch-guard.ts`. Total offline tests: **250**.

## K1. A flaw in my first version, found before anyone ran it

The first version of the check took `DATABASE_URL` from `loadBackendEnv()`. That loader runs **at import time** (the app's db client imports it) and reads the repository's root `.env` — which, on the user's machine, holds the application's own owner-privileged production URL. If the read-only variable had been forgotten, the check would have connected as the owner and only then refused (the role guard), after one `SELECT`. It now takes its URL **only** from `PROD_RO_DATABASE_URL`, loaded by a preload module imported first; it refuses a missing variable and any user name that does not start with `festgrid_poc_ro`; it masks the host in its report. Verified: with `DATABASE_URL` and a repository `.env` pointing at two other ports, the check dialled only the read-only URL; without the variable, or with a wrong role name, it stopped before any connection; against a scratch PostgreSQL built from the repository's migrations the whole pack ran under the role and the owner role was refused.

## K2. Limits (this addendum)

* Verified on a scratch PostgreSQL only. **Not verified**: Supabase row-level security on these tables, the pooler's handling of `SET LOCAL`, `pg_stat_statements` access, and that production's schema equals the repository's migrations.
* The hand-back by git puts production aggregates into the repository history; the runbook says so and offers the chat as the alternative.
* The statement policy is a keyword/function deny-list over single statements, backed by the read-only role and `BEGIN READ ONLY`; it is a belt-and-braces check, not a SQL parser.
* No product code was changed; backlog IDEA-083 and FIND-090 as registered; checker count unchanged (69).

---

# Addendum 12 (2026-10-19, twelfth discussion): the production report and the event-group plan (AD-36), verified

Full review: [`prod-findings-review-2026-10-19.md`](./prod-findings-review-2026-10-19.md). Nothing in AD-36 or in the product owner's report was edited; amendments are proposed there.

## L1. What the checks changed

* **The double encoding is not the pooler** (and the repository already fixed it on three columns on 2026-08-29: see Addendum 14). Drizzle 0.30.10's `jsonb` stringifies and postgres.js 3.4.9 stringifies again; reproduced with `prepare` on and off, and cured by pass-through serializers for OIDs 114 and 3802 (what Drizzle ≥ 0.33.0 installs). It affects all 27 `jsonb` columns in every environment, not one column in production (BUG-068, note `backlog/BUG-068-…md`; probe output `results/jsonb-encoding-probe.generated.md`). The fix order (writer first, then rows) is rehearsed in the probe.
* **The production-size numbers.** A scratch database with production's row count answers a Discovery page in about 8–10 ms (`results/perf-request-prodsize.generated.md`), production `jit` is off and production's open set is 431: the scale items (IDEA-076, IDEA-082, FIND-088) lose urgency; data quality (BUG-068, BUG-066, duplicates) gains it.
* **The "5% recall" is not the matcher's recall.** It counts same-name pairs the matcher cannot reach by design (created before it ran, siblings of one post, dates more than two days apart). `results/prod-findings-review-2026-10-19-queries/recall-classes.sql` splits them; it is validated on a synthetic fixture only.
* **AD-36 has ten gaps** (anchor not handled by a merge, per-event notifications multiplied by the reshape and contradicting a PRD rule, a weak dedup gate, an unworked moderator queue, Discovery flooding, an undefined Tier 2 anchor source, a venue test on broken location data, no index plan, a small Tier 1 sample, non-deterministic extraction).
* The production pack was corrected (events per post, a JSON-encoding item, normalized location reads) and re-run as the least-privilege role on the scratch database.

## L2. Limits (this addendum)

* No production access: the report's numbers were checked for consistency, not re-measured. (Superseded by Addendum 13: the production run confirmed 1.08 on the pack's own definition; the report's 1,364 posts count something else.)
* Drizzle versions between 0.31.0 and 0.33.0 were not checked; every process that creates its own postgres.js client needs the same serializer line.
* The recall classes, the notification and flooding gaps, and the group-collapsing proposal are reasoning and one synthetic fixture, not measurements on production.
* Checker count unchanged (69); no product code changed.

---

# Addendum 13 (2026-10-19, thirteenth discussion): the production checks came back (pack SQL as `readonly_2`, recall classes, geocode probe)

Full analysis: [`prod-check-results-review-2026-10-19.md`](./prod-check-results-review-2026-10-19.md). Raw results: `results/prod-readonly-report-2026-10-19.md`, `results/recall-classes-prod-2026-10-19.txt`, `results/geocode-probe-2026-10-19.md`. Run by a local session on the owner's machine; I re-ran nothing against production.

## M1. What the results changed

* **BUG-068 is confirmed on production** for all four columns the role can see: 2,231 of 2,231 non-null values are JSON strings, none an object or array. `with_admin_area` is 0 of 1,460 (BUG-063 confirmed); `with_venue_type` 37.
* **A bug in my own query, found by the output.** `recall-classes.sql` dated a pair by the larger-id event instead of the newer one; two pairs in "created before the first candidate" had a candidate row, which cannot happen. Fixed, regression fixture added (`recall-classes.fixture.sql`); the production classes must be re-run. The bound that survives: recall on reachable pairs is at most 23 / 168 ≈ 14%.
* **Hypothesis from the code, not yet measured:** a pair of duplicate roundup- or curator-sourced events can never reach the 'mid' threshold (0.25 + 0.15 = 0.40 < 0.45) because the organizer weight is discounted on purpose (BUG-058). `recall-class4-stubs.sql` tests it.
* **Geocoding:** 7 of 14 probe descriptions got the wrong place, only 2 of 42 picks were outside Indonesia (so the bounding-box test undercounts), a country filter does not help, and the two wrong *area phrases* scored 0.66 and 0.50, above the placeholder floor of 0.5. 627 of 1,460 stored pins (43%) have confidence under 0.5; with the 265 unpinned schedules, about half of all schedules have no trustworthy pin.
* The 1.08 events per post is confirmed (1,286 primary posts); my earlier "does not reconcile" was about the report's different post count.

## M2. Limits (this addendum)

* The pack's Discovery `EXPLAIN` verdicts were not run on production (the pack refuses `readonly_2`).
* The probe's right/wrong labels are my reading of formatted addresses; 14 hand-picked descriptions do not calibrate a floor.
* Sleman City Hall's US pin is unexplained: the probe geocodes it correctly. Round 2 (brief §7) has the queries and probe variant that test the explanations.
* Checker count unchanged (69); no product code changed.

---

# Addendum 14 (2026-10-19, fourteenth discussion): decisions taken on the production results, and a change of mechanism for BUG-068

Detail: [`prod-check-results-review-2026-10-19.md`](./prod-check-results-review-2026-10-19.md) §9.

## N1. What was decided, and what changed

* The product owner accepted my recommendations: BUG-068 is fixed **ahead of the personalization work**; IDEA-085 covers a sweep of the legacy duplicate pairs, a stub-scoring fix and the moderator queue; the 11 curator default locations are cleared after the BUG-065 code gate; the filtering and scoring discussion for events with a target area and no usable pin follows Round 2.
* **I changed the BUG-068 mechanism after the decision, and say so here.** My recommendation was a client-level pass-through serializer. Reading `deferred-work.md` afterwards showed the team had fixed the same bug on three columns on 2026-08-29 with an in-house `customJsonb` type (raw object to the driver, parse on read, a test, defensive reads, no data migration, "not schema-wide"); my probe shows the serializer route makes those three columns raise an error, and a Drizzle upgrade to 0.33 or later would too. `customJsonb` on the other 27 columns is migration-neutral (`drizzle-kit generate` on a temp copy: "No schema changes, nothing to migrate"; a swapped column stores an object and still reads a legacy string) and is proven on production for three columns. That earlier entry also explains the pooler hypothesis: it blamed `prepare: false`; the probe shows the cause is independent of it.
* Delivered: the implementation spec (`backlog/BUG-068-jsonb-columns-double-encoded-by-drizzle.md`), a tested row-migration runbook (`backlog/BUG-068-jsonb-migration/`: look, apply, rollback; 10 checks on a scratch PostgreSQL built from the 80 migrations, **not run on production**), IDEA-085's scope note, and the BUG-065 decision. BUG-068 and IDEA-085 are `triaged`.

## N2. Limits (this addendum)

* **Nothing is implemented.** The writer fix, the ratchet test and the regression test are specified, not written; no production write was made.
* The mechanical swap was verified on a temp copy of `packages/database` for migration-neutrality and on one table at run time; the full test suite was not run against a swapped schema.
* The migration runbook's `rest` columns were not sized on production; `01-look.sql` reports bytes first.
* Checker count unchanged (69).

---

# Addendum 15 (2026-10-19, fifteenth discussion): the BUG-068 writer fix, implemented

The product owner answered "do it" to the offer to implement the fix. **This is the first product-code change on this planning branch**; it is in its own commit so it can be reviewed, cherry-picked or reverted separately.

## O1. What changed

* `packages/database/schema.ts`: the 27 plain `jsonb()` columns are `customJsonb<T>()` (mechanical, balanced-bracket rewrite; the unused `jsonb` import is gone; the comment on `customJsonb` now states the real cause). `drizzle-kit generate` reports no migration.
* `packages/database/jsonb-columns.test.ts` (new, vitest): no column may be a `PgJsonb`; `customJsonb` hands the driver the raw value and parses a legacy string. Verified to fail on the old schema.
* `apps/backend/src/schema/jsonb-encoding.test.ts`: a DB regression test that writes through Drizzle into `schedules.location_details`, `events.links`, `social_media_account_profiles.default_location` and `posts.additional_image_urls`, asserts `jsonb_typeof` and that SQL-side `->>` and `jsonb_array_elements` see inside, and that a legacy string row still reads parsed. Run on a migrated scratch PostgreSQL 16; verified to fail on the old schema.
* `_bmad-output/project-context.md`: a rule that every jsonb column uses `customJsonb`.
* `apps/backend/tsconfig.json`: `scripts/poc-event-insight` is excluded. **A defect from my earlier turns:** the backend's `tsc` (its `build`) includes `scripts/`, and nine of my POC scripts use `import.meta`, which the backend's NodeNext/CJS config rejects, so `pnpm --filter backend build` would have failed. The POC scripts keep their own type-check command.

## O2. Limits (this addendum)

* Not deployed; **no production write**; the row migration (`backlog/BUG-068-jsonb-migration/`) is still to be run by the owner after the deploy.
* **Backend suite** (1,348 tests, migrated and seeded scratch PostgreSQL 16): everything passes except 21 tests in `geolocation.test.ts`, `social-media-accounts.test.ts` and `user-locations.test.ts`, which need a real Geoapify key (`GEOAPIFY_API_KEY is not configured`). A clean run of exactly those three files gives **the same 21 failures on the old and on the new schema** (51 tests, 30 pass, 21 fail both ways). The row-count ratchet reported one leftover profile (`test_profile_ac15_1`), left by those key-less failures. **My first full run was contaminated**: the first background attempt kept running while I started the second, so the log holds two interleaved runs; I rely on the per-file comparison for the failures, and the other 1,300+ tests passed under that interference. The geolocation cache path that uses a swapped column (`geolocation_cache.result`) is covered by the new DB regression test, not by those key-less tests.
* `packages/database` unit tests (12) pass; `packages/database` lint (`--max-warnings 0`) and `tsc` are clean; backend `tsc --noEmit` is clean. Web and the other packages were not run.
* `customJsonb` is tied to drizzle-orm 0.30's behavior (see the project-context rule).
