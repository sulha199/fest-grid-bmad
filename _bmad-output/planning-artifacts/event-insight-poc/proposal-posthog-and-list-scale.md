---
status: draft-for-review
type: planning-proposal
date: 2026-10-19
related: [prd Analytics, §3.2 Personalization, §3.16 Data Minimization; Architecture Spine AD-5 (analytics), AD-17, AD-18, AD-30; proposal-discovery-ranking-and-scale.md; fest-grid-monetization: cost-forecast-model-2026-09-26.md, insight-layer-premium-plan-2026-10-13.md]
evidence: ./results/perf-request-*.generated.md · perf-features-*.generated.md · perf-scoring-*.generated.md · perf-pgbench-scoring.generated.md · perf-variants-300k-month12.generated.md
backlog: [FIND-088, FIND-089, IDEA-079, IDEA-080; corrects FIND-087]
---

# From the pre-subscription forecast to `getEvents`: what scale asks of the list endpoint, and how to use PostHog to know

> **Planning artifact.** No product code under `apps/*` or `packages/*` was changed. Measurements are from a **scratch PostgreSQL 16.15 built from the repository's 80 migrations plus `seed:volume` data** (30k, 120k and 300k events), database only, on a 4-core sandbox. Ratios are the finding; milliseconds are the sandbox's. The forecast inputs come from the `fest-grid-monetization` repository; **events per post, lead time, daily-active share and the burst figures are my assumptions and are marked as such.**

## 0. Your four carried-forward questions — answered

**1. Stub events from the bulk-updated accounts — is it about the curator's location change?** *Partly; there are two separate effects.*
* A **stub** is `events.detail_level = 'stub'`: set when the event's primary post is a *roundup* or is *curator-sourced* (`process-ingestion-job.ts:76–85`; the type comment calls it "an event created from a roundup item with no readable date/location"). Stubs never trigger a new-event notification. The bulk update makes those accounts curators, so **their future events become stubs** — that is the stub effect.
* The **location** effect is BUG-065: a curator's events stop falling back to the curator's account location, so a curator event that names no venue has **no location**.
* They stack: the legacy accounts' future events will often be stubs *and* placeless. **(Corrected 2026-10-19, `proposal-target-area-and-scan-safety.md` §2.1: the current prompt extracts a roundup item only when it has both a readable date and a readable location, so roundup stubs normally have both; and your reply puts the weight on the audience's target area, not the location.)** **The web app has no stub concept today** — `detailLevel` is not in the GraphQL schema or the client (searched `apps/web/src` and `apps/backend/src/schema`) — so Discovery would render them as ordinary cards, possibly sparse ones. The open design question is therefore: show, badge, rank lower, or hide stubs until enriched? PostHog can answer it with data (`event_card_opened` carries `detail_level`, §7).

**2. The retry sweep — only for profile scraping?** *Yes, only for the one-time profile read at subscribe time* (account-type classification plus the country, reach and time-zone enrichment of IDEA-075). Today any failure of that call parks the account in `AWAITING_APPROVAL` and nothing retries it. The policy (`profile-retry.ts`, tested): retry transient failures at 15 min, 1 h, 6 h, 1 d, 3 d; never retry "profile not found / private"; when the scrape worked but showed no country, re-evaluate on the first scraped posts instead of re-scraping; then hand to a person. **Post scraping already has its own recovery** (the scraper poll-and-drain rule every 5 minutes). Because the first backoff is 15 minutes, the natural host is the existing **5-minute scraper poll-and-drain rule**; the daily batch would stretch it to a day.

**3. The geocode confidence floor — what is the case?** Geoapify returns candidates for a place text, each with a confidence between 0 and 1. Today the highest-confidence candidate always wins and is stored as a map pin, **even at 0.2** — so a vague text like "DIY & Jawa Tengah" or "omah noto plankton" can become a confident-looking pin in the wrong city or country (BUG-066's "fatal" case). The **floor** is a minimum confidence below which we keep the text and store *no coordinates*. Calibration means choosing that number: **too low** and wrong pins get through; **too high** and legitimate but vague places lose their pin. I used 0.5 only because the repo already treats below 0.5 as untrustworthy for showing a map link; it has not been tested against Geoapify's real scores for Indonesian place names. To calibrate: run `probe-geocode-country.ts` (needs a Geoapify key) over 100–200 real stored place texts, label each result right or wrong by hand, and pick the floor where wrong pins are about zero at the smallest loss of right ones.

**4. Already-stored captions — what is my concern?** Your rule (clear a curator post's caption when it is re-extracted; re-scrape only when necessary) is right and cheap. The one gap is that **it fires on extraction, and the legacy posts were extracted long ago** — while the accounts were treated as organizers, so nothing cleared the caption (FIND-086). Unless someone re-extracts a given post, its caption simply stays, indefinitely, on exactly the accounts the minimization rule was written for. So the concern is not cost: by the cost model a re-scrape is about $0.003 a post (about IDR 54,000 per 1,000 posts at 18,000 IDR/USD). It is that the rule leaves a **stock of captions with no trigger to remove them**. FIND-086's SQL counts them. If the count is small, or you accept "cleared at next re-extraction", nothing more is needed; whether that is acceptable under PRD §3.16 is a question for counsel, not for me.

## 1. Short answers

| Question | Answer |
|---|---|
| **Use PostHog** | It is wired (`PostHogProvider`, 96 `posthog.capture` call sites, ~67 event names) but measures almost none of Discovery: **no page views** (`capture_pageview: false` with "we capture manually" — and nothing captures them), **no list impressions**, favorites carry only `eventId` (no rank, tier or page), **no AI-filter submit/result events**, no client-timed API latency. §7 proposes a prioritised plan; its first job is to replace this document's assumptions with measured numbers. |
| **How many events will we filter and sort?** | From your forecast: ~25k–36k events/month in the planned launch (195 → 353 accounts; 24.4k → 35.9k posts/month at 1 event per post), so an **open set of ~30k–45k events** at any time, and a **catalogue that grows to ~300k–430k events by month 12.** §2. |
| **What limits the endpoint with complex filters and per-user scores?** | Not request rate — at 50k registered users the steady peak is ~2 list requests/s. Three things: (1) **per-request latency that grows with history, not just with what users see** (same 22k-event open set: 0.2 s at 30k total events, 0.5–0.6 s at 300k); (2) **a sort that cannot use an index** once it is per-user — cost is linear in candidates scored (~3 µs per candidate for a 12-term score), so the *candidate count must be capped by cheap shared indexes*; (3) **plan cliffs and connection hold time**, which turn bursts (a push notification) into queueing. §3–§4. |
| **Return event ids + last-update, hydrate separately with a frontend cache?** | **Worth it for the ranked (per-user) mode, not for the plain date-ordered one, and not before the foundation.** Measured: ids-only on today's query saves nothing (the sort is the cost); hydrating 10 ids costs 0.3–0.5 ms in the database with code that already exists (Favorites); 200 ranked ids is 9 KB. The real benefits are amortisation (rank once per session), stable paging, and shared-content caching. §5. |
| **Does skipping `totalCount` matter?** | **Yes, and it is free.** The shared `GetEvents` document selects `totalCount`, so the resolver runs a separate `count(*)` on every page request; Discovery never reads it (`hasMore` comes from the extra row). Removing it saves **31–348 ms and 14–42% of a page's database time** (JIT off). §3. |
| **Is the current stack enough?** | **Yes, for the forecast, by a wide margin on throughput** — what breaks first is per-request latency from query shape and plan cliffs, all fixable inside Postgres. No new service is justified yet; §6 lists the measured tripwires that would change that. |

## 2. From the pre-subscription forecast to events (`cost-forecast-model-2026-09-26.md`, §2.9)

| scenario | accounts | posts/month | events/month (1.0 per post) | open set (~1.25 months of events) | catalogue at month 6 / 12 / 24 |
|---|--:|--:|--:|--:|---|
| A. Phase 0 (Yogyakarta, live) | 35 | 4,200 | 4,200 | ~5k | 25k / 50k / 101k |
| **B. Phase 0 + 1 (4 cities)** | **195** | **24,403** | **24,403** | **~31k** | **146k / 293k / 586k** |
| C. nine cities | 353 | 35,949 | 35,949 | ~45k | 216k / 431k / 863k |
| D. stress: the model's pessimistic pool (1,000 accounts × 120 posts) | 1,000 | 120,000 | 120,000 | ~150k | 720k / 1.44M / 2.88M |

**Assumptions to replace with measured values** (queries are read-only and were run against the migrated schema): events per post (here 1.0), lead time (here ~30 days), and trial wildcard accounts, which add accounts beyond the curated pool.

```sql
SELECT count(*) AS events, count(DISTINCT post_id) AS posts_with_events,
       round(count(*)::numeric / nullif(count(DISTINCT post_id),0), 2) AS events_per_event_post FROM events WHERE deleted_at IS NULL;
SELECT date_trunc('month', created_at)::date AS month, count(*) FROM events WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1 DESC LIMIT 12;
SELECT count(DISTINCT s.event_id) AS open_events FROM schedules s JOIN events e ON e.id = s.event_id
 WHERE e.deleted_at IS NULL AND coalesce(s.event_end_date, s.event_start_date) >= current_date;
```

**Traffic** (assumptions: 20% of registered users active per day, 1.5 sessions each, 3 list requests per session, 15% of a day's requests in the peak hour). Illustration, not a forecast — PostHog (§7) replaces every one of these.

| registered users | list requests/day | steady peak-hour requests/s | push-burst requests/s (20% of users open within 5 minutes of a notification, 3 requests each) |
|--:|--:|--:|--:|
| 2,000 | 1,800 | 0.07 | 4 |
| 10,000 | 9,000 | 0.4 | 20 |
| 50,000 | 45,000 | 1.9 | 100 |

Steady load is tiny. **The realistic peak driver is a push notification** (the post-login burst already caused the 2026-08-27 pool-exhaustion incident, with `events` among the failing queries).

## 3. What one Discovery page costs today (measured)

`perf-request.ts` runs the web client's own `getEvents` document through the real resolvers and times **every statement** (JIT = the server default; "JIT off" shows the query's own cost). Page of 10, offset 0, median of 5.

| database | open events | page statement, anonymous (JIT on / off) | page statement, signed in (on / off) | `count(*)` (on / off, anon) | whole request as shipped, anon, JIT off → without `totalCount` | `totalCount` share of DB time, JIT off (anon / signed in) |
|---|--:|--:|--:|--:|--:|--:|
| 30k events | 22k | 930 / 204 ms | 245 / 167 ms | 51 / 40 ms | 244 → 195 ms | 20% / 14% |
| 120k, mature (85% ended) | 13k | 305 / 223 ms | 280 / 227 ms | 101 / 111 ms | 335 → 224 ms | 33% / 42% |
| **300k, "month 12"** | **22k** | **1,319 / 545 ms** | **1,277 / 581 ms** | **314 / 226 ms** | **771 → 470 ms** | **39% / 22%** |
| 120k, every event open | 91k | 1,440 / 845 ms | 1,977 / 1,194 ms | 276 / 302 ms | 1,147 → 892 ms | 22% / 24% |

* **History matters as much as visibility.** Rows 1 and 3 have the *same* 22k open events; the 300k catalogue takes 2.7–3.5× longer (page statement, JIT off) because the plan hash-joins every event, post and main schedule before discarding the ended ones.
* **`totalCount` is pure overhead for Discovery**: `home-content.tsx` reads `hasMore` and never `totalCount`, but `GetEventsDocument` selects both, and the resolver runs the count whenever it is selected (Story 1.3j made it conditional, not absent). Archive and Favorites do use it. A Discovery-specific document without `totalCount` is a one-line change. After the maintained-key fix the page itself is 0.4 ms, so the count would become **the** dominant statement — it should go first.
* **Correction to my earlier report (FIND-087).** I said JIT was ~80% of the request. That is true of the *anonymous* plan at 30k (700 of 904 ms). The real mechanism: every plan here exceeds `jit_above_cost` (100k), but Postgres pays the expensive part (inlining + optimisation, ~700–840 ms) only when the plan's estimated cost also exceeds `jit_inline_above_cost` / `jit_optimize_above_cost` (500k each). Measured estimated cost and penalty:

| case | anonymous plan cost | JIT cost | signed-in plan cost | JIT cost |
|---|--:|--:|--:|--:|
| 30k, 22k open | 611k | 700 ms | 345k | 53 ms |
| 120k mature, 13k open | 445k | 44 ms | 283k | 56 ms |
| 300k, 22k open | 1.01M | 818 ms | 625k | 837 ms |
| 120k, 91k open | 2.86M | 694 ms | 1.60M | 809 ms |

So a request is either ~50 ms of JIT or ~800 ms, depending on which side of 500k its estimated cost falls — **a cliff, not a slope**, and the signed-in plan reached it at 300k. The first-round throughput numbers (4.4 vs 25 requests/s) were for the anonymous plan. The recommendation stands (turn JIT off for this role, or remove the cause), but the headline "80%" was too general. Settings must survive Supabase's transaction-mode pooler (a plain `SET` does not): use a role-level setting or `SET LOCAL`.
* **Every signed-in `events` request also writes**: `getOrCreateUserSettings` is an `INSERT … ON CONFLICT DO UPDATE` (a no-op update that still creates a new row version) run only to read `hidePastEventsAfterDays`. It costs ~0.1 ms here, but it is a write on the most-used read path, and two concurrent requests from one user (prefetching pages) contend on the same row. A plain `SELECT` with the default (0) when no row exists removes it (FIND-089).
* **Connection hold time** (arithmetic, not measured): busy connections ≈ requests/s × seconds per request. A 20 requests/s push burst at 0.9–1.5 s per page holds 18–30 connections; the pool in the 2026-08-27 incident was 15. At 60 ms (foundation + personalised horizon) the same burst holds ~1.2; at 0.5 ms, none. Check the current Supabase pool size.

## 4. Complex filters and per-user scores: where the limits are

**Filters** (AI filter: AND/OR/NOT, depth ≤ 3, ≤ 12 nodes). Cost grows with the *open* set unless a leaf is selective and indexed; a four-leaf filter that matches nothing costs 14–60 ms to prove it across 22k–91k open events (S0/S1). Bounded by the node cap, so safe.

**Per-user scores** cannot use an index (the order differs per user). Cost is therefore linear in the **candidates scored**, so the design rule is: *cheap shared indexes choose at most K candidates; the per-user score ranks only those.* Measured with a synthetic 12-term paid score (interests, types, three "vibe" distances, budget, distance from the user, weekday, freshness, seen, area tier) over tier-0 and tier-1 events in the next 60 days (`perf-scoring.ts`):

| candidates scored K | 30k DB (4,242 available) | 91k-open DB (16,836 available) | under 8 clients, K=1000 |
|--:|--:|--:|--:|
| 300 | 11.7 ms | 1.9 ms | — |
| 1,000 | 10.8 ms | 5.0 ms | 24 ms / 338 req/s (30k) · 12.5 ms / 639 req/s (91k open) |
| 3,000 | 17.1 ms | 40.5 ms | 54 req/s at 91k open (see below) |
| 10,000 | 21.9 ms (4,242 found) | 62.1 ms | — |
| all 16,836 | — | 99.1 ms | — |

* The **marginal cost is about 1.3–4 µs per scored candidate** (median ~3; the K=300 cell at 30k, 8.7 µs, is noise around a tiny total). Free scoring (tier + freshness + seen) costs about the same or less — 8–12 ms at 30k, 1–48 ms at 91k open; the extra paid terms are not the problem, the candidate count is.
* Candidate **generation is the fragile part**: at 91k open the same query flips from an index walk (0.8–3.7 ms at K=300–1,000) to a parallel sequential scan (31–36 ms from K≈1,000–3,000, depending on the data draw), and under 8 concurrent clients that plan collapses to 54 requests/s (148 ms) because the parallel workers fight for cores. A purpose-built index for the tier predicate, plus a plan-regression gate (§7), is required before relying on it.
* Event-side features here are plain numeric columns. **Extracting them from JSON per candidate would be slower and is not measured.** Precompute them at ingestion.
* **Paid versus free** differs only in the terms, never in the pipeline shape: free = tier + date + freshness + seen; paid adds the insight columns of `insight-layer-premium-plan-2026-10-13.md`. Entitlement is enforced where the insight columns are read (candidate scoring and hydration), as that plan's §5 requires.
* **Do not allow user-defined scoring formulas** or unbounded candidate sets; K is a server constant (start at 1,000–3,000).

## 5. "Ids first, hydrate by id, cache in the frontend"

The pattern **already exists in this codebase**: Favorites fetches a frozen id list (`GetFavoritedEventIds`), then hydrates 10 at a time with `events(query: id in […])` and sorts client-side by the id list; the calendar's windowed mode does the same in two stages on the server.

**Measured (no new backend code):**

| step | database time | response |
|---|--:|--:|
| ids only, limit 10 / 200 / 1000, **today's order** | 164–267 ms (30k) · 173–280 ms (120k mature) — flat in K | 0.5 KB / 9.2 KB / 46 KB |
| hydrate 10 ids with `id in […]` | **0.3–0.5 ms** | 7.6–7.9 KB (≈ 790 B per event vs 51 B for an id) |
| rank 200 ids once, per-user (tier + freshness + seen, 60-day horizon, no joins) | 21 ms (30k) · 45 ms (300k) · 52 ms (91k open) | ≈ 9 KB |
| rank 10 per page, same order, with the full select list (P3h) | 22 / 27–37 / 71 ms **per page** | 7.9 KB |

**What the split buys**
* **Amortisation**: a five-page session pays one ranking (21–52 ms) plus five hydrations (≈ 2 ms) instead of five rankings (110–355 ms); the larger the score cost, the larger the gain.
* **Stable paging**: a frozen id list cannot repeat or skip events (BUG-067 for the ranked mode), exactly as Favorites already behaves.
* **`totalCount` for free** (= list length), and **prefetch**: the next pages' ids are known, so cards can be fetched ahead.
* **Shared content, per-user order**: the expensive per-user part (ranking) is separated from the shared part (event content), which can be cached by `id` in TanStack Query and reused by the detail view, Favorites and the calendar.

**What it costs**
* **It saves nothing by itself today**: ids-only on the current query is as slow as the full list. Without the foundation (IDEA-076) it only adds a round trip.
* **Ranking without joins is only 10–35% cheaper** than ranking with the full select list (I3 vs P3: 53 vs 63 ms at 300k, 111 vs 166 ms at 91k open, 34 vs 38 ms at 30k); the sort over candidates dominates, not the joins. Do not sell the split on database time.
* **A waterfall**: rank, then hydrate. Mitigation: the ranking response also carries page 1's full cards plus the remaining ids.
* **Fixed per-call cost is paid again** (API Gateway, Lambda, JWT verification, the `user_settings` lookup) — not in my numbers. Free-tier headroom is large (1M API Gateway calls/month per `2-backend.md`), but latency is what users feel.
* **Staleness**: the list is frozen for the session; new, cancelled or merged events appear only on refresh. Hydration must tolerate a vanished or merged id (`mergedIntoEventId` exists). Set a maximum list age.
* **Cache invalidation needs a trustworthy version.** `events.updated_at` does not change when a schedule is edited (schedules have their own `updated_at`), and `favoriteCount` / `isFavorited` / `isAddedToCalendar` change constantly. Cache *content* by `(id, content_version)` and keep the volatile flags out of the version; one trigger on `schedules` can maintain both the sort key (IDEA-076) and a `content_version`.
* **Entitlement**: hydration must enforce visibility per id and must never put premium insight fields into a shared cache entry.
* **A cap**: the list holds K ids (200 is 9 KB); beyond it, continue by date with a keyset cursor.

**Recommendation.** Do it for the ranked mode after the foundation (opaque cursor = `asOf` + phase + list id); keep the anonymous / no-profile path as one combined call (0.4 ms, simpler). It is an extension of the Favorites pattern, not a new layer; AD-17 / AD-18 need amending, not replacing.

## 6. Is the current stack enough? The evidence, and the tripwires

**Enough, because:**
1. **Throughput headroom is large**: steady peak ≤ 2 list requests/s at 50k registered users (§2) against a measured foundation capacity of 2,084 requests/s (date order) and 76 requests/s (personalised, 60-day horizon, JIT off) on one 4-core database.
2. **Every measured problem is query shape, not infrastructure**: JIT thresholds, an unbounded count, a missing tie-break, an index that keeps ended events, a seq-scan plan flip. None points at Lambda, API Gateway, SQS or Supabase as the limit.
3. **The pipeline is small**: 24k–36k posts/month is ~0.6–0.8 posts per minute on average. The risk is the burst, not the average: a daily scrape that lands ~800–1,200 posts within an hour is 13–20 per minute, which is at the ~15 calls/min on which the POC's key returned 429s — check the production Gemini key's quota.
4. **Per-user scoring is affordable** when capped (§4): 5–40 ms for K ≤ 3,000.

**Not yet measured, check before relying on "enough":** storage (the synthetic 300k-event database is **1.04 GB**, ≈ 3.5 KB per event including schedules and posts; real rows may differ — compare 12–24 months of the forecast with the Supabase plan's storage limit), the write cost of a maintained key, and the fixed per-call overhead.

**Tripwires — what would justify a new layer, and the first lever before it:**

| tripwire (measure it) | first lever | then |
|---|---|---|
| personalised requests exceed ~50% of the measured ceiling (≈ 40 req/s per 4 cores) at p95 | cache the first ranked page per area ladder; raise compute | read replica |
| per-user scoring needs more than ~100 ms at p95 for K ≤ 3,000, or needs per-user history (collaborative filtering, embeddings) | precompute each active user's candidate list nightly (a table of ≤ 1,000 ids per active user; 10k users ≈ 160 MB) via the existing EventBridge + Lambda pattern | pgvector, then a ranking service |
| filters need free-text or semantic matching beyond structured leaves | Postgres full-text / pgvector | external search engine |
| burst concurrency exhausts the pool even with the foundation | reserved concurrency on the API Lambda; a larger pool | revisit pooling |
| open set above ~100k and the 60-day horizon no longer bounds the work | the window rule (exact, tested) | per-ladder precomputed table |

## 7. PostHog — what to measure and how

**Today.** `PostHogProvider` initialises once with `person_profiles: 'identified_only'` and `capture_pageview: false`; `posthog.identify` runs on login. 96 `posthog.capture` call sites (~67 names) cover sign-up/login, PWA install, push, saved locations, subscriptions, votes, the nearby filter, `filter_applied`, `search_submitted`, `event_details_viewed`, favorites and moderator tools. **Gaps:** nothing captures page views despite `capture_pageview: false`; no list impressions; `event_favorited` carries only `eventId`; no AI-filter submit/result/zero-result event; no timing; AD-5 says features must use the shared helper but only one call site does (the rest call `posthog.capture` directly); no consent or opt-out handling and no session-replay or error-capture configuration found.

**Plan, in priority order** (events use AD-5's `noun_verb`; every new name is listed in the event dictionary AD-5 rule 3 requires):

| # | Job | Events (key properties) | What it answers / replaces |
|---|---|---|---|
| 0 | **Basics** | manual `$pageview` on route change; `register()` super-properties: locale, plan (free / trial / paid), coarse city, PWA vs browser, app version; one typed event dictionary in `@festgrid/analytics`; a lint rule for direct `posthog.capture` | a baseline for everything else |
| 1 | **Discovery health** | `discovery_page_loaded` (page, sort_mode, item_count, **client-measured ms**, filter kind); `discovery_page_viewed` (**one event per page** with ids and positions — batched, not per card); `event_card_opened` (id, position, page, tier, **detail_level**); extend `event_favorited` and calendar-add with position/page/tier; `discovery_empty`; `filter_applied` with node count and result-count bucket | real pages per session, real peak concurrency, zero-result rate (the case for close matches), p50/p95 latency users feel, stub vs full engagement — **replaces my traffic assumptions** |
| 2 | **Cost-model calibration** | `subscription_added` (account, source = curated list / wildcard — exists, add `source`); trial funnel: signup → accounts subscribed → first favorite → D1/D7/D14 return → paywall viewed → upgrade clicked → paid (payment method) | the **empirical Zipf exponent and pool size** the cost model flags as unmeasured (s = 1.0, M = 300), and real conversion and retention in place of the 10–25% / 85–96% judgments |
| 3 | **Fake-door and price test** | `ai_filter_trigger_tapped`, `upgrade_prompt_viewed` (variant), `price_point_selected` behind a feature flag | the insight-layer plan §6 test, with its thresholds set beforehand |
| 4 | **Ranking experiments** | flag `discovery_sort` (soonest / area-first / area + freshness + seen); primary: favorites + calendar adds per user-week; secondary: open rate by position, return rate; guardrails: "Soonest" toggle use, client p95 | IDEA-074 / IDEA-078 — see sample sizes below |
| 5 | **Operations (client side)** | PostHog error capture; Web Vitals; sampled `graphql_request_timed` (operation, ms, status) | what users feel. **Not** a replacement for database monitoring: use Supabase query performance / `pg_stat_statements` / `auto_explain` and CloudWatch for the server; AD-5 is frontend-only, so I do not suggest `posthog-node` yet |

**Experiment power, honestly.** Detecting a +10% relative lift on a 20% weekly favorite rate needs about **6,300 users per arm**; +25% needs about 1,000; on a 10% base rate, +10% needs about 14,100 and +25% about 2,300 (two-sided 5%, 80% power). At 2,000 daily actives only large effects are testable in weeks, so run the **offline replay** first (`favorites` history, proposal §5) and A/B only what survives it.

**Event volume.** At 2,000 daily actives, ~4 page loads + 4 batched page-view events + ~10 interactions a day is ≈ 1.1M events/month; **per-card impressions (≈ 40 per active a day) would triple it to ≈ 3.2M**. Batch per page and sample. Check the current plan's limits.

**Privacy.** Keep `identified_only`. Send ids and coarse buckets, never free text, never coordinates (the saved-location boundary of PRD §4.6 applies), nothing from children's-data filters. Decide consent or opt-out handling and the PostHog host region before replay or error capture is turned on (PRD: replays are "optional"; PDP and §3.16 apply).

## 8. Proposed backlog and order of work

* **FIND-088** — Discovery selects `totalCount` it never reads (first, one-line, free: 31–348 ms per page).
* **FIND-089** — every signed-in `events` request upserts `user_settings` just to read one setting.
* **IDEA-079** — PostHog: basics, Discovery measurement, cost-model calibration, experiments.
* **IDEA-080** — ranked ids per session + hydrate by id (+ `content_version`), after IDEA-076.
* **FIND-087 corrected**: the JIT penalty is a cliff set by estimated plan cost against 500k, not a constant 80%.

Order: **FIND-088 → PostHog basics + Discovery measurement (so real numbers arrive while the rest is built) → JIT setting and tie-break (BUG-067) → IDEA-076 foundation → area tier with horizon (IDEA-074) → IDEA-080 → freshness / seen (IDEA-078) → close matches (IDEA-077).**

## 9. Decisions needed from you

> **Answered 2026-10-19** — see `proposal-target-area-and-scan-safety.md` §0: stubs → the target area is what matters; retry sweep accepted; captions "cleared at next re-extraction"; PostHog approved; geocode calibration waits for a key supplied through the environment; `totalCount` re-analysed (§4 there).


1. Stubs: show as ordinary cards, badge them, rank them lower, or hide them until enriched?
2. Retry sweep on the existing 5-minute scraper rule — agreed?
3. Geocode floor: can I get a Geoapify key for the calibration probe, or will you run it?
4. Captions: accept "cleared at next re-extraction", or purge the legacy stock once (FIND-086 counts it)?
5. PostHog: approve the §7 order; decide consent / opt-out and the host region; allow a lint rule against direct `posthog.capture`?
6. Remove `totalCount` from the Discovery document now?

## 10. Limits

* **Synthetic data, database only, one sandbox**, medians of 5; run-to-run and build-to-build variation is real (the same query on a rebuilt database moved by up to ~50% for some variants, and one windowed variant by 5× — 8.9 vs 43.5 ms — because the random audience draw differs). Do not read differences below ~30% as findings.
* **Not measured**: the write cost of a maintained key; fixed per-call overhead (API Gateway, Lambda cold starts, JWT verification); scoring over JSON-stored features; real event-side distributions; the production `jit` setting and pool size; Supabase storage limits.
* **My assumptions**: 1 event per post, ~30-day lead time, 20% daily actives, 3 list requests per session, 15% of traffic in the peak hour, the push-burst share. The scoring terms are invented; they measure cost, not ranking quality.
* The anonymous plan's JIT cost dominated my first-round headline; the correction is in §3. All first-round tables remain valid for the data they were measured on.

## 11. Reproducing

```
# scratch Postgres 16, from apps/backend (databases: seed:volume --events 30000 / 120000 / 300000; aged as in setup scripts of the earlier round)
export BACKEND_PORT=4001 DATABASE_URL=postgres://…/bench
npx tsx scripts/poc-event-insight/perf-request.ts  --label x --out request.md    # §3, §5: every statement of one page; ids-only; hydrate
npx tsx scripts/poc-event-insight/perf-features.ts --label x --out features.md    # ranking cost incl. the ids-only I-series
npx tsx scripts/poc-event-insight/perf-scoring.ts  --label x --out scoring.md --sql-dir d   # §4; run perf-features first
pgbench -n -f d/paid-1000.sql -c 8 -j 4 -T 8 bench                                 # concurrency (PGOPTIONS='-c jit=off')
```
Scratch databases only: `perf-features.ts` and `perf-scoring.ts` add `bench_*` columns; `perf-request.ts` runs `EXPLAIN (ANALYZE)` on the statements it captures, which executes any non-`SELECT` among them (one `user_settings` upsert in the signed-in case).
