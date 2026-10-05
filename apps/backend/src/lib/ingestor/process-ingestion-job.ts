import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { schedules, posts, eventPosts, eventMatchCandidates } from '@festgrid/database';
import { ExtractedEventMessage, buildEventInsertValues } from '@festgrid/domain';
import { parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { insertEventWithPrimaryPost, enrichAndPromoteEvent } from '../events/set-event-primary-post.js';
import { notifyNewEvent } from '../events/notify-new-event.js';
import { isOrganizerAuthoredPost } from '../posts/is-organizer-authored-post.js';
import { findMatchingEvent } from '../events/match-event-to-existing.js';

export async function processIngestionJob(message: ExtractedEventMessage): Promise<{ inserted: boolean }> {
  let insertedEvent: any = null;
  let shouldNotify = false;

  const result = await db.transaction(async (tx) => {
    const extractionOrdinal = message.extractionOrdinal ?? 0;

    // Story 3.6v (AC1) -- the idempotency lookup runs BEFORE matching, on the exact same key
    // insertEventWithPrimaryPost's own onConflictDoNothing already enforces
    // ((postId, extractionOrdinal)) -- a hit means this exact item is already represented, and
    // matching must never re-run redundantly on a redelivery (SQS at-least-once). This is purely
    // an early-exit optimization: the observed outcome for an already-covered redelivery is
    // identical to before this story (an idempotent skip), only reached one query sooner.
    const [existingLink] = await tx
      .select({ eventId: eventPosts.eventId })
      .from(eventPosts)
      .where(and(eq(eventPosts.postId, message.postId), eq(eventPosts.extractionOrdinal, extractionOrdinal)))
      .limit(1);

    if (existingLink) {
      console.log(`Skipped duplicate ingestion for postId: ${message.postId}, extractionOrdinal: ${extractionOrdinal}`);
      return { inserted: false };
    }

    // Story 3.7g — look up the source post's platform identity inside this transaction (so it
    // sees a consistent view alongside the insert below) and pass it into
    // buildEventInsertValues() so it can derive a platform-prefixed slug (AD-16 Rules 1/3/4).
    // Moved inside the transaction because buildEventInsertValues() now depends on this DB read.
    // Story 3.6t — also select groupingReason, needed for the stub/notify decision below.
    // Story 3.6v — also select accountId, needed as the matching pass's organizer-match input.
    const [sourcePost] = await tx
      .select({
        accountId: posts.accountId,
        platform: posts.platform,
        platformPostId: posts.platformPostId,
        platformPostType: posts.platformPostType,
        postUrl: posts.postUrl,
        originalPostUrl: posts.originalPostUrl,
        groupingReason: posts.groupingReason,
      })
      .from(posts)
      .where(eq(posts.id, message.postId))
      .limit(1);

    // A post scraped before platform identity was captured at scrape time (migration 0062 added
    // the columns with no backfill) -- or re-found by persistScrapedPost's already-existed branch,
    // which never wrote them -- has null identity here even though its URLs are perfectly
    // parseable. Derive it from the stored URLs (same parser the scrape path uses) so the event
    // still gets its platform-prefixed slug, and persist it so the post is healed for good. A
    // genuinely unparseable URL stays null and keeps the legacy hex-slug fallback.
    if (sourcePost && (sourcePost.platformPostId === null || sourcePost.platformPostType === null)) {
      const derived = parsePlatformPostIdentity({
        postUrl: sourcePost.postUrl,
        originalPostUrl: sourcePost.originalPostUrl,
      });
      if (derived.platformPostId !== null && derived.platformPostType !== null) {
        sourcePost.platformPostId = derived.platformPostId;
        sourcePost.platformPostType = derived.platformPostType;
        await tx
          .update(posts)
          .set({ platformPostId: derived.platformPostId, platformPostType: derived.platformPostType })
          .where(eq(posts.id, message.postId));
      }
    }

    // Story 3.6t (AC3/AC5) — an event is a stub (never notifies) when its primary post's
    // grouping_reason is 'roundup' OR its primary post is curator-sourced (AD-31 Rule 3,
    // negated); full/notify-eligible otherwise. isStub/shouldNotify are the exact complement of
    // each other by construction (AD-30 Rule 7 and Rule 10 share the same two boolean inputs) --
    // not computed independently, so a future edit to one rule can't silently desync them.
    const isRoundupSourced = sourcePost?.groupingReason === 'roundup';
    const isCuratorSourced = !(await isOrganizerAuthoredPost(message.postId, tx));
    const isStub = isRoundupSourced || isCuratorSourced;

    const { event, schedules: scheduleValues } = buildEventInsertValues(message, sourcePost ?? null, isStub ? 'stub' : undefined);

    // Story 3.6v (AC1, Amendment) — organizerHandle defaults to the *posting* account for a
    // roundup/curator-sourced item (Story 3.6s's extraction prompt), which would falsely
    // inflate a match score against an unrelated event the curator/aggregator also covered.
    // Discount it to `undefined` in exactly that case -- reusing isRoundupSourced/isCuratorSourced
    // already computed above, never re-derived.
    const organizerHandleForMatching = isRoundupSourced || isCuratorSourced ? undefined : message.organizerHandle;

    const match = sourcePost
      ? await findMatchingEvent(
          tx,
          event,
          scheduleValues,
          { postId: message.postId, accountId: sourcePost.accountId, groupingReason: sourcePost.groupingReason },
          organizerHandleForMatching
        )
      : null;

    if (match && match.tier === 'high') {
      // Story 3.6v (AC1, AC2, AC4, AC5, AC7) — enrich the matched event in place and promote the
      // new post to primary if it wins AD-30 Rule 7's ordering; no new `events` row.
      const { event: enrichedEvent, becameOrganizerAuthored } = await enrichAndPromoteEvent(
        tx,
        match.candidate,
        event,
        scheduleValues,
        message.postId,
        extractionOrdinal
      );

      insertedEvent = enrichedEvent;
      shouldNotify = becameOrganizerAuthored;

      return { inserted: true };
    }

    // Story 3.6r / AD-30 Rule 2 — the only two call sites allowed to write `events.postId` are
    // insertEventWithPrimaryPost and setEventPrimaryPost (set-event-primary-post.ts), enforced by
    // events-postid-write-ratchet.test.ts. The conflict target is now the composite
    // (postId, extractionOrdinal) unique rather than postId alone (AD-30 Rule 1/3); extractionOrdinal
    // defaults to 0 at the helper's DB-write boundary when the message carries none (AC2).
    const insertedRow = await insertEventWithPrimaryPost(tx, event);

    if (!insertedRow) {
      console.log(`Skipped duplicate ingestion for postId: ${message.postId}, extractionOrdinal: ${extractionOrdinal}`);
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

    if (match && match.tier === 'mid') {
      // Story 3.6v (AC1, AC8) — queue a suggested-match record for moderator review (Story
      // 3.6w's own scope to read it); idempotent on (eventId, candidateEventId) re-run.
      await tx
        .insert(eventMatchCandidates)
        .values({
          eventId: insertedEvent.id,
          candidateEventId: match.candidate.id,
          score: match.score,
          postId: message.postId,
        })
        .onConflictDoNothing({ target: [eventMatchCandidates.eventId, eventMatchCandidates.candidateEventId] });
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
