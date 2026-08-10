import type { SQSEvent, Context, SQSBatchResponse } from 'aws-lambda';
import { processAiJob } from '../lib/ai-processor/process-ai-job.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const message: ProcessingJobMessage = JSON.parse(record.body);
      await processAiJob(message);
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
