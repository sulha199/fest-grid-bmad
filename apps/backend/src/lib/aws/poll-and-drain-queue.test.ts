import test from 'node:test';
import assert from 'node:assert';
import {
  pollAndDrainQueue,
  receiveSqsMessages,
  setReceiveSqsMessages,
  deleteSqsMessage,
  setDeleteSqsMessage,
  hasJobType,
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

  // Review Finding (Story 0.40 code review): receiveSqsMessages had no try/catch -- a
  // transient SQS error propagated uncaught and failed the whole invocation.
  await t.test('(e) a thrown receiveSqsMessages error is caught, logged, and does not reject', async () => {
    setReceiveSqsMessages(async () => {
      throw new Error('ReceiveMessage throttled');
    });

    const originalConsoleError = console.error;
    let loggedError: unknown;
    console.error = (...args: unknown[]) => {
      loggedError = args;
    };

    try {
      await assert.doesNotReject(pollAndDrainQueue('https://queue', async () => {}));
    } finally {
      console.error = originalConsoleError;
    }

    assert.ok(loggedError, 'expected the receive error to be logged');
  });

  // Review Finding (Story 0.40 code review): a message missing Body/ReceiptHandle was
  // silently skipped with zero logging.
  await t.test('(f) a message with missing Body/ReceiptHandle is skipped with a logged warning', async () => {
    let received = false;
    setReceiveSqsMessages(async () => {
      if (received) {
        return [];
      }
      received = true;
      return [{ Body: undefined, ReceiptHandle: 'rh-malformed' } as any];
    });
    setDeleteSqsMessage(async () => {});

    const originalConsoleWarn = console.warn;
    let loggedWarning: unknown;
    console.warn = (...args: unknown[]) => {
      loggedWarning = args;
    };

    const processedBodies: string[] = [];
    try {
      await pollAndDrainQueue('https://queue', async (body) => {
        processedBodies.push(body);
      });
    } finally {
      console.warn = originalConsoleWarn;
    }

    assert.deepStrictEqual(processedBodies, []);
    assert.ok(loggedWarning, 'expected the malformed message to be logged');
  });

  // Review Finding (Story 0.40 code review): the time budget was checked only after a whole
  // batch finished, never per-message, so a batch of slow handleMessage calls could overrun
  // the budget and risk the Lambda's own hard timeout.
  await t.test('(g) once the budget is spent mid-batch, the first message still runs but later ones in the same batch are skipped', async () => {
    let received = false;
    setReceiveSqsMessages(async () => {
      if (received) {
        return [];
      }
      received = true;
      return [
        { Body: 'first', ReceiptHandle: 'rh-first' },
        { Body: 'second', ReceiptHandle: 'rh-second' },
        { Body: 'third', ReceiptHandle: 'rh-third' },
      ];
    });

    const deletedHandles: string[] = [];
    setDeleteSqsMessage(async (_queueUrl, receiptHandle) => {
      deletedHandles.push(receiptHandle);
    });

    const processedBodies: string[] = [];
    await pollAndDrainQueue(
      'https://queue',
      async (body) => {
        processedBodies.push(body);
      },
      // Budget already expired before the loop starts: the first message in the batch is
      // still attempted (matching the "first receive always happens" guarantee), but the
      // 2nd/3rd must be skipped rather than risking a runaway batch past the Lambda timeout.
      { timeBudgetMs: 0 }
    );

    assert.deepStrictEqual(processedBodies, ['first']);
    assert.deepStrictEqual(deletedHandles, ['rh-first']);
  });
});

test('hasJobType', () => {
  // Review Finding (Story 0.40 code review): isPollAndDrainEvent/isStaleJobSweepEvent were
  // copy-pasted verbatim across scraper.ts/ai-processor.ts/ingestor.ts; this shared generic
  // guard replaces all 3 (plus scraper.ts's stale-job-sweep guard).
  assert.strictEqual(hasJobType({ jobType: 'poll-and-drain' }, 'poll-and-drain'), true);
  assert.strictEqual(hasJobType({ jobType: 'stale-job-sweep' }, 'poll-and-drain'), false);
  assert.strictEqual(hasJobType({ Records: [] }, 'poll-and-drain'), false);
  assert.strictEqual(hasJobType(null, 'poll-and-drain'), false);
  assert.strictEqual(hasJobType(undefined, 'poll-and-drain'), false);
});
