---
backlog_id: BUG-069
title: "A moderator receives no email or push notification (reported 2026-10-20, PWA installed)"
captured: 2026-10-20
---

# BUG-069 — what the code does, what it cannot do, and what the owner has to check

**Status:** reported by the product owner (moderator account, PWA installed, "never received any email or push"). **Read from code only; nothing was run, and production cannot be inspected from the planning session** (the read-only role has no access to `users`, `fcm_tokens`, `user_settings` or `subscriptions` by design). Two causes are certain from the code; the third is a configuration question.

## Certain from the code

1. **A moderator is never sent a push, by design.** FCM push is sent by `sendEventNotifications` only to users who (a) subscribe to the event's source account, (b) have `user_settings.push_notifications_enabled`, and (c) have a row in `fcm_tokens` (`get-subscribers-for-notification.ts`: three inner joins, so a user with no `user_settings` row gets nothing). The moderator role does not enter it. The token is registered only from the onboarding step and from Settings → Account → Notifications (`requestPushPermissionAndRegister`); installing the PWA alone registers nothing.
2. **Moderators are emailed for five events only**, to every `users.role = 'moderator'`: `DANGEROUS_EVENT_MODERATOR_ALERT` (a report of a dangerous event), `DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT` and `DEFAULT_LOCATION_CHANGE_AWAITING_APPROVAL_ALERT` (an account's default location changed), `SCRAPER_AUDIT_TRAIL_FAILURE_ALERT` and `SCRAPER_PROVIDER_DOWN_MODERATOR_ALERT` (the scraper). **Nothing notifies a moderator about the queue**: the 147 pending match candidates, corrections, reports other than "dangerous", account-type reviews, group suggestions. That is consistent with moderators having resolved 0 of 147.
3. **A failed send is silent.** The default-location emails use `Promise.allSettled` and never look at a rejected result; the other three log `console.error` only. A rejected SES send (unverified recipient, sandbox) leaves no trace outside CloudWatch.

## To check (owner; configuration, not code)

- The deployed Lambdas have `SES_FROM_EMAIL_ADDRESS` set. If it is empty, `sendTemplatedEmail` logs `[Email Stub] Outbound email sending bypassed` and sends nothing (`email/adapter.ts`). CloudWatch: search the API, AI-processor and notifier Lambdas for `[Email Stub]` and `Failed to notify moderator`.
- SES: the domain identity (`festdaily.app`, DKIM) is verified, **and the account is out of the SES sandbox**; in the sandbox only verified recipient addresses receive mail. Send one test message to the moderator's address from the SES console. Check the spam folder.
- `users.role = 'moderator'` for the moderator's own row in production, and `deleted_at IS NULL`.
- Run as the database owner, counts only: moderators; moderators with an `fcm_tokens` row; with a `user_settings` row; with `push_notifications_enabled`; with an active subscription.

The queries are in `_bmad-output/planning-artifacts/event-insight-poc/results/prod-findings-review-2026-10-19-queries/owner-notification-checks.sql` (owner-run, read-only transaction, tested on a scratch database built from the migrations): the moderators as a group, the owner's own row, the accounts the owner subscribes to (type, twin profile, last 30 days of events: stubs and notified), and the global notified-versus-not split.

**Investigation brief for the local session:** `event-insight-poc/prod-readonly/local-session-brief-2026-10-20.md` (Job B). A further lead found while writing it: `getSubscribersForNotification` joins `social_media_account_profiles.account_id` to the event's source account id, so a subscription to a BUG-059 twin profile never matches; and the token is saved only from Settings → Notifications, per browser or installed app.

## Why it matters for the architecture

AD-36 Rules 4 and 7 and AD-30 Rule 7 rely on "moderators review after the fact" and on a sweep that "must not enqueue candidates faster than moderators resolve them". If a moderator cannot be reached, review never happens. The follow-up that makes it work is IDEA-090 (a moderator work-queue digest and push). The two fixes are independent: this bug is "the existing five emails do not arrive", IDEA-090 is "the queue produces notifications".

## Local investigation, 2026-10-20 (code and one browser; report: `event-insight-poc/results/notification-and-session-investigation-2026-10-20.md`)

Nothing was fixed or deployed. The owner-run SQL (`owner-notification-checks.sql`), SES, Lambda environment and Supabase auth checks were **not** run, so none of the push causes below is confirmed on production.

- **Email to a subscriber or a moderator about an event or a queue item does not exist.** `EMAIL_TEMPLATES` holds eight templates, none for a new event, a subscription or a queue item. This is not a defect to fix in BUG-069; it is the missing capability of IDEA-090.
- **Push, ranked by the investigator (code inference):** (1) no `fcm_tokens` row for the browser or installed app: the token is saved only when the Notifications settings page loads with push on, per browser, and needs a login; (2) a subscription to a BUG-059 twin profile (the join needs `account_id` to equal the event's account); (3) no qualifying event: stubs, curator-typed and roundup events never notify, and the claim is taken before sending; (4) a missing `user_settings` row or push off (the page shows ON when the database value is null); (5) Firebase or FCM failure, reported through SES, so silent if SES is unset.
- **Device side is not the cause in the observed browser:** permission granted, the Firebase worker active at scope `/` with all five parameters set, a push subscription present.
- **Link to the logout defects (BUG-072):** a moderator who is logged out when the Notifications page loads saves no token. An inference from code; the logout was not reproduced in about three minutes of browsing.
- **Still true:** a failed send is silent (`Promise.allSettled` ignored, or `console.error` only).

Owner checklist: section 6 of the report (SQL, SES sandbox and sender, Firebase variables, moderator role, Supabase auth settings, CloudWatch counts per day, browser steps).

## Update 2026-10-21

The local session's AWS checks and the owner's SQL (result set 4 only) found infrastructure causes, split out as **BUG-073**: the Ingestor and AIProcessor, which send the pushes, hold no Firebase credentials and no alert address; SES is in the sandbox with no verified identity; the claim before the send loses the notification when the start fails. Production also has 2 registered users, neither with push on. The owner's result sets 1 to 3 (does the owner have a token, push on, an untwinned subscription) are still missing: re-run the script with the e-mail typed in, one select at a time.
