import type { SQSEvent, EventBridgeEvent, Context } from 'aws-lambda';
import '../lib/scraper/register-adapters.js';
import { getBatchScrapeTargets } from '../lib/scraper/get-scrape-targets.js';
import { enqueueScrapeJob } from '../lib/scraper/enqueue-scrape-job.js';
import { processScrapeJob } from '../lib/scraper/process-scrape-job.js';

export const handler = async (
  event: SQSEvent | EventBridgeEvent<string, unknown>,
  context: Context
): Promise<void> => {
  console.log('Scraper lambda invoked', JSON.stringify({ event }));

  if ('Records' in event) {
    // SQS Event: Process enqueued scrape jobs
    console.log(`Processing SQS batch of ${event.Records.length} records`);
    for (const record of event.Records) {
      try {
        const target = JSON.parse(record.body);
        await processScrapeJob(target);
      } catch (err) {
        console.error('Failed to parse or process SQS message body:', record.body, err);
      }
    }
  } else {
    // EventBridge Event: Trigger batch targeting and enqueue jobs
    console.log('Triggering daily batch scrape targets extraction');
    try {
      const targets = await getBatchScrapeTargets();
      console.log(`Found ${targets.length} distinct targets to scrape. Enqueuing...`);
      
      const results = await Promise.allSettled(
        targets.map((target) => enqueueScrapeJob(target))
      );

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.error(`Failed to enqueue ${failedCount} out of ${targets.length} scrape jobs`);
      } else {
        console.log(`Successfully enqueued all ${targets.length} scrape jobs`);
      }
    } catch (err) {
      console.error('Failed to retrieve or enqueue batch scrape targets:', err);
      throw err;
    }
  }
};
