---
title: 'Location keywords, slice 2: keyword geocoding ladder and keyword map link'
type: 'feature'
created: '2026-11-10'
revised: '2026-11-11'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Geocoding and the map link both work from one free-text string. Without an account default country Geoapify has no country prior, so Indonesian venues land abroad ("Grand Mercure Yogyakarta" in England, "Karawang" in New York); a wrong account default (Poland, Pennsylvania) then makes today's 300 km filter discard correct matches. The link points at a coordinate whenever the geocoder is "confident", so a wrong match sends people to the wrong place. A request that geocodes many schedules has no shared memo or budget across events. Co-authored posts, where the primary account mostly has no default location (28 of 97 have one), get no help from any default.

**Approach:** Depends on slice 1 (`spec-location-keywords-extraction.md`: keywords and `countryCode` produced and stored/carried). Geocode from the keywords with a 2-step ladder under a country hint (`filter=countrycode:<code>`: the model's code for the string or the post, else a configured platform default; nothing hard-coded to one country), a code-cleaned ladder when keywords are missing, build the map link as a text search from the keywords (no coordinates), and give a request one shared lookup memo and a budget.

## Boundaries & Constraints

**Always:** Address source per schedule: schedule keywords, schedule `location`, event keywords, event `location`, account default (as today). Country hint, per string, one pure domain function `resolveCountryHint` returning `{code, source}`: (1) the string's `locationCountryCode` from slice 1 (the model's code for that text, or, filled by the slice 1 generator, the code most of the post's other strings agree on); (2) else the platform default `DEFAULT_COUNTRY_CODE` (backend env, default "ID", empty = none); (3) else none. Sources (1) are trusted: a hard `filter=countrycode:<code>` and no unfiltered pass after it found nothing (it returned foreign look-alikes in the POC). Source (2) is a guess: filter-first, then one unfiltered pass, so a wrong default costs a lookup, not a wrong place. No hint means unfiltered only. The account's default location and the account's past events are never a country source (the default is wrong for many accounts; history is deferred). A string with no keywords (old data, failed call) uses the fallback ladder with the same hint. Keywords ladder: step 1 = all keywords joined with ", "; step 2 = without the most specific (first) one, run only with 2 or more keywords and only after step 1 ended in "not found" (including the plausibility filter); an outage is never laddered. Fallback ladder (pure domain function `buildFallbackLocationQueries`): step 1 = the text with parentheticals, floor/level/unit/RT/RW/street-number noise and country names removed, comma segments kept; step 2 = its last two segments (only with 3 or more segments). Every step is its own cached query (AD-14 Rule 5 negative cache; the country filter is part of the cache key); at most 2 steps per filter pass, so at most 4 uncached lookups per string. No confidence floor: the POC shows Geoapify confidence does not separate right from wrong (8 correct hits had confidence 0, 3 wrong ones too). Proximity bias and the 300 km plausibility filter keep working but take the account default location only when its country equals the hint's country; otherwise it is ignored for that string (a wrong default would discard correct matches). With no hint the default is used as today. A request-scoped geocode session (memo of in-flight and finished queries by cache key, plus a budget of uncached Geoapify calls) is created by the caller and passed through `buildExtractedEventMessage` to `resolveAccountAndLocations`; API Apply passes a budget (default 12), the AI Lambda path none. When spent, remaining queries are skipped (text and account timezone kept) and one `geocode-budget-exhausted` line is logged. Record which step resolved each schedule: new nullable text column `schedules.location_resolution` (migration `--custom`, not a pg enum; TS union `LocationResolution` in `packages/shared-types`) with values `kw1|kw2|fb1|fb2` (resolved by that ladder step), `none` (lookups ran, nothing plausible), `skipped` (budget spent or Geoapify outage; a later Apply may resolve it); null = never attempted or a row from before this slice. It is set in the same write as `location_details` (build-extracted-event-message to insert values, Apply) and cleared with it wherever `location_details` is reset (`submitCorrection`, enrichment in `set-event-primary-post.ts`, `merge-events.ts` copies it with the schedule); a schedule whose coordinates came from the account default location gets null. Internal only: not on GraphQL, not in the web app. The same value is also logged per schedule as `step=...` with the hint code and its source (`string|platform|none`). Link: always `https://www.google.com/maps/search/?api=1&query=<encoded>`, query = keywords joined with a space, else the display name; one trailing icon (`ExternalLink`); a pure domain helper builds the query. Apply makes no Gemini call.

**Decided (2026-11-11):** `SubscribedAccountCard` keeps its `isLocationTrustworthy(location)` gate (it decides whether to show a possibly wrong city label at all, not which URL opens); only the link inside it changes (query = place name + city). The country hint uses the string's code, then the platform default; account history was considered and deferred. Using the account default location only when its country matches the hint changes PR #202's behavior for accounts with a wrong default.

**Ask First:** Adding account history as a country source (most common country of the account's geocoded events, at least 3 events and 60%), if the platform default proves wrong too often in a new market.

**Never:** No GraphQL exposure of `location_resolution`. No removal of `confidence`/`matchType` from GraphQL or the mapper (Story 0.i7z AC 4 tests cite them). No backfill. No new geocoding vendor. No change to distance calculation or timezone resolution. No region derived from the account default and appended to a query.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Venue known | keywords `["Pasar Porosjayan","Gamping","Sleman"]`, string code "ID" | step 1 (filter ID, source `string`) resolves; `step=kw1` | N/A |
| Venue unknown | step 1 not found | step 2 `"Gamping, Sleman"` resolves (area pin) | N/A |
| Both fail | steps 1 and 2 not found | no coordinates; text kept; account timezone | not-found cached per step |
| Foreign venue | `["Doylestown","Pennsylvania"]`, code "US" | filter US; no Indonesian match possible | N/A |
| Single keyword | `["Sleman"]` | one step only | N/A |
| Keywords missing | old row, or slice 1 call failed, no string code | fallback ladder with the platform default as hint: cleaned text filtered, then unfiltered | N/A |
| Wrong account default | default in Poland, venue in Jakarta, string code "ID" | default ignored for that string; resolves in Jakarta | N/A |
| New market | `DEFAULT_COUNTRY_CODE=PH`, string without a code | filter PH first, then one unfiltered pass; no Indonesian assumption anywhere in code | N/A |
| No hint | no string code, no platform default | unfiltered, as today | N/A |
| Outage | Geoapify 5xx on step 1 | error surfaces as today; no step 2, nothing cached | existing best-effort log |
| 20 schedules, 2 places | one Apply | 2 queries (ladder at most 4), repeats from the session memo, also across events | N/A |
| Budget spent | many distinct unknown places | later queries skipped, one log line | schedules keep text only |
| Link, keywords | `["Pasar Porosjayan","Gamping","Sleman"]` | query `Pasar Porosjayan Gamping Sleman`, no coordinates | N/A |
| Link, no keywords | display name only | query the name | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/geolocation/geoapify-client.ts`, `adapter.ts`, `cache-store.ts` -- add the country filter option (`filter=countrycode:`) and put it in the cache key; steps are ordinary `ADDRESS` queries
- `packages/database/schema.ts` (schedules, next to `locationDetails` :757), new migration + snapshot + `_journal.json`, `packages/shared-types/src/index.ts` (`LocationResolution`), `build-event-insert-values.ts`, `merge-events.ts`, `set-event-primary-post.ts`, `schema/resolvers.ts` `submitCorrection` -- the `location_resolution` column travels with `location_details`
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` -- per-call memo today (PR #204); becomes the ladder + session consumer
- `apps/backend/src/lib/ai-processor/build-extracted-event-message.ts` -- :24, called per event; takes the session in its options
- `apps/backend/src/lib/extraction/apply-post-reextraction.ts` :86-95 (per-event loop, creates the session with the budget); `process-ai-job.ts` :502 and `process-extraction-step.ts` :260 (per-post session, no budget)
- `packages/domain/src/geolocation/` -- new pure helpers: keywords-ladder builder, `buildFallbackLocationQueries`, `buildLocationSearchQuery`; existing `filterPlausibleCandidates`/`selectBestCandidate`
- `packages/ui/src/core/LocationLink.tsx` (+ `.test.tsx`, carries the 0.i7z header), `EventDetailView.tsx` :554-567, `SubscribedAccountCard.tsx` :65-72 (+ test), `apps/web/src/features/events/mapper.ts` :91-93 (+ `mapper.test.ts`), `EventDetailView.types.ts` :21, `apps/web/src/features/events/queries.graphql` (select `locationKeywords` where `location` is selected)
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` -- AD-14 Rule 2 "Enforced by" (map-link gate lines), Rule 1/3 text on the account default as a hard filter, and new Rule 6; `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` ~:417 (the "search icon … coordinates absent or below the confidence threshold" sentence, which this slice reverses)

## Tasks & Acceptance

**Execution:**
- [ ] `packages/domain/src/geolocation/` -- keywords-ladder builder, `buildFallbackLocationQueries`, `buildLocationSearchQuery` with tests
- [ ] Geoapify client/adapter/cache -- country filter option, cache key includes it
- [ ] `packages/domain/src/geolocation/` -- `resolveCountryHint` (string code, else platform default, else none) with tests; `DEFAULT_COUNTRY_CODE` read once in `apps/backend/src/env.ts` (slice 1 already adds it for the keywords prompt)
- [ ] Geocode session (memo + budget) beside the resolver, with tests (in-flight de-dupe, budget, across events)
- [ ] `resolve-account-and-locations.ts`, `build-extracted-event-message.ts`, `apply-post-reextraction.ts`, `process-ai-job.ts`, `process-extraction-step.ts` -- precedence, country prior, ladders, default-country rule, session, per-schedule `step=` log
- [ ] `schedules.location_resolution` -- drizzle migration (`--custom`, mind the journal `when` ordering ratchet and renumbering), schema + `LocationResolution` type, written with `location_details` by the resolver result, cleared where `location_details` is reset, copied on merge, with DB tests
- [ ] `LocationLink.tsx` -- drop `coordinates`/`confidence`/`matchType`, take `searchQuery`, single icon; update callers and tests; keep the `locationDetails` passthrough in the mapper (distance consumers)
- [ ] `SubscribedAccountCard.tsx` -- link query from place name + city; gate unchanged unless the human decides otherwise
- [ ] Architecture spine AD-14 re-pointing + Rule 6; `EXPERIENCE.md`; the 0.i7z header comments on touched tests (historical story files stay as they are)

**Acceptance Criteria:**
- Given a schedule with keywords whose venue Geoapify does not know, when it is resolved, then the second step's area-level result is used and no more than 2 queries are made for it.
- Given an account default in another country than the string's hint, when the string is geocoded, then the default is not used as proximity or plausibility input for it.
- Given `DEFAULT_COUNTRY_CODE` set to another country and strings without a code, when they are geocoded, then the filter is that country first and no code or test assumes Indonesia.
- Given an Apply of 20 schedules on 2 places across 3 events, when it runs, then at most 2 uncached lookups happen (4 with ladders) and the request finishes inside 28 s.
- Given schedules resolved at the keywords' first step, second step, by the fallback ladder, by nothing, or skipped by the budget, when they are saved, then `location_resolution` is `kw1`, `kw2`, `fb1`/`fb2`, `none` or `skipped` respectively, and it is null for a schedule that was never geocoded.
- Given a moderator correction that changes a schedule's location text, when it is saved, then `location_details` and `location_resolution` are cleared together.
- Given any location link, when rendered, then its URL contains no coordinates, and with keywords the query is the keywords joined by spaces.

## Spec Change Log

- 2026-11-11 (revised after the POC): hard country filter instead of soft bias (the soft bias changed no result), `countryCode` from slice 1, code-cleaned fallback ladder, no confidence floor (confidence does not separate right from wrong), default-country rule for the account default.
- 2026-11-11 (country hint, user decision): no hard-coded country. Hint = the model's code for the string (or the post's consensus, filled in slice 1), else the platform default `DEFAULT_COUNTRY_CODE`. Account history deferred; `SubscribedAccountCard` gate kept.
- 2026-11-11 (user decision): store which ladder step resolved a schedule in a new nullable column `schedules.location_resolution` (the draft only logged it). Internal observability, not exposed.

## Design Notes

POC numbers on 54 labelled real locations: production 29 correct / 9 wrong / 16 not found; text under filter ID-first then unfiltered 36/11/7; code-cleaned ladder 38/12/4; Gemini keywords ladder 45/8/1 (the co-authored, no-default subset of 26: 14/8/4 today, 22/3/1). Remaining wrong answers are name collisions (for example "Pakuwon Mall Jogja" resolving to Cirebon) that no ladder variant fixed. The foreign-venue guard rests on the model's `countryCode`, which the POC did not test: there Raleigh and Kumamoto resolved only through the unfiltered fallback, and Singapore and Doylestown resolved wrongly to Indonesian places under the ID-first pass. Slice 1's manual check covers it.

Why a session instead of relying on the cache: the cache is one DB round trip per lookup and cannot de-dupe two lookups in flight at once; the session is also where the budget lives. Why 2 steps: the link no longer uses coordinates, so a district-level pin is enough for distance and timezone. Known gap: a spent budget leaves schedules ungeocoded with no automatic second chance; re-running Apply reuses everything cached.

## Verification

**Commands:**
- Rebuild domain/database dist; backend `tsc`, `lint`, DB tests one file at a time; `pnpm --filter @festgrid/ui test`; `pnpm --filter web build` and web unit tests -- expected: green

**Manual checks:**
- Re-run `scripts/poc-location-keywords-oneoff3.ts` style comparison against the shipped ladder on the 54 labelled rows: at least 43 correct, no more wrong than the POC's 8.
- On a scratch DB, run a 20-schedule Apply with a stubbed geocoder and confirm the call count and the per-schedule `step=` log lines.
- Open an event detail and a subscribed-account card in the web app: links open a map search on the name/keywords, never a coordinate.
