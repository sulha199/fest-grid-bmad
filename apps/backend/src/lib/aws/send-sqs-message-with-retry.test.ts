import test from 'node:test';
import assert from 'node:assert';
import { sendSqsMessageWithRetry } from './send-sqs-message-with-retry.js';
import { sendSqsMessage, setSendSqsMessage } from './send-sqs-message.js';

test('sendSqsMessageWithRetry tests', async (t) => {
  const originalSendSqsMessage = sendSqsMessage;

  t.afterEach(() => {
    setSendSqsMessage(originalSendSqsMessage);
  });

  await t.test('succeeds on the first attempt: sendSqsMessage called once, no onAttemptFailed call, resolves', async () => {
    let callCount = 0;
    let onAttemptFailedCallCount = 0;

    setSendSqsMessage(async () => {
      callCount++;
    });

    await sendSqsMessageWithRetry('https://queue.test', 'body-1', {
      backoffMs: 1,
      onAttemptFailed: () => {
        onAttemptFailedCallCount++;
      },
    });

    assert.strictEqual(callCount, 1);
    assert.strictEqual(onAttemptFailedCallCount, 0);
  });

  await t.test('fails twice then succeeds on the 3rd attempt (default maxAttempts): resolves, onAttemptFailed called exactly twice with attempt 1 and 2', async () => {
    let callCount = 0;
    const failedAttempts: number[] = [];

    setSendSqsMessage(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Simulated SQS failure on attempt ${callCount}`);
      }
    });

    await sendSqsMessageWithRetry('https://queue.test', 'body-2', {
      backoffMs: 1,
      onAttemptFailed: (attempt) => {
        failedAttempts.push(attempt);
      },
    });

    assert.strictEqual(callCount, 3);
    assert.deepStrictEqual(failedAttempts, [1, 2]);
  });

  await t.test('fails all maxAttempts times: rejects with the last thrown error, onAttemptFailed called maxAttempts times', async () => {
    let callCount = 0;
    const failedAttempts: number[] = [];

    setSendSqsMessage(async () => {
      callCount++;
      throw new Error(`Simulated SQS failure on attempt ${callCount}`);
    });

    await assert.rejects(
      () =>
        sendSqsMessageWithRetry('https://queue.test', 'body-3', {
          maxAttempts: 3,
          backoffMs: 1,
          onAttemptFailed: (attempt) => {
            failedAttempts.push(attempt);
          },
        }),
      /Simulated SQS failure on attempt 3/
    );

    assert.strictEqual(callCount, 3);
    assert.deepStrictEqual(failedAttempts, [1, 2, 3]);
  });
});
