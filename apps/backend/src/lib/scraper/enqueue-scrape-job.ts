import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { loadBackendEnv } from '../../env.js';
import { ScrapeTarget } from './get-scrape-targets.js';

export let sendSqsMessage = async (queueUrl: string, body: string): Promise<void> => {
  const client = new SQSClient({});
  await client.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: body,
  }));
};

export function setSendSqsMessage(fn: typeof sendSqsMessage) {
  sendSqsMessage = fn;
}

export async function enqueueScrapeJob(target: ScrapeTarget): Promise<void> {
  const env = loadBackendEnv();
  if (!env.scrapingQueueUrl) {
    throw new Error('SCRAPING_QUEUE_URL is not configured');
  }
  await sendSqsMessage(env.scrapingQueueUrl, JSON.stringify(target));
}
