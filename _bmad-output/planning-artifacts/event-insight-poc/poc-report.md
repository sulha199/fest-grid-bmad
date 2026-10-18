---
status: complete
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
npx tsx --test scripts/poc-event-insight/*.test.ts                              # 51 tests, no network
```

Raw per-call outputs (insights, scores, tokens, latencies; raw response text omitted) are in `results/`. The corpus `corpus.real.json` contains public captions already present in this repo's `apify-runs`/`cc-024-reference-posts`, with contact-detail lines removed.
