# Adversarial review: PRD amendment of 2026-10-21 (commit ea81cb3)

Reviewer stance: cynical. Read-only except this file. Target: `prd.md` as amended (new Sections 3.18-3.21, interface 4.21; amended 3.1, 3.3, 3.7, 3.9.3, 3.15, 4.1, 4.3-4.5, 4.7, 4.18, KPIs).

Sources used: architecture spine `festgrid-architecture-spine.md` (`S:n` = line n), `event-insight-poc/round-4-analysis-2026-10-21.md` (`R4:n`), the two extracts in this folder (`X1:n` = `source-extract-dedup-grouping.md`, `X2:n` = `source-extract-location-audience-moderator.md`), `.memlog.md` (`ML:n`), PRD line numbers (`PRD:n`) are those of the file as it stands now.

Rule applied: the PRD may state only ADOPTED decisions as requirements; start values and unproven items carry `[ASSUMPTION]`; planned or unshipped behaviour says so.

## Verdict

The amendment is careful in the places it was careful (tags on the gap windows, the 90 s delay, the 7-day window, the audience-country POC caveat, `planned` on the place split and lineup reshape, `Planned; not yet in production` on 4.21). It still fails its own rule in four systematic ways: (1) one word, "country", carries three different facts and the destructive merge guard is worded in the wrong one; (2) most of 3.1, 3.18-3.20 reads as current behaviour although nothing is shipped and Discovery has no ranking to hang "rank", "tier" and "best-ranked" on; (3) PROPOSED/ASSUMPTION parts of the pin-trust predicate and the area-source order are stated as settled fact, with the tag the spine carries dropped (the memlog says they were tagged; they were not); (4) several old sentences were left in place that now contradict the new text. Do not hand this to the epic writer or UX before the Critical and High items are fixed.

## Index

| Severity | Count | IDs |
|---|--:|---|
| Critical | 3 | C-1 to C-3 |
| High | 12 | H-1 to H-12 |
| Medium | 19 | M-1 to M-19 |
| Low | 10 | L-1 to L-10 |

---

## CRITICAL

### C-1. "Country" means three different facts, and the automatic-merge and grouping guards are worded in the wrong one

- **Location.** PRD:343 (3.18 Never Merged Automatically), PRD:357 (3.19 Same Country Only), PRD:371 (3.20 expected country), PRD:380-383 (3.21), PRD:472-480 (4.1).
- **Quotes.**
  - 3.18: "...an event with an applied or pending correction or a pending report; **events aimed at different countries**."
  - 3.19: "**Events aimed at different countries** are never grouped, and an event whose country cannot be settled joins no group."
  - 3.21: "Each event carries the country it is **aimed at**..." and "The audience country is a separate fact from the country an event takes place in (Section 3.19 uses the latter, strictly...). A defaulted audience country never feeds grouping or the check on a pin's country." and "Existing events stay without one until they are derived again; no bulk default is applied."
  - 3.20: "...its country differs from the event's expected country: the single country named in the poster's own location text, or, when the text names none, the platform's default country."
- **Evidence.** The spine has three country facts. (a) The grouping/merge country is where the event happens: `events.country_key`, "NULL when unsettled" (S:2831-2843, S:3174-3196; AD-39 Rule 8 S:3949-3951: "`events.country_key` ... is where the event happens, strict"). (b) The pin check's expected country (AD-14 Rule 4 (e), S:449-483), with its own default. (c) The audience country, a different fact whose storage is "AD-42, to be drafted" (S:3936-3939). The spine's own phrase "events targeted at different countries" (S:2828) is the same trap; the PRD copied it. In the PRD, "aimed at" is the defined meaning of the audience country (3.21), so 3.18 and 3.19 read as "audience country". Three consequences: (1) the one-time sweep runs over existing events that, by 3.21's own last bullet, have no audience country, so a guard worded as audience country cannot be evaluated on the data it protects; (2) 3.21 says the audience country has a default, 3.20 says the pin check has a default, and the spine's `eventCountry()` has a third (S:2836-2837, only when no pin carries a different code), and a reader cannot tell which "default" the 3.21 sentence "never feeds ... the check on a pin's country" forbids; (3) 3.19 "its country cannot be settled" has no referent that a UX designer or epic writer can find in 3.20/3.21.
- **Why Critical.** The guard decides whether a destructive (soft-delete) merge happens and whether a wrong "part of" link hides an event. A wrong reading either blocks every merge (no audience country exists on old events) or lets Allianz Malaysia/BWF Denmark vs Egypt rounds merge or group.
- **Fix.** Add a three-line glossary at the top of 3.20 and use it everywhere: **place country** (where the event happens; settles merge and grouping; NULL = unsettled), **expected country** (pin check only; named-in-text else platform default), **audience country** (who it is for; never used by merge, grouping or the pin check). Replace "aimed at different countries" in 3.18 and 3.19 with "whose place countries are both settled and differ" and add "an event whose place country is unsettled is not merged automatically and joins no group". In 3.21 say once which sentence of 3.19/3.20 each default belongs to.

### C-2. Discovery "rank", "tier", "best-ranked" and "the viewer's area" are used by four requirements; the PRD defines none of them and the spine says the ranked list ships later

- **Location.** PRD:37 (In Your Area), PRD:39 and PRD:376 (FR123), PRD:40 and PRD:359 (FR118), PRD:373 (Ranking may use area closeness), PRD:360 (relevance).
- **Quotes.** "...still **ranks among the local events**..." / "...with **a lower rank and a limit per page**..." / "...as its **best-ranked** matching occurrence..." / "every event **competes on its own relevance**" / "The 'In your area' label marks an event whose area is **the viewer's area** or inside it."
- **Evidence.**
  1. The PRD never defines the Discovery order. A search of the whole PRD finds no sentence defining the Discovery sort; the only "rank/relevance" hits are the vote list (3.13) and the new text. Section 3.12 mandates infinite scroll (PRD:252), so "a limit per page" has no user-visible meaning.
  2. The spine: "Today's `Query.events` orders by the next schedule date with `LIMIT/OFFSET`: it has no score... This Rule ships **after the ranked list** of IDEA-074 / IDEA-076 / IDEA-080 and is not delivered earlier" (S:2990-2993, Rule 13 `[ADOPTED, user-accepted; delivery gate and request switch PROPOSED]`). The collapse (FR118), the unknown-area penalty and cap (FR123) and the area-closeness ranking all need that list.
  3. "The viewer's area" has no source. X2:126 (Q4): "Which user location defines 'your area' (saved location, current location, none...)... Users have no country field." The spine never answers it (grep of "your area" finds only S:3853, 3884, 3886). The Nearby bullet right next to it (PRD:41) is explicit that it "never itself prompts for location access"; the new "In your area" label is silent on whether it may.
  4. The "tiers" the spine relies on (local tier 0 for same/inside/covers/sibling, "default tier of national events" for unknown, S:3857-3861, 3884-3886) are not in the PRD, so "still ranks among the local events" and "lower rank" cannot be tested.
- **Why Critical.** Four requirements cannot be implemented or tested as written, and the analysis recommends exactly these (area-first order, audience country) as the pre-release work that "stays" (R4:27).
- **Fix.** Either add a short "Discovery order" requirement (the default order today; the planned ranked order; local tier = same/inside/covers/sibling; default tier = everything else; unknown-area penalty and cap) marked `planned, gated on the ranked list`, or mark FR118 collapse, FR123 and the area-closeness ranking `planned, not before the ranked list ships (AD-36 Rule 13 gate)` and delete "best-ranked/lower rank" until then. Define "the viewer's area" explicitly as an open decision with `[ASSUMPTION]` (e.g. resolved from a saved location or consented current location only; nothing for anonymous visitors without a location) and say whether the label may trigger a permission prompt.

### C-3. Planned or unshipped behaviour is written as current behaviour in most of the amended text

- **Location.** PRD:37-41 (3.1), PRD:52 (3.3), PRD:103 and PRD:107 (3.7), PRD:301 (3.15), PRD:341 and PRD:344 (3.18), PRD:354-362 (3.19), PRD:369-376 (3.20), PRD:466 (4.1). Only PRD:92, PRD:356, PRD:363 and the 4.21 header say "planned".
- **Quotes and evidence, by item.**
  1. Exact repeats. PRD:341 "If a poster posts the same event twice... FestGrid shows it once." and PRD:103 "...is linked to that existing event **whatever its score**" and PRD:107 "The system also merges events on its own in two cases". The live path is behind `exact_repeat_live`, "default off until the sweep's first capped run has been read" (S:2001-2002); the sweep has not run (X1:18, and Q4 at X1:155 asks exactly whether the PRD may promise this now). The qualification sits only in the last bullet of 3.18 (PRD:345); 3.7 has none, and 3.7 omits the preconditions that 3.18 lists, so "whatever its score" overrides a moderator's "not a duplicate".
  2. Discovery collapse (PRD:40, PRD:359): gated behind the ranked list (see C-2).
  3. Grouped-event notifications (PRD:361) and the per-user suppression: production has 2 registered users, both the owner's, push off; the push pipeline "cannot send" (R4:9, 12, 30; BUG-073); the analysis says per-user suppression "should not be built before push works for anyone". The PRD gives this sequencing only for moderator mail (PRD:200).
  4. The place model (3.20): pin trust, gazetteer, area keys and the precision exposure are all unbuilt; the spine's rollout says "NULL means 'not derived'... otherwise the map link disappears from all 1,460 pinned schedules" (S:507-510). PRD:301 says "Region matching **now** uses the event's area" and PRD:52 says the radius "matches only events with a verified location", both as current.
  5. 4.1 adds `locationPrecision` as a **required** field (PRD:466) with no "planned"/"absent until derived" note, while `audienceCountry` right below is optional "absent on events not yet derived" (PRD:472-475). A required field on an interface production does not serve is the same error in schema form.
  6. Group creation over existing events: the spine's "Deduplication-first is a hard sequencing rule" (S:2730-2739) and the backfill gate (S:3586-3587) are not in the PRD; see M-19.
- **Fix.** Give 3.18, 3.19, 3.20, 3.21 each a one-line "Status" bullet (what ships first, what is switched off, what depends on what: ranked list, BUG-073, the sweep read, the audience POC), and add `(planned)` to the 3.1 bullets, to PRD:103/107/301/52 and to the 4.1 fields. Make `locationPrecision` optional with "absent until derived".

---

## HIGH

### H-1. FR124 states the PROPOSED parts of the pin-trust predicate as fact, drops shipped clauses, and mis-states one consequence

- **Location.** PRD:371.
- **Quote.** "A pin is not verified when the geolocation provider's confidence is below a floor (`[ASSUMPTION]` start value 0.5), **when it disagrees with the area the poster stated**, when it came from an account's default location outside the cases below, or when its country differs... A pin that is not verified **still leaves the event with its area**."
- **Evidence.**
  - The predicate's header: "`[PROPOSED by the 2026-10-19 architect review; the idea of a 'trusted pin' is user-accepted (AD-39), this predicate's shape is not yet]`" (S:424-426). Only leg (e), the wrong-country test, was adopted (S:449-451, "`[ADOPTED, user-directed 2026-10-21 (the wrong-country test itself); ...]`"). Leg (c) "the pin's administrative path intersects [the stated area]" is PROPOSED (S:443-446); its sibling "a stated area and a pin must agree" sits inside the AD-39 Rule 2 block tagged `[ASSUMPTION: derived from the confirmed decisions, not itself confirmed]` (S:3761-3762, 3779-3780). The PRD tags the floor and nothing else. The memlog claims otherwise: ML:78 item (4) "pin confidence floor 0.5 **and the full pin-trust predicate** (PROPOSED in AD-14)" is listed as carried `[ASSUMPTION]`; it is not.
  - Dropped from the PRD: `matchType === 'full_match'` (shipped today and kept by the calibration, S:431-436: without it precision falls 44% to 39%); `PLACE_ID_EXACT` (a place a user picked) bypasses the floor (S:429-431), so a user-picked pin would be unverifiable under the PRD's wording; "a pin with no `countryCode` is untrusted" (S:451-452; 158 pins); "several countries named means no expected country" (S:461-463); text from `account_default` and a geocoder's formatted address never names the expected country (S:456-461); the schedule text first, then the event text (S:452-453).
  - "Still leaves the event with its area" is false whenever the pin was the only area source (spine: a trusted pin "yields area_status = known (keys from its path)", S:3755-3756; an untrusted pin gives nothing). It is also contradicted two bullets later and in 3.19 ("an Indonesian event whose only location is a wrong foreign pin, with no area...", PRD:357).
- **Fix.** Tag legs (a)-(d) `[ASSUMPTION]` (or write only the adopted leg (e) as a requirement and the rest as "a pin must also pass the confidence/match-type test in force today; the new area-agreement test is proposed"). Re-add `full_match`, the user-picked-place exception, and the missing-country-code rule. Replace the last sentence with "An event whose pin is not verified keeps an area only if the poster stated one, a roundup heading names one, or an account fallback supplies one; otherwise it is `UNKNOWN`."

### H-2. The order of area sources is reordered relative to the spine, untagged, and inconsistent with the PRD's own FR123 and "none is inferred from another"

- **Location.** PRD:369, PRD:372, PRD:376.
- **Quotes.** 369: "None is inferred from another." 372: "In order, the first that answers: the area the poster states (**including the area named by a roundup post's heading**...); **the area of a verified pin**; the account fallback below; otherwise unknown." 376: "a nightly automatic job retries to resolve it (**the roundup heading, then the account's area**)".
- **Evidence.** The spine order is stated + gazetteer, then trusted pin, then roundup heading, then account fallback, and it is tagged `[ASSUMPTION: derived from the confirmed decisions, not itself confirmed]` (S:3761-3774); writes are compare-and-set on rank `stated > pin > heading > account` (S:3776-3778). The PRD folds the heading into rank 1, above the pin, which inverts the spine's precedence. The owner confirmed only "roundup heading as a stated area: Yes" (X2:20), not its rank against the pin. Inside the PRD, FR123 (PRD:376) retries the heading as a late step, so the PRD contradicts itself. "None is inferred from another" (adopted, S:3738) sits beside "the area of a verified pin"; the spine reconciles them ("never inferred" = not stored as a function), the PRD does not.
- **Fix.** Restate the order as the spine has it (stated, verified pin, heading, account) and tag the whole sentence `[ASSUMPTION]`; reword bullet 1 to "no fact is stored as a function of another; a verified pin's address may supply the area".

### H-3. "A series needs different places" and "same place, same name = duplicate" contradict the series definition, the roll rule and the spine

- **Location.** PRD:358 vs PRD:351 and PRD:355.
- **Quote.** 358: "**Two events at the same place with the same name are duplicates (Section 3.18); a series needs different places.**" 351: "Series: the same activity at different places **or times**: a weekly run at three venues".
- **Evidence.** A duplicate in 3.18 requires an identical date range and start time. Two events with the same name and place but different dates are therefore neither a 3.18 duplicate nor, by PRD:358, a series, so the "Series Roll" rule (PRD:355, "a new occurrence joins an open series when its first date falls within a gap") has no same-place case, which is exactly the weekly run at one venue. The spine: "Same-name pairs more than two days apart (107 of 446) are **series members, not duplicates**" (S:1954-1956); "same place and a **high score** is the matcher's duplicate, not a series" (S:2946-2948), i.e. only inside the matcher's date window. The "different places" condition belongs to the **cross-account** join only (S:2797-2800, X1:58).
- **Fix.** "Two events with the same name, place, date range and start time are duplicates (Section 3.18). Two events of one account with the same name and place on different dates are occurrences of one series; a series of different accounts additionally needs different places."

### H-4. `EventGroup.memberCount` is documented as the opposite of what the spine says it counts

- **Location.** PRD:1471-1472.
- **Quote.** "The number of active members, **not counting the archive of past occurrences**."
- **Evidence.** S:2709-2710: a group's active members are events with `group_id` set and `deleted_at IS NULL`; "`member_count` counts only those", i.e. past occurrences are included. S:3071-3072: "N = the rows returned (**not `member_count`, which includes the archive**)". X1:99 repeats it. The PRD text would make an implementer exclude past members from the denominator that the notification count is explicitly *not* taken from.
- **Fix.** "The number of members that are not soft-deleted, including past occurrences (the archive). The notification and Discovery counts are taken from the matching or newly claimed events, not from this field."

### H-5. The old "undo window" sentence now contradicts the new reversibility guarantee

- **Location.** PRD:107, PRD:199, PRD:344.
- **Quotes.** 107: "A merge can be undone **within the moderator undo window**." 199: "an undo window matching the existing soft-delete-with-undo pattern." 344: "Every automatic merge ... is visible to moderators and **can be undone**."
- **Evidence.** As built, "the 'undo window' is the UI's 6 s soft-delete-with-undo toast only... `undoEventMerge` has **no server-side expiry**... the accepted behavior" (S:2091-2095; X1:C8). A system merge is by definition not made in front of the moderator, so a reading of 107/199 gives system merges no usable undo, and 3.9.3 (PRD:199) lists them "each with an undo". The amendment edited the very bullet (107) and left the sentence.
- **Fix.** "A merge can be undone from Moderator Items at any time; the six-second toast is only the first chance." Say explicitly that undoing a system merge is permanent for that pair (already in 3.18).

### H-6. The programme example in 3.19 is the one case the spine says is not created automatically; the PRD offers no way to create it

- **Location.** PRD:352, PRD:354, PRD:365.
- **Quotes.** 352: "Programme: ... a mall anniversary with a circus, a line dance and fireworks." 354: "The system creates groups from the events themselves, without a model call". 365: "From 'review group' a moderator can detach a wrongly suggested event, rename the group or dissolve it, and can correct a group's kind."
- **Evidence.** The mall anniversary is SCH "8th Anniversary". "SCH is not one of [the Tier 1 groups]... SCH becomes a programme **only when a moderator creates the group** with its `(keyword, organizer)` seed... its delivery depends on a reachable moderator (IDEA-090) and is a manual step until Tier 3 exists" (S:2632-2639). Tier 2 needs a seeded anchor `[ASSUMPTION]` (S:2623-2631). The PRD's moderator actions have no "create group" or "seed" action, so by the PRD's own text the headline programme example cannot appear.
- **Fix.** State that automatic detection produces programmes only for same-account "Umbrella - Child" titles (measured: 19 groups, 56 events) and that a programme like SCH needs a moderator-created group; add "create a group / set its keyword and organizer" to the moderator actions, tagged `[ASSUMPTION]` until Tier 2/3 is decided; or drop SCH as the example.

### H-7. FR122's venue-account rule depends on an account "reach" attribute that exists only as a POC

- **Location.** PRD:374.
- **Quote.** "...only for a confirmed organizer/venue/event account **of local or regional reach** (a national company's head office is not where its webinar happens)..."
- **Evidence.** The spine names it "the POC's reach guard" (S:3847-3848). There is no reach field in the PRD data model (4.5 has `audienceAreaKeys`, nothing for reach; grep of the PRD finds no such field), nor in the spine. The only source is IDEA-075, status `backlog`, "POC: 18 profiles (5 real, 13 synthetic)... not run on production" (`backlog.yaml` IDEA-075). Without it the condition is either never true (no venue account ever lends a pin) or implementer-defined.
- **Fix.** State that until a reach attribute exists (IDEA-075) venue accounts follow the "every other account" row (area only), and tag the venue row `[ASSUMPTION]`; add the field to 4.5 when decided.

### H-8. FR125 (audience country): "every event" is false at launch, two of its four sources do not exist, the schema is invented ahead of AD-42, and nothing user-visible follows

- **Location.** PRD:380-384, PRD:472-480.
- **Quotes.** "**Every Event Has an Audience Country**"; "(3) the account's own country when it has one; (4) the platform's default country"; "Existing events stay without one until they are derived again"; "How the value orders or filters Discovery is not decided here."; `audienceCountrySource?: 'stated' | 'place' | 'account' | 'default' | 'moderator'`.
- **Evidence.**
  1. Bullet 1 vs bullet 4: the heading is a universal claim; the same section exempts every existing event (466 open events today, R4:67). The spine has the same tension (S:3953-3954) but states it as "Existing events stay empty until re-derived".
  2. "The account's own country": no field. IDEA-075's country is POC only, and "stored fields at implementation, not now" (X2:79). The spine's AD-14 Rule 4 rejects the account default country for pins (S:471-473); the PRD does not say these differ.
  3. "The platform's default country" is never defined in the PRD (X2 7b: "The PRD never states a platform home country"); the spine's value is the env var `GEOAPIFY_DEFAULT_COUNTRY`, default `id` (S:3947-3948).
  4. The spine: "the storage, the extraction contract and the order it feeds are AD-42, to be drafted and proven by the audience POC" (S:3937-3939) and "The POC sequence... comes before any story" (S:3960-3961). The PRD fixes an enum (`stated|place|account|default|moderator`); the spine names only `default` and `moderator`.
  5. With no ordering or filtering effect (PRD:384), FR125 has no testable user-visible behaviour; the only observable effect is a moderator correction, which has no UI described.
- **Fix.** Rename to "Every New Event Carries an Audience Country (planned, gated on the audience POC)"; define the default as the deployment's default country (currently Indonesia, `id`); remove source (3) or tag it `[ASSUMPTION]` pending IDEA-075; tag the `audienceCountrySource` value set `[ASSUMPTION]` (as was done for `audienceAreaSource`); add "no build before the larger labelled test passes" as a gate.

### H-9. The exact-repeat predicate is not testable as written

- **Location.** PRD:341, PRD:343, PRD:344.
- **Quote.** "(same name, same place, same date range and same start time)".
- **Evidence.**
  - Missing start time: 28 of the 38 repeat groups have no start time on the main schedule; "for them 'same start time' means 'both missing'; that is weaker than the rule's wording" (R4:63 point 1; S:2017-2019). The PRD does not say whether two missing start times are "the same". A tester cannot decide the dominant case.
  - "Main schedule": the spine compares "the same date range and start time **on the main schedule**" and requires the schedule match `(start date, end date, start time, place)` (S:1997-1998, 2039-2040). The PRD says nothing about events with several schedules.
  - "Same place" is `isSamePlace` = `same`; "no place is not that" (R4:61: revision 1 counted missing places as the same place, 40/110/70 vs 38/107/69 after the fix; S:2022-2028: the one group with no place stays in the queue). The PRD does not say a missing place is not "the same place".
  - "Same poster" is undefined (see M-5: "poster" also means the image) and the spine itself leaves "same poster" versus "organizer" open (X1:157, Q6); co-authors and the scraping-source account (PRD:122, 4.7a) make "the same poster" ambiguous.
  - The surviving event is not stated for the sweep. The spine's winner order is an organizer-authored primary, then more complete schedules, then earlier `created_at`, then lower id (S:1958-1960), where the "more complete schedules" step is the spine's own `[ASSUMPTION]` (S:1860-1861; PRD:104 repeats it untagged, see L-1). For a curator group of 11 identical posts a designer must know which URL survives.
- **Fix.** Define the predicate in four bullets: same publishing account; same normalized name; place equal by the place test (a missing place is never equal); identical start date, end date and start time on the main schedule, with two missing start times equal `[ASSUMPTION]` (or not equal, owner to decide); survivor order as in the spine, tagged where the spine tags it.

### H-10. The "UNKNOWN has no badge" rule contradicts an adopted exposure rule and decides an open question without a tag; "instead of" misleads the card design

- **Location.** PRD:37, PRD:370, PRD:468-470.
- **Quotes.** 37: "...shows an area badge with the area's name **instead of implying a precise spot**; an event with no known area is not labelled." 370: "`UNKNOWN`: no area label."
- **Evidence.** AD-39 Rule 6 `[ADOPTED]`: "The list card shows an area badge **whenever precision is not `EXACT`**" (S:3898-3899). X2:125 (Q3, open, "blocks a requirement"): "What does the card badge say for `UNKNOWN` precision (no area label exists)?" The PRD resolves it by decree. "Instead of implying a precise spot" reads as replacing the venue text; the spine adds a badge, it does not remove the poster's stated venue name, and an event whose poster stated a venue but whose pin failed verification is `AREA` with the venue text still known.
- **Fix.** Say "an area badge is shown whenever the location is not exact; for `UNKNOWN` the badge text is `[ASSUMPTION]` 'location not specified' / not shown, decided at UX". Replace "instead of" with "in addition to the location text the poster gave".

### H-11. The Nearby threshold in an amended bullet (5 km) contradicts the spine and the design source (8 km)

- **Location.** PRD:41 (the bullet was rewritten by this amendment).
- **Quote.** "a card for an event **within 5km** of the viewer's current position shows a 'Nearby' badge."
- **Evidence.** AD-22: "`<8km` is the one sanctioned nearby-badge gate (DESIGN.md's corrected value, **replacing the shipped `<=5km` bug**); no consumer may hardcode or re-derive its own threshold" (S:1278-1280, S:1295-1297); `EVENT-CARD-DESIGN.md:213` "GATED AT <8KM (revised 2026-09-14, user-directed)". The PRD text dates from 2026-09-04. X2 K5 flagged it; the memlog does not list it.
- **Fix.** Replace "within 5km" with "within the Nearby distance (currently 8 km, AD-22)" or change the number; whichever is the owner's, the two documents must agree.

### H-12. FR119 notification text omits adopted eligibility, over-promises timing, and blurs "promoted individually" with "batched per post"

- **Location.** PRD:361, PRD:100, PRD:106.
- **Quote.** "One notification is sent per group and source post, **shortly after ingestion** (a short delay plus up to one processing cycle; `[ASSUMPTION]` start value 90 seconds)... A user who **follows several accounts** that post the same series is not notified about it more than once within 7 days... **never to programmes, whose events are promoted individually**."
- **Evidence.**
  - Eligibility is per event: "a roundup or curator-sourced stub never gets `notify_due_at` and is never stamped, so its one future notification... is not consumed" (S:3075-3079). 3.19 never says it, so a reader applies the group rule to stubs; curator posts are 34% of open events (R4:71).
  - Timing: "the due time plus up to one drain cycle (about 6 minutes in production)... a lower bound, not a promise" (S:3072-3074). "Shortly" plus a 90 s figure that is only the *due delay* will be read as 90 s; "one processing cycle" is not quantified.
  - The 7-day rule is per `(user, group)`, not per number of followed accounts (S:3240-3257, 3258-3269); a single account posting two members of one series within 7 days is also suppressed. The PRD wording ("follows several accounts") invites a test plan that skips that case. The stated consequences (a user who subscribes to a second mall after the first claim is not told; a new season is a new group, so it notifies again; a failed push may be recorded as sent) are not carried.
  - "Programmes... events are promoted individually" is true for Discovery and ranking; notifications for a programme are still one per `(group, post)` counting its events. As worded, a UX writer will specify one push per programme event.
  - Sequencing: no audience until BUG-073 is fixed (see C-3 item 3).
- **Fix.** Add eligibility; say "the exact delay is the due time plus the next scheduled run (about 6 minutes today), not a guarantee"; reword the suppression as "per user and group, series only, 7 days since the last push for that group"; add the three consequences; clarify that programmes are batched per post but not suppressed across posts; mark the whole bullet `depends on BUG-073`.

---

## MEDIUM

### M-1. "Likely matches are queued ... as before" conflicts with the sweep's own insert bound
- **Location.** PRD:342. **Quote.** "'likely' ('mid') matches are queued for a moderator as before".
- **Evidence.** The sweep inserts at most `max(0, 50 - pending)` mid candidates (start value `[ASSUMPTION]`, S:1949-1951), which "would insert nothing today" with 147 pending (S:2050-2052); the fix is `[PROPOSED; corrected by review R4]` (S:2053-2059). R4:45 applies the bound to "the 6 to 8 pairs that remain". As written, the PRD promises a queue entry the architecture does not yet make.
- **Fix.** "...mid matches are queued, subject to a bound on how many are added (`[ASSUMPTION]` start value 50 pending)". State that this stays inert until moderators are notified (FR126).

### M-2. "A programme is never ... capped" ignores the adopted optional soft cap
- **Location.** PRD:359, PRD:1465-1466 (4.21). **Quote.** "A programme is never collapsed and never capped".
- **Evidence.** S:3008-3011 `[ADOPTED, user-directed 2026-10-20]`: members beyond `k` take a rank penalty behind a flag, off by default; `k` and the penalty are `[ASSUMPTION]`. X1:A27.
- **Fix.** "...never collapsed; no cap by default (an optional rank penalty for members beyond `k`, off by default, `[ASSUMPTION]`)".

### M-3. The curator-area validation paragraph states a PROPOSED table and drops its assumptions
- **Location.** PRD:375. **Quotes.** "the narrowest area that contains **most of the first posts**"; "**When they disagree the posts win**; when neither yields an area it stays unresolved."
- **Evidence.** The header is `[ADOPTED... a model guess, validated by the account's first posts, never Geoapify; **the table is PROPOSED**]` (S:3795-3796). "Most of the first posts" is `M` of the first `N`, start values 5 and 3 `[ASSUMPTION]` (S:3803-3804); an ambiguous place name takes the widest candidate `[ASSUMPTION]` (S:3798). The "posts win" row and the provisional-P row are table rows.
- **Fix.** Tag "posts win", the N/M thresholds and the ambiguous-name rule `[ASSUMPTION]`, or write only the adopted skeleton (model guess, validated by the first posts, never from the geocoder).

### M-4. "Start value 20" has no tag, and the two supervision gates are blurred
- **Location.** PRD:344-345. **Quote.** "the first live run is limited to a small number of groups (**start value 20**) and reported before the limit is lifted... off until the first sweep's result has been reviewed by the owner."
- **Evidence.** ML:78 item (3) lists "first live sweep limit 20 groups" as `[ASSUMPTION]`; the PRD sentence carries no tag. The spine has two reads: "the owner reads the dry-run list before the cap is lifted" (S:2031-2032) and the live switch stays off "until the sweep's first capped run has been read" (S:2001-2002); the cap's content is "the largest, a random sample, and every cluster whose place texts differ" (S:2042-2044), so it can exceed 20 by construction.
- **Fix.** Tag it; say "dry run read by the owner before the first capped live run; first capped run read before the cap is lifted and before the live check is switched on".

### M-5. Overloaded words invite misreads (poster, groups, FestGrid, programme)
- **Evidence.** "poster" is the image in PRD:60-62 and the author in PRD:341, 369-372. "groups" means clusters of duplicates in 3.18 (PRD:344 "limited to a small number of groups") and `EventGroup` in 3.19 (PRD:364 "a daily limit caps the groups created"; KPI PRD:1844 "groups created per day"); the analysis itself says "38 groups, 107 events" for repeats (R4:11). "FestGrid" appears once (PRD:341); the product is FestDaily everywhere else. "programme" (group kind) vs `program-lineup` (a `groupingReason`, PRD:94, 363, 4.7) are different things spelled almost alike.
- **Fix.** Use "posting account" for the author, "poster image" for the image, "duplicate cluster" for 3.18, keep "group" for 3.19, FestDaily throughout, and add one sentence separating programme groups from program-lineup posts.

### M-6. What "same promo name" means is undefined, and 3.1 and 3.19 disagree on when a series collapses
- **Location.** PRD:40 vs PRD:359, PRD:356. **Quotes.** 40: "A repeated activity... appears once in the default Discovery list as its best-ranked matching occurrence". 359: "It collapses **only where the occurrences carry the same promo name**; occurrences linked more loosely show on their own". 356: "when the promo name is **near-identical**".
- **Evidence.** The spine's rule is equality of a per-event canonical key for collapse and a weighted score at least 0.85 `[ASSUMPTION]` for the link-only join (S:2800-2803, 2865-2896); the key function is `[PROPOSED]`. 3.1 states the unconditional version. A tester has no way to tell "same" from "near-identical".
- **Fix.** Define both: collapse = equal after normalizing case, accents, punctuation and a trailing place `[ASSUMPTION]`; join = near-identical with a threshold `[ASSUMPTION]`. Make 3.1 say "where the occurrences share the promo name".

### M-7. Lane, tier and national-event semantics left open or mis-stated
- **Location.** PRD:38, PRD:52, PRD:373. **Quotes.** "shown separately as closest matches"; "appear in a separate lane labelled 'no exact location'".
- **Evidence.** The spine delivers the partial lane "as `matchLane: STRICT | PARTIAL` ordering in the **same** query so the AD-36 Rule 13 collapse sees both" (S:3879-3881); "shown separately" reads as a second list. Which `AREA` events enter the radius lane for a saved location (all of them? those whose area contains the saved point?) is not stated, and the spine does not say either (X2:125-127). `sibling` events (neighbouring regency) stay in the local tier but are not labelled (S:3884-3886): PRD:37 mentions only the wider-area case. Whether a country-only area is a legal known area, and where a national or online event sorts, is open (X2:124 Q2, X2:82 (b)); PRD:369 lists "country" as an area level and PRD:381 says online events with no audience are `international`, so a literal reading puts every national event in the viewer's local tier with an area badge "Indonesia". With infinite scroll (PRD:252) "a limit per page" is undefined.
- **Fix.** Say the partial results follow the strict ones in the same list under a label; define the radius-lane entry rule `[ASSUMPTION]`; add `sibling`; add a visible open question for national/online events and for the page cap under infinite scroll.

### M-8. Old 3.15 / 4.3 / 4.17 text still describes the superseded admin-area text match; saved filters and the prompt-to-key step are not covered
- **Location.** PRD:296, PRD:298, PRD:300, PRD:1611, PRD:1617-1627, PRD:641-650; `spec-ai-prompt-event-filter/filter-vocabulary.md:14`.
- **Quotes.** PRD:296 "admin-area/region text match"; PRD:300 "alongside the new admin-area field"; PRD:1611 "region mode (new admin-area text match, Section 3.15)".
- **Evidence.** Only the "Known Limitation" bullet (PRD:301) and the two interface comments were amended. A prompt such as "in Sleman" must now become a gazetteer key (`areaKey`); nothing says who resolves the text, what happens for places the Indonesia-only gazetteer lacks (they are `unresolved`, S:3483-3484), or what happens to saved AI filters and widgets that carry the old `location.adminArea` text. PRD:298 "nothing is migrated or re-extracted" was written for the boolean upgrade but now reads as covering this change. Boolean expressions with the partial lane (`OR`, `NOT` over an area leaf) are not defined; `NOT` is "null-inclusive" (PRD:298), so `NOT area=Sleman` would keep unknown-area events while PRD:373 says unknown never matches.
- **Fix.** Update the three stale phrases; add a short "Region leaf" rule (text to key step via the gazetteer, caveat when unresolved, saved filters with text are re-resolved or ignored with a caveat, partial lane only for a top-level AND leaf).

### M-9. The correction form and derived fields
- **Location.** PRD:167, PRD:466 ("Derived, never edited by hand"), PRD:383.
- **Evidence.** PRD:167 gives users "a form with typed inputs for each field of the `EventInfo` and `Schedule` interfaces"; the new fields are all derived. The spine says a correction that edits `location` "re-derives the schedules' `pin_trust`" (S:525-527) and is a writer (S:3903-3910). The PRD says only that a moderator can correct the audience country (PRD:383) and a moderator can set a curator's area. Whether a user can correct the area or fix a wrong "withheld" pin is not stated (X2 Q7).
- **Fix.** List the fields the form excludes (`locationPrecision`, `areaLabel`, `pinTrust`, `group`) and say that editing the location text re-derives pin trust and area.

### M-10. The "Default Location" control for curator accounts is left as before
- **Location.** PRD:84, PRD:85, PRD:331. **Quote.** "Any subscriber may set it if unset."
- **Evidence.** After the amendment a curator's default location is never used (PRD:83, 86, 374). The subscribe-time control, the moderator notification on each change (PRD:85) and the claim text (PRD:331) are unchanged, so the UI offers an editable field with no effect. `[ASSUMPTION]` "existing curators' stored default locations are cleared" (PRD:375) is a silent system write that bypasses the `PENDING_REVIEW` flow (4.14).
- **Fix.** State whether the field is hidden or disabled for curator accounts, and that the one-time clear writes no change request.

### M-11. 4.3 lacks the fields FR124 reads; 4.1 has a required derived field
- **Location.** PRD:601-662 (4.3), PRD:466.
- **Evidence.** FR124 depends on "the geolocation provider's confidence" and the pin's "country"; `LocationDetails` has no `confidence`, `matchType`, `countryCode` (grep) although AD-14 Rule 1 says the mappers already populate them (S:368-373; X2 7b). The `venueType` comment (PRD:654-656) still says it is inherited "along with the rest of `LocationDetails`" whenever a schedule inherits the default, which now holds only for a qualifying venue account.
- **Fix.** Add the three fields (optional); correct the `venueType` comment.

### M-12. 4.21 states PROPOSED shape as fact and sits under the wrong heading
- **Location.** PRD:1450-1476.
- **Evidence.** `placeCount` and `concurrent` ("also at N other places") are `[PROPOSED]` (S:2774-2781; X1 P8). The interface sits under "**Distribution & Filtering**" (PRD:1450), before 4.16 Widget, although it belongs with "Core Event Data" or "Moderation". (The surrounding numbering is already out of order: 4.20, 4.21, 4.16; not new.) The interface has no `country` (the spine's one-country invariant, S:3174-3182) and no dormant state.
- **Fix.** Tag `placeCount`/`concurrent` `[ASSUMPTION]`; move 4.21 under "Core Event Data".

### M-13. KPIs cover dedup and grouping only, and have no baseline or target
- **Location.** PRD:1844.
- **Evidence.** FR121-FR125 add no measure. The spine lists `pin_trust` distribution, splits, cap hits, groups created, kill-switch state, notification claims and failures (S:3676-3678). The one rule that visibly removes content (the 336+ withheld pins, H-1 and M-14) has no counter. "FR116-FR119" omits FR120. With two users and no released app (R4:9) the undo-share and review metrics have no population; the PRD does not say so.
- **Fix.** Add: share of events by precision; pins withheld by the country rule; unknown-area share and the share of them resolved by the nightly job; audience-country coverage; and note that targets come after launch.

### M-14. The 336 of 432 sentence mislabels its denominator, its comparison and its direction
- **Location.** PRD:371. **Quote.** "On production data 336 of 432 pins **outside Indonesia** name no country in their text and would be withheld, as **all 42 pins labelled by hand were wrong**."
- **Evidence.** R4:82 "432 pins lie outside Indonesia's **box**" (a box, not the country: "Sandakan, Malaysia lies inside the box", S:474). "All 42 labelled pins outside the box are wrong" (S:475-476) is a subset of 87 hand-labelled pins, 15 of which are correct (S:431-433); "all 42 pins labelled by hand" reads as the whole labelled set. 336 is the "no country named" bucket; the pins with a named country that the pin contradicts (R4:91: Denmark to US 5, Indonesia to US 4, ...) are withheld too, and R4:92 says the 88 "event text only" pins may not count under the narrowed rule, so the true figure is at least 336 and could reach about 424. R4:90 ("up to 336 pins") and R4:92 disagree with each other. The cost the spine names, "a map link lost for any genuine foreign event whose text names no country" (R4:90, S:481-483), is missing.
- **Fix.** "At least 336 of the 432 pins outside Indonesia's bounding box (on 2026-10-21) name no country in their text and would be withheld; every one of the 42 hand-labelled out-of-box pins was wrong. The cost is a missing map link for genuine foreign events that do not name their country." Date the figure.

### M-15. Production snapshots are embedded in requirement text and will rot
- **Location.** PRD:200 ("today only five event types are e-mailed... neither channel can send"), PRD:342 and PRD:376 ("0 of 147"), PRD:371, PRD:374 ("12 posts"), PRD:384 (34%, 22%).
- **Evidence.** Each is dated in the sources (147: 2026-10-19; the rest 2026-10-21) but undated in the PRD; two of them (the 147 queue, "neither channel can send") will be false the day BUG-073 or the queue changes.
- **Fix.** Date each figure or move it to a rationale note ("when this was decided").

### M-16. Scope of the Discovery collapse and the card/detail treatment of `AREA` events are not stated
- **Evidence.** The spine sets `groupCollapse` only on the Discovery document (S:2995-2997); the PRD says the calendar, favorites, feed and account pages list every event (PRD:359) but is silent on the Widget (3.14), saved AI filters loaded into Discovery, the Archive and the post collection page. The roundup provenance stays on the detail page (S:3899-3900); the detail page's place line for `AREA`/`UNKNOWN` events, and the `'Location not specified'` placeholder that remains in `events.location` (S:3867-3868), are not described.
- **Fix.** List the surfaces that collapse (Discovery only) and add one bullet for the detail page.

### M-17. Curator and roundup stubs in groups: silent, and 34% of events are curator events
- **Evidence.** "A roundup or curator-sourced stub neither creates nor joins a series until it is promoted" (S:2956-2958; `[PROPOSED]` via the organizer-key bullet); "BWF, RSIH, Denmark Open and AKMU are curator-only today and cannot form a series until promoted" (S:2815-2818). PRD 3.18 treats curator stubs as in scope for dedup (39 of 69 deletes are curator stubs, S:2019-2020) and 3.19 never limits eligibility, so a reader assumes curator content groups.
- **Fix.** State the eligibility as `[ASSUMPTION]` or as an open question.

### M-18. The moderator digest, the badge and the Moderator Items list name three different sets of queue items
- **Location.** PRD:199, PRD:200, PRD:201.
- **Evidence.** Digest (PRD:200): suggested matches, corrections, reports, group suggestions, curators without an audience area. Badge (PRD:201): reports, Default Location changes, suggested matches, account-type classifications, then (new) group suggestions, "corrections", curators without an audience area. List (PRD:199): Default Location changes, matches, account-type reviews, group review, curators without area, automatic merges. The digest omits Default Location changes and account-type reviews; "corrections" are new to the badge and the badge sentence cites "these queues" without naming them. The spine's decision is untagged (X2 9b: "IDEA-090 'Decided direction'", and BUG-069 says moderators are never sent push by design); the badge counting group items appears only in `backlog.yaml` IDEA-090 ("group suggestions count in the pending badge (2026-10-21)"), while X2:133 lists it as open (Q11).
- **Fix.** One list of queue-item types, used by the digest, the badge and the page; tag the "push to moderators" and the badge extension `[ASSUMPTION]` until the spine or owner records them.

### M-19. The dedup-first rule and the backfill are mis-promised
- **Location.** PRD:363. **Quote.** "existing upcoming events are planned to be re-extracted the same way (past events are left as they are)."
- **Evidence.** The spine's backfill key is `[ADOPTED, user-directed]`: "Re-extraction uses contributors' keys only, and only those of contributors who subscribe to the account that posted it... a post whose account has no subscriber with a usable key is not re-extracted... its event stays unsplit" (S:3604-3613). The sizing is "about ten events" `[PROPOSED]` (S:3624-3633), of which six need the owner to supply the partition, not a re-extraction (S:3641-3643). Production has two users (R4:9). "Deduplication-first is a hard sequencing rule... grouping must not run over the existing backlog" (S:2730-2739) is absent. The PRD therefore promises a backfill of "existing upcoming events" and by omission lets group creation run over the backlog.
- **Fix.** "Existing events are split only where the place is already in their schedules, plus a few events handled by hand; events whose account has no subscriber key stay unsplit. Existing events are not grouped until the duplicate sweep has been read (`[ASSUMPTION]` 80% gate)."

---

## LOW

- **L-1. Primary-post clause (2) is stated as fact; the spine tags it `[ASSUMPTION]`** (PRD:104 "(2) the post whose extraction gave more schedules with a complete date and location"; S:1860-1861; ML:78 item (10) knows and left it). It is now load-bearing for the exact-repeat survivor (H-9). Tag it.
- **L-2. "Moderators are notified of suggestions" (PRD:354) is stated as fact with no carrier.** Only Tier 2/3 suggestions notify (S:2644-2647; Tier 1 is `[ASSUMPTION]`), the deterministic series and place-split detectors have no notification, and the carrier does not exist (BUG-069). The Safety Net bullet (PRD:364) asserts "can be switched off ... a daily limit caps" and only afterwards tags them as "proposed mechanisms"; tag in the same clause.
- **L-3. FR numbering.** "Review group" has two ids (FR117-FR120 in 3.19, FR126 in 3.9.3); the KPI is "FR116-FR119" (PRD:1844) and omits FR120; no FR register exists, so the ids cannot be traced (no other file cites FR116-FR126).
- **L-4. "A stated place always wins over any fallback" (PRD:374)** is not true when the stated text does not resolve ("usable" means resolves to a key or a trusted pin, S:3858-3860), in which case a curator's audience area applies and can label a Bali event as Yogyakarta. State the rule for unresolved stated text.
- **L-5. NFR.** Section 5 still says `Query.events` "must be held to a stricter budget" without a number (PRD:1760); the new windowing, lanes and caps are exactly the cost the spine gates with an EXPLAIN check and `K <= 3,000` (S:3040-3048).
- **L-6. First-Organizer-Post** (PRD:106): "keeps its one future notification **until then**" - until what? Say "until it first gains an organizer-authored primary post".
- **L-7. Location Data Reuse Boundary** (PRD:1792) allows a viewer's location only "as a per-viewer, non-persisted ranking weight"; the new "In your area" label and the area filter use it as a label and a filter. Reword the boundary or the labels.
- **L-8. "Near-identical" (PRD:356)** is the PRD's stand-in for the 0.85 weighted-score bar `[ASSUMPTION]` (S:2896); tag it. The hashtag sentence is correctly marked planned.
- **L-9. Favorites (PRD:362).** "When one event is split... every user's favorite is copied" is true only after the split ships (unmarked); "Where favorites count as a ranking signal" refers to a signal that does not exist in the PRD.
- **L-10. Timezone inference** (PRD:138) still says "the event's location" feeds it. Under the new model only a verified pin should, and an `AREA`/`UNKNOWN` event falls through to the subscriber's timezone; known and unresolved (ML:78 item 11), but the amendment adds many more such events (curators no longer lend a location).

---

## Number check (item 4)

| PRD value | Where | Source | Verdict |
|---|---|---|---|
| 336 of 432 pins | PRD:371 | R4:82-88 (336 = 78% no country named of 432 outside the box) | Numbers match; denominator mislabelled, 336 is a floor, cost omitted (M-14) |
| 42 labelled pins all wrong | PRD:371 | S:475-476 (42 of the 87 labelled, outside the box) | Reads as the whole labelled set (M-14) |
| 147 queued matches, 0 resolved | PRD:342, 376 | S:1950, 2656, 3828 (2026-10-19); not in R4 | Matches the spine; undated (M-15) |
| 34% curator, 22% never classified | PRD:384 | R4:71-75 (159 and 103 of 466) | Matches |
| Gap 120 / 30 days | PRD:355 | S:2973-2976 | Matches; tagged |
| Suppression window 7 days | PRD:361 | S:3263-3264 | Matches; tagged; wording narrower than rule (H-12) |
| Due delay 90 s | PRD:361 | S:3064 | Matches; tagged; user delay is up to about 6 min (H-12) |
| Live-run limit 20 | PRD:344 | S:2042-2044 (20 clusters) | Matches; **untagged**; "groups" collides (M-4, M-5) |
| Pin floor 0.5 | PRD:371 | S:431-434 (PROPOSED) | Tagged; `full_match` dropped (H-1) |
| Nearby 5 km | PRD:41 | S:1278, 1295 (8 km) | **Mismatch** (H-11) |
| Curator picked 12 places in 12 posts | PRD:374 | S:3789-3790 | Matches |
| 5 moderator e-mail types | PRD:200 | X2:99, S:3318-3320 | Matches; time-bound fact (M-15) |
| 38 groups / 107 events / 69 deletes; 3 open curator events lose a pin; stub weight 0.10 | not in the PRD | R4:11, 13, 10 | Not stated; fine. The PRD does not contradict them |

## Tag audit (item 1)

| PRD item | Spine tag | PRD tag | Result |
|---|---|---|---|
| Gap windows, due delay, suppression window | ADOPTED values stay start values | `[ASSUMPTION]` | OK (conservative) |
| Exact-repeat live-run limit 20 | ADOPTED paragraph, a cap | none | **Missing** (M-4) |
| Pin predicate legs (a)-(d), `full_match`, agreement with stated area | PROPOSED / ASSUMPTION | floor only | **Missing / dropped** (H-1) |
| Area-source order and compare-and-set rank | ASSUMPTION (S:3761-3762) | none, and reordered | **Missing, altered** (H-2) |
| Curator P/Q table, N and M, widest candidate | PROPOSED / ASSUMPTION | none | **Missing** (M-3) |
| `placeCount`, `concurrent`, "also at N other places" | PROPOSED | none | **Missing** (M-12) |
| Primary-post clause (2) | ASSUMPTION | none (unchanged) | **Missing**, pre-existing (L-1) |
| UNKNOWN has no label | open (X2 Q3) | none | **Decided without tag** (H-10) |
| Venue-account "reach" | POC only | none | **Unbuilt attribute** (H-7) |
| Audience-country sources, enum | AD-42 undrafted | partly `[ASSUMPTION]` | **Over-specified** (H-8) |
| Group items in the badge, moderator push | untagged direction | none | **Missing** (M-18) |
| Mid-match queue "as before" | ASSUMPTION bound, PROPOSED fix | none | **Missing** (M-1) |
| Cross-poster rule, subscriber cannot set area, clearing curator defaults, digest details, gazetteer coverage, switch and limit, audience-country POC | PROPOSED / ASSUMPTION | `[ASSUMPTION]` | OK |

## Cross-references checked (item 3)

- Section numbers 3.18-3.21, 3.7, 3.9.3, 3.15, 3.16, 4.18, 4.21 and the interface names `EventGroup`, `EventInfo.group`, `LocationFilter.areaKey`, `Schedule.pinTrust`, `SocialMediaAccountProfile.audienceAreaKeys` all resolve. FR116-FR126 are internally consistent with the section headers (FR126 appears only in 3.9.3; see L-3).
- "(Section 3.19 uses the latter, strictly...)" (PRD:382) points to text that never says "place country" (C-1).
- PRD:41 and PRD:52 point to Section 3.20 for the exact meaning; 3.20 does not define the lane or the radius rule precisely (M-7).
- 4.21 is out of numeric order, as 4.20 and 4.14 already were (see M-12 for its placement).

## Not wrong, for the record

Same-country-only with its accepted cost; per-member collapse and the hashtag "link never collapses" rule (planned, switched off); "a group appears when at least one member matches" and "cover may differ with and without a filter"; favorites per event, series counts distinct users; undo records "not a duplicate"; unknown area published, not held; curator scraped whatever its area; group-page text and the separation from Related Events; the `planned` markers on the place split and lineup reshape.
