---
title: 'Add RELIGION_AND_SPIRITUALITY to EventCategory'
type: 'feature'
created: '2026-08-01'
status: 'done'
review_loop_iteration: 0
context: ['_bmad-output/project-context.md']
route: 'one-shot'
---

# Add RELIGION_AND_SPIRITUALITY to EventCategory

## Intent

**Problem:** `EventCategory` had no home for religious events (worship services, retreats, interfaith gatherings) — they'd have fallen into `HOLIDAY` (only fits holiday-tied events) or `OTHER`, the same gap `CHARITY_AND_CAUSES`/`CIVIC_AND_COMMUNITY` were previously carved out to fix.

**Approach:** Added `RELIGION_AND_SPIRITUALITY` as a new `EventCategory` member across every source that declares or transports it — PRD spec, `shared-types` enum, GraphQL schema, Drizzle Postgres enum (+ generated migration), locale files, and the GraphQL-codegen output — following the exact pattern of the two prior "(New)" categories.

## Suggested Review Order

**Enum declarations**

- Canonical enum + rationale comment; entry point for the whole change.
  [`shared-types/index.ts:42`](../../packages/shared-types/src/index.ts#L42)
- PRD spec updated to match.
  [`prd.md:232`](../planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#L232)
- GraphQL schema enum member.
  [`events.graphql:30`](../../apps/backend/src/schema/events.graphql#L30)

**Database migration**

- Drizzle `pgEnum` source of truth.
  [`schema.ts:16`](../../packages/database/schema.ts#L16)
- Generated migration, hand-adjusted after `drizzle-kit generate` so the physical enum ordering matches `schema.ts` (`BEFORE 'OTHER'`) and re-running is safe (`IF NOT EXISTS`) — `drizzle-kit`'s default output had neither.
  [`0003_strong_stark_industries.sql:1`](../../packages/database/migrations/0003_strong_stark_industries.sql#L1)

**Translation content**

- New locale keys; `page.tsx`'s `buildEnumLabels` picks these up automatically via `Object.values(EventCategory)`, no page-level code change needed.
  [`en.json:35`](../../apps/web/locales/en.json#L35), [`id.json:35`](../../apps/web/locales/id.json#L35)

**Peripherals**

- Regenerated via `graphql-codegen` — no manual edit.
  [`generated/graphql.ts`](../../apps/web/src/generated/graphql.ts)
- Deferred pre-existing gaps surfaced by adversarial review (backend resolver type-safety hole, no schema-merge test, Postgres enum irreversibility).
  [`deferred-work.md`](./deferred-work.md)
