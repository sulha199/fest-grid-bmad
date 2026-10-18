---
status: draft-for-review
type: planning-proposal
date: 2026-10-18
related: [prd §3.1 Event Discovery, §3.2 Personalization, §3.8 Gemini API Management, §3.16 Data Minimization, §4.1 EventInfo, §4.3 LocationDetails; Architecture Spine AD-13, AD-17, AD-18, AD-29, AD-30; Epic 7/9 (AI filter) for the golden-set pattern]
evidence: ./poc-report.md
---

# Smarter Discovery: audience insight extraction + per-user ranking

> **Planning artifact.** Nothing in `apps/*` or `packages/*` product code was changed. The only code added is POC tooling under `apps/backend/scripts/poc-event-insight/` (same convention as `poc-ingestion-preview.ts`). Numbers quoted here are from [`poc-report.md`](./poc-report.md), which also lists the POC's limits — read those before relying on any percentage.

## 1. Recommendation

**Build it, in two gated phases.** The POC says Gemini can extract *who an event is for and where its audience is* well enough to rank on — for some fields. For others it can't, and the design below uses each field only as far as the evidence supports.

| Question from the discussion | Answer from the POC |
|---|---|
| Can Gemini extract targeting insight (area, audience, eligibility, …) from our posts? | **Yes for the hard-edged fields** (target area, geo scope, eligibility, stated age, gender restriction, cost tier: each ≥94% correct on the core set, and steady run-to-run; with only 27 posts the 95% interval on a per-post rate of ~93% is roughly 77–98%, so read these as "good enough to build behind a gate", not as measured production accuracy). **Not reliably for the soft ones** (audience segments, participation mode): they flip between runs on ~⅓–½ of posts. |
| Can it do it without another API request per post? | **Yes.** Injecting the insight into the *real* production extraction schema was accepted in all 33 calls (no `400 INVALID_ARGUMENT`, the failure `build-gemini-request.ts` documents for oversized schemas) at a median **+0.9k–1.3k input tokens (static rules text, depending on prompt version), +~0.2k output tokens and ~+0.4 s per post, 0 extra requests.** |
| Can we trust the model's own confidence? | **No.** Mean self-reported confidence was 0.92 on fully-correct answers and 0.94 on wrong ones. The design never gates on it. |
| Does it hallucinate? | **Rarely, but in a harmful way**: invented age bounds (`60..120` for "60 tahun ke atas"; `3..10` inferred from "PAUD/TK/SD") and a wrongly "restricted" event. Cheap deterministic checks against the source text removed all of these on the core set (§3.2). |
| How often is an extracted insight wrong somewhere? | **Roughly 1 in 5 to 1 in 9 insights has at least one wrong field** (11–20% of runs, 95% CIs ~6–30%), though each field alone is 93–100% — see the report's wrong-claim table. So ranking must be **bounded and low-leverage per field**, which is what §4 does. |
| Is each-user-sees-a-different-page workable? | **Mechanically yes** (§4 prototype, run on real extracted insights), with an honest caveat: the first prototype failed — see §4.3. Weights must be tuned on real engagement, not by judgement. |

**Prompt choice is open.** v1 and v2 are statistically indistinguishable at this sample size (v2 better on 6 held-out posts, worse on 27 core posts); pick on the larger golden set.

**Gate for the build phase:** a *golden set* with a nightly live eval and a hard bar of **zero critical errors** (§7, Story 10.1). The POC's 33 labelled posts are a seed for that set, not a substitute: one labeller, text-only (no poster images), Jogja-heavy.

## 2. What we are building

Two halves joined by one pure function:

```
 post caption (+ images) ──Gemini──► EventInsight ──guards──► events.insight*   (once, at extraction)
                                                                   │
 user: saved locations, favorites,                                 ▼
 calendar adds, onboarding interests ──► RankingProfile ──► relevance R ∈ [-1,1] ──► ORDER BY
                                                                   (packages/domain, pure)
```

### 2.1 Event side — `EventInsight` (extracted, never user-attributed)

| Field | Values | Why it exists | POC reliability |
|---|---|---|---|
| `geoScope` | venue_local · city · region · national · international · online · unspecified | Is this for people near me, or anywhere? | high |
| `targetAreas[]` `{name, level}` | place names the **audience** is drawn from — *not* where performers/artists come from | the user's own example: "extract which area is targeted" | high (one adversarial venue-vs-artist-origin case passed 3/3) |
| `eligibility` | open_to_public · restricted · unspecified | "Is it for me at all?" | 90–95% core; **"is an age band a restriction?" is an open product definition (§6.2)**; use only to demote, never to hide |
| `ageMin` / `ageMax` | numbers **stated in the text only** | kids/seniors events | high **only with the grounding guard** |
| `genderFocus` | all · women · men | women-only etc. | high |
| `costTier` | free · low · medium · high · unspecified | budget fit | high (±1 tier at team-fee posts) |
| `interests[]` | ≤6 specific lower-case tags | the main personalization signal | high recall; vocabulary is open → needs normalisation (§6.3) |
| `segments[]` | kids · teens · young_adults · adults · seniors · families · students · professionals · tourists_expats · community_members | audience fit | **unstable** → weak weight only |
| `participationModes[]` | attend · participate · compete · volunteer · shop · learn · network | "I want to join a contest" vs "watch" | **unstable** → weak/UI-label only |
| `languages[]`, `evidence[]`, `confidence` | — | language fit; groundedness gate; (confidence is logged, never used) | language high |

The user's request — "not limited to location" — is covered by interests, audience, eligibility, age, gender, cost and language, each with a different reliability that the weights respect.

### 2.2 User side — `RankingProfile` (only signals we hold or the user gives us)

| Signal | Source | Notes |
|---|---|---|
| Home/area | `user_locations` → geocoded `LocationDetails` (`city`/`adminArea`/`province`, PRD §4.3) | multiple saved places allowed |
| Ambient location | browser permission (Story 0.39) | session-only, never stored; also serves anonymous visitors |
| Interests | **implicit:** favorites + calendar adds, time-decayed, into a new `user_interest_profile` row set; **explicit:** optional "pick what you like" chips at onboarding (PRD §3.11) | explicit chips solve cold start cheaply |
| Locale | `en`/`id` | language fit |
| Declared audience (student / parent / age bracket) | **opt-in only, off in v1** | see §6.2 |

**Not used, ever:** inferred age, gender, religion, ethnicity, health, politics, or any inference about a *person* from the events they open. The model is also told never to output such attributes about attendees. (Indonesia PDP Law specific-data categories; the repo already treats children's data conservatively, PRD §5.)

## 3. Extraction design

### 3.1 Piggy-back on the existing call (recommended) — not a second call

* Add `insight` to `geminiEventResponseSchema` (per event, so roundups and multi-event posts get one each) and the rules block to the system instruction. Tested against the production request builder: accepted 33/33.
* **Why not a separate "insight pass":** (a) PRD §3.8 / AD-13 — we batch to protect Gemini RPM/RPD, and a second request per post doubles request count; (b) PRD §3.16 — a curator/local-guide post's caption is **cleared after extraction**, so a later pass cannot recover it; (c) images: the insight call should see the same (face-blurred) images as extraction, and re-sending them is the expensive part.
* Measured marginal cost per post (paired against the same request without insight): **median +931 input / +242 output tokens / +0.4 s with the v1 rules (n=27); +1.3k input / +208 output / +0.37 s with the longer v2 rules (n=6).** The input delta is static rules text — a candidate for provider-side prompt caching. (A *mean* output delta from the first run was +4 tokens because one baseline response ran away by ~7k tokens; use the paired medians.)

### 3.2 Guards: the model proposes, deterministic code verifies

Applied in `packages/domain` before persistence (reference implementation: `scripts/poc-event-insight/guards.ts`, unit-tested):

1. **Evidence must be verbatim.** Every returned quote is checked against the source text (NFKC-folded, punctuation-insensitive). In the POC, 100% of 219 quotes (81 calls) passed — so this check is cheap and currently never fires, which is exactly what a *tripwire* should look like.
2. **Ages must be grounded:** a number survives only if it appears as a standalone numeric token in a verified quote within 25 characters of an age word; `n±1` is allowed next to an under/over cue ("di bawah 12 tahun" → 11 or 12). This is what removed `60..120` and the school-level-derived `3..10`.
3. **Gender restriction needs gender wording**; a verified gender restriction forces `eligibility = restricted` (the model once returned "khusus perempuan" as `open_to_public`).
4. **`restricted` without any restriction wording → `unspecified`.** *Measured trade-off:* this removed wrong claims on the core set but also demoted correctly-worded ones ("Terbuka untuk pelajar SMA") on the held-out set, costing accuracy (100% → 83% on that dimension). Because the ranking in §4 only ever **demotes** for eligibility and never filters, a wrong `restricted` is cheap — so **ship this guard log-only** (record how often it would fire) and promote it to enforcing only if a hard "hide events I can't attend" filter is ever added.
5. **Confidence is ignored.** Logged to the AD-29 audit table for drift monitoring only.

Evidence quotes are **not persisted** (they are verbatim caption text and can contain contact names/numbers — PRD §3.16/§5). They are a gate that is run and discarded; only counters (`evidenceQuotes`, `evidenceVerbatimRate`, guard actions) go to `extraction_audit_logs`, following AD-29 Rule 1 (telemetry in its own table, never joined into a hot path).

### 3.3 Persistence

Insight is read by the hottest query in the system, so it must be on the `events` row (no join) — the opposite of AD-29's telemetry. Proposed: one `insight jsonb` (detail view, debugging) **plus** the few denormalised columns the sort needs: `target_area_keys text[]` (GIN), `interest_tags text[]` (GIN), `eligibility`, `gender_focus`, `age_min/age_max smallint`, `languages text[]`. No new table, queue, Lambda, or vendor → **no `docs/infrastructure/architecture-diagram.md` change is triggered** (CLAUDE.md §4); revisit if an embedding service is ever added (§6.3).

### 3.4 Existing events

A one-off backfill using the *standalone* call (measured **~1.2k input / ~0.25k output tokens per event**; multiply by event count and the current published rate to budget it) over events whose source caption still exists. Events from curator posts (caption cleared) stay `NULL` and rank **neutrally** — a missing insight is never a penalty.

## 4. Ranking design

### 4.1 Relevance as a *bounded date discount*

```
R        = 0.35·geo + 0.45·interest + 0.15·audience + 0.05·language        ∈ [-1, 1]
sortKey  = daysUntilNext − 21·max(R,0) + 21·max(−R,0)
```

* Discovery stays recognisably chronological (today's contract: next-upcoming schedule date, Story 2.7). A strongly relevant event surfaces **up to 3 weeks earlier** than its date alone; a clear mismatch sinks up to 3 weeks later. Nothing is hidden, nothing is unbounded.
* No profile (anonymous, new user, no location permission) ⇒ `R = 0` ⇒ **exactly today's order** (tested).
* Ties break on `events.id`, so offset pagination is deterministic.
* Geo is **mostly a negative signal** (+0.6 own area, +0.2 containing area, −1 meant-for-elsewhere; national/online/unspecified neutral). In a regional product most events are "near" most users, so a large positive geo weight is a constant offset that reorders nothing (§4.3).
* Audience fit is 0 unless the user declared audience facets, and the only negative case is a *narrow* audience (kids/seniors) the user declared they are not part of. **`eligibility` is not part of the prototype score;** when it is added it should be demote-only.

### 4.2 Fit with the hot-path rules

* **One `ORDER BY` expression** inside the existing `Query.events` select — no per-row field resolver and no extra unconditional query (project-context "Database & Performance"; AD-17). User-profile terms are passed as bound parameters (arrays), not joins.
* Cost is bounded by the **visible** set (default filter is ongoing/upcoming), and the existing sort already evaluates correlated subqueries per row (Story 2.7 EXPLAIN'd at ~30k events). Story 10.7 must repeat that EXPLAIN. **Fallback if it doesn't hold:** rank only a date window of the first N candidates (the bounded 21-day discount means a window of `offset + page + 21 days` is sufficient).
* **One definition of "relevance".** The reference scorer lives in `packages/domain` (100% unit-tested, per the Unit Test Requirement); the SQL builder is tested for **parity** against it on DB fixtures, so the ORDER BY and the UI chips ("Near you", "Because you like running") cannot drift apart — the same failure class AD-17 Rule 1 was written to prevent. Chips are derived **client-side** from the same pure function; a server `relevanceReasons` field would be a new per-row resolver and is not allowed here.
* `sort: RECOMMENDED | SOONEST` becomes a `nuqs` URL param and is a committed filter-class input for `useListPaginationController` (AD-18 / BUG-019 class): changing it resets pagination. Next/Previous in the detail view inherits the sort (Context-Aware Detail Views). Calendar, Feed, Favorites and account pages keep their own orderings.
* Pagination caveat: `R` depends on the profile, which can change mid-scroll (favoriting an event). The client already merges pages by id, so the worst case is a duplicate/skip at a page boundary, not corruption. Story 10.7 decides whether to snapshot the profile per session.

### 4.3 What the prototype showed (and the mistake it caught)

The prototype (`relevance.ts`) was run on **real extracted insights** for four personas (a runner in Sleman, a Yogyakarta student following futsal/esports, a parent in Sleman, an expat in Canggu). First version: geo weighted 0.45 and positive for any local match. Result: **a runner and a parent in the same district got an identical top-6** (Jaccard 1.00) and the runner saw no running events — because most of a Jogja-heavy pool is "near" everyone, geo became a near-constant offset that drowned interest. Reworking geo to a mostly-negative signal and raising interest's weight fixed the *mechanism*:

| persona | event they'd care about | chronological rank | personalised rank (of 27) |
|---|---|--:|--:|
| parent | colouring contest | 21 | 10 |
| parent | family fun day | 16 | 7 |
| student | futsal championship | 19 | 11 |
| student | billiard/PES/futsal tournament | 27 | 16 |
| expat | beach-yoga community dinner | 14 | **1** |
| runner | RSIH Mlayu-Mlayu | 23 | 17 |

Two honest caveats. (1) The 27-event, 5-week demo pool is far denser per day than production, so a 21-day window reaches further here; the **window and weights are tunables to be fit on real data** (§7, Story 10.9), not constants to be trusted. (2) A soft-signal error is visible: the parent's top result included a seniors' exercise class because the model tagged it `families` — which is why `segments` carries only 0.15 total weight.

## 5. Measurement

* **Extraction quality (gate for Story 10.1/10.2):** golden set + nightly live eval modelled on Story 9.7. Hard bars: **0 critical errors** (invented age, wrongly `restricted`, forbidden segment, non-verbatim quote, invented area); eligibility/geo/age/gender/cost ≥ the POC's levels on a *fresh* held-out slice; track the abstention rate (a claim dropped by a guard) separately from the wrong-claim rate — for ranking they are very different failures.
* **Offline replay (before any user sees it):** we already store `favorites` and `calendar_additions`. Build each user's profile from favorites *before* date D, rank the events that existed at D, and measure where their *later* favorites land under SOONEST vs RECOMMENDED. This is a free, label-less way to fit the weights and the 21-day window — and to find out whether personalisation helps at all.
* **Online:** PostHog flag `discovery_recommended_sort` (feature flags are already in the stack). Primary: favorite + calendar-add rate per impression by rank position. Guardrails: usage of the "Soonest" toggle (mass switching back = it's wrong), time-to-first-interaction, Discovery bounce.

## 6. Risks and decisions

### 6.1 Risks
* **POC is text-only.** The real pipeline sends the (face-blurred) poster image; some audience info lives only on the poster. The combined-schema test was text-only too. *Mitigation:* Story 10.1 re-runs the eval through `poc-ingestion-preview.ts --fixture` with images before the gate.
* **Filter bubble / small-organiser starvation.** Bounded boost (≤3 weeks), a visible Soonest toggle, and missing insight = neutral (never negative) keep this contained; add an exploration slot if replay shows narrowing.
* **Model/version drift.** The nightly eval is the early-warning; the prompt is versioned (`v1`, `v2` in the POC).
* **Interest vocabulary** is open (the model writes "trail running", users have "running"): v1 uses substring matching on a normalised tag; a controlled vocabulary or embeddings is the upgrade (and *would* trigger the architecture-diagram rule).
* **Languages.** Tested Indonesian and English only; Javanese/other untested.
* **Gemini quota** throttled the POC (429s at roughly 15 calls/min on the key used, plus 503 "high demand" on the larger `gemini-3.5-flash`, which made that comparison inconclusive). Backfill and nightly eval must go through the existing guarded vendor wrapper (AD-32) and queues.

### 6.2 Decisions needed from you
1. **Declared audience facets** (student / parent / age bracket): leave **off in v1** (recommended), or ask opt-in during onboarding? They are the only way eligibility/age/gender can *personalise* rather than just label. PDP-sensitive; needs a purpose statement and a reset/delete control either way.
2. **Default sort** for signed-in users once flagged: RECOMMENDED (recommended, behind the A/B) vs SOONEST until the replay is convincing.
3. **Anonymous visitors with granted browser location:** location-only personalisation (recommended) or none?
4. **Events with several linked posts (AD-30):** insight follows the *primary* post and is replaced when primary changes *only if* the new primary produced one (recommended) — or merge insights across posts?
5. **Is an age-banded event ("usia 7–16 tahun", "60+") `restricted` or `open_to_public`?** The extraction prompt and the product must agree; it changes what `eligibility` means for ranking and for any future filter. (The POC's own prompt and labels disagreed on exactly this.)
6. **"Near you" vs the existing Nearby badge** (AD-22/24, <5 km): separate chip (recommended; different semantics: area vs distance) or unify?

## 7. Proposed epic (not yet in `epics.md`; numbering and splitting to be done with `bmad-create-epics-and-stories` after you confirm §6.2)

**Epic 10 (proposed): Personalized Discovery** — *Phase A (extraction, gated)*: 10.1 insight domain types + AJV + prompt v2 + golden set/nightly eval (gate); 10.2 piggy-back extraction + guards + persistence + audit counters; 10.3 canonical target areas via the geolocation adapter; 10.4 backfill. *Phase B (ranking)*: 10.5 `user_interest_profile` (+ onboarding chips, reset control); 10.6 relevance scorer in `packages/domain` + SQL builder with parity test; 10.7 `Query.events` `sort` arg + EXPLAIN at ~30k; 10.8 Discovery UI (sort control, reason chips, skeletons in sync, i18n, detail-nav context); 10.9 offline replay harness, flag, analytics, rollout.

Needs a new FR set and PRD edits (§3.1/§3.2 and §4.1 `EventInfo`) — **not made here** because this is a proposal awaiting your decisions in §6.2.

## 8. Reproducing the POC

```bash
cd apps/backend
export DATABASE_URL=postgres://placeholder:placeholder@127.0.0.1:1/placeholder BACKEND_PORT=4001   # never connects
export SYSTEM_GEMINI_API_KEY=...                                                                   # or --gemini-key
npx tsx scripts/poc-event-insight/run.ts --set core --prompt v2 --runs 3        # live Gemini calls
npx tsx scripts/poc-event-insight/rescore.ts --results <results.json>           # offline, applies guards
npx tsx scripts/poc-event-insight/rank-demo.ts --results <results.json>         # offline, per-persona ranking
npx tsx scripts/poc-event-insight/wrong-claims.ts "label=<results.json>"       # offline, wrong-claim rate + CI
npx tsx --test scripts/poc-event-insight/*.test.ts                              # 51 unit tests, no network
```
