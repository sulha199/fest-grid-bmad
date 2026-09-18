import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { handler } from './scraper.js';
import {
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
} from '../lib/aws/poll-and-drain-queue.js';

// Covers AC13: proves scraper.ts's new `{ jobType: 'poll-and-drain' }` branch (AC5) calls
// pollAndDrainQueue with the queue URL sourced from SCRAPING_QUEUE_URL (AC7 for the other two
// handlers; scraper.ts already had this env var) and a per-message callback that parses the
// SQS body and forwards it to processScrapeJob -- using AC10's receiveSqsMessages/
// deleteSqsMessage test seams rather than making real AWS calls. This does NOT re-test the
// pre-existing SQS-Records/stale-job-sweep/daily-batch branches, which are unchanged.
test('scraper lambda poll-and-drain branch', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  const originalQueueUrl = process.env.SCRAPING_QUEUE_URL;

  t.after(() => {
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
    process.env.SCRAPING_QUEUE_URL = originalQueueUrl;
  });

  await t.test('polls SCRAPING_QUEUE_URL and forwards each message to processScrapeJob', async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';

    const receivedQueueUrls: string[] = [];
    let call = 0;
    setReceiveSqsMessages(async (queueUrl) => {
      receivedQueueUrls.push(queueUrl);
      call += 1;
      if (call === 1) {
        return [
          {
            // A platform with no registered scraper adapter makes processScrapeJob take
            // its defensive catch path (getScraperAdapter throws synchronously, caught by
            // processScrapeJob's own try/catch) instead of reaching out to a real
            // scraping provider -- proving the callback correctly parses-and-forwards
            // without this test depending on live external services. profileId is a
            // syntactically-valid but non-existent UUID so the surrounding DB lookups
            // degrade to "no rows found"/no-op instead of a Postgres uuid-parse error.
            Body: JSON.stringify({
              profileId: randomUUID(),
              platform: 'poll-and-drain-test-platform',
              accountId: 'acc-1',
              username: 'test_user',
            }),
            ReceiptHandle: 'rh-1',
          },
        ];
      }
      return [];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (queueUrl, receiptHandle) => {
      assert.strictEqual(queueUrl, 'https://sqs.mock-scraping-queue');
      deletedHandles.push(receiptHandle);
    });

    await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.deepStrictEqual(receivedQueueUrls, [
      'https://sqs.mock-scraping-queue',
      'https://sqs.mock-scraping-queue',
    ]);
    assert.deepStrictEqual(deletedHandles, ['rh-1']);
  });

  await t.test('does not fall through to the SQS-Records/stale-job-sweep/daily-batch branches', async () => {
    process.env.SCRAPING_QUEUE_URL = 'https://sqs.mock-scraping-queue';
    setReceiveSqsMessages(async () => []);
    setDeleteSqsMessage(async () => {});

    // If this fell through to the 'Records' branch, `event.Records` would be undefined and
    // iterating it would throw synchronously.
    await assert.doesNotReject(handler({ jobType: 'poll-and-drain' } as any, {} as any));
  });
});
