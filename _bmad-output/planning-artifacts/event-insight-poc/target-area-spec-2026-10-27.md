# Target area spec (draft 1, 2026-10-27)

Status: SETTLED with the owner on 2026-10-27 and APPLIED to the POC and to PRD Section 3.20 on this branch (nothing is built in production).
It replaces the venue-first line in the labelling guides (`labelling-guide-2026-10-21*.md`) and in the `audience-v2` prompt
(`audience-insight.ts`, now `audience-v3`), and extends PRD Section 3.20 (FR121-FR124). Where each decision landed:
`poc-status.md` ("Target-area change (2026-10-27)") and `target-area-edits-draft-2026-10-27.md`. Sources: owner decisions in the
2026-10-26/27 discussion; `proposal-target-area-and-scan-safety.md`; `location-policy.ts`; prod checks of 2026-10-26/27.

## 1. What it is

The **target area** is where an event's audience is drawn from. It is not where the event happens (the pin and the
place area, PRD 3.20 "Three Facts"). One event has a *set* of target areas. Each is
`{name, key, level, source, qualifier, anchor, quote, ambiguous}`:

- `level`: `neighbourhood | city | regency | province | country | continent`
- `source`: `stated | venue | hashtag | account | account-bio`
- `qualifier`: `only | and_surroundings | part_of | none`
- `anchor`: only for `neighbourhood`; the kelurahan/desa it sits in
- `quote`: the verbatim caption text for `stated` (guard: it must occur in the caption, else dropped)

## 2. Decision order

```
0. Is it an event? No -> no target area.
1. EXPLICIT (model, caption-grounded)
   Audience cue + place: "Hallo warga Jogja", "se-DIY", "mahasiswa se-Bantul", "khusus warga RW 05", "Jabodetabek".
   Hit -> STOP. No implicit area is added. The venue is still kept as the place (pin), only not as the audience.
   Participants who attend, register or compete DO count ("peserta se-DIY", "terbuka untuk mahasiswa Jogja"): an explicit
   mention of the participants wins over the venue, whether it is wider or narrower than the venue (owner decision, 2026-10-27).
   NOT stated: an address or "Tempat:" line; where performers/exhibitors/vendors come from ("sanggar tari se-yogyakarta");
   a place inside a name ("Java Jazz"); "open to the public".
2. SCOPE GATE
   Stated national/international -> country/continent, no implicit areas.
   Online with no stated area -> none (unless the account fallback below applies).
3. IMPLICIT, only if 1 and 2 gave nothing. Collect every signal, tag its source:
   a. venue: the area of the verified pin, else the venue text resolved through the gazetteer (PRD 3.20)
   b. hashtags (#jogja, #sleman): weakest signal, never alone overrides a venue
   c. account: confirmed organizer/venue account of local/regional reach -> its default-location area;
      curator -> its audience area (PRD 3.20 "Curator Audience Area"), including one stated in its bio
   Merge rule (owner decision R4): signals that NEST (one contains the other) resolve to the widest container.
   Signals that are DISJOINT (venue Sleman, hashtag #jakarta) are not merged: venue > account > hashtag, conflict flagged.
   Nothing -> unknown (published, lower rank, PRD FR123).
4. RESOLVE (code, not the model): name -> gazetteer key and level (Section 3).
5. LEVEL POLICY for implicit areas (Section 4).
```

## 3. Resolving names

- The model reports the name; the **gazetteer decides the level** (the model's level was wrong or ambiguous in 17 of 73 mentions in
  the recorded runs; the gazetteer used there was typed after reading the names, so treat that as indicative).
- **Ambiguous names take the widest candidate** and are flagged: "Yogyakarta"/"Jogja" -> province DI Yogyakarta; "Jakarta" -> DKI.
  Explicit "Kota Yogyakarta" / "Kabupaten Sleman" stay as written.
- **Siblings are not nested**: "Bandung"/"Malang" can be a Kota or a Kabupaten. "Widest" is undefined, so store **both** as a set
  (not the province, which is far too wide).
- Aggregates are sets: "Jawa" = six provinces, "Jabodetabek" = nine units; an area outside the gazetteer goes to the geocoder.
- Qualifier `only` ("khusus", "hanya", "... saja") vs `and_surroundings` ("dan sekitarnya").

## 4. Implicit level policy

| Signal | Default level | Exceptions |
|---|---|---|
| Venue = mall, stadium, convention centre, university | city / regency | **DIY, DKI Jakarta: province** (small province, central venues). Batam stays city (owner decision, 2026-10-27) |
| Venue = anything else | the venue's city / regency | none decided |
| Hashtag | the area named | none |
| Curator co-author / curator account | its audience area (usually a province, e.g. "Jogja") | none |

The rule is a **configuration table** (venue type x province -> level), applied in code from the venue's geocode and its stored
venue category. A venue with no category falls back to the default. `neighbourhood` is **never** produced by a fallback.

## 5. Neighbourhood scale (e.g. a 17 Agustus ceremony for one RW)

- Produced only by explicit wording (warga RW/RT, lingkungan, kampung, dusun). Stored as `{label: "RW 05", anchor: kelurahan X}`.
  "RW 05" alone is not a key: it exists in thousands of kelurahan.
- The gazetteer stops at kelurahan/desa, so the anchor is the lookup; the RW/RT label is carried as text.
- Matching a user uses **distance from the verified pin**, not administrative keys. With no verified pin, use the anchor's
  kelurahan, and treat the event as local to that kelurahan only.
- Ranking: boost people close to the pin; **neutral** (not boosted) for the rest of the city.
- **Residents-only** is the qualifier `only` on the area, not `eligibility = restricted`: inside the area full credit; outside the
  area the same bounded demotion as a mismatched city, not harder (owner decision, 2026-10-27; never hidden); unknown location neutral. Needs explicit wording; ship log-only first (a wrong `only`
  buries an event). The card says "Warga RW 05 saja".

## 6. Account rules

- A curator **never lends a location** and its address is **never inferred from a post** (PRD FR122). A curator's *post* may still name
  a venue; that is the venue signal.
- A curator's **audience area stated in its bio counts** (owner decision, 2026-10-27). It is the last resort and is tagged `account-bio`.
- Attribution is a precondition: the rules depend on the post's publisher being the right profile. BUG-081 (profile backfill overwrote
  usernames) was fixed and 22 rows were repaired on 2026-10-26/27; repost handling beyond that is deferred (IDEA-103, read the audience
  area from the original account).
- **Unclassified accounts are treated as curators until classified** (owner decision, 2026-10-27): they lend no location and supply an
  audience area only if their bio states one. This differs from today's code (`mayUseAccountLocation`) and from PRD FR122, where a
  never-classified account lends at most the area of its default location. In prod on 2026-10-26, 281 accounts with stored posts were
  never classified and produced 539 of the last 30 days' 2,191 posts (about 25%); those lose the account fallback.

## 7. Labelling and evaluation changes

1. Labelling guides (EN and ID), `target_area_level` row: replace "Take it from the venue, then the hashtags, then the account" with
   the order in Section 2. Add the rule "an address line is not an audience".
2. Add a `target_area_source` column (`stated | venue | hashtag | account | none`) and a `target_area_name` column. Scoring then
   separates the **model's reading** (stated, name) from the **policy** (level for implicit areas), which the model cannot know.
3. A separate **probe set** (not the 122-post scored set; deliberately chosen posts would distort headline accuracy), labelled blind:

| # | Case | Tests | Post |
|---|---|---|---|
| 1 | "Warga Jogja" + venue in Sleman | stated beats venue; Jogja -> province | https://www.instagram.com/p/Dey3mlFJKEa/ |
| 2 | Area word describes performers ("sanggar tari se-yogyakarta") | not an audience | https://www.instagram.com/p/DeyFxXpT8VP/ |
| 3 | National contest ("SD/MI se-Indonesia") posted by curator `jogjakajian` | scope gate; curator lends nothing | https://www.instagram.com/p/DeeAONmFE4r/ |
| 4 | National expo hosted in the city | national despite local venue | https://www.instagram.com/p/De6beulIBVK/ |
| 5 | Mosque kajian, open to public, "RW 09" in the address (published by `pojokdakwah_mbm`, co-authored by curator `jogjakajian`) | address is not audience; venue + curator merge to province | https://www.instagram.com/p/Deiw9h4xcsi/ |
| 6 | The same event on `jogjakajian`'s feed (Bright Data record lists `pojokdakwah_mbm` as poster) | repost/collab | https://www.instagram.com/p/DeoKB2cEa7Z/ |
| 7 | Neighbourhood ceremony: address + "warga RW 05" | neighbourhood + anchor | synthetic |
| 8 | "khusus warga RW 05" vs "warga RW 05 dan sekitarnya" | `only` vs `and_surroundings` | synthetic pair |
| 9 | Hashtags only (#jogja #sleman), no venue | hashtag signal | synthetic |
| 10 | Same area-less text from a local organizer account vs a curator account | account fallback differs | synthetic pair |

Rows 5 and 6 are one collab/repost pair (corrected 2026-10-27). Caption-only: the POC call does not see posters, so an area that
appears only on the poster is out of scope until production extraction (which sends images) is checked.

## 8. PRD deltas (3.20): applied on this branch on 2026-10-27 (owner: PRD changes go in the same branch); run them through `bmad-prd` before the branch merges

1. "Where an Event's Area Comes From": add hashtags as a weak signal; add the nest/disjoint merge rule for implicit signals; keep stated first.
2. Add the `neighbourhood` level with a kelurahan/desa anchor and distance-based matching.
3. Add the `only` qualifier and its scoring (demote-only, bounded, log-only first).
4. Add the per-province level policy for large venues (mall, stadium, convention centre, university): province in DIY and DKI Jakarta, city or regency elsewhere (Batam stays city).
5. Curator audience area may come from the bio (PRD already allows "bio, name or captions").
6. Siblings (Kota X / Kabupaten X) resolve to a set, not the province.
7. FR122: never-classified accounts are treated as curators until classified (no location lent), replacing "lends at most the area of its default location".

## 9. Decisions and open points

Decided (2026-10-27): Batam stays city; residents-only demotes outsiders by the same bounded amount as a mismatched city; the
large-venue exception covers stadium, convention centre and university as well as malls; an explicit participant mention wins over the
venue; unclassified accounts are treated as curators until classified.

Also decided (2026-10-27):
- **Hashtags** (accepted). Data: 18 of 3,135 posts name a different city in a hashtag, and the two I read were brand or origin words
  (`#bandungcheesecuit` on a Jogja mall post). A hashtag counts only when it is a plain place tag or a place plus a generic word
  (`#jogja`, `#eventjogja`), never a compound brand or origin tag; it is used only when the venue and account give nothing; on a
  disjoint conflict the venue wins and the conflict is flagged. Extracted by code (regex + gazetteer), not by the model.
- **Poster is a source** (accepted). Production extraction sends the poster image to the model, so an area printed only on the poster
  counts as stated, tagged `stated_poster`, with the quote read from the image. The caption-only POC cannot test it; the production
  golden set must include poster-only posts, and the rate of `stated_poster` as the only source is reported.

Confirmed by the owner (2026-10-27): "unclassified = curator" (about 25% of last-30-day posts lose the account fallback and land on unknown
area unless their bio states one; this reverses PRD FR122 for those accounts and the 2026-10-18 decision).

## 10. Venue-only locations and duplicate names (SETTLED 2026-10-27; one edge case proposed in step 3)

Problem: a post names a venue without an address ("Taman Budaya", "Alun-alun Ambarrukmo"). Today the venue text goes to the geocoder
with only a country bias (`geocodeAddress`, `bias=countrycode`, top 5, best confidence wins), with no area context. Prod, 2026-10-27:
of 1,173 geocoded schedules only 506 (43%) had confidence >= 0.5, and 981 were labelled `full_match`, so match type is no guard.
Examples: "Arena Grand Paris" resolved to a place in France (23 schedules); "Taman Budaya Embung Giwangan" to Sabah, Malaysia, confidence 0.24 (4);
"Alun-Alun Ambarrukmo" to Ciamis, West Java, confidence 0 (3, in-country but wrong); "Le Gareca Space" to France (5). Unique names work:
"Plaza Ambarrukmo" resolves to Depok, DIY, confidence 1 (27).

Proposed ladder, first that answers:
1. **Extract** the venue name and any literal address parts (street, kelurahan/kecamatan, city) as separate fields, copied from the caption or poster. The model never adds a city.
2. **Account-scoped venue memory**: if the same account has a verified pin for the same normalized venue name, reuse it (a moderator-corrected pin wins). A cache key must include the account/context, never the bare name.
3. **Context** for the query and for ranking candidates, strongest first:
   (a) post-level context: the target area the post states, a roundup heading's area, the area of the event's other resolved schedules, a plain place hashtag;
   (b) account-level context: an organizer's default area, a curator's audience area.
   Query text = venue name + the context city; the provider's proximity bias or area filter is set to the context area, plus the country filter.
   **When no context city is found** (owner, 2026-10-27: "sometimes we don't find the context city"): degrade, do not guess. Use the widest
   context area that exists (regency, then province) as the provider's area filter/bias and accept a candidate only if exactly one
   plausible candidate lies inside it; two or more inside it is ambiguous (step 5). With no context at all, only an unambiguous name
   (one candidate >= 0.9, the rest <= 0.5) is accepted. A missing context city never triggers taking the top candidate.
4. **Accept a candidate** only if: country matches (PRD 3.20), confidence >= 0.5, and it lies inside the context area when one exists.
   Taking the top candidate of an otherwise ambiguous set is allowed **only when post-level context supports it** (owner, 2026-10-27).
   - Pin precision `EXACT` only when the support is post-level context or the venue is unambiguous (one candidate >= 0.9, the rest <= 0.5).
   - If the only support is account-level context, cap the result at `AREA` (never `EXACT`), flagged `contextSource: account`.
5. **Ambiguous**: several candidates in different regencies within a small confidence gap, or a **generic name** (alun-alun, taman budaya, masjid agung/jami, pasar, GOR, balai desa/warga, lapangan, gedung serbaguna, taman kota) with no context: do **not** pin and give **no venue signal**; the target area then comes from hashtags/account, else unknown (published, PRD FR123); a nightly job retries with better context.

Effect on the target area: the venue signal exists only when step 2 or 4 produced an accepted candidate; its area is that candidate's area (then the Section 4 level policy).

Data note on account-level context (prod, 2026-10-27): the missing-city rule is needed even after profile extraction. Today no bio is stored
for any account (`description` is empty for all 367 accounts with posts) and the bio is read only transiently for account-type
classification; profile enrichment (IDEA-075) is not built. Of 336 never-classified accounts with posts, only 4 have a default location, so under
"unclassified = curator" nearly all of them have no account context until profile extraction runs for them. After extraction a city is still
absent for: national or international accounts, multi-region accounts (the POC read "Jawa; Bali"), profiles with no place in the bio or
latest captions, and accounts whose area is only a province. The POC measured 18 profiles (5 real, 13 synthetic), too few to estimate a rate; measure
on a sample of the real fleet before relying on it.

## 11. Multi-area audiences and edge cases (SETTLED 2026-10-27, owner: "support multi region, city or some area level"; the four open points were settled with the recommendations: roles on, caption/poster conflict nested -> widest and disjoint -> flag, a seeded aggregates table the owner maintains, cap 8)

**Model.** `targetAreas` is a **set of members at mixed levels** (e.g. Yogyakarta city + Jawa Tengah province + the aggregate "Solo Raya").
Each member: `{key, level, qualifier, source, role, ancestorPath}`; `role` is `participant | attendee | both` (default `both`).
- Normalisation: members that nest collapse to the widest container (Sleman + DIY -> DIY), the quotes are kept; disjoint members stay separate.
- Cap 8 members per event; more are stored as the covering aggregate (island, region, country), as PRD 3.20 already does for very large sets.
- Matching: the relation is the **best over event set x user set**; the user side is also a set (home, work). Strict area filter: any member inside.
- Exclusions ("kecuali X"): not supported in v1 (0 of 3,333 posts).

**Frequencies in prod captions (3,333 posts, 2026-10-27, regex counts, indicative):** "se-<area>" 20; national wording 52; "tingkat
kecamatan/kabupaten/provinsi/nasional" 5; "dan sekitarnya" 21; two or more cities listed 12; informal aggregates 42; abroad/diaspora 7; exclusions 0.

| # | Edge case | Evidence | Handling |
|---|---|---|---|
| 1 | **The geocoder's `city` is often a kecamatan**, and "Depok" is also Kota Depok in West Java. `LocationDetails` has no county/kabupaten, and the province is spelled two ways ("Special Region of Yogyakarta" / "Yogyakarta") | DIY schedules: Depok 352, Mlati 48, Banguntapan 26, Pisangan 24, Pakem 13 | Venue area comes from the **gazetteer hierarchy** (kecamatan -> kabupaten -> province) via coordinates or name, never the raw `city` string; normalise province aliases |
| 2 | Informal aggregates (Solo Raya, Jabodetabek, Kartamantul, Joglosemar, Malang Raya) | 42 posts | Owner-maintained aggregate table with member lists and a revision date; unknown aggregate -> unresolved, flagged |
| 3 | **Dual audience**: national registration, local final | 52 national-wording posts | Keep both members: national as `participant`, venue area as `attendee`; rank by the best |
| 4 | Staged contests (kecamatan -> kabupaten -> provinsi -> nasional) | 5 posts | Catchment = union (widest); per-stage detail belongs to tracks later |
| 5 | Caption, poster and other posts of the same event disagree | seen by design | Nested -> widest; disjoint -> keep both, flag for review (replaces "refuse the poster claim") |
| 6 | Lists of cities / tours | 12 posts | A set of cities; each split sibling event (AD-38) keeps its own stop unless a stated audience wraps all |
| 7 | "dan sekitarnya" | 21 posts | The named unit plus its neighbours from an adjacency table; needs data |
| 8 | Abroad and diaspora (Indonesian audience, venue in Malaysia) | 7 posts | Gazetteer is Indonesia-first, so a foreign place is country-level only; audience country stays separate (PRD 3.21) |
| 9 | Online event with a stated region ("webinar untuk warga Jateng") | by design | The stated area wins; the online gate applies only when nothing is stated |
| 10 | Border users and several saved locations | by design | Adjacency tier (PRD "neighbour") and the user-side set |
| 11 | Gazetteer drift and aliases (new Papua provinces 2022, IKN; Jogja / Yogya / Ngayogyakarta / DIY) | known | Versioned gazetteer with a revision date and an alias table |
| 12 | Membership-bound audiences ("mahasiswa UGM", alumni) | by design | `eligibility`, not an area; the institution's place is not a stated area |
| 13 | A famous act draws beyond the venue's city | known limit | Not inferable from text; the large-venue rule is the only lever |

## 12. Out of scope

Reading the original account for reposts (IDEA-103); OCR of posters in the POC; the full numeric account-identity unification (BUG-059).
