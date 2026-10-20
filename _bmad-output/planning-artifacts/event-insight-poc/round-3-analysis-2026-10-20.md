# Round 3 analysis (2026-10-20)

Reads the results that landed in commit `30154e2` (`results/`) and the local session's
`notification-and-session-investigation-2026-10-20.md`. The numbers the investigator reported were
re-derived here from the raw files, not copied: the labelled pins were re-scored with
`score-pin-trust-labels.ts` (it matches) and cross-tabulated by country and stratum (Section 1).
Tags: `[PROPOSED]` stays proposed until the owner says yes; `[ASSUMPTION]` is a value taken to move on.

What follows answers the four open decisions first (Section 0), then gives the evidence per topic.

## 0. The four decisions waiting on you, with a recommendation

| # | Decision | Recommendation | What it rests on | What the data cannot show |
|---|---|---|---|---|
| 1 | Publish curator events with no resolved area as `unknown` (penalty, per-page cap) instead of holding them | **Yes, publish** | Today at most 26 of 452 open events (6%) have no place at all; a hold would be indefinite and silent because moderators resolved 0 of 147 and receive no queue notification (BUG-069) | AD-39 Rule 3 removes the account-default pin from curator events, so more events become area-less than the 26. The size of that is the fingerprint count of AD-39 Rule 7, not yet run (Section 6) |
| 2 | Wacoal-type promos are a `series`, cover = member nearest the user, label "also at N other places" | **Yes**, and the stem becomes a phrase-and-order score instead of suffix patterns | Wacoal is 3 events, 3 malls, date ranges that overlap, so it fits "same activity, same audience, several places". One of the three names reads "... at Pakuwon Mall Jogja"; a pattern per suffix form ("- X", "at X", "@ X") is brittle, so Section 4.1 replaces it with a score (prototype and 12 tests in `poc-event-insight/series-phrase.ts`) | Whether the 3 events share one account (the landed file has no account column); how many true same-account multi-place series exist after spelling variants of one place are removed |
| 3 | Promos posted separately by each place's own account | **They are candidates, yes (Sports Station and J.CO are series by definition). Keep them ungrouped in v1 behind an option; decide after the names cut** | 34 of 178 concurrent pairs cross accounts. Of the 5 multi-account names in the listing, 3 are one place posted by several accounts (duplicates, the matcher's job) and 2 are branch promos (Sports Station, J.CO); both score 1.00 on the phrase score, so only the organizer key keeps them out. A wrong series hides events behind a cap of one, so the option needs a higher bar, overlapping dates, a rare-word anchor and moderator confirmation (AD-36 Rule 12) | The listing shows only the 25 largest names, so how many such pairs exist is unknown. Two cheap unknowns: whether the posting accounts are brand or mall accounts, and whether the captions tag the brand (a better key than the posting account). Both come from the Round 4 names cut (Section 6, ask 3) |
| 4 | Pin-trust floor and the `full_match` clause | **Keep 0.5 and keep `full_match`; add a country leg; do not raise the floor** | The floor is the least important lever (Section 1): 0.5 to 0.6 moves one labelled row, 0.7 and above discard good pins. The country leg removes all 42 wrong-country rows | 15 correct (Y) pins is a direction, not a rate; legitimate foreign events (Denmark Open, BWF) exist and must not be hidden by the country leg |

## 1. Pin trust (Round 3 item 14, 87 labels: 15 Y, 15 C, 57 N)

Verified: today's rule (confidence at least 0.5 and `full_match`) has **44%** weighted precision (66% if
C counts as right) and keeps **65%** of the Y pins; at 0.6 it is 48% / 73% / 65%. The raw count behind
44% is 8 Y of 22 trusted rows (95% interval 20 to 57%).

One correction to the investigator's wording: the sample has **45 inside-box labels (15 Y, 15 C, 15 N)**
and 42 outside-box labels (all N), not "30 inside-box labels".

**Where the wrong pins are.**

| Group | Rows | What they are |
|---|--:|---|
| Outside the Indonesia box | 42 of 42 wrong | every confidence band, including 4 of 4 at 1.00 and 2 of 2 at 0.75 to 0.99; about 27% of all pins by weight (409 of 1,517) |
| Inside the box, wrong country | 1 | Malaysia (Sandakan) sits inside the box, so the **box is a leaky test; the country code is the right one** |
| Inside the country, wrong place (14 N) | 14 | 7 are one failure: "Pakuwon Mall Jogja" read as a street called Pakuwon in West Java, always with a floor or atrium qualifier or no text, at 0.00 to 0.42 (below the floor already). The other 7: Kupang, Praya, Padang, Malang, "Transmart Cirebon" in Surabaya (0.50), "Balai Kota Yogyakarta" in Jakarta (0.67), and a province centroid |
| Inside the country, right city or neighbourhood but not the place (label C) | 15 | street, neighbourhood or centroid answers: "Jakarta" answered at 1.00 with the Jakarta region, "Jalan Kolonel Sugiono" four times at 0.50, "Hush Puppies store Plaza Ambarrukmo" answered with a lane beside the plaza at 0.81 |

**Rules scored on the same weights** (weighted precision of Y / of Y-or-C / Y kept):

| Rule | Trusted pins (weighted) | Precision Y | Precision Y or C | Y kept |
|---|--:|--:|--:|--:|
| today: 0.5 and `full_match` | 646 | 44% | 66% | 65% |
| 0.6 and `full_match` | 584 | 48% | 73% | 65% |
| 0.7 and `full_match` | 440 | 46% | 78% | 47% |
| **0.5, `full_match`, country is Indonesia** | 507 | **56%** | **84%** | 65% |
| 0.6, `full_match`, country is Indonesia | 466 | 60% | 91% | 65% |
| today's rule without `full_match` | 718 | 39% | 67% | 65% |

Readings:

1. **The country leg is the lever.** It removes 139 weighted pins, all wrong, and keeps every Y pin.
   The two N rows still left under it (Transmart Cirebon, Balai Kota Yogyakarta) are exactly what AD-14
   Rule 4(c) (the pin's path must meet the area the text states) exists for, because each text names
   the city. Both are caught if (c) can run; (c) is vacuous until the area resolver ships.
2. **The floor does not matter within noise.** 0.5 to 0.6 changes one row (Transmart Cirebon at 0.50).
   Raising it to 0.7 and above throws away correct pins. Already at 0.5, **7 of the 15 Y pins are
   discarded**: four with a stored confidence of 0.00 to 0.45 and three with none stored. The geocoder scored
   a compound text low and still found the right building ("Chadol Gujeolpan - Lantai GF, Plaza Ambarrukmo"
   at 0.18, twice). Re-geocoding with a cleaned query (Section 1.1) is the way to recover them, not a lower floor.
3. **`full_match` helps a little** (44% against 39% at 0.5) and costs no Y pin. Keep it.
4. **`confidence_city_level` and `confidence_street_level` are not an alternative**: they are filled in 19 of
   192 probe rows. The AD-14 `[ASSUMPTION]` that they might separate the cases is withdrawn.
5. **The 15 C rows are a different defect**: the right city or neighbourhood, not the place; some are
   centroids ("Jakarta"). The mapper does not store Geoapify's result type (checked in
   `geoapify-client.ts`), so nothing in the data separates a place from a centroid. That is the AREA versus
   EXACT distinction of AD-39 Rule 1, and it needs the result type stored (Section 1.2). How many of the 15
   are centroids is not recorded in the labels.
6. **Pins with no stored confidence** (122 inside the box, 36 outside): the sample has 4 inside, of which 3
   are right and 1 is wrong. Too few to trust them. They stay untrusted (AD-14 Rule 2), and the derive job
   should reverse-geocode them for a country code instead (about 158 calls).

**What it means for the product.** By the existing "trusted-looking" test only 155 of 452 open events (34%)
have a pin; 213 (47%) have a pin the rule rejects, 58 have place text only and 26 have no place. If the 44%
carried over to events, roughly 70 open events would show a correct map pin today. This is an
extrapolation from pin weights to events, so read it as an order of magnitude. It is why the area lane
(AD-39) carries more of the load than Nearby.

### 1.1 Query shape matters more than any threshold (item 10, 100 requests, 21 labelled texts)

| Query sent | Right country | Right country and confidence at least 0.5 |
|---|--:|--:|
| text as stored | 4 | 2 |
| sub-venue qualifiers removed | 11 | 6 |
| the venue segment only | 16 | 13 |
| venue segment plus the stated city | 16 | 13 |

The Indonesia bias changed nothing (the same count with and without). Of the 42 wrong-country pins, 25
had an account with no usable country, 12 an account default in a non-Indonesian country (lb 6, sg 3, in 2,
us 1), 5 an Indonesian default; 38 of the 42 were stored after the bias shipped on 2026-09-13. An account's
default country is therefore not a safe source for the expected country (caveat from the investigator: it is
the account's *current* default, which may have been set after the pin). **Limits:** 21 labelled texts, and
the venue-word list in the probe was written while looking at them, so 16 of 21 is an upper bound until a
held-out set is run. Seven texts stay wrong even at venue-segment level ("Court 2" answered in Canada at
1.00, "Online" in France at 1.00, "Tennis Indoor Senayan" in the US at 0.67).

### 1.2 What changes in the spine `[PROPOSED]`

- AD-14 Rule 4 gains leg (a2): the pin's `countryCode` equals the expected country, and a pin without one
  is untrusted. Expected country = the country named in the schedule's own location text when it names
  one (so Denmark Open and BWF keep their pins), else the deployment default
  (`GEOAPIFY_DEFAULT_COUNTRY`, `id`). The account's default country is **not** used.
- Floor 0.5 and `full_match` stay; the "calibrate later" deferral is closed.
- The mapper stores Geoapify's `result_type`; a city, state or country result is a centroid and is capped at
  precision `AREA` (no map link as a place, no Nearby). `[ASSUMPTION]` which result types count as a place.
- AD-14 Rule 5 gains the venue-segment step: after `stripSubVenueQualifier()`, the geocoder gets the last
  segment that reads as a venue, not the whole compound text.
- The derive job re-geocodes **open** events with the cleaned query: the 213 whose pin is untrusted and the
  58 with place text only, minus non-places (about 270 calls at most), and reverse-geocodes the 158 pins
  with no stored signal.

## 2. Matcher recall and the stub-pair rule (item 8, IDEA-085)

181 reachable pairs (the brief said 178). By the matcher's own scoring:

| Newer event | Replay tier | Pairs | In the candidate list | Should be, is not |
|---|---|--:|--:|--:|
| full | high | 5 | 1 | 4 |
| full | mid | 42 | 17 | 25 |
| stub (organizer discounted) | mid | 11 | 7 | 4 |
| stub (organizer discounted) | low | 123 | 0 | 0 |

1. **Two separate problems were counted as one.** Of the 58 pairs the scoring rates mid or high, 25 are
   listed (43%): those 33 misses are the pairs that existed before the matcher ran, which the one-time
   sweep reaches. The other 123 pairs (68% of the 181) score **low by construction**: with the organizer weight
   discounted, a same-name, same-day, same-venue stub pair scores 0.25 + 0.15 = 0.40 against a threshold of
   0.45, and 111 of the 123 do match on venue.
2. **The AD-36 Rule 10 gate (80% of reachable pairs merged, dismissed or holding a fresh candidate) cannot
   be met** while 68% of the pairs cannot reach `mid`, whatever the sweep does.
3. **The sweep as written would insert nothing.** AD-30 Rule 7 caps inserts at `max(0, 50 - pending)` per
   run, and 147 are pending, so the 29 `mid` pairs would wait behind a queue that moderators have not
   touched (0 resolved) and that nothing notifies them about (BUG-069). The queue has to be cleared or
   expired first, or the cap has to be on age rather than count.

**Stub-pair rule `[PROPOSED]`.** A same-poster signal for a stub pair: both items were posted by the **same
account**, with the same normalized name and `isSamePlace` = `same`. It is worth half the organizer weight
(0.20), which keeps BUG-058's intent (an aggregator earns no organizer weight for a *tagged third party*,
and two different aggregators never get it). Arithmetic, not a replay: 0.384 mean + 0.20 = about 0.58, so
the 111 venue-matched pairs land at about 0.55 to 0.60 and become `mid`, and the other 12 sit at about 0.45,
on the threshold. The maximum a stub pair can reach is 0.25 + 0.15 + 0.20 = 0.60, below `high` (0.75), so a
stub pair can never auto-merge on this signal. Unproven until the replay is re-run with this weight
(Section 6). All 181 reachable pairs are same-account by construction, so the signal applies to all 134
stub pairs. Because every one of these would land in an unworked queue, the
second part of the proposal is a decision for you: an exact repeat (same poster, same normalized name, same
place, overlapping dates) is merged by the sweep as the system user, journaled and undoable, instead of
queued. That extends the adopted "auto-merge high pairs" scope to a case that scores `mid`.

## 3. Event identity and the split (items 11, 12)

- Events holding more than one place: **15 of 1,431 (about 1%)**; 7 more have several schedules and no place
  at all. The place normalizer is a small part of the data and a large part of the spec.
- Only **5** of those 15 have an open schedule, and one of them is `dependent-stages` (never split). The
  AD-38 Rule 5 backfill is therefore about **4 splittable events plus at most 6 whose place sits in the
  schedule titles**, about ten events. The dry-run table, per-run caps, per-key budget and standing drift
  check of Rule 5 are machinery for ten events. `[PROPOSED]` simplification: use the Rule 4 moderator
  "split event" action (journaled, undoable) for the ten, and keep the proposals table only if the backfill
  grows.
- Gemini: 27 to 48 extraction calls a day, spikes of 409, 123, 106; 1,124 in 15 days; the 500 a day limit
  never reached. A ten-event backfill is invisible against that, so the quota discussion of Rule 5 is moot at
  this size. (The correction in the memlog still stands: live extraction is BYOK, so this table counts
  calls, not one key's quota.)

## 4. Groups (items 13, 15, 16)

**GAP (item 13).** 59 series candidates; 52 span under a month (196 events, up to 17 members), 5 span one to
two months, 1 two to four, 1 more than four. A 60-day gap splits only the two-member candidates whose members
are more than 60 days apart (at most 2 of 59) and keeps the others whole. The data is one snapshot of about
seven weeks of posts, so it cannot show a yearly repeat. **60 days stays an `[ASSUMPTION]`; the data does not contradict it.**

**Tier 1 and SCH (item 16).** 19 groups, 56 events: 15 groups (46 events) look like programmes, 1 (2 events)
like a series, 3 (8 events) are mixed. **SCH is not among them.** This was already in the write-up ("covers
about 4% and misses SCH") and contradicts one sentence of AD-36 Rule 12: "the 52 SCH events of the Tier 1
measurement yield zero series groups". The 52 events are VICTORIA TOURNAMENT, Logolepsy, UGM RunFest and the
like, not SCH. Two consequences:
- The Rule 12 fixture must be the 19 real Tier 1 groups plus an SCH fixture written by hand (SCH's 21
  children are found only by Tier 2).
- Tier 2 needs a **seeded anchor** (Rule 3), and SCH is not a Tier 1 umbrella, so **SCH becomes a programme
  only if a moderator seeds `(8th Anniversary, Sleman City Hall)`**. Your decision that SCH is a programme
  stands; the way it gets built is a manual seed, and the seed depends on a moderator being reachable
  (IDEA-090).
- Most "programme-like" Tier 1 groups are the categories or rounds of one competition (Victoria Tournament
  categories at one hall, BWF rounds in Denmark and Egypt, UGM RunFest 3K and 5K). The programme policy
  (not capped, "part of" chip) suits categories with their own audience, so the adopted policy holds; the
  rounds of a single competition are `dependent-stages` and are a candidate for the same exemption (AD-38).

**Concurrent multi-place (item 15).** 178 concurrent pairs; 144 same account on different posts (39 names),
34 across accounts (21 names), none from the same post. Many of the large clusters are **one place spelled
several ways** (Jogja Coffee Week 6 at JEC under four spellings, SCH Choir Competition and Obral Obrolan
Buku at "Atrium Rama"), so 178 over-counts true multi-place pairs and the right count needs `isSamePlace`.
Real same-account cases exist: Wacoal (3 events, 3 malls), Lomba Mata Pelajaran (4 malls in 4 cities), RSIH
Mlayu Mlayu (2 places), SWARANUSA (2 places). Of the 5 names in the listing that span several accounts, 3
are one place posted by several accounts (Erafone Run, GembiRun Loka, BIOSFERUN: duplicates, the matcher's
job) and 2 are branch promos (Sports Station, 4 accounts and 4 stores; J.CO, 2 accounts and 2 malls).

### 4.1 The stem rule as a score, not a pattern (added after review)

`deriveStem()` as first written removed only a trailing "- <own place>". The Wacoal events are named
"Wacoal 25% Off Promo", "Wacoal 25% Off Promo" and "Wacoal 25% Off Promo at Pakuwon Mall Jogja"; production
names also use "@", "di", brackets or a leading place. Listing every form is brittle, so
`seriesNameScore(a, b)` (POC: `apps/backend/scripts/poc-event-insight/series-phrase.ts`, 12 tests) scores two names on
phrase and order:

1. **Core of each name** = the name minus the longest run of consecutive tokens that is also a run of its own
   place text. Order is what keeps the brand: "House of Wacoal 2nd Floor, Pakuwon Mall Jogja" shares "wacoal"
   with the name, but the run "pakuwon mall jogja" is longer, so the brand stays. A run that the other name also
   contains ("Sports Station" in both, "Jogja" in "Jogja Coffee Week") is shared wording and stays.
2. **Score** = 0.5 x dice over the longest common token *subsequence* + 0.5 x (longest common contiguous *run* /
   longer core). Reordered words score low (0.25 for "Promo Off 25% Wacoal" against "Wacoal 25% Off Promo");
   one extra word costs a share that shrinks as names get longer.
3. **A differing number caps the score at 0.5** (25% against 30%, 2025 against 2026, Week 6 against Week 7).
4. **Optional rarity weights** (inverse document frequency over all event names) make a generic shared phrase
   count less than a shared brand.

What it did on the names in the repo. The group name is the output of `groupName(a, b)`: the words the two names share
once each place is removed, in the poster's own spelling and casing, taken from the more general of the two names. For a
pair below the bar no group is made; the name is shown in brackets only to show what the shared words would be.

Source column: **R** = the names and place texts are as they appear in the production listings of 2026-10-19/20; **R\*** =
the names are real, but I completed a place text or a child name that the listing cut at 24 characters (for example
"sports station lt ug lip" became "Sports Station Lippo Plaza Jogja"); **S** = I made it up from the shape of a real case.
Correction added after review: the previous version of this table did not mark which rows were which, and two rows were
not what they looked like (the Jogja Coffee Week row and every row of the second table below).

| Source | Pair | Score | Groups at 0.85? | Group name (formula output) |
|:-:|---|--:|:-:|---|
| R | Wacoal "... at Pakuwon Mall Jogja" with the plain Wacoal events (Plaza Ambarrukmo, Jogja City Mall) | 1.00 | yes | Wacoal 25% Off Promo |
| R* | Sports Station BOGO, two stores | 1.00 | yes | Sports Station Buy 1 Get 1 Free Promo |
| R* | J.CO Anniversary, two malls | 1.00 | yes | J.CO ANNIVERSARY PROMO |
| R | Lomba Mata Pelajaran, two malls | 1.00 | yes | Lomba Mata Pelajaran dan Mewarnai |
| S | "Jogja Coffee Week" at JEC and at Plaza Ambarrukmo (the real event, "Jogja Coffee Week 6", is one venue spelled four ways, so it is a duplicate case, not a series) | 1.00 | yes | Jogja Coffee Week |
| S | Dash, "@", "di", bracket and leading-place forms | 1.00 each | yes | Wednesday Night Run |
| R | SCH Choir against SCH Halloween Dance | 0.53 | no | (SCH Competition 2026) |
| R* | Line Dance Carnival against Zumba Anniversary | 0.00 | no | (none) |
| R | Wacoal against J.CO, against Sports Station | 0.25, 0.15 | no | (Promo) |
| R* | BWF "Men's Singles Final" against "... Quarterfinals" (the listing shows "men s singles final" and "men s singles quarterf") | 0.75 | no | (Men's Singles) |
| R | Denmark Open 2026 against Victor Denmark Open 2026 (same place: the matcher's case) | 0.80 | no | (Denmark Open 2026) |
| S | Same name, 2025 against 2026; 25% against 30% | 0.50 (capped) | no | (the shared words) |
| S | Generic phrase, two brands ("Buy 1 Get 1 Free Promo"; "Watsons" is invented) | 0.78 plain, 0.66 weighted | no | (not computed) |

Two things the name shows that the score does not. The name is only as good as the pair that made it: it is computed
from the first two members when the series is created and is not recomputed when a third arrives (a moderator can
rename it), `[ASSUMPTION]`. And a below-bar pair still has shared words, which is why a name is never made for it.

**What this does not show.** The cases are 12 hand-picked pairs, and the first version failed two of them (it
stripped the brand "Wacoal" because the place text repeats it, and left "mall jogja" in the name); the run-based
core was the fix, so the set was not independent of the design. Every score is 1.00 or at most 0.80, so the range
0.80 to 0.95, where the bar will actually bite, is untested. The bar (0.85) is an assumption until Round 4 ask 3
runs the formula over all 1,431 names. Known miss: a city that is in the name but not in the place text ("Erafone
Run 2026 Yogyakarta Series" and "... Bandung Series") scores low until the gazetteer area label is passed in
with the place text.

**The in-between zone (synthetic pairs, scored afterwards to show where the bar bites).** Each is a pair at two
different places:

**Every variant below is invented (S).** The first name of each pair is a real event name; the second is my invention of a
plausible variant. None of these variants is in production as far as I know. In particular "Erafone Fun Run 2026" does not
exist: the real event is "Erafone Run 2026 Yogyakarta Series" (a "Chapter Yogyakarta" of the Erafone Run, from the post of
2026-08-30 in the test corpus).

| Pair | Score | Should it group? | Group name if it did (formula output) |
|---|--:|---|---|
| "Sports Station Buy 1 Get 1 Free Promo" and "... Free" (one drops "Promo") | 0.90 | yes | Sports Station Buy 1 Get 1 Free |
| "Wacoal 25% Off Promo" and "Wacoal Anniversary 25% Off Promo" | 0.74 | probably yes | Wacoal 25% Off Promo |
| "Jogja Coffee Week 6" and "Jogja Coffee Week 6 Opening Day" | 0.73 | probably yes | Jogja Coffee Week 6 |
| "Wednesday Night Run" and "Wednesday Night Run Special Edition" | 0.68 | probably yes | Wednesday Night Run |
| "Erafone Run 2026" and "Erafone Fun Run 2026" (a stand-in for two different runs by one brand) | 0.68 | **no** | Erafone Run 2026 |
| "Obral Obrolan Buku" and "Obral Obrolan Buku Vol 2" (number cap) | 0.50 | unclear: an edition, or the next one | Obral Obrolan Buku |
| "Promo Diskon 25% Wacoal" and "Wacoal 25% Off Promo" (Indonesian against English) | 0.25 | yes | Promo (wrong: the shared word is only "Promo") |

What this means: the conclusion (the formula cannot tell "the same activity plus an added word" from "a different
activity with a similar name") rests on invented variants, so it shows the formula's behaviour, not how often real names
look like that. The names query is what shows how often.

The formula cannot tell "the same activity with an added word" from "a different activity with a similar name": both
sit at 0.68. Any bar between 0.68 and 0.90 therefore trades missed groups against wrong ones, and the two errors are
not equal. A missed group leaves the events as they are today. A wrong series hides events behind a cap of one.
That is why the starting bar is high (0.85) and why the cross-account option needs a moderator's confirmation. The
last row is a separate limit: the score compares words, so a translation or a synonym is invisible to it.

## 5. Notifications and sessions (Job B, Job C)

Ranked causes of "a subscribed moderator never gets a push or an email" (from the local session, code
reading; none observed in production):

0. **Email: absent by design.** Eight templates exist, none about a new event, a subscription or a queue
   item. A moderator cannot be emailed about an event. This is IDEA-090, a product gap, not a bug.
1. **No `fcm_tokens` row for the browser or installed app.** The token is written only from the
   Notifications settings page, per browser, and needs a valid login.
2. A subscription to a **twin profile** (BUG-059): the join needs `profiles.account_id` = the event's account.
3. **No qualifying event:** stubs, curator-typed and roundup events never notify, and the claim is taken
   before sending, so an event with no subscriber at that moment is never notified later.
4. **`user_settings` row missing or push false** (the page shows ON when the database value is null).
5. Firebase or FCM failure, logged and then e-mailed through SES, so silent if SES is unset.
6. Device side (idle service worker, blocked permission, pruned token): **not the case in the observed
   browser** (permission granted, worker active with all five parameters set, a push subscription present).

**Session loss.** Confirmed in code, not reproduced in about three minutes of browsing:
- H1: the first GraphQL response with `UNAUTHENTICATED` signs the user out, even if a refresh would work.
- H2: no refresh middleware is built (only next-intl), so a server `getSession()` can spend the single-use
  refresh token without persisting the new cookies.
- H7: every JWT verification failure, a JWKS fetch failure on a cold Lambda included, is reported as
  `UNAUTHENTICATED`, which triggers H1.
- H5 (service workers) is refuted as a cause.
These two threads join: a moderator who is logged out when the Notifications page loads saves no token.
That is an inference from code. New row **BUG-072** records the logout defects separately from BUG-069
because they are independent of the moderator's role and affect every user. The project-context rule
"Force Logout on Auth Failure" (2026-08-28) is the design that H1 and H7 weaken; it needs a decision, not a
silent change.

**Owner-run checks that decide between 1 to 5:** `owner-notification-checks.sql`, SES (`SES_FROM_EMAIL_ADDRESS`,
sandbox), the Lambda Firebase environment, Supabase auth settings. These are the owner's and not blocking.

## 6. Asks for the local session (Round 4, all read-only)

1. **Stub-weight replay:** `recall-replay.sql` with the same-poster weight at 0.10 and 0.20, reporting how
   many of the 123 low pairs reach `mid`, and how many are exact repeats (same poster, name, place, overlap).
2. **Fingerprint counts** of AD-39 Rule 7 on open events, by account type: `account_default` (empty
   schedule location and a pin matching the account default), `geocoded_from_text`, `legacy_unknown`. They
   size how many curator events lose a pin and become `unknown`.
3. **Item 15 re-cut with the phrase score** (`prod-findings-review-2026-10-19-queries/event-names-for-series-score.sql`,
   one SELECT, tested on the scratch database): for every live event, its name, place text, main schedule dates, a
   pseudonymous account, the account's type and `organizer_name` cut to 40 characters (no captions, links, handles or
   platform ids). The cloud session runs `seriesNameScore`
   over the pairs offline, so the cut-off is read off real pairs and the owner can eyeball the cross-account
   candidates (Sports Station, J.CO and whatever else surfaces). It also gives the account of the Wacoal events
   and says whether the captions of the brand promos tag the brand (`organizerHandle`), which would be a
   better series key than the posting account.
4. **Held-out geocode set** (run inside the build story as its test set): 20 more labelled texts not used to write the venue-word list, run through the
   venue-segment query.
5. **Foreign events, text only:** for the outside-box pins, how many have an event or schedule location text that
   names a country (Denmark, Egypt), against how many have none. It sizes who loses a map link under Rule 4 (e).
   (The 158 pins with no stored signal are not a separate ask: the derive job's dry run covers them.)

## 7. Which unverified items are worth verifying

Rule used: verify an item only if its answer could change a decision, and only if the check costs less than being
wrong. Ranked by that.

| # | Unverified | What it decides | Cost to verify | Verdict |
|---|---|---|---|---|
| 1 | Why the moderator gets no push (`owner-notification-checks.sql`, SES, Lambda Firebase variables) | the owner's actual problem; whether BUG-072 matters for it | one read-only query run by you, a few settings looks | **Do first.** It is the only item that is a live defect for a person today. If the moderator has no `fcm_tokens` row, BUG-072 becomes the lead and a 10-minute idle-tab reproduction is worth it; if a row exists, skip the reproduction |
| 2 | Phrase-score names cut (Round 4 ask 3): all event names with account, tagged organizer, own place and dates, no captions | the bar (0.85 is a guess); how many cross-account pairs exist; the account of Wacoal; whether the brand is a better key than the posting account | one read-only query, then offline scoring here | **Do.** It settles decisions 2 and 3 with data instead of 12 hand-picked pairs |
| 3 | Same-poster stub weight (Round 4 ask 1): replay at 0.10 and 0.20 | the stub rule's value and the size of the exact-repeat merge | the same replay SQL with one parameter | **Do, after 1 and 2.** Low urgency: even a right weight only feeds a queue nobody works until the exact-repeat merge or IDEA-090 exists |
| 4 | Fingerprint counts for unknown area (Round 4 ask 2) | the size of the penalty and per-page cap, and the UX copy; not the publish-or-hold decision (a hold has no worker whatever the count) | one read-only query | **Do before UX and epics sizing, not before your yes** |
| 5 | Foreign events under the country leg: whether the 27 Denmark and 10 Egypt schedules (empty schedule text) have an event text that names the country | whether legitimate foreign events lose their map link | a text-only count; fold it into ask 5 | **Cheap, do it with the others.** The harm if wrong is small: a Denmark badminton event loses a map link, and Nearby never applied to it for an Indonesian user |
| 6 | Held-out geocode set (Round 4 ask 4): 20 more texts through the venue-segment query | whether the venue-word list really gets 16 of 21 | 20 expected countries from you, about 40 Geoapify calls | **Do inside the build story as its test set, not before.** It needs to exist as a test anyway |
| 7 | More pin labels | the floor (insensitive: 0.5 against 0.6 is one row) and the country leg (42 of 42 already) | your time, about an hour for 50 labels | **Not worth it now.** More labels would not flip either decision. Spend it after the change ships: 30 fresh labels as an acceptance check that the outside-box wrong pins are gone |
| 8 | GAP of 60 days | when a series becomes a new season | needs months of series data | **Not verifiable now, not worth trying.** Keep it a configuration value; revisit after about six months |
| 9 | The 158 pins with no stored signal | a country code for old rows | about 158 reverse-geocode calls | **Do not run separately.** It is the dry run of the derive job |
| 10 | "About 70 open events show a correct pin today" | nothing; it is a motivating estimate from pin weights to events | not applicable | **Do not verify.** Do not quote it as a measurement |

## 8. What was not looked at

- The result files from earlier rounds (`perf-*`, `audience-areas-*`, `profile-insight-*`, `tracks-*`,
  `venues-*`) were not re-read; this landing did not change them.
- No production system was touched from this session. Every figure above is from files in the repo.
