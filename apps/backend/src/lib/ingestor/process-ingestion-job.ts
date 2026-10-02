import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { schedules, posts } from '@festgrid/database';
import { ExtractedEventMessage, buildEventInsertValues } from '@festgrid/domain';
import { insertEventWithPrimaryPost } from '../events/set-event-primary-post.js';
import { notifyNewEvent } from '../events/notify-new-event.js';
import { isOrganizerAuthoredPost } from '../posts/is-organizer-authored-post.js';

export async function processIngestionJob(message: ExtractedEventMessage): Promise<{ inserted: boolean }> {
  let insertedEvent: any = null;
  let shouldNotify = false;

  const result = await db.transaction(async (tx) => {
    // Story 3.7g — look up the source post's platform identity inside this transaction (so it
    // sees a consistent view alongside the insert below) and pass it into
    // buildEventInsertValues() so it can derive a platform-prefixed slug (AD-16 Rules 1/3/4).
    // Moved inside the transaction because buildEventInsertValues() now depends on this DB read.
    // Story 3.6t — also select groupingReason, needed for the stub/notify decision below.
    const [sourcePost] = await tx
      .select({
        platform: posts.platform,
        platformPostId: posts.platformPostId,
        platformPostType: posts.platformPostType,
        groupingReason: posts.groupingReason,
      })
      .from(posts)
      .where(eq(posts.id, message.postId))
      .limit(1);

    // Story 3.6t (AC3/AC5) — an event is a stub (never notifies) when its primary post's
    // grouping_reason is 'roundup' OR its primary post is curator-sourced (AD-31 Rule 3,
    // negated); full/notify-eligible otherwise. isStub/shouldNotify are the exact complement of
    // each other by construction (AD-30 Rule 7 and Rule 10 share the same two boolean inputs) --
    // not computed independently, so a future edit to one rule can't silently desync them.
    const isRoundupSourced = sourcePost?.groupingReason === 'roundup';
    const isCuratorSourced = !(await isOrganizerAuthoredPost(message.postId, tx));
    const isStub = isRoundupSourced || isCuratorSourced;

    const { event, schedules: scheduleValues } = buildEventInsertValues(message, sourcePost ?? null, isStub ? 'stub' : undefined);

    // Story 3.6r / AD-30 Rule 2 — the only two call sites allowed to write `events.postId` are
    // insertEventWithPrimaryPost and setEventPrimaryPost (set-event-primary-post.ts), enforced by
    // events-postid-write-ratchet.test.ts. The conflict target is now the composite
    // (postId, extractionOrdinal) unique rather than postId alone (AD-30 Rule 1/3); extractionOrdinal
    // defaults to 0 at the helper's DB-write boundary when the message carries none (AC2).
    const insertedRow = await insertEventWithPrimaryPost(tx, event);

    if (!insertedRow) {
      console.log(`Skipped duplicate ingestion for postId: ${message.postId}, extractionOrdinal: ${message.extractionOrdinal ?? 0}`);
      return { inserted: false };
    }

    insertedEvent = insertedRow;
    shouldNotify = !isStub;

    if (scheduleValues.length > 0) {
      const schedulesToInsert = scheduleValues.map((s) => ({
        ...s,
        eventId: insertedEvent.id,
      }));

      await tx.insert(schedules).values(schedulesToInsert);
    }

    return { inserted: true };
  });

  if (result.inserted && insertedEvent && shouldNotify && message.sourceSocialMediaAccountId) {
    // FIND-061: must be awaited, not fire-and-forget, after the transaction commits. The
    // deployed ingestor Lambda (lambdas/ingestor.ts) awaits processIngestionJob() and then
    // returns; a dangling (unawaited) promise here lets AWS freeze the execution environment
    // before the recipient-query + FCM send ever completes, so notifications silently never
    // go out. notifyNewEvent's underlying sendEventNotifications already catches and reports
    // its own errors internally, so this await cannot turn a committed ingestion into a failure
    // on its own -- the try/catch below is just a defensive backstop so a notification failure
    // never fails the SQS record.
    try {
      await notifyNewEvent(
        db,
        {
          id: insertedEvent.id,
          slug: insertedEvent.slug,
          name: insertedEvent.eventName,
          description: insertedEvent.description || '',
        },
        message.sourceSocialMediaAccountId
      );
    } catch (err) {
      // Defensive backstop only -- sendEventNotifications already catches and reports its own
      // errors internally. This also guards against a seam throwing synchronously (e.g. a test
      // double), which a bare `.catch()` on the call expression would not catch.
      console.error('[processIngestionJob] Notification dispatch failed:', err);
    }
  }

  return { inserted: result.inserted };
}
