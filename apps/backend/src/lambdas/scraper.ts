import type { SQSEvent, EventBridgeEvent, Context } from 'aws-lambda';

export const handler = async (
  event: SQSEvent | EventBridgeEvent<string, unknown>,
  context: Context
): Promise<void> => {
  console.log('scraper lambda invoked (placeholder)', JSON.stringify({ event, context }));
};
