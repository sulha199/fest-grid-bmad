# Incident: Connection Pool Exhaustion on Post-Login Queries

**Date:** 2026-08-27
**Status:** Fix applied to prod secret + code; pending redeploy to take effect.

## Summary

Deployed app returned GraphQL `"Unexpected error."` (`INTERNAL_SERVER_ERROR`) on `mySubscriptions`, `myApiKeys`, `myLocations`, `events`, and other authenticated queries — most visibly the burst of queries a client fires immediately after login.

## Investigation

Two hypotheses were ruled out before finding the real cause:

- **Not a resolver-specific bug.** Every affected resolver in `apps/backend/src/schema/resolvers.ts` uses the same `requireAuth(context)` → `authUser.userId` → Drizzle query pattern as unaffected resolvers. Nothing in the resolver code itself differed.
- **Not the Story 3-6e/3-6f `durableImageUrl` migration.** That story added new `posts` columns referenced in `events`-adjacent queries, which could plausibly 500 if the migration hadn't run — but no "column does not exist" errors appeared anywhere in the logs.

The real cause was found by pulling CloudWatch logs for the prod API Lambda (log group `/aws/lambda/FestgridBackendStack-prod-ApiLambdaprod5885E0E5-hJHuy64Mekfs`). GraphQL Yoga's default error masking (`apps/backend/src/server.ts`) hides the real error from clients but still logs the unmasked original error via `console.error` before masking it — that's where the actual error surfaced. (No Sentry/APM is wired in; CloudWatch is currently the only place to see the real error.)

All 52 errors sampled over a 24h window were the identical error, spread across whichever resolver happened to need a DB connection at that moment:

```
PostgresError: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
```

Paths hit: `myApiKeys` (14), `events` (12), `mySubscriptions` (8), `updateUserTimezone` (5), `myLocations` (4), `mySettings` (3), `me` (3), `eventBySlug` (1), `myExtractionQuota` (1) — i.e. the post-login dashboard burst, not one specific query.

## Root Cause

`apps/backend/src/db/client.ts` already capped `postgres.js` at `max: 1` connection per Lambda container, to avoid a *different* connection-storm problem (documented in its own comment). But `DATABASE_URL` pointed at Supabase's **session-mode pooler** (port `5432`), which holds one pooler slot per connected client for the connection's entire lifetime and caps *total* concurrent clients across all Lambda containers combined at `pool_size` (15 on this project). A routine burst of concurrent Lambda containers — a few dashboard queries firing in parallel right after login, across a handful of concurrent users — exceeded 15 concurrent connections, and the pooler rejected the rest outright.

Contributing factor: no `reservedConcurrentExecutions` is set on the API Lambda in `apps/infrastructure/lib/festgrid-backend-stack.ts`, so nothing currently caps how many concurrent containers can spin up under load.

## Fix

1. **Code** (`apps/backend/src/db/client.ts`): added `prepare: false` to the `postgres()` client options. This is required for transaction-mode pooling — prepared statements can't be reused across the backend connections a transaction-mode pooler rotates between queries.
2. **Infra**: updated the `festgrid-database-url-prod` secret in AWS Secrets Manager to change `DATABASE_URL`'s port from `5432` (session mode) to `6543` (transaction mode) — same host/user/password/db otherwise. Transaction mode releases the connection back to the pool between queries instead of holding it for the connection's lifetime, so far more concurrent Lambda containers can share the same `pool_size: 15` backend slots.
3. **Pending**: the Lambda's `DATABASE_URL` env var is a CloudFormation dynamic reference resolved at deploy time, so the new value only takes effect after the next deploy of `FestgridBackendStack-prod`. The `festgrid-database-url-dev` secret was **not** changed.

## Follow-ups (not yet done)

- Add `reservedConcurrentExecutions` to the API Lambda so a future traffic spike throttles gracefully instead of exhausting the DB pool again.
- Wire in Sentry (or similar) so this class of error surfaces without manually pulling CloudWatch logs.
- Fix `.github/workflows/ci.yml` job ordering: `db-migrate` and `deploy-infrastructure` both currently declare `needs: ci` as siblings with no dependency between them, which is a separate deploy-ordering race for future migrations (unrelated to this incident, but found during the same investigation).
