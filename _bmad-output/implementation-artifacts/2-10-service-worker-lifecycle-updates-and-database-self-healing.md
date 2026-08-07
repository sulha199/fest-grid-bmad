# Story 2.10: Service Worker Lifecycle Updates and Database Self-Healing

## Story Details

- Epic: 2
- Story ID: 2.10
- Status: ready-for-dev

## Story

As a developer,
I want the push notification service worker and storage layers to automatically update and self-heal from database conflicts,
and proactively report failures to me via email and analytics,
so that the notification system remains functional and monitored without manual intervention.

## Acceptance Criteria

1. **Given** a new version of `firebase-messaging-sw.js` is deployed, **When** the app registers it, **Then** `skipWaiting` and `clients.claim` are triggered so the new SW takes active control immediately.
2. **Given** any background IndexedDB `VersionError` occurs during FCM registration/token request, **When** caught, **Then** the application programmatically deletes `firebase-messaging-database` to self-heal, triggers a retry, and captures a `push_notifications_sw_error` analytics event in PostHog.
3. **Given** the service worker registers successfully, **When** a registration object is returned, **Then** `.update()` is invoked programmatically to fetch any updated scripts.
4. **Given** a critical client-side Service Worker or IndexedDB error is caught, **When** the self-healing occurs, **Then** the application dispatches a backend `reportSystemError` GraphQL mutation which sends an alert email to the configured developer/administrator email address using the backend's Outbound Email Adapter (Story 0.15).

## Tasks / Subtasks

- [ ] **Task 1: Add update handlers to firebase-messaging-sw.js** (AC: 1)
  - [ ] Add `install` listener calling `self.skipWaiting()`.
  - [ ] Add `activate` listener calling `self.clients.claim()`.
- [ ] **Task 2: Handle VersionError / IDB failure on client** (AC: 2)
  - [ ] Wrap token retrieval / registration in a robust try/catch that detects `VersionError`.
  - [ ] Implement database deletion of `firebase-messaging-database` via `window.indexedDB.deleteDatabase()` on conflict detection.
  - [ ] Trigger an automated registration retry after deletion.
  - [ ] Capture the `push_notifications_sw_error` event with PostHog.
- [ ] **Task 3: Ensure SW updates programmatically** (AC: 3)
  - [ ] Call `serviceWorkerRegistration.update()` post-registration.
- [ ] **Task 4: Build backend error reporting and email alert** (AC: 4)
  - [ ] Define the `reportSystemError` mutation in backend schema, taking error details as input.
  - [ ] Implement backend mutation resolver to dispatch an alert email using the already-implemented Outbound Email Adapter (Story 0.15).
  - [ ] Wire the frontend client to call `reportSystemError` mutation whenever a critical SW or `VersionError` self-healing event is triggered.
