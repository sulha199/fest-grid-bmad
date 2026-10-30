---
backlog_id: BUG-066
title: "Geocoding can land in the wrong country: soft bias only, no bias at bootstrap, no confidence floor"
captured: 2026-10-18
---

# BUG-066 — a wrong address or country is reachable by construction

**Captured:** 2026-10-18 · **Update 2026-10-19:** the effect is now **seen in production data** (`prod-findings-and-event-groups-2026-10-19.md` §3: 379 of 1,460 pins outside Indonesia's bounding box, 26 Sleman City Hall schedules pinned in the US, Plaza Ambarrukmo outlets in New York); which of the six mechanisms below produced which pin is still not established, and the probe has not been run. · **Status:** **mechanisms not reproduced.** The report was the product owner's ("querying curator location falls into totally wrong address, wrong country — fatal"). Everything below is **code reading**; the session had no Geoapify key, and an attempted keyless check against Nominatim was rate-limited (HTTP 429) and abandoned, so **no wrong-country result is claimed here as observed.** A ready-to-run probe is included.

## Measured 2026-10-19 (`prod-check-results-review-2026-10-19.md`)

* Production: 379 of 1,460 pins lie outside Indonesia's bounding box; **627 (43%) have a stored confidence under 0.5**; 265 more schedules have no pin. The box test is a floor: pins in the wrong province of the right country are inside the box.
* Probe (`results/geocode-probe-2026-10-19.md`, 14 descriptions × no bias / bias `id` / filter `id`, my reading of the addresses): 7 right (confidence 0.67–1.00), 5 venue texts answered with another place (confidence 0.00–0.20), 2 **area phrases** answered with a business (0.66 and 0.50). Only 2 of 42 picks were outside Indonesia (the same description, Canada at 0.20); the `filter` mode stays wrong inside Indonesia. So: a floor works on venue texts and fails on area phrases, which should go to the gazetteer instead (IDEA-081); do not calibrate the floor on 14 texts.
* Open: the probe geocodes "Sleman City Hall" correctly (id, 1.00) while production stores 26 of its schedules in the US. `confidence-by-country-box.sql` and a probe with `--country us` test the explanations (account default as bias, cache entry, pin from another path).

## Mechanisms found in the code (each is a hypothesis until the probe or the SQL says otherwise)

| # | where | what | effect |
|---|---|---|---|
| 1 | `backfill-account-profile-and-infer-location.ts` → `resolveLocationSeam({ kind: 'ADDRESS', address: inference.placeDescription })` | the first-time default-location geocode passes **no `countryBias`** (an account with no default has no country to bias with) | descriptions like "Jogja", "omah noto plankton", "DIY & Jawa Tengah" (to a global geocoder "DIY" is not a province) are matched worldwide |
| 2 | `geoapify-client.ts` `geocodeAddress` | country is `&bias=countrycode:xx`, a *preference* for ranking. Geoapify also has `&filter=countrycode:xx`, a hard restriction, which is not used anywhere | even with a bias a confident foreign match can win |
| 3 | `packages/domain/src/geolocation/select-best-candidate.ts` | highest `confidence` wins; no country check and **no floor** — something is always accepted unless the provider returned nothing | a 0.2-confidence guess is stored and rendered as a pin |
| 4 | `resolve-account-and-locations.ts` | `countryBias: defaultLocation?.countryCode` — the bias for **every later event of the account** comes from the account's stored default | one wrong-country default (mechanism 1) skews every later geocode of that account; with no default, no bias at all |
| 5 | `process-ai-job.ts` step 8.5 / `process-scrape-job.ts` | the inference runs for curators too (BUG-065), where the "location" is an arbitrary venue of one post | the stored default is both arbitrary and unbiased-geocoded |
| 6 | the Gemini gate | `LOCATION_INFERENCE_CONFIDENCE_THRESHOLD` (0.5) is applied to Gemini's **self-reported** confidence, not to the geocoder's | measured (BUG-065): a curator's twelve different places were all applied at 0.70–1.00 |

Ruled out by reading: the geocode **cache key** includes the bias (`build-cache-key.ts`: `|bias:${countryBias ?? 'none'}`), so a no-bias result is not reused for a biased query.
`isLocationTrustworthy` (confidence ≥ 0.5 and `full_match`) exists but is used only to decide whether the UI shows a map link; nothing stops a low-confidence result from being stored.

## Fix direction

1. Country as a **filter**, from a known set. The account's country comes from **its initial profile scrape** (IDEA-075: deterministic markers such as +62 / WIB / Rp / .co.id, backed by a quoted model answer; 16 profiles tested, 0 wrong countries — a small, partly synthetic test). Only when that is still unresolved after the retries does the platform's home-country setting (Indonesia today) apply — **decided 2026-10-18** — as a *preference* (`bias=countrycode:`) with the confidence floor: any country may win, but the winner must clear the floor, otherwise the address is kept as text and no pin is stored. Never as a silent filter. Draft + tests: `geocodePlan` / `decideGeocode` in `location-policy.ts`; the floor (0.5, the threshold `isLocationTrustworthy` already uses) is not calibrated.
2. Country-aware candidate choice with a confidence floor and an **"unresolved"** outcome: keep the text, store no coordinates, never a wrong pin (draft + tests: `poc-event-insight/location-policy.ts` `acceptGeocode`).
3. Gate inference on the **geocoder's** confidence/country, not Gemini's.
4. Do not infer for curators (BUG-065); infer for organizers only on consensus.
5. Existing data: find and report, do not silently rewrite.

## To verify first

**A. Live probe (needs a Geoapify key).** `GEOAPIFY_API_KEY=… npx tsx apps/backend/scripts/poc-event-insight/probe-geocode-country.ts --md <out.md>` replays the 14 descriptions the production prompt produced for a curator and two venues (`results/probe-default-location.generated.txt`) under *no bias* (today's bootstrap), *bias* (today's later geocodes) and *filter*, and prints the country of today's pick plus the countries in the other candidates. `--dry` prints the URLs only.

**B. Production data (read-only).**

```sql
-- where do stored event pins and account defaults actually point?
SELECT location_details->>'countryCode' AS country, count(*) FROM schedules WHERE location_details IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
SELECT default_location->>'countryCode' AS country, account_type, count(*) FROM social_media_account_profiles WHERE default_location IS NOT NULL GROUP BY 1, 2 ORDER BY 3 DESC;

-- stored pins that the UI itself would not trust (confidence < 0.5), least confident first
SELECT s.id, s.location_details->>'formattedAddress' AS addr, s.location_details->>'countryCode' AS country,
       (s.location_details->>'confidence')::float AS conf
FROM schedules s WHERE s.location_details IS NOT NULL AND (s.location_details->>'confidence')::float < 0.5 ORDER BY conf LIMIT 100;
```

If the first query shows only `id`, mechanism 1–4 are not producing foreign pins in practice and the fault is narrower (probably a handful of curator defaults). The queries were run (rolled back) against a scratch PostgreSQL 16 built from the repository's 80 migrations: they parse and every table and column resolves. They were not run against production data, so no result is known.

Related: BUG-065, IDEA-073, IDEA-075, BUG-064.
