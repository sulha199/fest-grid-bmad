---
backlog_id: FIND-061
title: "No new-event push notification has ever been received -- diagnosis"
status: complete
---

# FIND-061 — No new-event push notification has ever been received

## Scope of this pass

Traced the Story 3.8 / 0.21 push-notification path end to end in code (ingestion →
fan-out → recipient query → FCM send) and reproduced the recipient query against the
local Postgres instance. Each of the three unconfirmed leads from the original row was
checked individually. No FIREBASE_* keys are configured in this environment, so no live
FCM send was possible — the FCM send step itself could only be code-reviewed, not
exercised.

## Path traced

1. **Trigger:** `apps/backend/src/lib/ingestor/process-ingestion-job.ts:48-61` — after
   the event-insert transaction commits, fires `sendEventNotificationsSeam(event,
   message.sourceSocialMediaAccountId)` as a non-blocking (`.catch`-guarded) promise,
   but only `if (message.sourceSocialMediaAccountId)` is truthy. In production this
   runs inside the ingestor Lambda, consuming `DATA_INGESTION_QUEUE_URL`.
2. **Fan-out:** `apps/backend/src/lib/notifications/send-event-notifications.ts` —
   calls `getSubscribersForNotification`, batches tokens by 500, calls
   `messaging.sendEachForMulticast(payload)`, deletes tokens FCM reports as
   invalid/unregistered, and swallows all errors via `reportErrorSilently` (which
   emails `SYSTEM_ERROR_ALERT_EMAIL` if configured, else only `console.error`s).
3. **Recipient query:** `apps/backend/src/lib/notifications/get-subscribers-for-notification.ts` —
   `subscriptions` INNER JOIN `socialMediaAccountProfiles` (on `subscriptions.accountId
   = profiles.id`) INNER JOIN `userSettings` (on `userId`) INNER JOIN `fcmTokens` (on
   `userId`), filtered on `profiles.accountId = sourceAccountId`,
   `userSettings.pushNotificationsEnabled = true`, and `activeOnly(subscriptions)`.
4. **FCM send:** `apps/backend/src/lib/firebase-admin.ts` (`getAdminApp()`) +
   `firebase-admin/messaging`'s `sendEachForMulticast`, fed by
   `packages/domain/src/notifications/build-fcm-payload.ts` (pure, 100%-covered).

## Leads checked

### Lead 1 — "inner joins to `user_settings`/`fcm_tokens` yield zero tokens silently" → **refuted as the cause**

The existing test `apps/backend/src/lib/notifications/get-subscribers-for-notification.test.ts`
already seeds exactly the scenario this diagnosis pass was asked to build (a subscriber,
their `user_settings` row, and an active `fcm_tokens` row) and asserts the token comes
back. Re-ran it directly against the local Postgres instance:

```
pnpm --filter backend exec tsx --test src/lib/notifications/get-subscribers-for-notification.test.ts
# tests 4, pass 4, fail 0
```

All three sub-cases pass: enabled subscriber returns their token, disabled subscriber is
excluded, unsubscribed user is excluded, and multiple tokens for one subscriber all come
back. The join mechanics are correct for the data shape they're given.

The theoretical risk named in the lead — a user with an `fcm_tokens` row but **no**
`user_settings` row at all would be silently dropped by the `INNER JOIN` on
`userSettings`, even though the column's default (`pushNotificationsEnabled: true`)
implies they should be opted in — is real as written, but a second investigation pass
confirmed it cannot be the active cause today: `user_settings` rows are **not** only
created by the settings page. `Query.events` (`resolvers.ts:2985-2989`, the resolver
behind every event list in the app — Discovery/Feed/Favorites/Calendar) calls
`getOrCreateUserSettings(userId)` for *any* authenticated caller, and `Query.mySettings`
(`resolvers.ts:2641-2643`) does the same. Both frontend surfaces that ever call
`registerFcmToken` — `onboarding-notification-step.tsx:31` and
`notifications-content.tsx:55-61` — unconditionally fire `useGetMySettingsQuery` on
mount, before any token registration happens, and the shipped `notifications-content.tsx`
also calls `updateUserSettings` (itself another `getOrCreateUserSettings` call site) as
part of its default-sync effect. In every real UI path, a `user_settings` row already
exists by the time an `fcm_tokens` row could be created. This also means browsing any
event list as a logged-in user provisions the row well before notification settings are
ever touched. **No reachable code path in the current app produces an `fcm_tokens` row
without a `user_settings` row.**

(The join is still a latent fragility — it depends on an unrelated resolver's side
effect rather than an explicit guarantee — but changing it would not address FIND-061's
observed symptom, and per workflow guidance this pass does not guess-fix an unconfirmed
cause. Worth a follow-up hardening row — `COALESCE` / `LEFT JOIN` with an explicit
default — if it's wanted for robustness independent of this finding.)

### Lead 2 — "empty `sourceSocialMediaAccountId` on the event/post" → **not reproducible from any code path found; cannot be fully ruled out without production data**

`events.sourceSocialMediaAccountId` (`packages/database/schema.ts:394`) is a nullable
`text` column, not a UUID FK — it stores the platform-native account id
(`socialMediaAccountProfiles.accountId`), not the internal `id`. It's set in
`apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts:24-38`: the profile
is looked up by internal UUID `id`, and the function **throws** (`Social media account
profile not found: ...`) if no profile row exists — so by the time
`sourceSocialMediaAccountId = profile.accountId` runs, `profile` is guaranteed non-null.
Every `socialMediaAccountProfiles` insert site found
(`subscribe-to-account.ts:54`, `get-or-create-discovered-account-profile.ts:34`,
`resolvers.ts:2089`) sets `accountId` from a caller-supplied, non-empty platform account
id — no insert path that writes an empty string was found.

One real, separate risk surfaced while tracing this: the ingestion trigger guard
(`process-ingestion-job.ts:48`) uses a plain truthy check —
`if (result.inserted && insertedEvent && message.sourceSocialMediaAccountId)` — which
would also silently skip notification dispatch for an **empty string** `""`, not just
`null`/`undefined`, with no log line at all in that branch. This is worth a direct
production data check (see below) since it can't be reproduced locally without a
scraper/vendor response that supplies an empty account id upstream.

### Lead 3 — "`pushNotificationsEnabled` default" → **refuted as the cause**

`userSettings.pushNotificationsEnabled` is `boolean(...).default(true).notNull()`
(`packages/database/schema.ts:146`), set correctly in the original migration
(`migrations/0011_classy_tyrannus.sql`) and never altered by a later migration. A row
that gets created via `getOrCreateUserSettings`'s upsert (used everywhere a row is
lazily provisioned) gets `true` by default, matching the ACs' intended opt-in-by-default
behavior. No path sets it to `false` except the explicit `updateUserSettings` mutation
and the browser-permission-denied auto-sync in `notifications-content.tsx:81-91` /
`handleToggleChange`'s denied branch — both of which are legitimate, user-driven.

## What remains unconfirmed — requires production access

Every mechanism traced in code behaves correctly against seeded data. Since the
reported symptom is "no push notification has **ever** been received" in production,
and this environment has no `FIREBASE_*` credentials and no access to production data,
the remaining plausible explanations can only be confirmed or ruled out by someone with
production DB and environment access:

1. **Frontend FCM config may be entirely unset, meaning zero `fcm_tokens` rows have
   ever been created.** `requestPushPermissionAndRegister()`
   (`apps/web/src/lib/push-notifications.ts:57-80`) silently returns `null` (only a
   `console.warn`, no user-facing error, no alert) if any of
   `NEXT_PUBLIC_FIREBASE_API_KEY` / `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` /
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` /
   `NEXT_PUBLIC_FIREBASE_APP_ID` / `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is missing, or if
   `/firebase-messaging-sw.js` fails to register. If this is the case in production,
   the table is empty and nothing downstream (recipient query, FCM send) ever has
   anything to act on — this alone fully explains the symptom.
   - **Check:** confirm all six `NEXT_PUBLIC_FIREBASE_*` vars are set in the production
     frontend's build/runtime environment (e.g. Vercel project settings), and that
     `GET https://<prod-host>/firebase-messaging-sw.js` returns the service worker file
     (not a 404).
   - **Check:** `SELECT count(*) FROM fcm_tokens;` against production. Zero rows
     confirms this is the (or a) root cause outright.

2. **Backend FCM Admin credentials may be unset, meaning every send attempt throws and
   is swallowed.** `getAdminApp()` (`apps/backend/src/lib/firebase-admin.ts:17-23`)
   throws if `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` is
   missing; `send-event-notifications.ts`'s per-batch `try/catch` (lines 51-77) catches
   this and routes it through `reportErrorSilently`, which only emails if
   `SYSTEM_ERROR_ALERT_EMAIL` is set — otherwise it is a `console.error` inside a
   Lambda, invisible unless CloudWatch logs are checked directly.
   - **Check:** confirm `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`
     are set on the ingestor Lambda's environment in the deployed stack, and whether
     `SYSTEM_ERROR_ALERT_EMAIL` is set (if not, these failures are currently invisible
     by design).
   - **Check:** CloudWatch logs for the ingestor Lambda, filtered for
     `[sendEventNotifications]` or `Firebase Admin initialization failed`.

3. **Real-world condition overlap may simply be near-zero so far.** All four ACs must
   hold simultaneously for a given event: a user subscribed to *that* account, with
   `pushNotificationsEnabled = true`, with at least one live `fcm_tokens` row, *and*
   that account producing a newly-ingested event since the subscription+token existed.
   Both Story 3.8 and Story 0.21 are still `status: review` (not `done`) in
   `sprint-status.yaml` — i.e. not yet closed out — so it is also possible this has had
   limited real exposure. Worth checking:
   - **Check:** run the exact recipient query shape from
     `get-subscribers-for-notification.ts` against production for a handful of
     recently-ingested `events.id`s (via their `sourceSocialMediaAccountId`) and see
     whether it returns zero rows (data-shape issue) or some rows (meaning tokens *are*
     being resolved and the failure is downstream, at FCM send time):
     ```sql
     SELECT DISTINCT ft.token
     FROM subscriptions s
     JOIN social_media_account_profiles p ON s.account_id = p.id
     JOIN user_settings us ON s.user_id = us.user_id
     JOIN fcm_tokens ft ON s.user_id = ft.user_id
     WHERE p.account_id = '<sourceSocialMediaAccountId from a recent events row>'
       AND us.push_notifications_enabled = true
       AND s.deleted_at IS NULL;
     ```
   - **Check:** `SELECT id, event_name, source_social_media_account_id, created_at FROM
     events ORDER BY created_at DESC LIMIT 20;` — look for any row where
     `source_social_media_account_id` is `NULL` or `''` (Lead 2's remaining open
     question).

## Verdict

**No code-confirmed, locally-reproducible root cause found.** The recipient query,
join semantics, and default values all behave correctly against seeded data (see test
run above) — none of the three original leads holds up as the active cause once traced
through the full current codebase. The most likely explanations (missing frontend FCM
env config → empty `fcm_tokens` table, or missing backend FCM Admin credentials →
silently-swallowed send failures) are both environment/production-data questions that
cannot be verified from this environment. No code or schema change has been applied as
part of this pass — see the "Check" items above for what to run in production to
narrow this further.
