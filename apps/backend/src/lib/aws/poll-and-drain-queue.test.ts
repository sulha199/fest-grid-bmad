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

test('poll-and-drain-queue per-message budget', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  t.afterEach(() => {
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
  });

  await t.test('asks for only as many messages as fit in the time budget, so none is received and left unhandled', async () => {
    const asked: Array<number | undefined> = [];
    setReceiveSqsMessages(async (_queueUrl, maxMessages) => {
      asked.push(maxMessages);
      return asked.length === 1 ? [{ Body: 'm', ReceiptHandle: 'rh' }] : [];
    });
    setDeleteSqsMessage(async () => {});

    // 270s budget / 135s per message = 2 messages per receive
    await pollAndDrainQueue('https://queue', async () => {}, { timeBudgetMs: 270_000, perMessageBudgetMs: 135_000 });
    assert.strictEqual(asked[0], 2);
  });

  await t.test('stops receiving once a further message no longer fits, but always makes the first receive', async () => {
    let receives = 0;
    setReceiveSqsMessages(async () => {
      receives += 1;
      return [{ Body: 'm', ReceiptHandle: 'rh' }];
    });
    setDeleteSqsMessage(async () => {});

    // The budget is smaller than one message's worst case: still one receive, then stop.
    await pollAndDrainQueue('https://queue', async () => {}, { timeBudgetMs: 100, perMessageBudgetMs: 10_000 });
    assert.strictEqual(receives, 1);
  });

  await t.test('without a per-message budget the receive is the unchanged 10-message one', async () => {
    const asked: Array<number | undefined> = [];
    setReceiveSqsMessages(async (_queueUrl, maxMessages) => {
      asked.push(maxMessages);
      return [];
    });
    await pollAndDrainQueue('https://queue', async () => {});
    assert.deepStrictEqual(asked, [undefined]);
  });
});

test('poll-and-drain-queue remaining-time guard', async (t) => {
  const originalReceiveSqsMessages = receiveSqsMessages;
  const originalDeleteSqsMessage = deleteSqsMessage;
  const originalConsoleWarn = console.warn;
  let warnings: string[] = [];
  t.beforeEach(() => {
    warnings = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
  });
  t.afterEach(() => {
    setReceiveSqsMessages(originalReceiveSqsMessages);
    setDeleteSqsMessage(originalDeleteSqsMessage);
    console.warn = originalConsoleWarn;
  });

  const batch = (...names: string[]) => names.map((n) => ({ Body: n, ReceiptHandle: `rh-${n}` }));

  await t.test('handles and deletes every message while remaining time stays at or above the minimum', async () => {
    let received = false;
    setReceiveSqsMessages(async () => {
      if (received) return [];
      received = true;
      return batch('a', 'b');
    });
    const deleted: string[] = [];
    setDeleteSqsMessage(async (_q, rh) => {
      deleted.push(rh);
    });

    const handled: string[] = [];
    await pollAndDrainQueue('https://queue', async (body) => { handled.push(body); }, {
      minRemainingMs: 90_000,
      getRemainingTimeInMillis: () => 90_000, // exactly the minimum is still enough
    });

    assert.deepStrictEqual(handled, ['a', 'b']);
    assert.deepStrictEqual(deleted, ['rh-a', 'rh-b']);
    assert.deepStrictEqual(warnings, []);
  });

  await t.test('stops mid-batch when a slow message uses up the time, leaving the rest undeleted and logging it', async () => {
    let remaining = 200_000;
    let received = false;
    setReceiveSqsMessages(async () => {
      if (received) return [];
      received = true;
      return batch('a', 'b', 'c');
    });
    const deleted: string[] = [];
    setDeleteSqsMessage(async (_q, rh) => {
      deleted.push(rh);
    });

    const handled: string[] = [];
    await pollAndDrainQueue('https://queue', async (body) => {
      handled.push(body);
      remaining = 80_000; // the first message ran long
    }, { minRemainingMs: 100_000, getRemainingTimeInMillis: () => remaining });

    assert.deepStrictEqual(handled, ['a']);
    assert.deepStrictEqual(deleted, ['rh-a']);
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /80000ms/);
    assert.match(warnings[0], /handled=1/);
    assert.match(warnings[0], /leftInFlight=2/);
  });

  await t.test('does not handle even the first message of a batch when the time is already short (long-poll ate it)', async () => {
    // Plenty of time until the receive returns; the receive itself is what uses it up.
    let remaining = 200_000;
    setReceiveSqsMessages(async () => {
      remaining = 50_000;
      return batch('a');
    });
    let deleted = 0;
    setDeleteSqsMessage(async () => { deleted += 1; });

    const handled: string[] = [];
    await pollAndDrainQueue('https://queue', async (body) => { handled.push(body); }, {
      minRemainingMs: 100_000,
      getRemainingTimeInMillis: () => remaining,
    });

    assert.deepStrictEqual(handled, []);
    assert.strictEqual(deleted, 0);
    assert.match(warnings[0], /handled=0/);
    assert.match(warnings[0], /leftInFlight=1/);
  });

  await t.test('does not even receive when the time is already short', async () => {
    let receives = 0;
    setReceiveSqsMessages(async () => {
      receives += 1;
      return batch('a');
    });
    setDeleteSqsMessage(async () => {});

    await pollAndDrainQueue('https://queue', async () => {}, {
      minRemainingMs: 100_000,
      getRemainingTimeInMillis: () => 99_999,
    });

    assert.strictEqual(receives, 0);
    assert.strictEqual(warnings.length, 1);
  });

  await t.test('stops before the next receive once a batch has spent the time', async () => {
    let remaining = 250_000;
    let receives = 0;
    setReceiveSqsMessages(async () => {
      receives += 1;
      return batch(`m${receives}`);
    });
    setDeleteSqsMessage(async () => {});

    const handled: string[] = [];
    await pollAndDrainQueue('https://queue', async (body) => {
      handled.push(body);
      remaining = 60_000;
    }, { minRemainingMs: 100_000, getRemainingTimeInMillis: () => remaining });

    assert.strictEqual(receives, 1);
    assert.deepStrictEqual(handled, ['m1']);
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /60000ms/);
    assert.match(warnings[0], /handled=1/);
  });

  await t.test('is disabled unless BOTH options are given', async () => {
    for (const opts of [{ minRemainingMs: 100_000 }, { getRemainingTimeInMillis: () => 0 }]) {
      let received = false;
      setReceiveSqsMessages(async () => {
        if (received) return [];
        received = true;
        return batch('a');
      });
      setDeleteSqsMessage(async () => {});
      const handled: string[] = [];
      await pollAndDrainQueue('https://queue', async (body) => { handled.push(body); }, opts);
      assert.deepStrictEqual(handled, ['a']);
    }
    assert.deepStrictEqual(warnings, []);
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
