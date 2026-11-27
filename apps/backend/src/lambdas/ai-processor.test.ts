import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { manualExtractionJobs, users } from '@festgrid/database';
import { db } from '../db/client.js';
import {
  setCallGeminiForManualExtractionSeam,
  callGeminiForManualExtractionSeam,
} from '../lib/ai-processor/process-manual-extraction-job.js';
import { handler } from './ai-processor.js';
import { loadBackendEnv } from '../env.js';
import {
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
  getQueueDepth,
  setGetQueueDepth,
} from '../lib/aws/poll-and-drain-queue.js';
import { setCallGeminiSeam, callGeminiSeam, setMarkPostExtractedSeam, markPostExtractedSeam } from '../lib/ai-processor/process-ai-job.js';
import { enqueueStepMessage } from '../lib/ai-processor/extraction-chain.js';
import { sendSqsMessage, setSendSqsMessage } from '../lib/aws/send-sqs-message.js';

// Covers AC13: proves ai-processor.ts's new `{ jobType: 'poll-and-drain' }` branch (AC6) calls
// pollAndDrainQueue with the queue URL sourced from AI_PROCESSING_QUEUE_URL (AC7 -- new to this
// Lambda's environment) and a per-message callback that parses the SQS body and forwards it to
// processAiJob -- using AC10's receiveSqsMessages/deleteSqsMessage test seams plus processAiJob's
// own existing callGeminiSeam/markPostExtractedSeam seams, rather than making real AWS/Gemini
// calls. This does NOT re-test the pre-existing SQSEvent-batch branch, which is unchanged.
test('ai-processor lambda poll-and-drain branch', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  const originalGetQueueDepth = getQueueDepth;
  const originalCallGeminiSeam = callGeminiSeam;
  const originalMarkPostExtractedSeam = markPostExtractedSeam;
  const originalQueueUrl = process.env.AI_PROCESSING_QUEUE_URL;
  // An empty receive consults the queue depth: stub it as drained so no test reaches the real SQS client.
  setGetQueueDepth(async () => 0);

  t.after(() => {
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
    setGetQueueDepth(originalGetQueueDepth);
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
      // minimal. Story 3.6s moved eventName/types/categories/schedules under the
      // post-level `events` array; an empty array is valid (and expected) when isEvent
      // is false.
      return {
        text: JSON.stringify({
          isEvent: false,
          events: [],
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

  // AD-47 Rule 5 / AD-52 Rule 5: a chain step is enqueued seconds before the next receive, so that receive must not trust
  // the queue-depth gate's approximate counts. The real step counter is bumped by the real enqueue helper here.
  await t.test('the receive after a handled message that enqueued a chain step is a long poll with no depth read', async () => {
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';
    const originalSendSqsMessage = sendSqsMessage;
    setSendSqsMessage(async () => {});
    try {
      const waits: Array<number | undefined> = [];
      let depthCalls = 0;
      setGetQueueDepth(async () => { depthCalls += 1; return 0; });
      let call = 0;
      setReceiveSqsMessages(async (_queueUrl, _maxMessages, waitTimeSeconds) => {
        waits.push(waitTimeSeconds);
        call += 1;
        return call === 1
          ? [{
              Body: JSON.stringify({
                postId: 'post-chain-hint-test',
                accountId: randomUUID(),
                content: 'Some post content',
                postUrl: 'https://test.com/p-chain-hint',
                publishedAt: '2026-08-10T12:00:00Z',
              }),
              ReceiptHandle: 'rh-chain-hint',
            }]
          : [];
      });
      // The handled message "put the next step on the queue": the delete stub runs right after the handler.
      setDeleteSqsMessage(async () => { await enqueueStepMessage({ postId: 'post-chain-hint-test' } as never); });
      setCallGeminiSeam(async () => ({ text: JSON.stringify({ isEvent: false, events: [] }) }));
      setMarkPostExtractedSeam(async () => ({} as any));

      await handler({ jobType: 'poll-and-drain' } as any, {} as any);

      assert.strictEqual(waits.length, 2);
      // The first receive depends on what the resume passes did against the test database; the second is the one
      // after the enqueue, and must be the plain long poll that never asks for the depth.
      assert.strictEqual(waits[1], 20);
      assert.strictEqual(depthCalls, 0);
    } finally {
      setSendSqsMessage(originalSendSqsMessage);
    }
  });

  // The drain budget derives from the face-blur floor, so the expected values below do too (rather than
  // assuming the 60s default, which an environment may override).
  const blurFloorMs = () => loadBackendEnv().faceBlurMinRemainingTimeMs;
  const minRemainingMs = () => blurFloorMs() + 40_000; // AI_MESSAGE_WORK_MARGIN_MS in ai-processor.ts

  // Drain budget: with face blurring on, the loop must size receives from a per-message budget and refuse to
  // start work late in the 300s timeout (message started with <60s left => cover blur fails closed, text-only).
  await t.test('blur on: receives are sized from the per-message budget, floor((remaining - min + 45000) / 45000)', async () => {
    const originalBlur = process.env.BLUR_FACES_BEFORE_AI;
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';
    try {
      const asked: Array<number | undefined> = [];
      setReceiveSqsMessages(async (_queueUrl, maxMessages) => {
        asked.push(maxMessages);
        return [];
      });
      setDeleteSqsMessage(async () => {});

      await handler({ jobType: 'poll-and-drain' } as any, { getRemainingTimeInMillis: () => 300_000 } as any);

      assert.deepStrictEqual(asked, [Math.floor((300_000 - minRemainingMs() + 45_000) / 45_000)]);
    } finally {
      if (originalBlur === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
      else process.env.BLUR_FACES_BEFORE_AI = originalBlur;
    }
  });

  await t.test('blur on: with less than floor + margin remaining nothing is received or handled', async () => {
    const originalBlur = process.env.BLUR_FACES_BEFORE_AI;
    process.env.BLUR_FACES_BEFORE_AI = 'true';
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';
    try {
      let receives = 0;
      setReceiveSqsMessages(async () => {
        receives += 1;
        return [];
      });
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        await handler({ jobType: 'poll-and-drain' } as any, { getRemainingTimeInMillis: () => minRemainingMs() - 1 } as any);
      } finally {
        console.warn = originalWarn;
      }

      assert.strictEqual(receives, 0);
    } finally {
      if (originalBlur === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
      else process.env.BLUR_FACES_BEFORE_AI = originalBlur;
    }
  });

  await t.test('blur off: the receive is the unchanged unsized one even with a Lambda context', async () => {
    const originalBlur = process.env.BLUR_FACES_BEFORE_AI;
    process.env.BLUR_FACES_BEFORE_AI = 'false';
    process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';
    try {
      const asked: Array<number | undefined> = [];
      setReceiveSqsMessages(async (_queueUrl, maxMessages) => {
        asked.push(maxMessages);
        return [];
      });

      await handler({ jobType: 'poll-and-drain' } as any, { getRemainingTimeInMillis: () => 300_000 } as any);

      assert.deepStrictEqual(asked, [undefined]);
    } finally {
      if (originalBlur === undefined) delete process.env.BLUR_FACES_BEFORE_AI;
      else process.env.BLUR_FACES_BEFORE_AI = originalBlur;
    }
  });
});

// Story 4.2b -- the asynchronous direct-invoke branch used by the API Lambda for manual
// "AI-Assisted Correction" extraction. Proves the handler routes `{ jobType: 'manual-extraction' }`
// to processManualExtractionJob (job gets claimed and completed) and never into the SQS-batch
// branch (which would throw on the missing `Records`).
test('ai-processor lambda manual-extraction branch (Story 4.2b)', async (t) => {
  const originalSeam = callGeminiForManualExtractionSeam;

  const [user] = await db.select().from(users).limit(1);
  assert.ok(user, 'Must have at least one seeded user');
  const [job] = await db
    .insert(manualExtractionJobs)
    .values({
      requestedByUserId: user.id,
      sourceUrl: 'https://www.instagram.com/p/handler-4-2b/',
      requestPayload: {
        message: {
          postId: randomUUID(),
          accountId: '',
          content: 'caption',
          postUrl: 'https://www.instagram.com/p/handler-4-2b/',
          publishedAt: '2026-08-29T10:24:17Z',
        },
      },
    })
    .returning();

  t.after(async () => {
    setCallGeminiForManualExtractionSeam(originalSeam);
    await db.delete(manualExtractionJobs).where(eq(manualExtractionJobs.id, job.id));
  });

  await t.test('routes to processManualExtractionJob and returns void', async () => {
    let called = false;
    setCallGeminiForManualExtractionSeam(async () => {
      called = true;
      return { text: JSON.stringify({ isEvent: false, events: [] }) } as any;
    });

    const result = await handler({ jobType: 'manual-extraction', jobId: job.id } as any, {} as any);

    assert.strictEqual(result, undefined);
    assert.ok(called, 'the manual extraction processor should have run');
    const [row] = await db.select().from(manualExtractionJobs).where(eq(manualExtractionJobs.id, job.id));
    assert.strictEqual(row.status, 'FAILED'); // isEvent:false -> EXTRACTION_FAILED, proving it ran to a terminal state
    assert.strictEqual(row.errorCode, 'EXTRACTION_FAILED');
  });
});
