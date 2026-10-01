---
backlog_id: BUG-030
title: "getEvents N+1: schedules/favoriteCount/isFavorited resolved per-row instead of batched, on the highest-traffic query"
captured: 2026-09-15
---

# BUG-030 — getEvents N+1 on the highest-traffic query

## Capture

Found via `bmad-agent-architect` review (2026-09-15) requested by the user, of `getEvents` and
its Discovery/Feed/Favorites usage.

`buildOptimizedDrizzleSelect` (`packages/graphql-select/optimized-select.ts`) only maps
requested GraphQL fields to physical columns of the `events` Drizzle table, so it has no way to
batch computed/virtual fields. The shared `apps/web/src/features/events/queries.graphql`
`getEvents` document (used by Discovery, Feed, and Favorites' batched fetch) requests
`favoriteCount`, `isFavorited`, and `schedules{...}` on every item; each falls through to its
own per-parent `Event.*` field resolver in `apps/backend/src/schema/resolvers.ts` (`schedules:`
line ~3619, `isFavorited:` ~3649, `favoriteCount:` ~3664), issuing one DB round trip per row per
field — roughly `1+1+3N` queries for a page of N events, up to `limit`'s max of 1000.

The `events` resolver's own `fieldMap` (~2991-3018) already builds efficient EXISTS-subquery
forms for `isFavorited`/`isAddedToCalendar`/`isFromSubscribedAccount` for WHERE-clause
filtering — these are unused for output and should be reused (or a per-request DataLoader
added) so the batch stays O(1) queries per page instead of O(N).

## Status

Documented as a standing rule in `_bmad-output/project-context.md`'s Database & Performance
section and the PRD's NFR Performance section so future changes to this resolver don't add more
per-row field resolvers. Not yet scoped into a story at capture time.
