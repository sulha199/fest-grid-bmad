# Source extract: place, area, audience country, moderator notifications

Extracted 2026-10-20 for the PRD update (read-only; no other file touched). Behaviour only, for a PM.
Citations: `S:n` = `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` line n; `PRD:n` = `prd.md` line n;
`TA:n` = `event-insight-poc/proposal-target-area-and-scan-safety.md`; `PD:n` = `.../proposal-personalized-discovery.md`;
`BL:n` = `implementation-artifacts/backlog.yaml`; `ML:n` = `architecture/architecture-festgrid-2026-09-22/.memlog.md`.
Tag rule used: a sentence inside a tagged bullet inherits the bullet's tag unless it carries its own. Untagged statements are listed apart (section 9b).

## 0. Owner statement and status

Verbatim (2026-10-20): "every event should at least has audience target level at least on country level". Recorded as `(direction)` ML:144, mechanism "Not yet decided; recommendation given in chat"; owner answered "Yes" to starting the PRD update including "the country-level audience requirement" (ML:146; PRD memlog line 76 lists "mandatory country-level audience target"). The architect's own finding (ML:144): "the spine has no AD for EventInsight (AD-42 is the next free number); AD-39 holds area keys and the curator audience area, but not a mandatory country-level audience target". Intent adopted, wording and mechanism open (section 5).

## 1. ADOPTED requirements (write these as requirements)

Tag text is quoted exactly. "Start values" are not final numbers.

**A1. Three independent facts; unknown is a value, never "national".** S:3692 `[ADOPTED, user-accepted]`. Pin (coordinates + trust), area (`known | unknown`; "`unknown` is a value, **never null read as "national"**"), provenance (how the place was obtained). S:3693-3702.
**A2. Precision has three states, derived not stored.** S:3703-3708 (inside A1's tag). `EXACT` only if the **main** schedule's pin is trusted; else `AREA` if the area is known; else `UNKNOWN`; an event with no schedule is `UNKNOWN`. A trusted pin always implies a known area; a curator-audience or account-default area never has a trusted pin unless the venue conditions (A15) hold. S:3709-3714. The idea of a "trusted pin" is user-accepted (S:424-425); its predicate is not (P1).
**A3. Area keys are ancestor-closed** (a Sleman event stores `{id, id-yo, id-yo-sleman}`, so the country is the root key of every known area; "inside X" = contains X). Storage shape fixed now: S:3698 `[ADOPTED, user-accepted 2026-10-20]` ("IDEA-087 may still revise it before the first migration").
**A4. A roundup heading's place counts as a stated area for items that state none.** Owner reply 2026-10-19: "Roundup heading as a stated area | **Yes**" (TA:23). Effect: an item whose own place does not resolve still gets a city/area (TA:103). The guardrails in TA:90-104 (heading found verbatim in the post, never widen an item, ignore place-as-brand) are the author's edge-case rules, not separately confirmed (P12).
**A5. Strict "in X" area filter.** S:3825 `[ADOPTED]`, S:3826-3832. Matches only when the event's area is the same as or inside X. An event whose area **covers** X (a DIY-wide curator event for a Sleman user) goes to a **partial-match lane** returned in the same query; `sibling`, `other` and `unknown` never match a strict filter. `LocationFilterInput.adminArea` (never written, BUG-063) is replaced by `areaKey`.
**A6. "In your area" label.** S:3833-3835 `[ADOPTED, user-accepted 2026-10-20]`. The chip and the default Discovery tier label mean `same` and `inside` only. `covers` and `sibling` events stay in the local ordering tier but are **not** labelled "in your area".
**A7. Nearby is a pin-only distance claim.** S:3836-3840 (A5's tag). One shared computation, trusted pins only. Area-only events appear in a radius filter's partial lane as "no exact location". The cover of a series is chosen by trusted-pin distance first, then area closeness, and shows its own Nearby badge when its pin is trusted.
**A8. Ranking uses area closeness when there is no trusted pin** (same 1.0, inside 0.8, covers 0.5, sibling 0.3, other 0: start values) and never calls it distance. S:3841-3844 (A5's tag).
**A9. Exposure.** S:3845-3851 `[ADOPTED]`. Each event shows a precision (`EXACT | AREA | UNKNOWN`), a localized area label (the gazetteer's place name), and its schedules a pin trust; **not** the extraction's stub/full flag. The list card shows an **area badge whenever precision is not `EXACT`**; the roundup provenance ("from <roundup title>") stays on the detail page. Labels go through the enum translation namespace.
**A10. Unknown area is shown, penalised and capped; resolution is automatic first.** S:3806-3817 `[ADOPTED, user-accepted]`. An event with no stated area, no usable place text (usable = resolves to a key or a trusted pin) and no usable account fallback appears in the default Discovery tier of national events (the POC's tier 1) with a ranking penalty and a per-page cap (values at story time). A nightly job retries (roundup heading, then account area); the moderator "needs location" list is "a **backstop, never the mechanism**". Size 2026-10-20: 26 of 452 open events (6%) have no place at all, 58 more place text only; 155 (34%) a pin the shipped test trusts, 213 (47%) one it rejects; the `unknown` count rises once A12 applies (S:3818-3822).
**A11. The account default location is read only in one narrow, recorded place** (`resolveEventPlace()`), tagged with how the place was obtained. S:3735-3740 `[ADOPTED, user-directed and user-accepted; the "everything else" bullet accepted 2026-10-20]`.
**A12. Curators never lend their location.** S:3741-3748 (A11's tag). A curator event with no exact location does **not** take the account's location; the area is **never** derived with Geoapify (a curator's pick is "a different venue each time: 12 posts, 12 places"). The account carries an **audience target area**; a location-less curator event inherits it and has precision `AREA`.
**A13. How a curator's audience area is found.** S:3749-3750 `[ADOPTED, user-directed 2026-10-20: a model guess, validated by the account's first posts, never Geoapify; the table is PROPOSED]`. Two sources, both resolved through the gazetteer: the profile (Gemini names the areas the account serves, each with verbatim evidence; a guard drops any area not in the input) and the account's first extracted posts (the narrowest area containing most of them, "never the country"). Re-validated as the first posts arrive. A moderator can correct it after the fact (A18 posture): "Moderator review of a model- or posts-derived area happens after the fact" (S:3784-3785). Setting an area re-queues the account's `unknown` events once (S:3793). Legacy: the 463 of 466 accounts with no default location get the same enrichment (S:3791-3793).
**A14. Curator type confirmation and scraping never wait for the area.** S:3770-3773 `[ADOPTED, user-directed 2026-10-20]`. The scrape gate (AD-34) is unchanged and "no new curator is held in `AWAITING_APPROVAL` for lack of one". Supersedes ML:97 (3), where the account stayed pending until a moderator set an area.
**A15. Venue accounts.** S:3794-3798 (A11's tag). The account's default location may serve as the event's place, and its pin may be trusted, only when the place is recorded as `account_default`, the account is a confirmed `ORGANIZER_VENUE_EVENT` of local or regional reach ("a national company's head office is not where its webinar happens"), and the event is organizer-authored.
**A16. Everything else** (never-classified, personal, awaiting-approval accounts, venue accounts outside A15's conditions). S:3799-3805 (accepted 2026-10-20). Only the default's **area**, never its pin, may fill the event's area; precision at most `AREA`; the event appears in "In your area" and the partial lane and **never in Nearby**. This reverses the owner's 2026-10-18 decision that never-classified accounts lend their location (PD:48, decision 19).
**A17. Country scope for grouping.** S:2793-2794 `[ADOPTED, user-directed 2026-10-20; mechanism corrected by review R4]`: "events targeted at different countries are never grouped"; an unsettled event "attaches to nothing"; the cost (an Indonesian event whose only pin is a wrong foreign one and has no area or country text stays ungrouped) was accepted by the owner (ML:143 (3)). BWF Denmark/Egypt rounds separate. The way the country is computed is P8.
**A18. Moderators are notified, never blocking.** S:2608 `[ADOPTED, user-directed, modified from the tier-gated recommendation]`: every group tier applies immediately; "nothing in ingestion, matching or display waits on a moderator"; Tier 2 and Tier 3 suggestions generate a moderator notification; Moderator Tools gains a "review group" action (detach a child, rename, dissolve: a revert, never a block). S:2609-2615.
**A19. Every event carries an audience target at least at country level** (owner statement, section 0). Intent only; see section 5.

Count: 19 ADOPTED requirements (A1-A19).

## 2. What an event's place and area come from, and what the user sees

Order of sources `[ASSUMPTION: derived from the confirmed decisions, not itself confirmed]` (S:3715-3734): (1) a stated area resolved by the gazetteer (area phrases such as "DIY & Jawa Tengah" or "Jabodetabek" are **not** sent to the geocoder); (2) the trusted pin's administrative path; (3) the roundup heading; (4) the account fallback (A12/A15/A16); else `unknown`. A stated area and a pin must agree, otherwise the pin becomes untrusted, not the text (S:3733-3734). Stated place text is geocoded after sub-venue qualifiers are stripped and non-places ("Online", Zoom) are never geocoded (AD-14 Rule 5, S:527-536; its venue-segment step is P4).

| Source | Stated place | Trusted pin | Roundup heading | Account fallback |
|---|---|---|---|---|
| `area_source` / `location_source` | `stated` / `stated` or `geocoded_from_text` | `pin` / (as the pin) | `heading` | `account` / `account_default` or `account_audience_area` |
| Area and precision | area from gazetteer; `EXACT` only if its pin is trusted | `EXACT`, area from the pin's path | `AREA` | `AREA` (venue account may be `EXACT`, A15) |

| Precision | Map link | Nearby badge | Radius filter | Strict area filter | "In your area" | Card badge |
|---|---|---|---|---|---|---|
| `EXACT` | yes (trusted pin) [today's gate: confidence 0.5 + `full_match`, S:426-428; replaced only if P1 is adopted] | yes if near (A7) | matches | by its area: same/inside strict, covers partial | if same/inside | none |
| `AREA` | no (no trusted pin) | never (A7, A16) | partial lane, "no exact location" (A7) | same/inside strict, covers partial (A5) | same/inside only (A6) | area badge with area label (A9) |
| `UNKNOWN` | no | never | not stated for unknown | never matches (A5) | no | badge shown ("not EXACT") but its label is not defined (Q3) |

Ordering: `EXACT` and `AREA` events sit in the local tier when same, inside, covers or sibling; `UNKNOWN` events sit in the default tier 1 with penalty and cap (A10, A6).
Facts that frame it: production has 1,460 stored pins, 627 (43%) with stored confidence under 0.5; 129 of 343 pins outside Indonesia's box are 0.5 or higher (S:416-418, 500-501).

## 3. Curator accounts, venue accounts, everything else

**Curator audience target area** (A12-A14). Found by profile guess (P) validated by first posts (Q), never Geoapify, never the country for Q. Who writes it: one function `setAudienceArea()` that records a change row; `audience_area_source` is `model | moderator` (S:3746-3747) while the table also uses `posts` (S:3760-3766): inconsistent (Q6). Subscribers are not named as setters. A moderator sets or corrects it (S:3779-3781, "the account is listed for a moderator to set an area"). Reliability evidence: 18 profiles x 3 runs, one real curator, 0 of 54 wrong country or zone, areas varied by run (S:3786-3793): a proposal a moderator can correct, and a real-curator evaluation is the gate for trusting it without that pass (P9).
**What a location-less curator event shows:** precision `AREA`, the area label, the area badge on the card, no map link, no Nearby, "In your area" only for a viewer inside or equal to the audience area (a DIY-wide event for a Sleman viewer is `covers`: local ordering tier, partial lane, not labelled "in your area").
**When no area is resolved and the event states none:** published as `unknown` (A10: penalty, cap), the account listed for a moderator (backstop). The curator-specific sentence "published rather than held" carries its own tag `[PROPOSED: publish rather than hold. ...]` (S:3781-3783; open owner yes/no, ML:132 (1)); A10 is adopted generally.
**Existing curators:** 11 of 17 production curators hold an arbitrary default (S:3686-3687); BL:2331-2337 and BUG-065:105 say clear them after the code gate ships, "Decided on my recommendation" (owner acceptance not recorded, Q10).
**Venue accounts** (A15) and **everything else** (A16): see rows above. For those a stated place always wins; the fallback applies only to an event with no place of its own.

## 4. Unknown-area events and wrong-country pins

- **Published, not held** (A10), in the default tier with a penalty and a per-page cap; values "start values at story time, from Round 3 item 9" (S:3810-3811, 3907-3908). The alternative (a hold) "has no worker: moderators resolved 0 of 147 and receive no queue notification" (S:3823-3824).
- Automatic retry nightly, "at most N geocodes per run `[ASSUMPTION]`" (S:3811). The `'Location not specified'` placeholder stays in `events.location`; readers use area status (S:3815-3817).
- **Wrong-country pins:** ADOPTED part is only the principle in A2 (an untrusted pin gives at most `AREA`, so no map link and no Nearby). The test that decides "wrong country" is **PROPOSED**: AD-14 Rule 4 (e) `[PROPOSED 2026-10-20]` (S:449-483, "awaiting the owner's yes", S:3899-3900; ML:132 (4)). Evidence: 42 labelled pins outside Indonesia are wrong at every confidence including 4 of 4 at 1.00; 214 of 333 listed out-of-box pins (64%) come from accounts with no default location (S:415-418, 472-477). In-country wrong-city pins (Transmart Cirebon answered in Surabaya) stay open until the pin-versus-area check can run (S:488-491).

## 5. The country-level audience requirement: what exists, the gap, wording options

**What exists (AD-39 and neighbours)**
1. Area keys are ancestor-closed, so any event with a known area carries a country key as root (A3). The country is a by-product of area, not a field.
2. `area_status = unknown` is allowed, published, penalised and capped (A10): such an event has **no country of any kind**.
3. Curator audience area: Q is "never the country" (S:3757-3758); the area may stay unresolved (S:3766, 3778).
4. Country-level audiences are by design **not an audience area**: "Country-level keys and above are not an audience area: they mean 'national' and go to tier 1" (TA:128, draft-for-review); a national or international scope gives "none, stop" (PD:402-404, draft). That is, national = absence of an audience area. The spine does not restate or adopt this; it has no stored `geo_scope`, no `national | international | online` value (none in the spine; PD:166 proposes `geo_scope` and `target_area_keys` columns, not adopted).
5. The only country fact stored is `events.country_key` / `country_source` (`area | pin | text | default`), for grouping (S:3140-3143, PROPOSED mechanism). It means where the event happens, is nullable (NULL = unsettled, "attaches to nothing") and step (4) is `GEOAPIFY_DEFAULT_COUNTRY` only when no pin has a different country (S:2797-2804). ML:144: "the audience country is a different fact and may default to the platform country with source = default, which must never leak into grouping. Not yet decided".
6. Geocoding is biased to `GEOAPIFY_DEFAULT_COUNTRY` (default `id`) when the account has none (S:405-408). The account's own country exists only as a POC (IDEA-075: read from the profile scrape, 0 of 54 wrong; stored fields "at implementation, not now", backlog file line 118). AD-14 Rule 4 says "The account's default country is never the expected country" for pins (S:469-472). Users have no country column (IDEA-075 file line 29). The gazetteer is "Indonesia-only first" (S:3904-3905).
7. Audience extraction (IDEA-074) is POC only; its prompt v2 "had no country field"; held-out 18/18 on 6 posts (ML:144; BL:2347-2353).

**The gap (precise).** No field says "the country this event is aimed at" for every event. Specifically: (a) an `unknown`-area event has none; (b) a national, international or online event has no stored form, and AD-39 does not say whether a country-only key `{id}` is a legal `known` area; read literally it is `covers` for every viewer in the country (local tier 0, partial lane, not "in your area", S:3829-3835), whereas the drafts put it in tier 1 "anywhere" (TA:128) and A10 penalises `unknown`; three readings of one event; (c) `country_key` is nullable by design and describes the venue; (d) curator Q is never country-level and may stay unresolved; (e) there is no source ranking for a default audience country and no record that a country was defaulted.

**Wording options (not decided; pick one per axis)**
- Axis 1, what every event carries: (1a) exactly one audience country code; (1b) an audience country code or the value `international`; (1c) an audience level that is country or finer (a known area implies its country via A3) or `international`, which is the closest reading of "at least on country level".
- Axis 2, online events: (2a) the audience country of the stated or organizer's audience, like onsite; (2b) `international` when no audience is stated; (2c) organizer's country when the organizer is local or regional (PD:403), else `international`.
- Axis 3, default source when the post states none, in what order (candidates, with where each stands): known area keys (A3); trusted-pin country (P2); country named in stated text (P2); roundup heading (A4); curator audience area or account country (A12; IDEA-075 POC); platform default country `GEOAPIFY_DEFAULT_COUNTRY` recorded with source `default` (ML:144); subscribers' country (IDEA-075 "tie-break, the last option"; sits against PRD:1652, section 7c); or none.
- Axis 4, provenance: whether the defaulted source is stored and shown to moderators; whether a defaulted value may feed grouping (ML:144: never).
- Axis 5, relation to the grouping country: (5a) two facts (audience country, event-location country); (5b) one.
- Axis 6, unknown-area events: (6a) a defaulted country fills in, penalty stays for area-unknown; (6b) penalty only when no country is resolved.
- Axis 7, existing events: (7a) backfill with the default and source `default`; (7b) leave empty until re-derived.
- Axis 8, correction: whether a moderator (or user via the correction form, PRD:159-173) can edit an event's audience country.

## 6. Moderator work-queue notifications (BUG-069, IDEA-090)

**Decided (ADOPTED):** A18 (non-blocking, notify group suggestions, "review group"), A10's "backstop, never the mechanism", and the principle that nothing waits on a moderator.
**Recorded as a direction without a tag:** BL:2550-2556 IDEA-090: "Decided direction 2026-10-20 (AD-36 Rules 4 and 7 depend on it): a digest email and a push to moderators for pending queue items (candidates, corrections, reports, group suggestions, curators without an area); today only 5 event types are emailed. Needs BUG-069 first." Title: "a digest email and a push for pending items, with delivery failures recorded". The spine defers the mechanism: "the carrier of the moderator notifications of Rules 4 and 7 ... depends on IDEA-090" (S:3271-3274; S:2028, 2604-2607, 3243-3247).
**Queue item types named** (two lists, not identical): IDEA-090: match candidates, corrections, reports, group suggestions, curators without an area. BUG-069 file: pending match candidates (147), corrections, reports other than "dangerous", account-type reviews, group suggestions. Also named in the spine: group-conflict on a merge (Rule 7, S:2661-2670, a mechanical consistency call, not user-asked), the nightly list of new cross-account groups (S:3243-3247, "needs a carrier"), and the SCH programme needing a moderator-created group seed (S:2604-2607).
**Facts today (BUG-069 file, code reading, not run on production):** a moderator is emailed for five event types only: dangerous-event report, default-location change (two variants), two scraper alerts; a moderator is never sent a push by design (push goes to subscribers with a stored device token, push on, and a subscription); nothing notifies about the queue; a failed send is silent; 147 candidates pending, 0 resolved. Causes for the owner's missing push/email are unconfirmed (owner SQL, SES sandbox, sender address not checked).
**Not decided:** digest cadence and time; whether push fires per item or per batch and at what threshold; recipients (all moderators, as the five emails do?); opt-out; where delivery failures are recorded and who sees them; whether the five existing emails stay immediate; whether new item types count in the PRD:196 pending badge; PRD wording (IDEA-090 touches the PRD).

## 7. Conflicts with the current PRD

**7a. PRD sentences contradicted or superseded by ADOPTED decisions (9)**
- K1. PRD:79 "If the AI agent does not find an explicit location in a post, it will use this default location for the event." Now: only venue accounts under A15 use it as the place; others give area only, precision `AREA` (A16); curators never (A12).
- K2. PRD:82 "If a "Default Location" is still unset when a post is scraped, the system infers one automatically rather than leaving the account without a fallback." Now: for curators no account location is inferred or used; the audience area (A13) replaces it. Whether inference continues for venue accounts is untouched by adopted items (a consensus-across-posts rule appears only in PD:374, draft).
- K3. PRD:572-573 "When a `Schedule` inherits its account's Default Location (Section 3.7), this field is inherited along with the rest of `LocationDetails`." and PRD:295 "...is included whenever a schedule inherits its account's Default Location..." Now: full inheritance only under A15; area only (no pin, no venue data) under A16; none for curators.
- K4. PRD:716-728 (`defaultLocation`) "The default location used to backfill an event's location when a post's location is implicit (Section 3.7)." Narrowed as K1; the account also gains audience-area fields (keys, source) with its own writer.
- K5. PRD:37 "a card for an event within 5km of the viewer's current position shows a "Nearby" badge." Now: only events with a trusted pin (precision `EXACT`) ever show it (A7, A16). Aside: S:1155 cites DESIGN.md `<8km`, PRD says 5 km.
- K6. PRD:48 "These saved locations can be used to find "nearby events" within a user-defined radius..." Now: the radius reads trusted pins only; area-only events appear in a partial lane labelled "no exact location" (A7).
- K7. PRD:557-566 (`adminArea`) "A normalized administrative-area label used for region-mode filtering (Section 3.15)... Derived from the geolocation provider's most granular reliable admin-area field". Now: never written (BUG-063); replaced by ancestor-closed area keys from a gazetteer, stored on the event, matched hierarchically (A3, A5).
- K8. PRD:1484-1487 (`LocationFilter.adminArea` "Matched against `LocationDetails.adminArea`") and PRD:1539-1560 (leaf `locationAdminArea`). Now: `areaKey`, same-or-inside matches strictly, covers goes to the partial lane (A5).
- K9. PRD:291 "admin-area/region text match", PRD:295 "alongside the new admin-area field", PRD:296 "Region Matching, a Known Limitation: ... relies on the existing geolocation provider's administrative-area data (Section 4.3)". Now: region matching is by gazetteer area keys, with an `unknown` state that never matches; polygon filtering stays rejected.

**7b. PRD is silent: additions needed (not contradictions)**
PRD:31-37 (§3.1): no "In your area" chip, partial lane, area badge, strict area filter, precision. PRD:72-84 (§3.7): no curator audience area, no roundup-heading area, no unknown-area publication. PRD:84 Moderator Override: moderators also set a curator's audience area. PRD:195-196 (§3.9.3): add "curators without an area", the audience-area edit, "review group"; the badge counts reports, default-location changes, cross-post matches and account-type classifications only; whether new types count is open (Q11). PRD:404-406 (`EventInfo.location: string`) and §4.1: no precision, area label, audience country. PRD:521-576 (§4.3) lacks `confidence`, `matchType`, `countryCode` that AD-14 Rule 1 says mappers already populate (S:368-373). §4.4 (PRD:633-644): no pin trust. No notification of moderators about queue items anywhere (IDEA-090). The PRD never states a platform home country.

**7c. Conflicts that appear only if PROPOSED items are adopted (do not write yet)**
PRD:133-136 timezone inference "The event's location will be used to determine the timezone": under AD-14 Rule 4 readers, only a trusted pin feeds it (S:492-499), and tier 2 (account default's zone) is read through `resolveEventPlace()`. PRD:1652 "Location Data Reuse Boundary: A user's saved/current location ... must never be used to label or infer a social media account's location": the "subscribers' country" clue (IDEA-075) as a country source would need an explicit carve-out. PRD:159-173 correction form: editing `location` re-derives pin trust and area (S:520-521, 3852-3859, P7).

## 8. Open questions that block a requirement

- Q1. Country-level audience: Axes 1-8 of section 5; first the shape (1a/1b/1c) and the default source order.
- Q2. Is a country-only key a legal `known` area, and where does a national/international/online event sort (tier 0 covers, tier 1 anywhere, or penalised unknown)?
- Q3. What does the card badge say for `UNKNOWN` precision (no area label exists), and is `UNKNOWN` in a radius filter's partial lane?
- Q4. Which user location defines "your area" (saved location, current location, none = every event tier 1 per PD:189), and how it resolves to area keys. Users have no country field.
- Q5. Owner yes/no on "publish, not hold" for curator events with no area (S:3781, ML:132 (1)); confirm A14 replaces ML:97 (3).
- Q6. Who may set or correct a curator's audience area besides a moderator (PRD:80 lets any subscriber set Default Location)? Does a moderator edit use the PRD §4.14 request/notify/revert flow? `audience_area_source` values: `model | moderator` (S:3746) or `model | posts` (S:3760-3766).
- Q7. Can an individual event's area or audience country be corrected by a moderator or user?
- Q8. Owner yes/no on the wrong-country test (e) and the floor (S:3899-3900, ML:132 (4)).
- Q9. Penalty size and per-page cap for unknown events (pending Round 3 item 9).
- Q10. Clearing the 11 curators' stored defaults: owner acceptance not recorded (BUG-065:105).
- Q11. IDEA-090 scope, cadence, recipients, failure recording, badge counting; BUG-069 root cause is unverified.
- Q12. Audience-area inheritance by group members is open (S:2695-2697, 3905-3906).
- Q13. Gazetteer source, licence and coverage; Indonesia-only first means a non-Indonesian country needs another source for its country key (S:3904-3905).

## 9. Not adopted - do not write as requirements

**9a. PROPOSED / ASSUMPTION (with the tag text)**
- P1. AD-14 Rule 4 pin-trust predicate `[PROPOSED by the 2026-10-19 architect review; the idea of a "trusted pin" is user-accepted (AD-39), this predicate's shape is not yet]` (S:424-426, 492-499); floor 0.5 and `full_match` stay `[PROPOSED]` (S:431-442).
- P2. Leg (e) the pin's country equals the expected country `[PROPOSED 2026-10-20]` (S:449-483); country-name collisions `[ASSUMPTION]` (S:463-464); result-type cap `[ASSUMPTION]` (S:478-482).
- P3. Rule 3a (S:415-423) is a factual amendment (the old "self-healing" claim withdrawn), untagged.
- P4. AD-14 Rule 5: `pickVenueSegment()` `[PROPOSED]` (S:543-546), "16 of 21 is an upper bound" `[ASSUMPTION]`; the non-place rule is untagged: "The non-place rule is not an assumption." (S:535-536).
- P5. AD-39 Rule 2 source order and compare-and-set rank `[ASSUMPTION: derived from the confirmed decisions, not itself confirmed]` (S:3715-3734).
- P6. Curator area details: widest candidate for an ambiguous name `[ASSUMPTION]` (S:3751-3753); `N = 5`, `M = 3` `[ASSUMPTION]` (S:3757-3758); the P/Q consistency table "is PROPOSED" (S:3749-3769); P produced by the classification call `[ASSUMPTION]` (S:3773-3777); "publish rather than hold" `[PROPOSED: ...]` (S:3781-3783).
- P7. AD-39 Rule 7 single writers and the expand-derive-switch-contract migration `[PROPOSED]` (S:3852-3884); legacy `location_source` fingerprint.
- P8. AD-36 Rule 17 `[PROPOSED by the review]` unless marked (S:3119-3122): stored `country_key`, `country_source`, the `eventCountry()` order (area keys, trusted pin, single country named in stated text, `GEOAPIFY_DEFAULT_COUNTRY`), unsettled = NULL (S:2797-2804, 3140-3162). Scope adopted (A17), mechanism not.
- P9. Real-curator evaluation as the gate for trusting a model area without a moderator pass (Deferred, S:3901-3903); time zone from an area key `[ASSUMPTION]` (S:3907); N geocodes per night `[ASSUMPTION]` (S:3811).
- P10. AD-36 Tier 1 notifies moderators `[ASSUMPTION]` (S:2615); Rule 7 merge-conflict notification (a "mechanical consistency call", ML:64); nightly new-group list "needs a carrier" (S:3243-3247).
- P11. Draft proposals (status `draft-for-review`): level ladder, aggregates as sets, qualifiers, "target area but no recorded location" options (TA:74-83, "not decided"), tier 0/1/2 ordering (PD:174-189), organizer consensus for inference (PD:374), `geoScope` values `venue_local, city, region, national, international, online, unspecified` (PD:94; model reliability "high"; stored only as a proposal).
- P12. Roundup-heading guardrails TA:90-104 (heading must be verbatim in the post; never widen; place-as-brand ignored; wide heading over a narrower item).

**9b. Untagged or ambiguous (confirm before writing)**
- IDEA-090 "Decided direction" (section 6). BUG-065 clearing the 11 curator defaults "Decided on my recommendation". PD:44-50 "Revision" decisions (account country from profile scrape, default time zone, subscribers' country as last tie-break) are listed as decisions of the 2026-10-18 discussions inside a draft, with no spine tag. AD-39 header "Prevents" list, including a wrong-country pin driving the map link, radius filter and Nearby badge (S:3687-3690).
