import { and, eq } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { planExtractionFailure, type ExtractionFailurePlan } from '@festgrid/domain/posts';
import type { RetryHint, RetrySituation } from '@festgrid/domain/retry';
import { db } from '../../db/client.js';

// AD-52 Rule 4 -- the post-level attempt ledger. A failed extraction job records the failure here (one update that
// also releases the claim); a successful extraction clears it (markPostExtracted); a moderator's manual selection
// resets it (enqueuePostForProcessing). The values come from the pure `planExtractionFailure`.

/** How often a failure write is retried when another writer changed the attempts counter in between. */
const MAX_LEDGER_WRITE_TRIES = 3;

/** The four ledger columns back at their clean state. */
export const CLEAN_EXTRACTION_LEDGER = {
  extractionAttempts: 0,
  extractionFailureReason: null,
  extractionNextAttemptAt: null,
  extractionFirstFailureAt: null,
} as const;

/**
 * Records one failed extraction job and releases the claim. Returns the plan that was stored, or `undefined`
 * when there was nothing to record (the post does not exist or is already extracted), so the caller can fall
 * back to its previous behavior for that case.
 */
export async function recordExtractionFailure(input: {
  postId: string;
  situation: RetrySituation;
  hint?: RetryHint;
  now?: Date;
}): Promise<ExtractionFailurePlan | undefined> {
  const now = input.now ?? new Date();

  // Read, plan, write guarded by the attempts value that was read: two failures racing for one post (a duplicate
  // message, overlapping ticks) cannot both write from the same count, so no attempt is lost. A lost race re-reads.
  let plan: ExtractionFailurePlan | undefined;
  for (let tries = 0; tries < MAX_LEDGER_WRITE_TRIES && !plan; tries++) {
    const [row] = await db
      .select({
        isExtracted: posts.isExtracted,
        attempts: posts.extractionAttempts,
        firstFailureAt: posts.extractionFirstFailureAt,
      })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);
    if (!row || row.isExtracted) {
      return undefined;
    }

    const candidate = planExtractionFailure({
      situation: input.situation,
      ...(input.hint ? { hint: input.hint } : {}),
      attemptsBefore: row.attempts,
      firstFailureAt: row.firstFailureAt,
      now,
    });

    const updated = await db
      .update(posts)
      .set({
        extractionAttempts: candidate.attempts,
        extractionFailureReason: candidate.failureReason,
        extractionNextAttemptAt: candidate.nextAttemptAt,
        extractionFirstFailureAt: candidate.firstFailureAt,
        // Release the claim so the post reads as failed at once instead of after the claim TTL.
        queuedForExtractionAt: null,
      })
      .where(and(eq(posts.id, input.postId), eq(posts.isExtracted, false), eq(posts.extractionAttempts, row.attempts)))
      .returning({ id: posts.id });
    if (updated.length > 0) {
      plan = candidate;
    }
  }
  if (!plan) {
    return undefined;
  }

  console.info(
    `[extraction-failure] post=${input.postId} situation=${plan.failureReason} attempts=${plan.attempts} ` +
      `nextAttemptAt=${plan.nextAttemptAt ? plan.nextAttemptAt.toISOString() : 'none'} ` +
      `givenUpBecause=${plan.givenUpBecause ?? 'n/a'}`
  );
  return plan;
}
