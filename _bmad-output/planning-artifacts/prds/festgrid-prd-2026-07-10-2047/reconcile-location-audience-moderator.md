# Reconciliation: place, area, audience country and moderator notifications against the amended PRD

Scope. `source-extract-location-audience-moderator.md` (ADOPTED A1-A19, conflicts K1-K9, additions 7b, questions Q1-Q13, not-adopted P1-P12) checked against `prd.md` as amended on 2026-10-21 (commit ea81cb3). Also read: the owner's decisions of 2026-10-21 (architecture `.memlog.md` entries 150 and 152; entries 143-145 are dated 2026-10-20, and entry 144 holds the audience-country direction that entry 150 item 2 then settled), `round-4-analysis-2026-10-21.md`, and the current spine (AD-14 Rule 4, AD-39 Rules 1-8). The spine is now 4,230 lines, so this file cites rules, not the extract's line numbers.

Citations. `PRD:n` = line n of the current `prd.md`. Status words: CAPTURED, WEAK (the gap is named), MISSING.

Counts. ADOPTED: 15 captured, 4 weak, 0 missing (19). Conflicts K1-K9: 7 resolved, 1 partial, 1 standing. Section 7b additions: 7 of 9 done, 2 not done.

## 1. Owner decisions of 2026-10-21 against the PRD

| Decision (memlog 150 / 152) | In the PRD |
|---|---|
| (1) Suppression: series only, 7-day window | PRD:361 (see dedup file, A38) |
| (2) Every event carries an audience country; order stated -> place/area -> account -> platform default; separate from grouping country; online with no audience = international; existing events stay empty; moderator may correct | PRD:380-384, PRD:475-480. Done. Consequence for users and ordering is explicitly left open (PRD:384). |
| (3) The PRD pass includes the place-model rewrite, adopted parts only | 7 of the 9 contradicted sentences cleanly rewritten; K3 standing, K9 partial (section 3). |
| (4) Publish curator events with no resolved area as unknown | PRD:376, PRD:375. Done. |
| (5) Wrong-country pin test (leg (e)) adopted; floor, `full_match`, country list, result-type cap keep their tags | PRD:371. Done, but legs (c) and (d) of the predicate are also written as requirements and are still PROPOSED (section 5). |
| (6) Group suggestions and queue items count in the moderator badge | PRD:201. Done. |
| (7) Run the PRD reviewers after the edit | Process, not PRD. |
| Round 4 facts (336 of 432 foreign pins, 34% / 22% curator and unclassified, BUG-073, 0 of 147) | Used at PRD:371, 384, 200, 376. The 336 is stated as exact (section 5). |
| Stub weight 0.10; claim release on Firebase initialisation failure | PRD silent; thresholds are implementation (PRD:103), but the claim policy is a user-visible notification guarantee (see dedup file, A37). |

## 2. ADOPTED items

| ID | Spine item | Status | Where in the PRD, or what is missing |
|---|---|---|---|
| A1 | Three independent facts; unknown is a value, never "national" | CAPTURED | PRD:369 ("None is inferred from another. An unknown area is a value of its own and is never read as 'national'"). |
| A2 | Precision has three states, derived not stored | CAPTURED | PRD:370; PRD:462-466 (main schedule's pin; no schedule is `UNKNOWN`; "derived, never edited by hand"). |
| A3 | Area keys ancestor-closed, country is the root | CAPTURED | PRD:369 (country, province, regency, city), PRD:373 ("same or inside"), PRD:381 ("the country of its known area"). Storage shape is implementation. |
| A4 | Roundup heading counts as a stated area | CAPTURED | PRD:372. Internal inconsistency: PRD:372 puts the heading inside "the area the poster states" (rank 1, ahead of a verified pin), PRD:376 lists it again as a nightly retry step after "unknown"; the spine order is stated > pin > heading > account. |
| A5 | Strict "in X" filter and partial lane | CAPTURED | PRD:38, PRD:373, PRD:1627 (`areaKey`), PRD:1617-1620 (`adminArea` superseded). |
| A6 | "In your area" means same or inside only | CAPTURED | PRD:37 (province-wide event seen from one regency ranks local, not labelled). Neighbouring ("sibling") areas, also local-tier and unlabelled, not mentioned. |
| A7 | Nearby is a pin-only distance claim; area-only in the radius partial lane; series cover by trusted-pin distance then area closeness, with its own Nearby badge | WEAK | PRD:41, PRD:52, PRD:370-373 capture the first two. Missing: the series cover rule. PRD:359 says only "best-ranked matching occurrence"; the cover's own Nearby badge is not stated. |
| A8 | Ranking uses area closeness without a trusted pin, never called distance | CAPTURED | PRD:373 last sentence. Start values (1.0 / 0.8 / 0.5 / 0.3 / 0) omitted, fine. |
| A9 | Exposure: precision, localized area label, pin trust; area badge whenever precision is not EXACT; not the stub/full flag; roundup provenance stays on the detail page | WEAK | Fields at PRD:466, 470, 733; badge at PRD:37, PRD:370. Diverges: PRD:37 and PRD:370 say an event with no known area "is not labelled" / `UNKNOWN`: no area label, whereas the spine says the badge shows whenever precision is not `EXACT` (label undefined, extract Q3). Missing: the badge is independent of the extraction's stub/full flag (a roundup stub with a known area still gets the area badge; the "details coming" treatment is separate); "from <roundup title>" stays on the detail page. |
| A10 | Unknown area shown, penalised, capped; automatic resolution first | CAPTURED | PRD:39, PRD:376 (nightly retry: heading, then account area; moderator list is a backstop; reason 0 of 147). Dropped: such events sit in the default tier of national events (the POC's tier 1); sizes (26 of 452 open events, 6%, have no place at all, 58 more place text only); the unknown count rises when the curator fallback goes. |
| A11 | Account default read in one narrow, recorded place | CAPTURED | PRD:83 (amended), PRD:369 (c) provenance, PRD:374. |
| A12 | Curators never lend their location; audience area; precision AREA | CAPTURED | PRD:374-375, with the reason (a different venue in each of 12 posts). |
| A13 | How a curator's audience area is found | WEAK | PRD:375 has profile with evidence, guard, first posts (narrowest area, never the country), never the geocoder, moderator correction, one re-check. Missing: the model area is provisional until the first posts arrive and is re-validated after each of them; the 463 of 466 legacy accounts get the same enrichment; the reliability caveat (areas varied by run; 18 profiles, one real curator; a real-curator evaluation gates trusting it without a moderator pass) is not flagged `[ASSUMPTION]` as PRD:384 does for the audience country. "When they disagree the posts win" comes from the PROPOSED consistency table and is untagged. |
| A14 | Type confirmation and scraping never wait for the area | CAPTURED | PRD:375 ("A curator is scraped, and its type confirmed, whether or not an area is known"). |
| A15 | Venue accounts: default may be the place only under three conditions | CAPTURED | PRD:374, including the head-office reason. |
| A16 | Everything else: area only, never the pin, never Nearby | CAPTURED | PRD:374. |
| A17 | Country scope for grouping | WEAK | PRD:357, PRD:343. Same defect as dedup A21: "aimed at different countries" reads as the audience country (PRD:380) while the rule is the country where the event takes place (PRD:382). |
| A18 | Moderators notified, never blocking | CAPTURED | PRD:354, PRD:199-201. |
| A19 | Every event carries an audience target at least at country level | CAPTURED | PRD:380-384, PRD:475-480. All eight axes of extract section 5 are decided or flagged: 1b (code or `international`), 2b (online with no audience), 3 (order, PRD:381), 4 (source stored, PRD:480), 5 (two facts, PRD:382), 6 (penalty stays, PRD:382), 7 (empty until re-derived, PRD:383), 8 (moderator only, PRD:383). Gaps: no user-visible behaviour; the platform default country is never named. |

## 3. Conflicts K1-K9

| # | PRD sentence | Verdict | Evidence |
|---|---|---|---|
| K1 | "If the AI agent does not find an explicit location ... it will use this default location" | RESOLVED | PRD:83 "(Amended 2026-10-21, FR122) Whether the default may serve as an event's place depends on the account's type (Section 3.20); a curator or local-guide account never lends its location." |
| K2 | "If a Default Location is still unset ... the system infers one automatically" | RESOLVED | PRD:86 "For a curator or local-guide account no Default Location is inferred or used; its audience area ... replaces it." Inference for venue and other accounts continues, as the extract says. |
| K3 | Venue type "is inherited along with the rest of `LocationDetails`" when a schedule inherits the account default | STANDING | PRD:654-656 (4.3 `venueType`) and PRD:300 (3.15 Venue Type Source, "alongside the new admin-area field, and is included whenever a schedule inherits its account's Default Location") are untouched. Under A12, A15, A16 a curator inherits nothing, a non-venue account inherits only an area, and only a qualifying venue account inherits a place. An epic writer following these sentences rebuilds the removed fallback. |
| K4 | `defaultLocation`: "used to backfill an event's location when a post's location is implicit" | RESOLVED | PRD:817-818 amended; `audienceAreaKeys` and `audienceAreaSource` added, PRD:825-830. |
| K5 | "Nearby" badge within 5 km | RESOLVED | PRD:41 "appears only for an event whose location is verified". Aside unresolved: DESIGN.md says under 8 km. |
| K6 | Saved locations find "nearby events" within a radius | RESOLVED | PRD:52. |
| K7 | `LocationDetails.adminArea` derived from the provider | RESOLVED | PRD:646-647 "nothing in production wrote this field". |
| K8 | `LocationFilter.adminArea` and leaf `locationAdminArea` | RESOLVED | PRD:1620-1627 supersedes with `areaKey`, names the leaf. Leftover wording at PRD:1679 and PRD:1700 ("admin-area") is only the leaf name. |
| K9 | "admin-area/region text match" in the AI-filter vocabulary; region matching relies on provider data | PARTIAL | PRD:301 (Region Matching) amended. PRD:296 (Locked Filter Vocabulary: "admin-area/region text match") and PRD:300 are not. A prompt such as "in Sleman" must now resolve through the gazetteer to an area key, and an unknown area never matches; the vocabulary sentence still says text match. |

## 4. Section 7b additions

| Addition | Status | Note |
|---|---|---|
| 3.1 chip, partial lane, area badge, strict filter, precision | DONE | PRD:37-39, 41 |
| 3.7 curator audience area, heading area, unknown-area publication | DONE | PRD:372-376, cross-referenced from PRD:83, 86 |
| 3.7 Moderator Override covers the audience area | PARTIAL | PRD:375, PRD:199 say a moderator sets or corrects it. PRD:88 (Override) and the 4.14 request, notify, revert flow are not applied or ruled out (extract Q6). |
| 3.9.3 curators without an area, audience-area edit, review group, badge | DONE | PRD:199-201 |
| EventInfo precision, area label, audience country | DONE | PRD:462-480 |
| 4.3 lacks `confidence`, `matchType`, `countryCode` | NOT DONE | PRD 4.3 unchanged (no hits). The pin test (PRD:371) reads exactly these three stored inputs. |
| 4.4 pin trust | DONE | PRD:727-733 |
| Moderator queue notifications | DONE | PRD:200 |
| The PRD never states a platform home country | NOT DONE | PRD:371 and PRD:381 say "the platform's default country" without naming it (Indonesia, configurable). |

## 5. PRD statements with no or weaker spine support

| PRD | Statement | Issue |
|---|---|---|
| PRD:37, PRD:370 | `UNKNOWN`: no area label, not labelled | Spine (AD-39 Rule 6) badges every non-`EXACT` card; the PRD chose differently without saying it is a decision. Also unstated whether `UNKNOWN` events enter the radius partial lane. |
| PRD:372 | Source order of the area, stated as fact | Spine tags the order `[ASSUMPTION: derived from the confirmed decisions, not itself confirmed]` and ranks stated > pin > heading > account; the PRD puts the heading first. |
| PRD:371 | Pin not verified when it disagrees with the stated area, or came from an account default | Legs (c) and (d) of the pin predicate are PROPOSED (AD-14 Rule 4: "this predicate's shape is not yet" accepted); only leg (e) is ADOPTED. Only the floor is tagged in the PRD. |
| PRD:371 | "336 of 432 pins ... would be withheld" | Spine: 336 name no country; 88 name one only in event text, which may be a geocoder address that the rule excludes, so more than 336 can be withheld (reliable lower bound of stated-country pins is 8, upper 96). The cost, a lost map link for any genuine foreign event whose text names no country, is implied, not said. |
| PRD:375 | "When they disagree the posts win" | From the PROPOSED P/Q table. |
| PRD:475-480 | `audienceCountry` and the five-value `audienceCountrySource` | Spine defers storage and extraction contract to AD-42, not yet drafted. The PRD invents the source set (it does match the four-step order plus moderator). |
| PRD:200 | A push notification to moderators | Extract: today a moderator is never sent a push by design (push needs a device token, push on, a subscription). The direction comes from IDEA-090 ("Decided direction", untagged). |
| PRD:199 | Moderator Items lists the system's automatic merges | See dedup file, section 4. |

## 6. Open questions Q1-Q13

| # | Status | Note |
|---|---|---|
| Q1 audience-country shape and source order | RESOLVED | PRD:380-384 |
| Q2 is a country-only key a legal known area; where national, international, online events sort | STANDING | PRD:384 "How the value orders or filters Discovery is not decided here." Three readings of a nationwide event remain (local tier "covers", default tier "anywhere", penalised unknown). |
| Q3 `UNKNOWN` badge text; `UNKNOWN` in the radius lane | PARTIAL | Badge decided by the PRD (none), diverges from spine; radius lane unstated. |
| Q4 which user location defines "your area" | STANDING | PRD:37 says "the viewer's area" and never defines it (saved location, current location, none; anonymous visitors; a user with no saved location). Users have no country field. |
| Q5 publish, not hold; A14 replaces the old hold | RESOLVED | PRD:375-376 |
| Q6 who sets a curator's audience area; flow; source values | PARTIAL | Moderator yes, subscriber `[ASSUMPTION]` no, PRD:375; source set flagged, PRD:828-829; 4.14 flow and the change record unaddressed. |
| Q7 correcting an event's area or audience country | PARTIAL | Audience country by a moderator, PRD:383. Event area, user corrections, and whether 3.9.1's form (a field for each `EventInfo` field, PRD:167) now includes the derived fields: unaddressed. Editing `location` must re-derive pin trust and area (spine AD-14 Rule 4, AD-39 Rule 7); PRD:370 says precision is "not edited by hand" but 3.9.1 lets a user edit the place. |
| Q8 wrong-country test | RESOLVED | PRD:371 |
| Q9 penalty size and per-page cap | FLAGGED | PRD:376 `[ASSUMPTION]` |
| Q10 clear the 11 curators' stored defaults | FLAGGED | PRD:375 `[ASSUMPTION]`. Round 4: only 3 open curator events carry the account default as their pin, so the visible effect is small. |
| Q11 IDEA-090 scope and badge | PARTIAL | Badge resolved, PRD:201. Cadence, recipients, opt-out, failure display flagged, PRD:200. BUG-069's cause is superseded by BUG-073 (SES sandbox; no Firebase credentials in the sending Lambdas). |
| Q12 audience-area inheritance by group members | OPEN in spine | PRD silent, correctly. |
| Q13 gazetteer source and coverage | FLAGGED | PRD:369 `[ASSUMPTION]` Indonesia first; "for other countries only the country is known" is the PRD's own assumption (the spine says a non-Indonesian country key needs another source). |

Not-adopted items written as requirements: P1 (legs c, d of the pin predicate, PRD:371), P5 (source order, PRD:372), P6 ("posts win", PRD:375). P2, P4, P7, P8 (as mechanism), P9, P11 and P12's guardrails are correctly absent.

## 7. Rationale and examples the structure dropped

1. Where national, international and online events appear. The extract's "default Discovery tier of national events" is the only place those events live in the spine; the PRD has no description of Discovery's location ordering at all, yet PRD:37 relies on "ranks among the local events".
2. Why a curator's audience area is only a proposal (areas varied by run; one real curator; 54 runs, 0 wrong country).
3. Why the widest candidate is taken for an ambiguous name ("Yogyakarta": a wrong guess then lands in the partial lane instead of hiding the event).
4. Roundup-heading guardrails (heading must be verbatim in the post; never widen an item; ignore a place used as a brand).
5. The cost of the wrong-country rule for genuine foreign events, and the Denmark / Egypt exception that keeps BWF pins trusted.
6. The Round 4 finding that removing the curator fallback touches only 3 open events, and that 61 curator and 30 unclassified events have an unknown pin source (the derive job must classify them).

## 8. Gaps ranked by what a UX designer or epic writer would get wrong

1. Whose area is "your area" (Q4, PRD:37, PRD:52). The chip, the strict filter's default, the tier order and the "no exact location" lane all need a viewer area. Without a saved or current location, and for anonymous visitors, the PRD gives no behaviour. Round 4 says location-only ranking needs no history and stays.
2. Audience country has no user-facing effect and Discovery ordering is undecided (Q2, PRD:384). A designer cannot place a nationwide, international or online event, and the PRD never names the platform home country. Pair with the missing description of the local tier versus the default tier.
3. `UNKNOWN` precision (A9, Q3). The PRD and the spine disagree about the badge; the radius lane is unstated; the stub/full independence and the roundup provenance location are missing. Needs an explicit decision.
4. Stale place-model sentences (K3, K9, PRD:300, PRD:296, PRD:654-656) and the correction form (Q7). These still describe full inheritance of `LocationDetails` and text-matched regions, and would reintroduce the removed fallback or a text filter. 3.9.1 needs a line on editing a location (re-derives pin trust and area) and on which new fields users cannot edit.
5. Pin verification (PRD:371). Mark legs (c) and (d) `[ASSUMPTION]`, say 336 is a floor, state the cost to genuine foreign events, and add `confidence`, `matchType`, `countryCode` to 4.3.
6. Curator audience area (A13, Q6). Add the provisional-then-validated behaviour, the legacy-account enrichment, the reliability caveat, an `[ASSUMPTION]` on "posts win", and say whether a moderator edit follows the 4.14 request, notify, revert flow and leaves a change record.
7. Series cover (A7). The cover is chosen by trusted-pin distance, then area closeness, and shows its own Nearby badge; PRD:359 says "best-ranked".
8. Country wording (A17) and the heading inconsistency (A4): see dedup file gap 1; reorder PRD:372 against the spine or tag it.
9. Moderator notifications (PRD:200). Say moderators currently receive no push (a device token and subscription are needed), that the five existing e-mails are untouched, which queue types are listed (the two lists in the sources differ), and that BUG-073 is the prerequisite for both channels.
