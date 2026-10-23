import { and, eq, isNull } from 'drizzle-orm';
import { events } from '@festgrid/database';
import { sendEventNotificationsSeam } from '../notifications/send-event-notifications.js';
import type { DbExecutor } from './set-event-primary-post.js';

/**
 * AD-30 Rule 10's "one notify helper" -- events.notified_at is set here and nowhere else.
 * Atomically claims notified_at (UPDATE ... WHERE notified_at IS NULL) BEFORE sending, so a
 * concurrent or duplicate call for the same event can never double-send: only the caller whose
 * UPDATE actually returns a row proceeds to call sendEventNotificationsSeam. Eligibility (is
 * this event a roundup/curator-sourced stub that should never notify at all?) is the caller's
 * decision, not this function's -- it only ever claims+sends when asked to.
 *
 * Claim-before-send, not send-before-claim: sendEventNotifications already catches and reports
 * its own errors internally (it never lets an exception propagate), so claiming *after* a call
 * that essentially never throws would make the claim almost unconditional and offer no real
 * protection against a double-send from two concurrent/duplicate invocations (e.g. an
 * at-least-once SQS redelivery racing a slow first attempt). Claiming first via a single atomic
 * `UPDATE ... WHERE notified_at IS NULL RETURNING` is the only point in this flow that gets real
 * atomicity from Postgres itself.
 *
 * One exception, adopted 2026-10-21 (BUG-073, AD-30 Rule 10 amended): when the send reports that
 * Firebase could not be initialised, so no FCM request was made at all, the claim is released
 * (`notified_at` back to NULL) so a later drain or re-drive can notify. Any failure after a request
 * was made keeps the claim and is not retried, which is what keeps a double send impossible. The
 * release only ever undoes *this* call's claim (it matches the exact timestamp it set).
 */
export async function notifyNewEvent(
  executor: DbExecutor,
  event: { id: string; slug: string; name: string; description: string },
  sourceAccountId: string
): Promise<void> {
  const claimedAt = new Date();
  const claimed = await executor
    .update(events)
    .set({ notifiedAt: claimedAt })
    .where(and(eq(events.id, event.id), isNull(events.notifiedAt)))
    .returning({ id: events.id });

  if (claimed.length === 0) {
    return; // already notified -- never re-fire (AD-30 Rule 10)
  }

  const result = await sendEventNotificationsSeam(event, sourceAccountId);

  if (result?.firebaseInitFailed) {
    try {
      await executor
        .update(events)
        .set({ notifiedAt: null })
        .where(and(eq(events.id, event.id), eq(events.notifiedAt, claimedAt)));
    } catch (releaseError) {
      // The caller's work (an ingested event) must not fail because the claim could not be released:
      // the event then stays claimed, exactly as before this release existed.
      console.error(`[notifyNewEvent] Could not release the claim on event ${event.id} after a Firebase initialisation failure:`, releaseError);
    }
  }
}
