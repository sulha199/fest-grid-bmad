---
backlog_id: BUG-029
title: "queryActorRuns returns HTTP 502 in production (moderator Actor Runs browser)"
captured: 2026-09-14
---

# BUG-029 — queryActorRuns 502 in production

## Capture

Reported by user via `bmad-help` (2026-09-14): calling the `queryActorRuns` GraphQL query
(`apps/backend/src/schema/resolvers.ts:3367`, backs the Moderator Tools Actor Runs page built
in Story 3.4k / `apps/web/src/app/[locale]/moderator/tools/actor-runs-content.tsx`) returns a
502 in production.

Environment confirmed production; no filters/cursor, error log, or reproduction steps provided
yet — logged as a bare unconfirmed report for triage.

## Analysis

A 502 at this layer suggests an infra/gateway-level failure (Lambda timeout or crash, cold
start, unhandled exception surfacing as a raw 5xx) rather than a GraphQL-level error, since a
normal resolver throw would surface as a 200 with a GraphQL `errors[]` array, not a 502 — needs
a prod log pull (CloudWatch or equivalent for the resolving Lambda) to confirm which.

Not yet scoped into a story.
