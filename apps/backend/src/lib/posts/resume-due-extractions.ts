import { and, asc, eq, isNotNull, isNull, lte } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import {
  PostAlreadyExtractedError,
  PostAlreadyQueuedError,
  PostNotFoundError,
  computeClaimCutoff,
} from '@festgrid/domain/posts';
import { db } from '../../db/client.js';
import { loadBackendEnv } from '../../env.js';
import { enqueuePostForProcessing } from './enqueue-post-for-processing.js';
import { recordExtractionFailure } from './extraction-ledger.js';

// AD-52 Rule 5 -- the resume pass. The AI Lambda runs it at the start of every 5-minute tick: posts whose recorded
// failure has a retry due are re-enqueued through the same atomic claim every other enqueue uses.
//
// A retry that is enqueued gets a watchdog: `extraction_next_attempt_at` is moved past the claim TTL, so a job
// that dies without recording anything (a Lambda timeout, a crash) is found again, counted as a failed attempt
// and either retried later or given up. That keeps every retry chain bounded without a second counter.

/** At most this many posts are resumed per tick; the rest wait for the next one. */
export const RESUME_PASS_LIMIT = 10;
/** The watchdog fires this long after the claim could have expired (one tick). */
const WATCHDOG_GRACE_MS = 5 * 60 * 1000;

export interface ResumePassResult {
  enqueued: number;
  watchdogFailures: number;
  skipped: number;
}

export async function resumeDueExtractions(now: Date = new Date()): Promise<ResumePassResult> {
  const env = loadBackendEnv();
  const claimTtlMinutes = env.postExtractionClaimTtlMinutes;
  const cutoff = computeClaimCutoff(claimTtlMinutes, now);
  const result: ResumePassResult = { enqueued: 0, watchdogFailures: 0, skipped: 0 };

  const due = await db
    .select({
      id: posts.id,
      queuedForExtractionAt: posts.queuedForExtractionAt,
      extractionNextAttemptAt: posts.extractionNextAttemptAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.isExtracted, false),
        // A post with a cursor is governed by its cursor counters, not this ledger (AD-52 Rule 5).
        isNull(posts.extractionCursor),
        // A due retry (a recorded failure) or a due watchdog (a first attempt that may have died silently): the claim
        // decides below which of the two it is.
        isNotNull(posts.extractionNextAttemptAt),
        lte(posts.extractionNextAttemptAt, now)
      )
    )
    .orderBy(asc(posts.extractionNextAttemptAt))
    .limit(RESUME_PASS_LIMIT);

  for (const post of due) {
    try {
      const claimedAt = post.queuedForExtractionAt;
      if (claimedAt !== null && claimedAt.getTime() >= cutoff.getTime()) {
        // A live claim: a job is (or may still be) running. Not due yet in any real sense.
        result.skipped++;
        continue;
      }
      if (claimedAt !== null) {
        // The claim expired with no failure recorded: the retry died silently. Count it and reschedule or give up.
        await recordExtractionFailure({ postId: post.id, situation: 'timeout', now });
        result.watchdogFailures++;
        continue;
      }

      // The watchdog is set BEFORE the send and only if the due time is still the one read, so a job that fails
      // fast afterwards writes its own backoff last and is never overwritten here.
      const watchdogAt = new Date(now.getTime() + claimTtlMinutes * 60 * 1000 + WATCHDOG_GRACE_MS);
      const armed = await db
        .update(posts)
        .set({ extractionNextAttemptAt: watchdogAt })
        .where(
          and(
            eq(posts.id, post.id),
            eq(posts.isExtracted, false),
            isNotNull(posts.extractionNextAttemptAt),
            eq(posts.extractionNextAttemptAt, post.extractionNextAttemptAt!)
          )
        )
        .returning({ id: posts.id });
      if (armed.length === 0) {
        // Something else (a manual selection, another pass) changed the post since it was read.
        result.skipped++;
        continue;
      }
      await enqueuePostForProcessing(post.id);
      result.enqueued++;
    } catch (error) {
      result.skipped++;
      console.warn(`[resume-due-extractions] post=${post.id} skipped:`, error instanceof Error ? error.message : error);
      const lostRace =
        error instanceof PostAlreadyQueuedError ||
        error instanceof PostAlreadyExtractedError ||
        error instanceof PostNotFoundError;
      if (!lostRace) {
        // A send or database failure for this post: count it and push it back, so a post that keeps failing cannot
        // sit at the head of the oldest-first selection and starve every later one. Never throws.
        try {
          await recordExtractionFailure({ postId: post.id, situation: 'unavailable', now });
        } catch (recordError) {
          console.warn(`[resume-due-extractions] post=${post.id} could not be rescheduled:`, recordError);
        }
      }
    }
  }

  console.info(
    `[resume-due-extractions] due=${due.length} enqueued=${result.enqueued} ` +
      `watchdogFailures=${result.watchdogFailures} skipped=${result.skipped}`
  );
  return result;
}
