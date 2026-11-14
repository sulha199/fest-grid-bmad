# 4. Push Notifications

*   **Service:** **Firebase Cloud Messaging (FCM)**
*   **Description:** A cross-platform messaging solution.
*   **Reasoning:** FCM is the industry standard for push notifications. It's free, reliable, and provides everything needed to send notifications to the PWA.

---

## Job-finished push (Story 10.13)

*   **Sent by:** the Scraper Lambda, from the last step of the 5-minute job sweep (`announceEndedJobs`). It holds the Firebase variables and the Firebase private-key secret read for this; the AI processor holds neither.
*   **Who gets it:** the owner of a job that ended, through the existing `pushNotificationsEnabled` setting (default on) and the registered device tokens; no new consent screen. A system job notifies no one. A job whose owner saw it end on a visible tab is not pushed.
*   **When:** a just-ended job waits `JOB_NOTIFY_GRACE_SECONDS` (45); one push per owner per `JOB_NOTIFY_WINDOW_MINUTES` (10), several endings inside the window merge into one push to the Jobs page; an ended job older than `JOB_NOTIFY_MAX_AGE_MINUTES` (60) is not pushed.
*   **Text:** the job type and the account handle (or the number of posts), English and Indonesian in one message; never a vendor, caption, post URL or error text. The push `data` is `{ type: 'JOB_FINISHED', path }`, and the service worker opens `data.path` on click (web part of the story).
