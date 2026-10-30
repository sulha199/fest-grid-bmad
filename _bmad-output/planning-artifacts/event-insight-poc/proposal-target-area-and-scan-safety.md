---
status: draft-for-review
type: planning-proposal
date: 2026-10-19
related: [proposal-posthog-and-list-scale.md, proposal-discovery-ranking-and-scale.md, proposal-personalized-discovery.md §9–§10; prd §3.1, §4.3; Architecture Spine AD-17, AD-18, AD-30; backlog IDEA-073, IDEA-074, IDEA-076]
evidence: ./results/area-resolver-eval.generated.md · area-kinds-probe.generated.md · perf-candidates-*.generated.md · perf-pgbench-candidates.generated.md · plan-guard-month12.generated.txt · perf-count-and-ranking-*.generated.md
backlog: [IDEA-081, IDEA-082, FIND-088 (re-analysed); decisions recorded on IDEA-075, IDEA-079, FIND-086]
---

# Target area, proactive scan prevention, and the total count — second pass

> **Planning artifact.** No product code under `apps/*` or `packages/*` was changed. Added: POC tooling under `apps/backend/scripts/poc-event-insight/` (`area-resolver.ts`, `plan-guard.ts`, `perf-candidates.ts`, …, 238 offline tests in total) and result tables under `./results/`. Database numbers are from a **scratch PostgreSQL 16.15 with the repository's migrations and `seed:volume` data** (30k, 120k and 300k events), database only, one 4-core sandbox: ratios are the finding, milliseconds are the sandbox's.

## 0. Decisions recorded (your reply of 2026-10-19)

| item | decision | recorded in |
|---|---|---|
| Stub events | The **audience's target area** is what matters, not the curator's location. Find the best way to define it and map it to the right area level; decide filtering/scoring for "target area but no recorded location" later. | §2 (design), IDEA-081 |
| Retry sweep | **N-minute backoff and retry is enough** — the schedule in `profile-retry.ts` (15 min, 1 h, 6 h, 1 d, 3 d) on the existing 5-minute scraper rule. | IDEA-075 note |
| Geoapify key | See §1: this is a cloud session; I cannot read your local `.env`. | §1 |
| Stored captions | **Accept "cleared at next re-extraction".** No purge. | IDEA-075 / FIND-086 notes |
| PostHog | **Approved** (plan, order and privacy posture of `proposal-posthog-and-list-scale.md` §7). | IDEA-079 → `triaged` |
| Roundup heading as a stated area | **Yes** (reply 2): a place in a roundup's heading counts as a stated area for items that state none — with the guardrails of §2.6. | §2.6, IDEA-081 |
| Slow table scans | **Prevent proactively.** | §3, IDEA-082 |
| Total count | Make sure a `hasNextPage`-style flag exists; **analyse again whether skipping the count matters.** | §4 |

## 1. The Geoapify key

This session runs in a cloud container (not on your machine): the repository was cloned from GitHub, so your local `.env` is not in it — only `.env.example` — and I have no way to read files on your computer. Nothing is blocked on the network: `api.geoapify.com` answers from here (HTTP 401 without a key). To give me the key without pasting it into chat, add `GEOAPIFY_API_KEY` to the cloud environment (environment menu in the session's title bar → Edit → a network secret / environment variable). A **new session** picks it up. **But read `prod-readonly/README.md` first for anything touching production**: do not copy the whole `.env` into the cloud environment (the cloud proxy cannot carry raw-TCP databases anyway); the key for this one HTTPS service is the only thing worth adding. With it I can run `probe-geocode-country.ts` (BUG-066) and calibrate the confidence floor, and test the geocoder side of §2. Until then I have not mocked or invented any geocoder result.

**What this session does and does not have access to** (you asked, because it was not clear): I have **not** connected to your production database, and I have **not** read your local `.env` — I cannot. Everything I measured ran on a PostgreSQL I created inside this container with synthetic data (`seed:volume`), as each document says. The repositories were cloned from GitHub. The container does carry environment variables set on the cloud environment — I listed the *names* only: a Gemini key (`SYSTEM_GEMINI_API_KEY`, which the live extraction experiments and the probe in §2.9 used), plus an **Apify token and AWS credentials that I have not used**. I cannot tell what those two can reach; if they are not meant to be in a cloud environment, or are production-scoped, it is worth reviewing the environment's variable list and removing what the work does not need. I will not use them unless you ask. The statements that depend on real data (the legacy accounts being Indonesian curators, `SHOW jit`, real event counts) are still yours to confirm; the SQL for each is in the backlog notes.

## 2. The target area: how to define it and map it to the right level

### 2.1 Two corrections to what I told you before

* **Stubs normally do have a date and a place.** The current extraction prompt extracts a roundup item *only when it has both a readable date and a readable location*; otherwise the item goes to `skippedItems` (`build-gemini-request.ts`, "ROUNDUP HANDLING"). My earlier wording ("sparse, possibly with no date or place") came from an older comment on the `stub` type. A stub is simply an event whose primary post is a roundup or curator-sourced (never notifies); a *curator's single-event post* can still name no venue.
* **The UI is not blind to roundups.** Event *detail* pages already head the related-events group with the roundup's `postTitle` ("Events from …"). What does not exist is any distinction in the Discovery list, and `detail_level` is not exposed in the GraphQL schema.

### 2.2 Where a target area can come from (priority order, as already decided)

1. **Stated audience** in the post ("se-Kabupaten Bantul", "mahasiswa se-DIY") — extracted by the model, 18/18 on the 6-post held-out set (small).
2. **The item's own place** for an ordinary local event with no stated audience. For roundup items this is guaranteed by the prompt rule above, which is why your point holds: *the roundup's own schedules already carry the area*.
3. **A post-level area** — a roundup titled "Weekend Roundup in Jakarta" or from a city curator. `postTitle` is stored but nothing parses an area from it. **Decided: it counts as a stated area for items that state none, with the guardrails of §2.6.**

The unsolved part is the mapping: **a name as written → a canonical key on one administrative ladder, with the right level.**

### 2.3 What the model's level labels are worth (measured on the recorded runs)

`area-resolver-eval.ts` resolved every area the model produced in the recorded audience-area runs (73 mentions, 21 distinct strings) against a gazetteer and compared the level:

| class | mentions | examples |
|---|--:|---|
| the model's level agrees with the gazetteer | 47 | "Kabupaten Bantul" regency, "DIY" province, "Kota Surabaya" city |
| **model level wrong** | **8** | "Jabodetabek" called a *province* (3; it spans three), "Jawa" called a *province* (3; an island of six), "Canggu, Bali" a *city* and "Canggu, Kabupaten Badung" a *regency* (it is a locality; the same place was also labelled *neighbourhood*) |
| ambiguous string | 9 | "Yogyakarta" — the city or the province (the model said *city* every time) |
| definitional | 6 | "Jakarta" — city or province (it is both) |
| outside the Indonesian sample | 3 | "Victoria" (Australia) → the geocoder |

Caveat that matters: the sample gazetteer was typed by me **after** reading these names, so coverage here is fitted, not a held-out estimate; the useful numbers are the level disagreements (8 wrong, 9 ambiguous), which do not depend on coverage. Six posts' worth of names is a small sample.

### 2.4 Recommended way to define it

1. **The model reports the name and the scope; it does not decide the level.** Keep `geoScope`; ignore its `level` for ordering.
2. **Resolve the name to canonical keys with a gazetteer, deterministically** (`area-resolver.ts`, 9 tests): normalise ("se-", "warga", diacritics), split lists ("DIY & Jawa Tengah"), use type markers ("Kabupaten", "Kota", "Daerah Istimewa"), look up aliases ("Jogja", "DIY", "Jateng"). Indonesia's hierarchy is small and static (provinces → regencies/cities → districts), so a shipped gazetteer is cheaper, faster and more predictable than a geocoder call per area, and it works **offline and without coordinates**. Build it from the official administrative-code list (Kemendagri / BPS) after confirming its licence and revision; the sample in the POC is hand-typed and not to be shipped.
3. **Aggregates are sets, not points on the ladder.** "Jabodetabek" resolves to its nine member regencies/cities, "Jawa" to six provinces. The stored value is a *set of keys*, each with its ancestor path (`id > id-yo > id-yo-sleman`) so matching is hierarchical.
4. **Ambiguity is flagged and resolved by a rule**: a bare "Yogyakarta" resolves to the **widest** candidate (the province) and is marked `ambiguous`; "Kota Yogyakarta" resolves to the city. Narrowest and "both" are options; the default is a product call (widest loses fewer local users, narrowest is more precise).
5. **Names outside the gazetteer go to the geocoder** and come back as the same ladder (country, state, county, city, suburb → levels), under the confidence floor. This is the part that needs the Geoapify key.
6. **The key level for ordering is the regency/city**, the unit people name; localities and districts roll up to it, provinces and aggregates cover many.
7. **Ordering tier from keys, not text** (`tierFor`): any rung on the user's ladder — same, inside, a containing area, or a sibling — is tier 0; a national audience is tier 1; elsewhere is tier 2. (A DIY event is tier 0 for a user in Sleman; "Jawa" is tier 0 because its members include the user's province; Jabodetabek and Bali are tier 2.)

This also supplies the missing writer for BUG-063 (`adminArea` is never written) and is the resolver half of IDEA-073.

### 2.5 Target area but no recorded location — options for the later decision

The audience key exists, the event has no pin. Per leaf (not decided; recommended default in bold):

| filter / score leaf | rule |
|---|---|
| area tier (ordering) | audience keys — unaffected |
| `locationAdminArea = Sleman` | **venue path when there is a venue, otherwise the audience path** (match when it reaches the area) — or treat as *unknown* (0.5 credit, shown as "can't tell") |
| `locationProximity` / "Nearby" | **needs coordinates: unknown, never a match** (a strict filter excludes it, a partial-match lane shows it with "no location") |
| map pin, distance label | absent |
| `venueType`, indoor/outdoor | unknown |

### 2.6 A roundup heading as a stated area — decided yes; the edge cases

Your answer is yes. The edge cases below decide *how*; the live probe in §2.9 shows the model can already tell most of them apart.

| edge case | example | rule |
|---|---|---|
| The heading's place is where events are, not who they are for | "Agenda Jogja", "Event di Bandung" | `events_located_in`: a coverage claim. It **supplies** an area for items whose own place does not resolve; it does not override an item that has its own stated audience |
| The heading names an audience that differs from the place | "Wisata Jogja untuk warga Jakarta" | two roles from one heading: Jogja = where, Jakarta = audience. Only the audience becomes the items' stated audience |
| The place is part of a name | "Java Jazz Festival", "Bali United vs Persib Bandung" | `brand_or_name`: ignore. A plain alias scan of titles would turn Java Jazz (held in Jakarta) into the whole island of Java |
| The heading is wider than the item | national or island heading over a Surabaya concert | **never widen**: a heading wider than the item's own place does not move the item up to tier 1, unless the role is audience |
| An item lies outside the heading's area | "Jadwal Konser Jabodetabek" listing a Bandung concert | the item keeps its own place; the conflict is flagged. In the probe the model did not leak item places into the heading's areas (0 of 16 runs) |
| Online or national items inside a local roundup | a Zoom webinar in "Agenda Jogja" | no place from the heading unless its role is audience; otherwise the national webinar is wrongly localised |
| The heading names several places or an aggregate | "Jawa-Bali", "Jabodetabek" | a set of keys (§2.8) |
| **The heading was written by the model, not by the post** | the model's `postTitle` "Weekend Event Roundup in Jakarta" when the post has no heading | **circular**: that place was derived from the items' venues and adds no independent signal. Use only a heading **found verbatim in the post text** (the existing grounding guard); do not parse `postTitle` |
| Ambiguous names | "Agenda Yogyakarta" | the same ambiguity rule as any other area (flagged, widest by default) |
| No heading, or an old post | most posts; `postTitle` was never backfilled | nothing changes; the item falls back to its own place |
| Event with several posts (AD-30) | roundup is the primary post for one item and not for another | use the primary post's heading, as for the rest of the insight |
| An item whose own place does not resolve | the item says only "Gedung X" and geocoding fails | **this is the main case the heading helps**: it supplies the city, so the event still gets a target area without a pin |

Practical effect, stated plainly: for items that have a resolvable place the heading rarely changes anything (the ladder is merged and a Bantul item and a "Jogja" heading are both tier 0 for a Sleman user); it earns its keep for items whose place does not resolve and for the audience-differs case.

### 2.7 The ladder to define: levels, settlement type, aggregates, scopes

Yes — define it explicitly, but as **four separate things**, not one list with "urban" and "sub-urban" mixed in:

| concept | what it is | values | used for |
|---|---|---|---|
| **administrative level** (a tree) | the legal hierarchy; each unit has one parent | `country > province > regency/city > district > village` (Indonesia: provinsi > kabupaten/kota > kecamatan > kelurahan/desa); the model's `neighborhood` maps to a locality below district | nested/parent matching and the graded closeness (same / inside / covers / sibling / other) |
| **settlement type** (an attribute, not a level) | whether a unit is urban or rural | derived for free from the legal type: **kota** vs **kabupaten**, **kelurahan** vs **desa** | optional scoring such as "city-centre" vs "outskirts"; not needed for matching in v1 |
| **aggregate** (a set of units, any levels) | a named area that is not one administrative unit and may cross provinces | metro areas (Jabodetabek, Kartamantul, Solo Raya, Malang Raya, Gerbangkertosusila), islands (Jawa, Sumatera), regions (Indonesia Timur, Nusa Tenggara), supranational (Asia Tenggara, ASEAN); each lists its members | "dan sekitarnya" catchments and any audience phrase that names a region; this is where **sub-urban** belongs (the surroundings of a city are a set of neighbouring units, not a level) |
| **scope** (not an area) | how far the audience reaches | `venue_local, city, region, national, international, online, unspecified` (already extracted) | tier 1 ("anywhere") for national / international / online with no area |

Why urban/sub-urban are not levels: they do not nest (a sub-urban district belongs to a regency, not to an "urban" node), they have no legal definition or data source, and two competing definitions would corrupt matching. The legal kota/kabupaten and kelurahan/desa types already give the urban/rural split where it is wanted.

Two additions the data asked for: a **`continent`/supranational** top (the recorded runs contain "Asia"), and a **qualifier** on an area — `only`, `and_surroundings` ("dan sekitarnya"), `part_of` ("Jawa bagian selatan"). A qualifier changes the set: `and_surroundings` = the named unit plus its neighbours (siblings under the same parent, or the members of the aggregate it belongs to).

### 2.8 Does "Jawa" mean several provinces? Yes — an event has a *set* of target areas

* `audienceAreas` is a **set of keys**, each with its ancestor path. "Jawa" is six provinces (DKI Jakarta, Jawa Barat, Banten, Jawa Tengah, DI Yogyakarta, Jawa Timur); "Jabodetabek" is nine units in three provinces; "DIY & Jawa Tengah" is two; a tour "Jakarta, Bandung, Surabaya" is three cities.
* Keys are stored at the **covering level** (the six provinces, not their ~119 regencies); descendants match through the path, so the stored set stays small. A very large set (for example "Indonesia Timur") is capped and stored as the aggregate key itself.
* **Relation = the best over the set**: a Sleman user is `covers` for "Jawa" (it contains DIY) and `same` for "Sleman"; the closest relation decides the tier.
* "Jawa" itself is ambiguous in Indonesian — the island, or the Javanese heartland — and "se-Jawa Bali" is an island pair. Default: the island, flagged ambiguous; "Jawa Tengah/Timur/Barat" are resolved first by longest match.
* Country-level keys and above are **not an audience area**: they mean "national" and go to tier 1.

### 2.9 Can the AI extract this? A live probe

Existing evidence (prompt v2, `gemini-3.5-flash-lite`): **scope and stated area names** — 57/60 fully correct on the core set (the 3 misses are the known `cald-conference` post), **18/18 on the 6-post held-out set**, no ungrounded area, no venue leak. What it did *not* do well was the level (§2.3). The new probe (`run-area-kinds.ts`; 18 short posts and 8 roundup headings, 2 runs each, **my** gold labels, one labeller) asks for something different: a **kind**, a **qualifier**, the **units covered**, and the **role** of a place in a heading.

| | result |
|---|---|
| kind of the area (admin unit / metro area / island / region / country / continent) | **36/36 runs** — Jabodetabek, Solo Raya, Malang Raya, Kartamantul, Gerbangkertosusila, Bandung Raya = metro areas; Pulau Jawa = island; Indonesia Timur, Asia Tenggara, Pantura = regions; "Bali dan Lombok" = province + island |
| qualifier ("dan sekitarnya", "bagian selatan") | **35/36** — one misread: "se-DIY **dan** Jawa Tengah" got `and_surroundings` on one area in one run |
| units covered, where graded (Jabodetabek, Java, Kartamantul, DIY + Jawa Tengah) | recall **92%** over 8 runs, no extras: Java 6/6, Kartamantul 3/3, DIY + Jateng 2/2, **Jabodetabek 6/9 in both runs**. I could not inspect the raw lists (the key was rate-limited on the rerun), so I cannot say whether the missing three are the model's omission or my sample gazetteer resolving a bare "Bogor/Bekasi/Tangerang" to the city only |
| role of a place in a roundup heading (coverage / audience / brand / none) | **16/16 runs**, including the traps: "Java Jazz" and "Bali United vs Persib Bandung" as brands, "Wisata Jogja untuk warga Jakarta" split into place and audience, a heading with no place over items in three cities (no leak), and a Bandung item under a Jabodetabek heading (no leak) |

**Answer:** yes for what the post *says* — names, kind, qualifier, role, and a best-effort list of covered units — and that is good enough to use as input. **No for being the source of truth**: the unit lists are 92% on a small graded set and the earlier runs got the level wrong 8 times in 73. So keep the split: the model reports; the gazetteer and aggregate table (curated, versioned, reviewable) decide. A useful middle path for aggregates the table does not know yet: accept the model's `coveredUnits` **only** after they resolve in the gazetteer, mark the result `source: model`, and queue it for review like an abstention.

**Limits of the probe.** Short, clean, synthetic posts that I wrote; real posts are messier. The headings were given as post text, so it does not test the "model-written title" case of §2.6. Gold labels are mine, general knowledge, unchecked against an official source. Two runs per case. The probe called the live Gemini API (a key from the cloud environment); no production data was used.

## 3. Preventing slow table scans proactively

### 3.1 What actually goes wrong (measured)
* **The shape flips with the data.** Candidate generation by array overlap (`audience && ladder OR none`, date order, LIMIT K) walks an index in 0.5–0.8 ms at K=300 and then, at K ≥ 1,000 on 91k open events, **reads the whole candidate pool: 28–42 ms and 16,845 rows scanned to return 1,000** (178 requests/s at 8 clients). On an earlier build of the same data it flipped to a parallel sequential scan (54 requests/s). One shape, three plans, depending on a statistics draw.
* **Today's list query already has the bad shapes**, and the guard shows it (§3.3).
* A `Seq Scan` rule alone would have missed the 91k case above (it was a bitmap scan of the pool): the guard also needs a **work budget**.

### 3.2 Layer 1 — make the slow plan unavailable (by construction)
Serve candidates from a **junction table of audience-area keys** — one row per (event, area), indexed `(area_key, open_key, event_id)` — merged branch by branch: one ordered index range scan per rung of the user's ladder, each with its own `LIMIT K`, plus a partial-index range scan for events with no audience area. Work is bounded by (rungs + 1) × K index entries whatever the table size, and there is no cheaper plan for the planner to prefer.

| 91k open events, ladder of 3 rungs | array overlap + OR | junction branches | speed-up |
|---|--:|--:|--:|
| K = 1,000: 1 client / 8 clients | 28.6 ms / 44.9 ms (178 req/s) | **1.0 ms / 1.9 ms (4,108 req/s)** | 27× / 23× |
| K = 3,000: 1 client / 8 clients | 29.5 ms / 50.1 ms (160 req/s) | **2.3 ms / 4.7 ms (1,708 req/s)** | 13× / 11× |
| rows scanned, K = 3,000 | 16,845 | 6,749 | |

At 30k, 300k ("month 12") and 120k mature the two forms were both fast (0.3–7 ms; pools of 2.5k–4.3k events) — **the flip is a large-pool phenomenon, and a purpose-built index is what removes it.** The write side is not measured: `open_key` is copied into the junction so the merge can stay in index order, which a roll-forward (and any schedule edit) must keep current, in the same trigger as the sort key (IDEA-076). Real events can have several audience areas, so the merged branches need a `DISTINCT` on id (small, bounded by (rungs + 1) × K).

### 3.3 Layer 2 — a plan guard in CI
`plan-guard.ts` (pure over `EXPLAIN (ANALYZE, FORMAT JSON)`, 9 tests) and `plan-guard-run.ts` (live; exit code 1 on violation). Rules, starting values to tune: no sequential scan of a hot table (`events`, `schedules`, `posts`, `favorites`, `reports`, `calendar_additions`) touching ≥ 1,000 rows; estimated cost ≤ 400,000 (the JIT cliff is at 500,000); no JIT-compiled function; rows scanned ÷ rows returned ≤ 2,000; and an optional **absolute scanned-rows budget per query** (4 × K for a candidate query).

On the month-12 database (300k events, 22k open) the guard fails **all four** of today's Discovery statements and passes the junction candidate query:

| statement | ms | rules broken |
|---|--:|---|
| page, anonymous | 1,139 | Seq Scan on events (300,012 rows), cost 765k, 75 JIT functions, scanned 405,559 rows to return 11 (×36,869) |
| count, anonymous | 382 | Seq Scan on events, 33 JIT functions, scanned 330,608 rows to return 1 |
| page, signed in | 1,237 | cost 523k, 105 JIT functions, scanned 146,253 to return 11 |
| count, signed in | 286 | 48 JIT functions, scanned 52,555 to return 1 |
| junction candidates, K = 3,000 | 8 | — passes |

Run it on the volume seed in the existing nightly workflow pattern (`seed:volume` + a Postgres service container); it needs no new infrastructure. The statements it checks should include every hot query the PostHog data (§7 of the previous document) shows to matter.

### 3.4 Layer 3 — contain a flip that gets through
* **JIT off for the API role** (role-level, or `SET LOCAL` in a transaction — a plain `SET` is lost behind a transaction-mode pooler). The guard's JIT rule keeps this honest.
* **A statement timeout for list queries** (for example 2 s, via a dedicated role or `SET LOCAL`) so a flipped plan fails fast instead of holding one of ~15 pooled connections for tens of seconds. Use a separate role for moderator tools and backfills that legitimately run long.
* **Do not rely on `enable_seqscan = off`**: when I turned it off for the flipped candidate query it was no faster (48.6 vs 48.8 ms, the candidate-and-score query of the earlier build); a hint cannot fix a query shape.

### 3.5 Layer 4 — see it in production
Supabase's query-performance reports / `pg_stat_statements` for the list statements (mean and p95 time, rows per call, block reads), an alert when they drift, and PostHog's client-measured `graphql_request_timed` p95 as the user-side signal. `auto_explain` would capture the offending plan; **whether the hosted database allows it is unverified**. After bulk loads, `ANALYZE` (autovacuum usually covers it) — but stale statistics are the cause the first three layers are meant to make irrelevant.

## 4. Skipping the total count — analysed again

### 4.1 The flag exists
`EventConnection { items, hasMore, totalCount }`: `hasMore` is computed from the extra row the query fetches (`limit + 1`), not from the count (`resolvers.ts`, "`hasMore` above is computed from the fetched page length"). It is the `hasNextPage` flag; Discovery's `getNextPageParam` reads `lastPage.events.hasMore`. In the ranked, frozen-list mode (IDEA-080) it is `offset + page < ids.length`. If cursors arrive, expose it as `pageInfo { hasNextPage endCursor }` and keep `hasMore` for existing clients.

### 4.2 Who reads the count
Searched `apps/web/src`: **nobody reads `totalCount` from the shared `getEvents` document.** The remaining readers use their own documents — Archive (`GetArchivedEventsDocument`, which uses it for page arithmetic that `hasMore` could do) and the favorited-ids snapshot (`GetFavoritedEventIds`, for a count of favorites). The synthetic page objects built in Favorites and the navigation hook set their own `totalCount` only to satisfy the type.

### 4.3 What it costs (JIT off, median of 5; `perf-features.ts` N-series)
| database (open events) | the page itself, today | today's count statement | page after the foundation (date order) | exact count on the maintained key | count from the open-events index alone | capped count (stop at 1,001) |
|---|--:|--:|--:|--:|--:|--:|
| 30k (22k) | 195 ms | 49.5 ms | 0.6 ms | 37.1 ms | 7.3 ms | 2.1 ms |
| 120k mature (13k) | 281 ms | 103.9 ms | 0.6 ms | 31.2 ms | 3.5 ms | 24.2 ms |
| **300k, month 12 (22k)** | **503 ms** | **243.8 ms** | **0.5 ms** | **65.9 ms** | **7.5 ms** | **53.7 ms** |
| 120k, every event open (91k) | 963 ms | 283.2 ms | 0.4 ms | 190.4 ms | 37.4 ms | 2.0 ms |

* **Today** the count is 20–33% of a page's database time (the previous round measured 14–42% over the whole request).
* **After the foundation it matters far more**: a date-ordered page costs 0.4–0.6 ms, so even the best exact count (31–190 ms on the maintained key) would be **98%+ of the request** — and as large as a whole personalised page (20–70 ms). The count would silently erase the foundation's gain.
* **There is no cheap exact total.** The index-only count (3.5–37 ms) is a *global* number that ignores the user's visibility and filters; filtered exact counts are 8–55 ms; and even the **capped count is plan-fragile** (2.0 ms at one size, 53.7 ms at another — the same family of problem as §3).
* **What a count is for**: nothing in Discovery. A UI that wants "N results" should show "many" via `hasMore`, or a cached/approximate figure per ladder and day — not a per-request `count(*)`.

### 4.4 Recommendation
Remove `totalCount` from the shared `GetEvents` document (nothing reads it); keep the schema field, computed only when selected (already true). Add a ratchet so it does not creep back: a test that scans the web's `.graphql` documents and fails if a list document selects `totalCount` outside an allowlist (Archive, favorited ids). Optionally trim the count statement's unneeded `LEFT JOIN`s to `schedules` and `posts` for the remaining readers.

## 5. Backlog and next steps
* **IDEA-081** — target-area resolver: gazetteer + aggregates + level from the gazetteer (supplies BUG-063's writer; half of IDEA-073). Needs the official data source and the Geoapify key.
* **IDEA-082** — plan-regression guard + statement timeout + JIT off + junction candidate generation (the "prevent slow scans" epic seed; depends on IDEA-076).
* **FIND-088** — re-analysed (§4): remove `totalCount` from the Discovery document; the case is stronger after the foundation.
* **IDEA-079** — PostHog: approved, `triaged`.
* **Decisions recorded** on IDEA-075 (retry schedule accepted; captions "cleared at next re-extraction") and FIND-086.

Order: FIND-088 → PostHog basics → JIT off + statement timeout + tie-break → IDEA-076 foundation **with the plan guard in CI from its first story** → area resolver (IDEA-081) feeding the junction table → area tier with horizon → IDEA-080 → freshness/seen → close matches. When you want these as stories, `bmad-create-epics-and-stories` is the next step; I have not started it.

## 6. Limits
* **Synthetic data, database only, one sandbox**, medians of 5; build-to-build variation is real (the same junction-vs-overlap comparison flipped plan type between builds). Do not read differences below ~30% as findings.
* **Not measured**: the write side of the junction table and the sort key; the geocoder half of area resolution; the real distribution of audience areas (here 40% none, 12 areas, one per event); a held-out evaluation of the gazetteer. The gazetteer is a hand-typed sample.
* The §2.9 probe: 26 hand-written cases, two runs each, my gold labels, clean synthetic text; membership graded for four cases only; the raw lists of the aggregate cases were not inspected.
* The statement-timeout and `SET LOCAL` mechanics through Supabase's pooler are reasoned from its documented transaction mode, not tested.
* The plan-guard thresholds are starting values chosen by me; the first real runs should tune them.

## 7. Reproducing
```
export BACKEND_PORT=4001 DATABASE_URL=postgres://…/bench          # scratch database, seed:volume as in the earlier documents
npx tsx scripts/poc-event-insight/perf-features.ts   --label x --out features.md           # creates bench_* columns; N-series = count cost
npx tsx scripts/poc-event-insight/perf-candidates.ts --label x --out cand.md --sql-dir d   # overlap vs junction, each fed through the plan guard
npx tsx scripts/poc-event-insight/plan-guard-run.ts  --sql d/junction-3000.sql --sql d/overlap-3000.sql   # exit 1 on a violation
npx tsx scripts/poc-event-insight/area-resolver-eval.ts results/audience-areas-v2-core.json results/audience-areas-v2-holdout.json   # offline
npx tsx --test scripts/poc-event-insight/*.test.ts                                           # 238 offline tests
```
