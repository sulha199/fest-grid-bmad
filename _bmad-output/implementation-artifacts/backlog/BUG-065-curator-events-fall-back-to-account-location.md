---
backlog_id: BUG-065
title: "Curator events fall back to the curator's account location; inference gives it an arbitrary place"
captured: 2026-10-18
---

# BUG-065 — an account location is meaningful for a venue, not for a curator

**Captured:** 2026-10-18 · **Status:** partly reproduced. Gemini behaviour: **measured** (live, production prompt, real posts).
Pipeline consequences: **inferred from reading code**, not reproduced (no database in the session).

## The policy that was asked for

| account type | may an event with no location of its own take the account's location? | may we infer an account location? |
|---|---|---|
| `ORGANIZER_VENUE_EVENT`, confirmed | yes — "an event at a mall posted on the mall's account" (PRD §3.7) | yes, but only when several posts agree (see Fix) |
| `CURATOR_GUIDE` | **no** | **no** |
| `PERSONAL` | never scraped (`isScrapableAccountType`) | no |
| unclassified (`accountTypeStatus` null, legacy) | yes — today's behaviour is kept | yes |
| `AWAITING_APPROVAL` | no — it might be a curator | no |

## What the code does today (no account-type check at any of these sites)

| site | behaviour |
|---|---|
| `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` (the `addressString` fallback) | `schedule.location \|\| event location \|\| defaultLocation.formattedAddress` — for every account type |
| `packages/domain/src/events/transform-gemini-response-to-event-info.ts` (`payload.location \|\| context.defaultLocation…`) | the same fallback, a second time, in the pure transformer |
| `apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts`, called from `process-scrape-job.ts` and from `process-ai-job.ts` step 8.5 | infers a default location for any account whose `defaultLocation` is null; `onlyIfCurrentlyNull` makes the first post win |

`process-ai-job.ts` already computes `isCuratorGuide` (it clears curator captions after extraction, PRD §3.16), so the gate is a few lines at three call sites, not new plumbing.

## What was measured

`apps/backend/scripts/poc-event-insight/probe-default-location.ts` runs the **production** inference prompt (`buildLocationInferenceRequest`) over real posts, one post at a time, and applies the production gate (Gemini self-confidence ≥ 0.5). Output: `planning-artifacts/event-insight-poc/results/probe-default-location.generated.txt`.

| account | type | posts | distinct places returned | applied |
|---|---|--:|--:|---|
| `@plazaambarrukmo` | venue | 4 | 1 place (3 spellings of it) | 4/4 |
| `@slemancityhall` | venue | 1 | 1 | 1/1 |
| `@infoeventjogja` | curator | 12 | **12 of 12 different** — "Plaza Ambarrukmo", "Royal Ambarrukmo", "Sport Academy Yogyakarta and Lapangan Funminton", "omah noto plankton", "Jogja", "DIY & Jawa Tengah", "Montero Jogja, … Pakem, Sleman", "Auditorium SGLC … UGM", … | 12/12 (confidence 0.70–1.00) |

The production prompt asks where *this post's* events take place. For a venue that is also the account's base; for a curator it is simply the venue of whichever post happened to run first, and the 0.5 gate on the model's own confidence does not catch it (the model is confident about each post's venue). The sample is **one** curator account and 17 posts, all Indonesian: it shows the mechanism, not a rate.

## Why it is worse than "an odd pin"

`resolveAccountAndLocations` passes `countryBias: defaultLocation?.countryCode` to every later geocode of that account. A wrong stored default therefore also biases the country of all of that account's other events — BUG-066.

## Fix direction

1. One predicate, `mayUseAccountLocation(accountType, accountTypeStatus)` (the shape of `isScrapableAccountType`, AD-34), used by the three sites above, plus a ratchet that no other code reads `defaultLocation` as an event-location fallback. Draft + tests: `poc-event-insight/location-policy.ts`.
2. Curators and `AWAITING_APPROVAL` accounts: no fallback, no inference. An event with no stated location gets no pin (it stays attendable by its text and, with IDEA-074, by its extracted audience area).
3. Organizers: infer only on **consensus** — a place that at least two posts (and a majority of the sampled ones) describe (`consensusPlace`, same file). Gate on the geocoder's own confidence and country (BUG-066), not on Gemini's self-reported confidence.
4. Existing data: clear `AI_INFERENCE` default locations on curator accounts after a moderator-visible report, not silently.

## To verify first (read-only SQL, one query each)

```sql
-- curator accounts that carry a default location, and where it points
SELECT username, account_type_status, default_location->>'countryCode' AS country,
       default_location->>'formattedAddress' AS address, (default_location->>'confidence')::float AS conf
FROM social_media_account_profiles
WHERE account_type = 'CURATOR_GUIDE' AND default_location IS NOT NULL ORDER BY conf NULLS FIRST;

-- pinned schedules per account type (curators are the rows that should not exist; the join key is the platform
-- account id: events.source_social_media_account_id = social_media_account_profiles.account_id)
SELECT p.account_type, count(*) FROM schedules s
JOIN events e ON e.id = s.event_id
JOIN social_media_account_profiles p ON p.account_id = e.source_social_media_account_id
WHERE s.location_details IS NOT NULL GROUP BY 1;
```

Column names were read from `packages/database/schema.ts`; the queries were **not run**. The second one counts pinned schedules by account type, it cannot tell a fallback pin from a stated one — that needs the post text.

Related: BUG-066, BUG-064, IDEA-074. Design: `planning-artifacts/event-insight-poc/proposal-personalized-discovery.md` §9.
