import type { SQSEvent, Context } from 'aws-lambda';

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  console.log('ingestor lambda invoked (placeholder)', JSON.stringify({ event, context }));
};
