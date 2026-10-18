---
status: complete (addenda 1-3, 2026-10-18, appended)
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

