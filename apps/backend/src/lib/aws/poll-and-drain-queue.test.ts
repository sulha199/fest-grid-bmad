import test from 'node:test';
import assert from 'node:assert';
import {
  pollAndDrainQueue,
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
} from './poll-and-drain-queue.js';

test('poll-and-drain-queue tests', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;

  t.afterEach(() => {
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
  });

  await t.test('(a) loops across multiple receive calls until one returns empty', async () => {
    const receivedCalls: string[] = [];
    let call = 0;
    setReceiveSqsMessages(async (queueUrl) => {
      receivedCalls.push(queueUrl);
      call += 1;
      if (call === 1) {
        return [{ Body: 'msg-1', ReceiptHandle: 'rh-1' }];
      }
      if (call === 2) {
        return [{ Body: 'msg-2', ReceiptHandle: 'rh-2' }];
      }
      return [];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (_queueUrl, receiptHandle) => {
      deletedHandles.push(receiptHandle);
    });

    const processedBodies: string[] = [];
    await pollAndDrainQueue('https://queue', async (body) => {
      processedBodies.push(body);
    });

    assert.strictEqual(call, 3);
    assert.deepStrictEqual(receivedCalls, ['https://queue', 'https://queue', 'https://queue']);
    assert.deepStrictEqual(processedBodies, ['msg-1', 'msg-2']);
    assert.deepStrictEqual(deletedHandles, ['rh-1', 'rh-2']);
  });

  await t.test('(b) stops looping once the time budget elapses even if not yet empty', async () => {
    let call = 0;
    setReceiveSqsMessages(async () => {
      call += 1;
      // Always returns a message -- queue is never "drained" on its own.
      return [{ Body: `msg-${call}`, ReceiptHandle: `rh-${call}` }];
    });
    setDeleteSqsMessage(async () => {});

    await pollAndDrainQueue(
      'https://queue',
      async () => {},
      { timeBudgetMs: 0 }
    );

    // The first receive always happens regardless of budget; the loop must stop after
    // that batch is processed instead of continuing indefinitely.
    assert.strictEqual(call, 1);
  });

  await t.test('(c) deletes only messages whose handler resolved successfully', async () => {
    let received = false;
    setReceiveSqsMessages(async () => {
      if (received) {
        return [];
      }
      received = true;
      return [
        { Body: 'good', ReceiptHandle: 'rh-good' },
        { Body: 'bad', ReceiptHandle: 'rh-bad' },
      ];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (_queueUrl, receiptHandle) => {
      deletedHandles.push(receiptHandle);
    });

    await pollAndDrainQueue('https://queue', async (body) => {
      if (body === 'bad') {
        throw new Error('boom');
      }
    });

    assert.deepStrictEqual(deletedHandles, ['rh-good']);
  });

  await t.test('(d) a thrown handler error is caught and logged, not left unhandled', async () => {
    let received = false;
    setReceiveSqsMessages(async () => {
      if (received) {
        return [];
      }
      received = true;
      return [{ Body: 'bad', ReceiptHandle: 'rh-bad' }];
    });

    let deleteCalled = false;
    setDeleteSqsMessage(async () => {
      deleteCalled = true;
    });

    const originalConsoleError = console.error;
    let loggedError: unknown;
    console.error = (...args: unknown[]) => {
      loggedError = args;
    };

    try {
      await assert.doesNotReject(
        pollAndDrainQueue('https://queue', async () => {
          throw new Error('boom');
        })
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.strictEqual(deleteCalled, false);
    assert.ok(loggedError, 'expected the thrown error to be logged');
  });
});
