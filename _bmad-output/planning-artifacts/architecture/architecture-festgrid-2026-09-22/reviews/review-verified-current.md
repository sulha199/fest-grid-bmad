# Reviewer Gate, lens "verified-current": amended spine text of 2026-10-19

Reviewed: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` at commit `cad868a`. Scope: AD-14 Rules 3a, 4, 5; the "Amended 2026-10-19" paragraphs of AD-30 Rules 5, 7, 10; AD-36 (Rules 1, 3, 4, 6, 7, 9, 10, 11 amended, Rules 12-15 new); AD-37; AD-38; AD-39. Review date: 2026-10-19/20. Only this file was written. Scratch files, a throwaway PostgreSQL 16.15 cluster (outside the repo) and two downloaded npm tarballs were used and are not part of the repo.

## Verdict

The amended text is mostly well evidenced (AD-37's mechanism, the AD-14 production counts and the Riot/SCH/duplicate numbers all check out against code, the npm tarballs and the raw production output), but two committed mechanisms rest on premises that the repo contradicts (AD-38 Rule 5's "live ingestion shares the platform key quota", and AD-36 Rule 14's "SQS DelaySeconds on the notify message"), and AD-36 Rule 13 describes a `Query.events` (score, candidate cap, ids-then-hydrate) that does not exist yet and contains a SQL expression that fails on this schema.

## How to read the tables

- **confirmed**: checked against the code, the installed or downloaded package, a live fetch of the vendor documentation, or a reproduction I ran.
- **contradicted**: the repo, the PRD, or the vendor documentation says something different from the spine wording.
- **could-not-verify**: no source reachable from this sandbox (production database, owner dashboards, unrecorded benchmark), or the claim is a forecast or a decision rather than a fact.
- Production numbers are cited from the repo's own result files. I had no production access.

## Claims checked

### AD-37 (jsonb write path) and AD-36 Rule 11 (mechanism)

| # | Claim | How verified | Result |
|---|---|---|---|
| 1 | drizzle-orm 0.30.10 `jsonb()` `mapToDriverValue` returns `JSON.stringify(value)` | Read `packages/database/node_modules/drizzle-orm/pg-core/columns/jsonb.js` (installed 0.30.10) | confirmed |
| 2 | postgres.js 3.4.9 stringifies again for OIDs 114 and 3802 | Read installed `postgres/src/types.js` (`types.json` to 114, from `[114, 3802]`, `serialize: JSON.stringify`; `typeHandlers` registers the serializer under both OIDs) and `connection.js` Bind | confirmed |
| 3 | Double encoding with `prepare` on and off | Re-ran my own script (installed drizzle 0.30.10 + postgres 3.4.9 against a throwaway PG 16.15): `jsonb()` default string, `prepare:false` string, `customJsonb` object in both | confirmed (independent reproduction) |
| 4 | From drizzle-orm 0.33 the postgres-js driver installs pass-through serializers for 114 and 3802 | `npm view` + downloaded tarballs into empty dirs and grepped `postgres-js/driver.js`: absent in 0.32.2; present in 0.33.0 (lines 15-16), 0.36.4, 0.44.7, 0.45.4 (latest stable), 1.0.0-beta.22. `jsonb` `mapToDriverValue` is still `JSON.stringify` in all of them | confirmed; "from 0.33" is exact (0.33.0 is the first release) |
| 5 | With pass-through serializers `customJsonb` raises `The "string" argument must be of type string…` | Re-ran: installed drizzle with `serializers[114/3802] = identity` set on the client, `customJsonb` insert | confirmed (error text matches; the client assignment simulates what 0.33 does, the 0.33 driver code was read but not executed) |
| 6 | `drizzle-kit generate` is migration-neutral for `customJsonb` | Ran drizzle-kit 0.21.4 `generate` against the current `schema.ts` with a scratch copy of `migrations/` as `out`: "No schema changes, nothing to migrate"; repo working tree untouched | confirmed |
| 7 | `customJsonb` in `packages/database/schema.ts`, all 30 jsonb columns use it | Read lines 14-40; `grep` counts 30 `customJsonb<` columns and 0 plain `jsonb(` calls (the 2 hits are comments) | confirmed |
| 8 | Ratchet `packages/database/jsonb-columns.test.ts` enumerates tables (`is(v, PgTable)`, `getTableColumns`), filters `getSQLType() === 'jsonb'`, fails on `columnType === 'PgJsonb'` | Read the file; package `test` script is `vitest run`; `PgJsonb` is the `columnType` in the installed jsonb.js | confirmed (also executed: `vitest run jsonb-columns.test.ts` passes, 2 tests, on the current schema; the old-schema failure was not re-run) |
| 9 | Regression test `apps/backend/src/schema/jsonb-encoding.test.ts` and probe `probe-jsonb-encoding.ts` exist and match the description | Read both; CI (`.github/workflows/ci.yml`) has a `postgres:16` service | confirmed (CI runs PG 16, production is 17.6) |
| 10 | Versions in use are 0.30.10 / postgres 3.4.9 / drizzle-kit 0.21 | `pnpm-lock.yaml` lines 4839-4843, 6749; installed package.json files | confirmed (drizzle-kit is 0.21.4) |
| 11 | `resolvers.ts:4318-4336` are the defensive `->>` reads | Read: they are in `queryUnprocessedPayloads`; the two defensive predicates sit at 4319-4320 and 4333-4334 | confirmed (block is 4317-4337) |
| 12 | `resolvers.ts:3401-3402` are the `adminArea` and `venueType` `->>` readers | Read | confirmed (exact) |
| 13 | `customJsonb` applied to the 3 `unprocessed_scraper_payloads` columns "since 2026-08-29" | `deferred-work.md` entry says 2026-08-29; `git log -S` shows the repo history starts 2026-10-04 so git cannot confirm it | could-not-verify in git; documented in `deferred-work.md` |
| 14 | Production: 2,231 of 2,231 non-null values are strings; `location_details` 1,460 of 1,460 | Cited from `prod-check-results-review-2026-10-19.md` §1 and BUG-068 | could-not-verify (no production access); consistent across three documents |
| 15 | `->>` on a jsonb string returns null; `jsonb_array_elements` on a string raises | Ran on PG 16.15 | confirmed |
| 16 | No client sets 114/3802 serializers today | `grep` of every `postgres(` construction: none passes `types` or touches `serializers` except the probe | confirmed |
| 17 | The shared unwrap fragment `CASE WHEN jsonb_typeof(c) = 'string' THEN (c #>> '{}')::jsonb ELSE c END` is safe to use in a reader | Ran it on PG 16.15 with the string `"Online"` | contradicted: `invalid input syntax for type json` (see VC-9) |

### AD-36 Rules 13 and 14, AD-30 Rule 10

| # | Claim | How verified | Result |
|---|---|---|---|
| 18 | `coalesce(group_id, -id)` can be the window partition key | `events.id` is `uuid` (`schema.ts:429`), `group_id` is `uuid`; ran the expression on PG 16.15 | contradicted: `operator does not exist: - uuid` (see VC-6) |
| 19 | Window functions (`row_number`, `count`, `bool_or` partitioned by group) can run over a ranked candidate set before `LIMIT/OFFSET` in one query | Ran candidate LIMIT K, windows, cap filter in an outer query, ORDER BY, LIMIT/OFFSET on PG 16.15 (plan: WindowAgg over a Sort over the candidate set, top-N heapsort at the end). The cap filter needs an outer level because a window result cannot be referenced in the WHERE of the level that defines it. The repo already does this for the calendar's windowed mode (`resolvers.ts` ~3600-3625, `dayRank <= perDayLimit`) | confirmed (feasible; needs a subquery/CTE wrapper) |
| 20 | `Query.events` today has "the per-event score", a "ranked candidate set" with a cap K, and "ids-then-hydrate (IDEA-076)" | Read `resolvers.ts` 3190-3882 and the backlog | contradicted (see VC-3): no score, no K, no ids-then-hydrate; IDEA-076 is the maintained next-open-date column, the id-first pattern is IDEA-080 |
| 21 | Measured cost +2 to +4 ms at K = 3,000, 16.15, JIT off | The benchmark script and output are not in the repo (`grep` for `row_number`/`partition by` finds only the spine, memlog, epics). Re-measured on a 10,000-row synthetic table, uuid keys, `work_mem` 2184kB (production's value): baseline 1.19 ms, cap 4.8 ms, cap + count + bool_or 5.4 ms at K = 3,000; 1.14 / 9.6 / 14.3 ms at K = 10,000 | confirmed in order of magnitude (+3.6 to +4.3 ms at K = 3,000 here); the original run is unrecorded |
| 22 | PostgreSQL version difference (production 17.6, scratch 16.15) does not matter | Production version from `prod-readonly-report-2026-10-19.md` line 12 (17.6, JIT off, work_mem 2184kB, 1 parallel worker). PostgreSQL 17 release notes list no window-function or WindowAgg change; nothing measured on 17 | could-not-verify (no documented change in 17; nothing measured on 17) |
| 23 | SQS maximum `DelaySeconds` is 900; standard queues honor per-message delay; FIFO does not | AWS docs "Amazon SQS message timers" (fetched): maximum 15 minutes, "FIFO queues don't support timers on individual messages"; installed `@aws-sdk/client-sqs` 3.1106 `SendMessageRequest.DelaySeconds` "0 to 900"; CDK queues are standard (no `fifo`) | confirmed |
| 24 | The repo's SQS helpers can pass `DelaySeconds` | Read `send-sqs-message.ts` (`sendSqsMessage(queueUrl, body)` builds `SendMessageCommand({QueueUrl, MessageBody})`) and `send-sqs-message-with-retry.ts` (forwards only `queueUrl, body`) | contradicted (needs a third parameter; the `setSendSqsMessage(fn: typeof sendSqsMessage)` seam type changes with it) |
| 25 | Notifications are sent from an SQS "notify message" | `notifyNewEvent` is called inline in `processIngestionJob` (`process-ingestion-job.ts:181`), which the ingestor Lambda awaits; it sends FCM directly (FIND-061). No notify message type or queue exists; `docs/infrastructure/architecture-diagram.md` line 104 agrees | contradicted (see VC-2) |
| 26 | A delay of "about 60 to 120 seconds" is what the user gets | CDK `festgrid-backend-stack.ts` ~548-625: in prod there is no `SqsEventSource`; each queue is drained by a 5-minute EventBridge poll-and-drain (FIND-034); `pollAndDrainQueue` stops at the first empty receive | contradicted for prod (effective latency is the next 5-minute tick after the delay expires) |
| 27 | PRD says "push notifications are sent per event, not per post" | `prd.md` line 96: "Push notifications are sent per event, not per post." | confirmed |
| 28 | `notifyNewEvent` is the only claim point, `UPDATE ... WHERE notified_at IS NULL RETURNING` | Read `notify-new-event.ts` | confirmed |

### AD-38 Rule 5 (Gemini budget) and AD-10 / AD-32 interplay

| # | Claim | How verified | Result |
|---|---|---|---|
| 29 | Flash Lite is 500 requests/day and 20/minute; non-lite Flash 20/day | Google rate-limits page (fetched 2026-10-19): lists no per-model free-tier numbers, points to AI Studio; limits "applied per project, not per API key"; RPD "reset at midnight Pacific time"; "Specified rate limits are not guaranteed". Provenance in the repo: "stated by the owner on 2026-10-19" (`gemini-usage.sql` header, memlog line 82) | could-not-verify (user-reported; docs neither confirm nor contradict) |
| 30 | The spine's "Flash Lite" and "Flash" are the models the code uses | `env.ts:224` `GEMINI_MODEL` default `gemini-3.5-flash-lite` (extraction); `env.ts:227` `GEMINI_FILTER_MODEL` default `gemini-3.5-flash` (AI prompt filter only); `.env.example` agrees. Models page: `gemini-3.5-flash-lite` Stable. Deprecations page: `gemini-3.5-flash` released 2026-05-19, no shutdown date, replacement `gemini-3.6-flash`, "automatically routes API requests to gemini-3.6-flash" (fetch summary of a flattened table: moderate confidence); the models page lists `gemini-3.6-flash` and `gemini-3.8-flash` (2026-09-02) but not `gemini-3.5-flash`. Production values of the env vars are not visible (CDK passes `process.env.GEMINI_MODEL`) | confirmed for names in code; could-not-verify for production env |
| 31 | Live ingestion shares the Flash Lite budget through the platform-funded `SYSTEM_GEMINI_API_KEY` (AD-10) via the AD-32 wrapper | AD-10 Prevents text; PRD §3.7 line 83 ("exclusively for default-location inference ... does not extend to general post-extraction processing, which remains BYOK-only"); code: `process-ai-job.ts:142` calls `callGemini`, which selects only subscriber keys (`fetchCandidateKeys`); the system key is reachable only from `callGeminiForLocationInference` and `callGeminiForAccountClassification` (`system-key-adapter.ts`) | contradicted (see VC-1) |
| 32 | "Live use is about 47 posts per day (2,337 posts over 7 weeks)" | 2,337 is the `posts` table row count (`prod-findings-and-event-groups-2026-10-19.md` line 18), i.e. every scraped post, not Gemini extractions; posts with a non-null `grouping_reason` number 880 (738+61+47+29+5) | contradicted as an extraction count; it is a ceiling proxy for post volume |
| 33 | "Forecast about 813 posts per day, above one 500-per-day key" | 24,403 / 30 = 813 from the `fest-grid-monetization` forecast (`proposal-posthog-and-list-scale.md` §2); that repo was not reachable | could-not-verify; and "key" should read "Google project" (per-project limit) |
| 34 | The backfill may re-extract on the platform key | PRD line 1648: unpaid keys' content, images included, may be used by Google; face blur before the vendor is required (FR115); billing tier unverified (FIND-066) | could-not-verify (billing tier of the key unknown); no blur or billing check is stated in AD-38 Rule 5 |

### AD-14 Rules 3a, 4, 5, AD-39

| # | Claim | How verified | Result |
|---|---|---|---|
| 35 | Geoapify returns `rank.confidence` and `rank.match_type`; the mappers spread them | Geoapify forward-geocoding docs (fetched) and `geoapify-client.ts` `mapGeocodeResult` (conditional spread), `getPlaceDetails` (synthetic `confidence: 1` / `PLACE_ID_EXACT`) | confirmed |
| 36 | `bias=countrycode:xx` is a soft preference | Geoapify docs: bias "prioritize"; `filter` is "hard result filters"; the repo's own `results/geocode-probe-2026-10-19.md` shows the `filter` variant gives the same PLN-office answer at 0.66 for "DIY & Jawa Tengah" | confirmed (Rule 3a stands; switching to `filter` is not a fix) |
| 37 | `geoapify-client.ts` sends the bias as `&bias=countrycode:${countryBias}` | Read line ~60 | confirmed |
| 38 | `isLocationTrustworthy` is "the confidence-only" predicate | Read `packages/domain/src/geolocation/is-location-trustworthy.ts`: `confidence != null && confidence >= 0.5 && matchType === 'full_match'` | contradicted (see VC-4) |
| 39 | `resolve-account-and-locations.ts` falls back to the account default location with no provenance | Read all 78 lines: `schedule.location || explicitTopLevelLocation || defaultLocation.formattedAddress ?? placeName`, geocoded with `countryBias: defaultLocation?.countryCode`; the result goes into `resolvedScheduleLocations` with no source flag. Applies to every account type, not only curators; the default's text is re-geocoded, not copied as an object | confirmed (with the nuances) |
| 40 | `schedules` has no `location_source`, `pin_trust`, `location_precision`; `events` no `area_status` | `grep` of `schema.ts`: none | confirmed |
| 41 | `adminArea` is read at `resolvers.ts` ~3401 and never written | Read; `grep` of writers: only `seed-volume.ts` writes it; the Geoapify mapper does not | confirmed |
| 42 | 627 of 1,460 pins under 0.5; 129 of 343 outside ≥ 0.5, 83 at 1.00; 413 of 959 inside < 0.5; 214 of the first 333 from accounts with no default; equal country in 15 | Raw output `results/confidence-by-country-box-prod-2026-10-19.txt`: 214 = 118+55+41, 129 = 44+2+83, 413 = 220+106+87; the 333 is the sum of the query's `LIMIT 30` rows, 214 of them "(account has no default location)", 15 = lb/lb 7 + us/us 5 + in/in 3 | confirmed arithmetic; wording issue in VC-8 |
| 43 | "Atrium & Plaza Rama, Sleman City Hall" fails at 0.00; "DIY & Jawa Tengah" gets a PLN office at 0.66; "Online" geocoded | Same raw output and `geocode-probe-2026-10-19.md`: 5 schedules at 0.00 (US); PLN 0.66; "Online" answered in France at 1.00 (5 schedules) | confirmed |
| 44 | "Zoom", "Google Meet" are non-places sent to the geocoder in production | Only "Online" appears in production rows; Zoom and Google Meet come from POC extraction output (`poc-report.md`, BUG-064), whose own text says the pipeline effect was inferred | could-not-verify for production |
| 45 | 11 of the 17 production curators hold an arbitrary default; 463 legacy accounts | `prod-check-results-review-2026-10-19.md` lines 28, 79 (466 legacy, 463 without a default) | confirmed against the review; production not reachable |
| 46 | Matcher: 446 pairs, 178 reachable, 23 candidates (12.9%), 0 of 122 stub pairs, 160 legacy, 107 more than 2 days apart, 29 unexplained, 147 pending / 0 merges | `prod-check-results-review-2026-10-19.md` §10.1 | confirmed against the review; production not reachable |
| 47 | 47 `program-lineup` posts; the same caption extracted as 7 events and as 10 | `prod-findings-and-event-groups-2026-10-19.md` lines 21, 45 (posts `4936055f` vs `e464fcc3`, 418 characters) | confirmed |
| 48 | "Production showed one event holding three schedules at three venues (Riot Jogja)" | No result file contains row-level evidence; `events-multi-place.sql` (Round 3 item 11) is not yet run; `series-candidates.sql` frames the same names as separate events | could-not-verify (product-owner report; see VC-8) |
| 49 | `drizzle-kit` 0.21 drops partial-index `WHERE` predicates (relevant to AD-36 Rule 1's partial index on `events.group_id`) | Generated a migration for a schema with `index(...).where(sql...)` using the installed 0.21.4: output is `CREATE INDEX ... ("group_id")` with no predicate | confirmed (and AD-36 Rule 1 does not say hand-write it; see VC-7) |
| 50 | Named code objects exist (`CURATOR_GUIDE`, `ORGANIZER_VENUE_EVENT`, `selectBestCandidate`, `isOrganizerAuthoredPost`, `findMatchingEvent`, `enrichAndPromoteEvent`, `mergeEvents`, `undoEventMerge`, `event_match_candidates`, POC `mayUseAccountLocation`, `tierFor`, `relation`) | `grep` over `packages`, `apps/backend/src`, `apps/backend/scripts` | confirmed |
| 51 | Latest versions: drizzle-orm 0.45.4 stable (1.0.0-beta.22 beta), drizzle-kit 0.31.11, postgres.js 3.4.9, PostgreSQL minors 16.15 / 17.11 / 18.6 | `npm view`; postgresql.org versioning page | confirmed; the repo pins drizzle-orm 15 minors and drizzle-kit 10 minors behind; production 17.6 is 5 minors behind 17.11 (managed host) |

Totals, each row counted once by its dominant result: 51 claims. **Confirmed 34. Contradicted 9** (rows 17, 18, 20, 24, 25, 26, 31, 32, 38). **Could-not-verify 8** (rows 13, 14, 22, 29, 33, 34, 44, 48). Row 30 is confirmed for the names in code and unverifiable for the production environment values (listed under "What I could not verify").

## Findings

### Critical

#### VC-1. AD-38 Rule 5 builds its quota budget on a key that live ingestion does not use

Spine wording at fault (AD-38 Rule 5, Budget bullet): "Flash Lite is **500 requests per day and 20 per minute**, shared with live ingestion (the platform-funded `SYSTEM_GEMINI_API_KEY`, AD-10, through the AD-32 wrapper). The backfill budget is 500 minus the day's live use ... Live use is estimated at about 47 posts per day (2,337 posts over 7 weeks) ... Forward risk: the Phase 0+1 forecast is about 813 posts per day, above one 500-per-day key, so the daily quota, not the database, is the first ingestion scaling limit."

Evidence:
- AD-10 exists to keep the system key **out of** the general post-extraction path ("Prevents: This key being reachable from the general post-extraction path"). PRD §3.7 (line 83): the system key "is used exclusively for default-location inference ... it does not extend to general post-extraction processing, which remains BYOK-only".
- Code: `process-ai-job.ts:142` calls `callGemini`, which selects among subscriber keys via `fetchCandidateKeys('gemini', subscriberUserIds)`. `SYSTEM_GEMINI_API_KEY` is reachable only from `callGeminiForLocationInference` and `callGeminiForAccountClassification` (`system-key-adapter.ts`) after `AiGatewayExhaustedError`.
- So "500 minus the day's live use" has no live-use term on that key (live extraction draws on contributors' own keys and their own Google projects), and the backfill would need a **new** path to the system key that AD-10 deliberately fences. FIND-090 shows the only recorded heavy use of the system key is the POC's own runs ("hundreds of POC calls and rate-limited").
- The 47-per-day figure is the `posts` table row count over the snapshot (every scraped post), not extractions (880 posts have a `grouping_reason`), and `gemini-usage.sql` itself calls `extraction_audit_logs` a lower bound of Gemini use.
- The 500/day and 20/minute numbers are the owner's statement (memlog line 82; `gemini-usage.sql` header), not documentation. Google's rate-limit page publishes no per-model free-tier numbers (they are visible only in AI Studio) and says "Specified rate limits are not guaranteed". The limits apply "per project, not per API key" and daily quotas "reset at midnight Pacific time".
- The forward-risk sentence assumes platform-funded extraction; the PRD is BYOK and flags the platform-paid assumption as under review (CC-032, PRD line 1648).

Proposed replacement wording:
> **Budget.** The re-extraction needs a Gemini key. Live extraction is BYOK and does not use `SYSTEM_GEMINI_API_KEY` (AD-10, PRD §3.7), so the backfill may not assume "500 minus live use" on that key. Either (a) an AD-10 amendment and a PRD sentence allow the system key to serve this backfill, in which case the budget is the key's own quota minus its other users (location inference, account classification, the AI filter fallback; measured by `gemini-usage.sql`, Round 3 item 12, not yet run), or (b) the backfill runs on contributors' keys under their quotas. `[ASSUMPTION]` Flash Lite is 500 requests/day and 20/minute and the non-lite model 20/day, as stated by the owner on 2026-10-19 from AI Studio; Google's documentation lists no per-model free-tier numbers, quotas apply per Google project (not per key) and reset at midnight Pacific time, so the backfill day boundary is Pacific, not UTC or local. Re-read the numbers in AI Studio on the day the backfill is sized. The backfill uses the extraction model (`GEMINI_MODEL`, default `gemini-3.5-flash-lite`), never the filter model (`GEMINI_FILTER_MODEL`, default `gemini-3.5-flash`).
> **Forward risk.** The Phase 0+1 forecast (about 813 posts per day, `fest-grid-monetization` model, not re-verified) matters only if extraction becomes platform-funded (CC-032); under BYOK the limit is per contributing key.

#### VC-2. AD-36 Rule 14 / AD-30 Rule 10: the delayed notify message has no queue, no sender support, and in production no 60-120 second delay

Spine wording at fault (AD-36 Rule 14): "**Sent after a short delay**, about 60 to 120 seconds (an SQS `DelaySeconds` on the notify message). Ingestion runs one message per event ..." and AD-38 Rule 3's flowchart node "Delayed notify claim per group and source post 60 to 120 s".

Evidence:
- There is no notify message. `notifyNewEvent` runs inline inside `processIngestionJob` after the commit and calls FCM directly (`process-ingestion-job.ts:176-193`, FIND-061: it must be awaited because the Lambda freezes after return). `docs/infrastructure/architecture-diagram.md` line 104 says the same.
- `sendSqsMessage(queueUrl, body)` and `sendSqsMessageWithRetry(queueUrl, body, options)` cannot pass `DelaySeconds` (see row 24). Adding it is small but changes the `setSendSqsMessage` seam type used by existing tests.
- A delayed message needs either a new queue (CDK `Queue` + DLQ + consumer wiring + IAM grants, and per CLAUDE.md §4 an update of `docs/infrastructure/architecture-diagram.md` and `high-level-overview.md` in the same change) or a discriminated message type on `DataIngestionQueue` (`ingestor.ts` parses every body as `ExtractedEventMessage`).
- In production the consumers are not event-source-mapped: `festgrid-backend-stack.ts` (comments at ~548-553) replaced `SqsEventSource` with a **5-minute EventBridge poll-and-drain** after the FIND-034 free-tier incident. `pollAndDrainQueue` stops at the first empty receive (`WaitTimeSeconds: 20`), so a message delayed 60-120 s is received on a later tick. The real latency is the delay plus up to one 5-minute cycle, and in dev/staging (ESM off by default) it is the delay only.
- The AWS facts themselves are right: maximum 900 s, per-message `DelaySeconds` on standard queues, not on FIFO.

Proposed replacement wording (Rule 14, second bullet):
> **Sent after a delay.** Today `notifyNewEvent` runs inline in the ingestor and no notify message exists. Delivery is deferred by enqueuing a notify message with SQS `DelaySeconds` (standard queues only, maximum 900 s). The send helper `sendSqsMessage` and its retry wrapper gain an optional `delaySeconds` argument. The queue is `[ASSUMPTION]` the existing `DataIngestionQueue` with a message-type discriminator in `ingestor.ts`, to avoid a new queue and its CLAUDE.md §4 documentation change. Because prod consumers run on a 5-minute poll-and-drain (FIND-034), the user-visible delay is the `DelaySeconds` value plus up to one drain cycle; the value (start 60 s) is therefore a lower bound, not a promise. Sizing it against the drain cadence is story time.

### High

#### VC-3. AD-36 Rule 13 describes a `Query.events` that does not exist yet; the cost figure and an IDEA id are attached to the wrong things

Spine wording at fault: "`Query.events` stays one query: the per-event score as today, then window functions ... over the already ranked candidate set, then the cap ... With ids-then-hydrate (IDEA-076) the id list also carries `group_id` ... keep K at or below 3,000."

Evidence:
- `Query.events` today (`resolvers.ts` 3733-3841) has no per-event score and no candidate set: it orders by a correlated-subquery next-schedule-date key (3820-3836) with `LIMIT qLimit+1 OFFSET qOffset`, selecting full rows from `events`/`schedules`/`posts`/profiles; BUG-067 records that this order has no tie-break; `totalCount` is a separate `count()` on `whereClause`.
- The candidate cap K ("start at 1,000-3,000"), per-user scoring and ids-first hydration are proposals in `proposal-posthog-and-list-scale.md`. IDEA-076 is "maintained next-open-date column, open-events index, id tie-break"; the ranked-ids-then-hydrate pattern is **IDEA-080**, which "depends on IDEA-076".
- The group-level "seen" is described as "the only place a group needs its own score input", but the windows are said to run "over the already ranked candidate set": if seen changes the score, `row_number` (cover choice) must run after the seen window and the rescoring, so two sort passes are needed and the 4.8 ms figure may not cover that shape.
- The cap changes who appears on a page; the existing `totalCount` (count on `whereClause`) would then disagree with the list. Nothing reads `totalCount` today (FIND-088), so this is a note, not a blocker.
- The measurement is not reproducible from the repo (no script, no output file). My re-run reproduces the magnitude (rows 21).

Proposed replacement wording:
> **No double fetch.** `[ASSUMPTION]` Rule 13 is specified for the ranked `Query.events` of IDEA-074 / IDEA-076 / IDEA-080, which is not built; today's `Query.events` orders by next schedule date with `LIMIT/OFFSET` and has no score or candidate cap. On that future shape the list stays one query: candidate set (cap K), per-event score, then window functions over the candidate set, then the cap in an outer query, then the final order and `LIMIT/OFFSET`. If a series' group-level "seen" feeds the score, the `bool_or` window runs before the rescore and the `row_number` after it. With the ranked-ids mode (IDEA-080, after IDEA-076) the id list carries `group_id`, name, kind and `matching_count`. The `totalCount` field is computed with the same cap or dropped (FIND-088). The cost figures below are synthetic; the script and output are to be stored under `event-insight-poc/results/` (Round 3).

#### VC-4. AD-14 Rule 4 mis-describes the existing trust predicate and omits the `matchType` clause and the `PLACE_ID_EXACT` case

Spine wording at fault (Rule 4): "`isPinTrusted()` ... (the confidence-only `isLocationTrustworthy` becomes its first leg) is true only when: (a) the stored confidence reaches the floor (start value 0.5, uncalibrated ...)".

Evidence:
- `is-location-trustworthy.ts` requires `confidence >= 0.5` **and** `matchType === 'full_match'` (`TRUSTWORTHY_MATCH_TYPE`). It is not confidence-only.
- `getPlaceDetails` sets the synthetic `matchType: 'PLACE_ID_EXACT'` (AD-14 Rule 1), which fails the `full_match` test even at `confidence: 1`, so user-picked places are untrusted today; no test covers it.
- Production: `full_match` accompanies confidence 0.00 (320 of 379 outside-the-box pins are `full_match`), and Geoapify documents `match_type` as "whether the result matches the requested address level, not whether all address components are correct". The clause is therefore either decorative or harmful; the spine has to say which.
- Geoapify also documents `confidence_city_level` and `confidence_street_level` and cautions that "when the result has low confidence, it doesn't mean that it's incorrect" (its own sample uses 0.95 accept / 0.2 decline and separate levels). The mapper stores none of them. AD-14 marks the floor `[ASSUMPTION]`, which is right; the spine does not say that the vendor suggests per-level thresholds.

Proposed replacement wording:
> `isPinTrusted()` in `packages/domain` extends today's `isLocationTrustworthy` (`confidence >= 0.5` and `matchType === 'full_match'`). Decide at story time whether the `full_match` clause stays (production shows `full_match` at confidence 0.00) and treat `PLACE_ID_EXACT` as trusted (it fails the current test). `[ASSUMPTION]` leg (a) uses the overall confidence; Geoapify also returns `confidence_city_level` and `confidence_street_level`, which the mapper does not store and which may separate the wrong-country cases better than the overall value. Calibrate against `confidence-by-country-box`.

#### VC-5. AD-38 Rule 5 states the Gemini limits as facts and names models without ids

Covered together with the other quota points in VC-1; this finding is the narrower edit to the "Gemini Flash Lite re-extraction" and "Never the non-lite model (20 requests per day)" lines: name the ids and provenance. The extraction default `gemini-3.5-flash-lite` is a Stable model on Google's models page; `GEMINI_FILTER_MODEL` defaults to `gemini-3.5-flash`, which the deprecations page lists as released 2026-05-19, no shutdown date, replaced by `gemini-3.6-flash` ("not available to select in Google AI Studio; the endpoint ... automatically routes API requests to gemini-3.6-flash"; fetch summary of a flattened table, moderate confidence) and which no longer appears on the models page. "Non-lite Flash 20/day" therefore may describe a different served model than the id the code requests, and the AI prompt filter, a user-facing feature, spends that same non-lite quota.

Proposed replacement wording:
> Step 2, **re-extraction on the extraction model** (`GEMINI_MODEL`, default `gemini-3.5-flash-lite`, Stable) only for the residual. Never on `GEMINI_FILTER_MODEL` (default `gemini-3.5-flash`, an alias that Google's deprecation page says routes to `gemini-3.6-flash`; owner-stated 20 requests/day, and the user-facing AI prompt filter spends the same quota).

### Medium

#### VC-6. `coalesce(group_id, -id)` is not valid SQL on this schema

Spine wording (AD-36 Rule 13): "window functions (`row_number`, `count`, `bool_or` partitioned by `coalesce(group_id, -id)`)". `events.id` and `events.group_id` are `uuid`; PostgreSQL has no unary minus for uuid (`ERROR: operator does not exist: - uuid`, reproduced on 16.15). The expression presumably came from the integer-keyed synthetic table.

Replacement: "partitioned by `coalesce(group_id, id)` (both `uuid`; an ungrouped event is its own partition)". My re-measurement used this form with uuid keys.

#### VC-7. AD-36 Rule 1's partial index on `events.group_id` is silently dropped by drizzle-kit 0.21.4

Spine wording: "`events.group_id` is indexed `WHERE group_id IS NOT NULL AND deleted_at IS NULL`" and Rule 13's "separate on-demand query on the partial index of Rule 1". Reproduced: drizzle-kit 0.21.4 emits `CREATE INDEX ... ("group_id")` with no predicate. AD-30 Rule 1 already says to hand-write partial predicates (AD-8 Rule 3); AD-36 does not. A full index still serves the on-demand query but it is not what the text says and a later `generate` may diverge.

Replacement: append "hand-written in the migration SQL, as AD-30 Rule 1 does (drizzle-kit 0.21 drops `WHERE` predicates; re-checked 2026-10-19 on 0.21.4)".

#### VC-8. Wording and provenance of three production claims

1. AD-14 Rule 3a: "of the first 333 **wrong-country** pins". The source is "outside Indonesia's bounding box" (lat -11.5..6.5, lon 94.5..141.5). The same output shows legitimate foreign events (Denmark 27, Egypt 13, Lebanon accounts with a Lebanon default 7) and 38 of the 333 have no pin country at all; the "inside" box also contains parts of neighbouring countries. The 333 is the sum of the query's `LIMIT 30` rows (333 of 379 outside pins). The arithmetic is right; the label is not.
   Replacement: "of the 333 pins outside Indonesia's bounding box that the check listed (some are legitimate foreign events), 214 (64%) come from accounts with no default location ..." and likewise "outside/inside the box" in Rule 4.
2. AD-14 Rule 5: "Online", "Zoom", "Google Meet". Only "Online" (5 schedules, answered in France at 1.00) is in production data; Zoom and Google Meet are POC extraction outputs. Mark them "(Zoom and Google Meet: seen in POC extraction output, not yet in production rows)".
3. AD-30 Rule 5 and AD-38: "production showed one event holding three schedules at three venues (Riot Jogja 'Wednesday Night Run')". No result file holds this row; the prevalence queries (`events-multi-place.sql`, `series-candidates.sql`) are not yet run, and `series-candidates.sql` frames the same names as separate events. Replacement: "reported by the product owner (Riot Jogja 'Wednesday Night Run'); prevalence unmeasured until Round 3 items 11 and 13".

#### VC-9. AD-37 Rule 5's shared unwrap fragment fails on non-JSON strings

Spine wording: "`CASE WHEN jsonb_typeof(c) = 'string' THEN (c #>> '{}')::jsonb ELSE c END`". For a jsonb string whose text is not JSON (`"Online"`) it raises `invalid input syntax for type json` and aborts the whole statement (reproduced). The migration runbook and the check query `confidence-by-country-box.sql` guard with `left(c #>> '{}', 1) IN ('{','[')`; the spine's version is weaker than the one the project already uses.

Replacement: "`CASE WHEN jsonb_typeof(c) = 'string' THEN (CASE WHEN left(c #>> '{}', 1) IN ('{','[') THEN (c #>> '{}')::jsonb END) ELSE c END` (the guard matches `02-apply.sql`; an unguarded cast aborts the statement on a non-JSON string)".

#### VC-10. AD-37 omits the two readers that already exist and the age of the Drizzle pin

- `resolvers.ts:3401-3402` (`adminArea`, `venueType` over `schedules.location_details`) are SQL-side readers that return null for every old production row today. `venueType` is written by the Geoapify mapper, so the `venueType` filter is blind in production until the row migration; `adminArea` is separately never written (BUG-063). AD-37's "Prevents" and its Deferred list mention BUG-063 but not these existing readers or that they are the natural post-migration check.
  Replacement (Rule 4, verification): add "`Query.events` filters on `venueType` (and `adminArea` after BUG-063) return rows".
- "Considered and rejected: upgrading Drizzle to 0.33 or later now (... a version bump ... for one defect)". The pin is drizzle-orm 0.30.10 (latest stable 0.45.4, beta 1.0.0-beta.22) and drizzle-kit 0.21.4 (latest 0.31.11). The pin is the cause of several hand-written workarounds in the spine (partial index predicates, operator classes, deferrable FKs). The rejection is reasonable for this change, but the reason should name that accumulation and the current versions, so a future upgrade decision is made with them in view. Both pass-through serializers stay in every later version I checked (0.36.4, 0.44.7, 0.45.4, 1.0.0-beta.22), so the Rule 3 gate does not expire.

### Low

- **VC-11.** AD-37 "Verified" says pass-through serializers were applied on the client in the probe. That simulates 0.33; it is now also confirmed from the 0.33.0 tarball (`driver.js` lines 15-16). Add the tarball evidence to the line. Also note that CI runs `postgres:16` while production is 17.6.
- **VC-12.** AD-37 Binds: "`resolvers.ts:4318-4336`" is the block 4317-4337 (defensive predicates at 4319-4320 and 4333-4334). Cosmetic; line numbers drift, cite the function `queryUnprocessedPayloads`.
- **VC-13.** AD-37 Rule 1: "since 2026-08-29". Git history starts 2026-10-04, so only `deferred-work.md` supports the date. Cite that file.
- **VC-14.** AD-36 Rule 13: "PostgreSQL 16.15 ... local" versus production 17.6 (JIT off, `work_mem` 2184kB, 1 parallel worker). PostgreSQL 17's release notes name no window-function change, so no change is expected, but nothing was measured on 17; say so. My re-run at `work_mem` 2184kB gave 4.8 ms for the cap at K = 3,000 against the spine's 3.1 ms, so state the value as "about +2 to +4 ms".
- **VC-15.** AD-38 Rule 5 should require the re-extraction to pass through the same face-blur-before-AI step (`blurFacesBeforeAi`) as live extraction and to state the key's billing tier; PRD line 1648 says unpaid-tier content, images included, may be used by Google and the tier of the platform key is unverified (FIND-066).
- **VC-16.** AD-39 Rule 3: "the legacy 463 accounts". The population is 466 legacy accounts, 463 without a default location (IDEA-075 acts on those 463). Say "463 of the 466 legacy accounts (those without a default location)".
- **VC-17.** AD-39 Rule 3 / "Prevents": the account-default fallback is applied by `resolveAccountAndLocations` to every account type and re-geocodes the default's text rather than copying its object. Say so, so BUG-065's fix scope (curators only) is not read as "the code only does this for curators".
- **VC-18.** Currency notes with no action needed now: PostgreSQL minors current are 16.15, 17.11, 18.6 (production 17.6 is managed by the host); `@aws-sdk/client-sqs` 3.1106 exposes `DelaySeconds`; postgres.js 3.4.9 is the latest release.

## What I could not verify

- Any production figure (no production access); every production number above is checked only against the repo's result files and, where raw output exists, against that output.
- The owner's Gemini limits and which Google project and key they belong to.
- The original window-function benchmark (not in the repo); only a re-measurement.
- Production values of `GEMINI_MODEL` and `GEMINI_FILTER_MODEL` (CDK forwards `process.env`).
- The `fest-grid-monetization` forecast behind 813 posts per day.
- The claim that `gemini-3.5-flash` auto-routes to `gemini-3.6-flash` rests on a model-summarised fetch of a flattened table.
- The DB regression test `jsonb-encoding.test.ts` was read, not executed (my own script reproduces the same behaviour). The ratchet test was executed and passes.
