import type { SQSEvent, Context, SQSBatchResponse } from 'aws-lambda';
import { processIngestionJob } from '../lib/ingestor/process-ingestion-job.js';
import { type ExtractedEventMessage } from '@festgrid/domain';

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
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
