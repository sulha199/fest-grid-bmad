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

```sql
select count(*) filter (where u.role = 'moderator' and u.deleted_at is null) as moderators,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from fcm_tokens t where t.user_id = u.id)) as with_push_token,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from user_settings s where s.user_id = u.id)) as with_settings_row,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from user_settings s where s.user_id = u.id and s.push_notifications_enabled)) as push_enabled,
       count(*) filter (where u.role = 'moderator' and u.deleted_at is null and exists (select 1 from subscriptions b where b.user_id = u.id and b.deleted_at is null)) as with_active_subscription
from users u;
```

## Why it matters for the architecture

AD-36 Rules 4 and 7 and AD-30 Rule 7 rely on "moderators review after the fact" and on a sweep that "must not enqueue candidates faster than moderators resolve them". If a moderator cannot be reached, review never happens. The follow-up that makes it work is IDEA-090 (a moderator work-queue digest and push). The two fixes are independent: this bug is "the existing five emails do not arrive", IDEA-090 is "the queue produces notifications".
