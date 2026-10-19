---
backlog_id: BUG-068
title: "Every plain jsonb() column written through Drizzle 0.30.10 + postgres.js is stored as a JSON string, not an object"
captured: 2026-10-19
---

# BUG-068 — the double encoding is in Drizzle's `jsonb()` type, not in the pooler, and the repository already has the fix for three columns

**Status:** mechanism **reproduced** (scratch PostgreSQL 16.15, `apps/backend/scripts/poc-event-insight/probe-jsonb-encoding.ts`, output `planning-artifacts/event-insight-poc/results/jsonb-encoding-probe.generated.md`) and **confirmed on production 2026-10-19** for every column the read-only role can see: `schedules.location_details` 1,460 of 1,460, `social_media_account_profiles.default_location` 28 of 28, `events.links` 247 of 247, `posts.additional_image_urls` 496 of 496 non-null values are JSON strings; **none** is an object or array, so the production writer is still double-encoding. The other 23 columns are inferred from the mechanism, not read.

**Decided 2026-10-19 (product owner, on my recommendation):** fix at the write path **ahead of the personalization work**, then convert the stored rows. **The mechanism I first recommended was changed the same day, after finding the history below**: extend the in-house `customJsonb` type to the 27 columns instead of a client-level serializer. Nothing is implemented yet; this note is the implementation spec.

## History the first analysis missed

`deferred-work.md` (2026-08-29, "unprocessed_scraper_payloads.context is double-JSON-encoded") records the same bug on three columns. It was fixed at the source with `customJsonb` (`packages/database/schema.ts`: `toDriver` hands the **raw object** to postgres.js, which serializes it once; `fromDriver` parses a legacy string), "applied only to this table's three jsonb columns, not schema-wide", with defensive reads in two resolver filters (`resolvers.ts:4318–4336`), a regression test (`apps/backend/src/schema/jsonb-encoding.test.ts`), and **no data migration**. That entry attributed the cause to `prepare: false`; the probe shows it is independent of it. BUG-068 is the schema-wide completion of that fix, plus the data migration it deferred.

## Mechanism

1. Drizzle 0.30.10 `PgJsonb.mapToDriverValue` returns `JSON.stringify(value)` (a string).
2. postgres.js 3.4.9 has a built-in serializer for the `json` / `jsonb` parameter types (OIDs 114 and 3802) that stringifies **again**, so the server stores a jsonb *string* whose text is the JSON.
3. Drizzle's postgres-js driver only neutralizes the date types in 0.30.10; from 0.33.0 it also installs a pass-through serializer for 114 and 3802 (present in the 0.33.0 tarball, absent in 0.31.0; versions between not checked).

| client / column configuration | Drizzle `jsonb()` insert | `$1::jsonb` with a JSON string | `customJsonb` insert |
|---|---|---|---|
| default (`prepare: true`) | **string** | **string** | — |
| `prepare: false` (what `db/client.ts` uses) | **string** | **string** | **object** |
| `prepare: false` + `max_lifetime` | **string** | **string** | — |
| serializers 114 / 3802 set to pass-through | object | object | **error** (`The "string" argument must be of type string…`) |

## Scope

`packages/database/schema.ts` declares **30** jsonb columns: 3 already `customJsonb` (`unprocessed_scraper_payloads.raw_payload`, `.validation_error`, `.context`) and **27 plain `jsonb()`** that this bug is about: `user_locations.location_details`, `social_media_account_profiles.default_location` and `.discovery_source`, `geolocation_cache.result`, `posts.additional_image_urls`, `scraper_actor_runs.raw_input` and `.raw_output`, `events.links`, seven `event_merges` journal columns, three `account_profile_merges` columns, `extraction_audit_logs.events_completeness`, `schedules.location_details`, `default_location_change_requests.previous_location` and `.new_location`, `corrections.proposed_data`, `widgets.filters`, `ai_event_filters.resolved_filter`, `manual_extraction_jobs.request_payload` and `.result_data`.

**Why nothing visibly broke:** reads through Drizzle work in every state. What does **not** work is anything evaluated inside PostgreSQL: `resolvers.ts:3401–3402` `location_details->>'adminArea'` / `->>'venueType'` (`->>` on a jsonb string returns null; checked) cannot be true; `jsonb_array_elements` on a string raises "cannot extract elements from a scalar" (checked); every planned SQL-side use (area ladder IDEA-073, target-area resolver IDEA-081, `@>` containment, expression indexes) would see nothing.

## The three ways to fix the write path

| | A. client-level pass-through serializers | **B. `customJsonb` on the 27 columns (decided)** | C. upgrade Drizzle to ≥ 0.33 |
|---|---|---|---|
| change | `serializers['114'/'3802']` in every `postgres()` client | 27 column declarations in `schema.ts` | version bump across `drizzle-orm`/`drizzle-kit` |
| works with the existing `customJsonb` | **no**: the probe raises an error unless `customJsonb.toDriver` is also changed | yes (it is the same type) | **no**, same reason; the upgrade must revisit `customJsonb` |
| proven on this project's pooler setup | no | **yes**: three production columns have been written this way since 2026-08-29 | no |
| covers future columns and other processes | yes, if every client uses the helper | only with a ratchet test (below) | yes |
| migration-neutral | n/a | **yes** (verified: `drizzle-kit generate` on a copy with all 27 swapped says "No schema changes, nothing to migrate"; the seven `.default([])` columns included) | n/a |
| seeds, backfills, tests that build their own client | each needs the helper | inherit it (same schema) | inherit it |

## Implementation spec (for `bmad-quick-dev` or a story)

1. **`packages/database/schema.ts`:** replace each plain `jsonb('x').$type<T>()` by `customJsonb<T>('x')`, keeping `.notNull()` and `.default([])`; remove the unused `jsonb` import. Verified on a temp copy of the package: all 27 replaced mechanically, `drizzle-kit generate` → no migration, and a Drizzle insert through the swapped `geolocation_cache.result` stores an `object` while a legacy string row still reads back parsed.
2. **Ratchet test (stops the next plain `jsonb()`):** enumerate the exported tables with `is(v, PgTable)`, `getTableColumns(v)`, keep columns whose `getSQLType() === 'jsonb'`, and assert none has `columnType === 'PgJsonb'` (today: 30 jsonb columns, 27 `PgJsonb`, 3 `PgCustomColumn`; after the change: 0 `PgJsonb`). A comment in `schema.ts` and a rule in `project-context.md` ("jsonb columns use `customJsonb`") point at it.
3. **Regression test:** extend `jsonb-encoding.test.ts`: insert through Drizzle into `schedules.location_details`, `events.links`, `social_media_account_profiles.default_location` and `posts.additional_image_urls`, then assert `jsonb_typeof` is `object` / `array` (and that a legacy string row still reads parsed).
4. **Deploy**, then run the migration runbook `BUG-068-jsonb-migration/` (look → apply → look again; tested on a scratch database, **not run on production**). Core columns first; `-v include_rest=1` only after reading the byte sizes in the look output.
5. **Verify on production** with the pack's "JSON encoding of jsonb columns" item (all rows `object` / `array`), and that `schedules` reports the same `pinned` count before and after.
6. **Not part of this fix:** BUG-066 (wrong pins), BUG-063 (`adminArea` is never written: 0 of 1,460), and the defensive `->>` reads of 2026-08-29 (keep until step 5 is done).

## Notes for the dependent work

- `customJsonb` is written for Drizzle 0.30's behavior; any Drizzle upgrade to ≥ 0.33 must revisit it (it would error, see the table above).
- AD-36 Rule 9 (location inheritance for group children) stays gated behind this and BUG-066.
- Until step 4 is done, new rows are objects and old rows are strings: SQL-side `->>` sees only the new ones.
