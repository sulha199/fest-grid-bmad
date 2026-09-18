import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { handler } from './ai-processor.js';
import {
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
} from '../lib/aws/poll-and-drain-queue.js';
import { setCallGeminiSeam, callGeminiSeam, setMarkPostExtractedSeam, markPostExtractedSeam } from '../lib/ai-processor/process-ai-job.js';

// Covers AC13: proves ai-processor.ts's new `{ jobType: 'poll-and-drain' }` branch (AC6) calls
// pollAndDrainQueue with the queue URL sourced from AI_PROCESSING_QUEUE_URL (AC7 -- new to this
// Lambda's environment) and a per-message callback that parses the SQS body and forwards it to
// processAiJob -- using AC10's receiveSqsMessages/deleteSqsMessage test seams plus processAiJob's
// own existing callGeminiSeam/markPostExtractedSeam seams, rather than making real AWS/Gemini
// calls. This does NOT re-test the pre-existing SQSEvent-batch branch, which is unchanged.
test('ai-processor lambda poll-and-drain branch', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  const originalCallGeminiSeam = callGeminiSeam;
  const originalMarkPostExtractedSeam = markPostExtractedSeam;
  const originalQueueUrl = process.env.AI_PROCESSING_QUEUE_URL;

  t.after(() => {
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
    setCallGeminiSeam(originalCallGeminiSeam);
    setMarkPostExtractedSeam(originalMarkPostExtractedSeam);
    process.env.AI_PROCESSING_QUEUE_URL = originalQueueUrl;
  });

  await t.test('polls AI_PROCESSING_QUEUE_URL and forwards each message to processAiJob', async () => {
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';

    const receivedQueueUrls: string[] = [];
    let call = 0;
    setReceiveSqsMessages(async (queueUrl) => {
      receivedQueueUrls.push(queueUrl);
      call += 1;
      if (call === 1) {
        return [
          {
            Body: JSON.stringify({
              postId: 'post-poll-and-drain-test',
              // A syntactically-valid but non-existent UUID: getActiveSubscriberUserIds/the
              // socialMediaAccountProfiles lookup inside processAiJob require a real UUID
              // shape (a plain string would fail Postgres's uuid parsing before ever
              // reaching callGeminiSeam), but the row need not actually exist -- both
              // lookups degrade to "no rows found" rather than throwing.
              accountId: randomUUID(),
              content: 'Some post content',
              postUrl: 'https://test.com/p1',
              publishedAt: '2026-08-10T12:00:00Z',
            }),
            ReceiptHandle: 'rh-1',
          },
        ];
      }
      return [];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (queueUrl, receiptHandle) => {
      assert.strictEqual(queueUrl, 'https://sqs.mock-ai-processing-queue');
      deletedHandles.push(receiptHandle);
    });

    let callGeminiCalled = false;
    setCallGeminiSeam(async () => {
      callGeminiCalled = true;
      // isEvent: false takes processAiJob's early-return path -- no queue enqueue, no
      // image rehost -- just markPostExtractedSeam, keeping this test's side effects
      // minimal. eventName/types/categories/schedules are still AJV-required regardless
      // of isEvent's value, so minimal-but-valid values are supplied for each.
      return {
        text: JSON.stringify({
          isEvent: false,
          eventName: '',
          types: [],
          categories: [],
          schedules: [],
          confidenceScore: 0.1,
        }),
      };
    });

    let markPostExtractedCalled = false;
    setMarkPostExtractedSeam(async (postId) => {
      markPostExtractedCalled = true;
      assert.strictEqual(postId, 'post-poll-and-drain-test');
      return {} as any;
    });

    await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.deepStrictEqual(receivedQueueUrls, [
      'https://sqs.mock-ai-processing-queue',
      'https://sqs.mock-ai-processing-queue',
    ]);
    assert.ok(callGeminiCalled, 'callGemini should have been invoked via the forwarded message');
    assert.ok(markPostExtractedCalled, 'markPostExtracted should have been invoked, proving processAiJob ran to completion');
    assert.deepStrictEqual(deletedHandles, ['rh-1']);
  });

  await t.test('returns void, not an SQSBatchResponse, and does not fall through to the SQS-batch branch', async () => {
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';
    setReceiveSqsMessages(async () => []);
    setDeleteSqsMessage(async () => {});

    const result = await handler({ jobType: 'poll-and-drain' } as any, {} as any);

    assert.strictEqual(result, undefined);
  });
});
