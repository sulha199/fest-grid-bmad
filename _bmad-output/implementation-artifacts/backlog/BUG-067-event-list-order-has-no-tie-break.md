---
backlog_id: BUG-067
title: "Query.events orders by the next date alone, so offset paging repeats and skips events that share a date"
captured: 2026-10-18
---

# BUG-067 — the Discovery order has no unique tie-break

**Captured:** 2026-10-18 · **Status:** reproduced on a scratch PostgreSQL 16.15 with the repository's migrations and `seed:volume` data (30,012 events, roughly 130 events per day over the next 60 days — more ties than production probably has). **Not reproduced on production data.**

## Evidence

`apps/backend/src/schema/resolvers.ts` (`events`): `ORDER BY COALESCE(<next open date>, <main schedule date>, <earliest date>) ASC` then `limit qLimit+1 offset qOffset`. No `events.id` term. Each page is a separate query and Postgres may order tied rows differently each time.

`apps/backend/scripts/poc-event-insight/perf-pagination.ts --pages 20 --size 10` fetches 20 consecutive pages the way the web client does (page size 10, `+1` row for `hasMore`):

* 200 rows fetched; **48 events returned on more than one page**;
* **98 of the true first 200 events never returned**; 10 returned events were not in the true first 200.

The web client merges pages by id, so the visible effect is missing events (and, at a boundary, a shifted list), not duplicate cards. Adding `"events"."id" ASC` as the last ORDER BY term shows no consistent cost (203 vs 175 ms at offset 0, 173 vs 182 ms at offset 200, 224 vs 214 ms at offset 2,000; JIT off, 30k; variants V1/V2 in `results/perf-variants-30k.generated.md`).

## Fix direction

`ORDER BY <key>, events.id`. Then, once the list is served from a maintained key (IDEA-076), an opaque cursor with a keyset seek removes the OFFSET cost as well: 0.3 ms at any depth against 18.7 ms at offset 2,000 and 130 ms at 10,000.

## To verify first

Page through Discovery with an account that has several events on the same day and compare the ids seen with `ORDER BY key, id` on the same data; or run `perf-pagination.ts` against a copy of production.

Related: FIND-087, IDEA-076.
