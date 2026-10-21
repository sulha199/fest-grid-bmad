# What the production checks show — pack SQL, recall classes, geocode probe (2026-10-19)

**Source.** Three files pushed by the local session (commit `1031970`): `results/prod-readonly-report-2026-10-19.md`, `results/recall-classes-prod-2026-10-19.txt`, `results/geocode-probe-2026-10-19.md`. **Caveats the local session reported, and I confirm:** check 1 is the pack's *SQL* run through `psql` as `readonly_2` (the pack itself refuses that role), so the Discovery-statement `EXPLAIN (ANALYZE)` verdicts were **not** run; the figures are the owner's production primary at one moment. I re-ran nothing against production; everything below is read from those files, the repository code, and my own reasoning where I say so.

## 0. Result in brief

1. **BUG-068 is confirmed on production for every column the role can see:** 2,231 of 2,231 non-null values are JSON strings, **0** objects or arrays. Production still runs the double-encoding writer today (no object row exists even among October's rows).
2. **The report's numbers reproduce exactly** with the corrected pack (1,394 events, 253 stubs, 431 open, 1,725 schedules, 1,460 pins, 379 outside the box, 466 legacy accounts / 463 without a default location). `events_per_event_post` is **1.08** with 0 events lacking a post: my earlier "does not reconcile" was wrong about the number (§5).
3. **The matcher's real recall is at most 23 / 168 ≈ 14%, and the "5%" mixes three different things.** But my first `recall-classes.sql` had a bug (found in this pass), so the class sizes need one more run (§2). Code reading gives a strong hypothesis for most of the uncovered reachable pairs: **duplicate stubs cannot reach the 'mid' threshold by construction.**
4. **Geocoding is worse than the 379 suggests.** Half of the probe's descriptions got the wrong place, and most of those are *inside* Indonesia, invisible to the bounding-box test; **627 of 1,460 pins (43%) carry a stored confidence under 0.5**, and 265 schedules have no pin at all. About half of the schedules (at least 892 of 1,725) have no trustworthy pin (§3).
5. **Nothing was changed** in thresholds, product code or schema. Not measured: the Discovery plan on production (low value at this size).

## 1. Check 1 — the figures that matter

| Figure (production, 2026-10-19) | Value | What it means |
|---|---|---|
| server | PostgreSQL 17.6, `jit` off, `work_mem` 2.1 MB, parallel workers 1 | the JIT cliff is not a live risk |
| events / stubs / open | 1,394 / 253 (18%) / 431 (31%) | same as the owner's run |
| events per month | Aug 31, Sep 434, Oct 929 (to the 19th) | about 1,500 a month at the October pace (a ramp-up: 31, 434, then 929 in 19 days) |
| events per event-post | **1.08** (1,286 posts hold the 1,394 events as primary post; 0 events without a post) | the forecast's 1.0 is 8% low; small |
| jsonb encoding | `schedules.location_details` 1,460 of 1,460 **string**; `default_location` 28 of 28; `events.links` 247 of 247; `posts.additional_image_urls` 496 of 496; 0 objects or arrays | **BUG-068 confirmed**; the migration for these four columns is 2,231 rows |
| schedules | 1,725 (1.24 per event); 265 with no location (15%); 1,460 pinned | |
| `with_admin_area` | **0** of 1,460 | BUG-063 confirmed on production |
| `with_venue_type` | 37 of 1,460 (2.5%) | `venueType` is too sparse to be a filter vocabulary today |
| `low_confidence_pins` (stored confidence < 0.5) | **627** of 1,460 (43%) | see §3; pins with no stored confidence are not in this count |
| pins outside Indonesia's box | 379 (26%) | a **floor** on wrong pins (§3) |
| country mix (all 1,725 schedules) | id 933, (none) 425 = 160 pinned without a country code + 265 unpinned, us 104, fr 41, dk 27, my 24, in 23, es 19, eg 13, ca 11, br 10, lb 7, pk 6, et 6, mx 6 | |
| accounts | 466 with no type and no status (463 without a default location); `CURATOR_GUIDE` 17 (**11 of them hold a default location**); `ORGANIZER_VENUE_EVENT` 16 (2 without); 1 awaiting approval | the IDEA-075 bulk update is 466 accounts; the 11 curator defaults are the BUG-065 leftovers |
| indexes with 0 scans | `event_types_idx`, `event_name_idx`, `event_location_idx`, `schedule_location_idx`, `schedule_performers_idx`, `schedules_slug_unique`, `posts_platform_post_identity_idx` (160 kB, new to the list) | all under 250 kB; dropping them saves little and is not a priority. In use: `schedule_coordinates_idx` 523 scans, `idx_events_event_name_trgm` 286 (the matcher) |

## 2. Check 2 — the recall classes, and a bug in my query

| class | pairs | in candidate list | share of 446 |
|---|--:|--:|--:|
| 1 same post (sibling guard, by design) | 1 | 0 | 0.2% |
| 2 created before the first candidate (legacy) | 193 | 2 | 43% |
| 3 dates more than 2 days apart (recurring or another occurrence) | 86 | 0 | 19% |
| 4 reachable by the matcher | 166 | 21 | 37% |
| total | 446 | 23 | |

**The bug.** `recall-classes.sql` took `b.created_at`, the row with the larger id, as "the later event". Ids are random, so about half the pairs were dated by the *older* event. The output itself shows it: **2 pairs in class 2 have a candidate row**, which is impossible (a candidate row is written when the later event arrives, so it can never be older than the first candidate row). Fixed (`greatest(a.created_at, b.created_at)`), with a regression fixture (`recall-classes.fixture.sql`: the old expression puts the test pair in class 2, the fixed one in class 4). Consequence for the table above: class 2 shrinks (≤ 193), classes 3 and 4 can only grow, and **all 23 candidate pairs belong in class 4** (a candidate is reachable by definition). So:

* the matcher's honest recall on reachable pairs is **at most 23 / 168 ≈ 13.7%**, and the true denominator is larger;
* the legacy class is a **one-time sweep** problem: the matcher only runs on new ingests, so no tuning will ever touch it;
* class 3 is mostly not a miss (a same-name event on another week is usually a recurring event).

**Why the reachable pairs are not matched — a hypothesis from the code, not yet measured.** `computeMatchScore` weights: organizer 0.40, shared link 0.20, date+name 0.25 (an average of name similarity and date proximity), venue 0.15; 'mid' (candidate) starts at 0.45, 'high' at 0.75. For a roundup- or curator-sourced item `process-ingestion-job.ts` deliberately discounts the organizer (BUG-058). A same-name, same-day pair of two such items therefore scores at most **0.25 + 0.15 (same venue) = 0.40 < 0.45: never a candidate**, unless they share a link (+0.20 → 0.60). Two organizer-authored events with the same name and day score at least 0.65 (mid) and, with a venue match, 0.80 (high, auto-merged in place). Stubs are 18% of events, and they are the curator and roundup events, the ones most likely to be duplicated across posts. `recall-class4-stubs.sql` splits the reachable pairs by "any stub" and "shares a link" and counts the candidates in each; if the hypothesis is right, the "both full" row is almost fully covered and the uncovered pairs sit in the stub rows. Then the fix is a scoring rule for stub-vs-stub pairs (for example, counting the same posting account as a smaller signal for stubs, or an exact-name, same-date rule), tested offline by replaying `computeMatchScore` over the pairs; I have not built the replay.

**What IDEA-085 should contain, if you agree:** (1) a one-time sweep of the legacy pairs, then a moderator-queue plan sized to it; (2) the stub scoring rule above, after the stub split confirms it; (3) the existing queue (147 pending, 0 merges) — AD-36 gap G4 stands.

## 3. Check 3 — the geocode probe (14 descriptions × no bias / bias `id` / filter `id`)

My reading of the formatted addresses (there is no ground-truth coordinate), grouped:

| outcome | descriptions | stored confidence of the answer |
|---|---|--:|
| **right** (7) | Plaza Ambarrukmo; Royal Ambarrukmo, Yogyakarta; Jogja; Yogyakarta; Hotel Kotta Go Yogyakarta; Plaza Ambarrukmo, Yogyakarta; Sleman City Hall | 1.00, 1.00, 1.00, 1.00, 0.75, 0.67, 1.00 |
| **wrong: a venue text answered with another place** (5) | Sport Academy … Lapangan Funminton (a generic street, "Jalan Lapangan"); omah noto plankton ("Resto Omah Lawas"); Montero Jogja … Sleman (a street in state code SE; under the country filter a street in NT, both far from Yogyakarta); Museum Gunungapi Merapi ("Museum Perjuangan Yogyakarta"); Auditorium SGLC … Universitas Gadjah Mada (the University of British Columbia in **Canada** under no bias and bias; under the filter an "Auditorium" in Tangerang) | 0.00, 0.00, 0.00, 0.00, 0.20 (Canada) / 0.13 (Tangerang) |
| **wrong: an area phrase answered with a business** (2) | "DIY & Jawa Tengah" (a PLN office in Semarang); "DIY (Daerah Istimewa Yogyakarta) and Sleman, Indonesia" (a hotel-restaurant in Sleman) | 0.66, 0.50 |

What this says:

* **Only 2 of 42 picks are outside Indonesia (both the same description), but 7 of 14 descriptions are wrong.** The bounding-box test sees the Canada answer and misses the street in South Sulawesi. The production "379 outside the box" is therefore a **floor** on wrong pins, not the count.
* **A country filter does not fix it.** Under the filter, Auditorium and Montero stay wrong, now inside Indonesia. This agrees with the decision already taken (country as a *preference* plus a confidence floor, never a silent filter); the floor, not the country, is the protection.
* **A confidence floor works on venue texts and fails on area phrases.** All five wrong venue answers are at or below 0.20; a floor of 0.5 rejects them all and rejects no right answer (the lowest right one is 0.67). The two wrong area phrases score **0.66 and 0.50**, so the placeholder floor of 0.5 (`>=`) *accepts both*. A floor of 0.67 would separate this sample perfectly but sits on a knife edge between 0.66 and 0.67 over 14 hand-picked texts: **do not calibrate to this sample.** The better fix for the area phrases is not a higher floor but not sending them to a place geocoder at all: they are areas, and resolving them is the gazetteer's job (IDEA-081, `area-resolver.ts`), yielding an area key, not a pin.
* **Production's stored confidence says the problem is large:** 627 of 1,460 pins are under 0.5, and in the probe every venue answer under 0.5 was wrong. Together with the 265 unpinned schedules, **at least 892 of 1,725 schedules (about 52%) have no pin or an untrustworthy one** (a lower bound: pins with no stored confidence are not counted).
* **The Sleman City Hall puzzle is still open.** The probe geocodes "Sleman City Hall" correctly (id, 1.00) in every mode, yet production stored 26 of its schedules in the US. So the stored query text or parameters differ from the probe's. Candidates: the account's stored default country used as the bias (BUG-066 mechanism 4; the probe used `--country id`, production would use whatever the account's default holds), a poisoned geocode-cache entry, or a pin that did not come from the geocoder. `confidence-by-country-box.sql` answers it with counts: the stored confidence, provider and match type of the 26, and the pin country against the account's default country. Probe variant 7 in the brief (`--country us`) tests the bias explanation directly.

**Consequence for the conversation you want next.** Roughly half of all schedules lack a trustworthy location, and 18% of events are stubs. An event that has a target area but no usable pin is therefore not an edge case; it is **half the catalogue**. That supports your earlier position that the audience's target area matters more than the location, and it makes the filtering and scoring rule for such events the central design question, not a refinement.

## 4. Effect on the plan

| Item | Effect |
|---|---|
| BUG-068 | confirmed in production on four columns; the other 23 are inferred from the mechanism. Migration scope for the four visible columns is 2,231 rows. Decided 2026-10-19: fix first, ahead of IDEA-074; mechanism `customJsonb` on the 27 columns (not the serializer line: see §9) |
| BUG-063 | confirmed: `adminArea` is written for 0 of 1,460 pins; `venueType` for 37 |
| BUG-066 | now measured: 43% of pins are under 0.5; wrong pins inside Indonesia are invisible to the box test; the filter does not help; area phrases need routing, not a floor. The 0.5 floor stays a placeholder until `confidence-by-country-box.sql` gives the production distribution |
| IDEA-085 | the "5%" is retired; scope becomes sweep + stub scoring + queue (§2). AD-36 Rule 10's gate should name class-4 recall and the sweep, not "above 5%" |
| IDEA-075 | 466 legacy accounts confirmed; 11 of 17 curators hold a default location that BUG-065 says is arbitrary: a cleanup decision for you |
| IDEA-081 / area ladder | the gazetteer is the right place for area phrases (probe: 2 of 14 descriptions were areas answered as businesses) |
| FIND-087, IDEA-076/082, FIND-088 | unchanged: not urgent at this size |

## 5. Corrections to my earlier review (`prod-findings-review-2026-10-19.md`)

* **Events per post.** I wrote that 1.08 "does not reconcile" with the report's 1,326 + 38 posts. The pack's own definition (distinct *primary* posts, `events.post_id`) gives 1,286 posts and 1.08, so the number is right; the report's 1,364 counts something else (78 more posts, plausibly posts reached through the `event_posts` link table, which I have not checked). I have corrected the review.
* **The recall classes.** The first version of `recall-classes.sql` mis-dated pairs (§2). Fixed, fixture added; the production counts must be re-run.
* **The count of jsonb columns** was already corrected to 27.

## 6. Next run (Round 2 of the local-session brief, §7)

Four items, `readonly_2` only: the fixed `recall-classes.sql`, `recall-class4-stubs.sql`, `confidence-by-country-box.sql` (four result sets), and an optional Geoapify probe with `--country us`. Tell the local session to pull the branch and run Round 2.

## 7. Decisions needed from you

1. **BUG-068 (decided, see §9):** serializer line (my recommendation at the time) or Drizzle upgrade, and may it run ahead of the personalization work? The production check turns "may it" into "must it": every SQL-side location read is blind today.
2. **IDEA-085 scope:** do you want the sweep of legacy duplicates and the stub scoring rule in it?
3. **Curator defaults:** clear the 11 curator default locations (they are arbitrary by BUG-065), or leave them?
4. **Whether to proceed to the filtering and scoring discussion now** (events with a target area and no trustworthy pin), or after Round 2.

## 8. Not verified

* Production plan of the Discovery statements (the pack refused `readonly_2`; at 1,394 events this is low value).
* The class sizes after the bug fix, and the stub hypothesis (needs Round 2).
* Ground truth for the probe's "right" and "wrong" (my reading of the addresses), and any generalization from 14 descriptions to the 627 low-confidence pins.
* The other 23 jsonb columns on production.

## 9. Decided 2026-10-19 ("do as your recommendations") and one change of mechanism

| Question | Decision | Where recorded |
|---|---|---|
| BUG-068: which fix, and before the personalization work? | Fix first, **ahead of IDEA-074**. **Mechanism changed by me after the decision:** `customJsonb` on the 27 plain `jsonb()` columns + a ratchet test, then the row migration. Reason: reading `deferred-work.md` showed the team fixed the same bug on three columns on 2026-08-29 with exactly this type (proven on production, with a test); the serializer line would make those three columns raise an error (probe), a Drizzle upgrade likewise; the swap is migration-neutral (`drizzle-kit generate` on a copy: "No schema changes"). Say so if you prefer the serializer route. Status `triaged`, **not implemented** | `backlog/BUG-068-…md` (implementation spec), `backlog/BUG-068-jsonb-migration/` (tested runbook) |
| IDEA-085 scope | sweep of the legacy pairs + stub scoring + moderator queue; AD-36 Rule 10's gate to be restated on class-4 recall. Status `triaged` | `backlog/IDEA-085-…md` |
| Curator default locations (11 of 17) | clear them **after** the BUG-065 code gate ships, as a runbook step | `backlog/BUG-065-…md` |
| Filtering and scoring for events with a target area and no usable pin | **after Round 2** | this document §6 |

Not done, on purpose: nothing was written to production, AD-36 was not edited. *Update, same day: the BUG-068 writer fix was then implemented at the product owner's request ("do it"), see Addendum 15; the "no product code was changed" statement above held until then.*

## 10. Round 2 results (local session, commit `eec72e9`; `readonly_2`, read-only, production primary)

Files: `results/recall-classes-prod-2026-10-19-v2.txt`, `results/recall-class4-stubs-prod-2026-10-19.txt`, `results/confidence-by-country-box-prod-2026-10-19.txt`, `results/geocode-probe-us-2026-10-19.md`. I read them; I re-ran nothing.

### 10.1 Duplicates (IDEA-085)

* **The fixed query behaves:** class 2 now has 0 candidates (it had 2 with the bug). Classes: same post 1, legacy 160 (36%), more than two days apart 107 (24%), **reachable 178 (40%)**, of which 23 are candidates: **recall on reachable pairs is 12.9%** (my earlier bound was "at most 13.7%").
* **The stub hypothesis holds, and it is the dominant gap.** Stub pairs without a shared link: **0 of 122** are candidates, 79% of the 155 uncovered reachable pairs. Stub pairs with a shared link: 6 of 10. A scoring rule for stub pairs could reach up to 126 of the 155.
* **It is not the whole story.** Pairs of two full events with no shared link: only 17 of 46 are candidates, so **29 uncovered pairs are unexplained by the stub rule.** From the code, the organizer weight (0.40) goes through `post_account_associations` on the posts linked by `event_posts` (not through `events.source_social_media_account_id`, which the report's pairs use), so a pair that looks same-account can still score without it; a path that does not run the matcher is also possible. Only a replay of `computeMatchScore` over the 178 pairs decides it.
* Totals the sweep and the scoring fix would touch: 160 legacy + 155 uncovered reachable = 315 of 446 pairs; the 107 recurring pairs are mostly not duplicates.

### 10.2 Pins, confidence and the wrong country (BUG-066)

| | inside the box (1,081) | outside the box (379) |
|---|--:|--:|
| stored confidence < 0.5 | 413 of 959 with a value (43%) | 214 of 343 (62%) |
| stored confidence ≥ 0.5 | 546 | 129 (83 at exactly 1.00) |
| no confidence stored | 122 | 36 |

* **The distributions overlap**, so a floor alone cannot fix BUG-066: a floor of 0.5 would drop 413 pins inside Indonesia (an unknown share of them right) and keep 129 outside.
* **Why high confidence is not safe:** the outside pins at 1.00 are partly legitimate foreign events (Denmark Open 27, Egypt 13) and partly confident nonsense: **"Online" answered with Montpellier at 1.00** (BUG-064, not a geocoder fault), "Court 2" answered with Canada at 1.00.
* **The failing texts have a shape.** The Sleman City Hall rows are compound texts, not the plain name the probe used: "Atrium & Plaza Rama, Sleman City Hall" (US, 0.00, 5 schedules), "Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang" (France, 0.00), "Customer Service, Ground Floor, Sleman City Hall" (US, 0.55). The same generic word recurs elsewhere: "Atrium Lower Ground, Galeria Mall" (US, 0.00, six schedules), "Grand Atrium Pakuwon Mall Jogja" (Pakistan, 0.00), "Sky Commons, Lantai 3A, Plaza Ambarrukmo" (Spain, 0.06), "TKP JOGJA Lantai 2, Pakuwon Mall Jogja" (Spain, 0.00), "Watsons, Ground Floor Galeria Mall" (Mexico, 0.70), "Convention Hall Lt.2" (Canada, 0.81). **A sub-venue qualifier (atrium, floor, hall, court, counter) in front of the venue name makes the geocoder match the generic word.** Most of these score 0.00–0.06, so a floor catches them; the 0.55–0.81 ones show it cannot catch all.
* **The bias explanation is refuted for the plain text and mostly for the rest.** With `bias=us` 12 of 14 probe descriptions answer exactly as with `bias=id` (the two that moved were already wrong at 0.00), and plain "Sleman City Hall" stays correct. In production, of the first 333 outside pins, **214 (64%) come from accounts with no default location** (so no bias at all: BUG-066 mechanism 1) and the pin country equals the account's default country in only 15. The app sends only a soft `bias=countrycode:` and never a filter (`geoapify-client.ts:60`), and the probe shows that bias has little effect on a bad text, so "bias to Indonesia when there is no account default" (already decided) is necessary but would not have fixed these.

### 10.3 What this suggests for BUG-066's fix (for the decision, not decided)

In order of evidence: (1) do not geocode "Online" and other non-places (BUG-064); (2) strip the sub-venue qualifier before geocoding, keep venue name plus city (a Round 3 probe on the production texts would test it); (3) keep the confidence floor as a cheap net for the 0.00–0.06 cases; (4) **validate the answer against the event's stated target area**: a pin in Mexico for an event whose post says Jogja is wrong whatever the confidence. (4) is the only check that catches the confident nonsense, and it needs the area ladder and the resolver (IDEA-073, IDEA-081): it is where this thread meets the filtering and scoring discussion you scheduled after Round 2.

### 10.4 Next, if you want it

* **Round 3 (one local run):** (a) the `computeMatchScore` replay over the 178 reachable pairs as a read-only SQL (I would write and test it on a fixture first); (b) a Geoapify probe over the roughly 15 distinct compound texts above, as is and with the qualifier stripped, under bias `id`. Both are read-only or public-name-only.
* **The filtering and scoring discussion** (target area but no usable pin): the numbers it needs are now in hand (§3, §10.2).
