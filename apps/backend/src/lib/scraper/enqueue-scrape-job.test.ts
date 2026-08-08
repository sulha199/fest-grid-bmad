import test from 'node:test';
import assert from 'node:assert';
import { enqueueScrapeJob, setSendSqsMessage } from './enqueue-scrape-job.js';

test('enqueue-scrape-job tests', async (t) => {
  await t.test('sends correct queue url and stringified target body', async () => {
    let sentQueueUrl = '';
    let sentBody = '';

    setSendSqsMessage(async (queueUrl, body) => {
      sentQueueUrl = queueUrl;
      sentBody = body;
    });

    // Artificially set SCRAPING_QUEUE_URL for the test
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/ScrapingQueue';

    const target = {
      profileId: 'profile-abc',
      platform: 'instagram' as const,
      accountId: 'account-123',
      username: 'test_user',
    };

    await enqueueScrapeJob(target);

    assert.strictEqual(sentQueueUrl, 'https://sqs.us-east-1.amazonaws.com/12345/ScrapingQueue');
    assert.deepStrictEqual(JSON.parse(sentBody), target);
  });
});
