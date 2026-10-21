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
* Release the claim (set `notified_at` back to NULL) **only when the failure happens before any FCM request is made** (initialisation); every other failure keeps claim-before-send, so a double send stays impossible. Add a test for both branches.
* SES: fix the domain's DNS, request production access, set `SES_FROM_EMAIL_ADDRESS` to a verified identity (owner's checklist).
* Tell a moderator or the owner when initialisation fails (it is the first alert this needs).

## Blocks

IDEA-090 (moderator queue notifications), the grouped-event notifications of AD-36 Rules 14 and 17.5, and the first-organizer-post notification itself.
