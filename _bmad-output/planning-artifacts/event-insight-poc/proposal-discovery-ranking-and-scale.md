---
status: draft-for-review
type: planning-proposal
date: 2026-10-18
related: [prd §3.1 Event Discovery, §3.2 Personalization, §3.16 Data Minimization; Architecture Spine AD-17, AD-18; Story 2.7 (next-upcoming sort); Story 9.7 (golden prompts); proposal-personalized-discovery.md §4, §4.2]
evidence: ./results/perf-*.generated.* (measurements) · ./poc-report.md Addendum 7 · code in apps/backend/scripts/poc-event-insight/ (perf-*.ts, discovery-sort.ts, partial-match.ts)
backlog: [FIND-087, BUG-067, IDEA-076, IDEA-077, IDEA-078]
---

# Discovery ranking at scale: close matches for the AI filter, freshness, "already seen" — and a list endpoint that can carry them

> **Planning artifact.** No product code under `apps/*` or `packages/*` was changed. Added: POC tooling under `apps/backend/scripts/poc-event-insight/` and the result tables under `./results/`. Every number is from a **scratch PostgreSQL 16.15 with the repository's 80 migrations and `seed:volume` data** on a 4-core / 16 GB sandbox, database only (no Lambda, no network, no GraphQL layer). It is a **relative** measurement — what a change does to a query — not a statement about production latency. §10 lists everything it does not show.

## Open questions carried forward (unchanged — still yours to answer)

1. **How the UI renders the stub events** that the bulk-updated curator accounts will now produce.
2. **Which scheduled job hosts the profile-enrichment retry sweep.**
3. **The geocode confidence-floor calibration** (the 0.5 floor is the existing `isLowConfidence` threshold, not a calibrated number).
4. **Whether to delete the captions already stored** for those accounts (not requested, so not done).

## 1. Short answers

| You asked | Answer | Evidence |
|---|---|---|
| **AI filter: a partial match should stay in the list with a lower score instead of being eliminated — can we?** | **Yes, with three limits.** (a) Not inside `Query.events`: scoring every event costs 140 ms at 30k events and 458 ms at 120k, against 0.3 ms for the plain order. (b) Account and keyword leaves, and `NOT`, are never relaxed. (c) Missing data (BUG-063's `adminArea`, for one) must show as "can't tell", not as a match. Recommended shape: exact matches exactly as today, plus a separate, bounded **"closest matches"** lane that names the conditions that failed. | §3 |
| **Sort by freshness of the post so the list changes after each scrape** | **Yes, as a bounded pull** (up to 7 days earlier for a post published in the last 3 days, fading to nothing), measured from the post's own `published_at`, not from when we scraped it. Cost is small (≈ +6 ms at 30k). A fresh event does not jump to the top on freshness alone — by design. | §4 |
| **Push events the user already saw lower** | **Yes, but only as a snapshot taken when a Discovery session starts**, bounded (+14 days), never for events starting within 3 days, never for favorited or calendar-added ones, kept on the device. Cost ≈ 0. Risk is product, not performance: needs an A/B. | §5 |
| **…and the list endpoint must stay optimal and safe to scale** | **It is not, today — independent of these features.** Three measured problems (§2): the planner switches on JIT compilation for this query (≈ 80% of the time at 30k for the anonymous plan; **a cliff, not a constant — corrected in `proposal-posthog-and-list-scale.md` §3**), the cost follows *total history* rather than the visible set, and the order has no tie-break so offset paging **repeats and skips events**. Fix those first (a maintained sort key + an open-events index + `id` tie-break): the list then costs 0.4 ms instead of 175–880 ms, and **personalization on top of it (28 ms at 30k, 67 ms at 120k open) is still faster than today's plain date sort.** | §2, §6, §7 |

## 2. What `Query.events` does today, measured

### 2.1 Findings

**FIND-087 — JIT compilation dominates the request.** The query's estimated cost (three correlated sub-selects in the ORDER BY, evaluated per row) is 611k–1.33M planner units at 30k events, past `jit_above_cost` (default 100,000), so Postgres compiles machine code for it on every request: **79 functions, 717 ms of the 909 ms execution** in the captured plan (`results/perf-today-list-query-jit-on.generated.plan.txt`). Same SQL, JIT off: 175 ms. With 8 concurrent clients on 4 cores: **4.4 requests/s with JIT on, 25 with JIT off.** **Correction (2026-10-19):** the 79-function, 717 ms case is the *anonymous* plan at 30k events; the signed-in plan at the same size paid only 53 ms, because the expensive inlining/optimisation runs only when the plan's estimated cost exceeds 500k, which the signed-in plan reached at 300k events (837 ms) — see `proposal-posthog-and-list-scale.md` §3. I measured stock defaults; **I do not know the production database's `jit` setting** — `SHOW jit;` on it is the first thing to check, and `SET jit = off` for this role is the cheapest fix there is.

**Cost follows the catalogue, not what users can see.** At 120k events with 85% ended (13,394 still open) the query still takes 239 ms (JIT off): the plan hash-joins **all 120,012 events, all 120,035 posts and all main schedules** and only then discards the ended ones (`results/perf-variants-120k-mature.generated.md`).

**BUG-067 — no tie-break, so paging repeats and skips events.** The ORDER BY is the next date alone; many events share a date; each page is a separate sort of the tied rows. Fetching 20 consecutive pages of 10 (the web client's page size): **48 events came back on more than one page, 98 of the true first 200 never came back** (`results/perf-pagination-30k.generated.md`). The web client merges by id, so the user-visible effect is *missing* events, not duplicates. The seed puts roughly 130 events on each day of the next 60 days (7,685 events), probably more ties than production will have — but the defect exists wherever two events share a date across a page boundary. Deep pages also cost more with OFFSET: 0.3 ms at offset 0, 2.6 at 200, 18.7 at 2,000, 130 at 10,000 (a keyset seek stays at 0.3–0.4 ms).

### 2.2 What removes them (all 5 runs' median of `EXPLAIN (ANALYZE, BUFFERS)`, offset 0 / 200 / 2000)

| variant | 30k events (22k open) | 120k events, mature (13k open) |
|---|---|---|
| V0 today, JIT on (server default) | 882 / 961 / 894 ms | 311 / 289 / 315 ms |
| V1 today, JIT off | 175 / 182 / 214 ms | 239 / 234 / 255 ms |
| V2 + `id` tie-break, JIT off | 203 / 173 / 224 ms | 247 / 237 / 234 ms |
| V3 one LATERAL aggregate for the key, JIT off | 195 / 168 / 185 ms | 231 / 255 / 233 ms |
| V4 **maintained** sort-key column + (key, id) index | 32 / 30 / 45 ms | **503 / 452 / 480 ms** (worse than today) |
| V5 maintained key, index holding **only events with something still open** | **0.4 / 2.4 / 20 ms** | **0.4 / 2.9 / 128 ms** |

Reading it: a tie-break (V2) and a rewritten key (V3) cost nothing but fix nothing big. A maintained key alone (V4) helps at 30k and **hurts on a mature catalogue**, because the index walks past every ended event before it reaches a visible one. Only V5 — the index contains nothing but still-open events — is flat. Throughput, 8 clients, 12 s each: today 4.4 (JIT on) / 25 (JIT off) requests/s; V5 **2,084 requests/s** at 3.8 ms mean (`results/perf-pgbench-30k.generated.md`).

Two things V5 does **not** include: its write side (the key must be kept current when schedules are written, and rolled forward when a multi-schedule event's first date passes), and users whose `hidePastEventsAfterDays` is above the default 0 — they must also see events that ended up to 365 days ago, which this index leaves out (§7).

## 3. AI filter: keep partial matches, with a lower score

### 3.1 Today

A filter is a tree (`FilterNode`: AND/OR/NOT over 11 leaf fields, depth ≤ 3, ≤ 12 nodes) compiled into one `WHERE`. An event that fails any leaf is **gone**. The model's "caveats" are text; nothing in the result says *which* condition an event missed.

### 3.2 What a score would mean (`partial-match.ts`, 11 tests; weights and tolerances are **unvalidated defaults**)

| leaf | class | weight | partial credit |
|---|---|--:|---|
| `accountId`, `keyword` | hard | 3 | none — a miss **removes** the event |
| `dateRange`, `temporalFilter` | graded | 3 | linear to 0 at 3 days outside the range |
| `locationAdminArea` | graded | 3 | same area 1 · sibling in the same region 0.6 · same province 0.4 · else 0 |
| `locationProximity` | graded | 3 | inside the radius 1 · linear to 0 at twice the radius |
| `type`, `category`, `dayOfWeek` | binary | 2 | 0 or 1 |
| `isFree`, `venueType` | binary | 1 | 0 or 1 |

AND = weighted mean of the children (a hard child at 0 removes the event); OR = best child; **NOT is strict** (an event that matches the excluded thing is out; unknown data passes, as it does today). A leaf the event has **no data for** gets 0.5 and is reported as *unknown*. A **close match** is: not removed, score below 1, at most one unmet leaf, score ≥ 0.6.

Worked on "free music in Sleman this week" (4 leaves, total weight 9; computed by the module):

| event | score | status | unmet |
|---|--:|---|---|
| matches everything | 1.000 | exact | — |
| music, free, this week, **in Bantul** (sibling) | 0.867 | close | area |
| music, Sleman, free, **1 day after** the week | 0.889 | close | date |
| music, Sleman, this week, **paid** | 0.889 | close | free |
| free, Sleman, this week, **theatre** | 0.778 | close | category |
| everything fits, **price not stated** | 0.944 | close | free (*unknown*) |
| Bantul **and** paid | 0.756 | not shown | 2 misses |

The tuning facts this makes visible: a paid event in the right place and week ranks level with a free one a day late, because `isFree` weighs 1 and a day-late date loses 1/3 of 3. Whether that order is right is a product call; the weights should be fitted on the golden prompt set (Story 9.7 pattern) and then on click-through, not trusted as written.

### 3.3 Where it can run (measured, same data)

The filter benchmark is four leaves — `category = MUSIC`, `adminArea = Sleman`, free, within the next 6 days — which **matches nothing on the seed** (the strict query returns 0 rows: exactly the situation that motivates the feature).

| approach | 30k events | 120k events (98k open) |
|---|--:|--:|
| strict filter, today's ORDER BY (S0) | 29.6 ms | 59.8 ms |
| strict filter, maintained key (S1) | 44.4 ms | 57.8 ms |
| **score every visible event**, order by score (S2) | 140.5 ms | **457.6 ms** |
| visible events matching ≥ 3 of 4 leaves (S3) | 94.2 ms | 385.7 ms |
| same as OR of four leave-one-out conjunctions (S4) | 138.7 ms | 641.3 ms |
| **bounded**: score only the 300 soonest visible events (S5) | **6.1 ms** | **5.2 ms** |

Scoring cost is linear in the visible catalogue, so it must **not** ride on `Query.events` (the most-used endpoint, one `ORDER BY`, no per-row work — AD-17). The bounded form is cheap and under load stays cheap (**12.4 ms mean, 643 requests/s** at 8 clients).

**The honest catch in S5.** "The 300 soonest" is a measurement device, not a design: on the seed that is about 2–3 days of events (≈ 7,700 events fall in 60 days), so a good near-miss five weeks out would never be found. The design should bound the candidates by *relaxing the graded leaves of the user's own filter* (date ± 3 days, sibling areas, the same tolerances the score uses), run that as one more ordinary indexed query — expected to cost what S0/S1 cost (30–60 ms class; **not measured**) — and grade its rows in code with `matchScore`.

### 3.4 Recommended shape

1. `Query.events` is unchanged: exact matches, same order, same cost.
2. A separate bounded request — fired by the client only when the exact list ends (or is empty) — returns up to ~20 close matches with `score` and `unmet` leaves. One extra query, only in filtered sessions that ran short.
3. UI text names what differs ("in Bantul, not Sleman", "price not stated") — never a bare percentage.
4. Never relaxed: account, keyword, `NOT`. Unknown data is shown as unknown.
5. Side effect worth having: data holes (BUG-063's `adminArea`, BUG-062's venue type) become visible as "can't tell" instead of silently empty results.

## 4. Freshness

`sortDays = daysUntil − freshBoost(ageDays) + seenPenalty`, inside the area tier (`discovery-sort.ts`, 10 tests; defaults `freshMaxDays 7`, `freshWindowDays 3`). `freshBoost` = 7 days for a post published just now, fading linearly to 0 at 3 days.

* **Age is the post's `published_at`** (`posts.published_at`, NOT NULL, indexed), **not the time we ingested it.** A new subscription ingests a backlog of old posts in one go; by ingest time they would all look fresh and flood the list.
* **Bounded**, so it is a perturbation of date order: nothing is hidden, nothing moves earlier than 7 days. That is also why the effect is modest in a sparse calendar: an event three weeks out does not jump to the top because it was posted today. If the product wants a stronger "new" signal, that is a UI element (a "New" chip or strip), not a heavier sort weight.
* "A different list after each scrape" comes from two things: new events appear (already true) and recent posts rise up to a week within their tier.
* **Cost** (30k): 45.2 ms with freshness against 39.7 ms for the tier alone. The benchmark used a synthetic `ingested` timestamp column on `events`; the production term needs `published_at` denormalised onto `events` (or the join to `posts`, which the select already makes — that variant is not measured).
* Decision for events with several linked posts (AD-30): use the **primary** post's date (consistent with the insight), so an organiser re-posting cannot keep an event fresh.

## 5. "Already seen" demotion

* **What counts as seen:** at least ~60% of the card on screen for at least ~1 s (IntersectionObserver). Favorited, calendar-added or opened events are *not* demoted — the user wanted them.
* **Where it lives:** on the device (PRD §3.16 — nothing new is stored server-side). The client sends its most recent ≤200 ids with each page request (≈ 7 KB of variables). **Taken as a snapshot when the Discovery session starts and held fixed for the session**: demoting while the user scrolls would reorder cards already on screen and break paging. The effect appears the next time they open Discovery, which is what "I come back and see something different" asks for.
* **Bounded and exempt:** +14 days, and never for an event starting within 3 days (a glance at "tomorrow" must not lose it).
* **Paging stays consistent** only if each session also pins an `asOf` timestamp (freshness decays with time) and the `id` tie-break exists (BUG-067). Both belong to the foundation, not to this feature.
* **Cost** (30k): 43.4 ms with the penalty against 45.2 ms without; at 120k open 191 vs 173 ms. Effectively free.
* **Risk is product, not performance:** a user who returns for an event they remember finds it 14 days lower. That is why IDEA-078 is an A/B behind a flag with "Soonest" one tap away, not a default.

## 6. All together — what the ranking costs on top of a sound list

Tier = area ladder from `proposal-personalized-discovery.md` §4.0 (a `CASE` on an audience-area array). Synthetic audience data: 40% of events without an audience area, the rest one of 12 areas. 30,012 events / 22,337 open, and the adversarial 120,012 events **all open** (98,404). Median of 5, JIT off, 21 rows.

| query | 30k | 120k all open |
|---|--:|--:|
| today's query, unchanged (C0) | 171.5 ms | 894.6 ms |
| P0 date only: maintained key + open-events index | **0.3 ms** | **0.5 ms** |
| P1 + area tier first | 39.7 ms | 119.6 ms |
| P2 + freshness | 45.2 ms | 173.1 ms |
| P3 + already-seen penalty | 43.4 ms | 191.4 ms |
| P3 at offset 200 | 45.4 ms | 213.3 ms |
| P3b tier branches windowed by the 21-day rule | 43.5 ms | 59.4 ms |
| P3b at offset 200 | 67.4 ms | 140.1 ms |
| **P3h: personalise only the next 60 days** | **28.4 ms** | **66.9 ms** |
| P3h at offset 200 | 30.1 ms | 69.8 ms |
| P3h, 14 days | 15.4 ms | 29.1 ms |

* **The tier is the cost.** Going from the plain order to "area tier first" is 0.3 → 40 ms (30k) and 0.5 → 120 ms (120k, all open): the sort can no longer walk an index in order, it has to rank every candidate. Freshness and the seen penalty add little on top.
* **The window rule (P3b) is not worth its complexity at 30k** (no gain, worse at offset 200) and pays off only at 98k open events (59 vs 191 ms). It is exact — a randomised test (300 pools, several offsets) checks the 21-day window = 7 + 14 days against the full ranking, and a second test shows a smaller window is *not* exact — so it stays available as a later optimisation.
* **A horizon is the lever that works**: personalise events dated in the next N days, then continue in plain date order. Cost follows the events in the next 60 days (a function of the posting rate), not the length of history. Trade-off: a Sleman event 70 days out follows a Jakarta event 10 days out. (This is the `horizon` option already in proposal §4.0, now with its price.)
* **Under load**, 8 clients, 4 cores (30k): personalised over all open events **34.7 requests/s** (230 ms mean); personalised over the next 60 days **76.5 requests/s** (105 ms); date-only foundation **2,084 requests/s**. Personalisation costs capacity: the 60-day version is about 27× below the plain order (2,084 vs 76.5 requests/s), the all-open version about 60× — yet the 60-day version is still 17× today's throughput with JIT on and 3× with it off. Illustration only: if 100 signed-in users each loaded a page every 10 s that would be 10 requests/s; I do not know the real rate. The number to watch is the *share of requests that are personalised*: **anonymous visitors and users with no profile are all tier 1, which is exactly the date-only path** (unit-tested earlier), so they ride the 0.4 ms query.
* Not measured, possible later: cache the first personalised page per (area ladder, hour) — the number of distinct ladders is bounded by the number of areas, not users — and apply the seen-penalty on the client for the cached part.

## 7. The scale-safe foundation (IDEA-076) — build this before any of the above

1. **Deterministic order:** `ORDER BY key, id`. Fixes BUG-067 on its own (V2 shows it costs nothing).
2. **A maintained sort key** on `events` (the next schedule date with something still open, falling back to the main, then the earliest — today's exact semantics). Kept current in the same transaction as every write to `schedules` (a trigger is the way to cover all writers without enumerating them; I have **not** enumerated them) and rolled forward nightly for multi-schedule events whose first date has passed.
3. **An open-events index** `(key, id) WHERE deleted_at IS NULL AND key IS NOT NULL`, with events that have nothing left open dropped from it nightly. **This is measured for `hidePastEventsAfterDays = 0`, the default.** Users with a larger grace (up to 365) need events that ended recently; either a second index over "ended within 365 days", or the old query for those users. Decision for you (§9).
4. **JIT off for this query** (or for the application role) — independent of everything else; check production's setting first.
5. **Pinned sessions:** an opaque cursor carrying `asOf`, the seen-snapshot hash and the phase; OFFSET inside the personalised horizon (bounded, 30 ms at offset 200), keyset beyond it and for the date-only path (flat 0.3 ms at any depth).
6. **Keep the endpoint's contract:** one `ORDER BY` expression, no per-row resolver, `Query.events` still the only list; the close-matches lane is a separate query (§3.4).

Order of work, smallest first: **(4)** a configuration check → **(1)** tie-break → **(2)+(3)** maintained key and open-events index, with `pgbench` and `EXPLAIN` repeated on the real schema (Story 2.7 / CC-024 method) → area tier with horizon (IDEA-074) → freshness → seen-demotion (A/B) → close-matches lane (IDEA-077). The ranking features are all optional on top of (1)–(4), and (1)–(4) are worth doing even if none of them ships.

## 8. What this changes in the earlier proposal

* §4.2's "cost is bounded by the visible set … fallback: rank a date window" is **corrected**: cost today is bounded by the *total* catalogue and the fallback that works is a horizon, not the window rule.
* §4.0's `horizon` option moves from "decide with the replay" to "recommended default (60 days)" on cost grounds.
* §4.1's optional relevance stage and this document's freshness/seen terms are the same shape (a bounded perturbation of the date); one definition should serve both (`discovery-sort.ts`).

## 9. Decisions needed from you

1. **Run `SHOW jit;` on production** (or tell me where I can't) — if it is on, FIND-087 is the quick win.
2. **Close matches:** are they shown only after the exact ones run out (recommended), or never alongside exact results? Which leaves are never relaxed — my default is account, keyword, `NOT`.
3. **Weights:** accept the table in §3.2 as a starting point, to be fitted on the golden prompts? In particular, should a paid event in the right place rank level with a free one a day late?
4. **Freshness:** 7 days / 3 days as starting values; primary post only for multi-post events?
5. **Seen-demotion:** A/B only (recommended), and is "on screen ≥ 1 s" the right definition of seen?
6. **Horizon:** 60 days by default?
7. **Users with a hide-past grace above 0:** a second index, or the old query path for them?

## 10. Limits — read before quoting a number

* **Synthetic data.** `seed:volume` is not production: its date and tie distribution, the audience-area spread (40% none, 12 areas), and the filter that matches nothing were chosen by me. The same bench on a copy of production data is the real check.
* **Database only, relative.** No Lambda, no network, no GraphQL parsing, no `totalCount` query, no connection pool. One 4-core machine, warm cache, one query at a time except the explicit `pgbench` runs. Treat the ratios as the finding and the milliseconds as the sandbox.
* **Stock PostgreSQL 16.15 defaults** (JIT on). Production may differ in version, parameters and hardware.
* **Not measured:** the write side of a maintained key (trigger cost, rollover job), the `posts` join variant of freshness, the relaxed-candidate query of §3.3, the cache idea, and any user-visible effect — whether people prefer these orders is untested and is what the replay and A/B are for.
* **The bounded close-match lane (S5) as measured covers only the 300 soonest events.** Its latency is real; its coverage is not what the final design would have.
* **Unvalidated parameters:** every weight, tolerance and window (`partial-match.ts`, `discovery-sort.ts`).
* Earlier mistake caught on this round: the first run of the feature benchmark attached its predicates to the `WHERE` inside the select list's favourites sub-select, so the figures were not what they claimed (the queries still ran and returned 21 rows). It was found through a syntax error in a later variant, fixed by anchoring on the visibility predicate, and **every figure in this document comes from the re-run**.

## 11. Reproducing

```
# scratch Postgres 16 (any empty database), then from apps/backend:
pnpm --filter @festgrid/database migrate && pnpm --filter @festgrid/database seed:volume
export BACKEND_PORT=4001 DATABASE_URL=postgres://…/bench
npx tsx scripts/poc-event-insight/perf-variants.ts   --label bench30k --out variants.md      # §2.2
npx tsx scripts/poc-event-insight/perf-features.ts   --label bench30k --out features.md      # §3.3, §6   (add --open-all for the all-open 120k run)
npx tsx scripts/poc-event-insight/perf-pagination.ts --pages 20 --size 10 --out paging.md    # §2.1
npx tsx --test scripts/poc-event-insight/*.test.ts                                           # 220 offline tests, incl. discovery-sort and partial-match
```

The scripts add `bench_*` columns and indexes to `events`: **scratch databases only**. The harness captures the SQL the real resolver emits by running the web client's own `getEvents` operation against the schema, so the baseline is today's query, not a re-typed copy.
