---
backlog_id: BUG-034
title: "favorites has no index with eventId as a leading column — favoriteCount full-scans the table on every eventBySlug call"
captured: 2026-09-15
---

# BUG-034 — favorites table missing eventId index

## Capture

Found via `bmad-agent-architect` audit (2026-09-15).

The `favoriteCount` field resolver (`apps/backend/src/schema/resolvers.ts:3664-3672`) queries
`WHERE eventId = X AND deletedAt IS NULL`, but `favorites` (`packages/database/schema.ts`) only
carries `unique(userId, eventId)` (:411) and a partial index on `userId` alone (`activeIdx`,
:412) — neither has `eventId` as a leading/usable column for this query shape, forcing a full
table scan of `favorites` on every single `eventBySlug` call.

Doubled by BUG-035, and multiplied further by BUG-035's prefetch case.

## Fix

Add a partial index on `(eventId)` scoped to `WHERE deleted_at IS NULL`, matching AD-8 rule 3's
existing partial-index convention for this exact table family (subject to AD-8 rule 3's
documented drizzle-kit WHERE-clause-dropping limitation — the migration will need the same
hand-edit workaround already used for `idx_favorites_active`).

Not yet scoped into a story.
