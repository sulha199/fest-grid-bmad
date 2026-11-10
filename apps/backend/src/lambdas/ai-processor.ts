import type { SQSEvent, Context, SQSBatchResponse } from 'aws-lambda';
import { processAiJob } from '../lib/ai-processor/process-ai-job.js';
import { processManualExtractionJob } from '../lib/ai-processor/process-manual-extraction-job.js';
import { type ProcessingJobMessage, type ManualExtractionInvokePayload } from '@festgrid/domain/posts';
import { pollAndDrainQueue, hasJobType, type PollAndDrainQueueOptions } from '../lib/aws/poll-and-drain-queue.js';
import { loadBackendEnv } from '../env.js';
import { resumeDueExtractions } from '../lib/posts/resume-due-extractions.js';
import { resumeStalledChains } from '../lib/ai-processor/resume-stalled-chains.js';

type PollAndDrainEvent = { jobType: 'poll-and-drain' };

// Measured on prod 2026-11-02..09 (log gaps between consecutive messages, an upper bound): p50 4.6s,
// p95 22s, p99 40s, max 71s. One message's budget for receive sizing is therefore ~p99.
const AI_PER_MESSAGE_BUDGET_MS = 45_000;
// Added on top of the face-blur floor (FACE_BLUR_MIN_REMAINING_TIME_MS): the cover blur, any slide blurs and
// the Gemini call all happen after a message starts, and the slide blurs and the thumbnail stage each
// re-check that floor. ~p99 of a message's duration, so all but the slowest ~1% finish above the floor.
const AI_MESSAGE_WORK_MARGIN_MS = 40_000;

// Without these a message can start with ~30s of the 300s timeout left, below the face-blur floor, and the
// cover blur then fails closed: the post is extracted text-only, gets no thumbnail and is never retried
// (380 prod posts, 2026-10-05..11-09). Only applies when face blurring is on and the Lambda context can
// tell us the remaining time; otherwise the loop keeps its original unbounded behavior.
function buildDrainBudget(context: Context): PollAndDrainQueueOptions | undefined {
  const env = loadBackendEnv();
  if (!env.blurFacesBeforeAi || !context.getRemainingTimeInMillis) {
    return undefined;
  }
  const getRemainingTimeInMillis = context.getRemainingTimeInMillis.bind(context);
  const minRemainingMs = env.faceBlurMinRemainingTimeMs + AI_MESSAGE_WORK_MARGIN_MS;
  return {
    minRemainingMs,
    getRemainingTimeInMillis,
    perMessageBudgetMs: AI_PER_MESSAGE_BUDGET_MS,
    // The last receive must still leave its messages a start at or above `minRemainingMs`: receives size to
    // floor((budget - elapsed) / perMessage) and stop at 0, so a budget of remaining - min + perMessage makes
    // the last receive happen no later than (timeout - min).
    timeBudgetMs: Math.max(0, getRemainingTimeInMillis() - minRemainingMs + AI_PER_MESSAGE_BUDGET_MS),
  };
}

export const handler = async (
  event: SQSEvent | PollAndDrainEvent | ManualExtractionInvokePayload,
  context: Context
): Promise<SQSBatchResponse | void> => {
  // Prod-only (AC3): the EventBridge-scheduled poll-and-drain trigger, replacing the
  // continuous SqsEventSource poller. This event shape has no `Records` field, so it must
  // be checked before the pre-existing SQS-batch branch below (used only when dev/staging's
  // gated ESM, AC2, is opted in -- that branch and its reportBatchItemFailures behavior are
  // otherwise unchanged).
  // Story 4.2b: asynchronous direct invoke from the API Lambda for a manual "AI-Assisted
  // Correction" extraction (no queue involved -- prod's AI Lambda only drains the queue every 5
  // minutes, far too slow for a user waiting on a spinner). Checked before the SQS-batch branch
  // below, which is otherwise untouched.
  if (hasJobType(event, 'manual-extraction')) {
    await processManualExtractionJob(event.jobId, {
      getRemainingTimeInMillis: context.getRemainingTimeInMillis?.bind(context),
    });
    return;
  }

  if (hasJobType(event, 'poll-and-drain')) {
    console.log('Running poll-and-drain for AI processing queue');
    // AD-52 Rule 5: re-enqueue posts whose failed extraction has a retry due, before draining, so they are
    // picked up in this same tick. Never lets a problem here stop the drain.
    try {
      await resumeDueExtractions();
    } catch (error) {
      console.error('[ai-processor] resume pass failed; continuing with the drain:', error);
    }
    // AD-47 Rules 5-6: stalled stepped extractions are resumed (after one re-scrape when their images expired).
    try {
      await resumeStalledChains();
    } catch (error) {
      console.error('[ai-processor] chain resume pass failed; continuing with the drain:', error);
    }
    await pollAndDrainQueue(
      process.env.AI_PROCESSING_QUEUE_URL!,
      async (body) => {
        const message: ProcessingJobMessage = JSON.parse(body);
        // Story 3.6n (AC5): optional chaining -- real Lambda invocations always provide this,
        // but existing tests (ai-processor.test.ts) pass a bare `{} as any` context with no
        // getRemainingTimeInMillis, which must keep working unchanged (defaults to unbounded).
        await processAiJob(message, {
          getRemainingTimeInMillis: context.getRemainingTimeInMillis?.bind(context),
        });
      },
      buildDrainBudget(context)
    );
    return;
  }

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const message: ProcessingJobMessage = JSON.parse(record.body);
      // Story 3.6n (AC5): optional chaining -- real Lambda invocations always provide this,
      // but existing tests (ai-processor.test.ts) pass a bare `{} as any` context with no
      // getRemainingTimeInMillis, which must keep working unchanged (defaults to unbounded).
      await processAiJob(message, {
        getRemainingTimeInMillis: context.getRemainingTimeInMillis?.bind(context),
      });
    } catch (error) {
      console.error(
        `Error processing SQS record with messageId ${record.messageId}:`,
        error
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
