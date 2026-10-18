---
status: draft-for-review (revision 2)
type: planning-proposal
date: 2026-10-18
related: [prd §3.1 Event Discovery, §3.2 Personalization, §3.8 Gemini API Management, §3.16 Data Minimization, §4.1 EventInfo, §4.3 LocationDetails; Architecture Spine AD-13, AD-17, AD-18, AD-29, AD-30; Epic 7/9 (AI filter) for the golden-set pattern]
evidence: ./poc-report.md
---

# Smarter Discovery: audience insight extraction + per-user ranking

> **Planning artifact.** Nothing in `apps/*` or `packages/*` product code was changed. The only code added is POC tooling under `apps/backend/scripts/poc-event-insight/` (same convention as `poc-ingestion-preview.ts`). Numbers quoted here are from [`poc-report.md`](./poc-report.md), which also lists the POC's limits — read those before relying on any percentage.

## 0. Revision 2 — decisions taken in the 2026-10-18 discussion

1. **Audience extraction is automatic, and the audience carries the target area.** One extraction call produces the event's *audience* — where it reaches (`geoScope`, `targetAreas`), who may take part (`tracks`, §2.3), what it is about (`interests`). The target area is the field the ordering uses first. Nobody is asked for age, gender, school or occupation.
2. **Default order is "targeted at my area first, then the sooner"** (§4.0): `ORDER BY areaTier, nextDate, id`. The blended relevance score of the first draft (§4.1) is kept only as an optional second stage / experiment arm.
3. **Age is modelled as *tracks*, not one min/max** (§2.3), because real events qualify people in several ways at once. Tested live: §2.3 and the report's addendum.
4. **Master brought the venue-type work (BUG-062, IDEA-070/071/072, AD-35).** Reading it against the code shows the AI filter's *region* match has the same defect venue type had: the field is read but nothing in production writes it. §9 sets out what that means for this proposal and what to discuss.

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

**Gate for the build phase:** a *golden set* with a nightly live eval and a hard bar of **zero critical errors** (§7, Story 10.4). The POC's 33 labelled posts are a seed for that set, not a substitute: one labeller, text-only (no poster images), Jogja-heavy.

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
| `eligibility` | open_to_public · restricted · unspecified | **membership-type** limits only (invite-only, internal, one institution). Age and gender are *not* eligibility — they live in `tracks` (§2.3), which resolves the age-band conflict the first draft left open | 90–95% core; use only to demote, never to hide |
| `tracks[]` | `{label, ageMin?, ageMax?, lifeStages[], genderFocus}` + `allAges` | who may take part, as separately-qualifying categories (§2.3) | counts right 39/39 runs; 0 fabricated numbers; numbers need code (§2.3) |
| `costTier` | free · low · medium · high · unspecified | budget fit | high (±1 tier at team-fee posts) |
| `interests[]` | ≤6 specific lower-case tags | the main personalization signal | high recall; vocabulary is open → needs normalisation (§6.1) |
| `segments[]` | kids · teens · young_adults · adults · seniors · families · students · professionals · tourists_expats · community_members | audience fit | **unstable** → weak weight only |
| `participationModes[]` | attend · participate · compete · volunteer · shop · learn · network | "I want to join a contest" vs "watch" | **unstable** → weak/UI-label only |
| `languages[]`, `evidence[]`, `confidence` | — | language fit; groundedness gate; (confidence is logged, never used) | language high |

Grouped for the ordering: **reach** (`geoScope`, `targetAreas`) is what the default order uses; **tracks / eligibility / interests / cost / language** are what filters, card labels and the optional second stage use. Each has a different reliability, and the design uses each only as far as the evidence supports.

### 2.2 User side — `RankingProfile` (only signals we hold or the user gives us)

| Signal | Source | Notes |
|---|---|---|
| Home/area | `user_locations` → geocoded `LocationDetails` (`city`/`adminArea`/`province`, PRD §4.3) | multiple saved places allowed |
| Ambient location | browser permission (Story 0.39) | session-only, never stored; also serves anonymous visitors |
| Interests | **implicit:** favorites + calendar adds, time-decayed, into a new `user_interest_profile` row set; **explicit:** optional "pick what you like" chips at onboarding (PRD §3.11) | explicit chips solve cold start cheaply |
| Locale | `en`/`id` | language fit |
| Declared audience (student / parent / age bracket) | **none** — audience is extracted from the event, never asked of the user (decision 1). Age enters only as an ephemeral filter value (§2.3) | resolved |

**Not used, ever:** inferred age, gender, religion, ethnicity, health, politics, or any inference about a *person* from the events they open. The model is also told never to output such attributes about attendees. (Indonesia PDP Law specific-data categories; the repo already treats children's data conservatively, PRD §5.)

### 2.3 Age and "who may take part" as *tracks*

Real posts do not have one age range; they have categories. A single `(ageMin, ageMax)` either lies or cannot express it:

| real/test post | what the text says | one min/max can say | tracks say |
|---|---|---|---|
| colouring contest | Kategori A: PAUD/TK · Kategori B: 1–3 SD | `3..10` (v1 invented both numbers; no age is stated) | 2 tracks: `early_childhood`, `child` — no numbers |
| fun run | Kids Dash 6–10 · 5K 12+ · 10K 17+ · Master 45+ | `6..45` (wrongly says an 11-year-old fits) | 4 tracks: `[6,10]`, `[12,∞)`, `[17,∞)`, `[45,∞)` |
| piano classes | Anak 5–8 · Remaja 13–17 · Dewasa pemula | `5..17` | `[5,8]`, `[13,17]`, `adult` (no numbers) |
| sports week | basket putra · badminton ganda putra · ganda campuran | one gender or none | 3 tracks with their own `genderFocus` |
| debate | 3 mahasiswa, usia maks. 25 th | `..25` | 1 track: `young_adult` **AND** `ageMax 25` |
| essay contest | pelajar SMA **atau** mahasiswa S1 | — | 1 track, `lifeStages [teen, young_adult]` (alternatives) |
| seniors class | usia 60 tahun ke atas | `60..120` (invented max) | `ageMin 60`, no max |
| bazaar | "usia berapa saja", Rp25–50 ribu, 10.00–15.00 | risk: price/time read as an age | `allAges: true`, no numbers |

**Semantics (suggested).** A person qualifies for an event if they fit **any one track** (tracks are alternatives). Inside one track every stated criterion must hold (**age AND stage AND gender**); several values of one kind are alternatives (`lifeStages [teen, young_adult]`). `allAges` means everyone. No tracks means the post states nothing — *unspecified*, never "excluded".

**Numbers only when written; otherwise a life stage.** `lifeStages` (`early_childhood ≤6 · child 7–12 · teen 13–17 · young_adult 18–30 · adult 31–59 · senior 60+`) is the honest stand-in for "PAUD/SD/SMA/mahasiswa/anak/remaja/dewasa/lansia". The model fills stages; **code reads the numbers** (a deterministic range parser fills the maximum the model drops, the grounding guard checks each number's role — "45 tahun ke atas" is a minimum — within its own clause).

**What the product does with it — without ever storing a person's age:**
* **Cards:** the *union* of intervals ("6–10 · 12+"), never one stretched range.
* **FilterHub:** an ephemeral "for age N" / "for my child (N)" control — a query parameter like any other filter, **not saved to the profile**. `qualifies(event, {age})` is true if any track fits; events with no tracks stay visible. Gap cases are real and correct (an 11-year-old fits no track of the fun run above).
* **Ordering:** none in v1 (no user age exists). Later, an *affinity* learned from favorites ("this user favours `child`-stage tracks") can feed the optional second stage — behaviour, not a declared or inferred attribute.

**Evidence (live Gemini, `gemini-3.5-flash-lite`).** 12 posts × 2 runs: 24/24 usable, **right number of tracks 24/24, fabricated numbers 0/24**, fully correct 18/24 raw — all 6 misses are the same defect: for a closed range ("usia 6–10 tahun") the model often returns the minimum and **drops the maximum** (3 of 4 closed-range posts here; 3 of 3 in the held-out set). Code repair → 24/24 (but written after seeing those posts). **Out of sample:** 5 new posts × 3 runs, labelled before the repair ever ran on them: raw 6/15 → **12/15** with the repair (the "bazaar" trap with time and price ranges: 3/3, nothing fabricated). Fixing a clause-scope bug that this set exposed then gave 15/15, which is contaminated. Details: report addendum.

## 3. Extraction design

### 3.1 Piggy-back on the existing call (recommended) — not a second call

* Add `insight` to `geminiEventResponseSchema` (per event, so roundups and multi-event posts get one each) and the rules block to the system instruction. Tested against the production request builder: accepted 33/33.
* **Why not a separate "insight pass":** (a) PRD §3.8 / AD-13 — we batch to protect Gemini RPM/RPD, and a second request per post doubles request count; (b) PRD §3.16 — a curator/local-guide post's caption is **cleared after extraction**, so a later pass cannot recover it; (c) images: the insight call should see the same (face-blurred) images as extraction, and re-sending them is the expensive part.
* Measured marginal cost per post (paired against the same request without insight): **median +931 input / +242 output tokens / +0.4 s with the v1 rules (n=27); +1.3k input / +208 output / +0.37 s with the longer v2 rules (n=6).** The input delta is static rules text — a candidate for provider-side prompt caching. (A *mean* output delta from the first run was +4 tokens because one baseline response ran away by ~7k tokens; use the paired medians.)

### 3.2 Guards: the model proposes, deterministic code verifies

Applied in `packages/domain` before persistence (reference implementation: `scripts/poc-event-insight/guards.ts`, unit-tested):

1. **Evidence must be verbatim.** Every returned quote is checked against the source text (NFKC-folded, punctuation-insensitive). In the POC, 100% of 219 quotes (81 calls) passed — so this check is cheap and currently never fires, which is exactly what a *tripwire* should look like.
2. **Ages must be grounded:** a number survives only if it appears as a standalone numeric token in a verified quote within 25 characters of an age word; `n±1` is allowed next to an under/over cue ("di bawah 12 tahun" → 11 or 12). This is what removed `60..120` and the school-level-derived `3..10`. **Two flaws found later and fixed (see report addendum):** the number's *role* must fit its wording ("45 tahun ke atas" is a minimum, never a maximum), judged **within its own clause** (a neighbouring "19+" must not reject "16–18"); and cue words are whole words ("Min**ggu**" is not "min"). For closed ranges the model drops the maximum, so **code fills it from the text** (`repairAgeRanges`, §2.3).
3. **Gender restriction needs gender wording** (a track-level `genderFocus` is dropped to `all` without it). *(In the flat POC schema a verified gender restriction also forced `eligibility = restricted`; under tracks, §2.3, that rule goes away — gender is a track criterion, not eligibility.)*
4. **`restricted` without any restriction wording → `unspecified`.** *Measured trade-off:* this removed wrong claims on the core set but also demoted correctly-worded ones ("Terbuka untuk pelajar SMA") on the held-out set, costing accuracy (100% → 83% on that dimension). Because the ranking in §4 only ever **demotes** for eligibility and never filters, a wrong `restricted` is cheap — so **ship this guard log-only** (record how often it would fire) and promote it to enforcing only if a hard "hide events I can't attend" filter is ever added.
5. **Confidence is ignored.** Logged to the AD-29 audit table for drift monitoring only.

Evidence quotes are **not persisted** (they are verbatim caption text and can contain contact names/numbers — PRD §3.16/§5). They are a gate that is run and discarded; only counters (`evidenceQuotes`, `evidenceVerbatimRate`, guard actions) go to `extraction_audit_logs`, following AD-29 Rule 1 (telemetry in its own table, never joined into a hot path).

### 3.3 Persistence

Insight is read by the hottest query in the system, so it must be on the `events` row (no join) — the opposite of AD-29's telemetry. Proposed: one `insight jsonb` (detail view, debugging, `tracks`) **plus** the few denormalised columns the ordering needs: `target_area_keys text[]` (GIN; canonical keys, §9.2), `geo_scope`, and later `interest_tags text[]` (GIN), `eligibility`, `languages text[]`. Tracks stay in the jsonb: they are read for cards and the "for age N" filter, not for the default ordering. No new table, queue, Lambda, or vendor → **no `docs/infrastructure/architecture-diagram.md` change is triggered** (CLAUDE.md §4); revisit if an embedding service is ever added (§6.3).

### 3.4 Existing events

A one-off backfill using the *standalone* call (measured **~1.2k input / ~0.25k output tokens per event**; multiply by event count and the current published rate to budget it) over events whose source caption still exists. Events from curator posts (caption cleared) stay `NULL` and rank **neutrally** — a missing insight is never a penalty.

## 4. Ranking design

### 4.0 Default order: targeted at my area first, then the sooner

```
ORDER BY areaTier ASC, nextUpcomingDate ASC, id ASC          -- areaTier = one integer CASE
```

| tier | meaning | examples for a Sleman user |
|--:|---|---|
| 0 | the event's target areas include **my area, a sub-area, a containing area, or a sibling in my region** | Sleman · Depok · DIY-wide · Bantul |
| 1 | no specific area: national / international / online / unspecified / no insight yet — and **every event, if I have no location** | "se-Indonesia" webinar; Zoom class |
| 2 | targeted at **somewhere else** | Jakarta exhibition; Bali yoga |

* **Event areas** = AI `targetAreas` **∪ the venue's geocoded areas** (already stored on `schedules.location_details`). The venue part needs no Gemini, so this ordering can ship *before* audience extraction does, and the AI part then adds the catchment the venue cannot tell you ("terbuka untuk mahasiswa dan umum se-DIY & Jawa Tengah"). Both depend on the area ladder fix in §9.
* **No profile ⇒ every event is tier 1 ⇒ exactly today's chronological order** (unit-tested). Ties break on `id`, so offset pagination stays deterministic.
* **Option `most-local-first`** splits tier 0 into "my own district first, then the wider region" (Sleman before DIY-wide). Needs the regency level, which the geocoder currently drops (§9.1).
* **Option `horizon`** (e.g. apply tiers only within the next 30 days, pure date beyond): protects against the strictness trade-off below. Default: off, as requested; decide with the replay (§5).

**Measured on the real extracted insights** (27 events, 4 personas; `rank-demo.ts`): the expat in Canggu goes from rank 14 to **1** for the Bali event and has 23 of 27 events in tier 2; Yogyakarta users keep 20 of 27 in tier 0, so for them the page is chronological with out-of-area events behind. **Said plainly: "area first" separates regions, not people within a region.** On a Jogja-only catalogue it will change little until (a) the catalogue spans several cities, or (b) the area ladder is fine enough to tell Sleman from Bantul from Yogyakarta city, or (c) a within-tier refinement exists (nearer via the saved-location radius, or interest — §4.1). **Trade-off to accept knowingly:** a strictly local event two months away outranks a national event tomorrow (`rankAreaThenDate: strictness trade-off is real` test).

### 4.1 Optional second stage: relevance as a *bounded date discount*

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

* **One `ORDER BY` expression** (the area tier is a single integer `CASE` ahead of the existing date key) inside the existing `Query.events` select — no per-row field resolver and no extra unconditional query (project-context "Database & Performance"; AD-17). User-profile terms are passed as bound parameters (arrays), not joins.
* Cost is bounded by the **visible** set (default filter is ongoing/upcoming), and the existing sort already evaluates correlated subqueries per row (Story 2.7 EXPLAIN'd at ~30k events). Story 10.2 must repeat that EXPLAIN. **Fallback if it doesn't hold:** rank only a date window of the first N candidates (the bounded 21-day discount means a window of `offset + page + 21 days` is sufficient).
* **One definition of "relevance".** The reference scorer lives in `packages/domain` (100% unit-tested, per the Unit Test Requirement); the SQL builder is tested for **parity** against it on DB fixtures, so the ORDER BY and the UI chips ("Near you", "Because you like running") cannot drift apart — the same failure class AD-17 Rule 1 was written to prevent. Chips are derived **client-side** from the same pure function; a server `relevanceReasons` field would be a new per-row resolver and is not allowed here.
* `sort: RECOMMENDED | SOONEST` becomes a `nuqs` URL param and is a committed filter-class input for `useListPaginationController` (AD-18 / BUG-019 class): changing it resets pagination. Next/Previous in the detail view inherits the sort (Context-Aware Detail Views). Calendar, Feed, Favorites and account pages keep their own orderings.
* Pagination caveat: `R` depends on the profile, which can change mid-scroll (favoriting an event). The client already merges pages by id, so the worst case is a duplicate/skip at a page boundary, not corruption. Story 10.2 decides whether to snapshot the profile per session.

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

Two honest caveats. (1) The 27-event, 5-week demo pool is far denser per day than production, so a 21-day window reaches further here; the **window and weights are tunables to be fit on real data** (§7, Story 10.3), not constants to be trusted. (2) A soft-signal error is visible: the parent's top result included a seniors' exercise class because the model tagged it `families` — which is why `segments` carries only 0.15 total weight.

## 5. Measurement

* **Extraction quality (gate for Story 10.4/10.5):** golden set + nightly live eval modelled on Story 9.7. Hard bars: **0 critical errors** (invented age, wrongly `restricted`, forbidden segment, non-verbatim quote, invented area); eligibility/geo/age/gender/cost ≥ the POC's levels on a *fresh* held-out slice; track the abstention rate (a claim dropped by a guard) separately from the wrong-claim rate — for ranking they are very different failures.
* **Offline replay (before any user sees it):** we already store `favorites` and `calendar_additions`. Build each user's profile from favorites *before* date D, rank the events that existed at D, and measure where their *later* favorites land under SOONEST vs RECOMMENDED. This is a free, label-less way to fit the weights and the 21-day window — and to find out whether personalisation helps at all.
* **Online:** PostHog flag `discovery_recommended_sort` (feature flags are already in the stack). Primary: favorite + calendar-add rate per impression by rank position. Guardrails: usage of the "Soonest" toggle (mass switching back = it's wrong), time-to-first-interaction, Discovery bounce.

## 6. Risks and decisions

### 6.1 Risks
* **POC is text-only.** The real pipeline sends the (face-blurred) poster image; some audience info lives only on the poster. The combined-schema test was text-only too. *Mitigation:* Story 10.4 re-runs the eval through `poc-ingestion-preview.ts --fixture` with images before the gate.
* **Filter bubble / small-organiser starvation.** Bounded boost (≤3 weeks), a visible Soonest toggle, and missing insight = neutral (never negative) keep this contained; add an exploration slot if replay shows narrowing.
* **Model/version drift.** The nightly eval is the early-warning; the prompt is versioned (`v1`, `v2` in the POC).
* **Interest vocabulary** is open (the model writes "trail running", users have "running"): v1 uses substring matching on a normalised tag; a controlled vocabulary or embeddings is the upgrade (and *would* trigger the architecture-diagram rule).
* **Languages.** Tested Indonesian and English only; Javanese/other untested.
* **Gemini quota** throttled the POC (429s at roughly 15 calls/min on the key used, plus 503 "high demand" on the larger `gemini-3.5-flash`, which made that comparison inconclusive). Backfill and nightly eval must go through the existing guarded vendor wrapper (AD-32) and queues.

### 6.2 Decisions needed from you
1. ~~Declared audience facets~~ — **resolved (rev. 2): audience is extracted automatically; users declare nothing.** Age appears only as an ephemeral filter value.
2. **Default sort** for signed-in users once flagged: RECOMMENDED (recommended, behind the A/B) vs SOONEST until the replay is convincing.
3. **Anonymous visitors with granted browser location:** location-only personalisation (recommended) or none?
4. **Events with several linked posts (AD-30):** insight follows the *primary* post and is replaced when primary changes *only if* the new primary produced one (recommended) — or merge insights across posts?
5. ~~Is an age-banded event `restricted` or `open_to_public`?~~ — **resolved by tracks (rev. 2):** age and gender are track criteria; `eligibility` means only membership-type limits. "Dibuka untuk UMUM, usia 7–16" = `open_to_public` + one `[7,16]` track. (The POC's flat guards "age band keeps restricted" and "gender ⇒ restricted" belong to the old schema and go away.)
6. **Tier granularity and horizon (§4.0):** `any-containing` (as requested) or `most-local-first`; with or without a 30-day horizon? Recommend shipping `any-containing` and letting the replay decide.
7. **What counts as "my area":** AI target areas ∪ venue geocode (recommended), and should the user's saved-location radius also count (an event within my saved radius is "mine" even if its area names differ)?
8. **"Near you" vs the existing Nearby badge** (AD-22/24, <5 km): separate chip (recommended; different semantics: area vs distance) or unify?

## 7. Proposed epic (not yet in `epics.md`; numbering and splitting to be done with `bmad-create-epics-and-stories` after you confirm §6.2)

**Epic 10 (proposed): Personalized Discovery** — revised order, smallest-first:

* *Phase 0 — shared prerequisite (also fixes the AI filter, §9):* **10.0 canonical area ladder** — geocoder writes a normalised country > province > regency > city path (keeping `county`), matching is case-insensitive and hierarchical, backfill of cached geocodes + existing schedules. Owned jointly with IDEA-071.
* *Phase A — area-first ordering (needs no Gemini):* 10.1 `areaTier` + sort in `packages/domain` (100% tested, sample in `relevance.ts`) with SQL parity test; 10.2 `Query.events` `sort` arg (RECOMMENDED = area → date) + EXPLAIN at ~30k; 10.3 Discovery UI (sort control, "near you" chip, skeletons, i18n, detail-nav context) + replay harness + flag.
* *Phase B — automatic audience extraction (gated):* 10.4 insight + tracks domain types, AJV, prompt, golden set + nightly eval (gate; reuse IDEA-072's machinery); 10.5 piggy-back extraction + guards (incl. range repair) + persistence + audit counters; 10.6 resolve AI `targetAreas` through the geocoder into canonical keys; 10.7 backfill; 10.8 "for age N" filter + track chips on cards.
* *Phase C — optional second stage:* 10.9 `user_interest_profile` (+ onboarding chips, reset control) and the bounded relevance discount as an A/B arm.

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
npx tsx scripts/poc-event-insight/run-tracks.ts --runs 2                         # live: age/eligibility as tracks (--holdout for the unseen set)
npx tsx scripts/poc-event-insight/rescore-tracks.ts <tracks-experiment.json>    # offline: with/without range repair
npx tsx --test scripts/poc-event-insight/*.test.ts                              # 82 unit tests, no network
```

## 9. What master revealed: AI filter, venue type, and the area ladder

Master brought BUG-062 / IDEA-070 (venue type), IDEA-071 (backfill), IDEA-072 (golden prompts that grow from usage), FIND-085, and AD-35. They matter here in four ways.

### 9.1 The same defect, one field over: `adminArea`

IDEA-070's root cause: *the PRD lists `venueType`, the AI filter offers it, the query compares it — and nothing ever wrote it.* Reading the code for the area side:

| piece | where | what it does |
|---|---|---|
| reader | `resolvers.ts:3401` | `adminArea: (schedules.location_details->>'adminArea')`, compared with `eq` (`buildLocationCondition`) |
| producer of the query | `build-filter-extraction-request.ts` | tells the model to emit `adminArea: "Sleman" / "Bantul" / "Jakarta"` |
| **writer** | `geoapify-client.ts` | maps `city`, `province` (= `state` ‖ `province` ‖ `county`), `countryCode`, `timezone`, `venueType` — **no `adminArea`** |
| only other writer | `seed-volume.ts` | dev seed |

So, from the code, an AI filter such as "events in Sleman" resolves to `adminArea eq 'Sleman'` against a field no production path populates, and returns nothing — exactly BUG-062's symptom, for regions. **I inferred this from reading the code; I did not reproduce it** (no database or Geoapify key in this environment), so it needs a one-minute check against a real schedule row. A second problem sits underneath: the mapper keeps `county` only as a fallback for `province`, but the **regency** (Sleman, Bantul) is the level Indonesians name. I could not verify what Geoapify returns for Indonesian places without a key; IDEA-070's author did a live probe for categories and the same probe should be done for admin levels.

### 9.2 One area ladder instead of three mechanisms

The AI filter's region leaf, this proposal's area-first ordering, and resolving AI-extracted `targetAreas` all need the same thing, and IDEA-070's open questions answer how:

* **Closed, canonical keys, not free text** (IDEA-070 Q2): a stored path such as `id / id-yo / id-yo-sleman`, written at geocode time. The model names places; **the geocoder canonicalises them** (never the model).
* **Case-insensitive, hierarchical match, not `eq`** (Q5): "Sleman" must match events in Sleman and below.
* **Geocoder first, AI where it is silent** (Q1): the venue's hierarchy is reliable for named places; the AI adds the *catchment* the venue cannot tell you.
* **`NOT` semantics** (Q3): `NOT area=Jakarta` is `IS DISTINCT FROM`, which keeps unknown — correct for filters, but then "unknown area" must be a first-class value, not an absence. The ordering's tier 1 is that value.
* **Backfill** (IDEA-071): the geocode cache never expires and existing schedules carry no area path; same one-off job.

### 9.3 Venue type is also an audience question

BUG-062's prompt — "outdoor event for kids this weekend" — is an audience (kids) + setting (outdoor) + date query. IDEA-070 Q1 asks whether an AI should classify indoor/outdoor from the caption "at the cost of wrong guesses and a per-event call". The piggy-back measurements here answer the cost half: **a field added to the existing extraction call costs zero extra requests** and a few tokens. The accuracy half is untested. A closed `setting` (indoor / outdoor / mixed / unknown) with the Geoapify category as the first source is a natural next probe with this POC's machinery — I have not run it.

### 9.4 A ratchet worth having

Venue type and `adminArea` are two instances of one failure: *a spec'd, queryable field with no production writer.* This proposal is exposed to it too (every insight column needs a writer). Suggest a test, not a convention: for each field the PRD declares filterable or rankable, run the **real write path** on a fixture and assert the field is non-null.

### 9.5 Reuse

IDEA-072 (golden prompts grown from real usage, human-gated promotion) is the right home for this proposal's golden set; the metamorphic variants and rate-limit-safe pacing added to the nightly eval in master are exactly what the POC lacked (it was throttled at ~15 calls/min).

### 9.6 To discuss

1. Should the area ladder (10.0) be done first, as its own story, since it fixes the AI filter independently of this feature?
2. Is `setting` (indoor/outdoor) part of the audience extraction, or stays a geocoder-only attribute with the AI as a fallback (IDEA-070 Q1)?
3. Do you want a backlog finding recorded for `adminArea` now (I have not touched `backlog.yaml`)?

