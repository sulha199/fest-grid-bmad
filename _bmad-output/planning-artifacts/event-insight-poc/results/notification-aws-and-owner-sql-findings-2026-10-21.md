# Notification investigation: AWS read-only checks and owner SQL (2026-10-21)

Measured on 2026-10-21 by the local session (AWS, region us-east-1, read-only calls only) and by the owner (the SQL). Companion to `local-session-brief-2026-10-20.md` §4 (Job B). No e-mail address, account id, token, endpoint or user id appears here. Lambda names are shortened.

## 1. Caveats first

* The AWS identity on the owner's machine is an IAM user with `AdministratorAccess`, not a read-only one. The owner asked for the checks anyway. Only `get`, `list`, `describe`, `start-query` and `get-query-results` were called; nothing was changed or sent.
* The owner's SQL (`owner-notification-checks.sql`) returned **only result set 4**: the Supabase SQL editor shows the last result of a multi-statement script, and the script's `:'owner_email'` is a psql variable that the editor cannot read. **Result sets 1 to 3 (moderators, the owner's own row, the owner's subscribed accounts) are still missing.** They are the ones that say whether the owner has a token, push enabled and an untwinned subscription.
* Every Logs Insights figure counts **log lines**, not sends. One failed send writes more than one line (the two Firebase lines are about double the `FCM batch dispatch failed` lines on the same days).

## 2. SES (us-east-1)

| Check | Result |
|---|---|
| Account in sandbox | **Yes.** `ProductionAccessEnabled` = false; quota 200 per 24 h, sent in the last 24 h: 0; enforcement status HEALTHY |
| Verified sender identities | **None.** The account has exactly one SES identity, a DOMAIN, with `VerificationStatus` = FAILED, error `HOST_NOT_FOUND`, DKIM FAILED, `VerifiedForSendingStatus` = false |
| Does the configured sender match it | `SES_FROM_EMAIL_ADDRESS` is set on three production Lambdas (Api, Notifier, Scraper) and in all three **its domain differs from the one SES identity** |

Reading: no e-mail can leave SES today, and the sandbox would limit it to verified recipients even if the domain were fixed.

## 3. Production Lambda variables (names and presence only; values not read into this file)

| Lambda | `SES_FROM_EMAIL_ADDRESS` | `SYSTEM_ERROR_ALERT_EMAIL` | `FIREBASE_*` keys |
|---|---|---|---|
| Api | set (domain mismatch) | set | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Notifier | set (domain mismatch) | absent | none |
| Scraper | set (domain mismatch) | absent | none |
| **Ingestor** | **absent** | **absent** | **none** |
| **AIProcessor** | **absent** | **absent** | **none** |
| Webhook, ApifyWebhook | absent | absent | none |

Code trace, confirmed in the repository: `notifyNewEvent` is called from `processIngestionJob` (`apps/backend/src/lib/ingestor/process-ingestion-job.ts:148`), which runs in the Ingestor Lambda (`lambdas/ingestor.ts`) and inline in the AI processor (`lib/ai-processor/process-ai-job.ts:552`). `getAdminApp` (`lib/firebase-admin.ts:22-26`) throws when the three Firebase variables are missing, and there is no Secrets Manager or SSM fallback in `env.ts`. So the two Lambdas that send pushes have no Firebase credentials, and the Lambdas that hold them (Api) do not send pushes. The failure alert (`SYSTEM_ERROR_ALERT_EMAIL`) is also absent on those two Lambdas, and their e-mail adapter is a stub.

## 4. CloudWatch Logs Insights, Ingestor and AIProcessor log groups, last 14 days (log lines per day)

| Day | `Firebase Admin initialization failed` | `FCM batch dispatch failed` | `No subscribers with active device tokens` | `[sendEventNotifications]` (any) | `[Email Stub]` |
|---|---|---|---|---|---|
| 2026-10-07 | 42 | 21 | 0 | 21 | 0 |
| 2026-10-08 | 68 | 34 | 0 | 34 | 0 |
| 2026-10-09 | 38 | 19 | 1 | 20 | 2 |
| 2026-10-10 | 48 | 24 | 4 | 28 | 0 |
| 2026-10-11 | 26 | 13 | 6 | 19 | 0 |
| 2026-10-12 | 34 | 17 | 1 | 18 | 0 |
| 2026-10-13 | 40 | 20 | 1 | 21 | 0 |
| 2026-10-14 | 36 | 18 | 0 | 18 | 0 |
| 2026-10-15 | 36 | 18 | 2 | 20 | 0 |
| 2026-10-16 | 26 | 13 | 226 | 239 | 36 |
| 2026-10-17 | 0 | 0 | 41 | 41 | 8 |
| 2026-10-18 | 0 | 0 | 21 | 21 | 18 |
| 2026-10-19 | 0 | 0 | 47 | 47 | 12 |
| 2026-10-20 | 0 | 0 | 47 | 47 | 2 |

`Notification dispatch failed` (the backstop in `process-ingestion-job.ts:162`): 0 lines.

Reading (the local session's, not verified further):

* **2026-10-07 to 10-16:** almost every notification attempt reached the Firebase step and failed to initialise it. A send gets that far only when the event's source account has at least one subscriber **with a token and push enabled**; so during that window at least one such recipient existed, and no push could be delivered because the Ingestor has no credentials.
* **From 2026-10-16:** the Firebase error stops and **every** attempt logs "No subscribers with active device tokens" (226 on the 16th, then 41, 21, 47, 47). Either every token/subscription row for the followed accounts disappeared on or about 10-16, or the subscriber join stopped matching (BUG-059 twin profiles is one candidate). What happened on 10-16 is not visible from here; the owner's result sets 1 to 3 would show which.
* Even after a token returns, the Firebase variables still have to reach the Ingestor and AIProcessor before a push can be delivered.
* `[Email Stub]` lines confirm those Lambdas run the e-mail adapter in stub mode (empty sender variable).

## 5. Owner SQL, result set 4 only (events created in the last 30 days, not deleted)

| events_30d | notified | not_notified_stub | not_notified_full |
|---|---|---|---|
| 1181 | 721 | 279 | 181 |

Reading: `notified_at` is claimed **before** the send (`lib/events/notify-new-event.ts:27-37`), so "notified" means the claim succeeded, not that a push was delivered. 721 of 1181 events (61 %) were claimed, 279 are stubs (a stub never notifies by design), and 181 full events were never claimed (curator, roundup or non-organizer posts, or ingested outside the notifying path). Because the claim comes first and is never retried, the claimed events whose send failed (the 10-07 to 10-16 failures in §4) cannot be notified later.

## 6. Open items for the owner

1. Run the owner SQL again so result sets **1 to 3** come back (in the editor: replace both `:'owner_email'` with a quoted address and run each of the four selects separately; or use psql with `-v owner_email=...`).
2. Not changed, only listed: verify the SES domain's DNS (the identity failed with `HOST_NOT_FOUND`), request SES production access, make `SES_FROM_EMAIL_ADDRESS` match a verified identity, add `FIREBASE_*` and the alert address to the Ingestor and AIProcessor, and check the Supabase auth settings (JWT expiry, refresh-token reuse interval, compromised-token revocation). The Supabase CLI is not installed here.
3. Cloud session: decide whether the claim-before-send should be undone when the send fails to initialise (events claimed during the credential outage are lost for good).
