# Story 2.10: Service Worker Lifecycle Updates and Database Self-Healing

## Story Details

- Epic: 2
- Story ID: 2.10
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the push notification service worker and storage layers to automatically update and self-heal from database conflicts, and proactively report failures to me via email and analytics,
so that the notification system remains functional and monitored without manual intervention.

## Acceptance Criteria

1. **Given** a new version of `firebase-messaging-sw.js` is deployed, **When** the app registers it, **Then** `skipWaiting` and `clients.claim` are triggered so the new SW takes active control immediately.
2. **Given** any background IndexedDB `VersionError` occurs during FCM registration/token request, **When** caught, **Then** the application programmatically deletes the `firebase-messaging-database` IndexedDB database to self-heal, retries registration exactly once, and captures a `push_notifications_sw_error` analytics event in PostHog carrying `{ errorName: string; retrySucceeded: boolean }`.
3. **Given** the service worker registers successfully, **When** a registration object is returned, **Then** `.update()` is invoked programmatically to fetch any updated scripts.
4. **Given** a critical client-side Service Worker or IndexedDB error is caught, **When** the self-healing occurs, **Then** the application dispatches the backend `reportSystemError` GraphQL mutation (built by Story 0.23, this story's prerequisite), which sends an alert email to the configured developer/administrator address via the Outbound Email Adapter (Story 0.15) — the mutation call is fire-and-forget and never blocks or fails the retry/UI flow, even if the mutation itself errors.
5. **Given** `reportSystemError` is called from a plain library function (`apps/web/src/lib/push-notifications.ts`), not a React component, **When** the analytics event (AC2) and/or the mutation (AC4) are dispatched, **Then** neither call requires or waits on a React render context — both use module-level clients/helpers so this logic works identically whether invoked from a component effect or any future non-component caller.

## Tasks / Subtasks

- [ ] **Task 1: Add update handlers to `firebase-messaging-sw.js`** (AC: 1)
  - [ ] Add a top-level `self.addEventListener('install', () => self.skipWaiting())`.
  - [ ] Add a top-level `self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))`.
  - [ ] Add these listeners unconditionally at the top of the file (outside the `if (firebaseConfig.apiKey && ...)` block) so lifecycle control happens even if Firebase config is incomplete — the SW should still take control promptly in idle mode.
  - [ ] No dependency on any other task — this file has zero code overlap with `push-notifications.ts`.

- [ ] **Task 2: Extend `@festgrid/analytics` with a non-hook capture helper** (AC: 2, 5)
  - [ ] `push-notifications.ts` is a plain async function, not a React hook/component (confirmed unmodified from Story 0.12) — it has no access to `usePostHog()`, the package's only current export. Add `capturePostHogEvent(event: string, properties?: Record<string, unknown>): void` to `packages/analytics/src/index.ts` (or a new co-located `capture-event.ts` re-exported from `index.ts`), implemented via `posthog-js`'s default/imperative export (`import posthog from 'posthog-js'`) — guarded with `if (typeof window === 'undefined') return;` to no-op on the server, mirroring `push-notifications.ts`'s own SSR guard style.
  - [ ] This does not duplicate or reinitialize the provider (AD-5) — it reads the same singleton `posthog-js` client instance the existing `PostHogProvider`/`usePostHog()` already initialize; it only adds a second, non-hook access path for non-component callers.
  - [ ] Add `packages/analytics/src/capture-event.test.ts` (mirrors `env.test.ts`'s style) verifying: calls `posthog.capture(event, properties)` when `window` is defined; no-ops without throwing when `window` is undefined (simulate via `vi.stubGlobal('window', undefined)` or an equivalent jsdom-environment override).

- [ ] **Task 3: Handle `VersionError` / IDB failure and retry in `push-notifications.ts`** (AC: 2, 3)
  - [ ] Wrap the existing `navigator.serviceWorker.register(swUrl)` → `getToken(messaging, {...})` sequence in `requestPushPermissionAndRegister()` so a thrown error whose `.name === 'VersionError'` is caught distinctly from the existing generic `catch (error)` block (which stays as the final fallback for all other errors).
  - [ ] On `VersionError`: call `window.indexedDB.deleteDatabase('firebase-messaging-database')` (awaited via a `Promise` wrapping the request's `onsuccess`/`onerror`/`onblocked` handlers — do not fire-and-forget the deletion, since retrying the registration before the DB is actually removed would just re-trigger the same conflict), then retry the full register → getToken sequence exactly **once** (a bounded retry — do not recurse or loop; a second failure falls through to `reportSystemError` and returns `null`, so a persistently broken environment can't hang or infinite-loop).
  - [ ] After the retry attempt resolves (success or second failure), call `capturePostHogEvent('push_notifications_sw_error', { errorName: 'VersionError', retrySucceeded: <boolean> })` (Task 2's helper) — fire this regardless of whether the retry ultimately succeeded, since AC2 requires the event to fire on any caught `VersionError`, not only on final failure.
  - [ ] Call `serviceWorkerRegistration.update()` immediately after every successful `navigator.serviceWorker.register(...)` call (both the initial attempt and the post-self-heal retry) — this satisfies AC3 and is not conditional on AC2's error path.
  - [ ] The function's exported signature (`Promise<string | null>`) does not change — `notifications-content.tsx` (Story 2.9, the only current caller) requires no modification.

- [ ] **Task 4 (blocked on Story 0.23): Wire `reportSystemError` mutation call** (AC: 4)
  - [ ] **Do not start this task until Story 0.23 ("Build the system error reporting and alerting foundation") has shipped the `reportSystemError` mutation in `apps/backend`'s GraphQL schema** — this project's frontend codegen (`pnpm --filter web run codegen`) validates `.graphql` operation documents against the real backend schema files under `apps/backend/src/schema/**/*.graphql`; a `reportSystemError` document written before Story 0.23 lands will fail codegen with an unknown-field error, not just be "aspirational." Tasks 1-3 have zero dependency on Story 0.23 and can be implemented, tested, and shipped independently first if 0.23 is not yet done.
  - [ ] Create `apps/web/src/features/system/mutations.graphql` with `mutation reportSystemError($input: ReportSystemErrorInput!) { reportSystemError(input: $input) }` (new `system` feature folder — deliberately not `features/settings/`, since this mechanism is cross-cutting per Story 0.23's Gate 3 origin, not settings-domain-specific).
  - [ ] Run `pnpm --filter web run codegen` to regenerate `apps/web/src/generated/graphql.ts` with the new operation/types.
  - [ ] In `push-notifications.ts`, on the same `VersionError` catch path as Task 3 (after the retry resolves, alongside the analytics capture), call `graphqlClient.request(ReportSystemErrorDocument, { input: { source: 'service-worker', message: <error.message>, context: <retry outcome / error.name> } })` directly (the existing `graphqlClient` singleton from `@/lib/graphql-client` — no React Query hook needed, mirroring `navigation-hook.ts`/`route.ts`'s established plain-lib-file GraphQL-call pattern) — wrapped in its own `try/catch` that only `console.error`s on failure, per AC4's "never blocks or fails the retry/UI flow" requirement.

## Dev Notes

### Architecture & UX Gate Findings

- **Epic-wide sweep does not cover this story.** `epic-2-readiness.md` (`swept: true`) lists `stories_covered: [2.1a, 2.1, 2.1b, 2.2, 2.3a, 2.3b, 2.3, 2.4, 2.4a, 2.5a, 2.5, 2.6, 2.6a, 2.7, 2.8, 2.9]` — Story 2.10 is absent because it was drafted after the sweep ran (2026-08-04) and, until this `bmad-create-story` run, had no `epics.md` section at all (see "Backfill Note" below). Per the escape-hatch guard, the sweep's conclusions cannot be trusted for this story, so Gate 1 and Gate 3 were run fresh (not cited from the report).
- **Gate 1 (Architecture/Infrastructure Completeness) — GAP found, category: pure sequencing dependency.** Task 4's `reportSystemError` call ultimately needs to reach a real email-sending capability. Direct code inspection confirmed Story 0.15 ("Set up outbound email adapter") is `ready-for-dev` but **has zero implementation** — no `packages/domain/src/email/` (packages/domain's existing subfolders are `geolocation/`, `calendar/`, `user-locations/`, `query/`, `events/`, `user-settings/` — no `email/`), and no `apps/backend/src/lib/email` or any SES/`sendEmail` code exists anywhere in the repo (grepped, zero hits). This story must not build a parallel ad hoc email-sending path as a workaround — it depends on Story 0.15 shipping via its own designated owner (Story 0.23, see below).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — GAP found, category: genuine new prerequisite story needed.** `reportSystemError` as specified in the original draft AC4 is a generic "alert the developer about any critical client-side failure" mechanism, not push-notification-specific — it is exactly the kind of shared, project-wide capability future stories (any future Service Worker, IndexedDB, or other unrecoverable frontend failure) would also want to call, rather than each feature inventing its own error-alerting mutation and email template. Story 0.15 itself has no generic system/developer-error concept in its `EmailTemplateKey` enum (only `QUOTA_EXHAUSTION_WARNING`, `INVALID_API_KEY_ALERT`, `DANGEROUS_EVENT_MODERATOR_ALERT`, all domain-specific).
- **Gate 2 (UI Complexity & Reusability) — No gap found.** This is a developer-facing, no-UI reliability/observability story (Service Worker lifecycle handlers, an IndexedDB self-healing retry, a background GraphQL mutation) — no component, page, or user-visible interaction is introduced or touched, analogous to Stories 0.12/0.21's identical "no UI, no E2E, reserved capability" precedent. `design-artifacts/` has no service-worker/self-healing-related UX spec (the only push/notification-adjacent hits, `04.7-email-notification-quota.md` and `07.1-capacity-limit-notification.md`, are unrelated end-user notification-*content* specs). Verified via a one-shot Freya-persona subagent dispatch.
- **Resolution (user-confirmed, see below):** Rather than let Story 2.10 build `reportSystemError` ad hoc as a byproduct of its push-notification scope (which would repeat both the Gate 1 and Gate 3 violation), the mutation, resolver, and new `SYSTEM_ERROR_ALERT` email template are split into a new Epic 0 foundation story, **Story 0.23 ("Build the system error reporting and alerting foundation")**, added to `epics.md` immediately after Story 0.22 (Epic 0's prior highest-numbered story) and to `sprint-status.yaml` as a new `backlog` entry. Story 2.10 is scoped as a pure consumer of the mutation Story 0.23 defines (Task 4).

### Design Decisions Confirmed With User (2026-08-07)

Two real, non-mechanical tradeoffs were surfaced via `AskUserQuestion` before drafting:

- **Missing `epics.md` section — chosen: backfill it, then run the full pipeline.** This story's file and its `ready-for-dev` `sprint-status.yaml` entry already existed prior to this run, but `epics.md` (the authoritative source this workflow reads from) had no "Story 2.10" section at all — Epic 2 jumped from Story 2.9 straight to Epic 3. Resolved by adding a full Story 2.10 section to `epics.md` (see its "Backfilled into epics.md on 2026-08-07" note) before proceeding, rather than treating the pre-existing bare story file as sufficient authority on its own.
- **Gate 1/3 `reportSystemError` gap — chosen: split into a new Epic 0 prerequisite story.** Considered against a lighter-weight alternative (amend Story 0.15 in place, since it is itself unimplemented — mirroring this project's Story 2.5a precedent of amending an unshipped sibling story rather than splitting) and against accepting the gap and keeping Task 4 fully inside 2.10. The user chose the new-story split, matching Gate 3's literal recommendation over the lighter-weight in-place-amendment option. Consequence: Story 2.10's Task 4 is now hard-blocked on Story 0.23 (currently `backlog`), not just soft-sequenced against an already-`ready-for-dev` sibling.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no mismatch found, no changes required.** This story touches zero database schema. It adds one new frontend-only GraphQL operation document (`apps/web/src/features/system/mutations.graphql`) that *consumes* a mutation/type Story 0.23 owns defining on the backend — Story 2.10 does not define `ReportSystemErrorInput` or any backend type itself.
- **Impacted contracts:** `apps/web/src/generated/graphql.ts` (regenerated via frontend codegen, Task 4 — additive, generated output only, and only after Story 0.23's schema exists). No `@festgrid/shared-types` change — mirrors Story 0.12's conclusion that this kind of backend-local/frontend-local type has no shared/cross-package contract.
- **Required DB migration changes:** None.
- **Backward compatibility and rollout notes:** `requestPushPermissionAndRegister()`'s exported signature (`Promise<string | null>`) is unchanged — Story 2.9's `notifications-content.tsx` (its only current caller) requires no modification. `firebase-messaging-sw.js`'s new lifecycle listeners are additive and backward-compatible with the existing `onBackgroundMessage` handler.
- **Verification checks:** Task 2/3's unit/integration tests (see Testing Requirements) prove the retry-once bound, the analytics payload shape, and the SSR-safe no-op path; a manual check confirms `pnpm --filter web run codegen` only succeeds for Task 4 once Story 0.23's schema exists (expected to fail loudly beforehand — this is the intended blocking signal, not a bug to work around).

### Project Structure Notes

- **`push-notifications.ts` stays a plain lib function, not a hook.** Confirmed unchanged from Story 0.12's own conclusion ("a plain async function, not a hook, and is not wired to any component") — this story's self-healing logic extends the same function in place rather than converting it into a `packages/ui` hook, since its browser-API surface (`navigator.serviceWorker`, `window.indexedDB`) is not portable/reusable UI logic.
- **No `packages/domain` involvement.** The self-healing/retry logic is fundamentally coupled to browser-only DOM APIs (`indexedDB`, `navigator.serviceWorker`, `self` in the SW context) that do not exist in a Node/Lambda runtime — per `project-context.md`'s domain-package restriction (dependency-free of Node/DOM-runtime-only concerns is implied by "must stay importable by Node/Backend," which cuts both ways: browser-only APIs are equally non-portable to a package meant to be safely importable by backend Lambda code). This logic correctly stays in `apps/web`.
- **New `apps/web/src/features/system/` folder.** Every existing frontend GraphQL-document folder (`features/{auth,locations,events,settings}`) is named after a product domain; `system` is deliberately generic/domain-agnostic, matching Story 0.23's Gate-3-driven "cross-cutting, not settings-owned" classification — a future second consumer of `reportSystemError` would add its own call site importing from this same folder rather than duplicating the document.
- **`@festgrid/analytics` gains its first non-hook export.** Every existing call site in the codebase uses `usePostHog()` from a component; `capturePostHogEvent` (Task 2) is the first export usable from a plain module. This is a minimal, backward-compatible addition to an already-existing shared package (not a new package, not a new cross-cutting story) — it reads the same singleton PostHog client the hook already initializes via context, so it does not violate AD-5 rule 1's "single provider" requirement.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.10`, `#Story 0.23`] — story AC source (backfilled this run); Story 0.23's Note explains its Gate 1/3 origin.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`] — confirmed `swept: true` but Story 2.10 absent from `stories_covered`, the basis for running Gate 1/3 fresh rather than citing the report.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — gate definitions, numbering rule (new Epic 0 story for a tooling/infrastructure gap), escape-hatch guard for sweep reports that predate a story.
- [Source: `_bmad-output/implementation-artifacts/0-15-set-up-outbound-email-adapter.md`] — read in full; confirmed `ready-for-dev`/unimplemented, confirmed its exact 3-value `EmailTemplateKey` enum and its Task 1/2 scaffolding-sequencing-conflict pattern (the template this story's blocking-dependency framing follows for Task 4).
- [Source: `_bmad-output/implementation-artifacts/0-12-set-up-firebase-cloud-messaging-foundation.md`] — read in full; confirms `requestPushPermissionAndRegister()`'s current exact behavior/signature (this story's "file being modified"), confirms it is "a plain async function, not a hook" (basis for Task 2's analytics-helper decision) and SSR/unsupported-browser guard style to mirror.
- [Source: `_bmad-output/implementation-artifacts/0-21-set-up-fcm-device-token-registry.md`] — confirms `registerFcmToken`/`unregisterFcmToken` fully implemented and unaffected by this story.
- [Source: `_bmad-output/implementation-artifacts/2-9-manage-push-notification-settings.md`] — confirms `notifications-content.tsx` is the sole current caller of `requestPushPermissionAndRegister()` and requires no modification since this story's changes are signature-compatible; confirms the "Lenient: always save intent" contract this story does not affect.
- [Source: `apps/web/public/firebase-messaging-sw.js`] — read in full; confirmed current state (no `install`/`activate` listeners, only `onBackgroundMessage`) — the exact file Task 1 extends.
- [Source: `apps/web/src/lib/push-notifications.ts`] — read in full; confirmed current state (single `try/catch`, no `VersionError` branch, no `.update()` call, no analytics) — the exact file Task 3/4 extends.
- [Source: `apps/web/src/lib/firebase-client.ts`, `graphql-client.ts`] — read in full; confirms the lazy Firebase app singleton and the isomorphic `graphqlClient` singleton this story reuses unmodified.
- [Source: `packages/analytics/src/index.ts`, `env.ts`, `env.test.ts`] — read in full; confirms the package's only current export is the `usePostHog()` hook re-export — the basis for Task 2's new non-hook helper and its test-file style precedent.
- [Source: `apps/web/src/features/events/navigation-hook.ts`, `apps/web/src/app/api/calendar/ics/route.ts`] — read in full; confirms the established `graphqlClient.request<T>(Document, variables)` pattern for calling GraphQL from a plain (non-hook) lib/route file, which Task 4 follows for `reportSystemError`.
- [Source: `apps/backend/src/schema/resolvers.ts` (lines 287-315), `fcm-tokens.graphql`] — read in full; confirms every existing mutation calls `requireAuth(context)` — the contrast basis for Story 0.23's `reportSystemError` being the first intentionally-unauthenticated mutation (documented there, not decided by this story).
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-5, #AD-7`] — analytics single-provider/no-direct-SDK-call rule (basis for routing Task 2's new helper through `@festgrid/analytics` rather than importing `posthog-js` directly in `push-notifications.ts`); `requireAuth` as the sole auth-enforcement surface.
- [Source: `docs/infrastructure/4-push-notifications.md`, `index.md`] — confirms FCM is the sanctioned push service; no infra shard content requires updating (no new AWS/cloud resource in this story — Story 0.23 owns any SES-related infra documentation).
- [User decision, 2026-08-07] — epics.md backfill approach and Gate 1/3 new-prerequisite-story split, both confirmed via `AskUserQuestion` before drafting (see Design Decisions above).

## Global Rules References

- `_bmad-output/project-context.md` (Critical Implementation Rules → Security → Resilient Processing Pipeline [not applicable — no SQS involvement here, listed for completeness]; General Architecture → Adapter Pattern; Testing Rules)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-5, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.10, Story 0.23, Story 0.15, Story 0.12)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `docs/infrastructure/4-push-notifications.md`, `docs/infrastructure/index.md`

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **Modified:** `apps/web/public/firebase-messaging-sw.js` (Task 1 — add `install`/`activate` listeners).
- **Modified:** `packages/analytics/src/index.ts` (or new co-located `capture-event.ts` re-exported from it) — adds `capturePostHogEvent` (Task 2).
- **New:** `packages/analytics/src/capture-event.test.ts` (Task 2).
- **Modified:** `apps/web/src/lib/push-notifications.ts` — `VersionError` detection, bounded one-time retry, `.update()` call, analytics capture, `reportSystemError` dispatch (Tasks 3-4).
- **New:** `apps/web/src/features/system/mutations.graphql` (Task 4, blocked on Story 0.23).
- **Modified (regenerated):** `apps/web/src/generated/graphql.ts` (`pnpm --filter web run codegen`, Task 4 — not hand-edited, and not runnable until Story 0.23's backend schema exists).
- **New:** `apps/web/src/lib/push-notifications.test.ts` (Task 5, see Testing Requirements).
- **Not modified:** `apps/web/src/app/[locale]/settings/notifications/notifications-content.tsx` (Story 2.9's caller — signature-compatible, no change needed); `apps/backend` (Story 0.23's exclusive scope); `packages/database` (no schema change); `packages/domain` (browser-only APIs, not portable logic); `packages/ui` (no UI); `apps/web/locales/{en,id}.json` (no user-facing text introduced).

### Rule Mapping

- *AD-5 (Analytics Instrumentation)* → `push_notifications_sw_error` event, payload `{ errorName, retrySucceeded }`, fired via the new `capturePostHogEvent` helper — routed through `@festgrid/analytics`, never a direct `posthog-js` import inside `push-notifications.ts` (Task 2/3).
- *Story-split-gate Gate 1/2/3* → Gate 1/3 run fresh (sweep predates this story) and both found gaps, resolved by splitting Story 0.23; Gate 2 run fresh, no gap (no UI in scope).
- *General Architecture — Adapter Pattern* → `reportSystemError`'s actual email delivery stays exclusively behind Story 0.15's Outbound Email Adapter interface (owned by Story 0.23); this story never calls a raw SMTP/provider SDK.
- *Testing Rules* → `apps/web` follows the "testing trophy" integration/unit-test approach (Task 5); the one new `packages/analytics` function gets a focused unit test per that package's existing per-function test-file convention (not the 100%-domain-coverage rule, which is `packages/domain`-specific and does not apply here since no `packages/domain` code is added).

### Verification Plan

- `packages/analytics`: `vitest run capture-event.test.ts` — capturing fires `posthog.capture` with correct args when `window` exists; no-ops without throwing when it does not (Task 2).
- `apps/web`: `vitest run push-notifications.test.ts` (Task 5) — mocking `firebase/messaging`'s `getToken` to throw a `VersionError`-named error on first call and succeed on the retry: confirms `indexedDB.deleteDatabase` is called with `'firebase-messaging-database'` before the retry, confirms exactly one retry attempt (not more), confirms `capturePostHogEvent('push_notifications_sw_error', { errorName: 'VersionError', retrySucceeded: true })` fires, confirms `serviceWorkerRegistration.update()` is called after both the initial and retried successful registration. A second scenario where the retry also throws confirms `retrySucceeded: false` is captured and `graphqlClient.request` (mocked) is called with the `reportSystemError` document and does not throw even if the mocked mutation call itself rejects. A third scenario (no `VersionError`, generic error) confirms the existing fallback `catch` still returns `null` unchanged, unaffected by this story's additions.
- Manual: confirm `firebase-messaging-sw.js`'s new listeners don't regress the existing `onBackgroundMessage` manual-verification steps from Story 0.12's own Task 5; confirm `pnpm build`/`pnpm lint` clean for `apps/web` and `packages/analytics`.
- **Deferred until Story 0.23 ships:** an end-to-end check that `reportSystemError` actually reaches a real inbox — mirrors Story 0.15's own deferred "real SES send" verification.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: Tasks 1-3 are `apps/web`-only (no backend/domain change) and can proceed immediately; Task 4 is explicitly **blocked** pending Story 0.23.
- [ ] **Blocking dependency acknowledged:** Story 0.23 ("Build the system error reporting and alerting foundation") is currently `backlog` — Task 4 (and therefore full AC4 satisfaction) cannot be completed until it ships. Dev agent should implement/ship Tasks 1-3 first if 0.23 is not yet done by the time this story is picked up.
- [ ] **Gate 1/2/3 findings confirmed:** Gate 1 (email-adapter sequencing) and Gate 3 (generic error-reporting mechanism) gaps both resolved by splitting Story 0.23 into `epics.md`/`sprint-status.yaml`, per user's confirmed choice (see Dev Notes → Design Decisions Confirmed With User); Gate 2 — no in-scope UI gap.
- [ ] **epics.md backfill confirmed:** Story 2.10's missing `epics.md` section was backfilled this run (see Dev Notes), per user's confirmed choice, before requirements were drafted.
- [ ] Architecture and boundary confirmation: no `packages/domain` involvement (browser-only APIs); `capturePostHogEvent` added to the existing `@festgrid/analytics` package (not a new package); `reportSystemError`'s frontend document lives in a new domain-agnostic `apps/web/src/features/system/` folder.
- [ ] Testing plan confirmed: `packages/analytics` unit test for the new helper; `apps/web` unit/integration tests for `push-notifications.ts`'s retry/analytics/mutation-dispatch behavior, covering the VersionError-recovers, VersionError-persists, and non-VersionError-error paths; no `packages/domain` tests needed (nothing added there); no new E2E test (matches Story 0.12/0.21's "no UI, no E2E" precedent).
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- `packages/analytics`: `vitest run` unit test for `capturePostHogEvent` (Task 2) — fires `posthog.capture` correctly when `window` is defined; no-ops without throwing when it is not.
- `apps/web`: `vitest run` unit/integration test for `push-notifications.test.ts` (Task 5) covering AC1-AC5: VersionError caught → DB deleted → exactly one retry → analytics captured with correct payload → `.update()` called on the successful registration; VersionError persists through the retry → analytics captured with `retrySucceeded: false` → `reportSystemError` dispatched (mocked `graphqlClient.request`) without throwing even if that call rejects; a non-VersionError error still falls through to the pre-existing generic `catch` unchanged, returning `null`.
- No `packages/domain` unit tests required — this story adds no framework-agnostic logic there (all new logic is browser-API-coupled, per Project Structure Notes).
- No new E2E (`Playwright`) test required — matches Stories 0.12/0.21's identical "no UI, no E2E, reserved/background capability" precedent; this story has no user-facing flow to exercise end-to-end.
- Deferred (not part of this story's automated verification): a real end-to-end check that `reportSystemError` reaches Story 0.15's actual SES-backed inbox — requires Story 0.23 to exist and a live, DNS-verified sending domain, mirroring Story 0.15's own deferred real-send verification.

## Deliverables Checklist

- [ ] `firebase-messaging-sw.js` has `install`/`activate` listeners calling `skipWaiting()`/`clients.claim()`.
- [ ] `@festgrid/analytics` exports `capturePostHogEvent`, unit-tested.
- [ ] `push-notifications.ts` detects `VersionError`, deletes `firebase-messaging-database`, retries exactly once, calls `.update()` on every successful registration, and captures `push_notifications_sw_error` with the correct payload — unit/integration tested for all three error-path scenarios.
- [ ] `apps/web/src/features/system/mutations.graphql` created and `reportSystemError` wired from the `VersionError` catch path (blocked until Story 0.23 ships its backend schema).
- [ ] `pnpm build`/`pnpm lint` clean for `apps/web` and `packages/analytics`.

## Out of Scope

- Building the `reportSystemError` mutation, its resolver, or the `SYSTEM_ERROR_ALERT` email template itself — split into Story 0.23 (`backlog`) per this run's Gate 1/3 findings; see `epics.md` Story 0.23.
- Amending Story 0.15's `EmailTemplateKey` enum or its scaffolding-sequencing tasks — owned by Story 0.23, not this story.
- Any retry/self-healing behavior beyond a single bounded retry — a persistently broken IndexedDB environment surfaces via `reportSystemError`/analytics for developer investigation rather than looping indefinitely client-side.
- Reading `pushNotificationsEnabled` (Story 2.9/2.6a) to gate whether self-healing runs at all — this story's self-healing applies to any FCM registration attempt regardless of the user's toggle state, since a broken IndexedDB affects the browser's FCM capability generally, not just this one setting.
- A real, live SES send verification for `reportSystemError` — deferred to whichever consumer story (this one, once unblocked) runs first against a fully set-up AWS account, mirroring Story 0.15's own deferred verification.
- Any change to `notifications-content.tsx` or Story 2.9's "Lenient: always save intent" contract — unaffected by this story.

## Definition of Done

- [ ] AC1-AC5 satisfied and verified by unit/integration tests (AC4 verified via mocked `reportSystemError` dispatch; real end-to-end delivery deferred per Out of Scope).
- [ ] All required tests passing (`packages/analytics` unit test; `apps/web` unit/integration tests for `push-notifications.ts`).
- [ ] Lint and type checks passing for `apps/web` and `packages/analytics`.
- [ ] `pnpm --filter web run codegen` re-run and confirmed to have regenerated the `reportSystemError` operation (only once Story 0.23 has shipped its backend schema).
- [ ] Story 0.23 confirmed `done` (or its gap explicitly accepted by the user) before this story's own Task 4/AC4 is marked complete.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used



### Debug Log References



### Completion Notes List



### File List

