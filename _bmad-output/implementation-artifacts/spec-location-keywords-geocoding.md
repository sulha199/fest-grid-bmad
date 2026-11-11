---
title: 'Location keywords, slice 2a: keyword geocoding ladder, country hint and shared lookup session'
type: 'feature'
created: '2026-11-10'
revised: '2026-11-11'
status: 'in-progress'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/festgrid-architecture-spine.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Geocoding works from one free-text string. Without an account default country Geoapify has no country prior, so Indonesian venues land abroad ("Grand Mercure Yogyakarta" in England, "Karawang" in New York); a wrong account default (Poland, Pennsylvania) then makes today's 300 km filter discard correct matches. The soft `bias=countrycode` added in PR #202 changes no result (POC). A request that geocodes many schedules has a memo only inside one `resolveAccountAndLocations` call, so a re-extract Apply repeats the same lookup once per event. Co-authored posts, where the primary account mostly has no default location (28 of 97 have one), get no help from any default.

**Approach:** Depends on slice 1 (merged, PR #206: keywords and `locationCountryCode` produced, stored and carried). Geocode from the keywords with a 2-step ladder under a country hint (`filter=countrycode:<code>`: the model's code for the string or the post, else a configured platform default; nothing hard-coded to one country), a code-cleaned ladder when keywords are missing, one shared request-scoped lookup session (memo and budget), a recorded per-schedule `location_resolution`, and a kill switch. The map link and UI are slice 2b (`spec-location-keywords-map-link.md`) and do not depend on this slice.

## Boundaries & Constraints

**Always:** Address source per schedule: schedule keywords, schedule `location`, event keywords, event `location`, account default (as today). Country hint, per string, one pure domain function `resolveCountryHint` returning `{code, source}`: (1) the string's `locationCountryCode` from slice 1 (the model's code for that text, or the code most of the post's other strings agree on); (2) else the platform default `DEFAULT_COUNTRY_CODE` (backend env, default "ID", empty = none, already read by slice 1); (3) else none. Source (1) is trusted: a hard `filter=countrycode:<code>` and no unfiltered pass after it found nothing (it returned foreign look-alikes in the POC). Source (2) is a guess: filter first, then one unfiltered pass, so a wrong default costs a lookup, not a wrong place. No hint means unfiltered only. The account's default location and past events are never a country source. Query shape: the `ADDRESS` geolocation query REPLACES `countryBias` with `countryFilter` (hard `filter=countrycode:`, lower-case) in the query type, the Geoapify client and the cache key (`...|filter:<code|none>`; existing entries miss once); `proximity` stays. Keywords ladder: step 1 = all keywords joined with ", "; step 2 = without the most specific (first) one, only with 2 or more keywords and only after step 1 ended in "not found" (including the plausibility filter); an outage is never laddered. Fallback ladder (pure domain function `buildFallbackLocationQueries`, used when a string has no keywords): step 1 = the text with parentheticals, floor/level/unit/RT/RW/street-number noise and country names removed, comma segments kept; step 2 = its last two segments (only with 3 or more segments). Every step is its own cached query (AD-14 Rule 5 negative cache); at most 2 steps per filter pass, so at most 4 uncached lookups per string. No confidence floor: Geoapify confidence does not separate right from wrong (8 correct hits had confidence 0, 3 wrong ones too). Proximity bias and the 300 km plausibility filter keep working but take the account default location only when its country equals the hint's country; otherwise it is ignored for that string (a wrong default would discard correct matches); with no hint it is used as today. Geocode session: a request-scoped object (memo of in-flight and finished queries by cache key, plus a budget of uncached Geoapify calls; cache hits are free) created by the caller and passed through `buildExtractedEventMessage` to `resolveAccountAndLocations`, so de-duplication works across events. API Apply creates it with a budget of 12 calls (a constant); the AI Lambda paths (normal and stepped extraction) pass a session with no budget. When the budget is spent the remaining queries are skipped (text and account timezone kept) and one `geocode-budget-exhausted` line is logged. Recording: new nullable text column `schedules.location_resolution` (migration `--custom`, not a pg enum; TS union `LocationResolution` in `packages/shared-types`) with `kw1|kw2|fb1|fb2` (resolved by that ladder step), `none` (lookups ran, nothing plausible), `skipped` (budget spent or Geoapify outage; a later Apply may resolve it); null = never attempted, a row from before this slice, a feature-off run, or coordinates that came from the account default location. It is written in the same write as `location_details` (carried on the extracted schedule message to `build-event-insert-values` and Apply), cleared with it wherever `location_details` is reset (`submitCorrection`, enrichment in `set-event-primary-post.ts`), and copied by `merge-events.ts` with the schedule. Internal only: not on GraphQL. Also log per schedule `step=kw1|kw2|fb1|fb2|none|skipped`, the hint code and its source (`string|platform|none`). Kill switch: env `KEYWORD_GEOCODING_ENABLED` (default true; only the value `false` turns it off), read in `apps/backend/src/env.ts`. Off: the resolver behaves as before this slice (address = schedule `location`, else event `location`, else account default; proximity from the account default; no country filter, no ladder, no keywords, `location_resolution` stays null), still with the shared memo. Apply makes no Gemini call.

**Decided (2026-11-11, user):** replace the soft `countryBias` with the hard `countryFilter` (no both); ship with the `KEYWORD_GEOCODING_ENABLED` kill switch, default on; Apply budget 12 uncached calls; store the resolving step in `schedules.location_resolution`; country hint = string/consensus code, then platform default (account history deferred); the account default location is used only when its country equals the hint's country, which changes PR #202's behavior for accounts with a wrong default.

**Ask First:** Adding account history or subscriber origin as a country source (most common country of the account's confidently geocoded events, else the country most of its subscribers come from), if the platform default proves wrong too often in a new market; tracked as IDEA-261111-avw (smarter default-country derivation). Changing the Apply budget after measuring real Apply timings.

**Never:** No change to the map link, `LocationLink`, UI or UX docs (slice 2b). No GraphQL exposure of `location_resolution`. No removal of `confidence`/`matchType` from GraphQL or the mapper (Story 0.i7z AC 4 tests cite them). No backfill of existing events. No new geocoding vendor. No change to distance calculation or timezone resolution. No region derived from the account default and appended to a query. No hard-coded country in code or tests (tests use the configured default).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Venue known | keywords `["Pasar Porosjayan","Gamping","Sleman"]`, string code "ID" | step 1 (filter ID, source `string`) resolves; `location_resolution=kw1` | N/A |
| Venue unknown | step 1 not found | step 2 `"Gamping, Sleman"` resolves (area pin); `kw2` | N/A |
| Both fail | steps 1 and 2 not found | no coordinates; text kept; account timezone; `none` | not-found cached per step |
| Foreign venue | `["Doylestown","Pennsylvania"]`, code "US" | filter US; no Indonesian match possible | N/A |
| Single keyword | `["Sleman"]` | one step only | N/A |
| Keywords missing | old row, or the slice 1 call failed, no string code | fallback ladder, platform default as hint: cleaned text filtered, then unfiltered; `fb1`/`fb2` | N/A |
| Wrong account default | default in Poland, venue in Jakarta, string code "ID" | default ignored for that string; resolves in Jakarta | N/A |
| New market | `DEFAULT_COUNTRY_CODE=PH`, string without a code | filter PH first, then one unfiltered pass; no Indonesian assumption anywhere | N/A |
| No hint | no string code, `DEFAULT_COUNTRY_CODE` empty | unfiltered, as today | N/A |
| Outage | Geoapify 5xx/429 on step 1 | error surfaces as today; no step 2; nothing cached; `skipped` | existing best-effort log |
| 20 schedules, 2 places, 3 events | one Apply | at most 2 uncached lookups (4 with ladders), repeats from the session memo across events | N/A |
| Budget spent | many distinct unknown places | later queries skipped, one log line; those schedules `skipped` | schedules keep text only |
| Kill switch off | `KEYWORD_GEOCODING_ENABLED=false` | text geocoding as before this slice, no hint/ladder, `location_resolution` null | N/A |
| Correction | moderator changes a schedule's location text | `location_details` and `location_resolution` cleared together | N/A |
| Merge | two events merged | each schedule keeps its `location_resolution` | N/A |

</frozen-after-approval>

## Code Map

- `packages/domain/src/geolocation/types.ts` (`GeolocationQuery` `ADDRESS`: `countryBias` -> `countryFilter`), `build-cache-key.ts` (+ tests), new pure helpers beside them: `resolveCountryHint`, the keywords-ladder builder, `buildFallbackLocationQueries`; existing `filterPlausibleCandidates` and `selectBestCandidate`
- `apps/backend/src/lib/geolocation/geoapify-client.ts` (`geocodeAddress`: `bias=countrycode` -> `filter=countrycode:` ; proximity bias stays), `adapter.ts`, `cache-store.ts` (+ their tests citing `countryBias`)
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts` -- today's per-call memo (PR #204) becomes the ladder + session consumer; new inputs: schedule/event keywords and `locationCountryCode`
- `apps/backend/src/lib/ai-processor/build-extracted-event-message.ts` :24 (called per event; takes the session in its context); callers: `apply-post-reextraction.ts` (per-event loop, creates the session with the budget), `process-ai-job.ts` and `process-extraction-step.ts` (per-post session, no budget)
- `apps/backend/src/env.ts` (`keywordGeocodingEnabled`; fixtures that build a full `BackendEnv` need the field)
- `packages/database/schema.ts` (schedules, next to `locationDetails`), new migration + snapshot + `_journal.json`, `packages/shared-types/src/index.ts` (`LocationResolution`), `packages/domain/src/events/transform-gemini-response-to-event-info.ts` and `build-event-insert-values.ts`, `apps/backend/src/lib/events/merge-events.ts`, `set-event-primary-post.ts`, `schema/resolvers.ts` (`submitCorrection`)
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` -- AD-14 Rule 1/3 text on the account default as a hard filter, Rule 2 only if it cites the map-link gate (that part is 2b), and new Rule 6; `docs/infrastructure/` if an env page lists backend env values

## Tasks & Acceptance

**Execution:**
- [ ] `packages/domain/src/geolocation/` -- `resolveCountryHint`, keywords-ladder builder, `buildFallbackLocationQueries`, `countryFilter` in the query type and cache key, with tests (100 % domain coverage rule)
- [ ] Geoapify client/adapter/cache -- hard country filter, `countryBias` removed everywhere it appears, tests updated
- [ ] Geocode session (memo + budget) beside the resolver, with tests (in-flight de-dupe, budget, across events)
- [ ] `env.ts` -- `KEYWORD_GEOCODING_ENABLED` (default true); fix the env fixtures
- [ ] `schedules.location_resolution` -- migration (`--custom`; mind the journal `when` ordering ratchet and renumbering), schema, `LocationResolution` type, written with `location_details`, cleared where it is reset, copied on merge, with DB tests
- [ ] `resolve-account-and-locations.ts`, `build-extracted-event-message.ts`, `apply-post-reextraction.ts`, `process-ai-job.ts`, `process-extraction-step.ts` -- precedence, hint, ladders, default-country rule, session, kill switch, per-schedule `step=` log
- [ ] Architecture spine AD-14 re-pointing + Rule 6; the 0.i7z header comments on touched tests (historical story files stay as they are)

**Acceptance Criteria:**
- Given a schedule with keywords whose venue Geoapify does not know, when it is resolved, then the second step's area-level result is used, no more than 2 queries are made for it, and `location_resolution` is `kw2`.
- Given an account default in another country than the string's hint, when the string is geocoded, then the default is not used as proximity or plausibility input for it.
- Given `DEFAULT_COUNTRY_CODE` set to another country and strings without a code, when they are geocoded, then the filter is that country first and no code or test assumes Indonesia.
- Given an Apply of 20 schedules on 2 places across 3 events, when it runs, then at most 2 uncached lookups happen (4 with ladders) and the request finishes inside 28 s; given more distinct places than the budget, then the rest are `skipped` with one log line.
- Given schedules resolved at the keywords' first step, second step, by the fallback ladder, by nothing, or skipped, when saved, then `location_resolution` is `kw1`, `kw2`, `fb1`/`fb2`, `none` or `skipped`, and null for a never-geocoded schedule.
- Given a moderator correction that changes a schedule's location text, when saved, then `location_details` and `location_resolution` are cleared together.
- Given `KEYWORD_GEOCODING_ENABLED=false`, when a post is extracted, then geocoding behaves as before this slice and `location_resolution` is null.
- Given the repo, when searched, then `countryBias` no longer appears in code or cache keys.

## Spec Change Log

- 2026-11-11 (revised after the POC): hard country filter instead of soft bias (the soft bias changed no result), `countryCode` from slice 1, code-cleaned fallback ladder, no confidence floor, default-country rule for the account default.
- 2026-11-11 (country hint, user decision): no hard-coded country. Hint = the model's code for the string (or the post's consensus, filled in slice 1), else the platform default `DEFAULT_COUNTRY_CODE`. Account history deferred; `SubscribedAccountCard` gate kept (2b).
- 2026-11-11 (user decision): store which ladder step resolved a schedule in `schedules.location_resolution` (internal, not exposed).
- 2026-11-11 (approved by the user at Checkpoint 1; the smarter country derivation, from the account's confident events or its subscribers' country, is backlog IDEA-261111-avw and not part of this slice).
- 2026-11-11 (Checkpoint 1 walkthrough, user decisions): split into 2a (this spec: backend) and 2b (`spec-location-keywords-map-link.md`: link and UI); replace `countryBias` with `countryFilter` instead of keeping both; add the `KEYWORD_GEOCODING_ENABLED` kill switch (default on); Apply budget 12 uncached calls.

## Design Notes

Replay of the 54 labelled real locations through the shipped slice 1 generator (no account-region hint) and this ladder design, 2026-11-11: 48 correct / 6 wrong / 0 unresolved (production text query 29 / 9 / 16; code-cleaned ladder 38 / 12 / 4; POC keywords ladder 45 / 8 / 1). Foreign venues got US, JP, SG, US codes. The 6 wrong answers are name collisions (for example "Pakuwon Mall Jogja" resolving to Cirebon) that no ladder variant fixed. About 1.2 Geoapify calls per string on average in that replay (74 calls for 60 rows) against one today; the worst case is 4 per string and is bounded by the budget.

Why a session instead of the cache alone: the cache is one DB round trip per lookup and cannot de-dupe two lookups in flight at once; the session is also where the budget lives. Why 2 steps: the link no longer uses coordinates (2b), so a district-level pin is enough for distance and timezone. Known gap: a spent budget leaves schedules ungeocoded with no automatic second chance; re-running Apply reuses everything cached, and `skipped` marks the rows that need it.

Operational: a market other than Indonesia needs `DEFAULT_COUNTRY_CODE` set, because the account default is ignored when its country differs from the hint. Changing the cache-key shape means one wave of cache misses after deploy.

## Verification

**Commands:**
- Rebuild domain/database dist; backend `tsc`, `lint`, DB tests one file at a time on a scratch DB (`DATABASE_URL` override); domain tests with coverage; web build only if shared types reach the web app -- expected: green

**Manual checks:**
- Replay the 54 labelled rows through the shipped ladder (the maintainer's local script `apps/backend/scripts/replay-keywords-oneoff2.ts` is untracked; it needs `GEOAPIFY_API_KEY` and `SYSTEM_GEMINI_API_KEY`): at least 43 correct and no more than 8 wrong.
- On a scratch DB, run a 20-schedule Apply with a stubbed geocoder and confirm the call count, the budget log line and the per-schedule `step=` log lines.
