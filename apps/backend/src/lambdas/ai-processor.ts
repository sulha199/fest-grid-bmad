import type { SQSEvent, Context } from 'aws-lambda';

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  console.log('ai-processor lambda invoked (placeholder)', JSON.stringify({ event, context }));
};
