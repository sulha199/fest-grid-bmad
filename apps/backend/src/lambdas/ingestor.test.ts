import test from 'node:test';
import assert from 'node:assert';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { socialMediaAccountProfiles, posts, events } from '@festgrid/database';
import { handler } from './ingestor.js';
import {
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
} from '../lib/aws/poll-and-drain-queue.js';

// Covers AC13: proves ingestor.ts's new `{ jobType: 'poll-and-drain' }` branch (AC6) calls
// pollAndDrainQueue with the queue URL sourced from DATA_INGESTION_QUEUE_URL (AC7 -- new to
// this Lambda's environment) and a per-message callback that parses the SQS body and forwards
// it to processIngestionJob -- using AC10's receiveSqsMessages/deleteSqsMessage test seams
// rather than making real AWS calls. This does NOT re-test the pre-existing SQSEvent-batch
// branch, which is unchanged. processIngestionJob itself has no test seam of its own (it always
// hits the real DB), so this test seeds a real profile/post row -- mirroring this codebase's
// existing integration-style test convention (e.g. process-ai-job.test.ts) -- to exercise the
// callback's forwarding for real rather than stubbing it away.
test('ingestor lambda poll-and-drain branch', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  const originalQueueUrl = process.env.DATA_INGESTION_QUEUE_URL;

  const testAccountId = 'platform-acc-ingestor-poll-drain-' + Date.now();
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: testAccountId,
      platform: 'instagram',
      displayName: 'Ingestor Poll Drain Account',
      username: 'ingestor_poll_drain_' + Date.now(),
    })
    .returning();

  const [post] = await db
    .insert(posts)
    .values({
      accountId: profile.id,
      platform: 'instagram',
      content: 'Event post content',
      postUrl: 'https://test.com/ingestor-poll-drain-' + Date.now(),
      publishedAt: new Date('2026-08-10T12:00:00Z'),
    })
    .returning();

  t.after(async () => {
    await db.delete(events).where(eq(events.postId, post.id));
    await db.delete(posts).where(eq(posts.id, post.id));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
    process.env.DATA_INGESTION_QUEUE_URL = originalQueueUrl;
  });

  await t.test('polls DATA_INGESTION_QUEUE_URL and forwards each message to processIngestionJob', async () => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-data-ingestion-queue';

    const receivedQueueUrls: string[] = [];
    let call = 0;
    setReceiveSqsMessages(async (queueUrl) => {
      receivedQueueUrls.push(queueUrl);
      call += 1;
      if (call === 1) {
        return [
          {
            Body: JSON.stringify({
              postId: post.id,
              eventName: 'Poll and Drain Test Event',
              location: 'Test City',
              schedules: [],
            }),
            ReceiptHandle: 'rh-1',
          },
        ];
      }
      return [];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (queueUrl, receiptHandle) => {
      assert.strictEqual(queueUrl, 'https://sqs.mock-data-ingestion-queue');
      deletedHandles.push(receiptHandle);
    });

    await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.deepStrictEqual(receivedQueueUrls, [
      'https://sqs.mock-data-ingestion-queue',
      'https://sqs.mock-data-ingestion-queue',
    ]);
    assert.deepStrictEqual(deletedHandles, ['rh-1'], 'message should be deleted only after processIngestionJob resolved');

    const [insertedEvent] = await db.select().from(events).where(eq(events.postId, post.id));
    assert.ok(insertedEvent, 'processIngestionJob should have inserted a real events row, proving the callback forwarded correctly');
    assert.strictEqual(insertedEvent.eventName, 'Poll and Drain Test Event');
  });

  await t.test('returns void, not an SQSBatchResponse, and does not fall through to the SQS-batch branch', async () => {
    process.env.DATA_INGESTION_QUEUE_URL = 'https://sqs.mock-data-ingestion-queue';
    setReceiveSqsMessages(async () => []);
    setDeleteSqsMessage(async () => {});

    const result = await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.strictEqual(result, undefined);
  });
});
