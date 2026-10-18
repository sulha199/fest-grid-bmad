---
backlog_id: IDEA-075
title: "Read an account's country and reach from its initial profile scrape, and retry that scrape when it fails"
captured: 2026-10-18
---

# IDEA-075 — one profile read, three answers, and a retry

**Captured:** 2026-10-18 · **Status:** POC done (16 profiles, partly synthetic), no product code. Code: `apps/backend/scripts/poc-event-insight/` — `country-signals.ts`, `profile-insight.ts`, `run-profile-insight.ts`, `profile-retry.ts`. Results: `planning-artifacts/event-insight-poc/results/profile-insight-v1.generated.md`.

## Why

* BUG-066 mechanism 1: the first geocode of an account has **no country** to filter or bias with.
* BUG-065: whether an organizer's account location may stand in for an event's missing place depends on **how far the organizer reaches** — a local government's Zoom briefing is for its residents; a national company's webinar is for everyone and its head-office city is not an audience.
* Both can be read from the profile scrape Story 3.4n already pays for at subscribe time.

## What the code does today (read, not run)

| fact | where |
|---|---|
| the subscribe-time scrape is Apify `instagram-profile-scraper`, $0.0026 per profile in the 3.4n smoke test | `3-4n-…md`, `apify-runs/run-BIbGhsAYIVlbRe9JQ.infoeventjogja.md` |
| its payload carries biography, full name, business category, `isBusinessAccount`, external link and the **latest 12 posts** (captions, hashtags, sometimes `locationName`) | the same run files |
| `getAccountClassificationProfile` keeps **4 of those fields** (bio, username, name, category); the rest is dropped and **the bio is stored nowhere** (`description` is never populated) | `classify-account-type.ts`, 3.4n Dev Notes |
| **any** failure of that call — timeout, 429, capacity, Gemini outage, unparsable answer — becomes `AWAITING_APPROVAL` plus a review row; nothing retries it, because `subscribeToAccount` only classifies a profile whose status is null | `classify-account-type.ts` `handleHardFailure`, `subscribe-to-account.ts` |
| the other two profile-scraper actors tried in 3.4n were rate-limited or returned empty results | 3.4n Dev Notes, `apify-runs/` |
| an account with no default location gets an inference attempt after **every** post (an implicit retry — for location only) | `process-ai-job.ts` step 8.5 |

## What was measured (Gemini `gemini-3.5-flash-lite`, 3 runs per profile)

16 profiles: **5 real** (2 with a real profile payload; 3 known only from post payloads, so with no bio) and **11 synthetic** that I wrote to include the traps — an Indonesian-language community in Melbourne, a Malay-language complex in Johor, an English-language studio in Bali, a national company with a Jakarta head office, a local-government agency, an English brand with no place anywhere, an empty profile. Handles end in `.demo`. Labels were written before the run.

| | result |
|---|---|
| deterministic signals alone (no model) | country resolved for 13/16, **wrong 0**; the 3 left unresolved are the placeless profiles, as labelled |
| model, 48 runs | **wrong country 0/48**; fully correct 47/48 (reach right 47/48: a placeless coffee shop called `local` once) |
| model claims a country no signal supports | 0/48 |
| national organizer given a place (head-office leak) | 0/48 |
| local organizer's place found | 48/48 |

**Read this carefully:** the model and the signals agreed on every profile, so this test cannot say which one to trust when they disagree — that rule (`resolveCountry`: signals anchor, the model fills silence, disagreement is "unresolved") is unit-tested, not measured. The synthetic profiles are cleaner than real ones; there is **no real foreign account** in the corpus; real bios are often decorative or empty. The model is genuinely needed for **reach** (signals cannot tell a national company from a local one); for **country** the signals did all the work here.

## Design

**Country, in order:** (1) the country of a default location a person set (existing, explicit) → (2) deterministic markers in the profile payload → (3) a model answer, only where the markers are silent and only with a verbatim quote → (4) re-evaluate on the first scraped posts → (5) unresolved: the geocoder keeps today's soft preference but with a confidence floor, and the account surfaces for a moderator. *Language is never evidence.*

**Reach** (`local | regional | national | international | unspecified`): from the same call. Feeds `mayUseAccountLocation(…, reach)`: a national or international organizer lends no location, and an online event with no stated audience takes its organizer's area only when the reach is known to be local/regional.

**Store** (migration at implementation, not now): `country_code`, `country_source`, `account_reach`, plus the retry state below. Store the derived values, not the bio (PRD §3.16 spirit); re-reading a profile costs $0.0026.

**Retry** (`profile-retry.ts`, 8 tests) separates three situations that today are one:

| situation | what happens |
|---|---|
| transient (timeout, 429/5xx, capacity, model unavailable) | retry after 15 min, 1 h, 6 h, 1 day, 3 days (a longer `Retry-After` wins), then `NEEDS_REVIEW` |
| permanent (profile not found / private) | `NEEDS_REVIEW` at once; no more paid scrapes |
| scrape worked but showed no country | **do not re-scrape**; wait for new evidence (the first scraped posts), up to 3 passes, then `NEEDS_REVIEW` |

No new service: the sweep is a query ("status PENDING and next attempt due") inside an existing scheduled job (the daily scrape batch / the EventBridge poll-and-drain), guarded by the claim-with-TTL pattern Story 3.16 already uses (`classificationClaimedAt`). I did not trace which scheduled Lambda should host it; confirm before sizing. Classification should ride the same retry — today's first-failure-parks-the-account behaviour is the more important defect.

## Decisions needed

1. **Include never-classified (legacy) accounts?** One re-read each ($0.0026 per profile, i.e. $2.60 per 1,000 accounts, plus a model call) would classify them, settle their country and reach, and end the ambiguity in BUG-065 / FIND-086. Story 3.4n rejected a backfill for cost and effort; this reverses that only if you choose it. Until then they simply lend no location.
2. **What a still-unresolved country does to geocoding** (step 5): preference + floor (recommended) vs. no pin at all.

## To verify first (read-only SQL, not run)

```sql
SELECT account_type, account_type_status, count(*) FROM social_media_account_profiles GROUP BY 1, 2 ORDER BY 3 DESC;
-- accounts currently parked by a TRANSIENT failure rather than a real low-confidence answer
SELECT failure_reason, count(*) FROM account_type_classification_reviews WHERE failure_reason IS NOT NULL AND reviewed_at IS NULL GROUP BY 1 ORDER BY 2 DESC;
```

The second query measures how much the missing retry costs today.

Related: BUG-065, BUG-066, IDEA-074, FIND-086.
