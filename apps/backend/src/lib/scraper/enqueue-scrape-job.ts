import { loadBackendEnv } from '../../env.js';
import { ScrapeTarget } from './get-scrape-targets.js';
import { sendSqsMessage } from '../aws/send-sqs-message.js';

export { sendSqsMessage, setSendSqsMessage } from '../aws/send-sqs-message.js';

export async function enqueueScrapeJob(target: ScrapeTarget): Promise<void> {
  const env = loadBackendEnv();
  if (!env.scrapingQueueUrl) {
    throw new Error('SCRAPING_QUEUE_URL is not configured');
  }
  await sendSqsMessage(env.scrapingQueueUrl, JSON.stringify(target));
}
