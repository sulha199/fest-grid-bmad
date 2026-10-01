import type { SQSEvent, Context, SQSBatchResponse } from 'aws-lambda';
import { processIngestionJob } from '../lib/ingestor/process-ingestion-job.js';
import { type ExtractedEventMessage } from '@festgrid/domain';
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
    console.log('Running poll-and-drain for data ingestion queue');
    await pollAndDrainQueue(process.env.DATA_INGESTION_QUEUE_URL!, async (body) => {
      const message: ExtractedEventMessage = JSON.parse(body);
      await processIngestionJob(message);
    });
    return;
  }

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const message: ExtractedEventMessage = JSON.parse(record.body);
      await processIngestionJob(message);
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
