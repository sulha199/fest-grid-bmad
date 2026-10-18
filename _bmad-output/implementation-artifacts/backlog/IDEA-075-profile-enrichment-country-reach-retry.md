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

## Legacy accounts: a bulk update, not a backfill (decision 2026-10-18)

The product owner states that the never-classified accounts **that have no location are all Indonesian curators**. Then no re-read is needed: one transaction sets them. **Not run — there is no database in the session; the predicates and column names were read from `packages/database/schema.ts`.** Look first, because the claim is about data I cannot see:

```sql
-- 0. the sets
SELECT count(*) FILTER (WHERE default_location IS NULL)     AS never_classified_no_location,
       count(*) FILTER (WHERE default_location IS NOT NULL) AS never_classified_with_location
FROM social_media_account_profiles WHERE account_type_status IS NULL;

SELECT username, display_name, last_scraped_at FROM social_media_account_profiles
WHERE account_type_status IS NULL AND default_location IS NULL ORDER BY last_scraped_at DESC NULLS LAST;  -- read it: every row should be a curator

-- 1. keep the before-state (a scratch table outside the drizzle migrations; export it and drop it later)
CREATE TABLE _bak_account_type_20261018 AS
SELECT id, account_type, account_type_status, account_type_confidence_score, updated_at
FROM social_media_account_profiles WHERE account_type_status IS NULL AND default_location IS NULL;

-- 2. set them, in one transaction. The predicates make it safe against a concurrent subscribe.
BEGIN;
UPDATE social_media_account_profiles p
SET account_type = 'CURATOR_GUIDE', account_type_status = 'CONFIRMED', updated_at = now()
FROM _bak_account_type_20261018 b
WHERE p.id = b.id AND p.account_type_status IS NULL AND p.default_location IS NULL AND p.classification_claimed_at IS NULL;
-- compare the reported row count with: SELECT count(*) FROM _bak_account_type_20261018   (fewer = some changed meanwhile)
COMMIT;

-- 3. rollback, if needed
UPDATE social_media_account_profiles p
SET account_type = b.account_type, account_type_status = b.account_type_status, account_type_confidence_score = b.account_type_confidence_score, updated_at = now()
FROM _bak_account_type_20261018 b WHERE p.id = b.id AND p.account_type = 'CURATOR_GUIDE';
```

`account_type_confidence_score` stays NULL, which is how a hand-set row is told from a classified one; no review row is created (the moderator page lists `AWAITING_APPROVAL` only).

**What changes for these accounts — read before running** (from the code, not observed):

| | effect |
|---|---|
| scraping | **unchanged** — `isScrapableAccountType(CURATOR_GUIDE, CONFIRMED)` is true; the web "coming soon" gate for curators was already removed (`spec-curator-guide-frontend-gate-stale.md`) |
| captions of **future** posts | cleared after extraction, as for every confirmed curator (3.4o, PRD §3.16); images are not re-hosted |
| captions already stored | **stay** until someone clears them. A clear-up, `UPDATE posts SET content = NULL WHERE account_id IN (SELECT id FROM _bak_account_type_20261018) AND is_extracted AND content IS NOT NULL`, is a **deletion** and also removes the ability to re-extract those posts — separate decision, not part of the update |
| **future events** from these accounts | `isOrganizerAuthoredPost` now returns false for them, so `process-ingestion-job.ts` creates them with `detailLevel = 'stub'`, distrusts their `organizerHandle` for matching, and they no longer count as organizer-authored for primary-post choice and the first-organizer notification — exactly as for any other confirmed curator today. Until now a null-typed curator was treated as an organizer on every one of those. **I did not check how the UI renders a stub event** |
| location / zone fallback | none from the account (BUG-065); with no default location they never had one |
| FIND-086 | resolved for this group |

**Not covered by the statement:** never-classified accounts that *do* have a location. They stay null and, under the revised policy, lend no location. How many there are, and whether they are organizers, is the first query above. Once the `country_code` column of this idea exists, the same migration sets `country_code = 'ID'` for the group.

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

## Subscribers' country as a clue (decision 2026-10-18: considered)

* **Nothing new needs to be recorded.** A subscriber's country is derivable on demand from what exists: `user_locations.location_details.countryCode` (the places the user saved) or, failing that, the country of `users.timezone`. There is no country column and I recommend not adding one for this: it would be a new piece of personal data.
* **It is a weak clue, and the platform's own base rate weakens it further.** On a mostly-Indonesian user base the answer is "ID" for almost every account, including a Melbourne community followed by Indonesians. In `country-signals.ts` it is worth 1 (resolving needs 2), needs at least 3 subscribers and an 80% majority, can never resolve a country alone, and cannot outvote a strong foreign marker (tested with eight Indonesian subscribers of a Melbourne account). Its real use: tie-break an otherwise quiet profile, and give the very first subscriber's account *something* at subscribe time.
* **Precedent:** the time-zone resolver already uses the subscriber's `users.timezone` for events (Story 3.6c). Using subscribers' locations to infer a property of an *account* is a different purpose; keep only the derived value (`country_source = 'subscribers'`), never a per-user list, and treat it as a decision for the PRD §3.16 owner.
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

**For the legacy curators in the bulk update:** do not set a blanket `Asia/Jakarta`. Read the zones of their past events and set a default only where it is uniform. The query is circular — those zones came from earlier venue geocodes or from tiers 2/3 — so eyeball it:

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

**Country, in order:** (1) the country of a default location a person set → (2) deterministic markers in the profile payload → (3) a model answer, only where the markers are silent and only with a verbatim quote → (4) the subscribers' country, as a tie-break only → (5) re-evaluate on the first scraped posts → (6) unresolved: the geocoder keeps today's soft preference but with a confidence floor, and the account surfaces for a moderator. *Language is never evidence.*

**Reach** (`local | regional | national | international | unspecified`): from the same call. Feeds `mayUseAccountLocation(…, reach)` and, with it, the zone: a national or international organizer lends no location and gets no default zone; an online event with no stated audience takes its organizer's area only when the reach is known to be local/regional.

**Store** (migration at implementation, not now): `country_code`, `country_source`, `account_reach`, `default_timezone`, plus the retry state below. Store the derived values, not the bio (PRD §3.16 spirit); re-reading a profile costs $0.0026.

**Retry** (`profile-retry.ts`, 8 tests) separates three situations that today are one:

| situation | what happens |
|---|---|
| transient (timeout, 429/5xx, capacity, model unavailable) | retry after 15 min, 1 h, 6 h, 1 day, 3 days (a longer `Retry-After` wins), then `NEEDS_REVIEW` |
| permanent (profile not found / private) | `NEEDS_REVIEW` at once; no more paid scrapes |
| scrape worked but showed no country | **do not re-scrape**; wait for new evidence (the first scraped posts), up to 3 passes, then `NEEDS_REVIEW` |

No new service: the sweep is a query ("status PENDING and next attempt due") inside an existing scheduled job (the daily scrape batch / the EventBridge poll-and-drain), guarded by the claim-with-TTL pattern Story 3.16 already uses (`classificationClaimedAt`). I did not trace which scheduled Lambda should host it; confirm before sizing. Classification should ride the same retry — today's first-failure-parks-the-account behaviour is the more important defect.

## Decisions still open

1. **Run the bulk update?** After the first query confirms the set. Also: clear the already-stored captions of those accounts (a deletion), or leave them.
2. **Never-classified accounts *with* a location** — leave null (lend no location), or classify them by the profile read (one re-read each: $2.60 per 1,000 profiles plus a model call).
3. **What a still-unresolved country does to geocoding**: preference + floor (recommended) vs. no pin at all.
4. **Subscribers' country**: use as a tie-break (recommended) or not at all — it repurposes users' location data.

## To verify first (read-only SQL, not run)

```sql
SELECT account_type, account_type_status, count(*) FROM social_media_account_profiles GROUP BY 1, 2 ORDER BY 3 DESC;
-- accounts currently parked by a TRANSIENT failure rather than a real low-confidence answer
SELECT failure_reason, count(*) FROM account_type_classification_reviews WHERE failure_reason IS NOT NULL AND reviewed_at IS NULL GROUP BY 1 ORDER BY 2 DESC;
```

The second query measures how much the missing retry costs today.

Related: BUG-065, BUG-066, IDEA-074, FIND-086.
