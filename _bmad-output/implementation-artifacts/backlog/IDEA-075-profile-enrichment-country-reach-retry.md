---
backlog_id: IDEA-075
title: "Profile enrichment: country, reach and default time zone from the initial profile scrape, with retry"
captured: 2026-10-18
---

# IDEA-075 — one profile read, four answers, and a retry

**Captured:** 2026-10-18 (revised twice the same day) · **Status:** POC done — 18 profiles, partly synthetic — no product code. Code: `apps/backend/scripts/poc-event-insight/` — `country-signals.ts`, `timezone-signals.ts`, `profile-insight.ts`, `run-profile-insight.ts`, `profile-retry.ts`. Results: `planning-artifacts/event-insight-poc/results/profile-insight-v1.generated.md` (country + reach, 16 profiles), `profile-insight-v2-rescored.generated.md` (+ time zone, 18 profiles; `profile-insight-v2.generated.md` is the same run before one guard fix, kept on purpose).

## Why

* BUG-066 mechanism 1: the first geocode of an account has **no country** to filter or bias with.
* BUG-065: whether an organizer's account location may stand in for an event's missing place depends on **how far the organizer reaches** — a local government's Zoom briefing is for its residents; a national company's webinar is for everyone and its head-office city is not an audience.
* BUG-065 also removes a curator's account location, and with it the **time-zone tier** that location silently provided (see "Default time zone"). An account needs its own default zone.
* All three can be read from the profile scrape Story 3.4n already pays for at subscribe time.

## What the code does today (read, not run)

| fact | where |
|---|---|
| the subscribe-time scrape is Apify `instagram-profile-scraper`, $0.0026 per profile in the 3.4n smoke test | `3-4n-…md`, `apify-runs/run-BIbGhsAYIVlbRe9JQ.infoeventjogja.md` |
| its payload carries biography, full name, business category, `isBusinessAccount`, external link and the **latest 12 posts** (captions, hashtags, sometimes `locationName`) | the same run files |
| `getAccountClassificationProfile` keeps **4 of those fields** (bio, username, name, category); the rest is dropped and **the bio is stored nowhere** (`description` is never populated) | `classify-account-type.ts`, 3.4n Dev Notes |
| **any** failure of that call — timeout, 429, capacity, Gemini outage, unparsable answer — becomes `AWAITING_APPROVAL` plus a review row; nothing retries it, because `subscribeToAccount` only classifies a profile whose status is null | `classify-account-type.ts` `handleHardFailure`, `subscribe-to-account.ts` |
| the other two profile-scraper actors tried in 3.4n were rate-limited or returned empty results | 3.4n Dev Notes, `apify-runs/` |
| an account with no default location gets an inference attempt after **every** post (an implicit retry — for location only) | `process-ai-job.ts` step 8.5 |
| a schedule's time zone resolves in four tiers: its own geocoded venue → **the source account's timezone (= its default location's)** → the one subscriber's `users.timezone` (only when there is exactly one) → `NEEDS_CLARIFICATION` (moderators only) | `resolve-schedule-timezones.ts` |
| `users` has a `timezone` column; it has **no country** column. A user's country exists only as the `countryCode` inside `user_locations.location_details` | `packages/database/schema.ts` |

## Legacy accounts: a bulk update, not a backfill (decision taken 2026-10-18: yes)

The product owner states that the never-classified accounts **that have no location are all Indonesian curators**, so no profile re-read is spent on them: one transaction sets them to `CURATOR_GUIDE`/`CONFIRMED`. **Never-classified accounts that already have a location are not changed.**

The runbook is in `IDEA-075-legacy-bulk-update/` — `01-look.sql` (read-only; read the list first), `02-apply.sql` (one all-or-nothing transaction with a snapshot table, a row ceiling and a changed-in-between check), `03-rollback.sql`, `04-after.sql` — with a README. It was **tested on a scratch PostgreSQL 16 built from the repository's 80 migrations** with seeded accounts: happy path, refused second run, rollback, and the three abort paths. **It has not been run on production data**, and that the set is all curators is the product owner's statement, not something I could check.

What it changes for those accounts (from the code, not observed): scraping no; future captions cleared after extraction and images not re-hosted (3.4o); future events ingested as `stub` and no longer organizer-authored for the primary-post choice and the first-organizer notification — until now a null-typed curator counted as an organizer. I did not check how the UI renders a stub event. Captions already stored **stay**: deleting them is a separate decision (it would also remove the ability to re-extract those posts) and nobody asked for it. FIND-086 is resolved for this group.

**Left as they are, by decision:** never-classified accounts with a location keep today's behaviour, including lending their location (`mayUseAccountLocation(null, null)` is true). A curator among them would still carry an arbitrary stored location and still escape the minimization; `04-after.sql` lists the ones whose events are scattered over five or more cities, the shape a curator has. Once the `country_code` column of this idea exists, the same migration sets `country_code = 'ID'` for the bulk-set group.

## What was measured

**Country and reach** — v1, `gemini-3.5-flash-lite`, 3 runs per profile, 16 profiles: **5 real** (2 with a real profile payload; 3 known only from post payloads, so with no bio) and **11 synthetic** that I wrote to include the traps (an Indonesian-language community in Melbourne, a Malay-language complex in Johor, an English-language studio in Bali, a national company with a Jakarta head office, a local-government agency, an English brand with no place, an empty profile). Labels were written before the run.

| | result |
|---|---|
| deterministic signals alone (no model) | country resolved 13/16, **wrong 0**; the 3 left unresolved are the placeless profiles, as labelled |
| model, 48 runs | **wrong country 0/48**; fully correct 47/48 (reach 47/48: a placeless coffee shop called `local` once); a country no signal supports 0/48; national account given a place 0/48 |

**Default time zone** — v2 prompt, the same corpus plus a Java+Bali curator and a Papua community (18 profiles, 54 runs), after fixing one defect of mine: the guard demanded evidence of at least 4 characters, which discarded 14 correct zones whose only evidence was "WIB", "MYT", "SGT", "IST" or "WIT". The fix was made after seeing those drops, and the recorded answers were **re-scored offline with no new model calls** (`--from`).

| | result |
|---|---|
| time-zone signals alone | zone resolved 11/18, **wrong 0**; the 7 left unresolved are the national organizer, the Java+Bali curator, the Flores/Kupang/Kartasura olympiad, the three placeless accounts, and one museum known from a single caption (weak) — every one a case where the label allows no zone |
| model, 54 runs | **wrong zone 0/54**, `UNKNOWN` where a zone was expected 0/54; on the three multi-zone accounts and the placeless shop it answered `UNKNOWN` every time |
| signals + guarded model + reach gate | wrong 0/54, unresolved-where-expected 0/54 |
| country, same run | wrong 0/54 |
| one case where the model supplied a zone the text could not | a Yogyakarta museum known only from one caption mentioning "Sleman, Yogyakarta": signals "weak", model `Asia/Jakarta` (correct) — accepted as source `model` |

**Read this carefully.** The model and the signals agreed everywhere they both spoke, so the test cannot say which to trust in a disagreement — that rule (`resolveCountry`, `resolveTimezone`: signals anchor, the model fills silence, disagreement is "unresolved") is unit-tested, not measured. The synthetic profiles are cleaner than real ones; there is **no real foreign account**; only two real bios exist in the corpus; the `place` tables were extended after reading one real account (`kupang|flores|kartasura`) and `inferZone` was fixed after the corpus exposed that an ambiguous abbreviation ("IST") wrongly counted against the right zone. The model is genuinely needed for **reach**; for **country and zone** the signals did nearly all the work.

## Subscribers' country as a clue (decision taken 2026-10-18: a tie-break, the last option)

* **Nothing new is recorded.** A subscriber's country is derivable on demand from what exists: `user_locations.location_details.countryCode` (places the user saved) or, failing that, the country of `users.timezone`. There is no country column on `users`; I recommend not adding one for this.
* **Where it sits: last.** After the markers, the model, and the re-evaluation on the first scraped posts — and only to *confirm a lone weak signal* for the same country (one place name, say). It is not a signal in the scoring any more (`collectSignals` never produces one); `applySubscriberTieBreak` is applied to an otherwise-unresolved decision. Needs at least 3 subscribers with an 80% majority.
* **What it will not do:** resolve a country from subscribers alone, or break a genuine tie between two countries that both have evidence. On a mostly-Indonesian platform that would send every tie to ID, including a Melbourne community followed by Indonesians (unit-tested with eight Indonesian subscribers).
* **Precedent and caveat:** the time-zone resolver already uses the subscriber's `users.timezone` for events (Story 3.6c). Using subscribers' locations to infer a property of an *account* is a different purpose: keep only the derived value (`country_source = 'subscribers'`), never a per-user list.
* **Not measured:** no production data. To see whether it can matter at all:

```sql
-- do subscribers from outside Indonesia exist, and which accounts do they follow?
SELECT p.username, upper(coalesce(ul.location_details->>'countryCode', '??')) AS country, count(DISTINCT u.id) AS subscribers
FROM subscriptions s
JOIN social_media_account_profiles p ON p.id = s.account_id
JOIN users u ON u.id = s.user_id
LEFT JOIN user_locations ul ON ul.user_id = u.id AND ul.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY 1, 2 ORDER BY 1, 3 DESC;
```

## Default time zone (decision 2026-10-18: infer it; the country cannot supply it)

**Why it is needed.** Tier 2 of the schedule-timezone resolver is "the source account's timezone", which exists only as the timezone of the account's default location. BUG-065 takes the default location away from curators, so a curator's location-less events would fall to tier 3 (exactly one subscriber) or `NEEDS_CLARIFICATION`. It also exposes a latent flaw: today a curator with a *stored* default location (say Yogyakarta, WIB) gives every location-less event of that account WIB, including a Bali event that is WITA — a silent one-hour error in the displayed time.

**Why not the country.** Indonesia has three zones (WIB `Asia/Jakarta`, WITA `Asia/Makassar`, WIT `Asia/Jayapura`), Australia several. The country is a shortcut only where all its zones share one UTC offset (Singapore, India, Malaysia — `COUNTRY_SINGLE_ZONE`); Indonesia and Australia are explicitly not.

**Rule (`timezone-signals.ts`, 14 tests).** Evidence: an unambiguous abbreviation, or a place that lies in one zone; an ambiguous abbreviation (AEST, IST) only narrows and must be settled by a place; past resolved events of the account when there are at least 5 and 90% agree. Decision: the zone that at least 90% of the zone-mentioning texts point to, backed by a strong signal or two texts; a different clock in more than 10% of them, a tie, an abbreviation contradicting its own place, a zone from the wrong country, or a *national or international reach* ⇒ **no default** ("multi-zone"). No default is a correct answer: those accounts keep resolving event by event (venue → subscriber → moderator). Model answers are accepted only for a single-region account, with a verbatim quote and a valid IANA name, and never override a multi-zone text.

**Store** (migration at implementation): `default_timezone` (nullable IANA name) + source. Resolver tier 2 becomes `defaultLocation?.timezone ?? account.default_timezone`, so an organizer's explicit location still wins.

**For the legacy curators in the bulk update:** do not set a blanket `Asia/Jakarta` (the zone is a later step: the `default_timezone` column does not exist yet). Read the zones of their past events and set a default only where it is uniform. The query is circular — those zones came from earlier venue geocodes or from tiers 2/3 — so eyeball it:

```sql
SELECT p.username, s.timezone, count(*) AS n,
       round(count(*)::numeric / sum(count(*)) OVER (PARTITION BY p.id), 2) AS share, sum(count(*)) OVER (PARTITION BY p.id) AS total
FROM _bak_account_type_20261018 b
JOIN social_media_account_profiles p ON p.id = b.id
JOIN events e ON e.source_social_media_account_id = p.account_id
JOIN schedules s ON s.event_id = e.id
WHERE s.timezone IS NOT NULL AND s.timezone_status = 'RESOLVED'
GROUP BY p.id, p.username, s.timezone ORDER BY p.username, n DESC;
-- accept an account only where total >= 5 and the top share >= 0.9
```

## Design (country and reach)

**Country, in order:** (1) the country of a default location a person set → (2) deterministic markers in the profile payload → (3) a model answer, only where the markers are silent and only with a verbatim quote → (4) re-evaluate on the first scraped posts → (5) the subscribers' country, **last option, tie-break only** → (6) unresolved. *Language is never evidence.*

**Unresolved country (decided 2026-10-18, on the recommendation):** it does **not** mean "no pin". The geocoder gets a *preference* for the platform's home country (`bias=countrycode:id`, today's behaviour) plus the confidence floor; any country may win, but the winner must clear the floor, otherwise the address is kept as text and no coordinates are stored. A known country is a hard filter (`filter=countrycode:`) with the same floor. `geocodePlan` / `decideGeocode` in `location-policy.ts`. The home country is a setting (an env value next to `GEOAPIFY_API_KEY`). The floor defaults to 0.5, the threshold `isLocationTrustworthy` already uses for the map link; it is **not calibrated** — that needs a Geoapify key and `probe-geocode-country.ts`.

**Reach** (`local | regional | national | international | unspecified`): from the same call. Feeds `mayUseAccountLocation(…, reach)` and, with it, the zone: a national or international organizer lends no location and gets no default zone; an online event with no stated audience takes its organizer's area only when the reach is known to be local/regional.

**Store** (migration at implementation, not now): `country_code`, `country_source`, `account_reach`, `default_timezone`, plus the retry state below. Store the derived values, not the bio (PRD §3.16 spirit); re-reading a profile costs $0.0026.

**Retry** (`profile-retry.ts`, 8 tests) separates three situations that today are one:

| situation | what happens |
|---|---|
| transient (timeout, 429/5xx, capacity, model unavailable) | retry after 15 min, 1 h, 6 h, 1 day, 3 days (a longer `Retry-After` wins), then `NEEDS_REVIEW` |
| permanent (profile not found / private) | `NEEDS_REVIEW` at once; no more paid scrapes |
| scrape worked but showed no country | **do not re-scrape**; wait for new evidence (the first scraped posts), up to 3 passes, then `NEEDS_REVIEW` |

No new service: the sweep is a query ("status PENDING and next attempt due") inside an existing scheduled job (the daily scrape batch / the EventBridge poll-and-drain), guarded by the claim-with-TTL pattern Story 3.16 already uses (`classificationClaimedAt`). I did not trace which scheduled Lambda should host it; confirm before sizing. Classification should ride the same retry — today's first-failure-parks-the-account behaviour is the more important defect.

## Decisions taken (2026-10-18) and what is still open

| question | decision |
|---|---|
| run the legacy bulk update | **yes**, for the never-classified accounts with no location |
| never-classified accounts that already have a location | **not changed** — they stay null and keep behaving as today |
| an unresolved country | **preference + confidence floor**, not "no pin" |
| subscribers' country | **tie-break, last option** |

Still open, none of them blocking: deleting the captions already stored for the bulk-set accounts (not requested, not done); calibrating the geocode floor (needs a Geoapify key); where the retry sweep runs (which scheduled job); how the UI renders stub events.

## To verify first (read-only SQL; checked against the real schema, not run on production data)

```sql
SELECT account_type, account_type_status, count(*) FROM social_media_account_profiles GROUP BY 1, 2 ORDER BY 3 DESC;
-- accounts currently parked by a TRANSIENT failure rather than a real low-confidence answer
SELECT failure_reason, count(*) FROM account_type_classification_reviews WHERE failure_reason IS NOT NULL AND reviewed_at IS NULL GROUP BY 1 ORDER BY 2 DESC;
```

The second query measures how much the missing retry costs today.

Related: BUG-065, BUG-066, IDEA-074, FIND-086.
