# Round 4 production results, read by the cloud session (2026-10-21)

Source: the five read-only queries of `prod-readonly/local-session-brief-2026-10-21.md`, run by the local session on production with the `readonly_2` role, plus the notification findings of the same day (`results/notification-aws-and-owner-sql-findings-2026-10-21.md`). Raw outputs are in `results/*-prod-2026-10-21.txt`. Counts only; nothing here identifies a person.

## 0. The five findings that change something

| # | Finding | Changes |
|---|---|---|
| 1 | **Production has 2 registered users**, neither with push on, both following 10 or more accounts; one has 18 favorites and 1 calendar addition; no new user in 30 days | The offline replay and any A/B on signed-in users are not possible; the implicit interest profile cannot be learned or tested; per-user notification suppression has no audience today. Ask the owner whether this is expected (section 1) |
| 2 | **Stub weight: 0.10, not 0.20.** 114 of the 134 stub pairs are exact repeats the exact-repeat rule handles; the weight only decides the other 20. At 0.20, six pairs with a shared link reach `high` and merge through the matcher, bypassing the exact-repeat preconditions | AD-30 Rule 7: stub signal 0.10 `[PROPOSED]`; the "ceiling 0.60, never high" sentence was wrong when a shared link is present (0.80) and is corrected |
| 3 | **The exact-repeat sizing query over-counted "same place"**: it read the schedule's place text only, and 9 of the 15 largest groups have none. Re-run after the fix | AD-30 Rule 7 figures marked provisional (section 3) |
| 4 | **The push pipeline cannot send today**: the Lambdas that send pushes (Ingestor, AIProcessor) hold no Firebase credentials and no alert address; SES is in the sandbox with no verified identity | New BUG-073; BUG-069 and IDEA-090 gain a prerequisite; the grouped-notification work sits behind it |
| 5 | **Only 3 open curator events lose a pin** to the place model (AD-39 Rule 3), not dozens | BUG-065's open-event effect is small; the derive job still has to classify 61 curator events with an unknown pin source |

## 1. Usage counts (`usage-counts-prod-2026-10-21.txt`)

| Measure | Value |
|---|--:|
| Registered users (not deleted) | 2 |
| New users, last 30 days | 0 |
| Users with a favorite / a calendar addition / a saved location / a subscription | 1 / 1 / 0 / 2 |
| Active favorites (one user) | 18 (13 in the last 28 days, none in the last 7) |
| Users following 10 or more accounts | 2 (push on: 0) |

Reading, and what it does not say. The table holds only people who signed in; Discovery and account pages are public, so anonymous traffic is not in these numbers (PostHog would hold it, IDEA-079). What the numbers do say is that nothing about signed-in behaviour can be measured or learned today: the replay needs many users with a history, an A/B on signed-in users cannot reach any significance, and a favorites-based interest profile would be built from one person. Consequences for the plan, for the owner to confirm:

* Ranking that needs only the **viewer's location** (the area-first order, the audience country) works for anonymous visitors and needs no history: it stays.
* The **implicit interest profile** (`user_interest_profile`, taxonomy chips learned from favorites) and the **A/B on signed-in users** have no population: defer them until there are signed-in users; do not start the taxonomy POC now. Tags as FilterHub facets and the explicit onboarding chips do not need history and can be planned later.
* **Per-user notification suppression** (AD-36 Rule 17.5) stays adopted but has no audience today; it should not be built before push works for anyone (finding 4).

## 2. Stub-weight replay (`recall-replay-stub-weight-prod-2026-10-21.txt`)

Pairs (older event is the candidate, newer is the new item), the matcher's own scoring, weight added only when the newer event is a stub and the places match. Exact repeat here = identical date range and start time on the main schedule, with the place test.

| Weight | Stub pairs low | mid | high | of which exact repeats | Not exact repeats |
|--:|--:|--:|--:|--:|--:|
| 0.00 (today) | 123 | 11 | 0 | 114 (108 low, 6 mid) | 20 |
| 0.10 | 14 | 120 | 0 | 114 | 20 (14 low, 6 mid) |
| 0.20 | 12 | 116 | 6 | 114 (6 high, 108 mid) | 20 (12 low, 8 mid) |

* 114 of 134 stub pairs (85%) are exact repeats. The rule that merges them does not need the weight; the weight decides only the other 20: at 0.10, 6 of them reach `mid`; at 0.20, 8.
* At 0.20 six pairs reach `high` (0.25 + 0.15 + 0.20 shared link + 0.20 = 0.80). All six are exact repeats here, but `high` links through the matcher without the exact-repeat preconditions (no rejection check, no correction check, no country check). A second automatic path is not worth two more pairs. **Recommendation: 0.10**, below `high` for every pair (ceiling 0.70 with a shared link).
* The full-event rows are unchanged by the weight: 5 `high` (4 exact repeats, 1 listed) and 45 `mid` (25 not listed). Those 29 pairs are the sweep's.
* The `mid` stub pairs that are exact repeats should not be inserted into the queue: the sweep merges them. The insert bound applies to the 6 to 8 pairs that remain.

## 3. Exact-repeat sizing (`exact-repeat-sizing-prod-2026-10-21.txt`), first version of the query

| Measure | Value |
|---|--:|
| Groups (same poster, name, place text, date range, start time) | 40 |
| Events / would be soft-deleted | 110 / 70 |
| Groups with no start time on the main schedule | 32 of 40 |
| Groups already ended | 24 |
| Blocked by an exclusion (two events of one post) | 1 group; 69 deletes remain |
| Curator groups (stub 19, full 2) | 21 of 40; 45 of the 70 deletes |
| Lenient pairs: identical range and time / identical range, time differs or missing / ranges differ | 149 / 3 / 30 |

**Defect found while reading it.** The query took the place text from the schedule only. Nine of the fifteen largest groups print an empty place (Allianz Malaysia Super 100 ×11, BWF World Junior ×7, Victor Denmark Open ×5, Denmark Open ×3, and five others, all curator posts), so two events with no place text were counted as "same place". The adopted rule needs `isSamePlace` = same; no place is not that. The query is fixed (the event's text is the fallback, the "Location not specified" placeholder counts as none, and the result splits by `place_known`) and tested on the scratch fixture; it must be re-run. Until then the 40 / 110 / 70 are an upper bound.

Two facts that stand regardless. (1) 32 of the 40 groups have no start time, so for them "same start time" means "both missing"; that is weaker than the rule's wording. (2) The curator no-place groups (the BWF and Denmark Open posts, 26 events) are real repeat posts by eye, and they are exactly the ones the rule as adopted would leave to the queue. Whether a curator stub with an identical name, date range and poster and no place text on either side counts as a repeat is an owner decision, to take after the re-run (open question 1).

## 4. Place fingerprint on open events (`place-fingerprint-open-events-prod-2026-10-21.txt`)

466 open events.

| Account type | account_default | geocoded_from_text | legacy_unknown | Total | With a pin |
|---|--:|--:|--:|--:|--:|
| Curator | 3 | 95 | 61 | 159 | 137 |
| Organizer / venue | 23 | 145 | 36 | 204 | 155 |
| Unclassified | 0 | 73 | 30 | 103 | 88 |

* **Only 3 open curator events carry the account default as their pin.** That is the whole open-event effect of removing the curator fallback (BUG-065); the 2026-10-18 reading ("11 of 17 curators hold a default") described accounts, not open events.
* 61 curator and 30 unclassified events are `legacy_unknown`: a pin with no schedule text, or nothing. Their pin source cannot be told apart; the derive job must classify them, and `legacy_unknown` readers never give them `EXACT` on a non-venue account (AD-39 Rule 7).
* 23 organizer events are `account_default`: they keep a trusted pin only when AD-39 Rule 3's venue conditions hold (confirmed `ORGANIZER_VENUE_EVENT`, local or regional reach, organizer-authored).
* 103 open events (22%) come from unclassified accounts; the legacy bulk update (IDEA-075) decides how many of them become curators.

## 5. Foreign pins and the stated country (`foreign-pins-country-text-prod-2026-10-21.txt`)

432 pins lie outside Indonesia's box.

| Text situation | Pins |
|---|--:|
| Country named in the schedule text | 8 |
| Country named only in the event text | 88 |
| No country named | 336 (78%) |

* AD-14 Rule 4 (e) already says that with no stated country the expected country is `GEOAPIFY_DEFAULT_COUNTRY` (`id`), so the 336 pins would be withheld: consistent with the Round 3 labels (all 42 labelled pins outside the box were wrong), and a map link lost for any genuine foreign event whose text names no country. That is the cost of decision 5 of 2026-10-21, now sized: up to 336 pins.
* Where a country is named, the pin agrees in most cases (Denmark → DK 27, Egypt → EG 13, India → IN 2, France → FR 1, United States → US 5) and disagrees in the rest (Denmark → US 5, Indonesia → US 4, PK 1, IT 1, DE 1, France or Prancis → US 4). Pin-country counts per name are not per pin (a pin can name two countries), so this is a direction, not a rate.
* Caveat: `events.location` can hold the geocoder's formatted address (`transformGeminiResponseToEventInfo` copies it), and Rule 4 (e) excludes such text from naming the expected country. The 88 "event text only" pins may therefore include answers that the narrowed rule would not count. The reliable lower bound of stated-country pins is the 8 in the schedule text; the upper bound is 96.

## 6. Notifications: what the AWS and SQL checks found

(Full detail in `results/notification-aws-and-owner-sql-findings-2026-10-21.md`.)

* SES is in the sandbox, with one identity (a domain) in `FAILED` state, and the configured sender's domain matches none: no e-mail can leave today, including the five moderator mails.
* `notifyNewEvent` runs in the **Ingestor** (and inline in the AI processor). Those two Lambdas hold no `FIREBASE_*` variables and no `SYSTEM_ERROR_ALERT_EMAIL`; the Api Lambda holds them but sends no pushes. From 2026-10-07 to 10-16 the logs show about 40 failed Firebase initialisations a day; from 10-16 every attempt reports "No subscribers with active device tokens", which fits the finding that no user has push on.
* The claim comes before the send and is never retried, so events claimed during the credential outage can never notify (721 of 1,181 recent events are claimed).
* Result sets 1 to 3 of the owner's SQL are still missing (the editor could not take the variable).

Consequences: grouped-event notifications (AD-36 Rules 14 and 17.5) and moderator queue notifications (IDEA-090) both need, first, working credentials in the sending Lambdas, SES production access with a verified sender, and a decision on releasing the claim when initialisation fails. Recommendation for the third: release the claim only when the failure happens **before** any FCM request was made (initialisation), which cannot double-send; keep claim-before-send for every other failure.

## 7. Open questions for the owner

1. **Curator stubs with no place text** and an identical poster, name, date range and start time: repeats (merge) or queue? Take after the re-run of `exact-repeat-sizing.sql`.
2. **Is "2 registered users" expected** for production? It decides whether the signed-in personalization work (interest profile, taxonomy, A/B, replay) is deferred.
3. **Stub weight 0.10** instead of 0.20?
4. **Release the notification claim when Firebase fails to initialise** (recommended)?
