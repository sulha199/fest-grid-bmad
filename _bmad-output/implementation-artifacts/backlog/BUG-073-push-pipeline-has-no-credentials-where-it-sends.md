---
backlog_id: BUG-073
title: "The push pipeline has no credentials where it sends (found 2026-10-21)"
captured: 2026-10-21
---

# BUG-073: the push pipeline has no credentials where it sends (found 2026-10-21)

Found by the local session's read-only AWS checks and the owner's SQL (`planning-artifacts/event-insight-poc/results/notification-aws-and-owner-sql-findings-2026-10-21.md`), read in `round-4-analysis-2026-10-21.md` section 6. Companion to BUG-069 (a moderator receives nothing). Not fixed; nothing was changed in AWS.

## What is wrong

1. **The Lambdas that send pushes cannot start Firebase.** `notifyNewEvent` runs in the Ingestor (`process-ingestion-job.ts:148`) and inline in the AI processor (`process-ai-job.ts:552`). `getAdminApp` (`lib/firebase-admin.ts:22-26`) throws when `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` or `FIREBASE_PRIVATE_KEY` is missing, and `env.ts` has no other source. Those two Lambdas hold none of them; the Api Lambda holds them and sends no pushes.
2. **The failure alert goes nowhere.** `SYSTEM_ERROR_ALERT_EMAIL` and `SES_FROM_EMAIL_ADDRESS` are absent on the Ingestor and AIProcessor, whose e-mail adapter is therefore a stub (`[Email Stub]` lines in the logs).
3. **No e-mail can leave SES at all.** The account is in the sandbox, its one identity is a domain in `FAILED` state (`HOST_NOT_FOUND`, DKIM failed) and the configured sender's domain matches no identity. The five moderator e-mails are affected too.
4. **A failed start loses the notification for good.** `notifyNewEvent` sets `notified_at` before it sends and never retries (AD-30 Rule 10). 2026-10-07 to 10-16 the logs show about 40 failed Firebase initialisations a day; those events can never notify.
5. Since 2026-10-16 every attempt logs "No subscribers with active device tokens"; production has 2 registered users and neither has push on (`usage-counts`). Why the tokens disappeared on 10-16 is not visible from here: the owner's result sets 1 to 3 would show.

## Proposed fix (for a story, not done)

* Give the Ingestor and AIProcessor the three `FIREBASE_*` variables and the alert address (or move the send behind a Lambda that has them); one source in `env.ts`.
* Release the claim (set `notified_at` back to NULL) **only when the failure happens before any FCM request is made** (initialisation); every other failure keeps claim-before-send, so a double send stays impossible. Add a test for both branches. **Adopted by the owner 2026-10-21** (AD-30 Rule 10, amended).
* SES: fix the domain's DNS, request production access, set `SES_FROM_EMAIL_ADDRESS` to a verified identity (owner's checklist).
* Tell a moderator or the owner when initialisation fails (it is the first alert this needs).

## Status 2026-10-21

Owner SQL (one row per user, 2 users, both `moderator`): `push_enabled` is **false** for both although each has 2 FCM token rows (created 2026-08-30, last updated 2026-09-22 and 09-28); they hold 31 and 17 active subscriptions, of which 1 and 3 are subscriptions to **twin profiles** (BUG-059: they never match an event's source account); 10 and 12 follow organizer accounts. Push was therefore switched off for both about when the logs change (2026-10-16); who or what switched it is not visible. The owner confirms SES is in the sandbox and has not yet fixed the SES domain's DNS or requested SES production access. The app is not released; the 2 production users are the owner's. This is a launch blocker for push and for every e-mail.

## Blocks

IDEA-090 (moderator queue notifications), the grouped-event notifications of AD-36 Rules 14 and 17.5, and the first-organizer-post notification itself.

## Resolution 2026-10-22: code and CDK (sandbox-capable); the SES account steps stay with the owner

Built on master as one commit, `784455c0`, PR [sulha199/fest-grid-bmad#93](https://github.com/sulha199/fest-grid-bmad/pull/93) (cut after the BUG-074 hotfix). This page's status stays `backlog`: the code half of the list under "What is wrong" is done, the SES account half is not.

| Item | State |
|---|---|
| 1. Ingestor cannot start Firebase | Done. The Ingestor gets `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (one `firebaseEnv` object shared with the Api) and the Firebase secret read. |
| 1. AI processor (`process-ai-job.ts:552`) | **Not wired, on purpose:** that notify path is not on master (it lives on the planning branch). Whoever ships it must give that Lambda `firebaseEnv`, `mailEnv`, `systemAlertEnv` and `grantSesSend` in `festgrid-backend-stack.ts`; there is a comment at the spot. |
| 2. Alert and mail env | Done for the Ingestor (`SES_FROM_EMAIL_ADDRESS`, `WEB_APP_BASE_URL`, `SYSTEM_ERROR_ALERT_EMAIL`) and the two webhooks (`mailEnv`). The values come from the deploy environment; unset means the same empty value as before, so nothing changes until the owner sets them. |
| 3. No e-mail leaves SES | Code half done: every sending Lambda (Api, Ingestor, Notifier, Scraper, both webhooks) may `ses:SendEmail` on the domain identity **and** on the From address identity. Account half is the owner's, see "SES sandbox" below. |
| 4. A failed start burns the notification | Done. `notifyNewEvent` claims `notified_at` before the send and releases it (compare-and-set on the claim time) only when `sendEventNotifications` reports `firebaseInitFailed`. A release failure is logged, never thrown. Both branches are tested. AD-30 Rule 10 is unchanged in meaning. |
| 5. No tokens since 10-16 | Not a code defect found; owner SQL result sets 1 to 3 still decide it. |
| "Tell a moderator or the owner when initialisation fails" | Not built. The failure alert now has an address and a grant but no SES to send through; see IDEA-096 for an alert that does not need SES. |

### SES sandbox: what it takes (answer to "can we use sandbox mode?")

Yes for the moderators, because the sandbox only restricts *who* can receive, not whether the app can send:

- **Sender:** `SES_FROM_EMAIL_ADDRESS` must be a verified identity in the account's region, either the address itself (click-through verification, no DNS) or an address under a verified domain. The existing domain identity is `FAILED` (DNS), so verify the address, which is what the extra IAM grant on the address identity is for.
- **Recipients:** each must be a verified identity too. The moderators have confirmed theirs; any other user's mail is rejected with `MessageRejected`.
- **Limits:** 200 messages per 24 h, 1 per second. Enough for moderator mail and the failure alert; not for user-facing mail.
- **Production access** (a console request, owner only) is needed for non-moderator mail and is the launch blocker for it, not for moderator mail.
- **To switch it on:** set `SES_FROM_EMAIL_ADDRESS` and `SYSTEM_ERROR_ALERT_EMAIL` (a verified address) in the deploy environment and redeploy. The Lambdas need no other change.

### Known gaps left

- The Notifier and Scraper keep their existing wiring; only the grant was widened.
- The owner-side checks (the `[Email Stub]` lines disappearing, a test send) cannot be done from the repository.
