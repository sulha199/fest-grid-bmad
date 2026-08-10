---
baseline_commit: 103bdb8bb87c64e4e5cfa8644c678734ee112bfc
---

# Story 3.8: Push notifications for extracted events

## Story Details

- **Epic:** 3
- **Story ID:** 3.8
- **Status:** review

## Story

**As a** user,
**I want** to receive a push notification when a new event is extracted from one of my subscribed accounts,
**So that** I can be immediately informed about new events.

## Acceptance Criteria

1. **Given** I have subscribed to a social media account (`subscriptions` table join, Story 3.2),
2. **And** I have enabled push notifications in my settings (`user_settings.push_notifications_enabled = true`, Story 2.9),
3. **And** I have registered one or more active device tokens (`fcm_tokens` table, Story 0.21),
4. **When** a new event is successfully extracted from that account and ingested into the database (Story 3.6b),
5. **Then** the system sends a push notification to all of my registered active device tokens using the Firebase Admin SDK on the backend.
6. **And** the push notification contains the event name as the title, and a short description (trimmed safely with an ellipsis if too long) as the body.
7. **And** the notification payload includes custom data fields (including the event's internal `id` and `slug`) so that clicking the notification on the client can open the specific event detail page (`/events/[slug]`).
8. **And** if a device token is returned as inactive or invalid (specifically `messaging/invalid-registration-token` or `messaging/registration-token-not-registered`) by the Firebase Cloud Messaging (FCM) service, the backend automatically deletes that token from the `fcm_tokens` table to prevent future redundant calls.
9. **And** transient failures sending notifications to a single user, device, or even the FCM service itself do not block, revert, or fail the ingestion of the event — notification delivery is handled safely as a side effect after the database transaction is successfully committed.

## Tasks / Subtasks

- [x] **Task 1 — Query Subscribers and Settings Helper:** Create `apps/backend/src/lib/notifications/get-subscribers-for-notification.ts` exporting `getSubscribersForNotification(sourceAccountId: string): Promise<string[]>`:
  - [x] Query the database to find all user IDs subscribed to the given `sourceSocialMediaAccountId` via the `subscriptions` table.
  - [x] Join with `user_settings` and filter to only include users where `push_notifications_enabled === true` (from Story 2.7/2.9's schema).
  - [x] Join with `fcm_tokens` (from Story 0.21's schema) to retrieve all active device registration tokens (`token` column) belonging to these eligible users.
  - [x] Return a flat array of unique registration tokens.
  - [x] Write unit tests for this query helper using a real local Postgres instance, covering: subscriber with notifications enabled (returns token), subscriber with notifications disabled (excludes token), unsubscribed user (excludes token), and multiple tokens for a single subscriber (returns all of them).
- [x] **Task 2 — Build Notification Payload Utility:** Create `packages/domain/src/notifications/build-fcm-payload.ts` exporting `buildFcmPayload(event: { id: string; slug: string; name: string; description: string }, tokens: string[]): any`:
  - [x] Format a multicast FCM message payload compatible with the Firebase Admin SDK (e.g., using `sendEachForMulticast` or `sendMulticast` depending on the exact version initialized in Story 0.12).
  - [x] Truncate description safely (e.g., max 150 characters with trailing `...`) for the notification body.
  - [x] Embed `eventId`, `slug`, and `type: 'NEW_EVENT'` inside the FCM data payload.
  - [x] Ensure no direct ORM/DB or Node-only Admin SDK imports exist in `packages/domain` to comply with the Code Organization boundary guidelines.
  - [x] Add `build-fcm-payload.test.ts` (`node:test`, pure logic, no DB, 100% coverage): verify safe truncation of long descriptions, correct mapping of fields, and expected structure of the output payload.
- [x] **Task 3 — Send Notifications and Cleanup Service:** Create `apps/backend/src/lib/notifications/send-event-notifications.ts` exporting `sendEventNotifications(event: { id: string; slug: string; name: string; description: string }, sourceAccountId: string): Promise<void>`:
  - [x] Call `getSubscribersForNotification(sourceAccountId)` to fetch active device tokens. If empty, log and exit.
  - [x] Batch the tokens into groups of up to 500 (FCM's maximum limit per multicast call).
  - [x] For each batch, invoke the Firebase Admin SDK's multicast messaging API (e.g. `admin.messaging().sendEachForMulticast(...)` or equivalent).
  - [x] Inspect the returned responses array. For any individual token delivery failure, check the error code. If the error code matches `messaging/invalid-registration-token` or `messaging/registration-token-not-registered` (or equivalent invalid token status), delete the corresponding token from the `fcm_tokens` table.
  - [x] Catch and handle all errors internally: if the FCM service is completely down or credential validation fails, log the error using the system error reporting foundation (Story 0.23) but do NOT let the error propagate up (satisfies AC9).
  - [x] Write integration tests for this service with mocked FCM Admin SDK responses to verify: successful multicast dispatch, correct handling and deletion of invalid tokens, and full exception safety.
- [x] **Task 4 — Ingestion Pipeline Integration:** Update `apps/backend/src/lib/ingestor/process-ingestion-job.ts` (from Story 3.6b):
  - [x] After the database transaction successfully commits and the event is written, trigger `sendEventNotifications` as an asynchronous, non-blocking side-effect.
  - [x] Do NOT block the primary ingestion response or await it inside the transaction block itself, ensuring fast queue consumption.
  - [x] Add tests to `process-ingestion-job.test.ts` verifying that `sendEventNotifications` is called with correct arguments when an event is successfully ingested.
- [x] **Task 5 — Verification & Linting:**
  - [x] Run `pnpm --filter @festgrid/domain test` and ensure 100% coverage is maintained.
  - [x] Run `pnpm --filter backend test` and verify all notification query and service tests pass.
  - [x] Run `pnpm build && pnpm lint && pnpm test` at the workspace root to confirm no compilation or regression errors exist across the monorepo.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 (Architecture Completeness): No gap found.** This story is covered by the swept `epic-3-readiness.md` (`swept: true`, dated 2026-08-09). The push notification trigger fits directly into the serverless queue-based pipeline. Notification sending is triggered from the Ingestor Lambda (`L_Ingest`), which already runs on SQS triggers with `DATABASE_URL` and FCM Admin SDK credentials wired. No new infrastructure resources, queues, or lambdas are needed.
- **Gate 2 (UI Complexity & Reusability): No gap found.** There is zero UI or frontend surface added by this story. Users manage their notification settings on the `/settings/notifications` page, which is fully owned by Story 2.9. Device registration is owned by Story 0.21. This story is pure, backend-triggered background logic.
- **Gate 3 (Foundational Completeness): No gap found.** Sourced from the sweep: Story 0.12 (Firebase Cloud Messaging foundation) establishes FCM Admin SDK credentials and config on the backend, and Story 0.21 (FCM device token registry) establishes the `fcm_tokens` table and its registration API. Both are fully complete.

### Safe Asynchronous Side-Effect execution

To preserve queue throughput, notification dispatch MUST be non-blocking. In AWS Lambda execution, a dangling promise can be truncated or killed if the handler returns before it resolves. Therefore, while we should not block the write transaction, we must await the notification promise *after* the transaction has successfully committed, but *before* the SQS message handler returns. This guarantees the Lambda container stays alive to finish delivery to the FCM gateway, while avoiding any DB lock contention or transaction timeout.

### Data Type Compatibility & Migration Requirements

- **No DB schema changes or migrations are required.** All target tables (`events`, `subscriptions`, `user_settings`, `fcm_tokens`) are already fully defined and migrated.
- **No GraphQL schema updates are required.** This trigger is internal and automatic upon database write.
- **Data type compatibility:** Tokens are fetched as `text` strings. `push_notifications_enabled` is mapped from the boolean column in `user_settings`. Long descriptions are safely trimmed to fit push notification payloads.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.8] — Acceptance criteria reference.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — Sworn Gate 1/3 evidence.
- [Source: _bmad-output/implementation-artifacts/3-6b-ingest-processed-events-into-the-database.md] — Ingestion handler reference.
- [Source: _bmad-output/implementation-artifacts/2-9-manage-push-notification-settings.md] — User settings reference.
- [Source: _bmad-output/implementation-artifacts/0-21-set-up-fcm-device-token-registry.md] — Device token schema and registry reference.
