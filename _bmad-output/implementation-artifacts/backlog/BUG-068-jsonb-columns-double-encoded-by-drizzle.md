---
backlog_id: BUG-068
title: "Every jsonb column written through Drizzle 0.30.10 + postgres.js is stored as a JSON string, not an object"
captured: 2026-10-19
---

# BUG-068 — the double encoding is in the application's own database client, not in the pooler

**Status:** **mechanism reproduced** on a scratch PostgreSQL 16.15 (`apps/backend/scripts/poc-event-insight/probe-jsonb-encoding.ts`, output in `planning-artifacts/event-insight-poc/results/jsonb-encoding-probe.generated.md`). Production shows the effect on `schedules.location_details` (1,460 of 1,460 non-null rows, `prod-findings-and-event-groups-2026-10-19.md` §3); **confirmed on production 2026-10-19 for every column the read-only role can see** (`results/prod-readonly-report-2026-10-19.md`): `schedules.location_details` 1,460 of 1,460, `social_media_account_profiles.default_location` 28 of 28, `events.links` 247 of 247 and `posts.additional_image_urls` 496 of 496 non-null values are JSON strings; **none** is an object or array, so the production writer is still double-encoding. The other 23 columns are inferred from the mechanism, not read.

## Mechanism

1. Drizzle 0.30.10 `PgJsonb.mapToDriverValue` returns `JSON.stringify(value)` (a string).
2. postgres.js 3.4.9 has a built-in serializer for the `json` / `jsonb` parameter types (OIDs 114 and 3802) that stringifies **again**, so the server receives a quoted JSON string and stores a jsonb *string* whose text is the JSON.
3. Drizzle's postgres-js driver 0.30.10 only replaces the serializers of the date/time types (OIDs 1184, 1082, 1083, 1114). Drizzle **0.33.0** also installs a pass-through serializer for 114 and 3802 (`node_modules/drizzle-orm/postgres-js/driver.js` in the 0.33.0 and later tarballs; the 0.31.0 tarball does not have it; versions between were not checked).

| client configuration | Drizzle `jsonb()` insert | plain `$1::jsonb` with a JSON string | `client.json(obj)` |
|---|---|---|---|
| default (`prepare: true`) | **string** | **string** | object |
| `prepare: false` (the pooler setting in `db/client.ts`) | **string** | **string** | object |
| `prepare: false` + `max_lifetime` | **string** | **string** | object |
| serializers 114 and 3802 set to pass-through, either `prepare` | object | object | n/a |

So the pooler / `prepare: false` hypothesis in the production write-up and in AD-36 Rule 11 is **refuted**: the behavior is identical with prepared statements on, and it exists in every database the application writes to, including local development. The code already contains one workaround for the same effect on another column: `apps/backend/src/schema/resolvers.ts:4318–4336` reads `unprocessed_scraper_payloads.context` both ways (`context->>'source'` **or** `(("context"#>>'{}')::jsonb)->>'source'`).

## Scope

27 `jsonb` columns are declared in `packages/database/schema.ts`: `user_locations.location_details`, `social_media_account_profiles.default_location` and `.discovery_source`, `geolocation_cache.result`, `posts.additional_image_urls`, `scraper_actor_runs.raw_input` and `.raw_output`, `events.links`, seven `event_merges` journal columns, three `account_profile_merges` columns, `extraction_audit_logs.events_completeness`, `schedules.location_details`, `default_location_change_requests.previous_location` and `.new_location`, `corrections.proposed_data`, `widgets.filters`, `ai_event_filters.resolved_filter`, `manual_extraction_jobs.request_payload` and `.result_data`. All of them are written through Drizzle's `jsonb()`.

**Why nothing visibly broke:** reads through Drizzle work in every state — postgres.js returns the stored jsonb string as a JS string and Drizzle's `mapFromDriverValue` parses it. What does **not** work is anything evaluated inside PostgreSQL:

| reader | effect today |
|---|---|
| `resolvers.ts:3401–3402` `schedules.location_details->>'adminArea'` / `->>'venueType'` (the AI filter's area and venue-type conditions) | `->>` on a jsonb string returns null (checked), so these conditions cannot be true while the value is a string; BUG-063 (adminArea is never written) is a second, independent reason the area condition finds nothing |
| every planned SQL-side use: area ladder (IDEA-073), target-area resolver (IDEA-081), country counts, `@>` containment, expression indexes | would silently see nothing |
| `event_merges` journal arrays | read back through Drizzle only; `jsonb_array_elements` on a string value raises "cannot extract elements from a scalar" (checked) |

## Fix (two steps, in this order)

1. **Stop writing strings.** Either upgrade Drizzle to ≥ 0.33.0 (a larger upgrade across 0.30 → 0.33; check `drizzle-kit` and the generated migration snapshots) or, as a two-line change in `apps/backend/src/db/client.ts` after the client is created, set the pass-through serializers exactly as the newer driver does:
   ```ts
   for (const oid of ['114', '3802']) (client.options.serializers as Record<string, unknown>)[oid] = (v: unknown) => v;
   ```
   Every other process that creates its own `postgres()` client for application writes (Lambdas, scripts, `packages/database/migrate.ts` callers) needs the same line or a shared factory. No non-test code binds an object to a `::jsonb` parameter by hand (searched `::jsonb`, `to_jsonb`, `jsonb_build`, `sql.json`), and a plain JSON string cast with `$1::jsonb` also stores an object once the serializer is a pass-through (probe row 2).
2. **Convert the stored rows**, after step 1 is deployed (otherwise new rows keep arriving as strings), per column, in batches, inside a maintenance window or off-peak:
   ```sql
   UPDATE schedules SET location_details = (location_details #>> '{}')::jsonb
   WHERE jsonb_typeof(location_details) = 'string' AND left(location_details #>> '{}', 1) IN ('{', '[');
   ```
   The `left(...)` guard leaves a row that is a genuine JSON string untouched. Rehearsed in the probe: after step 1 and before step 2 Drizzle reads old (string) and new (object) rows alike; SQL-side `->>` only matches the new ones; after step 2 both match.

**Migration size for the four visible columns:** 2,231 rows (the remaining columns hold journal and job data; count them with the owner's own role before migrating).

**Verification (read-only, production):** the pack's item "JSON encoding of jsonb columns written through Drizzle" must show only `object` / `array` rows, and `schedules` must report `pinned` and `with_admin_area` the same before and after.

## Notes for the dependent work

- BUG-063 (adminArea never written) and the area filter need this **and** a backfill of the admin area; BUG-066 (wrong-country pins, 379 of 1,460) is a **separate** defect — fixing the encoding does not move a pin.
- AD-36 Rule 9 (location inheritance for group children) stays gated behind this and BUG-066.
- A regression test belongs with the fix: insert an object through Drizzle into each of the four columns of the pack, assert `jsonb_typeof` is `object` / `array`.
