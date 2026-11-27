import test from 'node:test';
import assert from 'node:assert';
import { consumeEnqueuedStepCount, enqueueStepMessage } from './extraction-chain.js';
import { sendSqsMessage, setSendSqsMessage } from '../aws/send-sqs-message.js';

test('extraction-chain enqueued step count', async (t) => {
  const originalSendSqsMessage = sendSqsMessage;
  const originalQueueUrl = process.env.AI_PROCESSING_QUEUE_URL;
  process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.mock-ai-processing-queue';
  const message = { postId: 'p' } as never;

  t.beforeEach(() => {
    consumeEnqueuedStepCount();
  });
  t.afterEach(() => {
    setSendSqsMessage(originalSendSqsMessage);
  });
  t.after(() => {
    if (originalQueueUrl === undefined) delete process.env.AI_PROCESSING_QUEUE_URL;
    else process.env.AI_PROCESSING_QUEUE_URL = originalQueueUrl;
    consumeEnqueuedStepCount();
  });

  await t.test('counts each step message that was sent, with the inter-step delay', async () => {
    const sent: Array<number | undefined> = [];
    setSendSqsMessage(async (_url, _body, options) => { sent.push(options?.delaySeconds); });

    await enqueueStepMessage(message);
    await enqueueStepMessage(message);

    assert.deepStrictEqual(sent, [10, 10]);
    assert.strictEqual(consumeEnqueuedStepCount(), 2);
  });

  await t.test('reading the count resets it', async () => {
    setSendSqsMessage(async () => {});
    await enqueueStepMessage(message);
    assert.strictEqual(consumeEnqueuedStepCount(), 1);
    assert.strictEqual(consumeEnqueuedStepCount(), 0);
  });

  await t.test('a send that fails is not counted', async () => {
    setSendSqsMessage(async () => { throw new Error('queue outage'); });
    await assert.rejects(enqueueStepMessage(message), /queue outage/);
    assert.strictEqual(consumeEnqueuedStepCount(), 0);
  });
});
