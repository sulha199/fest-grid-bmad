---
backlog_id: FIND-087
title: "Query.events: JIT compilation adds ~50 ms or ~800 ms depending on whether the plan's estimated cost crosses 500k, and the cost follows total history, not the visible set"
captured: 2026-10-18
---

# FIND-087 — the most-used endpoint spends most of its time compiling, and scales with history

**Captured:** 2026-10-18 · **Status:** measured on a scratch PostgreSQL 16.15 built from the repository's 80 migrations plus `seed:volume` (30,012 and 120,012 events), database only, 4-core sandbox. **Not measured on production**; whether production runs with `jit` on is unknown. Full tables: `planning-artifacts/event-insight-poc/proposal-discovery-ranking-and-scale.md` §2, raw: `planning-artifacts/event-insight-poc/results/perf-*.generated.*`.

## Evidence

| what | result |
|---|---|
| the list query as the real resolver emits it (captured by running the web client's `getEvents` operation), 30k events | 882 ms with JIT on (server default), 175 ms with JIT off |
| the captured plan | `JIT: Functions: 79 … Total 716.688 ms` of `Execution Time: 909.221 ms`; estimated cost 611k–1.33M against `jit_above_cost` 100,000 |
| 8 concurrent clients, 4 cores, 12 s | 4.4 requests/s with JIT on · 25 with JIT off · 2,084 with a maintained sort key and an open-events index |
| 120k events, 85% ended (13,394 open), JIT off | 239 ms — the plan reads all 120,012 events, 120,035 posts and every main schedule, then discards the ended ones |
| a maintained key with an index over *all* events (no pruning) on that mature catalogue | 503 ms — worse than today: the index walks past every ended event |

## Correction (2026-10-19)

The "~80%" above is true of the **anonymous** plan at 30k events only. Every plan here exceeds `jit_above_cost` (100k), but the expensive part (inlining + optimisation, ~700–840 ms) is paid only when the estimated cost also exceeds `jit_inline_above_cost` / `jit_optimize_above_cost` (500k each). Measured (anonymous / signed-in plan cost → JIT time): 30k events 611k / 345k → 700 / 53 ms; 120k mature 445k / 283k → 44 / 56 ms; 300k events with the same 22k open 1.01M / 625k → 818 / 837 ms; 120k all open 2.86M / 1.60M → 694 / 809 ms. It is a **cliff**: a signed-in request that cost 53 ms of JIT at 30k events paid 837 ms at 300k. The throughput figures above (4.4 vs 25 requests/s) were for the anonymous plan. Detail: `planning-artifacts/event-insight-poc/proposal-posthog-and-list-scale.md` §3.

## To verify first (read-only, on the production database)

```sql
SHOW jit;  SHOW jit_above_cost;
-- then EXPLAIN (ANALYZE, BUFFERS) the captured query (results/perf-today-list-query.generated.sql, parameters in its last line) and look for a "JIT:" block
```

## Fix direction

1. If `jit` is on: turn it off for the application role (`ALTER ROLE … SET jit = off`) — independent of everything else.
2. A maintained next-open-date column on `events` with an index holding only events that still have something open, and `ORDER BY key, id` — IDEA-076. Measured end state: 0.4 ms at offset 0, flat; the write side (trigger on `schedules`, nightly roll-forward) is **not** measured.
3. Repeat the Story 2.7 / CC-024 EXPLAIN and a `pgbench` run on a copy of production data before and after.

Related: BUG-067, IDEA-076, IDEA-074.
