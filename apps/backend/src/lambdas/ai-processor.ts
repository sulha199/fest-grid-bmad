import type { SQSEvent, Context, SQSBatchResponse } from 'aws-lambda';
import { processAiJob } from '../lib/ai-processor/process-ai-job.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { pollAndDrainQueue, hasJobType } from '../lib/aws/poll-and-drain-queue.js';

type PollAndDrainEvent = { jobType: 'poll-and-drain' };

export const handler = async (
  event: SQSEvent | PollAndDrainEvent,
  context: Context
): Promise<SQSBatchResponse | void> => {
  // Prod-only (AC3): the EventBridge-scheduled poll-and-drain trigger, replacing the
  // continuous SqsEventSource poller. This event shape has no `Records` field, so it must
  // be checked before the pre-existing SQS-batch branch below (used only when dev/staging's
  // gated ESM, AC2, is opted in -- that branch and its reportBatchItemFailures behavior are
  // otherwise unchanged).
  if (hasJobType(event, 'poll-and-drain')) {
    console.log('Running poll-and-drain for AI processing queue');
    await pollAndDrainQueue(process.env.AI_PROCESSING_QUEUE_URL!, async (body) => {
      const message: ProcessingJobMessage = JSON.parse(body);
      // Story 3.6n (AC5): optional chaining -- real Lambda invocations always provide this,
      // but existing tests (ai-processor.test.ts) pass a bare `{} as any` context with no
      // getRemainingTimeInMillis, which must keep working unchanged (defaults to unbounded).
      await processAiJob(message, {
        getRemainingTimeInMillis: context.getRemainingTimeInMillis?.bind(context),
      });
    });
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
