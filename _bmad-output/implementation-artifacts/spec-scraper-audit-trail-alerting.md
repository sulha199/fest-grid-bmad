---
title: 'Alert moderators and preserve context on scraper audit-trail silent failures'
type: 'bugfix'
created: '2026-09-05'
status: 'in-review'
review_loop_iteration: 0
context: []
baseline_commit: '5b13fab6f98eb7f093521e20796d53032bcfffb1'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `scraper_actor_runs` (the scraper audit-trail table) and its dependent tables (`unprocessed_scraper_payloads`, `apify_pending_jobs`, `brightdata_pending_jobs`, `posts`) silently end up with a NULL/missing `scraper_actor_run_id` link whenever the audit-row insert fails or an FK insert is rejected. `record-actor-run.ts`'s three exports (`recordActorRunStart`, `recordActorRunResult`, `recordSyncActorRun`) catch DB errors and only `console.error`; `persist-unprocessed-payload.ts` catches a Postgres `23503` FK violation, `console.warn`s, and retries the insert with the FK column dropped, discarding the run link permanently. No moderator is ever notified, so runs become unlinked/unreprocessable with zero visibility.

**Approach:** Add a new, additive moderator-alert module — `sendScraperAuditAlert` — mirroring the existing `send-dangerous-report-moderator-alerts.ts` pattern exactly (query `users` where `role = 'moderator'`, email each via a new `SCRAPER_AUDIT_TRAIL_FAILURE_ALERT` template, `Promise.allSettled`, never throws). Wire it into every silent-catch branch in `record-actor-run.ts`, and into `persist-unprocessed-payload.ts`'s FK-violation branch. In that same FK-violation branch, also preserve the orphaned `scraperActorRunId` inside the `context` jsonb column on the retried insert (as `orphanedScraperActorRunId`) instead of discarding it, so a future backfill script has something to key on.

## Boundaries & Constraints

**Always:**
- Every touched function keeps its existing "never throw, never block the caller" contract — the alert call is fire-and-forget (not awaited) inside each catch block, and `sendScraperAuditAlert` itself never throws (own try/catch, matching `sendDangerousReportModeratorAlerts`'s shape).
- Alert recipients are all `role = 'moderator'` users (per user decision, consistent with Story 3.4q's precedent) — not `SYSTEM_ERROR_ALERT_EMAIL`.
- No throttling/cooldown in this fix (per user decision) — one alert attempt per failure occurrence.
- `stale-job-sweep.ts` needs no direct changes — it only calls `recordActorRunResult`, so fixing `record-actor-run.ts` covers it.

**Ask First:** None outstanding — resolved via `AskUserQuestion` before this spec was drafted (alert target = all moderators; no throttling; scope excludes Story 3.4q).

**Never:**
- Do not implement Story 3.4q (`scraper_provider_health` table, consecutive-failure-day tracking, Bright Data token rotation) — separate, already-specced story.
- Do not add throttling/cooldown state (new table, debounce) in this fix — record it as a deferred-work entry instead.
- Do not change `persist-unprocessed-payload.ts`'s FK column behavior itself (it still must omit the FK on retry — only the `context` jsonb payload changes).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| DB insert fails in `recordActorRunStart`/`recordActorRunResult`/`recordSyncActorRun` | Postgres throws (any error) | Function still returns `null`/`void` as before; `sendScraperAuditAlert` fired with vendor/runId/profileId context | Alert failure itself is swallowed inside `sendScraperAuditAlert` |
| `persist-unprocessed-payload.ts` FK violation (`23503`) | `scraperActorRunId` references a non-existent row | Retried insert succeeds with FK omitted; `context.orphanedScraperActorRunId` set to the dropped id; `sendScraperAuditAlert` fired | Same as above |
| No moderators exist | `users` table has zero `role='moderator'` rows | `sendScraperAuditAlert` logs and returns, no email sent, no throw | N/A |
| One moderator email send rejects | Mocked `sendTemplatedEmail` throws for one recipient | Other moderators still alerted (`Promise.allSettled`) | Logged via `console.error`, not thrown |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/notifications/send-scraper-audit-alert.ts` -- NEW: moderator-alert module, mirrors `send-dangerous-report-moderator-alerts.ts`
- `apps/backend/src/lib/scraper/record-actor-run.ts` -- wire alert into all 3 catch blocks
- `apps/backend/src/lib/posts/persist-unprocessed-payload.ts` -- wire alert + preserve `orphanedScraperActorRunId` in `context`
- `packages/domain/src/email/types.ts` / `templates.ts` -- new `SCRAPER_AUDIT_TRAIL_FAILURE_ALERT` template
- `packages/domain/src/email/render-template.test.ts` -- render test for new template (100% coverage rule)
- `apps/backend/src/lib/scraper/record-actor-run.test.ts`, `apps/backend/src/lib/posts/persist-unprocessed-payload.test.ts` -- extend with alert-fired assertions
- `_bmad-output/implementation-artifacts/deferred-work.md` + `backlog.yaml` -- record the throttling/cooldown deferral per user's answer

## Tasks & Acceptance

**Execution:**
- [x] `packages/domain/src/email/types.ts` -- add `SCRAPER_AUDIT_TRAIL_FAILURE_ALERT` to `EmailTemplateKey` + its `EmailTemplateVariables` entry `{ source: string; message: string; context: string; moderatorReviewUrl: string }` -- new template, mirrors `SYSTEM_ERROR_ALERT`'s field naming
- [x] `packages/domain/src/email/templates.ts` -- add the template body (subject/html/text), matching existing moderator-alert tone
- [x] `packages/domain/src/email/render-template.test.ts` -- add render test for the new key
- [x] `apps/backend/src/lib/notifications/send-scraper-audit-alert.ts` -- new module, `sendScraperAuditAlert(details: { source: string; message: string; context: string }, deps = { sendTemplatedEmail })`, mirrors `send-dangerous-report-moderator-alerts.ts` exactly
- [x] `apps/backend/src/lib/notifications/send-scraper-audit-alert.test.ts` -- new, real-DB seam-based test mirroring `send-dangerous-report-moderator-alerts.test.ts` (happy path, zero moderators, partial failure)
- [x] `apps/backend/src/lib/scraper/record-actor-run.ts` -- call `sendScraperAuditAlert` (fire-and-forget, `.catch(() => {})` safety net) from all 3 catch blocks with vendor/runId/profileId context
- [x] `apps/backend/src/lib/scraper/record-actor-run.test.ts` -- extend existing "catch and log" tests to also assert the alert fires (mock `sendScraperAuditAlert` via its module seam)
- [x] `apps/backend/src/lib/posts/persist-unprocessed-payload.ts` -- in the `23503` branch, call `sendScraperAuditAlert` and set `context.orphanedScraperActorRunId` on the retried insert
- [x] `apps/backend/src/lib/posts/persist-unprocessed-payload.test.ts` -- add a real-DB test that forces a genuine FK violation (a random non-existent UUID) and asserts the retried row's `context.orphanedScraperActorRunId` matches, plus the alert fires
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- append one entry naming the deferred throttling/cooldown mechanism for this alert path

**Acceptance Criteria:**
- Given a DB error during `recordActorRunStart`, when it's caught, then the function still returns `null` (unchanged contract) and `sendScraperAuditAlert` is invoked with vendor/runId/profileId
- Given a `23503` FK violation in `persistUnprocessedPayload`, when the retry succeeds, then the persisted row's `context.orphanedScraperActorRunId` equals the originally-passed `scraperActorRunId`, and `sendScraperAuditAlert` is invoked
- Given zero `role='moderator'` users, when `sendScraperAuditAlert` runs, then it logs and returns without throwing or sending email

## Design Notes

Alert module needs a mockable seam for `record-actor-run.test.ts`/`persist-unprocessed-payload.test.ts` (which mock `db`, not real DB) to assert without hitting email/DB — follow this repo's existing `export let fn = ...` + `setFn(...)` seam pattern (see `instagram-adapter.ts`'s `callApifyActor`/`setCallApifyActor`) for `sendScraperAuditAlert` itself, so `record-actor-run.test.ts` can inject a spy instead of hitting a real `users` table query.

## Verification

**Commands:**
- `pnpm --filter backend exec cross-env NODE_ENV=test tsx --test --test-concurrency=1 src/lib/scraper/record-actor-run.test.ts src/lib/posts/persist-unprocessed-payload.test.ts src/lib/notifications/send-scraper-audit-alert.test.ts` -- expect all green
- `pnpm --filter domain exec tsx --test src/email/*.test.ts` -- expect 100% coverage maintained
- `pnpm --filter backend lint && pnpm --filter domain lint` -- expect clean
- `pnpm --filter backend build && pnpm --filter domain build` -- expect clean
