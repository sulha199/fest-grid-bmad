import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { posts, eventPosts } from '@festgrid/database';
import { ExtractedEventMessage } from '@festgrid/domain';
import { parsePlatformPostIdentity } from '@festgrid/domain/scraper';
import { notifyNewEvent } from '../events/notify-new-event.js';
import { evaluateIngestionMatch } from './evaluate-ingestion-match.js';
import { type DedupDecisionLog } from './build-dedup-decision-log.js';
import { writeIngestionDecision } from './write-ingestion-decision.js';

export async function processIngestionJob(message: ExtractedEventMessage): Promise<{ inserted: boolean }> {
  let insertedEvent: any = null;
  let shouldNotify = false;
  // Set on the paths that act on a match decision; logged only after the transaction commits, so a
  // rolled-back attempt never reports a decision that did not happen.
  let dedupDecisionLog: DedupDecisionLog | null = null;

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

    // Stub rule, organizer discount and candidate search live in evaluateIngestionMatch -- the one
    // place the decision is made, shared with the moderator re-extract preview (AD-40).
    const evaluation = await evaluateIngestionMatch(tx, message, sourcePost ?? null);

    // The write half (enrich on a high match; otherwise insert + schedules + queue a mid match) is
    // shared with the moderator re-extract Apply (AD-40): one function, two callers.
    const written = await writeIngestionDecision(tx, message, extractionOrdinal, evaluation);
    if (!written.inserted) {
      return { inserted: false };
    }
    insertedEvent = written.event;
    shouldNotify = written.shouldNotify;
    dedupDecisionLog = written.dedupDecisionLog;

    return { inserted: true };
  });

  // One structured line per match decision (high / mid / low / no candidate). The high path leaves
  // no other trace, so this line is the only way to read the auto-linked vs queued rate; the
  // Logs Insights queries are in docs/infrastructure/7-event-dedup.md.
  if (dedupDecisionLog) {
    console.log(JSON.stringify(dedupDecisionLog));
  }

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
